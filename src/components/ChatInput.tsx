import React, { useState, useRef, useEffect } from "react";
import { Mic, MicOff, Send, Paperclip, X, FileText, Image as ImageIcon, ChevronDown } from "lucide-react";
import { API_BASE } from "../config";

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
  // 2-MODE CONSOLIDATION (matches implementation_plan.md's real design):
  // "compiler" ("AI Reasoning β") retired as a 3rd officer-facing choice --
  // that planning engine is now shared, invisible machinery under BOTH modes
  // (see agent_loop.py's _run_semantic_compiler `deep` param), not something
  // the officer opts into separately. A stale client that still sends
  // "compiler" is still accepted server-side as an alias for deep dossier
  // planning, so nothing breaks if a cached old build sends it.
  answerMode: "standard" | "dossier";
  onAnswerModeChange: (m: "standard" | "dossier") => void;
}

export const ChatInput: React.FC<ChatInputProps> = React.memo(({
  onSend,
  isThinking,
  isUploading,
  lang,
  addToast,
  answerMode,
  onAnswerModeChange,
}) => {
  const [modeMenuOpen, setModeMenuOpen] = useState(false);
  const [inputVal, setInputVal] = useState("");
  const [pendingAttachments, setPendingAttachments] = useState<File[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingStatus, setRecordingStatus] = useState("");
  const [voiceAvailable, setVoiceAvailable] = useState(true);
  // The mic AUTO-DETECTS the spoken language and is fully DECOUPLED from the
  // top-right app-language toggle (which only changes the whole UI). The server
  // transcribes the audio under both English and Kannada and returns whichever
  // was actually spoken -- the officer just talks in either language. `lang` is
  // used only as the fall-back language for the browser Web Speech recognizer
  // (used when mic capture / the Zia endpoint is unavailable), which cannot
  // auto-detect on its own.

  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  // Auto-grow the composer with its content (like Claude's input): expand to fit
  // the text, then cap at a max height and scroll INSIDE the box -- instead of a
  // fixed 2-row field that crams long queries. Recomputes whenever the value
  // changes (typing, voice dictation, or reset-to-empty after send).
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, [inputVal]);
  // Web Audio capture -> real Zia STT (far better Kannada than the browser
  // recognizer). We DON'T use MediaRecorder: on Chrome it emits webm/opus, and
  // Zia STT gates on the file EXTENSION and rejects .webm/.mp4 with
  // INVALID_FILE_EXTENSION (confirmed live; it accepts .wav/.mp3/.ogg/.flac).
  // So we capture raw PCM via an AudioContext + ScriptProcessor, downsample to
  // 16 kHz mono, and encode a real .wav that Zia accepts. recognitionRef stays
  // as the fallback when mic capture or the STT endpoint is unavailable.
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const audioSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const audioProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const pcmChunksRef = useRef<Float32Array[]>([]);
  const inputSampleRateRef = useRef<number>(48000);
  const capturingRef = useRef<boolean>(false);

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

  // Real Zia STT: record mic audio, upload to /api/voice/stt, drop the
  // transcript into the composer. Far better Kannada than the browser
  // recognizer. Falls back to the browser recognizer if mic capture or the
  // endpoint isn't available.
  // Encode collected mono Float32 PCM (downsampled to 16 kHz) into a 16-bit WAV
  // blob -- the format Zia STT accepts. Written inline (no dep) so the mic works
  // cross-browser without relying on MediaRecorder's container.
  const encodeWav = (samples: Float32Array, sampleRate: number): Blob => {
    const buffer = new ArrayBuffer(44 + samples.length * 2);
    const view = new DataView(buffer);
    const writeStr = (off: number, s: string) => { for (let i = 0; i < s.length; i++) view.setUint8(off + i, s.charCodeAt(i)); };
    writeStr(0, "RIFF");
    view.setUint32(4, 36 + samples.length * 2, true);
    writeStr(8, "WAVE");
    writeStr(12, "fmt ");
    view.setUint32(16, 16, true);      // PCM chunk size
    view.setUint16(20, 1, true);       // PCM format
    view.setUint16(22, 1, true);       // mono
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true); // byte rate
    view.setUint16(32, 2, true);       // block align
    view.setUint16(34, 16, true);      // bits per sample
    writeStr(36, "data");
    view.setUint32(40, samples.length * 2, true);
    let off = 44;
    for (let i = 0; i < samples.length; i++, off += 2) {
      const s = Math.max(-1, Math.min(1, samples[i]));
      view.setInt16(off, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    }
    return new Blob([view], { type: "audio/wav" });
  };

  const downsampleTo16k = (chunks: Float32Array[], inRate: number): Float32Array => {
    let total = 0;
    for (const c of chunks) total += c.length;
    const merged = new Float32Array(total);
    let o = 0;
    for (const c of chunks) { merged.set(c, o); o += c.length; }
    const outRate = 16000;
    if (inRate <= outRate) return merged;
    const ratio = inRate / outRate;
    const outLen = Math.floor(merged.length / ratio);
    const out = new Float32Array(outLen);
    for (let i = 0; i < outLen; i++) {
      // simple average over the source window -> cheap anti-alias
      const start = Math.floor(i * ratio);
      const end = Math.min(merged.length, Math.floor((i + 1) * ratio));
      let sum = 0, n = 0;
      for (let j = start; j < end; j++) { sum += merged[j]; n++; }
      out[i] = n ? sum / n : 0;
    }
    return out;
  };

  const finishCaptureAndUpload = async () => {
    // Tear down the audio graph + mic.
    try { audioProcessorRef.current?.disconnect(); } catch { /* ignore */ }
    try { audioSourceRef.current?.disconnect(); } catch { /* ignore */ }
    try { await audioCtxRef.current?.close(); } catch { /* ignore */ }
    mediaStreamRef.current?.getTracks().forEach((t) => t.stop());
    const chunks = pcmChunksRef.current;
    const inRate = inputSampleRateRef.current;
    audioProcessorRef.current = null;
    audioSourceRef.current = null;
    audioCtxRef.current = null;
    mediaStreamRef.current = null;
    pcmChunksRef.current = [];
    capturingRef.current = false;

    const totalSamples = chunks.reduce((s, c) => s + c.length, 0);
    if (totalSamples < 1600) { setIsRecording(false); setRecordingStatus(""); return; } // <0.1s -> nothing said
    setRecordingStatus(lang === "en" ? "Transcribing..." : "ಪ್ರತಿಲಿಪಿ ಮಾಡಲಾಗುತ್ತಿದೆ...");
    try {
      const pcm16k = downsampleTo16k(chunks, inRate);
      const wav = encodeWav(pcm16k, 16000);
      const form = new FormData();
      form.append("audio", wav, "speech.wav");
      const res = await fetch(`${API_BASE}/api/voice/stt?language=auto`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${localStorage.getItem("vajra_token") || ""}` },
        body: form,
      });
      if (res.ok) {
        const data = await res.json();
        if (data.text && data.text.trim()) setInputVal((prev) => (prev ? prev + " " : "") + data.text.trim());
      } else {
        addToast(
          lang === "en" ? "Transcription Unavailable" : "ಪ್ರತಿಲಿಪಿ ಲಭ್ಯವಿಲ್ಲ",
          lang === "en" ? "Voice transcription is temporarily unavailable. Please type instead." : "ಧ್ವನಿ ಪ್ರತಿಲಿಪಿ ತಾತ್ಕಾಲಿಕವಾಗಿ ಲಭ್ಯವಿಲ್ಲ. ದಯವಿಟ್ಟು ಟೈಪ್ ಮಾಡಿ.",
          "Warning"
        );
      }
    } catch {
      // silent -- officer can type
    } finally {
      setIsRecording(false);
      setRecordingStatus("");
    }
  };

  const startRecording = async () => {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!navigator.mediaDevices?.getUserMedia || !AudioCtx) {
      startBrowserRecording();
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      pcmChunksRef.current = [];
      const ctx = new AudioCtx();
      audioCtxRef.current = ctx;
      inputSampleRateRef.current = ctx.sampleRate;
      const source = ctx.createMediaStreamSource(stream);
      audioSourceRef.current = source;
      const processor = ctx.createScriptProcessor(4096, 1, 1);
      audioProcessorRef.current = processor;
      capturingRef.current = true;
      processor.onaudioprocess = (e) => {
        if (!capturingRef.current) return;
        // copy -- the underlying buffer is reused by the audio thread
        pcmChunksRef.current.push(new Float32Array(e.inputBuffer.getChannelData(0)));
      };
      source.connect(processor);
      processor.connect(ctx.destination); // required for onaudioprocess to fire in some browsers
      setIsRecording(true);
      setRecordingStatus(
        lang === "kn" ? "ರೆಕಾರ್ಡ್ ಆಗುತ್ತಿದೆ... (ನಿಲ್ಲಿಸಲು ಮೈಕ್ ಟ್ಯಾಪ್ ಮಾಡಿ)" : "Recording... (tap mic to stop)"
      );
    } catch (err) {
      // permission denied / no mic -> try the browser recognizer
      startBrowserRecording();
    }
  };

  const startBrowserRecording = () => {
    const SpeechRecognitionCtor = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognitionCtor) {
      addToast(
        lang === "en" ? "Voice Input Unavailable" : "ಧ್ವನಿ ಇನ್‌ಪುಟ್ ಲಭ್ಯವಿಲ್ಲ",
        lang === "en" ? "Microphone/voice input isn't available in this browser." : "ಈ ಬ್ರೌಸರ್‌ನಲ್ಲಿ ಮೈಕ್/ಧ್ವನಿ ಇನ್‌ಪುಟ್ ಲಭ್ಯವಿಲ್ಲ.",
        "Warning"
      );
      return;
    }
    const recognition = new SpeechRecognitionCtor();
    // Bound to the independent voice-language pill, NOT the display-language
    // Browser recognizer can't auto-detect; fall back to the app display
    // language as the best guess (this path only runs when the Zia auto-detect
    // endpoint / mic capture is unavailable).
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
    setRecordingStatus(
      lang === "kn" ? "ಆಲಿಸಲಾಗುತ್ತಿದೆ (ಧ್ವನಿ STT)..." : "Listening (Speech STT)..."
    );
  };

  const stopRecording = () => {
    // Web Audio path -> encode WAV + upload; the "Transcribing..." state
    // continues until the transcript returns (finishCaptureAndUpload clears it).
    if (capturingRef.current) {
      capturingRef.current = false;
      void finishCaptureAndUpload();
      return;
    }
    // Browser-recognizer fallback path.
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
          ref={textareaRef}
          value={inputVal}
          onChange={(e) => setInputVal(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={
            lang === "en"
              ? "Query VAJRA AI copilot... (e.g., 'Show crimes connected to suspect Ramesh', 'Show hotspots in Mysuru')"
              : "ವಜ್ರ AI ನೊಂದಿಗೆ ವಿಚಾರಣೆ ನಡೆಸಿ... (ಉದಾ: 'ಶಂಕಿತ ರಮೇಶ್ ಸಂಪರ್ಕಿತ ಅಪರಾಧಗಳನ್ನು ತೋರಿಸಿ')"
          }
          rows={1}
          className="flex-1 bg-transparent border-none text-stone-100 placeholder-stone-500 text-sm focus:outline-none resize-none py-1 font-sans max-h-[200px] overflow-y-auto leading-relaxed"
        />

        {/* Mic language follows the app's main language toggle automatically --
            no separate voice-language pill (removed). */}

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
            title={isRecording ? "Stop voice listening" : "Start voice listening (auto-detects English / Kannada)"}
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

      {/* Answer-mode selector -- the "which model" position in a chat UI.
          Standard = fast, one focused view. Full Dossier = deep, forces the
          complete multi-panel investigation view for the case/suspect asked. */}
      <div className="flex items-center gap-2 pt-1">
        <div className="relative">
          <button
            type="button"
            onClick={() => setModeMenuOpen((o) => !o)}
            disabled={isThinking}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold border border-stone-800 bg-stone-900/60 hover:bg-stone-800 transition-colors cursor-pointer disabled:opacity-50"
            title={lang === "en" ? "Choose answer depth" : "ಉತ್ತರದ ಆಳ ಆಯ್ಕೆಮಾಡಿ"}
          >
            <span className={answerMode !== "standard" ? "text-[#C79A4E]" : "text-stone-300"}>
              ◈ {answerMode === "dossier"
                    ? (lang === "en" ? "Full Dossier" : "ಪೂರ್ಣ ದೋಶಿಯರ್")
                    : (lang === "en" ? "Standard" : "ಸಾಮಾನ್ಯ")}
            </span>
            <ChevronDown className="w-3 h-3 text-stone-500" />
          </button>
          {modeMenuOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setModeMenuOpen(false)} />
              <div className="absolute bottom-9 left-0 z-50 w-64 bg-stone-900 border border-stone-800 rounded-xl shadow-2xl py-1.5">
                {([
                  ["standard", lang === "en" ? "Standard" : "ಸಾಮಾನ್ಯ", lang === "en" ? "Fast, focused answer -- the AI plans internally when a question needs it, kept minimal." : "ವೇಗದ, ಕೇಂದ್ರೀಕೃತ ಉತ್ತರ."],
                  ["dossier", lang === "en" ? "Full Dossier" : "ಪೂರ್ಣ ದೋಶಿಯರ್", lang === "en" ? "Deep: risk, network, timeline, sections, map & similar cases -- a deliberately comprehensive sweep." : "ಆಳವಾದ: ಅಪಾಯ, ಜಾಲ, ಕಾಲಾನುಕ್ರಮ, ಸೆಕ್ಷನ್‌ಗಳು ಒಟ್ಟಿಗೆ."],
                ] as const).map(([val, title, desc]) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => { onAnswerModeChange(val); setModeMenuOpen(false); }}
                    className={`w-full text-left px-3 py-2 hover:bg-stone-800 cursor-pointer flex items-start gap-2 ${answerMode === val ? "bg-stone-850/60" : ""}`}
                  >
                    <span className={`mt-0.5 text-[11px] ${answerMode === val ? "text-[#C79A4E]" : "text-transparent"}`}>✓</span>
                    <span className="flex flex-col">
                      <span className={`text-[12px] font-bold ${val !== "standard" ? "text-[#C79A4E]" : "text-stone-200"}`}>◈ {title}</span>
                      <span className="text-[10px] text-stone-500 leading-snug">{desc}</span>
                    </span>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
        {answerMode === "dossier" && (
          <span className="text-[10px] font-mono text-[#C79A4E]/70">
            {lang === "en" ? "deep investigation view" : "ಆಳವಾದ ತನಿಖಾ ನೋಟ"}
          </span>
        )}
      </div>
    </div>
  );
});
