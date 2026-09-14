"""
VAJRA Officer Personnel Governance & Access Control Engine
Statutory Compliance: KPA 1963 §23, BNSS 2023 §126, BSA 2023 §63
Implements: Officer Onboarding, Account Blocking, Account Deletion, Session Killswitch, and Self-Service Password Reset
"""

import time
import base64
import json
import logging
import threading
from datetime import datetime
from typing import Dict, Any, List, Optional
from pydantic import BaseModel, Field
from fastapi import APIRouter, Depends, HTTPException, Request, status
import bcrypt

from vajra_core import (
    catalyst_app,
    escape_zcql_literal,
    security_firewall,
    zcql_insert_row,
    zcql_update_row,
    derive_role_tier,
    SUPERVISOR_KGIDS,
)

logger = logging.getLogger("vajra_governance")

# Router instance
router = APIRouter(tags=["Officer Governance"])

# ---------------------------------------------------------------------------
# IN-MEMORY SESSION REVOCATION KILLSWITCH
# ---------------------------------------------------------------------------
_REVOKED_OFFICERS_LOCK = threading.Lock()
_REVOKED_OFFICERS: Dict[str, float] = {}  # kgid -> revoked_timestamp
_PASSWORD_ATTEMPTS: Dict[str, List[float]] = {}  # kgid -> failed attempt timestamps


def revoke_officer_sessions(kgid: str) -> None:
    """Immediately revokes all active sessions for a blocked or deleted officer."""
    with _REVOKED_OFFICERS_LOCK:
        _REVOKED_OFFICERS[str(kgid).strip()] = time.time()
    logger.warning(f"[KILLSWITCH] All active sessions revoked for Officer KGID: {kgid}")


def reinstate_officer_sessions(kgid: str) -> None:
    """Clears revocation status when an officer is unblocked."""
    with _REVOKED_OFFICERS_LOCK:
        _REVOKED_OFFICERS.pop(str(kgid).strip(), None)
    logger.info(f"[KILLSWITCH] Reinstated session validity for Officer KGID: {kgid}")


def is_officer_session_revoked(kgid: str, token_issued_at: Optional[float] = None) -> bool:
    """Checks if an officer's session was revoked."""
    with _REVOKED_OFFICERS_LOCK:
        revoked_at = _REVOKED_OFFICERS.get(str(kgid).strip())
        if revoked_at is None:
            return False
        if token_issued_at is None:
            return True
        return token_issued_at < revoked_at


# ---------------------------------------------------------------------------
# PYDANTIC SCHEMAS
# ---------------------------------------------------------------------------
class CreateOfficerPayload(BaseModel):
    badge_no: str = Field(..., min_length=7, max_length=7, description="7-digit KGID")
    first_name: str = Field(..., min_length=2, max_length=100)
    rank_id: int = Field(..., ge=1, le=10)
    designation_id: int = Field(..., ge=1, le=10)
    unit_id: int = Field(..., ge=1, le=50)
    phone_number: Optional[str] = Field(None, max_length=15)
    email: Optional[str] = Field(None, max_length=100)
    initial_password: str = Field(..., min_length=6, max_length=64)


class BlockOfficerPayload(BaseModel):
    reason: str = Field(..., min_length=5, max_length=255, description="Statutory reason for account suspension")
    notes: Optional[str] = Field(None, max_length=500)


class DeleteOfficerPayload(BaseModel):
    reason: str = Field(..., min_length=5, max_length=255, description="Statutory reason for account deletion")


class ChangePasswordPayload(BaseModel):
    old_password: str = Field(..., min_length=1, description="Current officer password")
    new_password: str = Field(..., min_length=6, max_length=64)
    confirm_new_password: str = Field(..., min_length=6, max_length=64)


class AssignStationPayload(BaseModel):
    unit_id: int = Field(..., ge=1, le=100, description="Target Police Station / Unit ID")
    reason: Optional[str] = Field(default="Administrative Station Transfer under KPA 1963", max_length=255)


