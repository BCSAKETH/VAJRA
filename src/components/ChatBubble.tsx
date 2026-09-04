import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { ChatMessage } from "../AppContext";
import { translations } from "../i18n";
import { AlertTriangle, Tag, Paperclip, Volume2, VolumeX, Sparkles, Copy, Check, Eye, X, Loader2, RotateCcw, ShieldCheck, ThumbsUp, ThumbsDown, Languages, ChevronLeft, ChevronRight, Mic, Video, FileText } from "lucide-react";
import { InlineWidget } from "./InlineWidget";
import { API_BASE } from "../config";

interface ChatBubbleProps {
  message: ChatMessage;
  lang: "en" | "kn";
  onExpandWidget: (type: string, data: any) => void;
  onRetry?: () => void;
  // Clickable-answer overlay for a clarifying question: only rendered when
  // the answer itself carries real, structured candidates (data.
  // candidate_names) -- e.g. a suspect name matching multiple distinct real
  // people. Deliberately NOT rendered for a free-text clarifying question
  // with no structured options (data.needs_clarification alone) -- there's
  // nothing real to turn into buttons there, and fabricating generic
  // Yes/No-style choices would be exactly the kind of dishonest UI this
  // project avoids everywhere else. Clicking a chip sends it as the
  // officer's own next message, same as typing it.
  onQuickReply?: (text: string) => void;
  addToast?: (title: string, message: string, severity: "Critical" | "Warning" | "Info" | "Success") => void;
  isLast?: boolean;
}

