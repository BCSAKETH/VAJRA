import os
import sys
sys.path.append("vajra_backend")
from dotenv import load_dotenv

load_dotenv(dotenv_path=os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env"))
from vajra_core import catalyst_app

print("=== TESTING ForecastResults FULL INSERT ===")
row = {
    "District": "Peenya",
    "CrimeType": "THEFT",
    "ForecastPeriod": "August 2026",
    "PredictedCount": 12.5,
    "HistoricalAvg": 10.0,
    "ConfidenceScore": 0.85,
    "GeneratedAt": "2026-07-13T00:00:00"
}

try:
    res = catalyst_app.datastore().table("ForecastResults").insert_row(row)
    print("Full Insert: Success!", res)
except Exception as e:
    print("Full Insert failed:", e)