# ---------------------------------------------------------------------------
# HELPER: PARSE PASSWORD HASH FOR BLOCK METADATA
# ---------------------------------------------------------------------------
def parse_credential_status(raw_hash: str) -> Dict[str, Any]:
    """
    Inspects stored PasswordHash to detect $BLOCKED: or $FIRST_LOGIN: packaging.
    Format 1: $FIRST_LOGIN:{clean_hash}
    Format 2: $BLOCKED:{b64_json}:{clean_hash}
    Format 3: $BLOCKED:{b64_json}:$FIRST_LOGIN:{clean_hash}
    """
    if not raw_hash:
        return {"is_blocked": False, "is_first_login": False, "clean_hash": ""}

    is_blocked = False
    is_first_login = False
    blocked_by_kgid = ""
    blocked_by_name = "Supervisor"
    blocked_at = ""
    reason = "Administrative Suspension under KPA 1963 §23"
    clean_hash = raw_hash

    if raw_hash.startswith("$BLOCKED:"):
        is_blocked = True
        try:
            rest = raw_hash[len("$BLOCKED:"):]
            if ":" in rest and not rest.startswith("{"):
                # Format: $BLOCKED:{b64_meta}:{clean_hash}
                meta_str, clean_hash = rest.split(":", 1)
            elif "$" in rest:
                # Format: $BLOCKED:{b64_meta}${clean_hash}
                idx = rest.find("$2")
                if idx != -1:
                    meta_str = rest[:idx].rstrip("$")
                    clean_hash = rest[idx:]
                else:
                    parts = rest.split("$", 1)
                    meta_str = parts[0]
                    clean_hash = parts[1] if len(parts) > 1 else ""
            else:
                meta_str = rest
                clean_hash = ""

            # Check if base64 json
            if "{" in meta_str or not ":" in meta_str:
                try:
                    meta = json.loads(base64.urlsafe_b64decode(meta_str.encode("ascii")).decode("utf-8"))
                    blocked_by_kgid = meta.get("supervisor_kgid", "")
                    blocked_by_name = meta.get("supervisor_name", "Supervisor")
                    blocked_at = meta.get("blocked_at", "")
                    reason = meta.get("reason", "Administrative Suspension under KPA 1963 §23")
                except Exception:
                    pass
            else:
                subparts = meta_str.split(":", 3)
                blocked_by_kgid = subparts[0] if len(subparts) > 0 else "SUPERVISOR"
                blocked_by_name = subparts[1] if len(subparts) > 1 else "Supervisor"
                blocked_at = subparts[2] if len(subparts) > 2 else ""
                reason = subparts[3] if len(subparts) > 3 else "Administrative Suspension under KPA 1963 §23"
        except Exception as e:
            logger.warning(f"Failed to parse $BLOCKED metadata: {e}")
            clean_hash = raw_hash

    if clean_hash.startswith("$FIRST_LOGIN:"):
        is_first_login = True
        clean_hash = clean_hash[len("$FIRST_LOGIN:"):]

    clean_raw = clean_hash.lstrip("$")
    clean_hash = f"${clean_raw}" if clean_raw else ""

    return {
        "is_blocked": is_blocked,
        "is_first_login": is_first_login,
        "clean_hash": clean_hash,
        "blocked_by_kgid": blocked_by_kgid,
        "blocked_by_name": blocked_by_name,
        "blocked_at": blocked_at,
        "reason": reason
    }


# ---------------------------------------------------------------------------
# ENDPOINT 1: LIST GOVERNED OFFICERS (Supervisor Only)
# ---------------------------------------------------------------------------
@router.get("/api/supervisor/officers")
@router.get("/api/governance/officers")
async def list_governed_officers(
    request: Request,
    location_context: str = Depends(security_firewall)
):
    """Fetches the complete officer roster with active/blocked statuses."""
    role_tier = getattr(request.state, "role_tier", "officer")
    kgid_caller = getattr(request.state, "kgid", "")
    if role_tier != "supervisor" and kgid_caller not in SUPERVISOR_KGIDS:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Security Access Violation: Officer management requires Supervisor-tier clearance."
        )

    if not catalyst_app:
        raise HTTPException(status_code=500, detail="Database client offline.")

    try:
        # Fetch employees
        emp_rows = catalyst_app.zql().execute_query(
            "SELECT ROWID, KGID, FirstName, RankID, DesignationID, UnitID, Email FROM Employee ORDER BY RankID DESC LIMIT 100"
        )
        # Fetch credentials
        cred_rows = catalyst_app.zql().execute_query(
            "SELECT KGID, PasswordHash FROM OfficerCredentials LIMIT 100"
        )

        # Build credential lookup with block metadata
        cred_map: Dict[str, Dict[str, Any]] = {}
        for r in cred_rows:
            c = r.get("OfficerCredentials", {})
            kgid = str(c.get("KGID", "")).strip()
            if kgid:
                raw_hash = c.get("PasswordHash", "")
                parsed = parse_credential_status(raw_hash)
                cred_map[kgid] = parsed

        # Reference tables lookup
        ranks_res = catalyst_app.zql().execute_query("SELECT RankID, RankName FROM Rank")
        rank_names = {int(r.get("Rank", {}).get("RankID")): r.get("Rank", {}).get("RankName") for r in ranks_res if r.get("Rank", {}).get("RankID") is not None}

        desig_res = catalyst_app.zql().execute_query("SELECT DesignationID, DesignationName FROM Designation")
        desig_names = {int(d.get("Designation", {}).get("DesignationID")): d.get("Designation", {}).get("DesignationName") for d in desig_res if d.get("Designation", {}).get("DesignationID") is not None}

        unit_res = catalyst_app.zql().execute_query("SELECT UnitID, UnitName FROM Unit")
        unit_names = {int(u.get("Unit", {}).get("UnitID")): u.get("Unit", {}).get("UnitName") for u in unit_res if u.get("Unit", {}).get("UnitID") is not None}

        roster = []
        for r in emp_rows:
            emp = r.get("Employee", {})
            kgid = str(emp.get("KGID", "")).strip()
            cred = cred_map.get(kgid)

            is_blocked = cred.get("is_blocked", False) if cred else False
            has_credentials = cred is not None

            unit_id_val = emp.get("UnitID") or emp.get("PoliceUnitID") or 1
            roster.append({
                "rowid": emp.get("ROWID"),
                "kgid": kgid,
                "name": emp.get("FirstName"),
                "rank_id": emp.get("RankID"),
                "rank_name": rank_names.get(int(emp.get("RankID") or 0), f"Rank {emp.get('RankID')}"),
                "designation_id": emp.get("DesignationID"),
                "designation_name": desig_names.get(int(emp.get("DesignationID") or 0), f"Desig {emp.get('DesignationID')}"),
                "unit_id": unit_id_val,
                "unit_name": unit_names.get(int(unit_id_val or 0), f"Unit {unit_id_val}"),
                "phone_number": emp.get("PhoneNumber"),
                "email": emp.get("Email"),
                "status": "blocked" if is_blocked else ("active" if has_credentials else "unprovisioned"),
                "blocked_details": {
                    "blocked_by_kgid": cred.get("blocked_by_kgid"),
                    "blocked_by_name": cred.get("blocked_by_name"),
                    "blocked_at": cred.get("blocked_at"),
                    "reason": cred.get("reason"),
                } if is_blocked else None
            })

        return {"officers": roster, "total": len(roster)}

    except Exception as e:
        logger.error(f"Error fetching officer roster: {e}")
        raise HTTPException(status_code=500, detail=f"Database query error: {str(e)}")


