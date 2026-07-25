import React, { useState, useEffect } from "react";
import { ChatMessage } from "../AppContext";
import { translations } from "../i18n";
import { AlertTriangle, Tag, Paperclip, Volume2, VolumeX, Sparkles } from "lucide-react";
import { InlineWidget } from "./InlineWidget";

interface ChatBubbleProps {
  message: ChatMessage;
  lang: "en" | "kn";
  onExpandWidget: (type: string, data: any) => void;
}

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

const speakText = (text: string, lang: "en" | "kn", onEnd: () => void) => {
  if (!("speechSynthesis" in window)) return false;
  window.speechSynthesis.cancel();
  
  const cleaned = cleanTextForSpeech(text);
  if (!cleaned) return false;
  
  const utterance = new SpeechSynthesisUtterance(cleaned);
  utterance.lang = lang === "kn" ? "kn-IN" : "en-US";
  utterance.rate = lang === "kn" ? 0.92 : 1.0;
  utterance.pitch = 1.0;
  
  const voices = window.speechSynthesis.getVoices();
  let matchedVoice: SpeechSynthesisVoice | undefined;
  if (lang === "kn") {
    matchedVoice = voices.find(v => v.lang.toLowerCase().includes("kn") || v.name.toLowerCase().includes("kannada") || v.name.toLowerCase().includes("kn-in"));
  } else {
    matchedVoice = voices.find(v => v.lang.toLowerCase().includes("en-in")) || voices.find(v => v.lang.toLowerCase().includes("en-us"));
  }
  if (matchedVoice) {
    utterance.voice = matchedVoice;
  }

  utterance.onend = onEnd;
  utterance.onerror = onEnd;
  window.speechSynthesis.speak(utterance);
  return true;
};

export const ChatBubble: React.FC<ChatBubbleProps> = React.memo(({ message, lang, onExpandWidget }) => {
  const t = translations[lang];
  const isAI = message.sender === "assistant";
  const [isSpeaking, setIsSpeaking] = useState(false);
  const ttsSupported = typeof window !== "undefined" && "speechSynthesis" in window;

  const displayText = isAI
    ? (lang === "kn" ? (message.textKn || message.text) : (message.textEn || message.text))
    : message.text;

  useEffect(() => {
    return () => {
      if (isSpeaking) window.speechSynthesis.cancel();
    };
  }, [isSpeaking]);

  const handleToggleSpeak = () => {
    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      return;
    }
    const started = speakText(displayText, lang, () => setIsSpeaking(false));
    if (started) setIsSpeaking(true);
  };

  return (
    <div className={`flex flex-col gap-1.5 w-full animate-fade-in ${isAI ? "items-start" : "items-end"}`}>
      {/* Sender Label */}
      <span className="text-[10px] text-stone-500 font-semibold px-2 font-mono flex items-center gap-1.5">
        {isAI ? "VAJRA.AI" : (message.senderName ? message.senderName.toUpperCase() : "INVESTIGATOR")} • {message.timestamp}
        {isAI && ttsSupported && (
          <button
            onClick={handleToggleSpeak}
            title={isSpeaking ? t.ttsStop : t.ttsRead}
            className={`p-0.5 rounded hover:bg-stone-800 transition-colors cursor-pointer ${isSpeaking ? "text-[#C79A4E]" : "text-stone-600 hover:text-stone-300"}`}
          >
            {isSpeaking ? <Volume2 className="w-3 h-3 animate-pulse text-[#C79A4E]" /> : <VolumeX className="w-3 h-3" />}
          </button>
        )}
      </span>

      {/* Bubble Container */}
      <div className="max-w-[85%] sm:max-w-[75%] flex flex-col gap-3">
        {isAI && message.isSimulated ? (
          <div className="rounded-2xl p-4 border border-amber-500/30 bg-amber-500/10 flex items-start gap-2.5 max-w-full">
            <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
            <div className="text-xs leading-relaxed text-amber-350">
              <span className="font-extrabold uppercase tracking-wider block mb-1 text-amber-500">
                {t.aiUnavailableTitle}
              </span>
              <span className="text-stone-200">{displayText}</span>
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

          {/* Attachment indicator */}
          {message.attachments && message.attachments.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2.5">
              {message.attachments.map((a, i) => (
                <span
                  key={i}
                  className="flex items-center gap-1 px-2 py-1 rounded-md bg-stone-950/40 border border-stone-800 text-[10px] text-stone-400 font-mono"
                >
                  <Paperclip className="w-3 h-3" />
                  {a.file_name}{a.page_count > 1 ? ` (${a.page_count}p)` : ""}
                </span>
              ))}
            </div>
          )}

          {/* Citation Pills */}
          {isAI && message.citations && message.citations.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-4 pt-3 border-t border-stone-850">
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
            </div>
          )}
        </div>

        {/* Embedded Inline Widgets with Answer-to-Viz Guided Lead-in */}
        {isAI && message.responseType && message.responseType !== "text" && message.data && (
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
        </>
        )}
      </div>
    </div>
  );
});

