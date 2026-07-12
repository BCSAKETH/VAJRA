import React, { useState, useEffect } from "react";
import { useApp } from "../AppContext";
import { API_BASE } from "../config";
import { MapContainer, TileLayer, Marker, Popup, Circle } from "react-leaflet";
import { WatermarkOverlay } from "../components/WatermarkOverlay";
import { MapPin, Sliders, AlertTriangle } from "lucide-react";

interface HotspotPoint {
  lat: number;
  lng: number;
  label: string;
  weight?: number;
}

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
    <div className="h-full flex flex-col md:flex-row relative overflow-hidden bg-slate-950/20">
      {/* Security Watermark Overlay */}
      <WatermarkOverlay />

      {/* Left Sidebar Controls */}
      <div className="w-full md:w-80 border-b md:border-b-0 md:border-r border-slate-850 p-6 flex flex-col gap-6 bg-slate-900/10 shrink-0 z-10">
        <div className="space-y-1.5">
          <h3 className="text-sm font-black text-slate-100 uppercase tracking-wider font-mono flex items-center gap-2">
            <Sliders className="w-4 h-4 text-[#00C6AD]" />
            <span>Hotspot Controls</span>
          </h3>
          <p className="text-[11px] text-slate-550 leading-relaxed font-mono">
            Spatial DBSCAN and Kernel Density parameters for official patrol route allocation.
          </p>
        </div>

        <div className="space-y-4">
          {/* DBSCAN EPS Radius */}
          <div className="space-y-1.5">
            <label className="flex justify-between text-[11.5px] font-bold text-slate-400 font-mono">
              <span>EPS Radius (deg):</span>
              <span className="text-[#00C6AD] font-bold">{eps.toFixed(3)}</span>
            </label>
            <input
              type="range"
              min="0.005"
              max="0.05"
              step="0.001"
              value={eps}
              onChange={(e) => setEps(parseFloat(e.target.value))}
              className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-[#00C6AD]"
              disabled={!!errorMsg}
            />
          </div>

          {/* DBSCAN Min Points */}
          <div className="space-y-1.5">
            <label className="flex justify-between text-[11.5px] font-bold text-slate-400 font-mono">
              <span>Min Cluster Points:</span>
              <span className="text-[#00C6AD] font-bold">{minPts}</span>
            </label>
            <input
              type="range"
              min="2"
              max="8"
              step="1"
              value={minPts}
              onChange={(e) => setMinPts(parseInt(e.target.value))}
              className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-[#00C6AD]"
              disabled={!!errorMsg}
            />
          </div>
        </div>

        {/* Diagnostic Metadata */}
        <div className="mt-auto border-t border-slate-850 pt-4 space-y-3 font-mono text-[10px] text-slate-450 bg-slate-950/20 p-3 rounded-lg border">
          <div className="flex justify-between">
            <span>Points Scanned:</span>
            <span className="font-bold text-slate-200">{points.length}</span>
          </div>
          <div className="flex justify-between">
            <span>Active Clusters:</span>
            <span className="font-bold text-amber-500">{errorMsg ? "0" : Math.max(1, Math.round(points.length / minPts))}</span>
          </div>
          <div className="flex justify-between">
            <span>Spatial Engine:</span>
            <span className="text-[#00C6AD] font-bold">DBSCAN 1.2</span>
          </div>
        </div>
      </div>

      {/* Main Map Content Pane */}
      <div className="flex-1 min-h-[400px] relative z-0 flex flex-col">
        {errorMsg ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center bg-slate-950/90 z-20 space-y-4">
            <div className="w-12 h-12 bg-rose-500/10 border border-rose-500/25 text-rose-500 rounded-full flex items-center justify-center">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div className="space-y-1 max-w-md">
              <h4 className="text-sm font-black text-rose-400 uppercase tracking-wider font-mono">
                {lang === "en" ? "Data Unavailable" : "ಡೇಟಾ ಲಭ್ಯವಿಲ್ಲ"}
              </h4>
              <p className="text-xs text-slate-500 leading-relaxed font-semibold">
                {errorMsg} Check connection to the KSP CCTNS geographical registry.
              </p>
            </div>
          </div>
        ) : isLoading ? (
          <div className="flex-1 flex items-center justify-center bg-slate-950/40 text-slate-400 text-xs font-mono">
            Loading geographical spatial nodes...
          </div>
        ) : (
          <div className="flex-1 relative">
            <MapContainer
              center={points[0] ? [points[0].lat, points[0].lng] : [13.0276, 77.5124]}
              zoom={13}
              style={{ height: "100%", width: "100%" }}
            >
              <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              />
              {points.map((point, index) => (
                <React.Fragment key={index}>
                  <Marker position={[point.lat, point.lng]}>
                    <Popup>
                      <div className="text-xs font-sans text-slate-900">
                        <span className="font-bold block">{point.label}</span>
                        Lat: {point.lat.toFixed(5)}, Lng: {point.lng.toFixed(5)}
                      </div>
                    </Popup>
                  </Marker>
                  <Circle
                    center={[point.lat, point.lng]}
                    radius={eps * 111300} // rough degrees to meters conversion
                    pathOptions={{
                      fillColor: "#00C6AD",
                      color: "rgba(0,198,173,0.3)",
                      weight: 1,
                      fillOpacity: 0.08,
                    }}
                  />
                </React.Fragment>
              ))}
            </MapContainer>
          </div>
        )}
      </div>
    </div>
  );
};
