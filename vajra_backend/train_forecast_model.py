# Time-series seasonal forecasting background job script for Zoho Catalyst
import os
import logging
from collections import defaultdict
from datetime import datetime
from typing import Dict
from dotenv import load_dotenv

load_dotenv(dotenv_path=os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env"))
from vajra_core import catalyst_app, zcql_insert_row

logger = logging.getLogger("train_forecast_model")
logging.basicConfig(level=logging.INFO)


def run_forecasting_job():
    logger.info("Initializing Crime Time-Series Forecasting Job...")
    if not catalyst_app:
        logger.error("Zoho Catalyst SDK not initialized. Cannot run forecasting job.")
        return

    try:
        # 1. Fetch historical incident registrations, with the lookup data
        # needed to resolve real district/crime-type names (CaseMaster only
        # stores PoliceStationID/CrimeMajorHeadID). This previously fetched
        # cases_res and then never used it -- every row was random.uniform().
        logger.info("Fetching CaseMaster records...")
        cases_res = catalyst_app.zql().execute_query(
            "SELECT PoliceStationID, CrimeMajorHeadID, CrimeRegisteredDate FROM CaseMaster LIMIT 250"
        )
        district_res = catalyst_app.zql().execute_query("SELECT DistrictID, DistrictName FROM District")
        district_map = {r["District"]["DistrictID"]: r["District"]["DistrictName"] for r in district_res}
        unit_res = catalyst_app.zql().execute_query("SELECT UnitID, DistrictID FROM Unit")
        unit_district_map = {r["Unit"]["UnitID"]: r["Unit"]["DistrictID"] for r in unit_res}
        crimehead_res = catalyst_app.zql().execute_query("SELECT CrimeHeadID, CrimeGroupName FROM CrimeHead")
        crimehead_map = {r["CrimeHead"]["CrimeHeadID"]: r["CrimeHead"]["CrimeGroupName"] for r in crimehead_res}

        forecast_period = "Next 30 Days"

        # 2. Bucket real cases by (district, crime_type, year-month) so the
        # historical average and seasonal trend below reflect actual
        # registered incidents rather than invented numbers.
        monthly_counts: Dict = defaultdict(lambda: defaultdict(int))
        crime_type_totals: Dict = defaultdict(int)
        district_monthly_totals: Dict = defaultdict(lambda: defaultdict(int))
        total_cases = 0
        for r in cases_res:
            c = r.get("CaseMaster", {})
            unit_id = c.get("PoliceStationID")
            ch_id = c.get("CrimeMajorHeadID")
            raw_date = c.get("CrimeRegisteredDate")
            if not (unit_id and ch_id and raw_date):
                continue
            dist_id = unit_district_map.get(unit_id)
            district_name = district_map.get(dist_id)
            crime_type = crimehead_map.get(ch_id)
            if not (district_name and crime_type):
                continue
            month_key = raw_date[:7]  # "YYYY-MM"
            monthly_counts[(district_name, crime_type)][month_key] += 1
            district_monthly_totals[district_name][month_key] += 1
            crime_type_totals[crime_type] += 1
            total_cases += 1

        crime_types = sorted(crimehead_map.values())
        overall_crime_share = {
            ct: (crime_type_totals.get(ct, 0) / total_cases if total_cases else 1.0 / max(len(crime_types), 1))
            for ct in crime_types
        }

        # Clear existing forecast records first to avoid duplicate results
        try:
            catalyst_app.zql().execute_query("DELETE FROM ForecastResults")
            logger.info("Cleared previous ForecastResults entries.")
        except Exception as e:
            logger.warning(f"Error clearing ForecastResults table (might be empty): {e}")

        logger.info("Aggregating real historical incident data into district/crime-type forecasts...")
        records_to_insert = []
        for dist_name in sorted(district_map.values()):
            dist_months = district_monthly_totals.get(dist_name, {})
            dist_avg_monthly = (sum(dist_months.values()) / len(dist_months)) if dist_months else 0.0

            for crime in crime_types:
                combo_months = monthly_counts.get((dist_name, crime), {})
                if combo_months:
                    # Directly observed real data for this exact combination.
                    values = list(combo_months.values())
                    historical_avg = round(sum(values) / len(values), 2)
                    recent_months = sorted(combo_months.keys())[-3:]
                    recent_avg = sum(combo_months[m] for m in recent_months) / len(recent_months)
                    seasonal_factor = round(recent_avg / historical_avg, 3) if historical_avg > 0 else 1.0
                    # More observed months -> more confidence in the estimate.
                    confidence = round(min(0.95, 0.55 + 0.08 * len(combo_months)), 2)
                else:
                    # No real cases for this exact (district, crime) pair in the
                    # sample -- extrapolate from the district's real overall
                    # volume times this crime type's real share of all cases,
                    # rather than inventing a number outright. Flagged with a
                    # lower confidence since it's an extrapolation, not an
                    # observation.
                    historical_avg = round(dist_avg_monthly * overall_crime_share.get(crime, 0.0), 2)
                    seasonal_factor = 1.0
                    confidence = 0.4 if dist_avg_monthly > 0 else 0.25

                predicted = round(historical_avg * seasonal_factor, 2)

                row = {
                    "district": dist_name,
                    "crime_type": crime,
                    "forecast_period": forecast_period,
                    "predicted_count": predicted,
                    "historical_avg": historical_avg,
                    "confidence_score": confidence,
                    "generated_at": datetime.utcnow().isoformat()
                }
                zcql_insert_row("ForecastResults", row)
                records_to_insert.append(row)

        logger.info(f"Forecasting job complete. Successfully inserted {len(records_to_insert)} forecasted rows into ForecastResults datastore (from {total_cases} real cases).")

    except Exception as e:
        logger.error(f"Error executing time-series forecasting pipeline: {e}")


if __name__ == "__main__":
    run_forecasting_job()
