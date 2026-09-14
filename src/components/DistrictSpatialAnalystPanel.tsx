import React, { useEffect, useState } from "react";
import { MapContainer, TileLayer, CircleMarker, Popup, Circle, Polygon, useMap, useMapEvents } from "react-leaflet";
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

// Free, unmetered, watermark-free basemap providers (ESRI Canvas / Satellite / OSM)
const BASEMAP_TILES = {
  dark: {
    base: "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}",
    attribution: "Tiles &copy; Esri &mdash; Esri, DeLorme, NAVTEQ",
    maxZoom: 16,
  },
  satellite: {
    base: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    overlay: "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}",
    attribution: "Tiles &copy; Esri, i-cubed, USDA, USGS, GeoEye",
    maxZoom: 19,
  },
  osm: {
    base: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution: "&copy; OpenStreetMap contributors",
    maxZoom: 19,
  },
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
    // Invalidate map size on mount/tab change to prevent grey unrendered tiles
    const t1 = setTimeout(() => { try { map.invalidateSize(); } catch {} }, 150);
    const t2 = setTimeout(() => { try { map.invalidateSize(); } catch {} }, 400);

    if (points.length === 0) return () => { clearTimeout(t1); clearTimeout(t2); };
    if (points.length === 1) {
      map.setView([points[0].lat, points[0].lng], 13);
      return () => { clearTimeout(t1); clearTimeout(t2); };
    }
    map.fitBounds(L.latLngBounds(points.map((p) => [p.lat, p.lng] as [number, number])), { padding: [32, 32], maxZoom: 14 });
    return () => { clearTimeout(t1); clearTimeout(t2); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, points]);
  return null;
};

