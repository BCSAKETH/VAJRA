import React, { useEffect, useMemo, useRef, useState } from "react";
import { API_BASE } from "../config";
import { MascotState, canInterrupt } from "../types/mascot";

interface VajraVakMascotProps {
  lang: "en" | "kn";
  // Non-empty while the officer is actively typing -- eyes glance down into
  // the textarea instead of staring straight ahead (Section 145).
  currentInput?: string;
  isThinking?: boolean;
  // Real count from /api/officer/digest's pending_tasks (Section 129) --
  // an INCREASE between renders is a genuinely new task streaming in, which
  // triggers the hop-and-catch animation + golden chest badge, never a
  // fabricated notification.
  taskBadgeCount?: number;
}

// Local fallback pool, used only when /api/mascot/quip is unreachable --
// mirrors GreetingHeader.tsx's own time-bucketed pool pattern so a quip
// never depends on network availability.
const LOCAL_QUIP_POOL: Record<"en" | "kn", string[]> = {
  en: [
    "Eyes on the beat, always.",
    "Vajra-Vak, standing watch.",
    "Another shift, another lead.",
    "Steady hands, sharp eyes.",
  ],
  kn: ["ಕಣ್ಣು ಕಾವಲಿನಲ್ಲಿ.", "ವಜ್ರ-ವಾಕ್ ಕಾವಲಿನಲ್ಲಿ.", "ಇನ್ನೊಂದು ಪಾಳಿ, ಇನ್ನೊಂದು ಸುಳಿವು."],
};

function pickLocalQuip(lang: "en" | "kn"): string {
  const pool = LOCAL_QUIP_POOL[lang];
  return pool[Math.floor(Math.random() * pool.length)];
}

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return reduced;
}

