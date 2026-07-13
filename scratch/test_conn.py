import requests
try:
    r = requests.get("http://127.0.0.1:8000/health", timeout=3)
    print("Health status code:", r.status_code)
    print("Response json:", r.json())
except Exception as e:
    print("Connection failed:", e)
