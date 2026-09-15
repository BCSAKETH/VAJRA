import React from "react";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

/**
 * Finals-part 3.md §25, Loophole L225: the one genuinely missing piece of
 * the dual-map comparison feature -- DistrictDashboardScreen's side-by-side
 * Compare mode (F.17, already built: linked-viewport sync, independent
 * district selectors, responsive grid) placed two maps next to each other
 * but left the officer to mentally subtract incident counts and cluster
 * densities. This reads the real per-panel stats each
 * DistrictSpatialAnalystPanel already reports via its own onStatsChange
 * prop -- never invented numbers.
 */
export interface ComparisonStats {
  label: string;
  incidents: number;
  clusters: number;
}

interface ComparisonDeltaHUDProps {
  primary: ComparisonStats | null;
  secondary: ComparisonStats | null;
  lang?: "en" | "kn";
}

const DeltaBadge: React.FC<{ delta: number; pct: number | null }> = ({ delta, pct }) => {
  const isFlat = delta === 0;
  const isUp = delta > 0;
  const Icon = isFlat ? Minus : isUp ? TrendingUp : TrendingDown;
  // Higher incident/cluster count on the secondary side reads as a real
  // signal worth flagging (amber/red), not automatically "bad" -- but a
  // reduction is unambiguously the good direction for these metrics, so
  // green for down/flat, amber for a moderate rise, red for a sharp one.
  const colorCls = isFlat
    ? "text-stone-400 bg-stone-800/60 border-stone-700"
    : isUp
    ? (pct !== null && pct >= 50 ? "text-rose-400 bg-rose-500/10 border-rose-500/30" : "text-amber-400 bg-amber-500/10 border-amber-500/30")
    : "text-emerald-400 bg-emerald-500/10 border-emerald-500/30";
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[10.5px] font-mono font-bold ${colorCls}`}>
      <Icon className="w-3 h-3" />
      {isFlat ? "0" : `${isUp ? "+" : ""}${delta}`}
      {pct !== null && !isFlat && <span className="opacity-70">({isUp ? "+" : ""}{pct.toFixed(0)}%)</span>}
    </span>
  );
};

export const ComparisonDeltaHUD: React.FC<ComparisonDeltaHUDProps> = ({ primary, secondary, lang = "en" }) => {
  if (!primary || !secondary) return null;

  const incidentDelta = secondary.incidents - primary.incidents;
  const incidentPct = primary.incidents > 0 ? (incidentDelta / primary.incidents) * 100 : null;
  const clusterDelta = secondary.clusters - primary.clusters;

  return (
    <div className="glass-card border border-stone-850 p-3 flex flex-wrap items-center gap-x-6 gap-y-2 text-[11px]">
      <span className="font-mono font-black text-stone-400 uppercase tracking-wide text-[10px]">
        {lang === "en" ? "Comparative Delta" : "ತುಲನಾತ್ಮಕ ವ್ಯತ್ಯಾಸ"}
      </span>
      <span className="font-mono text-stone-500 truncate max-w-[220px]" title={`${primary.label} vs ${secondary.label}`}>
        {primary.label} <span className="text-stone-700">vs</span> {secondary.label}
      </span>
      <div className="flex items-center gap-1.5">
        <span className="text-stone-500 font-mono">{lang === "en" ? "Incidents" : "ಘಟನೆಗಳು"}:</span>
        <DeltaBadge delta={incidentDelta} pct={incidentPct} />
      </div>
      <div className="flex items-center gap-1.5">
        <span className="text-stone-500 font-mono">{lang === "en" ? "Clusters" : "ಸಮೂಹಗಳು"}:</span>
        <DeltaBadge delta={clusterDelta} pct={null} />
      </div>
    </div>
  );
};
