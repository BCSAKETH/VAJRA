import React, { useState, useEffect, useRef } from "react";
import { useApp, ChatMessage } from "../AppContext";
import { API_BASE } from "../config";
import { ChatBubble } from "../components/ChatBubble";
import { ExpandedOverlay } from "../components/ExpandedOverlay";
import { ChatHistoryPanel } from "../components/ChatHistoryPanel";
import { AppletPanel, AppletSpec } from "../components/AppletPanel";
import { Mic, MicOff, Send, Download, Sparkles, Paperclip, X, FileText, Image as ImageIcon, Users } from "lucide-react";

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
    addToast,
    setIsAuthenticated,
  } = useApp();

  const [inputVal, setInputVal] = useState("");
  // The real, backend-assigned session id for the active conversation. null
  // means "no session yet" -- /api/chat auto-creates one on the first turn
  // and returns it; every subsequent turn in this conversation reuses it so
  // messages land in the same ChatSession row instead of scattering across
  // synthetic per-request ids.
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [sessionsRefreshKey, setSessionsRefreshKey] = useState(0);
  const [appletSpec, setAppletSpec] = useState<AppletSpec | null>(null);
  const [isAppletLoading, setIsAppletLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingStatus, setRecordingStatus] = useState("");
  const [voiceAvailable, setVoiceAvailable] = useState(true);
  const [isThinking, setIsThinking] = useState(false);
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

  // Cowork mode: "chat" is today's solo behavior, unchanged. "cowork" shows
  // an invite prompt (once a session exists) and switches message delivery
  // over to the WebSocket broadcast so every participant sees the same
  // live thread instead of only the sender seeing their own optimistic update.
  const [chatMode, setChatMode] = useState<"chat" | "cowork">("chat");
  const [showInvitePanel, setShowInvitePanel] = useState(false);
  const [inviteBadge, setInviteBadge] = useState("");
  const [inviteRole, setInviteRole] = useState<"viewer" | "collaborator">("collaborator");
  const [isInviting, setIsInviting] = useState(false);
  const [hasParticipants, setHasParticipants] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

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
              // Pop toast -- alert.timestamp is the real TriggerTime from
              // ProactiveAlerts, not "now", so old alerts read as old.
              addToast(
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
  }, [addToast]);

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
    if (!activeSessionId) return;

    const wsProtocol = API_BASE.startsWith("https") ? "wss" : "ws";
    const wsHost = API_BASE.replace(/^https?:\/\//, "");
    const token = localStorage.getItem("vajra_token") || "";
    const ws = new WebSocket(`${wsProtocol}://${wsHost}/ws/chat/${activeSessionId}?token=${encodeURIComponent(token)}`);
    wsRef.current = ws;

    ws.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload.type !== "message") return;
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
          setIsThinking(false);
        }
      } catch (err) {
        console.error("Failed to parse WebSocket message:", err);
      }
    };
    ws.onerror = (err) => console.error("Cowork WebSocket error:", err);

    return () => {
      ws.close();
      wsRef.current = null;
    };
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

  // Start voice recognition -- real browser STT (Web Speech API), not a
  // record-then-upload-to-a-503 flow. Transcription streams into the input
  // box live as the officer speaks; nothing is sent to the backend until
  // they actually hit Send, same as typing.
  const startRecording = () => {
    const SpeechRecognitionCtor = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognitionCtor) {
      addToast(
        lang === "en" ? "Voice Input Unavailable" : "ಧ್ವನಿ ಇನ್‌ಪುಟ್ ಲಭ್ಯವಿಲ್ಲ",
        lang === "en" ? "This browser does not support speech recognition." : "ಈ ಬ್ರೌಸರ್ ಸ್ಪೀಚ್ ರೆಕಗ್ನಿಷನ್ ಬೆಂಬಲಿಸುವುದಿಲ್ಲ.",
        "Warning"
      );
      return;
    }
    const recognition = new SpeechRecognitionCtor();
    recognition.lang = lang === "kn" ? "kn-IN" : "en-IN";
    recognition.continuous = true;
    recognition.interimResults = true;
    recognitionRef.current = recognition;

    let finalTranscript = "";

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i] as unknown as { 0: { transcript: string }; isFinal: boolean };
        if (result.isFinal) {
          finalTranscript += result[0].transcript;
        } else {
          interim += result[0].transcript;
        }
      }
      setInputVal((finalTranscript + interim).trim());
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      console.error("Speech recognition error:", event.error);
      if (event.error !== "no-speech") {
        addToast(
          lang === "en" ? "Voice Input Error" : "ಧ್ವನಿ ಇನ್‌ಪುಟ್ ದೋಷ",
          lang === "en" ? `Speech recognition failed: ${event.error}` : `ಸ್ಪೀಚ್ ರೆಕಗ್ನಿಷನ್ ವಿಫಲವಾಗಿದೆ: ${event.error}`,
          "Warning"
        );
      }
      setIsRecording(false);
      setRecordingStatus("");
    };

    recognition.onend = () => {
      setIsRecording(false);
      setRecordingStatus("");
    };

    recognition.start();
    setIsRecording(true);
    setRecordingStatus(lang === "en" ? "Listening..." : "ಆಲಿಸಲಾಗುತ್ತಿದೆ...");
  };

  // Stop voice recognition
  const stopRecording = () => {
    if (recognitionRef.current && isRecording) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
      setIsRecording(false);
      setRecordingStatus("");
    }
  };

  // Second request for the analysis panel (Phase 7) -- now a deterministic,
  // no-LLM mapping server-side (see generate_applet_spec in agent_loop.py),
  // so this resolves almost instantly. Still its own call/round-trip rather
  // than inlined into the main response so a network hiccup here can't
  // delay the chat reply itself.
  const fetchAppletSpec = async (responseType: string, data: any) => {
    setIsAppletLoading(true);
    try {
      const response = await fetch(`${API_BASE}/api/chat/applet`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${localStorage.getItem("vajra_token") || ""}`,
        },
        body: JSON.stringify({ response_type: responseType, data: data || {} }),
      });
      if (response.ok) {
        const result = await response.json();
        setAppletSpec(result.applet || null);
      } else {
        setAppletSpec(null);
      }
    } catch (err) {
      console.error("Applet spec fetch failed:", err);
      setAppletSpec(null);
    } finally {
      setIsAppletLoading(false);
    }
  };

  // Client-side validation mirrors the backend's real limits (8MB/file, 3
  // files, 20MB aggregate, PDF/JPEG only) so a rejection is instant and
  // specific instead of a generic failure after an upload round-trip.
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected: File[] = Array.from(e.target.files || []);
    e.target.value = "";
    if (selected.length === 0) return;

    if (pendingAttachments.length + selected.length > MAX_ATTACHMENTS_PER_MESSAGE) {
      addToast(
        lang === "en" ? "Too Many Attachments" : "ಹಲವಾರು ಲಗತ್ತುಗಳು",
        lang === "en" ? `Max ${MAX_ATTACHMENTS_PER_MESSAGE} files per message.` : `ಪ್ರತಿ ಸಂದೇಶಕ್ಕೆ ಗರಿಷ್ಠ ${MAX_ATTACHMENTS_PER_MESSAGE} ಫೈಲ್‌ಗಳು.`,
        "Warning"
      );
      return;
    }
    for (const f of selected) {
      if (!ALLOWED_ATTACHMENT_TYPES.includes(f.type)) {
        addToast(
          lang === "en" ? "Unsupported File Type" : "ಬೆಂಬಲಿಸದ ಫೈಲ್ ಪ್ರಕಾರ",
          lang === "en" ? `'${f.name}' must be a PDF or JPEG.` : `'${f.name}' PDF ಅಥವಾ JPEG ಆಗಿರಬೇಕು.`,
          "Warning"
        );
        return;
      }
      if (f.size > MAX_ATTACHMENT_BYTES) {
        addToast(
          lang === "en" ? "File Too Large" : "ಫೈಲ್ ತುಂಬಾ ದೊಡ್ಡದಾಗಿದೆ",
          lang === "en" ? `'${f.name}' exceeds the 8 MB per-file limit.` : `'${f.name}' ೮ MB ಮಿತಿಯನ್ನು ಮೀರಿದೆ.`,
          "Warning"
        );
        return;
      }
    }
    const aggregate = [...pendingAttachments, ...selected].reduce((sum, f) => sum + f.size, 0);
    if (aggregate > MAX_AGGREGATE_BYTES) {
      addToast(
        lang === "en" ? "Attachments Too Large" : "ಲಗತ್ತುಗಳು ತುಂಬಾ ದೊಡ್ಡದಾಗಿವೆ",
        lang === "en" ? "Total attachment size exceeds the 20 MB limit for this message." : "ಒಟ್ಟು ಲಗತ್ತು ಗಾತ್ರ ಈ ಸಂದೇಶಕ್ಕೆ ೨೦ MB ಮಿತಿಯನ್ನು ಮೀರಿದೆ.",
        "Warning"
      );
      return;
    }
    setPendingAttachments((prev) => [...prev, ...selected]);
  };

  const removeAttachment = (index: number) => {
    setPendingAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  // Submit Text Query to Copilot Agent Loop
  const handleSend = async (textToSend: string) => {
    // Guards against duplicate sends -- e.g. the Enter keydown handler and
    // a rapid double-click on Send both firing before the first request
    // resolves, which previously queued multiple identical messages.
    if (isThinking || isUploadingAttachments) return;
    if (!textToSend.trim() && pendingAttachments.length === 0) return;

    // If there are attachments, upload+analyze them first, then prepend the
    // analysis to the query as context before it reaches the normal GLM
    // agent loop -- Qwen reads the evidence, GLM reasons over the combined text.
    let queryForAgent = textToSend;
    let uploadedAttachmentRefs: { file_name: string; type: string; page_count: number }[] = [];
    if (pendingAttachments.length > 0) {
      setIsUploadingAttachments(true);
      try {
        const formData = new FormData();
        pendingAttachments.forEach((f) => formData.append("files", f));
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
      setPendingAttachments([]);
    }

    // Once a session exists, the WebSocket is connected and delivers every
    // message (including the sender's own) via broadcast -- appending it
    // here too would show it twice. Only the very first message of a brand
    // new session (before a session_id/WS connection exists yet) still
    // needs the old optimistic local append.
    const wsAlreadyConnected = !!activeSessionId;
    if (!wsAlreadyConnected) {
      const userMsg: ChatMessage = {
        id: `msg-${Date.now()}-user`,
        sender: "user",
        text: textToSend,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        attachments: uploadedAttachmentRefs.length > 0 ? uploadedAttachmentRefs : undefined,
      };
      setChatMessages((prev) => [...prev, userMsg]);
    }
    setInputVal("");
    setThinkingType(lang === "kn" ? "translation" : "standard");
    setIsThinking(true);

    try {
      const response = await fetch(`${API_BASE}/api/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${localStorage.getItem("vajra_token") || ""}`,
        },
        body: JSON.stringify({
          message: queryForAgent,
          lang: lang,
          session_id: activeSessionId,
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

      // Once the WebSocket is connected, it delivers this same message via
      // broadcast -- appending it here too would duplicate it. Only the
      // first turn (before a session/WS exists) still needs this.
      if (!wsAlreadyConnected && data.ai_invoked !== false) {
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
        };
        setChatMessages((prev) => [...prev, aiMsg]);
      }

      // First turn of a new conversation: the backend just auto-created a
      // real ChatSession and handed back its id. Adopt it so every
      // subsequent turn in this conversation persists to the same session,
      // and nudge the history sidebar to refresh so the new entry shows up.
      if (!activeSessionId && data.session_id) {
        setActiveSessionId(data.session_id);
        setSessionsRefreshKey((k) => k + 1);
        // If the officer picked "Cowork" mode before sending the first
        // message, the session now exists -- prompt for who to invite.
        if (chatMode === "cowork") {
          setShowInvitePanel(true);
        }
      }

      // Second, independent call for the analysis panel -- fired after the
      // chat reply is already shown, so a slow or empty applet response
      // never delays the answer itself. The panel shows a loading skeleton
      // until this resolves.
      if (data.ai_invoked !== false) {
        fetchAppletSpec(data.response_type, data.data);
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
        isSimulated: false,
      };
      setChatMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsThinking(false);
      setThinkingType("standard");
    }
  };

  // Start a fresh conversation -- clears the transcript and drops the active
  // session id, so the next message sent auto-creates a brand new ChatSession.
  const handleNewChat = () => {
    setChatMessages([]);
    setActiveSessionId(null);
    setAppletSpec(null);
    setChatMode("chat");
    setHasParticipants(false);
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

  // Resume a past conversation from the history sidebar.
  const handleSelectSession = async (sessionId: string) => {
    try {
      const response = await fetch(`${API_BASE}/api/sessions/${sessionId}/messages`, {
        headers: { "Authorization": `Bearer ${localStorage.getItem("vajra_token") || ""}` },
      });
      if (!response.ok) {
        throw new Error("Failed to load session history.");
      }
      const messages = await response.json();
      const loaded: ChatMessage[] = messages.map((m: any, idx: number) => ({
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
      }));
      setChatMessages(loaded);
      setActiveSessionId(sessionId);
      // Applet specs aren't persisted per-turn, so there's nothing honest to
      // show for a resumed conversation's past turns until a new message is sent.
      setAppletSpec(null);
    } catch (err) {
      console.error(err);
      addToast(
        lang === "en" ? "Failed to Load Session" : "ಅಧಿವೇಶನ ಲೋಡ್ ವಿಫಲವಾಗಿದೆ",
        lang === "en" ? "Could not retrieve past conversation history." : "ಹಿಂದಿನ ಸಂಭಾಷಣೆ ಇತಿಹಾಸವನ್ನು ಪಡೆಯಲು ಸಾಧ್ಯವಾಗಲಿಲ್ಲ.",
        "Critical"
      );
    }
  };

  // Export Transcript to PDF
  const handleExportPDF = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/chat/export-pdf`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${localStorage.getItem("vajra_token") || ""}`,
        },
        body: JSON.stringify({
          transcript: chatMessages.map((m) => ({
            role: m.sender,
            // Respect the officer's CURRENTLY selected language, not
            // whichever one was active when each message first came in --
            // otherwise toggling language mid-conversation and exporting
            // would produce a transcript mixing both languages per message.
            content: m.sender === "assistant"
              ? (lang === "kn" ? (m.textKn || m.text) : (m.textEn || m.text))
              : m.text,
            timestamp: m.timestamp || "",
          })),
          badge_id: badgeNumber || "KSP-4003385",
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to compile PDF.");
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
    }
  };

  const suggestionChips = [
    { label: lang === "en" ? "Assess conviction risk for suspect Ramesh" : "ರಮೇಶ್ ಅಪರಾಧದ ಅಪಾಯ ವಿಶ್ಲೇಷಿಸು", text: "Assess conviction risk for suspect Ramesh" },
    { label: lang === "en" ? "Find similar burglary cases" : " burglary ಪ್ರಕರಣಗಳನ್ನು ಹುಡುಕಿ", text: "Find similar burglary cases" },
    { label: lang === "en" ? "Plot crime hotspot coordinates" : "ಅಪರಾಧದ ಹಾಟ್‌ಸ್ಪಾಟ್‌ಗಳನ್ನು ತೋರಿಸಿ", text: "Plot crime hotspot coordinates" },
  ];

  return (
    <div className="h-full flex overflow-hidden bg-slate-950/20">
      <ChatHistoryPanel
        activeSessionId={activeSessionId}
        onSelectSession={handleSelectSession}
        onNewChat={handleNewChat}
        refreshKey={sessionsRefreshKey}
      />

      <div className="flex-1 flex flex-col relative overflow-hidden">
      {/* Header export action button */}
      <div className="absolute top-4 right-4 z-20">
        {chatMessages.length > 0 && (
          <button
            onClick={handleExportPDF}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-800 bg-slate-900/60 hover:bg-slate-800 text-xs font-semibold text-slate-400 hover:text-white transition-all shadow-md cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{t.exportPdf}</span>
          </button>
        )}
      </div>

      {/* Messages Thread Container */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
        {chatMessages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center max-w-lg mx-auto space-y-4 animate-fade-in">
            <div className="w-16 h-16 rounded-full bg-[#00C6AD]/10 border border-[#00C6AD]/25 text-[#00C6AD] flex items-center justify-center glow-teal">
              <Sparkles className="w-8 h-8" />
            </div>
            <div className="space-y-1.5">
              <h2 className="text-base font-bold text-slate-200 uppercase tracking-wider">
                {t.chatHubTitle}
              </h2>
              <p className="text-xs text-slate-500 leading-relaxed">
                {t.chatHubDesc}
              </p>
            </div>
          </div>
        ) : (
          chatMessages.map((msg) => (
            <ChatBubble
              key={msg.id}
              message={msg}
              lang={lang}
              onExpandWidget={(widgetType, widgetData) => setExpandedWidget({ type: widgetType as any, data: widgetData })}
            />
          ))
        )}

        {/* Shimmer loading / Thinking indicator */}
        {isThinking && (
          <div className="flex items-start gap-3 max-w-[75%] animate-fade-in">
            <div className="w-8 h-8 rounded-full bg-[#00C6AD]/10 border border-[#00C6AD]/20 flex items-center justify-center shrink-0 glow-teal">
              <Sparkles className="w-4 h-4 text-[#00C6AD] animate-spin" />
            </div>
            <div className="space-y-2 flex-1">
              <div className="text-[10px] font-mono text-slate-500 font-bold uppercase tracking-wider flex items-center gap-2">
                <span>
                  {thinkingType === "translation"
                    ? t.translatingIndicator
                    : t.thinkingIndicator}
                </span>
                <span className="text-[#00C6AD]">{thinkingSeconds}s</span>
              </div>
              {/* GLM is a "thinking" model that reasons at length before
                  answering -- confirmed live, 15-140s is normal, not stuck.
                  Past 20s (well within one uneventful turn) this softens the
                  wait instead of letting the officer assume it hung. */}
              {thinkingSeconds > 20 && (
                <div className="text-[9.5px] text-slate-600 font-mono">
                  {lang === "en"
                    ? "Complex queries can take over a minute — still working."
                    : "ಸಂಕೀರ್ಣ ಪ್ರಶ್ನೆಗಳಿಗೆ ಒಂದು ನಿಮಿಷಕ್ಕಿಂತ ಹೆಚ್ಚು ಸಮಯ ಬೇಕಾಗಬಹುದು — ಇನ್ನೂ ಕೆಲಸ ಮಾಡುತ್ತಿದೆ."}
                </div>
              )}
              <div className="shimmer-bg h-10 w-full rounded-xl border border-slate-900" />
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input controls & suggestions footer */}
      <div className="p-4 border-t border-slate-850 bg-slate-900/10 shrink-0">
        <div className="max-w-4xl mx-auto space-y-4">
          {/* Suggestion Chips */}
          {chatMessages.length === 0 && (
            <div className="flex flex-wrap gap-2 justify-center">
              {suggestionChips.map((chip, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSend(chip.text)}
                  className="px-3 py-1.5 rounded-full border border-slate-800 hover:border-[#00C6AD]/40 bg-slate-900/50 hover:bg-[#00C6AD]/5 text-[11px] text-slate-450 hover:text-slate-200 transition-all cursor-pointer"
                >
                  {chip.label}
                </button>
              ))}
            </div>
          )}

          {/* Pending attachment preview chips */}
          {pendingAttachments.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {pendingAttachments.map((f, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-[#00C6AD]/25 bg-[#00C6AD]/5 text-[11px] text-slate-300"
                >
                  {f.type === "application/pdf" ? (
                    <FileText className="w-3.5 h-3.5 text-[#00C6AD]" />
                  ) : (
                    <ImageIcon className="w-3.5 h-3.5 text-[#00C6AD]" />
                  )}
                  <span className="max-w-[140px] truncate">{f.name}</span>
                  <button onClick={() => removeAttachment(idx)} className="text-slate-500 hover:text-rose-500 cursor-pointer">
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Input controls block */}
          <div className="flex items-center gap-3">
            {/* Microphone Toggle — disabled honestly when voice/STT isn't actually
                configured, instead of letting an officer record audio that would
                just be uploaded and discarded on a guaranteed 503. */}
            <button
              onClick={isRecording ? stopRecording : startRecording}
              disabled={!voiceAvailable}
              className={`p-3.5 rounded-xl border transition-all ${
                !voiceAvailable
                  ? "bg-slate-950/40 border-slate-900 text-slate-700 cursor-not-allowed"
                  : isRecording
                  ? "bg-rose-500/10 border-rose-500/30 text-rose-500 animate-pulse cursor-pointer"
                  : "bg-slate-900 border-slate-800 hover:border-[#00C6AD]/40 text-slate-400 hover:text-slate-200 cursor-pointer"
              }`}
              title={voiceAvailable ? t.micTitleAvailable : t.micTitleUnavailable}
            >
              {isRecording ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
            </button>

            {/* Attach evidence (PDF/JPEG) */}
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf,image/jpeg"
              multiple
              className="hidden"
              onChange={handleFileSelect}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={pendingAttachments.length >= MAX_ATTACHMENTS_PER_MESSAGE || isUploadingAttachments}
              className="p-3.5 rounded-xl border bg-slate-900 border-slate-800 hover:border-[#00C6AD]/40 text-slate-400 hover:text-slate-200 transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              title={t.attachTitle}
            >
              <Paperclip className="w-5 h-5" />
            </button>

            {/* Main Text Input -- disabled while a send is in flight so an
                impatient re-click/re-Enter during a slow GLM round-trip
                can't queue up duplicate messages. */}
            <div className="flex-1 relative">
              <input
                type="text"
                value={inputVal}
                onChange={(e) => setInputVal(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !isThinking && !isUploadingAttachments && handleSend(inputVal)}
                placeholder={isUploadingAttachments ? t.uploadingAttachments : (recordingStatus || t.chatPlaceholder)}
                disabled={isThinking || isUploadingAttachments}
                className="w-full bg-slate-950/65 border border-slate-800 focus:border-[#00C6AD] rounded-xl py-3.5 px-4 text-sm text-slate-100 placeholder-slate-600 focus:outline-none transition-all pr-12 disabled:opacity-50"
              />
              <button
                onClick={() => handleSend(inputVal)}
                disabled={isThinking || isUploadingAttachments}
                className="absolute right-2 top-2 p-2 rounded-lg bg-slate-900 border border-slate-800 hover:border-[#00C6AD]/40 text-slate-400 hover:text-[#00C6AD] transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Chat / Cowork mode toggle */}
          <div className="flex items-center gap-2">
            <div className="inline-flex rounded-lg border border-slate-800 bg-slate-950/50 p-0.5">
              <button
                onClick={() => handleToggleCowork("chat")}
                className={`px-3 py-1.5 rounded-md text-[11px] font-bold uppercase tracking-wider transition-all cursor-pointer ${
                  chatMode === "chat" ? "bg-slate-800 text-slate-100" : "text-slate-500 hover:text-slate-300"
                }`}
              >
                {t.chatModeChat}
              </button>
              <button
                onClick={() => handleToggleCowork("cowork")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-bold uppercase tracking-wider transition-all cursor-pointer ${
                  chatMode === "cowork" ? "bg-[#00C6AD]/15 text-[#00C6AD]" : "text-slate-500 hover:text-slate-300"
                }`}
              >
                <Users className="w-3 h-3" /> {t.chatModeCowork}
              </button>
            </div>
            {hasParticipants && (
              <span className="text-[10px] text-[#00C6AD] font-mono">
                {t.sharedSessionHint}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Cowork invite panel */}
      {showInvitePanel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-sm">
          <div className="w-full max-w-sm glass-panel border border-[#00C6AD]/30 rounded-2xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-black text-slate-100 uppercase tracking-wider font-mono flex items-center gap-2">
                <Users className="w-4 h-4 text-[#00C6AD]" /> {t.inviteToCowork}
              </h3>
              <button onClick={() => setShowInvitePanel(false)} className="text-slate-500 hover:text-slate-200 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-1">
              <label className="block text-[10px] font-black text-slate-450 uppercase font-mono">{t.badgeNumberKgidLabel}</label>
              <input
                type="text"
                value={inviteBadge}
                onChange={(e) => setInviteBadge(e.target.value)}
                placeholder="e.g. 1594888"
                className="w-full bg-slate-950/60 border border-slate-850 focus:border-[#00C6AD] rounded-xl py-2.5 px-3 text-xs text-slate-200 focus:outline-none transition-all"
              />
            </div>
            <div className="space-y-1">
              <label className="block text-[10px] font-black text-slate-450 uppercase font-mono">{t.accessLevelLabel}</label>
              <div className="flex gap-2">
                <button
                  onClick={() => setInviteRole("viewer")}
                  className={`flex-1 py-2 rounded-lg border text-[11px] font-bold uppercase tracking-wider transition-all cursor-pointer ${
                    inviteRole === "viewer" ? "bg-slate-800 border-slate-700 text-slate-100" : "border-slate-850 text-slate-500 hover:text-slate-300"
                  }`}
                >
                  {t.viewerLabel}
                </button>
                <button
                  onClick={() => setInviteRole("collaborator")}
                  className={`flex-1 py-2 rounded-lg border text-[11px] font-bold uppercase tracking-wider transition-all cursor-pointer ${
                    inviteRole === "collaborator" ? "bg-[#00C6AD]/15 border-[#00C6AD]/40 text-[#00C6AD]" : "border-slate-850 text-slate-500 hover:text-slate-300"
                  }`}
                >
                  {t.collaboratorLabel}
                </button>
              </div>
              <p className="text-[10px] text-slate-550 pt-1">
                {inviteRole === "viewer" ? t.viewerDesc : t.collaboratorDesc}
              </p>
            </div>
            <button
              onClick={handleSendInvite}
              disabled={isInviting || !activeSessionId}
              className="w-full py-2.5 rounded-xl bg-[#00C6AD]/10 hover:bg-[#00C6AD]/20 border border-[#00C6AD]/30 text-[#00C6AD] text-xs font-black uppercase tracking-wider transition-all disabled:opacity-50 cursor-pointer"
            >
              {isInviting ? t.sendingInvitation : t.sendInvitation}
            </button>
          </div>
        </div>
      )}

      {/* Full screen widgets expansion backdrop */}
      {expandedWidget && (
        <ExpandedOverlay
          type={expandedWidget.type}
          data={expandedWidget.data}
          onClose={() => setExpandedWidget(null)}
        />
      )}
      </div>

      <AppletPanel spec={appletSpec} isLoading={isAppletLoading} />
    </div>
  );
};