// F.17: Side-by-Side District/Time Comparison -- Loophole L1: two maps at
// different zoom/pan states make a visual comparison meaningless, so panning
// or zooming EITHER map (in compare mode) must move both. This lifts the
// viewport into shared state (owned by the caller, DistrictDashboardScreen)
// and keeps this one map instance in sync with it -- both panel instances
// read/write the SAME shared state, so they can never drift apart. Guarded
// against feedback loops: only calls map.setView when the incoming shared
// viewport actually differs from this map's own current view.
const ViewportSync: React.FC<{
  shared: { center: [number, number]; zoom: number };
  onChange: (v: { center: [number, number]; zoom: number }) => void;
}> = ({ shared, onChange }) => {
  const map = useMapEvents({
    moveend: () => {
      const c = map.getCenter();
      onChange({ center: [c.lat, c.lng], zoom: map.getZoom() });
    },
  });
  useEffect(() => {
    const cur = map.getCenter();
    const curZoom = map.getZoom();
    if (Math.abs(cur.lat - shared.center[0]) > 1e-5 || Math.abs(cur.lng - shared.center[1]) > 1e-5 || curZoom !== shared.zoom) {
      map.setView(shared.center, shared.zoom, { animate: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shared.center[0], shared.center[1], shared.zoom]);
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
interface DistrictSpatialAnalystPanelProps {
  district: string;
  // F.17: when provided (compare mode), this map's pan/zoom is a controlled
  // mirror of the shared viewport instead of auto-fitting its own bounds --
  // undefined/omitted means "standalone" (existing single-map behavior,
  // completely unchanged).
  sharedViewport?: { center: [number, number]; zoom: number };
  onViewportChange?: (v: { center: [number, number]; zoom: number }) => void;
}

export const DistrictSpatialAnalystPanel: React.FC<DistrictSpatialAnalystPanelProps> = ({ district, sharedViewport, onViewportChange }) => {
  const [points, setPoints] = useState<HotspotPoint[]>([]);
  const [hexbins, setHexbins] = useState<HexBin[]>([]);
  const [viewMode, setViewMode] = useState<"heat" | "hex">("heat");
  const [eps, setEps] = useState(0.02);
  const [minPts, setMinPts] = useState(2);
  const [dayOfWeek, setDayOfWeek] = useState<number | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  // F.14: Hotspot Time-Lapse -- real month-bucketed hotspot data from the
  // SAME /api/cases/spatial-hotspots fetch (query_hotspots, agent_loop.py),
  // no extra request. `null` selectedMonth means "All" (the combined view,
  // same as before this item). Defaults to the most recent real month once
  // data with more than one month arrives.
  const [hotspotsByMonth, setHotspotsByMonth] = useState<Record<string, HotspotPoint[]>>({});
  const [availableMonths, setAvailableMonths] = useState<string[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);

  // Basemap & 3D Perspective controls (Section 11 & 12)
  const [basemapMode, setBasemapMode] = useState<"dark" | "satellite" | "osm">("dark");
  const [is3DMode, setIs3DMode] = useState<boolean>(false);

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
        const months: string[] = data?.available_months || [];
        setHotspotsByMonth(data?.hotspots_by_month || {});
        setAvailableMonths(months);
        setSelectedMonth(months.length > 1 ? months[months.length - 1] : null);
      } catch (err: any) {
        if (err?.name === "AbortError") return;
        setErrorMsg(err.message || "Geospatial engine unreachable.");
      } finally {
        setIsLoading(false);
      }
    }, 300);
    return () => { clearTimeout(handle); controller.abort(); };
  }, [district, eps, minPts, dayOfWeek]);

  // F.14: when a specific month is scrubbed to, show that month's own
  // clustered points; "All" (selectedMonth === null) shows the combined view.
  const displayPoints = selectedMonth && hotspotsByMonth[selectedMonth] ? hotspotsByMonth[selectedMonth] : points;
  const monthLabel = (m: string) => {
    const [y, mo] = m.split("-");
    return new Date(Number(y), Number(mo) - 1, 1).toLocaleString("en-US", { month: "short", year: "numeric" });
  };

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
        {/* F.14: Hotspot Time-Lapse -- only shown when real data spans more
            than one month; scrubbing moves selectedMonth, which swaps the
            rendered point set client-side (all data already fetched, no
            extra request per scrub). */}
        {availableMonths.length > 1 && (
          <div className="space-y-1.5 border-t border-stone-850 pt-3">
            <label className="flex justify-between text-[10.5px] font-bold text-stone-400 font-mono">
              <span>Time-Lapse:</span>
              <span className="text-[#C79A4E]">{selectedMonth ? monthLabel(selectedMonth) : "All"}</span>
            </label>
            <input
              type="range" min={0} max={availableMonths.length - 1} step={1}
              value={selectedMonth ? availableMonths.indexOf(selectedMonth) : availableMonths.length - 1}
              onChange={(e) => setSelectedMonth(availableMonths[parseInt(e.target.value)])}
              className="w-full h-1 bg-stone-800 rounded-lg appearance-none cursor-pointer accent-[#C79A4E]"
            />
            <div className="flex justify-between text-[9px] font-mono text-stone-600">
              <span>{monthLabel(availableMonths[0])}</span>
              <span>{monthLabel(availableMonths[availableMonths.length - 1])}</span>
            </div>
            <button onClick={() => setSelectedMonth(null)} className={`w-full py-1 rounded-md text-[9.5px] font-bold font-mono uppercase transition-colors cursor-pointer ${selectedMonth === null ? "bg-[#C79A4E]/15 border border-[#C79A4E]/40 text-[#C79A4E]" : "bg-stone-900 border border-stone-800 text-stone-500 hover:text-stone-300"}`}>
              Show All Months
            </button>
          </div>
        )}
        <div className="border-t border-stone-850 pt-3 space-y-2 font-mono text-[10px] text-stone-450">
          <div className="flex justify-between"><span>Incidents:</span><span className="font-bold text-stone-200">{errorMsg ? "0" : displayPoints.reduce((s, p) => s + (p.point_count || 1), 0)}</span></div>
          <div className="flex justify-between"><span>Clusters:</span><span className="font-bold text-amber-500">{errorMsg ? "0" : displayPoints.length}</span></div>
        </div>

        {/* Basemap & 3D Mode Layer Switcher */}
        <div className="border-t border-stone-850 pt-3 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[10.5px] font-bold text-stone-400 font-mono">Basemap Layer:</span>
            <button
              onClick={() => setIs3DMode(!is3DMode)}
              className={`px-1.5 py-0.5 rounded text-[9px] font-mono border transition-all cursor-pointer ${
                is3DMode
                  ? "bg-[#C79A4E] text-stone-950 font-black border-[#C79A4E] shadow-sm shadow-[#C79A4E]/30"
                  : "bg-stone-900 text-stone-400 border-stone-800 hover:text-stone-200"
              }`}
              title="Toggle 3D Command-Center Perspective"
            >
              3D {is3DMode ? "ON" : "OFF"}
            </button>
          </div>
          <div className="grid grid-cols-3 gap-1">
            <button
              onClick={() => setBasemapMode("dark")}
              className={`py-1 rounded text-[9.5px] font-bold font-mono uppercase transition-colors cursor-pointer ${
                basemapMode === "dark"
                  ? "bg-[#C79A4E]/15 border border-[#C79A4E]/40 text-[#C79A4E]"
                  : "bg-stone-900 border border-stone-800 text-stone-500 hover:text-stone-300"
              }`}
            >
              Tactical
            </button>
            <button
              onClick={() => setBasemapMode("satellite")}
              className={`py-1 rounded text-[9.5px] font-bold font-mono uppercase transition-colors cursor-pointer ${
                basemapMode === "satellite"
                  ? "bg-[#C79A4E]/15 border border-[#C79A4E]/40 text-[#C79A4E]"
                  : "bg-stone-900 border border-stone-800 text-stone-500 hover:text-stone-300"
              }`}
            >
              Satellite
            </button>
            <button
              onClick={() => setBasemapMode("osm")}
              className={`py-1 rounded text-[9.5px] font-bold font-mono uppercase transition-colors cursor-pointer ${
                basemapMode === "osm"
                  ? "bg-[#C79A4E]/15 border border-[#C79A4E]/40 text-[#C79A4E]"
                  : "bg-stone-900 border border-stone-800 text-stone-500 hover:text-stone-300"
              }`}
            >
              OSM
            </button>
          </div>
        </div>
        <div className="border-t border-stone-850 pt-3 space-y-1.5">
          <div className="flex items-center gap-1.5 text-[9.5px] font-mono font-bold text-stone-400 uppercase tracking-wider">
            <Flame className="w-3 h-3 text-[#C79A4E]" /><span>Relative Density</span>
          </div>
          <div className="h-1.5 w-full rounded-full" style={{ background: "linear-gradient(90deg, #2f8f4e, #d9c441, #e08a2e, #d9403a)" }} />
          {/* F.17 Loophole L2: this scale is per-map relative density, not an
              absolute shared number -- a small district's moderate density
              can render at the same visual intensity as a large district's
              genuinely higher one. Stated explicitly so a side-by-side
              comparison is never misread as an absolute comparison. */}
          <p className="text-[9px] font-mono text-stone-600 leading-snug">Scale is relative to this map's own data, not an absolute cross-district value.</p>
        </div>
      </div>

      {/* Map */}
      <div
        className="flex-1 min-h-[420px] rounded-xl overflow-hidden border border-stone-850 relative transition-all duration-700 ease-out"
        style={{ perspective: is3DMode ? "900px" : "none", background: "#161412" }}
      >
        <div
          className="w-full h-full transition-transform duration-700 ease-out"
          style={{
            transform: is3DMode ? "rotateX(42deg) scale(1.06)" : "rotateX(0deg) scale(1)",
            transformOrigin: "center 75%",
            height: "100%",
          }}
        >
        {errorMsg ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-stone-950/90 z-10 text-center p-4">
            <AlertTriangle className="w-6 h-6 text-rose-500" />
            <p className="text-xs text-stone-400">{errorMsg}</p>
          </div>
        ) : isLoading ? (
          <div className="absolute inset-0 flex items-center justify-center bg-stone-950/40 text-stone-400 text-xs font-mono z-10">Loading spatial engine...</div>
        ) : displayPoints.length === 0 ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-stone-950/40 text-center p-4 z-10">
            <MapPin className="w-5 h-5 text-stone-600" />
            <p className="text-stone-400 text-xs font-mono font-bold">No hotspots match these filters.</p>
          </div>
        ) : (
          <MapContainer key={`${district}-${basemapMode}`} center={[displayPoints[0].lat, displayPoints[0].lng]} zoom={11} style={{ height: "100%", width: "100%", background: "#161412" }}>
            {/* Watermark-Free High-Performance Basemap Tiles */}
            <TileLayer
              url={BASEMAP_TILES[basemapMode].base}
              attribution={BASEMAP_TILES[basemapMode].attribution}
              maxZoom={BASEMAP_TILES[basemapMode].maxZoom}
            />
            {basemapMode === "satellite" && (
              <TileLayer
                url={BASEMAP_TILES.satellite.overlay!}
                attribution=""
                maxZoom={19}
                opacity={0.85}
              />
            )}
            {/* F.17: compare mode (sharedViewport provided) locks pan/zoom to
                the shared state instead of auto-fitting this map's own
                bounds -- auto-fit-per-side would immediately desync two
                "synchronized" maps the moment their point sets differ. */}
            {sharedViewport && onViewportChange ? (
              <ViewportSync shared={sharedViewport} onChange={onViewportChange} />
            ) : (
              <AutoFitBounds points={displayPoints} />
            )}
            {viewMode === "hex" && hexbins.length > 0 && (() => {
              const maxCount = Math.max(...hexbins.map((h) => h.count), 1);
              return hexbins.map((h) => (
                <Polygon key={h.h3_index} positions={h.boundary} pathOptions={{ fillColor: "#C79A4E", color: "#C79A4E", weight: 1, fillOpacity: 0.15 + 0.55 * (h.count / maxCount), opacity: 0.5 }}>
                  <Popup>
                    <div className="text-xs font-sans text-stone-900" style={{ transform: is3DMode ? "rotateX(-42deg)" : "none", transformOrigin: "bottom center" }}>
                      <span className="font-bold block">{h.count} incidents</span>
                    </div>
                  </Popup>
                </Polygon>
              ));
            })()}
            {viewMode === "heat" && <HeatLayer points={displayPoints} />}
            {viewMode === "heat" && displayPoints.map((point, i) => {
              const isSat = basemapMode === "satellite";
              return (
                <React.Fragment key={i}>
                  {/* 3D Volumetric Depth Ring */}
                  {is3DMode && (
                    <CircleMarker
                      center={[point.lat, point.lng]}
                      radius={14}
                      pathOptions={{
                        fillColor: isSat ? "#FFFFFF" : "#C79A4E",
                        color: isSat ? "#FFFFFF" : "#C79A4E",
                        weight: 1,
                        fillOpacity: 0.18,
                        opacity: 0.4,
                      }}
                    />
                  )}
                  <Circle center={[point.lat, point.lng]} radius={eps * 111300} pathOptions={{ fillColor: "#C79A4E", color: "rgba(199,154,78,0.3)", weight: 1, fillOpacity: 0.08 }} />
                  <CircleMarker
                    center={[point.lat, point.lng]}
                    radius={6}
                    pathOptions={{
                      fillColor: "#C79A4E",
                      color: isSat ? "#FFFFFF" : "#211F1D",
                      weight: isSat ? 2.5 : 1.5,
                      fillOpacity: 0.95,
                    }}
                  >
                    <Popup>
                      <div
                        className="text-xs font-sans text-stone-900 space-y-1 min-w-[170px] max-w-[220px]"
                        style={{
                          transform: is3DMode ? "rotateX(-42deg)" : "none",
                          transformOrigin: "bottom center",
                        }}
                      >
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
              );
            })}
          </MapContainer>
        )}
        </div>

        {/* Metadata HUD Overlay */}
        {basemapMode === "satellite" && (
          <div className="absolute bottom-2 left-2 z-[400] bg-stone-950/85 backdrop-blur-md px-2 py-0.5 rounded border border-stone-800 text-[8.5px] font-mono text-stone-400 pointer-events-none">
            🛰️ ESRI World Imagery • Sub-Meter Aerial
          </div>
        )}
      </div>
    </div>
  );
};
