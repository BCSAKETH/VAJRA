import os
import requests
import json
import logging
from datetime import datetime

# Logger setup
logger = logging.getLogger()
logger.setLevel(logging.INFO)

# Load environment or use fallbacks
PROJECT_ID = os.getenv("CATALYST_PROJECT_ID", "50212000000025002")
CLIENT_ID = os.getenv("CATALYST_CLIENT_ID")
CLIENT_SECRET = os.getenv("CATALYST_CLIENT_SECRET")
REFRESH_TOKEN = os.getenv("CATALYST_REFRESH_TOKEN")

ZCQL_URL = f"https://api.catalyst.zoho.in/baas/v1/project/{PROJECT_ID}/query"
TOKEN_URL = "https://accounts.zoho.in/oauth/v2/token"

def get_token():
    payload = {
        "client_id": CLIENT_ID,
        "client_secret": CLIENT_SECRET,
        "refresh_token": REFRESH_TOKEN,
        "grant_type": "refresh_token"
    }
    try:
        res = requests.post(TOKEN_URL, data=payload, timeout=10)
        return res.json().get("access_token")
    except Exception as e:
        logger.error(f"Auth token generation failure: {e}")
        return None


def fetch_all(headers, select_clause, table, max_pages=50):
    """
    ZCQL caps every query at 300 rows, whether or not a LIMIT is given (an
    unbounded query silently returns only the first 300). CaseMaster (~8000
    rows) and Accused (~14000 rows) both need every row to compute real
    district/offender counts, so page through with LIMIT offset, 300 until a
    short page signals the end.
    """
    rows = []
    offset = 0
    for _ in range(max_pages):
        q = f"SELECT {select_clause} FROM {table} LIMIT {offset}, 300"
        res = requests.post(ZCQL_URL, headers=headers, json={"query": q}, timeout=20)
        page = res.json().get("data", [])
        rows.extend(page)
        if len(page) < 300:
            break
        offset += 300
    return rows


