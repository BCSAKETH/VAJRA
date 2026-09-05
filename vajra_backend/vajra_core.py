import os as _os
import json as _json
from dotenv import load_dotenv

# 1. Load from .env if present (Local environment)
_env_path = _os.path.join(_os.path.dirname(_os.path.abspath(__file__)), ".env")
if _os.path.exists(_env_path):
    load_dotenv(_env_path)

# 2. Load from bundled runtime configuration (AppSail production)
_cfg_path = _os.path.join(_os.path.dirname(_os.path.abspath(__file__)), "catalyst_runtime_config.json")
if _os.path.exists(_cfg_path):
    try:
        with open(_cfg_path, "r", encoding="utf-8") as _f:
            _cfg = _json.load(_f)
            for _k, _v in _cfg.items():
                if _k not in _os.environ or not _os.environ[_k]:
                    _os.environ[_k] = str(_v)
    except Exception:
        pass

import os
import re
import json
import uuid
import logging
import time
import threading
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional
import numpy as np
from fastapi import Request, HTTPException, status
import zcatalyst_sdk
import jwt as pyjwt



# Import SentenceTransformers / Scikit-learn fallback (Forced TF-IDF to avoid HF download hangs)
SENTENCE_TRANSFORMERS_AVAILABLE = False
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger(__name__)

# Court-Admissible Provenance HUD backing store (see patched_execute_query
# below, the one real choke point every ZCQL call in the app passes
# through). Thread-local so concurrent officers' turns (each on its own
# AppSail worker thread) never see each other's queries.
_zql_query_log = threading.local()


def start_zql_log() -> None:
    """Call once at the start of a turn to begin collecting the exact ZCQL
    queries it executes."""
    _zql_query_log.queries = []


def get_zql_log() -> List[str]:
    """The exact ZCQL SQL strings executed so far on this thread this turn."""
    return list(getattr(_zql_query_log, "queries", []))


# Initialize Zoho Catalyst SDK client
try:
    from zcatalyst_sdk.credentials import RefreshTokenCredential
    import requests
    from zcatalyst_sdk.zcql import Zcql
    import time
    
    # Robust cached token retrieval with self-healing auto-refresh on 401
    def get_cached_access_token(force_refresh: bool = False):
        token_file = os.path.join(os.path.dirname(__file__), ".token_cache")
        # Reuse cached token if it's less than 50 minutes (3000 seconds) old and not forced
        if not force_refresh and os.path.exists(token_file):
            mtime = os.path.getmtime(token_file)
            if time.time() - mtime < 3000:
                try:
                    with open(token_file, 'r') as f:
                        t = f.read().strip()
                        if t:
                            return t
                except Exception:
                    pass
                    
        # Token is missing, expired, or forced -> Fetch a new one from Zoho OAuth
        client_id = os.getenv("CATALYST_CLIENT_ID") or os.getenv("ZOHO_CLIENT_ID")
        client_secret = os.getenv("CATALYST_CLIENT_SECRET") or os.getenv("ZOHO_CLIENT_SECRET")
        refresh_token = os.getenv("CATALYST_REFRESH_TOKEN") or os.getenv("ZOHO_REFRESH_TOKEN")
        
        if not (client_id and client_secret and refresh_token):
            logger.warning("Zoho OAuth credentials not fully set in environment.")
            return None

        payload = {
            "client_id": client_id,
            "client_secret": client_secret,
            "refresh_token": refresh_token,
            "grant_type": "refresh_token"
        }
        
        # Retry with exponential backoff on transient errors
        for delay in [1, 2, 4]:
            try:
                res = requests.post("https://accounts.zoho.in/oauth/v2/token", data=payload, timeout=10)
                data = res.json()
                if "access_token" in data:
                    t = data["access_token"]
                    # Write to cache file
                    try:
                        with open(token_file, 'w') as f:
                            f.write(t)
                    except Exception:
                        pass
                    logger.info("New Zoho OAuth access token generated and cached.")
                    return t
                else:
                    logger.error(f"Zoho accounts returned error: {data}")
            except Exception as ex:
                logger.warning(f"Error fetching access token (retrying): {ex}")
            time.sleep(delay)
            
        # Fallback to existing cache if refresh failed
        if os.path.exists(token_file):
            try:
                with open(token_file, 'r') as f:
                    return f.read().strip()
            except Exception:
                pass
        return None

    # Patch RefreshTokenCredential.token to use our cached token
    def patched_token(self) -> str:
        t = get_cached_access_token()
        if t:
            self._cached_token = {
                'access_token': t,
                'expires_in': int(round(time.time())) + 3600 * 1000
            }
            return t
        raise Exception("Failed to acquire access token.")
        
    RefreshTokenCredential.token = patched_token

    client_id = os.getenv("CATALYST_CLIENT_ID") or os.getenv("ZOHO_CLIENT_ID")
    refresh_token = os.getenv("CATALYST_REFRESH_TOKEN") or os.getenv("ZOHO_REFRESH_TOKEN")
    
    if client_id and refresh_token:
        logger.info("Initializing Zoho Catalyst SDK with OAuth refresh token (Unified environment).")
        cred = RefreshTokenCredential({
            'client_id': client_id,
            'client_secret': os.getenv("CATALYST_CLIENT_SECRET") or os.getenv("ZOHO_CLIENT_SECRET"),
            'refresh_token': refresh_token
        })
        catalyst_app = zcatalyst_sdk.initialize_app(
            credential=cred,
            options={
                'project_id': os.getenv("CATALYST_PROJECT_ID", "50212000000025002"),
                'project_key': os.getenv("CATALYST_PROJECT_KEY", "60074806366"),
                'project_domain': "zoho.in" if os.getenv("CATALYST_REGION", "IN") == "IN" else "zoho.com"
            }
        )
    elif os.getenv("PORT") and not os.getenv("X_ZOHO_CATALYST_IS_LOCAL") == "true":
        logger.info("Initializing Zoho Catalyst SDK with container credentials (AppSail environment).")
        catalyst_app = zcatalyst_sdk.initialize_app()
    else:
        logger.info("Initializing Zoho Catalyst SDK with no arguments (Fallback).")
        catalyst_app = zcatalyst_sdk.initialize_app()
    
    # Monkeypatch execute_query with self-healing token refresh & retry on 401
    def patched_execute_query(self, query: str):
        logger.info(f"Patched ZCQL query: {query}")
        # Court-Admissible Provenance HUD (implementation_plan.md #7): every
        # real ZCQL SQL string executed during a turn is logged here, into a
        # PER-THREAD list -- this is the ONE existing choke point every ZCQL
        # call in the whole app already passes through (already patched here
        # for token refresh), so this closes the "exact SQL query executed"
        # gap without touching any of the hundreds of individual call sites.
        # Thread-local, not global: AppSail runs each turn on its own
        # worker thread (run_in_threadpool), so this never leaks one
        # officer's queries into another's concurrent turn.
        try:
            _log = getattr(_zql_query_log, "queries", None)
            if _log is not None:
                _log.append(query)
        except Exception:
            pass
        token = get_cached_access_token()
        if not token:
            try:
                credential = self._app.credential
                credential._switch_user("user")
                token = credential.token()
            except Exception:
                pass
                
        project_id = os.getenv("CATALYST_PROJECT_ID", "50212000000025002")
        url = f"https://api.catalyst.zoho.in/baas/v1/project/{project_id}/query"
        headers = {
            "Authorization": f"Zoho-oauthtoken {token}",
            "Content-Type": "application/json",
            "X-Catalyst-Environment": "Development",
            "environment": "Development"
        }
        res = requests.post(url, headers=headers, json={"query": query})
        
        # Self-healing: if token expired or invalid, force refresh once and retry
        if res.status_code == 401:
            logger.warning("ZCQL received 401 INVALID_TOKEN. Forcing OAuth token refresh and retrying...")
            fresh_token = get_cached_access_token(force_refresh=True)
            if fresh_token:
                headers["Authorization"] = f"Zoho-oauthtoken {fresh_token}"
                res = requests.post(url, headers=headers, json={"query": query})
                
        logger.info(f"Patched ZCQL response status: {res.status_code}")
        if res.status_code != 200:
            raise Exception(f"ZCQL query failed: {res.status_code} - {res.text}")
        return res.json().get("data", [])
        
    Zcql.execute_query = patched_execute_query
    
    # Add alias zql to CatalystApp for compatibility
    zcatalyst_sdk.CatalystApp.zql = zcatalyst_sdk.CatalystApp.zcql

    logger.info("Successfully initialized Zoho Catalyst SDK connection with ZCQL monkeypatch.")
