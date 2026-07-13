import React, { useState, useEffect, useRef } from "react";
import { useApp, ChatMessage } from "../AppContext";
import { API_BASE } from "../config";
import { ChatBubble } from "../components/ChatBubble";
import { ExpandedOverlay } from "../components/ExpandedOverlay";
import { Mic, MicOff, Send, Download, Sparkles } from "lucide-react";

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
  const [isRecording, setIsRecording] = useState(false);
  const [recordingStatus, setRecordingStatus] = useState("");
  const [voiceAvailable, setVoiceAvailable] = useState(true);
  const [isThinking, setIsThinking] = useState(false);
  const [thinkingType, setThinkingType] = useState<"standard" | "translation">("standard");

  const [expandedWidget, setExpandedWidget] = useState<{ type: "map" | "network" | "risk" | "forecast"; data: any } | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

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

  // Submit Text Query to Copilot Agent Loop
  const handleSend = async (textToSend: string) => {
    if (!textToSend.trim()) return;

    const userMsg: ChatMessage = {
      id: `msg-${Date.now()}-user`,
      sender: "user",
      text: textToSend,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setChatMessages((prev) => [...prev, userMsg]);
    setInputVal("");
    setThinkingType(lang === "kn" ? "translation" : "standard");
    setIsThinking(true);

    try {
      const response = await fetch(`${API_BASE}/api/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Session-ID": `session-${badgeNumber || "4003385"}`,
          "Authorization": `Bearer ${localStorage.getItem("vajra_token") || ""}`,
        },
        body: JSON.stringify({
          message: textToSend,
          lang: lang,
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
    <div className="h-full flex flex-col relative overflow-hidden bg-slate-950/20">
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

            {/* Main Text Input */}
            <div className="flex-1 relative">
              <input
                type="text"
                value={inputVal}
                onChange={(e) => setInputVal(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSend(inputVal)}
                placeholder={recordingStatus || t.chatPlaceholder}
                className="w-full bg-slate-950/65 border border-slate-800 focus:border-[#00C6AD] rounded-xl py-3.5 px-4 text-sm text-slate-100 placeholder-slate-600 focus:outline-none transition-all pr-12"
              />
              <button
                onClick={() => handleSend(inputVal)}
                className="absolute right-2 top-2 p-2 rounded-lg bg-slate-900 border border-slate-800 hover:border-[#00C6AD]/40 text-slate-400 hover:text-[#00C6AD] transition-all cursor-pointer"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Full screen widgets expansion backdrop */}
      {expandedWidget && (
        <ExpandedOverlay
          type={expandedWidget.type}
          data={expandedWidget.data}
          onClose={() => setExpandedWidget(null)}
        />
      )}
    </div>
  );
};
