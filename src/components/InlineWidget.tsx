import React from "react";
import { Maximize2, ShieldAlert, MapPin, Network, TrendingUp, AlertTriangle } from "lucide-react";

interface InlineWidgetProps {
  type: "map" | "network" | "risk" | "forecast";
  data: any;
  onExpand: () => void;
}

export const InlineWidget: React.FC<InlineWidgetProps> = ({ type, data, onExpand }) => {
  return (
    <div className="glass-card rounded-xl border border-slate-800 p-4 shadow-lg animate-fade-in relative overflow-hidden">
      {/* Header Info */}
      <div className="flex items-center justify-between border-b border-slate-850 pb-2 mb-3">
        <div className="flex items-center gap-2">
          {type === "map" && (
            <>
              <MapPin className="w-4 h-4 text-[#00C6AD]" />
              <span className="text-xs font-bold text-[#00C6AD] tracking-wider uppercase font-mono">Geospatial Incident Hotspots</span>
            </>
          )}
          {type === "network" && (
            <>
              <Network className="w-4 h-4 text-[#00C6AD]" />
              <span className="text-xs font-bold text-[#00C6AD] tracking-wider uppercase font-mono">Criminal Syndicate Graph</span>
            </>
          )}
          {type === "risk" && (
            <>
              <ShieldAlert className="w-4 h-4 text-amber-500" />
              <span className="text-xs font-bold text-amber-500 tracking-wider uppercase font-mono">Offender Recidivism Risk</span>
            </>
          )}
          {type === "forecast" && (
            <>
              <TrendingUp className="w-4 h-4 text-[#00C6AD]" />
              <span className="text-xs font-bold text-[#00C6AD] tracking-wider uppercase font-mono">Seasonal Trend Forecast</span>
            </>
          )}
        </div>

        <button
          onClick={onExpand}
          className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
          title="Expand View"
        >
          <Maximize2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Widget Layouts */}
      <div className="text-xs space-y-2">
        {type === "map" && (
          <div className="space-y-2">
            <p className="text-slate-400">
              Resolved <span className="font-bold text-slate-200">{data.hotspots?.length || 0}</span> coordinate points.
            </p>
            <div className="bg-slate-950/65 rounded-lg p-2.5 font-mono text-[10px] text-slate-400 border border-slate-900">
              Coordinates range: {data.hotspots?.[0] ? `${data.hotspots[0].lat}, ${data.hotspots[0].lng}` : "No points mapped"}
            </div>
          </div>
        )}

        {type === "network" && (
          <div className="space-y-2">
            <p className="text-slate-400">
              Traced connections for <span className="font-extrabold text-slate-200">{data.suspect || "Suspect"}</span>.
            </p>
            <div className="bg-slate-950/65 rounded-lg p-2.5 space-y-1.5 font-mono text-[10px] border border-slate-900">
              <div className="text-slate-300 font-bold">Associated Entities:</div>
              <div className="text-slate-400">
                Phones: {data.phones?.join(", ") || "None"} | Vehicles: {data.vehicles?.join(", ") || "None"}
              </div>
            </div>
          </div>
        )}

        {type === "risk" && (
          <div className="flex gap-4 items-center">
            {/* Animated Circular Gauge */}
            <div className="relative w-16 h-16 shrink-0 flex items-center justify-center">
              <svg className="w-full h-full transform -rotate-90">
                <circle cx="32" cy="32" r="28" stroke="rgba(255,255,255,0.05)" strokeWidth="4" fill="transparent" />
                <circle
                  cx="32"
                  cy="32"
                  r="28"
                  stroke={data.risk_score > 60 ? "#F59E0B" : "#00C6AD"}
                  strokeWidth="4"
                  fill="transparent"
                  strokeDasharray={175}
                  strokeDashoffset={175 - (175 * (data.risk_score || 0)) / 100}
                  className="transition-all duration-1000 ease-out"
                />
              </svg>
              <span className="absolute text-[11px] font-black text-slate-100">{data.risk_score || 0}%</span>
            </div>

            {/* Top SHAP Contributors */}
            <div className="flex-1 space-y-1.5">
              <p className="text-[11px] text-slate-450 font-semibold">Primary Risk Indicators (SHAP):</p>
              <div className="grid grid-cols-2 gap-1.5">
                {(data.shap_factors || []).slice(0, 2).map((f: any, idx: number) => (
                  <div
                    key={idx}
                    className={`px-2 py-0.5 rounded text-[9px] font-mono flex justify-between ${
                      f.contribution === "positive" ? "bg-rose-500/10 text-rose-450 border border-rose-500/10" : "bg-teal-500/10 text-[#00C6AD] border border-teal-500/10"
                    }`}
                  >
                    <span className="truncate mr-1">{f.name}</span>
                    <span className="font-bold">{f.value > 0 ? `+${f.value}` : f.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {type === "forecast" && (
          <div className="space-y-2">
            <p className="text-slate-400">
              Seasonal Trend Projection (Next 30 Days):
            </p>
            <div className="bg-slate-950/65 rounded-lg p-2.5 font-mono text-[10px] space-y-1 border border-slate-900">
              {data.forecast?.slice(0, 2).map((f: any, i: number) => (
                <div key={i} className="flex justify-between text-slate-350">
                  <span>{f.crime_type} in {f.district}:</span>
                  <span className="font-black text-[#00C6AD]">{f.predicted} predicted</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Interactive Expand Prompt Indicator */}
      <div className="mt-3 text-right">
        <button
          onClick={onExpand}
          className="text-[9.5px] font-black font-mono tracking-wider text-[#00C6AD] uppercase hover:underline cursor-pointer"
        >
          Open Detailed View &rarr;
        </button>
      </div>
    </div>
  );
};
