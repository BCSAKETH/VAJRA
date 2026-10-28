import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { API_BASE } from "../config";
import { MascotState } from "../types/mascot";
import { vakBus, vajraVakBus, MascotEventPayload, VajraVakEvent } from "../services/vajraVakEventBus";
import { useWakeWord } from "../hooks/useWakeWord";
import { useLoginBriefing } from "../hooks/useLoginBriefing";

export interface VajraVakMascotProps {
  lang: "en" | "kn";
  currentInput?: string;
  isThinking?: boolean;
  taskBadgeCount?: number;
}

export interface StateConfig {
  priority: number;
  timeoutMs?: number;
  autoNext?: MascotState;
}

// Authoritative Priority Mapping: Higher number takes absolute precedence
export const STATE_PRIORITIES: Record<MascotState, number> = {
  SLEEP: 5,
  PERCHED_IDLE: 10,
  USER_FOCUS: 20,
  WAKE: 20,
  NAVIGATION: 25,
  THINKING: 30,
  THINKING_DEEP: 35,
  QUERY_SUBMITTED: 40,
  RESPONDING: 40,
  RESULT_READY: 45,
  STARTUP: 50,
  FLY_IN: 50,
  SUCCESS: 60,
  ERROR: 70,
  ALERT: 100,
  ALERT_HOLD: 100,
};

export const STATE_CONFIGS: Record<MascotState, StateConfig> = {
  STARTUP: { priority: 50, timeoutMs: 900, autoNext: "FLY_IN" },
  FLY_IN: { priority: 50, timeoutMs: 1200, autoNext: "PERCHED_IDLE" },
  PERCHED_IDLE: { priority: 10 },
  USER_FOCUS: { priority: 20 },
  QUERY_SUBMITTED: { priority: 40, timeoutMs: 1000, autoNext: "THINKING" },
  THINKING: { priority: 30 },
  THINKING_DEEP: { priority: 35 },
  RESULT_READY: { priority: 45, timeoutMs: 1200, autoNext: "PERCHED_IDLE" },
  RESPONDING: { priority: 40 },
  ALERT: { priority: 100, timeoutMs: 7000, autoNext: "ALERT_HOLD" },
  ALERT_HOLD: { priority: 100 },
  SUCCESS: { priority: 60, timeoutMs: 2500, autoNext: "PERCHED_IDLE" },
  ERROR: { priority: 70, timeoutMs: 3000, autoNext: "PERCHED_IDLE" },
  NAVIGATION: { priority: 25, timeoutMs: 4000, autoNext: "PERCHED_IDLE" },
  SLEEP: { priority: 5 },
  WAKE: { priority: 20, timeoutMs: 900, autoNext: "PERCHED_IDLE" },
};

export interface SentinelOwlHookResult {
  currentState: MascotState;
  setCurrentState: React.Dispatch<React.SetStateAction<MascotState>>;
  targetAnchor: string;
  setTargetAnchor: React.Dispatch<React.SetStateAction<string>>;
  alertDismissed: boolean;
  dismissAlert: () => void;
  transitionTo: (nextState: MascotState, force?: boolean) => void;
}

/**
 * useSentinelOwlState: Core FSM Engine connecting VajraVakEventBus to Sentinel Owl Rig.
 * Implements strict Priority Gating so high-priority events (e.g. ALERT=100)
 * cannot be interrupted by lower-priority events (e.g. QUERY_SUBMITTED=40).
 */
