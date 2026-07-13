import os
import sys
sys.path.append("vajra_backend")
from dotenv import load_dotenv

load_dotenv(dotenv_path=os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env"))
from vajra_core import catalyst_app

print("=== TESTING AuditLog LOWERCASE COLUMN BY COLUMN INSERT ===")
row = {
    "employee_id": "KSP-6",
    "action_type": "TEST",
    "target_entity": "TEST",
    "query_text": "TEST",
    "response_summary": "TEST",
    "session_id": "TEST",
    "logged_at": "2026-07-13T00:00:00",
    "prev_hash": "TEST",
    "row_hash": "TEST"
}

for col in row.keys():
    try:
        res = catalyst_app.datastore().table("AuditLog").insert_row({col: row[col]})
        print(f"Insert {col}: Success! Return: {res}")
    except Exception as e:
        print(f"Insert {col} failed: {e}")
