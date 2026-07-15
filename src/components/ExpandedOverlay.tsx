import React, { useEffect, useRef } from "react";
import { X, MapPin, Network, ShieldAlert, TrendingUp, Clock, Fingerprint, Users, Download } from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell, LineChart, Line, CartesianGrid } from "recharts";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import { WatermarkOverlay } from "./WatermarkOverlay";
import { NetworkGraph } from "./NetworkGraph";
import { downloadJson, downloadHotspotsAsGeoJson, downloadSvgAsPng } from "../lib/widgetExport";

// Leaflet measures its container's size at mount time. Inside a modal that
// animates/expands in, the flex layout hasn't settled to its final size yet
// when that measurement happens, so the tile grid renders as a handful of
// small, disconnected tiles instead of one cohesive map. Forcing
// invalidateSize() once the container has its real dimensions (and again on
// any later resize) fixes it.
const MapSizeFixer: React.FC = () => {
  const map = useMap();
  useEffect(() => {
    const raf = requestAnimationFrame(() => map.invalidateSize());
    const t1 = setTimeout(() => map.invalidateSize(), 150);
    const t2 = setTimeout(() => map.invalidateSize(), 400);
    const onResize = () => map.invalidateSize();
    window.addEventListener("resize", onResize);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(t1);
      clearTimeout(t2);
      window.removeEventListener("resize", onResize);
    };
  }, [map]);
  return null;
};

interface ExpandedOverlayProps {
  type: "map" | "network" | "risk" | "forecast" | "timeline" | "mo_match" | "correlation";
  data: any;
  onClose: () => void;
}

