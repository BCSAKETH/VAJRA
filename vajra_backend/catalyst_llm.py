import os
import json
import time
import logging
import requests
from typing import Dict, Any, List, Optional
from vajra_core import get_cached_access_token, catalyst_app

logger = logging.getLogger("catalyst_llm")

_DOWN_FLAG_KEY = "catalyst_llm_endpoint_down"
# Segment.put()'s real signature is put(key, value, expiry=None) where expiry
# is whole hours (req_json sends it as expiry_in_hours) -- there's no
# finer-grained TTL available, so 1 hour is the shortest real "recently
# down" window this API can express.
_DOWN_FLAG_EXPIRY_HOURS = 1


def _mark_endpoint_down():
    """
    Short-lived flag in Catalyst Cache so repeated chat turns during a real
    outage skip straight to the local fallback instead of each eating the
    full retry-with-backoff + timeout budget. Degrades silently if Cache
    itself is unreachable (same graceful-degradation pattern as
    session_memory.py) -- this is a latency optimization, not a correctness
    requirement, so a Cache failure here must never break the chat turn.
    """
    if not catalyst_app:
        return
    try:
        catalyst_app.cache().segment("Default").put(_DOWN_FLAG_KEY, "1", _DOWN_FLAG_EXPIRY_HOURS)
    except Exception:
        pass


