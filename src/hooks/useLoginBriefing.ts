import { useEffect, useState, useCallback, useRef } from "react";
import { vajraVakBus } from "../services/vajraVakEventBus";

export interface UseLoginBriefingOptions {
  enabled?: boolean;
  lang?: "en" | "kn";
  callSign?: string;
  officerName?: string;
  autoPlayOnMount?: boolean;
}

export const useLoginBriefing = ({
  enabled = true,
  lang = "en",
  callSign = "Garuda",
  officerName,
  autoPlayOnMount = true,
}: UseLoginBriefingOptions = {}) => {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [hasPlayed, setHasPlayed] = useState(() => {
    try {
      return typeof window !== "undefined" && Boolean(sessionStorage.getItem("vajra_login_briefing_played"));
    } catch {
      return false;
    }
  });

  const isSpeakingRef = useRef(isSpeaking);
  isSpeakingRef.current = isSpeaking;

  const playBriefing = useCallback((force = false) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      return;
    }

    try {
      if (!force && sessionStorage.getItem("vajra_login_briefing_played")) {
        return;
      }

      sessionStorage.setItem("vajra_login_briefing_played", "true");
      setHasPlayed(true);

      // 1. Wake the Sentinel Owl Mascot
      vajraVakBus.emit("user_returned");

      // 2. Prepare Briefing Text
      const greeting = lang === "kn" ? "ನಮಸ್ಕಾರ ಅಧಿಕಾರಿ." : `Namaskara ${officerName ? `Officer ${officerName}` : "Officer"}.`;
      const tacticalBody =
        lang === "kn"
          ? "ರಾತ್ರಿ 3 ಮ್ಯೂಲ್ ಖಾತೆಗಳು ಪತ್ತೆಯಾಗಿವೆ. 1 ಸೆಕ್ಷನ್ 187 ರಿಮಾಂಡ್ ಗಡುವು ಪರಿಶೀಲನೆಗೆ ಬಾಕಿ ಇದೆ. ವಜ್ರ-ವಾಕ್ ಜಾಗರೂಕವಾಗಿದೆ."
          : `3 mule accounts flagged overnight. 1 Section 187 statutory remand deadline requires your review today. ${callSign} is on duty.`;

      const speechText = `${greeting} ${tacticalBody}`;

      // 3. Synthesize Speech via SpeechSynthesis
      const utterance = new SpeechSynthesisUtterance(speechText);
      utterance.lang = lang === "kn" ? "kn-IN" : "en-IN";
      utterance.rate = 1.0;
      utterance.pitch = 1.0;

      utterance.onstart = () => {
        setIsSpeaking(true);
        // Inform mascot that audio output is active
        vajraVakBus.emit("assistant_speaking", { quipText: speechText });
      };

      utterance.onend = () => {
        setIsSpeaking(false);
        vajraVakBus.emit("result_ready");
      };

      utterance.onerror = (e) => {
        console.warn("[useLoginBriefing] Speech synthesis notice:", e);
        setIsSpeaking(false);
      };

      window.speechSynthesis.cancel(); // Clear any hung speech queue
      window.speechSynthesis.speak(utterance);
    } catch (err) {
      console.warn("[useLoginBriefing] Failed to execute login briefing:", err);
      setIsSpeaking(false);
    }
  }, [lang, callSign, officerName]);

  useEffect(() => {
    if (enabled && autoPlayOnMount && !hasPlayed) {
      // Small delay to allow audio context & mascot to initialize after mount
      const timer = setTimeout(() => {
        playBriefing(false);
      }, 1200);
      return () => clearTimeout(timer);
    }
  }, [enabled, autoPlayOnMount, hasPlayed, playBriefing]);

  return {
    isSpeaking,
    hasPlayed,
    playBriefing: () => playBriefing(true),
  };
};
