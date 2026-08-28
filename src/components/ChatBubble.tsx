import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { ChatMessage } from "../AppContext";
import { translations } from "../i18n";
import { AlertTriangle, Tag, Paperclip, Volume2, VolumeX, Sparkles, Copy, Check, Eye, X, Loader2, RotateCcw, ShieldCheck, ThumbsUp, ThumbsDown, Languages } from "lucide-react";
import { InlineWidget } from "./InlineWidget";
import { API_BASE } from "../config";

interface ChatBubbleProps {
  message: ChatMessage;
  lang: "en" | "kn";
  onExpandWidget: (type: string, data: any) => void;
  onRetry?: () => void;
  addToast?: (title: string, message: string, severity: "Critical" | "Warning" | "Info" | "Success") => void;
  isLast?: boolean;
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

// Lightweight, dependency-free renderer for the small subset of markdown the
// GLM emits -- **bold**, #/##/### headings, bullet lists (* - •), numbered
// lists, and blank-line paragraphs. Builds JSX (never dangerouslySetInnerHTML),
// so it's CSP-safe and can't inject HTML. Without this the raw "**...**" and
// "* " markers show literally in the bubble (the reported rough look).
const renderInline = (s: string, kb: string): React.ReactNode[] => {
  return s.split(/(\*\*[^*]+\*\*)/g).map((p, i) => {
    if (p.startsWith("**") && p.endsWith("**")) {
      return <strong key={kb + i} className="font-semibold text-stone-100">{p.slice(2, -2)}</strong>;
    }
    return <React.Fragment key={kb + i}>{p}</React.Fragment>;
  });
};

const renderRich = (text: string): React.ReactNode => {
  const lines = (text || "").split("\n");
  const blocks: React.ReactNode[] = [];
  let bullets: React.ReactNode[] = [];
  const flush = (k: string) => {
    if (bullets.length) {
      blocks.push(<ul key={"ul" + k} className="list-disc pl-5 space-y-0.5 my-1.5">{bullets}</ul>);
      bullets = [];
    }
  };
  lines.forEach((raw, idx) => {
    const t = raw.trim();
    if (!t) { flush("e" + idx); return; }
    const h = t.match(/^(#{1,3})\s+(.*)$/);
    const bul = t.match(/^[*\-•]\s+(.*)$/);
    const num = t.match(/^(\d+)\.\s+(.*)$/);
    if (h) { flush("h" + idx); blocks.push(<div key={idx} className="font-bold text-stone-100 mt-2.5 mb-0.5 text-[14.5px]">{renderInline(h[2], idx + "h")}</div>); }
    else if (bul) { bullets.push(<li key={idx}>{renderInline(bul[1], idx + "b")}</li>); }
    else if (num) { flush("n" + idx); blocks.push(<div key={idx} className="mt-2 flex gap-1.5"><span className="text-[#C79A4E] font-bold shrink-0">{num[1]}.</span><span>{renderInline(num[2], idx + "n")}</span></div>); }
    else { flush("p" + idx); blocks.push(<p key={idx} className="my-1.5">{renderInline(t, idx + "p")}</p>); }
  });
  flush("end");
  return <div className="leading-relaxed [&>*:first-child]:mt-0">{blocks}</div>;
};

// Pre-generated TTS audio cache so clicking "speak" plays INSTANTLY (no ~5s
// server-synthesis wait, and the flaky-Zia retry happens off the click path).
// Keyed by message id + lang, bounded so blob URLs don't accumulate.
const _ttsCache = new Map<string, string>();
// In-flight pre-generation promises, keyed the same as _ttsCache. When the
// officer taps speak while the background pre-gen is still synthesising (the
// ~5-7s Zia round-trip, unavoidable for Kannada since there's no on-device
// voice), the click AWAITS this promise instead of firing a SECOND synthesis --
// so the perceived lag is only "time since the answer appeared", not a fresh
// 7-10s wait, and Zia is never called twice for the same clip.
const _ttsPending = new Map<string, Promise<string | null>>();
const _ttsOrder: string[] = [];
const _ttsPut = (key: string, url: string) => {
  if (_ttsCache.has(key)) { try { URL.revokeObjectURL(url); } catch { /* noop */ } return; }
  _ttsCache.set(key, url);
  _ttsOrder.push(key);
  while (_ttsOrder.length > 8) {
    const old = _ttsOrder.shift();
    if (old) { const u = _ttsCache.get(old); if (u) { try { URL.revokeObjectURL(u); } catch { /* noop */ } } _ttsCache.delete(old); }
  }
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

export const ChatBubble: React.FC<ChatBubbleProps> = React.memo(({ message, lang, onExpandWidget, onRetry, addToast, isLast }) => {
  const t = translations[lang];
  const isAI = message.sender === "assistant";
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [copied, setCopied] = useState(false);
  const [feedback, setFeedback] = useState<"up" | "down" | null>(null);
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

  // Per-message ⇄ Translate (independent of the app-wide language toggle up top).
  // It translates THIS message LIVE on demand rather than flipping a pre-stored
  // value: English answers are no longer eagerly translated every turn (that was
  // wasted latency), and old messages whose stored Kannada was a bad/looping
  // translation get re-translated correctly. English is always the reliable
  // source; when the officer wants Kannada we fetch a fresh translation once and
  // cache it locally for instant re-toggles.
  const [showTranslated, setShowTranslated] = useState(false);
  const [liveKn, setLiveKn] = useState<string | null>(null);
  const [translating, setTranslating] = useState(false);
  const englishSource = isAI ? (message.textEn || message.text) : message.text;
  const canTranslate = isAI && !message.isSimulated && !!(englishSource && englishSource.trim());

  // effectiveLang drives panel bodies too, so the whole message flips together.
  const effectiveLang: "en" | "kn" = !showTranslated ? lang : (lang === "en" ? "kn" : "en");
  let rawDisplayText: string;
  if (!isAI) {
    rawDisplayText = message.text;
  } else if (!showTranslated) {
    rawDisplayText = lang === "kn" ? (message.textKn || message.text) : englishSource;
  } else if (lang === "en") {
    rawDisplayText = liveKn ?? englishSource;      // toggled to Kannada (fetched live)
  } else {
    rawDisplayText = englishSource;                // toggled to English (source, always reliable)
  }

  const handleTranslate = async () => {
    if (showTranslated) { setShowTranslated(false); return; }
    // Toggling to English, or Kannada already fetched -> instant, no call.
    if (lang === "kn" || liveKn) { setShowTranslated(true); return; }
    setTranslating(true);
    try {
      const res = await fetch(`${API_BASE}/api/translate`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${localStorage.getItem("vajra_token") || ""}`, "Content-Type": "application/json" },
        body: JSON.stringify({ text: englishSource, source_lang: "en", target_lang: "kn" }),
      });
      if (res.ok) {
        const d = await res.json();
        setLiveKn(d.text || englishSource);
        setShowTranslated(true);
      }
    } catch {
      /* silent -- officer still has the original */
    } finally {
      setTranslating(false);
    }
  };
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
  // The exact text spoken -- capped to a summary length at a sentence boundary
  // (a full multi-panel dossier is slow to synthesize and rarely wanted whole).
  // Shared by the click handler AND the background pre-generator so the cached
  // audio matches exactly what a click requests.
  const getSpeakText = React.useCallback((): string => {
    const cleaned = cleanTextForSpeech(displayText);
    if (!cleaned) return "";
    // Speak a SHORT summary (first ~2 sentences) rather than the whole answer.
    // Server TTS takes ~1s per ~150 chars, so a 320-char cap synthesises in
    // ~2s -- fast enough that the background pre-generation finishes before the
    // officer clicks, making playback feel instant. The full answer stays on
    // screen; only what's read aloud is trimmed.
    const MAX_SPEAK = 320;
    if (cleaned.length <= MAX_SPEAK) return cleaned;
    const slice = cleaned.slice(0, MAX_SPEAK);
    const lastStop = Math.max(
      slice.lastIndexOf(". "), slice.lastIndexOf("? "), slice.lastIndexOf("! "),
      slice.lastIndexOf("। "), slice.lastIndexOf("\n")
    );
    return (lastStop > 200 ? slice.slice(0, lastStop + 1) : slice).trim();
  }, [displayText]);

  const playUrl = async (url: string, revokeOnEnd: boolean): Promise<boolean> => {
    try {
      const audio = new Audio(url);
      audioRef.current = audio;
      const done = () => { if (revokeOnEnd) { try { URL.revokeObjectURL(url); } catch { /* noop */ } } audioRef.current = null; setIsSpeaking(false); };
      audio.onended = done;
      audio.onerror = done;
      await audio.play();
      return true;
    } catch { return false; }
  };

  // Pre-generate the LATEST AI answer's audio in the background so "speak" plays
  // INSTANTLY from cache instead of waiting ~5s for synthesis -- and the flaky-
  // Zia retry runs here, off the click path, which is also what makes Kannada
  // voice reliable. Best-effort: any failure just means the click falls back to
  // synthesizing on demand.
  React.useEffect(() => {
    if (!isLast || !isAI || message.isSimulated) return;
    // Voice language = the language actually being DISPLAYED (effectiveLang), not
    // the app toggle: after the ⇄ button translates this message the shown text
    // is in the other language, and the TTS voice must match it or Zia speaks the
    // wrong language (the reported "Kannada speaking not working").
    const vlang = effectiveLang;
    const key = `${message.id}:${vlang}`;
    if (_ttsCache.has(key) || _ttsPending.has(key)) return;
    const toSpeak = getSpeakText();
    if (!toSpeak) return;
    // Start the synthesis and REGISTER the in-flight promise, so a click during
    // synthesis awaits this same request instead of firing a second one.
    const p: Promise<string | null> = (async () => {
      const ctrl = new AbortController();
      const to = setTimeout(() => ctrl.abort(), vlang === "kn" ? 26000 : 12000);
      try {
        const r = await fetch(`${API_BASE}/api/voice/tts`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${localStorage.getItem("vajra_token") || ""}` },
          body: JSON.stringify({ text: toSpeak, lang: vlang }),
          signal: ctrl.signal,
        });
        if (!r.ok) return null;
        const blob = await r.blob();
        const url = URL.createObjectURL(blob);
        _ttsPut(key, url);
        return url;
      } catch { return null; }
      finally { clearTimeout(to); _ttsPending.delete(key); }
    })();
    _ttsPending.set(key, p);
  }, [isLast, isAI, message.id, message.isSimulated, effectiveLang, getSpeakText]);

