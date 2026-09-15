import React, { useEffect, useState } from "react";
import { MapContainer, TileLayer, CircleMarker, Popup, Circle, Polygon, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import { BASEMAP_TILES, BasemapMode } from "../lib/basemap";
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

// H.2.1: a weighted-recency trend estimate, not a confirmed prediction --
// same honest disclosure discipline as get_forecast's own confidence band.
interface ProjectedHexBin {
  h3_index: string;
  projected_score: number;
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

interface NearbyCase { case_no: string; crime_type: string; date: string; distance_km: number; }

// H.2.2: "what's near this point" -- click anywhere on the map (not just a
// computed hotspot cell) and see the nearest real cases with real distance,
// via the new /api/cases/near endpoint (haversine over CaseMaster, RLS-
// scoped the same as every other case-listing endpoint in this app).
const ClickToFindNearby: React.FC<{
  point: { lat: number; lng: number } | null;
  onPick: (p: { lat: number; lng: number } | null) => void;
  district: string;
}> = ({ point, onPick, district }) => {
  useMapEvents({ click: (e) => onPick({ lat: e.latlng.lat, lng: e.latlng.lng }) });
  const [cases, setCases] = useState<NearbyCase[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    if (!point) return;
    const controller = new AbortController();
    setLoading(true);
    setErr(null);
    fetch(`${API_BASE}/api/cases/near?lat=${point.lat}&lng=${point.lng}&radius_km=2&district=${encodeURIComponent(district)}`, {
      headers: { Authorization: `Bearer ${localStorage.getItem("vajra_token") || ""}` },
      signal: controller.signal,
    })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("lookup failed"))))
      .then((d) => setCases(d.cases || []))
      .catch((e) => { if (e?.name !== "AbortError") setErr("Could not look up nearby cases."); })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [point, district]);
  const markerRef = React.useRef<L.CircleMarker>(null);
  useEffect(() => {
    // Marker created via a programmatic map click (not a click ON the
    // marker itself), so Leaflet's own default "click opens popup"
    // behavior never fires -- open it explicitly once mounted.
    if (point) setTimeout(() => markerRef.current?.openPopup(), 0);
  }, [point]);
  if (!point) return null;
  return (
    <CircleMarker ref={markerRef} center={[point.lat, point.lng]} radius={5} pathOptions={{ fillColor: "#5DCAA5", color: "#0f172a", weight: 2, fillOpacity: 1 }}>
      <Popup eventHandlers={{ remove: () => onPick(null) }}>
        <div className="text-xs font-sans text-stone-900 space-y-1 min-w-[180px] max-w-[240px]">
          <span className="font-bold block">Cases within 2 km</span>
          {loading && <span className="text-stone-500">Looking up nearby cases...</span>}
          {err && <span className="text-rose-600">{err}</span>}
          {!loading && !err && cases.length === 0 && <span className="text-stone-500">No cases found within 2 km.</span>}
          {!loading && cases.length > 0 && (
            <ul className="space-y-0.5">
              {cases.map((c, i) => (
                <li key={i} className="font-mono text-[10px] text-stone-700 truncate">
                  {c.case_no} · {c.distance_km} km · {c.crime_type}
                </li>
              ))}
            </ul>
          )}
        </div>
      </Popup>
    </CircleMarker>
  );
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
  // Finals-part 3.md §25 (L225): lets a parent in Compare mode read this
  // panel's own incident/cluster counts to drive a ComparisonDeltaHUD --
  // undefined/omitted means "standalone" (no behavior change).
  onStatsChange?: (stats: { incidents: number; clusters: number }) => void;
}

