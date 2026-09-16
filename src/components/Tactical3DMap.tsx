import React, { useEffect, useRef, useState, useCallback } from "react";
import { Map as MapLibreMap, Marker, LngLatBounds, setWorkerUrl } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { Plus, Minus, Compass, Maximize2 } from "lucide-react";
// CONFIRMED LIVE BUG (2026-09-16): MapLibre GL JS v6 is ESM-only and
// locates its tile-processing worker via `new URL("./maplibre-gl-worker.mjs",
// import.meta.url)` at runtime. Vite rewrites import.meta.url to this
// component's own hashed production chunk and never emits a separate
// maplibre-gl-worker.mjs file next to it, so that request 404s (silently
// falls through to the SPA's index.html) and the map never finishes
// loading -- exactly the "map is not loading" symptom reported live.
// Routing the worker through Vite's own `?worker&url` import makes Vite
// emit it as its own real, fetchable chunk and gives MapLibre the correct
// URL via setWorkerUrl() before any Map is constructed.
import maplibreWorkerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";
setWorkerUrl(maplibreWorkerUrl);

/**
 * Finals-part 3.md §21-22: Tactical 3D Vector Geospatial Intelligence map.
 * Real WebGL 3D building extrusion via OpenFreeMap (zero-cost, ODbL,
 * zero API key) + MapLibre GL JS -- the one genuinely new technical
 * capability across the whole 19-section document (nothing in this
 * codebase used a WebGL vector map before).
 *
 * Deliberately does NOT reproduce the source doc's per-station "Send
 * Patrol" dispatch button -- no patrol/dispatch tracking concept or table
 * exists anywhere in this codebase's real schema, and inventing one just
 * to match the mockup would be building a fake action button, the same
 * category of fabrication already corrected in spatiotemporal_forecast.py.
 *
 * Station markers/positions/scores come entirely from the caller (real
 * data from /api/geospatial/district-stations + /api/geospatial/station-
 * forecast) -- this component only renders what it's given.
 */
export interface TacticalStation {
  unit_id: number | string;
  name: string;
  lat: number;
  lng: number;
  tier?: "elevated" | "typical" | "quiet" | null;
}

interface Tactical3DMapProps {
  stations: TacticalStation[];
  selectedUnitId?: number | string | null;
  onSelectStation: (station: TacticalStation) => void;
  isDark?: boolean;
  // Real selected district name for the top-left badge -- never fabricated,
  // just the same value the caller's own district selector already holds.
  district?: string;
}

// L192/L208: a station outside Karnataka's real bounding box is a data
// error, not a place to fly the camera to (avoids the "Null Island"
// [0,0]-in-the-Atlantic bug a bad/missing coordinate would otherwise cause).
const KARNATAKA_BOUNDS = { latMin: 11.5, latMax: 18.5, lngMin: 74.0, lngMax: 78.5 };
const isValidKarnatakaCoord = (lat: number, lng: number) =>
  lat >= KARNATAKA_BOUNDS.latMin && lat <= KARNATAKA_BOUNDS.latMax &&
  lng >= KARNATAKA_BOUNDS.lngMin && lng <= KARNATAKA_BOUNDS.lngMax;

const TIER_COLOR: Record<string, string> = {
  elevated: "#EF4444",
  typical: "#F59E0B",
  quiet: "#10B981",
};

