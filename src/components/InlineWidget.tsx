import React from "react";
import { useApp } from "../AppContext";
import { Maximize2, ShieldAlert, MapPin, Network, TrendingUp, AlertTriangle, Clock, Fingerprint, Users, Repeat, Link2 } from "lucide-react";

interface InlineWidgetProps {
  type: "map" | "network" | "risk" | "forecast" | "timeline" | "mo_match" | "correlation" | "repeat_offenders" | "crime_groups";
  data: any;
  onExpand: () => void;
}

export const InlineWidget: React.FC<InlineWidgetProps> = ({ type, data, onExpand }) => {
  const { lang } = useApp();
  return (
    <div className="glass-card rounded-xl border border-slate-800 p-4 shadow-lg animate-fade-in relative overflow-hidden">
      {/* Header Info */}
      <div className="flex items-center justify-between border-b border-slate-850 pb-2 mb-3">
        <div className="flex items-center gap-2">
          {type === "map" && (
            <>
              <MapPin className="w-4 h-4 text-[#00C6AD]" />
              <span className="text-xs font-bold text-[#00C6AD] tracking-wider uppercase font-mono">{lang === "en" ? "Geospatial Incident Hotspots" : "ಭೌಗೋಳಿಕ ಘಟನಾ ಹಾಟ್‌ಸ್ಪಾಟ್‌ಗಳು"}</span>
            </>
          )}
          {type === "network" && (
            <>
              <Network className="w-4 h-4 text-[#00C6AD]" />
              <span className="text-xs font-bold text-[#00C6AD] tracking-wider uppercase font-mono">{lang === "en" ? "Criminal Syndicate Graph" : "ಅಪರಾಧ ಜಾಲ ಗ್ರಾಫ್"}</span>
            </>
          )}
          {type === "risk" && (
            <>
              <ShieldAlert className="w-4 h-4 text-amber-500" />
              <span className="text-xs font-bold text-amber-500 tracking-wider uppercase font-mono">{lang === "en" ? "Offender Recidivism Risk" : "ಅಪರಾಧಿ ಮರುಅಪರಾಧ ಅಪಾಯ"}</span>
            </>
          )}
          {type === "forecast" && (
            <>
              <TrendingUp className="w-4 h-4 text-[#00C6AD]" />
              <span className="text-xs font-bold text-[#00C6AD] tracking-wider uppercase font-mono">{lang === "en" ? "Seasonal Trend Forecast" : "ಋತುಮಾನ ಪ್ರವೃತ್ತಿ ಮುನ್ಸೂಚನೆ"}</span>
            </>
          )}
          {type === "timeline" && (
            <>
              <Clock className="w-4 h-4 text-[#00C6AD]" />
              <span className="text-xs font-bold text-[#00C6AD] tracking-wider uppercase font-mono">{lang === "en" ? "Chronological Case Timeline" : "ಪ್ರಕರಣದ ಕಾಲಾನುಕ್ರಮ"}</span>
            </>
          )}
          {type === "mo_match" && (
            <>
              <Fingerprint className="w-4 h-4 text-amber-500" />
              <span className="text-xs font-bold text-amber-500 tracking-wider uppercase font-mono">{lang === "en" ? "MO Suspect Matches" : "MO ಶಂಕಿತ ಹೊಂದಾಣಿಕೆಗಳು"}</span>
            </>
          )}
          {type === "correlation" && (
            <>
              <Users className="w-4 h-4 text-[#00C6AD]" />
              <span className="text-xs font-bold text-[#00C6AD] tracking-wider uppercase font-mono">{lang === "en" ? "Demographic Correlations" : "ಜನಸಂಖ್ಯಾ ಸಂಬಂಧಗಳು"}</span>
            </>
          )}
          {type === "repeat_offenders" && (
            <>
              <Repeat className="w-4 h-4 text-amber-500" />
              <span className="text-xs font-bold text-amber-500 tracking-wider uppercase font-mono">{lang === "en" ? "Repeat Offender Roster" : "ಪುನರಾವರ್ತಿತ ಅಪರಾಧಿಗಳ ಪಟ್ಟಿ"}</span>
            </>
          )}
          {type === "crime_groups" && (
            <>
              <Link2 className="w-4 h-4 text-amber-500" />
              <span className="text-xs font-bold text-amber-500 tracking-wider uppercase font-mono">{lang === "en" ? "Organized Crime Groups" : "ಸಂಘಟಿತ ಅಪರಾಧ ಗುಂಪುಗಳು"}</span>
            </>
          )}
        </div>

        <button
          onClick={onExpand}
          className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
          title={lang === "en" ? "Expand View" : "ವಿಸ್ತರಿಸಿ"}
        >
          <Maximize2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Widget Layouts */}
      <div className="text-xs space-y-2">
        {type === "map" && (
          <div className="space-y-2">
            <p className="text-slate-400">
              {lang === "en" ? (
                <>Resolved <span className="font-bold text-slate-200">{data.hotspots?.length || 0}</span> coordinate points.</>
              ) : (
                <><span className="font-bold text-slate-200">{data.hotspots?.length || 0}</span> ನಿರ್ದೇಶಾಂಕ ಬಿಂದುಗಳನ್ನು ಪರಿಹರಿಸಲಾಗಿದೆ.</>
              )}
            </p>
            <div className="bg-slate-950/65 rounded-lg p-2.5 font-mono text-[10px] text-slate-400 border border-slate-900">
              {lang === "en" ? "Coordinates range:" : "ನಿರ್ದೇಶಾಂಕ ವ್ಯಾಪ್ತಿ:"} {data.hotspots?.[0] ? `${data.hotspots[0].lat}, ${data.hotspots[0].lng}` : (lang === "en" ? "No points mapped" : "ಯಾವುದೇ ಬಿಂದುಗಳಿಲ್ಲ")}
            </div>
          </div>
        )}

        {type === "network" && (
          <div className="space-y-2">
            <p className="text-slate-400">
              {lang === "en" ? (
                <>Traced connections for <span className="font-extrabold text-slate-200">{data.target_suspect || data.suspect || "Suspect"}</span>.</>
              ) : (
                <><span className="font-extrabold text-slate-200">{data.target_suspect || data.suspect || "ಶಂಕಿತ"}</span> ಗಾಗಿ ಸಂಪರ್ಕಗಳನ್ನು ಪತ್ತೆಹಚ್ಚಲಾಗಿದೆ.</>
              )}
            </p>
            <div className="bg-slate-950/65 rounded-lg p-2.5 space-y-1.5 font-mono text-[10px] border border-slate-900">
              <div className="text-slate-300 font-bold">
                {(data.nodes?.length || 1) - 1} {lang === "en" ? "connected entities" : "ಸಂಪರ್ಕಿತ ಘಟಕಗಳು"}
                {data.engine_mode === "Static Fallback Simulation" && (
                  <span className="text-amber-500 font-normal ml-1">{lang === "en" ? "(simulated)" : "(ಸಿಮ್ಯುಲೇಟೆಡ್)"}</span>
                )}
              </div>
              <div className="text-slate-400">
                {lang === "en"
                  ? `${data["1st_degree_connections"]?.length || 0} direct links, ${data["2nd_degree_connections"]?.length || 0} second-degree links`
                  : `${data["1st_degree_connections"]?.length || 0} ನೇರ ಕೊಂಡಿಗಳು, ${data["2nd_degree_connections"]?.length || 0} ದ್ವಿತೀಯ-ಹಂತದ ಕೊಂಡಿಗಳು`}
              </div>
            </div>
            {data.financial_transactions && data.financial_transactions.length > 0 && (
              <div className="bg-[#00C6AD]/10 border border-[#00C6AD]/25 rounded-lg p-2 flex justify-between items-center text-[10px] font-mono mt-2 text-slate-250">
                <span>{lang === "en" ? "Transactions:" : "ವಹಿವಾಟುಗಳು:"} <strong className="text-[#00C6AD]">{data.financial_transactions.length}</strong></span>
                <span>{lang === "en" ? "Total:" : "ಒಟ್ಟು:"} <strong className="text-amber-500">₹{data.financial_transactions.reduce((sum: number, tx: any) => sum + (tx.amount || 0), 0).toLocaleString()}</strong></span>
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
              <p className="text-[11px] text-slate-450 font-semibold">{lang === "en" ? "Primary Risk Indicators (SHAP):" : "ಪ್ರಾಥಮಿಕ ಅಪಾಯ ಸೂಚಕಗಳು (SHAP):"}</p>
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
              {lang === "en" ? "Seasonal Trend Projection (Next 30 Days):" : "ಋತುಮಾನ ಪ್ರವೃತ್ತಿ ಮುನ್ಸೂಚನೆ (ಮುಂದಿನ ೩೦ ದಿನಗಳು):"}
            </p>
            <div className="bg-slate-950/65 rounded-lg p-2.5 font-mono text-[10px] space-y-1 border border-slate-900">
              {data.forecast?.slice(0, 2).map((f: any, i: number) => (
                <div key={i} className="flex justify-between text-slate-350">
                  <span>{f.crime_type} {lang === "en" ? "in" : ""} {f.district}:</span>
                  <span className="font-black text-[#00C6AD]">{f.predicted} {lang === "en" ? "predicted" : "ಮುನ್ಸೂಚಿತ"}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {type === "timeline" && (
          <div className="space-y-2">
            <p className="text-slate-400">
              {lang === "en" ? (
                <>Case ID <span className="font-bold text-slate-200">{data.case_id}</span> chronological milestones:</>
              ) : (
                <>ಪ್ರಕರಣ ID <span className="font-bold text-slate-200">{data.case_id}</span> ಕಾಲಾನುಕ್ರಮ ಮೈಲಿಗಲ್ಲುಗಳು:</>
              )}
            </p>
            <div className="bg-slate-950/65 rounded-lg p-2.5 font-mono text-[10px] space-y-1.5 border border-slate-900">
              {(data.timeline || []).slice(0, 2).map((e: any, i: number) => (
                <div key={i} className="flex gap-2">
                  <span className="text-[#00C6AD] font-bold shrink-0">[{e.date}]</span>
                  <span className="text-slate-300 truncate">{e.event}: {e.description}</span>
                </div>
              ))}
              {(data.timeline || []).length > 2 && (
                <div className="text-[9px] text-slate-500 italic">
                  {lang === "en" ? `+${data.timeline.length - 2} more milestones` : `+${data.timeline.length - 2} ಹೆಚ್ಚಿನ ಮೈಲಿಗಲ್ಲುಗಳು`}
                </div>
              )}
            </div>
          </div>
        )}

        {type === "mo_match" && (
          <div className="space-y-2">
            <p className="text-slate-400">
              {lang === "en" ? (
                <>Behavioral matches for <span className="font-bold text-slate-200">{data.suspect}</span>:</>
              ) : (
                <><span className="font-bold text-slate-200">{data.suspect}</span> ಗಾಗಿ ವರ್ತನೆಯ ಹೊಂದಾಣಿಕೆಗಳು:</>
              )}
            </p>
            <div className="bg-slate-950/65 rounded-lg p-2.5 font-mono text-[10px] space-y-1 border border-slate-900">
              <div className="flex justify-between text-slate-300">
                <span>{lang === "en" ? "Top Match Match Rate:" : "ಅಗ್ರ ಹೊಂದಾಣಿಕೆ ದರ:"}</span>
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
              {lang === "en" ? (
                <>Socio-demographics for <span className="font-bold text-slate-200">{data.profile?.district}</span>:</>
              ) : (
                <><span className="font-bold text-slate-200">{data.profile?.district}</span> ಗಾಗಿ ಸಾಮಾಜಿಕ-ಜನಸಂಖ್ಯಾಶಾಸ್ತ್ರ:</>
              )}
            </p>
            <div className="bg-slate-950/65 rounded-lg p-2.5 font-mono text-[10px] grid grid-cols-2 gap-2 border border-slate-900">
              <div className="text-slate-450">{lang === "en" ? "Literacy:" : "ಸಾಕ್ಷರತೆ:"} <strong className="text-slate-200">{data.profile?.literacy}%</strong></div>
              <div className="text-slate-450">{lang === "en" ? "Unemployment:" : "ನಿರುದ್ಯೋಗ:"} <strong className="text-slate-200">{data.profile?.unemployment}%</strong></div>
              <div className="text-slate-450">{lang === "en" ? "Stress Index:" : "ಒತ್ತಡ ಸೂಚ್ಯಂಕ:"} <strong className="text-slate-200">{data.profile?.stress}</strong></div>
              <div className="text-slate-450">{lang === "en" ? "Urbanization:" : "ನಗರೀಕರಣ:"} <strong className="text-slate-200">{data.profile?.urbanization}</strong></div>
            </div>
          </div>
        )}

        {type === "repeat_offenders" && (
          <div className="space-y-2">
            <p className="text-slate-400">
              {lang === "en"
                ? `${(data.offenders || []).length} repeat offender(s) identified${data.district_filter ? ` in ${data.district_filter}` : ""}:`
                : `${(data.offenders || []).length} ಪುನರಾವರ್ತಿತ ಅಪರಾಧಿಗಳು ಗುರುತಿಸಲಾಗಿದೆ${data.district_filter ? ` (${data.district_filter})` : ""}:`}
            </p>
            <div className="bg-slate-950/65 rounded-lg p-2.5 space-y-1.5 font-mono text-[10px] border border-slate-900">
              {(data.offenders || []).slice(0, 4).map((o: any, idx: number) => (
                <div key={idx} className="flex justify-between text-slate-300">
                  <span className="truncate mr-2">{o.suspect}</span>
                  <span className="font-bold text-amber-500 shrink-0">{o.case_count} {lang === "en" ? "cases" : "ಪ್ರಕರಣಗಳು"}</span>
                </div>
              ))}
              {(data.offenders || []).length === 0 && (
                <div className="text-slate-600">{lang === "en" ? "No repeat offenders on record." : "ಯಾವುದೇ ಪುನರಾವರ್ತಿತ ಅಪರಾಧಿಗಳ ದಾಖಲೆ ಇಲ್ಲ."}</div>
              )}
            </div>
          </div>
        )}

        {type === "crime_groups" && (
          <div className="space-y-2">
            <p className="text-slate-400">
              {lang === "en"
                ? `${(data.groups || []).length} likely organized group(s) detected (repeated co-offense pattern):`
                : `${(data.groups || []).length} ಸಂಭವನೀಯ ಸಂಘಟಿತ ಗುಂಪುಗಳು ಪತ್ತೆಯಾಗಿವೆ (ಪುನರಾವರ್ತಿತ ಸಹ-ಅಪರಾಧ ಮಾದರಿ):`}
            </p>
            <div className="bg-slate-950/65 rounded-lg p-2.5 space-y-1.5 font-mono text-[10px] border border-slate-900">
              {(data.groups || []).slice(0, 3).map((g: any, idx: number) => (
                <div key={idx} className="text-slate-300">
                  <span className="truncate">{(g.members || []).join(", ")}</span>
                  <span className="text-amber-500 font-bold ml-1">({g.shared_case_count} {lang === "en" ? "shared cases" : "ಹಂಚಿದ ಪ್ರಕರಣಗಳು"})</span>
                </div>
              ))}
              {(data.groups || []).length === 0 && (
                <div className="text-slate-600">{lang === "en" ? "No repeated co-offense clusters found." : "ಯಾವುದೇ ಪುನರಾವರ್ತಿತ ಸಹ-ಅಪರಾಧ ಸಮೂಹಗಳು ಕಂಡುಬಂದಿಲ್ಲ."}</div>
              )}
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
          {lang === "en" ? "Open Detailed View" : "ವಿವರ ನೋಟ ತೆರೆಯಿರಿ"} &rarr;
        </button>
      </div>
    </div>
  );
};
