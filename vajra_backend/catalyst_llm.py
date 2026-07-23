import os
import json
import time
import logging
import requests
from typing import Dict, Any, List, Optional
from vajra_core import get_cached_access_token

logger = logging.getLogger("catalyst_llm")

# In-process cooldown timestamp -- deliberately NOT backed by Catalyst
# Cache. Cache's expiry_in_hours is whole-hours-only (no finer TTL
# granularity available), so the previous Cache-backed flag couldn't
# express anything shorter than a 1-hour "assume down" window. Confirmed
# live: this deployed model is a "thinking" model with real response times
# ranging 15-140s+ (longer when a turn needs two sequential LLM calls), so
# a single unlucky query timing out on both retry attempts is normal
# variance, not proof the service is actually down -- but it still tripped
# the old flag and made every OTHER officer's chat report "AI unavailable"
# for up to an hour. An in-memory timestamp gives an exact, short cooldown
# instead. The tradeoff (not shared across separate worker processes) is
# free here: this backend runs as a single AppSail process.
_down_until: float = 0.0
# Retry-exhaustion on transient errors (timeout/429/5xx) -- the failure
# class that's most likely to just be "this one request was slow," not a
# real outage. Short enough that the next officer's query gets a fresh
# real attempt within a minute rather than inheriting someone else's bad luck.
_TRANSIENT_COOLDOWN_SECONDS = 45
# Definitive errors (401/404 misconfiguration, other clean 4xx, connection
# exceptions) -- these mean something is actually broken (bad credentials,
# bad URL) and won't self-heal by just waiting a few seconds, so it's worth
# skipping the retry budget for longer.
_DEFINITIVE_COOLDOWN_SECONDS = 300


def _mark_endpoint_down(cooldown_seconds: int = _DEFINITIVE_COOLDOWN_SECONDS):
    global _down_until
    _down_until = time.time() + cooldown_seconds


