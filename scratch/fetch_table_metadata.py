import os
import requests
import json
from dotenv import load_dotenv

load_dotenv(dotenv_path=os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env"))

CLIENT_ID = os.getenv("CATALYST_CLIENT_ID")
CLIENT_SECRET = os.getenv("CATALYST_CLIENT_SECRET")
REFRESH_TOKEN = os.getenv("CATALYST_REFRESH_TOKEN")
PROJECT_ID = os.getenv("CATALYST_PROJECT_ID")

# Get access token
r = requests.post("https://accounts.zoho.in/oauth/v2/token", data={
    "client_id": CLIENT_ID, "client_secret": CLIENT_SECRET,
    "refresh_token": REFRESH_TOKEN, "grant_type": "refresh_token"
})
token = r.json()["access_token"]
headers = {
    "Authorization": f"Zoho-oauthtoken {token}",
    "Content-Type": "application/json",
    "X-Catalyst-Environment": "Development",
    "environment": "Development"
}

target_tables = ["AuditLog", "ConsistencyFlags", "FinancialTransaction", "ForecastResults", "ProactiveAlerts"]

print("=== FETCHING TABLE METADATA FROM ZOHO CATALYST API ===")

# First get all tables to find table IDs (identifiers)
tables_url = f"https://api.catalyst.zoho.in/baas/v1/project/{PROJECT_ID}/table"
res = requests.get(tables_url, headers=headers)
if res.status_code != 200:
    print(f"Failed to fetch table list: {res.status_code} - {res.text}")
    exit(1)

tables_data = res.json().get("data", [])
table_map = {}
for t in tables_data:
    t_name = t.get("table_name")
    t_id = t.get("table_id")
    table_map[t_name] = t_id

for table_name in target_tables:
    print(f"\n--- Table: {table_name} ---")
    table_id = table_map.get(table_name)
    if not table_id:
        print(f"Table '{table_name}' does not exist in the Catalyst project!")
        continue
        
    detail_url = f"https://api.catalyst.zoho.in/baas/v1/project/{PROJECT_ID}/table/{table_id}"
    detail_res = requests.get(detail_url, headers=headers)
    if detail_res.status_code == 200:
        columns = detail_res.json().get("data", {}).get("columns", [])
        print(f"{'Column Name':<25} | {'Data Type':<15} | {'Is Mandatory':<12}")
        print("-" * 60)
        for col in columns:
            print(f"{col.get('column_name'):<25} | {col.get('data_type'):<15} | {str(col.get('is_mandatory')):<12}")
    else:
        print(f"Failed to fetch details for {table_name}: {detail_res.status_code} - {detail_res.text}")