def handler(context, basic_val):
    logger.info("Starting Proactive Alerts Job Function...")
    try:
        token = get_token()
        if not token:
            logger.error("Failed to fetch access token.")
            return "Auth failure"
            
        headers = {
            "Authorization": f"Zoho-oauthtoken {token}",
            "Content-Type": "application/json",
            "X-Catalyst-Environment": "Development",
            "environment": "Development"
        }
        
        # 1. District Case-Volume Spike Detection
        # Fetch case master station links (paginated -- CaseMaster has ~8000 rows,
        # far past ZCQL's 300-row-per-query cap)
        cases_list = fetch_all(headers, "CaseMasterID, PoliceStationID", "CaseMaster")
        case_to_ps = {
            int(c["CaseMaster"]["CaseMasterID"]): int(c["CaseMaster"]["PoliceStationID"])
            for c in cases_list
            if c.get("CaseMaster", {}).get("CaseMasterID") and c.get("CaseMaster", {}).get("PoliceStationID")
        }

        # Fetch station to district mapping (Unit is small, one page is enough)
        units_q = "SELECT UnitID, DistrictID FROM Unit"
        res = requests.post(ZCQL_URL, headers=headers, json={"query": units_q}, timeout=15)
        units_list = res.json().get("data", [])
        unit_to_dist = {int(u["Unit"]["UnitID"]): int(u["Unit"]["DistrictID"]) for u in units_list if u.get("Unit", {}).get("UnitID") and u.get("Unit", {}).get("DistrictID")}

        # Fetch districts lookup (small, one page)
        d_q = "SELECT DistrictID, DistrictName FROM District"
        res = requests.post(ZCQL_URL, headers=headers, json={"query": d_q}, timeout=15)
        dist_list = res.json().get("data", [])
        dist_names = {int(d["District"]["DistrictID"]): d["District"]["DistrictName"] for d in dist_list if d.get("District", {}).get("DistrictID")}
        
        # Count cases per district
        dist_counts = {}
        for c in cases_list:
            ps_id = c.get("CaseMaster", {}).get("PoliceStationID")
            if ps_id and int(ps_id) in unit_to_dist:
                d_id = unit_to_dist[int(ps_id)]
                dist_counts[d_id] = dist_counts.get(d_id, 0) + 1
                
        spatial_alerts = []
        for d_id, count in dist_counts.items():
            d_name = dist_names.get(d_id, f"District {d_id}")
            if count > 250:
                alert_msg = f"Volume Spike Warning: {d_name} has logged {count} incidents, exceeding normal threshold limits."
                spatial_alerts.append({
                    "AlertType": "SPATIAL_SPIKE",
                    "DistrictID": d_id,
                    "AlertMessage": alert_msg,
                    "TriggerTime": datetime.now().isoformat(),
                    "Severity": "Critical",
                    "IsRead": False,
                    "_sort_key": count
                })

        # 2. Repeat Offender Check (paginated -- Accused has ~14000 rows)
        acc_list = fetch_all(headers, "AccusedName, CaseMasterID", "Accused")

        acc_counts = {}
        acc_last_district = {}
        for a in acc_list:
            name = a.get("Accused", {}).get("AccusedName")
            case_id = a.get("Accused", {}).get("CaseMasterID")
            if name and name.strip() and "unknown" not in name.lower():
                acc_counts[name] = acc_counts.get(name, 0) + 1
                ps_id = case_to_ps.get(int(case_id)) if case_id else None
                if ps_id and ps_id in unit_to_dist:
                    acc_last_district[name] = unit_to_dist[ps_id]

        repeat_offender_alerts = []
        for name, count in acc_counts.items():
            if count > 1:
                d_id = acc_last_district.get(name, 1)
                alert_msg = f"Repeat Offender Alert: Suspect '{name}' detected in {count} separate cases."
                repeat_offender_alerts.append({
                    "AlertType": "REPEAT_OFFENDER",
                    "DistrictID": d_id,
                    "AlertMessage": alert_msg,
                    "TriggerTime": datetime.now().isoformat(),
                    "Severity": "Critical" if count > 3 else "Warning",
                    "IsRead": False,
                    "_sort_key": count
                })

        # Cap each alert TYPE independently (most severe first within each
        # type) rather than truncating one combined list -- confirmed live:
        # with the old combined-then-slice[:20] approach, 21 real district
        # volume spikes (a real, large district count in this dataset) filled
        # every insert slot before the repeat-offender loop's alerts were
        # ever reached, so REPEAT_OFFENDER rows were silently never written
        # at all despite being correctly computed. get_repeat_offenders (the
        # chat tool that reads this table) always reported "none found" as a
        # result, not because no repeat offenders exist in the data, but
        # because this truncation threw their alerts away before they were
        # ever saved.
        spatial_alerts.sort(key=lambda a: a["_sort_key"], reverse=True)
        repeat_offender_alerts.sort(key=lambda a: a["_sort_key"], reverse=True)
        alerts_to_insert = spatial_alerts[:20] + repeat_offender_alerts[:20]

        # Save alerts to ProactiveAlerts table (if it exists)
        for alert in alerts_to_insert:
            insert_q = f"""
                INSERT INTO ProactiveAlerts (AlertType, DistrictID, AlertMessage, TriggerTime, Severity, IsRead)
                VALUES ('{alert["AlertType"]}', {alert["DistrictID"]}, '{alert["AlertMessage"].replace("'", "''")}', '{alert["TriggerTime"]}', '{alert["Severity"]}', false)
            """
            res = requests.post(ZCQL_URL, headers=headers, json={"query": insert_q}, timeout=10)
            if "No such Table" in res.text:
                logger.warning("ProactiveAlerts table does not exist in Catalyst Console Datastore. Skipping insert.")
                break

        logger.info(f"Proactive Alerts Job completed successfully. Generated {len(alerts_to_insert)} alerts "
                    f"({len(spatial_alerts[:20])} spatial spike, {len(repeat_offender_alerts[:20])} repeat offender).")
        return "Success"
    except Exception as e:
        logger.error(f"Error in Proactive Alerts Job: {e}")
        return "Error"
