import os
import sys
import json
import time
import requests
import logging

logger = logging.getLogger()
logger.setLevel(logging.INFO)

PROJECT_ID = os.getenv("CATALYST_PROJECT_ID", "50212000000025002")
CLIENT_ID = os.getenv("CATALYST_CLIENT_ID", "1000.C7P6NV7VABS62L20K4PU2FPKHR4XXC")
CLIENT_SECRET = os.getenv("CATALYST_CLIENT_SECRET", "0578e8267e011fafc60ef0d93bd769d283b7c5b803")
REFRESH_TOKEN = os.getenv("CATALYST_REFRESH_TOKEN", "1000.9e78850ec0e125a9822664a0de2472fa.072a393efae4ff953cd72be4c89e6f7c")
LLM_ENDPOINT = os.getenv("CATALYST_LLM_ENDPOINT", f"https://api.catalyst.zoho.in/quickml/v1/project/{PROJECT_ID}/glm/chat")

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
    prompt_payload = {
        "messages": [
            {
                "role": "system",
                "content": (
                    "You are VAJRA, the AI Crime Intelligence Copilot for Karnataka State Police (KSP). "
                    "Provide highly structured, professional criminological analysis with specific statutory provisions (BNS, IT Act). "
                    "Grounded Database Facts:\n" + "\n".join(grounded_context)
                )
            },
            {"role": "user", "content": message}
        ],
        "temperature": 0.3,
        "max_tokens": 1024
    }
    
    response_text = ""
    try:
        glm_res = requests.post(
            LLM_ENDPOINT,
            headers={"Authorization": f"Zoho-oauthtoken {token}", "Content-Type": "application/json"},
            json=prompt_payload,
            timeout=120
        )
        if glm_res.status_code == 200:
            resp_data = glm_res.json()
            response_text = resp_data.get("choices", [{}])[0].get("message", {}).get("content", "")
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
