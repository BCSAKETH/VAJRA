import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import type { Layer } from "leaflet";
import { useApp } from "../AppContext";
import { API_BASE } from "../config";
import { MapContainer, TileLayer, CircleMarker, Popup, GeoJSON } from "react-leaflet";
import karnatakaDistrictsGeo from "../assets/karnataka-districts.json";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  Legend,
  LabelList,
} from "recharts";
import { Map as MapIcon, RefreshCw, AlertTriangle, Users, ShieldAlert, Building2, Flame, Layers, UserX, Clock } from "lucide-react";

interface DistrictSummaryRow {
  district_id: number;
  district: string;
  active_cases: number;
  most_wanted: { suspect: string; case_count: number } | null;
}

interface DistrictDetail {
  district_id: number;
  district: string;
  socio_economic_chart: { data: { name: string; value: number | null }[]; disclaimer: string };
  hotspots: { lat: number; lng: number; label: string; point_count?: number }[];
  crime_type_distribution: { name: string; value: number }[];
  case_outcomes: { name: string; value: number }[];
  police_presence: { employee_headcount: number; station_count: number };
  most_wanted: { suspect: string; case_count: number } | null;
  recent_cases: { crime_no: string; registered_date: string; brief_facts: string }[];
}

const KARNATAKA_CENTER: [number, number] = [14.85, 76.0];

// karnataka-districts.json (public-domain district boundaries, 2011 census
// administrative units -- see civictech-India/udit-001 GeoJSON datasets)
// spells 4 district names differently than this project's own District
// table does. Real district shapes can't come from this project's own data
// (District only has DistrictID/DistrictName/StateID, no polygon geometry
// anywhere in the schema), so this map is external public geographic data,
// merged against live case counts by name -- never fabricated data of our
// own. Verified against a live /api/dashboard/districts/summary pull: only
// these 4 of 30 names differ; everything else matches exactly.
const GEOJSON_TO_DB_NAME: Record<string, string> = {
  "Bagalkote": "Bagalkot",
  "Chamarajanagara": "Chamarajanagar",
  "Chikkaballapura": "Chikkaballapur",
  "Shivamogga": "Shimoga",
};

const PIE_COLORS = ["#C79A4E", "#5DCAA5", "#9085e9", "#e66767", "#3987e5", "#F59E0B", "#77a6e0", "#c98fd6"];
const OUTCOME_COLORS: Record<string, string> = { Solved: "#5DCAA5", Unsolved: "#E24B4A", Unclassified: "#77746e" };
const RANK_STYLE = [
  { ring: "ring-[#E4C590] border-[#E4C590]", chip: "bg-[#E4C590] text-stone-950" },
  { ring: "ring-stone-300 border-stone-300", chip: "bg-stone-300 text-stone-950" },
  { ring: "ring-[#C79A4E]/60 border-[#C79A4E]/60", chip: "bg-[#C79A4E]/60 text-stone-950" },
];

const StatCard: React.FC<{ icon: React.ElementType; label: string; value: React.ReactNode; sub?: React.ReactNode }> = ({
  icon: Icon,
  label,
  value,
  sub,
}) => (
  <div className="glass-card p-3.5 border border-stone-850 flex items-center gap-3">
    <div className="w-9 h-9 rounded-lg bg-[#C79A4E]/10 border border-[#C79A4E]/25 flex items-center justify-center shrink-0">
      <Icon className="w-4.5 h-4.5 text-[#C79A4E]" />
    </div>
    <div className="min-w-0">
      <div className="text-lg font-black text-stone-100 font-mono truncate leading-tight">{value}</div>
      <div className="text-[9.5px] text-stone-500 uppercase font-mono tracking-wide truncate">{label}</div>
      {sub && <div className="text-[9.5px] text-stone-600 truncate">{sub}</div>}
    </div>
  </div>
);

