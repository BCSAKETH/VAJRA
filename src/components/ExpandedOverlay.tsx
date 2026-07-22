import React, { useEffect, useRef } from "react";
import { useApp } from "../AppContext";
import { X, MapPin, Network, ShieldAlert, TrendingUp, Clock, Fingerprint, Users, Download, Repeat, Link2 } from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell, LineChart, Line, CartesianGrid } from "recharts";
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import { WatermarkOverlay } from "./WatermarkOverlay";
import { NetworkGraph } from "./NetworkGraph";
import { downloadJson, downloadHotspotsAsGeoJson, downloadSvgAsPng } from "../lib/widgetExport";

// Leaflet measures its container's size at mount time. Inside a modal that
// animates/expands in, the flex layout hasn't settled to its final size yet
// when that measurement happens, so the tile grid renders as a handful of
// small, disconnected tiles instead of one cohesive map -- confirmed live,
// screenshotted mid-render even a second-plus after open. Fixed-delay
// invalidateSize() timers were a guess at how long the animation takes; a
// ResizeObserver reacts to the container's ACTUAL size settling instead, so
// it fires exactly when needed regardless of animation/network timing, with
// the old timers kept only as a cheap early safety net.
//
// The other half of the original "patchy tiles" bug: hotspot rows come from
// a random 300-row DBSCAN sample spanning the whole state (confirmed live --
// clusters as far apart as Kalaburagi and Sindagi), but the map used to
// center on hotspot[0] at a fixed zoom, so most other markers -- and the
// tiles around them -- were never requested at all. fitBounds() to every
// marker's real coordinates fixes that at the source: the visible area now
// always matches what's actually being shown.
const MapSizeAndBoundsFixer: React.FC<{ points: { lat: number; lng: number }[] }> = ({ points }) => {
  const map = useMap();
  const containerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    containerRef.current = map.getContainer();
    const fit = () => {
      map.invalidateSize();
      if (points.length > 0) {
        const bounds = L.latLngBounds(points.map((p) => [p.lat, p.lng] as [number, number]));
        map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
      }
    };

    fit();
    const t1 = setTimeout(fit, 150);
    const t2 = setTimeout(fit, 500);

    let observer: ResizeObserver | null = null;
    if (containerRef.current && typeof ResizeObserver !== "undefined") {
      observer = new ResizeObserver(() => fit());
      observer.observe(containerRef.current);
    }
    const onWindowResize = () => fit();
    window.addEventListener("resize", onWindowResize);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      observer?.disconnect();
      window.removeEventListener("resize", onWindowResize);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, points.length]);

  return null;
};

interface ExpandedOverlayProps {
  type: "map" | "network" | "risk" | "forecast" | "timeline" | "mo_match" | "correlation" | "repeat_offenders" | "crime_groups";
  data: any;
  onClose: () => void;
}

