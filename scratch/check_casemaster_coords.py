import os
import sys
sys.path.append("vajra_backend")
from dotenv import load_dotenv

load_dotenv(dotenv_path=os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env"))
from vajra_core import catalyst_app

print("=== CHECKING CaseMaster COORDINATES ===")
try:
    res = catalyst_app.zql().execute_query("SELECT * FROM CaseMaster LIMIT 5")
    print("ZCQL SELECT * success! Result:")
    for r in res:
        print(r)
except Exception as e:
    print("ZCQL SELECT failed:", e)