# ---------------------------------------------------------------------------
# ENDPOINT 2: ONBOARD NEW OFFICER (Supervisor Only)
# ---------------------------------------------------------------------------
@router.post("/api/supervisor/officers/create", status_code=status.HTTP_201_CREATED)
@router.post("/api/governance/officers", status_code=status.HTTP_201_CREATED)
async def create_officer_account(
    payload: CreateOfficerPayload,
    request: Request,
    location_context: str = Depends(security_firewall)
):
    """Creates a new officer record in Employee and initializes credentials."""
    role_tier = getattr(request.state, "role_tier", "officer")
    kgid_caller = getattr(request.state, "kgid", "")
    if role_tier != "supervisor" and kgid_caller not in SUPERVISOR_KGIDS:
        raise HTTPException(status_code=403, detail="Supervisor-tier clearance required.")

    if not payload.badge_no.isdigit() or len(payload.badge_no) != 7:
        raise HTTPException(status_code=400, detail="Badge Number must be exactly 7 numeric digits.")

    if not catalyst_app:
        raise HTTPException(status_code=500, detail="Database client offline.")

    # Check for duplicate KGID
    clean_badge = escape_zcql_literal(payload.badge_no.strip())
    existing = catalyst_app.zql().execute_query(
        f"SELECT KGID FROM Employee WHERE KGID = '{clean_badge}'"
    )
    if existing:
        raise HTTPException(status_code=409, detail=f"Officer with Badge KGID {payload.badge_no} already exists.")

    # Bcrypt hash password
    pw_bytes = payload.initial_password.encode("utf-8")
    hashed_pw = bcrypt.hashpw(pw_bytes, bcrypt.gensalt(12)).decode("utf-8")

    # Resolve DistrictID from Unit
    district_id = 1
    try:
        unit_q = catalyst_app.zql().execute_query(f"SELECT DistrictID FROM Unit WHERE UnitID = {payload.unit_id}")
        if unit_q:
            district_id = int(unit_q[0].get("Unit", {}).get("DistrictID") or 1)
    except Exception:
        pass

    # Compute next EmployeeID
    next_emp_id = 100
    try:
        emp_ids_res = catalyst_app.zql().execute_query("SELECT EmployeeID FROM Employee")
        ids = [int(r.get("Employee", {}).get("EmployeeID")) for r in emp_ids_res if r.get("Employee", {}).get("EmployeeID") and str(r.get("Employee", {}).get("EmployeeID")).isdigit()]
        if ids:
            next_emp_id = max(ids) + 1
    except Exception:
        pass

    # Insert into Employee table matching live ZCQL schema
    employee_row = {
        "KGID": payload.badge_no.strip(),
        "FirstName": payload.first_name.strip()[:100],
        "RankID": payload.rank_id,
        "DesignationID": payload.designation_id,
        "UnitID": payload.unit_id,
        "DistrictID": district_id,
        "EmployeeID": next_emp_id,
        "Email": (payload.email or f"{payload.badge_no}@vajra.ksp.gov.in")[:100]
    }
    zcql_insert_row("Employee", employee_row)

    # Insert into OfficerCredentials table with mandatory $FIRST_LOGIN: requirement
    cred_row = {
        "KGID": payload.badge_no.strip(),
        "PasswordHash": f"$FIRST_LOGIN:{hashed_pw}"
    }
    zcql_insert_row("OfficerCredentials", cred_row)

    # Immutable Hash-Chained Audit Log
    try:
        from main import agent_loop
        supervisor_badge = getattr(request.state, "kgid", "SUPERVISOR")
        supervisor_profile = getattr(request.state, "user_profile", {}) or {}
        supervisor_name = supervisor_profile.get("FirstName", f"Supervisor {supervisor_badge}")

        agent_loop._write_audit_log(
            employee_id=int(payload.badge_no),
            action_type="OFFICER_CREATED",
            target=f"Officer {payload.badge_no} ({payload.first_name})",
            query=f"Onboarded by Supervisor {supervisor_name} (KGID: {supervisor_badge}). RankID: {payload.rank_id}, UnitID: {payload.unit_id}",
            response="SUCCESS - Employee and OfficerCredentials provisioned with SHA-256 ledger chaining",
            session_id=f"admin-create-{int(time.time())}"
        )
    except Exception as e:
        logger.warning(f"Audit log write failed during officer creation: {e}")

    return {
        "success": True,
        "message": f"Officer {payload.first_name} (KGID: {payload.badge_no}) provisioned successfully.",
        "badge_no": payload.badge_no
    }


