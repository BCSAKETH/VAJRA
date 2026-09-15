"""
Real station-level geospatial risk signal for the Tactical 3D Map (Finals-
part 3.md §21-22, "Component D: Backend Spatiotemporal Forecast Engine").

HONEST SCOPE, corrected against the source document before building: that
doc specifies a "24-Hour Forensic Forecast Scrubber" with an hourly
forecast_hour (0-23) and a circadian base_risk heuristic keyed off clock
hour ("18 <= forecast_hour <= 23"). Confirmed, from THREE independent
sources already in this codebase (docs/PLAN_MASTER_BUILD_QUEUE.md,
docs/PLAN_time_hex_syndicate.md, and vajra_core.py's own
compute_mo_vector docstring) before writing a line here: CaseMaster.
CrimeRegisteredDate and Inv_OccuranceTime.OccurrenceDate are DATE-ONLY
across the entire real dataset -- no clock-time component exists anywhere
in the real data. An hour-of-day slider would therefore be fabricated
granularity dressed up as a real signal, exactly the kind of thing this
project's own discipline (see the OMNI-SYNAPSE PPT fact-check, the
Isolation-Forest/Louvain groundedness passes earlier this session) exists
to catch, not reproduce. This module implements the same underlying idea
-- a real, disclosed temporal risk signal per station -- using DAY-OF-WEEK
instead, the same honest substitution already established and shipped
elsewhere in this codebase (docs/PLAN_time_hex_syndicate.md Feature 1,
DistrictSpatialAnalystPanel.tsx's own day-of-week filter).

Also NOT built here: a claimed "SHAP TreeExplainer" attribution. The
doc's own blueprint's "factors" list is hardcoded boilerplate text
("Recorded crime density had little measurable effect...") for every
station regardless of its real data -- not real SHAP output, since no
trained spatiotemporal model exists for station-level risk (the one real
SHAP model in this codebase, XGBoost + SHAP via train_risk_model.py,
scores individual SUSPECTS, not geographic areas -- a different problem).
This module returns a real, disclosed STATISTICAL signal instead (a
z-score against the station's own trailing baseline, the same pattern
agent_loop.py's anomaly_detection tool already uses and discloses
honestly), never a fabricated "XGBoost risk score" for a model that
doesn't exist for this task.

No real per-station coordinate table exists either (confirmed:
docs/SCHEMA.md lists Latitude/Longitude only on CaseMaster, per-CASE, not
on Unit). A station's map position is derived as the real centroid of its
own recent geocoded cases, not a hardcoded 5-station dictionary (the doc's
own KARNATAKA_STATION_COORDINATES, which would only ever place 5 of
Karnataka's 1000+ real stations on the map).
"""
import logging
from datetime import datetime
from typing import Any, Dict, List, Optional

logger = logging.getLogger("spatiotemporal_forecast")

DAY_LABELS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]


def _week_day(date_str: Optional[str]) -> Optional[int]:
    """0=Monday..6=Sunday from a 'YYYY-MM-DD...' date string, matching the
    same real-data convention already established in vajra_core.py."""
    if not date_str:
        return None
    try:
        return datetime.strptime(str(date_str)[:10], "%Y-%m-%d").weekday()
    except Exception:
        return None


def get_district_stations(district: str, catalyst_app: Any) -> List[Dict[str, Any]]:
    """
    Real stations for a district, each with a real centroid derived from its
    own recent geocoded cases (not a hardcoded coordinate dict). Stations
    with zero geocoded cases in the sample are omitted rather than placed at
    a fabricated [0,0]/district-centroid fallback that would misrepresent
    their real location.
    """
    if not catalyst_app or not district:
        return []
    try:
        d_res = catalyst_app.zql().execute_query(
            f"SELECT DistrictID FROM District WHERE DistrictName LIKE '*{district}*' LIMIT 1")
        if not d_res:
            return []
        dist_id = d_res[0].get("District", {}).get("DistrictID")
        units = catalyst_app.zql().execute_query(
            f"SELECT UnitID, UnitName FROM Unit WHERE DistrictID = {dist_id} LIMIT 60")
        stations = []
        for u in units:
            ud = u.get("Unit", {})
            unit_id = ud.get("UnitID")
            unit_name = ud.get("UnitName")
            if not unit_id or not unit_name:
                continue
            rows = catalyst_app.zql().execute_query(
                f"SELECT Latitude, Longitude, CrimeMajorHeadID FROM CaseMaster "
                f"WHERE PoliceStationID = {unit_id} AND Latitude IS NOT NULL AND Longitude IS NOT NULL LIMIT 300")
            coords = [(float(r.get("CaseMaster", {}).get("Latitude")), float(r.get("CaseMaster", {}).get("Longitude")))
                      for r in rows if r.get("CaseMaster", {}).get("Latitude") is not None]
            if not coords:
                continue
            lat = sum(c[0] for c in coords) / len(coords)
            lng = sum(c[1] for c in coords) / len(coords)
            stations.append({
                "unit_id": unit_id, "name": unit_name, "district": district,
                "lat": round(lat, 6), "lng": round(lng, 6), "sample_size": len(coords),
            })
        return stations
    except Exception as e:
        logger.warning(f"get_district_stations failed for {district!r}: {e}")
        return []