export const VajraVakMascot: React.FC<VajraVakMascotProps> = ({ lang, currentInput, isThinking, taskBadgeCount }) => {
  const reducedMotion = usePrefersReducedMotion();
  const [state, setState] = useState<MascotState>("PERCHED_IDLE");
  const [isBlinking, setIsBlinking] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isHopping, setIsHopping] = useState(false);
  const [crawling, setCrawling] = useState(false);
  const [quip, setQuip] = useState<string | null>(null);
  const prevTaskCount = useRef<number | undefined>(taskBadgeCount);

  const enter = (next: MascotState) => setState((cur) => (canInterrupt(cur, next) ? next : cur));

  // React to real app signals -- never a state this component invented on
  // its own. QUERY_SUBMITTED is intentionally skipped in favor of jumping
  // straight to THINKING: this mascot stays perched on the composer rather
  // than actually flying off-screen, so the "acknowledge_then_takeoff"
  // transitional clip has nothing physical to animate here.
  useEffect(() => {
    enter(isThinking ? "THINKING" : "PERCHED_IDLE");
  }, [isThinking]);

  useEffect(() => {
    if (!isThinking && (currentInput || "").trim().length > 0) enter("USER_FOCUS");
    else if (!isThinking) enter("PERCHED_IDLE");
  }, [currentInput, isThinking]);

  // Blink loop -- randomized 2.5-6s interval, skipped entirely under
  // reduced motion (a static face, never a half-finished blink frame stuck
  // mid-animation).
  useEffect(() => {
    if (reducedMotion) return;
    let timeout: ReturnType<typeof setTimeout>;
    const scheduleBlink = () => {
      timeout = setTimeout(() => {
        setIsBlinking(true);
        setTimeout(() => setIsBlinking(false), 220);
        scheduleBlink();
      }, 2500 + Math.random() * 3500);
    };
    scheduleBlink();
    return () => clearTimeout(timeout);
  }, [reducedMotion]);

  // Occasional crawl_surface micro-movement while genuinely idle -- a slow
  // side-to-side drift along the composer's top rim, never during
  // thinking/speaking/alert states. Skipped under reduced motion.
  useEffect(() => {
    if (reducedMotion || state !== "PERCHED_IDLE") return;
    const timeout = setTimeout(() => {
      setCrawling(true);
      setTimeout(() => setCrawling(false), 2200);
    }, 45000 + Math.random() * 45000);
    return () => clearTimeout(timeout);
  }, [reducedMotion, state]);

  // Case Diary Task Harvester (Section 145): hop-and-catch fires only when
  // the real pending-task count went UP since the last render -- never on
  // mount (prevTaskCount starts equal to the first value) and never on a
  // decrease (a task being completed isn't a "new task arrived" moment).
  useEffect(() => {
    if (
      typeof taskBadgeCount === "number" &&
      typeof prevTaskCount.current === "number" &&
      taskBadgeCount > prevTaskCount.current &&
      !reducedMotion
    ) {
      setIsHopping(true);
      setTimeout(() => setIsHopping(false), 650);
    }
    prevTaskCount.current = taskBadgeCount;
  }, [taskBadgeCount, reducedMotion]);

  const eyeOffset = useMemo(() => {
    // Elliptical socket clamping: eyes glance down (never past the socket
    // floor) while actively typing, otherwise centered.
    const typing = (currentInput || "").trim().length > 0 && !isThinking;
    return typing ? { dx: 0, dy: 5 } : { dx: 0, dy: 0 };
  }, [currentInput, isThinking]);

  const handleClick = async () => {
    if (isSpeaking) return;
    let text = quip;
    try {
      const res = await fetch(`${API_BASE}/api/mascot/quip?lang=${lang}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("vajra_token") || ""}` },
      });
      if (res.ok) {
        const data = await res.json();
        text = data.quip || pickLocalQuip(lang);
      } else {
        text = pickLocalQuip(lang);
      }
    } catch {
      text = pickLocalQuip(lang);
    }
    setQuip(text);

    const SpeechCtor = window.speechSynthesis;
    if (!SpeechCtor || !text) return;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang === "kn" ? "kn-IN" : "en-US";
    // Real audio-driven lip-flap: tied to the utterance's own start/end
    // events, never a fixed timer guessing at speech duration.
    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    SpeechCtor.cancel();
    SpeechCtor.speak(utterance);
  };

  const eyesClosed = isBlinking && !reducedMotion;
  const transitionCls = reducedMotion ? "" : "transition-all duration-300 ease-out";

  return (
    <div
      className={`relative select-none cursor-pointer ${transitionCls} ${
        crawling ? "translate-x-2" : "translate-x-0"
      } ${isHopping ? "-translate-y-2" : "translate-y-0"}`}
      onClick={handleClick}
      role="button"
      aria-label={lang === "en" ? "Vajra-Vak, tap for a briefing" : "ವಜ್ರ-ವಾಕ್, ಒತ್ತಿ"}
      title={quip || (lang === "en" ? "Vajra-Vak" : "ವಜ್ರ-ವಾಕ್")}
    >
      <svg width="52" height="52" viewBox="0 0 200 200" className={reducedMotion ? "" : "drop-shadow-[0_2px_6px_rgba(0,0,0,0.4)]"}>
        {/* 03_tail_back */}
        <path d="M60 150 Q40 175 55 190 L75 165 Z" fill="#242220" />
        {/* 06/07 left wing, 08/09 right wing -- gentle idle sway, skipped under reduced motion */}
        <g className={!reducedMotion && state === "PERCHED_IDLE" ? "animate-[wingsway_4s_ease-in-out_infinite]" : ""}>
          <path d="M45 110 Q10 130 25 175 Q45 165 55 130 Z" fill="#3A3835" stroke="#161412" strokeWidth="3" />
          <path d="M155 110 Q190 130 175 175 Q155 165 145 130 Z" fill="#3A3835" stroke="#161412" strokeWidth="3" />
        </g>
        {/* 04/05 body */}
        <ellipse cx="100" cy="130" rx="52" ry="60" fill="#2B2926" stroke="#161412" strokeWidth="3" />
        {/* 33/34/35 chest plate + core, glow pulse */}
        <circle cx="100" cy="140" r="16" fill="#161412" stroke="#C79A4E" strokeWidth="2" />
        <circle
          cx="100"
          cy="140"
          r="7"
          fill="#C79A4E"
          className={!reducedMotion ? "animate-[coreglow_2.4s_ease-in-out_infinite]" : ""}
        />
        {/* golden task-harvester badge, only when there's a real count > 0 */}
        {typeof taskBadgeCount === "number" && taskBadgeCount > 0 && (
          <g>
            <circle cx="134" cy="108" r="12" fill="#C79A4E" stroke="#161412" strokeWidth="2" />
            <text x="134" y="112" textAnchor="middle" fontSize="12" fontWeight="bold" fill="#161412" fontFamily="monospace">
              {taskBadgeCount > 9 ? "9+" : taskBadgeCount}
            </text>
          </g>
        )}
        {/* 10-13 legs/feet */}
        <path d="M85 185 v14 M115 185 v14" stroke="#4A4744" strokeWidth="6" strokeLinecap="round" />
        {/* 14-17 head + face plate */}
        <circle cx="100" cy="78" r="46" fill="#34322F" stroke="#161412" strokeWidth="3" />
        <ellipse cx="100" cy="82" rx="38" ry="30" fill="#F2F0EA" />
        {/* 30 forehead vajra emblem */}
        <path d="M100 40 L106 52 L118 55 L108 63 L111 76 L100 68 L89 76 L92 63 L82 55 L94 52 Z" fill="#C79A4E" />
        {/* 18-27 eye sockets, iris/pupil (clamped travel), eyelids (blink) */}
        {[{ cx: 82 }, { cx: 118 }].map((eye, i) => (
          <g key={i}>
            <ellipse cx={eye.cx} cy="82" rx="16" ry="19" fill="#0C0B0A" stroke="#C79A4E" strokeWidth="1.5" />
            {!eyesClosed && (
              <>
                <circle cx={eye.cx + eyeOffset.dx} cy={82 + eyeOffset.dy} r="10" fill="#C79A4E" />
                <circle cx={eye.cx + eyeOffset.dx + 2} cy={80 + eyeOffset.dy} r="3.4" fill="#100E0C" />
              </>
            )}
            {eyesClosed && <path d={`M${eye.cx - 12} 82 Q${eye.cx} 88 ${eye.cx + 12} 82`} stroke="#C79A4E" strokeWidth="3" fill="none" strokeLinecap="round" />}
          </g>
        ))}
        {/* 28/29 beak -- lip-flap synced to real speech events */}
        <path
          d={isSpeaking ? "M90 96 Q100 118 110 96 Q100 108 90 96Z" : "M90 96 Q100 104 110 96 Q100 100 90 96Z"}
          fill="#C79A4E"
          stroke="#161412"
          strokeWidth="1.5"
          className={!reducedMotion ? "transition-all duration-100" : ""}
        />
        {/* 31/32 cyan side lights */}
        <circle cx="58" cy="80" r="5" fill="#5DCAA5" opacity="0.85" />
        <circle cx="142" cy="80" r="5" fill="#5DCAA5" opacity="0.85" />
      </svg>
    </div>
  );
};
