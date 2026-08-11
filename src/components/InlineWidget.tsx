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

interface InlineWidgetProps {
  type: "map" | "network" | "risk" | "forecast" | "timeline" | "mo_match" | "correlation" | "repeat_offenders" | "crime_groups" | "trend" | "case_distribution";
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
        })() : (
          <ExpandedOverlay inline type={type} data={data} onClose={() => {}} />
        )}
      </div>
    </div>
  );
};

export const InlineWidget = React.memo(InlineWidgetComponent);