export const Tactical3DMap: React.FC<Tactical3DMapProps> = ({
  stations,
  selectedUnitId,
  onSelectStation,
  isDark = true,
  district,
}) => {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markersRef = useRef<Record<string, Marker>>({});
  const [isMapLoaded, setIsMapLoaded] = useState(false);
  const [currentPitch, setCurrentPitch] = useState(52);
  const [currentBearing, setCurrentBearing] = useState(-17);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // L181: WebGL context loss recovery -- a laptop switching tabs/sleeping
  // can drop the GPU context; without this the map goes permanently black
  // until a full page reload.
  useEffect(() => {
    if (!mapContainerRef.current) return;

    const styleUrl = isDark
      ? "https://tiles.openfreemap.org/styles/dark"
      : "https://tiles.openfreemap.org/styles/liberty";
    const initialCenter: [number, number] = [76.6, 14.5]; // Karnataka centroid-ish

    // L185: cap pitch and disable antialiasing on low-core-count hardware
    // (budget station desktops) so 3D extrusion doesn't stutter/overheat.
    const lowPower = typeof navigator !== "undefined" && (navigator.hardwareConcurrency || 8) < 4;

    const map = new MapLibreMap({
      container: mapContainerRef.current,
      style: styleUrl,
      center: initialCenter,
      zoom: 6.5,
      pitch: 0,
      bearing: 0,
      maxPitch: lowPower ? 45 : 65,
      minZoom: 5,
      maxZoom: 18.5,
      attributionControl: false,
    });

    const canvas = map.getCanvas();
    const handleContextLost = (e: Event) => {
      e.preventDefault();
      console.warn("[Tactical3DMap] WebGL context lost -- awaiting restore.");
    };
    const handleContextRestored = () => {
      map.triggerRepaint();
    };
    canvas.addEventListener("webglcontextlost", handleContextLost, false);
    canvas.addEventListener("webglcontextrestored", handleContextRestored, false);

    // OpenFreeMap's "dark"/"liberty" styles reference a couple of sprite
    // icons (circle-11, wood-pattern) this style's own sprite sheet doesn't
    // actually ship -- MapLibre logs a console warning and renders the
    // layer without that icon, which is harmless (nothing in this map uses
    // those icons) but was spamming the console on every tile load. A
    // no-op resolver tells MapLibre those IDs are expected to be missing
    // instead of treating each one as a fresh error to report.
    map.setMissingStyleImageResolver(() => {});
    map.on("load", () => setIsMapLoaded(true));
    map.on("pitch", () => setCurrentPitch(Math.round(map.getPitch())));
    map.on("rotate", () => setCurrentBearing(Math.round(map.getBearing())));

    mapRef.current = map;

    // L182: ResizeObserver against the 0x0-on-mount flexbox-layout-race bug.
    const resizeObserver = new ResizeObserver(() => {
      mapRef.current?.resize();
    });
    resizeObserver.observe(mapContainerRef.current);

    return () => {
      resizeObserver.disconnect();
      canvas.removeEventListener("webglcontextlost", handleContextLost);
      canvas.removeEventListener("webglcontextrestored", handleContextRestored);
      map.remove(); // L207: explicit teardown -- prevents a WebGL context leak on repeated navigation
      mapRef.current = null;
      setIsMapLoaded(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDark]);

  // Sync station markers with real data.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isMapLoaded) return;

    const currentIds = new Set(stations.map((s) => String(s.unit_id)));
    Object.keys(markersRef.current).forEach((key) => {
      if (!currentIds.has(key)) {
        markersRef.current[key].remove();
        delete markersRef.current[key];
      }
    });

    let hasValid = false;
    stations.forEach((station) => {
      if (!isValidKarnatakaCoord(station.lat, station.lng)) return;
      hasValid = true;
      const key = String(station.unit_id);
      const color = TIER_COLOR[station.tier || "typical"] || TIER_COLOR.typical;
      const isSelected = String(selectedUnitId) === key;

      let marker = markersRef.current[key];
      if (!marker) {
        const el = document.createElement("div");
        el.className = "cursor-pointer select-none group";
        el.style.width = "28px";
        el.style.height = "28px";
        el.style.position = "relative";
        el.innerHTML = `
          <div style="position:absolute;inset:0;border-radius:9999px;background:${color};opacity:0.35;animation:pulse 2s cubic-bezier(0.4,0,0.6,1) infinite;"></div>
          <div style="position:relative;z-index:1;width:14px;height:14px;margin:7px;border-radius:9999px;background:${color};border:2px solid white;box-shadow:0 0 6px rgba(0,0,0,0.5);"></div>
        `;
        el.addEventListener("click", (e) => {
          e.stopPropagation();
          onSelectStation(station);
          if (isValidKarnatakaCoord(station.lat, station.lng)) {
            map.flyTo({ center: [station.lng, station.lat], zoom: 15.5, pitch: 55, bearing: -20, duration: 1200 });
          }
        });
        marker = new Marker({ element: el, anchor: "center" }).setLngLat([station.lng, station.lat]).addTo(map);
        markersRef.current[key] = marker;
      } else {
        marker.setLngLat([station.lng, station.lat]);
      }
      const el = marker.getElement();
      el.style.outline = isSelected ? `2px solid ${color}` : "none";
      el.style.borderRadius = "9999px";
    });

    // Auto-fit to the real station set once, when it first loads.
    if (hasValid && stations.length > 0) {
      const bounds = new LngLatBounds();
      stations.forEach((s) => { if (isValidKarnatakaCoord(s.lat, s.lng)) bounds.extend([s.lng, s.lat]); });
      if (!bounds.isEmpty()) {
        map.fitBounds(bounds, { padding: 60, maxZoom: 13, duration: 800 });
      }
    } else {
      // CONFIRMED LIVE BUG (2026-09-16): switching to a district with zero
      // geocoded stations left the camera wherever a PREVIOUS district's
      // station click had flown it to (e.g. still zoomed into a Bengaluru
      // street after switching to Hassan) -- nothing ever told the camera
      // to move, so the officer saw an unrelated city's streets under a
      // "HASSAN" badge with no pins, which reads as broken rather than as
      // "no geocoded data for this district" (the real, honest state).
      // Reset to the statewide overview so the empty-state banner the
      // caller renders is shown over a sensible, unconfusing view.
      map.flyTo({ center: [76.6, 14.5], zoom: 6.5, pitch: 0, bearing: 0, duration: 800 });
    }
  }, [stations, selectedUnitId, isMapLoaded, onSelectStation]);

  const handleZoomIn = useCallback(() => mapRef.current?.zoomIn({ duration: 300 }), []);
  const handleZoomOut = useCallback(() => mapRef.current?.zoomOut({ duration: 300 }), []);
  const handleResetTilt = useCallback(() => mapRef.current?.easeTo({ pitch: 52, bearing: -17, duration: 600 }), []);
  const toggleFullscreen = useCallback(() => setIsFullscreen((v) => !v), []);

  return (
    <div
      className={`relative w-full h-full overflow-hidden transition-all duration-300 ${
        isFullscreen ? "fixed inset-0 z-50 bg-stone-950" : "rounded-xl border border-stone-800 shadow-2xl"
      }`}
    >
      {/* Top-left geographic badge -- real selected district, not fabricated. */}
      <div className="absolute top-3 left-4 z-20 pointer-events-none">
        <div className="px-3 py-2 rounded-lg bg-stone-950/85 border border-stone-800 backdrop-blur-md shadow-xl">
          <div className="text-xs font-black tracking-widest text-[#C79A4E] uppercase">{district || "Karnataka"}</div>
          <div className="text-[10px] font-medium text-stone-400">
            {district ? "Real-Time Station Intelligence" : "Statewide FIR Coverage"}
          </div>
        </div>
      </div>

      <div className="absolute top-3 right-3 z-20 flex flex-col gap-1.5 bg-stone-900/90 border border-stone-800 rounded-lg p-1 shadow-xl backdrop-blur-md">
        <button onClick={handleZoomIn} title="Zoom In" className="p-2 hover:bg-stone-800 text-stone-300 hover:text-white rounded transition-colors cursor-pointer">
          <Plus className="w-4 h-4" />
        </button>
        <button onClick={handleZoomOut} title="Zoom Out" className="p-2 hover:bg-stone-800 text-stone-300 hover:text-white rounded transition-colors cursor-pointer">
          <Minus className="w-4 h-4" />
        </button>
        <button onClick={handleResetTilt} title={`Reset tilt (pitch ${currentPitch}°, bearing ${currentBearing}°)`} className="p-2 hover:bg-stone-800 text-[#C79A4E] hover:text-[#e0b265] rounded transition-colors cursor-pointer">
          <Compass className="w-4 h-4" style={{ transform: `rotate(${currentBearing}deg)` }} />
        </button>
        <button onClick={toggleFullscreen} title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"} className="p-2 hover:bg-stone-800 text-stone-300 hover:text-white rounded transition-colors cursor-pointer">
          <Maximize2 className="w-4 h-4" />
        </button>
      </div>

      <div className="absolute bottom-3 right-3 z-20 flex flex-col items-end gap-1 pointer-events-none select-none">
        <div className="px-2.5 py-1 rounded bg-black/70 border border-stone-800/80 text-[10px] text-stone-400 backdrop-blur-sm">
          Scroll to zoom • Drag to rotate and tilt
        </div>
        <div className="text-[9px] font-mono text-stone-500 pointer-events-auto">
          OpenFreeMap © OpenMapTiles Data from OpenStreetMap
        </div>
      </div>

      {!isMapLoaded && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-stone-950/60">
          <div className="w-8 h-8 border-2 border-stone-800 border-t-[#C79A4E] rounded-full animate-spin" />
        </div>
      )}

      <div ref={mapContainerRef} className="w-full h-full" />
    </div>
  );
};