export const DistrictDashboardScreen: React.FC = () => {
  const { lang, addToast } = useApp();
  const [rows, setRows] = useState<DistrictSummaryRow[]>([]);
  const [isLoadingSummary, setIsLoadingSummary] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<number | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [detail, setDetail] = useState<DistrictDetail | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const drilldownRef = useRef<HTMLDivElement | null>(null);
  // The GeoJSON polygon layer's hover/select highlighting is applied
  // imperatively (layer.setStyle) inside stable Leaflet event handlers
  // bound once in onEachFeature, not re-rendered by React on every hover --
  // re-mounting all 30 district polygons on every mouse movement would be
  // real, visible jank. These refs let those stable closures read the
  // CURRENT selection/rows without needing to be recreated when it changes.
  const selectedIdRef = useRef<number | null>(null);
  useEffect(() => { selectedIdRef.current = selectedId; }, [selectedId]);
  const rowsRef = useRef<DistrictSummaryRow[]>([]);
  useEffect(() => { rowsRef.current = rows; }, [rows]);

  // Fixed architecture: every number is a live query, no caching. One
  // grouped summary fetch per load/refresh -- never per-hover. Also refetch
  // on window focus so newly-added cases (e.g. via simulate_new_cases.py)
  // show up without a manual reload.
  const fetchSummary = useCallback(async () => {
    setIsLoadingSummary(true);
    setErrorMsg(null);
    try {
      const res = await fetch(`${API_BASE}/api/dashboard/districts/summary`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("vajra_token") || ""}` },
      });
      if (!res.ok) throw new Error("Failed to load district summary.");
      const data = await res.json();
      setRows(data.districts || []);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || "District summary unreachable.");
    } finally {
      setIsLoadingSummary(false);
    }
  }, []);

  useEffect(() => {
    fetchSummary();
    const onFocus = () => fetchSummary();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [fetchSummary]);

  const handleSelectDistrict = async (districtId: number) => {
    setSelectedId(districtId);
    setIsLoadingDetail(true);
    setDetail(null);
    // Scroll to the drill-down panel right away rather than waiting on the
    // fetch -- the loading shimmer is itself the feedback that a district
    // was selected, so there's no reason to make the officer wait for data
    // before the page even moves.
    requestAnimationFrame(() => {
      drilldownRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    try {
      const res = await fetch(`${API_BASE}/api/dashboard/districts/${districtId}/detail`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("vajra_token") || ""}` },
      });
      if (!res.ok) throw new Error("Failed to load district detail.");
      setDetail(await res.json());
    } catch (err: any) {
      console.error(err);
      addToast(
        lang === "en" ? "District Detail Failed" : "ಜಿಲ್ಲಾ ವಿವರ ವಿಫಲವಾಗಿದೆ",
        lang === "en" ? "Could not load this district's chart data." : "ಈ ಜಿಲ್ಲೆಯ ಚಾರ್ಟ್ ಡೇಟಾವನ್ನು ಲೋಡ್ ಮಾಡಲು ಸಾಧ್ಯವಾಗಲಿಲ್ಲ.",
        "Critical"
      );
    } finally {
      setIsLoadingDetail(false);
    }
  };

  const maxCases = Math.max(1, ...rows.map((r) => r.active_cases));
  const hovered = rows.find((r) => r.district_id === hoveredId);

  // Rank the top 3 districts by active case load for a visible leaderboard
  // treatment on the heat grid -- purely presentational, computed from the
  // same live summary rows already fetched.
  const rankById = useMemo(() => {
    const sorted = [...rows].sort((a, b) => b.active_cases - a.active_cases).slice(0, 3);
    const map = new Map<number, number>();
    sorted.forEach((r, i) => map.set(r.district_id, i));
    return map;
  }, [rows]);

  const totalActiveCases = useMemo(() => rows.reduce((sum, r) => sum + r.active_cases, 0), [rows]);
  const flaggedSuspectCount = useMemo(() => rows.filter((r) => r.most_wanted).length, [rows]);
  const topDistrict = rows.length ? [...rows].sort((a, b) => b.active_cases - a.active_cases)[0] : null;

  const crimeTypeTotal = detail ? detail.crime_type_distribution.reduce((s, d) => s + d.value, 0) : 0;
  const caseOutcomeTotal = detail ? detail.case_outcomes.reduce((s, d) => s + d.value, 0) : 0;

  return (
    <div className="h-full flex flex-col p-6 space-y-6 bg-stone-950/20 overflow-y-auto">
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center border-b border-stone-850 pb-4 shrink-0">
        <div className="space-y-1">
          <h2 className="text-base font-black text-stone-100 uppercase tracking-wider font-mono flex items-center gap-2">
            <MapIcon className="w-5 h-5 text-[#C79A4E]" />
            <span>{lang === "en" ? "District Analytics Dashboard" : "ಜಿಲ್ಲಾ ವಿಶ್ಲೇಷಣೆ ಡ್ಯಾಶ್‌ಬೋರ್ಡ್"}</span>
          </h2>
          <p className="text-[11px] text-stone-550 leading-relaxed font-mono">
            {lang === "en"
              ? "Hover a district for live case counts. Click to drill into socio-economic, hotspot, and outcome analytics -- every figure is a live query, never cached."
              : "ಜೀವಂತ ಪ್ರಕರಣ ಎಣಿಕೆಗಾಗಿ ಜಿಲ್ಲೆಯ ಮೇಲೆ ಹೋವರ್ ಮಾಡಿ. ಸಾಮಾಜಿಕ-ಆರ್ಥಿಕ ವಿಶ್ಲೇಷಣೆಗಾಗಿ ಕ್ಲಿಕ್ ಮಾಡಿ."}
          </p>
        </div>
        <button
          onClick={fetchSummary}
          disabled={isLoadingSummary}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-stone-800 bg-stone-900/60 hover:bg-stone-800 text-xs font-semibold text-stone-400 hover:text-white transition-all disabled:opacity-50 disabled:cursor-wait cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoadingSummary ? "animate-spin" : ""}`} />
          <span>{lang === "en" ? "Refresh" : "ರಿಫ್ರೆಶ್"}</span>
        </button>
      </div>

      {errorMsg ? (
        <div className="flex flex-col items-center justify-center p-6 text-center bg-stone-950/40 rounded-2xl border border-rose-500/10 space-y-3">
          <AlertTriangle className="w-8 h-8 text-rose-500" />
          <p className="text-xs text-stone-500">{errorMsg}</p>
        </div>
      ) : (
        <>
          {/* Statewide telemetry strip -- quick-read totals derived from the
              same live rows the heat grid renders, so it never diverges. */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 shrink-0">
            <StatCard
              icon={ShieldAlert}
              value={isLoadingSummary ? "—" : totalActiveCases.toLocaleString()}
              label={lang === "en" ? "Total Active Cases" : "ಒಟ್ಟು ಸಕ್ರಿಯ ಪ್ರಕರಣಗಳು"}
            />
            <StatCard
              icon={Layers}
              value={isLoadingSummary ? "—" : rows.length}
              label={lang === "en" ? "Districts Tracked" : "ಟ್ರ್ಯಾಕ್ ಮಾಡಿದ ಜಿಲ್ಲೆಗಳು"}
            />
            <StatCard
              icon={Flame}
              value={isLoadingSummary || !topDistrict ? "—" : topDistrict.district}
              sub={topDistrict ? `${topDistrict.active_cases} ${lang === "en" ? "cases" : "ಪ್ರಕರಣಗಳು"}` : undefined}
              label={lang === "en" ? "Highest Load" : "ಅತಿ ಹೆಚ್ಚು ಹೊರೆ"}
            />
            <StatCard
              icon={Users}
              value={isLoadingSummary ? "—" : flaggedSuspectCount}
              label={lang === "en" ? "Districts w/ Most-Wanted" : "ಅತಿ ಬೇಕಾದ ಜಿಲ್ಲೆಗಳು"}
            />
          </div>

          {/* Real Karnataka district-boundary map -- actual polygon shapes
              from public 2011-census administrative boundary data (this
              project's own District table has no geometry at all, only
              DistrictID/DistrictName/StateID), merged by name against live
              case counts. Every color, count, and most-wanted label comes
              from the live summary rows below, never from the boundary
              file itself. Hover highlights a district and drives the same
              floating stat card the grid uses; click drills down. Remounts
              (via `key`) only when case-count data actually changes on
              refresh -- hover/select highlighting is applied directly to
              the Leaflet layer instead, so hovering across all 30 districts
              never re-renders the polygon layer itself. */}
          <div className="h-[420px] rounded-2xl overflow-hidden border border-stone-850 relative">
            <MapContainer center={KARNATAKA_CENTER} zoom={7} style={{ height: "100%", width: "100%" }} scrollWheelZoom={true}>
              <TileLayer
                url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                subdomains="abcd"
                attribution="&copy; OpenStreetMap &copy; CARTO"
              />
              {rows.length > 0 && (
                <GeoJSON
                  key={rows.map((r) => `${r.district_id}:${r.active_cases}`).join(",")}
                  data={karnatakaDistrictsGeo as any}
                  style={(feature: any) => {
                    const dbName = GEOJSON_TO_DB_NAME[feature.properties.district] || feature.properties.district;
                    const row = rows.find((r) => r.district === dbName);
                    const intensity = row ? row.active_cases / maxCases : 0;
                    const isSelected = !!row && row.district_id === selectedId;
                    return {
                      fillColor: isSelected ? "#E4C590" : "#C79A4E",
                      fillOpacity: row ? 0.22 + intensity * 0.55 : 0.05,
                      color: isSelected ? "#E4C590" : "#3a352e",
                      weight: isSelected ? 2.5 : 1,
                    };
                  }}
                  onEachFeature={(feature: any, layer: Layer) => {
                    const dbName = GEOJSON_TO_DB_NAME[feature.properties.district] || feature.properties.district;
                    const row = rowsRef.current.find((r) => r.district === dbName);
                    if (!row) return;
                    const anyLayer = layer as any;
                    layer.on({
                      mouseover: () => {
                        setHoveredId(row.district_id);
                        anyLayer.setStyle({ weight: 2.5, color: "#C79A4E" });
                        anyLayer.bringToFront();
                      },
                      mouseout: () => {
                        setHoveredId(null);
                        const stillSelected = selectedIdRef.current === row.district_id;
                        anyLayer.setStyle({ weight: stillSelected ? 2.5 : 1, color: stillSelected ? "#E4C590" : "#3a352e" });
                      },
                      click: () => handleSelectDistrict(row.district_id),
                    });
                  }}
                />
              )}
            </MapContainer>
            <div className="absolute bottom-2 left-2 z-[400] glass-panel border border-stone-800 rounded-lg px-2.5 py-1.5 text-[9px] font-mono text-stone-400 pointer-events-none">
              {lang === "en" ? "Fill intensity = active case load. Hover or click a district." : "ಬಣ್ಣದ ತೀವ್ರತೆ = ಸಕ್ರಿಯ ಪ್ರಕರಣ ಹೊರೆ. ಜಿಲ್ಲೆಯ ಮೇಲೆ ಹೋವರ್/ಕ್ಲಿಕ್ ಮಾಡಿ."}
            </div>
          </div>

          {/* Same district list as a compact, scannable grid below the map --
              same data, same hover/click interactions, useful for districts
              that sit close together on the map. */}
          <div className="relative">
            <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-6 gap-2.5">
              {isLoadingSummary
                ? Array.from({ length: 18 }).map((_, i) => (
                    <div key={i} className="h-20 rounded-xl shimmer-bg border border-stone-900" />
                  ))
                : rows.map((r) => {
                    const intensity = r.active_cases / maxCases;
                    const isSelected = r.district_id === selectedId;
                    const rank = rankById.get(r.district_id);
                    return (
                      <button
                        key={r.district_id}
                        onMouseEnter={() => setHoveredId(r.district_id)}
                        onMouseLeave={() => setHoveredId(null)}
                        onClick={() => handleSelectDistrict(r.district_id)}
                        className={`group relative h-20 rounded-xl border p-2.5 flex flex-col justify-between text-left overflow-hidden bg-stone-900/50 transition-all duration-200 cursor-pointer hover:-translate-y-0.5 hover:shadow-lg ${
                          isSelected
                            ? "border-[#C79A4E] ring-1 ring-[#C79A4E] shadow-[0_0_20px_rgba(199,154,78,0.18)]"
                            : "border-stone-850 hover:border-stone-700"
                        }`}
                      >
                        {/* Intensity encoded as a bottom heat bar, not a full
                            solid fill -- keeps the grid legible as cards
                            rather than a wall of flat color blocks. */}
                        <div
                          className="absolute inset-x-0 bottom-0 transition-all duration-300"
                          style={{
                            height: `${18 + intensity * 60}%`,
                            background: "linear-gradient(to top, rgba(199,154,78,0.35), rgba(199,154,78,0))",
                          }}
                        />
                        {rank !== undefined && (
                          <span
                            className={`absolute top-1.5 right-1.5 w-4 h-4 rounded-full text-[8px] font-black flex items-center justify-center font-mono ${RANK_STYLE[rank].chip}`}
                          >
                            {rank + 1}
                          </span>
                        )}
                        <span className="relative text-[9.5px] font-bold text-stone-300 group-hover:text-stone-100 truncate leading-tight pr-4">
                          {r.district}
                        </span>
                        <span className="relative text-base font-black text-[#E4C590] font-mono">{r.active_cases}</span>
                      </button>
                    );
                  })}
            </div>

            {hovered && (
              <div className="absolute top-0 right-0 z-10 glass-panel border border-[#C79A4E]/30 rounded-xl p-3 w-56 shadow-2xl pointer-events-none">
                <p className="text-xs font-bold text-stone-100">{hovered.district}</p>
                <p className="text-[10px] text-stone-400 font-mono mt-1">
                  {lang === "en" ? "Active cases" : "ಸಕ್ರಿಯ ಪ್ರಕರಣಗಳು"}: <span className="text-[#C79A4E] font-bold">{hovered.active_cases}</span>
                </p>
                <p className="text-[10px] text-stone-400 font-mono mt-0.5">
                  {lang === "en" ? "Most wanted" : "ಅತಿ ಬೇಕಾದ"}:{" "}
                  <span className="text-rose-400 font-bold">
                    {hovered.most_wanted ? `${hovered.most_wanted.suspect} (${hovered.most_wanted.case_count})` : "—"}
                  </span>
                </p>
              </div>
            )}
          </div>

          {/* Drill-down panel */}
          {selectedId && (
            <div ref={drilldownRef} className="space-y-4 animate-fade-in scroll-mt-6">
              {isLoadingDetail ? (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {[1, 2, 3, 4, 5, 6].map((n) => (
                    <div key={n} className="h-64 rounded-2xl shimmer-bg border border-stone-900" />
                  ))}
                </div>
              ) : detail ? (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {/* Socio-economic bar chart */}
                  <div className="glass-card p-4 border border-stone-850 space-y-2">
                    <h3 className="text-[11px] font-black text-stone-200 uppercase tracking-wider font-mono">
                      {detail.district} — {lang === "en" ? "Socio-Economic Profile" : "ಸಾಮಾಜಿಕ-ಆರ್ಥಿಕ ಪ್ರೊಫೈಲ್"}
                    </h3>
                    <div className="h-56">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={detail.socio_economic_chart.data} layout="vertical" margin={{ left: 20, right: 28 }}>
                          <XAxis type="number" tick={{ fontSize: 9, fill: "#94A3B8" }} />
                          <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 9, fill: "#94A3B8" }} />
                          <Tooltip
                            cursor={{ fill: "rgba(199,154,78,0.06)" }}
                            contentStyle={{ background: "#211f1d", border: "1px solid #37332e", fontSize: 11, borderRadius: 8 }}
                          />
                          <Bar dataKey="value" fill="#C79A4E" radius={[0, 4, 4, 0]}>
                            <LabelList
                              dataKey="value"
                              position="right"
                              formatter={(v: number) => (v == null ? "" : v.toFixed(1))}
                              style={{ fill: "#E4C590", fontSize: 9, fontFamily: "monospace", fontWeight: 700 }}
                            />
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                    <p className="text-[9px] text-stone-600 italic">{detail.socio_economic_chart.disclaimer}</p>
                  </div>

                  {/* Hotspot map */}
                  <div className="glass-card p-4 border border-stone-850 space-y-2">
                    <div className="flex items-center justify-between">
                      <h3 className="text-[11px] font-black text-stone-200 uppercase tracking-wider font-mono">
                        {lang === "en" ? "High-Crime Hotspots (DBSCAN)" : "ಅಧಿಕ-ಅಪರಾಧ ಹಾಟ್‌ಸ್ಪಾಟ್‌ಗಳು"}
                      </h3>
                      {detail.hotspots.length > 0 && (
                        <span className="flex items-center gap-1 text-[9px] font-mono text-stone-500">
                          <span className="w-2 h-2 rounded-full bg-[#C79A4E] border border-stone-950 shrink-0" />
                          {detail.hotspots.length} {lang === "en" ? "clusters" : "ಸಮೂಹಗಳು"}
                        </span>
                      )}
                    </div>
                    {detail.hotspots.length === 0 ? (
                      <div className="h-56 flex items-center justify-center text-[10px] text-stone-600 font-mono text-center px-4">
                        {lang === "en" ? "No dense clusters detected in this district's sample." : "ಈ ಜಿಲ್ಲೆಯಲ್ಲಿ ದಟ್ಟವಾದ ಸಮೂಹಗಳು ಕಂಡುಬಂದಿಲ್ಲ."}
                      </div>
                    ) : (
                      <div className="h-56 rounded-lg overflow-hidden">
                        <MapContainer
                          key={detail.district_id}
                          center={[detail.hotspots[0].lat, detail.hotspots[0].lng]}
                          zoom={10}
                          style={{ height: "100%", width: "100%" }}
                          scrollWheelZoom={false}
                        >
                          <TileLayer
                            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                            subdomains="abcd"
                            attribution="&copy; OpenStreetMap &copy; CARTO"
                          />
                          {detail.hotspots.map((h, i) => (
                            <CircleMarker
                              key={i}
                              center={[h.lat, h.lng]}
                              radius={7}
                              pathOptions={{ fillColor: "#C79A4E", color: "#211F1D", weight: 1.5, fillOpacity: 0.9 }}
                            >
                              <Popup>
                                <span className="text-xs text-stone-900">{h.label}</span>
                              </Popup>
                            </CircleMarker>
                          ))}
                        </MapContainer>
                      </div>
                    )}
                  </div>

                  {/* Crime types pie */}
                  <div className="glass-card p-4 border border-stone-850 space-y-2">
                    <div className="flex items-center justify-between">
                      <h3 className="text-[11px] font-black text-stone-200 uppercase tracking-wider font-mono">
                        {lang === "en" ? "Crime Types Breakdown" : "ಅಪರಾಧ ಪ್ರಕಾರಗಳ ವಿಭಜನೆ"}
                      </h3>
                      <span className="text-[9px] font-mono text-stone-500">
                        {crimeTypeTotal.toLocaleString()} {lang === "en" ? "total" : "ಒಟ್ಟು"}
                      </span>
                    </div>
                    <div className="h-56">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={detail.crime_type_distribution} dataKey="value" nameKey="name" innerRadius={38} outerRadius={68} paddingAngle={2}>
                            {detail.crime_type_distribution.map((_, i) => (
                              <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} stroke="#161412" strokeWidth={1} />
                            ))}
                          </Pie>
                          <Tooltip contentStyle={{ background: "#211f1d", border: "1px solid #37332e", fontSize: 10, borderRadius: 8 }} />
                          <Legend
                            verticalAlign="bottom"
                            iconType="circle"
                            iconSize={7}
                            wrapperStyle={{ fontSize: 9, color: "#A8A49C", paddingTop: 6 }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Solved vs unsolved pie + police presence */}
                  <div className="glass-card p-4 border border-stone-850 space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-[11px] font-black text-stone-200 uppercase tracking-wider font-mono flex items-center gap-1.5">
                        <ShieldAlert className="w-3.5 h-3.5 text-[#C79A4E]" />
                        {lang === "en" ? "Case Outcomes" : "ಪ್ರಕರಣದ ಫಲಿತಾಂಶಗಳು"}
                      </h3>
                      <span className="text-[9px] font-mono text-stone-500">
                        {caseOutcomeTotal.toLocaleString()} {lang === "en" ? "total" : "ಒಟ್ಟು"}
                      </span>
                    </div>
                    <div className="h-40">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={detail.case_outcomes} dataKey="value" nameKey="name" innerRadius={26} outerRadius={54} paddingAngle={2}>
                            {detail.case_outcomes.map((entry, i) => (
                              <Cell key={i} fill={OUTCOME_COLORS[entry.name] || PIE_COLORS[i]} stroke="#161412" strokeWidth={1} />
                            ))}
                          </Pie>
                          <Tooltip contentStyle={{ background: "#211f1d", border: "1px solid #37332e", fontSize: 10, borderRadius: 8 }} />
                          <Legend
                            verticalAlign="bottom"
                            iconType="circle"
                            iconSize={7}
                            wrapperStyle={{ fontSize: 9, color: "#A8A49C", paddingTop: 4 }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="border-t border-stone-850 pt-2.5 grid grid-cols-2 gap-2">
                      <div className="bg-stone-950/40 rounded-lg p-2 flex items-center gap-2">
                        <Users className="w-3.5 h-3.5 text-[#C79A4E] shrink-0" />
                        <div>
                          <div className="text-sm font-black text-stone-100">{detail.police_presence.employee_headcount}</div>
                          <div className="text-[8.5px] text-stone-500 uppercase font-mono">{lang === "en" ? "Officers" : "ಅಧಿಕಾರಿಗಳು"}</div>
                        </div>
                      </div>
                      <div className="bg-stone-950/40 rounded-lg p-2 flex items-center gap-2">
                        <Building2 className="w-3.5 h-3.5 text-[#C79A4E] shrink-0" />
                        <div>
                          <div className="text-sm font-black text-stone-100">{detail.police_presence.station_count}</div>
                          <div className="text-[8.5px] text-stone-500 uppercase font-mono">{lang === "en" ? "Stations" : "ಠಾಣೆಗಳು"}</div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Most-wanted */}
                  <div className="glass-card p-4 border border-stone-850 space-y-3">
                    <h3 className="text-[11px] font-black text-stone-200 uppercase tracking-wider font-mono flex items-center gap-1.5">
                      <UserX className="w-3.5 h-3.5 text-rose-450" />
                      {lang === "en" ? "Most Wanted" : "ಅತಿ ಬೇಕಾದ"}
                    </h3>
                    {detail.most_wanted ? (
                      <div className="bg-rose-500/5 border border-rose-500/15 rounded-lg p-3 flex items-center justify-between">
                        <span className="text-sm font-extrabold text-stone-100 truncate">{detail.most_wanted.suspect}</span>
                        <span className="text-[10px] font-mono font-black text-rose-400 shrink-0 ml-2">
                          {detail.most_wanted.case_count} {lang === "en" ? "cases" : "ಪ್ರಕರಣಗಳು"}
                        </span>
                      </div>
                    ) : (
                      <div className="text-[10px] text-stone-600 font-mono py-2">
                        {lang === "en" ? "No repeat suspect flagged in this district." : "ಈ ಜಿಲ್ಲೆಯಲ್ಲಿ ಯಾವುದೇ ಪುನರಾವರ್ತಿತ ಶಂಕಿತ ಗುರುತಿಸಲಾಗಿಲ್ಲ."}
                      </div>
                    )}
                  </div>

                  {/* Recent case activity */}
                  <div className="glass-card p-4 border border-stone-850 space-y-3 lg:col-span-2">
                    <h3 className="text-[11px] font-black text-stone-200 uppercase tracking-wider font-mono flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-[#C79A4E]" />
                      {lang === "en" ? "Recent Case Activity" : "ಇತ್ತೀಚಿನ ಪ್ರಕರಣ ಚಟುವಟಿಕೆ"}
                    </h3>
                    {detail.recent_cases.length === 0 ? (
                      <div className="text-[10px] text-stone-600 font-mono py-2">
                        {lang === "en" ? "No recent case records found." : "ಇತ್ತೀಚಿನ ಪ್ರಕರಣ ದಾಖಲೆಗಳು ಕಂಡುಬಂದಿಲ್ಲ."}
                      </div>
                    ) : (
                      <div className="divide-y divide-stone-850">
                        {detail.recent_cases.map((c, i) => (
                          <div key={i} className="py-2 flex items-start gap-3 font-mono">
                            <span className="text-[10px] font-black text-[#C79A4E] shrink-0 w-24 truncate">{c.crime_no}</span>
                            <span className="text-[9.5px] text-stone-500 shrink-0 w-20">{c.registered_date?.split(" ")[0]}</span>
                            <span className="text-[10.5px] text-stone-400 truncate flex-1">{c.brief_facts || "—"}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </>
      )}
    </div>
  );
};
