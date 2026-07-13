import os
import requests
from dotenv import load_dotenv

load_dotenv(dotenv_path=os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env"))
token = "fake"
token_path = os.path.join("vajra_backend", ".token_cache")
if os.path.exists(token_path):
    with open(token_path, "r") as f:
        token = f.read().strip()

headers = {
    "Authorization": f"Bearer {token}",
    "Content-Type": "application/json"
}

r = requests.get("http://127.0.0.1:8000/api/alerts/consistency-flags", headers=headers)
print("Status Code:", r.status_code)
print("Response JSON:")
print(r.json())