# ---------------------------------------------------------------------------
# ENDPOINT 3: BLOCK OFFICER ACCOUNT (Supervisor Only)
# ---------------------------------------------------------------------------
@router.post("/api/supervisor/officers/{badge}/block")
@router.post("/api/governance/officers/{badge}/block")
async def block_officer_account(
    badge: str,
    payload: BlockOfficerPayload,
    request: Request,
    location_context: str = Depends(security_firewall)
):
    """Suspends an officer's account, terminates sessions, and records supervisor attribution."""
    role_tier = getattr(request.state, "role_tier", "officer")
    supervisor_kgid = str(getattr(request.state, "kgid", "")).strip()
    if role_tier != "supervisor" and supervisor_kgid not in SUPERVISOR_KGIDS:
        raise HTTPException(status_code=403, detail="Supervisor-tier clearance required.")

    target_kgid = str(badge).strip()

    # Loophole 2 Mitigation: Anti-Self-Lockout
    if supervisor_kgid == target_kgid:
        raise HTTPException(
            status_code=400,
            detail="Administrative Safeguard: You cannot block your own supervisor account."
        )

    clean_target = escape_zcql_literal(target_kgid)

    # Check target rank hierarchy
    target_res = catalyst_app.zql().execute_query(
        f"SELECT RankID, FirstName FROM Employee WHERE KGID = '{clean_target}'"
    )
    if not target_res:
        raise HTTPException(status_code=404, detail=f"Officer with badge {badge} not found.")

    target_emp = target_res[0].get("Employee", {})
    target_rank = int(target_emp.get("RankID") or 1)
    target_name = target_emp.get("FirstName", f"Officer {badge}")

    # DGP is untouchable
    if target_rank >= 10:
        raise HTTPException(
            status_code=403,
            detail="Hierarchical Safeguard: Director General of Police (DGP) cannot be suspended via dashboard."
        )

    # Resolve supervisor rank
    sup_res = catalyst_app.zql().execute_query(
        f"SELECT RankID, FirstName FROM Employee WHERE KGID = '{escape_zcql_literal(supervisor_kgid)}'"
    )
    sup_rank = 10 if supervisor_kgid in SUPERVISOR_KGIDS else 6
    sup_name = f"Supervisor {supervisor_kgid}"
    if sup_res:
        sup_emp = sup_res[0].get("Employee", {})
        sup_rank = int(sup_emp.get("RankID") or sup_rank)
        sup_name = sup_emp.get("FirstName", sup_name)

    if target_rank >= sup_rank and supervisor_kgid not in SUPERVISOR_KGIDS:
        raise HTTPException(
            status_code=403,
            detail=f"Hierarchical Violation: Rank level {sup_rank} cannot suspend senior/equal rank level {target_rank}."
        )

    # Query existing credential row
    cred_res = catalyst_app.zql().execute_query(
        f"SELECT ROWID, KGID, PasswordHash FROM OfficerCredentials WHERE KGID = '{clean_target}'"
    )
    if not cred_res:
        raise HTTPException(status_code=404, detail=f"No credential record found for officer {badge}.")

    cred_row = cred_res[0].get("OfficerCredentials", {})
    cred_rowid = cred_row.get("ROWID")
    raw_hash = cred_row.get("PasswordHash", "")

    parsed = parse_credential_status(raw_hash)
    clean_bcrypt = parsed.get("clean_hash", raw_hash).lstrip("$")
    if clean_bcrypt:
        clean_bcrypt = "$" + clean_bcrypt
    blocked_at = datetime.utcnow().isoformat()

    # Base64 package block metadata
    meta_dict = {
        "supervisor_kgid": supervisor_kgid,
        "supervisor_name": sup_name,
        "blocked_at": blocked_at,
        "reason": payload.reason
    }
    b64_meta = base64.urlsafe_b64encode(json.dumps(meta_dict).encode("utf-8")).decode("ascii")
    packaged_hash = f"$BLOCKED:{b64_meta}:{clean_bcrypt}"

    zcql_update_row("OfficerCredentials", {
        "ROWID": cred_rowid,
        "PasswordHash": packaged_hash
    })

    # Trigger Instant Session Killswitch
    revoke_officer_sessions(target_kgid)

    # Log to Tamper-Evident Hash Chain
    try:
        from main import agent_loop
        agent_loop._write_audit_log(
            employee_id=int(target_kgid),
            action_type="OFFICER_BLOCKED",
            target=f"Officer {target_kgid} ({target_name})",
            query=f"Account Suspended by {sup_name} (KGID: {supervisor_kgid}). Reason: {payload.reason}",
            response=f"ACCESS_REVOKED at {blocked_at} - Sessions terminated via Killswitch",
            session_id=f"admin-block-{int(time.time())}"
        )
    except Exception as e:
        logger.warning(f"Audit write failed during officer block: {e}")

    return {
        "success": True,
        "message": f"Officer {target_name} ({target_kgid}) has been blocked. Active sessions terminated.",
        "badge_no": target_kgid,
        "blocked_at": blocked_at
    }


