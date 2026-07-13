import os
import sys
sys.path.append("vajra_backend")
from dotenv import load_dotenv

load_dotenv(dotenv_path=os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env"))
from vajra_core import catalyst_app

print("=== INSPECTING AuditLog COLUMNS ===")
# Try to fetch columns using table details
try:
    table = catalyst_app.datastore().table("AuditLog")
    cols = table.get_all_columns()
    for col in cols:
        print(f"Col: {col.get_column_name()} | Datatype: {col.get_data_type()}")
except Exception as e:
    print("Error getting columns via SDK:", e)
