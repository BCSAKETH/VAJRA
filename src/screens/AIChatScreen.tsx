import React, { useState, useEffect, useRef, useCallback, useMemo, Suspense, lazy } from "react";
import { useApp, ChatMessage } from "../AppContext";
import { API_BASE } from "../config";
import { ChatBubble } from "../components/ChatBubble";
import { ChatInput } from "../components/ChatInput";
import { WatermarkOverlay } from "../components/WatermarkOverlay";
import { GreetingHeader } from "../components/GreetingHeader";
import { CaseBoard } from "../components/CaseBoard";
import { CaseChipStrip } from "../components/CaseChipStrip";
import { TaskChecklist } from "../components/TaskChecklist";
import { CaseDiary } from "../components/CaseDiary";
import { ReasonCollectionModal } from "../components/ReasonCollectionModal";
import { InvestigationBrowser } from "../components/InvestigationBrowser";
import { VajraLogo } from "../components/VajraLogo";
import { OSINTCard } from "../components/OSINTCard";
import { ApprovalsCard } from "../components/ApprovalsCard";
import { Download, X, Users, FileText, Globe, Check, MoreVertical, ListChecks, BookText, Pin, ChevronDown, ChevronUp, ChevronRight, FolderOpen, Timer } from "lucide-react";

// ExpandedOverlay pulls in Leaflet + Recharts directly (~250KB+ of the main
// bundle) but only ever renders when a widget is actually expanded -- most
// chat turns never touch it. Deferring the import means Login/AIChat's
// first load no longer pays for a map/charting library it may never use.
const ExpandedOverlay = lazy(() =>
  import("../components/ExpandedOverlay").then((m) => ({ default: m.ExpandedOverlay }))
);

// The backend persists timestamps via Python's datetime.utcnow().isoformat(),
// which has NO trailing "Z"/offset -- a bare "2026-09-01T18:33:12" string. The
// ISO-8601 spec (and every browser) treats a date-time string with no timezone
// designator as LOCAL time, not UTC, so `new Date(m.timestamp)` silently
// mis-parsed every server timestamp as if it were already in the officer's
// timezone -- confirmed live: a message sent "just now" in IST displayed the
// raw UTC clock time unconverted (off by UTC+5:30). Treat a marker-less
// timestamp as UTC by appending "Z" before parsing.
const parseServerTimestamp = (ts: string): Date => {
  const hasTz = /Z$|[+-]\d{2}:?\d{2}$/.test(ts);
  return new Date(hasTz ? ts : `${ts}Z`);
};

