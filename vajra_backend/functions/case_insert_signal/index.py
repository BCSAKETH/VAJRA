"""
§5.3/C.21 (VAJRA plan): thin Catalyst Signal handler for "a new CaseMaster
row was inserted." Deliberately does NOT contain the actual matching logic
-- that lives once, in the main app (main.py's /api/internal/case-inserted,
reusing the exact same MOBehavioralProfiler/get_mo_profile code path a
manual officer ask already uses), so the automatic check and the manual one
can never drift apart on what counts as a serial pattern. This file's only
job is: notice the event fired, extract the new row's CaseMasterID, call
that one real endpoint.

HONEST, UNVERIFIED ASSUMPTION -- read before deploying:
This project has no existing, deployed example of a genuine Catalyst DB
Signal anywhere in its codebase to copy from (the one "type": "event"
function that existed before this, ai_turn_worker, is itself documented as
a stale, never-deployed prototype). The payload-shape handling below is
written defensively against several PLAUSIBLE shapes a Catalyst Signal
might deliver a changed row in, based on how Catalyst's other event-style
payloads look elsewhere in this project -- but it has NOT been confirmed
against a real, live-firing Signal. If this doesn't fire as expected once
wired up in the Console, log the raw `event` payload it actually receives
and adjust `_extract_case_master_id` below to match -- don't assume the
shape guessed here is correct without checking.

Also requires a real Catalyst Console step this file cannot perform itself
(same category as the OSINT radar's cron schedule and Zoho OAuth rotation):
1. Create a Signal in the Catalyst Console watching CaseMaster for INSERT.
2. Point it at this deployed function.
3. Set this function's environment variables (Functions > case_insert_signal
   > Environment Variables): VAJRA_APP_BASE_URL (the deployed AppSail app's
   own base URL) and INTERNAL_SIGNAL_SECRET (must match the SAME value set
   on the main app's own INTERNAL_SIGNAL_SECRET env var -- this is the
   shared secret the two sides use to trust each other).
"""
import os
import json
import logging
import requests

logger = logging.getLogger()
logger.setLevel(logging.INFO)

VAJRA_APP_BASE_URL = os.getenv("VAJRA_APP_BASE_URL", "")
INTERNAL_SIGNAL_SECRET = os.getenv("INTERNAL_SIGNAL_SECRET", "")


def _extract_case_master_id(event: dict):
    """Tries several plausible shapes for where a Catalyst Signal's changed-
    row data might live -- see the module docstring's honesty note. Returns
    None (never raises) if none of them match, so the caller can log the
    real shape instead of crashing on a guess that turned out wrong."""
    candidates = [
        event.get("CaseMasterID"),
        (event.get("data") or {}).get("CaseMasterID") if isinstance(event.get("data"), dict) else None,
        (event.get("row") or {}).get("CaseMasterID") if isinstance(event.get("row"), dict) else None,
        ((event.get("data") or {}).get("CaseMaster") or {}).get("CaseMasterID")
            if isinstance(event.get("data"), dict) and isinstance(event["data"].get("CaseMaster"), dict) else None,
    ]
    # Some Signal payloads deliver an array of changed rows rather than one.
    rows = event.get("rows") or event.get("records")
    if isinstance(rows, list) and rows:
        first = rows[0]
        if isinstance(first, dict):
            candidates.append(first.get("CaseMasterID"))
            if isinstance(first.get("CaseMaster"), dict):
                candidates.append(first["CaseMaster"].get("CaseMasterID"))
    for c in candidates:
        if c is not None:
            try:
                return int(c)
            except (TypeError, ValueError):
                continue
    return None


def handler(event, context):
    logger.info(f"case_insert_signal received event: {json.dumps(event)[:500]}")

    if not VAJRA_APP_BASE_URL or not INTERNAL_SIGNAL_SECRET:
        logger.error(
            "VAJRA_APP_BASE_URL / INTERNAL_SIGNAL_SECRET not configured on this "
            "function's environment -- see this file's module docstring for the "
            "required Console setup. Nothing can be done without them."
        )
        return {"status": "error", "reason": "not_configured"}

    case_master_id = _extract_case_master_id(event if isinstance(event, dict) else {})
    if case_master_id is None:
        logger.warning(
            "Could not find a CaseMasterID in this Signal's payload under any "
            "of the shapes this function tries -- log the raw event above and "
            "update _extract_case_master_id to match the real shape."
        )
        return {"status": "skipped", "reason": "no_case_master_id_found"}

    try:
        res = requests.post(
            f"{VAJRA_APP_BASE_URL.rstrip('/')}/api/internal/case-inserted",
            json={"case_master_id": case_master_id},
            headers={"X-Internal-Signal-Secret": INTERNAL_SIGNAL_SECRET, "Content-Type": "application/json"},
            timeout=25,
        )
        logger.info(f"case-inserted call for CaseMasterID {case_master_id}: {res.status_code} {res.text[:300]}")
        return {"status": "forwarded", "case_master_id": case_master_id, "response_code": res.status_code}
    except Exception as e:
        logger.warning(f"case-inserted forward failed for CaseMasterID {case_master_id}: {e}")
        return {"status": "error", "detail": str(e)}
