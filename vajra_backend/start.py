import os
import sys
import json
import traceback
import logging

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("vajra_startup")

logger.info(f"[STARTUP] Initializing VAJRA 2.0 AppSail Bootloader (Python: {sys.version.split()[0]} on {sys.platform})...")

# 1. Base directory and vendor path
_base_dir = os.path.dirname(os.path.abspath(__file__))
if _base_dir not in sys.path:
    sys.path.insert(0, _base_dir)

# Vendored C-extensions (.so) are strictly for Linux x86_64
vendor_dir = os.path.join(_base_dir, "vendor")
if os.name != 'nt' and os.path.exists(vendor_dir):
    if vendor_dir not in sys.path:
        sys.path.insert(0, vendor_dir)
    existing_pythonpath = os.environ.get("PYTHONPATH", "")
    if vendor_dir not in existing_pythonpath:
        os.environ["PYTHONPATH"] = vendor_dir + (os.pathsep + existing_pythonpath if existing_pythonpath else "")
    logger.info(f"[STARTUP] Vendored Linux dependencies attached from {vendor_dir}")

# 2. Load runtime environment configuration
_env_path = os.path.join(_base_dir, ".env")
if os.path.exists(_env_path):
    try:
        from dotenv import load_dotenv
        load_dotenv(_env_path)
        logger.info("[STARTUP] Loaded environment variables from .env")
    except Exception as e:
        logger.warning(f"[STARTUP] Notice loading .env: {e}")

_cfg_path = os.path.join(_base_dir, "catalyst_runtime_config.json")
if os.path.exists(_cfg_path):
    try:
        with open(_cfg_path, "r", encoding="utf-8") as _f:
            _cfg = json.load(_f)
            for _k, _v in _cfg.items():
                if _k not in os.environ or not os.environ[_k]:
                    os.environ[_k] = str(_v)
        logger.info(f"[STARTUP] Loaded {len(_cfg)} runtime config entries from catalyst_runtime_config.json")
    except Exception as e:
        logger.warning(f"[STARTUP] Notice reading catalyst_runtime_config.json: {e}")

# 3. Determine listen port
port_str = os.getenv("X_ZOHO_CATALYST_LISTEN_PORT") or os.getenv("PORT") or "9000"
port = int(port_str)

# 4. Import main app with error containment
app = None
import_error_traceback = None

try:
    logger.info("[STARTUP] Importing main FastAPI application...")
    from main import app as _main_app
    app = _main_app
    logger.info("[STARTUP] VAJRA 2.0 FastAPI application imported successfully.")
except Exception as exc:
    import_error_traceback = traceback.format_exc()
    logger.error(f"[STARTUP CRITICAL] Failed to import main application:\n{import_error_traceback}")

    # Fallback zero-dependency pure ASGI app so container binds to the port
    async def fallback_asgi_app(scope, receive, send):
        if scope["type"] == "http":
            body = json.dumps({
                "status": "startup_import_failure",
                "service": "VAJRA 2.0 Backend (Diagnostic Fallback)",
                "error": import_error_traceback,
                "sys_info": {
                    "python": sys.version,
                    "platform": sys.platform,
                    "executable": sys.executable,
                    "env_port": os.getenv("X_ZOHO_CATALYST_LISTEN_PORT"),
                    "port": port
                }
            }, indent=2).encode("utf-8")
            
            await send({
                "type": "http.response.start",
                "status": 500,
                "headers": [
                    (b"content-type", b"application/json"),
                    (b"content-length", str(len(body)).encode("ascii")),
                    (b"access-control-allow-origin", b"*"),
                ],
            })
            await send({
                "type": "http.response.body",
                "body": body,
            })
    
    app = fallback_asgi_app

if __name__ == "__main__":
    logger.info(f"[STARTUP] Launching server on 0.0.0.0:{port}...")
    try:
        import uvicorn
        uvicorn.run(app, host="0.0.0.0", port=port, proxy_headers=True, forwarded_allow_ips="*")
    except Exception as uvicorn_err:
        logger.error(f"[STARTUP CRITICAL] Uvicorn launch failed: {uvicorn_err}, falling back to standard library HTTPServer")
        from http.server import HTTPServer, BaseHTTPRequestHandler
        
        class DiagnosticHandler(BaseHTTPRequestHandler):
            def do_GET(self):
                body = json.dumps({
                    "status": "uvicorn_failed",
                    "uvicorn_error": str(uvicorn_err),
                    "import_error": import_error_traceback,
                    "python": sys.version
                }, indent=2).encode("utf-8")
                self.send_response(500)
                self.send_header("Content-Type", "application/json")
                self.send_header("Content-Length", str(len(body)))
                self.send_header("Access-Control-Allow-Origin", "*")
                self.end_headers()
                self.wfile.write(body)

        httpd = HTTPServer(("0.0.0.0", port), DiagnosticHandler)
        logger.info(f"[STARTUP] Diagnostic HTTP server listening on 0.0.0.0:{port}")
        httpd.serve_forever()