export const useSentinelOwlState = (
  isThinkingProp?: boolean,
  currentInputProp?: string
): SentinelOwlHookResult => {
  const [currentState, setCurrentState] = useState<MascotState>("PERCHED_IDLE");
  const [targetAnchor, setTargetAnchor] = useState<string>("ANCHOR_PERCH");
  const [alertDismissed, setAlertDismissed] = useState<boolean>(false);

  // Priority-aware state transition with lock gating
  const transitionTo = useCallback((nextState: MascotState, force = false) => {
    setCurrentState((current) => {
      if (current === nextState) return current;
      const currentPri = STATE_PRIORITIES[current] ?? 0;
      const nextPri = STATE_PRIORITIES[nextState] ?? 0;

      // Strict Priority Gating:
      // If current state has higher priority (e.g. ALERT=100) and !force, lock transition
      if (!force && nextPri < currentPri) {
        return current;
      }
      return nextState;
    });
  }, []);

  const dismissAlert = useCallback(() => {
    setAlertDismissed(true);
    transitionTo("PERCHED_IDLE", true);
    setTargetAnchor("ANCHOR_PERCH");
  }, [transitionTo]);

  // Subscribe to all 17 incoming events on the vajraVakBus / vakBus
  useEffect(() => {
    const unsub = vajraVakBus.subscribe((event) => {
      const evType = event.type;
      const payload = event.payload;

      switch (evType) {
        case "app_loaded":
          transitionTo("STARTUP", true);
          break;
        case "input_focused":
        case "user_typing":
        case "file_uploaded":
          transitionTo("USER_FOCUS");
          break;
        case "query_submitted":
          transitionTo("QUERY_SUBMITTED");
          break;
        case "ai_processing_started":
          transitionTo("THINKING");
          break;
        case "retrieval_started":
        case "file_analysis_started":
        case "deep_analysis_started":
          transitionTo("THINKING_DEEP");
          break;
        case "map_analysis_started":
          setTargetAnchor(payload?.anchorTarget || "ANCHOR_MAP");
          transitionTo("NAVIGATION");
          break;
        case "network_analysis_started":
          setTargetAnchor(payload?.anchorTarget || "ANCHOR_GRAPH");
          transitionTo("NAVIGATION");
          break;
        case "page_changed":
          setTargetAnchor(payload?.anchorTarget || "ANCHOR_DOSSIER");
          transitionTo("NAVIGATION");
          break;
        case "result_ready":
          transitionTo("RESULT_READY");
          break;
        case "assistant_speaking":
          transitionTo("RESPONDING");
          break;
        case "operation_success":
          transitionTo("SUCCESS");
          break;
        case "operation_error":
          transitionTo("ERROR");
          break;
        case "critical_alert":
        case "agent_alert":
          setAlertDismissed(false);
          transitionTo("ALERT", true);
          break;
        case "idle_timeout":
          transitionTo("SLEEP");
          break;
        case "user_returned":
          transitionTo("WAKE");
          break;
        default:
          break;
      }
    });

    return () => unsub();
  }, [transitionTo]);

  // Synchronize top-level props with internal state
  useEffect(() => {
    if (
      isThinkingProp &&
      currentState !== "THINKING" &&
      currentState !== "THINKING_DEEP" &&
      currentState !== "ALERT" &&
      currentState !== "ALERT_HOLD"
    ) {
      transitionTo("THINKING");
    } else if (!isThinkingProp && (currentState === "THINKING" || currentState === "THINKING_DEEP")) {
      transitionTo("PERCHED_IDLE");
    }
  }, [isThinkingProp, currentState, transitionTo]);

  useEffect(() => {
    const hasInput = (currentInputProp || "").trim().length > 0;
    if (hasInput && currentState === "PERCHED_IDLE") {
      transitionTo("USER_FOCUS");
    } else if (!hasInput && currentState === "USER_FOCUS") {
      transitionTo("PERCHED_IDLE");
    }
  }, [currentInputProp, currentState, transitionTo]);

  // Automatic timeout transitions for ephemeral states
  useEffect(() => {
    const cfg = STATE_CONFIGS[currentState];
    if (cfg?.timeoutMs && cfg?.autoNext) {
      const timer = setTimeout(() => {
        transitionTo(cfg.autoNext!, true);
        if (cfg.autoNext === "PERCHED_IDLE") {
          setTargetAnchor("ANCHOR_PERCH");
        }
      }, cfg.timeoutMs);
      return () => clearTimeout(timer);
    }
  }, [currentState, transitionTo]);

  return {
    currentState,
    setCurrentState,
    targetAnchor,
    setTargetAnchor,
    alertDismissed,
    dismissAlert,
    transitionTo,
  };
};

