import os
import json
import time
import logging
import requests
from typing import Dict, Any, List, Optional
from vajra_core import get_quickml_access_token

logger = logging.getLogger("catalyst_rag")

def _get_runtime_config(key: str, default: str = "") -> str:
    val = os.getenv(key, "")
    if val:
        return val
    config_path = os.path.join(os.path.dirname(__file__), "catalyst_runtime_config.json")
    if os.path.exists(config_path):
        try:
            with open(config_path, "r", encoding="utf-8") as f:
                cfg = json.load(f)
                return cfg.get(key, default)
        except Exception as e:
            logger.warning(f"Failed to read runtime config for {key}: {e}")
    return default

class CatalystRAG:
    """
    Client for Catalyst QuickML RAG Agent Endpoint.
    Responsible for CCTNS knowledge retrieval, statutory dispatch, and tool sequence planning.
    """
    def __init__(self):
        self.endpoint = _get_runtime_config(
            "CATALYST_RAG_ENDPOINT",
            "https://console.catalyst.zoho.in/quickml/v1/project/50212000000025002/genai/endpoints/rag/agent/chat"
        )
        self.endpoint_key = _get_runtime_config(
            "CATALYST_RAG_ENDPOINT_KEY",
            "78a50a95bb2772f664571786b886326a148880f505cc545ae08dcced62822620bda68c2a0c32f4ffb73e092ef2254048"
        )
        self.app_id = _get_runtime_config("CATALYST_PROJECT_KEY", "60074806366")

    def query(
        self,
        query_text: str,
        chat_history: Optional[List[Dict[str, str]]] = None,
        context: Optional[Dict[str, Any]] = None,
        timeout: int = 15
    ) -> Dict[str, Any]:
        """
        Queries the Catalyst RAG Agent for knowledge retrieval and tool recommendations.
        """
        if not self.endpoint:
            return {"available": False, "error": "RAG endpoint not configured"}

        headers = {
            "Content-Type": "application/json",
            "X-App-Id": self.app_id,
        }
        if self.endpoint_key:
            headers["Authorization"] = f"Zoho-encapikey {self.endpoint_key}"

        payload: Dict[str, Any] = {
            "query": query_text,
            "chat_history": chat_history or [],
        }
        if context:
            payload["context"] = context

        max_retries = 2
        for attempt in range(max_retries + 1):
            try:
                response = requests.post(
                    self.endpoint,
                    headers=headers,
                    json=payload,
                    timeout=timeout
                )
                if response.status_code == 200:
                    res_json = response.json()
                    data = res_json.get("data", res_json)
                    return {
                        "available": True,
                        "data": data,
                        "status_code": 200,
                        "raw": res_json
                    }
                elif response.status_code in (401, 403):
                    # Try with fresh OAuth token if encapikey failed
                    oauth_token = get_quickml_access_token()
                    if oauth_token:
                        headers["Authorization"] = f"Zoho-oauthtoken {oauth_token}"
                        continue
                    return {
                        "available": False,
                        "error": f"Auth failed with status {response.status_code}: {response.text[:200]}",
                        "status_code": response.status_code
                    }
                else:
                    logger.warning(f"Catalyst RAG error status {response.status_code}: {response.text[:200]}")
                    if attempt == max_retries:
                        return {
                            "available": False,
                            "error": f"RAG failed with status {response.status_code}: {response.text[:200]}",
                            "status_code": response.status_code
                        }
            except requests.exceptions.Timeout:
                logger.warning(f"Catalyst RAG timeout (attempt {attempt + 1}/{max_retries + 1})")
                if attempt == max_retries:
                    return {"available": False, "error": "RAG request timed out"}
            except Exception as ex:
                logger.warning(f"Catalyst RAG network error (attempt {attempt + 1}/{max_retries + 1}): {ex}")
                if attempt == max_retries:
                    return {"available": False, "error": str(ex)}
            time.sleep(0.5)

        return {"available": False, "error": "RAG retries exhausted"}
