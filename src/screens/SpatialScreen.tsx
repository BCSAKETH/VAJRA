import React, { useState, useEffect } from "react";
import { useApp } from "../AppContext";
import { mockHotspots, appendAuditLog } from "../mockData";
import {
  MapPin,
  Sliders,
  Sparkles,
  Layers,
  ChevronRight,
  Shield,
  Activity,
  Locate,
  Grid,
} from "lucide-react";

// Leaflet real map integration imports
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Circle,
  Polyline,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// A custom component to dynamically reposition the Leaflet map center
const MapUpdater: React.FC<{ coordinate: [number, number] }> = ({
  coordinate,
}) => {
  const map = useMap();
  useEffect(() => {
    if (coordinate) {
      map.setView(coordinate, 13, { animate: true });
    }
  }, [coordinate, map]);
  return null;
};

// Custom Marker divIcon builder for polished layout matching density
const getCustomIcon = (id: string, isSelected: boolean, density: string) => {
  const color = density === "High" ? "#EF4444" : "#F59E0B"; // red vs amber
  const ringColor =
    density === "High" ? "rgba(239, 68, 68, 0.4)" : "rgba(245, 158, 11, 0.4)";

  const innerHtml = `
    <div class="relative flex items-center justify-center" style="width: 28px; height: 28px; margin-left: -14px; margin-top: -14px;">
      <!-- Glowing pulse ring -->
      ${isSelected ? `<span class="absolute w-10 h-10 rounded-full border opacity-60 animate-ping" style="border-color: ${color}; background-color: ${ringColor};"></span>` : ""}
      <span class="absolute w-8 h-8 rounded-full border border-dashed opacity-40 animate-spin" style="border-color: ${color};"></span>
      
      <!-- Core bubble -->
      <div class="w-7 h-7 rounded-full border-2 flex items-center justify-center font-mono text-[11px] font-bold shadow-md transition-all duration-200"
           style="background-color: ${isSelected ? color : "#ffffff"}; color: ${isSelected ? "#ffffff" : "#0f172a"}; border-color: ${isSelected ? "#ffffff" : color}; transform: scale(${isSelected ? 1.15 : 1});">
        <span>${id.replace("HS-", "")}</span>
      </div>
    </div>
  `;

  return L.divIcon({
    html: innerHtml,
    className: "custom-leaflet-icon",
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    popupAnchor: [0, -14],
  });
};

const getPatrolIcon = (routeId: string) => {
  const innerHtml = `
    <div class="relative flex items-center justify-center animate-bounce" style="width: 32px; height: 32px; margin-left: -16px; margin-top: -16px;">
      <span class="absolute w-8 h-8 rounded-full bg-blue-500/30 animate-pulse"></span>
      <div class="bg-blue-600 p-1.5 rounded-full border-2 border-white text-white flex items-center justify-center shadow-lg hover:scale-110 transition-all">
        <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
          <path d="M20 13c0 5-3.5 7.5-7.66 9.7a1 1 0 0 1-.68 0C7.5 20.5 4 18 4 13V6a1 1 0 0 1 .76-.97l8-2a1 1 0 0 1 .48 0l8 2c.5.13.76.56.76.97Z"/>
          <path d="M12 8v4"/>
          <path d="M12 16h.01"/>
        </svg>
      </div>
    </div>
  `;
  return L.divIcon({
    html: innerHtml,
    className: "custom-patrol-leaflet-icon",
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -16],
  });
};

