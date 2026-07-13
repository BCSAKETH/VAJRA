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
url = f"https://api.catalyst.zoho.in/baas/v1/project/{PROJECT_ID}/query"
headers = {
    "Authorization": f"Zoho-oauthtoken {token}",
    "Content-Type": "application/json",
    "X-Catalyst-Environment": "Development",
    "environment": "Development"
}

# Check ConsistencyFlags columns
print("\n=== CHECKING ConsistencyFlags ===")
for col in ["case_id", "CaseID", "recorded_section", "RecordedSection", "suggested_section", "SuggestedSection", "confidence_score", "ConfidenceScore", "reviewed", "Reviewed", "flagged_at", "FlaggedAt"]:
    query = f"SELECT {col} FROM ConsistencyFlags LIMIT 1"
    res = requests.post(url, headers=headers, json={"query": query})
    print(f"ConsistencyFlags {col}: {res.status_code} - {res.text[:200]}")

# Check FinancialTransaction columns
print("\n=== CHECKING FinancialTransaction ===")
for col in ["sender_ref", "SenderRef", "receiver_ref", "ReceiverRef", "amount", "Amount", "txn_time", "TxnTime", "linked_case_id", "LinkedCaseID", "account_or_wallet_id", "AccountOrWalletID"]:
    query = f"SELECT {col} FROM FinancialTransaction LIMIT 1"
    res = requests.post(url, headers=headers, json={"query": query})
    print(f"FinancialTransaction {col}: {res.status_code} - {res.text[:200]}")

# Check ForecastResults columns
print("\n=== CHECKING ForecastResults ===")
for col in ["district", "District", "crime_type", "CrimeType", "forecast_period", "ForecastPeriod", "predicted_count", "PredictedCount", "historical_avg", "HistoricalAvg", "confidence_score", "ConfidenceScore", "generated_at", "GeneratedAt"]:
    query = f"SELECT {col} FROM ForecastResults LIMIT 1"
    res = requests.post(url, headers=headers, json={"query": query})
    print(f"ForecastResults {col}: {res.status_code} - {res.text[:200]}")