// Panel types that InlineWidget can render as a visual (everything else in a
// Full Dossier -- case_facts, case_sections, case_summary, similar_cases --
// renders as its grounded text block instead).
const WIDGET_PANEL_TYPES = new Set([
  "map", "network", "risk", "forecast", "timeline",
  "mo_match", "correlation", "repeat_offenders", "crime_groups", "trend", "case_distribution", "case_list",
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
    // Number normalization for TTS: Zia mispronounced numbers containing a
    // thousands-separator comma (e.g. "7,099" read as "seven comma zero
    // ninety-nine" instead of "seven thousand ninety-nine") and skipped/
    // garbled the bare "%" sign. Only affects what's SPOKEN, never what's
    // displayed on screen.
    .replace(/(\d),(?=\d)/g, "$1")
    .replace(/(\d+(?:\.\d+)?)\s*%/g, "$1 percent")
    .replace(/\s+/g, " ")
    .trim();
};

// Officer report (confirmed real, live): playback stopped after ~2 lines of
// a short message, well under every length cap already in place (4500-char
// frontend cap, 4800-char backend Zia cap) -- so the cutoff isn't a length
// limit being hit, it's something silently truncating a SINGLE long
// synthesis request/utterance (a hosted TTS engine returning a "successful"
// but truncated clip, or the browser's own well-documented long-utterance
// bug in the speechSynthesis fallback -- either way, one giant request is
// the shared risk factor). Splitting into short, sentence-sized chunks and
// playing them back-to-back removes that risk entirely instead of chasing
// which specific engine is truncating: no single chunk is ever long enough
// to trigger either failure mode, and chaining continues until every chunk
// has genuinely finished -- never a fixed time/length gate.
const _SPEECH_CHUNK_CHARS = 280;
const splitIntoSpeechChunks = (text: string): string[] => {
  const clean = (text || "").trim();
  if (!clean) return [];
  // Split on sentence-ending punctuation (., !, ?, Kannada ।), keeping the
  // punctuation with its sentence, then re-merge short neighbors so a chunk
  // stays close to _SPEECH_CHUNK_CHARS instead of being one clause each.
  const sentences = clean.match(/[^.!?।]+[.!?।]*/g) || [clean];
  const chunks: string[] = [];
  let current = "";
  for (const s of sentences) {
    const piece = s.trim();
    if (!piece) continue;
    if (current && (current.length + piece.length + 1) > _SPEECH_CHUNK_CHARS) {
      chunks.push(current);
      current = piece;
    } else {
      current = current ? `${current} ${piece}` : piece;
    }
  }
  if (current) chunks.push(current);
  return chunks;
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

export const ChatBubble: React.FC<ChatBubbleProps> = React.memo(({ message, lang, onExpandWidget, onRetry, onQuickReply, addToast, isLast }) => {
  const t = translations[lang];
  const isAI = message.sender === "assistant";
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [copied, setCopied] = useState(false);
  const [feedback, setFeedback] = useState<"up" | "down" | null>(null);
  const [viewingImageUrl, setViewingImageUrl] = useState<string | null>(null);
  // Real per-page pagination (confirmed live complaint: the old viewer
  // showed every page of a multi-page PDF pre-stitched into one long
  // scrolling image, with no way to actually page through it). When a
  // document has real per-page data (page_stratus_ids), this holds one
  // object URL per page and the current page index; Prev/Next just moves
  // the index, no re-fetch. viewingImageUrl (above) stays exactly as-is for
  // a single plain image attachment -- this is additive, not a replacement.
  const [viewingPages, setViewingPages] = useState<string[] | null>(null);
  const [viewingPageIdx, setViewingPageIdx] = useState(0);
  const [loadingAttachmentId, setLoadingAttachmentId] = useState<string | null>(null);
  // Real inline previews for every attachment type -- confirmed live
  // complaint: attachments only ever showed as a filename chip requiring a
  // click to see anything, unlike how a normal chat app shows the actual
  // image/PDF-page/audio-player/video-player right in the bubble. Fetched
  // once per stratus_id and cached in this map (keyed by stratus_id) so
  // re-renders never re-fetch the same blob.
  const [previewUrls, setPreviewUrls] = useState<Record<string, string>>({});
  const previewUrlsRef = useRef<Record<string, string>>({});
  useEffect(() => {
    const atts = message.attachments || [];
    const auth = { Authorization: `Bearer ${localStorage.getItem("vajra_token") || ""}` };
    atts.forEach((a) => {
      const id = a.stratus_id;
      if (!id || previewUrlsRef.current[id]) return;
      previewUrlsRef.current[id] = "__pending__";
      fetch(`${API_BASE}/api/attachments/${id}`, { headers: auth })
        .then((res) => (res.ok ? res.blob() : Promise.reject()))
        .then((blob) => {
          const url = URL.createObjectURL(blob);
          previewUrlsRef.current[id] = url;
          setPreviewUrls((prev) => ({ ...prev, [id]: url }));
        })
        .catch(() => {
          delete previewUrlsRef.current[id];
        });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [message.attachments]);
  useEffect(() => {
    return () => {
      (Object.values(previewUrlsRef.current) as string[]).forEach((u) => {
        if (u && u !== "__pending__") URL.revokeObjectURL(u);
      });
    };
  }, []);
  // Uploaded audio attachments (now transcribed server-side via Zia STT) --
  // clicking one used to reuse the image viewer, which silently rendered a
  // broken <img> for an audio blob. Separate state so it opens a real
  // <audio> player instead.
  const [viewingAudioUrl, setViewingAudioUrl] = useState<string | null>(null);
  // Uploaded video attachments -- same reasoning as audio above, a video
  // blob needs a <video> element, not an <img>.
  const [viewingVideoUrl, setViewingVideoUrl] = useState<string | null>(null);
  // USP-3 "explainable by default" -- one tap reveals the evidence trail
  // (which tools/records/queries produced this answer) already carried on
  // every message as citations. Collapsed by default so it never clutters
  // the calm chat, one click away when an officer needs to trust/verify.
  const [showEvidence, setShowEvidence] = useState(false);
  // POCSO access-request button: a deterministic alternative to typing a
  // phrase like "request access" (confirmed live: natural phrasing that
  // missed the text-trigger fell through to GLM and got a fabricated,
  // disconnected-from-reality process instead of this real flow). Shown only
  // when this specific answer was itself redacted (data.pocso_redacted).
  const [pocsoReqStatus, setPocsoReqStatus] = useState<"idle" | "pending" | "approved" | "rejected">("idle");
  const [isPocsoRequesting, setIsPocsoRequesting] = useState(false);
  const pocsoPollRef = useRef<number | null>(null);
  useEffect(() => () => { if (pocsoPollRef.current) window.clearInterval(pocsoPollRef.current); }, []);
  const requestPocsoAccess = async () => {
    const caseNo = message.data?.case_no;
    if (!caseNo) return;
    setIsPocsoRequesting(true);
    try {
      const res = await fetch(`${API_BASE}/api/pocso/request`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("vajra_token") || ""}` },
        body: JSON.stringify({ case_no: caseNo }),
      });
      if (!res.ok) throw new Error("request failed");
      setPocsoReqStatus("pending");
      if (pocsoPollRef.current) window.clearInterval(pocsoPollRef.current);
      pocsoPollRef.current = window.setInterval(async () => {
        try {
          const sres = await fetch(`${API_BASE}/api/pocso/request-status?case_no=${encodeURIComponent(caseNo)}`, {
            headers: { Authorization: `Bearer ${localStorage.getItem("vajra_token") || ""}` },
          });
          const sd = await sres.json();
          if (sd.status === "approved" || sd.status === "rejected") {
            if (pocsoPollRef.current) window.clearInterval(pocsoPollRef.current);
            setPocsoReqStatus(sd.status);
          }
        } catch { /* transient -- next tick retries */ }
      }, 5000);
    } catch {
      setPocsoReqStatus("idle");
    } finally {
      setIsPocsoRequesting(false);
    }
  };
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
  // Signals the chunk-playback loop (handleToggleSpeak) to stop advancing to
  // the next chunk once the officer hits stop mid-readout.
  const speakCancelRef = useRef(false);
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
  // A message has REAL Kannada only if its stored textKn is genuinely Kannada
  // script and not just a copy of the English (English turns don't pre-compute
  // Kannada, so textKn == englishSource there).
  const hasRealKannada = !!message.textKn && message.textKn !== englishSource && /[ಀ-೿]/.test(message.textKn);

  // Which language to actually show: the app-wide toggle, flipped by the ⇄ button.
  const effectiveLang: "en" | "kn" = !showTranslated ? lang : (lang === "en" ? "kn" : "en");

  // Fetch a live Kannada translation of the English source once, cached in liveKn.
  const fetchKn = React.useCallback(async () => {
    if (liveKn || translating || !canTranslate) return;
    setTranslating(true);
    try {
      const res = await fetch(`${API_BASE}/api/translate`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${localStorage.getItem("vajra_token") || ""}`, "Content-Type": "application/json" },
        body: JSON.stringify({ text: englishSource, source_lang: "en", target_lang: "kn" }),
      });
      if (res.ok) { const d = await res.json(); setLiveKn(d.text || englishSource); }
    } catch { /* silent -- officer still has the original */ } finally { setTranslating(false); }
  }, [liveKn, translating, canTranslate, englishSource]);

  // WHOLE-APP language switch: when the top-right toggle is on Kannada (or the ⇄
  // asks for Kannada) and this message has no real stored Kannada, translate it
  // live so the ENTIRE conversation switches language -- without the per-turn
  // eager translation that made English answers slow.
  React.useEffect(() => {
    if (effectiveLang === "kn" && !hasRealKannada && !liveKn && canTranslate) { void fetchKn(); }
  }, [effectiveLang, hasRealKannada, liveKn, canTranslate, fetchKn]);

  const kannadaText = hasRealKannada ? (message.textKn as string) : (liveKn ?? englishSource);
  const rawDisplayText: string = !isAI
    ? message.text
    : (effectiveLang === "kn" ? kannadaText : englishSource);

  const handleTranslate = () => {
    // The effect above fetches Kannada when needed; the button just flips which
    // language this one message shows, independent of the app-wide toggle.
    setShowTranslated((v) => !v);
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
      if (viewingPages) viewingPages.forEach((u) => URL.revokeObjectURL(u));
      if (viewingAudioUrl) URL.revokeObjectURL(viewingAudioUrl);
      if (viewingVideoUrl) URL.revokeObjectURL(viewingVideoUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSpeaking]);

  const stopPlayback = () => {
    speakCancelRef.current = true;
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
    // Speak the FULL answer -- officers reported playback stopping mid-message
    // when this trimmed to a ~140-char summary. Still bounded (not unlimited)
    // so a single runaway answer can't exceed the backend Zia TTS model's own
    // hard cap (_MAX_TTS_CHARS = 4800 in catalyst_speech.py); trimming to the
    // last full sentence at that boundary avoids cutting a sentence in half.
    const MAX_SPEAK = 4500;
    if (cleaned.length <= MAX_SPEAK) return cleaned;
    const slice = cleaned.slice(0, MAX_SPEAK);
    const lastStop = Math.max(
      slice.lastIndexOf(". "), slice.lastIndexOf("? "), slice.lastIndexOf("! "),
      slice.lastIndexOf("। "), slice.lastIndexOf("\n")
    );
    return (lastStop > 60 ? slice.slice(0, lastStop + 1) : slice).trim();
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
    const toSpeak = getSpeakText();
    if (!toSpeak) return;
    // Only the FIRST chunk is pre-generated -- see splitIntoSpeechChunks and
    // playChunk: playback is now sequential per-chunk, so pre-warming just
    // chunk 0 is what removes the wait before ANY audio starts; the rest
    // synthesize just-in-time during playback (a small, acceptable gap
    // between chunks, never a cutoff of the whole message).
    const firstChunk = splitIntoSpeechChunks(toSpeak)[0];
    if (!firstChunk) return;
    const key = `${message.id}:${vlang}:0`;
    if (_ttsCache.has(key) || _ttsPending.has(key)) return;
    // RACE CONDITION FIX: when effectiveLang is "kn" but the text is still in
    // English (translation hasn't arrived yet), DON'T send English text to the
    // Kannada "Anu" voice model — it causes Zia to hang or produce garbled audio.
    // Wait for the next re-render when liveKn or hasRealKannada updates.
    if (vlang === "kn" && !/[\u0C80-\u0CFF]/.test(firstChunk)) return;
    // Start the synthesis and REGISTER the in-flight promise, so a click during
    // synthesis awaits this same request instead of firing a second one.
    const p: Promise<string | null> = (async () => {
      const ctrl = new AbortController();
      // Extended timeouts: Kannada 35s (server needs up to 30s for synthesis),
      // English 12s (fast with speed="fast" + typically cached).
      const to = setTimeout(() => ctrl.abort(), vlang === "kn" ? 35000 : 12000);
      try {
        const r = await fetch(`${API_BASE}/api/voice/tts`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${localStorage.getItem("vajra_token") || ""}` },
          body: JSON.stringify({ text: firstChunk, lang: vlang }),
          signal: ctrl.signal,
        });
        if (!r.ok) return null;
        const blob = await r.blob();
        const url = URL.createObjectURL(blob);
        // Pre-instantiate Audio object so browser pre-decodes the WAV.
        // On click, playback starts INSTANTLY — no decoding lag.
        try {
          const preAudio = new Audio(url);
          preAudio.preload = "auto";
        } catch { /* non-critical: browser may not support preload */ }
        _ttsPut(key, url);
        return url;
      } catch { return null; }
      finally { clearTimeout(to); _ttsPending.delete(key); }
    })();
    _ttsPending.set(key, p);
  }, [isLast, isAI, message.id, message.isSimulated, effectiveLang, getSpeakText]);

  // Plays ONE chunk to completion (server Zia audio, falling back to the
  // browser voice for just this chunk if the server fails) and resolves only
  // once that chunk has genuinely finished -- never a fixed timer. Returns
  // false only when BOTH engines failed for this chunk, so the caller can
  // still continue to the next chunk instead of the whole readout dying on
  // one bad segment.
  const playChunk = async (text: string, vlang: "en" | "kn", key: string): Promise<boolean> => {
    let cachedUrl = _ttsCache.get(key);
    if (!cachedUrl && _ttsPending.has(key)) {
      cachedUrl = (await _ttsPending.get(key)!) || undefined;
    }
    if (cachedUrl) {
      if (await playUrl(cachedUrl, false)) return true;
    } else {
      try {
        const ctrl = new AbortController();
        const to = setTimeout(() => ctrl.abort(), vlang === "kn" ? 35000 : 12000);
        let res: Response;
        try {
          res = await fetch(`${API_BASE}/api/voice/tts`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${localStorage.getItem("vajra_token") || ""}`,
            },
            body: JSON.stringify({ text, lang: vlang }),
            signal: ctrl.signal,
          });
        } finally {
          clearTimeout(to);
        }
        if (res.ok) {
          const blob = await res.blob();
          const url = URL.createObjectURL(blob);
          _ttsPut(key, url);
          if (await playUrl(url, false)) return true;
        }
      } catch {
        // fall through to browser TTS for this chunk
      }
    }
    // Server path failed for this chunk -- browser voice fallback, awaited via
    // its own onEnd rather than a timer.
    return await new Promise<boolean>((resolve) => {
      const result = speakText(text, vlang, () => resolve(true));
      if (result !== "started") resolve(false);
    });
  };

  const handleToggleSpeak = async () => {
    if (isSpeaking) {
      stopPlayback();
      return;
    }
    const toSpeak = getSpeakText();
    if (!toSpeak) return;
    // Split into short, sentence-sized chunks and play them back-to-back --
    // see splitIntoSpeechChunks: this is what removes the "stopped after 2
    // lines" cutoff, since no single request/utterance is ever long enough
    // to trigger the truncation this was tracked down to.
    const chunks = splitIntoSpeechChunks(toSpeak);
    if (chunks.length === 0) return;
    speakCancelRef.current = false;
    setIsSpeaking(true);
    const vlang = effectiveLang;  // voice must match the DISPLAYED language, not the app toggle
    let anyPlayed = false;
    for (let i = 0; i < chunks.length; i++) {
      if (speakCancelRef.current) break;
      const key = `${message.id}:${vlang}:${i}`;
      const ok = await playChunk(chunks[i], vlang, key);
      anyPlayed = anyPlayed || ok;
      if (speakCancelRef.current) break;
    }
    setIsSpeaking(false);
    if (!anyPlayed && vlang === "kn") {
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
  const handleViewAudioAttachment = async (stratusId: string) => {
    setLoadingAttachmentId(stratusId);
    const auth = { Authorization: `Bearer ${localStorage.getItem("vajra_token") || ""}` };
    try {
      const res = await fetch(`${API_BASE}/api/attachments/${stratusId}`, { headers: auth });
      if (!res.ok) throw new Error("Attachment not available.");
      setViewingAudioUrl(URL.createObjectURL(await res.blob()));
    } catch (err) {
      console.error("Failed to load audio attachment:", err);
    } finally {
      setLoadingAttachmentId(null);
    }
  };

  const handleViewVideoAttachment = async (stratusId: string) => {
    setLoadingAttachmentId(stratusId);
    const auth = { Authorization: `Bearer ${localStorage.getItem("vajra_token") || ""}` };
    try {
      const res = await fetch(`${API_BASE}/api/attachments/${stratusId}`, { headers: auth });
      if (!res.ok) throw new Error("Attachment not available.");
      setViewingVideoUrl(URL.createObjectURL(await res.blob()));
    } catch (err) {
      console.error("Failed to load video attachment:", err);
    } finally {
      setLoadingAttachmentId(null);
    }
  };

  const handleViewAttachment = async (stratusId: string, pageIds?: string[]) => {
    setLoadingAttachmentId(stratusId);
    const auth = { Authorization: `Bearer ${localStorage.getItem("vajra_token") || ""}` };
    try {
      // Real multi-page doc: fetch every page (capped at 3 server-side
      // already) and let Prev/Next just flip between already-loaded
      // pages -- no re-fetch per page, no all-pages-stitched scroll.
      const ids = pageIds && pageIds.length > 1 ? pageIds : [stratusId];
      const urls = await Promise.all(ids.map(async (id) => {
        const res = await fetch(`${API_BASE}/api/attachments/${id}`, { headers: auth });
        if (!res.ok) throw new Error("Attachment not available.");
        return URL.createObjectURL(await res.blob());
      }));
      if (urls.length > 1) {
        setViewingPageIdx(0);
        setViewingPages(urls);
      } else {
        setViewingImageUrl(urls[0]);
      }
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
          {/* Attachment strip -- a SEPARATE area above the message text, not
              buried inline below it (confirmed live complaint: it read as
              an afterthought stuck under the text, unlike ChatGPT/Claude/
              Gemini which show attachments as their own row above what was
              typed). Clickable when an inline thumbnail or a Stratus
              reference exists, so an officer can actually view what they
              attached instead of only seeing the filename chip. */}
          {message.attachments && message.attachments.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-2.5 pb-2.5 border-b border-stone-800/60">
              {message.attachments.map((a, i) => {
                const isAudio = (a.type || "").startsWith("audio/");
                const isVideo = (a.type || "").startsWith("video/");
                const isImage = (a.type || "").startsWith("image/");
                const isPdf = a.type === "application/pdf";
                const previewUrl = a.data_uri || (a.stratus_id ? previewUrls[a.stratus_id] : undefined);
                const isLoadingThis = !!a.stratus_id && previewUrlsRef.current[a.stratus_id] === "__pending__";

                // Real inline thumbnail: image, or a PDF's own first-page
                // raster (stratus_id already points at page 1's real JPEG).
                if ((isImage || isPdf) && previewUrl) {
                  return (
                    <button
                      key={i}
                      onClick={() => a.stratus_id ? handleViewAttachment(a.stratus_id, a.page_stratus_ids) : setViewingImageUrl(previewUrl)}
                      className="relative rounded-lg overflow-hidden border border-stone-800 hover:border-[#C79A4E]/40 transition-colors cursor-pointer group"
                    >
                      <img src={previewUrl} alt={a.file_name} className="h-32 w-auto max-w-[180px] object-cover" />
                      <div className="absolute inset-0 bg-stone-950/0 group-hover:bg-stone-950/30 transition-colors flex items-center justify-center">
                        <Eye className="w-5 h-5 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                      {isPdf && (
                        <span className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded bg-stone-950/80 text-[9px] font-mono text-[#C79A4E] flex items-center gap-1">
                          <FileText className="w-2.5 h-2.5" /> {a.page_count > 1 ? `${a.page_count}p` : "PDF"}
                        </span>
                      )}
                    </button>
                  );
                }

                // Real inline audio player -- a compact bar, not a click-to-open chip.
                if (isAudio && previewUrl) {
                  return (
                    <div key={i} className="flex flex-col gap-1 px-2.5 py-2 rounded-lg bg-stone-950/40 border border-stone-800 min-w-[220px]">
                      <span className="flex items-center gap-1.5 text-[10px] text-stone-450 font-mono truncate">
                        <Mic className="w-3 h-3 text-[#5DCAA5] shrink-0" /> {a.file_name}
                      </span>
                      <audio controls src={previewUrl} className="h-8 w-full" style={{ maxWidth: 260 }} />
                    </div>
                  );
                }

                // Real inline video player -- preload=metadata keeps the
                // initial fetch light even though the full blob is already
                // in memory (needed for auth -- a plain <video src> can't
                // send the Bearer header this endpoint requires).
                if (isVideo && previewUrl) {
                  return (
                    <div key={i} className="rounded-lg overflow-hidden border border-stone-800 bg-stone-950/40">
                      <video controls preload="metadata" src={previewUrl} className="h-40 w-auto max-w-[240px]" />
                    </div>
                  );
                }

                // Fallback chip -- still loading, or the preview fetch failed.
                const isViewable = !!a.data_uri || !!a.stratus_id;
                const Wrapper: any = isViewable ? "button" : "span";
                const handleClick = isAudio && a.stratus_id
                  ? () => handleViewAudioAttachment(a.stratus_id!)
                  : isVideo && a.stratus_id
                  ? () => handleViewVideoAttachment(a.stratus_id!)
                  : a.data_uri
                  ? () => setViewingImageUrl(a.data_uri!)
                  : a.stratus_id
                  ? () => handleViewAttachment(a.stratus_id!, a.page_stratus_ids)
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
                    {isLoadingThis ? <Loader2 className="w-3 h-3 animate-spin" /> : isAudio ? <Mic className="w-3 h-3 text-[#5DCAA5]" /> : isVideo ? <Video className="w-3 h-3 text-[#9085e9]" /> : <Paperclip className="w-3 h-3" />}
                    {a.file_name}{a.page_count > 1 ? ` (${a.page_count}p)` : ""}
                    {isViewable && !isLoadingThis && <Eye className="w-3 h-3 ml-0.5 text-[#C79A4E]" />}
                  </Wrapper>
                );
              })}
            </div>
          )}

          {/* Main Text Content -- AI answers render light markdown (bold /
              headings / bullets / numbered) so they read as a scannable brief,
              not a raw-asterisk wall of text. User messages stay verbatim. */}
          {isAI
            ? <div className="font-sans text-stone-200 text-[13.5px]">{renderRich(displayText)}</div>
            : <div className="whitespace-pre-wrap font-sans text-stone-200">{displayText}</div>}

          {/* Clarifying-question quick-reply chips: only when the answer
              carries REAL structured candidates (an ambiguous name matching
              several distinct real people), not a generic yes/no guess. */}
          {isAI && isLast && Array.isArray(message.data?.candidate_names) && message.data.candidate_names.length > 0 && onQuickReply && (
            <div className="mt-3 flex flex-wrap gap-2">
              {message.data.candidate_names.slice(0, 8).map((name: string, i: number) => (
                <button
                  key={`${name}-${i}`}
                  type="button"
                  onClick={() => onQuickReply(name)}
                  className="text-[11px] font-mono px-2.5 py-1 rounded-full bg-[#C79A4E]/10 border border-[#C79A4E]/30 text-[#C79A4E] hover:bg-[#C79A4E]/20 transition-colors cursor-pointer"
                >
                  {name}
                </button>
              ))}
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
                    : (lang === "en" ? "🔍 View Grounding & ZCQL Provenance" : "🔍 ಆಧಾರ ಮತ್ತು ZCQL ಪುರಾವೆ ವೀಕ್ಷಿಸಿ")}
                </button>
                {message.data?.pocso_redacted && message.data?.case_no && (
                  pocsoReqStatus === "pending" ? (
                    <span className="flex items-center gap-1 text-[10px] font-mono text-amber-400">
                      <Loader2 className="w-2.5 h-2.5 animate-spin" />
                      {lang === "en" ? "Awaiting supervisor..." : "ಮೇಲ್ವಿಚಾರಕರಿಗಾಗಿ ಕಾಯಲಾಗುತ್ತಿದೆ..."}
                    </span>
                  ) : pocsoReqStatus === "approved" ? (
                    <span className="text-[10px] font-mono text-emerald-400">
                      {lang === "en" ? "Access approved -- ask again to view" : "ಪ್ರವೇಶ ಅನುಮೋದಿಸಲಾಗಿದೆ -- ಮತ್ತೆ ಕೇಳಿ"}
                    </span>
                  ) : pocsoReqStatus === "rejected" ? (
                    <span className="text-[10px] font-mono text-rose-400">
                      {lang === "en" ? "Access denied" : "ಪ್ರವೇಶ ನಿರಾಕರಿಸಲಾಗಿದೆ"}
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={requestPocsoAccess}
                      disabled={isPocsoRequesting}
                      className="flex items-center gap-1 text-[10px] font-mono text-rose-300 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/40 px-2 py-0.5 rounded transition-colors disabled:opacity-50 cursor-pointer"
                    >
                      <ShieldCheck className="w-2.5 h-2.5 shrink-0" />
                      {isPocsoRequesting
                        ? (lang === "en" ? "Requesting..." : "ವಿನಂತಿಸಲಾಗುತ್ತಿದೆ...")
                        : (lang === "en" ? "Request Access" : "ಪ್ರವೇಶ ವಿನಂತಿಸಿ")}
                    </button>
                  )
                )}
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
                  {/* Court-admissible provenance (§65B IEA): verifiable hash + cited records */}
                  {message.data?._provenance && (
                    <div className="rounded-md border border-[#C79A4E]/20 bg-[#C79A4E]/[0.04] p-2.5 space-y-1.5">
                      <div className="flex items-center gap-1.5 text-[9px] uppercase tracking-wider text-[#C79A4E] font-mono">
                        <ShieldCheck className="w-2.5 h-2.5 shrink-0" />
                        {lang === "en" ? "Cryptographic provenance · §65B IEA" : "ಕ್ರಿಪ್ಟೊಗ್ರಾಫಿಕ್ ಆಧಾರ · §65B"}
                      </div>
                      {Array.isArray(message.data._provenance.records) && message.data._provenance.records.length > 0 && (
                        <div className="text-[10px] text-stone-400">
                          <span className="text-stone-500">{lang === "en" ? "Cited records: " : "ಉಲ್ಲೇಖಿತ ದಾಖಲೆಗಳು: "}</span>
                          <span className="font-mono text-stone-300">{message.data._provenance.records.join(" · ")}</span>
                        </div>
                      )}
                      <div className="text-[10px] text-stone-400" title={message.data._provenance.hash}>
                        <span className="text-stone-500">{lang === "en" ? "Integrity (SHA-256): " : "ಸಮಗ್ರತೆ (SHA-256): "}</span>
                        <span className="font-mono text-emerald-400 break-all">{String(message.data._provenance.hash || "").slice(0, 32)}…</span>
                      </div>
                      <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[9px] text-stone-500 font-mono">
                        {message.data._provenance.operator_badge && <span>{lang === "en" ? "Operator" : "ಅಧಿಕಾರಿ"}: {message.data._provenance.operator_badge}</span>}
                        {message.data._provenance.generated_utc && <span>{String(message.data._provenance.generated_utc).replace("T", " ").slice(0, 19)} UTC</span>}
                      </div>
                    </div>
                  )}
                  {/* Court-Admissible Provenance HUD (implementation_plan.md
                      #7): the exact real ZCQL SQL strings this turn executed
                      -- captured at the one real choke point every query
                      already passes through (see vajra_core.py's
                      patched_execute_query), not reconstructed or guessed. */}
                  {Array.isArray(message.data?._zcql_provenance) && message.data._zcql_provenance.length > 0 && (
                    <div className="rounded-md border border-stone-800 bg-stone-950/70 p-2.5 space-y-1">
                      <div className="flex items-center gap-1.5 text-[9px] uppercase tracking-wider text-stone-400 font-mono">
                        <ShieldCheck className="w-2.5 h-2.5 shrink-0" />
                        {lang === "en" ? "🔍 Grounding & ZCQL provenance" : "🔍 ಆಧಾರ ಮತ್ತು ZCQL ಪುರಾವೆ"}
                      </div>
                      <div className="space-y-1 max-h-40 overflow-y-auto">
                        {message.data._zcql_provenance.map((q: string, i: number) => (
                          <div key={i} className="text-[9.5px] font-mono text-stone-400 break-all bg-stone-900/60 rounded px-1.5 py-1">
                            {q}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="text-[9px] text-stone-600 pt-1 border-t border-stone-850">
                    {lang === "en"
                      ? "Every VAJRA answer is grounded in real records — no fabricated data. This trail is written to the tamper-evident audit ledger; any edit changes the integrity hash."
                      : "ಪ್ರತಿ ವಜ್ರ ಉತ್ತರವೂ ನೈಜ ದಾಖಲೆಗಳ ಆಧಾರಿತ — ಯಾವುದೇ ಕಲ್ಪಿತ ಡೇಟಾ ಇಲ್ಲ. ಈ ಜಾಡು ಸುರಕ್ಷಿತ ಆಡಿಟ್ ಲೆಡ್ಜರ್‌ಗೆ ಬರೆಯಲಾಗಿದೆ; ಯಾವುದೇ ಬದಲಾವಣೆ ಹ್ಯಾಶ್ ಅನ್ನು ಬದಲಾಯಿಸುತ್ತದೆ."}
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

      {/* Audio attachment playback -- separate from the image lightbox above
          since an <img> silently renders broken for an audio blob. */}
      {viewingAudioUrl && createPortal(
        <div
          className="fixed inset-0 z-[100] bg-stone-950/95 backdrop-blur-sm flex items-center justify-center p-6"
          onClick={() => { URL.revokeObjectURL(viewingAudioUrl); setViewingAudioUrl(null); }}
          role="dialog"
          aria-modal="true"
        >
          <button
            className="absolute top-4 right-4 p-2 rounded-lg bg-stone-900/80 border border-stone-800 text-stone-400 hover:text-stone-100 cursor-pointer"
            onClick={() => { URL.revokeObjectURL(viewingAudioUrl); setViewingAudioUrl(null); }}
            aria-label="Close preview"
          >
            <X className="w-5 h-5" />
          </button>
          <div
            className="glass-panel border border-stone-800 rounded-2xl p-6 flex flex-col items-center gap-3 max-w-sm w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <Mic className="w-8 h-8 text-[#5DCAA5]" />
            <audio controls autoPlay src={viewingAudioUrl} className="w-full" />
          </div>
        </div>,
        document.body
      )}

      {/* Video attachment playback -- same reasoning as the audio modal. */}
      {viewingVideoUrl && createPortal(
        <div
          className="fixed inset-0 z-[100] bg-stone-950/95 backdrop-blur-sm flex items-center justify-center p-6"
          onClick={() => { URL.revokeObjectURL(viewingVideoUrl); setViewingVideoUrl(null); }}
          role="dialog"
          aria-modal="true"
        >
          <button
            className="absolute top-4 right-4 p-2 rounded-lg bg-stone-900/80 border border-stone-800 text-stone-400 hover:text-stone-100 cursor-pointer"
            onClick={() => { URL.revokeObjectURL(viewingVideoUrl); setViewingVideoUrl(null); }}
            aria-label="Close preview"
          >
            <X className="w-5 h-5" />
          </button>
          <video
            controls autoPlay src={viewingVideoUrl}
            className="max-w-full max-h-full rounded-xl border border-stone-800 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>,
        document.body
      )}

      {/* Real paginated document viewer -- one page at a time, Prev/Next
          navigation, page indicator. Replaces the old behavior of showing
          every page pre-stitched into one long scrolling image. */}
      {viewingPages && createPortal(
        <div
          className="fixed inset-0 z-[100] bg-stone-950/95 backdrop-blur-sm flex items-center justify-center p-6"
          onClick={() => { viewingPages.forEach((u) => URL.revokeObjectURL(u)); setViewingPages(null); }}
          role="dialog"
          aria-modal="true"
        >
          <button
            className="absolute top-4 right-4 p-2 rounded-lg bg-stone-900/80 border border-stone-800 text-stone-400 hover:text-stone-100 cursor-pointer"
            onClick={() => { viewingPages.forEach((u) => URL.revokeObjectURL(u)); setViewingPages(null); }}
            aria-label="Close preview"
          >
            <X className="w-5 h-5" />
          </button>
          <div className="flex flex-col items-center gap-3 max-w-full max-h-full" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-4">
              <button
                onClick={() => setViewingPageIdx((i) => Math.max(0, i - 1))}
                disabled={viewingPageIdx === 0}
                className="p-2 rounded-lg bg-stone-900/80 border border-stone-800 text-stone-300 hover:text-[#C79A4E] hover:border-[#C79A4E]/40 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                aria-label="Previous page"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <span className="text-[11px] font-mono text-stone-400 uppercase tracking-wide">
                {lang === "en" ? "Page" : "ಪುಟ"} {viewingPageIdx + 1} / {viewingPages.length}
              </span>
              <button
                onClick={() => setViewingPageIdx((i) => Math.min(viewingPages.length - 1, i + 1))}
                disabled={viewingPageIdx === viewingPages.length - 1}
                className="p-2 rounded-lg bg-stone-900/80 border border-stone-800 text-stone-300 hover:text-[#C79A4E] hover:border-[#C79A4E]/40 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                aria-label="Next page"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
            <img
              src={viewingPages[viewingPageIdx]}
              alt={`Page ${viewingPageIdx + 1}`}
              className="max-w-full max-h-[75vh] rounded-xl border border-stone-800 shadow-2xl"
            />
          </div>
        </div>,
        document.body
      )}
    </div>
  );
});

