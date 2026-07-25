import React, { useState, useRef, useEffect } from "react";
import { Mic, MicOff, Send, Paperclip, X, FileText, Image as ImageIcon } from "lucide-react";

const MAX_ATTACHMENT_BYTES = 8 * 1024 * 1024;
const MAX_ATTACHMENTS_PER_MESSAGE = 3;
const MAX_AGGREGATE_BYTES = 20 * 1024 * 1024;
const ALLOWED_ATTACHMENT_TYPES = ["application/pdf", "image/jpeg", "image/jpg"];

interface ChatInputProps {
  onSend: (text: string, attachments: File[]) => void;
  isThinking: boolean;
  isUploading: boolean;
  lang: "en" | "kn";
  addToast: (title: string, message: string, severity: "Critical" | "Warning" | "Info" | "Success") => void;
}

export const ChatInput: React.FC<ChatInputProps> = React.memo(({
  onSend,
  isThinking,
  isUploading,
  lang,
  addToast,
}) => {
  const [inputVal, setInputVal] = useState("");
  const [pendingAttachments, setPendingAttachments] = useState<File[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingStatus, setRecordingStatus] = useState("");
  const [voiceAvailable, setVoiceAvailable] = useState(true);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  useEffect(() => {
    const SpeechRecognitionCtor = window.SpeechRecognition || window.webkitSpeechRecognition;
    setVoiceAvailable(Boolean(SpeechRecognitionCtor));
  }, []);

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
    // Binds directly to user's EN/KN toggle choice
    recognition.lang = lang === "kn" ? "kn-IN" : "en-US";
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
    setRecordingStatus(lang === "en" ? "Listening (Speech STT)..." : "ಆಲಿಸಲಾಗುತ್ತಿದೆ (ಧ್ವನಿ STT)...");
  };

  const stopRecording = () => {
    if (recognitionRef.current && isRecording) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
      setIsRecording(false);
      setRecordingStatus("");
    }
  };

  const handleSendClick = () => {
    if (isThinking || isUploading) return;
    if (!inputVal.trim() && pendingAttachments.length === 0) return;
    if (isRecording) {
      stopRecording();
    }
    const text = inputVal;
    const files = [...pendingAttachments];
    setInputVal("");
    setPendingAttachments([]);
    onSend(text, files);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendClick();
    }
  };

  return (
    <div className="w-full flex flex-col gap-2 glass-panel border border-stone-800 rounded-2xl p-3 shadow-xl">
      {/* File input (hidden) */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileSelect}
        accept=".pdf,.jpeg,.jpg"
        multiple
        className="hidden"
      />

      {/* Pending Attachments Strip */}
      {pendingAttachments.length > 0 && (
        <div className="flex flex-wrap gap-2 pb-2 border-b border-stone-800">
          {pendingAttachments.map((f, idx) => (
            <div
              key={idx}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-stone-900 border border-stone-750 text-xs text-stone-200"
            >
              {f.type === "application/pdf" ? (
                <FileText className="w-3.5 h-3.5 text-[#C79A4E]" />
              ) : (
                <ImageIcon className="w-3.5 h-3.5 text-teal-400" />
              )}
              <span className="truncate max-w-[140px] font-mono text-[11px]">{f.name}</span>
              <button
                type="button"
                onClick={() => removeAttachment(idx)}
                className="text-stone-500 hover:text-stone-300 ml-1 cursor-pointer"
                title="Remove"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Voice Status Indicator */}
      {isRecording && (
        <div className="flex items-center gap-2 text-xs text-[#C79A4E] bg-[#C79A4E]/10 border border-[#C79A4E]/20 px-3 py-1 rounded-md animate-pulse font-mono">
          <span className="w-2 h-2 rounded-full bg-[#C79A4E] animate-ping" />
          <span>{recordingStatus}</span>
        </div>
      )}

      {/* Input Row */}
      <div className="flex items-end gap-2">
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={isThinking || isUploading}
          className="p-2 rounded-xl text-stone-400 hover:text-stone-200 hover:bg-stone-850 transition-colors disabled:opacity-50 cursor-pointer shrink-0"
          title={lang === "en" ? "Attach PDF/JPEG evidence" : "ಸಾಕ್ಷ್ಯ PDF/JPEG ಲಗತ್ತಿಸಿ"}
        >
          <Paperclip className="w-4 h-4" />
        </button>

        {/* Textarea Input */}
        <textarea
          value={inputVal}
          onChange={(e) => setInputVal(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={
            lang === "en"
              ? "Query VAJRA AI copilot... (e.g., 'Show crimes connected to suspect Ramesh', 'Show hotspots in Mysuru')"
              : "ವಜ್ರ AI ನೊಂದಿಗೆ ವಿಚಾರಣೆ ನಡೆಸಿ... (ಉದಾ: 'ಶಂಕಿತ ರಮೇಶ್ ಸಂಪರ್ಕಿತ ಅಪರಾಧಗಳನ್ನು ತೋರಿಸಿ')"
          }
          rows={2}
          className="flex-1 bg-transparent border-none text-stone-100 placeholder-stone-500 text-sm focus:outline-none resize-none py-1 font-sans"
        />

        {/* Mic Toggle Button */}
        {voiceAvailable && (
          <button
            type="button"
            onClick={isRecording ? stopRecording : startRecording}
            disabled={isThinking || isUploading}
            className={`p-2 rounded-xl transition-colors cursor-pointer shrink-0 ${
              isRecording
                ? "bg-rose-500/20 text-rose-400 border border-rose-500/30 animate-pulse"
                : "text-stone-400 hover:text-stone-200 hover:bg-stone-850"
            }`}
            title={isRecording ? "Stop voice listening" : "Start voice listening (STT)"}
          >
            {isRecording ? <MicOff className="w-4 h-4 text-rose-400" /> : <Mic className="w-4 h-4" />}
          </button>
        )}

        {/* Send Button */}
        <button
          type="button"
          onClick={handleSendClick}
          disabled={isThinking || isUploading || (!inputVal.trim() && pendingAttachments.length === 0)}
          className="p-2.5 rounded-xl bg-[#C79A4E] text-stone-950 font-bold hover:bg-[#d8ab5e] transition-all disabled:opacity-40 disabled:hover:bg-[#C79A4E] cursor-pointer shrink-0 shadow-md flex items-center justify-center"
        >
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
});
