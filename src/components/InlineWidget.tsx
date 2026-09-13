import React, { useEffect, useState } from "react";
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import { useApp } from "../AppContext";
import { API_BASE } from "../config";
import { Maximize2, ShieldAlert, MapPin, Network, TrendingUp, Activity, Clock, Fingerprint, Users, Repeat, Link2, PieChart, Newspaper, ExternalLink, Radio, ChevronDown, ChevronRight, Code2, Copy, Check, Sparkles, Download } from "lucide-react";
import { ExpandedOverlay } from "./ExpandedOverlay";
import { ErrorBoundary } from "./ErrorBoundary";

// Fit the inline map to the ACTUAL hotspot coordinates every render, and force
// a resize once the chat bubble has laid out (Leaflet renders grey/half-drawn
// if the container was 0-height when it mounted). fitBounds to the real points
// is what makes each district's map genuinely distinct and pin-point framed --
// not a fixed generic view that looks identical everywhere.
const InlineMapFitter: React.FC<{ points: { lat: number; lng: number }[] }> = ({ points }) => {
  const map = useMap();
  useEffect(() => {
    const fit = () => {
      map.invalidateSize();
      if (points.length === 1) {
        map.setView([points[0].lat, points[0].lng], 13);
      } else if (points.length > 1) {
        map.fitBounds(L.latLngBounds(points.map((p) => [p.lat, p.lng] as [number, number])), {
          padding: [30, 30],
          maxZoom: 14,
        });
      }
    };
    fit();
    const t1 = setTimeout(fit, 120);
    const t2 = setTimeout(fit, 400);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, points.length]);
  return null;
};

// Colour + arrow encode MOMENTUM (rising = danger, falling = good, else muted)
// so an officer reads the concern board at a glance without parsing numbers.
const momColor = (g: number) => (g > 3 ? "#E24B4A" : g < -3 ? "#5DCAA5" : "#A8A096");
const momArrow = (g: number) => (g > 3 ? "▲" : g < -3 ? "▼" : "▬");