# ---------------------------------------------------------------------------
# ENDPOINT 4: UNBLOCK OFFICER ACCOUNT (Supervisor Only)
# ---------------------------------------------------------------------------
@router.post("/api/supervisor/officers/{badge}/unblock")
@router.post("/api/governance/officers/{badge}/unblock")
async def unblock_officer_account(
    badge: str,
    request: Request,
    location_context: str = Depends(security_firewall)
):
    """Reinstates a suspended officer's login privileges."""
    role_tier = getattr(request.state, "role_tier", "officer")
    supervisor_kgid = str(getattr(request.state, "kgid", "")).strip()
    if role_tier != "supervisor" and supervisor_kgid not in SUPERVISOR_KGIDS:
        raise HTTPException(status_code=403, detail="Supervisor-tier clearance required.")

    clean_target = escape_zcql_literal(str(badge).strip())
    cred_res = catalyst_app.zql().execute_query(
        f"SELECT ROWID, KGID, PasswordHash FROM OfficerCredentials WHERE KGID = '{clean_target}'"
    )
    if not cred_res:
        raise HTTPException(status_code=404, detail=f"No credential record found for badge {badge}.")

    cred_row = cred_res[0].get("OfficerCredentials", {})
    cred_rowid = cred_row.get("ROWID")
    raw_hash = cred_row.get("PasswordHash", "")

    parsed = parse_credential_status(raw_hash)
    clean_bcrypt = parsed.get("clean_hash", raw_hash).lstrip("$")
    if clean_bcrypt:
        clean_bcrypt = "$" + clean_bcrypt

    # Restore clean bcrypt hash
    zcql_update_row("OfficerCredentials", {
        "ROWID": cred_rowid,
        "PasswordHash": clean_bcrypt
    })

    reinstate_officer_sessions(str(badge).strip())

    # Audit log reinstatement
    try:
        from main import agent_loop
        agent_loop._write_audit_log(
            employee_id=int(badge),
            action_type="OFFICER_UNBLOCKED",
            target=f"Officer {badge}",
            query=f"Account access reinstated by Supervisor {supervisor_kgid}",
            response="ACCESS_RESTORED - Hash-chained audit verified",
            session_id=f"admin-unblock-{int(time.time())}"
        )
    except Exception as e:
        logger.warning(f"Audit log failed during unblock: {e}")

    return {"success": True, "message": f"Officer {badge} access has been reinstated."}


