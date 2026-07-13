import os
import sys
sys.path.append("vajra_backend")
from dotenv import load_dotenv

load_dotenv(dotenv_path=os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env"))
from vajra_core import catalyst_app

print("=== CHECKING CaseMaster COORDINATE COUNTS ===")
try:
    res = catalyst_app.zql().execute_query("SELECT COUNT(CaseMasterID) FROM CaseMaster WHERE latitude IS NOT NULL")
    print("ZCQL latitude NOT NULL count:", res)
except Exception as e:
    print("ZCQL failed:", e)

try:
    res = catalyst_app.zql().execute_query("SELECT COUNT(CaseMasterID) FROM CaseMaster")
    print("ZCQL total count:", res)
except Exception as e:
    print("ZCQL failed:", e)