def _is_endpoint_marked_down() -> bool:
    if not catalyst_app:
        return False
    try:
        return bool(catalyst_app.cache().segment("Default").get_value(_DOWN_FLAG_KEY))
    except Exception:
        return False


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
        # The real console-provided API sample uses CATALYST-ORG: <project key>,
        # not a separate "org id" -- CATALYST_ORG_ID was never actually set in
        # .env, so this header was silently never sent before.
        self.org_id = os.getenv("CATALYST_ORG_ID") or os.getenv("CATALYST_PROJECT_KEY", "")
        self.model_name = os.getenv("CATALYST_LLM_MODEL", "crm-di-glm47b_30b_it")

    def chat(
        self,
        messages: List[Dict[str, str]],
        tools: Optional[List[Dict[str, Any]]] = None,
        use_agent_system_prompt: bool = True
    ) -> Dict[str, Any]:
        """
        Sends chat payload to Catalyst LLM Serving.
        Attempts native function-calling first; falls back to structured system prompting if native is unsupported.

        use_agent_system_prompt=False skips the tool-calling system prompt
        entirely and sends `messages` as-is. Needed by callers like
        generate_applet_spec() that already supply their own complete system
        prompt for a different JSON shape -- the tool-calling prompt would
        otherwise get prepended in front of it, confusing the model about
        which JSON shape to actually produce.
        """
        token = get_cached_access_token()
        if not token:
            logger.error("Failed to retrieve cached access token for Catalyst LLM.")
            return {"error": "Authentication token missing."}

        # Matches the real console-provided API sample exactly (Model Details ->
        # API Details) -- previously included extra X-Catalyst-Environment /
        # environment headers not in that sample, which is likely why every
        # request got a confusing zoho-inputstream parse error rather than a
        # clean response. CATALYST-ORG is required per the sample, not optional.
        headers = {
            "Authorization": f"Zoho-oauthtoken {token}",
            "Content-Type": "application/json",
            "CATALYST-ORG": self.org_id
        }
        if self.endpoint_key:
            headers["X-QUICKML-ENDPOINT-KEY"] = self.endpoint_key

        # Format system prompt to force structured tool execution if model doesn't support native tool calls.
        #
        # This deployed model (crm-di-glm47b_30b_it) has its own baked-in
        # guardrail against "respond STRICTLY in this format" / "reveal your
        # reasoning" style instructions -- confirmed live that phrasing
        # triggers a canned "I can't help with requests to expose protected
        # instructions" refusal regardless of wording tweaks, but a softer,
        # helpful-feature framing of the same JSON request does not. Keep
        # this framing if the prompt ever needs editing; don't reintroduce
        # "thought"/"strictly" language.
        if tools:
            system_prompt = (
                "You are a helpful assistant for the Karnataka Police, helping officers query a crime database. "
                "You have access to tools that can look up real data for the officer. "
                "When a tool would help answer the officer's question, respond with JSON containing a 'tool' field "
                "(the tool name) and a 'parameters' field (an object with the needed parameters). "
                "When you can answer directly without a tool, or the query is ambiguous and needs clarification, "
                "respond with JSON containing a 'text_response' field with your answer or clarifying question. "
                "Available tools:\n"
            )
            for t in tools:
                system_prompt += f"- {t['name']}: {t['description']}. Parameters: {json.dumps(t['parameters'])}\n"
        else:
            # No tools passed -- this is the final-synthesis call after tool
            # results are already in history. Confirmed live that reusing
            # the tool-calling prompt here (with an empty "Available tools:"
            # list) confused the model into responding with another
            # {"tool": ...} JSON instead of a real answer, since the history
            # already contains one. This prompt has no tool-calling framing
            # at all, so there's nothing for it to imitate.
            system_prompt = (
                "You are a helpful assistant for the Karnataka Police. A tool has already been run and its "
                "result is in the conversation above. Write the officer a direct, final answer based on that "
                "result -- respond with JSON containing only a 'text_response' field with your answer."
            )
        
        # Inject system prompt into messages if not already present
        if use_agent_system_prompt:
            if messages and messages[0].get("role") == "system":
                messages[0]["content"] = system_prompt + "\n" + messages[0]["content"]
                formatted_messages = messages
            else:
                formatted_messages = [{"role": "system", "content": system_prompt}] + messages
        else:
            formatted_messages = messages

        # Build payload -- matches the real console API sample exactly:
        # temperature/max_tokens/stream are top-level fields, not nested under
        # a "parameters" object (the nested shape was never valid and was
        # part of why every request failed). "model" is required and was
        # missing entirely before.
        #
        # Native "tools" is intentionally NOT sent: the TOOLS registry in
        # agent_loop.py is a flat {"name","description","parameters"} list,
        # not the {"type":"function","function":{...}} shape this endpoint's
        # native tool-calling expects, and the response parser in
        # run_agent_loop only understands the structured-JSON-in-content
        # format from the system prompt above, not native tool_calls --
        # sending a mismatched tools array risks the model responding in a
        # shape nothing here can parse.
        # max_tokens raised from 1000: this is a "thinking" model that writes
        # extensive step-by-step reasoning before its actual JSON answer
        # (confirmed live) -- 1000 tokens was cutting that reasoning off
        # mid-thought before it ever reached the JSON, causing a genuine
        # json.loads() failure ("I encountered an error processing your
        # query") on turns with longer reasoning traces.
        payload = {
            "model": self.model_name,
            "messages": formatted_messages,
            "temperature": 0.1,
            "max_tokens": 2500,
            "stream": False
        }

        # Skip the retry-with-backoff budget entirely if a recent call already
        # confirmed the endpoint down -- avoids every chat turn during a real
        # outage paying the full [1, 2, 4]s backoff + 25s timeout before
        # falling back, mirroring get_cached_access_token()'s own retry pattern.
        if _is_endpoint_marked_down():
            logger.info("Catalyst LLM endpoint recently confirmed down (cached flag) -- skipping to fallback.")
        else:
            for attempt, delay in enumerate([0, 1, 2, 4]):
                if delay:
                    time.sleep(delay)
                try:
                    logger.info(f"Posting to Catalyst LLM Serving endpoint (attempt {attempt + 1}): {self.endpoint_url}")
                    res = requests.post(self.endpoint_url, headers=headers, json=payload, timeout=25)

                    if res.status_code == 200:
                        data = res.json()
                        logger.info("Catalyst LLM Serving returned 200 OK.")
                        # Real shape confirmed live: {"response": "...",
                        # "tool_calls": [...], "usage": {...}}, not the
                        # OpenAI-style {"choices": [...]} the rest of this
                        # codebase (run_agent_loop, _local_agent_simulation)
                        # is written against. Normalize here so nothing
                        # downstream needs to know about this endpoint's
                        # actual wire format.
                        if "choices" not in data and "response" in data:
                            return {
                                "choices": [{
                                    "message": {"role": "assistant", "content": data["response"]}
                                }]
                            }
                        return data.get("data", data)

                    if res.status_code in (401, 404):
                        # Misconfiguration, not a transient failure -- retrying
                        # won't help (wrong credentials / wrong URL), so log
                        # loudly once and go straight to fallback instead of
                        # burning the retry budget.
                        logger.critical(f"Catalyst LLM endpoint misconfigured ({res.status_code}): {res.text}")
                        _mark_endpoint_down()
                        break

                    if res.status_code == 429 or res.status_code >= 500:
                        logger.warning(f"Catalyst LLM transient error {res.status_code}, retrying: {res.text[:200]}")
                        continue

                    # Any other 4xx (e.g. the current request-schema mismatch)
                    # is also not something a retry will fix.
                    logger.warning(f"Catalyst LLM API call failed with status: {res.status_code} - {res.text[:300]}")
                    _mark_endpoint_down()
                    break
                except requests.exceptions.Timeout:
                    logger.warning(f"Catalyst LLM request timed out (attempt {attempt + 1}), retrying.")
                    continue
                except Exception as e:
                    logger.error(f"Error calling Catalyst LLM Serving: {e}")
                    _mark_endpoint_down()
                    break
            else:
                # Exhausted all retries on transient errors
                _mark_endpoint_down()

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
