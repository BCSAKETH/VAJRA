import { useEffect, useRef, useState, useCallback } from "react";
import { vajraVakBus } from "../services/vajraVakEventBus";

// Extended SpeechRecognition interface for WebKit compatibility
interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
  message?: string;
}

interface ISpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
}

interface SpeechRecognitionConstructor {
  new (): ISpeechRecognition;
}

declare global {
  interface Window {
    SpeechRecognition?: any;
    webkitSpeechRecognition?: any;
  }
}

export interface UseWakeWordOptions {
  enabled?: boolean;
  callSign?: string;
  lang?: "en" | "kn";
  onTrigger?: () => void;
}

export const useWakeWord = ({
  enabled = false,
  callSign = "Garuda",
  lang = "en",
  onTrigger,
}: UseWakeWordOptions = {}) => {
  const [isListening, setIsListening] = useState<boolean>(false);
  const [isSupported, setIsSupported] = useState<boolean>(false);
  const [lastDetected, setLastDetected] = useState<string | null>(null);
  const recognitionRef = useRef<ISpeechRecognition | null>(null);
  const isEnabledRef = useRef<boolean>(enabled);
  const callSignRef = useRef<string>(callSign);

  isEnabledRef.current = enabled;
  callSignRef.current = callSign;

  // Safe feature detection
  useEffect(() => {
    try {
      if (typeof window !== "undefined") {
        const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
        setIsSupported(Boolean(SpeechRec));
      }
    } catch {
      setIsSupported(false);
    }
  }, []);

  const triggerWakeWordAction = useCallback(() => {
    try {
      // 1. Emit input_focused to VAK EventBus so mascot locks focus
      vajraVakBus.emit("input_focused");

      // 2. Focus the active chat composer input
      const inputEl =
        document.getElementById("vajra-chat-input") ||
        document.querySelector<HTMLInputElement | HTMLTextAreaElement>(
          "input[data-chat-input='true'], textarea[data-chat-input='true'], input[type='text'], textarea"
        );

      if (inputEl) {
        inputEl.focus();
      }

      // 3. User callback if supplied
      if (onTrigger) {
        onTrigger();
      }
    } catch (err) {
      console.warn("[useWakeWord] Error during wake-word focus action:", err);
    }
  }, [onTrigger]);

  useEffect(() => {
    if (!enabled) {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {
          // ignore already stopped
        }
        recognitionRef.current = null;
      }
      setIsListening(false);
      return;
    }

    try {
      const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SpeechRec) {
        setIsSupported(false);
        return;
      }

      const recognition = new SpeechRec();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = lang === "kn" ? "kn-IN" : "en-IN";

      recognition.onresult = (event: SpeechRecognitionEvent) => {
        try {
          const currentCallSign = (callSignRef.current || "Garuda").toLowerCase().trim();
          for (let i = event.resultIndex; i < event.results.length; i++) {
            const transcript = event.results[i][0].transcript.toLowerCase().trim();
            // Match custom call-sign (e.g. "hey garuda", "garuda", "sentinel", "vajra-vak")
            if (
              transcript.includes(currentCallSign) ||
              transcript.includes(`hey ${currentCallSign}`) ||
              transcript.includes(`ok ${currentCallSign}`) ||
              transcript.includes("hey vajra") ||
              transcript.includes("hey sentinel")
            ) {
              setLastDetected(transcript);
              triggerWakeWordAction();
              break;
            }
          }
        } catch (e) {
          console.warn("[useWakeWord] onresult parse error:", e);
        }
      };

      recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
        // "no-speech" and "aborted" are non-fatal in continuous mode
        if (event.error !== "no-speech" && event.error !== "aborted") {
          console.warn("[useWakeWord] Speech recognition error:", event.error);
        }
      };

      recognition.onend = () => {
        setIsListening(false);
        // Automatically restart if still enabled
        if (isEnabledRef.current && recognitionRef.current) {
          try {
            recognition.start();
            setIsListening(true);
          } catch {
            // Wait brief cooldown if browser limits quick restart
            setTimeout(() => {
              if (isEnabledRef.current && recognitionRef.current) {
                try {
                  recognition.start();
                  setIsListening(true);
                } catch {
                  // ignore
                }
              }
            }, 1000);
          }
        }
      };

      recognition.start();
      recognitionRef.current = recognition;
      setIsListening(true);
    } catch (err) {
      console.warn("[useWakeWord] Could not start speech recognition:", err);
      setIsListening(false);
    }

    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {
          // ignore
        }
        recognitionRef.current = null;
      }
      setIsListening(false);
    };
  }, [enabled, lang, triggerWakeWordAction]);

  return {
    isListening,
    isSupported,
    lastDetected,
  };
};
