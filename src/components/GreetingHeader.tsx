import React, { useEffect, useState } from "react";
import { useApp } from "../AppContext";
import { API_BASE } from "../config";

// §9.10 Context-aware greeting. Explicitly EXCLUDES the festival/forecast
// tie-in (assigned to a teammate, per user instruction, not tracked here).
// Loophole L1: the time-of-day text is computed from the officer's own
// browser clock -- purely cosmetic (worst case: a wrong "Good Morning" at
// 3pm), never a security-relevant timestamp.
//
// Per live feedback: a single fixed phrase per time-of-day read as static
// (the exact same "Good Evening" every single evening). A small pool per
// time-of-day, picked once per mount, gives real variety across visits
// without inventing any new claim -- still purely a time-of-day greeting,
// not tied to anything the officer did or any real event.
const GREETING_POOL: Record<"en" | "kn", Record<"morning" | "afternoon" | "evening" | "night", string[]>> = {
  en: {
    morning: ["Good Morning", "Morning", "Rise and Shine"],
    afternoon: ["Good Afternoon", "Afternoon"],
    evening: ["Good Evening", "Evening"],
    night: ["Good Night", "Working Late"],
  },
  kn: {
    morning: ["ಶುಭೋದಯ"],
    afternoon: ["ಶುಭ ಮಧ್ಯಾಹ್ನ"],
    evening: ["ಶುಭ ಸಂಜೆ"],
    night: ["ಶುಭ ರಾತ್ರಿ"],
  },
};

function getTimeBucket(): "morning" | "afternoon" | "evening" | "night" {
  const h = new Date().getHours();
  if (h < 12) return "morning";
  if (h < 17) return "afternoon";
  if (h < 21) return "evening";
  return "night";
}

function pickTimeGreeting(lang: "en" | "kn"): string {
  const options = GREETING_POOL[lang][getTimeBucket()];
  return options[Math.floor(Math.random() * options.length)];
}

interface DigestResponse {
  open_investigations: number;
  pending_approvals: number;
}

export const GreetingHeader: React.FC = () => {
  const { lang, officerName } = useApp(); // officerName ALREADY exists in AppContext (global, persisted)
  const [digest, setDigest] = useState<DigestResponse | null>(null);
  // Picked once per mount (lazy initializer), not recomputed every render --
  // a fresh visit/new-chat gets a fresh pick, but it doesn't flicker mid-view.
  const [greeting, setGreeting] = useState(() => pickTimeGreeting(lang));
  useEffect(() => { setGreeting(pickTimeGreeting(lang)); }, [lang]);

  useEffect(() => {
    let cancelled = false;
    // Loophole L2: the greeting text itself renders instantly from
    // client-side data only (officerName, browser clock) -- this fetch
    // pops the digest chips in once ready, never blocking the greeting.
    fetch(`${API_BASE}/api/officer/digest`, {
      headers: { Authorization: `Bearer ${localStorage.getItem("vajra_token") || ""}` },
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (!cancelled) setDigest(d); })
      .catch(() => { /* Loophole L3: silent -- never blocks or breaks the greeting */ });
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="text-center">
      <h1 className="text-xl font-serif text-stone-100">
        {greeting}, {officerName || (lang === "en" ? "Officer" : "ಅಧಿಕಾರಿ")}
      </h1>
      {digest && (digest.open_investigations > 0 || digest.pending_approvals > 0) && (
        <div className="flex justify-center flex-wrap gap-2 mt-2">
          {digest.open_investigations > 0 && (
            <span className="text-[10px] px-2 py-1 rounded-full bg-stone-900 border border-stone-800 text-stone-400 font-mono">
              {lang === "en"
                ? `\u{1F4CB} ${digest.open_investigations} open investigation${digest.open_investigations > 1 ? "s" : ""}`
                : `\u{1F4CB} ${digest.open_investigations} ಸಕ್ರಿಯ ತನಿಖೆಗಳು`}
            </span>
          )}
          {digest.pending_approvals > 0 && (
            <span className="text-[10px] px-2 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 font-mono">
              {lang === "en"
                ? `⏳ ${digest.pending_approvals} pending approval${digest.pending_approvals > 1 ? "s" : ""}`
                : `⏳ ${digest.pending_approvals} ಬಾಕಿ ಅನುಮೋದನೆಗಳು`}
            </span>
          )}
        </div>
      )}
    </div>
  );
};
