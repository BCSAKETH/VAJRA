import React, { useEffect } from "react";
import { X, MapPin, Network, ShieldAlert, TrendingUp } from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell, LineChart, Line, CartesianGrid } from "recharts";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import { WatermarkOverlay } from "./WatermarkOverlay";

interface ExpandedOverlayProps {
  type: "map" | "network" | "risk" | "forecast";
  data: any;
  onClose: () => void;
}

export const ExpandedOverlay: React.FC<ExpandedOverlayProps> = ({ type, data, onClose }) => {
  // ESC key dismiss
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

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
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg border border-slate-800 hover:border-slate-700 bg-slate-950/50 hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-all cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Pane */}
        <div className="flex-1 p-6 overflow-y-auto bg-slate-950/15">
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
              {/* Left Details List */}
              <div className="md:w-1/3 space-y-4">
                <h4 className="font-bold text-slate-200 uppercase tracking-wide text-xs">Syndicate Profile: {data.suspect}</h4>
                <div className="glass-card p-4 space-y-3 border border-slate-850">
                  <div className="text-xs text-slate-400">
                    <span className="block font-semibold text-slate-350">Active Links:</span>
                    Phones: {data.phones?.join(", ") || "None"}
                  </div>
                  <div className="text-xs text-slate-400">
                    <span className="block font-semibold text-slate-350">Vehicles Traced:</span>
                    {data.vehicles?.join(", ") || "None"}
                  </div>
                  <div className="text-xs text-slate-400">
                    <span className="block font-semibold text-slate-350">Co-Accused / Companions:</span>
                    {data.co_accused?.join(", ") || "None"}
                  </div>
                </div>
              </div>

              {/* Right Transaction Ledger Flow */}
              <div className="flex-1 flex flex-col gap-3">
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
        </div>
      </div>
    </div>
  );
};