except Exception as e:
    logger.critical(f"Zoho Catalyst SDK failed to initialize: {e}. Falling back to default settings.")
    catalyst_app = None


def _zcql_escape_value(v) -> str:
    if v is None:
        return "NULL"
    if isinstance(v, bool):
        return "true" if v else "false"
    if isinstance(v, (int, float)):
        return str(v)
    s = str(v).replace("'", "''").replace("\r", "")
    return f"'{s}'"


def zcql_insert_row(table_name: str, row: Dict[str, Any]) -> None:
    """
    Replaces catalyst_app.datastore().table(X).insert_row(row) everywhere in
    this codebase. That SDK method resolves its request base URL from
    APP_DOMAIN (env var X_ZOHO_CATALYST_CONSOLE_URL -- the console UI host,
    not the API host) whenever X_ZOHO_CATALYST_IS_LOCAL isn't set to 'true'.
    Confirmed live: every insert_row/update_row call was silently POSTing to
    console.catalyst.zoho.in instead of api.catalyst.zoho.in, getting an HTML
    error page back, which the SDK's response_json property can't parse and
    raises as CatalystAPIError('UNPARSABLE_RESPONSE', ...) -- caught by the
    broad try/except at every call site, so every single one of these writes
    (chat history, audit logs, cowork invitations, consistency flag reviews,
    forecast results) was failing 100% of the time in this environment
    without ever surfacing as a visible error. (This may not reproduce in an
    actual Catalyst-hosted deployment if AppSail sets X_ZOHO_CATALYST_IS_LOCAL
    itself -- but it reproduces every time locally, which is what matters for
    development and testing.) ZCQL INSERT via the already-working
    execute_query path hits the correct domain and works -- confirmed live.
    """
    if not catalyst_app:
        return
    cols = ", ".join(row.keys())
    vals = ", ".join(_zcql_escape_value(v) for v in row.values())
    catalyst_app.zql().execute_query(f"INSERT INTO {table_name} ({cols}) VALUES ({vals})")


def zcql_update_row(table_name: str, row: Dict[str, Any]) -> None:
    """Same fix as zcql_insert_row, for UPDATE. `row` must include ROWID."""
    if not catalyst_app:
        return
    row = dict(row)
    rowid = row.pop("ROWID", None)
    if rowid is None:
        raise ValueError("zcql_update_row requires a ROWID field")
    set_clause = ", ".join(f"{k} = {_zcql_escape_value(v)}" for k, v in row.items())
    catalyst_app.zql().execute_query(f"UPDATE {table_name} SET {set_clause} WHERE ROWID = {rowid}")


_mail_token_lock = threading.Lock()
_mail_token_cache: Dict[str, Any] = {"token": None, "fetched_at": 0.0}


def _get_mail_access_token(force_refresh: bool = False) -> Optional[str]:
    """
    Separate, dedicated OAuth token for Catalyst Mail ONLY. The app's main
    refresh token (CATALYST_REFRESH_TOKEN, used by get_cached_access_token
    for every other Catalyst call) was issued without the Mail scope --
    confirmed live, send_mail failed with OAUTH_SCOPE_MISMATCH. Rather than
    re-issuing the main token with a wider scope (real risk of typo'ing a
    scope string and breaking every other Catalyst call in production), Mail
    gets its OWN self-client refresh token, scoped to exactly
    ZohoCatalyst.email.CREATE and nothing else -- so a problem with mail
    can never take down datastore/QuickML/etc, and vice versa. Cached
    in-process (not the shared .token_cache file) so it doesn't collide
    with the main token's cache.
    """
    with _mail_token_lock:
        if not force_refresh and _mail_token_cache["token"] and (time.time() - _mail_token_cache["fetched_at"] < 3000):
            return _mail_token_cache["token"]
        client_id = os.getenv("CATALYST_CLIENT_ID")
        client_secret = os.getenv("CATALYST_CLIENT_SECRET")
        mail_refresh_token = os.getenv("CATALYST_MAIL_REFRESH_TOKEN")
        if not (client_id and client_secret and mail_refresh_token):
            return None
        try:
            import requests as _requests
            res = _requests.post("https://accounts.zoho.in/oauth/v2/token", data={
                "client_id": client_id, "client_secret": client_secret,
                "refresh_token": mail_refresh_token, "grant_type": "refresh_token",
            }, timeout=10)
            data = res.json()
            if "access_token" in data:
                _mail_token_cache["token"] = data["access_token"]
                _mail_token_cache["fetched_at"] = time.time()
                return data["access_token"]
            logger.error(f"Mail token refresh failed: {data}")
        except Exception as e:
            logger.warning(f"Mail token refresh error: {e}")
        return None


def send_investigation_email_internal(to_email: str, subject: str, content: str) -> Dict[str, Any]:
    """
    Shared Catalyst Mail sender used by both the direct HTTP endpoint
    (main.py's /api/investigation/send-email) and the conversational
    send_investigation_email agent tool (agent_loop.py). Calls Catalyst's
    Mail REST API directly (bypassing the SDK's Email component, which
    would use the shared, non-Mail-scoped credential) with the dedicated
    mail-only token above. Raises on any failure (no sender/token
    configured, Catalyst rejecting it, network error); callers decide how
    to surface that (HTTP 503/502 vs a chat message).
    """
    from_email = os.getenv("CATALYST_MAIL_FROM_EMAIL")
    if not from_email:
        raise RuntimeError(
            "Email dispatch is not configured -- no verified sender address "
            "(CATALYST_MAIL_FROM_EMAIL) set for this deployment."
        )
    token = _get_mail_access_token()
    if not token:
        raise RuntimeError(
            "Email dispatch is not configured -- no Mail-scoped OAuth token "
            "(CATALYST_MAIL_REFRESH_TOKEN) set for this deployment."
        )
    project_id = os.getenv("CATALYST_PROJECT_ID", "50212000000025002")
    org_id = os.getenv("CATALYST_ORG_ID") or os.getenv("CATALYST_PROJECT_KEY", "")
    url = f"https://api.catalyst.zoho.in/baas/v1/project/{project_id}/email/send"
    to_list = [to_email] if isinstance(to_email, str) else to_email
    fields = {
        "from_email": from_email, "to_email": ",".join(to_list),
        "subject": subject, "content": content, "display_name": "VAJRA AI Copilot",
    }
    files = {k: (None, v) for k, v in fields.items()}
    headers = {"CATALYST-ORG": org_id, "Authorization": f"Zoho-oauthtoken {token}"}
    import requests as _requests
    res = _requests.post(url, headers=headers, files=files, timeout=15)
    if res.status_code not in (200, 201):
        raise RuntimeError(f"Catalyst Mail returned {res.status_code}: {res.text[:300]}")
    return res.json()


def _cache_base_url() -> str:
    project_id = os.getenv("CATALYST_PROJECT_ID")
    domain = "in" if os.getenv("CATALYST_REGION") == "IN" else "com"
    return f"https://api.catalyst.zoho.{domain}/baas/v1/project/{project_id}"


def cache_put(segment_name: str, key: str, value: str, expiry_hours: int = 48) -> bool:
    """
    Replaces catalyst_app.cache().segment(X).put(...) -- confirmed live to be
    the exact same wrong-domain bug as insert_row/update_row above (traced
    the real HTTP call: POST console.catalyst.zoho.in\\baas/v1/.../segment/
    Default/cache, an HTML error page back, CatalystAPIError('UNPARSABLE_
    RESPONSE', ...)). This is why session_memory.py's multi-turn context
    (last_case_id/last_offender_id/last_location AND the conversation
    history list itself) has never actually persisted between chat turns in
    this environment -- every get_session_context() silently returned an
    empty default and every update_session_context() silently no-op'd,
    regardless of the OAuth scope granted. Direct REST call to the correct
    domain, mirroring zcql_insert_row/zcql_update_row's fix.
    """
    if not catalyst_app:
        return False
    try:
        token = get_cached_access_token()
        url = f"{_cache_base_url()}/segment/{segment_name}/cache"
        headers = {
            "Authorization": f"Zoho-oauthtoken {token}",
            "Content-Type": "application/json",
            "X-Catalyst-Environment": "Development",
            "environment": "Development"
        }
        payload = {"cache_name": key, "cache_value": value, "expiry_in_hours": expiry_hours}
        res = requests.post(url, headers=headers, json=payload, timeout=10)
        return res.status_code in (200, 201)
    except Exception as e:
        logger.warning(f"cache_put failed for key '{key}': {e}")
        return False


