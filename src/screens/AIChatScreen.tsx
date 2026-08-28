import React, { useState, useEffect, useRef, useCallback, Suspense, lazy } from "react";
import { useApp, ChatMessage } from "../AppContext";
import { API_BASE } from "../config";
import { ChatBubble } from "../components/ChatBubble";
import { ChatHistoryPanel } from "../components/ChatHistoryPanel";
import { ChatInput } from "../components/ChatInput";
import { WatermarkOverlay } from "../components/WatermarkOverlay";
import { Download, Sparkles, X, Users } from "lucide-react";

// ExpandedOverlay pulls in Leaflet + Recharts directly (~250KB+ of the main
// bundle) but only ever renders when a widget is actually expanded -- most
// chat turns never touch it. Deferring the import means Login/AIChat's
// first load no longer pays for a map/charting library it may never use.
const ExpandedOverlay = lazy(() =>
  import("../components/ExpandedOverlay").then((m) => ({ default: m.ExpandedOverlay }))
);

// Shared shape between the initial session-history fetch (handleSelectSession)
// and the cowork polling fallback below -- factored out so both stay in sync
// instead of drifting into two slightly different mappings over time.
const mapSessionMessages = (sessionId: string, messages: any[]): ChatMessage[] =>
  messages.map((m: any, idx: number) => ({
    id: `${sessionId}-${idx}`,
    sender: m.sender === "user" ? "user" : "assistant",
    text: m.text,
    textEn: m.text_en,
    textKn: m.text_kn,
    timestamp: m.timestamp
      ? new Date(m.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      : "",
    responseType: m.response_type,
    data: m.data,
    citations: m.citations,
    attachments: m.data?.attachments,
    senderName: m.sender_name,
    senderEmployeeId: m.sender_employee_id,
  }));

const MAX_ATTACHMENT_BYTES = 8 * 1024 * 1024;
const MAX_ATTACHMENTS_PER_MESSAGE = 3;
const MAX_AGGREGATE_BYTES = 20 * 1024 * 1024;
const ALLOWED_ATTACHMENT_TYPES = ["application/pdf", "image/jpeg", "image/jpg"];

export const AIChatScreen: React.FC = () => {
  const {
    t,
    lang,
    chatMessages,
    setChatMessages,
    badgeNumber,
    officerName,
    addToast,
    addNotification,
    setIsAuthenticated,
  } = useApp();

  const [inputVal, setInputVal] = useState("");
  // The real, backend-assigned session id for the active conversation. null
  // means "no session yet" -- /api/chat auto-creates one on the first turn
  // and returns it; every subsequent turn in this conversation reuses it so
  // messages land in the same ChatSession row instead of scattering across
  // synthetic per-request ids.
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  // Mirrors activeSessionId synchronously for handleSend's async callbacks
  // (see there) -- a GLM turn can take 15-140s+, and if the officer
  // navigates to a different conversation while one is still in flight, the
  // reply must not land in whatever conversation happens to be on screen
  // when it finally resolves. React state read inside a closure captured
  // before the navigation would still see the OLD activeSessionId; this ref
  // always reflects the current one.
  const activeSessionIdRef = useRef<string | null>(null);
  useEffect(() => { activeSessionIdRef.current = activeSessionId; }, [activeSessionId]);
  const [sessionsRefreshKey, setSessionsRefreshKey] = useState(0);
  // Which session (if any) is currently being fetched from the history
  // sidebar. Surfaced as an immediate spinner on the clicked row and a
  // skeleton in the thread -- previously a click gave zero feedback until
  // the fetch resolved, which reads as "not loading" even when it's working.
  const [loadingSessionId, setLoadingSessionId] = useState<string | null>(null);
  // Guards against a slow, now-stale session fetch overwriting the thread
  // after the officer has already clicked a different session (or "new
  // chat") while the first request was still in flight.
  const selectSessionRequestRef = useRef(0);
  // In-memory cache of already-loaded session transcripts, keyed by
  // session_id. Re-opening a session already visited this browser session
  // (a common workflow -- comparing two past cases back and forth) was
  // re-fetching the full message history over the network on every single
  // click, even the second time. Populated on navigate-away with whatever
  // is currently on screen (not just the server fetch result), so it always
  // reflects any messages sent live during that visit -- never goes stale.
  const sessionMessagesCacheRef = useRef<Map<string, ChatMessage[]>>(new Map());
  const [isRecording, setIsRecording] = useState(false);
  const [recordingStatus, setRecordingStatus] = useState("");
  const [voiceAvailable, setVoiceAvailable] = useState(true);
  // Which sessions currently have an AI turn in flight -- a Set, not a
  // single boolean, so waiting on one chat's reply no longer locks the
  // composer for every OTHER chat too. "__new__" covers a turn sent before
  // the backend has assigned a real session_id yet (a brand-new chat's
  // first message); pendingKeyRef below tracks which key a given send
  // should migrate from once that id arrives. isThinking (derived, not
  // stored) reflects only whether the SESSION CURRENTLY ON SCREEN is
  // pending, so switching to an idle chat re-enables its composer
  // immediately even while another chat is still waiting.
  const [pendingSessionIds, setPendingSessionIds] = useState<Set<string>>(new Set());
  const isThinking = pendingSessionIds.has(activeSessionId ?? "__new__");
  const markPending = useCallback((key: string) => {
    setPendingSessionIds((prev) => (prev.has(key) ? prev : new Set(prev).add(key)));
  }, []);
  const clearPending = useCallback((key: string) => {
    setPendingSessionIds((prev) => {
      if (!prev.has(key)) return prev;
      const next = new Set(prev);
      next.delete(key);
      return next;
    });
  }, []);
  const [thinkingType, setThinkingType] = useState<"standard" | "translation">("standard");
  // The deployed GLM model is a "thinking" model that reasons at length
  // before answering -- confirmed live, real turns commonly take 15-140s
  // (longer when a tool call needs a second LLM round-trip for synthesis).
  // A static "reasoning..." shimmer with no elapsed-time cue reads as a
  // frozen UI well before that; a live counter makes the wait legible
  // without needing to guess at (and risk understating) a fixed ETA.
  const [thinkingSeconds, setThinkingSeconds] = useState(0);

  const [expandedWidget, setExpandedWidget] = useState<{ type: "map" | "network" | "risk" | "forecast" | "timeline" | "mo_match" | "correlation" | "repeat_offenders" | "crime_groups" | "trend"; data: any } | null>(null);
  const [pendingAttachments, setPendingAttachments] = useState<File[]>([]);
  const [isUploadingAttachments, setIsUploadingAttachments] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);

  // Cowork mode: "chat" is today's solo behavior, unchanged. "cowork" shows
  // an invite prompt (once a session exists) and switches message delivery
  // over to the WebSocket broadcast so every participant sees the same
  // live thread instead of only the sender seeing their own optimistic update.
  const [chatMode, setChatMode] = useState<"chat" | "cowork">("chat");
  // Answer depth: "standard" (fast, one focused widget) or "dossier" (deep
  // Full Dossier -- forces the multi-panel composite for the query's case/
  // suspect). Chosen via the composer selector; persisted so the officer's
  // preference sticks across sessions.
  const [answerMode, setAnswerMode] = useState<"standard" | "dossier" | "compiler">(
    () => (localStorage.getItem("vajra_answer_mode") as "standard" | "dossier" | "compiler") || "standard"
  );
  useEffect(() => { localStorage.setItem("vajra_answer_mode", answerMode); }, [answerMode]);
  const [showInvitePanel, setShowInvitePanel] = useState(false);
  const [inviteBadge, setInviteBadge] = useState("");
  const [inviteRole, setInviteRole] = useState<"viewer" | "collaborator">("collaborator");
  const [isInviting, setIsInviting] = useState(false);
  const [hasParticipants, setHasParticipants] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  // client_msg_ids this tab has already rendered directly from its own HTTP
  // /api/chat response (both "<id>" for the user bubble and "<id>-ai" for
  // the assistant reply) -- the same turn also arrives over the WebSocket
  // broadcast a moment later (every participant, including the sender,
  // shares one broadcast channel), and without this the sender saw their
  // own message and its answer rendered twice.
  const sentClientMsgIdsRef = useRef<Set<string>>(new Set());

  // Poll proactive alerts. seenAlerts lives in a ref (not a local variable
  // inside the effect) so it survives if this effect ever re-runs for any
  // reason -- confirmed live that an unmemoized addToast() reference used
  // to cause exactly that (see the fix in AppContext.tsx), and a
  // effect-scoped Set silently resetting to empty on every re-run was what
  // turned "an alert popped up again" into thousands of duplicate toasts.
  const seenAlertsRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    const pollAlerts = async () => {
      try {
        const response = await fetch(`${API_BASE}/api/alerts`, {
          headers: {
            "Authorization": `Bearer ${localStorage.getItem("vajra_token") || ""}`,
          }
        });
        if (response.ok) {
          const alerts = await response.json();
          alerts.forEach((alert: any) => {
            const alertKey = `${alert.type}-${alert.timestamp}-${alert.details}`;
            if (!seenAlertsRef.current.has(alertKey)) {
              seenAlertsRef.current.add(alertKey);
              // Bell only, not a popup toast -- a first-login backlog can be
              // dozens of alerts deep, and popping a toast for each one
              // buried real on-screen controls under "+N more notifications".
              // alert.timestamp is the real TriggerTime from ProactiveAlerts,
              // not "now", so old alerts still read as old in the bell list.
              addNotification(
                alert.type === "SPATIAL_SPIKE" ? "🚨 Spatial Crime Spike" : "👤 Repeat Offender Alert",
                alert.details,
                "Warning",
                alert.timestamp
              );
            }
          });
        }
      } catch (err) {
        console.error("Alerts polling failed:", err);
      }
    };

    pollAlerts();
    const interval = setInterval(pollAlerts, 15000);
    return () => clearInterval(interval);
  }, [addNotification]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages, isThinking]);

  // Elapsed-time ticker for the thinking indicator -- see thinkingSeconds decl.
  useEffect(() => {
    if (!isThinking) {
      setThinkingSeconds(0);
      return;
    }
    const interval = setInterval(() => setThinkingSeconds((s) => s + 1), 1000);
    return () => clearInterval(interval);
  }, [isThinking]);

  // Voice input runs entirely client-side via the browser's own Web Speech
  // API -- no server-side STT service exists (the backend's own
  // /api/voice/process-stream is an honest, permanent 503; Zia has no
  // speech service in its current catalog either, confirmed earlier this
  // project). Availability is a browser-support question now, not a
  // backend-config one: Chrome/Edge support SpeechRecognition, Firefox and
  // most non-Chromium browsers as of this writing do not.
  useEffect(() => {
    const SpeechRecognitionCtor = window.SpeechRecognition || window.webkitSpeechRecognition;
    setVoiceAvailable(Boolean(SpeechRecognitionCtor));
  }, []);

  // Live message push for Cowork sessions -- a real WebSocket on the same
  // backend process (AppSail hosts this as a persistent server, not
  // serverless-per-request, so holding a socket open is genuinely viable).
  // Connects for every active session (not just Cowork ones) so the flow is
  // uniform; solo sessions just never have anyone else to broadcast to.
  useEffect(() => {
    if (!activeSessionId || chatMode !== "cowork" || API_BASE.includes("catalystappsail.in")) return;

    const wsProtocol = API_BASE.startsWith("https") ? "wss" : "ws";
    const wsHost = API_BASE.replace(/^https?:\/\//, "");
    const token = localStorage.getItem("vajra_token") || "";
    let ws: WebSocket | null = null;
    try {
      ws = new WebSocket(`${wsProtocol}://${wsHost}/ws/chat/${activeSessionId}?token=${encodeURIComponent(token)}`);
      wsRef.current = ws;

      ws.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          if (payload.type !== "message") return;
          if (payload.client_msg_id && sentClientMsgIdsRef.current.has(payload.client_msg_id)) {
            sentClientMsgIdsRef.current.delete(payload.client_msg_id);
            if (payload.sender === "assistant") clearPending(activeSessionId ?? "__new__");
            return;
          }
          setChatMessages((prev) => {
            const newMsg: ChatMessage = {
              id: `ws-${Date.now()}-${Math.random()}`,
              sender: payload.sender === "user" ? "user" : "assistant",
              text: payload.text,
              textEn: payload.text_en,
              textKn: payload.text_kn,
              timestamp: new Date(payload.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
              responseType: payload.response_type,
              data: payload.data,
              citations: payload.citations,
              senderName: payload.sender_name,
              senderEmployeeId: payload.sender_employee_id,
              isSimulated: payload.is_simulated,
              simulatedReason: payload.simulated_reason,
            };
            return [...prev, newMsg];
          });
          if (payload.sender === "assistant") {
            clearPending(activeSessionId ?? "__new__");
          }
        } catch (err) {
          console.error("Failed to parse WebSocket message:", err);
        }
      };

      ws.onerror = () => {
        // Quiet
      };
    } catch {
      // Quiet
    }

    return () => {
      if (ws) ws.close();
      wsRef.current = null;
    };
  }, [activeSessionId, chatMode, clearPending]);

  // Whether the active session already has a real participant (used to
  // decide whether "Cowork" mode shows an invite prompt or just behaves
  // as a normal shared thread).
  useEffect(() => {
    if (!activeSessionId) {
      setHasParticipants(false);
      return;
    }
    fetch(`${API_BASE}/api/cowork/sessions`, {
      headers: { "Authorization": `Bearer ${localStorage.getItem("vajra_token") || ""}` },
    })
      .then((res) => (res.ok ? res.json() : []))
      .then((sessions: any[]) => setHasParticipants(sessions.some((s) => s.session_id === activeSessionId)))
      .catch(() => setHasParticipants(false));
  }, [activeSessionId]);

  // Cowork live-push replacement: Zoho Catalyst's AppSail gateway (ZGS)
  // does not proxy WebSocket upgrade requests in this environment --
  // confirmed directly, a raw handshake against /ws/chat/... comes back a
  // plain HTTP 404 from FastAPI itself, not a 101 Switching Protocols, so
  // the browser's WebSocket connection can never succeed here regardless of
  // anything in this app's own code. Short-interval polling is the real
  // working substitute: only runs for genuine multi-participant sessions
  // (not every solo chat), and only ever grows the thread -- if the server
  // has no more messages than what's already on screen, this is a silent
  // no-op, so it can never clobber an in-flight optimistic update with
  // stale data.
  useEffect(() => {
    if (!activeSessionId || !hasParticipants) return;
    const pollForNewMessages = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/sessions/${activeSessionId}/messages`, {
          headers: { Authorization: `Bearer ${localStorage.getItem("vajra_token") || ""}` },
        });
        if (!res.ok) return;
        const raw = await res.json();
        const loaded = mapSessionMessages(activeSessionId, raw);
        sessionMessagesCacheRef.current.set(activeSessionId, loaded);
        setChatMessages((prev) => (loaded.length > prev.length ? loaded : prev));
      } catch {
        // Silent -- this is a background convenience poll, not a
        // user-initiated action; a transient failure just means this
        // particular tick found nothing new, next tick tries again.
      }
    };
    const interval = setInterval(pollForNewMessages, 4000);
    return () => clearInterval(interval);
  }, [activeSessionId, hasParticipants]);



  // Appends a message belonging to `turnSessionId` -- if that's still the
  // conversation on screen, updates the live thread as before; if the
  // officer has since navigated to a different conversation (a GLM turn can
  // run 15-140s+, easily long enough to switch away and back), it patches
  // that session's cache entry directly instead of dumping the reply into
  // whatever's currently displayed. Confirmed live: without this, a reply
  // that arrived after navigating away either vanished (never made it into
  // either conversation's cache) or appeared in the wrong thread.
  const appendMessageForTurn = useCallback((msg: ChatMessage, turnSessionId: string | null) => {
    if (activeSessionIdRef.current === turnSessionId) {
      setChatMessages((prev) => [...prev, msg]);
      return;
    }
    if (turnSessionId) {
      const existing = sessionMessagesCacheRef.current.get(turnSessionId) || [];
      sessionMessagesCacheRef.current.set(turnSessionId, [...existing, msg]);
    }
  }, []);

  // /api/chat now returns a fast "pending" ack and finishes the real GLM
  // turn in a server-side background task (see _run_ai_turn_and_persist in
  // main.py) -- AppSail's own gateway kills the underlying HTTP request at
  // ~30-36s regardless of any in-app timeout, well short of this model's
  // real 15-140s+ response times, so the answer can never come back on the
  // original request. Poll session history (the same endpoint Cowork's
  // live-push replacement already polls) until the persisted reply shows
  // up, using a raw message-count baseline fetched right after the ack --
  // comparing against local React state here would conflate not-yet-
  // persisted optimistic messages with the real server count.
  const pollForPendingReply = useCallback(async (turnSessionId: string | null, baselineCount: number) => {
    if (!turnSessionId) return;
    const maxAttempts = 40; // ~2 minutes at 3s apiece
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, 3000));
      try {
        const res = await fetch(`${API_BASE}/api/sessions/${turnSessionId}/messages`, {
          headers: { Authorization: `Bearer ${localStorage.getItem("vajra_token") || ""}` },
        });
        if (!res.ok) continue;
        const raw = await res.json();
        if (raw.length > baselineCount) {
          const loaded = mapSessionMessages(turnSessionId, raw);
          sessionMessagesCacheRef.current.set(turnSessionId, loaded);
          if (activeSessionIdRef.current === turnSessionId) {
            setChatMessages(loaded);
          }
          return;
        }
      } catch {
        // Transient -- next tick tries again.
      }
    }
    // Gave up -- tell the officer plainly rather than leaving the composer
    // stuck on "Thinking..." forever with no explanation.
    appendMessageForTurn({
      id: `msg-${Date.now()}-timeout`,
      sender: "assistant",
      text: lang === "en"
        ? "This is taking longer than expected. The response may still arrive shortly -- check back, or try again."
        : "ಇದು ನಿರೀಕ್ಷಿತಕ್ಕಿಂತ ಹೆಚ್ಚು ಸಮಯ ತೆಗೆದುಕೊಳ್ಳುತ್ತಿದೆ. ಪ್ರತಿಕ್ರಿಯೆ ಶೀಘ್ರದಲ್ಲೇ ಬರಬಹುದು -- ಮತ್ತೆ ಪರಿಶೀಲಿಸಿ ಅಥವಾ ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.",
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      isSimulated: true,
      simulatedReason: lang === "en" ? "response_delayed" : "ಪ್ರತಿಕ್ರಿಯೆ_ವಿಳಂಬವಾಗಿದೆ",
    }, turnSessionId);
  }, [lang, appendMessageForTurn]);

  // Submit Text Query to Copilot Agent Loop
  const handleSend = useCallback(async (textToSend: string, filesToSend: File[] = []) => {
    if (isThinking || isUploadingAttachments) return;
    if (!textToSend.trim() && filesToSend.length === 0) return;

    // The conversation this turn belongs to, fixed at send-time -- used
    // below to route the eventual reply correctly even if the officer
    // navigates elsewhere while it's still in flight. null means "brand new
    // chat, no session yet" (resolved to the real id once the response
    // hands one back).
    const sendSessionId = activeSessionIdRef.current;
    // Tracks whichever key pendingSessionIds actually has this turn under
    // right now -- starts as sendSessionId (or "__new__"), migrates to the
    // real session_id once the backend assigns one. finally always clears
    // THIS key, unconditionally, regardless of which chat is on screen.
    let pendingKey = sendSessionId ?? "__new__";

    let queryForAgent = textToSend;
    let uploadedAttachmentRefs: { file_name: string; type: string; page_count: number; stratus_id?: string; data_uri?: string }[] = [];
    if (filesToSend.length > 0) {
      setIsUploadingAttachments(true);
      try {
        const formData = new FormData();
        filesToSend.forEach((f) => formData.append("files", f));
        const uploadRes = await fetch(`${API_BASE}/api/chat/attachments`, {
          method: "POST",
          headers: { "Authorization": `Bearer ${localStorage.getItem("vajra_token") || ""}` },
          body: formData,
        });
        if (uploadRes.ok) {
          const uploadData = await uploadRes.json();
          uploadedAttachmentRefs = uploadData.attachments || [];
          if (uploadData.attachment_analysis) {
            queryForAgent = `Attachment analysis: ${uploadData.attachment_analysis}\n\n${textToSend}`;
          }
        } else {
          const errData = await uploadRes.json().catch(() => ({}));
          addToast(
            lang === "en" ? "Attachment Upload Failed" : "ಲಗತ್ತು ಅಪ್‌ಲೋಡ್ ವಿಫಲವಾಗಿದೆ",
            errData.detail || (lang === "en" ? "Could not process attachments." : "ಲಗತ್ತುಗಳನ್ನು ಪ್ರಕ್ರಿಯೆಗೊಳಿಸಲು ಸಾಧ್ಯವಾಗಲಿಲ್ಲ."),
            "Critical"
          );
          setIsUploadingAttachments(false);
          return;
        }
      } catch (err) {
        console.error("Attachment upload failed:", err);
        addToast(
          lang === "en" ? "Attachment Upload Failed" : "ಲಗತ್ತು ಅಪ್‌ಲೋಡ್ ವಿಫಲವಾಗಿದೆ",
          lang === "en" ? "Could not reach the server to process attachments." : "ಲಗತ್ತುಗಳನ್ನು ಪ್ರಕ್ರಿಯೆಗೊಳಿಸಲು ಸರ್ವರ್ ತಲುಪಲು ಸಾಧ್ಯವಾಗಲಿಲ್ಲ.",
          "Critical"
        );
        setIsUploadingAttachments(false);
        return;
      }
      setIsUploadingAttachments(false);
    }

    // Rendered directly from this call's own HTTP response below, always --
    // reliable regardless of whether the WebSocket happens to be connected,
    // mid-reconnect, or drops the broadcast (confirmed live: relying on the
    // broadcast alone for every message after the first meant a turn could
    // go through on the server but never appear on screen until a manual
    // refresh). client_msg_id lets the WS handler recognize and skip the
    // broadcast echo of this exact turn instead of rendering it a second
    // time once it arrives.
    const clientMsgId = `cmid-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    sentClientMsgIdsRef.current.add(clientMsgId);
    sentClientMsgIdsRef.current.add(`${clientMsgId}-ai`);
    const userMsg: ChatMessage = {
      id: `msg-${Date.now()}-user`,
      sender: "user",
      text: textToSend,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      attachments: uploadedAttachmentRefs.length > 0 ? uploadedAttachmentRefs : undefined,
      senderName: officerName || undefined,
    };
    setChatMessages((prev) => [...prev, userMsg]);
    setInputVal("");
    setThinkingType(lang === "kn" ? "translation" : "standard");
    // Keyed by sendSessionId (or "__new__"), not a bare flag -- this is the
    // fix for the composer locking up for every OTHER chat while this one
    // is still waiting. Migrated to the real session_id once the backend
    // assigns one (see below), and cleared by pollForPendingReply / the
    // finally block regardless of which chat is on screen when that happens.
    markPending(sendSessionId ?? "__new__");

    try {
      const response = await fetch(`${API_BASE}/api/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${localStorage.getItem("vajra_token") || ""}`,
        },
        body: JSON.stringify({
          message: queryForAgent,
          display_text: textToSend,
          lang: lang,
          session_id: sendSessionId,
          client_msg_id: clientMsgId,
          // Previously never sent -- uploadedAttachmentRefs only fed the
          // LOCAL optimistic bubble (userMsg above), so the backend had
          // nothing to persist and the attachment reference vanished the
          // moment the session reloaded from history. The backend already
          // accepts and stores this field (ChatRequest.attachments); it was
          // just never actually populated from here.
          attachments: uploadedAttachmentRefs.length > 0 ? uploadedAttachmentRefs : undefined,
          // Standard vs Full Dossier -- chosen in the composer selector.
          answer_mode: answerMode,
        }),
      });

      if (response.status === 401) {
        addToast(
          lang === "en" ? "Session Expired" : "ಅಧಿವೇಶನ ಅವಧಿ ಮುಗಿದಿದೆ",
          lang === "en" ? "Please sign in again to establish a secure logon." : "ಸುರಕ್ಷಿತ ಲಾಗಿನ್ ಸ್ಥಾಪಿಸಲು ದಯವಿಟ್ಟು ಮತ್ತೊಮ್ಮೆ ಲಾಗ್ ಇನ್ ಮಾಡಿ.",
          "Warning"
        );
        setIsAuthenticated(false);
        return;
      }

      if (!response.ok) {
        throw new Error("Logon or database offline. Failed to receive AI reasoning.");
      }

      const data = await response.json();
      // Resolved id for THIS turn -- sendSessionId for an existing
      // conversation, or the id the backend just auto-created if this was
      // the first message of a brand new one.
      const turnSessionId = sendSessionId || data.session_id || null;

      // First turn of a new conversation: the backend just auto-created a
      // real ChatSession and handed back its id. Only auto-adopt it (switch
      // the visible thread over) if the officer is still exactly where they
      // were when they sent it -- otherwise they've already navigated
      // elsewhere (a new chat reset, or an existing conversation) and
      // forcing them back would be as disruptive as the bug this whole
      // function exists to prevent. The sidebar refresh is always safe.
      if (!sendSessionId && data.session_id) {
        setSessionsRefreshKey((k) => k + 1);
        // Migrate the pending marker from the "__new__" bucket to the real
        // id now that one exists, so the eventual clear (here or inside
        // pollForPendingReply) actually finds and removes it.
        clearPending(pendingKey);
        pendingKey = data.session_id;
        markPending(pendingKey);
        if (activeSessionIdRef.current === sendSessionId) {
          setActiveSessionId(data.session_id);
          // If the officer picked "Cowork" mode before sending the first
          // message, the session now exists -- prompt for who to invite.
          if (chatMode === "cowork") {
            setShowInvitePanel(true);
          }
        }
      }

      if (data.pending) {
        // The real answer isn't back yet -- it's still running server-side.
        // Fetch the current message count as a baseline, then poll until it
        // grows (see pollForPendingReply above). isThinking deliberately
        // stays true across this whole await -- the `finally` below only
        // fires once the poll resolves (success or gives-up timeout).
        const baselineRes = await fetch(`${API_BASE}/api/sessions/${turnSessionId}/messages`, {
          headers: { Authorization: `Bearer ${localStorage.getItem("vajra_token") || ""}` },
        });
        const baselineRaw = baselineRes.ok ? await baselineRes.json() : [];
        await pollForPendingReply(turnSessionId, baselineRaw.length);
      } else if (data.ai_invoked !== false) {
        // Rendered directly from this response, always -- see clientMsgId
        // comment above for why. The WS handler skips its own echo of this
        // exact turn via sentClientMsgIdsRef. Routed via appendMessageForTurn
        // so a reply arriving after the officer has navigated elsewhere lands
        // in the right conversation's cache instead of the one on screen.
        const aiMsg: ChatMessage = {
          id: `msg-${Date.now()}-ai`,
          sender: "assistant",
          text: data.text,
          textEn: data.text_en,
          textKn: data.text_kn,
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          responseType: data.response_type,
          data: data.data,
          isSimulated: data.is_simulated,
          simulatedReason: data.simulated_reason,
          citations: data.citations,
          retryText: data.is_simulated ? textToSend : undefined,
        };
        appendMessageForTurn(aiMsg, turnSessionId);
      }
    } catch (err: any) {
      console.error(err);
      const errorMsg: ChatMessage = {
        id: `msg-${Date.now()}-err`,
        sender: "assistant",
        text: lang === "en"
          ? "I am unable to reach the VAJRA server. Please verify that your network connection is active and that backend services are running."
          : "ವಜ್ರ ಸರ್ವರ್ ತಲುಪಲು ಸಾಧ್ಯವಾಗುತ್ತಿಲ್ಲ. ದಯವಿಟ್ಟು ನಿಮ್ಮ ನೆಟ್‌ವರ್ಕ್ ಸಂಪರ್ಕ ಸಕ್ರಿಯವಾಗಿದೆಯೇ ಮತ್ತು ಬ್ಯಾಕೆಂಡ್ ಸೇವೆಗಳು ಚಾಲನೆಯಲ್ಲಿವೆಯೇ ಎಂದು ಪರಿಶೀಲಿಸಿ.",
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        // A network/server failure previously rendered as isSimulated:false,
        // which gives it the exact same bubble styling as a real successful
        // answer -- an officer had no visual signal that the system failed
        // to respond at all versus actually answering. Reuse the existing
        // amber "AI Unavailable" treatment (already correct for this case)
        // instead of inventing a new state.
        isSimulated: true,
        simulatedReason: lang === "en" ? "connection_failed" : "ಸಂಪರ್ಕ_ವಿಫಲವಾಗಿದೆ",
        retryText: textToSend,
      };
      appendMessageForTurn(errorMsg, sendSessionId);
    } finally {
      // The single clear point for every path (pending-poll, immediate
      // answer, and error) -- unconditional and keyed by pendingKey, not
      // gated on which chat happens to be on screen right now. That
      // gating was exactly the bug: switching chats while a reply was in
      // flight meant this line never ran, leaving the composer locked
      // everywhere until a page refresh.
      clearPending(pendingKey);
      if (activeSessionIdRef.current === sendSessionId) {
        setThinkingType("standard");
      }
    }
  }, [isThinking, isUploadingAttachments, lang, addToast, setIsAuthenticated, chatMode, appendMessageForTurn, pollForPendingReply, markPending, clearPending, answerMode]);

  // Start a fresh conversation -- clears the transcript and drops the active
  // session id, so the next message sent auto-creates a brand new ChatSession.
  const handleNewChat = () => {
    // Invalidate any in-flight handleSelectSession fetch so it can't land
    // after this and clobber the fresh blank thread.
    selectSessionRequestRef.current++;
    setLoadingSessionId(null);
    // Snapshot the outgoing session into the cache first, same as
    // handleSelectSession, so a later click back into it via the sidebar
    // hits the instant cache path instead of re-fetching.
    if (activeSessionId) {
      sessionMessagesCacheRef.current.set(activeSessionId, chatMessages);
    }
    setChatMessages([]);
    setActiveSessionId(null);
    setChatMode("chat");
    setHasParticipants(false);
    fetchSuggestionSeeds();
  };

  // Toggling to Cowork on a session that already exists but has no
  // participants yet -- prompt right away instead of waiting for the next
  // message. A brand-new (no session yet) chat instead waits until the
  // first message actually creates the session (handled in handleSend).
  const handleToggleCowork = (mode: "chat" | "cowork") => {
    setChatMode(mode);
    if (mode === "cowork" && activeSessionId && !hasParticipants) {
      setShowInvitePanel(true);
    }
  };

  const handleSendInvite = async () => {
    if (!activeSessionId) return;
    if (!/^\d{7}$/.test(inviteBadge)) {
      addToast(
        lang === "en" ? "Invalid Badge Number" : "ಅಮಾನ್ಯ ಬ್ಯಾಡ್ಜ್ ಸಂಖ್ಯೆ",
        lang === "en" ? "Badge (KGID) must be exactly 7 digits." : "ಬ್ಯಾಡ್ಜ್ (KGID) ನಿಖರವಾಗಿ ೭ ಅಂಕಿಗಳಾಗಿರಬೇಕು.",
        "Warning"
      );
      return;
    }
    setIsInviting(true);
    try {
      const response = await fetch(`${API_BASE}/api/cowork/invite`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${localStorage.getItem("vajra_token") || ""}`,
        },
        body: JSON.stringify({ session_id: activeSessionId, invitee_badge: inviteBadge, role: inviteRole }),
      });
      const resData = await response.json().catch(() => ({}));
      if (!response.ok) {
        addToast(
          lang === "en" ? "Invite Failed" : "ಆಹ್ವಾನ ವಿಫಲವಾಗಿದೆ",
          resData.detail || (lang === "en" ? "Could not send invitation." : "ಆಹ್ವಾನ ಕಳುಹಿಸಲು ಸಾಧ್ಯವಾಗಲಿಲ್ಲ."),
          "Critical"
        );
        return;
      }
      addToast(
        lang === "en" ? "Invitation Sent" : "ಆಹ್ವಾನ ಕಳುಹಿಸಲಾಗಿದೆ",
        lang === "en" ? `Badge ${inviteBadge} invited as ${inviteRole}.` : `ಬ್ಯಾಡ್ಜ್ ${inviteBadge} ಅನ್ನು ${inviteRole === "viewer" ? "ವೀಕ್ಷಕ" : "ಸಹಯೋಗಿ"} ಆಗಿ ಆಹ್ವಾನಿಸಲಾಗಿದೆ.`,
        "Success"
      );
      setShowInvitePanel(false);
      setInviteBadge("");
    } catch (err) {
      console.error("Failed to send cowork invite:", err);
      addToast(
        lang === "en" ? "Invite Failed" : "ಆಹ್ವಾನ ವಿಫಲವಾಗಿದೆ",
        lang === "en" ? "Could not reach the server." : "ಸರ್ವರ್ ತಲುಪಲು ಸಾಧ್ಯವಾಗಲಿಲ್ಲ.",
        "Critical"
      );
    } finally {
      setIsInviting(false);
    }
  };

  // Resume a past conversation from the history sidebar. Gives immediate
  // visual feedback (spinner on the clicked row + thread skeleton) instead
  // of appearing frozen while the fetch is in flight, and ignores its own
  // response if a newer session-select/new-chat has since superseded it.
  const handleSelectSession = async (sessionId: string) => {
    if (sessionId === activeSessionId && !loadingSessionId) return;

    const requestId = ++selectSessionRequestRef.current;
    setLoadingSessionId(sessionId);
    try {
      const response = await fetch(`${API_BASE}/api/sessions/${sessionId}/messages`, {
        headers: { "Authorization": `Bearer ${localStorage.getItem("vajra_token") || ""}` },
      });
      if (!response.ok) {
        throw new Error("Failed to load session history.");
      }
      const messages = await response.json();
      if (requestId !== selectSessionRequestRef.current) return; // superseded

      const loaded = mapSessionMessages(sessionId, messages);
      setChatMessages(loaded);
      setActiveSessionId(sessionId);
    } catch (err) {
      if (requestId !== selectSessionRequestRef.current) return; // superseded
      console.error(err);
      addToast(
        lang === "en" ? "Failed to Load Session" : "ಅಧಿವೇಶನ ಲೋಡ್ ವಿಫಲವಾಗಿದೆ",
        lang === "en" ? "Could not retrieve past conversation history." : "ಹಿಂದಿನ ಸಂಭಾಷಣೆ ಇತಿಹಾಸವನ್ನು ಪಡೆಯಲು ಸಾಧ್ಯವಾಗಲಿಲ್ಲ.",
        "Critical"
      );
    } finally {
      if (requestId === selectSessionRequestRef.current) setLoadingSessionId(null);
    }
  };

  // Export Transcript to PDF
  const handleExportPDF = async () => {
    if (isExportingPdf) return;
    setIsExportingPdf(true);
    try {
      const transcript = chatMessages.map((m) => ({
        role: m.sender,
        // Respect the officer's CURRENTLY selected language, not whichever one
        // was active when each message first came in.
        content: m.sender === "assistant"
          ? (lang === "kn" ? (m.textKn || m.text) : (m.textEn || m.text))
          : m.text,
        timestamp: m.timestamp || "",
      }));
      // Export is available to any authenticated officer -- no supervisor
      // co-sign. The document is still authenticated and attributed to the
      // real logged-in badge server-side.
      const response = await fetch(`${API_BASE}/api/chat/export-pdf`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${localStorage.getItem("vajra_token") || ""}` },
        body: JSON.stringify({
          transcript,
          badge_id: badgeNumber || "KSP-4003385",
        }),
      });

      if (!response.ok) {
        const d = await response.json().catch(() => ({}));
        throw new Error(d.detail || "Failed to compile PDF.");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `VAJRA_Transcript_${badgeNumber || "4003385"}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (err) {
      console.error(err);
      addToast(
        lang === "en" ? "Export Failed" : "ರಫ್ತು ವಿಫಲವಾಗಿದೆ",
        lang === "en" ? "Could not generate PDF conversation transcript." : "PDF ಸಂಭಾಷಣೆ ಪ್ರತಿಲಿಪಿಯನ್ನು ರಚಿಸಲು ಸಾಧ್ಯವಾಗಲಿಲ್ಲ.",
        "Critical"
      );
    } finally {
      setIsExportingPdf(false);
    }
  };

  // Built from real accused/district/crime-type values fetched fresh from
  // /api/chat/suggestions -- previously a static array that always said
  // "suspect Ramesh" on every single load, regardless of what's actually in
  // the database. Re-fetched on New Chat too (see handleNewChat) so the
  // chips don't just go stale after the first turn.
  const [suggestionSeeds, setSuggestionSeeds] = useState<{ suspect: string; district: string; crime_type: string } | null>(null);
  const fetchSuggestionSeeds = useCallback(() => {
    fetch(`${API_BASE}/api/chat/suggestions`, {
      headers: { Authorization: `Bearer ${localStorage.getItem("vajra_token") || ""}` },
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => { if (data) setSuggestionSeeds(data); })
      .catch(() => {});
  }, []);
  useEffect(() => { fetchSuggestionSeeds(); }, [fetchSuggestionSeeds]);

  const suggestionChips = suggestionSeeds
    ? [
        {
          label: lang === "en" ? `Assess conviction risk for suspect ${suggestionSeeds.suspect}` : `${suggestionSeeds.suspect} ಅಪರಾಧದ ಅಪಾಯ ವಿಶ್ಲೇಷಿಸು`,
          text: `Assess conviction risk for suspect ${suggestionSeeds.suspect}`,
        },
        {
          label: lang === "en" ? `Find similar ${suggestionSeeds.crime_type.toLowerCase()} cases` : `${suggestionSeeds.crime_type} ಪ್ರಕರಣಗಳನ್ನು ಹುಡುಕಿ`,
          text: `Find similar ${suggestionSeeds.crime_type.toLowerCase()} cases`,
        },
        {
          label: lang === "en" ? `Plot crime hotspots in ${suggestionSeeds.district}` : `${suggestionSeeds.district} ಅಪರಾಧದ ಹಾಟ್‌ಸ್ಪಾಟ್‌ಗಳನ್ನು ತೋರಿಸಿ`,
          text: `Plot crime hotspots in ${suggestionSeeds.district}`,
        },
      ]
    : [
        { label: lang === "en" ? "Assess conviction risk for a suspect" : "ಶಂಕಿತ ಅಪರಾಧದ ಅಪಾಯ ವಿಶ್ಲೇಷಿಸು", text: "Assess conviction risk for a suspect" },
        { label: lang === "en" ? "Find similar burglary cases" : " burglary ಪ್ರಕರಣಗಳನ್ನು ಹುಡುಕಿ", text: "Find similar burglary cases" },
        { label: lang === "en" ? "Plot crime hotspot coordinates" : "ಅಪರಾಧದ ಹಾಟ್‌ಸ್ಪಾಟ್‌ಗಳನ್ನು ತೋರಿಸಿ", text: "Plot crime hotspot coordinates" },
      ];

  return (
    <div className="h-full flex overflow-hidden bg-stone-950/20">
      <ChatHistoryPanel
        activeSessionId={activeSessionId}
        onSelectSession={handleSelectSession}
        onNewChat={handleNewChat}
        refreshKey={sessionsRefreshKey}
        loadingSessionId={loadingSessionId}
        onSessionDeleted={(deletedId) => {
          sessionMessagesCacheRef.current.delete(deletedId);
          if (deletedId === activeSessionId) {
            handleNewChat();
          }
        }}
      />

      <div className="flex-1 flex flex-col relative overflow-hidden">
      {/* Security watermark -- already used on Spatial/Supervisor, missing
          here despite chat being the screen most likely to display raw case
          facts, suspect names, and attachment content. */}
      <WatermarkOverlay />
      {/* Header export action button */}
      <div className="absolute top-4 right-4 z-20">
        {chatMessages.length > 0 && (
          <button
            onClick={handleExportPDF}
            disabled={isExportingPdf}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-stone-800 bg-stone-900/60 hover:bg-stone-800 text-xs font-semibold text-stone-400 hover:text-white transition-all shadow-md cursor-pointer disabled:opacity-50 disabled:cursor-wait"
          >
            <Download className={`w-3.5 h-3.5 ${isExportingPdf ? "animate-bounce" : ""}`} />
            <span>{isExportingPdf ? (lang === "en" ? "Exporting…" : "ರಫ್ತು ಮಾಡಲಾಗುತ್ತಿದೆ…") : t.exportPdf}</span>
          </button>
        )}
      </div>

      {/* Messages Thread Container */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
        {loadingSessionId ? (
          <div className="max-w-3xl mx-auto space-y-6 animate-fade-in" aria-live="polite" aria-busy="true">
            {[1, 2, 3].map((n) => (
              <div key={n} className={`flex ${n % 2 === 0 ? "justify-end" : "justify-start"}`}>
                <div className="space-y-2 w-2/3">
                  <div className={`h-4 rounded-lg shimmer-bg ${n % 2 === 0 ? "w-1/2 ml-auto" : "w-3/4"}`} />
                  <div className={`h-3 rounded-lg shimmer-bg ${n % 2 === 0 ? "w-1/3 ml-auto" : "w-1/2"}`} />
                </div>
              </div>
            ))}
          </div>
        ) : chatMessages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center max-w-lg mx-auto space-y-4 animate-fade-in">
            <div className="w-16 h-16 rounded-full bg-[#C79A4E]/10 border border-[#C79A4E]/25 text-[#C79A4E] flex items-center justify-center glow-teal">
              <Sparkles className="w-8 h-8" />
            </div>
            <div className="space-y-1.5">
              <h2 className="text-base font-bold text-stone-200 uppercase tracking-wider">
                {t.chatHubTitle}
              </h2>
              <p className="text-xs text-stone-500 leading-relaxed">
                {t.chatHubDesc}
              </p>
            </div>
          </div>
        ) : (
          chatMessages.map((msg, idx) => (
            <ChatBubble
              key={msg.id}
              message={msg}
              lang={lang}
              onExpandWidget={(widgetType, widgetData) => setExpandedWidget({ type: widgetType as any, data: widgetData })}
              onRetry={msg.retryText ? () => handleSend(msg.retryText!) : undefined}
              addToast={addToast}
              isLast={idx === chatMessages.length - 1}
            />
          ))
        )}

        {/* Shimmer loading / Thinking indicator */}
        {isThinking && (
          <div className="flex items-start gap-3 max-w-[75%] animate-fade-in">
            <div className="w-8 h-8 rounded-full bg-[#C79A4E]/10 border border-[#C79A4E]/20 flex items-center justify-center shrink-0 glow-teal">
              <Sparkles className="w-4 h-4 text-[#C79A4E] animate-spin" />
            </div>
            <div className="space-y-2 flex-1">
              <div className="text-[10px] font-mono text-stone-500 font-bold uppercase tracking-wider flex items-center gap-2">
                <span>
                  {thinkingType === "translation"
                    ? t.translatingIndicator
                    : t.thinkingIndicator}
                </span>
                <span className="text-[#C79A4E]">{thinkingSeconds}s</span>
              </div>
              {/* GLM is a "thinking" model that reasons at length before
                  answering -- confirmed live, 15-140s is normal, not stuck.
                  Past 20s (well within one uneventful turn) this softens the
                  wait instead of letting the officer assume it hung. */}
              {thinkingSeconds > 20 && (
                <div className="text-[9.5px] text-stone-600 font-mono">
                  {lang === "en"
                    ? "Complex queries can take over a minute — still working."
                    : "ಸಂಕೀರ್ಣ ಪ್ರಶ್ನೆಗಳಿಗೆ ಒಂದು ನಿಮಿಷಕ್ಕಿಂತ ಹೆಚ್ಚು ಸಮಯ ಬೇಕಾಗಬಹುದು — ಇನ್ನೂ ಕೆಲಸ ಮಾಡುತ್ತಿದೆ."}
                </div>
              )}
              <div className="shimmer-bg h-10 w-full rounded-xl border border-stone-900" />
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input controls & suggestions footer -- Claude/ChatGPT-style: no
          hard divider line between the thread and the composer. A soft
          top fade instead (the thread appears to dissolve under it), and
          the composer card itself (ChatInput's own glass-panel border)
          is the only visible boundary, not an outer strip. */}
      <div className="relative shrink-0">
        <div className="pointer-events-none absolute inset-x-0 -top-6 h-6 bg-gradient-to-t from-[#161412] to-transparent" />
        <div className="p-4 pt-2">
        <div className="max-w-4xl mx-auto space-y-4">
          {/* Suggestion Chips */}
          {chatMessages.length === 0 && (
            <div className="flex flex-wrap gap-2 justify-center">
              {suggestionChips.map((chip, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSend(chip.text)}
                  className="px-3 py-1.5 rounded-full border border-stone-800 hover:border-[#C79A4E]/40 bg-stone-900/50 hover:bg-[#C79A4E]/5 text-[11px] text-stone-450 hover:text-stone-200 transition-all cursor-pointer"
                >
                  {chip.label}
                </button>
              ))}
            </div>
          )}

          {/* Pending attachment preview chips */}
          {/* Input controls block */}
          <ChatInput
            onSend={handleSend}
            isThinking={isThinking}
            isUploading={isUploadingAttachments}
            lang={lang}
            addToast={addToast}
            answerMode={answerMode}
            onAnswerModeChange={setAnswerMode}
          />

          {/* Chat / Cowork mode toggle */}
          <div className="flex items-center gap-2">
            <div className="inline-flex rounded-lg border border-stone-800 bg-stone-950/50 p-0.5">
              <button
                onClick={() => handleToggleCowork("chat")}
                className={`px-3 py-1.5 rounded-md text-[11px] font-bold uppercase tracking-wider transition-all cursor-pointer ${
                  chatMode === "chat" ? "bg-stone-800 text-stone-100" : "text-stone-500 hover:text-stone-300"
                }`}
              >
                {t.chatModeChat}
              </button>
              <button
                onClick={() => handleToggleCowork("cowork")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-bold uppercase tracking-wider transition-all cursor-pointer ${
                  chatMode === "cowork" ? "bg-[#C79A4E]/15 text-[#C79A4E]" : "text-stone-500 hover:text-stone-300"
                }`}
              >
                <Users className="w-3 h-3" /> {t.chatModeCowork}
              </button>
            </div>
            {hasParticipants && (
              <span className="text-[10px] text-[#C79A4E] font-mono">
                {t.sharedSessionHint}
              </span>
            )}
          </div>
        </div>
        </div>
      </div>

      {/* Cowork invite panel */}
      {showInvitePanel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/85 backdrop-blur-sm">
          <div className="w-full max-w-sm glass-panel border border-[#C79A4E]/30 rounded-2xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-black text-stone-100 uppercase tracking-wider font-mono flex items-center gap-2">
                <Users className="w-4 h-4 text-[#C79A4E]" /> {t.inviteToCowork}
              </h3>
              <button onClick={() => setShowInvitePanel(false)} className="text-stone-500 hover:text-stone-200 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-1">
              <label className="block text-[10px] font-black text-stone-450 uppercase font-mono">{t.badgeNumberKgidLabel}</label>
              <input
                type="text"
                value={inviteBadge}
                onChange={(e) => setInviteBadge(e.target.value)}
                placeholder="e.g. 1594888"
                className="w-full bg-stone-950/60 border border-stone-850 focus:border-[#C79A4E] rounded-xl py-2.5 px-3 text-xs text-stone-200 focus:outline-none transition-all"
              />
            </div>
            <div className="space-y-1">
              <label className="block text-[10px] font-black text-stone-450 uppercase font-mono">{t.accessLevelLabel}</label>
              <div className="flex gap-2">
                <button
                  onClick={() => setInviteRole("viewer")}
                  className={`flex-1 py-2 rounded-lg border text-[11px] font-bold uppercase tracking-wider transition-all cursor-pointer ${
                    inviteRole === "viewer" ? "bg-stone-800 border-stone-700 text-stone-100" : "border-stone-850 text-stone-500 hover:text-stone-300"
                  }`}
                >
                  {t.viewerLabel}
                </button>
                <button
                  onClick={() => setInviteRole("collaborator")}
                  className={`flex-1 py-2 rounded-lg border text-[11px] font-bold uppercase tracking-wider transition-all cursor-pointer ${
                    inviteRole === "collaborator" ? "bg-[#C79A4E]/15 border-[#C79A4E]/40 text-[#C79A4E]" : "border-stone-850 text-stone-500 hover:text-stone-300"
                  }`}
                >
                  {t.collaboratorLabel}
                </button>
              </div>
              <p className="text-[10px] text-stone-550 pt-1">
                {inviteRole === "viewer" ? t.viewerDesc : t.collaboratorDesc}
              </p>
            </div>
            <button
              onClick={handleSendInvite}
              disabled={isInviting || !activeSessionId}
              className="w-full py-2.5 rounded-xl bg-[#C79A4E]/10 hover:bg-[#C79A4E]/20 border border-[#C79A4E]/30 text-[#C79A4E] text-xs font-black uppercase tracking-wider transition-all disabled:opacity-50 cursor-pointer"
            >
              {isInviting ? t.sendingInvitation : t.sendInvitation}
            </button>
          </div>
        </div>
      )}

      {/* Full screen widgets expansion backdrop */}
      {expandedWidget && (
        <Suspense
          fallback={
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/85 backdrop-blur-sm">
              <div className="w-8 h-8 border-2 border-stone-800 border-t-[#C79A4E] rounded-full animate-spin" />
            </div>
          }
        >
          <ExpandedOverlay
            type={expandedWidget.type}
            data={expandedWidget.data}
            onClose={() => setExpandedWidget(null)}
          />
        </Suspense>
      )}
      </div>
    </div>
  );
};
