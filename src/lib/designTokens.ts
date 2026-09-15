// H.4.2: documented color-token legend -- the single reference for every
// color already established and validated across this app, so new work
// reuses these instead of inventing a new hex value inline (the exact drift
// that produced the Supervisor Dashboard Ledger card / node-color
// inconsistencies fixed earlier this session, commits 3b7d12c/1ceca2f).
// Nothing here is a new color -- every value is pulled from where it's
// already used live (NetworkGraph.tsx's NODE_COLORS, the heat-layer
// gradient, the app's own gold accent) and validated against the dataviz
// skill's CVD-safe/OKLCH checker before this session started using them.

/** Primary brand accent -- used everywhere gold/amber appears in this app
 * (buttons, active states, borders, the VajraLogo crest). */
export const GOLD_ACCENT = "#C79A4E";
export const GOLD_ACCENT_LIGHT = "#E4C590"; // hover/active text variant

/** Network graph node palette (NetworkGraph.tsx's own NODE_COLORS) -- reuse
 * these exact values for any new node/entity-type visualization; never
 * invent a new node color, per NetworkGraph.tsx's own comment on this. */
export const NODE_COLORS = {
  suspect: "#00C6AD",
  case: "#f59e0b",
  person: "#a78bfa",
  vehicle: "#e66767",
  phone: "#38bdf8",
  financial_account: "#22d3ee",
} as const;

/** Heat/density gradient (maps, DistrictSpatialAnalystPanel.tsx) -- the
 * established low-to-high density scale used app-wide for any heat/density
 * visualization, not just the crime hotspot map. */
export const HEAT_GRADIENT = {
  low: "#2f8f4e",
  medium: "#d9c441",
  high: "#e08a2e",
  critical: "#d9403a",
} as const;

/** Projected/trend-estimate overlay (H.2.1) -- deliberately distinct from
 * HEAT_GRADIENT so a projected layer can never be visually mistaken for
 * real historical density. */
export const PROJECTED_TREND_COLOR = "#d9c441";

/** Semantic status colors. `success` is a real custom hex used pervasively
 * (verified against 13 files) for "NEW"/approved/online states -- reuse it
 * verbatim rather than picking a new green. `danger`/`warning` are NOT
 * custom hex values anywhere in this app -- every danger/warning state uses
 * Tailwind's own built-in `rose-*`/`amber-*` utility classes directly
 * (e.g. `text-rose-400`, `bg-amber-500/10`), so there is no single hex to
 * document here without inventing one; use those Tailwind classes, not a
 * new hardcoded color. */
export const SEMANTIC = {
  success: "#5DCAA5",
} as const;

/** Chart categorical palette -- verbatim copy of ExpandedOverlay.tsx's own
 * CHART_COLORS (24 colors, gold-first) for any multi-series pie/bar/funnel
 * chart elsewhere that needs the SAME sequence rather than inventing a new
 * one. If ExpandedOverlay.tsx's array ever changes, update this to match --
 * kept as a literal copy (not a shared import) so this file has zero
 * runtime dependency on a specific component file. */
export const CHART_COLORS = [
  "#C79A4E", "#00A896", "#028090", "#F59E0B", "#EF4444",
  "#8B5CF6", "#EC4899", "#3B82F6", "#10B981", "#6B7280",
  "#D97706", "#059669", "#DC2626", "#7C3AED", "#DB2777",
  "#2563EB", "#65A30D", "#9333EA", "#0891B2", "#B45309",
  "#4F46E5", "#E11D48", "#0D9488", "#A855F7",
] as const;