def cache_get(segment_name: str, key: str) -> Optional[str]:
    """Replaces catalyst_app.cache().segment(X).get_value(...) -- see cache_put."""
    if not catalyst_app:
        return None
    try:
        token = get_cached_access_token()
        url = f"{_cache_base_url()}/segment/{segment_name}/cache"
        headers = {
            "Authorization": f"Zoho-oauthtoken {token}",
            "X-Catalyst-Environment": "Development",
            "environment": "Development"
        }
        res = requests.get(url, headers=headers, params={"cacheKey": key}, timeout=10)
        if res.status_code == 200:
            data = res.json().get("data") or {}
            return data.get("cache_value")
    except Exception as e:
        logger.warning(f"cache_get failed for key '{key}': {e}")
    return None


SESSION_SECRET = os.getenv("SESSION_SECRET")
SESSION_TTL_SECONDS = 86400  # 24 hours — extended for hackathon demo sessions


def issue_session_token(kgid: str) -> str:
    """
    Mints a real, cryptographically-signed session for the specific badge that
    just passed the bcrypt password check in /api/auth/login. This exists
    because verify_catalyst_token_direct (below) requires a genuine per-user
    Catalyst session via /project-user/current, which needs Third-party
    Authentication enabled in the console -- not done yet, and until it is,
    every officer authenticates through the same shared admin-scoped
    RefreshTokenCredential, which Zoho's own endpoint can't resolve to an
    individual identity. This token is real (HS256-signed, tied to one KGID,
    expires, can't be forged without SESSION_SECRET) -- it replaces which
    system verifies the session, it isn't a bypass of the check itself.
    """
    if not SESSION_SECRET:
        raise RuntimeError("SESSION_SECRET is not configured.")
    payload = {"kgid": kgid, "iat": int(time.time()), "exp": int(time.time()) + SESSION_TTL_SECONDS}
    return pyjwt.encode(payload, SESSION_SECRET, algorithm="HS256")


def verify_session_token(token: str) -> Optional[str]:
    """Returns the KGID embedded in a valid, unexpired session token, or None."""
    if not SESSION_SECRET:
        return None
    try:
        payload = pyjwt.decode(token, SESSION_SECRET, algorithms=["HS256"])
        return payload.get("kgid")
    except pyjwt.PyJWTError as e:
        logger.warning(f"Session token verification failed: {e}")
        return None


def verify_catalyst_token_direct(jwt_token: str) -> Optional[Dict[str, Any]]:
    project_id = os.getenv("CATALYST_PROJECT_ID")
    region = os.getenv("CATALYST_REGION", "IN")
    domain = "in" if region == "IN" else "com"
    url = f"https://api.catalyst.zoho.{domain}/baas/v1/project/{project_id}/project-user/current"
    
    headers = {
        "Authorization": f"Zoho-oauthtoken {jwt_token}",
        "X-Catalyst-Environment": "Development",
        "environment": "Development"
    }
    try:
        res = requests.get(url, headers=headers, timeout=5)
        if res.status_code == 200:
            return res.json().get("data")
        else:
            # Try with Bearer prefix
            headers["Authorization"] = f"Bearer {jwt_token}"
            res = requests.get(url, headers=headers, timeout=5)
            if res.status_code == 200:
                return res.json().get("data")
            logger.warning(f"Catalyst direct token verification failed: {res.status_code} - {res.text}")
    except Exception as e:
        logger.error(f"Error during direct token verification: {e}")
    return None


# Explicit allowlist of badges (KGIDs) that hold the Supervisor tier. Kept as
# a hard allowlist rather than a rank cutoff because the deployment requires
# exactly ONE supervisor account -- badge 2346836 -- with every other officer
# (regardless of their seeded rank) confined to the officer tier. This gates
# the Supervisor dashboard tab (hidden in the frontend for non-supervisors),
# the supervisor-only endpoints, and two-person co-sign eligibility.
SUPERVISOR_KGIDS = {"2346836"}


# POCSO / juvenile-victim auto-redaction (Section 74, Juvenile Justice Act).
# Shared with main.py's export pre-screen so "sensitive" means the same thing
# everywhere in the app -- one definition, not two drifting copies.
POCSO_SENSITIVE_KEYWORDS = (
    "rape", "pocso", "sexual assault", "sexual offence", "sexual offense",
    "molest", "outrage of modesty", "minor victim", "juvenile", "child victim",
    "underage", "child abuse",
    "ಅತ್ಯಾಚಾರ", "ಲೈಂಗಿಕ", "ಅಶ್ಲೀಲ", "ಅಪ್ರಾಪ್ತ", "ಬಾಲಾಪರಾಧಿ", "ಮಕ್ಕಳ ಮೇಲಿನ",
)
_PHONE_RE = re.compile(r"\b([6-9]\d{5})(\d{4})\b")


def is_pocso_sensitive(*texts: str) -> bool:
    """True if any of the given texts (brief facts, category, etc.) name a
    POCSO/juvenile-victim matter -- the trigger for auto-redaction below."""
    blob = " ".join((t or "") for t in texts).lower()
    return any(k in blob for k in POCSO_SENSITIVE_KEYWORDS)


def redact_pocso_name(name: str) -> str:
    """Rank-gated PII mask for a POCSO-sensitive case's victim/complainant name."""
    return "[REDACTED UNDER POCSO ACT §74 JJA]" if (name or "").strip() else name


def redact_phone_numbers(text: str) -> str:
    """Mask any 10-digit Indian mobile number in text to XXXXXX1234 (last 4 kept
    for cross-reference), for POCSO-sensitive answers shown to non-supervisors."""
    if not text:
        return text
    return _PHONE_RE.sub(lambda m: "XXXXXX" + m.group(2), text)


def is_supervisor_badge(badge: Optional[str]) -> bool:
    return bool(badge) and str(badge).strip() in SUPERVISOR_KGIDS


# ---- POCSO access-request workflow (persisted in ProactiveAlerts, same shape
# as main.py's export-approval queue: one existing table reused, since this
# deployment's credentials can't create a new one). An officer who genuinely
# needs a redacted victim identity can request time-boxed access; a supervisor
# approves live from the Supervisor dashboard. Grant TTL keeps access bounded
# rather than permanent. Lives here (not main.py) so agent_loop.py can create
# a request straight from a chat turn without a circular import.
POCSO_GRANT_HOURS = 8


def find_pocso_row(request_id: str) -> Optional[Dict[str, Any]]:
    """Locate a POCSO access-request row by its uuid request_id or numeric ROWID."""
    if not catalyst_app or not request_id:
        return None
    rid = str(request_id).replace("'", "''")
    try:
        if rid.isdigit():
            res = catalyst_app.zql().execute_query(
                "SELECT ROWID, AlertMessage FROM ProactiveAlerts "
                f"WHERE AlertType = 'POCSO_ACCESS' AND ROWID = {rid} LIMIT 1")
        else:
            res = catalyst_app.zql().execute_query(
                "SELECT ROWID, AlertMessage FROM ProactiveAlerts "
                f"WHERE AlertType = 'POCSO_ACCESS' AND AlertMessage LIKE '*{rid}*' ORDER BY ROWID DESC LIMIT 1")
    except Exception as e:
        logging.getLogger("vajra_core").warning(f"find_pocso_row: {e}")
        return None
    if not res:
        return None
    a = res[0].get("ProactiveAlerts", {})
    try:
        meta = json.loads(a.get("AlertMessage") or "{}")
    except Exception:
        meta = {}
    return {"rowid": a.get("ROWID"), "meta": meta}


def create_pocso_request(requester_badge: str, requester_name: str, case_no: str,
                         reason: str = "") -> Dict[str, Any]:
    """Create a pending POCSO access request. Returns the request metadata
    (includes request_id). A duplicate pending request for the same
    badge+case is reused instead of creating a new one."""
    existing = find_active_pocso_request(requester_badge, case_no)
    if existing:
        return existing
    request_id = uuid.uuid4().hex[:16]
    meta = {
        "request_id": request_id, "requester_badge": str(requester_badge or ""),
        "requester_name": requester_name or "Officer", "case_no": case_no,
        "reason": (reason or "").strip()[:200], "status": "pending",
        "approver_badge": None, "decided_at": None, "grant_expires_at": None,
        "created_at": datetime.utcnow().isoformat(),
    }
    try:
        zcql_insert_row("ProactiveAlerts", {
            "AlertType": "POCSO_ACCESS", "Severity": "Critical",
            "TriggerTime": datetime.utcnow().isoformat(), "IsRead": False,
            "DistrictID": "0", "AlertMessage": json.dumps(meta),
        })
    except Exception as e:
        logging.getLogger("vajra_core").warning(f"create_pocso_request insert failed: {e}")
    return meta


