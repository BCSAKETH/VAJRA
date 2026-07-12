import os
import requests
import json
from dotenv import load_dotenv

load_dotenv(dotenv_path=os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env"))

CLIENT_ID = os.getenv("CATALYST_CLIENT_ID")
CLIENT_SECRET = os.getenv("CATALYST_CLIENT_SECRET")
REFRESH_TOKEN = os.getenv("CATALYST_REFRESH_TOKEN")
PROJECT_ID = os.getenv("CATALYST_PROJECT_ID")

r = requests.post("https://accounts.zoho.in/oauth/v2/token", data={
    "client_id": CLIENT_ID, "client_secret": CLIENT_SECRET,
    "refresh_token": REFRESH_TOKEN, "grant_type": "refresh_token"
})
token = r.json()["access_token"]

url = f"https://api.catalyst.zoho.in/baas/v1/project/{PROJECT_ID}/query"

headers = {
    "Authorization": f"Zoho-oauthtoken {token}",
    "Content-Type": "application/json",
    "X-Catalyst-Environment": "Development",
    "environment": "Development"
}

tables = [
    "State", "District", "UnitType", "Unit", "Rank", "Designation",
    "CaseCategory", "GravityOffence", "CaseStatusMaster", "CasteMaster",
    "ReligionMaster", "OccupationMaster", "Court", "Act", "Section",
    "CrimeHead", "CrimeSubHead", "CrimeHeadActSection", "Employee", "CaseMaster",
    "ComplainantDetails", "Victim", "Accused", "ArrestSurrender", "ChargesheetDetails",
    "ActSectionAssociation", "inv_arrestsurrenderaccused", "Inv_OccuranceTime",
    "AccidentReports", "CrimeData",
    "AuditLog", "FinancialTransaction", "ForecastResults", "ConsistencyFlags"
]

print("Starting database cleanup...")
for table in tables:
    query = f"DELETE FROM {table}"
    res = requests.post(url, headers=headers, json={"query": query})
    if res.status_code == 200:
        print(f"  Successfully cleared table: {table}")
    else:
        print(f"  Failed to clear table {table}: {res.status_code} - {res.text[:200]}")
print("Cleanup complete!")
