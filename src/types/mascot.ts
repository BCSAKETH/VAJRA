// Vajra-Vak ("Sentinel Owl") mascot -- Sections 145-148.
// The 16-state machine below is a direct, 1:1 port of
// scratch/vak_god_level/VAJRA_Vak_God_Level_Animation_Package/03_State_Machine/
// animation_state_machine.json -- transitions, interruption rules, and
// priorities are the real authored spec, not invented here. The 38-layer
// puppet spec (06_Puppet_Layers/PUPPET_LAYER_SPEC.md) and the master
// character sheet (scratch/vak_assets/VAJRA_Vak_Master_Character_Sheet.svg)
// describe a rig richer than what that one flat reference SVG actually
// contains (it's a single compound shape, not 38 separately-animatable
// groups) -- VajraVakMascot.tsx's own SVG is authored fresh in the same
// visual language (charcoal body, gold iris, cyan side-lights, vajra
// forehead emblem, chest core) with real separate groups for exactly the
// parts this integration actually animates (eyes, eyelids, beak, wings,
// chest core, body), not a mechanical 1:1 layer count.

export type MascotState =
  | "STARTUP"
  | "FLY_IN"
  | "PERCHED_IDLE"
  | "USER_FOCUS"
  | "QUERY_SUBMITTED"
  | "THINKING"
  | "THINKING_DEEP"
  | "RESULT_READY"
  | "RESPONDING"
  | "ALERT"
  | "ALERT_HOLD"
  | "SUCCESS"
  | "ERROR"
  | "NAVIGATION"
  | "SLEEP"
  | "WAKE";

export interface MascotStateDef {
  clip: string;
  next?: MascotState;
  interruptibleBy?: MascotState[];
  priority?: number;
}

// Ported verbatim from animation_state_machine.json's `states` map (STARTUP
// has no `clip` there either -- it only runs enter actions before falling
// through to FLY_IN).
export const MASCOT_STATE_MACHINE: Record<MascotState, MascotStateDef> = {
  STARTUP: { clip: "core_wake", next: "FLY_IN" },
  FLY_IN: { clip: "fly_in", next: "PERCHED_IDLE" },
  PERCHED_IDLE: {
    clip: "idle_perched",
    interruptibleBy: ["USER_FOCUS", "QUERY_SUBMITTED", "ALERT", "SUCCESS", "ERROR", "SLEEP", "NAVIGATION"],
  },
  USER_FOCUS: { clip: "listening", next: "PERCHED_IDLE" },
  QUERY_SUBMITTED: { clip: "acknowledge_then_takeoff", next: "THINKING" },
  THINKING: { clip: "thinking_scan", interruptibleBy: ["ALERT", "ERROR", "RESULT_READY"] },
  THINKING_DEEP: { clip: "hover_scan_or_surface_crawl", next: "RESULT_READY" },
  RESULT_READY: { clip: "return_land_success", next: "RESPONDING" },
  RESPONDING: { clip: "speaking", next: "PERCHED_IDLE" },
  ALERT: { clip: "alert", priority: 100, next: "ALERT_HOLD" },
  ALERT_HOLD: { clip: "alert_hold", priority: 100, next: "PERCHED_IDLE" },
  SUCCESS: { clip: "success", priority: 60, next: "PERCHED_IDLE" },
  ERROR: { clip: "error_supportive", priority: 70, next: "PERCHED_IDLE" },
  NAVIGATION: { clip: "fly_between_views", next: "PERCHED_IDLE" },
  SLEEP: { clip: "sleep", next: "WAKE" },
  WAKE: { clip: "wake_up", next: "PERCHED_IDLE" },
};

// The real event->state map from the same JSON's `events` block -- used
// verbatim by the caller (see useMascotStateMachine below) to know which
// state to enter for a given real app event.
export const MASCOT_EVENT_STATE: Record<string, MascotState> = {
  app_loaded: "STARTUP",
  chat_opened: "USER_FOCUS",
  input_focused: "USER_FOCUS",
  query_submitted: "QUERY_SUBMITTED",
  deep_analysis_started: "THINKING_DEEP",
  result_ready: "RESULT_READY",
  assistant_speaking: "RESPONDING",
  critical_alert: "ALERT",
  operation_success: "SUCCESS",
  operation_error: "ERROR",
  page_changed: "NAVIGATION",
  idle_timeout: "SLEEP",
  user_returned: "WAKE",
};

// Can `nextState` interrupt whatever is currently playing? Mirrors the
// JSON's own `priorityRules` in code: a state with no listed
// interruptibleBy set (e.g. ALERT_HOLD, SUCCESS, ERROR, transitional
// states) can still always be entered by an explicit event -- the guard
// only exists to stop a LOWER-priority event from cutting off
// PERCHED_IDLE/THINKING outside their declared interrupt list.
export function canInterrupt(current: MascotState, next: MascotState): boolean {
  if (current === next) return false;
  const currentDef = MASCOT_STATE_MACHINE[current];
  // ALERT/ALERT_HOLD (priority 100) are never pre-empted by anything except
  // another ALERT -- "USER_FOCUS never interrupts ALERT".
  if ((current === "ALERT" || current === "ALERT_HOLD") && next !== "ALERT") return false;
  if (!currentDef.interruptibleBy) return true; // transitional states always yield to their own `next`
  return currentDef.interruptibleBy.includes(next);
}
