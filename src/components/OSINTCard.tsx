import React, { useEffect, useState } from "react";
import { Radio, ExternalLink, CheckCircle2 } from "lucide-react";
import { API_BASE } from "../config";

// Real shape returned by GET /api/intelligence/district-signals (see
// internet_signals.py's _signal() helper) -- never a "signals" array, and
// never a fabricated field VAJRA invents on the frontend.
interface OSINTItem {
  title: string;
  source: string;
  published: string;
  url: string;
  snippet: string;
  disclaimer: string;
}

interface DistrictSignalsResponse {
  configured: boolean;
  district: string;
  items: OSINTItem[];
  note?: string;
}

interface OSINTCardProps {
  lang: "en" | "kn";
  isSupervisor: boolean;
  districtName: string | null;
}

// Mirrors GroupedSessionList.tsx's own formatRelativeTime -- kept local
// (not extracted to a shared util) since neither existing copy is exported
// either; this is the same small, established pattern, not a new one.
function formatRelativeTime(raw: string): string {
  if (!raw) return "";
  const t = new Date(raw).getTime();
  if (Number.isNaN(t)) return raw;
  const diffSec = Math.round((Date.now() - t) / 1000);
  if (diffSec < 60) return "just now";
  const mins = Math.round(diffSec / 60);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

export const OSINTCard: React.FC<OSINTCardProps> = ({ lang, isSupervisor, districtName }) => {
  const [data, setData] = useState<DistrictSignalsResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Supervisors get a broader, state-level query ("Karnataka" is a real,
    // supported "general region" per get_district_news's own docstring) --
    // there is no separate 31-district aggregation endpoint to call, so
    // this is the real breadth the backend can honestly provide, not a
    // fabricated "state-wide" data source. Officers without a resolved
    // home district yet (digest still loading) simply wait rather than
    // guessing a district.
    const scopeDistrict = isSupervisor ? "Karnataka" : districtName;
    if (!scopeDistrict) return;

    let cancelled = false;
    setLoading(true);
    fetch(`${API_BASE}/api/intelligence/district-signals?district=${encodeURIComponent(scopeDistrict)}`, {
      headers: { Authorization: `Bearer ${localStorage.getItem("vajra_token") || ""}` },
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (!cancelled) setData(d); })
      .catch(() => { if (!cancelled) setData(null); })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [isSupervisor, districtName]);

  const items = (data?.items || []).slice(0, 3);

  return (
    <div className="w-full glass-card border border-stone-850 rounded-2xl p-4 h-[250px] flex flex-col justify-between transition-all hover:border-stone-750">
      <div className="flex items-center justify-between pb-2 border-b border-stone-800/80">
        <div className="flex items-center gap-2">
          <Radio className="w-4 h-4 text-[#C79A4E] animate-pulse" />
          <h2 className="text-xs font-bold font-mono uppercase tracking-wider text-stone-200">
            {lang === "en" ? "OSINT Signals · Live" : "ಮುಕ್ತ-ಮೂಲ ಸಂಕೇತಗಳು"}
          </h2>
        </div>
        <span className="text-[10px] px-2 py-0.5 rounded-full font-mono font-semibold bg-[#C79A4E]/10 border border-[#C79A4E]/30 text-[#E4C590] shrink-0">
          {isSupervisor
            ? (lang === "en" ? "🌐 Whole State" : "🌐 ಇಡೀ ರಾಜ್ಯ")
            : districtName
            ? `📍 ${districtName}`
            : (lang === "en" ? "Locating district…" : "ಜಿಲ್ಲೆ ಪತ್ತೆಯಾಗುತ್ತಿದೆ…")}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto space-y-2.5 py-2 scrollbar-none">
        {loading || (!isSupervisor && !districtName) ? (
          <div className="space-y-2 pt-1">
            {[1, 2, 3].map((n) => (
              <div key={n} className="h-9 rounded-lg shimmer-bg" />
            ))}
          </div>
        ) : items.length > 0 ? (
          items.map((s, idx) => (
            <div key={s.url || idx} className="flex items-start justify-between gap-2 p-1.5 rounded-lg hover:bg-stone-850/50 transition-colors">
              <div className="space-y-0.5 flex-1 min-w-0">
                <div className="flex items-center gap-1.5 text-[10px] text-stone-500 font-mono">
                  <span className="text-[#C79A4E] font-semibold truncate">{s.source || "Web"}</span>
                  <span>•</span>
                  <span className="shrink-0">{formatRelativeTime(s.published)}</span>
                </div>
                <p className="text-xs text-stone-300 font-medium truncate">
                  {s.title}
                </p>
              </div>
              {s.url && (
                <a
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-stone-500 hover:text-stone-300 p-1 shrink-0"
                  title={s.disclaimer || "Unverified open-source lead"}
                >
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>
          ))
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-center text-stone-500 py-4">
            <CheckCircle2 className="w-5 h-5 text-emerald-500/60 mb-1" />
            <p className="text-[11px]">
              {lang === "en" ? "No open-source signals right now." : "ಈಗ ಯಾವುದೇ ಸಂಕೇತಗಳಿಲ್ಲ."}
            </p>
          </div>
        )}
      </div>

      <div className="pt-2 border-t border-stone-850/80 flex items-center justify-between text-[9.5px] font-mono text-stone-500">
        <span>{lang === "en" ? "Unverified Lead · §63 BSA Guidance" : "ಪರಿಶೀಲಿಸದ ಮಾಹಿತಿ · §63 BSA"}</span>
      </div>
    </div>
  );
};
