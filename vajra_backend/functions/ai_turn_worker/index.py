import os
import sys
import json
import time
import requests
import logging

logger = logging.getLogger()
logger.setLevel(logging.INFO)

# Item 16 / pentest V3 (Vajra Plan 04-09-26): this file previously had real,
# live OAuth credentials hardcoded as os.getenv(..., "<value>") fallback
# defaults -- meaning even with the env vars properly set elsewhere, a
# missing/misconfigured environment would silently fall back to using
# (and further exposing, since this file is committed to a public repo)
# those specific live secrets. This function is confirmed NOT currently
# deployed/wired to real traffic (a stale prototype -- see project memory),
# so removing the fallback breaks nothing live. No default: an unset
# credential now stays None and get_oauth_token() fails loudly (logged)
# instead of silently authenticating with a hardcoded value.
PROJECT_ID = os.getenv("CATALYST_PROJECT_ID", "50212000000025002")  # not a secret, just an id
CLIENT_ID = os.getenv("CATALYST_CLIENT_ID")
CLIENT_SECRET = os.getenv("CATALYST_CLIENT_SECRET")
REFRESH_TOKEN = os.getenv("CATALYST_REFRESH_TOKEN")
if not (CLIENT_ID and CLIENT_SECRET and REFRESH_TOKEN):
    logger.warning(
        "CATALYST_CLIENT_ID/CLIENT_SECRET/REFRESH_TOKEN not set in this function's "
        "environment -- get_oauth_token() will fail until they're configured in the "
        "Catalyst Console (Functions > ai_turn_worker > Environment Variables)."
    )
LLM_ENDPOINT = os.getenv("CATALYST_LLM_ENDPOINT", f"https://console.catalyst.zoho.in/quickml/v1/project/{PROJECT_ID}/genai/endpoints/glm-flash-47/generate")

ZCQL_URL = f"https://api.catalyst.zoho.in/baas/v1/project/{PROJECT_ID}/query"
TOKEN_URL = "https://accounts.zoho.in/oauth/v2/token"


def get_oauth_token():
    payload = {
        "client_id": CLIENT_ID,
        "client_secret": CLIENT_SECRET,
        "refresh_token": REFRESH_TOKEN,
        "grant_type": "refresh_token"
    }
    for delay in [1, 2]:
        try:
            res = requests.post(TOKEN_URL, data=payload, timeout=10)
            data = res.json()
            if "access_token" in data:
                return data["access_token"]
        except Exception as e:
            logger.warning(f"OAuth token fetch retry: {e}")
        time.sleep(delay)
    return None


def execute_zcql(query: str, token: str):
    headers = {
        "Authorization": f"Zoho-oauthtoken {token}",
        "Content-Type": "application/json",
        "environment": "Development"
    }
    res = requests.post(ZCQL_URL, headers=headers, json={"query": query}, timeout=15)
    if res.status_code == 200:
        return res.json().get("data", [])
    logger.warning(f"ZCQL failed ({res.status_code}): {res.text[:200]}")
    return []


def persist_assistant_message(session_id: str, text: str, response_type: str, data: dict, citations: list, token: str):
    headers = {
        "Authorization": f"Zoho-oauthtoken {token}",
        "Content-Type": "application/json",
        "environment": "Development"
    }
    # Escape quotes for ZCQL insert
    safe_text = text.replace("'", "''")
    safe_data = json.dumps(data).replace("'", "''")
    safe_citations = json.dumps(citations).replace("'", "''")
    
    insert_query = (
        f"INSERT INTO ChatMessage (session_id, sender, text, response_type, data_json, citations_json) "
        f"VALUES ('{session_id}', 'assistant', '{safe_text}', '{response_type}', '{safe_data}', '{safe_citations}')"
    )
    res = requests.post(ZCQL_URL, headers=headers, json={"query": insert_query}, timeout=15)
    return res.status_code == 200


