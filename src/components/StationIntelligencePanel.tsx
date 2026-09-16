import React, { useState } from "react";
import { Shield, Info, Loader2, Send, CheckCircle2 } from "lucide-react";
import { TacticalStation } from "./Tactical3DMap";
import { API_BASE } from "../config";

/**
 * Finals-part 3.md §21, "Component C: Station Intelligence & Decision
 * Panel." Renders ONLY real fields from /api/geospatial/station-forecast
 * (spatiotemporal_forecast.py) -- deliberately does not reproduce the
 * doc's fabricated "SHAP TreeExplainer" attribution list or "Back-Test
 * Error Band: 0%-42% / Confidence: High" (hardcoded boilerplate in the
 * source document, identical for every station regardless of its real
 * data).
 *
 * The doc's "Send Patrol" dispatch button IS built below, honestly: no
 * patrol/dispatch-team routing system exists in this schema, so this
 * calls POST /api/patrol/flag-station instead -- a real action with a
 * real AuditLog entry + a real supervisor-visible ProactiveAlerts row
 * (L206), never a fabricated "patrol dispatched" confirmation. L199
 * (multi-click spam) covered both ends: button disables immediately on
 * click, and the server enforces its own 60s per-station cooldown.
 */
export interface StationForecastResult {
  status: "ok" | "insufficient_data" | "unavailable" | "error";
  sample_size?: number;
  day_label?: string;
  selected_day_count?: number;
  weekly_average?: number;
  z_score?: number;
  tier?: "elevated" | "typical" | "quiet";
  dominant_crime?: string | null;
  disclosure?: string;
  message?: string;
}

interface StationIntelligencePanelProps {
  station: TacticalStation | null;
  forecast: StationForecastResult | null;
  isLoading: boolean;
  lang?: "en" | "kn";
}

const TIER_STYLE: Record<string, { text: string; badge: string }> = {
  elevated: { text: "text-rose-500", badge: "ELEVATED -- ABOVE THIS STATION'S OWN AVERAGE" },
  typical: { text: "text-amber-400", badge: "TYPICAL FOR THIS STATION" },
  quiet: { text: "text-emerald-400", badge: "QUIETER THAN THIS STATION'S OWN AVERAGE" },
};

