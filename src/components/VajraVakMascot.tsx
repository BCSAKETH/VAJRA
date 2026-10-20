import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { API_BASE } from "../config";
import { MascotState } from "../types/mascot";
import { vakBus, MascotEventPayload } from "../services/vajraVakEventBus";

interface VajraVakMascotProps {
  lang: "en" | "kn";
  currentInput?: string;
  isThinking?: boolean;
  taskBadgeCount?: number;
}

interface StateConfig {
  priority: number;
  timeoutMs?: number;
  autoNext?: MascotState;
}

const STATE_CONFIGS: Record<MascotState, StateConfig> = {
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

  // 16-State Finite State Machine with Priority Overrides
  const [vakState, setVakState] = useState<MascotState>("PERCHED_IDLE");
  const [targetAnchor, setTargetAnchor] = useState<string>("ANCHOR_PERCH");
  const [isBlinking, setIsBlinking] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [quip, setQuip] = useState<string | null>(null);
  const [alertDismissed, setAlertDismissed] = useState(false);
  const prevTaskCount = useRef<number | undefined>(taskBadgeCount);

  // Priority-aware state transition
  const transitionTo = useCallback((nextState: MascotState, force = false) => {
    setVakState((current) => {
      if (current === nextState) return current;
      const currentPri = STATE_CONFIGS[current]?.priority || 0;
      const nextPri = STATE_CONFIGS[nextState]?.priority || 0;
      // High-priority lock: ALERT / ALERT_HOLD requires force dismissal
      if (!force && nextPri < currentPri) {
        return current;
      }
      return nextState;
    });
  }, []);

  // Event Bus Wireup: All 18 events from Master Spec
  useEffect(() => {
    const subs = [
      vakBus.on("app_loaded", () => transitionTo("STARTUP", true)),
      vakBus.on("input_focused", () => transitionTo("USER_FOCUS")),
      vakBus.on("user_typing", () => transitionTo("USER_FOCUS")),
      vakBus.on("query_submitted", () => transitionTo("QUERY_SUBMITTED")),
      vakBus.on("ai_processing_started", () => transitionTo("THINKING")),
      vakBus.on("retrieval_started", () => transitionTo("THINKING_DEEP")),
      vakBus.on("file_uploaded", () => transitionTo("USER_FOCUS")),
      vakBus.on("file_analysis_started", () => transitionTo("THINKING_DEEP")),
      vakBus.on("map_analysis_started", (p?: MascotEventPayload) => {
        setTargetAnchor(p?.anchorTarget || "ANCHOR_MAP");
        transitionTo("NAVIGATION");
      }),
      vakBus.on("network_analysis_started", (p?: MascotEventPayload) => {
        setTargetAnchor(p?.anchorTarget || "ANCHOR_GRAPH");
        transitionTo("NAVIGATION");
      }),
      vakBus.on("result_ready", () => transitionTo("RESULT_READY")),
      vakBus.on("assistant_speaking", () => transitionTo("RESPONDING")),
      vakBus.on("operation_success", () => transitionTo("SUCCESS")),
      vakBus.on("operation_error", () => transitionTo("ERROR")),
      vakBus.on("critical_alert", () => {
        setAlertDismissed(false);
        transitionTo("ALERT", true);
      }),
      vakBus.on("page_changed", (p?: MascotEventPayload) => {
        setTargetAnchor(p?.anchorTarget || "ANCHOR_DOSSIER");
        transitionTo("NAVIGATION");
      }),
      vakBus.on("idle_timeout", () => transitionTo("SLEEP")),
      vakBus.on("user_returned", () => transitionTo("WAKE")),
    ];
    return () => subs.forEach((unsub) => unsub());
  }, [transitionTo]);

  // Synchronize top-level props with internal state
  useEffect(() => {
    if (isThinking && vakState !== "THINKING" && vakState !== "THINKING_DEEP" && vakState !== "ALERT") {
      transitionTo("THINKING");
    } else if (!isThinking && (vakState === "THINKING" || vakState === "THINKING_DEEP")) {
      transitionTo("PERCHED_IDLE");
    }
  }, [isThinking, vakState, transitionTo]);

  useEffect(() => {
    const hasInput = (currentInput || "").trim().length > 0;
    if (hasInput && vakState === "PERCHED_IDLE") {
      transitionTo("USER_FOCUS");
    } else if (!hasInput && vakState === "USER_FOCUS") {
      transitionTo("PERCHED_IDLE");
    }
  }, [currentInput, vakState, transitionTo]);

  // Automatic timeout transitions for ephemeral states
  useEffect(() => {
    const cfg = STATE_CONFIGS[vakState];
    if (cfg?.timeoutMs && cfg?.autoNext) {
      const timer = setTimeout(() => {
        transitionTo(cfg.autoNext!, true);
        if (cfg.autoNext === "PERCHED_IDLE") {
          setTargetAnchor("ANCHOR_PERCH");
        }
      }, cfg.timeoutMs);
      return () => clearTimeout(timer);
    }
  }, [vakState, transitionTo]);

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

  // Color schemes for Optics & Core
  const opticColor = useMemo(() => {
    if (vakState === "ALERT" || vakState === "ALERT_HOLD") return "#EF4444";
    if (vakState === "ERROR") return "#F43F5E";
    if (vakState === "SUCCESS") return "#10B981";
    if (vakState === "THINKING_DEEP") return "#06B6D4"; // Cyan Optical Scanner
    if (vakState === "THINKING") return "#F59E0B";
    if (vakState === "SLEEP") return "#57534E";
    return "#C79A4E"; // Default Amber/Gold
  }, [vakState]);

  // Click handler (Audio briefing & Alert Acknowledgement)
  const handleClick = async () => {
    if (vakState === "ALERT" || vakState === "ALERT_HOLD") {
      setAlertDismissed(true);
      transitionTo("PERCHED_IDLE", true);
      setTargetAnchor("ANCHOR_PERCH");
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
        // Physical flight across viewport to inspect Cytoscape canvas
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
      aria-label={lang === "en" ? "VAJRA-Vak Tactical Sentinel Owl" : "ವಜ್ರ-ವಾಕ್ ರಕ್ಷಣಾ ಸಹಾಯಕ"}
      title={
        isAlertState
          ? (lang === "en" ? "CRITICAL ALERT: Click to acknowledge" : "ತುರ್ತು ಎಚ್ಚರಿಕೆ: ದೃಢೀಕರಿಸಲು ಕ್ಲಿಕ್ ಮಾಡಿ")
          : quip || `VAJRA-Vak (${vakState})`
      }
    >
      {/* Laser Scanning Cone Overlay during THINKING_DEEP / OCR Scan */}
      {isDeepScanning && (
        <div className="absolute -inset-6 pointer-events-none overflow-visible">
          <div className="w-full h-1 bg-cyan-400/80 shadow-[0_0_12px_#06B6D4] animate-pulse rounded-full" />
        </div>
      )}

      {/* Alert Radar Beacon Glow */}
      {isAlertState && (
        <div className="absolute -inset-3 rounded-full bg-rose-500/20 border border-rose-500/40 animate-ping pointer-events-none" />
      )}

      {/* 38-LAYER VECTOR PUPPET RIG (Authoritative KSP Spec) */}
      <svg
        width="56"
        height="56"
        viewBox="0 0 200 200"
        className={reducedMotion ? "" : "drop-shadow-[0_4px_10px_rgba(0,0,0,0.55)]"}
      >
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
          <ellipse id="04_body_main" cx="100" cy="130" rx="52" ry="58" fill="#2B2926" stroke="#161412" strokeWidth="3.5" />
          {/* 05_body_highlights */}
          <path id="05_body_highlights" d="M72 108 Q100 120 128 108" stroke="#3A3835" strokeWidth="2" fill="none" opacity="0.7" />
        </g>

        {/* [Z 06-13: Articulated Limbs, Wings & Perch Talons] */}
        {/* 06/07 Left Wing (Pivot at 45, 110) */}
        <g
          id="06_07_left_wing"
          style={{
            transformOrigin: "45px 110px",
            transform: isAlertState
              ? "rotate(24deg) translate(-6px, -4px)"
              : vakState === "NAVIGATION"
              ? "rotate(-18deg) scaleY(1.08)"
              : "rotate(0deg)",
            transition: "transform 0.4s ease-out",
          }}
        >
          <path id="06_left_wing_upper" d="M45 110 Q12 128 26 172 Q45 162 55 128 Z" fill="#3A3835" stroke="#161412" strokeWidth="3" />
          <path id="07_left_wing_lower" d="M30 145 Q16 168 34 175" stroke="#C79A4E" strokeWidth="1.5" fill="none" opacity="0.6" />
        </g>

        {/* 08/09 Right Wing (Pivot at 155, 110) */}
        <g
          id="08_09_right_wing"
          style={{
            transformOrigin: "155px 110px",
            transform: isAlertState
              ? "rotate(-24deg) translate(6px, -4px)"
              : vakState === "NAVIGATION"
              ? "rotate(18deg) scaleY(1.08)"
              : "rotate(0deg)",
            transition: "transform 0.4s ease-out",
          }}
        >
          <path id="08_right_wing_upper" d="M155 110 Q188 128 174 172 Q155 162 145 128 Z" fill="#3A3835" stroke="#161412" strokeWidth="3" />
          <path id="09_right_wing_lower" d="M170 145 Q184 168 166 175" stroke="#C79A4E" strokeWidth="1.5" fill="none" opacity="0.6" />
        </g>

        {/* 10-13 Legs & Articulated Talons (Binary Grip on Perch) */}
        <g id="10_13_talons">
          <path id="10_11_legs" d="M85 184 v12 M115 184 v12" stroke="#4A4744" strokeWidth="5.5" strokeLinecap="round" />
          {/* 12_left_foot & 13_right_foot: 3-claw tactical grip */}
          <path
            id="12_left_foot"
            d={vakState === "NAVIGATION" ? "M78 194 Q85 190 92 194" : "M76 198 Q85 194 94 198"}
            stroke="#C79A4E"
            strokeWidth="3.2"
            strokeLinecap="round"
            fill="none"
          />
          <path
            id="13_right_foot"
            d={vakState === "NAVIGATION" ? "M108 194 Q115 190 122 194" : "M106 198 Q115 194 124 198"}
            stroke="#C79A4E"
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
          <circle id="34_chest_core_outer" cx="100" cy="140" r="12" fill="none" stroke={opticColor} strokeWidth="1.8" opacity="0.75" />
          {/* 35_chest_core_inner (Pulsing reactor core) */}
          <circle
            id="35_chest_core_inner"
            cx="100"
            cy="140"
            r={isDeepScanning ? "8.5" : isAlertState ? "9" : "6.5"}
            fill={opticColor}
            className={!reducedMotion ? "animate-[coreglow_2s_ease-in-out_infinite]" : ""}
          />
          {/* 36_gold_highlights */}
          <path id="36_gold_highlights" d="M96 136 L104 144 M104 136 L96 144" stroke="#FFEBA8" strokeWidth="1.2" opacity="0.6" />
        </g>

        {/* Golden Task-Harvester Notification Badge */}
        {typeof taskBadgeCount === "number" && taskBadgeCount > 0 && (
          <g id="task_badge" className="animate-bounce">
            <circle cx="138" cy="104" r="11" fill="#C79A4E" stroke="#161412" strokeWidth="2" />
            <text x="138" y="108" textAnchor="middle" fontSize="11" fontWeight="900" fill="#161412" fontFamily="monospace">
              {taskBadgeCount > 9 ? "9+" : taskBadgeCount}
            </text>
          </g>
        )}

        {/* [Z 14-27: Head, Sensor Horns, Visor & Optics Rig] */}
        <g
          id="14_27_head_rig"
          style={{
            transformOrigin: "100px 78px",
            transform: vakState === "USER_FOCUS"
              ? "rotate(-4deg) translateY(2px)"
              : isAlertState
              ? "rotate(0deg) scale(1.04)"
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
            fill="#C79A4E"
            stroke="#A3782C"
            strokeWidth="0.8"
          />

          {/* 31_left_cyan_light & 32_right_cyan_light (Status LEDs) */}
          <circle id="31_left_cyan_light" cx="58" cy="80" r="4.5" fill="#5DCAA5" opacity={isDeepScanning ? "1" : "0.75"} className={isDeepScanning ? "animate-pulse" : ""} />
          <circle id="32_right_cyan_light" cx="142" cy="80" r="4.5" fill="#5DCAA5" opacity={isDeepScanning ? "1" : "0.75"} className={isDeepScanning ? "animate-pulse" : ""} />

          {/* 18-27 Eye Sockets, Gold Irises, Tracking Pupils & Eyelids */}
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
            d={isSpeaking ? "M91 95 Q100 116 109 95 Q100 106 91 95Z" : "M91 95 Q100 103 109 95 Q100 99 91 95Z"}
            fill="#C79A4E"
            stroke="#161412"
            strokeWidth="1.5"
            className={!reducedMotion ? "transition-all duration-100" : ""}
          />
        </g>
      </svg>
    </div>
  );
};