  const handleToggleSpeak = async () => {
    if (isSpeaking) {
      stopPlayback();
      return;
    }
    const toSpeak = getSpeakText();
    if (!toSpeak) return;
    setIsSpeaking(true);
    const vlang = effectiveLang;  // voice must match the DISPLAYED language, not the app toggle
    const key = `${message.id}:${vlang}`;
    // INSTANT path: pre-generated audio already cached -> play immediately.
    let cachedUrl = _ttsCache.get(key);
    // If the background pre-gen is still synthesising, AWAIT it rather than
    // starting a second Zia request -- this is what removes the double-wait.
    if (!cachedUrl && _ttsPending.has(key)) {
      cachedUrl = (await _ttsPending.get(key)!) || undefined;
    }
    if (cachedUrl && (await playUrl(cachedUrl, false))) return;
    try {
      // Abort the server attempt and fall through to the browser voice if it
      // takes too long -- BUT the deadline is language-dependent. For English
      // the browser voice is a fine fallback, so fail fast (9s) and never leave
      // the officer waiting. For KANNADA the browser has no Kannada voice on
      // most devices (speakText returns "no_kannada_voice" -> silence), so the
      // server is the ONLY source of real Kannada speech; a 9s abort was cutting
      // off the server's retry-through-Zia's-flaky-502s and killing Kannada
      // voice entirely. Give Kannada room for the backend's 2x12s retry.
      const _ctrl = new AbortController();
      const _to = setTimeout(() => _ctrl.abort(), vlang === "kn" ? 26000 : 9000);
      let res: Response;
      try {
        res = await fetch(`${API_BASE}/api/voice/tts`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${localStorage.getItem("vajra_token") || ""}`,
          },
          body: JSON.stringify({ text: toSpeak, lang: vlang }),
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
    const result = speakText(toSpeak, vlang, () => setIsSpeaking(false));
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

  // Officer rates the answer -- the seed signal for auto-learning. Optimistic UI
  // (mark selected immediately); the POST is best-effort and never blocks.
  const submitFeedback = (rating: "up" | "down") => {
    const next = feedback === rating ? null : rating;   // click again to undo
    setFeedback(next);
    if (!next) return;
    fetch(`${API_BASE}/api/feedback`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${localStorage.getItem("vajra_token") || ""}` },
      body: JSON.stringify({
        session_id: (message as any).sessionId || "",
        message_id: String(message.id || ""),
        query: (message as any).forQuery || "",
        response: displayText.slice(0, 2000),
        rating: next,
      }),
    }).catch(() => { /* best-effort telemetry */ });
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
          {/* Main Text Content -- AI answers render light markdown (bold /
              headings / bullets / numbered) so they read as a scannable brief,
              not a raw-asterisk wall of text. User messages stay verbatim. */}
          {isAI
            ? <div className="font-sans text-stone-200 text-[13.5px]">{renderRich(displayText)}</div>
            : <div className="whitespace-pre-wrap font-sans text-stone-200">{displayText}</div>}

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
                        {decodeDisplayText((effectiveLang === "kn" ? (panel.text_kn || panel.text) : panel.text)).trim() || (lang === "en" ? "No data for this section." : "ಈ ವಿಭಾಗಕ್ಕೆ ಡೇಟಾ ಇಲ್ಲ.")}
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
          {/* Per-message ⇄ Translate: translates THIS answer live on demand,
              independent of the whole-app language toggle. */}
          {canTranslate && (
            <button
              onClick={handleTranslate}
              disabled={translating}
              aria-pressed={showTranslated}
              title={
                showTranslated
                  ? (lang === "en" ? "Show original (English)" : "ಮೂಲವನ್ನು ತೋರಿಸಿ (ಕನ್ನಡ)")
                  : (lang === "en" ? "Translate this message to Kannada" : "ಈ ಸಂದೇಶವನ್ನು ಇಂಗ್ಲಿಷ್‌ನಲ್ಲಿ ತೋರಿಸಿ")
              }
              className={`flex items-center gap-1 px-1.5 py-1 rounded hover:bg-stone-800 transition-colors cursor-pointer disabled:opacity-50 ${showTranslated ? "text-[#C79A4E]" : "text-stone-600 hover:text-stone-300"}`}
            >
              {translating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Languages className="w-3 h-3" />}
              <span className="text-[9px] font-mono font-bold tracking-wide">
                {showTranslated ? (lang === "en" ? "EN" : "ಕನ್") : (lang === "en" ? "ಕನ್" : "EN")}
              </span>
            </button>
          )}
          {isAI && !message.isSimulated && (
            <>
              <button
                onClick={() => submitFeedback("up")}
                title={lang === "en" ? "Good answer" : "ಉತ್ತಮ ಉತ್ತರ"}
                aria-pressed={feedback === "up"}
                className={`p-1 rounded hover:bg-stone-800 transition-colors cursor-pointer ${feedback === "up" ? "text-[#5DCAA5]" : "text-stone-600 hover:text-stone-300"}`}
              >
                <ThumbsUp className="w-3 h-3" />
              </button>
              <button
                onClick={() => submitFeedback("down")}
                title={lang === "en" ? "Needs improvement" : "ಸುಧಾರಣೆ ಅಗತ್ಯ"}
                aria-pressed={feedback === "down"}
                className={`p-1 rounded hover:bg-stone-800 transition-colors cursor-pointer ${feedback === "down" ? "text-rose-400" : "text-stone-600 hover:text-stone-300"}`}
              >
                <ThumbsDown className="w-3 h-3" />
              </button>
            </>
          )}
        </div>
        </>
        )}
      </div>

      {/* Image lightbox -- rendered through a PORTAL to document.body so its
          position:fixed covers the true viewport. Rendered inline, it sits
          inside the message bubble whose animate-fade-in / backdrop-blur
          ancestors establish a containing block that traps position:fixed,
          so the backdrop failed to cover the screen and the image floated
          over the chat (the reported "overlay glitch"). A portal escapes that. */}
      {viewingImageUrl && createPortal(
        <div
          className="fixed inset-0 z-[100] bg-stone-950/95 backdrop-blur-sm flex items-center justify-center p-6"
          onClick={() => { URL.revokeObjectURL(viewingImageUrl); setViewingImageUrl(null); }}
          role="dialog"
          aria-modal="true"
        >
          <button
            className="absolute top-4 right-4 p-2 rounded-lg bg-stone-900/80 border border-stone-800 text-stone-400 hover:text-stone-100 cursor-pointer"
            onClick={() => { URL.revokeObjectURL(viewingImageUrl); setViewingImageUrl(null); }}
            aria-label="Close preview"
          >
            <X className="w-5 h-5" />
          </button>
          <img
            src={viewingImageUrl}
            alt="Attachment preview"
            className="max-w-full max-h-full rounded-xl border border-stone-800 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>,
        document.body
      )}
    </div>
  );
});