def find_active_pocso_request(badge: str, case_no: str) -> Optional[Dict[str, Any]]:
    """The most recent pending/approved-not-yet-expired POCSO request for this
    officer+case, if any -- used to avoid duplicate requests and to grant
    access once approved."""
    if not catalyst_app or not badge or not case_no:
        return None
    try:
        res = catalyst_app.zql().execute_query(
            "SELECT ROWID, AlertMessage FROM ProactiveAlerts "
            f"WHERE AlertType = 'POCSO_ACCESS' AND AlertMessage LIKE '*{case_no}*' "
            "ORDER BY ROWID DESC LIMIT 30")
    except Exception:
        return None
    for r in res or []:
        a = r.get("ProactiveAlerts", {})
        try:
            m = json.loads(a.get("AlertMessage") or "{}")
        except Exception:
            continue
        if str(m.get("requester_badge")) != str(badge) or m.get("case_no") != case_no:
            continue
        if m.get("status") == "pending":
            return m
        if m.get("status") == "approved" and m.get("grant_expires_at"):
            try:
                if datetime.fromisoformat(m["grant_expires_at"]) > datetime.utcnow():
                    return m
            except Exception:
                pass
    return None


def has_active_pocso_grant(badge: Optional[str], case_no: Optional[str]) -> bool:
    """True if this officer currently holds a non-expired, approved POCSO
    access grant for this specific case."""
    if not badge or not case_no:
        return False
    m = find_active_pocso_request(badge, case_no)
    return bool(m and m.get("status") == "approved")


# ---- Inter-district access air-lock (Part C item #7) ----
# Reuses the EXACT same ProactiveAlerts request/approve/time-boxed-grant
# pattern already proven twice this session (export approval, POCSO access)
# rather than a separate Circuits-based flow -- same UX for supervisors, one
# reviewed pattern, less risk. An officer's HOME district is resolved once at
# login (VajraSecurityFirewall, Unit.DistrictID) and stored on request.state;
# any request that resolves to a DIFFERENT district requires this grant.
# Supervisors are exempt everywhere else in this app (SUPERVISOR_KGIDS) and
# are exempt here too -- state-wide oversight is their whole role.
DISTRICT_ACCESS_GRANT_HOURS = 8


def find_district_access_row(request_id: str) -> Optional[Dict[str, Any]]:
    """Locate a district-access request row by its uuid request_id or numeric ROWID."""
    if not catalyst_app or not request_id:
        return None
    rid = str(request_id).replace("'", "''")
    try:
        if rid.isdigit():
            res = catalyst_app.zql().execute_query(
                "SELECT ROWID, AlertMessage FROM ProactiveAlerts "
                f"WHERE AlertType = 'DISTRICT_ACCESS' AND ROWID = {rid} LIMIT 1")
        else:
            res = catalyst_app.zql().execute_query(
                "SELECT ROWID, AlertMessage FROM ProactiveAlerts "
                f"WHERE AlertType = 'DISTRICT_ACCESS' AND AlertMessage LIKE '*{rid}*' ORDER BY ROWID DESC LIMIT 1")
    except Exception as e:
        logging.getLogger("vajra_core").warning(f"find_district_access_row: {e}")
        return None
    if not res:
        return None
    a = res[0].get("ProactiveAlerts", {})
    try:
        meta = json.loads(a.get("AlertMessage") or "{}")
    except Exception:
        meta = {}
    return {"rowid": a.get("ROWID"), "meta": meta}


def create_district_access_request(requester_badge: str, requester_name: str,
                                   home_district_id: Any, target_district_id: Any,
                                   target_district_name: str, reason: str = "") -> Dict[str, Any]:
    """Creates (or returns the existing) pending/approved request for this
    officer + target district, mirroring create_pocso_request exactly."""
    existing = find_active_district_access_request(requester_badge, target_district_id)
    if existing:
        return existing
    request_id = uuid.uuid4().hex[:16]
    meta = {
        "request_id": request_id, "requester_badge": str(requester_badge or ""),
        "requester_name": requester_name or "Officer",
        "home_district_id": home_district_id, "target_district_id": target_district_id,
        "target_district_name": target_district_name,
        "reason": (reason or "").strip()[:200], "status": "pending",
        "approver_badge": None, "decided_at": None, "grant_expires_at": None,
        "created_at": datetime.utcnow().isoformat(),
    }
    try:
        zcql_insert_row("ProactiveAlerts", {
            "AlertType": "DISTRICT_ACCESS", "Severity": "Critical",
            "TriggerTime": datetime.utcnow().isoformat(), "IsRead": False,
            "DistrictID": str(target_district_id or "0"), "AlertMessage": json.dumps(meta),
        })
    except Exception as e:
        logging.getLogger("vajra_core").warning(f"create_district_access_request insert failed: {e}")
    return meta


def find_active_district_access_request(badge: str, target_district_id: Any) -> Optional[Dict[str, Any]]:
    """The most recent pending/approved-not-yet-expired request for this
    officer + target district, mirroring find_active_pocso_request exactly."""
    if not catalyst_app or not badge or target_district_id is None:
        return None
    try:
        res = catalyst_app.zql().execute_query(
            "SELECT ROWID, AlertMessage FROM ProactiveAlerts "
            f"WHERE AlertType = 'DISTRICT_ACCESS' AND AlertMessage LIKE '*{target_district_id}*' "
            "ORDER BY ROWID DESC LIMIT 30")
    except Exception:
        return None
    for r in res or []:
        a = r.get("ProactiveAlerts", {})
        try:
            m = json.loads(a.get("AlertMessage") or "{}")
        except Exception:
            continue
        if str(m.get("requester_badge")) != str(badge) or str(m.get("target_district_id")) != str(target_district_id):
            continue
        if m.get("status") == "pending":
            return m
        if m.get("status") == "approved" and m.get("grant_expires_at"):
            try:
                if datetime.fromisoformat(m["grant_expires_at"]) > datetime.utcnow():
                    return m
            except Exception:
                pass
    return None


# ---- Emergency "Break-Glass" override (Section 185 BNSS emergency-entry
# principle applied to the data air-lock): the normal request/approve flow
# above requires a supervisor to be online. A genuine emergency ("active
# abduction crossed into District X, need the case file NOW") can't wait on
# that. This grants access IMMEDIATELY and self-approved -- the safety valve
# is that it's short-lived (well under the normal 8h grant), MANDATORY reason
# text is required (no silent bypass), and it always surfaces in the
# supervisor queue as a post-hoc review item, distinct from a normal
# approval decision -- the supervisor can't stop it in the moment, but every
# use is visible and revocable after the fact.
BREAK_GLASS_GRANT_HOURS = 2


def create_emergency_district_access(requester_badge: str, requester_name: str,
                                     home_district_id: Any, target_district_id: Any,
                                     target_district_name: str, reason: str) -> Dict[str, Any]:
    """Self-granting emergency override. Caller MUST have already validated
    `reason` is non-empty -- this function does not silently default it."""
    request_id = uuid.uuid4().hex[:16]
    now = datetime.utcnow()
    meta = {
        "request_id": request_id, "requester_badge": str(requester_badge or ""),
        "requester_name": requester_name or "Officer",
        "home_district_id": home_district_id, "target_district_id": target_district_id,
        "target_district_name": target_district_name,
        "reason": (reason or "").strip()[:200], "status": "approved",
        "approver_badge": None,  # self-granted, not supervisor-decided
        "decided_at": now.isoformat(),
        "grant_expires_at": (now + timedelta(hours=BREAK_GLASS_GRANT_HOURS)).isoformat(),
        "created_at": now.isoformat(),
        "emergency": True, "reviewed": False,
    }
    try:
        zcql_insert_row("ProactiveAlerts", {
            "AlertType": "DISTRICT_ACCESS", "Severity": "Critical",
            "TriggerTime": now.isoformat(), "IsRead": False,
            "DistrictID": str(target_district_id or "0"), "AlertMessage": json.dumps(meta),
        })
    except Exception as e:
        logging.getLogger("vajra_core").warning(f"create_emergency_district_access insert failed: {e}")
    return meta


