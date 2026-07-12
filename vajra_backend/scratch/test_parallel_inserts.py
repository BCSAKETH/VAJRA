import os
import requests
import json
import time
from concurrent.futures import ThreadPoolExecutor
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

def check_one():
    # Insert a test state or check
    q = "SELECT * FROM State LIMIT 1"
    res = requests.post(url, headers=headers, json={"query": q})
    return res.status_code, res.text

# Let's test 10 parallel requests
print("Testing 10 parallel ZCQL queries...")
t0 = time.time()
with ThreadPoolExecutor(max_workers=10) as executor:
    results = list(executor.map(lambda _: check_one(), range(10)))
t1 = time.time()

for r in results:
    print(r)
print(f"Completed in {t1 - t0:.2f} seconds")
