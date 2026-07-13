import os
import sys
sys.path.append("vajra_backend")
from dotenv import load_dotenv

load_dotenv(dotenv_path=os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env"))
from vajra_core import catalyst_app

print("=== INSPECTING CaseMaster COLUMNS ===")
try:
    table = catalyst_app.datastore().table("CaseMaster")
    cols = table.get_all_columns()
    for col in cols:
        name = col.get_column_name()
        if "lat" in name.lower() or "long" in name.lower() or "coord" in name.lower():
            print(f"Col: {name} | Datatype: {col.get_data_type()}")
except Exception as e:
    print("Error:", e)