// Shared shape between the initial session-history fetch (handleSelectSession)
// and the cowork polling fallback below -- factored out so both stay in sync
// instead of drifting into two slightly different mappings over time.
const mapSessionMessages = (sessionId: string, messages: any[]): ChatMessage[] =>
  messages.map((m: any, idx: number) => ({
    id: `${sessionId}-${idx}`,
    // §9.8 fix: this used to coerce EVERY non-"user" sender to "assistant" --
    // a "system" message (e.g. an auto-flagged repeat-offender match routed
    // into this investigation) rendered mislabeled as "VAJRA.AI" even though
    // the backend deliberately stored it as sender="system" specifically to
    // avoid that. ChatMessage's own type union already allows "system".
    sender: m.sender === "user" ? "user" : m.sender === "system" ? "system" : "assistant",
    text: m.text,
    textEn: m.text_en,
    textKn: m.text_kn,
    timestamp: m.timestamp
      ? parseServerTimestamp(m.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      : "",
    responseType: m.response_type,
    data: m.data,
    citations: m.citations,
    attachments: m.data?.attachments,
    attachmentAnalysis: m.data?.attachment_analysis,
    senderName: m.sender_name,
    senderEmployeeId: m.sender_employee_id,
    responseStyle: m.response_style,
    responseStyleConfidence: m.response_style_confidence,
    personaEmergency: m.persona_emergency,
    personaManual: m.persona_manual,
    // Conversation branching (edit/retry/variants) -- packed into data_json
    // server-side, no new columns. msgId is this message's own stable id;
    // variantGroup/versionIndex let the UI group alternate versions of the
    // same turn and cycle between them. Older, pre-branching messages have
    // none of these -- they just render as single-version turns, same as
    // today, no migration needed.
    msgId: m.data?.msg_id,
    variantGroup: m.data?.variant_group,
    versionIndex: m.data?.version_index,
    // WhatsApp-style message pin -- same data_json convention as msgId above.
    isPinned: !!m.data?.is_pinned,
    sessionId: sessionId,
  }));

const MAX_ATTACHMENT_BYTES = 8 * 1024 * 1024;
const MAX_ATTACHMENTS_PER_MESSAGE = 3;
const MAX_AGGREGATE_BYTES = 20 * 1024 * 1024;
const ALLOWED_ATTACHMENT_TYPES = [
  "application/pdf", "image/jpeg", "image/jpg", "image/png",
  "audio/wav", "audio/x-wav", "audio/mpeg", "audio/mp3", "audio/webm", "audio/ogg",
  "video/mp4", "video/webm",
];

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
    roleTier,
    setCurrentScreen,
    voicePersona,
    transcriptWidth,
    transcriptTextSize,
    ttsSettings,
    // §9.1 Unified Sidebar bridge -- see AppContext.tsx's own comment for
    // why this thin bridge exists instead of lifting this whole pipeline.
    setActiveChatSessionId,
    chatSessionSelectRequest,
    newChatRequestNonce,
    bumpChatSessionsRefresh,
  } = useApp();

  // Section 15: Transcript ergonomics width derivation
  const messageWidthCls = useMemo(() => {
    switch (transcriptWidth) {
      case "narrow": return "max-w-2xl"; // ~672px
      case "wide":   return "max-w-6xl"; // ~1152px
      case "medium":
      default:       return "max-w-4xl"; // ~896px
    }
  }, [transcriptWidth]);

  const composerWidthCls = useMemo(() => {
    switch (transcriptWidth) {
      case "narrow": return "max-w-2xl"; // ~672px
      case "wide":   return "max-w-5xl"; // ~1024px
      case "medium":
      default:       return "max-w-3xl"; // ~768px
    }
  }, [transcriptWidth]);

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
  // §9.1: mirror the real active session id into AppContext so the now-
  // global UnifiedSidebar (a sibling of this screen, not a child of it) can
  // highlight the right row without this screen handing over its whole
  // send/poll pipeline.
  useEffect(() => { setActiveChatSessionId(activeSessionId); }, [activeSessionId, setActiveChatSessionId]);
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
  // Live-progress ticker (Part C item #8, backend built earlier -- this is
  // the missing frontend half): real step names the agent loop actually
  // reaches (see progress_tracker.py / GET /api/chat/progress/{session_id}),
  // NOT a fabricated countdown. Native EventSource can't send the
  // Authorization header this API requires, so this is consumed via a plain
  // fetch + manual stream reader instead (see streamTicker below).
  const [tickerMessage, setTickerMessage] = useState("");
  const tickerAbortRef = useRef<AbortController | null>(null);
  const streamTicker = useCallback(async (sessionId: string) => {
    tickerAbortRef.current?.abort();
    const controller = new AbortController();
    tickerAbortRef.current = controller;
    setTickerMessage("");
    try {
      const res = await fetch(`${API_BASE}/api/chat/progress/${sessionId}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("vajra_token") || ""}` },
        signal: controller.signal,
      });
      if (!res.ok || !res.body) return;
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const chunks = buf.split("\n\n");
        buf = chunks.pop() || "";
        for (const chunk of chunks) {
          const line = chunk.split("\n").find((l) => l.startsWith("data:"));
          if (!line) continue;
          try {
            const payload = JSON.parse(line.slice(5).trim());
            if (payload.message) setTickerMessage(payload.message);
            if (payload.done) return;
          } catch { /* ignore a malformed chunk -- next one still works */ }
        }
      }
    } catch {
      // Aborted (a new turn started, or this one finished) or a transient
      // network hiccup -- the static thinkingIndicator text below still
      // covers the wait either way, this is purely a UX enhancement.
    }
  }, []);

  const [expandedWidget, setExpandedWidget] = useState<{ type: string; data: any } | null>(null);
  // F.34: this officer's own "last viewed this network" timestamp for the
  // CURRENT Investigation, fetched right before showing the full-screen
  // network view so newly-appeared nodes/edges can be badged, then updated
  // once the officer has actually seen it. Scoped to the deliberate
  // full-screen "open" action (matches the item's own "reopening an
  // Investigation's network view" framing) -- the inline chat widget that
  // renders automatically isn't treated as a deliberate "visit."
  const [networkNewSince, setNetworkNewSince] = useState<string | null>(null);
  const [pendingAttachments, setPendingAttachments] = useState<File[]>([]);
  const [isUploadingAttachments, setIsUploadingAttachments] = useState(false);
  // E.6: real, honest upload status -- a genuine transfer percentage while
  // bytes are actually going out (XMLHttpRequest.upload.onprogress), then
  // an explicit "processing" label once the body is fully sent and the
  // server is doing frame-extraction/Qwen-vision/transcription work that
  // has no measurable client-side progress. Never a fabricated percentage
  // for that second phase.
  const [uploadStatusLabel, setUploadStatusLabel] = useState<string | null>(null);

  // Decoupled from fetch() specifically so upload.onprogress is available
  // (fetch's streaming request-body progress isn't supported widely enough
  // to rely on here) -- fixes the "blocking upload freeze" bug where a
  // multi-MB video attachment left the whole send flow with zero feedback.
  const uploadAttachmentsWithProgress = (files: File[]): Promise<{ ok: boolean; status: number; json: () => Promise<any> }> =>
    new Promise((resolve, reject) => {
      const formData = new FormData();
      files.forEach((f) => formData.append("files", f));
      formData.append("lang", lang);
      const xhr = new XMLHttpRequest();
      xhr.open("POST", `${API_BASE}/api/chat/attachments`);
      xhr.setRequestHeader("Authorization", `Bearer ${localStorage.getItem("vajra_token") || ""}`);
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          const pct = Math.round((e.loaded / e.total) * 100);
          setUploadStatusLabel(
            lang === "en" ? `Uploading attachment... ${pct}%` : `ಲಗತ್ತು ಅಪ್‌ಲೋಡ್ ಆಗುತ್ತಿದೆ... ${pct}%`
          );
        }
      };
      xhr.upload.onload = () => {
        setUploadStatusLabel(
          lang === "en" ? "Analyzing attachment..." : "ಲಗತ್ತನ್ನು ವಿಶ್ಲೇಷಿಸಲಾಗುತ್ತಿದೆ..."
        );
      };
      xhr.onload = () => {
        let parsed: any = {};
        try { parsed = JSON.parse(xhr.responseText || "{}"); } catch { /* non-JSON error body */ }
        resolve({ ok: xhr.status >= 200 && xhr.status < 300, status: xhr.status, json: async () => parsed });
      };
      xhr.onerror = () => reject(new Error("network error"));
      xhr.send(formData);
    });
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
  // 2-MODE CONSOLIDATION: "compiler" ("AI Reasoning β") retired as a 3rd
  // choice -- a returning officer's browser may still have that value saved
  // from before, so normalize it to "dossier" on load (the backend does the
  // same normalization independently, but fixing it here too keeps the UI
  // itself from ever showing a mode that no longer exists as an option).
  const [answerMode, setAnswerMode] = useState<"standard" | "dossier">(() => {
    const saved = localStorage.getItem("vajra_answer_mode");
    return saved === "dossier" ? "dossier" : "standard";
  });
  useEffect(() => { localStorage.setItem("vajra_answer_mode", answerMode); }, [answerMode]);
  // Section 113-116: officer-selected KSP persona override (PersonaSelectorBadge.tsx
  // in ChatInput.tsx), one of KSPResponseStyle's values or null for the
  // default auto-classified-per-query behavior. Persisted the same way
  // answerMode is -- a shift-long choice, not a per-message one.
  const [personaOverride, setPersonaOverride] = useState<string | null>(() => localStorage.getItem("vajra_persona_override") || null);
  useEffect(() => {
    if (personaOverride) localStorage.setItem("vajra_persona_override", personaOverride);
    else localStorage.removeItem("vajra_persona_override");
  }, [personaOverride]);
  // Section 113-116: drives the composer's red "Emergency SOP" HUD badge.
  // Deliberately NOT derived from chatMessages[chatMessages.length-1] (a
  // stale historical flag from a loaded-from-history session would
  // misrepresent a days-old auto-detected trigger as a live one) --
  // explicitly set true only when a turn JUST completed live in this tab,
  // and cleared on every new send / session switch.
  const [liveEmergencyActive, setLiveEmergencyActive] = useState(false);
  const [showInvitePanel, setShowInvitePanel] = useState(false);
  const [inviteBadge, setInviteBadge] = useState("");
  const [inviteRole, setInviteRole] = useState<"viewer" | "collaborator">("collaborator");
  const [isInviting, setIsInviting] = useState(false);
  // Confirmed live confusion: the invite panel used to auto-close after ONE
  // successful invite, with no participant count shown anywhere -- nothing
  // in the backend actually limits Cowork to 2 officers (CoworkParticipant
  // has no such cap), but the UI made adding a 3rd+ officer non-obvious
  // enough to look like a hard limit. Tracks who's been invited THIS
  // session-open so the panel can show it and stay open for the next one.
  const [invitedThisOpen, setInvitedThisOpen] = useState<string[]>([]);
  const [hasParticipants, setHasParticipants] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  // Section 125: the docked composer floats as an absolutely-positioned
  // overlay above the thread instead of a shrink-0 flex sibling, so the
  // thread needs its own dynamic bottom padding (composer height + margin)
  // to keep the last message from being hidden underneath the floating
  // card. Measured live via ResizeObserver since the card's height changes
  // with attachments, voice-recording status, and textarea auto-grow.
  // A callback ref (not useRef+useEffect) because the docked composer node
  // itself mounts/unmounts as isEmptyChat flips -- an effect with an empty
  // dep array would only ever see whatever was mounted on first render and
  // never reattach once the docked composer actually appears.
  const composerResizeObserverRef = useRef<ResizeObserver | null>(null);
  const [composerHeight, setComposerHeight] = useState(140);
  const composerRef = useCallback((el: HTMLDivElement | null) => {
    composerResizeObserverRef.current?.disconnect();
    composerResizeObserverRef.current = null;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const height = Math.ceil(entry.contentRect.height);
        setComposerHeight((prev) => (Math.abs(prev - height) < 4 ? prev : height));
      }
    });
    ro.observe(el);
    composerResizeObserverRef.current = ro;
  }, []);
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
              // Explicit map, not a two-way ternary: an unrecognized AlertType
              // (e.g. a future workflow type that slips past the backend's
              // internal-type filter) must never be mislabeled as a specific
              // alert kind it isn't -- fall back to a generic title instead.
              const ALERT_TITLES: Record<string, string> = {
                SPATIAL_SPIKE: "🚨 Spatial Crime Spike",
                REPEAT_OFFENDER: "👤 Repeat Offender Alert",
                // Cognitive Brain plan §3.4 Supervisor/Command Brain --
                // statistical (|z|>=2 vs trailing baseline) deviation
                // alerts, distinct from SPATIAL_SPIKE's simpler
                // any-increase-since-last-check signal.
                DISTRICT_TREND_ANOMALY: "🧭 Supervisor Radar: District Anomaly",
                OFFICER_WORKLOAD_ANOMALY: "🧭 Supervisor Radar: Officer Workload Anomaly",
                // Finals-part 3.md §21: real replacement for the doc's fake
                // "Send Patrol" dispatch confirmation -- an honest station
                // attention-flag, audit-logged, surfaced the same way every
                // other real alert already is.
                PATROL_FLAG: "🚓 Station Flagged for Patrol Attention",
              };
              addNotification(
                ALERT_TITLES[alert.type] ?? "🔔 System Alert",
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

  // §9.4/§9.7: whether the active session is a real Investigation (non-empty
  // description) -- same fetch-on-activeSessionId-change pattern already
  // used by the hasParticipants effect right below, tolerant of failure
  // (defaults to false, i.e. "treat as a regular chat" -- the safer default
  // for a screen that must never crash).
  const [isActiveInvestigation, setIsActiveInvestigation] = useState(false);
  // Section 69: the linked case number for the active investigation, if
  // any -- "Generate Full Dossier" needs this to name a FRESH, in-message
  // case reference (the backend's dossier fast-path deliberately requires
  // the case number to be present in THIS turn's own text, not inherited
  // from stale session memory -- see agent_loop.py's answer_mode=="dossier"
  // handling).
  const [activeInvestigationCaseNo, setActiveInvestigationCaseNo] = useState<string | null>(null);
  useEffect(() => {
    if (!activeSessionId) {
      setIsActiveInvestigation(false);
      setActiveInvestigationCaseNo(null);
      return;
    }
    let cancelled = false;
    fetch(`${API_BASE}/api/investigations`, {
      headers: { Authorization: `Bearer ${localStorage.getItem("vajra_token") || ""}` },
    })
      .then((r) => (r.ok ? r.json() : []))
      .then((list: { session_id: string; case_no?: string | null }[]) => {
        if (cancelled) return;
        const match = list.find((i) => i.session_id === activeSessionId);
        setIsActiveInvestigation(!!match);
        setActiveInvestigationCaseNo(match?.case_no || null);
      })
      .catch(() => { if (!cancelled) { setIsActiveInvestigation(false); setActiveInvestigationCaseNo(null); } });
    return () => { cancelled = true; };
  }, [activeSessionId]);

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

  // Cowork live-push, real-time: Zoho Catalyst's AppSail gateway (ZGS) does
  // not proxy WebSocket upgrade requests in this environment -- confirmed
  // directly, a raw handshake against /ws/chat/... comes back a plain HTTP
  // 404 from FastAPI itself, not a 101 Switching Protocols. SSE is NOT a
  // protocol upgrade (a plain HTTP GET with a chunked response) and is
  // already proven to survive this exact gateway -- the live-progress
  // ticker above (GET /api/chat/progress/{id}) has worked in production all
  // along on the identical mechanism. This reuses that same proven pattern
  // (cowork_feed.py backs it) for genuinely instant (sub-second) push
  // instead of the previous 4-second poll. Only runs for genuine
  // multi-participant sessions; reconnects automatically on any drop or on
  // the stream's own bounded server-side ceiling, so it behaves as one
  // continuous live connection from the officer's point of view.
  useEffect(() => {
    if (!activeSessionId || !hasParticipants) return;
    let cancelled = false;
    const controller = new AbortController();

    const connect = async () => {
      while (!cancelled) {
        try {
          const res = await fetch(`${API_BASE}/api/cowork/stream/${activeSessionId}`, {
            headers: { Authorization: `Bearer ${localStorage.getItem("vajra_token") || ""}` },
            signal: controller.signal,
          });
          if (!res.ok || !res.body) throw new Error("stream unavailable");
          const reader = res.body.getReader();
          const decoder = new TextDecoder();
          let buf = "";
          while (!cancelled) {
            const { value, done } = await reader.read();
            if (done) break;
            buf += decoder.decode(value, { stream: true });
            const chunks = buf.split("\n\n");
            buf = chunks.pop() || "";
            for (const chunk of chunks) {
              const line = chunk.split("\n").find((l) => l.startsWith("data:"));
              if (!line) continue;
              try {
                const payload = JSON.parse(line.slice(5).trim());
                if (payload._reconnect) continue;
                // Dynamic re-titling (Finals-part 3.md Section 53): the
                // backend renamed this session in the background after turn
                // 2 -- refresh the sidebar's session list so the new title
                // appears live, same live-push mechanism already used for a
                // Cowork partner's message arriving.
                if (payload.type === "session_title_updated") {
                  bumpChatSessionsRefresh();
                  continue;
                }
                // Section 93: secondary delivery path for the same in-place
                // POCSO unmask patch ChatBubble's own polling already
                // applies directly (the reliable path for a normal single-
                // officer session -- see pocso_request_status_for_case's own
                // comment on why this cowork stream isn't always open). Only
                // reaches here for a genuine multi-participant session.
                if (payload.type === "message_update") {
                  setChatMessages((prev) => prev.map((m) =>
                    (m.id === payload.message_id || m.msgId === payload.message_id)
                      ? { ...m, text: payload.text, textEn: payload.text_en || payload.text, textKn: payload.text_kn || payload.text, data: { ...(m.data || {}), ...(payload.data || {}) }, citations: payload.citations || m.citations }
                      : m
                  ));
                  continue;
                }
                if (payload.type !== "message") continue;
                if (payload.client_msg_id && sentClientMsgIdsRef.current.has(payload.client_msg_id)) {
                  sentClientMsgIdsRef.current.delete(payload.client_msg_id);
                  if (payload.sender === "assistant") clearPending(activeSessionId ?? "__new__");
                  continue;
                }
                setChatMessages((prev) => {
                  const newMsg: ChatMessage = {
                    id: `sse-${Date.now()}-${Math.random()}`,
                    // §9.8 fix: same "system" preservation as mapSessionMessages above.
                    sender: payload.sender === "user" ? "user" : payload.sender === "system" ? "system" : "assistant",
                    text: payload.text,
                    textEn: payload.text_en,
                    textKn: payload.text_kn,
                    timestamp: parseServerTimestamp(payload.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
                    responseType: payload.response_type,
                    data: payload.data,
                    citations: payload.citations,
                    senderName: payload.sender_name,
                    senderEmployeeId: payload.sender_employee_id,
                    responseStyle: payload.response_style,
                    responseStyleConfidence: payload.response_style_confidence,
                    personaEmergency: payload.persona_emergency,
                    personaManual: payload.persona_manual,
                    isSimulated: payload.is_simulated,
                    simulatedReason: payload.simulated_reason,
                  };
                  return [...prev, newMsg];
                });
                if (payload.sender === "assistant") {
                  clearPending(activeSessionId ?? "__new__");
                  setLiveEmergencyActive(payload.persona_emergency === true);
                }
                // Cowork live-push fix: the sidebar's chat list only refetches
                // on an explicit action today -- a partner's message arriving
                // live here should also move this session to the top /
                // update its last-active time in the sidebar without the
                // officer needing to click anything.
                bumpChatSessionsRefresh();
              } catch {
                // ignore one malformed SSE frame -- the next one still works
              }
            }
          }
        } catch {
          // network hiccup, or the server's own bounded ceiling closed the
          // stream -- reconnect below rather than leaving Cowork silently
          // stale for the rest of the session.
        }
        if (!cancelled) await new Promise((r) => setTimeout(r, 1000));
      }
    };
    connect();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [activeSessionId, hasParticipants, clearPending]);



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
    // Confirmed live: a real "full report on <suspect>" (generate_full_report
    // -- 4 chained sub-tool calls: risk+SHAP, MO profile, network graph,
    // repeat-offender roster) can legitimately run past 120s, well inside
    // the documented 15-140s+ GLM/composite-tool latency range. The old
    // 40-attempt (~120s) budget gave up and showed "AI TEMPORARILY
    // UNAVAILABLE" on a query that was still genuinely working -- the SAME
    // query then completed correctly moments later, proving the backend
    // never actually failed, only the frontend's patience ran out first.
    // 70 attempts (~210s) puts real margin above the documented worst case.
    const maxAttempts = 70;
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
            setLiveEmergencyActive(loaded[loaded.length - 1]?.personaEmergency === true);
          }
          return;
        }
      } catch {
        // Transient -- next tick tries again.
      }
    }
    // Budget exhausted -- tell the officer plainly rather than leaving the
    // composer stuck on "Thinking..." forever with no explanation. But the
    // background turn on the server has no such deadline and may still be
    // mid-flight (e.g. a slow sub-tool under load), so keep polling quietly
    // in the background instead of abandoning it outright -- if the real
    // reply does land, it still appends automatically instead of requiring
    // the officer to manually refresh/re-check to ever see it.
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
    for (let extra = 0; extra < 30; extra++) {
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
            setLiveEmergencyActive(loaded[loaded.length - 1]?.personaEmergency === true);
          }
          return;
        }
      } catch {
        // Transient -- next tick tries again.
      }
    }
  }, [lang, appendMessageForTurn]);

  // CONVERSATION BRANCHING (edit/retry/variants): messages sharing a
  // variantGroup are alternate versions of the SAME turn (see backend's
  // _resolve_variant_info). By default the LATEST version of each group is
  // shown; this map holds any manual overrides from clicking the < 1/2 >
  // pill, keyed by variantGroup. Messages with no variantGroup (the vast
  // majority -- anything never edited/retried) pass through unchanged.
  const [activeVariantOverride, setActiveVariantOverride] = useState<Record<string, number>>({});

  // Edit and retry both write into the same variant_group, but they need
  // different pairing behavior: editing a question bumps BOTH the user
  // message and its answer together (cycling should move them as a pair,
  // like ChatGPT), while retrying an answer bumps ONLY the assistant side
  // (cycling must NOT also swap out the still-current question). One shared
  // per-group override number handles both correctly: each side's shown
  // version is that shared number CLAMPED to how many versions THAT side
  // actually has. A side with only 1 version (e.g. the question, untouched
  // by a retry) always clamps back to its own v1 regardless of how far the
  // other side has cycled -- so retrying never disturbs the question, while
  // an edit (which advances both sides' version counts together) keeps them
  // moving in lockstep since the clamp is a no-op when both sides tie.
  const { displayMessages, variantMeta } = useMemo(() => {
    const bySender = { user: new Map<string, ChatMessage[]>(), assistant: new Map<string, ChatMessage[]>() };
    for (const m of chatMessages) {
      if (!m.variantGroup || m.sender !== "user" && m.sender !== "assistant") continue;
      const map = bySender[m.sender as "user" | "assistant"];
      const arr = map.get(m.variantGroup) || [];
      arr.push(m);
      map.set(m.variantGroup, arr);
    }
    const allGroups = new Set<string>([...bySender.user.keys(), ...bySender.assistant.keys()]);
    const meta: Record<string, { total: number; activeIndex: number }> = {};
    const skip = new Set<string>(); // ids of non-active variants to hide
    allGroups.forEach((group) => {
      const userSorted = [...(bySender.user.get(group) || [])].sort((a, b) => (a.versionIndex || 1) - (b.versionIndex || 1));
      const asstSorted = [...(bySender.assistant.get(group) || [])].sort((a, b) => (a.versionIndex || 1) - (b.versionIndex || 1));
      const userMax = userSorted.length || 1;
      const asstMax = asstSorted.length || 1;
      const shared = activeVariantOverride[group] ?? Math.max(userMax, asstMax);
      const clampedUser = Math.max(1, Math.min(shared, userMax));
      const clampedAsst = Math.max(1, Math.min(shared, asstMax));
      if (userSorted.length) {
        meta[`${group}::user`] = { total: userSorted.length, activeIndex: clampedUser };
        for (const m of userSorted) if ((m.versionIndex || 1) !== clampedUser) skip.add(m.id);
      }
      if (asstSorted.length) {
        meta[`${group}::assistant`] = { total: asstSorted.length, activeIndex: clampedAsst };
        for (const m of asstSorted) if ((m.versionIndex || 1) !== clampedAsst) skip.add(m.id);
      }
    });
    return { displayMessages: chatMessages.filter((m) => !skip.has(m.id)), variantMeta: meta };
  }, [chatMessages, activeVariantOverride]);

  // Pinned-messages strip -- WhatsApp-style, only when 1+ pinned messages
  // exist in this conversation. Clicking a preview reuses the existing
  // jump-to-and-highlight mechanism (handleJumpToMessage below), no new
  // scroll logic needed.
  const pinnedMessages = useMemo(() => chatMessages.filter((m) => m.isPinned && m.msgId), [chatMessages]);
  const [pinnedStripExpanded, setPinnedStripExpanded] = useState(false);

  const handleCycleVariant = useCallback((group: string, direction: 1 | -1) => {
    setActiveVariantOverride((prev) => {
      const userTotal = variantMeta[`${group}::user`]?.total || 1;
      const asstTotal = variantMeta[`${group}::assistant`]?.total || 1;
      const overallMax = Math.max(userTotal, asstTotal);
      const current = prev[group] ?? overallMax;
      const next = Math.min(overallMax, Math.max(1, current + direction));
      return { ...prev, [group]: next };
    });
  }, [variantMeta]);

  // WhatsApp-style message pin -- optimistic local flip, then persists
  // server-side via the existing msg_id-in-data_json convention. Reverts on
  // failure so the UI never lies about what's actually saved.
  const handleTogglePin = useCallback((msgId: string, currentlyPinned: boolean) => {
    const sid = activeSessionIdRef.current;
    if (!sid) return;
    setChatMessages((prev) => prev.map((m) => (m.msgId === msgId ? { ...m, isPinned: !currentlyPinned } : m)));
    fetch(`${API_BASE}/api/sessions/${sid}/messages/${msgId}/pin`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("vajra_token") || ""}` },
      body: JSON.stringify({ pinned: !currentlyPinned }),
    }).catch(() => {
      setChatMessages((prev) => prev.map((m) => (m.msgId === msgId ? { ...m, isPinned: currentlyPinned } : m)));
      addToast({ id: `pin-fail-${Date.now()}`, title: lang === "en" ? "Pin failed" : "ಪಿನ್ ವಿಫಲವಾಗಿದೆ", message: lang === "en" ? "Could not update this message. Try again." : "ಈ ಸಂದೇಶವನ್ನು ನವೀಕರಿಸಲಾಗಲಿಲ್ಲ. ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.", severity: "Warning", timestamp: new Date().toISOString() });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang]);

  // Submit Text Query to Copilot Agent Loop
  // F.34: fetches this officer's own last-viewed timestamp for the current
  // Investigation's network BEFORE marking it viewed (sequenced, not fired
  // in parallel, so the mark-viewed write can never race ahead of the read
  // and make everything look "not new"), then records this visit. Fails
  // silently if NetworkViewState (a new Console table this feature needs)
  // doesn't exist yet -- badging is a nice-to-have, never worth blocking or
  // erroring the network view itself over.
  const openNetworkWidget = useCallback(async () => {
    const sid = activeSessionIdRef.current;
    if (!sid) { setNetworkNewSince(null); return; }
    const authHeader = { Authorization: `Bearer ${localStorage.getItem("vajra_token") || ""}` };
    try {
      const res = await fetch(`${API_BASE}/api/investigations/${sid}/network-new-since`, { headers: authHeader });
      const j = await res.json().catch(() => ({}));
      setNetworkNewSince(j?.last_viewed_at || null);
    } catch {
      setNetworkNewSince(null);
    }
    fetch(`${API_BASE}/api/investigations/${sid}/network-viewed`, { method: "POST", headers: authHeader }).catch(() => {});
  }, []);

  const handleSend = useCallback(async (
    textToSend: string,
    filesToSend: File[] = [],
    variantOptions?: {
      editOfMsgId?: string;
      retryOfMsgId?: string;
      existingAttachments?: any[];
      cachedAttachmentAnalysis?: string;
      // Section 69: forces this ONE turn's answer_mode regardless of the
      // officer's own standard/dossier toggle -- setAnswerMode() is async
      // state, so a "toggle then immediately send" pattern would race the
      // actual request. "Generate Full Dossier" uses this instead of
      // touching the toggle at all.
      answerModeOverride?: "standard" | "dossier";
    }
  ) => {
    if (isThinking || isUploadingAttachments) return;
    if (!textToSend.trim() && filesToSend.length === 0) return;
    setLiveEmergencyActive(false);

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
    let uploadedAttachmentRefs: NonNullable<ChatMessage["attachments"]> = [];
    let currentAttachmentAnalysis: string | undefined = variantOptions?.cachedAttachmentAnalysis;

    if (variantOptions?.existingAttachments && variantOptions.existingAttachments.length > 0) {
      uploadedAttachmentRefs = variantOptions.existingAttachments;
      if (variantOptions.cachedAttachmentAnalysis) {
        queryForAgent = `Attachment analysis: ${variantOptions.cachedAttachmentAnalysis}\n\n${textToSend}`;
      }
    } else if (filesToSend.length > 0) {
      setIsUploadingAttachments(true);
      setUploadStatusLabel(
        lang === "en" ? "Uploading attachment... 0%" : "ಲಗತ್ತು ಅಪ್‌ಲೋಡ್ ಆಗುತ್ತಿದೆ... 0%"
      );
      try {
        const uploadRes = await uploadAttachmentsWithProgress(filesToSend);
        if (uploadRes.ok) {
          const uploadData = await uploadRes.json();
          uploadedAttachmentRefs = uploadData.attachments || [];
          if (uploadData.attachment_analysis) {
            currentAttachmentAnalysis = uploadData.attachment_analysis;
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
          setUploadStatusLabel(null);
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
        setUploadStatusLabel(null);
        return;
      }
      setIsUploadingAttachments(false);
      setUploadStatusLabel(null);
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
    // A RETRY reuses the already-asked question -- no new user bubble is
    // persisted server-side (see chat_endpoint's _is_retry branch), so none
    // is optimistically added here either; the existing user bubble on
    // screen stays exactly as it was.
    if (!variantOptions?.retryOfMsgId) {
      const userMsg: ChatMessage = {
        id: `msg-${Date.now()}-user`,
        sender: "user",
        text: textToSend,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        attachments: uploadedAttachmentRefs.length > 0 ? uploadedAttachmentRefs : undefined,
        attachmentAnalysis: currentAttachmentAnalysis,
        senderName: officerName || undefined,
      };
      setChatMessages((prev) => [...prev, userMsg]);
    }
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
          attachment_analysis: currentAttachmentAnalysis,
          // Standard vs Full Dossier -- chosen in the composer selector,
          // unless this one turn forces a specific mode (Section 69).
          answer_mode: variantOptions?.answerModeOverride || answerMode,
          persona_override: personaOverride || undefined,
          edit_of_msg_id: variantOptions?.editOfMsgId,
          retry_of_msg_id: variantOptions?.retryOfMsgId,
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
      if (turnSessionId) {
        streamTicker(turnSessionId);
      }

      // First turn of a new conversation: the backend just auto-created a
      // real ChatSession and handed back its id. Only auto-adopt it (switch
      // the visible thread over) if the officer is still exactly where they
      // were when they sent it -- otherwise they've already navigated
      // elsewhere (a new chat reset, or an existing conversation) and
      // forcing them back would be as disruptive as the bug this whole
      // function exists to prevent. The sidebar refresh is always safe.
      if (!sendSessionId && data.session_id) {
        setSessionsRefreshKey((k) => k + 1);
        bumpChatSessionsRefresh(); // §9.1: the sidebar is global now, refresh it too
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
        tickerAbortRef.current?.abort();
        setTickerMessage("");
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
      tickerAbortRef.current?.abort();
      setTickerMessage("");
      if (activeSessionIdRef.current === sendSessionId) {
        setThinkingType("standard");
      }
    }
  }, [isThinking, isUploadingAttachments, lang, addToast, setIsAuthenticated, chatMode, appendMessageForTurn, pollForPendingReply, markPending, clearPending, answerMode]);

  // Handler wired to ChatBubble's Edit action -- resends through the normal
  // handleSend pipeline (same attachment/session/pending-poll handling as any
  // turn), tagged with which existing message it's a new version of.
  // CONFIRMED LIVE BUG (2026-09-16): this used to call handleSend(newText,
  // [], { editOfMsgId: msgId }) with an empty attachments array and no
  // existingAttachments/cachedAttachmentAnalysis -- unlike handleRetryVariant
  // below (and the two other edit-entry-point call sites further down this
  // file), which both correctly carry attachment metadata through. Editing a
  // user message that had a video/image attached silently dropped it: the
  // edited turn re-sent as text-only, and the attachment vanished from that
  // version of the conversation. msgId here IS the user message being edited
  // (not an assistant reply needing a backward lookup for its paired
  // question, as in handleRetryVariant), so its own attachments/
  // attachmentAnalysis are used directly.
  const handleEditMessage = useCallback((msgId: string, newText: string) => {
    const targetMsg = chatMessages.find((m) => m.id === msgId || m.msgId === msgId);
    const existingAttachments = targetMsg?.attachments || [];
    const cachedAnalysis = (targetMsg as any)?.attachmentAnalysis || undefined;
    handleSend(newText, [], {
      editOfMsgId: msgId,
      existingAttachments,
      cachedAttachmentAnalysis: cachedAnalysis,
    });
  }, [chatMessages, handleSend]);

  // Component 1 (Section 9): Preserve attachments and cached analysis on retry
  const handleRetryVariant = useCallback((msgId: string, originalQuestionText: string) => {
    // 1. Locate the paired user message that initiated this turn
    const msgIndex = chatMessages.findIndex((m) => m.id === msgId || m.msgId === msgId);
    const pairedUser = msgIndex > 0
      ? chatMessages.slice(0, msgIndex).reverse().find((m) => m.sender === "user")
      : undefined;

    // 2. Extract existing attachment references from the paired user message
    const existingAttachments = pairedUser?.attachments || [];
    const cachedAnalysis = pairedUser?.attachmentAnalysis || undefined;

    // 3. Resend with existing attachment metadata -- ZERO re-upload overhead!
    handleSend(originalQuestionText, [], {
      retryOfMsgId: msgId,
      existingAttachments,
      cachedAttachmentAnalysis: cachedAnalysis,
    });
  }, [chatMessages, handleSend]);

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
    setLiveEmergencyActive(false);
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
      // Stay open (was auto-closing after one invite -- no backend limit
      // exists, this just made a 3rd/4th officer non-obvious to add).
      setInvitedThisOpen((prev) => [...prev, inviteBadge]);
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

  // §9.7 Investigation "Manage" menu -----------------------------------
  const [showManageMenu, setShowManageMenu] = useState(false);
  const [showAddCaseModal, setShowAddCaseModal] = useState(false);
  const [addCaseNo, setAddCaseNo] = useState("");
  const [isAddingCase, setIsAddingCase] = useState(false);
  const [showTaskChecklist, setShowTaskChecklist] = useState(false);
  const [showCaseDiary, setShowCaseDiary] = useState(false);

  const handleAddCase = async () => {
    if (!activeSessionId || !addCaseNo.trim()) return;
    setIsAddingCase(true);
    try {
      const res = await fetch(`${API_BASE}/api/investigations/${activeSessionId}/cases`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("vajra_token") || ""}` },
        body: JSON.stringify({ case_no: addCaseNo.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || "Could not link that case.");
      addToast(
        lang === "en" ? "Case Linked" : "ಪ್ರಕರಣ ಜೋಡಿಸಲಾಗಿದೆ",
        lang === "en" ? `Case ${addCaseNo.trim()} linked to this Investigation.` : `ಪ್ರಕರಣ ${addCaseNo.trim()} ಈ ತನಿಖೆಗೆ ಜೋಡಿಸಲಾಗಿದೆ.`,
        "Success"
      );
      setShowAddCaseModal(false);
      setAddCaseNo("");
    } catch (err: any) {
      addToast(lang === "en" ? "Could Not Link Case" : "ಪ್ರಕರಣ ಜೋಡಿಸಲಾಗಲಿಲ್ಲ", err.message, "Critical");
    } finally {
      setIsAddingCase(false);
    }
  };

  // CONFIRMED LIVE BUG (2026-09-17, Finals-part 3.md Section 69): this used
  // to call handleExportPDF() directly -- IDENTICAL to the plain "Export
  // PDF" button right next to it, so "Generate Full Dossier" never produced
  // anything different from a flat chat-transcript dump. The real synthesis
  // engine already exists (generate_case_dossier in agent_loop.py --
  // concurrent case-facts/risk+SHAP/network/timeline/sections/summary/
  // similar-cases panels plus a cross-signal assessment, all real data, no
  // second engine needed) and is already reachable via answer_mode=
  // "dossier"; it just wasn't being triggered by this menu action. This now
  // actually asks for one, in-thread, the same way an officer explicitly
  // typing "generate a full dossier" would -- once it lands, the EXISTING
  // PDF export pipeline already renders a dossier-mode message's rich
  // panels as real embedded charts (_extract_visual_cards_from_message in
  // main.py), not flat text, so a subsequent Export PDF captures the real
  // dossier. A dedicated full-screen interactive viewer (Tier 1 from the
  // plan doc) is NOT built here -- the dossier still renders as a normal
  // chat message, just a genuinely comprehensive one instead of an export
  // no different from the transcript.
  const handleGenerateDossier = () => {
    setShowManageMenu(false);
    if (isThinking) return;
    // The backend's dossier fast-path only fires for a case number FRESH in
    // THIS message (deliberate anti-stale-context guard) -- a vague "for
    // this case" with no number falls through to a web search instead,
    // silently producing the wrong thing. Fail honestly instead: no linked
    // case number means there's nothing real to synthesize a case dossier
    // from yet.
    if (!activeInvestigationCaseNo) {
      addToast(
        lang === "en" ? "No Case Linked" : "ಯಾವುದೇ ಪ್ರಕರಣ ಜೋಡಿಸಿಲ್ಲ",
        lang === "en"
          ? "Link a case number to this investigation first (Manage > Add Case) before generating a full dossier."
          : "ಪೂರ್ಣ ದೋಶಿಯರ್ ರಚಿಸುವ ಮೊದಲು ಈ ತನಿಖೆಗೆ ಪ್ರಕರಣ ಸಂಖ್ಯೆಯನ್ನು ಜೋಡಿಸಿ.",
        "Warning"
      );
      return;
    }
    addToast(
      lang === "en" ? "Generating Full Dossier" : "ಪೂರ್ಣ ದೋಶಿಯರ್ ರಚಿಸಲಾಗುತ್ತಿದೆ",
      lang === "en"
        ? "Synthesizing case facts, risk, network, timeline and sections into one comprehensive briefing..."
        : "ಪ್ರಕರಣದ ವಿವರ, ಅಪಾಯ, ಜಾಲ, ಕಾಲಾನುಕ್ರಮ ಸಂಯೋಜಿಸಲಾಗುತ್ತಿದೆ...",
      "Info"
    );
    handleSend(
      lang === "en"
        ? `Generate a full investigation dossier for case ${activeInvestigationCaseNo}.`
        : `ಪ್ರಕರಣ ${activeInvestigationCaseNo} ಗೆ ಪೂರ್ಣ ತನಿಖಾ ದೋಶಿಯರ್ ರಚಿಸಿ.`,
      [],
      { answerModeOverride: "dossier" }
    );
  };

  const handleCloseInvestigation = async () => {
    if (!activeSessionId) return;
    setShowManageMenu(false);
    const confirmed = window.confirm(
      lang === "en"
        ? "Close this Investigation? It stays viewable and can be re-opened later -- nothing is deleted."
        : "ಈ ತನಿಖೆಯನ್ನು ಮುಚ್ಚುವುದೇ? ಇದನ್ನು ನಂತರ ಮತ್ತೆ ತೆರೆಯಬಹುದು -- ಏನನ್ನೂ ಅಳಿಸಲಾಗುವುದಿಲ್ಲ."
    );
    if (!confirmed) return;
    try {
      const res = await fetch(`${API_BASE}/api/investigations/${activeSessionId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("vajra_token") || ""}` },
        body: JSON.stringify({ status: "closed" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || "Could not close this Investigation.");
      addToast(
        lang === "en" ? "Investigation Closed" : "ತನಿಖೆ ಮುಚ್ಚಲಾಗಿದೆ",
        lang === "en" ? "It remains viewable and can be re-opened anytime." : "ಇದು ವೀಕ್ಷಿಸಬಹುದಾಗಿ ಉಳಿದಿದೆ ಮತ್ತು ಯಾವಾಗ ಬೇಕಾದರೂ ಮತ್ತೆ ತೆರೆಯಬಹುದು.",
        "Success"
      );
    } catch (err: any) {
      addToast(lang === "en" ? "Could Not Close" : "ಮುಚ್ಚಲು ಸಾಧ್ಯವಾಗಲಿಲ್ಲ", err.message, "Critical");
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
    // A loaded-from-history session's last reply may have been an
    // auto-detected emergency days/weeks ago -- never show that as a live
    // HUD state just because the officer opened this thread now.
    setLiveEmergencyActive(false);
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

  // §9.1 Unified Sidebar bridge: the sidebar now lives in MainLayout (a
  // sibling of this screen), so a session click there arrives as a request
  // through AppContext instead of a direct prop call. Keyed off the
  // request's own nonce (not its sessionId) so re-selecting the SAME
  // session a second time still fires (matches handleSelectSession's own
  // early-return-if-unchanged behavior, which already handles the no-op
  // case correctly on its own).
  const lastHandledSelectNonceRef = useRef<number>(0);
  useEffect(() => {
    if (!chatSessionSelectRequest || chatSessionSelectRequest.nonce === lastHandledSelectNonceRef.current) return;
    lastHandledSelectNonceRef.current = chatSessionSelectRequest.nonce;
    handleSelectSession(chatSessionSelectRequest.sessionId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatSessionSelectRequest]);

  // Same bridge pattern for "New Chat" triggered from the sidebar -- nonce
  // starts at 0 on both sides, so this never fires on mount, only on a real
  // request from UnifiedSidebar.
  const lastHandledNewChatNonceRef = useRef(0);
  useEffect(() => {
    if (newChatRequestNonce === lastHandledNewChatNonceRef.current) return;
    lastHandledNewChatNonceRef.current = newChatRequestNonce;
    handleNewChat();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [newChatRequestNonce]);

  // §9.4 Case Board / Chip Strip: tapping an entry scrolls to and briefly
  // highlights the ORIGINAL message that already carries this data (never
  // re-runs or re-fetches anything -- Loophole L1). Both CaseBoard (full
  // panel, Investigations) and CaseChipStrip (thin strip, regular chats)
  // call this same handler.
  const [highlightedMsgId, setHighlightedMsgId] = useState<string | null>(null);
  const handleJumpToMessage = useCallback((msgId: string) => {
    const el = document.querySelector(`[data-msg-id="${msgId}"]`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
    setHighlightedMsgId(msgId);
    window.setTimeout(() => setHighlightedMsgId((cur) => (cur === msgId ? null : cur)), 2200);
  }, []);

  // Language Selection Modal state for PDF Export
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportTargetLang, setExportTargetLang] = useState<"en" | "kn">("en");
  const [activeApprovalId, setActiveApprovalId] = useState<string | null>(null);
  // Section 19: sandboxed in-app investigation browser overlay.
  const [showBrowser, setShowBrowser] = useState(false);

  // Export Transcript to PDF -- with the AI pre-screen + live supervisor-approval
  // flow. Supports explicit language selection (English / Kannada) and embeds
  // visual diagrams (mule rings, hotspot coordinates, risk meters).
  const buildTranscript = (targetLang: "en" | "kn") => chatMessages.map((m) => ({
    role: m.sender,
    sender: m.sender,
    content: m.sender === "assistant"
      ? (targetLang === "kn" ? (m.textKn || m.text) : (m.textEn || m.text))
      : m.text,
    text_en: m.textEn || m.text,
    text_kn: m.textKn || (targetLang === "kn" ? m.text : ""),
    timestamp: m.timestamp || "",
    data: m.data || {},
    citations: m.citations || [],
  }));

  const requestExport = async (targetLang: "en" | "kn", approvalId?: string, reason?: string): Promise<Response> =>
    fetch(`${API_BASE}/api/chat/export-pdf`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${localStorage.getItem("vajra_token") || ""}` },
      body: JSON.stringify({
        transcript: buildTranscript(targetLang),
        badge_id: badgeNumber || "KSP-4003385",
        lang: targetLang,
        session_id: activeSessionId || undefined,
        approval_id: approvalId || activeApprovalId || undefined,
        reason: reason || undefined,
      }),
    });

  const downloadPdfResponse = async (response: Response, targetLang: "en" | "kn") => {
    if (response.status !== 200) {
      throw new Error(`PDF Export returned status ${response.status}`);
    }
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `VAJRA_Dossier_${badgeNumber || "4003385"}_${targetLang.toUpperCase()}.pdf`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  const handleExportPDF = () => {
    setExportTargetLang(lang === "kn" ? "kn" : "en");
    setShowExportModal(true);
  };

  // E.1: officer's written justification, collected only when the AI
  // pre-screen actually flags the export as sensitive (see the
  // "reason_required" status below) -- an unflagged export never prompts
  // for one at all.
  const [showReasonModal, setShowReasonModal] = useState(false);
  const [reasonModalLang, setReasonModalLang] = useState<"en" | "kn">("en");

  const executeExport = async (targetLang: "en" | "kn", officerReason?: string) => {
    if (isExportingPdf) return;
    setIsExportingPdf(true);
    setShowExportModal(false);
    try {
      const response = await requestExport(targetLang, undefined, officerReason);
      if (response.status === 202) {
        const d = await response.json().catch(() => ({}));
        if (d.status === "reason_required") {
          // E.1: AI pre-screen flagged this export -- collect a real written
          // justification before creating the pending-approval request at
          // all (D.8: the server itself enforces the minimum length too).
          setIsExportingPdf(false);
          setReasonModalLang(targetLang);
          setShowReasonModal(true);
          return;
        }
        // AI held it for supervisor approval -- start the live wait.
        const reqId: string = d.request_id;
        setActiveApprovalId(reqId);
        addToast(
          lang === "en" ? "Awaiting supervisor approval" : "ಮೇಲ್ವಿಚಾರಕರ ಅನುಮೋದನೆಗಾಗಿ ಕಾಯಲಾಗುತ್ತಿದೆ",
          lang === "en"
            ? `AI pre-screen flagged sensitive content (${(d.reasons || []).join(", ")}). A supervisor has been notified.`
            : `AI ಪೂರ್ವ-ಪರಿಶೀಲನೆಯು ಸೂಕ್ಷ್ಮ ವಿಷಯವನ್ನು ಗುರುತಿಸಿದೆ. ಮೇಲ್ವಿಚಾರಕರಿಗೆ ಸೂಚಿಸಲಾಗಿದೆ.`,
          "Warning"
        );
        // Poll the decision (reliable on multi-worker); WebSocket also pushes it.
        const started = Date.now();
        const poll = async () => {
          if (Date.now() - started > 5 * 60 * 1000) { setIsExportingPdf(false); return; }
          try {
            const s = await fetch(`${API_BASE}/api/exports/${reqId}/status`, {
              headers: { "Authorization": `Bearer ${localStorage.getItem("vajra_token") || ""}` },
            }).then((r) => r.json());
            if (s.status === "approved") {
              setActiveApprovalId(reqId);
              const rr = await requestExport(targetLang, reqId);
              if (rr.status === 200) {
                await downloadPdfResponse(rr, targetLang);
                addToast(lang === "en" ? "Approved — exported" : "ಅನುಮೋದಿಸಲಾಗಿದೆ — ರಫ್ತು ಮಾಡಲಾಗಿದೆ",
                  lang === "en" ? "A supervisor approved this export." : "ಮೇಲ್ವಿಚಾರಕರು ಈ ರಫ್ತನ್ನು ಅನುಮೋದಿಸಿದ್ದಾರೆ.", "Info");
                setIsExportingPdf(false);
                return;
              } else if (rr.status === 202) {
                setTimeout(poll, 4000);
                return;
              }
              setIsExportingPdf(false); return;
            }
            if (s.status === "rejected") {
              addToast(lang === "en" ? "Export rejected" : "ರಫ್ತು ತಿರಸ್ಕರಿಸಲಾಗಿದೆ",
                lang === "en" ? "A supervisor declined this export." : "ಮೇಲ್ವಿಚಾರಕರು ಈ ರಫ್ತನ್ನು ನಿರಾಕರಿಸಿದ್ದಾರೆ.", "Critical");
              setIsExportingPdf(false); return;
            }
          } catch { /* keep polling */ }
          setTimeout(poll, 4000);
        };
        setTimeout(poll, 4000);
        return; // keep isExportingPdf true while pending
      }
      if (!response.ok) {
        throw new Error(await response.text());
      }
      await downloadPdfResponse(response, targetLang);
      addToast(
        lang === "en" ? "Dossier Exported" : "ದೋಶಿಯರ್ ರಫ್ತು ಮಾಡಲಾಗಿದೆ",
        lang === "en" ? `Official ${targetLang.toUpperCase()} PDF report downloaded successfully.` : `ಅಧಿಕೃತ PDF ವರದಿ ಯಶಸ್ವಿಯಾಗಿ ಡೌನ್‌ಲೋಡ್ ಆಗಿದೆ.`,
        "Success"
      );
    } catch (err: any) {
      addToast(
        lang === "en" ? "Export Failed" : "ರಫ್ತು ವಿಫಲವಾಗಿದೆ",
        err.message || (lang === "en" ? "Failed to generate report" : "ವರದಿ ರಚಿಸಲು ಸಾಧ್ಯವಾಗಲಿಲ್ಲ"),
        "Critical"
      );
    } finally {
      setIsExportingPdf(false);
    }
  };

  const handleReasonSubmit = async (reason: string) => {
    setShowReasonModal(false);
    await executeExport(reasonModalLang, reason);
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

  // Empty-chat centered layout: fresh login, "New Chat", or a brand-new
  // Investigation with no messages yet should center the greeting AND the
  // composer together as one block, like Claude's own home screen -- not
  // the composer pinned to the true bottom of the screen with a big empty
  // gap under the greeting (confirmed live complaint, reference screenshot
  // of Claude's own "✳ Vajra returns! / How can I help you today?" layout).
  // The composer JSX itself is identical either way -- only WHERE it
  // renders changes, so it's extracted once here and inserted into exactly
  // ONE of the two positions below, never both/duplicated/mounted twice.
  const isEmptyChat = !loadingSessionId && chatMessages.length === 0;

  // Section 129 Zone 2/3: one shared /api/officer/digest fetch for the home
  // screen's telemetry pills (real open-investigation/pending-task counts)
  // AND the dual tactical lanes below them (real pending-approvals count +
  // the officer's own resolved district for OSINT scoping) -- GreetingHeader
  // no longer fetches this itself (Section 129 moved the pills out of it).
  interface HomeDigest {
    open_investigations: number;
    pending_approvals: number;
    pending_tasks: number;
    assigned_district: string | null;
  }
  const [homeDigest, setHomeDigest] = useState<HomeDigest | null>(null);
  // Distinct from "still loading" (homeDigest === null, digestFailed ===
  // false): a failed fetch must never render as a confirmed "0 Open
  // Investigations" / "0 Pending Tasks", and must never silently collapse
  // Zone 3 to look like "0 approvals pending" when the truth is "unknown."
  const [digestFailed, setDigestFailed] = useState(false);
  useEffect(() => {
    if (!isEmptyChat) return;
    let cancelled = false;
    setDigestFailed(false);
    fetch(`${API_BASE}/api/officer/digest`, {
      headers: { Authorization: `Bearer ${localStorage.getItem("vajra_token") || ""}` },
    })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((d) => { if (!cancelled) setHomeDigest(d); })
      .catch(() => { if (!cancelled) setDigestFailed(true); });
    return () => { cancelled = true; };
  }, [isEmptyChat]);
  const isSupervisor = roleTier === "supervisor";

  const composerContent = (
    <div className={`${composerWidthCls} mx-auto space-y-4 w-full transition-all duration-200 pointer-events-auto`}>
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
        uploadStatusLabel={uploadStatusLabel}
        lang={lang}
        addToast={addToast}
        answerMode={answerMode}
        onAnswerModeChange={setAnswerMode}
        chatMode={chatMode}
        onToggleCowork={handleToggleCowork}
        hasParticipants={hasParticipants}
        pendingTaskCount={homeDigest?.pending_tasks}
        personaOverride={personaOverride}
        onPersonaOverrideChange={setPersonaOverride}
        personaEmergencyActive={liveEmergencyActive}
      />
    </div>
  );

  return (
    <div className="h-full flex overflow-hidden bg-stone-950/20">
      {/* §9.1: the chat-history/investigations panel is now the global
          UnifiedSidebar rendered once in MainLayout.tsx (a sibling of every
          screen, never remounted here) -- this screen no longer renders its
          own local history panel. Session switch/new-chat requests arrive
          via the AppContext bridge (chatSessionSelectRequest/
          newChatRequestNonce, wired above). */}
      <div className="flex-1 min-h-0 flex flex-col relative overflow-hidden">
      {/* Forensic watermark: activates once dialogue commences (Section 13.5) */}
      {chatMessages.length > 0 && <WatermarkOverlay />}
      {/* Header export action button + §9.5/§9.6/§9.7 Investigation-only controls */}
      <div className="absolute top-4 right-4 z-20 flex items-center gap-2">
        {isActiveInvestigation && (
          <>
            <button
              onClick={() => setShowTaskChecklist(true)}
              title={lang === "en" ? "Guided Tasks" : "ಮಾರ್ಗದರ್ಶಿ ಕಾರ್ಯಗಳು"}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-stone-800 bg-stone-900/60 hover:bg-stone-800 text-xs font-semibold text-stone-400 hover:text-white transition-all shadow-md cursor-pointer"
            >
              <ListChecks className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setShowCaseDiary(true)}
              title={lang === "en" ? "Case Diary" : "ಪ್ರಕರಣ ದಿನಚರಿ"}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-stone-800 bg-stone-900/60 hover:bg-stone-800 text-xs font-semibold text-stone-400 hover:text-white transition-all shadow-md cursor-pointer"
            >
              <BookText className="w-3.5 h-3.5" />
            </button>
            <div className="relative">
              <button
                onClick={() => setShowManageMenu((v) => !v)}
                title={lang === "en" ? "Manage Investigation" : "ತನಿಖೆ ನಿರ್ವಹಿಸಿ"}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-stone-800 bg-stone-900/60 hover:bg-stone-800 text-xs font-semibold text-stone-400 hover:text-white transition-all shadow-md cursor-pointer"
              >
                <MoreVertical className="w-3.5 h-3.5" />
              </button>
              {showManageMenu && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowManageMenu(false)} />
                  <div className="absolute right-0 top-9 z-50 bg-stone-900 border border-stone-800 rounded-lg shadow-2xl py-1 w-56">
                    {/* Reuses the EXISTING invite flow verbatim (setShowInvitePanel
                        already works for any Nth member) -- the only gap was ever
                        having a second way to trigger it beyond the automatic
                        first-participant prompt. */}
                    <button onClick={() => { setShowInvitePanel(true); setShowManageMenu(false); }} className="w-full text-left px-3 py-2 text-xs text-stone-300 hover:bg-stone-800 cursor-pointer">
                      {lang === "en" ? "Add member" : "ಸದಸ್ಯರನ್ನು ಸೇರಿಸಿ"}
                    </button>
                    <button onClick={() => { setShowAddCaseModal(true); setShowManageMenu(false); }} className="w-full text-left px-3 py-2 text-xs text-stone-300 hover:bg-stone-800 cursor-pointer">
                      {lang === "en" ? "Add another case" : "ಇನ್ನೊಂದು ಪ್ರಕರಣ ಸೇರಿಸಿ"}
                    </button>
                    <button onClick={handleGenerateDossier} className="w-full text-left px-3 py-2 text-xs text-stone-300 hover:bg-stone-800 cursor-pointer">
                      {lang === "en" ? "Generate Full Dossier" : "ಪೂರ್ಣ ದೋಶಿಯರ್ ರಚಿಸಿ"}
                    </button>
                    <div className="border-t border-stone-800 my-1" />
                    <button onClick={handleCloseInvestigation} className="w-full text-left px-3 py-2 text-xs text-rose-400 hover:bg-rose-500/10 cursor-pointer">
                      {lang === "en" ? "Close Investigation" : "ತನಿಖೆ ಮುಚ್ಚಿ"}
                    </button>
                  </div>
                </>
              )}
            </div>
          </>
        )}
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
        <button
          onClick={() => setShowBrowser(true)}
          title={lang === "en" ? "Browse with VAJRA" : "VAJRA ಬ್ರೌಸ್"}
          className="flex items-center justify-center p-1.5 rounded-lg border border-stone-800 bg-stone-900/60 hover:bg-stone-800 text-stone-400 hover:text-white transition-all shadow-md cursor-pointer"
        >
          <Globe className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* §9.4 Case Board (Investigation, full panel) / Chip Strip (regular
          chat, thin row) -- placed above the message list per the blueprint,
          inside the same scrollable thread region. */}
      {chatMessages.length > 0 && (
        <div className="px-4 sm:px-6 pt-4">
          <div className={`${messageWidthCls} mx-auto transition-all duration-200`}>
            {isActiveInvestigation ? (
              <CaseBoard messages={chatMessages} onJumpToMessage={handleJumpToMessage} />
            ) : (
              <CaseChipStrip messages={chatMessages} onJumpToMessage={handleJumpToMessage} />
            )}
          </div>
        </div>
      )}

      {/* WhatsApp-style pinned-messages strip -- only when 1+ messages are
          pinned. Collapsed shows a count; expanded lists short previews,
          clicking one jumps to and highlights the real message below (no
          separate fetch/re-render, same mechanism the Case Board uses). */}
      {pinnedMessages.length > 0 && (
        <div className="px-4 sm:px-6 pt-3">
          <div className={`${messageWidthCls} mx-auto rounded-lg border border-[#C79A4E]/25 bg-[#C79A4E]/[0.06] overflow-hidden transition-all duration-200`}>
            <button
              onClick={() => setPinnedStripExpanded((v) => !v)}
              className="w-full flex items-center gap-2 px-3 py-2 text-left cursor-pointer"
            >
              <Pin className="w-3.5 h-3.5 text-[#C79A4E] shrink-0" />
              <span className="text-xs font-bold text-[#C79A4E] font-mono">
                {pinnedMessages.length} {lang === "en" ? "pinned" : "ಪಿನ್ ಮಾಡಲಾಗಿದೆ"}
              </span>
              {pinnedStripExpanded ? (
                <ChevronUp className="w-3.5 h-3.5 text-stone-500 ml-auto shrink-0" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5 text-stone-500 ml-auto shrink-0" />
              )}
            </button>
            {pinnedStripExpanded && (
              <div className="border-t border-[#C79A4E]/20 divide-y divide-[#C79A4E]/10">
                {pinnedMessages.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => handleJumpToMessage(m.msgId!)}
                    className="w-full text-left px-3 py-2 text-xs text-stone-400 hover:bg-[#C79A4E]/10 transition-colors cursor-pointer truncate"
                  >
                    <span className="text-stone-600 font-mono mr-1.5">{m.sender === "user" ? (lang === "en" ? "You:" : "ನೀವು:") : "VAJRA.AI:"}</span>
                    {m.text}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Messages Thread Container. Bottom padding grows dynamically with the
          floating composer's real measured height (Section 125) so the last
          message is never hidden underneath it -- a static pb-* can't track
          a card whose height changes with attachments/recording/auto-grow. */}
      <div
        className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 space-y-6"
        style={!isEmptyChat ? { paddingBottom: `${composerHeight + 40}px` } : undefined}
      >
        <div className={`${messageWidthCls} mx-auto space-y-6 w-full transition-all duration-200`}>
        {loadingSessionId ? (
          <div className="space-y-6 animate-fade-in" aria-live="polite" aria-busy="true">
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
          <div className="h-full flex flex-col items-center justify-center text-center w-full max-w-4xl mx-auto px-4 animate-fade-in">
            {/* ZONE 1: Tight hero unit -- §9.10 context-aware greeting (time/date
                + officer name) brought close to the emblem and the composer.
                The old "VAJRA CENTRAL INQUEST HUB" title + CCTNS boilerplate
                paragraph (t.chatHubTitle/t.chatHubDesc) is gone from here --
                officers already know what VAJRA does, and it only pushed the
                prompt box down. The keys stay defined in translations.ts
                (Loophole L843) in case anything else still reads them. */}
            <GreetingHeader />
            <div className="w-13 h-13 my-1">
              <VajraLogo animated size={52} />
            </div>
            {/* Composer lives right here, inline with the greeting, until the
                first message sends -- not pinned to the true bottom of the
                screen with a gap under it (see composerContent's own
                definition above). */}
            <div className="w-full max-w-2xl px-2 mt-2">
              {composerContent}
            </div>

            {/* ZONE 2: Telemetry quick-action pills, directly below the
                prompt box -- real counts from the one shared digest fetch
                above, never placeholders. */}
            <div className="flex items-center justify-center flex-wrap gap-3 mt-5 mb-5">
              <button
                type="button"
                onClick={() => setCurrentScreen("investigations")}
                className="flex items-center gap-2 px-3 py-1 rounded-full bg-stone-900/80 border border-stone-800 hover:border-[#C79A4E]/40 text-stone-400 hover:text-stone-200 text-xs font-mono transition-all cursor-pointer shadow-sm"
              >
                <FolderOpen className="w-3.5 h-3.5 text-[#C79A4E]" />
                <span title={digestFailed ? (lang === "en" ? "Could not load -- try refreshing" : "ಲೋಡ್ ಆಗಲಿಲ್ಲ") : undefined}>
                  {homeDigest ? homeDigest.open_investigations : "—"}{" "}
                  {lang === "en" ? "Open Investigations" : "ಸಕ್ರಿಯ ತನಿಖೆಗಳು"}
                </span>
                <ChevronRight className="w-3 h-3 text-stone-500" />
              </button>
              <button
                type="button"
                onClick={() => setCurrentScreen("investigations")}
                className="flex items-center gap-2 px-3 py-1 rounded-full bg-stone-900/80 border border-stone-800 hover:border-[#C79A4E]/40 text-stone-400 hover:text-stone-200 text-xs font-mono transition-all cursor-pointer shadow-sm"
              >
                <Timer className="w-3.5 h-3.5 text-[#C79A4E]" />
                <span title={digestFailed ? (lang === "en" ? "Could not load -- try refreshing" : "ಲೋಡ್ ಆಗಲಿಲ್ಲ") : undefined}>
                  {homeDigest ? homeDigest.pending_tasks : "—"}{" "}
                  {lang === "en" ? "Pending Tasks" : "ಬಾಕಿ ಕಾರ್ಯಗಳು"}
                </span>
                <ChevronRight className="w-3 h-3 text-stone-500" />
              </button>
            </div>

            {/* ZONE 3: Dynamic self-collapsing dual tactical lanes (Section
                133). Approvals is only ever mounted for a supervisor with a
                real pending count > 0 -- for everyone else, OSINT expands
                front-and-center instead of leaving a half-empty grid.
                Gated on real digest data (never on a failed fetch): a
                fetch failure must never silently read as "0 approvals
                pending" and collapse the lane a supervisor may actually
                need. */}
            {digestFailed ? (
              <div className="w-full max-w-2xl mx-auto text-center text-[11px] text-stone-500 font-mono py-3">
                {lang === "en"
                  ? "Tactical signals unavailable right now -- try refreshing."
                  : "ಈಗ ಲಭ್ಯವಿಲ್ಲ -- ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ."}
              </div>
            ) : !homeDigest ? null : (() => {
              const hasPendingApprovals = isSupervisor && homeDigest.pending_approvals > 0;
              return (
                <div
                  className={
                    hasPendingApprovals
                      ? "w-full max-w-4xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-4 text-left transition-all duration-300 ease-in-out"
                      : "w-full max-w-2xl mx-auto flex justify-center text-left transition-all duration-300 ease-in-out"
                  }
                >
                  <OSINTCard
                    lang={lang}
                    isSupervisor={isSupervisor}
                    districtName={homeDigest.assigned_district}
                  />
                  {hasPendingApprovals && (
                    <ApprovalsCard
                      lang={lang}
                      pendingCount={homeDigest.pending_approvals}
                      onOpenApprovalsDesk={() => setCurrentScreen("supervisor")}
                    />
                  )}
                </div>
              );
            })()}
          </div>
        ) : (
          displayMessages.map((msg, idx) => {
            const vmeta = msg.variantGroup ? variantMeta[`${msg.variantGroup}::${msg.sender}`] : undefined;
            const fullIdx = chatMessages.findIndex((m) => m.id === msg.id);
            const pairedUser = fullIdx > 0 ? [...chatMessages.slice(0, fullIdx)].reverse().find((m) => m.sender === "user") : undefined;
            return (
            // §9.4 Case Board: data-msg-id + a brief highlight ring is what
            // "tap a board entry -> jump to and highlight the original
            // message" (Loophole L1: never re-run/re-fetch) actually hooks
            // into -- see handleJumpToMessage below.
            <div
              key={msg.id}
              data-msg-id={msg.msgId || undefined}
              className={msg.msgId && msg.msgId === highlightedMsgId ? "rounded-xl ring-2 ring-[#C79A4E]/60 transition-all" : ""}
            >
            <ChatBubble
              message={msg}
              lang={lang}
              voicePersona={voicePersona}
              textSize={transcriptTextSize}
              ttsSettings={ttsSettings}
              sessionId={activeSessionIdRef.current || ""}
              pairedQuery={msg.sender === "assistant" ? (pairedUser?.text || "") : undefined}
              onExpandWidget={(widgetType, widgetData) => {
                setExpandedWidget({ type: widgetType as any, data: widgetData });
                if (widgetType === "network") openNetworkWidget(); else setNetworkNewSince(null);
              }}
              onRetry={
                msg.retryText
                  ? () => {
                      handleSend(msg.retryText!, [], {
                        retryOfMsgId: msg.msgId || msg.id,
                        existingAttachments: pairedUser?.attachments || [],
                        cachedAttachmentAnalysis: (pairedUser as any)?.attachmentAnalysis || undefined,
                      });
                    }
                  : (msg.data?.pocso_redacted && pairedUser?.text)
                  ? () => {
                      handleSend(pairedUser.text, [], {
                        retryOfMsgId: msg.msgId || msg.id,
                        existingAttachments: pairedUser.attachments || [],
                        cachedAttachmentAnalysis: (pairedUser as any)?.attachmentAnalysis || undefined,
                      });
                    }
                  : undefined
              }
              onQuickReply={(text) => handleSend(text)}
              addToast={addToast}
              isLast={idx === displayMessages.length - 1}
              onMessageContentUpdate={(msgId, text, data) => {
                setChatMessages((prev) => prev.map((m) =>
                  (m.id === msgId || m.msgId === msgId)
                    ? { ...m, text, textEn: text, textKn: text, data: { ...(m.data || {}), ...data } }
                    : m
                ));
              }}
              onEditMessage={msg.sender === "user" && msg.msgId ? (newText) => handleEditMessage(msg.msgId!, newText) : undefined}
              onRetryVariant={msg.sender === "assistant" && msg.msgId ? () => {
                if (pairedUser) handleRetryVariant(msg.msgId!, pairedUser.text);
              } : undefined}
              totalVariants={vmeta?.total}
              activeVariantIndex={vmeta?.activeIndex}
              onCycleVariant={msg.variantGroup ? (dir) => handleCycleVariant(msg.variantGroup!, dir) : undefined}
              onTogglePin={msg.msgId ? () => handleTogglePin(msg.msgId!, !!msg.isPinned) : undefined}
            />
            </div>
            );
          })
        )}

        {/* Shimmer loading / Thinking indicator */}
        {isThinking && (
          <div className="flex items-start gap-3 max-w-[75%] animate-fade-in">
            <div className="w-8 h-8 rounded-full bg-[#C79A4E]/10 border border-[#C79A4E]/20 flex items-center justify-center shrink-0 glow-teal">
              <VajraLogo size={20} animated />
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
              {/* Live-progress ticker: a REAL step name the backend agent
                  loop actually just reached (see streamTicker above) --
                  never a fabricated status or a fake countdown. Empty until
                  the first real step is emitted, so it simply doesn't show
                  for the first moment of a turn. */}
              {tickerMessage && (
                <div className="text-[10px] text-[#C79A4E]/80 font-mono flex items-center gap-1.5">
                  <span className="w-1 h-1 rounded-full bg-[#C79A4E] animate-pulse shrink-0" />
                  {tickerMessage}
                </div>
              )}
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
      </div>

      {/* Floating "Ask VAJRA" composer capsule (Section 125): an absolute
          overlay above the thread, not a shrink-0 flex sibling, so message
          bubbles glide freely behind it during scroll instead of stopping
          at a rigid edge-to-edge footer bar. Outer wrapper is
          pointer-events-none so clicks on thread content in the margins to
          the left/right/underneath the card pass straight through;
          pointer-events-auto is restored on the card itself. Only rendered
          docked-to-the-bottom here once the thread has real messages -- for
          the empty state, composerContent instead renders centered
          alongside the greeting (above), never both/duplicated at once.
          The `#161412` hardcoded dissolve gradient is gone -- it hardcoded
          the DARK theme's background hex, so in light mode it rendered as
          a dirty black smudge over the (light) message thread. Using
          var(--color-background-dark) tracks whichever theme is active,
          since that token is itself redefined under html.light. */}
      {!isEmptyChat && (
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 z-30 print:hidden"
          role="region"
          aria-label={lang === "en" ? "VAJRA AI Copilot Prompt Composer" : "VAJRA AI ಪ್ರಾಂಪ್ಟ್ ಕಂಪೋಸರ್"}
        >
          {/* Floating composer capsule: only the centered input box itself is
              translucent (via .glass-panel + .composer-elevation). The full-width
              translucent bar, backdrop-blur, and gradient seam across the bottom
              of the viewport have been completely removed. Pointer-events are kept
              transparent on outer gutters so clicks pass through to thread content. */}
          <div
            ref={composerRef}
            className="p-4 pt-2 pb-[max(1rem,env(safe-area-inset-bottom))]"
          >
            {composerContent}
          </div>
        </div>
      )}

      {/* Cowork invite panel */}
      {showInvitePanel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/85 backdrop-blur-sm">
          <div className="w-full max-w-sm glass-panel border border-[#C79A4E]/30 rounded-2xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-black text-stone-100 uppercase tracking-wider font-mono flex items-center gap-2">
                <Users className="w-4 h-4 text-[#C79A4E]" /> {t.inviteToCowork}
              </h3>
              <button onClick={() => { setShowInvitePanel(false); setInvitedThisOpen([]); }} className="text-stone-500 hover:text-stone-200 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            {/* No participant cap exists server-side -- invite as many
                officers as needed, one at a time; each shows up here so it's
                obvious the panel stays open for the next one. */}
            {invitedThisOpen.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {invitedThisOpen.map((b, i) => (
                  <span key={i} className="text-[10px] font-mono px-2 py-1 rounded-md bg-[#5DCAA5]/10 border border-[#5DCAA5]/30 text-[#5DCAA5]">
                    ✓ {b}
                  </span>
                ))}
              </div>
            )}
            <div className="space-y-1">
              <label className="block text-[10px] font-black text-stone-450 uppercase font-mono">
                {t.badgeNumberKgidLabel}{invitedThisOpen.length > 0 ? (lang === "en" ? " (invite another)" : " (ಇನ್ನೊಬ್ಬರನ್ನು ಆಹ್ವಾನಿಸಿ)") : ""}
              </label>
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

      {/* §9.7 "Add another case" -- links an additional real CaseMaster
          record to this Investigation (InvestigationCaseLink). */}
      {showAddCaseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/85 backdrop-blur-sm">
          <div className="w-full max-w-sm glass-panel border border-stone-800 rounded-2xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-black text-stone-100 uppercase tracking-wider font-mono">
                {lang === "en" ? "Add Another Case" : "ಇನ್ನೊಂದು ಪ್ರಕರಣ ಸೇರಿಸಿ"}
              </h3>
              <button onClick={() => setShowAddCaseModal(false)} className="text-stone-500 hover:text-stone-200 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-1">
              <label className="block text-[10px] font-black text-stone-450 uppercase font-mono">
                {lang === "en" ? "Case / FIR Number" : "ಪ್ರಕರಣ / FIR ಸಂಖ್ಯೆ"}
              </label>
              <input
                type="text"
                value={addCaseNo}
                onChange={(e) => setAddCaseNo(e.target.value)}
                placeholder="e.g. FIR-2026-0814"
                className="w-full bg-stone-950/60 border border-stone-850 focus:border-[#C79A4E] rounded-xl py-2.5 px-3 text-xs text-stone-200 focus:outline-none transition-all"
              />
            </div>
            <button
              onClick={handleAddCase}
              disabled={isAddingCase || !addCaseNo.trim()}
              className="w-full py-2.5 rounded-xl bg-[#C79A4E]/10 hover:bg-[#C79A4E]/20 border border-[#C79A4E]/30 text-[#C79A4E] text-xs font-black uppercase tracking-wider transition-all disabled:opacity-50 cursor-pointer"
            >
              {isAddingCase ? (lang === "en" ? "Linking…" : "ಜೋಡಿಸಲಾಗುತ್ತಿದೆ…") : (lang === "en" ? "Link Case" : "ಪ್ರಕರಣ ಜೋಡಿಸಿ")}
            </button>
          </div>
        </div>
      )}

      {/* §9.5 Guided Task Workflow */}
      {showTaskChecklist && activeSessionId && (
        <TaskChecklist sessionId={activeSessionId} lang={lang} onClose={() => setShowTaskChecklist(false)} />
      )}

      {/* §9.6 Case Diary */}
      {showCaseDiary && activeSessionId && (
        <CaseDiary sessionId={activeSessionId} lang={lang} onClose={() => setShowCaseDiary(false)} />
      )}

      {/* E.1: written justification, only shown when the AI pre-screen
          actually flags an export as sensitive */}
      <ReasonCollectionModal
        isOpen={showReasonModal}
        title={lang === "en" ? "Justification Required" : "ಸಮರ್ಥನೆ ಅಗತ್ಯವಿದೆ"}
        subtitle={
          lang === "en"
            ? "AI pre-screen flagged this export as sensitive. Provide a real operational justification before it is sent for supervisor approval."
            : "AI ಪೂರ್ವ-ಪರಿಶೀಲನೆಯು ಈ ರಫ್ತನ್ನು ಸೂಕ್ಷ್ಮವೆಂದು ಗುರುತಿಸಿದೆ. ಮೇಲ್ವಿಚಾರಕರ ಅನುಮೋದನೆಗೆ ಕಳುಹಿಸುವ ಮೊದಲು ಕಾರ್ಯಾಚರಣೆಯ ಸಮರ್ಥನೆ ನೀಡಿ."
        }
        onClose={() => setShowReasonModal(false)}
        onSubmit={handleReasonSubmit}
      />

      {/* Section 19: Sandboxed Investigation Browser -- a real split-view side
          panel (docked to the right edge, chat stays fully visible and
          usable on the left) rather than a blocking modal, matching the
          split-pane "chat + live browser" layout an officer would expect
          from Claude's own browser-use view. No backdrop dim: both panes
          are meant to be looked at together, not one gating the other. */}
      {showBrowser && (
        <div className="fixed top-0 right-0 bottom-0 z-40 w-full sm:w-[46vw] sm:min-w-[420px] max-w-2xl p-2 sm:p-3 animate-fade-in">
          <InvestigationBrowser
            isOpen={showBrowser}
            onClose={() => setShowBrowser(false)}
            onSendToChat={(text) => { handleSend(text); }}
          />
        </div>
      )}

      {/* Language Selection Modal for Official PDF Dossier Export */}
      {showExportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-stone-900 border border-stone-800 rounded-2xl max-w-md w-full p-5 space-y-4 shadow-2xl relative">
            <div className="flex items-center justify-between border-b border-stone-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-[#C79A4E]/15 border border-[#C79A4E]/30 text-[#C79A4E] flex items-center justify-center">
                  <FileText className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-stone-100 flex items-center gap-1.5">
                    <span>{lang === "en" ? "Export Official Case Dossier" : "ಅಧಿಕೃತ ಪ್ರಕರಣ ದೋಶಿಯರ್ ರಫ್ತು"}</span>
                  </h3>
                  <p className="text-[10px] text-stone-400 font-mono">
                    {lang === "en" ? "Powered by Zoho Catalyst SmartBrowz" : "Zoho Catalyst SmartBrowz ಬೆಂಬಲಿತ"}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowExportModal(false)}
                className="text-stone-400 hover:text-stone-100 p-1 rounded-lg hover:bg-stone-800 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2">
              <label className="block text-[11px] font-bold text-stone-300 uppercase tracking-wider">
                {lang === "en" ? "Select Report Language" : "ವರದಿಯ ಭಾಷೆಯನ್ನು ಆಯ್ಕೆಮಾಡಿ"}
              </label>
              <p className="text-xs text-stone-400">
                {lang === "en"
                  ? "Choose the primary language for the certified investigation transcript, cards, and diagrams."
                  : "ಪ್ರಮಾಣೀಕೃತ ತನಿಖಾ ಪ್ರತಿ ಮತ್ತು ವಿಶ್ಲೇಷಣೆಗಾಗಿ ಪ್ರಾಥಮಿಕ ಭಾಷೆಯನ್ನು ಆಯ್ಕೆಮಾಡಿ."}
              </p>

              {/* Language Radio Cards */}
              <div className="grid grid-cols-1 gap-2.5 pt-2">
                {/* English Option */}
                <button
                  type="button"
                  onClick={() => setExportTargetLang("en")}
                  className={`flex items-start gap-3 p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                    exportTargetLang === "en"
                      ? "bg-[#C79A4E]/10 border-[#C79A4E] shadow-[0_0_15px_rgba(199,154,78,0.15)]"
                      : "bg-stone-950/60 border-stone-800 hover:border-stone-700 text-stone-400"
                  }`}
                >
                  <div className={`mt-0.5 w-4 h-4 rounded-full border flex items-center justify-center ${
                    exportTargetLang === "en" ? "border-[#C79A4E] bg-[#C79A4E]" : "border-stone-600"
                  }`}>
                    {exportTargetLang === "en" && <Check className="w-2.5 h-2.5 text-stone-950 stroke-[3]" />}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <span className={`text-xs font-bold ${exportTargetLang === "en" ? "text-[#E4C590]" : "text-stone-200"}`}>
                        English (Official SCRB Dossier)
                      </span>
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-stone-800 text-stone-300">EN</span>
                    </div>
                    <p className="text-[11px] text-stone-400 mt-1 leading-relaxed">
                      Official State Crime Records Bureau format with English transcript, structured intelligence cards, and evidence trail.
                    </p>
                  </div>
                </button>

                {/* Kannada Option */}
                <button
                  type="button"
                  onClick={() => setExportTargetLang("kn")}
                  className={`flex items-start gap-3 p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                    exportTargetLang === "kn"
                      ? "bg-[#C79A4E]/10 border-[#C79A4E] shadow-[0_0_15px_rgba(199,154,78,0.15)]"
                      : "bg-stone-950/60 border-stone-800 hover:border-stone-700 text-stone-400"
                  }`}
                >
                  <div className={`mt-0.5 w-4 h-4 rounded-full border flex items-center justify-center ${
                    exportTargetLang === "kn" ? "border-[#C79A4E] bg-[#C79A4E]" : "border-stone-600"
                  }`}>
                    {exportTargetLang === "kn" && <Check className="w-2.5 h-2.5 text-stone-950 stroke-[3]" />}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <span className={`text-xs font-bold ${exportTargetLang === "kn" ? "text-[#E4C590]" : "text-stone-200"}`}>
                        ಕನ್ನಡ (ಅಧಿಕೃತ ಕೆಎಸ್‌ಪಿ ವರದಿ)
                      </span>
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-stone-800 text-stone-300">KN</span>
                    </div>
                    <p className="text-[11px] text-stone-400 mt-1 leading-relaxed">
                      ಸಂಪೂರ್ಣ ಕನ್ನಡ ಭಾಷೆಯ ಅಧಿಕೃತ ವರದಿ, ಕನ್ನಡ ಯುನಿಕೋಡ್ ಫಾಂಟ್‌ಗಳು, ವಿಶ್ಲೇಷಣಾ ವಿಭಾಗ ಕಾರ್ಡ್‌ಗಳು ಮತ್ತು ಆಡಿಟ್ ಲೆಡ್ಜರ್.
                    </p>
                  </div>
                </button>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-stone-800">
              <button
                type="button"
                onClick={() => setShowExportModal(false)}
                className="px-3.5 py-2 rounded-xl text-xs font-semibold text-stone-400 hover:text-stone-200 hover:bg-stone-800 transition-all cursor-pointer"
              >
                {lang === "en" ? "Cancel" : "ರದ್ದುಮಾಡಿ"}
              </button>
              <button
                type="button"
                onClick={() => executeExport(exportTargetLang)}
                disabled={isExportingPdf}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#C79A4E] hover:bg-[#b0853e] text-stone-950 text-xs font-bold shadow-lg transition-all cursor-pointer disabled:opacity-50 disabled:cursor-wait"
              >
                <Download className="w-3.5 h-3.5 stroke-[2.5]" />
                <span>
                  {isExportingPdf
                    ? (lang === "en" ? "Generating PDF…" : "ರಚಿಸಲಾಗುತ್ತಿದೆ…")
                    : (lang === "en" ? `Generate ${exportTargetLang.toUpperCase()} PDF` : `${exportTargetLang === "kn" ? "ಕನ್ನಡ" : "ಇಂಗ್ಲಿಷ್"} PDF ರಫ್ತು`)}
                </span>
              </button>
            </div>
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
            onFollowUpQuery={(text) => { setExpandedWidget(null); handleSend(text); }}
            networkNewSinceTimestamp={networkNewSince}
          />
        </Suspense>
      )}
      </div>
    </div>
  );
};
