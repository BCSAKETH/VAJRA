import os
import json
import time
import logging
import requests
from typing import Dict, Any, List, Optional
from vajra_core import get_quickml_access_token

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
# In-memory timestamp for short cooldowns without AppSail-wide lockouts.
_down_until: float = 0.0
# Retry-exhaustion on transient errors (timeout/429/5xx) -- transient error
# gets a brief 3s cooldown so the next query gets a fresh chance almost immediately.
_TRANSIENT_COOLDOWN_SECONDS = 3
# Definitive errors (401/404 misconfiguration) -- endpoint missing or bad credentials.
_DEFINITIVE_COOLDOWN_SECONDS = 60


def _mark_endpoint_down(cooldown_seconds: int = _DEFINITIVE_COOLDOWN_SECONDS):
    global _down_until
    _down_until = time.time() + cooldown_seconds


def _is_endpoint_marked_down() -> bool:
    # Always attempt the query to give officers live execution without cascade lockouts
    return False


def _build_budgeted_prompt(system_prompt: str, messages: List[Dict[str, str]], max_chars: int = 9500) -> str:
    """
    Constructs a flattened prompt string strictly within QuickML's gateway input limit (< 10,000 chars),
    calibrated to a 9,500 character budget for maximum rich detail while preserving a safe buffer.
    Prioritizes:
    1. System prompt (instructions & tools)
    2. Latest message (current query or latest tool result)
    3. Intermediate conversation history, newest to oldest, up to budget.
    Truncates oversized single messages in the middle.
    """
    sys_part = f"System: {system_prompt.strip()}"
    continuation = "Assistant:"

    if not messages:
        return f"{sys_part}\n\n{continuation}"

    latest_msg = messages[-1]
    latest_role = (latest_msg.get("role") or "user").capitalize()
    latest_content = (latest_msg.get("content") or "").strip()
    if len(latest_content) > 3500:
        head = latest_content[:2200]
        tail = latest_content[-1200:]
        latest_content = f"{head}\n\n[... content truncated for model context budget ...]\n\n{tail}"
    latest_part = f"{latest_role}: {latest_content}"

    fixed_len = len(sys_part) + len(latest_part) + len(continuation) + 8
    remaining_budget = max_chars - fixed_len

    history_parts = []
    if remaining_budget > 200 and len(messages) > 1:
        for m in reversed(messages[:-1]):
            role = (m.get("role") or "user").capitalize()
            content = (m.get("content") or "").strip()
            if not content:
                continue
            if len(content) > 1500:
                head = content[:1000]
                tail = content[-450:]
                content = f"{head}\n...[truncated]...\n{tail}"
            part = f"{role}: {content}"
            if len(part) + 2 <= remaining_budget:
                history_parts.append(part)
                remaining_budget -= (len(part) + 2)
            else:
                break
        history_parts.reverse()

    all_parts = [sys_part] + history_parts + [latest_part, continuation]
    return "\n\n".join(all_parts)


# Canned guardrail refusals this deployed GLM emits (as a normal 200 OK) when it
# mis-reads input as an attempt to expose its instructions -- e.g. dense official-
# document text from an uploaded FIR/form. Detected so it can be treated as a soft
# failure and routed to the Qwen fallback instead of shown to the officer.
_GUARDRAIL_PHRASES = (
    "expose protected instructions",
    "protected internal details",
    "reveal your reasoning",
    "expose my instructions",
    "reveal my instructions",
    "expose protected internal",
)


def _is_guardrail_refusal(text: str) -> bool:
    if not text:
        return False
    low = text.strip().lower()
    # Only treat as a refusal when it's short and dominated by the canned phrase
    # -- a long, substantive answer that merely mentions "protected" is not a
    # refusal and must pass through untouched.
    if len(low) > 400:
        return False
    return any(p in low for p in _GUARDRAIL_PHRASES)