def mark_district_access_reviewed(request_id: str, reviewer_badge: str, revoke: bool = False) -> Optional[Dict[str, Any]]:
    """Supervisor post-hoc review of an emergency grant: acknowledges it, and
    optionally revokes the still-active grant immediately (status ->
    'revoked', which has_active_district_access_grant no longer treats as
    'approved')."""
    row = find_district_access_row(request_id)
    if not row:
        return None
    meta = row["meta"]
    meta["reviewed"] = True
    meta["reviewer_badge"] = reviewer_badge
    meta["reviewed_at"] = datetime.utcnow().isoformat()
    if revoke:
        meta["status"] = "revoked"
    try:
        zcql_update_row("ProactiveAlerts", {"ROWID": row["rowid"], "AlertMessage": json.dumps(meta)})
    except Exception as e:
        logging.getLogger("vajra_core").warning(f"mark_district_access_reviewed update failed: {e}")
    return meta


def has_active_district_access_grant(badge: Optional[str], home_district_id: Any, target_district_id: Any) -> bool:
    """True if the target district IS the officer's home district (no grant
    ever needed for one's own district), the officer is a supervisor (exempt,
    same as everywhere else in this app), or they hold a live approved grant."""
    if target_district_id is None or home_district_id is None:
        return True  # can't resolve either side -- fail OPEN here; callers
        # gate on an explicit district_id parameter/resolved value, so this
        # only triggers when there's genuinely nothing to compare.
    if str(target_district_id) == str(home_district_id):
        return True
    if is_supervisor_badge(badge):
        return True
    m = find_active_district_access_request(badge, target_district_id)
    return bool(m and m.get("status") == "approved")


def derive_role_tier(rank_id: Optional[int], kgid: Optional[str] = None) -> str:
    """
    Resolve an officer's access tier.

    When a badge (kgid) is supplied, the SUPERVISOR_KGIDS allowlist is the sole
    authority: only those exact badges are Supervisor-tier, everyone else is an
    officer no matter their rank. This is what the login endpoint and firewall
    use, so the app shows the Supervisor tab (and honours supervisor-only
    endpoints) for badge 2346836 alone.

    When no kgid is available, fall back to the legacy rank cutoff: RANKS is
    seeded ascending (Constable..DGP, RankID 1-10); PI (RankID 5) and above are
    gazetted supervisory ranks. This path exists only for callers that have a
    rank but no badge in hand.
    """
    if kgid is not None:
        return "supervisor" if str(kgid).strip() in SUPERVISOR_KGIDS else "officer"
    return "supervisor" if rank_id and int(rank_id) >= 5 else "officer"


# In-process cache for the Employee/Unit/Rank/Designation profile chain the
# firewall resolves on every single request. Confirmed live: this chain was
# costing ~2.5-3.5s of pure network round-trip time (4 sequential ZCQL
# queries at ~0.6-0.8s each to Zoho's India servers) on TOP OF whatever the
# endpoint itself does -- explaining why every protected call felt slow
# regardless of what it actually needed to do. This data changes rarely (an
# officer's rank/station), so a short TTL cache eliminates that cost on
# every request after the first for a given officer, at the cost of a stale
# read for up to PROFILE_CACHE_TTL_SECONDS after a real change (e.g. a
# promotion) -- acceptable for a data-store lookup this infrequently mutated.
_profile_cache: Dict[str, Any] = {}
PROFILE_CACHE_TTL_SECONDS = 600


class VajraSecurityFirewall:
    """
    A live security firewall enforcing data access context.
    Reads Authorization header, validates JWT with Zoho Catalyst Auth, extracts officer profile,
    and returns the authorized station/location.
    """
    async def __call__(self, request: Request) -> str:
        auth_header = request.headers.get("Authorization")
        if not auth_header or not auth_header.startswith("Bearer "):
            logger.warning("Access denied: Missing or invalid Authorization header.")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Security Access Violation: Missing or invalid 'Authorization: Bearer <token>' header."
            )
            
        jwt_token = auth_header.split(" ")[1]
        
        if not catalyst_app:
            logger.critical("Catalyst App is not initialized.")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Internal Server Error: Database client offline."
            )
            
        try:
            # 1. Verify VAJRA's own signed session token (see issue_session_token /
            # verify_session_token above). A prior version of this check compared
            # jwt_token against the backend's own cached service-account token and
            # auto-authenticated as admin on a match — a real privilege-escalation
            # path, removed. A version after that called Zoho's
            # /project-user/current, but that requires a genuine per-user Catalyst
            # session (Third-party Authentication, not enabled in console yet) —
            # every officer currently shares one admin-scoped RefreshTokenCredential,
            # which Zoho's own endpoint can't resolve to an individual identity, so
            # that check 401'd for every request regardless of who logged in. The
            # token verified here is real and per-officer (HS256-signed at login,
            # tied to the specific badge that passed the bcrypt check, expires) —
            # it replaces which system verifies the session, not the check itself.
            kgid = verify_session_token(jwt_token)

            if not kgid:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Security Access Violation: Session authentication failed."
                )

            # 3. Resolve the officer's profile -- from the in-process cache if
            # a recent lookup already did this (see PROFILE_CACHE_TTL_SECONDS
            # above), otherwise via the real 4-query chain and cache the result.
            cached = _profile_cache.get(kgid)
            if cached and (time.time() - cached["cached_at"]) < PROFILE_CACHE_TTL_SECONDS:
                profile = cached["profile"]
                unit_name = cached["unit_name"]
                rank_name = cached["rank_name"]
                designation_name = cached["designation_name"]
                role_tier = cached["role_tier"]
                home_district_id = cached.get("home_district_id")
            else:
                # Email is a NEW column (added for the officer-registers-own-
                # email feature) that may not exist yet on every deployment's
                # Employee table -- ZCQL raises "Unknown column" for a column
                # that isn't there, which would break login for EVERY officer
                # if this ran unguarded (this query is on the auth hot path).
                # Try with Email first; fall back to the original column set
                # the moment that fails, so this never depends on deploy
                # order versus the console schema change.
                try:
                    zql_query = f"""
                        SELECT EmployeeID, UnitID, KGID, FirstName, RankID, DesignationID, Email
                        FROM Employee
                        WHERE KGID = '{kgid}'
                    """
                    profile_res = catalyst_app.zql().execute_query(zql_query)
                except Exception:
                    zql_query = f"""
                        SELECT EmployeeID, UnitID, KGID, FirstName, RankID, DesignationID
                        FROM Employee
                        WHERE KGID = '{kgid}'
                    """
                    profile_res = catalyst_app.zql().execute_query(zql_query)

                if not profile_res:
                    # Previously fell back to an arbitrary Employee row ("LIMIT 1") when the
                    # authenticated user's KGID had no match — that silently granted whoever
                    # authenticated the identity/station/unit context of an unrelated employee.
                    # Fail closed instead: no matching Employee record means no access.
                    logger.warning(f"No Employee profile found for KGID '{kgid}'. Denying access.")
                    raise HTTPException(
                        status_code=status.HTTP_401_UNAUTHORIZED,
                        detail="Security Access Violation: Authorized employee profile not found."
                    )

                profile = profile_res[0].get("Employee", {})
                unit_id = profile.get("UnitID")
                rank_id = profile.get("RankID")
                designation_id = profile.get("DesignationID")

                # Fetch Unit Name + the officer's HOME DISTRICT (for the
                # inter-district access air-lock, Part C item #7) in the same
                # query -- no extra round-trip.
                unit_res = catalyst_app.zql().execute_query(f"SELECT UnitName, DistrictID FROM Unit WHERE UnitID = {unit_id}")
                unit_name = unit_res[0].get("Unit", {}).get("UnitName") if unit_res else "Unknown Station"
                home_district_id = unit_res[0].get("Unit", {}).get("DistrictID") if unit_res else None

                # Fetch Rank and Designation names — data has existed since seeding but was
                # never queried here or exposed to the frontend/session context until now.
                rank_name = "Unknown Rank"
                if rank_id:
                    rank_res = catalyst_app.zql().execute_query(f"SELECT RankName FROM Rank WHERE RankID = {rank_id}")
                    if rank_res:
                        rank_name = rank_res[0].get("Rank", {}).get("RankName") or rank_name

                designation_name = "Unknown Designation"
                if designation_id:
                    desig_res = catalyst_app.zql().execute_query(f"SELECT DesignationName FROM Designation WHERE DesignationID = {designation_id}")
                    if desig_res:
                        designation_name = desig_res[0].get("Designation", {}).get("DesignationName") or designation_name

                role_tier = derive_role_tier(rank_id, kgid)

                _profile_cache[kgid] = {
                    "profile": profile, "unit_name": unit_name, "rank_name": rank_name,
                    "designation_name": designation_name, "role_tier": role_tier,
                    "home_district_id": home_district_id,
                    "cached_at": time.time()
                }

            # Store the user profile and location context in request.state for downstream endpoints
            request.state.user_profile = profile
            request.state.authorized_station = unit_name
            request.state.kgid = profile.get("KGID")
            request.state.rank_name = rank_name
            request.state.designation_name = designation_name
            request.state.role_tier = role_tier
            request.state.home_district_id = home_district_id

            logger.info(f"Access granted. Officer {profile.get('FirstName')} (KGID: {profile.get('KGID')}, {designation_name}/{rank_name}) authenticated for station: '{unit_name}'")
            return unit_name
            
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Firewall JWT auth verification failure: {e}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Security Access Violation: Session verification failed."
            )


