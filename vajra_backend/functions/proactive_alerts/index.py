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
        # Fetch case master station links
        cases_q = "SELECT PoliceStationID FROM CaseMaster"
        res = requests.post(ZCQL_URL, headers=headers, json={"query": cases_q}, timeout=15)
        cases_list = res.json().get("data", [])
        
        # Fetch station to district mapping
        units_q = "SELECT UnitID, DistrictID FROM Unit"
        res = requests.post(ZCQL_URL, headers=headers, json={"query": units_q}, timeout=15)
        units_list = res.json().get("data", [])
        unit_to_dist = {int(u["Unit"]["UnitID"]): int(u["Unit"]["DistrictID"]) for u in units_list if u.get("Unit", {}).get("UnitID") and u.get("Unit", {}).get("DistrictID")}
        
        # Fetch districts lookup
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
                
        alerts_to_insert = []
        for d_id, count in dist_counts.items():
            d_name = dist_names.get(d_id, f"District {d_id}")
            if count > 250:
                alert_msg = f"Volume Spike Warning: {d_name} has logged {count} incidents, exceeding normal threshold limits."
                alerts_to_insert.append({
                    "alert_type": "SPATIAL_SPIKE",
                    "district_name": d_name,
                    "alert_message": alert_msg,
                    "timestamp": datetime.now().isoformat()
                })
                
        # 2. Repeat Offender Check
        acc_q = "SELECT AccusedName, CaseMasterID FROM Accused"
        res = requests.post(ZCQL_URL, headers=headers, json={"query": acc_q}, timeout=15)
        acc_list = res.json().get("data", [])
        
        acc_counts = {}
        for a in acc_list:
            name = a.get("Accused", {}).get("AccusedName")
            if name and name.strip() and "unknown" not in name.lower():
                acc_counts[name] = acc_counts.get(name, 0) + 1
                
        for name, count in acc_counts.items():
            if count > 1:
                alert_msg = f"Repeat Offender Alert: Suspect '{name}' detected in {count} separate cases."
                alerts_to_insert.append({
                    "alert_type": "REPEAT_OFFENDER",
                    "district_name": "Multiple Districts",
                    "alert_message": alert_msg,
                    "timestamp": datetime.now().isoformat()
                })
                
        # Save alerts to ProactiveAlerts table (if it exists)
        for alert in alerts_to_insert[:20]:
            insert_q = f"""
                INSERT INTO ProactiveAlerts (alert_type, district_name, alert_message, timestamp)
                VALUES ('{alert["alert_type"]}', '{alert["district_name"]}', '{alert["alert_message"].replace("'", "''")}', '{alert["timestamp"]}')
            """
            res = requests.post(ZCQL_URL, headers=headers, json={"query": insert_q}, timeout=10)
            if "No such Table" in res.text:
                logger.warning("ProactiveAlerts table does not exist in Catalyst Console Datastore. Skipping insert.")
                break
                
        logger.info(f"Proactive Alerts Job completed successfully. Generated {len(alerts_to_insert)} alerts.")
        return "Success"
    except Exception as e:
        logger.error(f"Error in Proactive Alerts Job: {e}")
        return "Error"
