import React, { useEffect, useState } from "react";
import { MapContainer, TileLayer, CircleMarker, Popup, Circle, Polygon, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet.heat";
import { MapPin, Sliders, AlertTriangle, Flame } from "lucide-react";
import { API_BASE } from "../config";

// Same real shapes SpatialScreen.tsx consumes from the shared
// /api/cases/spatial-hotspots endpoint (query_hotspots tool, agent_loop.py)
// -- this panel is the SAME engine and SAME endpoint, just pre-scoped to one
// district via that endpoint's already-real `district` query param (C.6),
// not a second implementation that could drift from the standalone screen.
interface HotspotPoint {
  lat: number;
  lng: number;
  label: string;
  weight?: number;
  point_count?: number;
  dominant_crime?: string | null;
  dominant_station?: string | null;
  // F.15: real CrimeNo list for this cluster (already-fetched data, capped
  // at 10 server-side), not a location blob with nothing to act on.
  case_preview?: string[];
  total_case_count?: number;
}

interface HexBin {
  h3_index: string;
  count: number;
  boundary: [number, number][];
}

const HEAT_GRADIENT: Record<number, string> = {
  0.0: "#2f8f4e",
  0.35: "#d9c441",
  0.65: "#e08a2e",
  1.0: "#d9403a",
};

const HeatLayer: React.FC<{ points: HotspotPoint[] }> = ({ points }) => {
  const map = useMap();
  useEffect(() => {
    if (!points.length) return;
    const maxWeight = Math.max(...points.map((p) => p.weight || 1), 1);
    const heatPoints: [number, number, number][] = points.map((p) => [p.lat, p.lng, (p.weight || 1) / maxWeight]);
    const heat = (L as any).heatLayer(heatPoints, { radius: 30, blur: 22, maxZoom: 16, minOpacity: 0.32, gradient: HEAT_GRADIENT }).addTo(map);
    return () => { map.removeLayer(heat); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, points]);
  return null;
};

const AutoFitBounds: React.FC<{ points: HotspotPoint[] }> = ({ points }) => {
  const map = useMap();
  useEffect(() => {
    if (points.length === 0) return;
    if (points.length === 1) { map.setView([points[0].lat, points[0].lng], 13); return; }
    map.fitBounds(L.latLngBounds(points.map((p) => [p.lat, p.lng] as [number, number])), { padding: [32, 32], maxZoom: 14 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, points]);
  return null;
};

const DAY_LABELS: { value: number; en: string; kn: string }[] = [
  { value: 0, en: "Mon", kn: "ಸೋಮ" }, { value: 1, en: "Tue", kn: "ಮಂಗಳ" }, { value: 2, en: "Wed", kn: "ಬುಧ" },
  { value: 3, en: "Thu", kn: "ಗುರು" }, { value: 4, en: "Fri", kn: "ಶುಕ್ರ" }, { value: 5, en: "Sat", kn: "ಶನಿ" }, { value: 6, en: "Sun", kn: "ಭಾನು" },
];

/** §Part-G-district: real DBSCAN/H3 spatial engine (identical backend call as
 * the standalone Spatial Analyst screen), scoped to ONE district's own
 * cases -- so a district commander gets the same patrol-planning tool
 * without navigating away from the district they're already looking at. */
export const DistrictSpatialAnalystPanel: React.FC<{ district: string }> = ({ district }) => {
  const [points, setPoints] = useState<HotspotPoint[]>([]);
  const [hexbins, setHexbins] = useState<HexBin[]>([]);
  const [viewMode, setViewMode] = useState<"heat" | "hex">("heat");
  const [eps, setEps] = useState(0.02);
  const [minPts, setMinPts] = useState(2);
  const [dayOfWeek, setDayOfWeek] = useState<number | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    const handle = setTimeout(async () => {
      try {
        setIsLoading(true);
        setErrorMsg(null);
        const qs = new URLSearchParams();
        qs.set("district", district);
        qs.set("eps", String(eps));
        qs.set("min_samples", String(minPts));
        if (dayOfWeek !== null) qs.set("day_of_week", String(dayOfWeek));
        const response = await fetch(`${API_BASE}/api/cases/spatial-hotspots?${qs.toString()}`, {
          headers: { "Authorization": `Bearer ${localStorage.getItem("vajra_token") || ""}` },
          signal: controller.signal,
        });
        if (!response.ok) throw new Error("Geospatial engine unreachable.");
        const data = await response.json();
        setPoints(data?.hotspots || []);
        setHexbins(data?.hexbins || []);
      } catch (err: any) {
        if (err?.name === "AbortError") return;
        setErrorMsg(err.message || "Geospatial engine unreachable.");
      } finally {
        setIsLoading(false);
      }
    }, 300);
    return () => { clearTimeout(handle); controller.abort(); };
  }, [district, eps, minPts, dayOfWeek]);

  return (
    <div className="flex flex-col lg:flex-row gap-4">
      {/* Controls rail */}
      <div className="w-full lg:w-64 shrink-0 space-y-4 glass-card p-4 border border-stone-850">
        <div className="flex rounded-lg border border-stone-800 bg-stone-900 p-0.5 gap-0.5">
          <button onClick={() => setViewMode("heat")} className={`flex-1 py-1.5 rounded-md text-[10.5px] font-bold font-mono uppercase tracking-wide transition-colors cursor-pointer ${viewMode === "heat" ? "bg-[#C79A4E]/15 text-[#C79A4E]" : "text-stone-500 hover:text-stone-300"}`}>Heat</button>
          <button onClick={() => setViewMode("hex")} className={`flex-1 py-1.5 rounded-md text-[10.5px] font-bold font-mono uppercase tracking-wide transition-colors cursor-pointer ${viewMode === "hex" ? "bg-[#C79A4E]/15 text-[#C79A4E]" : "text-stone-500 hover:text-stone-300"}`}>Hex Grid</button>
        </div>
        <div className={`space-y-3 ${viewMode === "hex" ? "opacity-40 pointer-events-none" : ""}`}>
          <div className="space-y-1">
            <label className="flex justify-between text-[10.5px] font-bold text-stone-400 font-mono">
              <span>EPS Radius:</span><span className="text-[#C79A4E]">{eps.toFixed(3)}</span>
            </label>
            <input type="range" min="0.005" max="0.05" step="0.001" value={eps} onChange={(e) => setEps(parseFloat(e.target.value))} className="w-full h-1 bg-stone-800 rounded-lg appearance-none cursor-pointer accent-[#C79A4E]" />
          </div>
          <div className="space-y-1">
            <label className="flex justify-between text-[10.5px] font-bold text-stone-400 font-mono">
              <span>Min Points:</span><span className="text-[#C79A4E]">{minPts}</span>
            </label>
            <input type="range" min="2" max="8" step="1" value={minPts} onChange={(e) => setMinPts(parseInt(e.target.value))} className="w-full h-1 bg-stone-800 rounded-lg appearance-none cursor-pointer accent-[#C79A4E]" />
          </div>
        </div>
        <div className="space-y-1.5">
          <label className="text-[10.5px] font-bold text-stone-400 font-mono">Day of Week:</label>
          <div className="grid grid-cols-4 gap-1">
            <button onClick={() => setDayOfWeek(null)} className={`px-1 py-1 rounded-md text-[9.5px] font-bold font-mono uppercase transition-colors cursor-pointer ${dayOfWeek === null ? "bg-[#C79A4E]/15 border border-[#C79A4E]/40 text-[#C79A4E]" : "bg-stone-900 border border-stone-800 text-stone-500 hover:text-stone-300"}`}>Any</button>
            {DAY_LABELS.map((d) => (
              <button key={d.value} onClick={() => setDayOfWeek(d.value)} className={`px-1 py-1 rounded-md text-[9.5px] font-bold font-mono uppercase transition-colors cursor-pointer ${dayOfWeek === d.value ? "bg-[#C79A4E]/15 border border-[#C79A4E]/40 text-[#C79A4E]" : "bg-stone-900 border border-stone-800 text-stone-500 hover:text-stone-300"}`}>{d.en}</button>
            ))}
          </div>
        </div>
        <div className="border-t border-stone-850 pt-3 space-y-2 font-mono text-[10px] text-stone-450">
          <div className="flex justify-between"><span>Incidents:</span><span className="font-bold text-stone-200">{errorMsg ? "0" : points.reduce((s, p) => s + (p.point_count || 1), 0)}</span></div>
          <div className="flex justify-between"><span>Clusters:</span><span className="font-bold text-amber-500">{errorMsg ? "0" : points.length}</span></div>
        </div>
        <div className="border-t border-stone-850 pt-3 space-y-1.5">
          <div className="flex items-center gap-1.5 text-[9.5px] font-mono font-bold text-stone-400 uppercase tracking-wider">
            <Flame className="w-3 h-3 text-[#C79A4E]" /><span>Density</span>
          </div>
          <div className="h-1.5 w-full rounded-full" style={{ background: "linear-gradient(90deg, #2f8f4e, #d9c441, #e08a2e, #d9403a)" }} />
        </div>
      </div>

      {/* Map */}
      <div className="flex-1 min-h-[420px] rounded-xl overflow-hidden border border-stone-850 relative">
        {errorMsg ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-stone-950/90 z-10 text-center p-4">
            <AlertTriangle className="w-6 h-6 text-rose-500" />
            <p className="text-xs text-stone-400">{errorMsg}</p>
          </div>
        ) : isLoading ? (
          <div className="absolute inset-0 flex items-center justify-center bg-stone-950/40 text-stone-400 text-xs font-mono z-10">Loading spatial engine...</div>
        ) : points.length === 0 ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-stone-950/40 text-center p-4 z-10">
            <MapPin className="w-5 h-5 text-stone-600" />
            <p className="text-stone-400 text-xs font-mono font-bold">No hotspots match these filters.</p>
          </div>
        ) : (
          <MapContainer center={[points[0].lat, points[0].lng]} zoom={11} style={{ height: "100%", width: "100%" }}>
            {/* Real bug found live: CartoDB's dark_all tiles now show an
                "API KEY REQUIRED" watermark over the map (Carto restricted
                free anonymous access) -- every other map in this app
                (InlineWidget.tsx, ExpandedOverlay.tsx, AppletPanel.tsx)
                already uses plain OpenStreetMap tiles with no key needed;
                matching that proven-working source here instead. */}
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            <AutoFitBounds points={points} />
            {viewMode === "hex" && hexbins.length > 0 && (() => {
              const maxCount = Math.max(...hexbins.map((h) => h.count), 1);
              return hexbins.map((h) => (
                <Polygon key={h.h3_index} positions={h.boundary} pathOptions={{ fillColor: "#C79A4E", color: "#C79A4E", weight: 1, fillOpacity: 0.15 + 0.55 * (h.count / maxCount), opacity: 0.5 }}>
                  <Popup><div className="text-xs font-sans text-stone-900"><span className="font-bold block">{h.count} incidents</span></div></Popup>
                </Polygon>
              ));
            })()}
            {viewMode === "heat" && <HeatLayer points={points} />}
            {viewMode === "heat" && points.map((point, i) => (
              <React.Fragment key={i}>
                <Circle center={[point.lat, point.lng]} radius={eps * 111300} pathOptions={{ fillColor: "#C79A4E", color: "rgba(199,154,78,0.3)", weight: 1, fillOpacity: 0.08 }} />
                <CircleMarker center={[point.lat, point.lng]} radius={6} pathOptions={{ fillColor: "#C79A4E", color: "#211F1D", weight: 1.5, fillOpacity: 0.95 }}>
                  <Popup>
                    <div className="text-xs font-sans text-stone-900 space-y-1 min-w-[170px] max-w-[220px]">
                      {point.point_count ? (
                        <>
                          <span className="font-bold block">{point.point_count} incidents</span>
                          {point.dominant_crime && <span className="block text-[11px]">Type: <strong>{point.dominant_crime}</strong></span>}
                          {point.dominant_station && <span className="block text-[11px]">Near: <strong>{point.dominant_station}</strong></span>}
                          {/* F.15: real case numbers from this cluster, not just a location blob */}
                          {point.case_preview && point.case_preview.length > 0 && (
                            <div className="mt-1.5 pt-1.5 border-t border-stone-300">
                              <span className="block text-[10px] font-bold text-stone-600 mb-0.5">Cases in this cluster:</span>
                              <ul className="space-y-0.5">
                                {point.case_preview.map((cn, ci) => (
                                  <li key={ci} className="font-mono text-[10px] text-stone-700 truncate">{cn}</li>
                                ))}
                              </ul>
                              {typeof point.total_case_count === "number" && point.total_case_count > point.case_preview.length && (
                                <span className="block text-[9.5px] text-stone-500 italic mt-0.5">
                                  +{point.total_case_count - point.case_preview.length} more in this cluster
                                </span>
                              )}
                            </div>
                          )}
                        </>
                      ) : <span className="font-bold block">{point.label}</span>}
                    </div>
                  </Popup>
                </CircleMarker>
              </React.Fragment>
            ))}
          </MapContainer>
        )}
      </div>
    </div>
  );
};
