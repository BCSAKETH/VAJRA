import React, { useEffect, useState } from "react";
import { useApp } from "../AppContext";

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

// Section 129: the open-investigations/pending-approvals pills used to live
// here, floating awkwardly above the emblem and below the officer's name.
// They've moved to AIChatScreen's own Zone 2 telemetry bar (directly under
// the prompt box) which now owns the single /api/officer/digest fetch --
// this component goes back to a pure, instant, client-only greeting with
// zero network dependency.
export const GreetingHeader: React.FC = () => {
  const { lang } = useApp();

  return (
    <div className="text-center mb-2 flex flex-col items-center justify-center animate-fade-in">
      <div className="w-10 h-10 rounded-full bg-[#C79A4E]/10 border border-[#C79A4E]/30 flex items-center justify-center text-[#C79A4E] text-xl mb-3 shadow-[0_0_20px_rgba(199,154,78,0.15)] select-none">
        ✴
      </div>
      <h1 className="text-2xl sm:text-3xl font-serif text-stone-100 tracking-tight font-medium">
        {lang === "en" ? "What shall we investigate today?" : "ನಾವು ಇಂದು ಏನು ತನಿಖೆ ಮಾಡೋಣ?"}
      </h1>
    </div>
  );
};
