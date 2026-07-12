import os
import requests
import json
from dotenv import load_dotenv

load_dotenv(dotenv_path="c:/Users/B.C SAKETH/Downloads/VAJRA-main/.env")

CLIENT_ID = os.getenv("CATALYST_CLIENT_ID")
CLIENT_SECRET = os.getenv("CATALYST_CLIENT_SECRET")
REFRESH_TOKEN = os.getenv("CATALYST_REFRESH_TOKEN")
PROJECT_ID = os.getenv("CATALYST_PROJECT_ID")

token_cache_path = os.path.join("c:/Users/B.C SAKETH/Downloads/VAJRA-main/vajra_backend", ".token_cache")
if os.path.exists(token_cache_path):
    with open(token_cache_path, "r") as f:
        token = f.read().strip()
else:
    token = ""

url = f"https://api.catalyst.zoho.in/baas/v1/project/{PROJECT_ID}/query"
headers = {
    "Authorization": f"Zoho-oauthtoken {token}",
    "Content-Type": "application/json",
    "X-Catalyst-Environment": "Development",
    "environment": "Development"
}

q = "SELECT Main_Cause, Severity, Weather, Hit_Run FROM AccidentReports LIMIT 1"
print(f"Executing: {q}")
res = requests.post(url, headers=headers, json={"query": q})
print(f"Status: {res.status_code}")
print(f"Response: {res.text}")
