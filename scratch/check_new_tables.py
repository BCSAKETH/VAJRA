# Diagnostic script to check if the 4 new Catalyst tables exist
import os
import requests
from dotenv import load_dotenv

load_dotenv(dotenv_path=os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env"))

CLIENT_ID = os.getenv("CATALYST_CLIENT_ID")
CLIENT_SECRET = os.getenv("CATALYST_CLIENT_SECRET")
REFRESH_TOKEN = os.getenv("CATALYST_REFRESH_TOKEN")
PROJECT_ID = os.getenv("CATALYST_PROJECT_ID")

# Refresh OAuth Token
r = requests.post("https://accounts.zoho.in/oauth/v2/token", data={
    "client_id": CLIENT_ID,
    "client_secret": CLIENT_SECRET,
    "refresh_token": REFRESH_TOKEN,
    "grant_type": "refresh_token"
})
token = r.json().get("access_token")
if not token:
    print("OAuth token exchange failed!")
    exit(1)

ZCQL_URL = f"https://api.catalyst.zoho.in/baas/v1/project/{PROJECT_ID}/query"
headers = {
    "Authorization": f"Zoho-oauthtoken {token}",
    "Content-Type": "application/json",
    "X-Catalyst-Environment": "Development",
    "environment": "Development"
}

new_tables = ["AuditLog", "FinancialTransaction", "ForecastResults", "ConsistencyFlags"]

print("Verifying if the 4 new tables exist in Catalyst:")
for table in new_tables:
    query = f"SELECT * FROM {table} LIMIT 1"
    res = requests.post(ZCQL_URL, headers=headers, json={"query": query})
    if res.status_code == 200:
        print(f"  [OK] Table '{table}' exists and is ready.")
    else:
        print(f"  [ERROR] Table '{table}' check failed: {res.status_code} - {res.text[:200]}")