export const DistrictSpatialAnalystPanel: React.FC<DistrictSpatialAnalystPanelProps> = ({ district, sharedViewport, onViewportChange, onStatsChange }) => {
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
  // H.2.1: Historical (real data, default) vs. Projected (trend estimate).
  const [mapTimeView, setMapTimeView] = useState<"historical" | "projected">("historical");
  const [projectedHexbins, setProjectedHexbins] = useState<ProjectedHexBin[]>([]);

  // Basemap & 3D Perspective controls (Section 11 & 12)
  const [basemapMode, setBasemapMode] = useState<BasemapMode>("street");
  const [is3DMode, setIs3DMode] = useState<boolean>(false);
  // H.2.2: "what's near this point" click state.
  const [nearbyClickPoint, setNearbyClickPoint] = useState<{ lat: number; lng: number } | null>(null);

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
        const fetchedPoints: HotspotPoint[] = data?.hotspots || [];
        setPoints(fetchedPoints);
        setHexbins(data?.hexbins || []);
        if (onStatsChange) {
          // Each HotspotPoint IS a cluster centroid (F.15's own comment:
          // `total_case_count`/`point_count` is how many real incidents
          // that cluster represents) -- not a flat list of individual
          // incidents, so clusters = points.length, incidents = the sum of
          // each cluster's own case count.
          const incidentTotal = fetchedPoints.reduce(
            (sum, p) => sum + (p.total_case_count ?? p.point_count ?? 0), 0
          );
          onStatsChange({ incidents: incidentTotal, clusters: fetchedPoints.length });
        }
        const months: string[] = data?.available_months || [];
        setHotspotsByMonth(data?.hotspots_by_month || {});
        setAvailableMonths(months);
        setSelectedMonth(months.length > 1 ? months[months.length - 1] : null);
        setProjectedHexbins(data?.projected_hexbins || []);
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
        {/* H.2.1: only offered when real data actually supports a trend
            estimate (2+ real months) -- never shown as a false option. */}
        {projectedHexbins.length > 0 && (
          <div className="space-y-1">
            <div className="flex rounded-lg border border-stone-800 bg-stone-900 p-0.5 gap-0.5">
              <button onClick={() => setMapTimeView("historical")} className={`flex-1 py-1.5 rounded-md text-[10.5px] font-bold font-mono uppercase tracking-wide transition-colors cursor-pointer ${mapTimeView === "historical" ? "bg-[#C79A4E]/15 text-[#C79A4E]" : "text-stone-500 hover:text-stone-300"}`}>Historical</button>
              <button onClick={() => setMapTimeView("projected")} className={`flex-1 py-1.5 rounded-md text-[10.5px] font-bold font-mono uppercase tracking-wide transition-colors cursor-pointer ${mapTimeView === "projected" ? "bg-[#C79A4E]/15 text-[#C79A4E]" : "text-stone-500 hover:text-stone-300"}`}>Projected</button>
            </div>
            {mapTimeView === "projected" && (
              <p className="text-[9px] font-mono text-amber-500/80 leading-snug flex items-start gap-1">
                <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5" />
                Projected next-period density -- a weighted-recency trend estimate from real history, not a confirmed prediction.
              </p>
            )}
          </div>
        )}
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
              onClick={() => setBasemapMode("street")}
              className={`py-1 rounded text-[9.5px] font-bold font-mono uppercase transition-colors cursor-pointer ${
                basemapMode === "street"
                  ? "bg-[#C79A4E]/15 border border-[#C79A4E]/40 text-[#C79A4E]"
                  : "bg-stone-900 border border-stone-800 text-stone-500 hover:text-stone-300"
              }`}
              title="High-Visibility Street View (OpenStreetMap)"
            >
              Street
            </button>
            <button
              onClick={() => setBasemapMode("satellite")}
              className={`py-1 rounded text-[9.5px] font-bold font-mono uppercase transition-colors cursor-pointer ${
                basemapMode === "satellite"
                  ? "bg-[#C79A4E]/15 border border-[#C79A4E]/40 text-[#C79A4E]"
                  : "bg-stone-900 border border-stone-800 text-stone-500 hover:text-stone-300"
              }`}
              title="Aerial Satellite Hybrid View with Boundaries"
            >
              Satellite
            </button>
            <button
              onClick={() => setBasemapMode("dark")}
              className={`py-1 rounded text-[9.5px] font-bold font-mono uppercase transition-colors cursor-pointer ${
                basemapMode === "dark"
                  ? "bg-[#C79A4E]/15 border border-[#C79A4E]/40 text-[#C79A4E]"
                  : "bg-stone-900 border border-stone-800 text-stone-500 hover:text-stone-300"
              }`}
              title="Tactical Dark View with Legible Reference Labels"
            >
              Tactical
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
            {BASEMAP_TILES[basemapMode].overlay && (
              <TileLayer
                url={BASEMAP_TILES[basemapMode].overlay!}
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
            {/* H.2.1: Projected view replaces the historical layers with a
                dashed-outline trend-estimate overlay -- deliberately
                visually distinct (dashed, amber) so it can never be
                mistaken for real historical density. */}
            {mapTimeView === "projected" ? (
              projectedHexbins.map((h) => (
                <Polygon
                  key={h.h3_index}
                  positions={h.boundary}
                  pathOptions={{ fillColor: "#d9c441", color: "#d9c441", weight: 1.5, dashArray: "4 3", fillOpacity: 0.12 + 0.45 * h.projected_score, opacity: 0.75 }}
                >
                  <Popup>
                    <div className="text-xs font-sans text-stone-900" style={{ transform: is3DMode ? "rotateX(-42deg)" : "none", transformOrigin: "bottom center" }}>
                      <span className="font-bold block">Projected relative density: {(h.projected_score * 100).toFixed(0)}%</span>
                      <span className="block text-[10px] text-stone-600 mt-0.5">Trend estimate, not a confirmed prediction.</span>
                    </div>
                  </Popup>
                </Polygon>
              ))
            ) : (
              <>
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
              </>
            )}
            <ClickToFindNearby point={nearbyClickPoint} onPick={setNearbyClickPoint} district={district} />
            {mapTimeView === "historical" && viewMode === "heat" && displayPoints.map((point, i) => {
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