export const ExpandedOverlay: React.FC<ExpandedOverlayProps> = ({ type, data, onClose }) => {
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
                <h3 className="text-sm font-extrabold text-white uppercase tracking-wider font-mono">Geospatial Hotspots Exploration</h3>
              </>
            )}
            {type === "network" && (
              <>
                <Network className="w-5 h-5 text-[#00C6AD]" />
                <h3 className="text-sm font-extrabold text-white uppercase tracking-wider font-mono">Relational Intelligence Network</h3>
              </>
            )}
            {type === "risk" && (
              <>
                <ShieldAlert className="w-5 h-5 text-amber-500" />
                <h3 className="text-sm font-extrabold text-white uppercase tracking-wider font-mono">Explainable Recidivism Risk (SHAP Explainer)</h3>
              </>
            )}
            {type === "forecast" && (
              <>
                <TrendingUp className="w-5 h-5 text-[#00C6AD]" />
                <h3 className="text-sm font-extrabold text-white uppercase tracking-wider font-mono">Seasonal Early Warning Predictions</h3>
              </>
            )}
            {type === "timeline" && (
              <>
                <Clock className="w-5 h-5 text-[#00C6AD]" />
                <h3 className="text-sm font-extrabold text-white uppercase tracking-wider font-mono">Case Investigation Chronology</h3>
              </>
            )}
            {type === "mo_match" && (
              <>
                <Fingerprint className="w-5 h-5 text-amber-500" />
                <h3 className="text-sm font-extrabold text-white uppercase tracking-wider font-mono">Behavioral MO Profiling Matches</h3>
              </>
            )}
            {type === "correlation" && (
              <>
                <Users className="w-5 h-5 text-[#00C6AD]" />
                <h3 className="text-sm font-extrabold text-white uppercase tracking-wider font-mono">District Socio-demographic Dashboard</h3>
              </>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleDownload}
              title={type === "map" ? "Download hotspot coordinates (GeoJSON)" : "Download this view"}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-800 hover:border-[#00C6AD]/40 bg-slate-950/50 hover:bg-slate-800 text-slate-400 hover:text-[#00C6AD] text-xs font-semibold transition-all cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Download</span>
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
          {type === "map" && (
            <div className="h-full flex flex-col gap-4">
              <p className="text-xs text-slate-400">
                Interactive DBSCAN/KDE Map showing clusters of past cases in selected district.
              </p>
              <div className="flex-1 rounded-xl overflow-hidden border border-slate-800 min-h-[300px] relative z-0">
                <MapContainer
                  center={data.hotspots?.[0] ? [data.hotspots[0].lat, data.hotspots[0].lng] : [12.9716, 77.5946]}
                  zoom={12}
                  style={{ height: "100%", width: "100%" }}
                >
                  <TileLayer
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                  />
                  <MapSizeFixer />
                  {(data.hotspots || []).map((marker: any, idx: number) => (
                    <Marker key={idx} position={[marker.lat, marker.lng]}>
                      <Popup>
                        <div className="text-xs font-sans text-slate-900">
                          <span className="font-bold block">{marker.label}</span>
                          Location: {marker.lat.toFixed(5)}, {marker.lng.toFixed(5)}
                        </div>
                      </Popup>
                    </Marker>
                  ))}
                </MapContainer>
              </div>
            </div>
          )}

          {type === "network" && (
            <div className="h-full flex flex-col md:flex-row gap-6">
              {/* Left: real node-link graph traced from live case/co-accused
                  data (or the honestly-labeled fallback simulation when the
                  suspect isn't in the database) -- previously this whole
                  panel read data.phones/data.vehicles/data.co_accused, fields
                  the backend never actually populated, always showing "None". */}
              <div className="flex-1 flex flex-col gap-3 min-w-0">
                <h4 className="font-bold text-slate-200 uppercase tracking-wide text-xs">
                  Syndicate Graph: {data.target_suspect || data.suspect}
                  {data.engine_mode === "Static Fallback Simulation" && (
                    <span className="ml-2 text-amber-500 normal-case font-normal text-[10px]">(simulated — suspect not found in database)</span>
                  )}
                </h4>
                <div className="flex-1 bg-slate-950/60 border border-slate-900 rounded-xl p-2 min-h-[320px]">
                  <NetworkGraph nodes={data.nodes || []} edges={data.edges || []} />
                </div>
              </div>

              {/* Right Transaction Ledger Flow */}
              <div className="md:w-1/3 flex flex-col gap-3">
                <h4 className="font-bold text-slate-200 uppercase tracking-wide text-xs">Linked Financial Transaction Nodes</h4>
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
                    <div className="text-center py-10 text-slate-550">No transaction logs linked to this profile.</div>
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
                  <h4 className="font-black text-slate-100 text-lg">Calibrated Conviction Probability: {data.risk_score || 0}%</h4>
                  <p className="text-xs text-slate-450 mt-1">
                    Computed via calibrated XGBoost risk estimator. SHAP factors indicate localized contributions to final model log-odds.
                  </p>
                </div>
                <div className="px-4 py-2 rounded-xl bg-slate-900 border border-slate-800 text-[#00C6AD] font-mono font-bold text-sm tracking-wide shrink-0">
                  Suspect: {data.suspect || "Unknown"}
                </div>
              </div>

              {/* Horizontal SHAP Explainer Chart */}
              <div className="flex-1 min-h-[300px]">
                <h5 className="font-extrabold text-slate-300 text-xs mb-3 font-mono">SHAP Contribution Waterfall (Descending Impact)</h5>
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
                      itemStyle={{ color: "#00C6AD" }}
                    />
                    <Bar dataKey="value" name="SHAP Contribution">
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
                <h4 className="font-black text-slate-100 text-sm">Target Area Trends & Predictive Projection</h4>
                <p className="text-xs text-slate-450 mt-1">
                  Time-series model forecasts. Evaluates seasonal trends, cyclical variables, and rolling baselines.
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
                <h4 className="font-black text-slate-100 text-sm">Chronological Milestones (Case ID {data.case_id})</h4>
                <p className="text-xs text-slate-450 mt-1">
                  Dynamic trace compiled from occurrence, registry, surrender, and chargesheet archives.
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
                  Modus Operandi Behavior Profile ({data.suspect})
                  {data.engine_mode && data.engine_mode.startsWith("Reference Simulation") && (
                    <span className="ml-2 text-amber-500 normal-case font-normal text-[10px]">(simulated reference set — no live case data available)</span>
                  )}
                </h4>
                <p className="text-xs text-slate-450 mt-1">
                  Cosine similarity ranking against primary historical incident profiles.
                </p>
              </div>
              <div className="flex-1 overflow-y-auto space-y-3">
                {(data.matches || []).map((m: any, idx: number) => (
                  <div key={idx} className="bg-slate-900/60 border border-slate-850 p-4 rounded-lg flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                    <div className="space-y-1">
                      <span className="text-xs font-black text-slate-250">Suspect: {m.suspect || "Unknown"}</span>
                      <p className="text-xs text-slate-400">Incident ID: {m.case_id} | Precinct: {m.station}</p>
                      <p className="text-[11px] text-slate-500 italic mt-1 font-mono">MO: {m.mo_signature || m.signature_narrative || "No narrative details"}</p>
                    </div>
                    <div className="shrink-0 text-right w-full sm:w-auto">
                      <div className="text-xs font-bold text-amber-500 mb-1">{Math.round((m.similarity_score || 0.84) * 100)}% Match Rate</div>
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
                <h4 className="font-black text-slate-100 text-sm">Socio-demographic Profile: {data.profile?.district}</h4>
                <p className="text-xs text-slate-450 mt-1">
                  Correlation indices compiled from socio-economic, literacy, and census registers.
                </p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-1">
                <div className="bg-slate-900/40 border border-slate-850 p-4 rounded-xl space-y-4">
                  <h5 className="text-xs font-bold text-slate-350 tracking-wider uppercase font-mono border-b border-slate-800 pb-1.5">Education & Employment</h5>
                  
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs text-slate-400">
                      <span>Literacy Rate</span>
                      <span className="font-bold text-[#00C6AD]">{data.profile?.literacy}%</span>
                    </div>
                    <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                      <div className="bg-[#00C6AD] h-full" style={{ width: `${data.profile?.literacy}%` }} />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between text-xs text-slate-400">
                      <span>Unemployment Rate</span>
                      <span className="font-bold text-amber-500">{data.profile?.unemployment}%</span>
                    </div>
                    <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                      <div className="bg-amber-500 h-full" style={{ width: `${data.profile?.unemployment * 5}%` }} />
                    </div>
                  </div>
                </div>

                <div className="bg-slate-900/40 border border-slate-850 p-4 rounded-xl space-y-4">
                  <h5 className="text-xs font-bold text-slate-350 tracking-wider uppercase font-mono border-b border-slate-800 pb-1.5">Development Indices</h5>

                  <div className="space-y-1">
                    <div className="flex justify-between text-xs text-slate-400">
                      <span>Economic Stress Index</span>
                      <span className="font-bold text-rose-450">{data.profile?.stress}</span>
                    </div>
                    <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                      <div className="bg-rose-500 h-full" style={{ width: `${data.profile?.stress * 100}%` }} />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between text-xs text-slate-400">
                      <span>Urbanization Index</span>
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
        </div>
      </div>
    </div>
  );
};
