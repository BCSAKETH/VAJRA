import os
import sys
sys.path.append("vajra_backend")
from dotenv import load_dotenv

load_dotenv(dotenv_path=os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env"))
from vajra_core import catalyst_app

print("=== TESTING ForecastResults INSERTROW ===")
row = {
    "District": "Peenya",
    "CrimeType": "THEFT",
    "ForecastPeriod": "August 2026",
    "PredictedCount": 12.5,
    "HistoricalAvg": 10.0,
    "ConfidenceScore": 0.85,
    "GeneratedAt": "2026-07-13T00:00:00"
}

# Let's try inserting one by one to see which column fails!
for col in row.keys():
    single_row = {col: row[col]}
    # Wait, some columns are mandatory, so single column insert might fail with mandatory column error.
    # But it would be a DIFFERENT error than "Invalid input value for column name"!
    try:
        res = catalyst_app.datastore().table("ForecastResults").insert_row(single_row)
        print(f"Insert single {col}: Success!")
    except Exception as e:
        print(f"Insert single {col} failed: {e}")

# Let's also print the entire table schema columns via SDK
try:
    table = catalyst_app.datastore().table("ForecastResults")
    # Let's see if we can get table details via SDK
    print("Table object details:", dir(table))
except Exception as e:
    print("Could not inspect table object:", e)