def get_station_forecast(unit_id: int, day_of_week: Optional[int], catalyst_app: Any) -> Dict[str, Any]:
    """
    Real day-of-week risk signal for ONE station: fetches this station's own
    recent cases (paginated to one 300-row page, same sample-size honesty as
    the rest of this module), buckets by real weekday, and reports the
    selected day's z-score against the station's own weekly baseline --
    the same statistical-significance discipline agent_loop.py's
    anomaly_detection tool already uses, not a fabricated ML score.
    """
    if not catalyst_app or not unit_id:
        return {"status": "unavailable"}
    try:
        rows = catalyst_app.zql().execute_query(
            f"SELECT CrimeRegisteredDate, CrimeMajorHeadID FROM CaseMaster "
            f"WHERE PoliceStationID = {unit_id} LIMIT 300")
        by_day: Dict[int, int] = {i: 0 for i in range(7)}
        crime_head_counts: Dict[Any, int] = {}
        total = 0
        for r in rows:
            cm = r.get("CaseMaster", {})
            wd = _week_day(cm.get("CrimeRegisteredDate"))
            if wd is not None:
                by_day[wd] += 1
                total += 1
            head_id = cm.get("CrimeMajorHeadID")
            if head_id:
                crime_head_counts[head_id] = crime_head_counts.get(head_id, 0) + 1

        dominant_crime = None
        if crime_head_counts:
            top_head_id = max(crime_head_counts, key=lambda k: crime_head_counts[k])
            try:
                ch = catalyst_app.zql().execute_query(f"SELECT CrimeGroupName FROM CrimeHead WHERE CrimeHeadID = {top_head_id} LIMIT 1")
                dominant_crime = ch[0].get("CrimeHead", {}).get("CrimeGroupName") if ch else None
            except Exception:
                dominant_crime = None

        if total < 14:  # not enough real history to say anything statistically meaningful
            return {
                "status": "insufficient_data", "sample_size": total,
                "dominant_crime": dominant_crime,
                "message": f"Only {total} geocoded cases on record for this station -- too few for a reliable day-of-week signal.",
            }

        counts = list(by_day.values())
        mean = sum(counts) / 7.0
        variance = sum((c - mean) ** 2 for c in counts) / 7.0
        stdev = variance ** 0.5 or 1.0

        if day_of_week is None:
            selected_count = round(mean)
            z = 0.0
            day_label = "All days (average)"
        else:
            selected_count = by_day.get(day_of_week, 0)
            z = (selected_count - mean) / stdev
            day_label = DAY_LABELS[day_of_week] if 0 <= day_of_week <= 6 else "Unknown"

        # Score is a plain, disclosed statistical percentile-style read, NOT
        # a trained model's probability -- explicitly labeled as such below.
        tier = "elevated" if z >= 1.0 else "typical" if z >= -1.0 else "quiet"

        return {
            "status": "ok",
            "sample_size": total,
            "day_label": day_label,
            "selected_day_count": selected_count,
            "weekly_average": round(mean, 1),
            "z_score": round(z, 2),
            "tier": tier,
            "dominant_crime": dominant_crime,
            "disclosure": (
                "Statistical read of this station's own recorded case history by day of week "
                "(z-score against its 7-day average) -- not a trained predictive model, and not "
                "an hour-of-day forecast (CCTNS records here carry no clock-time)."
            ),
        }
    except Exception as e:
        logger.warning(f"get_station_forecast failed for unit_id={unit_id}: {e}")
        return {"status": "error"}
