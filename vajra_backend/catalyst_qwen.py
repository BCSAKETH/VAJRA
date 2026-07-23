import os
import re
import json
import base64
import logging
import requests
from typing import List, Dict, Any, Optional
from vajra_core import get_cached_access_token

logger = logging.getLogger("catalyst_qwen")

# This deployment is a true VLM endpoint, not a general chat model with
# optional vision -- confirmed live: an empty `images` array 500s with
# {"detail": "Problem in the input image"}, so a text-only call needs
# *some* image present even when there's nothing to look at. A 1x1
# transparent PNG satisfies that requirement without costing any real
# image-token budget or influencing the answer -- confirmed live the model
# correctly ignores it and returns a clean text response when the prompt
# tells it to.
_BLANK_PNG_B64 = base64.b64encode(bytes.fromhex(
    "89504e470d0a1a0a0000000d49484452000000010000000108020000009077"
    "53de0000000c4944415408d763f8ffff3f0005fe02fea739663f0000000049454e44ae426082"
)).decode("ascii")


class CatalystQwen:
    """
    Client for a Qwen vision-language model deployed on Catalyst QuickML.
    Mirrors catalyst_llm.py's structure (same cached-token reuse) but is
    pointed at a separate vision endpoint and kept to a minimal, no-history
    prompt -- Qwen VL's ~9k token budget and 3-image ceiling don't leave room
    for the full chat history GLM gets.

    Confirmed live via the real console API sample (Model Details -> API
    Details): this endpoint uses a completely different, simpler wire format
    than GLM -- a flat "prompt" string plus an "images" array of base64
    strings, not an OpenAI-style "messages" array. Response is
    {"response": "...", "model": ..., "metrics": {...}}.
    """

    def __init__(self):
        self.project_id = os.getenv("CATALYST_PROJECT_ID")
        self.region = os.getenv("CATALYST_REGION", "IN")
        self.endpoint_url = os.getenv("CATALYST_QWEN_ENDPOINT", "")
        self.endpoint_key = os.getenv("CATALYST_QWEN_ENDPOINT_KEY", "")
        # CATALYST-ORG is the project key, confirmed via both GLM's and Qwen's
        # real console API samples.
        self.org_id = os.getenv("CATALYST_ORG_ID") or os.getenv("CATALYST_PROJECT_KEY", "")
        # Confirmed live via Qwen's own Model Details -> API Details sample.
        self.model_name = os.getenv("CATALYST_QWEN_MODEL", "VL-Qwen3.6-35B-A3B")

    def is_configured(self) -> bool:
        return bool(self.endpoint_url)

    def analyze(self, image_bytes_list: List[bytes], instruction: Optional[str] = None) -> Dict[str, Any]:
        """
        Sends up to 3 images to the Qwen VL endpoint with a single focused
        instruction (no chat history) and returns extracted text/description.
        Returns {"available": False, ...} honestly if no endpoint is
        configured, rather than a fabricated analysis.
        """
        if not self.is_configured():
            logger.warning("Qwen vision endpoint not configured (CATALYST_QWEN_ENDPOINT unset).")
            return {
                "available": False,
                "text": "Attachment analysis is not available -- the Qwen vision service has not been deployed/configured yet."
            }

        token = get_cached_access_token()
        if not token:
            return {"available": False, "text": "Attachment analysis failed: authentication token missing."}

        images_b64 = [base64.b64encode(b).decode("utf-8") for b in image_bytes_list[:3]]

        # Matches GLM's confirmed-real header shape exactly (no extra
        # X-Catalyst-Environment/environment headers -- those are what broke
        # GLM's requests before). CATALYST-ORG is required, not optional.
        headers = {
            "Authorization": f"Zoho-oauthtoken {token}",
            "Content-Type": "application/json",
            "CATALYST-ORG": self.org_id
        }
        if self.endpoint_key:
            headers["X-QUICKML-ENDPOINT-KEY"] = self.endpoint_key

        prompt = instruction or (
            "Extract and describe all investigatively relevant content from this evidence "
            "attachment: any text (OCR), identifiable objects, people, and context. Be concise "
            "and factual -- this is for a police case file, not a general description."
        )

        # Matches the real console-provided API sample exactly: flat "prompt"
        # + "images" array, not an OpenAI-style "messages" array like GLM.
        payload = {
            "prompt": prompt,
            "model": self.model_name,
            "images": images_b64,
            "system_prompt": "Be concise and factual.",
            "top_k": 50,
            "top_p": 0.9,
            "temperature": 0.1,
            "max_tokens": 800
        }

        try:
            res = requests.post(self.endpoint_url, headers=headers, json=payload, timeout=30)
            if res.status_code == 200:
                data = res.json()
                text = data.get("response") or ""
                return {"available": True, "text": text}
            logger.warning(f"Qwen vision call failed: {res.status_code} - {res.text[:300]}")
        except Exception as e:
            logger.error(f"Error calling Qwen vision endpoint: {e}")

        return {"available": False, "text": "Attachment analysis failed -- the Qwen vision service returned an error."}

    _LANG_NAMES = {"en": "English", "kn": "Kannada"}

    def translate(self, text: str, source_lang: str, target_lang: str) -> Dict[str, Any]:
        """
        Text translation via this same Qwen VL deployment, used as a last-
        resort fallback when GLM's chat-based translate() is unavailable.
        Qwen runs on a separate QuickML deployment/model from GLM (glm/chat
        vs vlm/chat) -- confirmed live over this session that GLM had three
        independent outage windows (ziahub.error.INTERNAL_SERVER_ERROR)
        while this endpoint kept responding, so its uptime genuinely doesn't
        track GLM's. Sends the blank placeholder image (see module docstring)
        since this endpoint 500s without at least one image attached; the
        model reliably ignores it when told to. Confirmed live on both
        directions, short and multi-sentence paragraphs, with exact numbers/
        case numbers/dates preserved -- response times 0.3-2.0s.
        """
        if not self.is_configured():
            return {"available": False, "text": text}
        token = get_cached_access_token()
        if not token:
            return {"available": False, "text": text}

        src_name = self._LANG_NAMES.get(source_lang, source_lang)
        tgt_name = self._LANG_NAMES.get(target_lang, target_lang)
        prompt = (
            f"Ignore the attached image, it is blank and irrelevant. Translate the following "
            f"{src_name} text to {tgt_name}. Output ONLY the translation, no explanation, "
            f"preserving all numbers exactly:\n\n{text}"
        )

        headers = {
            "Authorization": f"Zoho-oauthtoken {token}",
            "Content-Type": "application/json",
            "CATALYST-ORG": self.org_id
        }
        if self.endpoint_key:
            headers["X-QUICKML-ENDPOINT-KEY"] = self.endpoint_key

        payload = {
            "prompt": prompt,
            "model": self.model_name,
            "images": [_BLANK_PNG_B64],
            "system_prompt": "You are a precise translator. Output only the translated text, ignoring any attached image.",
            "top_k": 50,
            "top_p": 0.9,
            "temperature": 0.1,
            "max_tokens": max(500, len(text) * 2)
        }

        try:
            res = requests.post(self.endpoint_url, headers=headers, json=payload, timeout=30)
            if res.status_code == 200:
                data = res.json()
                translated = (data.get("response") or "").strip()
                if translated:
                    return {"available": True, "text": translated}
            logger.warning(f"Qwen translate call failed: {res.status_code} - {res.text[:300]}")
        except Exception as e:
            logger.error(f"Error calling Qwen translate endpoint: {e}")

        return {"available": False, "text": text}

    def decide_tool(self, query: str, tools: List[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
        """
        Tool-selection fallback for when GLM's own tool-selection call is
        unavailable -- the one point in the agent loop where a genuine dead
        end can happen (every other failure has a previously-fetched tool
        result to fall back to). Deliberately scoped to JUST picking a tool
        + parameters, not writing the rich analytical narrative GLM's full
        system prompt asks for -- that's a much smaller, more reliable ask
        for a differently-tuned model on a single-shot, no-history budget;
        the narrative still comes from the tool's own grounded text_result,
        or a later successful GLM synthesis call if GLM recovers by
        iteration 2.

        Returns None (never a fabricated guess) if Qwen's response isn't
        valid JSON with a 'tool' or 'text_response' field, so the caller
        can fall through to the deterministic keyword router instead of
        trusting a malformed decision. The caller is responsible for
        disclosing that this fallback was used (a citation, not silence --
        see the note on ai_unavailable in agent_loop.py about never
        presenting a non-GLM-reasoned answer as if it were full reasoning).
        """
        if not self.is_configured():
            return None
        token = get_cached_access_token()
        if not token:
            return None

        tool_lines = "\n".join(
            f"- {t['name']}: {t['description']}. Parameters: {json.dumps(t['parameters'])}" for t in tools
        )
        prompt = (
            "Ignore the attached image, it is blank and irrelevant. You are helping pick which database tool to "
            "run for a Karnataka Police officer's query. Respond with ONLY a JSON object: either "
            '{"tool": "<tool_name>", "parameters": {...}} if one of the tools below clearly matches, or '
            '{"text_response": "<a short clarifying question>"} if none of them do or a required parameter '
            "(like a name or case number) is missing from the query. No explanation outside the JSON.\n\n"
            f"Available tools:\n{tool_lines}\n\n"
            f"Officer's query: {query}"
        )

        headers = {
            "Authorization": f"Zoho-oauthtoken {token}",
            "Content-Type": "application/json",
            "CATALYST-ORG": self.org_id
        }
        if self.endpoint_key:
            headers["X-QUICKML-ENDPOINT-KEY"] = self.endpoint_key

        payload = {
            "prompt": prompt,
            "model": self.model_name,
            "images": [_BLANK_PNG_B64],
            "system_prompt": "Output only a single valid JSON object, nothing else.",
            "top_k": 50,
            "top_p": 0.9,
            "temperature": 0.1,
            "max_tokens": 400
        }

        try:
            res = requests.post(self.endpoint_url, headers=headers, json=payload, timeout=30)
            if res.status_code == 200:
                data = res.json()
                raw = (data.get("response") or "").strip()
                match = re.search(r"\{.*\}", raw, re.DOTALL)
                if match:
                    parsed = json.loads(match.group(0))
                    if "tool" in parsed or "text_response" in parsed:
                        return parsed
                logger.warning(f"Qwen tool-decision response wasn't usable JSON: {raw[:300]!r}")
            else:
                logger.warning(f"Qwen tool-decision call failed: {res.status_code} - {res.text[:300]}")
        except Exception as e:
            logger.error(f"Error calling Qwen tool-decision endpoint: {e}")

        return None
