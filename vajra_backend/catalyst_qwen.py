import os
import re
import json
import base64
import logging
import requests
from typing import List, Dict, Any, Optional
from vajra_core import get_quickml_access_token

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

    def _call(self, prompt: str, images_b64: List[str]) -> Optional[str]:
        """
        Shared request path for every method below. CONFIRMED LIVE
        (2026-09-17) against the recreated endpoint's real contract: true
        multipart/form-data (NOT a JSON body -- a JSON body 500s with
        INTERNAL_SERVER_ERROR), with "images" as a JSON-encoded array
        STRING (not a real multipart array/file part -- a repeated "images"
        field 400s with JSON_PARSE_ERROR) and "prompt" as a plain text
        field. Also requires the "Environment" header GLM's endpoint needs
        (see catalyst_llm.py). Only these two fields are accepted --
        temperature/top_k/top_p/max_tokens are no longer per-request; they're
        fixed by this endpoint's bound Saved Configuration in the console.
        Returns the raw response text, or None on any failure (never a
        fabricated analysis).
        """
        if not self.is_configured():
            return None
        token = get_quickml_access_token()
        if not token:
            return None
        headers = {
            "Authorization": f"Zoho-oauthtoken {token}",
            "Environment": os.getenv("CATALYST_ENVIRONMENT", "Development"),
            "CATALYST-ORG": self.org_id
        }
        if self.endpoint_key:
            headers["x-quickml-endpoint-key"] = self.endpoint_key
        # requests sets the correct multipart boundary automatically when
        # given `files=` -- do NOT set Content-Type manually here, it must
        # include that boundary parameter or the server can't parse it.
        files = [
            ("images", (None, json.dumps(images_b64))),
            ("prompt", (None, prompt)),
        ]
        try:
            # 90s, matching catalyst_llm.py's own per-attempt ceiling (same
            # request, same reasoning) -- this is the fallback used both for
            # tool-selection (when GLM is down) and translation (the last of
            # three tiers, after Zia and GLM), so a tight timeout here
            # cascades a single slow-but-working call into a full failure.
            res = requests.post(self.endpoint_url, headers=headers, files=files, timeout=90)
            if res.status_code == 200:
                data = res.json()
                return (data.get("response") or "").strip()
            logger.warning(f"Qwen call failed: {res.status_code} - {res.text[:300]}")
        except Exception as e:
            logger.error(f"Error calling Qwen endpoint: {e}")
        return None

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

        images_b64 = [base64.b64encode(b).decode("utf-8") for b in image_bytes_list[:3]]
        prompt = instruction or (
            "Extract and describe all investigatively relevant content from this evidence "
            "attachment: any text (OCR), identifiable objects, people, and context. Be concise "
            "and factual -- this is for a police case file, not a general description."
        )
        text = self._call(prompt, images_b64)
        if text:
            return {"available": True, "text": text}
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

        src_name = self._LANG_NAMES.get(source_lang, source_lang)
        tgt_name = self._LANG_NAMES.get(target_lang, target_lang)
        prompt = (
            f"Ignore the attached image, it is blank and irrelevant. Translate the following "
            f"{src_name} text to {tgt_name}. Output ONLY the translation, no explanation, "
            f"preserving all numbers exactly:\n\n{text}"
        )
        translated = self._call(prompt, [_BLANK_PNG_B64])
        if translated:
            return {"available": True, "text": translated}
        return {"available": False, "text": text}

    def plan(self, system_prompt: str, user_content: str, max_tokens: int = 3500) -> Optional[str]:
        """
        Generic single-shot planning fallback for vajra_cognitive_brain.py's
        semantic compiler: when GLM's own planning call errors out OR hits
        its baked-in guardrail refusal (confirmed live -- see catalyst_llm.py's
        _is_guardrail_refusal), the compiler previously had NO fallback at
        all for this specific call (unlike the agent loop's tool-selection
        call, which already falls back to decide_tool() above) -- both
        retry attempts just hit the same unreliable GLM path twice. Reuses
        this same Qwen deployment as a differently-tuned second model that
        doesn't share GLM's outage windows or this exact guardrail quirk.
        Returns the raw response text for the caller to JSON-parse (same
        contract as GLM's own raw content), or None on any failure -- never
        a fabricated plan.
        """
        if not self.is_configured():
            return None
        prompt = (
            f"{system_prompt}\n\nOutput only a single valid JSON object, nothing else -- no "
            f"prose, no markdown.\n\nOfficer's request: {user_content}"
        )
        return self._call(prompt, [_BLANK_PNG_B64])

    def decide_tool(
        self,
        query: str,
        tools: List[Dict[str, Any]],
        entity_context: Optional[Dict[str, Any]] = None,
    ) -> Optional[Dict[str, Any]]:
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

        entity_context (optional): {"case_id", "suspect", "district"} already
        resolved by _resolve_entities for this session. Confirmed live: this
        call is single-shot with no conversation history at all -- a
        follow-up like "list out all the 10+" or "what about Mysuru?" gives
        Qwen nothing to resolve "the 10+"/"what about" against, so it
        answers as if the message were the start of a brand new
        conversation. This can't give Qwen real multi-turn memory (still one
        prompt, no message list), but prepending the entities GLM itself
        already carries across turns is a small, structural improvement for
        exactly the turns most likely to need it -- worth doing given how
        often this path now runs (every turn during a GLM cooldown window,
        not just when GLM is fully down).
        """
        if not self.is_configured():
            return None

        tool_lines = "\n".join(
            f"- {t['name']}: {t.get('description', '')}. Parameters: {json.dumps(t.get('parameters', {}))}" for t in tools
        )
        context_line = ""
        if entity_context:
            parts = []
            if entity_context.get("case_id"):
                parts.append(f"case {entity_context['case_id']}")
            if entity_context.get("suspect"):
                parts.append(f"suspect {entity_context['suspect']}")
            if entity_context.get("district"):
                parts.append(f"district {entity_context['district']}")
            if parts:
                context_line = (
                    f"Context from earlier in this conversation (use this to resolve vague references like "
                    f"'that case', 'the suspect', 'them', or 'what about...' in the query below, but ONLY if the "
                    f"query itself doesn't already name something more specific): {', '.join(parts)}.\n\n"
                )
        prompt = (
            "Ignore the attached image, it is blank and irrelevant. You are VAJRA's tool router for a Karnataka Police officer's query. "
            "If the query asks about external entities, colleges, universities, companies, scams, news, cyber threats, or general topics, "
            "pick the 'web_search' tool with parameters {\"query\": \"" + query.replace('"', '\\"') + "\"}. "
            "If the query matches an internal CCTNS crime database tool, pick that tool. "
            "Respond with ONLY a JSON object: either "
            '{"tool": "<tool_name>", "parameters": {...}} or '
            '{"text_response": "<an informative direct answer or explanation>"} if the question can be answered directly without a tool. '
            "Never ask for clarification if you can search the web or answer directly. No explanation outside the JSON.\n\n"
            f"Available tools:\n{tool_lines}\n\n"
            f"{context_line}"
            f"Officer's query: {query}"
        )

        raw = self._call(prompt, [_BLANK_PNG_B64])
        if raw:
            match = re.search(r"\{.*\}", raw, re.DOTALL)
            if match:
                try:
                    parsed = json.loads(match.group(0))
                    if "tool" in parsed or "text_response" in parsed:
                        return parsed
                except json.JSONDecodeError:
                    pass
            logger.warning(f"Qwen tool-decision response wasn't usable JSON: {raw[:300]!r}")

        return None
