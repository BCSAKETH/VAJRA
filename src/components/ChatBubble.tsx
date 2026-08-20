import React, { useState, useEffect, useRef } from "react";
import { ChatMessage } from "../AppContext";
import { translations } from "../i18n";
import { AlertTriangle, Tag, Paperclip, Volume2, VolumeX, Sparkles, Copy, Check, Eye, X, Loader2, RotateCcw, ShieldCheck } from "lucide-react";
import { InlineWidget } from "./InlineWidget";
import { API_BASE } from "../config";

interface ChatBubbleProps {
  message: ChatMessage;
  lang: "en" | "kn";
  onExpandWidget: (type: string, data: any) => void;
  onRetry?: () => void;
  addToast?: (title: string, message: string, severity: "Critical" | "Warning" | "Info" | "Success") => void;
}

// Panel types that InlineWidget can render as a visual (everything else in a
// Full Dossier -- case_facts, case_sections, case_summary, similar_cases --
// renders as its grounded text block instead).
const WIDGET_PANEL_TYPES = new Set([
  "map", "network", "risk", "forecast", "timeline",
  "mo_match", "correlation", "repeat_offenders", "crime_groups", "trend", "case_distribution",
]);

// Normalize any stored text for display: turn SQL-escaped newlines back into
// real line breaks AND decode literal "\uXXXX" escape sequences into their real
// characters. Confirmed live: dossier panel titles/text round-tripped through a
// double JSON encode, so Kannada arrived as visible "ಪ್..." gibberish
// instead of glyphs. Decoding here repairs it at the last step before display,
// for both freshly-generated and already-stored (history) messages. Only valid
// 4-hex-digit \u sequences are touched, so ordinary text is never altered.
const decodeDisplayText = (raw: string | undefined | null): string => {
  let s = (raw || "").replace(/\\r\\n|\\n|\\r/g, "\n");
  if (s.indexOf("\\u") !== -1) {
    s = s.replace(/\\u([0-9a-fA-F]{4})/g, (_m, hex) => String.fromCharCode(parseInt(hex, 16)));
  }
  return s;
};

