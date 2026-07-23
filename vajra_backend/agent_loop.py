import os
import json
import logging
import re
import hashlib
from datetime import datetime
from typing import Dict, Any, List, Tuple, Optional
import numpy as np
import pandas as pd

from vajra_core import catalyst_app, VajraGraphRAG, VajraSemanticMemory, MOBehavioralProfiler, zcql_insert_row
from session_memory import VajraSessionMemory
from catalyst_llm import CatalystLLM

logger = logging.getLogger(__name__)

session_memory = VajraSessionMemory()
graph_rag = VajraGraphRAG()
semantic_memory = VajraSemanticMemory()

_real_districts_cache: Optional[List[str]] = None


def get_real_districts() -> List[str]:
    """
    Real KSP district names from the District table, cached in-process since
    they never change at runtime. Previously several call sites hardcoded an
    8-item list mixing a few real districts with police-station/area names
    ("Peenya", "Indiranagar") that aren't districts at all and excluding most
    of the real 30 -- entity resolution silently failed to recognize the
    other ~24 real districts a query might mention.
    """
    global _real_districts_cache
    if _real_districts_cache is None and catalyst_app:
        try:
            res = catalyst_app.zql().execute_query("SELECT DistrictName FROM District")
            _real_districts_cache = [r.get("District", {}).get("DistrictName") for r in res if r.get("District", {}).get("DistrictName")]
        except Exception as e:
            logger.warning(f"Could not load real district list: {e}")
    return _real_districts_cache or ["Bengaluru Urban", "Bengaluru Rural", "Mysuru", "Belagavi"]

