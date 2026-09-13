import React, { useEffect, useState } from "react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, LabelList, Cell,
} from "recharts";
import { TrendingUp, TrendingDown, Minus, Sparkles } from "lucide-react";
import { API_BASE } from "../config";

interface DemographicRow {
  district: string;
  crimeCount: number;
  unemploymentRate: number;
  literacyRate: number;
}

// Real fields already computed server-side per district (DistrictSocioProfile
// joined with a live case count -- see /api/dashboard/districts/{id}/detail).
// This panel does NOT invent new numbers -- it re-presents the SAME
// socio-economic figures already fetched for this district, plus the
// SAME all-district dataset ReportsScreen.tsx already fetches, just
// re-framed around one district instead of a flat 30-bar comparison.
interface SocioChart {
  data: { name: string; value: number | null }[];
  disclaimer: string;
}

const DeltaChip: React.FC<{ value: number; unit?: string; invert?: boolean }> = ({ value, unit = "%", invert }) => {
  // invert: for a metric where LOWER is better (e.g. unemployment), a
  // negative delta vs state average should read as good (teal), not bad.
  const good = invert ? value < 0 : value > 0;
  const flat = Math.abs(value) < 1;
  const color = flat ? "#A8A096" : good ? "#5DCAA5" : "#E24B4A";
  const Icon = flat ? Minus : value > 0 ? TrendingUp : TrendingDown;
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-mono font-black" style={{ color }}>
      <Icon className="w-3 h-3" />
      {value >= 0 ? "+" : ""}{value.toFixed(1)}{unit}
    </span>
  );
};

/** §Part-G-district: real cross-district correlation, framed around ONE
 * district -- "how does this district's crime/unemployment/literacy compare
 * to the state average", not a disconnected 30-district bar chart an officer
 * has to mentally re-scope every time they change district. Reuses the same
 * /api/cases/demographics dataset ReportsScreen.tsx already fetches (fetched
 * once here, not duplicated per-district-click). */
export const DistrictDemographicPanel: React.FC<{
  district: string;
  socioChart: SocioChart;
}> = ({ district, socioChart }) => {
  const [allDistricts, setAllDistricts] = useState<DemographicRow[] | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/cases/demographics`, {
          headers: { "Authorization": `Bearer ${localStorage.getItem("vajra_token") || ""}` },
        });
        if (!res.ok) throw new Error("Demographic analytics offline.");
        const data = await res.json();
        if (!cancelled) setAllDistricts(Array.isArray(data) ? data : []);
      } catch (e: any) {
        if (!cancelled) setErrorMsg(e.message || "Demographic analytics offline.");
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const thisRow = allDistricts?.find((r) => r.district === district) || null;
  const stateAvg = allDistricts && allDistricts.length
    ? {
        crimeCount: allDistricts.reduce((s, r) => s + (r.crimeCount || 0), 0) / allDistricts.length,
        unemploymentRate: allDistricts.reduce((s, r) => s + (r.unemploymentRate || 0), 0) / allDistricts.length,
        literacyRate: allDistricts.reduce((s, r) => s + (r.literacyRate || 0), 0) / allDistricts.length,
      }
    : null;

  // Cross-district comparison chart -- every district muted, THIS one lit
  // gold, so the correlation ("is this a high-crime AND high-unemployment
  // district relative to its peers?") is visually obvious at a glance
  // instead of requiring 30 mental lookups.
  const chartData = (allDistricts || [])
    .slice()
    .sort((a, b) => b.crimeCount - a.crimeCount);

  return (
    <div className="space-y-4">
      {/* This-district-vs-state-average correlation cards -- the actual
          "correlation" insight: not just this district's raw numbers, but
          how far from typical it sits, which is what makes a socio figure
          actionable rather than trivia. */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[
          { label: "Crime Incidence", value: thisRow?.crimeCount, avg: stateAvg?.crimeCount, invert: false, unit: "" },
          { label: "Unemployment", value: thisRow?.unemploymentRate, avg: stateAvg?.unemploymentRate, invert: true, unit: "%" },
          { label: "Literacy Rate", value: thisRow?.literacyRate, avg: stateAvg?.literacyRate, invert: false, unit: "%" },
        ].map((m, i) => {
          const delta = m.value != null && m.avg ? ((m.value - m.avg) / m.avg) * 100 : null;
          return (
            <div key={i} className="glass-card p-3.5 border border-stone-850 space-y-1.5">
              <div className="text-[9.5px] font-mono uppercase tracking-widest text-stone-500">{m.label}</div>
              <div className="text-xl font-black text-stone-100 font-mono tabular-nums">
                {m.value != null ? `${m.value.toFixed(m.unit === "%" ? 1 : 0)}${m.unit}` : "—"}
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[9px] text-stone-600 font-mono">vs state avg</span>
                {delta != null ? <DeltaChip value={delta} invert={m.invert} /> : <span className="text-[9px] text-stone-600">—</span>}
              </div>
            </div>
          );
        })}
      </div>

      {/* This district's own socio-economic bar (real DistrictSocioProfile
          figures, already fetched by the parent district-detail call). */}
      <div className="glass-card p-4 border border-stone-850 space-y-2">
        <h3 className="text-[11px] font-black text-stone-200 uppercase tracking-wider font-mono flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-[#C79A4E]" />
          {district} — Socio-Economic Profile
        </h3>
        <div className="h-52">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={socioChart.data} layout="vertical" margin={{ left: 20, right: 28 }}>
              <XAxis type="number" tick={{ fontSize: 9, fill: "#94A3B8" }} />
              <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 9, fill: "#94A3B8" }} />
              <Tooltip cursor={{ fill: "rgba(199,154,78,0.06)" }} contentStyle={{ background: "#211f1d", border: "1px solid #37332e", fontSize: 11, borderRadius: 8 }} />
              <Bar dataKey="value" fill="#C79A4E" radius={[0, 4, 4, 0]}>
                <LabelList dataKey="value" position="right" formatter={(v: number) => (v == null ? "" : v.toFixed(1))} style={{ fill: "#E4C590", fontSize: 9, fontFamily: "monospace", fontWeight: 700 }} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <p className="text-[9px] text-stone-600 italic">{socioChart.disclaimer}</p>
      </div>

      {/* Cross-district correlation strip -- every OTHER district muted gray,
          this one gold, sorted by crime volume so its rank among peers is
          immediately visible (not just its isolated number). */}
      <div className="glass-card p-4 border border-stone-850 space-y-2">
        <h3 className="text-[11px] font-black text-stone-200 uppercase tracking-wider font-mono">
          Crime Incidence — {district} vs All Districts
        </h3>
        {errorMsg ? (
          <div className="h-52 flex items-center justify-center text-[10px] text-rose-400 font-mono">{errorMsg}</div>
        ) : !allDistricts ? (
          <div className="h-52 flex items-center justify-center text-[10px] text-stone-500 font-mono">Loading cross-district comparison...</div>
        ) : (
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" />
                <XAxis dataKey="district" stroke="#94A3B8" fontSize={7.5} interval={0} angle={-55} textAnchor="end" height={70} />
                <YAxis stroke="#94A3B8" fontSize={9.5} />
                <Tooltip contentStyle={{ background: "rgba(33,31,29, 0.95)", border: "1px solid #1e293b" }} />
                <Bar dataKey="crimeCount" radius={[4, 4, 0, 0]}>
                  {chartData.map((row, i) => (
                    <Cell key={i} fill={row.district === district ? "#C79A4E" : "#3a352e"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
};