def _is_endpoint_marked_down() -> bool:
    return time.time() < _down_until


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
        use_agent_system_prompt: bool = True,
        max_tokens: int = 2500
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
                "When you can answer directly without a tool, or the query is genuinely ambiguous between two or "
                "more DIFFERENT tools, respond with JSON containing a 'text_response' field with your answer or "
                "clarifying question. "
                # Confirmed live: a one-word query like "map" produced 25+
                # steps of internal deliberation before asking a clarifying
                # question, even though query_hotspots was the only tool
                # that plausibly matched -- officers typing short commands
                # ("map", "hotspots", "network of X") expect the obvious
                # tool to just run, not a clarifying question back.
                "Officers often type short commands, not full sentences -- 'map' or 'hotspots' means run "
                "query_hotspots, 'network of X' or 'connections for X' means run query_graph_network with that "
                "name, 'risk for X' means run get_offender_risk. If exactly one tool plausibly matches, call it "
                "directly -- do not ask a clarifying question just because the wording was brief. Only ask for "
                "clarification when the request could equally mean two or more different tools, or a required "
                "parameter (like a name or case number) is completely missing. "
                # Confirmed live: without this, a 'text_response' answer was
                # often a single terse sentence restating the raw tool
                # output (e.g. "No transactions found for X.") with no
                # investigative context -- correct but not useful to an
                # officer deciding what to do next. This is the one place in
                # the whole pipeline where analytical depth actually gets
                # added, since the tool functions themselves only return
                # grounded facts, not interpretation.
                "When you write a 'text_response' (not a clarifying question), make it thorough and useful, not a "
                "one-line restatement: explain what the data shows, note any patterns or risk factors it points to, "
                "and where genuinely relevant, connect it to criminological or sociological context (e.g. what a "
                "repeat MO match, a district's economic-stress index, or a high SHAP-weighted feature implies for "
                "the investigation) and suggest concrete next steps or leads. Use short paragraphs or bullet points "
                "for multi-part answers. Only state what the tool result (or your own general knowledge, clearly "
                "distinguished from case-specific facts) actually supports -- never invent names, numbers, or case "
                "details that aren't in front of you. If a tool found nothing, say so plainly and suggest what the "
                "officer could try next rather than just reporting the negative result. "
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
                "result is in the conversation above. Write the officer a direct, detailed, well-organized final "
                "answer based on that result -- not a one-line restatement of the raw figures. Explain what the "
                "data means for the investigation: relevant patterns, risk factors, and where genuinely relevant, "
                "criminological or sociological context (e.g. what a repeat MO match, an economic-stress index, or "
                "a high-weighted risk feature implies). Suggest concrete next steps or investigative leads when the "
                "data supports them. Use short paragraphs or bullet points for answers covering multiple points. "
                "Only use facts actually present in the tool result above -- never invent names, numbers, or "
                "details not shown there. If the result was empty or negative, say so plainly and suggest what to "
                "try next. Respond with JSON containing only a 'text_response' field with your answer."
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
            "max_tokens": max_tokens,
            "stream": False
        }

        # Skip the retry-with-backoff budget entirely if a recent call already
        # confirmed the endpoint down -- avoids every chat turn during a real
        # outage paying the full [1, 2, 4]s backoff + 25s timeout before
        # falling back, mirroring get_cached_access_token()'s own retry pattern.
        if _is_endpoint_marked_down():
            logger.info("Catalyst LLM endpoint recently confirmed down (in-process cooldown) -- skipping to fallback.")
        else:
            # Confirmed live: this is a "thinking" model that writes
            # extensive step-by-step reasoning before answering -- real
            # response times ranged 25-58s across early test calls. The old
            # 25s timeout with 4 short-delay retries meant most calls timed
            # out on attempts 1-2 before the model was even done thinking,
            # then burned the whole retry budget re-asking the same slow
            # question from scratch rather than just waiting for the one in
            # flight. 60s helped, but a full session's worth of real timing
            # data later showed EVERY successful call completed under 60s --
            # several within a few seconds of that ceiling (47.9s, 54.3s,
            # 55.5s observed) -- while every timeout was a genuine held-open
            # connection past 60s, never a fast rejection (no 429 seen
            # anywhere). That combination means some calls that would have
            # succeeded at 65-90s were being killed right at the edge.
            # Raised to 90s for real margin above the highest observed
            # success, not an arbitrary guess.
            for attempt, delay in enumerate([0, 3]):
                if delay:
                    time.sleep(delay)
                try:
                    logger.info(f"Posting to Catalyst LLM Serving endpoint (attempt {attempt + 1}): {self.endpoint_url}")
                    res = requests.post(self.endpoint_url, headers=headers, json=payload, timeout=90)

                    if res.status_code == 200:
                        data = res.json()
                        logger.info("Catalyst LLM Serving returned 200 OK.")
                        # Real shape confirmed live: {"response": "...",
                        # "tool_calls": [...], "usage": {...}}, not the
                        # OpenAI-style {"choices": [...]} the rest of this
                        # codebase (run_agent_loop) is written against.
                        # Normalize here so nothing downstream needs to know
                        # about this endpoint's actual wire format.
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
                # Exhausted all retries on transient errors (timeout/429/5xx)
                # -- most likely this one query was just slow, not proof the
                # service is down, so use the short cooldown.
                _mark_endpoint_down(_TRANSIENT_COOLDOWN_SECONDS)

        # The real endpoint is unreachable -- previously this fell back to a
        # keyword-matching local simulator that still ran real tools and
        # presented a "degraded" answer behind an amber banner. Removed: on
        # a police intelligence platform, an answer whose tool/suspect was
        # picked by string-matching instead of real reasoning shouldn't be
        # presented as an answer at all, even a clearly-labeled one. Callers
        # (run_agent_loop, translate) check for this "error" key and stop
        # rather than trying to use any part of the response.
        logger.warning("Catalyst LLM endpoint unavailable -- reporting unavailable rather than falling back to keyword simulation.")
        return {"error": "llm_unavailable"}

    def translate(self, text: str, source_lang: str, target_lang: str) -> Dict[str, Any]:
        """
        Plain-text translation via the same GLM endpoint used for chat.
        Reuses chat()'s retry/timeout/down-flag handling via
        use_agent_system_prompt=False, which skips the tool-calling system
        prompt entirely -- a translation request has nothing to do with tool
        selection, and asking the model to also produce a JSON envelope for
        a plain translation is another chance for it to fail for no benefit.
        Replaces the old IndicTrans2Translator stub in main.py, which never
        actually translated anything -- it always returned a canned
        "[Translation Unavailable]" string regardless of input.
        """
        lang_names = {"en": "English", "kn": "Kannada"}
        src_name = lang_names.get(source_lang, source_lang)
        tgt_name = lang_names.get(target_lang, target_lang)

        messages = [
            {"role": "system", "content": (
                f"You are a precise {src_name}-to-{tgt_name} translator for Karnataka Police "
                f"investigative records. Translate the user's text faithfully, preserving names, "
                f"case numbers, and technical/legal terms exactly as written. Respond with ONLY "
                f"the translated {tgt_name} text -- no explanation, no quotes, no commentary."
            )},
            {"role": "user", "content": text}
        ]

        # Confirmed live: this model's step-by-step reasoning for a
        # translation task can run long enough to exhaust even 2500 tokens
        # before it ever emits </think> -- a real correct translation was
        # visible mid-reasoning ("Final Polish: ಡೇಟಾಬೇಸ್ ...") but got cut
        # off before the model committed to it as the final answer. 4000
        # gives it room to finish thinking on a task this simple.
        res = self.chat(messages, tools=None, use_agent_system_prompt=False, max_tokens=4000)
        if res.get("error"):
            return {"available": False, "text": text}
        try:
            content = res["choices"][0]["message"]["content"]
        except Exception:
            return {"available": False, "text": text}

        # No </think> means the response was cut off mid-reasoning (this
        # model always emits it once done thinking, confirmed across every
        # successful call observed) -- content before that point is a
        # reasoning draft, not a committed final answer, and returning it
        # as if it were the translation risks showing an officer a garbled
        # partial sentence instead of an honest "unavailable".
        if "</think>" not in content:
            logger.warning("Translation response truncated before </think> -- reporting unavailable rather than returning a partial reasoning fragment.")
            return {"available": False, "text": text}

        clean = content.split("</think>")[-1].strip()
        return {"available": True, "text": clean} if clean else {"available": False, "text": text}

    def translate_fast(self, text: str, source_lang: str, target_lang: str) -> Dict[str, Any]:
        """
        Fast-path translation via Zia's dedicated Text Translation model --
        a completely separate deployment from the GLM chat endpoint, not the
        "thinking" model at all. Confirmed live: ~0.7-2s round trip vs GLM's
        15-250s+, correct fluent output for both en->kn and kn->en on clean
        text. Supports en/hi/kn/ta/te/ml/mr/bn/gu/pa/or per the console.

        Has an undocumented, strict input validator confirmed live to reject
        '%', '*', '(', ')', '#', and '+' with a generic 400
        PATTERN_NOT_MATCHED error that gives no hint which character caused
        it. Callers translating VAJRA-generated text (markdown-formatted,
        full of percentages and parenthetical citations) MUST sanitize
        first -- see GLMTranslator._sanitize_for_fast_translate in main.py.
        Any failure here (network, validation, unsupported language) must be
        treated as "fall back to the slower GLM path", never surfaced to the
        officer as a translation failure -- this is a speed optimization
        layered in front of the existing translate(), not a replacement for
        its correctness guarantees.
        """
        token = get_cached_access_token()
        if not token:
            return {"available": False, "text": text}
        domain = "in" if self.region == "IN" else "com"
        url = f"https://api.catalyst.zoho.{domain}/quickml/api/v1/models/zia/translate"
        headers = {
            "Authorization": f"Zoho-oauthtoken {token}",
            "CATALYST-ORG": self.org_id,
            "Content-Type": "application/json",
        }
        payload = {"text": text, "src_lang": source_lang, "tgt_lang": target_lang}
        try:
            res = requests.post(url, headers=headers, json=payload, timeout=15)
            if res.status_code == 200:
                data = res.json()
                translated = data.get("translated_text")
                if data.get("status") == "success" and translated:
                    return {"available": True, "text": translated}
            logger.info(f"Zia fast-translate declined ({res.status_code}), falling back to GLM: {res.text[:200]}")
        except Exception as e:
            logger.info(f"Zia fast-translate unreachable, falling back to GLM: {e}")
        return {"available": False, "text": text}

    # _local_agent_simulation and _extract_suspect (keyword-matching fallback
    # tool-selection when the real LLM was unreachable) were removed here.
    # On a police intelligence platform, an answer whose tool/suspect was
    # picked by string-matching instead of real reasoning shouldn't be
    # presented as an answer at all, even a clearly-labeled "degraded" one --
    # chat() now returns {"error": "llm_unavailable"} instead, and callers
    # (run_agent_loop, translate) stop and say so plainly rather than trying
    # to answer anyway.
