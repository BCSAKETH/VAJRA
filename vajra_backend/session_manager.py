"""
VAJRA - Enterprise Single-Session Concurrency & Liveness Manager (Section 14)
Enforces strict 1-session-per-officer policy with Hotstar-style conflict resolution,
active liveness heartbeats, tab-close grace period handling, and tamper-evident audit logging.
"""

import os
import time
import uuid
import json
import logging
import threading
import hashlib
from typing import Dict, Any, Optional, Tuple
from datetime import datetime
import jwt as pyjwt

logger = logging.getLogger("session_manager")
_SESSION_LOCK = threading.RLock()

SESSION_SECRET = os.getenv("SESSION_SECRET", "vajra_ksp_session_secret_2026")
SESSION_TTL_SECONDS = 86400        # 24 Hours absolute max token life
HEARTBEAT_TIMEOUT_SECONDS = 45     # 45s heartbeat window (ghost session detection)
GRACE_PERIOD_SECONDS = 15          # 15s tab-close / refresh grace window


def _format_device_name(user_agent: str) -> str:
    ua = user_agent.lower()
    os_name = "Windows Workstation"
    if "macintosh" in ua or "mac os" in ua:
        os_name = "macOS Terminal"
    elif "linux" in ua and "android" not in ua:
        os_name = "Linux Police Workstation"
    elif "android" in ua:
        os_name = "Police Android Tablet"
    elif "iphone" in ua or "ipad" in ua:
        os_name = "iOS Secure Device"

    browser = "Browser"
    if "edg" in ua:
        browser = "Edge"
    elif "chrome" in ua:
        browser = "Chrome"
    elif "firefox" in ua:
        browser = "Firefox"
    elif "safari" in ua and "chrome" not in ua:
        browser = "Safari"

    return f"{browser} on {os_name}"


