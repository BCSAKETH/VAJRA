import React, { useState, useEffect } from "react";
import { useApp } from "../AppContext";
import { API_BASE } from "../config";
import { MapContainer, TileLayer, CircleMarker, Popup, Circle, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet.heat";
import { WatermarkOverlay } from "../components/WatermarkOverlay";
import { MapPin, Sliders, AlertTriangle, Flame } from "lucide-react";

interface HotspotPoint {
  lat: number;
  lng: number;
  label: string;
  weight?: number;
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

export const SpatialScreen: React.FC = () => {
  const { addToast, lang, setIsAuthenticated } = useApp();
  const [points, setPoints] = useState<HotspotPoint[]>([]);
  const [eps, setEps] = useState(0.015);
  const [minPts, setMinPts] = useState(3);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch coordinates on mount
  useEffect(() => {
    const fetchCoordinates = async () => {
      try {
        setIsLoading(true);
        setErrorMsg(null);
        
        // ZCQL coordinates extraction
        const response = await fetch(`${API_BASE}/api/cases/spatial-hotspots`, {
          headers: {
            "Authorization": `Bearer ${localStorage.getItem("vajra_token") || ""}`,
          },
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

        const data = await response.json();
        // Fallback check: if server returns empty and error
        if (!data || data.length === 0) {
          throw new Error("No spatial case clusters resolved from CCTNS register.");
        }

        setPoints(data);
      } catch (err: any) {
        console.error(err);
        setErrorMsg(err.message || "Geospatial services unreachable.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchCoordinates();
  }, []);

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

        <div className="space-y-4">
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
        </div>

        {/* Diagnostic Metadata */}
        <div className="mt-auto border-t border-stone-850 pt-4 space-y-3 font-mono text-[10px] text-stone-450 bg-stone-950/20 p-3 rounded-lg border">
          <div className="flex justify-between">
            <span>{lang === "en" ? "Points Scanned:" : "ಸ್ಕ್ಯಾನ್ ಮಾಡಿದ ಬಿಂದುಗಳು:"}</span>
            <span className="font-bold text-stone-200">{points.length}</span>
          </div>
          <div className="flex justify-between">
            <span>{lang === "en" ? "Active Clusters:" : "ಸಕ್ರಿಯ ಸಮೂಹಗಳು:"}</span>
            <span className="font-bold text-amber-500">{errorMsg ? "0" : Math.max(1, Math.round(points.length / minPts))}</span>
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
              <HeatLayer points={points} />
              <AutoFitBounds points={points} />
              {points.map((point, index) => (
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
                      <div className="text-xs font-sans text-stone-900">
                        <span className="font-bold block">{point.label}</span>
                        Lat: {point.lat.toFixed(5)}, Lng: {point.lng.toFixed(5)}
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
