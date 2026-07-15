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

  const [expandedWidget, setExpandedWidget] = useState<{ type: "map" | "network" | "risk" | "forecast" | "timeline" | "mo_match" | "correlation"; data: any } | null>(null);
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
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const wsRef = useRef<WebSocket | null>(null);

  // Poll proactive alerts
  useEffect(() => {
    const seenAlerts = new Set<string>();
    
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
            const alertKey = `${alert.type}-${alert.timestamp}-${alert.message}`;
            if (!seenAlerts.has(alertKey)) {
              seenAlerts.add(alertKey);
              // Pop toast
              addToast(
                alert.type === "SPATIAL_SPIKE" ? "🚨 Spatial Crime Spike" : "👤 Repeat Offender Alert",
                alert.message,
                "Warning"
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

  // Check whether voice/STT is actually configured before letting an officer record
  // audio that would otherwise be recorded, uploaded, and thrown away on a 503.
  useEffect(() => {
    fetch(`${API_BASE}/health`)
      .then((res) => res.json())
      .then((data) => setVoiceAvailable(Boolean(data.voice_service_available)))
      .catch(() => setVoiceAvailable(false));
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
            timestamp: new Date(payload.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            responseType: payload.response_type,
            data: payload.data,
            citations: payload.citations,
            senderName: payload.sender_name,
            senderEmployeeId: payload.sender_employee_id,
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

  // Start Mic Audio Recording
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        await uploadAudioPayload(audioBlob);
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingStatus(lang === "en" ? "Recording audio..." : "ಧ್ವನಿ ರೆಕಾರ್ಡ್ ಮಾಡಲಾಗುತ್ತಿದೆ...");
    } catch (err) {
      console.error("Failed to access audio devices:", err);
      addToast("Audio Access Error", "Could not start microphone stream.", "Critical");
    }
  };

  // Stop Mic Audio Recording
  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setRecordingStatus("");
    }
  };

  // Upload Voice Blob to ASR Processing Pipeline
  const uploadAudioPayload = async (blob: Blob) => {
    try {
      setThinkingType("translation");
      setIsThinking(true);
      
      const formData = new FormData();
      formData.append("audio", blob, "voice_inquest.webm");

      const response = await fetch(`${API_BASE}/api/voice/process-stream`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("ASR transcription pipeline returned an error.");
      }

      const result = await response.json();
      const transcribedText = lang === "kn" ? result.transcription : result.translation_english;
      
      if (transcribedText) {
        setInputVal(transcribedText);
        addToast(
          lang === "en" ? "Speech Transcribed" : "ಧ್ವನಿಯನ್ನು ಅನುವಾದಿಸಲಾಗಿದೆ",
          `Result: "${transcribedText}"`,
          "Success"
        );
      }
    } catch (err: any) {
      console.error(err);
      addToast("Zia STT Failed", "Failed to parse speech input stream.", "Warning");
    } finally {
      setIsThinking(false);
      setThinkingType("standard");
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
      addToast("Too Many Attachments", `Max ${MAX_ATTACHMENTS_PER_MESSAGE} files per message.`, "Warning");
      return;
    }
    for (const f of selected) {
      if (!ALLOWED_ATTACHMENT_TYPES.includes(f.type)) {
        addToast("Unsupported File Type", `'${f.name}' must be a PDF or JPEG.`, "Warning");
        return;
      }
      if (f.size > MAX_ATTACHMENT_BYTES) {
        addToast("File Too Large", `'${f.name}' exceeds the 8 MB per-file limit.`, "Warning");
        return;
      }
    }
    const aggregate = [...pendingAttachments, ...selected].reduce((sum, f) => sum + f.size, 0);
    if (aggregate > MAX_AGGREGATE_BYTES) {
      addToast("Attachments Too Large", "Total attachment size exceeds the 20 MB limit for this message.", "Warning");
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
          addToast("Attachment Upload Failed", errData.detail || "Could not process attachments.", "Critical");
          setIsUploadingAttachments(false);
          return;
        }
      } catch (err) {
        console.error("Attachment upload failed:", err);
        addToast("Attachment Upload Failed", "Could not reach the server to process attachments.", "Critical");
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
        text: "I am unable to reach the VAJRA server. Please verify that your network connection is active and that backend services are running.",
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
      addToast("Invalid Badge Number", "Badge (KGID) must be exactly 7 digits.", "Warning");
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
        addToast("Invite Failed", resData.detail || "Could not send invitation.", "Critical");
        return;
      }
      addToast("Invitation Sent", `Badge ${inviteBadge} invited as ${inviteRole}.`, "Success");
      setShowInvitePanel(false);
      setInviteBadge("");
    } catch (err) {
      console.error("Failed to send cowork invite:", err);
      addToast("Invite Failed", "Could not reach the server.", "Critical");
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
      addToast("Failed to Load Session", "Could not retrieve past conversation history.", "Critical");
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
            content: m.text,
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
      addToast("Export Failed", "Could not generate PDF conversation transcript.", "Critical");
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
            <span>Export PDF</span>
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
                VAJRA Central Inquest Hub
              </h2>
              <p className="text-xs text-slate-500 leading-relaxed">
                Log dialogues or speak in English/Kannada to query active CCTNS registers, analyze conviction risk indices, and plot spatial crime clusters.
              </p>
            </div>
          </div>
        ) : (
          chatMessages.map((msg) => (
            <ChatBubble
              key={msg.id}
              message={msg}
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
              <div className="text-[10px] font-mono text-slate-500 font-bold uppercase tracking-wider">
                {thinkingType === "translation"
                  ? "Translating Kannada Voice Data..."
                  : t.thinkingIndicator}
              </div>
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
              title={voiceAvailable ? "Speak Kannada/English" : "Voice input is not available — speech-to-text service is not yet configured"}
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
              title="Attach evidence (PDF or JPEG, max 3 files, 8MB each)"
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
                placeholder={isUploadingAttachments ? "Uploading attachments..." : (recordingStatus || t.chatPlaceholder)}
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
                Chat
              </button>
              <button
                onClick={() => handleToggleCowork("cowork")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-bold uppercase tracking-wider transition-all cursor-pointer ${
                  chatMode === "cowork" ? "bg-[#00C6AD]/15 text-[#00C6AD]" : "text-slate-500 hover:text-slate-300"
                }`}
              >
                <Users className="w-3 h-3" /> Cowork
              </button>
            </div>
            {hasParticipants && (
              <span className="text-[10px] text-[#00C6AD] font-mono">
                Shared session — mention <strong>@vajra</strong> to ask the AI
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
                <Users className="w-4 h-4 text-[#00C6AD]" /> Invite to Cowork
              </h3>
              <button onClick={() => setShowInvitePanel(false)} className="text-slate-500 hover:text-slate-200 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-1">
              <label className="block text-[10px] font-black text-slate-450 uppercase font-mono">Badge Number (7-digit KGID)</label>
              <input
                type="text"
                value={inviteBadge}
                onChange={(e) => setInviteBadge(e.target.value)}
                placeholder="e.g. 1594888"
                className="w-full bg-slate-950/60 border border-slate-850 focus:border-[#00C6AD] rounded-xl py-2.5 px-3 text-xs text-slate-200 focus:outline-none transition-all"
              />
            </div>
            <div className="space-y-1">
              <label className="block text-[10px] font-black text-slate-450 uppercase font-mono">Access Level</label>
              <div className="flex gap-2">
                <button
                  onClick={() => setInviteRole("viewer")}
                  className={`flex-1 py-2 rounded-lg border text-[11px] font-bold uppercase tracking-wider transition-all cursor-pointer ${
                    inviteRole === "viewer" ? "bg-slate-800 border-slate-700 text-slate-100" : "border-slate-850 text-slate-500 hover:text-slate-300"
                  }`}
                >
                  Viewer
                </button>
                <button
                  onClick={() => setInviteRole("collaborator")}
                  className={`flex-1 py-2 rounded-lg border text-[11px] font-bold uppercase tracking-wider transition-all cursor-pointer ${
                    inviteRole === "collaborator" ? "bg-[#00C6AD]/15 border-[#00C6AD]/40 text-[#00C6AD]" : "border-slate-850 text-slate-500 hover:text-slate-300"
                  }`}
                >
                  Collaborator
                </button>
              </div>
              <p className="text-[10px] text-slate-550 pt-1">
                {inviteRole === "viewer"
                  ? "Can watch the thread, cannot send messages."
                  : "Can post messages and @vajra the AI."}
              </p>
            </div>
            <button
              onClick={handleSendInvite}
              disabled={isInviting || !activeSessionId}
              className="w-full py-2.5 rounded-xl bg-[#00C6AD]/10 hover:bg-[#00C6AD]/20 border border-[#00C6AD]/30 text-[#00C6AD] text-xs font-black uppercase tracking-wider transition-all disabled:opacity-50 cursor-pointer"
            >
              {isInviting ? "Sending..." : "Send Invitation"}
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
