import requests
import json

base_url = "http://127.0.0.1:8000"

def check_endpoint(path, name):
    try:
        # Send authorization header to bypass firewall
        headers = {"Authorization": "Bearer vajra-secure"}
        res = requests.get(f"{base_url}{path}", headers=headers)
        print(f"\n=== Endpoint: {name} ({path}) ===")
        print("Status code:", res.status_code)
        if res.status_code == 200:
            data = res.json()
            if isinstance(data, list):
                print(f"Returned list with {len(data)} items.")
                if len(data) > 0:
                    print("Sample item:", json.dumps(data[0], indent=2))
            else:
                print("Response JSON:")
                print(json.dumps(data, indent=2))
        else:
            print("Error response:", res.text)
    except Exception as e:
        print(f"Failed to fetch {name}: {e}")

# Check health first
check_endpoint("/health", "Health Check")

# Check get_firs
check_endpoint("/api/firs", "FIR Registry")

# Check get_analytics_summary
check_endpoint("/api/analytics/summary", "Analytics Summary")

# Check get_accused_list
check_endpoint("/api/accused", "Accused Profiles")
