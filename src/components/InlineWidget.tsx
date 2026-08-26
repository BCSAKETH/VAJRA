import React, { useEffect } from "react";
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import { useApp } from "../AppContext";
import { Maximize2, ShieldAlert, MapPin, Network, TrendingUp, Activity, Clock, Fingerprint, Users, Repeat, Link2, PieChart } from "lucide-react";
import { ExpandedOverlay } from "./ExpandedOverlay";

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
  type: "map" | "network" | "risk" | "forecast" | "timeline" | "mo_match" | "correlation" | "repeat_offenders" | "crime_groups" | "trend" | "case_distribution" | "priority_concerns";
  data: any;
  onExpand: () => void;
}

const InlineWidgetComponent: React.FC<InlineWidgetProps> = ({ type, data, onExpand }) => {
  const { lang } = useApp();
  return (
    <div className="glass-card rounded-xl border border-stone-800 p-4 shadow-lg animate-fade-in relative overflow-hidden">
      {/* Header Info */}
      <div className="flex items-center justify-between border-b border-stone-850 pb-2 mb-3">
        <div className="flex items-center gap-2">
          {type === "map" && (
            <>
              <MapPin className="w-4 h-4 text-[#C79A4E]" />
              <span className="text-xs font-bold text-[#C79A4E] tracking-wider uppercase font-mono">{lang === "en" ? "Geospatial Incident Hotspots" : "ಭೌಗೋಳಿಕ ಘಟನಾ ಹಾಟ್‌ಸ್ಪಾಟ್‌ಗಳು"}</span>
            </>
          )}
          {type === "network" && (
            <>
              <Network className="w-4 h-4 text-[#C79A4E]" />
              <span className="text-xs font-bold text-[#C79A4E] tracking-wider uppercase font-mono">{lang === "en" ? "Criminal Syndicate Graph" : "ಅಪರಾಧ ಜಾಲ ಗ್ರಾಫ್"}</span>
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
              <TrendingUp className="w-4 h-4 text-[#C79A4E]" />
              <span className="text-xs font-bold text-[#C79A4E] tracking-wider uppercase font-mono">{lang === "en" ? "Seasonal Trend Forecast" : "ಋತುಮಾನ ಪ್ರವೃತ್ತಿ ಮುನ್ಸೂಚನೆ"}</span>
            </>
          )}
          {type === "timeline" && (
            <>
              <Clock className="w-4 h-4 text-[#C79A4E]" />
              <span className="text-xs font-bold text-[#C79A4E] tracking-wider uppercase font-mono">{lang === "en" ? "Chronological Case Timeline" : "ಪ್ರಕರಣದ ಕಾಲಾನುಕ್ರಮ"}</span>
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
              <Users className="w-4 h-4 text-[#C79A4E]" />
              <span className="text-xs font-bold text-[#C79A4E] tracking-wider uppercase font-mono">{lang === "en" ? "Demographic Correlations" : "ಜನಸಂಖ್ಯಾ ಸಂಬಂಧಗಳು"}</span>
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
          {type === "trend" && (
            <>
              <Activity className="w-4 h-4 text-[#C79A4E]" />
              <span className="text-xs font-bold text-[#C79A4E] tracking-wider uppercase font-mono">{lang === "en" ? "Crime Trend Analysis" : "ಅಪರಾಧ ಪ್ರವೃತ್ತಿ ವಿಶ್ಲೇಷಣೆ"}</span>
            </>
          )}
          {type === "case_distribution" && (
            <>
              <PieChart className="w-4 h-4 text-[#C79A4E]" />
              <span className="text-xs font-bold text-[#C79A4E] tracking-wider uppercase font-mono">{lang === "en" ? "Case Types Distribution" : "ಪ್ರಕರಣಗಳ ಪ್ರಕಾರ ವಿತರಣೆ"}</span>
            </>
          )}
          {type === "priority_concerns" && (
            <>
              <ShieldAlert className="w-4 h-4 text-rose-400" />
              <span className="text-xs font-bold text-rose-400 tracking-wider uppercase font-mono">{lang === "en" ? "Priority Concern Board" : "ಆದ್ಯತಾ ಕಾಳಜಿ ಫಲಕ"}</span>
            </>
          )}
        </div>

        {/* Subtle pop-out to the full-screen artifact view (optional -- the rich
            visualization already renders inline below). */}
        <button
          onClick={onExpand}
          className="p-1 rounded hover:bg-stone-800 text-stone-500 hover:text-stone-300 transition-colors"
          title={lang === "en" ? "Open full screen" : "ಪೂರ್ಣ ಪರದೆ ತೆರೆಯಿರಿ"}
        >
          <Maximize2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Widget body: the map renders its own Leaflet view inline; every other
          type reuses the SAME rich render as the full-screen view (ExpandedOverlay
          in inline mode), so maps, graphs, charts and timelines all appear
          directly in the chat -- no expand step needed. */}
      <div className="text-xs">
        {type === "map" ? (() => {
          const hotspots: { lat: number; lng: number; label?: string }[] = (data.hotspots || []).filter(
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
              {data.trend && (data.trend.recent || data.trend.prior) ? (
                <div className={`text-[11px] font-mono font-bold flex items-center gap-1 ${data.trend.direction === "rising" ? "text-rose-400" : data.trend.direction === "falling" ? "text-[#5DCAA5]" : "text-stone-400"}`}>
                  <span>{data.trend.direction === "rising" ? "▲" : data.trend.direction === "falling" ? "▼" : "▬"}</span>
                  <span>{lang === "en" ? "Incidents" : "ಘಟನೆಗಳು"} {data.trend.direction}{data.trend.pct_change != null ? ` ${data.trend.pct_change > 0 ? "+" : ""}${data.trend.pct_change}%` : ""}</span>
                  <span className="text-stone-500 font-normal">({lang === "en" ? `last ${data.trend.window_days}d vs prior` : `ಕಳೆದ ${data.trend.window_days} ದಿನ`})</span>
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
                  {hotspots.map((marker, idx) => {
                    const countMatch = marker.label?.match(/\((\d+)\s*incidents?\)/i);
                    const incidentCount = countMatch ? parseInt(countMatch[1], 10) : null;
                    const radius = incidentCount ? Math.min(26, 9 + incidentCount * 1.4) : 11;
                    return (
                      <CircleMarker
                        key={idx}
                        center={[marker.lat, marker.lng]}
                        radius={radius}
                        pathOptions={{ color: "#C79A4E", weight: 2, fillColor: "#C79A4E", fillOpacity: 0.35 }}
                      >
                        <Popup>
                          <div className="text-xs font-sans text-stone-900">
                            <span className="font-bold block">{marker.label || (lang === "en" ? "Hotspot" : "ಹಾಟ್‌ಸ್ಪಾಟ್")}</span>
                            {marker.lat.toFixed(5)}, {marker.lng.toFixed(5)}
                          </div>
                        </Popup>
                      </CircleMarker>
                    );
                  })}
                </MapContainer>
              </div>
            </div>
          );
        })() : type === "priority_concerns" ? (
          <PriorityConcernsView data={data} lang={lang} />
        ) : (
          <ExpandedOverlay inline type={type} data={data} onClose={() => {}} />
        )}
      </div>
    </div>
  );
};

export const InlineWidget = React.memo(InlineWidgetComponent);
