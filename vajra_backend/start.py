# 1. Ensure vendored Linux dependencies are on sys.path and PYTHONPATH
vendor_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "vendor")
if os.path.exists(vendor_dir):
    if vendor_dir not in sys.path:
        sys.path.insert(0, vendor_dir)
    existing_pythonpath = os.environ.get("PYTHONPATH", "")
    if vendor_dir not in existing_pythonpath:
        os.environ["PYTHONPATH"] = vendor_dir + (os.pathsep + existing_pythonpath if existing_pythonpath else "")

# 2. Load runtime environment configuration
from dotenv import load_dotenv
import json as _json

_env_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env")
if os.path.exists(_env_path):
    load_dotenv(_env_path)

_cfg_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "catalyst_runtime_config.json")
if os.path.exists(_cfg_path):
    try:
        with open(_cfg_path, "r", encoding="utf-8") as _f:
            _cfg = _json.load(_f)
            for _k, _v in _cfg.items():
                if _k not in os.environ or not os.environ[_k]:
                    os.environ[_k] = str(_v)
    except Exception:
        pass

# 3. Import app and launch uvicorn
import uvicorn
from main import app

if __name__ == "__main__":
    port_str = os.getenv("X_ZOHO_CATALYST_LISTEN_PORT") or os.getenv("PORT") or "8000"
    port = int(port_str)
    print(f"[STARTUP] Launching VAJRA AppSail Server on 0.0.0.0:{port}", flush=True)
    uvicorn.run(app, host="0.0.0.0", port=port, proxy_headers=True, forwarded_allow_ips="*")
