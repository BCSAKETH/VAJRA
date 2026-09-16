import React, { useState, useEffect, useCallback, useRef } from "react";
import { Compass } from "lucide-react";
import { useApp } from "../AppContext";
import { API_BASE } from "../config";
import { Tactical3DMap, TacticalStation } from "../components/Tactical3DMap";
import { ForecastTimeSlider } from "../components/ForecastTimeSlider";
import { StationIntelligencePanel, StationForecastResult } from "../components/StationIntelligencePanel";

interface DistrictSummaryRow {
  district_id: number;
  district: string;
}

/**
 * Finals-part 3.md §21-22, "Component E: Workspace Screen Integration."
 * Hosts the Tactical 3D Map + day-of-week pattern selector + station
 * intelligence panel, all wired to real data (spatiotemporal_forecast.py).
 * See Tactical3DMap.tsx / ForecastTimeSlider.tsx / StationIntelligencePanel.tsx
 * for the specific corrections made against the source document (no
 * hour-of-day forecast, no fabricated SHAP attribution, no per-station
 * hardcoded coordinates, no fake patrol-dispatch action).
 */
export const CrimeIntelligenceScreen: React.FC = () => {
  const { lang, theme } = useApp();
  const authHeaders = { Authorization: `Bearer ${localStorage.getItem("vajra_token") || ""}` };

  const [districts, setDistricts] = useState<DistrictSummaryRow[]>([]);
  const [selectedDistrict, setSelectedDistrict] = useState<string>("");
  const [stations, setStations] = useState<TacticalStation[]>([]);
  const [isLoadingStations, setIsLoadingStations] = useState(false);
  const [selectedStation, setSelectedStation] = useState<TacticalStation | null>(null);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [forecast, setForecast] = useState<StationForecastResult | null>(null);
  const [isLoadingForecast, setIsLoadingForecast] = useState(false);

  // Real district list -- same endpoint DistrictDashboardScreen already uses.
  useEffect(() => {
    fetch(`${API_BASE}/api/dashboard/districts/summary`, { headers: authHeaders })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        const rows: DistrictSummaryRow[] = d?.districts || [];
        setDistricts(rows);
        if (rows.length && !selectedDistrict) setSelectedDistrict(rows[0].district);
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Real stations + centroids for the selected district. L196: AbortController
  // guards against a fast district switch racing a slower earlier fetch.
  useEffect(() => {
    if (!selectedDistrict) return;
    const controller = new AbortController();
    setIsLoadingStations(true);
    setSelectedStation(null);
    setForecast(null);
    fetch(`${API_BASE}/api/geospatial/district-stations?district=${encodeURIComponent(selectedDistrict)}`, {
      headers: authHeaders,
      signal: controller.signal,
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setStations(Array.isArray(d?.stations) ? d.stations : []))
      .catch((e) => { if (e?.name !== "AbortError") setStations([]); })
      .finally(() => setIsLoadingStations(false));
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDistrict]);

  const fetchForecast = useCallback((station: TacticalStation, day: number | null) => {
    const controller = new AbortController();
    setIsLoadingForecast(true);
    const qs = new URLSearchParams({ unit_id: String(station.unit_id) });
    if (day !== null) qs.set("day_of_week", String(day));
    fetch(`${API_BASE}/api/geospatial/station-forecast?${qs.toString()}`, {
      headers: authHeaders,
      signal: controller.signal,
    })
      .then((r) => (r.ok ? r.json() : { status: "error" }))
      .then((d) => setForecast(d))
      .catch((e) => { if (e?.name !== "AbortError") setForecast({ status: "error" }); })
      .finally(() => setIsLoadingForecast(false));
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const abortRef = useRef<(() => void) | null>(null);
  useEffect(() => {
    if (!selectedStation) return;
    abortRef.current?.();
    abortRef.current = fetchForecast(selectedStation, selectedDay);
    return () => abortRef.current?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedStation, selectedDay]);

  const handleSelectStation = useCallback((station: TacticalStation) => {
    setSelectedStation(station);
  }, []);

  // Overlay each station's own tier (from its OWN forecast, once fetched)
  // so the map itself carries the same signal -- but only the currently
  // selected station's tier is known at any time (fetching all stations'
  // forecasts eagerly would be one request per station); other pins render
  // neutral until clicked.
  const mapStations: TacticalStation[] = stations.map((s) =>
    selectedStation && String(s.unit_id) === String(selectedStation.unit_id) && forecast?.status === "ok"
      ? { ...s, tier: forecast.tier }
      : s
  );

  return (
    <div className="h-full flex flex-col p-4 gap-3 bg-stone-950/20">
      <div className="flex items-center justify-between flex-wrap gap-2 shrink-0">
        <h2 className="text-base font-black text-stone-100 uppercase tracking-wider font-mono flex items-center gap-2">
          <Compass className="w-5 h-5 text-[#C79A4E]" />
          <span>{lang === "en" ? "Crime Intelligence" : "ಅಪರಾಧ ಗುಪ್ತಚರ"}</span>
        </h2>
        <select
          value={selectedDistrict}
          onChange={(e) => setSelectedDistrict(e.target.value)}
          className="bg-stone-900 border border-stone-800 rounded-md text-[11px] font-mono font-bold text-stone-300 px-2.5 py-1.5 cursor-pointer"
        >
          {districts.map((d) => (
            <option key={d.district_id} value={d.district}>{d.district}</option>
          ))}
        </select>
      </div>

      {/* L204 + L210: real statutory/ethical disclosures, not decorative --
          matches this project's own established discipline of stating a
          feature's real limits/scope plainly rather than implying more
          precision or authority than the underlying data supports. */}
      <p className="text-[9.5px] text-stone-600 leading-relaxed shrink-0 -mt-1">
        {lang === "en"
          ? "3D building envelopes are derived from crowd-sourced OpenStreetMap data for spatial orientation only -- not surveyed architectural elevations. This view computes exclusively from historical registered-case density and day-of-week patterns; it never uses demographics, ethnicity, caste, or individual profiling."
          : "3D ಕಟ್ಟಡ ಆಕಾರಗಳು OpenStreetMap ಡೇಟಾದಿಂದ ಪಡೆಯಲಾಗಿದೆ -- ಸಮೀಕ್ಷಿತ ವಾಸ್ತುಶಿಲ್ಪದ ಎತ್ತರಗಳಲ್ಲ. ಈ ವೀಕ್ಷಣೆಯು ಐತಿಹಾಸಿಕ ಪ್ರಕರಣ ಸಾಂದ್ರತೆಯಿಂದ ಮಾತ್ರ ಲೆಕ್ಕಹಾಕಲ್ಪಡುತ್ತದೆ."}
      </p>

      <div className="flex-1 min-h-0 grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-3">
        <div className="flex flex-col gap-3 min-h-0">
          <div className="flex-1 min-h-[320px]">
            {isLoadingStations ? (
              <div className="w-full h-full flex items-center justify-center rounded-xl border border-stone-800 bg-stone-900/40">
                <div className="w-8 h-8 border-2 border-stone-800 border-t-[#C79A4E] rounded-full animate-spin" />
              </div>
            ) : (
              <Tactical3DMap
                stations={mapStations}
                selectedUnitId={selectedStation?.unit_id ?? null}
                onSelectStation={handleSelectStation}
                isDark={theme !== "light"}
                district={selectedDistrict}
              />
            )}
          </div>
          <ForecastTimeSlider selectedDay={selectedDay} onChangeDay={setSelectedDay} lang={lang} />
        </div>
        <div className="min-h-[320px]">
          <StationIntelligencePanel
            station={selectedStation}
            forecast={forecast}
            isLoading={isLoadingForecast}
            lang={lang}
          />
        </div>
      </div>
    </div>
  );
};
