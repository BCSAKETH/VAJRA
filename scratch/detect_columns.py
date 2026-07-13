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

# Let's try various names for row_hash
candidates = ["row_hash", "RowHash", "rowhash", "rowHash", "ROW_HASH"]
for cand in candidates:
    query = f"SELECT {cand} FROM AuditLog LIMIT 1"
    res = requests.post(url, headers=headers, json={"query": query})
    print(f"Query {cand}: {res.status_code} - {res.text[:200]}")

# Let's try inserting with PascalCase column names
insert_query = """
INSERT INTO AuditLog (EmployeeID, ActionType, TargetEntity, QueryText, ResponseSummary, SessionID, LoggedAt, PrevHash, RowHash)
VALUES (1234, 'TEST', 'TEST', 'TEST', 'TEST', 'TEST', '2026-07-13T00:00:00', 'TEST_HASH', 'TEST_HASH')
"""
res = requests.post(url, headers=headers, json={"query": insert_query})
print(f"Insert with PascalCase: {res.status_code} - {res.text[:200]}")

# Let's try camelCase
insert_query_camel = """
INSERT INTO AuditLog (employeeId, actionType, targetEntity, queryText, responseSummary, sessionId, loggedAt, prevHash, rowHash)
VALUES (1234, 'TEST', 'TEST', 'TEST', 'TEST', 'TEST', '2026-07-13T00:00:00', 'TEST_HASH', 'TEST_HASH')
"""
res = requests.post(url, headers=headers, json={"query": insert_query_camel})
print(f"Insert with camelCase: {res.status_code} - {res.text[:200]}")
