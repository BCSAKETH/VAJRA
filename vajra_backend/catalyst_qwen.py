import os
import base64
import logging
import requests
from typing import List, Dict, Any, Optional
from vajra_core import get_cached_access_token

logger = logging.getLogger("catalyst_qwen")


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