// Clean markdown and formatting artifacts before sending text to speech synthesis
const cleanTextForSpeech = (rawText: string): string => {
  return rawText
    .replace(/\*\*([^*]+)\*\*/g, "$1") // strip bold **text**
    .replace(/#+\s*/g, "") // strip markdown headers ###
    .replace(/`([^`]+)`/g, "$1") // strip inline code
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1") // strip links
    .replace(/[-*•]\s+/g, "") // strip bullet points
    .replace(/[\n\r]+/g, ". ") // replace newlines with sentence pauses
    .replace(/\s+/g, " ")
    .trim();
};

type SpeakResult = "started" | "unsupported" | "no_kannada_voice";

// Confirmed live: when no real Kannada voice is installed on the device,
// leaving utterance.voice unset makes the browser fall back to its default
// system voice (almost always English) to read Kannada SCRIPT phonetically
// -- producing garbled, unintelligible output that LOOKS like it's
// "speaking" but says nothing real. Silently doing that is worse than not
// speaking at all: it looks like a working feature that's actually
// producing noise. Returning "no_kannada_voice" lets the caller tell the
// officer plainly instead, rather than mispronouncing Kannada through an
// English voice engine.
const speakText = (text: string, lang: "en" | "kn", onEnd: () => void): SpeakResult => {
  if (!("speechSynthesis" in window)) return "unsupported";
  window.speechSynthesis.cancel();

  const cleaned = cleanTextForSpeech(text);
  if (!cleaned) return "unsupported";

  const voices = window.speechSynthesis.getVoices();
  let matchedVoice: SpeechSynthesisVoice | undefined;
  if (lang === "kn") {
    matchedVoice = voices.find(v => v.lang.toLowerCase().includes("kn") || v.name.toLowerCase().includes("kannada") || v.name.toLowerCase().includes("kn-in"));
    if (!matchedVoice) return "no_kannada_voice";
  } else {
    matchedVoice = voices.find(v => v.lang.toLowerCase().includes("en-in")) || voices.find(v => v.lang.toLowerCase().includes("en-us"));
  }

  const utterance = new SpeechSynthesisUtterance(cleaned);
  utterance.lang = lang === "kn" ? "kn-IN" : "en-US";
  utterance.rate = lang === "kn" ? 0.92 : 1.0;
  utterance.pitch = 1.0;
  utterance.voice = matchedVoice;

  utterance.onend = onEnd;
  utterance.onerror = onEnd;
  window.speechSynthesis.speak(utterance);
  return "started";
};

export const ChatBubble: React.FC<ChatBubbleProps> = React.memo(({ message, lang, onExpandWidget, onRetry, addToast }) => {
  const t = translations[lang];
  const isAI = message.sender === "assistant";
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [copied, setCopied] = useState(false);
  const [viewingImageUrl, setViewingImageUrl] = useState<string | null>(null);
  const [loadingAttachmentId, setLoadingAttachmentId] = useState<string | null>(null);
  // USP-3 "explainable by default" -- one tap reveals the evidence trail
  // (which tools/records/queries produced this answer) already carried on
  // every message as citations. Collapsed by default so it never clutters
  // the calm chat, one click away when an officer needs to trust/verify.
  const [showEvidence, setShowEvidence] = useState(false);
  // Multi-lens explainability [B7]: on-demand, so it never slows the dossier.
  const [lenses, setLenses] = useState<{ role_tier?: string; primary?: string; engine?: string; lenses?: Record<string, string> } | null>(null);
  const [lensLoading, setLensLoading] = useState(false);

  const LENS_LABELS: Record<string, { en: string; kn: string }> = {
    investigator: { en: "Investigator", kn: "ತನಿಖಾಧಿಕಾರಿ" },
    supervisor: { en: "Supervisor", kn: "ಮೇಲ್ವಿಚಾರಕ" },
    compliance: { en: "Compliance", kn: "ಅನುಸರಣೆ" },
  };

  const handleExplainLenses = async () => {
    if (lensLoading) return;
    const panels: any[] = (message.data as any)?.panels || [];
    const ns = panels.find((p) => p.panel_key === "next_steps");
    const context = (ns?.text || panels.map((p) => p.text).filter(Boolean).join(" ")).slice(0, 1800);
    if (!context.trim()) return;
    setLensLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/intelligence/lenses`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("vajra_token") || ""}` },
        body: JSON.stringify({ context, case_no: (message.data as any)?.case_no || "" }),
      });
      if (res.ok) setLenses(await res.json());
    } catch { /* silent -- the button just won't populate */ }
    finally { setLensLoading(false); }
  };
  // Holds the currently-playing server-TTS audio so it can be stopped.
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const ttsSupported = typeof window !== "undefined" && "speechSynthesis" in window;

  const rawDisplayText = isAI
    ? (lang === "kn" ? (message.textKn || message.text) : (message.textEn || message.text))
    : message.text;
  // Multiline answers are stored with the newline SQL-escaped to a literal
  // "\n" (two chars) on insert and never un-escaped on read, so they render
  // as visible backslash-n instead of line breaks. Convert them back here for
  // display (the container already uses whitespace-pre-wrap). Also collapse a
  // stray leading "\n" so answers don't start with a blank line.
  const displayText = decodeDisplayText(rawDisplayText).replace(/^\n+/, "");

  useEffect(() => {
    return () => {
      if (isSpeaking && "speechSynthesis" in window) window.speechSynthesis.cancel();
      if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
      // Release the blob URL so the browser doesn't hold the decoded image
      // in memory for the lifetime of the page after the viewer closes.
      if (viewingImageUrl) URL.revokeObjectURL(viewingImageUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSpeaking]);

  const stopPlayback = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = "";
      audioRef.current = null;
    }
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    setIsSpeaking(false);
  };

  // Read the answer aloud. Prefer the server-side Zia TTS (real Kannada/
  // English/Hindi voice, device-independent) -- this is the fix for browser
  // SpeechSynthesis mispronouncing Kannada when no Kannada voice is installed.
  // Falls back to the browser voice only if the server call fails.
  const handleToggleSpeak = async () => {
    if (isSpeaking) {
      stopPlayback();
      return;
    }
    const cleaned = cleanTextForSpeech(displayText);
    if (!cleaned) return;
    // Synthesizing a full multi-panel dossier aloud is slow (seconds of audio to
    // generate before playback can even start) and rarely what an officer wants
    // to hear end-to-end. Cap the spoken text to a summary length, cut at a
    // sentence boundary so it never stops mid-word. The on-screen answer still
    // shows everything -- this only affects what's read aloud, and makes "speak"
    // start talking fast instead of after a long synthesis wait.
    const MAX_SPEAK = 700;
    let toSpeak = cleaned;
    if (toSpeak.length > MAX_SPEAK) {
      const slice = toSpeak.slice(0, MAX_SPEAK);
      const lastStop = Math.max(
        slice.lastIndexOf(". "), slice.lastIndexOf("? "), slice.lastIndexOf("! "),
        slice.lastIndexOf("। "), slice.lastIndexOf("\n")
      );
      toSpeak = (lastStop > 200 ? slice.slice(0, lastStop + 1) : slice).trim();
    }
    setIsSpeaking(true);
    try {
      // Fail FAST to the browser voice: the server Zia TTS can hang up to the
      // AppSail ~37s request kill when the voice service is degraded, which left
      // the officer staring at a "speaking" button for half a minute before any
      // sound. Abort the server attempt after 9s and fall through so playback
      // starts promptly (browser voice) instead of waiting out the timeout.
      const _ctrl = new AbortController();
      const _to = setTimeout(() => _ctrl.abort(), 9000);
      let res: Response;
      try {
        res = await fetch(`${API_BASE}/api/voice/tts`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${localStorage.getItem("vajra_token") || ""}`,
          },
          body: JSON.stringify({ text: toSpeak, lang }),
          signal: _ctrl.signal,
        });
      } finally {
        clearTimeout(_to);
      }
      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        audioRef.current = audio;
        audio.onended = () => { URL.revokeObjectURL(url); audioRef.current = null; setIsSpeaking(false); };
        audio.onerror = () => { URL.revokeObjectURL(url); audioRef.current = null; setIsSpeaking(false); };
        await audio.play();
        return;
      }
    } catch {
      // fall through to browser TTS
    }
    // Server TTS unavailable -- fall back to the browser voice (same trimmed text).
    const result = speakText(toSpeak, lang, () => setIsSpeaking(false));
    if (result === "started") return;
    setIsSpeaking(false);
    if (result === "no_kannada_voice") {
      addToast?.(
        lang === "en" ? "Voice Playback Unavailable" : "ಧ್ವನಿ ಪ್ಲೇಬ್ಯಾಕ್ ಲಭ್ಯವಿಲ್ಲ",
        lang === "en"
          ? "Server voice is temporarily unavailable and this device has no Kannada voice installed. Please try again shortly."
          : "ಸರ್ವರ್ ಧ್ವನಿ ತಾತ್ಕಾಲಿಕವಾಗಿ ಲಭ್ಯವಿಲ್ಲ ಮತ್ತು ಈ ಸಾಧನದಲ್ಲಿ ಕನ್ನಡ ಧ್ವನಿ ಸ್ಥಾಪಿಸಲಾಗಿಲ್ಲ. ದಯವಿಟ್ಟು ಸ್ವಲ್ಪ ಸಮಯದ ನಂತರ ಪ್ರಯತ್ನಿಸಿ.",
        "Warning"
      );
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(displayText);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (err) {
      console.error("Copy failed:", err);
    }
  };

  // Attachments are embedded inline as a data URI at upload time (see
  // upload_chat_attachments in main.py) -- no fetch needed, no dependency on
  // Stratus (currently unreachable from the backend). stratus_id-only
  // fetching is kept as a fallback for older messages saved before this
  // change, on the off chance storage does come back online later.
  const handleViewAttachment = async (stratusId: string) => {
    setLoadingAttachmentId(stratusId);
    try {
      const res = await fetch(`${API_BASE}/api/attachments/${stratusId}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("vajra_token") || ""}` },
      });
      if (!res.ok) throw new Error("Attachment not available.");
      const blob = await res.blob();
      setViewingImageUrl(URL.createObjectURL(blob));
    } catch (err) {
      console.error("Failed to load attachment:", err);
    } finally {
      setLoadingAttachmentId(null);
    }
  };

  return (
    <div className={`flex flex-col gap-1.5 w-full animate-fade-in group ${isAI ? "items-start" : "items-end"}`}>
      {/* Sender Label */}
      <span className="text-[10px] text-stone-500 font-semibold px-2 font-mono flex items-center gap-1.5">
        {isAI ? "VAJRA.AI" : (message.senderName ? message.senderName.toUpperCase() : "INVESTIGATOR")} • {message.timestamp}
      </span>

      {/* Bubble Container */}
      <div className="max-w-[85%] sm:max-w-[75%] flex flex-col gap-3">
        {isAI && message.isSimulated ? (
          <div className="rounded-2xl p-4 border border-amber-500/30 bg-amber-500/10 flex items-start gap-2.5 max-w-full">
            <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
            <div className="text-xs leading-relaxed text-amber-350 flex-1 min-w-0">
              <span className="font-extrabold uppercase tracking-wider block mb-1 text-amber-500">
                {t.aiUnavailableTitle}
              </span>
              <span className="text-stone-200">{displayText}</span>
              {onRetry && (
                <button
                  onClick={onRetry}
                  className="mt-2.5 flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 hover:text-amber-300 text-[11px] font-bold uppercase tracking-wider transition-colors cursor-pointer"
                >
                  <RotateCcw className="w-3 h-3" />
                  {lang === "en" ? "Retry" : "ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ"}
                </button>
              )}
            </div>
          </div>
        ) : (
        <>
        {/* Message Bubble Card */}
        <div
          className={`rounded-2xl p-4 border text-sm leading-relaxed ${
            isAI
              ? "glass-panel border-stone-800 text-stone-200 shadow-md"
              : "bg-stone-900 border-[#C79A4E]/20 text-stone-100 shadow-sm"
          }`}
        >
          {/* Main Text Content */}
          <div className="whitespace-pre-wrap font-sans text-stone-200">{displayText}</div>

          {/* Attachment indicator -- clickable when an inline thumbnail or a
              Stratus reference exists, so an officer can actually view what
              they attached instead of only seeing the filename chip. */}
          {message.attachments && message.attachments.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2.5">
              {message.attachments.map((a, i) => {
                const isViewable = !!a.data_uri || !!a.stratus_id;
                const isLoadingThis = loadingAttachmentId === a.stratus_id;
                const Wrapper: any = isViewable ? "button" : "span";
                const handleClick = a.data_uri
                  ? () => setViewingImageUrl(a.data_uri!)
                  : a.stratus_id
                  ? () => handleViewAttachment(a.stratus_id!)
                  : undefined;
                return (
                  <Wrapper
                    key={i}
                    onClick={handleClick}
                    disabled={isLoadingThis}
                    className={`flex items-center gap-1 px-2 py-1 rounded-md bg-stone-950/40 border border-stone-800 text-[10px] text-stone-400 font-mono ${
                      isViewable ? "hover:border-[#C79A4E]/40 hover:text-stone-200 transition-colors cursor-pointer" : ""
                    }`}
                  >
                    {isLoadingThis ? <Loader2 className="w-3 h-3 animate-spin" /> : <Paperclip className="w-3 h-3" />}
                    {a.file_name}{a.page_count > 1 ? ` (${a.page_count}p)` : ""}
                    {isViewable && !isLoadingThis && <Eye className="w-3 h-3 ml-0.5 text-[#C79A4E]" />}
                  </Wrapper>
                );
              })}
            </div>
          )}

          {/* Citation Pills + "Why this answer?" evidence expander (USP-3) */}
          {isAI && message.citations && message.citations.length > 0 && (
            <div className="mt-4 pt-3 border-t border-stone-850 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                {message.citations.map((c, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-1 text-[10px] font-mono bg-[#C79A4E]/5 text-[#C79A4E] border border-[#C79A4E]/20 px-2 py-0.5 rounded cursor-help transition-colors hover:bg-[#C79A4E]/10"
                    title={`${c.type}: ${c.details}`}
                  >
                    <Tag className="w-2.5 h-2.5 shrink-0" />
                    <span>{c.type}: {c.id}</span>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => setShowEvidence((v) => !v)}
                  className="flex items-center gap-1 text-[10px] font-mono text-stone-500 hover:text-[#C79A4E] border border-stone-800 hover:border-[#C79A4E]/30 px-2 py-0.5 rounded transition-colors cursor-pointer"
                  aria-expanded={showEvidence}
                >
                  <ShieldCheck className="w-2.5 h-2.5 shrink-0" />
                  {showEvidence
                    ? (lang === "en" ? "Hide evidence" : "ಸಾಕ್ಷ್ಯ ಮರೆಮಾಡಿ")
                    : (lang === "en" ? "Why this answer?" : "ಈ ಉತ್ತರ ಏಕೆ?")}
                </button>
              </div>
              {showEvidence && (
                <div className="rounded-lg border border-stone-800 bg-stone-950/50 p-3 text-[11px] space-y-2 animate-fade-in">
                  <div className="text-[10px] uppercase tracking-wider text-stone-500 font-mono">
                    {lang === "en" ? "◈ Evidence & reasoning trail" : "◈ ಸಾಕ್ಷ್ಯ ಮತ್ತು ತಾರ್ಕಿಕ ಜಾಡು"}
                  </div>
                  {message.responseType && message.responseType !== "text" && (
                    <div className="text-stone-400">
                      <span className="text-stone-500">{lang === "en" ? "Analysis type: " : "ವಿಶ್ಲೇಷಣೆ ಪ್ರಕಾರ: "}</span>
                      <span className="font-mono text-[#C79A4E]">{message.responseType}</span>
                    </div>
                  )}
                  <ul className="space-y-1.5">
                    {message.citations.map((c, i) => (
                      <li key={i} className="text-stone-300 leading-relaxed">
                        <span className="font-mono text-[#C79A4E]">{c.type}</span>
                        {c.id ? <span className="text-stone-500"> · {c.id}</span> : null}
                        {c.details ? <div className="text-stone-400 mt-0.5">{c.details}</div> : null}
                      </li>
                    ))}
                  </ul>
                  <div className="text-[9px] text-stone-600 pt-1 border-t border-stone-850">
                    {lang === "en"
                      ? "Every VAJRA answer is grounded in real records — no fabricated data. This trail is written to the tamper-evident audit ledger."
                      : "ಪ್ರತಿ ವಜ್ರ ಉತ್ತರವೂ ನೈಜ ದಾಖಲೆಗಳ ಆಧಾರಿತ — ಯಾವುದೇ ಕಲ್ಪಿತ ಡೇಟಾ ಇಲ್ಲ. ಈ ಜಾಡು ಸುರಕ್ಷಿತ ಆಡಿಟ್ ಲೆಡ್ಜರ್‌ಗೆ ಬರೆಯಲಾಗಿದೆ."}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* FULL DOSSIER -- multi-panel stacked intelligence view. When the
            backend returns data.panels (generate_case_dossier / deep mode),
            render each panel as its own titled block: a visual widget when the
            panel type is renderable, otherwise the panel's grounded text.
            Falls through to the single-widget path below for normal answers. */}
        {isAI && Array.isArray(message.data?.panels) && message.data.panels.length > 0 ? (
          /* ONE unified case-file container -- the sections live INSIDE it,
             divided by rules, so it reads as a single investigation dossier
             rather than a stack of disconnected answer cards. */
          <div className="w-full rounded-2xl border border-[#C79A4E]/30 bg-stone-950/40 overflow-hidden shadow-lg animate-fade-in">
            <div className="px-4 py-3 border-b border-[#C79A4E]/25 bg-gradient-to-r from-[#C79A4E]/12 to-transparent">
              <div className="flex items-center gap-2 text-[#C79A4E]">
                <Sparkles className="w-4 h-4 shrink-0" />
                <span className="font-mono text-[12px] font-bold uppercase tracking-[0.18em]">
                  {lang === "en" ? "Full Case Dossier" : "ಪೂರ್ಣ ಪ್ರಕರಣ ದೋಶಿಯರ್"}
                </span>
              </div>
              <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-[11px] text-stone-400 font-mono">
                {message.data.case_no && <span>Case: <span className="text-stone-200">{message.data.case_no}</span></span>}
                {message.data.primary_accused && <span>Primary accused: <span className="text-stone-200">{message.data.primary_accused}</span></span>}
                <span>{message.data.panels.length} {lang === "en" ? "sections" : "ವಿಭಾಗಗಳು"}</span>
              </div>
            </div>
            <div className="divide-y divide-stone-850">
              {message.data.panels.map((panel: any, i: number) => {
                const title = decodeDisplayText((lang === "kn" ? panel.title_kn : panel.title_en) || panel.title_en || "");
                const isWidget = WIDGET_PANEL_TYPES.has(panel.type) && panel.data;
                return (
                  <div key={i} className="px-4 py-3">
                    <div className="flex items-center gap-2 mb-2 text-[10.5px] font-mono uppercase tracking-[0.14em] text-[#C79A4E]/90">
                      <span className="text-[#C79A4E]/60">{String(i + 1).padStart(2, "0")}</span>
                      <span>{title}</span>
                    </div>
                    {isWidget ? (
                      <InlineWidget
                        type={panel.type}
                        data={panel.data}
                        onExpand={() => onExpandWidget(panel.type, panel.data)}
                      />
                    ) : (
                      <p className="text-[13px] text-stone-300 leading-relaxed whitespace-pre-wrap">
                        {decodeDisplayText((lang === "kn" ? (panel.text_kn || panel.text) : panel.text)).trim() || (lang === "en" ? "No data for this section." : "ಈ ವಿಭಾಗಕ್ಕೆ ಡೇಟಾ ಇಲ್ಲ.")}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
            {/* B7: on-demand multi-lens explainability (never auto-runs, so it
                doesn't slow the dossier; role-gated + graceful fallback server-side). */}
            <div className="px-4 py-3 border-t border-stone-850">
              {!lenses ? (
                <button
                  onClick={handleExplainLenses}
                  disabled={lensLoading}
                  className="text-[11px] font-mono uppercase tracking-wider text-[#C79A4E] hover:underline disabled:opacity-50"
                >
                  {lensLoading
                    ? (lang === "en" ? "Generating lenses…" : "ದೃಷ್ಟಿಕೋನಗಳನ್ನು ರಚಿಸಲಾಗುತ್ತಿದೆ…")
                    : (lang === "en" ? "◈ Explain in 3 lenses (Investigator · Supervisor · Compliance)" : "◈ 3 ದೃಷ್ಟಿಕೋನಗಳಲ್ಲಿ ವಿವರಿಸಿ")}
                </button>
              ) : (
                <div className="space-y-2">
                  <div className="text-[10px] font-mono text-stone-500 uppercase tracking-wider">
                    {lang === "en" ? "Multi-lens view" : "ಬಹು-ದೃಷ್ಟಿಕೋನ"}{lenses.role_tier ? ` · ${lenses.role_tier}` : ""}
                    {lenses.engine?.includes("Deterministic") && <span className="text-amber-500 ml-1">({lang === "en" ? "AI reframing offline" : "AI ಆಫ್‌ಲೈನ್"})</span>}
                  </div>
                  {Object.entries(lenses.lenses || {}).map(([k, v]) => (
                    <div key={k} className={`rounded-lg p-2.5 border ${k === "compliance" ? "bg-amber-500/5 border-amber-500/20" : "bg-stone-950/50 border-stone-900"}`}>
                      <div className={`text-[10px] font-mono font-bold uppercase tracking-wider mb-1 ${k === "compliance" ? "text-amber-500" : "text-[#C79A4E]"}`}>
                        {LENS_LABELS[k]?.[lang] || k}{k === lenses.primary ? " ★" : ""}
                      </div>
                      <p className="text-[12.5px] text-stone-300 leading-relaxed whitespace-pre-wrap">{decodeDisplayText(String(v))}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : isAI && message.responseType && message.responseType !== "text" && message.data && (
          <div className="w-full flex flex-col gap-2">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#C79A4E]/10 border border-[#C79A4E]/25 text-[11px] text-[#C79A4E] font-medium animate-fade-in">
              <Sparkles className="w-3.5 h-3.5 shrink-0 text-[#C79A4E]" />
              <span>
                {lang === "en"
                  ? "Supporting Intelligence Visualization — Click expand icon to explore in full overlay"
                  : "ಬೆಂಬಲಿತ ಅಪರಾಧ ಗುಪ್ತಚರ ದೃಶ್ಯೀಕರಣ — ವಿಸ್ತರಿಸಲು ಬಲಬದಿಯ ಐಕಾನ್ ಕ್ಲಿಕ್ ಮಾಡಿ"}
              </span>
            </div>
            <InlineWidget
              type={message.responseType}
              data={message.data}
              onExpand={() => onExpandWidget(message.responseType!, message.data)}
            />
          </div>
        )}

        {/* Message actions -- visible on hover, hidden otherwise so the
            thread stays uncluttered. Copy works for any message; Speak
            (moved down from the sender label) stays AI-only. */}
        <div className={`flex items-center gap-1 px-1 opacity-0 group-hover:opacity-100 transition-opacity ${isAI ? "" : "self-end"}`}>
          <button
            onClick={handleCopy}
            title={lang === "en" ? "Copy" : "ನಕಲಿಸಿ"}
            className="p-1 rounded hover:bg-stone-800 text-stone-600 hover:text-stone-300 transition-colors cursor-pointer"
          >
            {copied ? <Check className="w-3 h-3 text-[#5DCAA5]" /> : <Copy className="w-3 h-3" />}
          </button>
          {isAI && ttsSupported && (
            <button
              onClick={handleToggleSpeak}
              title={isSpeaking ? t.ttsStop : t.ttsRead}
              className={`p-1 rounded hover:bg-stone-800 transition-colors cursor-pointer ${isSpeaking ? "text-[#C79A4E]" : "text-stone-600 hover:text-stone-300"}`}
            >
              {isSpeaking ? <Volume2 className="w-3 h-3 animate-pulse text-[#C79A4E]" /> : <VolumeX className="w-3 h-3" />}
            </button>
          )}
        </div>
        </>
        )}
      </div>

      {/* Image lightbox -- fixed overlay in normal flow (not a stray
          position:fixed with no layout parent), closes on backdrop click. */}
      {viewingImageUrl && (
        <div
          className="fixed inset-0 z-50 bg-stone-950/90 backdrop-blur-sm flex items-center justify-center p-6"
          onClick={() => { URL.revokeObjectURL(viewingImageUrl); setViewingImageUrl(null); }}
        >
          <button
            className="absolute top-4 right-4 p-2 rounded-lg bg-stone-900/80 border border-stone-800 text-stone-400 hover:text-stone-100 cursor-pointer"
            onClick={() => { URL.revokeObjectURL(viewingImageUrl); setViewingImageUrl(null); }}
          >
            <X className="w-5 h-5" />
          </button>
          <img
            src={viewingImageUrl}
            alt="Attachment preview"
            className="max-w-full max-h-full rounded-xl border border-stone-800 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
});