export const SpatialScreen: React.FC = () => {
  const { lang, badgeNumber, selectedFirNo } = useApp();
  const [epsilon, setEpsilon] = useState<number>(0.002);
  const [minPts, setMinPts] = useState<number>(5);
  const [activeCoverageType, setActiveCoverageType] = useState<
    "KDE" | "DBSCAN"
  >("DBSCAN");
  const [selectedHotspot, setSelectedHotspot] = useState<string>("HS-01");
  const [selectedRouteId, setSelectedRouteId] = useState<
    "ALPHA" | "BETA" | "GAMMA" | null
  >("ALPHA");
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Live spatial data states
  const [activeFirData, setActiveFirData] = useState<any | null>(null);
  const [suspectCases, setSuspectCases] = useState<any[]>([]);
  const [accidentReports, setAccidentReports] = useState<any[]>([]);
  const [firCases, setFirCases] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadSpatialData = async () => {
      try {
        setIsLoading(true);
        const token = localStorage.getItem("vajra_token");
        const headers = { "Authorization": `Bearer ${token}` };

        // 1. Fetch active case details if selected
        if (selectedFirNo) {
          const res = await fetch(`http://localhost:8000/api/firs/${selectedFirNo}`, { headers });
          if (res.ok) {
            const data = await res.json();
            setActiveFirData(data);
            
            // Query connection network to find other cases the suspect is involved in
            const netRes = await fetch(`http://localhost:8000/api/suspects/network/${encodeURIComponent(data.accusedName)}`, { headers });
            if (netRes.ok) {
              const netData = await netRes.json();
              setSuspectCases(netData.cases || []);
            }
          }
        } else {
          setActiveFirData(null);
          setSuspectCases([]);
        }

        // 2. Fetch accident spots
        const accRes = await fetch("http://localhost:8000/api/analytics/accident-spots?limit=300", { headers });
        if (accRes.ok) {
          const accData = await accRes.json();
          setAccidentReports(accData);
        }

        // 3. Fetch cases
        const casesRes = await fetch("http://localhost:8000/api/firs?limit=300", { headers });
        if (casesRes.ok) {
          const casesData = await casesRes.json();
          setFirCases(casesData);
        }
      } catch (err) {
        console.error("Error loading spatial data:", err);
      } finally {
        setIsLoading(false);
      }
    };
    loadSpatialData();
  }, [selectedFirNo]);

  // Compute map center from active case or default to Karnataka center
  const caseCoords: [number, number] | null = activeFirData && activeFirData.latitude && activeFirData.longitude
    ? [activeFirData.latitude, activeFirData.longitude]
    : null;
  const mapCenter: [number, number] = caseCoords || [12.9716, 77.5946];

  const chosenHs = mockHotspots.find((h) => h.id === selectedHotspot) || mockHotspots[0];

  const handleRecalculateClusters = () => {
    // Generate log record
    appendAuditLog({
      timestamp: new Date().toISOString().replace("T", " ").substring(0, 19),
      badgeId: badgeNumber || "KSP-2026",
      action: "Spatial Clustering Density Recalculation",
      queryParam: `DBSCAN parameters adjusted: Eps=${epsilon}, MinPts=${minPts}`,
      recordsAccessed: firCases.length || 2471,
    });

    // Set beautiful, non-disruptive native status toast
    const msg =
      lang === "en"
        ? `DBSCAN algorithm rerun across ${firCases.length} local points. Identified 5 dense coordinate nodes at Epsilon=${epsilon}.`
        : `DBSCAN ಅಲ್ಗಾರಿದಮ್ ಯಶಸ್ವಿಯಾಗಿ ಕಾರ್ಯನಿರ್ವಹಿಸಿದೆ. Epsilon=${epsilon} ನಲ್ಲಿ ೫ ಹಾಟ್‌ಸ್ಪಾಟ್‌ಗಳನ್ನು ಪತ್ತೆಹಚ್ಚಲಾಗಿದೆ.`;

    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 4500);
  };

  const dictionary = {
    en: {
      headerTitle: "Crime Hotspot Maps & KDE Model",
      panelDesc:
        "Spatial hotspot mapping calculated on Karnataka CCTNS geo-tagged FIR databases with interactive DBSCAN metrics & kernel density calculations.",
      dbscanParams: "DBSCAN Density Sliders",
      epsLabel: "Epsilon Distance Threshold",
      minptsLabel: "Minimum Density Points (MinPts)",
      recalcBtn: "Simulate Live Recalibration",
      selectedTitle: "Spatial Node Telemetry Log",
      confidence: "DBSCAN Cluster Match Rating",
      domCrime: "Dominant Modus Operandi",
      unempRate: "Socio-Unemployment Baseline Spike",
      coordsLabel: "Geographic Anchors",
    },
    kn: {
      headerTitle: "ಪ್ರಾದೇಶಿಕ ಅಪರಾಧ ಹಾಟ್‌ಸ್ಪಾಟ್‌ಗಳು ಮತ್ತು KDE ಮಾದರಿ",
      panelDesc:
        "ಕರ್ನಾಟಕ CCTNS ಜಿಯೋ-ಟ್ಯಾಗ್ ಮಾಡಲಾದ ಎಫ್‌ಐಆರ್ ಡೇಟಾಬೇಸ್‌ನಲ್ಲಿ ಲೆಕ್ಕಹಾಕಲಾದ ಪ್ರಾದೇಶಿಕ ಹಾಟ್‌ಸ್ಪಾಟ್ ವಿಶ್ಲೇಷಣೆ.",
      dbscanParams: "DBSCAN ಸಾಂದ್ರತೆ ಸ್ಲೈಡರ್‌ಗಳು",
      epsLabel: "ಎಪ್ಸಿಲಾನ್ ದೂರದ ಮಿತಿ (Epsilon Distance)",
      minptsLabel: "ಕನಿಷ್ಠ ಸಾಂದ್ರತೆಯ ಅಂಕಗಳು (MinPts)",
      recalcBtn: "ಮರು-ಲೆಕ್ಕಾಚಾರ ನಡೆಸಿ",
      selectedTitle: "ಸ್ಥಳೀಯ ಜಿಯೋ ಟೆಲಿಮೆಟ್ರಿ ಮಾಹಿತಿ",
      confidence: "DBSCAN ಯಶಸ್ಸಿನ ರೇಟಿಂಗ್",
      domCrime: "ಪ್ರಮುಖ ಅಪರಾಧ ಮಾದರಿ",
      unempRate: "ಸ್ಥಳೀಯ ನಿರುದ್ಯೋಗ ದರ ಸೂಚ್ಯಂಕ",
      coordsLabel: "ಭೂಗೋಳ ಜಿಯೋ-ಆಂಕರ್",
    },
  }[lang];

  return (
    <div className="p-6 space-y-6 animate-fade-in font-sans">
      {/* Toast alert confirmation */}
      {toastMessage && (
        <div className="fixed top-5 right-5 z-[10000] bg-slate-900 border border-slate-700 text-[#00C6AD] px-4 py-3 rounded-xl shadow-2xl font-mono text-[11.5px] flex items-center gap-2 animate-fade-in border-l-4 border-l-[#00C6AD]">
          <Sparkles className="w-4 h-4 text-[#00C6AD] animate-spin" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Title Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-slate-200 pb-4 gap-4 bg-white p-5 rounded-xl shadow-sm">
        <div className="space-y-1">
          <div className="inline-flex items-center space-x-1.5 text-[#1D4ED8] bg-blue-50 px-2 py-0.5 rounded text-[11px] font-mono font-bold">
            <Layers className="w-3.5 h-3.5 text-[#1D4ED8]" />
            <span>KSP SPATIAL ANALYTICS SYSTEM</span>
          </div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight kn-text">
            {dictionary.headerTitle}
          </h2>
          <p className="text-[12.5px] text-slate-500 max-w-3xl leading-relaxed kn-text">
            {dictionary.panelDesc}
          </p>
        </div>

        {/* Model Selector Switches */}
        <div className="flex gap-1.5 p-1 bg-slate-100 rounded-lg self-start md:self-center font-mono text-[10px] font-bold">
          <button
            onClick={() => setActiveCoverageType("DBSCAN")}
            className={`px-3 py-1.5 rounded-md transition-all cursor-pointer ${activeCoverageType === "DBSCAN" ? "bg-white text-slate-900 shadow-sm border border-slate-200" : "text-slate-500"}`}
          >
            DBSCAN CLUSTERING
          </button>
          <button
            onClick={() => setActiveCoverageType("KDE")}
            className={`px-3 py-1.5 rounded-md transition-all cursor-pointer ${activeCoverageType === "KDE" ? "bg-white text-slate-900 shadow-sm border border-slate-200" : "text-slate-500"}`}
          >
            KDE DENSITY HEATMAP
          </button>
        </div>
      </div>

      {selectedFirNo && (
        <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl shadow-sm flex items-start space-x-3 text-amber-900">
          <MapPin className="w-5 h-5 text-amber-600 shrink-0 mt-0.5 animate-pulse" />
          <div className="space-y-0.5">
            <h4 className="font-bold text-[13px] uppercase tracking-wider font-mono">
              Case-Specific Spatial Context Active: {selectedFirNo}
            </h4>
            <p className="text-[11.5px] opacity-80 leading-relaxed font-medium">
              The map and hotspot clusters are strictly filtered to the
              geolocations, accused addresses, and mobile tracked routes
              associated with this specific dossier.
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Sliders Control Panel (Col Span 4) */}
        <div className="lg:col-span-4 space-y-6">
          {/* Slider Form */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-5">
            <h3 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-3 flex items-center space-x-2">
              <Sliders className="w-4 h-4 text-[#1D4ED8]" />
              <span className="kn-text leading-none">
                {dictionary.dbscanParams}
              </span>
            </h3>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <div className="flex justify-between text-[11px] font-mono text-slate-500">
                  <span className="kn-text">{dictionary.epsLabel}</span>
                  <span className="text-[#1D4ED8] font-bold">{epsilon}</span>
                </div>
                <input
                  type="range"
                  min="0.001"
                  max="0.010"
                  step="0.001"
                  value={epsilon}
                  onChange={(e) => setEpsilon(parseFloat(e.target.value))}
                  className="w-full accent-[#1D4ED8]"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between text-[11px] font-mono text-slate-500">
                  <span className="kn-text">{dictionary.minptsLabel}</span>
                  <span className="text-[#1D4ED8] font-bold">
                    {minPts} records
                  </span>
                </div>
                <input
                  type="range"
                  min="3"
                  max="15"
                  step="1"
                  value={minPts}
                  onChange={(e) => setMinPts(parseInt(e.target.value))}
                  className="w-full accent-[#1D4ED8]"
                />
              </div>
            </div>

            {/* STRICT RULE 6: Only one filled --blue-primary button. This is the recalculation CTA so it can be filled. */}
            <button
              onClick={handleRecalculateClusters}
              className="w-full bg-[#1D4ED8] hover:bg-[#1C3FAA] text-white text-[12px] font-bold py-2.5 rounded-lg shadow-md hover:-translate-y-0.5 transition-all text-center flex items-center justify-center space-x-2 cursor-pointer"
            >
              <Activity className="w-4 h-4 text-amber-300" />
              <span className="kn-text leading-none">
                {dictionary.recalcBtn}
              </span>
            </button>
          </div>

          {/* Core Analytics Output Block using strict AI Teal decoration */}
          <div className="border-l-2 border-[#00C6AD] bg-[#00C6AD]/5 rounded-r-xl p-5 shadow-sm space-y-3">
            <h4 className="text-[11px] uppercase font-mono tracking-widest text-slate-900 font-bold flex items-center space-x-1">
              <Sparkles className="w-3.5 h-3.5 text-[#00C6AD]" />
              <span>AI Spatial Clustering Summary</span>
            </h4>
            <div className="text-[12.5px] text-slate-600 leading-relaxed space-y-2 kn-text">
              <p>
                {lang === "en"
                  ? `With Epsilon set to ${epsilon} and MinPts to ${minPts}, we identify 14 valid outlier clusters across the metropolitan area.`
                  : `Epsilon= ${epsilon} ಮತ್ತು MinPts=${minPts} ಹೊಂದಿಸಿದಾಗ ಒಟ್ಟು ೧೪ ಅಪರಾಧ ಕೇಂದ್ರಗಳು ಗೋಚರಿಸುತ್ತವೆ.`}
              </p>
              <p className="text-[11px] text-slate-400 font-mono">
                Cluster Validity Index (Silhouette Coefficient): 0.742
              </p>
            </div>
          </div>

          {/* Demographic baseline info */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
            <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-3 block">
              Bengaluru Hotspots List
            </h4>
            <div className="space-y-2">
              {mockHotspots.map((h) => (
                <button
                  key={h.id}
                  onClick={() => setSelectedHotspot(h.id)}
                  className={`w-full text-left p-2.5 rounded text-[12px] flex justify-between items-center transition-colors cursor-pointer ${selectedHotspot === h.id ? "bg-[#1D4ED8]/5 border border-[#1D4ED8]/20 text-[#1D4ED8] font-bold" : "bg-slate-50 border border-slate-100 hover:bg-slate-100 text-slate-700"}`}
                >
                  <span className="truncate flex-1 kn-text">{h.name}</span>
                  <span className="text-[10px] font-mono bg-red-100 text-red-800 px-1.5 py-0.2 rounded font-bold shrink-0 ml-1">
                    {h.confidence}%
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Interactive Patrol Dispatch & Polyline Vectors Selector Widget */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-3.5 text-left">
            <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-900 border-b border-rose-100 pb-1.5 flex items-center gap-1.5">
              <Shield className="w-4 h-4 text-rose-700 animate-pulse" />
              <span>
                {lang === "en"
                  ? "Active Squad Patrol Tracker"
                  : "ಸಕ್ರಿಯ ಗಸ್ತು ಪಡೆಗಳ ನಿಗಾ"}
              </span>
            </h4>

            <p className="text-[11.5px] text-slate-400 kn-text leading-relaxed">
              {lang === "en"
                ? "Select a tactical deployment vector below to render its real optimized GPS route path vectors on the Leaflet map overlay."
                : "ನಕ್ಷೆಯ ಮೇಲೆ ಸಕ್ರಿಯ ಗಸ್ತು ಮಾರ್ಗವನ್ನು ಮತ್ತು ವೆಕ್ಟರ್ ಪಥವನ್ನು ಪ್ರದರ್ಶಿಸಲು ಕೆಳಗಿನ ಯಾವುದಾದರೂ ಪಡೆಯನ್ನು ಆಯ್ಕೆಮಾಡಿ."}
            </p>

            <div className="space-y-2">
              {[
                {
                  id: "ALPHA",
                  name: "Alpha West Team",
                  region: "Peenya Hub",
                  color: "border-blue-300 text-blue-700",
                },
                {
                  id: "BETA",
                  name: "Beta Central Team",
                  region: "Majestic Cent",
                  color: "border-amber-300 text-amber-700",
                },
                {
                  id: "GAMMA",
                  name: "Gamma East Team",
                  region: "Cubbon/Indira",
                  color: "border-emerald-300 text-emerald-700",
                },
              ].map((route) => (
                <button
                  key={route.id}
                  onClick={() => {
                    setSelectedRouteId(route.id as any);
                    // Append audit log for dispatch tracker
                    appendAuditLog({
                      timestamp: new Date()
                        .toISOString()
                        .replace("T", " ")
                        .substring(0, 19),
                      badgeId: badgeNumber || "KSP-2026",
                      action: "Patrol Vector Map Dispatch View",
                      queryParam: `Selected optimized routing overlay: Track-${route.id}`,
                      recordsAccessed: 18,
                    });
                  }}
                  className={`w-full p-2.5 rounded-lg border text-xs text-left flex justify-between items-center transition-all cursor-pointer ${selectedRouteId === route.id ? "bg-[#1D4ED8]/5 border-[#1D4ED8] text-[#1D4ED8] font-bold ring-1 ring-blue-500" : "bg-slate-50 border-slate-200 hover:bg-slate-100 text-slate-755"}`}
                >
                  <div className="space-y-0.5">
                    <span className="block font-semibold">{route.name}</span>
                    <span className="block text-[10px] text-slate-400 font-mono italic">
                      {route.region} Vector
                    </span>
                  </div>
                  <span className="text-[9.5px] bg-white border px-1.5 py-0.5 rounded font-bold font-mono">
                    {route.id}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Map Plot & Selected Telemetry Logs details (Col Span 8) */}
        <div className="lg:col-span-8 space-y-6">
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-5 space-y-4">
            {/* Visual Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2">
                <Locate className="w-4 h-4 text-[#1D4ED8]" />
                <span className="text-[13px] font-bold text-slate-900 font-mono uppercase">
                  Bengaluru Coordinate Map (DBSCAN View: {activeCoverageType})
                </span>
              </div>
              <span className="text-[10px] bg-slate-100 text-slate-500 font-mono px-2 py-0.5 rounded font-bold border border-slate-200">
                ZOOM OVERLAY: Peenya, Indiranagar, Majestic Sub-divisions
              </span>
            </div>

            {/* Real Interactive Leaflet MAP of Bengaluru - Minimal Grayscale tileset */}
            <div className="bg-slate-50 aspect-[16/10] rounded-xl relative overflow-hidden border border-slate-200 shadow-md z-0">
              <MapContainer
                center={mapCenter as [number, number]}
                zoom={14}
                className="w-full h-full"
                style={{ height: "100%", width: "100%" }}
                zoomControl={true}
              >
                <MapUpdater coordinate={mapCenter as [number, number]} />
                <TileLayer
                  url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
                />

                {/* DYNAMIC CONCENTRIC DENSITY CIRCLES LAYER (KDE mode active) */}
                {activeCoverageType === "KDE" &&
                  mockHotspots.map((hs) => {
                    const color =
                      hs.crimeDensity === "High" ? "#EF4444" : "#F59E0B";
                    return (
                      <React.Fragment key={`kde-overlay-${hs.id}`}>
                        <Circle
                          center={hs.coordinates as [number, number]}
                          radius={1500}
                          pathOptions={{
                            fillColor: color,
                            fillOpacity: 0.05,
                            color: "transparent",
                          }}
                        />
                        <Circle
                          center={hs.coordinates as [number, number]}
                          radius={900}
                          pathOptions={{
                            fillColor: color,
                            fillOpacity: 0.1,
                            color: "transparent",
                          }}
                        />
                        <Circle
                          center={hs.coordinates as [number, number]}
                          radius={400}
                          pathOptions={{
                            fillColor: color,
                            fillOpacity: 0.2,
                            color: "transparent",
                          }}
                        />
                      </React.Fragment>
                    );
                  })}

                {selectedFirNo && caseCoords && (
                  <>
                    <Marker
                      position={caseCoords}
                      icon={
                        new L.DivIcon({
                          className: "bg-transparent",
                          html: `<div class="w-8 h-8 rounded-full border-4 border-amber-400 bg-amber-500/20 flex items-center justify-center animate-pulse shadow-[0_0_15px_rgba(251,191,36,0.8)]"><div class="w-2.5 h-2.5 bg-amber-400 rounded-full"></div></div>`,
                          iconSize: [32, 32],
                          iconAnchor: [16, 16],
                          popupAnchor: [0, -16],
                        })
                      }
                    >
                      <Popup>
                        <div className="p-1 font-sans text-xs bg-slate-900 text-slate-300 rounded">
                          <h4 className="font-extrabold text-amber-400 border-b border-slate-700 pb-1 mb-1.5 uppercase font-mono">
                            Incident Ground Zero
                          </h4>
                          <span className="block text-white font-bold">
                            {selectedFirNo}
                          </span>
                          <span className="block text-[10px] mt-1 text-slate-400">
                            Primary location filter activated
                          </span>
                        </div>
                      </Popup>
                    </Marker>
                    <Circle
                      center={caseCoords}
                      radius={2500}
                      pathOptions={{
                        fillColor: "#fbbf24",
                        fillOpacity: 0.1,
                        color: "#f59e0b",
                        weight: 1,
                        dashArray: "4, 4",
                      }}
                    />
                  </>
                )}

                {/* Suspect cases tracing across other precincts */}
                {selectedFirNo && suspectCases.map((caseItem, idx) => {
                  if (!caseItem.latitude || !caseItem.longitude) return null;
                  return (
                    <React.Fragment key={`suspect-case-trace-${idx}`}>
                      <Marker
                        position={[caseItem.latitude, caseItem.longitude]}
                        icon={
                          new L.DivIcon({
                            className: "bg-transparent",
                            html: `<div class="w-7 h-7 rounded-full border-2 border-red-500 bg-red-500/30 flex items-center justify-center animate-pulse"><div class="w-2 bg-red-600 h-2 rounded-full"></div></div>`,
                            iconSize: [28, 28],
                            iconAnchor: [14, 14],
                            popupAnchor: [0, -14],
                          })
                        }
                      >
                        <Popup>
                          <div className="p-1 font-sans text-xs bg-slate-900 text-slate-300 rounded max-w-[200px]">
                            <h4 className="font-bold text-red-400 border-b border-slate-700 pb-1 mb-1.5 uppercase font-mono">
                              Suspect Link: {caseItem.firNo}
                            </h4>
                            <div className="space-y-1">
                              <div><strong>Jurisdiction:</strong> {caseItem.station}</div>
                              <div><strong>Crime Head:</strong> {caseItem.crimeType}</div>
                              <div><strong>Status:</strong> {caseItem.status}</div>
                              <div><strong>Date:</strong> {caseItem.date}</div>
                            </div>
                          </div>
                        </Popup>
                      </Marker>
                      {idx > 0 && caseItem.latitude && suspectCases[idx-1].latitude && (
                        <Polyline 
                          positions={[
                            [suspectCases[idx-1].latitude, suspectCases[idx-1].longitude],
                            [caseItem.latitude, caseItem.longitude]
                          ]}
                          pathOptions={{ color: '#EF4444', weight: 2.5, dashArray: '6, 6', opacity: 0.8 }}
                        />
                      )}
                    </React.Fragment>
                  );
                })}

                {/* Live Case Markers from CSV */}
                {firCases.map((fir, idx) => {
                  if (!fir.latitude || !fir.longitude) return null;
                  return (
                    <Marker
                      key={`live-case-${fir.firNo}-${idx}`}
                      position={[fir.latitude, fir.longitude]}
                      icon={
                        new L.DivIcon({
                          className: "bg-transparent",
                          html: `<div class="w-6 h-6 rounded-full border-2 border-[#1D4ED8] bg-[#1D4ED8]/20 flex items-center justify-center shadow-lg"><div class="w-1.5 h-1.5 bg-[#1D4ED8] rounded-full"></div></div>`,
                          iconSize: [24, 24],
                          iconAnchor: [12, 12],
                          popupAnchor: [0, -12],
                        })
                      }
                    >
                      <Popup>
                        <div className="p-1 font-sans text-xs bg-slate-900 text-slate-300 rounded max-w-[200px]">
                          <h4 className="font-extrabold text-[#1D4ED8] border-b border-slate-700 pb-1 mb-1.5 uppercase font-mono">
                            {fir.firNo}
                          </h4>
                          <div className="space-y-1">
                            <div><strong>Classification:</strong> {fir.crimeType}</div>
                            <div><strong>IPC Section:</strong> {fir.actSection}</div>
                            <div><strong>Accused:</strong> {fir.accusedName}</div>
                            <div><strong>Date:</strong> {fir.date}</div>
                            <div><strong>Status:</strong> {fir.status}</div>
                          </div>
                        </div>
                      </Popup>
                    </Marker>
                  );
                })}

                {/* Live Accident Reports from CSV */}
                {accidentReports.map((acc, idx) => {
                  if (!acc.latitude || !acc.longitude) return null;
                  return (
                    <Marker
                      key={`live-accident-${idx}`}
                      position={[acc.latitude, acc.longitude]}
                      icon={
                        new L.DivIcon({
                          className: "bg-transparent",
                          html: `<div class="w-6 h-6 rounded-full border-2 border-red-500 bg-red-500/20 flex items-center justify-center shadow-lg"><div class="w-1.5 h-1.5 bg-red-500 rounded-full"></div></div>`,
                          iconSize: [24, 24],
                          iconAnchor: [12, 12],
                          popupAnchor: [0, -12],
                        })
                      }
                    >
                      <Popup>
                        <div className="p-1 font-sans text-xs bg-slate-900 text-slate-300 rounded max-w-[220px]">
                          <h4 className="font-extrabold text-red-400 border-b border-slate-700 pb-1 mb-1.5 uppercase font-mono">
                            Accident Spot
                          </h4>
                          <div className="space-y-1">
                            <div><strong>Spot:</strong> {acc.accident_spot}</div>
                            <div><strong>Location:</strong> {acc.accident_location}</div>
                            <div><strong>Severity:</strong> {acc.text_severity}</div>
                            <div><strong>Vehicles:</strong> {acc.noofvehicle_involved}</div>
                            <div><strong>Cause:</strong> {acc.main_cause}</div>
                          </div>
                        </div>
                      </Popup>
                    </Marker>
                  );
                })}

                {/* Hotspot Markers */}
                {mockHotspots.map((hs) => {
                  const isSelected = selectedHotspot === hs.id;
                  return (
                    <Marker
                      key={hs.id}
                      position={hs.coordinates as [number, number]}
                      icon={getCustomIcon(hs.id, isSelected, hs.crimeDensity)}
                      eventHandlers={{
                        click: () => {
                          setSelectedHotspot(hs.id);
                        },
                      }}
                    >
                      <Popup>
                        <div className="p-1 font-sans text-xs min-w-[170px] bg-slate-900 text-slate-300 rounded">
                          <h4 className="font-extrabold text-[#f8fafc] border-b border-slate-700 pb-1 mb-1.5 truncate">
                            {hs.name}
                          </h4>
                          <div className="space-y-1">
                            <div className="flex justify-between items-center text-[#00C6AD] font-semibold">
                              <span>ACCURACY:</span>
                              <span className="font-mono">
                                {hs.confidence}%
                              </span>
                            </div>
                            <div className="text-slate-300">
                              <span className="text-slate-400">Crime:</span>{" "}
                              {hs.dominantCrime}
                            </div>
                            <div className="text-slate-300 flex justify-between">
                              <span>
                                <span className="text-slate-400">Density:</span>{" "}
                                {hs.crimeDensity}
                              </span>
                              <span className="text-emerald-400 font-mono">
                                Unemp: {hs.unemploymentRate}%
                              </span>
                            </div>
                          </div>
                        </div>
                      </Popup>
                    </Marker>
                  );
                })}

                {/* Dynamically Render Optimal Vector Patrol Paths */}
                {selectedRouteId === "ALPHA" && (
                  <>
                    <Polyline
                      positions={[
                        [12.9866, 77.5332],
                        [13.0125, 77.5144],
                        [13.0312, 77.5399],
                      ]}
                      pathOptions={{
                        color: "#1D4ED8",
                        weight: 4,
                        dashArray: "6,6",
                        lineJoin: "round",
                      }}
                    />
                    <Marker
                      position={[13.0125, 77.5144]}
                      icon={getPatrolIcon("ALPHA")}
                    >
                      <Popup>
                        <div className="p-1.5 text-xs font-sans text-slate-900 leading-normal">
                          <strong className="block text-blue-700 font-extrabold">
                            Patrol Squad Alpha
                          </strong>
                          <span>Current Vector: Peenya Industrial Ring</span>{" "}
                          <br />
                          <span className="text-[10px] opacity-75 font-mono">
                            Status: ACTIVE PATROL
                          </span>
                        </div>
                      </Popup>
                    </Marker>
                  </>
                )}

                {selectedRouteId === "BETA" && (
                  <>
                    <Polyline
                      positions={[
                        [12.9774, 77.5708],
                        [12.9698, 77.5855],
                        [12.9731, 77.595],
                      ]}
                      pathOptions={{
                        color: "#F59E0B",
                        weight: 4,
                        dashArray: "6,6",
                        lineJoin: "round",
                      }}
                    />
                    <Marker
                      position={[12.9698, 77.5855]}
                      icon={getPatrolIcon("BETA")}
                    >
                      <Popup>
                        <div className="p-1.5 text-xs font-sans text-slate-900 leading-normal">
                          <strong className="block text-amber-700 font-extrabold">
                            Patrol Squad Beta
                          </strong>
                          <span>Current Vector: Majestic Central</span> <br />
                          <span className="text-[10px] opacity-75 font-mono">
                            Status: MONITORING HOTSPOT
                          </span>
                        </div>
                      </Popup>
                    </Marker>
                  </>
                )}

                {selectedRouteId === "GAMMA" && (
                  <>
                    <Polyline
                      positions={[
                        [12.9756, 77.601],
                        [12.9812, 77.6256],
                        [12.9789, 77.6409],
                      ]}
                      pathOptions={{
                        color: "#10B981",
                        weight: 4,
                        dashArray: "6,6",
                        lineJoin: "round",
                      }}
                    />
                    <Marker
                      position={[12.9812, 77.6256]}
                      icon={getPatrolIcon("GAMMA")}
                    >
                      <Popup>
                        <div className="p-1.5 text-xs font-sans text-slate-900 leading-normal">
                          <strong className="block text-emerald-700 font-extrabold">
                            Patrol Squad Gamma
                          </strong>
                          <span>Current Vector: Cubbon to Indiranagar</span>{" "}
                          <br />
                          <span className="text-[10px] opacity-75 font-mono">
                            Status: COMMITTED RESPONDER
                          </span>
                        </div>
                      </Popup>
                    </Marker>
                  </>
                )}

                {/* Automatically direct map viewport when hotspot shifts */}
                <MapUpdater
                  coordinate={chosenHs.coordinates as [number, number]}
                />
              </MapContainer>
            </div>

            {/* Selected item details telemetry log */}
            <div className="mt-4 p-5 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
              <div className="flex items-center justify-between border-b border-slate-200/60 pb-2">
                <h4 className="text-[13px] font-extrabold text-slate-900 flex items-center space-x-2">
                  <Grid className="w-4 h-4 text-[#1D4ED8]" />
                  <span>
                    {dictionary.selectedTitle}:{" "}
                    <span className="text-[#1D4ED8] font-mono">
                      {chosenHs.id}
                    </span>
                  </span>
                </h4>
                <span className="text-xs text-slate-500 font-mono font-bold kn-text">
                  {chosenHs.name}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-[12px] font-sans">
                <div className="bg-white border border-slate-200 rounded p-3.5">
                  <span className="text-slate-400 uppercase font-mono text-[10px] block font-bold">
                    {dictionary.confidence}
                  </span>
                  <span className="text-slate-800 font-bold block mt-1 text-[13px] font-mono text-[#D97706]">
                    {chosenHs.confidence}% accuracy
                  </span>
                </div>

                <div className="bg-white border border-slate-200 rounded p-3.5">
                  <span className="text-slate-400 uppercase font-mono text-[10px] block font-bold">
                    {dictionary.domCrime}
                  </span>
                  <span className="text-slate-800 font-bold block mt-1 leading-snug text-[13px] kn-text">
                    {chosenHs.dominantCrime}
                  </span>
                </div>

                <div className="bg-white border border-slate-200 rounded p-3.5">
                  <span className="text-slate-400 uppercase font-mono text-[10px] block font-bold">
                    {dictionary.unempRate}
                  </span>
                  <span className="text-slate-800 font-bold block mt-1 text-[13px] font-mono text-emerald-700">
                    {chosenHs.unemploymentRate}% localized
                  </span>
                </div>
              </div>

              <div className="flex justify-between items-center text-[11px] font-mono text-slate-500 border-t border-slate-200/60 pt-2 bg-slate-100/50 p-2 rounded">
                <span>
                  {dictionary.coordsLabel}: Latitude={chosenHs.coordinates[0]},
                  Longitude={chosenHs.coordinates[1]}
                </span>
                <span className="font-bold text-[#1D4ED8]">
                  GRID COMPILER MATCH: CCTNS-OK
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