// Scannable "what should I be most concerned about" board: a hero for the #1
// concern, then ranked bars sized by volume and coloured by momentum. Full
// detail stays in the AI narrative above; this is the at-a-glance layer.
// Open-source news / web-search results as a scannable feed of source-cited
// cards -- deliberately framed as UNVERIFIED leads (gold "open-source" boundary),
// separate from official CCTNS records.
// Source-credibility triage badge (Revamped Internet Search plan, WS-9) --
// mirrors the backend's classify_domain() tiers so an officer sees at a
// glance whether a result is an official gazette, a legal database,
// verified press, or the open web. Every tier remains an unverified lead.
const TIER_BADGE: Record<string, { label: string; emoji: string; cls: string }> = {
  GOV: { label: "Official Gov", emoji: "🏛️", cls: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30" },
  LEGAL: { label: "Judicial / Law", emoji: "⚖️", cls: "bg-purple-500/15 text-purple-300 border-purple-500/30" },
  PRESS: { label: "Verified Press", emoji: "📰", cls: "bg-amber-500/15 text-amber-300 border-amber-500/30" },
  WEB: { label: "Open Web", emoji: "🌐", cls: "bg-stone-700/40 text-stone-400 border-stone-700" },
};

// "Browsed the web" trace drawer (Revamped Internet Search plan, §2 & §4.1)
// -- a collapsible, high-density accordion in place of a flat card list:
// dual Structured-Card / Raw-JSON view, one-click copy of every source,
// per-source domain-credibility badge, evidentiary SHA-256 digest, and the
// §63 BSA boundary notice. Currently backs a single web_search call per
// turn (the backend doesn't yet chain multiple queries in one turn), so
// this renders one query-group; the header/copy-all logic already counts
// generically so it keeps working if that ever changes.
const NewsView: React.FC<{ data: any; lang: "en" | "kn" }> = ({ data, lang }) => {
  const items: any[] = Array.isArray(data?.news) ? data.news : (Array.isArray(data?.results) ? data.results : []);
  const scope: string = data?.scope || data?.query || "";
  const durationMs: number | undefined = typeof data?.duration_ms === "number" ? data.duration_ms : undefined;
  const [isOpen, setIsOpen] = useState(true);
  const [viewMode, setViewMode] = useState<"cards" | "json">("cards");
  const [copied, setCopied] = useState(false);
  const relDate = (s?: string): string => {
    if (!s) return "";
    const d = new Date(s);
    if (isNaN(d.getTime())) return "";
    const days = Math.floor((Date.now() - d.getTime()) / 86400000);
    if (days <= 0) return lang === "en" ? "today" : "ಇಂದು";
    if (days === 1) return lang === "en" ? "yesterday" : "ನಿನ್ನೆ";
    if (days < 30) return lang === "en" ? `${days}d ago` : `${days} ದಿನ`;
    return d.toLocaleDateString();
  };
  if (items.length === 0) {
    return (
      <div className="bg-stone-950/65 rounded-lg p-3 font-mono text-[11px] text-stone-400 border border-stone-900">
        {lang === "en" ? "No open-source signals found right now." : "ಸದ್ಯಕ್ಕೆ ಯಾವುದೇ ಮುಕ್ತ-ಮೂಲ ಸಂಕೇತಗಳು ಸಿಗಲಿಲ್ಲ."}
      </div>
    );
  }
  const jsonPayload = JSON.stringify(
    items.map((it, i) => ({
      index: i + 1, title: it.title || it.headline || "", source: it.source || "",
      url: it.url || it.link || "", snippet: it.snippet || it.description || "",
      tier: it.tier || "WEB", published_at: it.published || it.date || "",
      evidence_sha256: it.evidence_hash || "",
    })),
    null, 2
  );
  const handleCopyAll = async () => {
    try {
      const text = viewMode === "json" ? jsonPayload : items.map((it, i) =>
        `[${i + 1}] ${it.title || it.headline || ""} — ${it.source || "web"}\n${it.url || it.link || ""}\n${it.snippet || it.description || ""}`
      ).join("\n\n");
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch { /* clipboard unavailable -- non-critical */ }
  };
  const durationLabel = durationMs != null ? `${(durationMs / 1000).toFixed(1)}s` : "";
  return (
    <div className="rounded-xl border border-[#C79A4E]/30 bg-[#C79A4E]/[0.04] overflow-hidden">
      {/* Header: click to collapse/expand the whole drawer -- "▼ Browsed the
          web (1 search · N sources · Xs)" per the plan's exact UX pattern. */}
      <button
        onClick={() => setIsOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-2 flex-wrap px-3 py-2.5 cursor-pointer hover:bg-[#C79A4E]/[0.06] transition-colors"
      >
        <div className="flex items-center gap-1.5 min-w-0">
          {isOpen ? <ChevronDown className="w-3.5 h-3.5 text-[#C79A4E] shrink-0" /> : <ChevronRight className="w-3.5 h-3.5 text-[#C79A4E] shrink-0" />}
          <span className="relative flex h-2 w-2 shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#C79A4E] opacity-60" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-[#C79A4E]" />
          </span>
          <span className="text-[10px] font-black uppercase tracking-widest font-mono text-[#E4C590] truncate">
            {lang === "en" ? "Browsed the web" : "ವೆಬ್ ಬ್ರೌಸ್ ಮಾಡಲಾಗಿದೆ"}
            {" · "}{items.length} {lang === "en" ? "sources" : "ಮೂಲಗಳು"}
            {durationLabel ? ` · ${durationLabel}` : ""}
          </span>
        </div>
        <span className="text-[8.5px] font-mono uppercase tracking-wide text-[#C79A4E]/70 truncate max-w-[220px]">
          {scope}
        </span>
      </button>

      {isOpen && (
        <div className="px-3 pb-3 space-y-2.5">
          {/* Query sub-header + view toggle + copy-all */}
          <div className="flex items-center justify-between gap-2 flex-wrap pt-0.5">
            <span className="text-[10.5px] text-stone-400 font-mono truncate flex-1 min-w-0">
              {lang === "en" ? "Searched web: " : "ಹುಡುಕಲಾಗಿದೆ: "}<span className="text-stone-300">"{scope}"</span>
            </span>
            <div className="flex items-center gap-1 shrink-0">
              <div className="flex rounded-md border border-stone-800 overflow-hidden text-[9px] font-mono uppercase">
                <button
                  onClick={() => setViewMode("cards")}
                  className={`px-2 py-1 cursor-pointer transition-colors ${viewMode === "cards" ? "bg-[#C79A4E]/20 text-[#E4C590]" : "text-stone-500 hover:text-stone-300"}`}
                >
                  {lang === "en" ? "Cards" : "ಕಾರ್ಡ್"}
                </button>
                <button
                  onClick={() => setViewMode("json")}
                  className={`px-2 py-1 cursor-pointer transition-colors flex items-center gap-1 border-l border-stone-800 ${viewMode === "json" ? "bg-[#C79A4E]/20 text-[#E4C590]" : "text-stone-500 hover:text-stone-300"}`}
                  title={lang === "en"
                    ? "Raw evidence data with SHA-256 digests -- for a report or court-file appendix"
                    : "SHA-256 ಡೈಜೆಸ್ಟ್‌ಗಳೊಂದಿಗೆ ಕಚ್ಚಾ ಸಾಕ್ಷ್ಯ ಡೇಟಾ -- ವರದಿ ಅಥವಾ ನ್ಯಾಯಾಲಯದ ಕಡತಕ್ಕಾಗಿ"}
                >
                  <Code2 className="w-2.5 h-2.5" /> {lang === "en" ? "Evidence" : "ಸಾಕ್ಷ್ಯ"}
                </button>
              </div>
              <button
                onClick={handleCopyAll}
                className="flex items-center gap-1 px-2 py-1 rounded-md border border-stone-800 text-[9px] font-mono uppercase text-stone-400 hover:text-[#E4C590] hover:border-[#C79A4E]/40 cursor-pointer transition-colors"
                title={lang === "en" ? "Copy all sources" : "ಎಲ್ಲಾ ಮೂಲಗಳನ್ನು ನಕಲಿಸಿ"}
              >
                {copied ? <Check className="w-2.5 h-2.5 text-emerald-400" /> : <Copy className="w-2.5 h-2.5" />}
                {copied ? (lang === "en" ? "Copied" : "ನಕಲಿಸಲಾಗಿದೆ") : (lang === "en" ? "Copy All" : "ಎಲ್ಲಾ ನಕಲಿಸಿ")}
              </button>
            </div>
          </div>

          {viewMode === "json" ? (
            <pre className="bg-stone-950/80 border border-stone-900 rounded-lg p-2.5 text-[10px] font-mono text-stone-300 overflow-x-auto max-h-[380px] overflow-y-auto whitespace-pre">
              {jsonPayload}
            </pre>
          ) : (
            <div className="space-y-1.5 max-h-[420px] overflow-y-auto pr-1">
              {items.map((it, i) => {
                const title = (it.title || it.headline || "").trim();
                const src = it.source || "source";
                const url = it.url || it.link || "";
                const snip = (it.snippet || it.description || "").trim();
                const tier = TIER_BADGE[it.tier as string] || TIER_BADGE.WEB;
                const card = (
                  <div className="group bg-stone-950/50 hover:bg-stone-900/70 border border-stone-850 hover:border-[#C79A4E]/40 rounded-lg p-2.5 transition-colors">
                    <div className="flex items-start gap-2">
                      <span className="mt-0.5 shrink-0 text-[9px] font-mono font-black text-[#C79A4E] w-5 tabular-nums">{String(i + 1).padStart(2, "0")}</span>
                      <div className="min-w-0 flex-1">
                        <div className="text-[12.5px] font-semibold text-stone-100 leading-snug group-hover:text-[#E4C590] transition-colors flex items-start gap-1.5">
                          <span className="flex-1">{title}</span>
                          {url && <ExternalLink className="w-3 h-3 mt-0.5 shrink-0 text-stone-500 group-hover:text-[#C79A4E]" />}
                        </div>
                        {snip && <p className="text-[10.5px] text-stone-400 leading-snug mt-1 line-clamp-2">{snip}</p>}
                        <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                          <span className={`text-[9px] font-mono uppercase tracking-wide px-1.5 py-0.5 rounded border ${tier.cls}`} title={tier.label}>
                            {tier.emoji} {tier.label}
                          </span>
                          <span className="text-[9px] font-mono uppercase tracking-wide px-1.5 py-0.5 rounded bg-[#C79A4E]/12 text-[#E4C590] truncate max-w-[160px]">{src}</span>
                          {relDate(it.published || it.date) && <span className="text-[9px] font-mono text-stone-500">{relDate(it.published || it.date)}</span>}
                          {/* §63 BSA evidentiary digest (WS-11): proof of what
                              this source said at the moment VAJRA fetched it,
                              independent of whether the page later changes.
                              A small hover target instead of its own full
                              line -- the full hash is still one hover away,
                              and always in the Evidence/JSON view. */}
                          {it.evidence_hash && (
                            <span
                              className="ml-auto shrink-0 text-stone-600 hover:text-stone-400 cursor-help"
                              title={(lang === "en" ? "Section 63 BSA evidentiary SHA-256 digest: " : "ಸೆಕ್ಷನ್ 63 BSA ಸಾಕ್ಷ್ಯ SHA-256 ಡೈಜೆಸ್ಟ್: ") + it.evidence_hash}
                            >
                              <Fingerprint className="w-3 h-3" />
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
                return url ? (
                  <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="block">{card}</a>
                ) : (
                  <div key={i}>{card}</div>
                );
              })}
            </div>
          )}

          {/* Section 63 BSA evidentiary boundary (Revamped Internet Search
              plan, WS-5): amber-gold demarcation so these results can never
              be mistaken for certified CCTNS records in a charge sheet. */}
          <div className="flex items-center gap-1.5 text-[9px] font-mono text-amber-400/90 pt-1.5 border-t border-amber-500/15">
            <Radio className="w-3 h-3" />
            {lang === "en"
              ? "⚠️ §63 BSA Notice: Web signals are unverified OSINT leads • Not certified CCTNS record"
              : "⚠️ §63 BSA ಸೂಚನೆ: ಪರಿಶೀಲಿಸದ ಮುಕ್ತ-ಮೂಲ ಸುಳಿವುಗಳು • ಅಧಿಕೃತ CCTNS ದಾಖಲೆ ಅಲ್ಲ"}
          </div>
        </div>
      )}
    </div>
  );
};

const PriorityConcernsView: React.FC<{ data: any; lang: "en" | "kn" }> = ({ data, lang }) => {
  const concerns: any[] = Array.isArray(data?.concerns) ? data.concerns : [];
  if (concerns.length === 0) {
    return (
      <div className="bg-stone-950/65 rounded-lg p-3 font-mono text-[11px] text-stone-400 border border-stone-900">
        {lang === "en" ? "No priority-concern signal for this scope." : "ಈ ವ್ಯಾಪ್ತಿಗೆ ಆದ್ಯತಾ ಕಾಳಜಿ ಸಂಕೇತ ಇಲ್ಲ."}
      </div>
    );
  }
  // Hero = the fastest-RISING type with real volume (the emerging threat). Only
  // fall back to the biggest-volume type when nothing is sharply rising -- and
  // then style it neutrally, never as a red alert, because a big-but-falling
  // category is a load, not an escalating danger.
  const rising = data?.top_rising || null;
  const hero = rising || concerns[0];
  const heroIsRising = !!rising;
  const maxRecent = Math.max(...concerns.map((c) => c.recent || 0), 1);
  const g = data?.overall_growth_pct ?? 0;
  return (
    <div className="space-y-3">
      <div className={`rounded-xl p-3.5 border ${heroIsRising ? "border-rose-500/30 bg-rose-500/[0.07]" : "border-stone-800 bg-stone-950/40"}`}>
        <div className="flex items-center justify-between gap-2">
          <span className={`text-[9px] font-mono uppercase tracking-widest ${heroIsRising ? "text-rose-400/80" : "text-stone-500"}`}>
            {heroIsRising ? (lang === "en" ? "Emerging Threat · Watch First" : "ಉದಯೋನ್ಮುಖ ಅಪಾಯ") : (lang === "en" ? "Highest Volume" : "ಗರಿಷ್ಠ ಪ್ರಮಾಣ")}
          </span>
          <span className="text-[10px] font-mono font-bold" style={{ color: momColor(hero.growth_pct) }}>
            {momArrow(hero.growth_pct)} {hero.growth_pct >= 0 ? "+" : ""}{hero.growth_pct}%
          </span>
        </div>
        <div className="flex items-baseline justify-between gap-2 mt-1">
          <span className="text-lg font-black text-stone-100 leading-tight">{hero.type}</span>
          <span className={`font-mono text-sm font-bold shrink-0 ${heroIsRising ? "text-rose-300" : "text-stone-300"}`}>
            {hero.recent}<span className="text-[9px] text-stone-500 ml-1">{lang === "en" ? "in 90d" : "90ದಿನ"}</span>
          </span>
        </div>
      </div>
      <div className="text-[9px] font-mono uppercase tracking-widest text-stone-500 pt-0.5">{lang === "en" ? "Highest current volume" : "ಗರಿಷ್ಠ ಪ್ರಸ್ತುತ ಪ್ರಮಾಣ"}</div>
      <div className="space-y-1.5">
        {concerns.slice(0, 6).map((c, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="text-[10px] font-mono text-stone-600 w-3 shrink-0">{i + 1}</span>
            <span className="text-[11px] text-stone-300 w-24 sm:w-28 truncate shrink-0" title={c.type}>{c.type}</span>
            <div className="flex-1 h-4 bg-stone-900/60 rounded overflow-hidden">
              <div className="h-full rounded" style={{ width: `${Math.max(6, (c.recent / maxRecent) * 100)}%`, background: momColor(c.growth_pct), opacity: 0.55 }} />
            </div>
            <span className="text-[10px] font-mono text-stone-400 w-8 text-right shrink-0">{c.recent}</span>
            <span className="text-[10px] font-mono font-bold w-12 text-right shrink-0" style={{ color: momColor(c.growth_pct) }}>
              {momArrow(c.growth_pct)}{c.growth_pct >= 0 ? "+" : ""}{c.growth_pct}%
            </span>
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between text-[10px] font-mono text-stone-500 pt-1.5 border-t border-stone-850">
        <span className="truncate">{data.scope}</span>
        <span className="shrink-0 ml-2">
          {lang === "en" ? "Overall" : "ಒಟ್ಟಾರೆ"}: <span style={{ color: momColor(g) }}>{g >= 0 ? "+" : ""}{g}%</span> · {data.total_recent} {lang === "en" ? "in 90d" : "90ದಿನ"}
        </span>
      </div>
    </div>
  );
};

interface InlineWidgetProps {
  type: string;
  data: any;
  onExpand: () => void;
}

const InlineWidgetComponent: React.FC<InlineWidgetProps> = ({ type, data, onExpand }) => {
  const { lang, addToast } = useApp();
  // F.30: "Explain This Chart" -- hooks declared unconditionally, before the
  // early `return null` below, per the Rules of Hooks (this component has
  // no other useState calls to piggyback the ordering on).
  const [chartExplanation, setChartExplanation] = useState<string | null>(null);
  const [isExplainingChart, setIsExplainingChart] = useState(false);
  // F.31: single-chart PNG export -- ref wraps the whole card so the export
  // handler can find whichever chart's real <svg> is actually rendered
  // inside it, without each chart type needing its own separate ref.
  const cardRef = React.useRef<HTMLDivElement>(null);

  if (!data || typeof data !== "object") {
    return null;
  }

  if (type === "news") {
    return <NewsView data={data} lang={lang} />;
  }

  // Resolve sub-data across top-level keys, nested sub-objects, or panels
  const netData = (data?.nodes && data.nodes.length > 0)
    ? data
    : (data?.network?.nodes && data.network.nodes.length > 0)
    ? data.network
    : (Array.isArray(data?.panels) ? data.panels.find((p: any) => p.type === "network" && p.data?.nodes?.length > 0)?.data : null);

  const riskData = (data?.risk_score != null || (data?.shap_factors && data.shap_factors.length > 0))
    ? data
    : (data?.risk && (data.risk.risk_score != null || data.risk.shap_factors?.length > 0))
    ? data.risk
    : (Array.isArray(data?.panels) ? data.panels.find((p: any) => p.type === "risk" && (p.data?.risk_score != null || p.data?.shap_factors?.length > 0))?.data : null);

  const mapData = (data?.hotspots && data.hotspots.length > 0)
    ? data
    : (Array.isArray(data?.panels) ? data.panels.find((p: any) => p.type === "map" && p.data?.hotspots?.length > 0)?.data : null);

  const effectiveType = (type === "dossier" || !type)
    ? (netData ? "network" : riskData ? "risk" : mapData ? "map" : "network")
    : type;

  const effectiveData = effectiveType === "network" ? (netData || data) :
                        effectiveType === "risk" ? (riskData || data) :
                        effectiveType === "map" ? (mapData || data) : data;
  const safeEffectiveData = (effectiveData && typeof effectiveData === "object") ? effectiveData : {};

  // F.30: only the genuinely chart/graph-shaped types get an "Explain"
  // button -- the list-shaped types (repeat_offenders, crime_groups,
  // priority_concerns, case_list) already read as plain language on their
  // own, nothing chart-specific to narrate.
  const isExplainableChart = ["map", "network", "risk", "forecast", "timeline", "mo_match", "correlation", "trend", "case_distribution"].includes(effectiveType);

  const handleExplainChart = async () => {
    setIsExplainingChart(true);
    setChartExplanation(null);
    try {
      const res = await fetch(`${API_BASE}/api/charts/explain`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${localStorage.getItem("vajra_token") || ""}`,
        },
        body: JSON.stringify({ chart_data: safeEffectiveData }),
      });
      const j = await res.json().catch(() => ({}));
      setChartExplanation(j?.explanation || (lang === "en" ? "Explanation unavailable right now." : "ವಿವರಣೆ ಸದ್ಯಕ್ಕೆ ಲಭ್ಯವಿಲ್ಲ."));
    } catch {
      setChartExplanation(lang === "en" ? "Explanation unavailable right now -- the chart data itself is still accurate." : "ವಿವರಣೆ ಸದ್ಯಕ್ಕೆ ಲಭ್ಯವಿಲ್ಲ -- ಚಾರ್ಟ್ ಡೇಟಾ ಇನ್ನೂ ನಿಖರವಾಗಿದೆ.");
    } finally {
      setIsExplainingChart(false);
    }
  };

  // F.31: only the types Recharts actually renders as a real <svg
  // class="recharts-surface"> support export -- map (Leaflet: raster tile
  // images + a separate overlay pane, not one self-contained SVG) and
  // network (a custom force-graph canvas) are excluded rather than
  // producing a blank/broken image, matching this app's honesty discipline
  // (no feature that silently fails is better than not offering it).
  const isExportableChart = ["forecast", "timeline", "correlation", "trend", "case_distribution"].includes(effectiveType);

  const handleExportChartPng = () => {
    const svg = cardRef.current?.querySelector("svg.recharts-surface") as SVGSVGElement | null;
    if (!svg) {
      addToast(
        lang === "en" ? "Export Unavailable" : "ರಫ್ತು ಲಭ್ಯವಿಲ್ಲ",
        lang === "en" ? "This chart type doesn't support image export yet." : "ಈ ಚಾರ್ಟ್ ಪ್ರಕಾರ ಇನ್ನೂ ಚಿತ್ರ ರಫ್ತು ಬೆಂಬಲಿಸುವುದಿಲ್ಲ.",
        "Info"
      );
      return;
    }
    try {
      // Real width/height off the live element -- viewBox-only SVGs (no
      // explicit width/height attrs) would otherwise rasterize at 0x0.
      const rect = svg.getBoundingClientRect();
      const width = Math.max(1, Math.round(rect.width)) || 800;
      const height = Math.max(1, Math.round(rect.height)) || 500;
      const clone = svg.cloneNode(true) as SVGSVGElement;
      clone.setAttribute("width", String(width));
      clone.setAttribute("height", String(height));
      clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
      // Recharts renders on a transparent background -- fill white first so
      // exported PNGs aren't unreadable when pasted into a light-background
      // briefing document.
      const bgRect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
      bgRect.setAttribute("width", "100%");
      bgRect.setAttribute("height", "100%");
      bgRect.setAttribute("fill", "#211f1d");
      clone.insertBefore(bgRect, clone.firstChild);
      const svgData = new XMLSerializer().serializeToString(clone);
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = width * 2; // 2x for a crisp, briefing-quality export
        canvas.height = height * 2;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        ctx.scale(2, 2);
        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob((blob) => {
          if (!blob) return;
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `vajra-chart-${effectiveType}-${Date.now()}.png`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        }, "image/png");
      };
      img.onerror = () => {
        addToast(
          lang === "en" ? "Export Failed" : "ರಫ್ತು ವಿಫಲವಾಗಿದೆ",
          lang === "en" ? "Could not render this chart to an image." : "ಈ ಚಾರ್ಟ್ ಅನ್ನು ಚಿತ್ರಕ್ಕೆ ರೆಂಡರ್ ಮಾಡಲು ಸಾಧ್ಯವಾಗಲಿಲ್ಲ.",
          "Critical"
        );
      };
      img.src = "data:image/svg+xml;charset=utf-8;base64," + btoa(unescape(encodeURIComponent(svgData)));
    } catch (e) {
      console.error(e);
      addToast(
        lang === "en" ? "Export Failed" : "ರಫ್ತು ವಿಫಲವಾಗಿದೆ",
        lang === "en" ? "Could not render this chart to an image." : "ಈ ಚಾರ್ಟ್ ಅನ್ನು ಚಿತ್ರಕ್ಕೆ ರೆಂಡರ್ ಮಾಡಲು ಸಾಧ್ಯವಾಗಲಿಲ್ಲ.",
        "Critical"
      );
    }
  };

  return (
    <ErrorBoundary
      fallbackTitle={lang === "en" ? "Visualization Card" : "ದೃಶ್ಯೀಕರಣ ಕಾರ್ಡ್"}
      fallbackMessage={lang === "en" ? "Unable to render this visual component. Underlying data is preserved." : "ಈ ಘಟಕವನ್ನು ರೆಂಡರ್ ಮಾಡಲು ಸಾಧ್ಯವಾಗಲಿಲ್ಲ."}
    >
      <div ref={cardRef} className="rounded-xl border border-[#C79A4E]/30 bg-stone-950/90 backdrop-blur-md p-0 shadow-[0_4px_30px_rgba(199,154,78,0.08)] animate-fade-in relative overflow-hidden">
        {/* Header Info — gold gradient strip matching the bespoke card aesthetic */}
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 border-b border-[#C79A4E]/20 bg-gradient-to-r from-[#C79A4E]/10 via-[#C79A4E]/[0.04] to-transparent">
          <div className="flex items-center gap-2 flex-wrap">
            {effectiveType === "map" && (
              <>
                <MapPin className="w-4 h-4 text-[#C79A4E]" />
                <span className="text-xs font-bold text-[#C79A4E] tracking-wider uppercase font-mono">{lang === "en" ? "Geospatial Incident Hotspots" : "ಭೌಗೋಳಿಕ ಘಟನಾ ಹಾಟ್‌ಸ್ಪಾಟ್‌ಗಳು"}</span>
              </>
            )}
            {effectiveType === "network" && (
              <>
                <Network className="w-4 h-4 text-[#C79A4E]" />
                <span className="text-xs font-bold text-[#C79A4E] tracking-wider uppercase font-mono">{lang === "en" ? "Criminal Syndicate Graph" : "ಅಪರಾಧ ಜಾಲ ಗ್ರಾಫ್"}</span>
              </>
            )}
            {effectiveType === "risk" && (
              <>
                <ShieldAlert className="w-4 h-4 text-amber-500" />
                <span className="text-xs font-bold text-amber-500 tracking-wider uppercase font-mono">{lang === "en" ? "Offender Recidivism Risk & SHAP Analysis" : "ಅಪರಾಧಿ ಮರುಅಪರಾಧ ಅಪಾಯ ಮತ್ತು SHAP"}</span>
              </>
            )}
            {effectiveType === "forecast" && (
              <>
                <TrendingUp className="w-4 h-4 text-[#C79A4E]" />
                <span className="text-xs font-bold text-[#C79A4E] tracking-wider uppercase font-mono">{lang === "en" ? "Seasonal Trend Forecast" : "ಋತುಮಾನ ಪ್ರವೃತ್ತಿ ಮುನ್ಸೂಚನೆ"}</span>
              </>
            )}
            {effectiveType === "timeline" && (
              <>
                <Clock className="w-4 h-4 text-[#C79A4E]" />
                <span className="text-xs font-bold text-[#C79A4E] tracking-wider uppercase font-mono">{lang === "en" ? "Chronological Case Timeline" : "ಪ್ರಕರಣದ ಕಾಲಾನುಕ್ರಮ"}</span>
              </>
            )}
            {effectiveType === "mo_match" && (
              <>
                <Fingerprint className="w-4 h-4 text-amber-500" />
                <span className="text-xs font-bold text-amber-500 tracking-wider uppercase font-mono">{lang === "en" ? "MO Suspect Matches" : "MO ಶಂಕಿತ ಹೊಂದಾಣಿಕೆಗಳು"}</span>
              </>
            )}
            {effectiveType === "correlation" && (
              <>
                <Users className="w-4 h-4 text-[#C79A4E]" />
                <span className="text-xs font-bold text-[#C79A4E] tracking-wider uppercase font-mono">{lang === "en" ? "Demographic Correlations" : "ಜನಸಂಖ್ಯಾ ಸಂಬಂಧಗಳು"}</span>
              </>
            )}
            {effectiveType === "repeat_offenders" && (
              <>
                <Repeat className="w-4 h-4 text-amber-500" />
                <span className="text-xs font-bold text-amber-500 tracking-wider uppercase font-mono">{lang === "en" ? "Repeat Offender Roster" : "ಪುನರಾವರ್ತಿತ ಅಪರಾಧಿಗಳ ಪಟ್ಟಿ"}</span>
              </>
            )}
            {effectiveType === "crime_groups" && (
              <>
                <Link2 className="w-4 h-4 text-amber-500" />
                <span className="text-xs font-bold text-amber-500 tracking-wider uppercase font-mono">{lang === "en" ? "Organized Crime Groups" : "ಸಂಘಟಿತ ಅಪರಾಧ ಗುಂಪುಗಳು"}</span>
              </>
            )}
            {effectiveType === "trend" && (
              <>
                <Activity className="w-4 h-4 text-[#C79A4E]" />
                <span className="text-xs font-bold text-[#C79A4E] tracking-wider uppercase font-mono">{lang === "en" ? "Crime Trend Analysis" : "ಅಪರಾಧ ಪ್ರವೃತ್ತಿ ವಿಶ್ಲೇಷಣೆ"}</span>
              </>
            )}
            {effectiveType === "case_distribution" && (
              <>
                <PieChart className="w-4 h-4 text-[#C79A4E]" />
                <span className="text-xs font-bold text-[#C79A4E] tracking-wider uppercase font-mono">{lang === "en" ? "Case Types Distribution" : "ಪ್ರಕರಣಗಳ ಪ್ರಕಾರ ವಿತರಣೆ"}</span>
              </>
            )}
            {effectiveType === "priority_concerns" && (
              <>
                <ShieldAlert className="w-4 h-4 text-rose-400" />
                <span className="text-xs font-bold text-rose-400 tracking-wider uppercase font-mono">{lang === "en" ? "Priority Concern Board" : "ಆದ್ಯತಾ ಕಾಳಜಿ ಫಲಕ"}</span>
              </>
            )}
            {effectiveType === "case_list" && (
              <>
                <Fingerprint className="w-4 h-4 text-amber-500" />
                <span className="text-xs font-bold text-amber-500 tracking-wider uppercase font-mono">{lang === "en" ? "Case Records" : "ಪ್ರಕರಣ ದಾಖಲೆಗಳು"}</span>
              </>
            )}
          </div>

          {/* Right action group: Explain + Maximize buttons */}
          <div className="flex items-center gap-2">
            {isExplainableChart && (
              <button
                onClick={handleExplainChart}
                disabled={isExplainingChart}
                className="p-1.5 rounded-md border border-transparent hover:border-[#C79A4E]/30 hover:bg-[#C79A4E]/10 text-[#C79A4E]/50 hover:text-[#C79A4E] transition-all cursor-pointer disabled:opacity-50 disabled:cursor-wait"
                title={lang === "en" ? "Explain this chart" : "ಈ ಚಾರ್ಟ್ ವಿವರಿಸಿ"}
              >
                <Sparkles className={`w-3.5 h-3.5 ${isExplainingChart ? "animate-pulse" : ""}`} />
              </button>
            )}
            {isExportableChart && (
              <button
                onClick={handleExportChartPng}
                className="p-1.5 rounded-md border border-transparent hover:border-[#C79A4E]/30 hover:bg-[#C79A4E]/10 text-[#C79A4E]/50 hover:text-[#C79A4E] transition-all cursor-pointer"
                title={lang === "en" ? "Save chart as image" : "ಚಾರ್ಟ್ ಅನ್ನು ಚಿತ್ರವಾಗಿ ಉಳಿಸಿ"}
              >
                <Download className="w-3.5 h-3.5" />
              </button>
            )}
            <button
              onClick={onExpand}
              className="p-1.5 rounded-md border border-transparent hover:border-[#C79A4E]/30 hover:bg-[#C79A4E]/10 text-[#C79A4E]/50 hover:text-[#C79A4E] transition-all cursor-pointer"
              title={lang === "en" ? "Open full screen" : "ಪೂರ್ಣ ಪರದೆ ತೆರೆಯಿರಿ"}
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* F.30: plain-language chart narration, shown right below the
            header once fetched -- collapsed/absent by default so it never
            clutters a chart nobody asked to have explained. */}
        {(isExplainingChart || chartExplanation) && (
          <div className="px-4 py-2 border-b border-[#C79A4E]/15 bg-[#C79A4E]/[0.03] text-[11px] text-stone-300 leading-relaxed flex items-start gap-2">
            <Sparkles className="w-3.5 h-3.5 text-[#C79A4E] shrink-0 mt-0.5" />
            <span>{isExplainingChart ? (lang === "en" ? "Explaining..." : "ವಿವರಿಸಲಾಗುತ್ತಿದೆ...") : chartExplanation}</span>
          </div>
        )}

        {/* Widget body: the map renders its own Leaflet view inline; every other
            type reuses the SAME rich render as the full-screen view (ExpandedOverlay
            in inline mode), so maps, graphs, charts and timelines all appear
            directly in the chat -- no expand step needed. */}
        <div className="text-xs px-4 py-3">
        {effectiveType === "map" ? (() => {
          // F.15: point_count/dominant_crime/dominant_station/case_preview
          // are all real fields cluster_hotspots (agent_loop.py) already
          // attaches -- previously discarded here by this narrower type,
          // same pattern C.6 already fixed on the standalone Spatial screen.
          const hotspots: {
            lat: number; lng: number; label?: string;
            point_count?: number; dominant_crime?: string | null; dominant_station?: string | null;
            case_preview?: string[]; total_case_count?: number;
          }[] = (safeEffectiveData.hotspots || []).filter(
            (h: any) => typeof h?.lat === "number" && typeof h?.lng === "number"
          );
          if (hotspots.length === 0) {
            return (
              <div className="bg-stone-950/65 rounded-lg p-3 font-mono text-[11px] text-stone-400 border border-stone-900">
                {lang === "en" ? "No mappable coordinates for this query." : "ಈ ಪ್ರಶ್ನೆಗೆ ನಕ್ಷೆಗೆ ಹಾಕಬಹುದಾದ ನಿರ್ದೇಶಾಂಕಗಳಿಲ್ಲ."}
              </div>
            );
          }
          return (
            <div className="space-y-2">
              <p className="text-stone-400">
                {lang === "en" ? (
                  <><span className="font-bold text-stone-200">{hotspots.length}</span> hotspot cluster{hotspots.length === 1 ? "" : "s"} plotted.</>
                ) : (
                  <><span className="font-bold text-stone-200">{hotspots.length}</span> ಹಾಟ್‌ಸ್ಪಾಟ್ ಸಮೂಹಗಳನ್ನು ಗುರುತಿಸಲಾಗಿದೆ.</>
                )}
              </p>
              {safeEffectiveData.trend && (safeEffectiveData.trend.recent || safeEffectiveData.trend.prior) ? (
                <div className={`text-[11px] font-mono font-bold flex items-center gap-1 ${safeEffectiveData.trend.direction === "rising" ? "text-rose-400" : safeEffectiveData.trend.direction === "falling" ? "text-[#5DCAA5]" : "text-stone-400"}`}>
                  <span>{safeEffectiveData.trend.direction === "rising" ? "▲" : safeEffectiveData.trend.direction === "falling" ? "▼" : "▬"}</span>
                  <span>{lang === "en" ? "Incidents" : "ಘಟನೆಗಳು"} {safeEffectiveData.trend.direction}{safeEffectiveData.trend.pct_change != null ? ` ${safeEffectiveData.trend.pct_change > 0 ? "+" : ""}${safeEffectiveData.trend.pct_change}%` : ""}</span>
                  <span className="text-stone-500 font-normal">({lang === "en" ? `last ${safeEffectiveData.trend.window_days}d vs prior` : `ಕಳೆದ ${safeEffectiveData.trend.window_days} ದಿನ`})</span>
                </div>
              ) : null}
              <div className="rounded-lg overflow-hidden border border-stone-800 h-[280px] relative z-0">
                <MapContainer
                  center={[hotspots[0].lat, hotspots[0].lng]}
                  zoom={12}
                  scrollWheelZoom={false}
                  style={{ height: "100%", width: "100%", background: "#161412" }}
                >
                  <TileLayer
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                  />
                  <InlineMapFitter points={hotspots} />
                  {(() => {
                    const counts = hotspots.map((h) => {
                      const m = h.label?.match(/\((\d+)\s*incidents?\)/i);
                      return m ? parseInt(m[1], 10) : 0;
                    });
                    const maxC = Math.max(1, ...counts);
                    return hotspots.map((marker, idx) => {
                      const c = counts[idx];
                      const intensity = c ? c / maxC : 0.35;
                      const color = intensity > 0.66 ? "#E24B4A" : intensity > 0.33 ? "#E4C590" : "#C79A4E";
                      const halo = c ? Math.min(18, 7 + c * 0.5) : 8;
                      return (
                        <React.Fragment key={idx}>
                          <CircleMarker center={[marker.lat, marker.lng]} radius={halo}
                            pathOptions={{ color, weight: 1, fillColor: color, fillOpacity: 0.1, opacity: 0.35 }} />
                          <CircleMarker center={[marker.lat, marker.lng]} radius={4}
                            pathOptions={{ color: "#161412", weight: 1.5, fillColor: color, fillOpacity: 1 }}>
                            <Popup>
                              <div className="text-xs font-sans text-stone-900 space-y-1 min-w-[150px] max-w-[220px]">
                                {marker.point_count ? (
                                  <>
                                    <span className="font-bold block">{marker.point_count} {lang === "en" ? "incidents" : "ಘಟನೆಗಳು"}</span>
                                    {marker.dominant_crime && <span className="block text-[11px]">{lang === "en" ? "Type" : "ಬಗೆ"}: <strong>{marker.dominant_crime}</strong></span>}
                                    {marker.dominant_station && <span className="block text-[11px]">{lang === "en" ? "Near" : "ಸಮೀಪ"}: <strong>{marker.dominant_station}</strong></span>}
                                    {marker.case_preview && marker.case_preview.length > 0 && (
                                      <div className="mt-1.5 pt-1.5 border-t border-stone-300">
                                        <span className="block text-[10px] font-bold text-stone-600 mb-0.5">
                                          {lang === "en" ? "Cases in this cluster:" : "ಈ ಸಮೂಹದಲ್ಲಿ ಪ್ರಕರಣಗಳು:"}
                                        </span>
                                        <ul className="space-y-0.5">
                                          {marker.case_preview.map((cn, ci) => (
                                            <li key={ci} className="font-mono text-[10px] text-stone-700 truncate">{cn}</li>
                                          ))}
                                        </ul>
                                        {typeof marker.total_case_count === "number" && marker.total_case_count > marker.case_preview.length && (
                                          <span className="block text-[9.5px] text-stone-500 italic mt-0.5">
                                            +{marker.total_case_count - marker.case_preview.length} {lang === "en" ? "more in this cluster" : "ಇನ್ನಷ್ಟು"}
                                          </span>
                                        )}
                                      </div>
                                    )}
                                  </>
                                ) : (
                                  <span className="font-bold block">{marker.label || (lang === "en" ? "Hotspot" : "ಹಾಟ್‌ಸ್ಪಾಟ್")}</span>
                                )}
                                <span className="font-mono text-stone-500">{marker.lat.toFixed(5)}, {marker.lng.toFixed(5)}</span>
                              </div>
                            </Popup>
                          </CircleMarker>
                        </React.Fragment>
                      );
                    });
                  })()}
                </MapContainer>
              </div>
            </div>
          );
        })() : effectiveType === "priority_concerns" ? (
          <PriorityConcernsView data={safeEffectiveData} lang={lang} />
        ) : effectiveType === "news" ? (
          <NewsView data={safeEffectiveData} lang={lang} />
        ) : (
          <ExpandedOverlay inline type={effectiveType} data={safeEffectiveData} onClose={() => {}} />
        )}
        </div>
      </div>
    </ErrorBoundary>
  );
};

export const InlineWidget = React.memo(InlineWidgetComponent);
