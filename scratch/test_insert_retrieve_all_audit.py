import os
import sys
sys.path.append("vajra_backend")
from dotenv import load_dotenv

load_dotenv(dotenv_path=os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env"))
from vajra_core import catalyst_app

print("=== TESTING AuditLog FULL INSERT AND RETRIEVE ===")
row = {
    "employee_id": 1,
    "action_type": "TEST_ACTION",
    "target_entity": "TEST_TARGET",
    "query_text": "TEST_QUERY",
    "response_summary": "TEST_RESPONSE",
    "session_id": "TEST_SESSION",
    "logged_at": "2026-07-13T22:30:00",
    "prev_hash": "TEST_PREV_HASH",
    "row_hash": "TEST_ROW_HASH"
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
