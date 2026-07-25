import os, requests, time, bcrypt
from dotenv import load_dotenv

backend_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
load_dotenv(os.path.join(backend_dir, ".env"))

import zcatalyst_sdk
from zcatalyst_sdk.credentials import RefreshTokenCredential

def get_token():
    tf = os.path.join(backend_dir, ".token_cache")
    if os.path.exists(tf) and time.time() - os.path.getmtime(tf) < 3000:
        t = open(tf).read().strip()
        if t: return t
    r = requests.post("https://accounts.zoho.in/oauth/v2/token", data={
        "client_id": os.getenv("CATALYST_CLIENT_ID"),
        "client_secret": os.getenv("CATALYST_CLIENT_SECRET"),
        "refresh_token": os.getenv("CATALYST_REFRESH_TOKEN"),
        "grant_type": "refresh_token"
    }, timeout=10)
    t = r.json()["access_token"]
    open(tf, "w").write(t)
    return t

def patched_token(self):
    t = get_token()
    self._cached_token = {"access_token": t, "expires_in": int(time.time()) + 3600000}
    return t

RefreshTokenCredential.token = patched_token
cred = RefreshTokenCredential({
    "client_id": os.getenv("CATALYST_CLIENT_ID"),
    "client_secret": os.getenv("CATALYST_CLIENT_SECRET"),
    "refresh_token": os.getenv("CATALYST_REFRESH_TOKEN")
})
app = zcatalyst_sdk.initialize_app(
    credential=cred,
    options={
        "project_id": os.getenv("CATALYST_PROJECT_ID"),
        "project_key": os.getenv("CATALYST_PROJECT_KEY"),
        "project_domain": "zoho.in"
    }
)

def qry(q):
    token = get_token()
    pid = os.getenv("CATALYST_PROJECT_ID")
    r = requests.post(
        f"https://api.catalyst.zoho.in/baas/v1/project/{pid}/query",
        headers={
            "Authorization": f"Zoho-oauthtoken {token}",
            "Content-Type": "application/json",
            "environment": "Development"
        },
        json={"query": q}
    )
    return r.json().get("data", [])

# Check current hashes and verify against HackaThon2026
rows = qry("SELECT KGID, PasswordHash FROM OfficerCredentials")
pw = b"HackaThon2026"
print("=== Current OfficerCredentials ===")
all_match = True
for r in rows:
    d = r.get("OfficerCredentials", {})
    h = d["PasswordHash"].encode()
    try:
        match = bcrypt.checkpw(pw, h)
    except Exception as e:
        match = f"ERROR: {e}"
    all_match = all_match and (match is True)
    print(f"  KGID: {d['KGID']} | HackaThon2026 matches: {match}")

if not all_match:
    print("\n=== Resetting all hashes to HackaThon2026 ===")
    new_hash = bcrypt.hashpw(pw, bcrypt.gensalt()).decode()
    print(f"  New hash: {new_hash}")
    for r in rows:
        d = r.get("OfficerCredentials", {})
        kgid = d["KGID"]
        qry(f"UPDATE OfficerCredentials SET PasswordHash = '{new_hash}' WHERE KGID = '{kgid}'")
        print(f"  Updated KGID {kgid}")
    print("Done!")
else:
    print("\nAll hashes already match HackaThon2026 correctly.")