# ---------------------------------------------------------------------------
# ENDPOINT 5: DELETE OFFICER ACCOUNT (Supervisor Only)
# ---------------------------------------------------------------------------
@router.delete("/api/supervisor/officers/{badge}")
@router.delete("/api/governance/officers/{badge}")
async def delete_officer_account(
    badge: str,
    payload: DeleteOfficerPayload,
    request: Request,
    location_context: str = Depends(security_firewall)
):
    """Permanently purges an officer's credentials and employee record while preserving audit logs."""
    role_tier = getattr(request.state, "role_tier", "officer")
    supervisor_kgid = str(getattr(request.state, "kgid", "")).strip()
    if role_tier != "supervisor" and supervisor_kgid not in SUPERVISOR_KGIDS:
        raise HTTPException(status_code=403, detail="Supervisor-tier clearance required.")

    target_kgid = str(badge).strip()

    # Anti-Self-Deletion Safeguard
    if supervisor_kgid == target_kgid:
        raise HTTPException(
            status_code=400,
            detail="Administrative Safeguard: You cannot delete your own supervisor account."
        )

    clean_target = escape_zcql_literal(target_kgid)

    # Resolve target rank & name
    target_res = catalyst_app.zql().execute_query(
        f"SELECT RankID, FirstName FROM Employee WHERE KGID = '{clean_target}'"
    )
    if not target_res:
        raise HTTPException(status_code=404, detail=f"Officer with badge {badge} not found in Employee directory.")

    target_emp = target_res[0].get("Employee", {})
    target_rank = int(target_emp.get("RankID") or 1)
    target_name = target_emp.get("FirstName", f"Officer {badge}")

    # DGP cannot be deleted
    if target_rank >= 10:
        raise HTTPException(
            status_code=403,
            detail="Hierarchical Safeguard: Director General of Police (DGP) cannot be deleted."
        )

    # Check supervisor hierarchy
    sup_res = catalyst_app.zql().execute_query(
        f"SELECT RankID, FirstName FROM Employee WHERE KGID = '{escape_zcql_literal(supervisor_kgid)}'"
    )
    sup_rank = 10 if supervisor_kgid in SUPERVISOR_KGIDS else 6
    sup_name = f"Supervisor {supervisor_kgid}"
    if sup_res:
        sup_emp = sup_res[0].get("Employee", {})
        sup_rank = int(sup_emp.get("RankID") or sup_rank)
        sup_name = sup_emp.get("FirstName", sup_name)

    if target_rank >= sup_rank and supervisor_kgid not in SUPERVISOR_KGIDS:
        raise HTTPException(
            status_code=403,
            detail=f"Hierarchical Violation: Rank level {sup_rank} cannot delete senior/equal rank level {target_rank}."
        )

    # 1. Purge from OfficerCredentials
    try:
        catalyst_app.zql().execute_query(
            f"DELETE FROM OfficerCredentials WHERE KGID = '{clean_target}'"
        )
    except Exception as e:
        logger.warning(f"Deletion from OfficerCredentials error: {e}")

    # 2. Purge from Employee
    catalyst_app.zql().execute_query(
        f"DELETE FROM Employee WHERE KGID = '{clean_target}'"
    )

    # 3. Kill any zombie sessions
    revoke_officer_sessions(target_kgid)

    # 4. Permanent Immutable Audit Log
    try:
        from main import agent_loop
        agent_loop._write_audit_log(
            employee_id=int(target_kgid),
            action_type="OFFICER_DELETED",
            target=f"Officer {target_kgid} ({target_name})",
            query=f"Account permanently purged by {sup_name} (KGID: {supervisor_kgid}). Reason: {payload.reason}",
            response="ACCOUNT_DELETED - Credentials and Employee records removed; Audit trail preserved under BSA §63",
            session_id=f"admin-delete-{int(time.time())}"
        )
    except Exception as e:
        logger.error(f"Audit write failed during officer deletion: {e}")

    return {
        "success": True,
        "message": f"Officer {target_name} ({target_kgid}) has been permanently deleted from the directory.",
        "badge_no": target_kgid
    }