def handler(context, basic_io):
    """
    Dedicated serverless worker for executing long-running AI turns (up to 15 mins).
    Decoupled from AppSail container lifecycles.
    """
    logger.info("AI Turn Worker invoked via Catalyst Job Scheduling.")
    job_params = basic_io.get_job_params() or {}
    
    session_id = job_params.get("session_id")
    message = job_params.get("message", "").strip()
    employee_id = job_params.get("employee_id")
    answer_mode = job_params.get("answer_mode", "standard")
    
    if not session_id or not message:
        logger.error("Missing session_id or message in job_params.")
        context.close()
        return

    token = get_oauth_token()
    if not token:
        logger.error("Failed to acquire OAuth token.")
        context.close()
        return

    # 1. Grounding queries via ZCQL
    grounded_context = []
    citations = []
    
    # Check for FIR numbers (e.g. CR-2026-31313)
    import re
    fir_matches = re.findall(r"CR-\d{4}-\d+", message, re.IGNORECASE)
    for fir in fir_matches[:3]:
        rows = execute_zcql(f"SELECT * FROM CaseMaster WHERE FIRNo = '{fir.upper()}' LIMIT 1", token)
        if rows:
            cm = rows[0].get("CaseMaster", {})
            grounded_context.append(f"FIR {fir}: Incident {cm.get('IncidentType')}, Status: {cm.get('CaseStatus')}, Details: {cm.get('IncidentDetails')}")
            citations.append({"type": "CCTNS FIR Record", "id": fir, "status": "verified"})

    # 2. Call GLM-4 QuickML model for reasoning
    #
    # CONTRACT NOTE (matches catalyst_llm.py's own real, live-confirmed
    # contract for this same recreated "generate" endpoint -- see that
    # file's CatalystLLM.chat() docstring/comments): the old OpenAI-style
    # {"messages": [...]} body / {"choices": [{"message": {"content": ...}}]}
    # response shape belonged to the PRIOR, now-deleted endpoint. The new
    # endpoint takes a flat {"prompt": "<string>"} body and returns
    # {"data": [{"data": "<think>...</think>actual answer"}], ...}. This
    # function is still confirmed NOT wired to live traffic (see the
    # module docstring above), so this was previously a silently dead
    # contract mismatch rather than a live bug -- fixed now so it doesn't
    # become one the moment this worker is actually dispatched. Auth is
    # also still unresolved for this specific gap: get_oauth_token() above
    # uses the main app's refresh token, which (per vajra_core.py's
    # get_quickml_access_token) may not carry the QuickML.deployment.READ
    # scope this endpoint requires -- that's a separate fix, not addressed
    # here, since this function has no scoped-token path of its own yet.
    system_prompt = (
        "You are VAJRA, the AI Crime Intelligence Copilot for Karnataka State Police (KSP). "
        "Provide highly structured, professional criminological analysis with specific statutory provisions (BNS, IT Act). "
        "Grounded Database Facts:\n" + "\n".join(grounded_context)
    )
    prompt_payload = {
        "prompt": f"System: {system_prompt}\n\nUser: {message}\n\nAssistant:"
    }
    glm_headers = {
        "Authorization": f"Zoho-oauthtoken {token}",
        "Content-Type": "application/json",
        "Environment": os.getenv("CATALYST_ENVIRONMENT", "Development"),
        "CATALYST-ORG": os.getenv("CATALYST_ORG_ID", PROJECT_ID),
    }
    endpoint_key = os.getenv("CATALYST_LLM_ENDPOINT_KEY", "")
    if endpoint_key:
        glm_headers["x-quickml-endpoint-key"] = endpoint_key

    response_text = ""
    try:
        glm_res = requests.post(LLM_ENDPOINT, headers=glm_headers, json=prompt_payload, timeout=120)
        if glm_res.status_code == 200:
            resp_data = glm_res.json()
            try:
                response_text = ((resp_data.get("data") or [{}])[0] or {}).get("data") or ""
            except (IndexError, AttributeError, TypeError):
                response_text = ""
            if "</think>" in response_text:
                response_text = response_text.split("</think>", 1)[-1].strip()
        else:
            logger.warning(f"GLM call returned {glm_res.status_code}: {glm_res.text[:200]}")
    except Exception as ex:
        logger.warning(f"GLM call failed: {ex}")

    if not response_text:
        response_text = f"Intelligence analysis for query: {message[:100]}... Grounded records examined: {len(grounded_context)}."

    # 3. Persist finalized answer to ChatMessage table
    data_payload = {
        "risk_score": 55.1,
        "mode": answer_mode,
        "worker": "catalyst_serverless_function"
    }
    
    success = persist_assistant_message(session_id, response_text, "standard", data_payload, citations, token)
    logger.info(f"Persisted AI turn for session {session_id}, success={success}")
    
    basic_io.write({"status": "completed", "session_id": session_id})
    context.close()
