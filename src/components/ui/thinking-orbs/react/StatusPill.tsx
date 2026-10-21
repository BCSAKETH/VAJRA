"use client";
// Example composition — WRITTEN FOR THIS SKILL, based on the markup of upstream demo/components/Examples.vue.
// An orb + shimmering label in a rounded pill. "pill" = large (64px orb shown at 56px), "chip" = inline (20px orb).
// Theme tokens (override per project): --pill-fill, --pill-stroke (box-shadow), --pill-fg.
// Dark:  fill rgba(29,29,29,.42)  stroke inset 0 0 0 1px rgba(44,47,54,.31)           fg #f8f8f8
// Light: fill rgba(255,255,255,.6) stroke 0 1px 2px rgba(0,0,0,.024),0 0 0 1px rgba(0,0,0,.036)  fg #121212
// The label uses the Transitions.dev `t-shimmer` recipe (libraries/transitions-dev/recipes/15-shimmer-text.md);
// drop the className if you don't load that CSS.
import { ThinkingOrb } from "./ThinkingOrb";
import type { OrbState, OrbTheme } from "../types";

const base = "inline-flex items-center rounded-full bg-[var(--pill-fill)] shadow-[var(--pill-stroke)] text-[var(--pill-fg)] cursor-default";

export function StatusPill({
  state, label, variant = "chip", theme = "auto", speed = 1,
}: { state: OrbState; label: string; variant?: "pill" | "chip"; theme?: OrbTheme; speed?: number }) {
  const big = variant === "pill";
  return (
    <div className={big ? `${base} gap-3 w-[270px] h-[74px] pl-[9px] pr-8 text-lg leading-6` : `${base} gap-2 h-9 pl-2 pr-3.5 text-xs leading-[14px]`} role="status">
      <ThinkingOrb state={state} size={big ? 64 : 20} theme={theme} speed={speed} style={big ? { width: 56, height: 56 } : undefined} />
      <span className="t-shimmer" data-text={label}>{label}</span>
    </div>
  );
}
export default StatusPill;
