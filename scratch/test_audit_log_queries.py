import os
import sys
sys.path.append("vajra_backend")
from dotenv import load_dotenv

load_dotenv(dotenv_path=os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env"))
from vajra_core import catalyst_app

print("=== TESTING ZCQL QUERIES ON AuditLog ===")

queries = [
    "SELECT ROWID FROM AuditLog LIMIT 1",
    "SELECT RowHash FROM AuditLog LIMIT 1",
    "SELECT rowhash FROM AuditLog LIMIT 1",
    "SELECT Row_Hash FROM AuditLog LIMIT 1",
    "SELECT row_hash FROM AuditLog LIMIT 1",
    "SELECT RowHash FROM auditlog LIMIT 1",
    "SELECT ROWID FROM Audit_Log LIMIT 1",
    "SELECT ROWID FROM audit_log LIMIT 1"
]

for query in queries:
    try:
        res = catalyst_app.zql().execute_query(query)
        print(f"Query '{query}': Success! Result: {res}")
    except Exception as e:
        print(f"Query '{query}' failed: {e}")