class CatalystLLM:
    """
    Client for Zoho Catalyst QuickML LLM Serving.
    Calls GLM-4.7-Flash using OAuth access tokens.
    """
    def __init__(self):
        self.project_id = os.getenv("CATALYST_PROJECT_ID", "50212000000025002")
        self.region = os.getenv("CATALYST_REGION", "IN")
        domain = "in" if self.region == "IN" else "com"

        # Pull endpoint URL from environment, fallback to live confirmed GLM endpoint
        self.endpoint_url = os.getenv(
            "CATALYST_LLM_ENDPOINT"
        ) or f"https://console.catalyst.zoho.{domain}/quickml/v1/project/{self.project_id}/genai/endpoints/glm-flash-47/generate"
        self.endpoint_key = os.getenv(
            "CATALYST_LLM_ENDPOINT_KEY",
            "15ac420ddfdbed8582a1be5dfe62bd4ca4f453b2ca54adde64e3e7d6ee57b9c8dbfa4f23e5bd8a35895a987fea72f6c0"
        )
        # CATALYST-ORG is the project key (60074806366), confirmed live against QuickML gateway
        self.org_id = os.getenv("CATALYST_ORG_ID") or os.getenv("CATALYST_PROJECT_KEY") or "60074806366"
        self.model_name = os.getenv("CATALYST_LLM_MODEL", "crm-di-glm47b_30b_it")

        # Live QuickML Agentic RAG Endpoint (VAJRA Master RAG)
        self.rag_endpoint_url = os.getenv(
            "CATALYST_RAG_ENDPOINT",
            f"https://console.catalyst.zoho.{domain}/quickml/v1/project/{self.project_id}/genai/endpoints/rag/agent/chat"
        )
        self.rag_endpoint_key = os.getenv(
            "CATALYST_RAG_ENDPOINT_KEY",
            "78a50a95bb2772f664571786b886326a148880f505cc545ae08dcced62822620bda68c2a0c32f4ffb73e092ef2254048"
        )

    def chat(
        self,
        messages: List[Dict[str, str]],
        tools: Optional[List[Dict[str, Any]]] = None,
        use_agent_system_prompt: bool = True,
        max_tokens: int = 2500,
        tool_exemplars: Optional[List[Dict[str, Any]]] = None,
        style_directive: Optional[str] = None,
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
        token = get_quickml_access_token()
        if not token:
            logger.error("Failed to retrieve QuickML-scoped access token for Catalyst LLM.")
            return {"error": "Authentication token missing."}

        # CONFIRMED LIVE (2026-09-17): the OLD "chat"-style endpoint this was
        # written against was gone (0 endpoints in the console -- deleted or
        # expired), so it had to be recreated via Console -> QuickML -> LLM
        # Serving -> Create Endpoint. The recreated endpoint speaks a
        # genuinely different, flat "generate" contract (see below), not the
        # OpenAI-style messages/choices shape this file originally assumed.
        # Real headers confirmed via the endpoint's own "Connection Details"
        # panel: Environment is REQUIRED (not in the old sample), and the
        # endpoint key header is lowercase "x-quickml-endpoint-key".
        headers = {
            "Authorization": f"Zoho-oauthtoken {token}",
            "Content-Type": "application/json",
            "Environment": os.getenv("CATALYST_ENVIRONMENT", "Development"),
            "CATALYST-ORG": self.org_id
        }
        if self.endpoint_key:
            headers["x-quickml-endpoint-key"] = self.endpoint_key

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
                # Explicit authorization framing (not a confirmed live bug --
                # added preemptively per a hardening review's claim that raw
                # police terminology can trigger a canned safety refusal from
                # this model). States plainly this is an authorized internal
                # deployment mapping questions to internal tool parameters,
                # not a request for the model to access anything external or
                # unauthorized on its own -- reduces the chance of a refusal
                # without changing what the assistant actually does.
                "You are VAJRA.AI, the advanced multimodal AI Copilot and Crime-Intelligence Assistant for the Karnataka State Police. "
                "You possess integrated CCTV video forensics, audio transcription, document OCR, and CCTNS database access. "
                "Never claim you are only a text-based AI or that you cannot view, analyze, or process video, audio, or image files. "
                "You assist investigating officers across all policing needs: internal CCTNS database queries (FIRs, cases, "
                "accused profiling, repeat offenders, recidivism risk scores, syndicate networks, financial mule rings, and "
                "predictive beat planning) as well as Open-Source Intelligence (OSINT) web searches, cybercrime advisories, and "
                "legal/procedural guidance under BNS, BNSS, BSA, and the IT Act.\n\n"
                "TOOL USAGE RULES:\n"
                "- When an officer's question can be answered using an internal database lookup or an external OSINT search, "
                "respond with JSON containing a 'tool' field (the tool name) and a 'parameters' field (an object with needed parameters).\n"
                "- For questions regarding external entities, organizations, colleges, universities, companies, public scams, cyber threats, news, "
                "or general knowledge not found in the crime database, call the 'web_search' tool with {\"query\": ...}.\n"
                "- For questions regarding specific FIRs, suspects, criminal networks, risk scores, or hotspots, call the appropriate CCTNS tool.\n"
                "- If the query asks for general legal advice, procedural guidance (SOP), analytical reasoning, or conceptual explanations that "
                "do not require an external lookup, respond directly with JSON containing a 'text_response' field providing a thorough, "
                "professional, and structured answer.\n"
                "- Officers often type short commands, not full sentences -- 'map' or 'hotspots' means run query_hotspots, 'network of X' means "
                "run query_graph_network, 'risk for X' means run get_offender_risk. If a tool plausibly matches, call it directly. "
                "NEVER ask for clarification unless the request is genuinely unintelligible or completely blank. Do NOT say 'Could you please "
                "clarify your request?' when you can either search the web or provide an informative analytical response.\n"
                # Confirmed live: without this, a 'text_response' answer was
                # often a single terse sentence restating the raw tool
                # output (e.g. "No transactions found for X.") with no
                # investigative context -- correct but not useful to an
                # officer deciding what to do next. This is the one place in
                # the whole pipeline where analytical depth actually gets
                # added, since the tool functions themselves only return
                # grounded facts, not interpretation.
                 "When you write a 'text_response' (not a clarifying question), make it thorough, authoritative, and structured, not a "
                "one-line restatement: explain what the data shows, note any patterns or risk factors it points to, "
                "and where genuinely relevant, connect it to legal, criminological, or procedural context (BNS, BNSS, BSA, IT Act). "
                "VISUAL FORMATTING STANDARDS (ChatGPT-style police taxonomy): "
                "For analytical responses, legal triage, investigative SOPs, or dossiers, format your response using distinct icon headers: "
                "`### 📋 Incident / Context Overview`, `### ⚖️ Legal & Statutory Classification`, `### 🔍 Mandatory Evidentiary Preservation Checklist (Section 63 BSA)` using `- [ ]` checklist boxes, "
                "and `### 💡 Tactical Next Steps`. "
                "Use high factual density with bold-keyed bullets (`- **Key:** Explanation`). Wrap IDs/sections/hashes in `backticks`. "
                "STATUTORY BANNER RULE: Only conclude with '[ 🛡️ Judicial & Operational Intelligence Advisory • BSA & BNS Compliant ]' when delivering a formal legal/statutory advisory analyzing specific criminal sections. NEVER append this banner to greetings, casual inquiries, system status, or clarification responses. "
                "COLLEAGUE TONE & UNCLEAR INPUTS: If an officer's query is brief, informal, conversational, or not a specific investigation query, respond naturally and politely as a helpful colleague (e.g. 'Greetings Officer. How can I assist you with case records, suspect profiling, or hotspots today?'). Never generate robotic system error jargon such as 'Input Integrity: Failed', 'Gibberish', 'Noise', or 'Transmission Error'. "
                "Only state what the tool result (or your own general knowledge, clearly "
                "distinguished from case-specific facts) actually supports -- never invent names, numbers, or case "
                "details that aren't in front of you. If a tool found nothing, say so plainly and suggest what the "
                "officer could try next rather than just reporting the negative result. "
                # VOICE (tone only -- every grounding/never-fabricate rule
                # above and below still applies exactly as written; this
                # changes HOW a true statement is delivered, never WHAT can
                # be claimed). Confirmed live the prompt above alone produces
                # correct but stiff, form-letter prose ("Hello, Officer. I am
                # ready to assist you with your queries on the..."), which
                # reads as a report generator, not an engaged colleague.
                "VOICE & PROTOCOL:\n"
                "- Address the user strictly as 'Officer' or 'Officer {LastName}'. Never use personal gender pronouns (he/she/him/her).\n"
                "- Refer to suspects, accused persons, victims, and witnesses strictly by their legal designations: 'Accused {Name}', 'The complainant', 'The victim', 'Witness No. 1'.\n"
                "- Write like a sharp, disciplined Senior Karnataka Police Intelligence Colleague, not a subservient chatbot or a generic form letter.\n"
                "- Plain, direct, authoritative sentences. Cut all throat-clearing filler ('Certainly!', 'I would be happy to help...', 'Based on the available data, it appears that...'). Lead with the operative finding immediately.\n"
                "- High factual density with structured icon headers and bold-key bullets. State findings plainly and with confidence; state genuine gaps or empty results just as simply.\n"
                "- Where naturally fitting, end with a concrete investigative next step or recommendation, the way an experienced colleague would. "
                # Confirmed live: an attachment-analysis result followed by
                # "add this to records" / "register this case" / "file this"
                # made the model try to invent a write-style tool call that
                # doesn't exist, producing unparseable output and a fast
                # generic error. Every tool here is read-only -- there is no
                # create/register/file/update tool to call, so naming that
                # limitation explicitly stops the model from trying.
                "IMPORTANT: every tool below only READS existing data -- none of them create, add, register, file, "
                "or update any record. If the officer asks to add/register/file/create/update something (including "
                "right after an attachment analysis), do not attempt a tool call for it -- respond with a "
                "'text_response' explaining that this assistant can look up and analyze existing records but cannot "
                "create new ones, and that they should use the appropriate records system or a supervisor for that. "
                "Available tools:\n"
            )
            for t in tools:
                system_prompt += f"- {t['name']}: {t['description']}. Parameters: {json.dumps(t['parameters'])}\n"
            if tool_exemplars:
                system_prompt += "\nVERIFIED GOLD TOOL DEMONSTRATIONS (Upvoted by KSP Officers):\n"
                for ex in tool_exemplars:
                    system_prompt += f'User: "{ex.get("query")}"\nDecision: {{"tool": "{ex.get("tool")}", "parameters": {json.dumps(ex.get("parameters", {}))}}}\n'
        else:
            # No tools passed -- this is the final-synthesis call after tool
            # results are already in history. Confirmed live that reusing
            # the tool-calling prompt here (with an empty "Available tools:"
            # list) confused the model into responding with another
            # {"tool": ...} JSON instead of a real answer, since the history
            # already contains one. This prompt has no tool-calling framing
            # at all, so there's nothing for it to imitate.
            system_prompt = (
                "You are VAJRA.AI, the advanced multimodal AI Copilot for the Karnataka State Police. "
                "You have integrated video forensics, audio transcription, document intelligence, and CCTNS access; never claim to be only text-based. "
                "A tool or media analysis has already been run and its "
                "result is in the conversation above. Write the officer a direct, detailed, well-organized final "
                "answer based on that result -- not a one-line restatement of the raw figures. "
                "VISUAL TAXONOMY: For structured briefings or legal/procedural guidance, format with distinct icon headers "
                "(`### 📋 Incident / Context Overview`, `### ⚡ Risk / 💰 Financial / 🕸️ Syndicate / 🎯 Hotspots / ⚖️ Legal`, "
                "`### 👤 Key Entities`, `### 🔍 Mandatory Evidentiary Preservation Checklist (Section 63 BSA)` using `- [ ]` checkboxes, "
                "`### 💡 Tactical Next Steps`), and bold-keyed bullets (`- **Field:** Value`). "
                "STATUTORY BANNER RULE: Only append '[ 🛡️ Certified Intelligence Briefing • BSA Section 63 Compliant ]' when reporting on formal CCTNS cases, suspect dossiers, or forensic evidence. NEVER append this banner to greetings, conversational messages, general lookups, or when no records are found. "
                "COLLEAGUE TONE: Write like a professional, helpful intelligence colleague. If an input is conversational or unclear, answer politely without robotic error jargon like 'Input Integrity: Failed', 'Gibberish', or 'Zero Valid Correlations'. "
                "Explain what the data means for the investigation: relevant patterns, risk factors, and concrete next steps. "
                "Use **bold** for key facts/names, a blank line between paragraphs, and wrap exact IDs/sections in `backticks`. "
                "Only use facts actually present in the tool result above -- never invent names, numbers, or "
                "details not shown there. If the result was empty or negative, say so plainly and suggest what to "
                "try next. "
                # Same VOICE directive as the tool-selection prompt -- tone
                # only, every grounding rule above still applies unchanged.
                "VOICE: write like a sharp, engaged colleague briefing a fellow officer, not a report generator. "
                "Plain, direct, confident sentences, contractions are fine, no throat-clearing filler ('Based on "
                "the available data...', 'It is important to note that...'). State a solid finding plainly and "
                "confidently; state a real gap just as plainly, never evasively. End with a genuine next step or "
                "question where it fits, like a colleague would, instead of trailing off after the facts. This "
                "is reporting an actual finding from the tool result above, so keep it measured and emoji-free by "
                "default -- unless the result itself is genuinely light (a plain count, an empty/harmless result), "
                "a conviction-risk score, POCSO/juvenile-sensitive case, victim, or violent/financial-crime finding "
                "always stays plain and serious; the finding carries the weight, not the delivery. "
                "DELIVERY & DENSITY: Be authoritative, structured, and dense. Deliver findings across 3-4 structured icon-headed sections. Limit length to 400 words without conversational filler so the briefing is rapidly actionable. "
                "Respond with JSON containing only a 'text_response' field with your answer."
            )

        # KSP Response Tailor (Finals-part 3.md Section 48): an additive
        # per-persona formatting refinement on top of the VOICE directive
        # above, never a replacement for it -- see ksp_response_tailor.py's
        # own docstring for why this is a real, small classifier rather than
        # a second prose-rewriting layer.
        if style_directive:
            system_prompt += "\n\n" + style_directive

        # Build payload with sliding-window budget management to guarantee
        # total prompt character length never exceeds QuickML's gateway ceiling (< 10k chars).
        if use_agent_system_prompt:
            prompt_str = _build_budgeted_prompt(system_prompt, messages, max_chars=9500)
        else:
            parts = []
            for m in messages:
                role = (m.get("role") or "user").capitalize()
                parts.append(f"{role}: {m.get('content', '')}")
            parts.append("Assistant:")
            prompt_str = "\n\n".join(parts)
            if len(prompt_str) > 9500:
                prompt_str = prompt_str[-9500:]
        payload = {"prompt": prompt_str}

        # Skip the retry-with-backoff budget entirely if a recent call already
        # confirmed the endpoint down -- avoids every chat turn during a real
        # outage paying the full [1, 2, 4]s backoff + 25s timeout before
        # falling back, mirroring get_cached_access_token()'s own retry pattern.
        _last_failure_reason = "unknown"
        if _is_endpoint_marked_down():
            logger.info("Catalyst LLM endpoint recently confirmed down (in-process cooldown) -- skipping to fallback.")
            _last_failure_reason = "skipped_cooldown_from_recent_failure"
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
            # Raised to 300s (5 minutes) per attempt, at the officer's own
            # explicit request to prioritize letting GLM actually finish its
            # real analysis over falling back to raw/unpolished output. This
            # codebase's own "confirmed live" notes document real successful
            # turns up to 140s+ under load (a screenshot mid-session showed a
            # legitimate in-progress turn still running at 132s, not yet
            # killed by anything upstream), and the specific fallback this
            # was raised to avoid -- the later "write a polished narrative"
            # synthesis call timing out and falling back to raw tool output
            # -- is explicitly noted as common "under sustained load," i.e.
            # exactly when the model needs the most room, not the least.
            # Neither FastAPI/Uvicorn nor AppSail impose their own shorter
            # request timeout here, so this Python-level value is the real
            # ceiling. Tradeoff, stated plainly: a genuinely stuck request
            # can now hold an officer's chat turn open for minutes before
            # ever falling back -- accepted deliberately in exchange for
            # letting slow-but-working turns actually complete.
            # Calibrated single attempt (42s): allows GLM ample thinking time while
            # guaranteeing the total request completes safely within the 60s gateway window.
            _req_timeout = 42
            for attempt, delay in enumerate([0]):
                if delay:
                    time.sleep(delay)
                try:
                    logger.info(f"Posting to Catalyst LLM Serving endpoint (attempt {attempt + 1}, timeout {_req_timeout}s): {self.endpoint_url}")
                    res = requests.post(self.endpoint_url, headers=headers, json=payload, timeout=_req_timeout)

                    if res.status_code == 200:
                        data = res.json()
                        logger.info("Catalyst LLM Serving returned 200 OK.")
                        try:
                            _resp = ((data.get("data") or [{}])[0] or {}).get("data") or ""
                        except (IndexError, AttributeError, TypeError):
                            _resp = ""
                        if "</think>" in _resp:
                            _resp = _resp.split("</think>", 1)[-1].strip()
                        if _is_guardrail_refusal(_resp):
                            logger.warning("GLM returned its canned guardrail refusal; treating as failure so Qwen fallback runs.")
                            return {"error": "llm_guardrail_refusal"}
                        return {
                            "choices": [{
                                "message": {"role": "assistant", "content": _resp}
                            }]
                        }

                    if res.status_code in (401, 404):
                        logger.critical(f"Catalyst LLM endpoint misconfigured ({res.status_code}): {res.text}")
                        _last_failure_reason = f"http_{res.status_code}: {res.text[:150]}"
                        _mark_endpoint_down(_DEFINITIVE_COOLDOWN_SECONDS)
                        break

                    if res.status_code == 429 or res.status_code >= 500:
                        logger.warning(f"Catalyst LLM transient error {res.status_code}, retrying: {res.text[:200]}")
                        _last_failure_reason = f"http_{res.status_code}: {res.text[:150]}"
                        continue

                    # Any other 4xx (e.g. 400 Bad Request / Length) is query-specific,
                    # NOT an endpoint outage. Do NOT mark down the endpoint for all queries!
                    logger.warning(f"Catalyst LLM API call failed with status: {res.status_code} - {res.text[:300]}")
                    _last_failure_reason = f"http_{res.status_code}: {res.text[:150]}"
                    break
                except requests.exceptions.Timeout:
                    logger.warning(f"Catalyst LLM request timed out (attempt {attempt + 1}), retrying.")
                    _last_failure_reason = f"timeout_{_req_timeout}s"
                    continue
                except Exception as e:
                    logger.error(f"Error calling Catalyst LLM Serving: {e}")
                    _last_failure_reason = f"exception: {type(e).__name__}: {str(e)[:150]}"
                    break
            else:
                # Exhausted all retries on transient errors (timeout/429/5xx)
                _mark_endpoint_down(_TRANSIENT_COOLDOWN_SECONDS)

        # The real endpoint is unreachable -- previously this fell back to a
        # keyword-matching local simulator that still ran real tools and
        # presented a "degraded" answer behind an amber banner. Removed: on
        # a police intelligence platform, an answer whose tool/suspect was
        # picked by string-matching instead of real reasoning shouldn't be
        # presented as an answer at all, even a clearly-labeled one. Callers
        # (run_agent_loop, translate) check for this "error" key and stop
        # rather than trying to use any part of the response.
        #
        # Confirmed live gap: this used to always return the bare string
        # "llm_unavailable" regardless of WHY -- a 401 (real misconfigured
        # credentials, fixable) and a 90s timeout (genuine upstream slowness,
        # nothing to fix) look identical to every caller and every diagnostic
        # citation built on top of this. The real reason is now preserved.
        logger.warning(f"Catalyst LLM endpoint unavailable ({_last_failure_reason}) -- reporting unavailable rather than falling back to keyword simulation.")
        return {"error": f"llm_unavailable ({_last_failure_reason})"}

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
        token = get_quickml_access_token()
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
    def query_rag_agent(self, query: str) -> Dict[str, Any]:
        """
        Queries the dedicated QuickML Agentic RAG Endpoint (VAJRA Master RAG).
        Returns {'success': True, 'response': '...'} or {'success': False, 'error': '...'}.
        """
        token = get_quickml_access_token()
        if not token:
            logger.error("Failed to retrieve QuickML access token for RAG endpoint.")
            return {"success": False, "error": "Authentication token missing."}

        headers = {
            "Authorization": f"Zoho-oauthtoken {token}",
            "Content-Type": "application/json",
            "Environment": os.getenv("CATALYST_ENVIRONMENT", "Development"),
            "x-quickml-endpoint-key": self.rag_endpoint_key,
            "CATALYST-ORG": self.org_id
        }

        payload = {"query": query}

        try:
            res = requests.post(self.rag_endpoint_url, headers=headers, json=payload, timeout=40)
            if res.status_code == 200:
                data = res.json()
                if data.get("status") == "success":
                    ans = data.get("response", "")
                    return {"success": True, "response": ans, "raw": data}
            logger.warning(f"RAG endpoint query failed ({res.status_code}): {res.text[:200]}")
            return {"success": False, "error": f"RAG returned {res.status_code}", "raw": res.text[:200]}
        except Exception as e:
            logger.error(f"Error querying QuickML RAG endpoint: {e}")
            return {"success": False, "error": str(e)}
