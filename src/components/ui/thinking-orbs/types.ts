/**
 * The six shipped states — each a hand-tuned animation:
 * - `working`   — particles on tilted orbits
 * - `searching` — a scan meridian sweeps a dotted globe
 * - `solving`   — bands scramble in quarter turns, then click back
 * - `listening` — a waveform rolls through latitude rings
 * - `composing` — an undulating multi-band sash
 * - `shaping`   — a dotted outline morphs circle → triangle → square
 */
export type OrbState = 'working' | 'searching' | 'solving' | 'listening' | 'composing' | 'shaping';

/**
 * Rendered size in CSS pixels. Two tuned presets ship (64 and 20),
 * but any number is safely scaled and resolved without crashing.
 */
export type OrbSize = 64 | 20 | number;

/**
 * Theme mode.
 *
 * - `auto` (default) resolves in three layers, live-updating on change:
 *   1. a `data-theme="dark|light"` attribute or `dark`/`light` class on
 *      any ancestor (the Tailwind / shadcn convention), watched via
 *      `MutationObserver`;
 *   2. otherwise `matchMedia('(prefers-color-scheme: dark)')`,
 *      subscribed for live OS/browser theme switches;
 *   3. during SSR (no DOM) the first client render resolves the theme
 *      before anything is painted — the canvas is client-only.
 * - `dark` / `light` pin the palette regardless of context.
 *
 * Dark renders light ink on the transparent canvas (for dark
 * backgrounds); light renders dark ink (for light backgrounds).
 */
export type OrbTheme = 'auto' | 'dark' | 'light';

/** Props for the ThinkingOrb Vue component. */
export interface ThinkingOrbProps {
  /** Which animation to show. @default 'working' */
  state?: OrbState;

  /** Tuned size preset — 64 or 20 CSS px. @default 64 */
  size?: OrbSize;

  /** Theme mode; `auto` detects from the host project. @default 'auto' */
  theme?: OrbTheme;

  /**
   * Animation speed multiplier on top of the preset's baked speed.
   * @default 1
   */
  speed?: number;

  /** Freeze the animation on the current frame. @default false */
  paused?: boolean;
}
