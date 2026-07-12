import os
from dotenv import load_dotenv
load_dotenv(dotenv_path=os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env"))

import sys
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../vajra_backend")))
from vajra_core import catalyst_app

if catalyst_app:
    print("Catalyst App initialized successfully.")
    try:
        # Check Zia service
        zia = catalyst_app.zia()
        print("Zia Service methods:", [m for m in dir(zia) if not m.startswith("_")])
    except Exception as e:
        print("Failed to get Zia service:", e)
        
    try:
        # Check QuickML service
        qml = catalyst_app.quick_ml()
        print("QuickML Service methods:", [m for m in dir(qml) if not m.startswith("_")])
    except Exception as e:
        print("Failed to get QuickML service:", e)
else:
    print("Catalyst App initialization failed.")
