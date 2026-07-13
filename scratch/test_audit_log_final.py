import os
import sys
sys.path.append("vajra_backend")
from dotenv import load_dotenv

load_dotenv(dotenv_path=os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env"))
from vajra_core import catalyst_app

print("=== TESTING AuditLog FINAL INSERT AND RETRIEVE ===")
row = {
    "employee_id": 4003385,
    "action_type": "TEST_FINAL_ACTION",
    "target_entity": "TEST_FINAL_TARGET",
    "query_text": "TEST_FINAL_QUERY",
    "response_summary": "TEST_FINAL_RESPONSE",
    "session_id": "TEST_FINAL_SESSION",
    "logged_at": "2026-07-13T22:30:00",
    "prevhash": "TEST_FINAL_PREV_HASH",
    "rowhash": "TEST_FINAL_ROW_HASH"
}

try:
    res = catalyst_app.datastore().table("AuditLog").insert_row(row)
    print("Full Insert success! Return dict:")
    print(res)
except Exception as e:
    print("Full Insert failed:", e)

try:
    # Query all columns in ZCQL
    z_res = catalyst_app.zql().execute_query("SELECT * FROM AuditLog")
    print("ZCQL SELECT * success! Result:")
    for r in z_res:
        print(r)
except Exception as e:
    print("ZCQL SELECT * failed:", e)
