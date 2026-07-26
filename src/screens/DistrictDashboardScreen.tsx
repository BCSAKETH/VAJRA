import React, { useState, useEffect, useCallback } from "react";
import { useApp } from "../AppContext";
import { API_BASE } from "../config";
import { MapContainer, TileLayer, CircleMarker, Popup } from "react-leaflet";
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
} from "recharts";
import { Map, RefreshCw, AlertTriangle, Users, ShieldAlert, Building2 } from "lucide-react";

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
}

const PIE_COLORS = ["#C79A4E", "#5DCAA5", "#9085e9", "#e66767", "#3987e5", "#F59E0B"];
const OUTCOME_COLORS: Record<string, string> = { Solved: "#5DCAA5", Unsolved: "#E24B4A", Unclassified: "#77746e" };

export const DistrictDashboardScreen: React.FC = () => {
  const { lang, addToast } = useApp();
  const [rows, setRows] = useState<DistrictSummaryRow[]>([]);
  const [isLoadingSummary, setIsLoadingSummary] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<number | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [detail, setDetail] = useState<DistrictDetail | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);

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

  return (
    <div className="h-full flex flex-col p-6 space-y-6 bg-stone-950/20 overflow-y-auto">
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center border-b border-stone-850 pb-4 shrink-0">
        <div className="space-y-1">
          <h2 className="text-base font-black text-stone-100 uppercase tracking-wider font-mono flex items-center gap-2">
            <Map className="w-5 h-5 text-[#C79A4E]" />
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
          {/* Choropleth-style clickable district grid. Karnataka districts
              have no polygon/GeoJSON boundary data anywhere in this
              project's schema (District only has DistrictID/DistrictName/
              StateID) -- a literal geographic map shape can't be built from
              real data. This grid uses the same visual encoding a
              choropleth does (color intensity = case density) with the
              same interactions (hover, click-to-drill-down), honestly
              presented as a heat grid rather than claiming a shape that
              doesn't exist in the data. */}
          <div className="relative">
            <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-6 gap-2">
              {isLoadingSummary
                ? Array.from({ length: 18 }).map((_, i) => (
                    <div key={i} className="h-16 rounded-lg shimmer-bg border border-stone-900" />
                  ))
                : rows.map((r) => {
                    const intensity = r.active_cases / maxCases;
                    const isSelected = r.district_id === selectedId;
                    return (
                      <button
                        key={r.district_id}
                        onMouseEnter={() => setHoveredId(r.district_id)}
                        onMouseLeave={() => setHoveredId(null)}
                        onClick={() => handleSelectDistrict(r.district_id)}
                        className={`h-16 rounded-lg border p-2 flex flex-col justify-between text-left transition-all cursor-pointer ${
                          isSelected ? "border-[#C79A4E] ring-1 ring-[#C79A4E]" : "border-stone-850 hover:border-stone-700"
                        }`}
                        style={{ backgroundColor: `rgba(199,154,78,${0.06 + intensity * 0.5})` }}
                      >
                        <span className="text-[9.5px] font-bold text-stone-200 truncate leading-tight">{r.district}</span>
                        <span className="text-sm font-black text-[#E4C590] font-mono">{r.active_cases}</span>
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
            <div className="space-y-4 animate-fade-in">
              {isLoadingDetail ? (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {[1, 2, 3, 4].map((n) => (
                    <div key={n} className="h-56 rounded-2xl shimmer-bg border border-stone-900" />
                  ))}
                </div>
              ) : detail ? (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {/* Socio-economic bar chart */}
                  <div className="glass-card p-4 border border-stone-850 space-y-2">
                    <h3 className="text-[11px] font-black text-stone-200 uppercase tracking-wider font-mono">
                      {detail.district} — {lang === "en" ? "Socio-Economic Profile" : "ಸಾಮಾಜಿಕ-ಆರ್ಥಿಕ ಪ್ರೊಫೈಲ್"}
                    </h3>
                    <div className="h-48">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={detail.socio_economic_chart.data} layout="vertical" margin={{ left: 20 }}>
                          <XAxis type="number" tick={{ fontSize: 9, fill: "#94A3B8" }} />
                          <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 9, fill: "#94A3B8" }} />
                          <Tooltip contentStyle={{ background: "#211f1d", border: "1px solid #37332e", fontSize: 11 }} />
                          <Bar dataKey="value" fill="#C79A4E" radius={[0, 4, 4, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                    <p className="text-[9px] text-stone-600 italic">{detail.socio_economic_chart.disclaimer}</p>
                  </div>

                  {/* Hotspot map */}
                  <div className="glass-card p-4 border border-stone-850 space-y-2">
                    <h3 className="text-[11px] font-black text-stone-200 uppercase tracking-wider font-mono">
                      {lang === "en" ? "High-Crime Hotspots (DBSCAN)" : "ಅಧಿಕ-ಅಪರಾಧ ಹಾಟ್‌ಸ್ಪಾಟ್‌ಗಳು"}
                    </h3>
                    {detail.hotspots.length === 0 ? (
                      <div className="h-48 flex items-center justify-center text-[10px] text-stone-600 font-mono">
                        {lang === "en" ? "No dense clusters detected in this district's sample." : "ಈ ಜಿಲ್ಲೆಯಲ್ಲಿ ದಟ್ಟವಾದ ಸಮೂಹಗಳು ಕಂಡುಬಂದಿಲ್ಲ."}
                      </div>
                    ) : (
                      <div className="h-48 rounded-lg overflow-hidden">
                        <MapContainer
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
                    <h3 className="text-[11px] font-black text-stone-200 uppercase tracking-wider font-mono">
                      {lang === "en" ? "Crime Types Breakdown" : "ಅಪರಾಧ ಪ್ರಕಾರಗಳ ವಿಭಜನೆ"}
                    </h3>
                    <div className="h-48 flex items-center justify-center">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={detail.crime_type_distribution} dataKey="value" nameKey="name" innerRadius={30} outerRadius={60} paddingAngle={2}>
                            {detail.crime_type_distribution.map((_, i) => (
                              <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip contentStyle={{ background: "#211f1d", border: "1px solid #37332e", fontSize: 10 }} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Solved vs unsolved pie + police presence */}
                  <div className="glass-card p-4 border border-stone-850 space-y-3">
                    <h3 className="text-[11px] font-black text-stone-200 uppercase tracking-wider font-mono flex items-center gap-1.5">
                      <ShieldAlert className="w-3.5 h-3.5 text-[#C79A4E]" />
                      {lang === "en" ? "Case Outcomes" : "ಪ್ರಕರಣದ ಫಲಿತಾಂಶಗಳು"}
                    </h3>
                    <div className="h-32 flex items-center justify-center">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={detail.case_outcomes} dataKey="value" nameKey="name" innerRadius={20} outerRadius={45} paddingAngle={2}>
                            {detail.case_outcomes.map((entry, i) => (
                              <Cell key={i} fill={OUTCOME_COLORS[entry.name] || PIE_COLORS[i]} />
                            ))}
                          </Pie>
                          <Tooltip contentStyle={{ background: "#211f1d", border: "1px solid #37332e", fontSize: 10 }} />
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
                </div>
              ) : null}
            </div>
          )}
        </>
      )}
    </div>
  );
};