# ---------------------------------------------------------------------------
# ENDPOINT 6: OFFICER SELF-SERVICE PASSWORD RESET
# ---------------------------------------------------------------------------
@router.post("/api/auth/change-password")
@router.post("/api/auth/reset-password")
async def change_password(
    payload: ChangePasswordPayload,
    request: Request,
    location_context: str = Depends(security_firewall)
):
    """Allows an authenticated officer to securely reset their password via Pop-up Modal."""
    caller_kgid = str(getattr(request.state, "kgid", "")).strip()
    if not caller_kgid:
        raise HTTPException(status_code=401, detail="Session identification error.")

    # Confirm matching new passwords
    if payload.new_password != payload.confirm_new_password:
        raise HTTPException(status_code=400, detail="New password and Confirm password do not match.")

    # Rate-limit failed old password attempts
    now = time.time()
    attempts = _PASSWORD_ATTEMPTS.setdefault(caller_kgid, [])
    recent_attempts = [t for t in attempts if now - t < 900]
    _PASSWORD_ATTEMPTS[caller_kgid] = recent_attempts

    if len(recent_attempts) >= 3:
        raise HTTPException(
            status_code=429,
            detail="Security Lockout: Too many failed password change attempts. Try again in 15 minutes."
        )

    if not catalyst_app:
        raise HTTPException(status_code=500, detail="Database offline.")

    clean_kgid = escape_zcql_literal(caller_kgid)
    cred_res = catalyst_app.zql().execute_query(
        f"SELECT ROWID, KGID, PasswordHash FROM OfficerCredentials WHERE KGID = '{clean_kgid}'"
    )
    if not cred_res:
        raise HTTPException(status_code=404, detail="Credentials record not found.")

    cred = cred_res[0].get("OfficerCredentials", {})
    cred_rowid = cred.get("ROWID")
    raw_hash = cred.get("PasswordHash", "")

    parsed = parse_credential_status(raw_hash)
    if parsed.get("is_blocked"):
        raise HTTPException(
            status_code=403,
            detail="Account Suspended: Cannot change password on a suspended account."
        )

    stored_bcrypt = parsed.get("clean_hash", raw_hash)

    # Verify old password
    if not stored_bcrypt or not bcrypt.checkpw(payload.old_password.encode("utf-8"), stored_bcrypt.encode("utf-8")):
        recent_attempts.append(now)
        _PASSWORD_ATTEMPTS[caller_kgid] = recent_attempts
        raise HTTPException(status_code=401, detail="Old password verification failed. Please verify and retry.")

    # Clear failed attempts on success
    _PASSWORD_ATTEMPTS.pop(caller_kgid, None)

    # Validate new password complexity
    new_pw = payload.new_password.strip()
    if len(new_pw) < 6:
        raise HTTPException(status_code=400, detail="New password must be at least 6 characters long.")
    if payload.old_password.strip() == new_pw:
        raise HTTPException(status_code=400, detail="New password cannot be identical to your old password.")

    # Compute new hash
    new_hash = bcrypt.hashpw(new_pw.encode("utf-8"), bcrypt.gensalt(12)).decode("utf-8")

    # Atomic Update
    zcql_update_row("OfficerCredentials", {
        "ROWID": cred_rowid,
        "PasswordHash": new_hash
    })

    # Record in Immutable SHA-256 Audit Ledger
    try:
        from main import agent_loop
        profile = getattr(request.state, "user_profile", {}) or {}
        officer_name = profile.get("FirstName", f"Officer {caller_kgid}")

        agent_loop._write_audit_log(
            employee_id=int(caller_kgid),
            action_type="PASSWORD_RESET",
            target=f"Officer {caller_kgid} ({officer_name})",
            query="Self-service password update from Account Settings Modal",
            response="SUCCESS - Bcrypt hash updated with work factor 12 (SHA-256 chained)",
            session_id=f"pwd-reset-{int(time.time())}"
        )
    except Exception as e:
        logger.error(f"Failed to record PASSWORD_RESET in AuditLog: {e}")

    return {
        "success": True,
        "message": "Password updated successfully. Please use your new password for subsequent logins."
    }


# ---------------------------------------------------------------------------
# ENDPOINT 7: LIST POLICE STATIONS (For Onboarding & Station Assignment)
# ---------------------------------------------------------------------------
FALLBACK_POLICE_STATIONS = [
    {"unit_id": 21, "name": "Amengad PS", "district_id": 21},
    {"unit_id": 22, "name": "Badami PS", "district_id": 22},
    {"unit_id": 29, "name": "Bagalkot Town PS", "district_id": 29},
    {"unit_id": 15, "name": "Banashankari PS", "district_id": 15},
    {"unit_id": 9, "name": "Basavanagudi PS", "district_id": 9},
    {"unit_id": 23, "name": "Bilgi PS", "district_id": 23},
    {"unit_id": 1, "name": "Cubbon Park PS", "district_id": 1},
    {"unit_id": 13, "name": "Electronic City PS", "district_id": 13},
    {"unit_id": 24, "name": "Guledgudda PS", "district_id": 24},
    {"unit_id": 18, "name": "Hebbal PS", "district_id": 18},
    {"unit_id": 6, "name": "HSR Layout PS", "district_id": 6},
    {"unit_id": 25, "name": "Hunagund PS", "district_id": 25},
    {"unit_id": 30, "name": "Ilkal PS", "district_id": 30},
    {"unit_id": 2, "name": "Indiranagar PS", "district_id": 2},
    {"unit_id": 26, "name": "Jamkhandi PS", "district_id": 26},
    {"unit_id": 5, "name": "Jayanagar PS", "district_id": 5},
    {"unit_id": 3, "name": "Koramangala PS", "district_id": 3},
    {"unit_id": 17, "name": "KR Puram PS", "district_id": 17},
    {"unit_id": 10, "name": "Malleswaram PS", "district_id": 10},
    {"unit_id": 7, "name": "Marathahalli PS", "district_id": 7},
    {"unit_id": 27, "name": "Mudhol PS", "district_id": 27},
    {"unit_id": 12, "name": "Peenya PS", "district_id": 12},
    {"unit_id": 28, "name": "Rabakavi PS", "district_id": 28},
    {"unit_id": 8, "name": "Rajajinagar PS", "district_id": 8},
    {"unit_id": 19, "name": "RT Nagar PS", "district_id": 19},
    {"unit_id": 20, "name": "Sadashivanagar PS", "district_id": 20},
    {"unit_id": 4, "name": "Whitefield PS", "district_id": 4},
    {"unit_id": 14, "name": "Yelahanka PS", "district_id": 14},
    {"unit_id": 11, "name": "Yeshwantpur PS", "district_id": 11},
    {"unit_id": 16, "name": "Vijayanagar PS", "district_id": 16}
]


