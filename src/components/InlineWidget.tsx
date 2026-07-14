import React from "react";
import { Maximize2, ShieldAlert, MapPin, Network, TrendingUp, AlertTriangle, Clock, Fingerprint, Users } from "lucide-react";

interface InlineWidgetProps {
  type: "map" | "network" | "risk" | "forecast" | "timeline" | "mo_match" | "correlation";
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
          {type === "timeline" && (
            <>
              <Clock className="w-4 h-4 text-[#00C6AD]" />
              <span className="text-xs font-bold text-[#00C6AD] tracking-wider uppercase font-mono">Chronological Case Timeline</span>
            </>
          )}
          {type === "mo_match" && (
            <>
              <Fingerprint className="w-4 h-4 text-amber-500" />
              <span className="text-xs font-bold text-amber-500 tracking-wider uppercase font-mono">MO Suspect Matches</span>
            </>
          )}
          {type === "correlation" && (
            <>
              <Users className="w-4 h-4 text-[#00C6AD]" />
              <span className="text-xs font-bold text-[#00C6AD] tracking-wider uppercase font-mono">Demographic Correlations</span>
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
              Traced connections for <span className="font-extrabold text-slate-200">{data.target_suspect || data.suspect || "Suspect"}</span>.
            </p>
            <div className="bg-slate-950/65 rounded-lg p-2.5 space-y-1.5 font-mono text-[10px] border border-slate-900">
              <div className="text-slate-300 font-bold">
                {(data.nodes?.length || 1) - 1} connected entities
                {data.engine_mode === "Static Fallback Simulation" && (
                  <span className="text-amber-500 font-normal ml-1">(simulated)</span>
                )}
              </div>
              <div className="text-slate-400">
                {data["1st_degree_connections"]?.length || 0} direct links, {data["2nd_degree_connections"]?.length || 0} second-degree links
              </div>
            </div>
            {data.financial_transactions && data.financial_transactions.length > 0 && (
              <div className="bg-[#00C6AD]/10 border border-[#00C6AD]/25 rounded-lg p-2 flex justify-between items-center text-[10px] font-mono mt-2 text-slate-250">
                <span>Transactions: <strong className="text-[#00C6AD]">{data.financial_transactions.length}</strong></span>
                <span>Total: <strong className="text-amber-500">₹{data.financial_transactions.reduce((sum: number, tx: any) => sum + (tx.amount || 0), 0).toLocaleString()}</strong></span>
              </div>
            )}
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

        {type === "timeline" && (
          <div className="space-y-2">
            <p className="text-slate-400">
              Case ID <span className="font-bold text-slate-200">{data.case_id}</span> chronological milestones:
            </p>
            <div className="bg-slate-950/65 rounded-lg p-2.5 font-mono text-[10px] space-y-1.5 border border-slate-900">
              {(data.timeline || []).slice(0, 2).map((e: any, i: number) => (
                <div key={i} className="flex gap-2">
                  <span className="text-[#00C6AD] font-bold shrink-0">[{e.date}]</span>
                  <span className="text-slate-300 truncate">{e.event}: {e.description}</span>
                </div>
              ))}
              {(data.timeline || []).length > 2 && (
                <div className="text-[9px] text-slate-500 italic">+{data.timeline.length - 2} more milestones</div>
              )}
            </div>
          </div>
        )}

        {type === "mo_match" && (
          <div className="space-y-2">
            <p className="text-slate-400">
              Behavioral matches for <span className="font-bold text-slate-200">{data.suspect}</span>:
            </p>
            <div className="bg-slate-950/65 rounded-lg p-2.5 font-mono text-[10px] space-y-1 border border-slate-900">
              <div className="flex justify-between text-slate-300">
                <span>Top Match Match Rate:</span>
                <span className="font-extrabold text-amber-500">{data.match_rate}%</span>
              </div>
              <div className="text-slate-400 italic truncate text-[9px] mt-1">
                {data.mo_signature}
              </div>
            </div>
          </div>
        )}

        {type === "correlation" && (
          <div className="space-y-2">
            <p className="text-slate-400">
              Socio-demographics for <span className="font-bold text-slate-200">{data.profile?.district}</span>:
            </p>
            <div className="bg-slate-950/65 rounded-lg p-2.5 font-mono text-[10px] grid grid-cols-2 gap-2 border border-slate-900">
              <div className="text-slate-450">Literacy: <strong className="text-slate-200">{data.profile?.literacy}%</strong></div>
              <div className="text-slate-450">Unemployment: <strong className="text-slate-200">{data.profile?.unemployment}%</strong></div>
              <div className="text-slate-450">Stress Index: <strong className="text-slate-200">{data.profile?.stress}</strong></div>
              <div className="text-slate-450">Urbanization: <strong className="text-slate-200">{data.profile?.urbanization}</strong></div>
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