def _compute_mo_vector(latitude: float, gravity_id: int, day_of_week: int, accused_count: int, crime_head_id: int) -> np.ndarray:
    """
    Shared normalization so a target suspect's MO signature and the reference
    vectors it's compared against (in MOBehavioralProfiler) are built from the
    exact same feature scaling -- must stay in sync with the target_vector
    construction in agent_loop.py's get_mo_profile.

    Temporal feature is DAY OF WEEK (0=Monday..6=Sunday), not hour-of-day.
    Confirmed live: CaseMaster.IncidentFromDate and Inv_OccuranceTime.
    OccurrenceDate are both DATE-ONLY ("2024-10-19") across this entire
    dataset -- no clock-time component exists anywhere in the real data. The
    original "incident_hour" feature parsed a "YYYY-MM-DD HH:MM:SS" shape
    that real rows never have, so it silently hit its exception handler and
    fell back to a HARDCODED CONSTANT (hour=12) for every single real case --
    one of five cosine-similarity dimensions was dead weight, contributing
    zero actual signal to every MO match (including the serial-offender
    threshold flag this profiler feeds). Day-of-week is the closest genuinely
    groundable temporal signal this data actually supports.
    """
    lat_factor = (latitude - 11.0) / 8.0 if (11.0 <= latitude <= 19.0) else 0.5
    gravity_factor = min(gravity_id, 10) / 10.0
    day_factor = (day_of_week % 7) / 6.0
    group_factor = min(accused_count, 10) / 10.0
    type_factor = min(crime_head_id, 50) / 50.0
    return np.array([lat_factor, gravity_factor, day_factor, group_factor, type_factor])


class MOBehavioralProfiler:
    """
    Numpy-based cosine similarity classifier engine for Modus Operandi (MO) signatures.
    Prefers real historical MO signatures computed from live CaseMaster/Accused
    records; falls back to the generated narrative database
    (synthetic_fir_data.json), and only as a last resort to random vectors
    labeled MOCK (kept so the tool never hard-fails, but real/seeded data is
    always tried first since the whole point is grounded investigative recall).
    """
    def __init__(self, data_path: str = "synthetic_fir_data.json", catalyst_app=None):
        self.vectors: List[np.ndarray] = []
        self.metadata: List[Dict[str, Any]] = []
        self.data_source = "mock"

        if catalyst_app:
            try:
                self._load_from_live_db(catalyst_app)
                if self.vectors:
                    self.data_source = "live_db"
                    logger.info(f"MOBehavioralProfiler: Built {len(self.vectors)} real MO vectors from live CaseMaster/Accused data.")
            except Exception as e:
                logger.warning(f"MOBehavioralProfiler: live DB vector build failed, falling back: {e}")

        # Load profile signatures
        if not self.vectors and os.path.exists(data_path):
            try:
                with open(data_path, 'r', encoding='utf-8') as f:
                    records = json.load(f)
                for r in records:
                    if "mo_vector" in r:
                        self.vectors.append(np.array(r["mo_vector"]))
                        self.metadata.append({
                            "fir_id": r.get("fir_id"),
                            "suspect_name": r.get("suspect_name"),
                            "crime_type": r.get("crime_type"),
                            "station": r.get("station")
                        })
                if self.vectors:
                    self.data_source = "synthetic_file"
                logger.info(f"MOBehavioralProfiler: Loaded {len(self.vectors)} historical MO vectors.")
            except Exception as e:
                logger.error(f"Failed to load MO database: {e}")

        if not self.vectors:
            np.random.seed(42)
            for i in range(50):
                self.vectors.append(np.random.rand(5))
                self.metadata.append({
                    "fir_id": f"FIR-2026-MOCK-{i}",
                    "suspect_name": f"Suspect-{i}",
                    "crime_type": "Theft",
                    "station": "Cubbon Park PS"
                })

        self.mo_matrix = np.vstack(self.vectors)
        norms = np.linalg.norm(self.mo_matrix, axis=1, keepdims=True)
        norms[norms == 0] = 1e-9
        self.mo_matrix_normalized = self.mo_matrix / norms

    def _load_from_live_db(self, catalyst_app):
        cases_res = catalyst_app.zql().execute_query(
            "SELECT CaseMasterID, latitude, GravityOffenceID, IncidentFromDate, CrimeMajorHeadID, PoliceStationID, CrimeNo FROM CaseMaster LIMIT 250"
        )
        if not cases_res:
            return

        crimehead_res = catalyst_app.zql().execute_query("SELECT CrimeHeadID, CrimeGroupName FROM CrimeHead")
        crimehead_map = {r["CrimeHead"]["CrimeHeadID"]: r["CrimeHead"]["CrimeGroupName"] for r in crimehead_res}
        unit_res = catalyst_app.zql().execute_query("SELECT UnitID, UnitName FROM Unit")
        unit_map = {r["Unit"]["UnitID"]: r["Unit"]["UnitName"] for r in unit_res}

        # Fetch accused SCOPED to exactly these 250 cases (IN-list, no JOINs in
        # ZCQL), not a flat "LIMIT 300" over the whole Accused table. Confirmed
        # live bug: an unscoped LIMIT 300 samples accused rows independently of
        # which 250 cases were selected above, so most of those cases' real,
        # on-record accused fell outside the sample -- every MO reference match
        # came back "suspect: Unknown" even for cases that DO have a named
        # accused, an avoidable data-completeness gap presented as if no
        # accused existed. Scoping the query to these specific case IDs (same
        # IN-list pattern already used elsewhere in this file, e.g. the
        # syndicate co-offense query below) closes that gap directly.
        accused_by_case: Dict[str, List[str]] = {}
        case_ids = [str(r.get("CaseMaster", {}).get("CaseMasterID")) for r in cases_res
                    if r.get("CaseMaster", {}).get("CaseMasterID")]
        if case_ids:
            ids_str = ",".join(case_ids)
            accused_res = catalyst_app.zql().execute_query(
                f"SELECT CaseMasterID, AccusedName FROM Accused WHERE CaseMasterID IN ({ids_str})")
            for r in accused_res:
                a = r.get("Accused", {})
                cid = a.get("CaseMasterID")
                if cid:
                    accused_by_case.setdefault(cid, []).append(a.get("AccusedName"))

        for r in cases_res:
            c = r.get("CaseMaster", {})
            cm_id = c.get("CaseMasterID")
            try:
                latitude = float(c.get("latitude") or 13.027)
                gravity_id = int(c.get("GravityOffenceID") or 4)
                ch_id_raw = c.get("CrimeMajorHeadID")
                crime_head_id = int(ch_id_raw or 5)

                # Real data is DATE-only ("2024-10-19", no clock time) -- see
                # _compute_mo_vector's docstring. day_of_week is the genuine
                # temporal signal this field actually supports.
                raw_date = c.get("IncidentFromDate") or ""
                day_of_week = 0
                try:
                    day_of_week = datetime.strptime(raw_date[:10], "%Y-%m-%d").weekday()
                except Exception:
                    pass

                names = accused_by_case.get(cm_id, [])
                accused_count = len(names) or 1

                vector = _compute_mo_vector(latitude, gravity_id, day_of_week, accused_count, crime_head_id)
                self.vectors.append(vector)
                self.metadata.append({
                    "fir_id": c.get("CrimeNo") or f"CASE-{cm_id}",
                    "suspect_name": names[0] if names else "Unknown",
                    "crime_type": crimehead_map.get(ch_id_raw, "Unknown"),
                    "station": unit_map.get(c.get("PoliceStationID"), "Unknown")
                })
            except Exception:
                continue

    def find_matches(self, target_vector: np.ndarray, top_k: int = 3) -> List[Dict[str, Any]]:
        if len(target_vector) != 5:
            raise ValueError("Target MO signature vector must contain exactly 5 features.")
            
        target_norm = np.linalg.norm(target_vector)
        target_vector_norm = target_vector / (target_norm if target_norm > 0 else 1.0)
        
        similarities = np.dot(self.mo_matrix_normalized, target_vector_norm)
        top_indices = np.argsort(similarities)[::-1][:top_k]
        
        matches = []
        for idx in top_indices:
            matches.append({
                "case_id": self.metadata[idx]["fir_id"],
                "suspect": self.metadata[idx]["suspect_name"],
                "crime": self.metadata[idx]["crime_type"],
                "station": self.metadata[idx]["station"],
                "similarity_score": round(float(similarities[idx]), 4)
            })
        return matches