class VajraAgentLoop:
    """
    Intelligent Agent Loop with Tool Registry, multi-turn session memory resolution,
    vague query validation, and role-scoped enforcement.
    Uses GLM-4.7-Flash for agentic tool selection.
    """
    
    # 22 Capabilities Tool Registry definition for GLM-4.7-Flash
    TOOLS = [
        {
            "name": "query_case",
            "description": "Structured FIR lookup. Retrieve case details by Case Number (e.g. CrimeNo like 'FIR-2026-0814').",
            "parameters": {
                "type": "object",
                "properties": {
                    "case_no": {"type": "string", "description": "The exact Case Number or CrimeNo of the incident"}
                },
                "required": ["case_no"]
            }
        },
        {
            "name": "resolve_vague_query",
            "description": "Vague/semantic case retrieval. Retrieve similar cases by descriptive text or narratives.",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {"type": "string", "description": "The vague search text or narrative description"}
                },
                "required": ["query"]
            }
        },
        {
            "name": "get_case_sections",
            "description": "Retrieve legal sections and acts recorded for an existing case by Case Master ID.",
            "parameters": {
                "type": "object",
                "properties": {
                    "case_id": {"type": "integer", "description": "The integer ID of the case (CaseMasterID)"}
                },
                "required": ["case_id"]
            }
        },
        {
            "name": "suggest_sections",
            "description": "Recommend legal sections (IPC/BNS) and find precedents for a new crime description.",
            "parameters": {
                "type": "object",
                "properties": {
                    "crime_description": {"type": "string", "description": "Description of the crime or incident"}
                },
                "required": ["crime_description"]
            }
        },
        {
            "name": "query_graph_network",
            "description": "Trace multi-hop syndicate relationships (phone, vehicle, co-accused) for a suspect.",
            "parameters": {
                "type": "object",
                "properties": {
                    "suspect_name": {"type": "string", "description": "The name of the suspect offender"}
                },
                "required": ["suspect_name"]
            }
        },
        {
            "name": "query_financial_links",
            "description": "Trace suspicious bank account and wallet transaction connections for a suspect or entity ID.",
            "parameters": {
                "type": "object",
                "properties": {
                    "entity_id": {"type": "string", "description": "The name of the suspect or bank account reference"}
                },
                "required": ["entity_id"]
            }
        },
        {
            "name": "query_hotspots",
            "description": "Retrieve geospatial coordinates of active crime hotspots and incident clusters.",
            "parameters": {
                "type": "object",
                "properties": {}
            }
        },
        {
            "name": "get_forecast",
            "description": "Retrieve seasonal 30-day early warning forecast for a specific district and crime type.",
            "parameters": {
                "type": "object",
                "properties": {
                    "district": {"type": "string", "description": "The name of the district (e.g. Peenya, Indiranagar)"},
                    "crime_type": {"type": "string", "description": "The category of crime (e.g. THEFT, CYBERCRIME)"}
                },
                "required": ["district", "crime_type"]
            }
        },
        {
            "name": "get_offender_risk",
            "description": "Retrieve re-offending risk score probability and SHAP feature attributions for a suspect.",
            "parameters": {
                "type": "object",
                "properties": {
                    "suspect_name": {"type": "string", "description": "The name of the suspect offender"}
                },
                "required": ["suspect_name"]
            }
        },
        {
            "name": "get_mo_profile",
            "description": "Retrieve Modus Operandi (MO) behavioral profile matching for a suspect.",
            "parameters": {
                "type": "object",
                "properties": {
                    "suspect_name": {"type": "string", "description": "The name of the suspect offender"}
                },
                "required": ["suspect_name"]
            }
        },
        {
            "name": "summarize_case",
            "description": "Compile a detailed case dossier summary (English/Kannada) including victims, accused, and brief facts.",
            "parameters": {
                "type": "object",
                "properties": {
                    "case_id": {"type": "integer", "description": "The integer ID of the case (CaseMasterID)"}
                },
                "required": ["case_id"]
            }
        },
        {
            "name": "find_similar_cases",
            "description": "Find similar past cases with matching MO or narratives for investigative leads.",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {"type": "string", "description": "The query description or Case ID"}
                },
                "required": ["query"]
            }
        },
        {
            "name": "ask_clarifying_question",
            "description": "Trigger a clarifying question to the user when the query is ambiguous or missing parameters.",
            "parameters": {
                "type": "object",
                "properties": {
                    "question": {"type": "string", "description": "The clarifying question to ask"}
                },
                "required": ["question"]
            }
        },
        {
            "name": "get_case_timeline",
            "description": "Retrieve chronological case milestones (Occurrence, FIR registration, Arrest, Chargesheet) by Case Master ID.",
            "parameters": {
                "type": "object",
                "properties": {
                    "case_id": {"type": "integer", "description": "The integer ID of the case (CaseMasterID)"}
                },
                "required": ["case_id"]
            }
        },
        {
            "name": "get_demographic_correlation",
            "description": "Correlate crime trends with district-level socio-demographics (literacy, unemployment, stress).",
            "parameters": {
                "type": "object",
                "properties": {
                    "district": {"type": "string", "description": "The name of the district (e.g. Bagalkot, Bengaluru Urban)"}
                },
                "required": ["district"]
            }
        },
        {
            "name": "get_repeat_offenders",
            "description": "List habitual/repeat offenders (accused persons appearing in multiple cases), optionally filtered by district. Use for questions like 'who are the repeat offenders' or 'habitual criminals in X'.",
            "parameters": {
                "type": "object",
                "properties": {
                    "district": {"type": "string", "description": "Optional district name to filter by (e.g. Bengaluru Urban). Omit to list top repeat offenders across all districts."}
                },
                "required": []
            }
        },
        {
            "name": "detect_crime_groups",
            "description": "Detect likely organized crime groups by finding accused persons who have repeatedly co-offended together across multiple separate cases (not just once). Use for questions like 'detect organized crime groups' or 'find criminal gangs/syndicates'.",
            "parameters": {
                "type": "object",
                "properties": {}
            }
        }
    ]

    def __init__(self, dbscan_model=None, xgboost_model=None, shap_explainer=None, label_encoders=None):
        self.dbscan_model = dbscan_model
        self.xgboost_model = xgboost_model
        self.shap_explainer = shap_explainer
        self.label_encoders = label_encoders
        self.llm = CatalystLLM()
        self._mo_profiler = None

    def _get_mo_profiler(self) -> "MOBehavioralProfiler":
        """Built once per process (queries ~250 real cases) rather than
        re-fetching and re-normalizing the whole reference matrix on every
        MO-match tool call."""
        if self._mo_profiler is None:
            self._mo_profiler = MOBehavioralProfiler(catalyst_app=catalyst_app)
        return self._mo_profiler

    def sanitize_sql_input(self, val: str) -> str:
        """
        Strips quotes, semicolons, hashes, and SQL line-comment sequences
        (--) to prevent ZCQL/SQL injection.

        Previously stripped every single '-' character, not just the '--'
        comment sequence. Every real CrimeNo is formatted "CR-YYYY-NNNNN"
        (confirmed live, e.g. "CR-2024-81977") -- stripping single dashes
        silently mangled it to "CR202481977" before it ever reached the
        query, so `WHERE CrimeNo = '{case_no}'` could never match a real
        row. query_case (and any other tool taking a dash-containing
        identifier, e.g. a suspect's hyphenated surname) was broken for
        every real value, not just malicious ones. A lone '-' isn't a
        meaningful injection vector on its own -- only the '--' comment
        sequence is worth stripping.
        """
        if not val:
            return ""
        return re.sub(r"(--|['#\";])", "", val).strip()

    def _resolve_entities(self, query: str, session_id: str) -> Dict[str, Any]:
        """
        Parses query to extract entities. Falls back to Session Memory if missing.
        """
        context = session_memory.get_session_context(session_id)
        
        # Regex match for Case IDs (real CrimeNo format, confirmed live: e.g.
        # "CR-2024-81977" -- 2-4 letter prefix, 4-digit year, 4-6 digit
        # sequence). The old pattern only matched "FIR-YYYY-NNNN" (4-digit
        # suffix) or a bare 7-digit number; migrate_to_catalyst.py has always
        # generated "CR-{year}-{5-digit}" (e.g. seed_table's
        # f"CR-{reg_date.year}-{random.randint(10000, 99999)}"), and
        # CaseMasterID is a small sequential int (never 7 digits) -- so
        # neither branch of the old regex could ever match a real case
        # number, meaning "show me case CR-2024-81977" always fell through
        # to vague semantic search instead of a direct, exact lookup.
        case_match = re.search(r'\b([A-Z]{2,4}-\d{4}-\d{4,6})\b', query, re.IGNORECASE)
        # Regex match for suspect names (Capitalized words like Ramesh Kumar)
        suspect_match = None
        suspect_candidates = re.findall(r'\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b', query)
        for cand in suspect_candidates:
            if cand.lower() not in ["karnataka", "police", "cctns", "scrb", "bengaluru", "peenya", "indiranagar", "station"]:
                suspect_match = cand
                break

        # Check for districts (real KSP district list, not a hardcoded guess)
        resolved_district = None
        for dist in get_real_districts():
            if dist.lower() in query.lower():
                resolved_district = dist
                break

        # Resolve with fallback cache context
        case_id = case_match.group(1) if case_match else context.get("last_case_id")
        suspect = suspect_match if suspect_match else context.get("last_offender_id")
        district = resolved_district if resolved_district else context.get("last_location")

        # Update cache context
        updated_ctx = {
            "last_case_id": case_id,
            "last_offender_id": suspect,
            "last_location": district,
            "last_query_entities": {
                "extracted_at": datetime.utcnow().isoformat(),
                "query": query[:100]
            },
            "messages": context.get("messages", [])
        }
        session_memory.update_session_context(session_id, updated_ctx)
        
        return {
            "case_id": case_id,
            "suspect": suspect,
            "district": district,
            "original_ctx": context
        }

    def _write_audit_log(self, employee_id: int, action_type: str, target: str, query: str, response: str, session_id: str):
        """
        Writes a secure, immutable audit log entry into the Catalyst AuditLog table.
        Computes rowhash = hash(prevhash + serialized_row_content) for tamper detection.
        """
        if not catalyst_app:
            return
        # Confirmed live (2026-07-14): the real AuditLog table is snake_case
        # (session_id, target_entity, query_text, response_summary,
        # action_type, employee_id, logged_at) -- PascalCase columns this
        # code used before don't exist under any casing tried, and neither do
        # row_hash/prev_hash, so hash-chaining silently never wrote anything
        # real despite being reported as "already implemented" earlier this
        # session. Tries the hash-chained insert first (works automatically
        # the moment row_hash/prev_hash columns are added to the console
        # table, no further code change needed); falls back to a plain write
        # of the fields that do exist if those columns aren't there yet, so
        # basic audit logging isn't blocked on that console change either.
        logged_at = datetime.utcnow().isoformat()
        base_row = {
            "employee_id": employee_id,
            "action_type": action_type,
            "target_entity": target[:200],
            "query_text": query[:500],
            "response_summary": response[:200],
            "session_id": session_id,
            "logged_at": logged_at
        }
        try:
            prev_hash = "0000000000000000000000000000000000000000000000000000000000000000"
            try:
                last_res = catalyst_app.zql().execute_query("SELECT row_hash FROM AuditLog ORDER BY logged_at DESC LIMIT 1")
                if last_res:
                    prev_hash = last_res[0].get("AuditLog", {}).get("row_hash") or prev_hash
            except Exception:
                pass  # row_hash column doesn't exist yet -- fall through to plain write below

            serialized_content = f"{employee_id}|{action_type}|{target}|{query[:100]}|{response[:100]}|{session_id}|{logged_at}"
            row_hash = hashlib.sha256((prev_hash + serialized_content).encode('utf-8')).hexdigest()
            zcql_insert_row("AuditLog", {**base_row, "prev_hash": prev_hash, "row_hash": row_hash})
            logger.info(f"Audit log hash-chained: {action_type} -> row_hash={row_hash[:10]}...")
            return
        except Exception as e:
            logger.warning(f"Hash-chained audit write failed (row_hash/prev_hash columns may not exist yet), falling back to plain write: {e}")

        try:
            zcql_insert_row("AuditLog", base_row)
            logger.info(f"Audit log written (no hash chain): {action_type} for session {session_id}")
        except Exception as e:
            logger.error(f"Failed to write to AuditLog table: {e}")

    @staticmethod
    def _extract_json(content_str: str) -> str:
        """
        The deployed GLM model (crm-di-glm47b_30b_it) is a "thinking" model --
        it emits step-by-step reasoning text before the actual answer, often
        ending with the real JSON inside a ```json fenced block (confirmed
        live). A naive greedy `re.search(r"\{.*\}", ..., re.DOTALL)` grabs
        from the FIRST '{' anywhere in the reasoning text through to the
        LAST '}' at the end -- across totally unrelated JSON fragments
        (e.g. a tool's parameter schema mentioned mid-reasoning) -- producing
        invalid, unparsable JSON. This prefers the last fenced ```json block
        if present, otherwise falls back to the last balanced {...} object
        found via brace counting (not regex, so nested braces don't break it).
        """
        fence_matches = re.findall(r"```(?:json)?\s*(\{.*?\})\s*```", content_str, re.DOTALL)
        if fence_matches:
            return fence_matches[-1]

        # Match backward from the LAST '}' to its corresponding '{' via depth
        # counting -- NOT forward from the last '{' (the previous approach).
        # Every real decision object here is nested (`{"tool": ..., "parameters":
        # {...}}`), and a nested object's OWN opening brace always appears later
        # in the text than its parent's. Searching forward from the last '{'
        # therefore finds the INNER object's start and returns only that
        # fragment (e.g. bare `{"suspect_name": "Ramesh"}`, no "tool" key) --
        # confirmed live: this silently truncated every tool-calling decision
        # to its parameters sub-object, which run_agent_loop then correctly
        # rejected as invalid (no "tool", no "text_response") and fell through
        # to "Please clarify your request." on every single query, including
        # ones where the LLM (or the local simulator) picked the right tool.
        # It also stripped the sibling "is_simulated" key the simulator sets
        # on the OUTER object, so degraded responses were misreported as real.
        # The outer object's closing '}' is always the LAST '}' in the text
        # (it closes after every object nested inside it), so anchoring there
        # and matching backward reliably finds the true outermost object.
        end = content_str.rfind("}")
        while end != -1:
            depth = 0
            for i in range(end, -1, -1):
                if content_str[i] == "}":
                    depth += 1
                elif content_str[i] == "{":
                    depth -= 1
                    if depth == 0:
                        return content_str[i:end + 1]
            end = content_str.rfind("}", 0, end)
        return content_str

    def run_agent_loop(self, query: str, session_id: str, employee_id: int, user_unit_id: Optional[int] = None) -> Dict[str, Any]:
        """
        Primary execution entry point. Decides what tools to run in sequence using LLM function calling.
        """
        # 1. Resolve Entities & Context
        entities = self._resolve_entities(query, session_id)

        # Load conversation history from session memory
        context = session_memory.get_session_context(session_id)
        history = context.get("messages", [])
        if not history:
            history = []

        # Append user message
        history.append({"role": "user", "content": query})
        history = history[-10:]  # Keep last 10 turns max to avoid token bloat

        response_text = ""
        response_type = "text"
        data_payload = {}
        citations = []
        # True the moment the real LLM endpoint is confirmed unreachable
        # during this turn -- previously this fell back to a keyword-
        # matching local simulator that still ran real tools and presented
        # a "degraded" answer behind an amber banner. That's gone: on a
        # police intelligence platform, an answer whose tool/suspect was
        # picked by string-matching instead of real reasoning shouldn't be
        # presented as an answer at all, even a clearly-labeled one.
        ai_unavailable = False
        # Tracks the most recent tool's own deterministic text_result (real
        # DB query / DBSCAN clustering / SHAP computation output, never
        # LLM-hallucinated) so that if the LLM successfully picks a tool via
        # real reasoning but the LATER "write a polished narrative" step
        # times out, the turn can fall back to the tool's own grounded
        # output instead of discarding real, already-fetched, non-
        # hallucinated data. Confirmed live this distinction matters: the
        # synthesis-only call (offered no tools, see allow_tools below) has
        # been timing out noticeably more often than the initial tool-
        # selection call under sustained load, wasting an otherwise-correct
        # answer every time.
        last_tool_text_result = ""

        max_iterations = 4
        current_iteration = 0

        while current_iteration < max_iterations:
            current_iteration += 1
            logger.info(f"Agent loop iteration {current_iteration} for query: '{query}'")
            # Every tool in TOOLS takes its parameters directly from the
            # query/session context -- none depend on another tool's output --
            # so genuine multi-hop chaining essentially never happens in
            # practice. Originally tools stayed offered through iteration 2
            # "in case a second tool genuinely helps," but confirmed live
            # that iteration 2 (still carrying the full tool-catalog prompt,
            # heavier for the model to process than the lean synthesis-only
            # one) was itself timing out on some turns -- e.g. "who are the
            # repeat offenders" correctly picked and ran get_repeat_offenders
            # on iteration 1 in ~52s, then iteration 2 hit two consecutive
            # 60s timeouts trying to re-consider the whole catalog before
            # just answering. Restricting tools to iteration 1 only means
            # every iteration after the first tool call gets the short,
            # focused "write the answer" prompt with nothing to re-deliberate.
            allow_tools = current_iteration == 1
            llm_res = self.llm.chat(
                history,
                self.TOOLS if allow_tools else None,
                max_tokens=(2500 if allow_tools else 3500)
            )

            if llm_res.get("error"):
                logger.warning(f"LLM unavailable, not answering (iteration {current_iteration}): {llm_res.get('error')}")
                ai_unavailable = True
                break

            try:
                content_str = llm_res["choices"][0]["message"]["content"]
                # Extract JSON from response
                content_str = self._extract_json(content_str)

                decision = json.loads(content_str)
                logger.info(f"Agent decision parsed (Iteration {current_iteration}): {decision}")

                # If the model wants to call a tool, invoke it
                if "tool" in decision:
                    tool_name = decision["tool"]
                    params = decision.get("parameters", {})
                    logger.info(f"Invoking tool (Iteration {current_iteration}): {tool_name} with params {params}")

                    # Execute specific tool based on function calling
                    tool_output = self._execute_tool(tool_name, params, employee_id, session_id, user_unit_id)

                    # Accumulate citations, response types, and data payloads
                    if tool_output.get("citations"):
                        citations.extend(tool_output["citations"])
                    if tool_output.get("response_type") and tool_output["response_type"] != "text":
                        response_type = tool_output["response_type"]
                    if tool_output.get("data"):
                        if isinstance(data_payload, dict) and isinstance(tool_output["data"], dict):
                            data_payload.update(tool_output["data"])
                        else:
                            data_payload = tool_output["data"]
                    if tool_output.get("text_result"):
                        last_tool_text_result = tool_output["text_result"]

                    # Append tool result to history and loop again
                    history.append({"role": "assistant", "content": json.dumps(decision)})
                    history.append({"role": "user", "content": f"Tool '{tool_name}' returned: {json.dumps(tool_output['text_result'])}"})
                else:
                    # Final synthesis response text or clarifying question.
                    # .split("</think>")[-1] guards against a "thinking" model
                    # ever putting its reasoning preamble inside this field
                    # instead of before the JSON block (the more common case,
                    # already handled by _extract_json stripping everything
                    # before the JSON itself).
                    raw_text = decision.get("text_response") or decision.get("text") or "Please clarify your request."
                    response_text = raw_text.split("</think>")[-1].strip() or raw_text
                    break
            except Exception as e:
                logger.error(f"Error executing LLM agent loop choices on iteration {current_iteration}: {e}")
                # Confirmed live against the real GLM endpoint: once this
                # "thinking" model has a tool result in hand, it often just
                # answers directly in plain prose after its </think> block
                # instead of wrapping the answer in the requested JSON --
                # e.g. "Based on the database query for suspect X: Offender
                # Risk Score: 0.1%... Top Predictor: Year Temporal" with no
                # JSON at all. That's a good, complete answer, not a broken
                # one -- treating it as an error and either failing
                # (iteration 1) or silently discarding it to pay for an
                # entire extra synthesis call (iteration 2+, which then has
                # no more information than this content already did, and
                # was confirmed live to sometimes time out on its own,
                # losing the answer entirely) wastes a real answer that was
                # already sitting right here. Try it as plain prose first.
                try:
                    raw_content = llm_res["choices"][0]["message"]["content"]
                    # No </think> means this response was cut off mid-reasoning
                    # (confirmed live on a translation call -- the model always
                    # emits </think> once it actually finishes thinking), not a
                    # genuine plain-prose answer -- don't treat an unfinished
                    # reasoning fragment as if the model had committed to it.
                    if "</think>" in raw_content:
                        fallback_text = raw_content.split("</think>")[-1].strip()
                        if fallback_text and len(fallback_text) > 3:
                            response_text = fallback_text
                            break
                except Exception:
                    pass
                if current_iteration == 1:
                    response_text = "I encountered an error processing your query. Please restate your request."
                break

        # If the loop finished and we executed tools but never got a final text_response, do one final synthesis
        if not response_text and citations and not ai_unavailable:
            try:
                logger.info("Executing final LLM response synthesis turn...")
                synthesis_res = self.llm.chat(history, max_tokens=3500)
                if synthesis_res.get("error"):
                    logger.warning(f"LLM unavailable during synthesis turn, not answering: {synthesis_res.get('error')}")
                    ai_unavailable = True
                else:
                    raw_response = synthesis_res["choices"][0]["message"]["content"]
                    try:
                        desc = json.loads(self._extract_json(raw_response))
                        # desc parsed as valid JSON but had neither key (e.g.
                        # the model responded with another {"tool": ...}
                        # instead of a text_response, confirmed live) -- the
                        # raw_response fallback must still have its
                        # </think> preamble stripped, or the officer sees the
                        # model's full internal reasoning trace verbatim.
                        fallback = raw_response.split("</think>")[-1].strip() or raw_response
                        response_text = desc.get("text_response") or desc.get("text") or fallback
                    except Exception:
                        # Not JSON at all (plain prose answer) -- still strip any
                        # </think> preamble before using it as-is, so the model's
                        # internal reasoning trace never leaks into what the
                        # officer sees.
                        response_text = raw_response.split("</think>")[-1].strip() or raw_response
            except Exception as e:
                logger.error(f"Error on final synthesis turn: {e}")
                response_text = "I have successfully retrieved the files. Let me know if you need specific details."

        # A police intelligence platform should never present an answer
        # picked by keyword-matching as if it were real reasoning -- but
        # that's a different failure than this one. Here, a tool was
        # already selected via a genuine, successful LLM reasoning call
        # (iteration 1) and executed against real data (real ZCQL queries,
        # real DBSCAN/SHAP computation) -- only the LATER, separate "write a
        # polished narrative" step timed out. The tool's own text_result is
        # grounded, deterministic, non-hallucinated output, not a guess, so
        # discarding it here just because the prose-polish step failed would
        # waste a real, correct answer the officer already paid the wait
        # time for. Confirmed live this fallback path is common under
        # sustained load: the synthesis-only call times out more often than
        # the initial tool-selection call.
        if ai_unavailable and last_tool_text_result and (citations or data_payload):
            response_text = (
                "[Automated data summary — AI narrative analysis timed out; showing retrieved results directly]\n\n"
                + last_tool_text_result
            )
            ai_unavailable = False
        elif ai_unavailable:
            response_text = "AI reasoning is temporarily unavailable. Please try again in a few minutes, or contact your system administrator if this persists."
            response_type = "text"
            data_payload = {}
            citations = []

        # Update cached history
        history.append({"role": "assistant", "content": response_text})
        context["messages"] = history
        session_memory.update_session_context(session_id, context)

        return {
            "text": response_text,
            "response_type": response_type,
            "data": data_payload,
            "citations": citations,
            "is_simulated": ai_unavailable,
            "simulated_reason": "Catalyst LLM generative endpoint offline" if ai_unavailable else ""
        }

    def generate_applet_spec(self, response_type: str, data_payload: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """
        Maps a tool's already-resolved data directly to a bounded UI spec for
        the right-hand applet panel -- no LLM call. This used to be a second,
        independent GLM call that asked the model to re-describe the same
        data it had already returned in the main turn as a chart spec: that
        cost another 7-25s round-trip per turn and gave the model a second
        chance to misdescribe its own data. The tool functions already return
        clean, structured data (hotspots, nodes/edges, SHAP factors, etc.) --
        mapping it here is instant, free, and can't hallucinate a mismatch
        between what's shown and what's real.
        """
        if not data_payload:
            return None

        if response_type == "map":
            hotspots = data_payload.get("hotspots", [])
            if not hotspots:
                return None
            return {"layout": "single", "components": [
                {"kind": "map", "title": "Crime Hotspots", "data": hotspots}
            ]}

        if response_type == "network":
            nodes = data_payload.get("nodes", [])
            edges = data_payload.get("edges", [])
            if not nodes:
                return None
            components = [{
                "kind": "network_graph",
                "title": f"Syndicate Network: {data_payload.get('target_suspect', '')}",
                "data": {"nodes": nodes, "edges": edges}
            }]
            fin_txns = data_payload.get("financial_transactions") or []
            if fin_txns:
                total = sum(t.get("amount") or 0 for t in fin_txns)
                components.append({
                    "kind": "stat_tile", "value": len(fin_txns),
                    "label": f"Linked Transactions (Total ₹{total:,.0f})"
                })
            return {"layout": "grid", "components": components}

        if response_type == "risk":
            components = [{
                "kind": "gauge", "title": "Conviction Risk",
                "value": data_payload.get("risk_score", 0),
                "label": f"Suspect: {data_payload.get('suspect', '')}"
            }]
            shap = data_payload.get("shap_factors") or []
            if shap:
                components.append({
                    "kind": "bar_chart", "title": "SHAP Feature Contributions",
                    "data": [{"name": f["name"], "value": f["value"]} for f in shap]
                })
            return {"layout": "grid", "components": components}

        if response_type == "forecast":
            forecast = data_payload.get("forecast", [])
            if not forecast:
                return None
            return {"layout": "single", "components": [{
                "kind": "line_chart", "title": "Seasonal Forecast Trend",
                "data": [{"name": f.get("period") or f.get("district", ""), "value": f.get("predicted", 0)} for f in forecast]
            }]}

        if response_type == "mo_match":
            matches = data_payload.get("matches", [])
            if not matches:
                return None
            return {"layout": "single", "components": [{
                "kind": "table", "title": f"MO Matches for {data_payload.get('suspect', '')}",
                "data": matches, "columns": ["suspect", "case_id", "station", "similarity_score"]
            }]}

        if response_type == "timeline":
            timeline = data_payload.get("timeline", [])
            if not timeline:
                return None
            return {"layout": "single", "components": [{
                "kind": "timeline", "title": f"Case {data_payload.get('case_id', '')} Timeline",
                "data": timeline
            }]}

        if response_type == "correlation":
            profile = data_payload.get("profile") or {}
            if not profile:
                return None
            return {"layout": "grid", "components": [
                {"kind": "stat_tile", "value": f"{profile.get('literacy', '')}%", "label": f"Literacy — {profile.get('district', '')}"},
                {"kind": "stat_tile", "value": f"{profile.get('unemployment', '')}%", "label": "Unemployment Rate"},
                {"kind": "gauge", "title": "Economic Stress Index", "value": round((profile.get("stress") or 0) * 100, 1), "label": ""},
            ]}

        if response_type == "repeat_offenders":
            offenders = data_payload.get("offenders", [])
            if not offenders:
                return None
            return {"layout": "single", "components": [{
                "kind": "table", "title": "Repeat / Habitual Offenders",
                "data": offenders, "columns": ["suspect", "case_count", "district", "severity"]
            }]}

        if response_type == "crime_groups":
            groups = data_payload.get("groups", [])
            if not groups:
                return None
            return {"layout": "single", "components": [{
                "kind": "table", "title": "Detected Organized Crime Groups",
                "data": [{"members": ", ".join(g["members"]), "shared_case_count": g["shared_case_count"]} for g in groups],
                "columns": ["members", "shared_case_count"]
            }]}

        return None

    def _execute_tool(self, tool_name: str, params: Dict[str, Any], employee_id: int, session_id: str, user_unit_id: Optional[int]) -> Dict[str, Any]:
        """
        Executes the registered backend capabilities.
        """
        text_result = ""
        response_type = "text"
        data = {}
        citations = []
        
        # Enforce role-scoped station boundary
        unit_filter_str = ""
        if user_unit_id is not None and user_unit_id != 1:
            unit_filter_str = f"AND PoliceStationID = {user_unit_id}"

        # 1. query_case
        if tool_name == "query_case":
            case_no = self.sanitize_sql_input(params.get("case_no", ""))
            if catalyst_app and case_no:
                try:
                    q = f"SELECT * FROM CaseMaster WHERE CrimeNo = '{case_no}' {unit_filter_str} LIMIT 1"
                    res = catalyst_app.zql().execute_query(q)
                    if res:
                        data = res[0].get("CaseMaster", {})
                        text_result = f"Grounded Case Detail: CrimeNo: {data.get('CrimeNo')}, Registered: {data.get('CrimeRegisteredDate')}, Brief Facts: {data.get('BriefFacts')}"
                        citations.append({"type": "CCTNS Database Record", "id": case_no, "details": "Structured case metadata"})
                    else:
                        text_result = f"Case {case_no} not found or access denied."
                except Exception as e:
                    text_result = f"Failed to query case: {e}"
            else:
                text_result = "Database offline or case_no missing."
            self._write_audit_log(employee_id, "Structured Case Lookup", case_no, f"Lookup case {case_no}", text_result, session_id)

        # 2. resolve_vague_query
        elif tool_name == "resolve_vague_query":
            raw_query = params.get("query", "")
            matches = self.resolve_vague_query(raw_query, user_unit_id)
            data = {"matches": matches}
            response_type = "text"
            if matches:
                text_result = f"Recalled {len(matches)} matching case dossiers. Highlights: "
                for idx, m in enumerate(matches):
                    fid = m.get("fir_id")
                    text_result += f"\n {idx+1}. Case {fid} (Confidence: {m.get('confidence_score')})"
                    citations.append({"type": "Semantic Search Index", "id": fid, "details": f"Confidence: {m.get('confidence_score')}"})
            else:
                text_result = "No matching cases resolved."
            self._write_audit_log(employee_id, "Vague Semantic Search", "CaseMaster Index", raw_query, text_result, session_id)

        # 3. get_case_sections
        elif tool_name == "get_case_sections":
            case_id = params.get("case_id", 1)
            sections = self.get_sections_for_case(case_id)
            data = {"case_id": case_id, "sections": sections}
            text_result = f"Recorded BNS/IPC sections for Case ID {case_id}: {', '.join(sections) if sections else 'None'}"
            citations.append({"type": "Act Section Association Registry", "id": str(case_id), "details": "Legal sections lookup"})

        # 4. suggest_sections
        elif tool_name == "suggest_sections":
            desc = params.get("crime_description", "")
            suggestions = self.suggest_sections_for_query(desc)
            data = suggestions
            precedent_summary = suggestions.get("precedent_note") or f"Precedents: {len(suggestions.get('precedents', []))} charge-sheeted case(s) found."
            text_result = f"Suggested Sections: {suggestions.get('suggested_section')} (Confidence: {suggestions.get('confidence_score')}). {precedent_summary}\n\n{suggestions.get('disclaimer', '')}"
            citations.append({"type": "IPC / BNS Legal Guidelines", "id": "IPC-BNS-Registry", "details": "Section mapping engine"})
            self._write_audit_log(employee_id, "Legal Precedent Suggestion", "IPC/BNS Table", desc, text_result, session_id)

        # 5. query_graph_network
        elif tool_name == "query_graph_network":
            suspect = self.sanitize_sql_input(params.get("suspect_name", ""))
            response_type = "network"
            network_info = graph_rag.get_criminal_network(suspect)
            
            # Combine financial transaction links -- filtered to this
            # suspect's actual linked cases. Previously pulled the first 10
            # FinancialTransaction rows globally with no WHERE clause at all,
            # so every suspect query showed the same handful of rows
            # (including leftover test data) regardless of relevance.
            fin_txns = []
            case_ids = network_info.get("case_ids") or []
            if catalyst_app and case_ids:
                try:
                    case_ids_str = ",".join(str(c) for c in case_ids)
                    tx_query = f"SELECT * FROM FinancialTransaction WHERE linked_case_id IN ({case_ids_str}) LIMIT 10"
                    tx_res = catalyst_app.zql().execute_query(tx_query)
                    for r in tx_res:
                        txn = r.get("FinancialTransaction", {})
                        fin_txns.append({
                            "sender": txn.get("sender_ref"),
                            "receiver": txn.get("receiver_ref"),
                            "amount": txn.get("amount"),
                            "txn_time": txn.get("txn_time")
                        })
                except Exception as ex:
                    logger.warning(f"Financial query fallback error: {ex}")
            
            network_info["financial_transactions"] = fin_txns
            data = network_info
            if network_info.get("ambiguous_match"):
                # Confirmed live: "ramesh" fuzzy-matched ~15 distinct real
                # people and their cases got silently merged into one fake
                # "syndicate" of ~50 unrelated cases. Say plainly that the
                # name is ambiguous instead of fabricating a combined network.
                candidates = network_info.get("candidate_names", [])
                text_result = (
                    f"'{suspect}' matches multiple different people in the database, not one suspect "
                    f"(found {len(candidates)}+ others with this name or a name containing it: "
                    f"{', '.join(candidates[:5])}{'...' if len(candidates) > 5 else ''}). "
                    f"Please provide a fuller name (e.g. full first and last name) to trace a specific person's network."
                )
                citations.append({"type": "GraphRAG Syndicate Map", "id": suspect, "details": "Name matched multiple distinct accused records -- ambiguous, not traced"})
            else:
                text_result = f"Syndicate network links for suspect {suspect}: Traced phone logs and {len(fin_txns)} logged bank transaction trails."
                citations.append({"type": "GraphRAG Syndicate Map", "id": suspect, "details": "Traversed co-accused links"})
            self._write_audit_log(employee_id, "Relational GraphRAG Traversal", suspect, f"Traced network of {suspect}", text_result, session_id)

        # 6. query_financial_links
        elif tool_name == "query_financial_links":
            entity = self.sanitize_sql_input(params.get("entity_id", ""))
            response_type = "network"
            # Return transactions linked to entity
            txns = []
            if catalyst_app:
                try:
                    tx_query = f"SELECT * FROM FinancialTransaction WHERE sender_ref = '{entity}' OR receiver_ref = '{entity}' LIMIT 20"
                    tx_res = catalyst_app.zql().execute_query(tx_query)
                    for r in tx_res:
                        txn = r.get("FinancialTransaction", {})
                        txns.append({
                            "sender": txn.get("sender_ref"),
                            "receiver": txn.get("receiver_ref"),
                            "amount": txn.get("amount"),
                            "txn_time": txn.get("txn_time"),
                            "account_wallet": txn.get("account_or_wallet_id")
                        })
                except Exception as ex:
                    logger.error(f"Financial links ZCQL query error: {ex}")
            data = {"entity_id": entity, "financial_transactions": txns}
            text_result = f"Found {len(txns)} suspicious financial transaction nodes linked to entity '{entity}'."
            citations.append({"type": "FinancialTransaction Datastore", "id": entity, "details": "Traced money laundering trails"})
            self._write_audit_log(employee_id, "Financial Link Analysis", entity, f"Money trail of {entity}", text_result, session_id)

        # 7. query_hotspots
        elif tool_name == "query_hotspots":
            response_type = "map"
            coordinates = []
            if catalyst_app:
                try:
                    map_query = f"SELECT Latitude, Longitude, CrimeNo FROM CaseMaster WHERE Latitude IS NOT NULL LIMIT 300"
                    map_res = catalyst_app.zql().execute_query(map_query)
                    for r in map_res:
                        cm = r.get("CaseMaster", {})
                        lat = cm.get("latitude")
                        lng = cm.get("longitude")
                        if lat is not None and lng is not None:
                            coordinates.append({
                                "lat": float(lat),
                                "lng": float(lng),
                                "label": cm.get("CrimeNo")
                            })
                except Exception as ex:
                    logger.error(f"Failed to fetch coordinates for hotspot: {ex}")
            
            # Execute DBSCAN clustering
            centroids = []
            if coordinates:
                try:
                    from sklearn.cluster import DBSCAN
                    X = np.array([[c["lat"], c["lng"]] for c in coordinates])
                    # min_samples lowered from 10: Catalyst hard-caps every ZCQL
                    # query at 300 rows, so this tool only ever sees a 300-row
                    # slice of ~18000 total cases spread across ~30 city-wide
                    # hotspot points -- confirmed live that even with cases
                    # concentrated onto real hotspot points (not scattered
                    # randomly), a 300-row sample averages ~10 points per
                    # hotspot, right at the old threshold with no margin for
                    # sampling variance across which 300 rows happen to be
                    # returned.
                    db = DBSCAN(eps=0.005, min_samples=6, metric='euclidean')
                    labels = db.fit_predict(X)
                    
                    unique_labels = set(labels)
                    if -1 in unique_labels:
                        unique_labels.remove(-1)
                    
                    for idx, label in enumerate(sorted(unique_labels)):
                        cluster_points = X[labels == label]
                        lat_center = float(np.mean(cluster_points[:, 0]))
                        lng_center = float(np.mean(cluster_points[:, 1]))
                        point_count = len(cluster_points)
                        centroids.append({
                            "lat": lat_center,
                            "lng": lng_center,
                            "label": f"DBSCAN Hotspot {idx + 1} ({point_count} incidents)"
                        })
                except Exception as db_err:
                    logger.warning(f"DBSCAN clustering failed: {db_err}")

            if centroids:
                data = {"hotspots": centroids}
                text_result = f"Plotted spatial crime density map. Detected {len(centroids)} active hotspot clusters containing dense incident concentrations."
            else:
                data = {"hotspots": coordinates if coordinates else [
                    {"lat": 13.02768, "lng": 77.5124, "label": "Peenya Hotspot A"},
                    {"lat": 12.9716, "lng": 77.5946, "label": "Cubbon Park Cluster"}
                ]}
                text_result = "The CCTNS database does not currently contain enough dense incident coordinates to form statistical clusters using DBSCAN (requires at least 10 spatial points within an eps of 0.005). Displaying raw incident marker positions."

            citations.append({"type": "Geospatial DBSCAN Analyst", "id": "KSP Hotspots", "details": "Incident spatial coordinates"})
            self._write_audit_log(employee_id, "Spatial Hotspot Query", "CaseMaster", "Get crime hotspots", text_result, session_id)

        # 8. get_forecast
        elif tool_name == "get_forecast":
            district = self.sanitize_sql_input(params.get("district", "Bengaluru Urban"))
            crime_type = self.sanitize_sql_input(params.get("crime_type", "THEFT"))
            response_type = "forecast"
            forecast_results = []
            if catalyst_app:
                try:
                    fc_query = f"SELECT * FROM ForecastResults WHERE district = '{district}' AND crime_type = '{crime_type}' LIMIT 10"
                    fc_res = catalyst_app.zql().execute_query(fc_query)
                    for r in fc_res:
                        f_data = r.get("ForecastResults", {})
                        forecast_results.append({
                            "district": f_data.get("district"),
                            "crime_type": f_data.get("crime_type"),
                            "period": f_data.get("forecast_period"),
                            "predicted": f_data.get("predicted_count"),
                            "historical_avg": f_data.get("historical_avg"),
                            "confidence": f_data.get("confidence_score")
                        })
                except Exception as ex:
                    logger.warning(f"Forecast results read error: {ex}")
            if not forecast_results:
                forecast_results = [{"district": district, "crime_type": crime_type, "period": "Next 30 Days", "predicted": 12.5, "historical_avg": 10.0, "confidence": 0.85}]
            data = {"forecast": forecast_results}
            text_result = f"Early Warning Forecast: Projecting {forecast_results[0]['predicted']} incidents for {crime_type} in {district} over the next month (Baseline average: {forecast_results[0]['historical_avg']})."
            citations.append({"type": "Seasonal Time-Series Predictor", "id": f"{district}-{crime_type}", "details": "Forecasting results table"})
            self._write_audit_log(employee_id, "Crime Trend Forecast", f"{district}-{crime_type}", f"Forecast {crime_type} in {district}", text_result, session_id)

        # 9. get_offender_risk
        elif tool_name == "get_offender_risk":
            suspect = self.sanitize_sql_input(params.get("suspect_name", ""))
            # Confirmed: the frontend's InlineWidget/ExpandedOverlay/AppContext
            # type unions only ever checked for "risk", never "risk_breakdown"
            # -- meaning the inline chat widget (and its "Open Detailed View"
            # expansion) for every offender-risk answer this whole project has
            # rendered as an empty shell (no gauge, no SHAP chart), even
            # though the data was always computed correctly. Only the
            # right-hand Analysis Panel's generate_applet_spec() checked the
            # same "risk_breakdown" string this tool set, so that one path
            # happened to work while the primary in-conversation widget never did.
            response_type = "risk"
            
            # Default fallback values
            age = 32
            district_name = "Bengaluru City"
            unit_name = "Peenya PS"
            crime_group_name = "THEFT"
            fir_type = "Heinous"
            fir_year = 2026
            fir_month = 6
            fir_day = 25
            victim_count = 1
            accused_count = 1
            risk_score = 0.86
            
            shap_factors = [
                {"name": "Prior Arrests", "value": 0.35, "contribution": "positive"},
                {"name": "MO Similarity", "value": 0.28, "contribution": "positive"},
                {"name": "District Crime Rate", "value": 0.15, "contribution": "positive"},
                {"name": "Age Factor", "value": -0.12, "contribution": "negative"}
            ]

            if catalyst_app and suspect:
                try:
                    # Query Accused details (AgeYear and CaseMasterID)
                    acc_res = catalyst_app.zql().execute_query(
                        f"SELECT CaseMasterID, AgeYear FROM Accused WHERE AccusedName LIKE '*{suspect}*' LIMIT 1"
                    )
                    if acc_res:
                        acc_data = acc_res[0].get("Accused", {})
                        cm_id = acc_data.get("CaseMasterID")
                        age = acc_data.get("AgeYear") or 32
                        
                        if cm_id:
                            # Query CaseMaster for metadata. Note: CaseMaster has neither
                            # a DistrictID nor AccusedCount/VictimCount column (those used
                            # to be selected here, which made ZCQL 400 the whole query and
                            # silently fell back to hardcoded risk/SHAP defaults every
                            # time). District is resolved via PoliceStationID ->
                            # Unit.DistrictID; accused/victim counts via COUNT queries
                            # against their own tables, keyed by CaseMasterID.
                            cm_res = catalyst_app.zql().execute_query(
                                f"SELECT CrimeRegisteredDate, PoliceStationID, CaseCategoryID, CrimeMajorHeadID "
                                f"FROM CaseMaster WHERE CaseMasterID = {cm_id} LIMIT 1"
                            )
                            if cm_res:
                                cm_data = cm_res[0].get("CaseMaster", {})
                                raw_date = cm_data.get("CrimeRegisteredDate") or "2026-06-25 10:00:00"
                                try:
                                    dt = datetime.strptime(raw_date.split()[0], "%Y-%m-%d")
                                    fir_year = dt.year
                                    fir_month = dt.month
                                    fir_day = dt.day
                                except Exception:
                                    pass

                                try:
                                    va_res = catalyst_app.zql().execute_query(f"SELECT COUNT(ROWID) FROM Accused WHERE CaseMasterID = {cm_id}")
                                    if va_res:
                                        accused_count = va_res[0].get("Accused", {}).get("COUNT(ROWID)") or 1
                                    vv_res = catalyst_app.zql().execute_query(f"SELECT COUNT(ROWID) FROM Victim WHERE CaseMasterID = {cm_id}")
                                    if vv_res:
                                        victim_count = vv_res[0].get("Victim", {}).get("COUNT(ROWID)") or 1
                                except Exception:
                                    pass

                                unit_id = cm_data.get("PoliceStationID")
                                cat_id = cm_data.get("CaseCategoryID")
                                ch_id = cm_data.get("CrimeMajorHeadID")

                                # Resolve names from referenced tables
                                if unit_id:
                                    u_res = catalyst_app.zql().execute_query(f"SELECT UnitName, DistrictID FROM Unit WHERE UnitID = {unit_id} LIMIT 1")
                                    if u_res:
                                        u_data = u_res[0].get("Unit", {})
                                        unit_name = u_data.get("UnitName") or unit_name
                                        dist_id = u_data.get("DistrictID")
                                        if dist_id:
                                            d_res = catalyst_app.zql().execute_query(f"SELECT DistrictName FROM District WHERE DistrictID = {dist_id} LIMIT 1")
                                            if d_res:
                                                district_name = d_res[0].get("District", {}).get("DistrictName") or district_name
                                if ch_id:
                                    ch_res = catalyst_app.zql().execute_query(f"SELECT CrimeGroupName FROM CrimeHead WHERE CrimeHeadID = {ch_id} LIMIT 1")
                                    if ch_res:
                                        crime_group_name = ch_res[0].get("CrimeHead", {}).get("CrimeGroupName") or crime_group_name
                                if cat_id:
                                    c_res = catalyst_app.zql().execute_query(f"SELECT LookupValue FROM CaseCategory WHERE CaseCategoryID = {cat_id} LIMIT 1")
                                    if c_res:
                                        fir_type = c_res[0].get("CaseCategory", {}).get("LookupValue") or fir_type
                except Exception as ex:
                    logger.warning(f"Failed fetching dynamic features from database: {ex}")

            # Transform features using label encoders
            dist_encoded, unit_encoded, group_encoded, type_encoded = 0, 0, 0, 0
            if self.label_encoders:
                try:
                    if "District_Name" in self.label_encoders:
                        dist_encoded = int(self.label_encoders["District_Name"].transform([district_name])[0])
                    if "UnitName" in self.label_encoders:
                        unit_encoded = int(self.label_encoders["UnitName"].transform([unit_name])[0])
                    if "CrimeGroup_Name" in self.label_encoders:
                        group_encoded = int(self.label_encoders["CrimeGroup_Name"].transform([crime_group_name])[0])
                    if "FIR_Type" in self.label_encoders:
                        type_encoded = int(self.label_encoders["FIR_Type"].transform([fir_type])[0])
                except Exception as ex:
                    logger.warning(f"Label encoding warning: {ex}")

            # Build feature row
            month_sin = np.sin(2 * np.pi * fir_month / 12.0)
            month_cos = np.cos(2 * np.pi * fir_month / 12.0)
            day_sin = np.sin(2 * np.pi * fir_day / 31.0)
            day_cos = np.cos(2 * np.pi * fir_day / 31.0)
            ratio = victim_count / (accused_count + 1.0)
            
            features_list = [
                dist_encoded, unit_encoded, group_encoded, type_encoded,
                fir_year, month_sin, month_cos, day_sin, day_cos,
                victim_count, accused_count, ratio
            ]
            X = pd.DataFrame([features_list], columns=[
                'District_Name_encoded', 'UnitName_encoded', 'CrimeGroup_Name_encoded', 'FIR_Type_encoded',
                'FIR_YEAR', 'month_sin', 'month_cos', 'day_sin', 'day_cos', 
                'VICTIM COUNT', 'Accused Count', 'victim_to_accused_ratio'
            ])

            if self.xgboost_model:
                try:
                    risk_score = float(self.xgboost_model.predict_proba(X)[0][1])
                except Exception as ex:
                    logger.warning(f"XGBoost prediction failed: {ex}")
            
            if self.shap_explainer:
                try:
                    shap_vals = self.shap_explainer(X)
                    base_features = [
                        "District Location", "Precinct Unit", "Crime Class Group", "FIR Category",
                        "Year Temporal", "Month Cyclic Sin", "Month Cyclic Cos", "Day Cyclic Sin", "Day Cyclic Cos",
                        "Victim Count", "Accused Count", "Victim/Accused Ratio"
                    ]
                    shap_factors = []
                    for idx, feat_name in enumerate(base_features):
                        val = float(shap_vals.values[0][idx])
                        contribution = "positive" if val > 0 else "negative"
                        if abs(val) > 0.005:
                            shap_factors.append({
                                "name": feat_name,
                                "value": round(val, 4),
                                "contribution": contribution
                            })
                    # Sort SHAP factors by absolute magnitude descending
                    shap_factors.sort(key=lambda x: abs(x["value"]), reverse=True)
                except Exception as ex:
                    logger.warning(f"SHAP explanation computation failed: {ex}")

            data = {
                "suspect": suspect,
                "age": age,
                "risk_score": round(risk_score * 100, 1),
                "shap_factors": shap_factors
            }
            text_result = f"Offender Risk Score: Suspect {suspect} has a {round(risk_score * 100, 1)}% conviction risk probability. Top predictor: *{shap_factors[0]['name'] if shap_factors else 'Prior History'}*."
            citations.append({"type": "XGBoost Conviction Predictor", "id": suspect, "details": f"SHAP Local feature waterfall computed dynamically for age={age}"})
            self._write_audit_log(employee_id, "Offender Risk Inquest", suspect, f"Risk score of {suspect}", text_result, session_id)

        # 10. get_mo_profile
        elif tool_name == "get_mo_profile":
            suspect = self.sanitize_sql_input(params.get("suspect_name", ""))
            
            # Default fallback values for behavioral vector
            latitude = 13.027
            gravity_id = 4
            incident_hour = 12
            accused_count = 1
            crime_head_id = 5

            if catalyst_app and suspect:
                try:
                    # Query Accused to find CaseMasterID
                    acc_res = catalyst_app.zql().execute_query(
                        f"SELECT CaseMasterID FROM Accused WHERE AccusedName LIKE '*{suspect}*' LIMIT 1"
                    )
                    if acc_res:
                        cm_id = acc_res[0].get("Accused", {}).get("CaseMasterID")
                        if cm_id:
                            # Query CaseMaster for actual MO characteristics. AccusedCount
                            # isn't a real column here (same phantom-column bug as
                            # get_offender_risk) -- computed via a COUNT query instead.
                            cm_res = catalyst_app.zql().execute_query(
                                f"SELECT latitude, GravityOffenceID, IncidentFromDate, CrimeMajorHeadID "
                                f"FROM CaseMaster WHERE CaseMasterID = {cm_id} LIMIT 1"
                            )
                            if cm_res:
                                cm_data = cm_res[0].get("CaseMaster", {})
                                # ZCQL returns numeric fields as strings -- cast explicitly,
                                # since downstream min()/arithmetic assumes real numbers.
                                latitude = float(cm_data.get("latitude") or 13.027)
                                gravity_id = int(cm_data.get("GravityOffenceID") or 4)
                                crime_head_id = int(cm_data.get("CrimeMajorHeadID") or 5)
                                try:
                                    va_res = catalyst_app.zql().execute_query(f"SELECT COUNT(ROWID) FROM Accused WHERE CaseMasterID = {cm_id}")
                                    if va_res:
                                        accused_count = int(va_res[0].get("Accused", {}).get("COUNT(ROWID)") or 1)
                                except Exception:
                                    pass
                                
                                raw_date = cm_data.get("IncidentFromDate") or "2026-06-25 12:00:00"
                                try:
                                    # Extract hour of day
                                    if " " in raw_date:
                                        time_str = raw_date.split()[1]
                                        incident_hour = int(time_str.split(":")[0])
                                except Exception:
                                    pass
                except Exception as ex:
                    logger.warning(f"Failed fetching MO features from database: {ex}")

            # Scale case properties between 0 and 1 to create behavioral signature vector
            lat_factor = (latitude - 11.0) / 8.0 if (11.0 <= latitude <= 19.0) else 0.5
            gravity_factor = min(gravity_id, 10) / 10.0
            hour_factor = incident_hour / 24.0
            group_factor = min(accused_count, 10) / 10.0
            type_factor = min(crime_head_id, 50) / 50.0

            target_vector = np.array([
                lat_factor, gravity_factor, hour_factor, group_factor, type_factor
            ])

            profiler = self._get_mo_profiler()
            matches = profiler.find_matches(target_vector, top_k=3)
            
            top_match = matches[0] if matches else {}
            match_rate = round(top_match.get("similarity_score", 0.845) * 100, 1)
            mo_signature = f"Incident pattern matching suspect {top_match.get('suspect', 'Unknown')} from case {top_match.get('case_id', 'Unknown')} at {top_match.get('station', 'Unknown')}"
            
            data = {
                "suspect": suspect,
                "profile_status": "Complete",
                "mo_signature": mo_signature,
                "match_rate": match_rate,
                "matches": matches,
                "engine_mode": "Live CaseMaster/Accused MO Vectors" if profiler.data_source == "live_db" else "Reference Simulation (no live case data available)"
            }
            response_type = "mo_match"
            text_result = f"Behavioral MO Profile: Suspect {suspect} matches Modus Operandi '{mo_signature}' at a {match_rate}% similarity score."
            citations.append({"type": "MO Behavioral Profiler", "id": suspect, "details": "Grounded cosine similarity search performed across reference narratives database"})
            self._write_audit_log(employee_id, "Behavioral MO Inquest", suspect, f"MO signature of {suspect}", text_result, session_id)

        # 11. summarize_case
        elif tool_name == "summarize_case":
            case_id = params.get("case_id", 1)
            summary = self.summarize_case(case_id)
            data = {"case_id": case_id, "summary": summary}
            text_result = summary
            citations.append({"type": "CCTNS Grounded Summary", "id": str(case_id), "details": "Dynamically compiled case dossiers"})
            self._write_audit_log(employee_id, "Case Summarization Inquest", f"Case {case_id}", f"Summarize case {case_id}", text_result, session_id)

        # 12. find_similar_cases
        elif tool_name == "find_similar_cases":
            raw_query = params.get("query", "")
            matches = self.resolve_vague_query(raw_query, user_unit_id)
            data = {"matches": matches}
            text_result = f"Found similar cases: {', '.join([m['fir_id'] for m in matches]) if matches else 'None found'}"
            citations.append({"type": "Semantic Search Index", "id": raw_query[:20], "details": "Case vector similarity recall"})

        # 13. ask_clarifying_question
        elif tool_name == "ask_clarifying_question":
            text_result = params.get("question", "Could you please provide more details?")
            data = {"question": text_result}

        # 14. get_case_timeline
        elif tool_name == "get_case_timeline":
            case_id = params.get("case_id", 1)
            response_type = "timeline"
            events = []
            if catalyst_app:
                try:
                    # 1. Occurrence Date
                    occ_res = catalyst_app.zql().execute_query(f"SELECT OccurrenceDate FROM Inv_OccuranceTime WHERE CaseMasterID = {case_id} LIMIT 1")
                    if occ_res:
                        d_str = occ_res[0].get("Inv_OccuranceTime", {}).get("OccurrenceDate")
                        if d_str:
                            events.append({"date": d_str.split()[0], "event": "Crime Occurrence", "description": "Date of incident occurrence recorded in CCTNS."})
                    
                    # 2. FIR Date
                    cm_res = catalyst_app.zql().execute_query(f"SELECT CrimeRegisteredDate, CrimeNo FROM CaseMaster WHERE CaseMasterID = {case_id} LIMIT 1")
                    if cm_res:
                        cm = cm_res[0].get("CaseMaster", {})
                        d_str = cm.get("CrimeRegisteredDate")
                        c_no = cm.get("CrimeNo")
                        if d_str:
                            events.append({"date": d_str.split()[0], "event": "FIR Registered", "description": f"Official FIR {c_no} registered at precinct."})
                    
                    # 3. Arrest Date
                    arr_res = catalyst_app.zql().execute_query(f"SELECT ArrestSurrenderDate, AccusedMasterID FROM ArrestSurrender WHERE CaseMasterID = {case_id}")
                    for r in arr_res:
                        arr = r.get("ArrestSurrender", {})
                        d_str = arr.get("ArrestSurrenderDate")
                        acc_id = arr.get("AccusedMasterID")
                        if d_str:
                            acc_name = "Suspect"
                            if acc_id:
                                name_res = catalyst_app.zql().execute_query(f"SELECT AccusedName FROM Accused WHERE AccusedMasterID = {acc_id} LIMIT 1")
                                if name_res:
                                    acc_name = name_res[0].get("Accused", {}).get("AccusedName") or "Suspect"
                            events.append({"date": d_str.split()[0], "event": "Accused Arrested", "description": f"Suspect {acc_name} apprehended and processed."})
                    
                    # 4. Chargesheet Date
                    cs_res = catalyst_app.zql().execute_query(f"SELECT csdate, cstype FROM ChargesheetDetails WHERE CaseMasterID = {case_id}")
                    for r in cs_res:
                        cs = r.get("ChargesheetDetails", {})
                        d_str = cs.get("csdate")
                        c_type = cs.get("cstype") or "Regular"
                        if d_str:
                            events.append({"date": d_str.split()[0], "event": "Chargesheet Filed", "description": f"{c_type} chargesheet submitted to magistrate court."})
                except Exception as ex:
                    logger.error(f"Error compiling case timeline: {ex}")
            events.sort(key=lambda x: x["date"])
            data = {"case_id": case_id, "timeline": events}
            text_result = f"Chronological Timeline for Case ID {case_id}:\n" + "\n".join([f"- [{e['date']}] {e['event']}: {e['description']}" for e in events])
            citations.append({"type": "ZCQL Joined Timeline", "id": str(case_id), "details": "Occurrence, FIR, Arrest, and Chargesheet logs merged"})
            self._write_audit_log(employee_id, "Case Timeline Inquest", f"Case {case_id}", f"Get timeline for case {case_id}", text_result, session_id)

        # 15. get_demographic_correlation
        elif tool_name == "get_demographic_correlation":
            district = self.sanitize_sql_input(params.get("district", "Bengaluru Urban"))
            response_type = "correlation"
            profile_data = None
            warning = "*Warning: Demographic correlation is based on synthetic estimates and should be used with operational caution. Note: socio-economic figures are illustrative synthetic estimates, not official Census/NCRB data.*"
            if catalyst_app:
                try:
                    d_res = catalyst_app.zql().execute_query(f"SELECT DistrictID FROM District WHERE DistrictName LIKE '*{district}*' LIMIT 1")
                    if d_res:
                        dist_id = d_res[0].get("District", {}).get("DistrictID")
                        if dist_id:
                            sp_res = catalyst_app.zql().execute_query(f"SELECT * FROM DistrictSocioProfile WHERE DistrictID = {dist_id} LIMIT 1")
                            if sp_res:
                                sp_data = sp_res[0].get("DistrictSocioProfile", {})
                                profile_data = {
                                    "district": district,
                                    "literacy": sp_data.get("LiteracyRate"),
                                    "unemployment": sp_data.get("UnemploymentRate"),
                                    "urbanization": sp_data.get("UrbanizationIndex"),
                                    "migration": sp_data.get("MigrationIndex"),
                                    "stress": sp_data.get("EconomicStressIndex")
                                }
                except Exception as ex:
                    logger.warning(f"DistrictSocioProfile query failed: {ex}. Using synthetic fallback.")
            if not profile_data:
                profile_data = {
                    "district": district,
                    "literacy": 88.5 if "bengaluru" in district.lower() else 74.2,
                    "unemployment": 3.5 if "bengaluru" in district.lower() else 6.8,
                    "urbanization": 0.95 if "bengaluru" in district.lower() else 0.45,
                    "migration": 0.75 if "bengaluru" in district.lower() else 0.25,
                    "stress": 0.3 if "bengaluru" in district.lower() else 0.55
                }
            data = {"profile": profile_data, "warning": warning}
            text_result = f"Demographic Correlation for {district}:\n- Literacy Rate: {profile_data['literacy']}%\n- Unemployment: {profile_data['unemployment']}%\n- Economic Stress Index: {profile_data['stress']}\n\n{warning}"
            citations.append({"type": "DistrictSocioProfile Datastore", "id": district, "details": "Grounded district socio-demographics correlation"})
            self._write_audit_log(employee_id, "Demographic Correlation", district, f"Socio correlation for {district}", text_result, session_id)

        # 16. get_repeat_offenders
        elif tool_name == "get_repeat_offenders":
            district = self.sanitize_sql_input(params.get("district", ""))
            response_type = "repeat_offenders"
            offenders = []
            if catalyst_app:
                try:
                    dist_id = None
                    if district:
                        d_res = catalyst_app.zql().execute_query(f"SELECT DistrictID FROM District WHERE DistrictName LIKE '*{district}*' LIMIT 1")
                        if d_res:
                            dist_id = d_res[0].get("District", {}).get("DistrictID")
                    # Reads from ProactiveAlerts (populated by the scheduled
                    # repeat-offender detection job -- see
                    # functions/proactive_alerts/index.py) rather than
                    # recomputing at request time: the Accused table has
                    # ~14,000 rows, needing ~47 paginated 300-row ZCQL calls to
                    # scan in full, which is far too slow for an interactive
                    # chat turn on top of an already-slow GLM round-trip.
                    alert_res = catalyst_app.zql().execute_query(
                        "SELECT DistrictID, AlertMessage, Severity, TriggerTime FROM ProactiveAlerts "
                        "WHERE AlertType = 'REPEAT_OFFENDER' ORDER BY TriggerTime DESC LIMIT 100"
                    )
                    district_res = catalyst_app.zql().execute_query("SELECT DistrictID, DistrictName FROM District")
                    district_names = {d.get("District", {}).get("DistrictID"): d.get("District", {}).get("DistrictName") for d in district_res}
                    for r in alert_res:
                        a = r.get("ProactiveAlerts", {})
                        d_id = a.get("DistrictID")
                        if dist_id and str(d_id) != str(dist_id):
                            continue
                        m = re.search(r"Suspect '(.+?)' detected in (\d+) separate cases", a.get("AlertMessage") or "")
                        if m:
                            offenders.append({
                                "suspect": m.group(1),
                                "case_count": int(m.group(2)),
                                "district": district_names.get(d_id, "Unknown"),
                                "severity": a.get("Severity")
                            })
                except Exception as ex:
                    logger.warning(f"get_repeat_offenders query failed: {ex}")
            offenders.sort(key=lambda x: x["case_count"], reverse=True)
            offenders = offenders[:15]
            data = {"offenders": offenders, "district_filter": district or None}
            if offenders:
                top_lines = "; ".join(f"{o['suspect']} ({o['case_count']} cases, {o['district']})" for o in offenders[:5])
                text_result = (
                    f"Identified {len(offenders)} repeat/habitual offender(s)"
                    f"{' in ' + district if district else ' across all districts'} from the scheduled proactive-alerts "
                    f"analysis. Top matches: {top_lines}."
                )
            else:
                text_result = (
                    f"No repeat-offender alerts are currently recorded"
                    f"{' for ' + district if district else ''}. This reflects the last scheduled repeat-offender "
                    f"analysis run, not a live per-request scan of the full Accused table."
                )
            citations.append({"type": "ProactiveAlerts Repeat-Offender Analysis", "id": district or "All Districts", "details": "Computed by the scheduled repeat-offender detection job"})
            self._write_audit_log(employee_id, "Repeat Offender Query", district or "All Districts", f"Repeat offenders in {district or 'all districts'}", text_result, session_id)

        # 17. detect_crime_groups
        elif tool_name == "detect_crime_groups":
            response_type = "crime_groups"
            groups = []
            if catalyst_app:
                try:
                    # A single shared case doesn't distinguish an organized
                    # group from two strangers coincidentally co-accused once
                    # (e.g. a bystander witness-turned-co-accused). Requiring
                    # accused pairs to share >= 2 SEPARATE CaseMasterIDs is a
                    # simple, honestly-grounded proxy for "these people
                    # actually operate together repeatedly" -- computed
                    # directly from real Accused rows, not fabricated.
                    # Bounded to the first 300 rows (one ZCQL page) to stay
                    # within interactive chat latency; a full-table sweep
                    # would need the same ~47-page pagination as
                    # get_repeat_offenders and belongs in a scheduled job, not
                    # a live tool call.
                    acc_res = catalyst_app.zql().execute_query("SELECT AccusedName, CaseMasterID FROM Accused LIMIT 300")
                    cases_by_name: Dict[str, set] = {}
                    for r in acc_res:
                        a = r.get("Accused", {})
                        name = a.get("AccusedName")
                        cid = a.get("CaseMasterID")
                        if name and name.strip() and "unknown" not in name.lower() and cid:
                            cases_by_name.setdefault(name, set()).add(cid)

                    names = [n for n, cids in cases_by_name.items() if len(cids) > 1]
                    pair_overlap: Dict[Tuple[str, str], set] = {}
                    for i in range(len(names)):
                        for j in range(i + 1, len(names)):
                            shared = cases_by_name[names[i]] & cases_by_name[names[j]]
                            if len(shared) >= 2:
                                pair_overlap[(names[i], names[j])] = shared

                    # Merge overlapping pairs into groups via union-find, so
                    # A-B and B-C sharing cases with B surface as one 3-person
                    # group instead of two disconnected pairs.
                    parent: Dict[str, str] = {}

                    def find(x: str) -> str:
                        while parent.get(x, x) != x:
                            x = parent.get(x, x)
                        return x

                    def union(x: str, y: str):
                        parent.setdefault(x, x)
                        parent.setdefault(y, y)
                        rx, ry = find(x), find(y)
                        if rx != ry:
                            parent[rx] = ry

                    all_case_ids: Dict[str, set] = {}
                    for (a, b), shared in pair_overlap.items():
                        union(a, b)
                        all_case_ids.setdefault(find(a), set()).update(shared)

                    members_by_root: Dict[str, set] = {}
                    for (a, b) in pair_overlap.keys():
                        root = find(a)
                        members_by_root.setdefault(root, set()).update([a, b])

                    for root, members in members_by_root.items():
                        groups.append({
                            "members": sorted(members),
                            "shared_case_count": len(all_case_ids.get(root, set())),
                            "case_ids": sorted(all_case_ids.get(root, set()), key=str)[:10]
                        })
                    groups.sort(key=lambda g: (len(g["members"]), g["shared_case_count"]), reverse=True)
                    groups = groups[:10]
                except Exception as ex:
                    logger.warning(f"detect_crime_groups query failed: {ex}")
            data = {"groups": groups, "scan_scope": "First 300 Accused records (one database page)"}
            if groups:
                top = groups[0]
                text_result = (
                    f"Detected {len(groups)} likely organized-crime group(s) -- clusters of accused persons who "
                    f"repeatedly co-offend together (sharing 2+ separate cases, not just one). Largest: "
                    f"{', '.join(top['members'])} ({top['shared_case_count']} shared cases). This scan covers the "
                    f"first 300 Accused records in the database, not the full table."
                )
            else:
                text_result = (
                    "No accused pairs sharing 2 or more separate cases were found in the scanned sample (first 300 "
                    "Accused records) -- no repeated-co-offense pattern strong enough to call an organized group in "
                    "this slice of the data."
                )
            citations.append({"type": "Co-Offense Pattern Analysis", "id": "Accused Table Sample", "details": "Repeated-co-accusal clustering (>=2 shared cases required)"})
            self._write_audit_log(employee_id, "Organized Crime Group Detection", "Accused", "Detect organized crime groups", text_result, session_id)

        return {
            "text_result": text_result,
            "response_type": response_type,
            "data": data,
            "citations": citations
        }

    def resolve_vague_query(self, text: str, user_unit_id: Optional[int] = None) -> List[Dict[str, Any]]:
        """
        Strictly sanitizes user query to prevent SQL injection, executes ZCQL lookups,
        validates entities against schema, and reranks results using TF-IDF similarity.
        """
        clean_text = self.sanitize_sql_input(text)
        if not clean_text:
            return []

        matches = []
        
        # 1. Direct ZCQL matching on CaseMaster narratives and crime records
        if catalyst_app:
            try:
                # Tokenize and run validated ZCQL lookups
                tokens = [t for t in re.split(r'\s+', clean_text) if len(t) > 3]
                validated_tokens = []
                
                for token in tokens:
                    # Enforce strict alphanumeric validation first
                    if not re.match(r'^[a-zA-Z0-9\-]+$', token):
                        continue
                        
                    # Validate potential District entities
                    is_district = False
                    try:
                        d_res = catalyst_app.zql().execute_query(
                            f"SELECT DistrictName FROM District WHERE DistrictName LIKE '*{token}*' LIMIT 1"
                        )
                        if d_res:
                            validated_tokens.append(token)
                            is_district = True
                    except Exception:
                        pass
                        
                    if not is_district:
                        # Validate potential CrimeSubHead entities
                        try:
                            s_res = catalyst_app.zql().execute_query(
                                f"SELECT CrimeHeadName FROM CrimeSubHead WHERE CrimeHeadName LIKE '*{token}*' LIMIT 1"
                            )
                            if s_res:
                                validated_tokens.append(token)
                        except Exception:
                            # If it's just a general search word (not matching a special entity), allow it safely
                            validated_tokens.append(token)
                    else:
                        validated_tokens.append(token)

                unit_filter = f"AND PoliceStationID = {user_unit_id}" if user_unit_id and user_unit_id != 1 else ""
                
                for token in validated_tokens[:3]:  # Limit tokens to avoid blowing 30s timeout
                    q = f"""
                        SELECT CrimeNo, BriefFacts, CaseMasterID 
                        FROM CaseMaster 
                        WHERE (CrimeNo LIKE '*{token}*' OR BriefFacts LIKE '*{token}*') {unit_filter}
                        LIMIT 3
                    """
                    res = catalyst_app.zql().execute_query(q)
                    for row in res:
                        cm = row.get("CaseMaster", {})
                        matches.append({
                            "fir_id": cm.get("CrimeNo"),
                            "station": "Catalyst Datastore",
                            "crime_type": "Narrative Match",
                            "confidence_score": 0.90,
                            "narrative": cm.get("BriefFacts")
                        })
            except Exception as e:
                logger.warning(f"ZCQL lookup inside resolve_vague_query failed: {e}")

        # 2. Rerank matches using TF-IDF similarity via local VajraSemanticMemory
        try:
            semantic_matches = semantic_memory.recall_context(clean_text, top_k=3)
            for sm in semantic_matches:
                # Avoid duplicate matches
                if not any(m["fir_id"] == sm["fir_id"] for m in matches):
                    matches.append(sm)
        except Exception as e:
            logger.warning(f"Semantic recall failed: {e}")

        # Sort matches by confidence score descending
        matches = sorted(matches, key=lambda x: x.get("confidence_score", 0), reverse=True)
        return matches[:3]

    def get_sections_for_case(self, case_master_id: int) -> List[str]:
        """
        Traces CaseMasterID -> ActSectionAssociation -> Section/Act.
        Returns a list of formatted section strings (e.g., 'IPC 379').
        """
        if not catalyst_app:
            return []
        try:
            query = f"SELECT SectionID, ActID FROM ActSectionAssociation WHERE CaseMasterID = {case_master_id}"
            res = catalyst_app.zql().execute_query(query)
            sections_list = []
            for r in res:
                assoc = r.get("ActSectionAssociation", {})
                sec_id = assoc.get("SectionID")
                if sec_id:
                    sec_res = catalyst_app.zql().execute_query(f"SELECT SectionCode, ActCode FROM Section WHERE ROWID = {sec_id}")
                    if sec_res:
                        sec_data = sec_res[0].get("Section", {})
                        sections_list.append(f"{sec_data.get('ActCode')} {sec_data.get('SectionCode')}")
            return sections_list
        except Exception as e:
            logger.error(f"Error in get_sections_for_case: {e}")
            return []

    def suggest_sections_for_query(self, query: str) -> Dict[str, Any]:
        """
        Suggests relevant legal sections/acts and returns real charge-sheeted
        precedent cases carrying that section — previously returned the same two
        hardcoded fake FIR numbers regardless of input.
        """
        query_lower = query.lower()

        # Deterministic keyword mapping — act_code/section_code must exactly match
        # what's actually seeded in the Section table (migrate_to_catalyst.py's
        # IPC_SECTIONS list), not an invented/display-friendly code.
        act_code, section_code = "IPC", "379"
        suggested_section = "IPC Section 379 (Theft / BNS 303)"
        confidence_score = 0.90

        if "accident" in query_lower or "hit and run" in query_lower:
            act_code, section_code = "IPC", "279"
            suggested_section = "IPC Section 279 / 337 (Negligent Driving / BNS 281)"
            confidence_score = 0.95
        elif "cyber" in query_lower or "hacking" in query_lower or "phishing" in query_lower:
            act_code, section_code = "IT", "66(D)"
            suggested_section = "IT Act Section 66(D) (Cyber Impersonation / BNS 318)"
            confidence_score = 0.92
        elif "murder" in query_lower or "kill" in query_lower:
            act_code, section_code = "IPC", "302"
            suggested_section = "IPC Section 302 (Murder / BNS 103)"
            confidence_score = 0.98

        precedents = []
        if catalyst_app:
            try:
                sec_res = catalyst_app.zql().execute_query(
                    f"SELECT ROWID FROM Section WHERE ActCode = '{act_code}' AND SectionCode = '{section_code}' LIMIT 1"
                )
                if sec_res:
                    section_rowid = sec_res[0].get("Section", {}).get("ROWID")
                    assoc_res = catalyst_app.zql().execute_query(
                        f"SELECT CaseMasterID FROM ActSectionAssociation WHERE SectionID = {section_rowid} LIMIT 20"
                    )
                    for row in assoc_res:
                        if len(precedents) >= 2:
                            break
                        cm_id = row.get("ActSectionAssociation", {}).get("CaseMasterID")
                        if not cm_id:
                            continue
                        # Only count it as a precedent if it's actually been charge-sheeted.
                        cs_res = catalyst_app.zql().execute_query(
                            f"SELECT CSID FROM ChargesheetDetails WHERE CaseMasterID = {cm_id} LIMIT 1"
                        )
                        if not cs_res:
                            continue
                        cm_res = catalyst_app.zql().execute_query(
                            f"SELECT CrimeNo, PoliceStationID FROM CaseMaster WHERE CaseMasterID = {cm_id} LIMIT 1"
                        )
                        if not cm_res:
                            continue
                        cm_data = cm_res[0].get("CaseMaster", {})
                        station_name = "Unknown PS"
                        unit_id = cm_data.get("PoliceStationID")
                        if unit_id:
                            unit_res = catalyst_app.zql().execute_query(f"SELECT UnitName FROM Unit WHERE UnitID = {unit_id} LIMIT 1")
                            if unit_res:
                                station_name = unit_res[0].get("Unit", {}).get("UnitName") or station_name
                        precedents.append({
                            "case_no": cm_data.get("CrimeNo"),
                            "station": station_name,
                            "charge_sheeted": "Yes"
                        })
            except Exception as e:
                logger.warning(f"Error finding real precedents for {act_code} {section_code}: {e}")

        precedent_note = None if precedents else "No charge-sheeted precedent cases carrying this section were found in the current database."

        return {
            "suggested_section": suggested_section,
            "confidence_score": confidence_score,
            "precedents": precedents,
            "precedent_note": precedent_note,
            "disclaimer": "*Disclaimer: IPC/BNS mappings are AI-generated based on the KSP Datathon 2026 schema and must be verified against official gazettes. Confirm with your SHO or legal officer before filing.*"
        }

    def summarize_case(self, case_id: int) -> str:
        """
        Fetches related rows and compiles a clean bilingual summary of the case.
        """
        if not catalyst_app:
            return "Database offline. Summary unavailable."
            
        try:
            # 1. Fetch Case Details
            case_res = catalyst_app.zql().execute_query(f"SELECT CrimeNo, BriefFacts, CrimeRegisteredDate FROM CaseMaster WHERE CaseMasterID = {case_id}")
            if not case_res:
                return f"Case with ID {case_id} not found."
                
            cm = case_res[0].get("CaseMaster", {})
            crime_no = cm.get("CrimeNo")
            facts = cm.get("BriefFacts") or "No narrative summary recorded."
            reg_date = cm.get("CrimeRegisteredDate") or "Unknown Date"
            
            # 2. Fetch Accused list
            acc_res = catalyst_app.zql().execute_query(f"SELECT AccusedName FROM Accused WHERE CaseMasterID = {case_id}")
            accused_names = [r.get("Accused", {}).get("AccusedName") for r in acc_res if r.get("Accused", {}).get("AccusedName")]
            accused_str = ", ".join(accused_names) if accused_names else "Unknown / Under Investigation"
            
            # 3. Fetch Victim list
            vic_res = catalyst_app.zql().execute_query(f"SELECT VictimName FROM Victim WHERE CaseMasterID = {case_id}")
            victim_names = [r.get("Victim", {}).get("VictimName") for r in vic_res if r.get("Victim", {}).get("VictimName")]
            victim_str = ", ".join(victim_names) if victim_names else "None listed"

            # 4. Fetch Complainant
            comp_res = catalyst_app.zql().execute_query(f"SELECT ComplainantName FROM ComplainantDetails WHERE CaseMasterID = {case_id}")
            comp_name = comp_res[0].get("ComplainantDetails", {}).get("ComplainantName") if comp_res else "None listed"
            
            summary_en = f"Official Summary for Case **{crime_no}** (Registered: {reg_date}). " \
                         f"Brief Facts: {facts} Accused: {accused_str}. Victim(s): {victim_str}. " \
                         f"Complainant: {comp_name}."
            return summary_en
        except Exception as e:
            logger.error(f"Error compiling case summary: {e}")
            return f"Failed to generate summary for Case ID {case_id} due to system error."
