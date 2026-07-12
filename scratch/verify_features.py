import requests
import json

BASE_URL = "http://127.0.0.1:8000"

def verify_all():
    print("=== STARTING VAJRA FULL BACKEND INTEGRATION TEST ===")
    
    # 1. Fake Login / Headers setup to bypass security firewall
    headers = {
        "Authorization": "Bearer fake-token-for-gowda",
        "Content-Type": "application/json",
        "X-Session-ID": "test-session-999"
    }

    # 2. Test Grounded Semantic Search
    print("\n[Test 1] Testing Grounded Semantic Search Chat Query...")
    payload = {
        "message": "Find details of Ramesh Peenya metal theft",
        "lang": "en"
    }
    r = requests.post(f"{BASE_URL}/api/chat", headers=headers, json=payload)
    print("Status Code:", r.status_code)
    try:
        res = r.json()
        print("Response Text Snippet:", res.get("text")[:200])
        print("Response Type:", res.get("response_type"))
        print("Citations Received:", len(res.get("citations", [])))
    except Exception as e:
        print("Failed to decode response:", e, r.text)

    # 3. Test Legal Consistency Check
    print("\n[Test 2] Testing Legal Section consistency checker for Case ID 1...")
    payload = {
        "message": "check consistency of case 1",
        "lang": "en"
    }
    r = requests.post(f"{BASE_URL}/api/chat", headers=headers, json=payload)
    print("Status Code:", r.status_code)
    try:
        res = r.json()
        print("Response Text:", res.get("text"))
        print("Is Consistent:", res.get("data", {}).get("is_consistent"))
        print("Suggested Section:", res.get("data", {}).get("suggested_section"))
        print("Precedents Found:", len(res.get("data", {}).get("precedents", [])))
    except Exception as e:
        print("Failed to decode response:", e, r.text)

    # 4. Test Audit Log Query
    print("\n[Test 3] Fetching Audit Logs from backend...")
    r = requests.get(f"{BASE_URL}/api/audit-logs", headers=headers)
    print("Status Code:", r.status_code)
    try:
        res = r.json()
        print("Total Logs Retreived:", len(res))
        if res:
            print("Latest Log Sample:", res[0])
    except Exception as e:
        print("Failed to decode response:", e, r.text)

    # 5. Test PDF Export
    print("\n[Test 4] Testing PDF Export generation...")
    pdf_payload = {
        "transcript": [
            {"sender": "user", "text": "Who is Ramesh?", "timestamp": "12:00 PM"},
            {"sender": "assistant", "text": "Ramesh is a metal thief associated with Peenya.", "timestamp": "12:01 PM"}
        ],
        "badge_id": "4003385"
    }
    r = requests.post(f"{BASE_URL}/api/chat/export-pdf", headers=headers, json=pdf_payload)
    print("Status Code:", r.status_code)
    print("Response Content Type:", r.headers.get("Content-Type"))
    print("PDF File Size:", len(r.content), "bytes")

    print("\n=== INTEGRATION TESTS COMPLETE ===")

if __name__ == "__main__":
    verify_all()