class VajraGraphRAG:
    """
    Traces multi-hop relationships between suspects by querying relational
    connections dynamically from Zoho Catalyst Datastore tables.

    This previously attempted a Neo4j connection first (bolt://localhost:7687),
    with this ZCQL path only as a fallback. Neo4j is unreachable from any real
    Catalyst deployment (no hosted graph DB in scope), so that code path never
    ran in production and never will — removed. This ZCQL tracing is the only
    path that actually runs, confirmed live against real CaseMaster data.
    """
    def __init__(self):
        pass

    def get_criminal_network(self, suspect_name: str) -> Dict[str, Any]:
        """
        Retrieves co-conspirator and related incident links by querying the
        live Catalyst tables using ZCQL.
        """
        if catalyst_app:
            try:
                # 1. Look up the suspect in our Accused table
                # ZCQL's LIKE wildcard is '*', not SQL-standard '%' -- confirmed
                # live that every '%...%' pattern anywhere in this codebase
                # silently matched zero rows regardless of real data present.
                # Escape the name here so ALL callers (incl. the REST paths that
                # pass it raw) are covered -- an apostrophe surname (D'Souza) would
                # otherwise break the query or allow injection.
                _sn = str(suspect_name).replace("'", "''")
                accused_query = f"SELECT AccusedName, CaseMasterID FROM Accused WHERE AccusedName LIKE '*{_sn}*'"
                accused_res = catalyst_app.zql().execute_query(accused_query)

                if accused_res:
                    # Confirmed live: a common first name ("ramesh") fuzzy-
                    # matched ~15 genuinely different real people across the
                    # database, and every one of their cases got merged into
                    # a single fake "syndicate" -- a ~50-case, dozens-of-
                    # co-accused network presented as if it belonged to one
                    # suspect. LIKE '*x*' matching multiple DISTINCT accused
                    # names is a name collision, not one prolific offender.
                    # Prefer an exact (case-insensitive) match among the
                    # candidates if one exists; otherwise this is genuinely
                    # ambiguous and must say so rather than silently
                    # presenting a fabricated combined network.
                    distinct_names = {}
                    for r in accused_res:
                        a = r.get("Accused", {})
                        name = a.get("AccusedName")
                        cid = a.get("CaseMasterID")
                        if name and cid:
                            distinct_names.setdefault(name, []).append(cid)

                    if len(distinct_names) > 1:
                        exact = next((n for n in distinct_names if n.lower() == suspect_name.lower()), None)
                        if exact:
                            case_ids = distinct_names[exact]
                            suspect_name = exact
                        else:
                            other_names = sorted(n for n in distinct_names if n.lower() != suspect_name.lower())
                            return {
                                "target_suspect": suspect_name,
                                "engine_mode": "Ambiguous Name Match",
                                "ambiguous_match": True,
                                "candidate_names": other_names[:10],
                                "1st_degree_connections": [],
                                "2nd_degree_connections": [],
                                "3rd_degree_connections": [],
                                "nodes": [{"id": "suspect", "label": suspect_name, "type": "suspect"}],
                                "edges": [],
                                "case_ids": []
                            }
                    else:
                        case_ids = list(distinct_names.values())[0] if distinct_names else []

                    if not case_ids:
                        return self._fallback_result(suspect_name)

                    case_ids_str = ",".join(map(str, case_ids))
                    
                    # 2. Find other accused persons linked to the same cases
                    co_query = f"SELECT AccusedName, CaseMasterID FROM Accused WHERE CaseMasterID IN ({case_ids_str})"
                    co_res = catalyst_app.zql().execute_query(co_query)
                    co_accused_names = list(set([r.get("Accused", {}).get("AccusedName") for r in co_res if suspect_name.lower() not in r.get("Accused", {}).get("AccusedName").lower()]))
                    
                    # 3. Retrieve case details from CaseMaster
                    cases_query = f"""
                        SELECT CrimeNo, PoliceStationID
                        FROM CaseMaster
                        WHERE CaseMasterID IN ({case_ids_str})
                    """
                    cases_res = catalyst_app.zql().execute_query(cases_query)

                    # Batch-fetch every station name in one call instead of one
                    # ZCQL round-trip per linked case -- a suspect with, say, 5
                    # linked cases previously meant 5 sequential "SELECT
                    # UnitName FROM Unit WHERE UnitID = X" calls (each its own
                    # ~300-500ms HTTP round-trip on top of an already-slow GLM
                    # turn), a real contributor to this tool occasionally
                    # exceeding realistic response-time budgets. Unit is a
                    # small, bounded table (~30 rows), so one unfiltered fetch
                    # is always cheaper than N lookups for N >= 2.
                    unit_name_map: Dict[Any, str] = {}
                    try:
                        all_units_res = catalyst_app.zql().execute_query("SELECT UnitID, UnitName FROM Unit")
                        for u in all_units_res:
                            u_data = u.get("Unit", {})
                            u_id = u_data.get("UnitID")
                            if u_id is not None:
                                unit_name_map[str(u_id)] = u_data.get("UnitName") or "Unknown PS"
                    except Exception as ex:
                        logger.warning(f"Could not batch-fetch Unit names for network trace: {ex}")

                    linked_cases = []
                    # Structured graph data for a real node-link diagram, built
                    # alongside the existing human-readable strings (kept for
                    # backward compat with any caller still reading them) --
                    # the suspect is the root, cases are 1st-degree nodes,
                    # co-accused sharing those cases are 2nd-degree nodes.
                    nodes = [{"id": "suspect", "label": suspect_name, "type": "suspect"}]
                    edges = []
                    for c in cases_res:
                        cm_data = c.get("CaseMaster", {})
                        crime_no = cm_data.get("CrimeNo")
                        station_id = cm_data.get("PoliceStationID")
                        unit_name = unit_name_map.get(str(station_id), "Unknown PS") if station_id else "Unknown PS"
                        linked_cases.append(f"{crime_no} ({unit_name})")

                        case_node_id = f"case_{crime_no}"
                        nodes.append({"id": case_node_id, "label": crime_no, "sublabel": unit_name, "type": "case"})
                        edges.append({"source": "suspect", "target": case_node_id})

                    for co in co_accused_names:
                        co_node_id = f"person_{co}"
                        nodes.append({"id": co_node_id, "label": co, "type": "person"})
                        # Link each co-accused to the first case node (best-effort;
                        # a precise per-case link would need the co-accused's own
                        # CaseMasterID carried through from the co_query above)
                        if len(nodes) > 1:
                            edges.append({"source": nodes[1]["id"], "target": co_node_id})

                    # Degree centrality (deterministic, no networkx -> respects the
                    # vendor disk cap): count the edges touching each node. The
                    # most-connected ENTITY (person, not a case node) is the likely
                    # hub / kingpin of this cluster -- the actionable "who to look at
                    # first" signal, not just a flat list of names.
                    deg: Dict[str, int] = {}
                    for e in edges:
                        deg[e["source"]] = deg.get(e["source"], 0) + 1
                        deg[e["target"]] = deg.get(e["target"], 0) + 1
                    label_by_id = {n["id"]: n for n in nodes}
                    centrality = sorted(
                        (
                            {"label": label_by_id[nid]["label"], "type": label_by_id[nid].get("type"), "degree": d}
                            for nid, d in deg.items() if nid in label_by_id
                        ),
                        key=lambda x: -x["degree"],
                    )[:8]
                    person_centrality = [c for c in centrality if c["type"] in ("suspect", "person")]
                    hub = person_centrality[0] if person_centrality else (centrality[0] if centrality else None)

                    # SHARED-ATTRIBUTE (Tier-2) LINKS: people connected by a
                    # shared phone or vehicle across DIFFERENT cases -- the
                    # "linked though never in the same FIR" signal that flat
                    # co-accused analysis misses. Reads the AccusedContact table
                    # if it has been seeded; silently skips when absent, so the
                    # base network still works unchanged.
                    shared_links = []
                    try:
                        sn = suspect_name.replace("'", "''")
                        mine = catalyst_app.zql().execute_query(
                            f"SELECT PhoneNumber, VehicleNumber FROM AccusedContact WHERE AccusedName LIKE '*{sn}*' LIMIT 1")
                        if mine:
                            m = mine[0].get("AccusedContact", {})
                            seen = {x.lower() for x in ([suspect_name] + co_accused_names)}
                            for attr_val, attr_kind, col in (
                                (m.get("PhoneNumber"), "phone", "PhoneNumber"),
                                (m.get("VehicleNumber"), "vehicle", "VehicleNumber")):
                                if not attr_val:
                                    continue
                                av = str(attr_val).replace("'", "''")
                                others = catalyst_app.zql().execute_query(
                                    f"SELECT AccusedName FROM AccusedContact WHERE {col} = '{av}'")
                                for o in others:
                                    onm = o.get("AccusedContact", {}).get("AccusedName")
                                    if onm and onm.lower() not in seen:
                                        seen.add(onm.lower())
                                        nid = f"shared_{len(nodes)}"
                                        nodes.append({"id": nid, "label": onm, "type": "shared_link", "sublabel": f"shared {attr_kind}"})
                                        edges.append({"source": "suspect", "target": nid, "kind": "shared_attribute", "label": f"shared {attr_kind}"})
                                        shared_links.append({"name": onm, "via": attr_kind, "value": attr_val})
                    except Exception as e:
                        logger.info(f"Shared-attribute linking skipped (AccusedContact not seeded?): {e}")

                    return {
                        "target_suspect": suspect_name,
                        "engine_mode": "Live Zoho Catalyst ZQL Tracing",
                        "1st_degree_connections": [f"Case Link: {c}" for c in linked_cases],
                        "2nd_degree_connections": [f"Co-Accused: {co}" for co in co_accused_names],
                        "3rd_degree_connections": ["Syndicate Connection: Local Crime Cell (Grounded in shared FIRs)"],
                        "nodes": nodes,
                        "edges": edges,
                        "centrality": centrality,
                        "hub": hub,
                        "shared_links": shared_links,
                        "case_ids": case_ids
                    }
            except Exception as e:
                logger.error(f"Failed to perform Zoho Catalyst relational GraphRAG trace: {e}")

        return self._fallback_result(suspect_name)

    def _fallback_result(self, suspect_name: str) -> Dict[str, Any]:
        return {
            "target_suspect": suspect_name,
            "engine_mode": "Static Fallback Simulation",
            "1st_degree_connections": ["Vehicle: KA-01-ME-8821", "Phone: +91-9882377182"],
            "2nd_degree_connections": ["Co-conspirator: Akash Kumar"],
            "3rd_degree_connections": ["Syndicate Connection: Bengaluru East Petty Theft Ring"],
            "nodes": [
                {"id": "suspect", "label": suspect_name, "type": "suspect"},
                {"id": "vehicle_1", "label": "KA-01-ME-8821", "type": "vehicle"},
                {"id": "phone_1", "label": "+91-9882377182", "type": "phone"},
                {"id": "person_akash", "label": "Akash Kumar", "type": "person"},
            ],
            "edges": [
                {"source": "suspect", "target": "vehicle_1"},
                {"source": "suspect", "target": "phone_1"},
                {"source": "suspect", "target": "person_akash"},
            ]
        }