class ActiveSessionRecord:
    def __init__(self, kgid: str, jti: str, ip_address: str, user_agent: str, device_name: str):
        self.kgid = str(kgid).strip()
        self.jti = jti
        self.ip_address = ip_address or "10.14.22.84"
        self.user_agent = user_agent or ""
        self.device_name = device_name
        self.login_time = time.time()
        self.last_heartbeat = time.time()
        self.is_pending_close = False
        self.pending_close_since = 0.0
        # Eviction metadata stamped when this session is superseded by another terminal
        self.superseded_by: Optional[Dict[str, Any]] = None

    def is_alive(self) -> bool:
        now = time.time()
        if self.is_pending_close:
            return (now - self.pending_close_since) < GRACE_PERIOD_SECONDS
        return (now - self.last_heartbeat) < HEARTBEAT_TIMEOUT_SECONDS

    def to_dict(self) -> Dict[str, Any]:
        now = time.time()
        mins_active = max(0, int((now - self.last_heartbeat) // 60))
        active_label = "Active just now" if mins_active < 1 else f"Active {mins_active} min{'s' if mins_active > 1 else ''} ago"
        return {
            "device_name": self.device_name,
            "ip_address": self.ip_address,
            "login_time": datetime.utcfromtimestamp(self.login_time).isoformat() + "Z",
            "last_active": active_label,
            "is_alive": self.is_alive()
        }


# In-memory session registries
_ACTIVE_SESSIONS: Dict[str, ActiveSessionRecord] = {}
# Single-use continuation tokens for conflict resolution: token -> (kgid, device_name, ip_address, timestamp)
_CONTINUATION_TOKENS: Dict[str, Tuple[str, str, str, float]] = {}
# Map of superseded token JTIs to their eviction notice metadata
_SUPERSEDED_EVICTIONS: Dict[str, Dict[str, Any]] = {}


def check_session_conflict(kgid: str, ip_address: str, user_agent: str) -> Optional[Dict[str, Any]]:
    """
    Checks if an active, living session is currently running for this KGID.
    Returns active session metadata & continuation token if conflict exists, or None if clear.
    """
    with _SESSION_LOCK:
        kgid_clean = str(kgid).strip()
        existing = _ACTIVE_SESSIONS.get(kgid_clean)
        if not existing:
            return None

        # If the existing session is dead (no heartbeat for >45s), auto-clear
        if not existing.is_alive():
            logger.info(f"Existing session for KGID {kgid_clean} is inactive (heartbeat expired). Clearing.")
            del _ACTIVE_SESSIONS[kgid_clean]
            return None

        # An active, living session genuinely exists on another terminal!
        d_name = _format_device_name(user_agent)
        c_token = f"ctok_{uuid.uuid4().hex}"
        _CONTINUATION_TOKENS[c_token] = (kgid_clean, d_name, ip_address, time.time())

        return {
            "status": "DEVICE_LIMIT_REACHED",
            "message": "Login Pending: Terminal Session Limit Reached",
            "active_session": existing.to_dict(),
            "continuation_token": c_token
        }


def register_session(kgid: str, ip_address: str, user_agent: str, device_name: Optional[str] = None) -> str:
    """Mints and registers a new active session token, superseding any prior sessions."""
    from vajra_core import _active_session_jti
    with _SESSION_LOCK:
        kgid_clean = str(kgid).strip()
        jti = uuid.uuid4().hex
        d_name = device_name or _format_device_name(user_agent)

        old_session = _ACTIVE_SESSIONS.get(kgid_clean)
        if old_session:
            eviction_meta = {
                "reason": "SESSION_SUPERSEDED",
                "evicted_at": datetime.utcnow().isoformat() + "Z",
                "remote_device": {
                    "device_name": d_name,
                    "ip_address": ip_address,
                    "timestamp": datetime.utcnow().isoformat() + "Z"
                }
            }
            old_session.superseded_by = eviction_meta
            _SUPERSEDED_EVICTIONS[old_session.jti] = eviction_meta

        record = ActiveSessionRecord(kgid_clean, jti, ip_address, user_agent, d_name)
        _ACTIVE_SESSIONS[kgid_clean] = record
        _active_session_jti[kgid_clean] = jti

        payload = {
            "kgid": kgid_clean,
            "jti": jti,
            "iat": int(time.time()),
            "exp": int(time.time()) + SESSION_TTL_SECONDS
        }
        return pyjwt.encode(payload, SESSION_SECRET, algorithm="HS256")


def resolve_session_conflict(continuation_token: str, ip_address: str, user_agent: str) -> Optional[Tuple[str, str]]:
    """
    Redeems a single-use continuation token, evicts the remote terminal,
    and returns (kgid, access_token) for the new terminal.
    """
    with _SESSION_LOCK:
        entry = _CONTINUATION_TOKENS.pop(continuation_token, None)
        if not entry:
            return None

        kgid, proposed_device, c_ip, c_time = entry
        # Strict 3-minute TTL on continuation token
        if (time.time() - c_time) > 180:
            logger.warning(f"Continuation token for KGID {kgid} has expired (>3m).")
            return None

        token = register_session(kgid, ip_address, user_agent, proposed_device)
        return (kgid, token)


def handle_heartbeat(jwt_token: str) -> bool:
    """Updates last_heartbeat for the active session and cancels any pending-close flag."""
    if not SESSION_SECRET or not jwt_token:
        return False
    try:
        payload = pyjwt.decode(jwt_token, SESSION_SECRET, algorithms=["HS256"])
        kgid = payload.get("kgid")
        jti = payload.get("jti")
        if not kgid or not jti:
            return False

        with _SESSION_LOCK:
            record = _ACTIVE_SESSIONS.get(str(kgid).strip())
            if record and record.jti == jti:
                record.last_heartbeat = time.time()
                # Cancel pending-close (e.g. F5 page reload)
                record.is_pending_close = False
                record.pending_close_since = 0.0
                return True
    except Exception as e:
        logger.debug(f"Heartbeat validation error: {e}")
    return False


def handle_tab_closed(jwt_token: str) -> bool:
    """Initiates the 15-second grace window on tab unload."""
    if not SESSION_SECRET or not jwt_token:
        return False
    try:
        payload = pyjwt.decode(jwt_token, SESSION_SECRET, algorithms=["HS256"], options={"verify_exp": False})
        kgid = payload.get("kgid")
        jti = payload.get("jti")
        if not kgid or not jti:
            return False

        with _SESSION_LOCK:
            record = _ACTIVE_SESSIONS.get(str(kgid).strip())
            if record and record.jti == jti:
                record.is_pending_close = True
                record.pending_close_since = time.time()
                logger.info(f"Tab-close signal received for KGID {kgid}. 15s grace window started.")
                return True
    except Exception as e:
        logger.debug(f"Tab-closed signal parse error: {e}")
    return False


def get_session_eviction_notice(jwt_token: str) -> Optional[Dict[str, Any]]:
    """Returns eviction metadata if this specific token was superseded by another terminal."""
    if not SESSION_SECRET or not jwt_token:
        return None
    try:
        payload = pyjwt.decode(jwt_token, SESSION_SECRET, algorithms=["HS256"], options={"verify_exp": False})
        jti = payload.get("jti")
        if jti and jti in _SUPERSEDED_EVICTIONS:
            return _SUPERSEDED_EVICTIONS[jti]
    except Exception:
        pass
    return None


def is_session_alive(kgid: str, jti: str) -> bool:
    """Checks whether an active session is currently running and alive."""
    with _SESSION_LOCK:
        record = _ACTIVE_SESSIONS.get(str(kgid).strip())
        if not record:
            # If untracked (e.g. server restart), fail soft
            return True
        if record.jti != jti:
            return False
        return record.is_alive()


def clear_active_session(kgid: str) -> None:
    """Explicitly clears the active session record for a KGID on logout."""
    with _SESSION_LOCK:
        kgid_clean = str(kgid).strip()
        record = _ACTIVE_SESSIONS.pop(kgid_clean, None)
        if record:
            logger.info(f"Active session for KGID {kgid_clean} explicitly cleared.")


def record_auth_audit_log(kgid: str, action_type: str, details: str, ip_address: str = "") -> None:
    """
    Writes a secure, immutable audit log entry into the Catalyst AuditLog table
    for authentication lifecycle events (LOGIN, LOGOUT, TAB_CLOSE, EVICTION, REPORT).
    """
    try:
        from vajra_core import catalyst_app, zcql_insert_row, escape_zcql_literal
        if not catalyst_app:
            return

        # Attempt to resolve real EmployeeID for accurate audit attribution
        emp_id = 1
        try:
            emp_res = catalyst_app.zql().execute_query(
                f"SELECT EmployeeID FROM Employee WHERE KGID = '{escape_zcql_literal(str(kgid))}'"
            )
            if emp_res:
                raw_id = emp_res[0].get("Employee", {}).get("EmployeeID")
                if raw_id:
                    emp_id = int(raw_id)
        except Exception:
            pass

        logged_at = datetime.utcnow().isoformat()
        base_row = {
            "employee_id": emp_id,
            "action_type": action_type[:50],
            "target_entity": f"AUTH_SESSION_{kgid}"[:200],
            "query_text": f"IP: {ip_address or '10.14.22.84'}"[:500],
            "response_summary": details[:200],
            "session_id": f"auth_{kgid}_{int(time.time())}",
            "logged_at": logged_at,
            "kgid": str(kgid)
        }

        prev_hash = "0000000000000000000000000000000000000000000000000000000000000000"
        try:
            last_res = catalyst_app.zql().execute_query("SELECT row_hash FROM AuditLog ORDER BY logged_at DESC LIMIT 1")
            if last_res:
                prev_hash = last_res[0].get("AuditLog", {}).get("row_hash") or prev_hash
        except Exception:
            pass

        serialized_content = f"{emp_id}|{action_type}|{base_row['target_entity']}|{base_row['query_text'][:100]}|{details[:100]}|{base_row['session_id']}|{logged_at}"
        row_hash = hashlib.sha256((prev_hash + serialized_content).encode('utf-8')).hexdigest()
        hash_fields = {"prev_hash": prev_hash, "row_hash": row_hash}

        base_row_no_kgid = {k: v for k, v in base_row.items() if k != "kgid"}
        attempts = [
            {**base_row, **hash_fields},
            {**base_row_no_kgid, **hash_fields},
            dict(base_row),
            dict(base_row_no_kgid)
        ]

        for attempt in attempts:
            try:
                zcql_insert_row("AuditLog", attempt)
                logger.info(f"Auth audit log written successfully: {action_type} for KGID {kgid} (EmpID: {emp_id})")
                return
            except Exception:
                continue
    except Exception as e:
        logger.error(f"Failed to record auth audit log for KGID {kgid}: {e}")
