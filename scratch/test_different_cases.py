import os
import sys
sys.path.append("vajra_backend")
from dotenv import load_dotenv

load_dotenv(dotenv_path=os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env"))
from vajra_core import catalyst_app

print("=== TESTING DIFFERENT COLUMN CASES FOR ForecastResults ===")

test_cases = [
    # PascalCase (from metadata)
    {"District": "Peenya"},
    # Lowercase
    {"district": "Peenya"},
    # camelCase
    {"districtId": 1},
    # All lowercase no underscores
    {"predictedcount": 12.5},
    # camelCase
    {"predictedCount": 12.5},
    # Snake_case
    {"predicted_count": 12.5}
]

for tc in test_cases:
    col_name = list(tc.keys())[0]
    val = tc[col_name]
    try:
        res = catalyst_app.datastore().table("ForecastResults").insert_row(tc)
        print(f"Insert {col_name}: Success! Return: {res}")
    except Exception as e:
        print(f"Insert {col_name} failed: {e}")
