import os
import sys
sys.path.append("vajra_backend")
from dotenv import load_dotenv

load_dotenv(dotenv_path=os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env"))
from vajra_core import catalyst_app

print("=== TESTING AuditLog HASH COLUMN SPELLINGS ===")
test_cols = ["PrevHash", "prev_hash", "RowHash", "row_hash", "Prevhash", "Rowhash", "prevhash", "rowhash", "prev_hash_code", "row_hash_code"]

for col in test_cols:
    try:
        res = catalyst_app.datastore().table("AuditLog").insert_row({col: "TEST_HASH"})
        print(f"Insert {col}: Success!")
    except Exception as e:
        print(f"Insert {col} failed: {e}")