@router.get("/api/supervisor/police-stations")
@router.get("/api/governance/police-stations")
async def list_police_stations(
    request: Request,
    location_context: str = Depends(security_firewall)
):
    """Returns all available Police Stations for onboarding and station transfers."""
    stations = []
    if catalyst_app:
        try:
            rows = catalyst_app.zql().execute_query("SELECT UnitID, UnitName, DistrictID FROM Unit")
            for r in rows:
                u = r.get("Unit", {})
                uid = u.get("UnitID")
                uname = u.get("UnitName")
                did = u.get("DistrictID")
                if uid and uname:
                    stations.append({
                        "unit_id": int(uid),
                        "name": str(uname).strip(),
                        "district_id": int(did) if did else int(uid)
                    })
        except Exception as e:
            logger.warning(f"Error querying Unit table for police stations: {e}")

    if not stations:
        stations = list(FALLBACK_POLICE_STATIONS)

    stations.sort(key=lambda s: s["name"])
    return {"police_stations": stations, "total": len(stations)}


# ---------------------------------------------------------------------------
# ENDPOINT 8: ASSIGN / REASSIGN OFFICER POLICE STATION (Supervisor Only)
# ---------------------------------------------------------------------------
@router.post("/api/supervisor/officers/{badge}/assign-station")
@router.post("/api/governance/officers/{badge}/assign-station")
async def assign_officer_station(
    badge: str,
    payload: AssignStationPayload,
    request: Request,
    location_context: str = Depends(security_firewall)
):
    """Reassigns an officer to a specific Police Station with audit logging."""
    role_tier = getattr(request.state, "role_tier", "officer")
    supervisor_kgid = str(getattr(request.state, "kgid", "")).strip()
    if role_tier != "supervisor" and supervisor_kgid not in SUPERVISOR_KGIDS:
        raise HTTPException(status_code=403, detail="Supervisor-tier clearance required.")

    if not catalyst_app:
        raise HTTPException(status_code=500, detail="Database client offline.")

    clean_badge = escape_zcql_literal(badge.strip())
    emp_res = catalyst_app.zql().execute_query(
        f"SELECT ROWID, FirstName, UnitID FROM Employee WHERE KGID = '{clean_badge}'"
    )
    if not emp_res:
        raise HTTPException(status_code=404, detail=f"Officer with badge {badge} not found in Employee directory.")

    emp_row = emp_res[0].get("Employee", {})
    emp_rowid = emp_row.get("ROWID")
    officer_name = emp_row.get("FirstName", f"Officer {badge}")
    old_unit_id = emp_row.get("UnitID")

    # Resolve Unit Name and DistrictID
    new_unit_name = f"Police Station #{payload.unit_id}"
    district_id = payload.unit_id
    try:
        unit_res = catalyst_app.zql().execute_query(
            f"SELECT UnitName, DistrictID FROM Unit WHERE UnitID = {payload.unit_id}"
        )
        if unit_res:
            unit_data = unit_res[0].get("Unit", {})
            new_unit_name = unit_data.get("UnitName", new_unit_name)
            district_id = int(unit_data.get("DistrictID") or payload.unit_id)
    except Exception as e:
        logger.warning(f"Could not resolve Unit {payload.unit_id}: {e}")

    # Update Employee
    update_data = {
        "ROWID": emp_rowid,
        "UnitID": payload.unit_id,
        "DistrictID": district_id
    }
    zcql_update_row("Employee", update_data)

    # Immutable Audit Log
    try:
        from main import agent_loop
        agent_loop._write_audit_log(
            employee_id=int(badge) if badge.isdigit() else 0,
            action_type="OFFICER_STATION_TRANSFERRED",
            target=f"Officer {badge} ({officer_name})",
            query=f"Police Station reassigned from Unit {old_unit_id} to {new_unit_name} (UnitID {payload.unit_id}) by Supervisor {supervisor_kgid}. Reason: {payload.reason}",
            response="STATION_REASSIGNED - Verified in Employee directory",
            session_id=f"admin-transfer-{int(time.time())}"
        )
    except Exception as e:
        logger.warning(f"Audit log write failed during station transfer: {e}")

    return {
        "success": True,
        "message": f"Officer {officer_name} successfully assigned to {new_unit_name}.",
        "badge_no": badge,
        "unit_id": payload.unit_id,
        "unit_name": new_unit_name
    }