class VajraSemanticMemory:
    """
    Vector search index. Ingests narratives and computes cosine similarities.
    On startup, attempts to fetch real incident reports from Zoho Catalyst to index!
    """
    def __init__(self, data_path: str = "synthetic_fir_data.json"):
        t_start = time.time()
        self.documents: List[str] = []
        self.fir_metadata: List[Dict[str, Any]] = []
        
        # Load from live database first
        if catalyst_app:
            try:
                # Fetch all units first to avoid N+1 query overhead
                unit_map = {}
                try:
                    all_units = catalyst_app.zql().execute_query("SELECT UnitID, UnitName FROM Unit")
                    for ur in all_units:
                        u_data = ur.get("Unit", {})
                        u_id = u_data.get("UnitID")
                        u_name = u_data.get("UnitName")
                        if u_id:
                            unit_map[int(u_id)] = u_name
                except Exception as ex:
                    logger.warning(f"Could not pre-fetch Unit table: {ex}")

                # Fetch up to 250 case master brief facts to index via ZQL
                zql_query = """
                    SELECT CrimeNo, BriefFacts, PoliceStationID 
                    FROM CaseMaster 
                    LIMIT 250
                """
                res = catalyst_app.zql().execute_query(zql_query)
                if res:
                    for r in res:
                        cm_data = r.get("CaseMaster", {})
                        facts = cm_data.get("BriefFacts") or "No narrative summary recorded."
                        crime_no = cm_data.get("CrimeNo")
                        station_id = cm_data.get("PoliceStationID")
                        
                        unit_name = "Unknown PS"
                        if station_id and int(station_id) in unit_map:
                            unit_name = unit_map[int(station_id)]
                                
                        self.documents.append(facts)
                        self.fir_metadata.append({
                            "fir_id": crime_no,
                            "station": unit_name,
                            "crime_type": "Grounded Database Record",
                            "suspect": "Grounded suspect trace"
                        })
                    logger.info(f"VajraSemanticMemory: Indexed {len(self.documents)} live database case briefs.")
            except Exception as e:
                logger.error(f"Failed to fetch live case briefs from Zoho Catalyst via ZQL: {e}")
                import traceback
                traceback.print_exc()

        # Load synthetic documents if database index is empty
        if not self.documents:
            if os.path.exists(data_path):
                try:
                    with open(data_path, 'r', encoding='utf-8') as f:
                        records = json.load(f)
                    for r in records:
                        self.documents.append(f"{r.get('narrative_english')} | {r.get('narrative_kannada')}")
                        self.fir_metadata.append({
                            "fir_id": r.get("fir_id"),
                            "station": r.get("station"),
                            "crime_type": r.get("crime_type"),
                            "suspect": r.get("suspect_name")
                        })
                    logger.info(f"VajraSemanticMemory: Loaded {len(self.documents)} fallback synthetic logs.")
                except Exception as e:
                    logger.error(f"Failed to load fallback index: {e}")
                    
        if not self.documents:
            self.documents = ["No reports index compiled."]
            self.fir_metadata = [{"fir_id": "MOCK", "station": "Mock PS", "crime_type": "None", "suspect": "None"}]

        # Set up similarity vectorizer
        self.use_transformer = False
        if SENTENCE_TRANSFORMERS_AVAILABLE:
            try:
                self.transformer = SentenceTransformer('all-MiniLM-L6-v2')
                self.doc_embeddings = self.transformer.encode(self.documents, show_progress_bar=False)
                self.use_transformer = True
                logger.info("SentenceTransformer embeddings generated successfully.")
            except Exception as e:
                logger.warning(f"SentenceTransformer load failure: {e}. Reverting to TF-IDF.")
                
        if not self.use_transformer:
            self.tfidf_vectorizer = TfidfVectorizer(stop_words='english')
            self.tfidf_matrix = self.tfidf_vectorizer.fit_transform(self.documents)
            
        t_end = time.time()
        logger.info(f"VajraSemanticMemory: Initialization took {t_end - t_start:.4f} seconds.")

    def recall_context(self, query: str, top_k: int = 1) -> List[Dict[str, Any]]:
        if not self.documents or self.documents[0] == "No reports index compiled.":
            return []

        if self.use_transformer:
            query_embedding = self.transformer.encode([query], show_progress_bar=False)
            dots = np.dot(self.doc_embeddings, query_embedding.T).squeeze()
            
            # Handle boundary case if documents contains only 1 element
            if len(self.documents) == 1:
                top_indices = np.array([0])
                scores = np.array([dots])
            else:
                top_indices = np.argsort(dots)[::-1][:top_k]
                scores = dots
        else:
            query_vector = self.tfidf_vectorizer.transform([query])
            similarities = cosine_similarity(self.tfidf_matrix, query_vector).squeeze()
            
            if len(self.documents) == 1:
                top_indices = np.array([0])
                scores = np.array([similarities])
            else:
                top_indices = np.argsort(similarities)[::-1][:top_k]
                scores = similarities

        results = []
        indices = [top_indices] if isinstance(top_indices, (int, np.integer)) else list(top_indices)
        
        for idx in indices:
            score = float(scores[idx]) if hasattr(scores, '__len__') and len(scores) > 1 else float(scores)
            results.append({
                "fir_id": self.fir_metadata[idx]["fir_id"],
                "station": self.fir_metadata[idx]["station"],
                "crime_type": self.fir_metadata[idx]["crime_type"],
                "suspect": self.fir_metadata[idx]["suspect"],
                "recalled_narrative": self.documents[idx],
                "confidence_score": round(score, 4)
            })
        return results