export const ExpandedOverlay: React.FC<ExpandedOverlayProps> = ({ type, data, onClose }) => {
  const { lang } = useApp();
  const contentRef = useRef<HTMLDivElement>(null);

  // ESC key dismiss
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const handleDownload = () => {
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    if (type === "map") {
      downloadHotspotsAsGeoJson(data.hotspots || [], `vajra_hotspots_${stamp}.geojson`);
      return;
    }
    if (type === "network" || type === "risk" || type === "forecast") {
      const svg = contentRef.current?.querySelector("svg");
      if (svg) {
        downloadSvgAsPng(svg as SVGSVGElement, `vajra_${type}_${stamp}.png`);
        return;
      }
    }
    // Timeline / mo_match / correlation (and any SVG-less fallback): the
    // underlying structured data is the exportable artifact.
    downloadJson(data, `vajra_${type}_${stamp}.json`);
  };

  // Formulate SHAP factor data for recharts
  const shapData = (data.shap_factors || []).map((f: any) => ({
    name: f.name,
    value: parseFloat(f.value),
    contribution: f.contribution,
  }));

  // Formulate forecast data for recharts
  const forecastData = (data.forecast || []).map((f: any, idx: number) => ({
    name: f.period || `P-${idx + 1}`,
    Predicted: f.predicted,
    Baseline: f.historical_avg || 10.0,
  }));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 md:p-10 bg-slate-950/80 backdrop-blur-md animate-fade-in">
      {/* Repeating Diagonal Security Watermark Overlay */}
      <WatermarkOverlay />

      {/* Modal Container */}
      <div className="w-full max-w-5xl h-[85vh] glass-panel border border-slate-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden relative">
        {/* Top Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between shrink-0 bg-slate-900/40">
          <div className="flex items-center gap-2">
            {type === "map" && (
              <>
                <MapPin className="w-5 h-5 text-[#00C6AD]" />
                <h3 className="text-sm font-extrabold text-white uppercase tracking-wider font-mono">{lang === "en" ? "Geospatial Hotspots Exploration" : "ಭೌಗೋಳಿಕ ಹಾಟ್‌ಸ್ಪಾಟ್ ಪರಿಶೋಧನೆ"}</h3>
              </>
            )}
            {type === "network" && (
              <>
                <Network className="w-5 h-5 text-[#00C6AD]" />
                <h3 className="text-sm font-extrabold text-white uppercase tracking-wider font-mono">{lang === "en" ? "Relational Intelligence Network" : "ಸಂಬಂಧಾತ್ಮಕ ಗುಪ್ತಚಾರ ಜಾಲ"}</h3>
              </>
            )}
            {type === "risk" && (
              <>
                <ShieldAlert className="w-5 h-5 text-amber-500" />
                <h3 className="text-sm font-extrabold text-white uppercase tracking-wider font-mono">{lang === "en" ? "Explainable Recidivism Risk (SHAP Explainer)" : "ವಿವರಣಾತ್ಮಕ ಮರುಅಪರಾಧ ಅಪಾಯ (SHAP ವಿವರಣೆ)"}</h3>
              </>
            )}
            {type === "forecast" && (
              <>
                <TrendingUp className="w-5 h-5 text-[#00C6AD]" />
                <h3 className="text-sm font-extrabold text-white uppercase tracking-wider font-mono">{lang === "en" ? "Seasonal Early Warning Predictions" : "ಋತುಮಾನ ಮುಂಚಿತ ಎಚ್ಚರಿಕೆ ಮುನ್ಸೂಚನೆಗಳು"}</h3>
              </>
            )}
            {type === "timeline" && (
              <>
                <Clock className="w-5 h-5 text-[#00C6AD]" />
                <h3 className="text-sm font-extrabold text-white uppercase tracking-wider font-mono">{lang === "en" ? "Case Investigation Chronology" : "ಪ್ರಕರಣ ತನಿಖಾ ಕಾಲಾನುಕ್ರಮ"}</h3>
              </>
            )}
            {type === "mo_match" && (
              <>
                <Fingerprint className="w-5 h-5 text-amber-500" />
                <h3 className="text-sm font-extrabold text-white uppercase tracking-wider font-mono">{lang === "en" ? "Behavioral MO Profiling Matches" : "ವರ್ತನೆಯ MO ಪ್ರೊಫೈಲಿಂಗ್ ಹೊಂದಾಣಿಕೆಗಳು"}</h3>
              </>
            )}
            {type === "correlation" && (
              <>
                <Users className="w-5 h-5 text-[#00C6AD]" />
                <h3 className="text-sm font-extrabold text-white uppercase tracking-wider font-mono">{lang === "en" ? "District Socio-demographic Dashboard" : "ಜಿಲ್ಲಾ ಸಾಮಾಜಿಕ-ಜನಸಂಖ್ಯಾ ಡ್ಯಾಶ್‌ಬೋರ್ಡ್"}</h3>
              </>
            )}
            {type === "repeat_offenders" && (
              <>
                <Repeat className="w-5 h-5 text-amber-500" />
                <h3 className="text-sm font-extrabold text-white uppercase tracking-wider font-mono">{lang === "en" ? "Repeat Offender Roster" : "ಪುನರಾವರ್ತಿತ ಅಪರಾಧಿಗಳ ಪಟ್ಟಿ"}</h3>
              </>
            )}
            {type === "crime_groups" && (
              <>
                <Link2 className="w-5 h-5 text-amber-500" />
                <h3 className="text-sm font-extrabold text-white uppercase tracking-wider font-mono">{lang === "en" ? "Detected Organized Crime Groups" : "ಪತ್ತೆಯಾದ ಸಂಘಟಿತ ಅಪರಾಧ ಗುಂಪುಗಳು"}</h3>
              </>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleDownload}
              title={type === "map" ? (lang === "en" ? "Download hotspot coordinates (GeoJSON)" : "ಹಾಟ್‌ಸ್ಪಾಟ್ ನಿರ್ದೇಶಾಂಕಗಳನ್ನು ಡೌನ್‌ಲೋಡ್ ಮಾಡಿ (GeoJSON)") : (lang === "en" ? "Download this view" : "ಈ ನೋಟವನ್ನು ಡೌನ್‌ಲೋಡ್ ಮಾಡಿ")}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-800 hover:border-[#00C6AD]/40 bg-slate-950/50 hover:bg-slate-800 text-slate-400 hover:text-[#00C6AD] text-xs font-semibold transition-all cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{lang === "en" ? "Download" : "ಡೌನ್‌ಲೋಡ್"}</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg border border-slate-800 hover:border-slate-700 bg-slate-950/50 hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-all cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content Pane */}
        <div ref={contentRef} className="flex-1 p-6 overflow-y-auto bg-slate-950/15">
          {type === "map" && (() => {
            const hotspots: { lat: number; lng: number; label?: string }[] = data.hotspots || [];
            return (
              <div className="h-full flex flex-col gap-4">
                <p className="text-xs text-slate-400">
                  {lang === "en" ? "Interactive DBSCAN/KDE Map showing clusters of past cases in selected district." : "ಆಯ್ದ ಜಿಲ್ಲೆಯಲ್ಲಿನ ಹಿಂದಿನ ಪ್ರಕರಣಗಳ ಸಮೂಹಗಳನ್ನು ತೋರಿಸುವ ಇಂಟರಾಕ್ಟಿವ್ DBSCAN/KDE ನಕ್ಷೆ."}
                </p>
                <div className="flex-1 rounded-xl overflow-hidden border border-slate-800 min-h-[300px] relative z-0">
                  <MapContainer
                    center={hotspots[0] ? [hotspots[0].lat, hotspots[0].lng] : [12.9716, 77.5946]}
                    zoom={12}
                    style={{ height: "100%", width: "100%" }}
                  >
                    <TileLayer
                      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    />
                    <MapSizeAndBoundsFixer points={hotspots} />
                    {hotspots.map((marker, idx) => {
                      // Hotspot labels from the DBSCAN path read "DBSCAN
                      // Hotspot N (M incidents)" -- pull the count to scale
                      // the highlight so denser clusters read as visually
                      // bigger, not just another same-size pin.
                      const countMatch = marker.label?.match(/\((\d+)\s*incidents?\)/i);
                      const incidentCount = countMatch ? parseInt(countMatch[1], 10) : null;
                      const radius = incidentCount ? Math.min(28, 10 + incidentCount * 1.5) : 12;
                      return (
                        <CircleMarker
                          key={idx}
                          center={[marker.lat, marker.lng]}
                          radius={radius}
                          pathOptions={{
                            color: "#00C6AD",
                            weight: 2,
                            fillColor: "#00C6AD",
                            fillOpacity: 0.35,
                          }}
                        >
                          <Popup>
                            <div className="text-xs font-sans text-slate-900">
                              <span className="font-bold block">{marker.label}</span>
                              Location: {marker.lat.toFixed(5)}, {marker.lng.toFixed(5)}
                            </div>
                          </Popup>
                        </CircleMarker>
                      );
                    })}
                  </MapContainer>
                </div>
              </div>
            );
          })()}

          {type === "network" && (
            <div className="h-full flex flex-col md:flex-row gap-6">
              {/* Left: real node-link graph traced from live case/co-accused
                  data (or the honestly-labeled fallback simulation when the
                  suspect isn't in the database) -- previously this whole
                  panel read data.phones/data.vehicles/data.co_accused, fields
                  the backend never actually populated, always showing "None". */}
              <div className="flex-1 flex flex-col gap-3 min-w-0">
                <h4 className="font-bold text-slate-200 uppercase tracking-wide text-xs">
                  {lang === "en" ? "Syndicate Graph:" : "ಜಾಲ ಗ್ರಾಫ್:"} {data.target_suspect || data.suspect}
                  {data.engine_mode === "Static Fallback Simulation" && (
                    <span className="ml-2 text-amber-500 normal-case font-normal text-[10px]">{lang === "en" ? "(simulated — suspect not found in database)" : "(ಸಿಮ್ಯುಲೇಟೆಡ್ — ಶಂಕಿತರು ಡೇಟಾಬೇಸ್‌ನಲ್ಲಿ ಕಂಡುಬಂದಿಲ್ಲ)"}</span>
                  )}
                </h4>
                <div className="flex-1 bg-slate-950/60 border border-slate-900 rounded-xl p-2 min-h-[320px]">
                  <NetworkGraph nodes={data.nodes || []} edges={data.edges || []} />
                </div>
              </div>

              {/* Right Transaction Ledger Flow */}
              <div className="md:w-1/3 flex flex-col gap-3">
                <h4 className="font-bold text-slate-200 uppercase tracking-wide text-xs">{lang === "en" ? "Linked Financial Transaction Nodes" : "ಜೋಡಿಸಲಾದ ಹಣಕಾಸು ವಹಿವಾಟು ನೋಡ್‌ಗಳು"}</h4>
                <div className="flex-1 bg-slate-950/60 border border-slate-900 rounded-xl p-4 overflow-y-auto max-h-[350px]">
                  {data.financial_transactions && data.financial_transactions.length > 0 ? (
                    <div className="space-y-2">
                      {data.financial_transactions.map((tx: any, idx: number) => (
                        <div key={idx} className="flex justify-between items-center bg-slate-900/50 p-2.5 rounded border border-slate-850 font-mono text-[11px]">
                          <div>
                            <span className="text-[#00C6AD] font-bold">{tx.sender}</span>
                            <span className="text-slate-500 mx-1">&rarr;</span>
                            <span className="text-slate-350">{tx.receiver}</span>
                          </div>
                          <div className="text-right">
                            <span className="text-amber-500 font-extrabold">₹{tx.amount?.toLocaleString() || "0"}</span>
                            <span className="block text-[9px] text-slate-500">{tx.txn_time || "N/A"}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-10 text-slate-550">{lang === "en" ? "No transaction logs linked to this profile." : "ಈ ಪ್ರೊಫೈಲ್‌ಗೆ ಯಾವುದೇ ವಹಿವಾಟು ದಾಖಲೆಗಳು ಜೋಡಣೆಯಾಗಿಲ್ಲ."}</div>
                  )}
                </div>
              </div>
            </div>
          )}

          {type === "risk" && (
            <div className="h-full flex flex-col gap-6">
              {/* Risk Gauge Header */}
              <div className="flex flex-col sm:flex-row items-center justify-between bg-slate-900/25 border border-slate-850 p-4 rounded-xl gap-4">
                <div>
                  <h4 className="font-black text-slate-100 text-lg">{lang === "en" ? "Calibrated Conviction Probability:" : "ಪರಿಷ್ಕೃತ ಅಪರಾಧ ಸಾಧ್ಯತೆ:"} {data.risk_score || 0}%</h4>
                  <p className="text-xs text-slate-450 mt-1">
                    {lang === "en" ? "Computed via calibrated XGBoost risk estimator. SHAP factors indicate localized contributions to final model log-odds." : "ಪರಿಷ್ಕೃತ XGBoost ಅಪಾಯ ಅಂದಾಜುದಾರ ಮೂಲಕ ಲೆಕ್ಕಹಾಕಲಾಗಿದೆ. SHAP ಅಂಶಗಳು ಅಂತಿಮ ಮಾದರಿ ಫಲಿತಾಂಶಕ್ಕೆ ಸ್ಥಳೀಯ ಕೊಡುಗೆಗಳನ್ನು ಸೂಚಿಸುತ್ತವೆ."}
                  </p>
                </div>
                <div className="px-4 py-2 rounded-xl bg-slate-900 border border-slate-800 text-[#00C6AD] font-mono font-bold text-sm tracking-wide shrink-0">
                  {lang === "en" ? "Suspect:" : "ಶಂಕಿತ:"} {data.suspect || (lang === "en" ? "Unknown" : "ಅಜ್ಞಾತ")}
                </div>
              </div>

              {/* Horizontal SHAP Explainer Chart */}
              <div className="flex-1 min-h-[300px]">
                <div className="flex items-center justify-between mb-3">
                  <h5 className="font-extrabold text-slate-300 text-xs font-mono">{lang === "en" ? "SHAP Contribution Waterfall (Descending Impact)" : "SHAP ಕೊಡುಗೆ ಜಲಪಾತ (ಇಳಿಕೆ ಪರಿಣಾಮ)"}</h5>
                  {/* Legend -- two-color diverging encoding (raises vs lowers
                      risk) needs its meaning stated explicitly; color alone
                      doesn't say which direction is "worse". */}
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: "#F59E0B" }} />
                      <span className="text-[9.5px] font-mono text-slate-400">{lang === "en" ? "Increases risk" : "ಅಪಾಯ ಹೆಚ್ಚಿಸುತ್ತದೆ"}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: "#00C6AD" }} />
                      <span className="text-[9.5px] font-mono text-slate-400">{lang === "en" ? "Decreases risk" : "ಅಪಾಯ ಕಡಿಮೆಗೊಳಿಸುತ್ತದೆ"}</span>
                    </div>
                  </div>
                </div>
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart
                    data={shapData}
                    layout="vertical"
                    margin={{ top: 5, right: 30, left: 120, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" />
                    <XAxis type="number" stroke="#475569" fontSize={10} />
                    <YAxis dataKey="name" type="category" stroke="#94A3B8" fontSize={9.5} />
                    <Tooltip
                      contentStyle={{ background: "rgba(10, 22, 40, 0.95)", border: "1px solid #1e293b", color: "#f8fafc" }}
                      formatter={(value: number, _name, item: any) => [
                        `${value} (${item?.payload?.contribution === "positive" ? (lang === "en" ? "increases risk" : "ಅಪಾಯ ಹೆಚ್ಚಿಸುತ್ತದೆ") : (lang === "en" ? "decreases risk" : "ಅಪಾಯ ಕಡಿಮೆಗೊಳಿಸುತ್ತದೆ")})`,
                        lang === "en" ? "SHAP Contribution" : "SHAP ಕೊಡುಗೆ",
                      ]}
                    />
                    <Bar dataKey="value" name="SHAP Contribution" radius={[0, 4, 4, 0]}>
                      {shapData.map((entry: any, index: number) => {
                        const isPos = entry.contribution === "positive";
                        return <Cell key={`cell-${index}`} fill={isPos ? "#F59E0B" : "#00C6AD"} />;
                      })}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {type === "forecast" && (
            <div className="h-full flex flex-col gap-6">
              <div className="bg-slate-900/25 border border-slate-850 p-4 rounded-xl">
                <h4 className="font-black text-slate-100 text-sm">{lang === "en" ? "Target Area Trends & Predictive Projection" : "ಗುರಿ ಪ್ರದೇಶ ಪ್ರವೃತ್ತಿಗಳು ಮತ್ತು ಮುನ್ಸೂಚನಾ ಪ್ರೊಜೆಕ್ಷನ್"}</h4>
                <p className="text-xs text-slate-450 mt-1">
                  {lang === "en" ? "Time-series model forecasts. Evaluates seasonal trends, cyclical variables, and rolling baselines." : "ಟೈಮ್-ಸೀರೀಸ್ ಮಾದರಿ ಮುನ್ಸೂಚನೆಗಳು. ಋತುಮಾನ ಪ್ರವೃತ್ತಿಗಳು, ಆವರ್ತಕ ಅಸ್ಥಿರಗಳು ಮತ್ತು ರೋಲಿಂಗ್ ಬೇಸ್‌ಲೈನ್‌ಗಳನ್ನು ಮೌಲ್ಯಮಾಪನ ಮಾಡುತ್ತದೆ."}
                </p>
              </div>

              {/* Line Chart */}
              <div className="flex-1 min-h-[280px]">
                <ResponsiveContainer width="100%" height={260}>
                  <LineChart data={forecastData} margin={{ top: 10, right: 30, left: 10, bottom: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" />
                    <XAxis dataKey="name" stroke="#94A3B8" fontSize={10} />
                    <YAxis stroke="#94A3B8" fontSize={10} />
                    <Tooltip
                      contentStyle={{ background: "rgba(10, 22, 40, 0.95)", border: "1px solid #1e293b" }}
                    />
                    <Line type="monotone" dataKey="Predicted" stroke="#F59E0B" strokeWidth={2.5} activeDot={{ r: 6 }} />
                    <Line type="monotone" dataKey="Baseline" stroke="#00C6AD" strokeWidth={2} strokeDasharray="5 5" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {type === "timeline" && (
            <div className="h-full flex flex-col gap-6">
              <div className="bg-slate-900/25 border border-slate-850 p-4 rounded-xl">
                <h4 className="font-black text-slate-100 text-sm">{lang === "en" ? `Chronological Milestones (Case ID ${data.case_id})` : `ಕಾಲಾನುಕ್ರಮ ಮೈಲಿಗಲ್ಲುಗಳು (ಪ್ರಕರಣ ID ${data.case_id})`}</h4>
                <p className="text-xs text-slate-450 mt-1">
                  {lang === "en" ? "Dynamic trace compiled from occurrence, registry, surrender, and chargesheet archives." : "ಘಟನೆ, ನೋಂದಣಿ, ಶರಣಾಗತಿ ಮತ್ತು ಚಾರ್ಜ್‌ಶೀಟ್ ದಾಖಲೆಗಳಿಂದ ಸಂಗ್ರಹಿಸಲಾದ ಕ್ರಿಯಾತ್ಮಕ ಜಾಡು."}
                </p>
              </div>
              <div className="flex-1 overflow-y-auto pr-2">
                <div className="relative border-l border-[#00C6AD]/30 ml-4 space-y-6 py-2">
                  {(data.timeline || []).map((e: any, idx: number) => (
                    <div key={idx} className="relative pl-6">
                      <div className="absolute -left-[5px] top-1.5 w-2.5 h-2.5 rounded-full bg-[#00C6AD]" />
                      <div className="bg-slate-900/60 border border-slate-850 p-3 rounded-lg">
                        <span className="text-[10px] font-mono text-[#00C6AD] font-bold block">{e.date}</span>
                        <span className="text-xs font-extrabold text-slate-200 block mt-0.5">{e.event}</span>
                        <p className="text-xs text-slate-400 mt-1">{e.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {type === "mo_match" && (
            <div className="h-full flex flex-col gap-6">
              <div className="bg-slate-900/25 border border-slate-850 p-4 rounded-xl">
                <h4 className="font-black text-slate-100 text-sm">
                  {lang === "en" ? `Modus Operandi Behavior Profile (${data.suspect})` : `ಕಾರ್ಯವಿಧಾನ ವರ್ತನೆಯ ಪ್ರೊಫೈಲ್ (${data.suspect})`}
                  {data.engine_mode && data.engine_mode.startsWith("Reference Simulation") && (
                    <span className="ml-2 text-amber-500 normal-case font-normal text-[10px]">{lang === "en" ? "(simulated reference set — no live case data available)" : "(ಸಿಮ್ಯುಲೇಟೆಡ್ ಉಲ್ಲೇಖ ಸೆಟ್ — ನೈಜ ಪ್ರಕರಣ ಡೇಟಾ ಲಭ್ಯವಿಲ್ಲ)"}</span>
                  )}
                </h4>
                <p className="text-xs text-slate-450 mt-1">
                  {lang === "en" ? "Cosine similarity ranking against primary historical incident profiles." : "ಪ್ರಾಥಮಿಕ ಐತಿಹಾಸಿಕ ಘಟನಾ ಪ್ರೊಫೈಲ್‌ಗಳ ವಿರುದ್ಧ ಕೊಸೈನ್ ಸಾಮ್ಯತೆ ಶ್ರೇಣಿ."}
                </p>
              </div>
              <div className="flex-1 overflow-y-auto space-y-3">
                {(data.matches || []).map((m: any, idx: number) => (
                  <div key={idx} className="bg-slate-900/60 border border-slate-850 p-4 rounded-lg flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                    <div className="space-y-1">
                      <span className="text-xs font-black text-slate-250">{lang === "en" ? "Suspect:" : "ಶಂಕಿತ:"} {m.suspect || (lang === "en" ? "Unknown" : "ಅಜ್ಞಾತ")}</span>
                      <p className="text-xs text-slate-400">{lang === "en" ? "Incident ID:" : "ಘಟನೆ ID:"} {m.case_id} | {lang === "en" ? "Precinct:" : "ಠಾಣೆ:"} {m.station}</p>
                      <p className="text-[11px] text-slate-500 italic mt-1 font-mono">MO: {m.mo_signature || m.signature_narrative || (lang === "en" ? "No narrative details" : "ವಿವರಣೆ ಲಭ್ಯವಿಲ್ಲ")}</p>
                    </div>
                    <div className="shrink-0 text-right w-full sm:w-auto">
                      <div className="text-xs font-bold text-amber-500 mb-1">{Math.round((m.similarity_score || 0.84) * 100)}% {lang === "en" ? "Match Rate" : "ಹೊಂದಾಣಿಕೆ ದರ"}</div>
                      <div className="w-32 bg-slate-850 h-1.5 rounded-full overflow-hidden">
                        <div className="bg-amber-500 h-full" style={{ width: `${(m.similarity_score || 0.84) * 100}%` }} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {type === "correlation" && (
            <div className="h-full flex flex-col gap-6">
              <div className="bg-slate-900/25 border border-slate-850 p-4 rounded-xl">
                <h4 className="font-black text-slate-100 text-sm">{lang === "en" ? "Socio-demographic Profile:" : "ಸಾಮಾಜಿಕ-ಜನಸಂಖ್ಯಾ ಪ್ರೊಫೈಲ್:"} {data.profile?.district}</h4>
                <p className="text-xs text-slate-450 mt-1">
                  {lang === "en" ? "Correlation indices compiled from socio-economic, literacy, and census registers." : "ಸಾಮಾಜಿಕ-ಆರ್ಥಿಕ, ಸಾಕ್ಷರತೆ ಮತ್ತು ಜನಗಣತಿ ದಾಖಲೆಗಳಿಂದ ಸಂಗ್ರಹಿಸಿದ ಸಂಬಂಧ ಸೂಚ್ಯಂಕಗಳು."}
                </p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-1">
                <div className="bg-slate-900/40 border border-slate-850 p-4 rounded-xl space-y-4">
                  <h5 className="text-xs font-bold text-slate-350 tracking-wider uppercase font-mono border-b border-slate-800 pb-1.5">{lang === "en" ? "Education & Employment" : "ಶಿಕ್ಷಣ ಮತ್ತು ಉದ್ಯೋಗ"}</h5>

                  <div className="space-y-1">
                    <div className="flex justify-between text-xs text-slate-400">
                      <span>{lang === "en" ? "Literacy Rate" : "ಸಾಕ್ಷರತಾ ಪ್ರಮಾಣ"}</span>
                      <span className="font-bold text-[#00C6AD]">{data.profile?.literacy}%</span>
                    </div>
                    <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                      <div className="bg-[#00C6AD] h-full" style={{ width: `${data.profile?.literacy}%` }} />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between text-xs text-slate-400">
                      <span>{lang === "en" ? "Unemployment Rate" : "ನಿರುದ್ಯೋಗ ಪ್ರಮಾಣ"}</span>
                      <span className="font-bold text-amber-500">{data.profile?.unemployment}%</span>
                    </div>
                    <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                      <div className="bg-amber-500 h-full" style={{ width: `${data.profile?.unemployment * 5}%` }} />
                    </div>
                  </div>
                </div>

                <div className="bg-slate-900/40 border border-slate-850 p-4 rounded-xl space-y-4">
                  <h5 className="text-xs font-bold text-slate-350 tracking-wider uppercase font-mono border-b border-slate-800 pb-1.5">{lang === "en" ? "Development Indices" : "ಅಭಿವೃದ್ಧಿ ಸೂಚ್ಯಂಕಗಳು"}</h5>

                  <div className="space-y-1">
                    <div className="flex justify-between text-xs text-slate-400">
                      <span>{lang === "en" ? "Economic Stress Index" : "ಆರ್ಥಿಕ ಒತ್ತಡ ಸೂಚ್ಯಂಕ"}</span>
                      <span className="font-bold text-rose-450">{data.profile?.stress}</span>
                    </div>
                    <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                      <div className="bg-rose-500 h-full" style={{ width: `${data.profile?.stress * 100}%` }} />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between text-xs text-slate-400">
                      <span>{lang === "en" ? "Urbanization Index" : "ನಗರೀಕರಣ ಸೂಚ್ಯಂಕ"}</span>
                      <span className="font-bold text-[#00C6AD]">{data.profile?.urbanization}</span>
                    </div>
                    <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                      <div className="bg-[#00C6AD] h-full" style={{ width: `${data.profile?.urbanization * 100}%` }} />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {type === "repeat_offenders" && (
            <div className="h-full flex flex-col gap-4">
              <div className="bg-slate-900/25 border border-slate-850 p-4 rounded-xl">
                <h4 className="font-black text-slate-100 text-sm">
                  {lang === "en"
                    ? `${(data.offenders || []).length} Repeat Offender(s)${data.district_filter ? ` — ${data.district_filter}` : ""}`
                    : `${(data.offenders || []).length} ಪುನರಾವರ್ತಿತ ಅಪರಾಧಿಗಳು${data.district_filter ? ` — ${data.district_filter}` : ""}`}
                </h4>
                <p className="text-xs text-slate-450 mt-1">
                  {lang === "en"
                    ? "Accused persons appearing in multiple separate cases, per the scheduled repeat-offender detection job."
                    : "ನಿಗದಿತ ಪುನರಾವರ್ತಿತ-ಅಪರಾಧಿ ಪತ್ತೆ ಕೆಲಸದ ಪ್ರಕಾರ ಹಲವಾರು ಪ್ರತ್ಯೇಕ ಪ್ರಕರಣಗಳಲ್ಲಿ ಕಾಣಿಸಿಕೊಂಡ ಆರೋಪಿಗಳು."}
                </p>
              </div>
              <div className="flex-1 overflow-y-auto space-y-2">
                {(data.offenders || []).map((o: any, idx: number) => (
                  <div key={idx} className="bg-slate-900/60 border border-slate-850 p-3.5 rounded-lg flex justify-between items-center gap-3">
                    <div className="space-y-0.5 min-w-0">
                      <span className="text-xs font-black text-slate-250 block truncate">{o.suspect}</span>
                      <span className="text-[11px] text-slate-450">{o.district}</span>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="text-sm font-black text-amber-500">{o.case_count}</div>
                      <div className="text-[9px] text-slate-500 uppercase tracking-wider">{lang === "en" ? "cases" : "ಪ್ರಕರಣಗಳು"}</div>
                    </div>
                  </div>
                ))}
                {(data.offenders || []).length === 0 && (
                  <div className="text-center py-10 text-slate-550">{lang === "en" ? "No repeat offenders on record." : "ಯಾವುದೇ ಪುನರಾವರ್ತಿತ ಅಪರಾಧಿಗಳ ದಾಖಲೆ ಇಲ್ಲ."}</div>
                )}
              </div>
            </div>
          )}

          {type === "crime_groups" && (
            <div className="h-full flex flex-col gap-4">
              <div className="bg-slate-900/25 border border-slate-850 p-4 rounded-xl">
                <h4 className="font-black text-slate-100 text-sm">
                  {lang === "en" ? `${(data.groups || []).length} Likely Organized Group(s)` : `${(data.groups || []).length} ಸಂಭವನೀಯ ಸಂಘಟಿತ ಗುಂಪುಗಳು`}
                </h4>
                <p className="text-xs text-slate-450 mt-1">
                  {lang === "en"
                    ? "Clusters of accused persons sharing 2 or more separate cases together — a repeated co-offense pattern, not a one-off coincidence."
                    : "2 ಅಥವಾ ಹೆಚ್ಚು ಪ್ರತ್ಯೇಕ ಪ್ರಕರಣಗಳನ್ನು ಒಟ್ಟಿಗೆ ಹಂಚಿಕೊಂಡ ಆರೋಪಿಗಳ ಸಮೂಹಗಳು — ಪುನರಾವರ್ತಿತ ಸಹ-ಅಪರಾಧ ಮಾದರಿ, ಒಂದೇ ಬಾರಿಯ ಕಾಕತಾಳೀಯವಲ್ಲ."}
                  {data.scan_scope && (
                    <span className="block mt-1 text-slate-550 italic">
                      {lang === "en" ? `Scope: ${data.scan_scope}.` : `ವ್ಯಾಪ್ತಿ: ${data.scan_scope}.`}
                    </span>
                  )}
                </p>
              </div>
              <div className="flex-1 overflow-y-auto space-y-3">
                {(data.groups || []).map((g: any, idx: number) => (
                  <div key={idx} className="bg-slate-900/60 border border-slate-850 p-4 rounded-lg space-y-2">
                    <div className="flex justify-between items-start gap-3">
                      <div className="flex flex-wrap gap-1.5">
                        {(g.members || []).map((m: string, mi: number) => (
                          <span key={mi} className="px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/25 text-amber-450 text-[11px] font-bold">{m}</span>
                        ))}
                      </div>
                      <div className="shrink-0 text-right">
                        <div className="text-sm font-black text-[#00C6AD]">{g.shared_case_count}</div>
                        <div className="text-[9px] text-slate-500 uppercase tracking-wider">{lang === "en" ? "shared cases" : "ಹಂಚಿದ ಪ್ರಕರಣಗಳು"}</div>
                      </div>
                    </div>
                    {g.case_ids && g.case_ids.length > 0 && (
                      <div className="text-[10px] text-slate-500 font-mono truncate">
                        {lang === "en" ? "Case IDs: " : "ಪ್ರಕರಣ ID: "}{g.case_ids.join(", ")}
                      </div>
                    )}
                  </div>
                ))}
                {(data.groups || []).length === 0 && (
                  <div className="text-center py-10 text-slate-550">{lang === "en" ? "No repeated co-offense clusters found." : "ಯಾವುದೇ ಪುನರಾವರ್ತಿತ ಸಹ-ಅಪರಾಧ ಸಮೂಹಗಳು ಕಂಡುಬಂದಿಲ್ಲ."}</div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
