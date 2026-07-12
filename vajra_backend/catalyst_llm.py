import os
import json
import logging
import requests
from typing import Dict, Any, List, Optional
from vajra_core import get_cached_access_token

logger = logging.getLogger("catalyst_llm")

class CatalystLLM:
    """
    Client for Zoho Catalyst QuickML LLM Serving.
    Calls GLM-4.7-Flash using OAuth access tokens.
    """
    def __init__(self):
        self.project_id = os.getenv("CATALYST_PROJECT_ID")
        self.region = os.getenv("CATALYST_REGION", "IN")
        domain = "in" if self.region == "IN" else "com"
        
        # Pull endpoint URL from environment, fallback to standard BaaS QuickML endpoint structure
        self.endpoint_url = os.getenv(
            "CATALYST_LLM_ENDPOINT",
            f"https://api.catalyst.zoho.{domain}/baas/v1/project/{self.project_id}/quickml/genai/llm/chat"
        )
        self.endpoint_key = os.getenv("CATALYST_LLM_ENDPOINT_KEY", "")
        self.org_id = os.getenv("CATALYST_ORG_ID", "")

    def chat(self, messages: List[Dict[str, str]], tools: Optional[List[Dict[str, Any]]] = None) -> Dict[str, Any]:
        """
        Sends chat payload to Catalyst LLM Serving.
        Attempts native function-calling first; falls back to structured system prompting if native is unsupported.
        """
        token = get_cached_access_token()
        if not token:
            logger.error("Failed to retrieve cached access token for Catalyst LLM.")
            return {"error": "Authentication token missing."}

        headers = {
            "Authorization": f"Zoho-oauthtoken {token}",
            "Content-Type": "application/json",
            "X-Catalyst-Environment": "Development",
            "environment": "Development"
        }
        if self.endpoint_key:
            headers["X-QUICKML-ENDPOINT-KEY"] = self.endpoint_key
        if self.org_id:
            headers["CATALYST-ORG"] = self.org_id

        # Format system prompt to force structured tool execution if model doesn't support native tool calls
        system_prompt = (
            "You are VAJRA, an agentic AI copilot for the Karnataka State Police. "
            "You have access to a suite of criminal database tools. "
            "To resolve the user query, choose the most appropriate tool and respond strictly in the following JSON format:\n"
            "{\n"
            "  \"thought\": \"reasoning about which tool to call and why\",\n"
            "  \"tool\": \"tool_name_here\",\n"
            "  \"parameters\": { \"param_name\": \"value\" }\n"
            "}\n"
            "If no tool is needed and you can answer directly using previous context, or if the query is ambiguous and you need to ask a clarifying question, respond in this format:\n"
            "{\n"
            "  \"thought\": \"reasoning\",\n"
            "  \"text_response\": \"your direct answer or clarifying question to the user\"\n"
            "}\n"
            "Available tools:\n"
        )

        if tools:
            for t in tools:
                system_prompt += f"- {t['name']}: {t['description']}. Parameters: {json.dumps(t['parameters'])}\n"
        
        # Inject system prompt into messages if not already present
        formatted_messages = []
        if messages and messages[0].get("role") == "system":
            messages[0]["content"] = system_prompt + "\n" + messages[0]["content"]
            formatted_messages = messages
        else:
            formatted_messages = [{"role": "system", "content": system_prompt}] + messages

        # Build payload
        payload = {
            "messages": formatted_messages,
            "parameters": {
                "temperature": 0.1,
                "max_tokens": 1000,
                "top_p": 0.9
            }
        }

        # If native tools are supported, inject tools array
        if tools:
            payload["tools"] = tools

        try:
            logger.info(f"Posting to Catalyst LLM Serving endpoint: {self.endpoint_url}")
            res = requests.post(self.endpoint_url, headers=headers, json=payload, timeout=25)
            
            if res.status_code == 200:
                data = res.json()
                logger.info("Catalyst LLM Serving returned 200 OK.")
                return data.get("data", data)
            else:
                logger.warning(f"Catalyst LLM API call failed with status: {res.status_code} - {res.text}")
        except Exception as e:
            logger.error(f"Error calling Catalyst LLM Serving: {e}")

        # Strict demo mode check: disable fallback completely
        strict_demo = os.environ.get("STRICT_DEMO_MODE", "false").lower() == "true"
        if strict_demo:
            logger.critical("Strict demo mode active: LLM generative endpoint offline. Fallback simulation blocked.")
            raise RuntimeError("Generative AI Service Unavailable - Local Simulation Blocked in Strict Demo Mode")

        # Fallback local mock simulation if live endpoint is unreachable (development fallback)
        logger.warning("Reverting to local agent rule-parsing simulation due to endpoint unavailability.")
        sim_res = self._local_agent_simulation(messages, tools)
        if "choices" in sim_res and len(sim_res["choices"]) > 0:
            msg = sim_res["choices"][0]["message"]
            try:
                content_json = json.loads(msg["content"])
                content_json["is_simulated"] = True
                content_json["simulated_reason"] = "Catalyst LLM generative endpoint offline"
                msg["content"] = json.dumps(content_json)
            except Exception:
                pass
        return sim_res

    def _local_agent_simulation(self, messages: List[Dict[str, str]], tools: Optional[List[Dict[str, Any]]] = None) -> Dict[str, Any]:
        """
        Grounded local LLM simulator mimicking the structured JSON tool decision format.
        Used for local offline execution when Catalyst QuickML generative endpoints are offline.
        """
        last_user_message = ""
        for m in reversed(messages):
            content = m.get("content", "")
            if m.get("role") == "user" and not content.startswith("Tool '"):
                last_user_message = content.lower()
                break

        if not tools:
            # Toolless synthesis turn
            return {
                "choices": [{
                    "message": {
                        "role": "assistant",
                        "content": json.dumps({
                            "thought": "Synthesizing final response based on retrieved data...",
                            "text_response": "I have successfully compiled the CCTNS records and security indicators. Please review the details below.",
                            "is_simulated": True,
                            "simulated_reason": "Catalyst LLM generative endpoint offline"
                        })
                    }
                }]
            }

        # Simulate agent tool selection reasoning
        tool_name = "resolve_vague_query"
        params = {"query": last_user_message}

        if "network" in last_user_message or "associate" in last_user_message or "connection" in last_user_message:
            tool_name = "query_graph_network"
            suspect_match = self._extract_suspect(last_user_message)
            params = {"suspect_name": suspect_match if suspect_match else "Ramesh"}
        elif "risk" in last_user_message or "reoffend" in last_user_message:
            tool_name = "get_offender_risk"
            suspect_match = self._extract_suspect(last_user_message)
            params = {"suspect_name": suspect_match if suspect_match else "Ramesh"}
        elif "map" in last_user_message or "hotspot" in last_user_message:
            tool_name = "query_hotspots"
            params = {}
        elif "forecast" in last_user_message or "predict" in last_user_message:
            tool_name = "get_forecast"
            params = {"district": "Peenya", "crime_type": "THEFT"}
        elif "summary" in last_user_message or "summarize" in last_user_message:
            tool_name = "summarize_case"
            params = {"case_id": 1}
        elif "section" in last_user_message or "act" in last_user_message:
            tool_name = "suggest_sections"
            params = {"crime_description": last_user_message}
        elif "mo" in last_user_message or "profile" in last_user_message:
            tool_name = "get_mo_profile"
            suspect_match = self._extract_suspect(last_user_message)
            params = {"suspect_name": suspect_match if suspect_match else "Ramesh"}

        sim_response = {
            "choices": [{
                "message": {
                    "role": "assistant",
                    "content": json.dumps({
                        "thought": f"Analyzed query '{last_user_message}' and decided to invoke '{tool_name}'",
                        "tool": tool_name,
                        "parameters": params
                    })
                }
            }]
        }
        return sim_response

    def _extract_suspect(self, query: str) -> Optional[str]:
        import re
        candidates = re.findall(r'\b[a-zA-Z]+\b', query)
        for cand in candidates:
            if cand.lower() not in ["show", "the", "network", "of", "risk", "profile", "reoffend", "peenya", "indiranagar", "assess", "conviction", "suspect"]:
                return cand.capitalize()
        return None
