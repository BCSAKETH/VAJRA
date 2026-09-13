import React, { useState, useEffect } from "react";
import { useApp } from "../AppContext";
import { API_BASE } from "../config";
import { MapContainer, TileLayer, CircleMarker, Popup, Circle, Polygon, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet.heat";
import { WatermarkOverlay } from "../components/WatermarkOverlay";
import { MapPin, Sliders, AlertTriangle, Flame } from "lucide-react";

interface HotspotPoint {
  lat: number;
  lng: number;
  label: string;
  weight?: number;
  // C.6: already returned by cluster_hotspots (agent_loop.py) but previously
  // discarded here -- real per-cluster depth (incident count, dominant crime
  // type/station), not invented client-side.
  point_count?: number;
  dominant_crime?: string | null;
  dominant_station?: string | null;
}

// C.7: one H3 cell -- boundary is a real polygon (array of [lat, lng] pairs)
// from h3.cell_to_boundary, not an approximated circle.
interface HexBin {
  h3_index: string;
  count: number;
  boundary: [number, number][];
}

// BUILD_BACKLOG.md item #9 ("Tactical Geospatial Thermal Density 'Gas-Spray'
// Map"): a 4-tier green->yellow->orange->red density gradient over the real
// DBSCAN points, intensity-normalized against the densest point in THIS
// result set (not a fixed scale, which would make a quiet district always
// look "cold" and a busy one always look "hot" regardless of its own real
// spread). Point weight defaults to 1 when the backend doesn't supply one
// (pure spatial density then does the work); a real per-point weight, if
// ever added server-side, is honored automatically.
const HEAT_GRADIENT: Record<number, string> = {
  0.0: "#2f8f4e",   // green -- low density
  0.35: "#d9c441",  // yellow
  0.65: "#e08a2e",  // orange
  1.0: "#d9403a",   // red -- highest density in this view
};

const HeatLayer: React.FC<{ points: HotspotPoint[] }> = ({ points }) => {
  const map = useMap();
  useEffect(() => {
    if (!points.length) return;
    const maxWeight = Math.max(...points.map((p) => p.weight || 1), 1);
    const heatPoints: [number, number, number][] = points.map((p) => [
      p.lat, p.lng, (p.weight || 1) / maxWeight,
    ]);
    // `leaflet.heat` patches the global Leaflet namespace rather than
    // exporting its own module -- heatLayer only exists on `L` once the
    // side-effect import above has run.
    const heat = (L as any).heatLayer(heatPoints, {
      radius: 32,
      blur: 24,
      maxZoom: 16,
      minOpacity: 0.32,
      gradient: HEAT_GRADIENT,
    }).addTo(map);
    return () => { map.removeLayer(heat); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, points]);
  return null;
};

// Auto-fitBounds: frame the map to the REAL hotspot coordinates every time
// the result set changes, instead of a fixed generic view -- so a district
// with a tight cluster and one with a wide spread both land correctly
// framed rather than one being zoomed too far in/out.
const AutoFitBounds: React.FC<{ points: HotspotPoint[] }> = ({ points }) => {
  const map = useMap();
  useEffect(() => {
    if (points.length === 0) return;
    if (points.length === 1) {
      map.setView([points[0].lat, points[0].lng], 14);
      return;
    }
    map.fitBounds(L.latLngBounds(points.map((p) => [p.lat, p.lng] as [number, number])), {
      padding: [40, 40],
      maxZoom: 15,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, points]);
  return null;
};

// C.6: 0=Monday..6=Sunday, matching Python's datetime.weekday() -- the exact
// convention agent_loop.py's day_of_week filter already uses server-side, so
// there's no day-index translation to get wrong between frontend and backend.
const DAY_LABELS: { value: number; en: string; kn: string }[] = [
  { value: 0, en: "Mon", kn: "ಸೋಮ" },
  { value: 1, en: "Tue", kn: "ಮಂಗಳ" },
  { value: 2, en: "Wed", kn: "ಬುಧ" },
  { value: 3, en: "Thu", kn: "ಗುರು" },
  { value: 4, en: "Fri", kn: "ಶುಕ್ರ" },
  { value: 5, en: "Sat", kn: "ಶನಿ" },
  { value: 6, en: "Sun", kn: "ಭಾನು" },
];

export const SpatialScreen: React.FC = () => {
  const { addToast, lang, setIsAuthenticated } = useApp();
  const [points, setPoints] = useState<HotspotPoint[]>([]);
  // C.7: real H3 hex-density grid, alternative to the DBSCAN heat/cluster
  // view -- viewMode toggles which one renders, both come from the same
  // already-fetched response (no second request).
  const [hexbins, setHexbins] = useState<HexBin[]>([]);
  const [viewMode, setViewMode] = useState<"heat" | "hex">("heat");
  const [eps, setEps] = useState(0.015);
  const [minPts, setMinPts] = useState(3);
  // C.6: previously purely decorative -- neither slider, nor any day-of-week
  // control (which didn't exist at all), ever reached the backend. Both now
  // drive a real, debounced refetch below.
  const [dayOfWeek, setDayOfWeek] = useState<number | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Debounced real refetch on any control change -- same 300ms-after-you-
  // stop-adjusting pattern already used for Ledger Search in
  // SupervisorDashboardScreen.tsx, so a slider drag doesn't fire a DBSCAN
  // re-clustering request on every single pixel of movement. An
  // AbortController guards against an older, slower request finishing after
  // a newer one and clobbering it with stale results (same reasoning as
  // that existing Ledger Search implementation).
  useEffect(() => {
    const controller = new AbortController();
    const handle = setTimeout(async () => {
      try {
        setIsLoading(true);
        setErrorMsg(null);

        const qs = new URLSearchParams();
        qs.set("eps", String(eps));
        qs.set("min_samples", String(minPts));
        if (dayOfWeek !== null) qs.set("day_of_week", String(dayOfWeek));

        const response = await fetch(`${API_BASE}/api/cases/spatial-hotspots?${qs.toString()}`, {
          headers: {
            "Authorization": `Bearer ${localStorage.getItem("vajra_token") || ""}`,
          },
          signal: controller.signal,
        });

        if (response.status === 401) {
          addToast(
            lang === "en" ? "Session Expired" : "ಅಧಿವೇಶನ ಅವಧಿ ಮುಗಿದಿದೆ",
            lang === "en" ? "Please sign in again to establish a secure logon." : "ಸುರಕ್ಷಿತ ಲಾಗಿನ್ ಸ್ಥಾಪಿಸಲು ದಯವಿಟ್ಟು ಮತ್ತೊಮ್ಮೆ ಲಾಗ್ ಇನ್ ಮಾಡಿ.",
            "Warning"
          );
          setIsAuthenticated(false);
          return;
        }

        if (!response.ok) {
          throw new Error("Data Unavailable — Geospatial Database Offline");
        }

        // C.7: this endpoint now returns {hotspots, hexbins, trend}, not a
        // bare array (previously the hexbins/trend fields were silently
        // dropped server-side before this ever reached the frontend).
        const data = await response.json();
        const hotspots = Array.isArray(data) ? data : data?.hotspots || []; // Array.isArray: tolerate an older bare-array response during a rolling deploy
        const bins = Array.isArray(data) ? [] : data?.hexbins || [];
        if (hotspots.length === 0) {
          // A real, filtered-down-to-nothing result (e.g. no cases on the
          // selected day) is a legitimate answer, not a fetch failure --
          // distinguished from an actual error via the empty-state below,
          // not folded into errorMsg (which reads as an outage).
          setPoints([]);
          setHexbins([]);
          return;
        }

        setPoints(hotspots);
        setHexbins(bins);
      } catch (err: any) {
        if (err?.name === "AbortError") return;
        console.error(err);
        setErrorMsg(err.message || "Geospatial services unreachable.");
      } finally {
        setIsLoading(false);
      }
    }, 300);

    return () => {
      clearTimeout(handle);
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eps, minPts, dayOfWeek]);

  return (
    <div className="h-full flex flex-col md:flex-row relative overflow-hidden bg-stone-950/20">
      {/* Security Watermark Overlay */}
      <WatermarkOverlay />

      {/* Left Sidebar Controls */}
      <div className="w-full md:w-80 border-b md:border-b-0 md:border-r border-stone-850 p-6 flex flex-col gap-6 bg-stone-900/10 shrink-0 z-10">
        <div className="space-y-1.5">
          <h3 className="text-sm font-black text-stone-100 uppercase tracking-wider font-mono flex items-center gap-2">
            <Sliders className="w-4 h-4 text-[#C79A4E]" />
            <span>{lang === "en" ? "Hotspot Controls" : "ಹಾಟ್‌ಸ್ಪಾಟ್ ನಿಯಂತ್ರಣಗಳು"}</span>
          </h3>
          <p className="text-[11px] text-stone-550 leading-relaxed font-mono">
            {lang === "en"
              ? "Spatial DBSCAN and Kernel Density parameters for official patrol route allocation."
              : "ಅಧಿಕೃತ ಗಸ್ತು ಮಾರ್ಗ ಹಂಚಿಕೆಗಾಗಿ ಪ್ರಾದೇಶಿಕ DBSCAN ಮತ್ತು ಕರ್ನಲ್ ಡೆನ್ಸಿಟಿ ನಿಯತಾಂಕಗಳು."}
          </p>
        </div>

        {/* C.7: Heat/Cluster vs Hex Grid view toggle -- placed above the
            DBSCAN-specific sliders below since eps/min-points only apply to
            that view, not the hex grid, which needs no tuning to be useful. */}
        <div className="flex rounded-lg border border-stone-800 bg-stone-900 p-0.5 gap-0.5">
          <button
            onClick={() => setViewMode("heat")}
            className={`flex-1 py-1.5 rounded-md text-[11px] font-bold font-mono uppercase tracking-wide transition-colors cursor-pointer ${
              viewMode === "heat" ? "bg-[#C79A4E]/15 text-[#C79A4E]" : "text-stone-500 hover:text-stone-300"
            }`}
          >
            {lang === "en" ? "Heat / Clusters" : "ಹೀಟ್ / ಸಮೂಹ"}
          </button>
          <button
            onClick={() => setViewMode("hex")}
            className={`flex-1 py-1.5 rounded-md text-[11px] font-bold font-mono uppercase tracking-wide transition-colors cursor-pointer ${
              viewMode === "hex" ? "bg-[#C79A4E]/15 text-[#C79A4E]" : "text-stone-500 hover:text-stone-300"
            }`}
          >
            {lang === "en" ? "Hex Grid" : "ಹೆಕ್ಸ್ ಗ್ರಿಡ್"}
          </button>
        </div>

        <div className={`space-y-4 ${viewMode === "hex" ? "opacity-40 pointer-events-none" : ""}`}>
          {/* DBSCAN EPS Radius */}
          <div className="space-y-1.5">
            <label className="flex justify-between text-[11.5px] font-bold text-stone-400 font-mono">
              <span>{lang === "en" ? "EPS Radius (deg):" : "EPS ತ್ರಿಜ್ಯ (ಡಿಗ್ರಿ):"}</span>
              <span className="text-[#C79A4E] font-bold">{eps.toFixed(3)}</span>
            </label>
            <input
              type="range"
              min="0.005"
              max="0.05"
              step="0.001"
              value={eps}
              onChange={(e) => setEps(parseFloat(e.target.value))}
              className="w-full h-1 bg-stone-800 rounded-lg appearance-none cursor-pointer accent-[#C79A4E]"
              disabled={!!errorMsg}
            />
          </div>

          {/* DBSCAN Min Points */}
          <div className="space-y-1.5">
            <label className="flex justify-between text-[11.5px] font-bold text-stone-400 font-mono">
              <span>{lang === "en" ? "Min Cluster Points:" : "ಕನಿಷ್ಠ ಸಮೂಹ ಬಿಂದುಗಳು:"}</span>
              <span className="text-[#C79A4E] font-bold">{minPts}</span>
            </label>
            <input
              type="range"
              min="2"
              max="8"
              step="1"
              value={minPts}
              onChange={(e) => setMinPts(parseInt(e.target.value))}
              className="w-full h-1 bg-stone-800 rounded-lg appearance-none cursor-pointer accent-[#C79A4E]"
              disabled={!!errorMsg}
            />
          </div>

          {/* C.6: day-of-week filter -- didn't exist on this screen at all
              before. "Any day" (null) is the default so a first-time officer
              sees the same full picture as always; picking a day is opt-in. */}
          <div className="space-y-1.5">
            <label className="flex justify-between text-[11.5px] font-bold text-stone-400 font-mono">
              <span>{lang === "en" ? "Day of Week:" : "ವಾರದ ದಿನ:"}</span>
            </label>
            <div className="grid grid-cols-4 gap-1">
              <button
                onClick={() => setDayOfWeek(null)}
                disabled={!!errorMsg}
                className={`px-1.5 py-1 rounded-md text-[10px] font-bold font-mono uppercase tracking-wide transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 ${
                  dayOfWeek === null
                    ? "bg-[#C79A4E]/15 border border-[#C79A4E]/40 text-[#C79A4E]"
                    : "bg-stone-900 border border-stone-800 text-stone-500 hover:text-stone-300"
                }`}
              >
                {lang === "en" ? "Any" : "ಯಾವುದೇ"}
              </button>
              {DAY_LABELS.map((d) => (
                <button
                  key={d.value}
                  onClick={() => setDayOfWeek(d.value)}
                  disabled={!!errorMsg}
                  className={`px-1.5 py-1 rounded-md text-[10px] font-bold font-mono uppercase tracking-wide transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 ${
                    dayOfWeek === d.value
                      ? "bg-[#C79A4E]/15 border border-[#C79A4E]/40 text-[#C79A4E]"
                      : "bg-stone-900 border border-stone-800 text-stone-500 hover:text-stone-300"
                  }`}
                >
                  {lang === "en" ? d.en : d.kn}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Diagnostic Metadata -- C.6: previously fabricated "Active
            Clusters" via points.length / minPts, a meaningless further
            reduction of a number that WAS ALREADY the real cluster count
            (each entry in `points` is one DBSCAN centroid, not a raw case --
            see cluster_hotspots in agent_loop.py). Now uses the real
            point_count the backend already computes per cluster. */}
        <div className="mt-auto border-t border-stone-850 pt-4 space-y-3 font-mono text-[10px] text-stone-450 bg-stone-950/20 p-3 rounded-lg border">
          <div className="flex justify-between">
            <span>{lang === "en" ? "Incidents in Clusters:" : "ಸಮೂಹಗಳಲ್ಲಿ ಘಟನೆಗಳು:"}</span>
            <span className="font-bold text-stone-200">
              {errorMsg ? "0" : points.reduce((sum, p) => sum + (p.point_count || 1), 0)}
            </span>
          </div>
          <div className="flex justify-between">
            <span>{lang === "en" ? "Active Clusters:" : "ಸಕ್ರಿಯ ಸಮೂಹಗಳು:"}</span>
            <span className="font-bold text-amber-500">{errorMsg ? "0" : points.length}</span>
          </div>
          <div className="flex justify-between">
            <span>{lang === "en" ? "Spatial Engine:" : "ಪ್ರಾದೇಶಿಕ ಎಂಜಿನ್:"}</span>
            <span className="text-[#C79A4E] font-bold">DBSCAN 1.2</span>
          </div>
        </div>

        {/* Thermal density legend -- the 4-tier gradient the heat layer
            actually draws, so an officer can read the map instead of
            guessing what the colors mean. */}
        <div className="border-t border-stone-850 pt-4 space-y-2">
          <div className="flex items-center gap-1.5 text-[10px] font-mono font-bold text-stone-400 uppercase tracking-wider">
            <Flame className="w-3 h-3 text-[#C79A4E]" />
            <span>{lang === "en" ? "Density Spray" : "ಸಾಂದ್ರತಾ ಗ್ರೇಡಿಯಂಟ್"}</span>
          </div>
          <div className="h-2 w-full rounded-full" style={{ background: "linear-gradient(90deg, #2f8f4e, #d9c441, #e08a2e, #d9403a)" }} />
          <div className="flex justify-between text-[9px] font-mono text-stone-500">
            <span>{lang === "en" ? "Low" : "ಕಡಿಮೆ"}</span>
            <span>{lang === "en" ? "High" : "ಹೆಚ್ಚು"}</span>
          </div>
        </div>
      </div>

      {/* Main Map Content Pane */}
      <div className="flex-1 min-h-[400px] relative z-0 flex flex-col">
        {errorMsg ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center bg-stone-950/90 z-20 space-y-4">
            <div className="w-12 h-12 bg-rose-500/10 border border-rose-500/25 text-rose-500 rounded-full flex items-center justify-center">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div className="space-y-1 max-w-md">
              <h4 className="text-sm font-black text-rose-400 uppercase tracking-wider font-mono">
                {lang === "en" ? "Data Unavailable" : "ಡೇಟಾ ಲಭ್ಯವಿಲ್ಲ"}
              </h4>
              <p className="text-xs text-stone-500 leading-relaxed font-semibold">
                {errorMsg} {lang === "en" ? "Check connection to the KSP CCTNS geographical registry." : "KSP CCTNS ಭೌಗೋಳಿಕ ರಿಜಿಸ್ಟ್ರಿಗೆ ಸಂಪರ್ಕವನ್ನು ಪರಿಶೀಲಿಸಿ."}
              </p>
            </div>
          </div>
        ) : isLoading ? (
          <div className="flex-1 flex items-center justify-center bg-stone-950/40 text-stone-400 text-xs font-mono">
            {lang === "en" ? "Loading geographical spatial nodes..." : "ಭೌಗೋಳಿಕ ಪ್ರಾದೇಶಿಕ ನೋಡ್‌ಗಳನ್ನು ಲೋಡ್ ಮಾಡಲಾಗುತ್ತಿದೆ..."}
          </div>
        ) : points.length === 0 ? (
          // C.6: a real, filtered-to-zero result (e.g. no cases on the
          // selected day) is a legitimate answer, not an outage -- shown
          // distinctly from the red "Data Unavailable" error state above so
          // an officer isn't told the registry is down when it just means
          // "nothing matched this filter."
          <div className="flex-1 flex flex-col items-center justify-center gap-2 bg-stone-950/40 text-center p-6">
            <MapPin className="w-6 h-6 text-stone-600" />
            <p className="text-stone-400 text-xs font-mono font-bold">
              {lang === "en" ? "No hotspots match these filters." : "ಈ ಫಿಲ್ಟರ್‌ಗಳಿಗೆ ಯಾವುದೇ ಹಾಟ್‌ಸ್ಪಾಟ್‌ಗಳು ಹೊಂದಿಕೆಯಾಗುವುದಿಲ್ಲ."}
            </p>
            <p className="text-stone-600 text-[10.5px] font-mono">
              {lang === "en" ? "Try a wider EPS radius, a lower minimum cluster size, or a different day." : "ವಿಶಾಲವಾದ EPS ತ್ರಿಜ್ಯ, ಕಡಿಮೆ ಕನಿಷ್ಠ ಸಮೂಹ ಗಾತ್ರ, ಅಥವಾ ಬೇರೆ ದಿನವನ್ನು ಪ್ರಯತ್ನಿಸಿ."}
            </p>
          </div>
        ) : (
          <div className="flex-1 relative">
            <MapContainer
              center={points[0] ? [points[0].lat, points[0].lng] : [13.0276, 77.5124]}
              zoom={13}
              style={{ height: "100%", width: "100%" }}
            >
              <TileLayer
                url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
                subdomains="abcd"
              />
              <AutoFitBounds points={points} />
              {/* C.7: real H3 hex-density grid -- an alternative view to the
                  DBSCAN heat/cluster rendering below, over the same
                  already-fetched response, no second request. Color/opacity
                  scaled against this result set's own densest cell (same
                  normalization approach as HeatLayer above), not a fixed
                  scale that would make a quiet district always look empty. */}
              {viewMode === "hex" && hexbins.length > 0 && (() => {
                const maxCount = Math.max(...hexbins.map((h: HexBin) => h.count), 1);
                return hexbins.map((h: HexBin) => (
                  <Polygon
                    key={h.h3_index}
                    positions={h.boundary}
                    pathOptions={{
                      fillColor: "#C79A4E",
                      color: "#C79A4E",
                      weight: 1,
                      fillOpacity: 0.15 + 0.55 * (h.count / maxCount),
                      opacity: 0.5,
                    }}
                  >
                    <Popup>
                      <div className="text-xs font-sans text-stone-900">
                        <span className="font-bold block">
                          {h.count} {lang === "en" ? "incidents in this cell" : "ಈ ಕೋಶದಲ್ಲಿ ಘಟನೆಗಳು"}
                        </span>
                        <span className="block text-[10px] text-stone-500 mt-0.5">{h.h3_index}</span>
                      </div>
                    </Popup>
                  </Polygon>
                ));
              })()}
              {viewMode === "heat" && <HeatLayer points={points} />}
              {viewMode === "heat" && points.map((point: HotspotPoint, index: number) => (
                <React.Fragment key={index}>
                  <Circle
                    center={[point.lat, point.lng]}
                    radius={eps * 111300} // rough degrees to meters conversion
                    pathOptions={{
                      fillColor: "#C79A4E",
                      color: "rgba(199,154,78,0.3)",
                      weight: 1,
                      fillOpacity: 0.08,
                    }}
                  />
                  {/* Solid gold center marker -- react-leaflet's default
                      Marker needs an external icon image Vite doesn't
                      auto-resolve (renders broken/missing), and even when it
                      does load it's an unthemed blue pin. CircleMarker is a
                      self-contained SVG circle -- no asset dependency, and
                      themed to match the rest of the app. */}
                  <CircleMarker
                    center={[point.lat, point.lng]}
                    radius={6}
                    pathOptions={{
                      fillColor: "#C79A4E",
                      color: "#211F1D",
                      weight: 1.5,
                      fillOpacity: 0.95,
                    }}
                  >
                    <Popup>
                      {/* C.6: point_count/dominant_crime/dominant_station are
                          real, already-computed fields from cluster_hotspots
                          -- previously reached this component but were
                          discarded; label's baked-in text is kept as a
                          fallback for an older response shape that lacks
                          them. */}
                      <div className="text-xs font-sans text-stone-900 space-y-1 min-w-[160px]">
                        {point.point_count ? (
                          <>
                            <span className="font-bold block">
                              {point.point_count} {lang === "en" ? "incidents" : "ಘಟನೆಗಳು"}
                            </span>
                            {point.dominant_crime && (
                              <span className="block text-[11px]">
                                {lang === "en" ? "Dominant type: " : "ಪ್ರಧಾನ ಬಗೆ: "}
                                <strong>{point.dominant_crime}</strong>
                              </span>
                            )}
                            {point.dominant_station && (
                              <span className="block text-[11px]">
                                {lang === "en" ? "Near: " : "ಸಮೀಪ: "}
                                <strong>{point.dominant_station}</strong>
                              </span>
                            )}
                          </>
                        ) : (
                          <span className="font-bold block">{point.label}</span>
                        )}
                        <span className="block text-[10px] text-stone-500">
                          {point.lat.toFixed(5)}, {point.lng.toFixed(5)}
                        </span>
                      </div>
                    </Popup>
                  </CircleMarker>
                </React.Fragment>
              ))}
            </MapContainer>
          </div>
        )}
      </div>
    </div>
  );
};