const LOCAL_QUIP_POOL: Record<"en" | "kn", string[]> = {
  en: [
    "Eyes on the beat, always.",
    "Vajra-Vak standing watch. All networks audited.",
    "Scanning evidence. Grounded in CCTNS §63 BSA.",
    "Steady hands, sharp eyes. Tracking the syndicate.",
    "Tactical sentinel online and synchronized.",
  ],
  kn: [
    "ಕಣ್ಣು ಕಾವಲಿನಲ್ಲಿ, ಸದಾ ಸನ್ನದ್ಧ.",
    "ವಜ್ರ-ವಾಕ್ ಕಾವಲಿನಲ್ಲಿದೆ. ದಾಖಲೆಗಳು ಪರಿಶೀಲಿಸಲಾಗಿದೆ.",
    "ಸಾಕ್ಷ್ಯ ಸ್ಕ್ಯಾನ್ ಆಗುತ್ತಿದೆ. ಸಿಸಿಟಿಎನ್‌ಎಸ್ ಅನುಸರಣೆ.",
    "ತನಿಖೆ ಮುಂದುವರಿದಿದೆ, ಜಾಗರೂಕರಾಗಿರಿ.",
  ],
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

export const VajraVakMascot: React.FC<VajraVakMascotProps> = ({
  lang,
  currentInput,
  isThinking,
  taskBadgeCount,
}) => {
  const reducedMotion = usePrefersReducedMotion();

  // Integrated FSM Engine with Priority Gating
  const {
    currentState: vakState,
    targetAnchor,
    dismissAlert,
    transitionTo,
  } = useSentinelOwlState(isThinking, currentInput);

  // Dynamic Mascot & Voice Configuration
  const [mascotCallSign, setMascotCallSign] = useState<string>(() => {
    return (typeof window !== "undefined" && localStorage.getItem("vajra_callsign")) || "Garuda";
  });
  const [wakeWordActive, setWakeWordActive] = useState<boolean>(() => {
    return typeof window !== "undefined" && localStorage.getItem("vajra_wakeword_enabled") === "true";
  });
  const [loginBriefingActive, setLoginBriefingActive] = useState<boolean>(() => {
    return typeof window !== "undefined" && localStorage.getItem("vajra_login_briefing_enabled") !== "false";
  });

  useEffect(() => {
    const onStorage = () => {
      setMascotCallSign(localStorage.getItem("vajra_callsign") || "Garuda");
      setWakeWordActive(localStorage.getItem("vajra_wakeword_enabled") === "true");
      setLoginBriefingActive(localStorage.getItem("vajra_login_briefing_enabled") !== "false");
    };
    window.addEventListener("storage", onStorage);
    const unsub = vajraVakBus.subscribe((e) => {
      if (e.type === "app_loaded") {
        onStorage();
      }
    });
    return () => {
      window.removeEventListener("storage", onStorage);
      unsub();
    };
  }, []);

  // Hands-free Wake-Word Listener hook
  useWakeWord({
    enabled: wakeWordActive,
    callSign: mascotCallSign,
    lang,
  });

  // Tactical Login Audio Briefing hook
  useLoginBriefing({
    enabled: loginBriefingActive,
    lang,
    callSign: mascotCallSign,
  });

  const [isBlinking, setIsBlinking] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [quip, setQuip] = useState<string | null>(null);

  // Blink cycle (2.5 - 6s)
  useEffect(() => {
    if (reducedMotion || vakState === "SLEEP") return;
    let timer: ReturnType<typeof setTimeout>;
    const schedule = () => {
      timer = setTimeout(() => {
        setIsBlinking(true);
        setTimeout(() => setIsBlinking(false), 220);
        schedule();
      }, 2500 + Math.random() * 3500);
    };
    schedule();
    return () => clearTimeout(timer);
  }, [reducedMotion, vakState]);

  // Eye gaze tracking (clamped dx, dy)
  const eyeOffset = useMemo(() => {
    if (vakState === "USER_FOCUS" && (currentInput || "").trim().length > 0) {
      return { dx: 0, dy: 5 }; // Looking down at input composer
    }
    if (vakState === "NAVIGATION") {
      return { dx: -4, dy: -2 }; // Looking toward the target panel
    }
    if (vakState === "ALERT" || vakState === "ALERT_HOLD") {
      return { dx: 0, dy: 0 }; // Dead-center focus
    }
    return { dx: 0, dy: 0 };
  }, [vakState, currentInput]);

  // Color schemes for Optics & Core (Crimson for ALERT, Cyan for THINKING_DEEP, Gold for IDLE)
  const opticColor = useMemo(() => {
    if (vakState === "ALERT" || vakState === "ALERT_HOLD") return "#EF4444"; // Crimson Alert
    if (vakState === "ERROR") return "#F43F5E";
    if (vakState === "SUCCESS") return "#10B981";
    if (vakState === "THINKING_DEEP") return "#06B6D4"; // Cyan Optical Scanner
    if (vakState === "THINKING") return "#F59E0B";
    if (vakState === "SLEEP") return "#57534E";
    return "#C79A4E"; // VAJRA Gold
  }, [vakState]);

  // Click handler (Audio briefing & Alert Acknowledgement)
  const handleClick = async () => {
    if (vakState === "ALERT" || vakState === "ALERT_HOLD") {
      dismissAlert();
      return;
    }

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
    utterance.onstart = () => {
      setIsSpeaking(true);
      transitionTo("RESPONDING");
    };
    utterance.onend = () => {
      setIsSpeaking(false);
      transitionTo("PERCHED_IDLE");
    };
    utterance.onerror = () => {
      setIsSpeaking(false);
      transitionTo("PERCHED_IDLE");
    };
    SpeechCtor.cancel();
    SpeechCtor.speak(utterance);
  };

  // Spatial Coordinate Flight Dynamics
  const spatialStyle = useMemo<React.CSSProperties>(() => {
    if (reducedMotion) {
      return {
        transform: "translate3d(0, 0, 0)",
        opacity: vakState === "SLEEP" ? 0.6 : 1,
        transition: "opacity 0.4s ease-out",
      };
    }

    if (vakState === "NAVIGATION") {
      if (targetAnchor === "ANCHOR_GRAPH") {
        return {
          transform: "translate3d(-320px, -220px, 0) scale(1.18)",
          transition: "transform 1.2s cubic-bezier(0.2, 0.7, 0.2, 1)",
          zIndex: 50,
          filter: "drop-shadow(0 12px 28px rgba(0,0,0,0.65))",
        };
      }
      if (targetAnchor === "ANCHOR_MAP") {
        return {
          transform: "translate3d(-260px, -280px, 0) scale(1.15)",
          transition: "transform 1.2s cubic-bezier(0.2, 0.7, 0.2, 1)",
          zIndex: 50,
          filter: "drop-shadow(0 12px 28px rgba(0,0,0,0.65))",
        };
      }
      return {
        transform: "translate3d(-180px, -200px, 0) scale(1.1)",
        transition: "transform 1.2s cubic-bezier(0.2, 0.7, 0.2, 1)",
        zIndex: 50,
      };
    }

    if (vakState === "FLY_IN") {
      return {
        transform: "translate3d(50px, -80px, 0) scale(0.75)",
        opacity: 0.8,
        transition: "transform 1.0s cubic-bezier(0.2, 0.8, 0.2, 1), opacity 0.8s ease-out",
      };
    }

    return {
      transform: "translate3d(0, 0, 0) scale(1)",
      transition: "transform 0.8s cubic-bezier(0.2, 0.8, 0.2, 1), opacity 0.3s ease-out",
      zIndex: 40,
    };
  }, [vakState, targetAnchor, reducedMotion]);

  const eyesClosed = (isBlinking || vakState === "SLEEP") && !reducedMotion;
  const isAlertState = vakState === "ALERT" || vakState === "ALERT_HOLD";
  const isDeepScanning = vakState === "THINKING_DEEP";

  return (
    <div
      style={spatialStyle}
      className="relative select-none cursor-pointer"
      onClick={handleClick}
      role="button"
      aria-label={lang === "en" ? `${mascotCallSign} Tactical Sentinel Owl` : `${mascotCallSign} ರಕ್ಷಣಾ ಸಹಾಯಕ`}
      title={
        isAlertState
          ? lang === "en"
            ? "CRITICAL ALERT: Click to acknowledge"
            : "ತುರ್ತು ಎಚ್ಚರಿಕೆ: ದೃಢೀಕರಿಸಲು ಕ್ಲಿಕ್ ಮಾಡಿ"
          : quip || `${mascotCallSign} (${vakState})`
      }
    >
      {/* Visual Trigger 1: Alert Radar Beacon Pulsing Crimson (#EF4444) */}
      {isAlertState && (
        <div className="absolute -inset-3 rounded-full bg-[#EF4444]/25 border border-[#EF4444]/50 animate-ping pointer-events-none" />
      )}

      {/* Visual Trigger 2: Ambient Scanline Beam for THINKING_DEEP */}
      {isDeepScanning && (
        <div className="absolute -inset-6 pointer-events-none overflow-visible flex items-center justify-center">
          <div className="w-full h-1 bg-gradient-to-r from-transparent via-[#F59E0B] to-transparent shadow-[0_0_14px_#C79A4E] animate-pulse rounded-full" />
        </div>
      )}

      {/* 38-LAYER VECTOR PUPPET RIG (Authoritative KSP Spec) */}
      <svg
        width="56"
        height="56"
        viewBox="0 0 200 200"
        className={reducedMotion ? "" : "drop-shadow-[0_4px_10px_rgba(0,0,0,0.55)]"}
      >
        <defs>
          <filter id="orb_glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="2.5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <linearGradient id="amber_scanline_gradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#C79A4E" stopOpacity="0.05" />
            <stop offset="25%" stopColor="#F59E0B" stopOpacity="0.8" />
            <stop offset="50%" stopColor="#FFEBA8" stopOpacity="1" />
            <stop offset="75%" stopColor="#F59E0B" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#C79A4E" stopOpacity="0.05" />
          </linearGradient>
        </defs>

        <style>{`
          @keyframes orb-orbit {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
          @keyframes amber-scanline {
            0%, 100% { transform: translateY(-14px); opacity: 0.25; }
            50% { transform: translateY(14px); opacity: 1; }
          }
        `}</style>

        {/* [Z 01-05: Base & Body Rig] */}
        <g id="01_root">
          {/* 02_shadow */}
          <ellipse
            id="02_shadow"
            cx="100"
            cy="192"
            rx={vakState === "NAVIGATION" ? "20" : "44"}
            ry={vakState === "NAVIGATION" ? "3" : "7"}
            fill="#090807"
            opacity={vakState === "NAVIGATION" ? "0.2" : "0.55"}
          />
          {/* 03_tail_back */}
          <path id="03_tail_back" d="M60 148 Q35 178 52 192 L75 162 Z" fill="#242220" />
          {/* 04_body_main */}
          <ellipse
            id="04_body_main"
            cx="100"
            cy="130"
            rx="52"
            ry="58"
            fill="#2B2926"
            stroke="#161412"
            strokeWidth="3.5"
          />
          {/* 05_body_highlights */}
          <path
            id="05_body_highlights"
            d="M72 108 Q100 120 128 108"
            stroke="#3A3835"
            strokeWidth="2"
            fill="none"
            opacity="0.7"
          />
        </g>

        {/* [Z 06-13: Articulated Limbs, Wings & Perch Talons] */}
        {/* 06/07 Left Wing (Pivot at 45, 110) - Wing rig articulates aggressively in ALERT state */}
        <g
          id="06_07_left_wing"
          style={{
            transformOrigin: "45px 110px",
            transform: isAlertState
              ? "rotate(28deg) translate(-8px, -6px)"
              : vakState === "NAVIGATION"
              ? "rotate(-18deg) scaleY(1.08)"
              : "rotate(0deg)",
            transition: "transform 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
          }}
        >
          <path
            id="06_left_wing_upper"
            d="M45 110 Q12 128 26 172 Q45 162 55 128 Z"
            fill="#3A3835"
            stroke="#161412"
            strokeWidth="3"
          />
          <path
            id="07_left_wing_lower"
            d="M30 145 Q16 168 34 175"
            stroke={isAlertState ? "#EF4444" : "#C79A4E"}
            strokeWidth={isAlertState ? "2.5" : "1.5"}
            fill="none"
            opacity={isAlertState ? "1" : "0.6"}
          />
        </g>

        {/* 08/09 Right Wing (Pivot at 155, 110) - Wing rig articulates aggressively in ALERT state */}
        <g
          id="08_09_right_wing"
          style={{
            transformOrigin: "155px 110px",
            transform: isAlertState
              ? "rotate(-28deg) translate(8px, -6px)"
              : vakState === "NAVIGATION"
              ? "rotate(18deg) scaleY(1.08)"
              : "rotate(0deg)",
            transition: "transform 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
          }}
        >
          <path
            id="08_right_wing_upper"
            d="M155 110 Q188 128 174 172 Q155 162 145 128 Z"
            fill="#3A3835"
            stroke="#161412"
            strokeWidth="3"
          />
          <path
            id="09_right_wing_lower"
            d="M170 145 Q184 168 166 175"
            stroke={isAlertState ? "#EF4444" : "#C79A4E"}
            strokeWidth={isAlertState ? "2.5" : "1.5"}
            fill="none"
            opacity={isAlertState ? "1" : "0.6"}
          />
        </g>

        {/* 10-13 Legs & Articulated Talons (Binary Grip on Perch) */}
        <g id="10_13_talons">
          <path
            id="10_11_legs"
            d="M85 184 v12 M115 184 v12"
            stroke="#4A4744"
            strokeWidth="5.5"
            strokeLinecap="round"
          />
          {/* 12_left_foot & 13_right_foot: 3-claw tactical grip */}
          <path
            id="12_left_foot"
            d={vakState === "NAVIGATION" ? "M78 194 Q85 190 92 194" : "M76 198 Q85 194 94 198"}
            stroke={isAlertState ? "#EF4444" : "#C79A4E"}
            strokeWidth="3.2"
            strokeLinecap="round"
            fill="none"
          />
          <path
            id="13_right_foot"
            d={vakState === "NAVIGATION" ? "M108 194 Q115 190 122 194" : "M106 198 Q115 194 124 198"}
            stroke={isAlertState ? "#EF4444" : "#C79A4E"}
            strokeWidth="3.2"
            strokeLinecap="round"
            fill="none"
          />
        </g>

        {/* [Z 33-38: Chest Energy Core & Reactor Aperture] */}
        <g id="33_38_energy_core">
          {/* 33_chest_plate */}
          <circle id="33_chest_plate" cx="100" cy="140" r="17" fill="#161412" stroke="#3A3835" strokeWidth="2" />
          {/* 34_chest_core_outer (Vajra aperture ring) */}
          <circle
            id="34_chest_core_outer"
            cx="100"
            cy="140"
            r="12"
            fill="none"
            stroke={opticColor}
            strokeWidth="1.8"
            opacity="0.8"
          />
          {/* 35_chest_core_inner (Pulsing reactor core) */}
          <circle
            id="35_chest_core_inner"
            cx="100"
            cy="140"
            r={isDeepScanning ? "8.5" : isAlertState ? "9.5" : "6.5"}
            fill={opticColor}
            className={!reducedMotion ? "animate-[coreglow_2s_ease-in-out_infinite]" : ""}
          />
          {/* 36_gold_highlights */}
          <path
            id="36_gold_highlights"
            d="M96 136 L104 144 M104 136 L96 144"
            stroke={isAlertState ? "#FFA4A4" : "#FFEBA8"}
            strokeWidth="1.2"
            opacity="0.6"
          />
          {/* 37_chest_insignia */}
          <circle id="37_chest_insignia" cx="100" cy="140" r="3" fill="#FFFFFF" opacity="0.4" />
          {/* 38_outer_seal */}
          <circle
            id="38_outer_seal"
            cx="100"
            cy="140"
            r="19"
            fill="none"
            stroke={isAlertState ? "#EF4444" : "#3A3835"}
            strokeWidth="1"
            opacity="0.5"
          />
        </g>

        {/* Golden Task-Harvester Notification Badge */}
        {typeof taskBadgeCount === "number" && taskBadgeCount > 0 && (
          <g id="task_badge" className="animate-bounce">
            <circle cx="138" cy="104" r="11" fill="#C79A4E" stroke="#161412" strokeWidth="2" />
            <text
              x="138"
              y="108"
              textAnchor="middle"
              fontSize="11"
              fontWeight="900"
              fill="#161412"
              fontFamily="monospace"
            >
              {taskBadgeCount > 9 ? "9+" : taskBadgeCount}
            </text>
          </g>
        )}

        {/* [Z 14-27: Head, Sensor Horns, Visor & Optics Rig] */}
        <g
          id="14_27_head_rig"
          style={{
            transformOrigin: "100px 78px",
            transform:
              vakState === "USER_FOCUS"
                ? "rotate(-4deg) translateY(2px)"
                : isAlertState
                ? "rotate(0deg) scale(1.06)"
                : "rotate(0deg)",
            transition: "transform 0.3s ease-out",
          }}
        >
          {/* 15_left_ear & 16_right_ear (Sensor horns) */}
          <path id="15_left_ear" d="M72 44 L60 22 L82 36 Z" fill="#3A3835" stroke="#161412" strokeWidth="2" />
          <path id="16_right_ear" d="M128 44 L140 22 L118 36 Z" fill="#3A3835" stroke="#161412" strokeWidth="2" />

          {/* 14_head_base */}
          <circle id="14_head_base" cx="100" cy="78" r="46" fill="#34322F" stroke="#161412" strokeWidth="3" />
          {/* 17_face_plate (Ivory Visor) */}
          <ellipse id="17_face_plate" cx="100" cy="82" rx="38" ry="30" fill="#F2F0EA" />

          {/* 30_forehead_vajra_emblem (Gold KSP Crest) */}
          <path
            id="30_forehead_vajra_emblem"
            d="M100 40 L106 52 L118 55 L108 63 L111 76 L100 68 L89 76 L92 63 L82 55 L94 52 Z"
            fill={isAlertState ? "#EF4444" : "#C79A4E"}
            stroke={isAlertState ? "#991B1B" : "#A3782C"}
            strokeWidth="0.8"
          />

          {/* 31_left_cyan_light & 32_right_cyan_light (Status LEDs) */}
          <circle
            id="31_left_cyan_light"
            cx="58"
            cy="80"
            r="4.5"
            fill={isAlertState ? "#EF4444" : "#5DCAA5"}
            opacity={isDeepScanning || isAlertState ? "1" : "0.75"}
            className={isDeepScanning || isAlertState ? "animate-pulse" : ""}
          />
          <circle
            id="32_right_cyan_light"
            cx="142"
            cy="80"
            r="4.5"
            fill={isAlertState ? "#EF4444" : "#5DCAA5"}
            opacity={isDeepScanning || isAlertState ? "1" : "0.75"}
            className={isDeepScanning || isAlertState ? "animate-pulse" : ""}
          />

          {/* 18-27 Eye Sockets, Irises, Tracking Pupils & Eyelids */}
          {[{ cx: 82, name: "left" }, { cx: 118, name: "right" }].map((eye) => (
            <g key={eye.name} id={`eye_${eye.name}`}>
              {/* 18/19 Socket */}
              <ellipse cx={eye.cx} cy="82" rx="16" ry="19" fill="#0C0B0A" stroke={opticColor} strokeWidth="1.6" />
              {/* 20/21 Iris */}
              <circle cx={eye.cx} cy="82" r="13" fill="none" stroke={opticColor} strokeWidth="1.2" opacity="0.65" />

              {!eyesClosed && (
                <>
                  {/* 22/23 Pupil (Clamped coordinate focal tracking) */}
                  <circle cx={eye.cx + eyeOffset.dx} cy={82 + eyeOffset.dy} r="9.5" fill={opticColor} />
                  {/* Specular Glint */}
                  <circle cx={eye.cx + eyeOffset.dx + 2} cy={80 + eyeOffset.dy} r="3" fill="#FFFFFF" opacity="0.9" />
                  <circle cx={eye.cx + eyeOffset.dx - 2.5} cy={83 + eyeOffset.dy} r="1.5" fill="#100E0C" />
                </>
              )}

              {/* 24-27 Eyelid Shutters (Blink / Sleep) */}
              {eyesClosed && (
                <path
                  d={`M${eye.cx - 13} 82 Q${eye.cx} 89 ${eye.cx + 13} 82`}
                  stroke={opticColor}
                  strokeWidth="3.2"
                  fill="none"
                  strokeLinecap="round"
                />
              )}
            </g>
          ))}

          {/* [Z 28-29: Mandibular Beak & Articulated Speech Hinge] */}
          {/* 28_beak_upper */}
          <path id="28_beak_upper" d="M92 94 Q100 102 108 94 Z" fill="#B38538" stroke="#161412" strokeWidth="1" />
          {/* 29_beak_lower (Synchronized lip-flap with TTS) */}
          <path
            id="29_beak_lower"
            d={
              isSpeaking
                ? "M91 95 Q100 116 109 95 Q100 106 91 95Z"
                : "M91 95 Q100 103 109 95 Q100 99 91 95Z"
            }
            fill={isAlertState ? "#EF4444" : "#C79A4E"}
            stroke="#161412"
            strokeWidth="1.5"
            className={!reducedMotion ? "transition-all duration-100" : ""}
          />
        </g>

        {/* Visual Trigger 3: [Z 39: Orbiting Golden Orbs for THINKING_DEEP] */}
        {isDeepScanning && (
          <g
            id="39_orbiting_golden_orbs"
            style={{
              transformOrigin: "100px 78px",
              animation: reducedMotion ? "none" : "orb-orbit 3.2s linear infinite",
            }}
          >
            {/* Orb 1 (Top) */}
            <circle cx="100" cy="20" r="4.5" fill="#C79A4E" filter="url(#orb_glow)" />
            <circle cx="100" cy="20" r="2" fill="#FFEBA8" />
            {/* Orb 2 (Lower Right) */}
            <circle cx="152" cy="108" r="4" fill="#C79A4E" filter="url(#orb_glow)" />
            <circle cx="152" cy="108" r="1.8" fill="#FFEBA8" />
            {/* Orb 3 (Lower Left) */}
            <circle cx="48" cy="108" r="4" fill="#C79A4E" filter="url(#orb_glow)" />
            <circle cx="48" cy="108" r="1.8" fill="#FFEBA8" />
          </g>
        )}

        {/* Visual Trigger 4: [Z 40: Amber Optical Scanline for THINKING_DEEP] */}
        {isDeepScanning && (
          <g id="40_amber_optical_scanline" className="pointer-events-none">
            <line
              x1="62"
              y1="82"
              x2="138"
              y2="82"
              stroke="url(#amber_scanline_gradient)"
              strokeWidth="2.8"
              strokeLinecap="round"
              style={{
                animation: reducedMotion ? "none" : "amber-scanline 1.6s ease-in-out infinite",
              }}
            />
          </g>
        )}
      </svg>
    </div>
  );
};
