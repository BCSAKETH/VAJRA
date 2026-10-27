import React, { useEffect, useState } from "react";
import { useApp } from "../AppContext";
import { API_BASE } from "../config";

function getTimeBucket(): "morning" | "afternoon" | "evening" | "night" {
  const h = new Date().getHours();
  if (h >= 5 && h < 12) return "morning";
  if (h >= 12 && h < 17) return "afternoon";
  if (h >= 17 && h < 21) return "evening";
  return "night";
}

// Procedural Semantic Synthesizer vectors (Track 19)
const TEMPORAL_VECTORS: Record<"en" | "kn", Record<"morning" | "afternoon" | "evening" | "night", string[]>> = {
  en: {
    morning: ["Morning focus", "Dawn briefing", "Early inquests", "Daylight patrol"],
    afternoon: ["Midday intelligence", "Afternoon inquiry", "Solar peak review"],
    evening: ["Evening thoughts", "Dusk inquests", "Twilight surveillance", "Nightfall review"],
    night: ["Night watch", "Midnight intelligence", "Nocturnal surveillance", "Late inquests"],
  },
  kn: {
    morning: ["ಮುಂಜಾನೆಯ ಅವಲೋಕನ", "ಉದಯದ ತನಿಖಾ ದೃಷ್ಟಿ", "ಬೆಳಗಿನ ಜಾಗರೂಕತೆ"],
    afternoon: ["ಮಧ್ಯಾಹ್ನದ ಪರಿಶೀಲನೆ", "ಮಧ್ಯಾಹ್ನದ ಗುಪ್ತಚರ ಮಾಹಿತಿ"],
    evening: ["ಸಂಜೆಯ ಅವಲೋಕನ", "ಮುಸ್ಸಂಜೆಯ ತನಿಖೆ", "ಸಂಜೆಯ ಗುಪ್ತಚರ ಜಾಗೃತಿ"],
    night: ["ರಾತ್ರಿ ಜಾಗೃತಿ", "ಮಧ್ಯರಾತ್ರಿಯ ನಿಗಾ", "ರಾತ್ರಿಯ ತನಿಖಾ ನಿಗಾವಣೆ"],
  },
};

function generateProceduralGreeting(lang: "en" | "kn", officerName: string | null): string {
  const bucket = getTimeBucket();
  const pool = TEMPORAL_VECTORS[lang][bucket];
  const phrase = pool[Math.floor(Math.random() * pool.length)];

  if (!officerName) return phrase;

  // Extract clean call name (e.g. "Siddharth Rao" -> "Siddharth")
  const firstName = officerName.trim().split(/\s+/)[0];
  if (!firstName) return phrase;

  return `${phrase}, ${firstName}`;
}

export const GreetingHeader: React.FC = () => {
  const { lang, officerName } = useApp();

  const [greeting, setGreeting] = useState<string>(() => {
    const sessionKey = `vajra_dynamic_greeting_${lang}`;
    const cached = typeof window !== "undefined" ? sessionStorage.getItem(sessionKey) : null;
    if (cached) return cached;
    const initial = generateProceduralGreeting(lang, officerName);
    if (typeof window !== "undefined") {
      sessionStorage.setItem(sessionKey, initial);
    }
    return initial;
  });

  // Re-generate or restore when language changes
  useEffect(() => {
    const sessionKey = `vajra_dynamic_greeting_${lang}`;
    const cached = sessionStorage.getItem(sessionKey);
    if (cached) {
      setGreeting(cached);
    } else {
      const fresh = generateProceduralGreeting(lang, officerName);
      sessionStorage.setItem(sessionKey, fresh);
      setGreeting(fresh);
    }
  }, [lang, officerName]);

  // Optional background fetch to enhance with backend AI dynamic greeting if available
  useEffect(() => {
    let isMounted = true;
    const fetchAiGreeting = async () => {
      try {
        const token = localStorage.getItem("vajra_token");
        if (!token) return;
        const res = await fetch(`${API_BASE}/api/officer/dynamic-greeting?lang=${lang}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) return;
        const data = await res.json();
        if (data.greeting && isMounted) {
          setGreeting(data.greeting);
          sessionStorage.setItem(`vajra_dynamic_greeting_${lang}`, data.greeting);
        }
      } catch {
        // Silently preserve procedural greeting on network error or if endpoint unavailable
      }
    };
    fetchAiGreeting();
    return () => {
      isMounted = false;
    };
  }, [lang]);

  return (
    <div className="text-center mb-2 flex flex-col items-center justify-center animate-fade-in select-none">
      <div className="w-10 h-10 rounded-full bg-[#C79A4E]/10 border border-[#C79A4E]/30 flex items-center justify-center text-[#C79A4E] text-xl mb-3 shadow-[0_0_20px_rgba(199,154,78,0.15)]">
        ✴
      </div>
      <h1 className="text-2xl sm:text-3xl font-serif text-stone-100 tracking-tight font-medium transition-all duration-300">
        {greeting}
      </h1>
      <p className="text-xs text-stone-400 mt-1.5 font-sans">
        {lang === "en"
          ? "What case or intelligence shall we investigate today?"
          : "ನಾವು ಇಂದು ಯಾವ ಪ್ರಕರಣ ಅಥವಾ ಗುಪ್ತಚರ ಮಾಹಿತಿಯನ್ನು ಪರಿಶೀಲಿಸೋಣ?"}
      </p>
    </div>
  );
};
export default GreetingHeader;