export const StationIntelligencePanel: React.FC<StationIntelligencePanelProps> = ({
  station,
  forecast,
  isLoading,
  lang = "en",
}) => {
  const [isFlagging, setIsFlagging] = useState(false);
  const [flagResult, setFlagResult] = useState<"ok" | "error" | null>(null);

  const handleFlagStation = async () => {
    if (!station || isFlagging) return;
    setIsFlagging(true);
    setFlagResult(null);
    try {
      const res = await fetch(`${API_BASE}/api/patrol/flag-station`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("vajra_token") || ""}` },
        body: JSON.stringify({ unit_id: station.unit_id, station_name: station.name }),
      });
      setFlagResult(res.ok ? "ok" : "error");
    } catch {
      setFlagResult("error");
    } finally {
      setIsFlagging(false);
      setTimeout(() => setFlagResult(null), 4000);
    }
  };

  if (!station) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center p-8 text-center bg-stone-900/60 border border-stone-800 rounded-xl">
        <Shield className="w-12 h-12 text-stone-600 mb-3" />
        <h3 className="text-sm font-bold text-stone-300">
          {lang === "en" ? "No Station Selected" : "ಯಾವುದೇ ಠಾಣೆ ಆಯ್ಕೆ ಮಾಡಿಲ್ಲ"}
        </h3>
        <p className="text-xs text-stone-500 mt-1">
          {lang === "en"
            ? "Click any station pin on the map to inspect its real day-of-week case pattern."
            : "ನಕ್ಷೆಯಲ್ಲಿ ಯಾವುದೇ ಠಾಣೆ ಪಿನ್ ಕ್ಲಿಕ್ ಮಾಡಿ."}
        </p>
      </div>
    );
  }

  return (
    <div className="w-full h-full bg-stone-900/90 border border-stone-800 rounded-xl p-5 shadow-2xl backdrop-blur-md flex flex-col gap-4 overflow-y-auto">
      <div className="border-b border-stone-800 pb-3">
        <h2 className="text-base font-bold text-white tracking-wide">{station.name}</h2>
        <div className="text-xs font-mono text-[#C79A4E] mt-0.5">
          {station.lat.toFixed(6)}, {station.lng.toFixed(6)}
        </div>
      </div>

      {isLoading ? (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-6 h-6 text-stone-600 animate-spin" />
        </div>
      ) : !forecast || forecast.status !== "ok" ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center gap-2 py-6">
          <Info className="w-6 h-6 text-stone-600" />
          <p className="text-xs text-stone-500 max-w-xs">
            {forecast?.message ||
              (lang === "en"
                ? "Not enough recorded case history for this station to compute a reliable signal."
                : "ಈ ಠಾಣೆಗೆ ವಿಶ್ವಾಸಾರ್ಹ ಸಂಕೇತವನ್ನು ಲೆಕ್ಕಹಾಕಲು ಸಾಕಷ್ಟು ದಾಖಲಿತ ಇತಿಹಾಸ ಇಲ್ಲ.")}
          </p>
          {typeof forecast?.sample_size === "number" && (
            <p className="text-[10px] font-mono text-stone-600">
              {lang === "en" ? `${forecast.sample_size} geocoded case(s) on record` : `${forecast.sample_size} ದಾಖಲೆಗಳು`}
            </p>
          )}
        </div>
      ) : (
        <>
          <div className="flex flex-col items-center justify-center py-2">
            <div className="text-4xl font-black font-mono text-stone-100">{forecast.selected_day_count}</div>
            <div className="text-[10px] font-bold tracking-widest text-stone-500 uppercase mt-1">
              {lang === "en" ? "Cases on record" : "ದಾಖಲಿತ ಪ್ರಕರಣಗಳು"} — {forecast.day_label}
            </div>
            <div className={`text-[10px] font-black tracking-wide uppercase mt-2 ${TIER_STYLE[forecast.tier || "typical"].text}`}>
              {TIER_STYLE[forecast.tier || "typical"].badge}
            </div>
          </div>

          <div className="p-3 rounded-lg bg-stone-950/70 border border-stone-800/80 flex justify-between items-center text-xs">
            <div>
              <div className="text-[10px] font-mono font-bold text-stone-500 uppercase">
                {lang === "en" ? "Station's own weekly average" : "ಠಾಣೆಯ ಸರಾಸರಿ"}
              </div>
              <div className="text-sm font-bold text-stone-200">{forecast.weekly_average}</div>
            </div>
            <div className="text-right">
              <div className="text-[10px] font-mono font-bold text-stone-500 uppercase">Z-Score</div>
              <div className="text-sm font-bold text-stone-200">{forecast.z_score}</div>
            </div>
          </div>

          <div className="p-3 rounded-lg bg-stone-950/70 border border-stone-800/80 text-xs">
            <div className="text-[10px] font-mono font-bold text-stone-500 uppercase">
              {lang === "en" ? "Dominant recorded crime type" : "ಮುಖ್ಯ ಅಪರಾಧ ಪ್ರಕಾರ"}
            </div>
            <div className="text-sm font-bold text-white capitalize mt-0.5">
              {forecast.dominant_crime || (lang === "en" ? "Not recorded" : "ದಾಖಲಾಗಿಲ್ಲ")}
            </div>
          </div>

          <div className="p-2.5 rounded-lg bg-stone-950/40 border border-stone-800/60 text-[10px] text-stone-500 leading-relaxed flex items-start gap-1.5">
            <Info className="w-3 h-3 shrink-0 mt-0.5 text-stone-600" />
            <span>{forecast.disclosure}</span>
          </div>

          <div className="text-[9.5px] text-stone-600 font-mono">
            {lang === "en" ? "Sample size" : "ಮಾದರಿ ಗಾತ್ರ"}: {forecast.sample_size}
          </div>
        </>
      )}

      <div className="mt-auto pt-3 border-t border-stone-800">
        <button
          onClick={handleFlagStation}
          disabled={isFlagging}
          className="w-full py-2.5 px-4 rounded-lg bg-[#C79A4E] hover:bg-[#b0853e] disabled:bg-stone-800 text-stone-950 font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-lg active:scale-[0.98] cursor-pointer disabled:cursor-not-allowed"
        >
          {isFlagging ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : flagResult === "ok" ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Send className="w-3.5 h-3.5" />}
          <span>
            {isFlagging
              ? (lang === "en" ? "Flagging..." : "ಗುರುತಿಸಲಾಗುತ್ತಿದೆ...")
              : flagResult === "ok"
              ? (lang === "en" ? "Flagged -- supervisor notified" : "ಗುರುತಿಸಲಾಗಿದೆ")
              : flagResult === "error"
              ? (lang === "en" ? "Could not flag -- try again" : "ವಿಫಲವಾಗಿದೆ -- ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ")
              : (lang === "en" ? "Flag Station for Patrol Attention" : "ಗಸ್ತು ಗಮನಕ್ಕಾಗಿ ಗುರುತಿಸಿ")}
          </span>
        </button>
      </div>
    </div>
  );
};
