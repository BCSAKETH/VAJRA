import React, { useState, useEffect, useCallback, useRef } from "react";
import { useApp } from "../AppContext";
import { API_BASE } from "../config";
import { Tactical3DMap, TacticalStation } from "./Tactical3DMap";
import { ForecastTimeSlider } from "./ForecastTimeSlider";
import { StationIntelligencePanel, StationForecastResult } from "./StationIntelligencePanel";

interface DistrictSummaryRow {
  district_id: number;
  district: string;
}

/**
 * Tactical 3D Map fold-in: same precedent already set for Spatial Analyst /
 * Demographic Correlation / Case Registry, which retired as standalone nav
 * screens and now live only as District Analytics tabs. CrimeIntelligenceScreen.tsx
 * is retired as a nav destination in favor of this; all the real data wiring
 * and the 3 confirmed-live bug fixes made against it (MapLibre v6 worker 404,
 * camera stuck on district switch, sequential district-stations round-trips)
 * carry over unchanged -- this is the same component tree, just hosted here.
 *
 * Per-station 3D geometry has no statewide equivalent (the backend requires a
 * district -- there is no "all 1,112 stations at once" 3D scene), so unlike
 * the other three folded-in panels this keeps its own district selector
 * rather than accepting null-as-statewide; it seeds from the district already
 * selected on the Overview tab when there is one.
 */
export const DistrictTacticalPanel: React.FC<{ district: string | null }> = ({ district }) => {
  const { lang, theme } = useApp();
  const authHeaders = { Authorization: `Bearer ${localStorage.getItem("vajra_token") || ""}` };

  const [districts, setDistricts] = useState<DistrictSummaryRow[]>([]);
  const [selectedDistrict, setSelectedDistrict] = useState<string>(district || "");
  const [stations, setStations] = useState<TacticalStation[]>([]);
  const [isLoadingStations, setIsLoadingStations] = useState(false);
  const [stationsDebug, setStationsDebug] = useState<{
    district_matched?: boolean; unit_count?: number; geocoded_case_rows?: number;
  } | null>(null);
  const [selectedStation, setSelectedStation] = useState<TacticalStation | null>(null);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [forecast, setForecast] = useState<StationForecastResult | null>(null);
  const [isLoadingForecast, setIsLoadingForecast] = useState(false);

  useEffect(() => {
    fetch(`${API_BASE}/api/dashboard/districts/summary`, { headers: authHeaders })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        const rows: DistrictSummaryRow[] = d?.districts || [];
        setDistricts(rows);
        if (!selectedDistrict && rows.length) setSelectedDistrict(rows[0].district);
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      .then((d) => {
        setStations(Array.isArray(d?.stations) ? d.stations : []);
        setStationsDebug(d?.debug || null);
      })
      .catch((e) => { if (e?.name !== "AbortError") { setStations([]); setStationsDebug(null); } })
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

  const mapStations: TacticalStation[] = stations.map((s) =>
    selectedStation && String(s.unit_id) === String(selectedStation.unit_id) && forecast?.status === "ok"
      ? { ...s, tier: forecast.tier }
      : s
  );

  return (
    <div className="glass-card p-4 border border-stone-850 space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="space-y-0.5">
          <h3 className="text-[11px] font-black text-stone-200 uppercase tracking-wider font-mono">
            {lang === "en" ? "Tactical 3D Map" : "ಟ್ಯಾಕ್ಟಿಕಲ್ 3D ನಕ್ಷೆ"}
          </h3>
          <p className="text-[9.5px] text-stone-600 leading-relaxed">
            {lang === "en"
              ? "3D building envelopes are derived from crowd-sourced OpenStreetMap data for spatial orientation only -- not surveyed architectural elevations. Computed exclusively from historical registered-case density and day-of-week patterns; never demographics, ethnicity, caste, or individual profiling."
              : "3D ಕಟ್ಟಡ ಆಕಾರಗಳು OpenStreetMap ಡೇಟಾದಿಂದ ಪಡೆಯಲಾಗಿದೆ -- ಸಮೀಕ್ಷಿತ ವಾಸ್ತುಶಿಲ್ಪದ ಎತ್ತರಗಳಲ್ಲ. ಈ ವೀಕ್ಷಣೆಯು ಐತಿಹಾಸಿಕ ಪ್ರಕರಣ ಸಾಂದ್ರತೆಯಿಂದ ಮಾತ್ರ ಲೆಕ್ಕಹಾಕಲ್ಪಡುತ್ತದೆ."}
          </p>
        </div>
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

      <div className="min-h-[560px] grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-3">
        <div className="flex flex-col gap-3 min-h-0">
          <div className="flex-1 min-h-[320px] relative">
            {isLoadingStations ? (
              <div className="w-full h-full flex items-center justify-center rounded-xl border border-stone-800 bg-stone-900/40">
                <div className="w-8 h-8 border-2 border-stone-800 border-t-[#C79A4E] rounded-full animate-spin" />
              </div>
            ) : (
              <>
                {stations.length === 0 && (
                  <div className="absolute top-3 left-1/2 -translate-x-1/2 z-30 px-3 py-2 rounded-lg bg-stone-950/90 border border-amber-500/30 text-[11px] text-amber-300/90 font-mono shadow-xl max-w-md text-center">
                    {!stationsDebug?.district_matched
                      ? (lang === "en"
                          ? `"${selectedDistrict}" didn't match any real district record.`
                          : `"${selectedDistrict}" ಯಾವುದೇ ನೈಜ ಜಿಲ್ಲಾ ದಾಖಲೆಗೆ ಹೊಂದಿಕೆಯಾಗಲಿಲ್ಲ.`)
                      : !stationsDebug?.unit_count
                      ? (lang === "en"
                          ? `${selectedDistrict} has no police stations on record.`
                          : `${selectedDistrict}ಗೆ ಯಾವುದೇ ಠಾಣೆ ದಾಖಲೆ ಇಲ್ಲ.`)
                      : (lang === "en"
                          ? `${selectedDistrict}'s ${stationsDebug.unit_count} stations have ${stationsDebug.geocoded_case_rows ?? 0} geocoded cases between them -- none yet at any single station.`
                          : `${selectedDistrict}ನ ${stationsDebug.unit_count} ಠಾಣೆಗಳಿಗೆ ${stationsDebug.geocoded_case_rows ?? 0} ನಿರ್ದೇಶಾಂಕ ಪ್ರಕರಣಗಳು ಮಾತ್ರ.`)}
                  </div>
                )}
                <Tactical3DMap
                  stations={mapStations}
                  selectedUnitId={selectedStation?.unit_id ?? null}
                  onSelectStation={handleSelectStation}
                  isDark={theme !== "light"}
                  district={selectedDistrict}
                />
              </>
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
