"""
VAJRA Cognitive Brain -- the real, working decision-making layer named in
the project's implementation plan, extracted here from agent_loop.py as its
own module rather than left as anonymous logic buried in a 7000-line file.

HONEST SCOPE (read before assuming this matches the plan doc's "8-Cortex
Neural Synapse" language literally): this is NOT a custom-trained neural
network or a novel reasoning architecture -- VAJRA runs on Zoho Catalyst
AppSail with no training infrastructure, so nothing here is a trained model.
"8-Cortex" in the plan is a naming/pitch layer over capabilities that are,
concretely, the four real mechanisms below. This file is the honest,
literal answer to "where does the Brain live" -- not a rewrite, a relocation
of already-verified-working code (see agent_loop.py's git history for the
original inline versions and the specific live bugs each one fixed).

CognitiveBrainMixin is mixed into VajraAgentLoop (see agent_loop.py's class
declaration) so every method here runs with full access to that class's
other methods and instance state via `self` -- exactly as if still defined
inline, just organized into its own named file. Four real mechanisms:

1. ROUTING (_classify_intent) -- one named, traceable decision point for
   "which deterministic decider, if any, already knows what tool this
   question needs," wrapping the Kannada/multi-keyword/keyword routers in
   their exact original tested order.
2. RELATIONSHIP UNDERSTANDING (_detect_relationship_query,
   _resolve_accused_name, _answer_relationship_between) -- recognizes and
   correctly answers a "how are X and Y connected" question instead of
   forcing a single-person answer onto a two-person question (a confirmed
   live bug this closed).
3. PLANNING (_is_complex_query, _resolve_plan_ref, _run_semantic_compiler)
   -- the one LLM-driven planner both Standard and Full Dossier modes share;
   compiles a natural-language question into a deterministic multi-step
   execution plan over the real tool registry, rather than a fixed template.
4. GROUNDING (_grounding_safety_net) -- the final honesty checkpoint every
   single answer passes through before reaching the officer, independently
   re-verifying POCSO redaction even if an upstream path forgot the rule.
"""
import json
import logging
import re
from typing import Any, Callable, Dict, List, Optional, Tuple

from vajra_core import catalyst_app, is_pocso_sensitive, is_supervisor_badge, has_active_pocso_grant

logger = logging.getLogger(__name__)


class CognitiveBrainMixin:
    """Mixed into VajraAgentLoop. Every method assumes the full set of
    sibling methods/attributes defined on that class (self._execute_tool,
    self._write_audit_log, self._resolve_case_rowid, self._route_kannada,
    self._keyword_route_multi, self._keyword_route_tool, self._extract_json,
    self.llm, self.officer_badge, ...) -- this mixin does not stand alone."""

    # ---- 1. ROUTING -----------------------------------------------------

    def _classify_intent(self, routing_query: str, officer_query: str) -> Dict[str, Any]:
        """
        THE BRAIN'S ROUTING DECISION -- one named, traceable entry point for
        "which deterministic decider, if any, already knows what tool this
        question needs." This is a pure WRAP of the exact same 3 deciders
        that used to run inline here, in the exact same tested order --
        Kannada-script router, then the English multi-tool router, then the
        single-tool router -- NOT a rewrite. Each was hardened by its own
        specific live bug (see their own docstrings: the Kannada router
        exists because the translator garbles domain queries and the
        English router never matches Kannada script; the keyword routers
        exist to skip a 15-140s GLM round trip for a clearly single-tool
        ask). Reordering or merging their internal logic is exactly the
        regression risk flagged in review -- ripping out a working fast-path
        can put simple-query latency back to 15-140s -- so this changes
        NOTHING about which decider wins or when; it only gives the same
        decision one name and a labeled trail (`decided_by`) instead of 3
        separate inline branches, so "why did VAJRA pick this tool" has one
        answer instead of needing to trace 3 places.
        """
        kn_dec = self._route_kannada(officer_query)
        if kn_dec:
            logger.info(f"Kannada-route: '{kn_dec['tool']}' chosen deterministically, skipping GLM")
            return {"forced_decision": kn_dec, "multi_decisions": None, "decided_by": "kannada"}
        multi_decisions = self._keyword_route_multi(routing_query)
        if multi_decisions:
            logger.info(f"Multi-tool route: {[d['tool'] for d in multi_decisions]}")
            return {"forced_decision": None, "multi_decisions": multi_decisions, "decided_by": "multi_keyword"}
        fast = self._keyword_route_tool(routing_query)
        if fast:
            logger.info(f"Fast-route: '{fast['tool']}' chosen deterministically, skipping GLM tool-selection")
            return {"forced_decision": fast, "multi_decisions": None, "decided_by": "keyword"}
        return {"forced_decision": None, "multi_decisions": None, "decided_by": "none"}

    # ---- 2. RELATIONSHIP UNDERSTANDING -----------------------------------

    def _detect_relationship_query(self, query: str) -> Optional[Tuple[str, str]]:
        """Detects a two-named-suspect relationship question ('how is X
        involved with Y', 'relation between X and Y', 'how are X and Y
        connected', etc.) and extracts both name spans. Deliberately narrow,
        specific phrase patterns -- not general NER -- because a false
        NEGATIVE here just falls through to the existing paths unchanged,
        while a false POSITIVE would misread an unrelated question as a
        relationship query, which is worse. Case-insensitive since an
        officer may type a name in lowercase (confirmed live)."""
        q = (query or "").strip()
        patterns = [
            r"how\s+(?:is|was)\s+([A-Za-z][A-Za-z .'-]{1,40}?)\s+(?:involved with|connected to|related to|linked to|associated with)\s+([A-Za-z][A-Za-z .'-]{1,40}?)[\?\.]*$",
            r"(?:relation|relationship|connection|link)\s+between\s+([A-Za-z][A-Za-z .'-]{1,40}?)\s+and\s+([A-Za-z][A-Za-z .'-]{1,40}?)[\?\.]*$",
            r"how\s+are\s+([A-Za-z][A-Za-z .'-]{1,40}?)\s+and\s+([A-Za-z][A-Za-z .'-]{1,40}?)\s+(?:connected|related|linked)",
        ]
        for pat in patterns:
            m = re.search(pat, q, re.IGNORECASE)
            if m:
                n1, n2 = m.group(1).strip(), m.group(2).strip()
                if n1 and n2 and n1.lower() != n2.lower() and len(n1) > 1 and len(n2) > 1:
                    return (n1, n2)
        return None

    def _resolve_accused_name(self, raw_name: str) -> Optional[str]:
        """Best-effort resolve a possibly-mistyped name to a real
        Accused.AccusedName on record. Tries the full typed name first, then
        falls back to just the last token (surname) -- confirmed live: an
        officer typed 'Qadin Shan' for the real record 'Qadim Shan', a
        one-letter first-name typo the full-string match alone would miss.
        Returns None (never a guessed name) when nothing resolves."""
        if not catalyst_app or not raw_name:
            return None
        esc = raw_name.replace("'", "''")
        try:
            res = catalyst_app.zql().execute_query(f"SELECT DISTINCT AccusedName FROM Accused WHERE AccusedName LIKE '*{esc}*' LIMIT 5")
            names = [r.get("Accused", {}).get("AccusedName") for r in res if r.get("Accused", {}).get("AccusedName")]
            if names:
                return names[0]
        except Exception:
            pass
        tokens = raw_name.split()
        if len(tokens) > 1:
            last = tokens[-1].replace("'", "''")
            if len(last) > 2:
                try:
                    res = catalyst_app.zql().execute_query(f"SELECT DISTINCT AccusedName FROM Accused WHERE AccusedName LIKE '*{last}*' LIMIT 5")
                    names = [r.get("Accused", {}).get("AccusedName") for r in res if r.get("Accused", {}).get("AccusedName")]
                    if len(names) == 1:
                        return names[0]
                except Exception:
                    pass
        return None

    def _answer_relationship_between(self, name1_raw: str, name2_raw: str, employee_id: int, session_id: str) -> Optional[Dict[str, Any]]:
        """Deterministic, specific answer for 'how are X and Y connected' --
        replaces two confirmed-live failure modes: (1) a generic case-search
        hit naming a case ID and telling the officer to go read it
        themselves instead of actually answering, and (2) Full Dossier mode
        ignoring the two-person question and dumping a single-person
        dossier for whichever name resolved first. Checks real shared-case
        membership (Accused.CaseMasterID intersection) AND the synthetic
        phone/vehicle overlap graph (AccusedContact, clearly labeled as
        such), and gives an honest 'no recorded link' answer instead of a
        fabricated or loosely-related pointer when neither is found."""
        if not catalyst_app:
            return None
        n1 = self._resolve_accused_name(name1_raw)
        n2 = self._resolve_accused_name(name2_raw)
        if not n1 or not n2:
            missing = name1_raw if not n1 else name2_raw
            return {
                "text": (f"I could not confidently match \"{missing}\" to a specific accused on record, so I can't "
                         f"determine a relationship. Please check the spelling, or give me the case number instead."),
                "response_type": "text", "data": {},
                "citations": [{"type": "Accused Datastore", "id": missing, "details": "No confident name match found."}],
                "is_simulated": False, "simulated_reason": ""
            }
        esc1, esc2 = n1.replace("'", "''"), n2.replace("'", "''")
        shared = set()
        try:
            r1 = catalyst_app.zql().execute_query(f"SELECT CaseMasterID FROM Accused WHERE AccusedName = '{esc1}'")
            r2 = catalyst_app.zql().execute_query(f"SELECT CaseMasterID FROM Accused WHERE AccusedName = '{esc2}'")
            cases1 = {r.get("Accused", {}).get("CaseMasterID") for r in r1 if r.get("Accused", {}).get("CaseMasterID") is not None}
            cases2 = {r.get("Accused", {}).get("CaseMasterID") for r in r2 if r.get("Accused", {}).get("CaseMasterID") is not None}
            shared = cases1 & cases2
        except Exception as e:
            logger.warning(f"_answer_relationship_between case lookup failed: {e}")
        shared_cases: List[Dict[str, Any]] = []
        for cm_id in list(shared)[:5]:
            try:
                fr = catalyst_app.zql().execute_query(f"SELECT CrimeNo, BriefFacts, PoliceStationID FROM CaseMaster WHERE CaseMasterID = {cm_id} LIMIT 1")
                if fr:
                    cm = fr[0].get("CaseMaster", {})
                    station = ""
                    ps = cm.get("PoliceStationID")
                    if ps:
                        u = catalyst_app.zql().execute_query(f"SELECT UnitName FROM Unit WHERE UnitID = {ps} LIMIT 1")
                        if u:
                            station = u[0].get("Unit", {}).get("UnitName") or ""
                    shared_cases.append({"crime_no": cm.get("CrimeNo"), "brief": cm.get("BriefFacts"), "station": station})
            except Exception:
                continue
        shared_contact = None
        try:
            cres = catalyst_app.zql().execute_query(f"SELECT AccusedName, PhoneNumber, VehicleNumber FROM AccusedContact WHERE AccusedName IN ('{esc1}', '{esc2}')")
            rows = {r.get("AccusedContact", {}).get("AccusedName"): r.get("AccusedContact", {}) for r in cres}
            c1, c2 = rows.get(n1), rows.get(n2)
            if c1 and c2:
                if c1.get("PhoneNumber") and c1.get("PhoneNumber") == c2.get("PhoneNumber"):
                    shared_contact = f"a shared phone number ({c1.get('PhoneNumber')})"
                elif c1.get("VehicleNumber") and c1.get("VehicleNumber") == c2.get("VehicleNumber"):
                    shared_contact = f"a shared vehicle ({c1.get('VehicleNumber')})"
        except Exception:
            pass

        lines = [f"Relationship between **{n1}** and **{n2}**:"]
        citations: List[Dict[str, Any]] = []
        if shared_cases:
            lines.append(f"- Co-accused together in {len(shared_cases)} shared case(s):")
            for sc in shared_cases:
                lines.append(f"  - {sc['crime_no'] or 'case number not recorded'} at "
                             f"{sc['station'] or 'station not recorded'}: {sc['brief'] or 'no brief facts recorded'}")
            citations.append({"type": "CCTNS Database Record",
                              "id": ", ".join(sc['crime_no'] for sc in shared_cases if sc['crime_no']) or "shared case",
                              "details": "Shared CaseMasterID between both accused records."})
        if shared_contact:
            lines.append(f"- Network link: {shared_contact} (synthetic phone/vehicle overlap enrichment for this "
                         f"demo dataset -- not an official CCTNS field).")
            citations.append({"type": "AccusedContact Datastore", "id": f"{n1} / {n2}",
                              "details": "Synthetic phone/vehicle overlap enrichment."})
        if not shared_cases and not shared_contact:
            lines.append("- No shared case record and no shared phone/vehicle link were found between these two "
                         "names in the database -- there is no recorded connection to report.")
            citations.append({"type": "Accused + AccusedContact Datastore", "id": f"{n1} / {n2}", "details": "No overlap found."})

        return {
            "text": "\n".join(lines), "response_type": "text",
            "data": {"name1": n1, "name2": n2, "shared_cases": shared_cases, "shared_contact": shared_contact},
            "citations": citations, "is_simulated": False, "simulated_reason": ""
        }

    # ---- 3. PLANNING ------------------------------------------------------

    _COMPILER_CAPABILITIES = [
        {"name": "query_hotspots", "does": "crime hotspot clusters on a map, per district or statewide", "params": {"district": "district name, optional"}},
        {"name": "get_crime_trends", "does": "monthly crime counts/trend over time for a district", "params": {"district": "optional", "crime_group": "crime type, optional"}},
        {"name": "get_repeat_offenders", "does": "ranked list of repeat/habitual offenders", "params": {"district": "optional", "top_n": "optional integer 1-50, defaults to 15 -- pass the exact number the officer asked for (e.g. 'top 20')"}},
        {"name": "list_suspects_by_crime_type", "does": "list suspects/accused linked to a specific crime type/category (e.g. money laundering, cybercrime, theft) -- use this, NOT get_repeat_offenders, when the officer asks for suspects by crime type rather than by district", "params": {"crime_type": "required -- the crime category to filter by", "district": "optional", "top_n": "optional integer 1-50, defaults to 15"}},
        {"name": "list_cases", "does": "list the ACTUAL cases (crime number, date, station) matching a crime type/district/station/year -- use this, NOT count_cases, when the officer wants the specific cases named rather than just a total", "params": {"crime_group": "optional crime category", "district": "optional", "station": "optional specific police station, more specific than district", "year": "optional 4-digit year", "top_n": "optional integer, defaults to 15, max 30"}},
        {"name": "search_by_identifier", "does": "look up which suspect a bare phone number or vehicle number belongs to (from a tip-off, CCTV plate, or call record) -- use when the officer has a raw number, NOT a suspect name", "params": {"identifier": "required -- the phone number or vehicle number to search for"}},
        {"name": "list_wanted_accused", "does": "list accused persons who are still at large / absconding (no arrest record on file), optionally filtered by crime type and/or district", "params": {"crime_group": "optional", "district": "optional", "top_n": "optional integer, defaults to 15, max 30"}},
        {"name": "list_cases_by_status", "does": "list actual cases that are pending chargesheet or already chargesheeted -- use this, NOT case_outcome_analytics, when the officer wants the specific cases named rather than a percentage", "params": {"status": "'pending' (default) or 'chargesheeted'", "crime_group": "optional", "district": "optional", "top_n": "optional integer, defaults to 15, max 30"}},
        {"name": "list_victims_by_category", "does": "list victims linked to cases of a specific crime type/district -- identities auto-masked on POCSO/juvenile-victim sensitive cases", "params": {"crime_group": "optional", "district": "optional", "top_n": "optional integer, defaults to 15, max 25"}},
        {"name": "get_offender_risk", "does": "conviction-risk score for ONE named suspect", "params": {"suspect_name": "required"}},
        {"name": "query_graph_network", "does": "criminal network/associates of ONE named suspect", "params": {"suspect_name": "required"}},
        {"name": "get_mo_profile", "does": "modus-operandi profile for ONE named suspect", "params": {"suspect_name": "required"}},
        {"name": "query_financial_links", "does": "financial transaction links for a named entity", "params": {"entity_id": "required name"}},
        {"name": "get_case_types_distribution", "does": "breakdown of cases by crime type (pie/bar)", "params": {"district": "optional"}},
        {"name": "get_priority_concerns", "does": "top emerging crime concerns ranked by momentum", "params": {"district": "optional", "top_n": "optional integer 1-30, defaults to 10"}},
        {"name": "get_forecast", "does": "next-period crime forecast for a district", "params": {"district": "optional", "crime_type": "optional"}},
        {"name": "get_demographic_correlation", "does": "socio-economic correlation with crime for a district", "params": {"district": "required"}},
        {"name": "rank_districts", "does": "rank ALL districts by crime volume, worst first", "params": {}},
        {"name": "get_database_overview", "does": "total FIRs + crime-type overview for the whole database", "params": {}},
        {"name": "count_cases", "does": "exact COUNT of cases, optionally filtered by crime type, district, and/or a 4-digit year (answers 'how many X in Y in YYYY')", "params": {"district": "optional", "crime_group": "optional crime type", "year": "optional 4-digit year"}},
        {"name": "list_cases_sharing_id", "does": "list the OTHER cases sharing the same internal database ID (CaseMasterID) as a given case -- use this, NOT query_graph_network or find_similar_cases, for 'linked by internal ID' / 'shares this ID' questions; this is a data-quality quirk, not a real link", "params": {"case_no": "required"}},
        {"name": "query_case", "does": "details of ONE case by its case number", "params": {"case_no": "required"}},
        {"name": "get_case_timeline", "does": "chronological timeline of ONE case", "params": {"case_no": "required"}},
        {"name": "get_case_sections", "does": "legal sections applied to ONE case", "params": {"case_no": "required"}},
        {"name": "find_similar_cases", "does": "semantic search for cases matching a description", "params": {"query": "the search text"}},
        {"name": "analyze_online_abuse", "does": "triage an online-abuse/cybercrime complaint into offences + evidence steps", "params": {"content": "the complaint text"}},
        {"name": "get_live_news", "does": "live open-source news headlines for a district/topic (unverified public leads, not official records)", "params": {"district": "district or topic, optional", "query": "the raw request, optional"}},
        {"name": "web_search", "does": "live open-source web search for any external topic (unverified public results, not official records)", "params": {"query": "what to search for"}},
        {"name": "shared_attribute_links", "does": "find OTHER accused who share a named suspect's phone or vehicle (hidden syndicate links)", "params": {"suspect_name": "required"}},
        {"name": "community_detection", "does": "detect syndicate clusters of accused bound by a shared phone/vehicle", "params": {"top_n": "optional integer 1-30, defaults to 8 -- pass the exact number the officer asked for"}},
        {"name": "centrality_ranking", "does": "rank accused by how connected they are over the shared-attribute graph (likely hubs/kingpins)", "params": {"top_n": "optional integer 1-30, defaults to 10 -- pass the exact number the officer asked for"}},
        {"name": "anomaly_detection", "does": "statistical anomaly call-outs (monthly z-score spike + category-momentum break) for a district", "params": {"district": "optional"}},
        {"name": "summarize_url", "does": "read and summarize any public web page/article by URL (unverified external content)", "params": {"url": "the URL", "query": "the raw request, optional"}},
        # These 5 real, working tools existed in the app's own tool registry
        # but were NEVER registered here -- confirmed live via a full diff of
        # every _execute_tool branch against this list (39 real tools, only
        # 26 visible to the Brain). The planner could never include them in
        # any plan no matter how the officer phrased the question, since
        # _run_semantic_compiler silently drops any step naming a capability
        # outside this exact set.
        {"name": "detect_financial_ring", "does": "money-laundering/hawala ring detection: traverses the financial-transaction graph from one entity to find mule accounts, layering chains, and collection/distribution hubs", "params": {"entity_id": "required -- suspect name or account/wallet reference"}},
        {"name": "summarize_case", "does": "narrative case summary (victims, accused, brief facts) for ONE case by its case number", "params": {"case_no": "required"}},
        {"name": "detect_crime_groups", "does": "detect likely organized crime groups from accused who have repeatedly co-offended together across multiple separate cases", "params": {"top_n": "optional integer 1-30, defaults to 10"}},
        {"name": "plan_patrol_deployment", "does": "predictive beat planning: ranked patrol-deployment recommendation fusing hotspot density + crime trend + repeat-offender presence", "params": {"district": "optional, omit for a state-wide plan"}},
        {"name": "suggest_sections", "does": "recommend applicable legal sections (IPC/BNS) and find precedent cases for a described crime", "params": {"crime_description": "required -- description of the incident"}},
        {"name": "get_my_profile", "does": "the requesting officer's OWN identity/assignment (rank, unit, district) -- not a suspect lookup", "params": {}},
        {"name": "case_outcome_analytics", "does": "real state-wide case-outcome statistics: chargesheet rate and arrest rate as a percentage of total cases on record", "params": {}},
        {"name": "recommend_sections", "does": "recommend applicable legal sections for an EXISTING case by number, with real precedent FIRs that carried the same sections (use suggest_sections instead for a free-text crime description with no case number yet)", "params": {"case_no": "the existing case number, if recommending for a specific case", "description": "free-text crime description, if no case number exists yet"}},
    ]

    # Multi-step cues + analytical keywords used by the AUTO-ROUTER to decide when
    # a Standard query is complex enough to deserve the AI Reasoning compiler.
    _COMPLEX_STRONG_CUES = (
        "network of the", "risk of the", "compare", "difference between", "differences between",
        "for each", " then ", "along with", "combined with", "as well as", "relationship between",
        "connected to the", "who else", "and also", "and their", "and show", "and give",
        # Broadened after a confirmed live miss: "which crime type is rising
        # fastest in X this year AND WHAT STATIONS are seeing the most
        # cases" hit none of the cues above and only 1 keyword hit, so
        # _is_complex_query returned False and the Brain was never even
        # asked -- the officer silently got only half their question
        # answered. These connector phrases are a strong, general signal of
        # "a second, distinct question is embedded in this one," regardless
        # of which specific analytical keywords appear around it.
        "and what", "and which", "and who", "and how many", "and where", "and when",
        "as well", "in addition", "also tell me", "also check", "also show",
    )
    _CAP_KEYWORDS = (
        "hotspot", "trend", "network", "risk", "modus", "financial", "money", "offender",
        "forecast", "predict", "demographic", "socio", "case", "section", "timeline",
        "distribution", "concern", "victim", "conviction", "clearance", "community",
        "cluster", "associate", "syndicate", "ranking", "station", "rising", "fastest",
    )

    def _is_complex_query(self, query: str) -> bool:
        """Auto-router heuristic: a Standard query is 'complex' (route to the AI
        Reasoning compiler) when it has an explicit multi-step cue, OR touches 2+
        analytical facets joined by 'and'/','. Kept conservative so simple lookups
        stay on the fast ~3s path and don't pay the planning-LLM tax."""
        q = (query or "").lower()
        if any(c in q for c in self._COMPLEX_STRONG_CUES):
            return True
        hits = sum(1 for k in self._CAP_KEYWORDS if k in q)
        return hits >= 2 and (" and " in q or ", " in q)

    @staticmethod
    def _resolve_plan_ref(ref: str, results: Dict[str, Any]) -> Any:
        """Resolve a DAG dependency like "$s1.data.offenders.0.suspect" against the
        stored outputs of earlier steps. Returns None if the path can't be walked
        (the step then simply runs without that param)."""
        parts = ref[1:].split(".")
        cur: Any = results.get(parts[0])
        for p in parts[1:]:
            if cur is None:
                return None
            if isinstance(cur, dict):
                cur = cur.get(p)
            elif isinstance(cur, list):
                try:
                    cur = cur[int(p)]
                except (ValueError, IndexError):
                    return None
            else:
                return None
        return cur

    def _run_semantic_compiler(self, query: str, employee_id: int, session_id: str,
                               user_unit_id: Optional[int], deep: bool = False,
                               progress_cb: Optional[Callable[[str], None]] = None,
                               history: Optional[List[Dict[str, str]]] = None) -> Optional[Dict[str, Any]]:
        """
        Compile the officer's natural-language query into a JSON execution plan
        via the LLM, then execute it DETERMINISTICALLY over the grounded tools.
        Returns a run_agent_loop-style dict, or None to fall back to the standard
        path (graceful degradation) when planning fails.

        THE BRAIN: this planner is the ONE engine both modes run -- `deep` is
        the only thing that changes. Standard (deep=False) asks for the
        MINIMAL plan that answers exactly what was asked, and only runs when
        the free deterministic fast-paths (case fast-path, keyword routers)
        didn't already answer -- those stay untouched for latency reasons.
        Full Dossier (deep=True) is this planner's PRIMARY job, always, per
        explicit direction (2026-09-03): no fixed panel template is the
        default Dossier answer shape anymore. deep=True's depth_rule
        explicitly requires a comprehensive multi-capability sweep by name
        (not just "be thorough") to minimize the real, previously-confirmed
        risk of the planner picking one narrow tool instead of a complete
        answer. The caller falls back to a fixed composite ONLY if this
        returns None (a genuine planning failure) in Dossier mode -- a
        safety net, not the default.

        `history` (recent prior turns, most recent last) is what makes the
        "ask, don't guess" flow actually work end to end: when this planner
        asks a clarifying question, the turn ends there -- there is no
        paused/resumed execution state. The officer's next message is a
        BRAND NEW turn; without the preceding conversation this planner
        would see only their short reply ("Bengaluru Urban") with no memory
        of what was originally asked or what question that's answering.
        Passing history lets the planner recombine the original request
        with the clarifying answer instead of planning against a bare
        district/name in isolation.
        """
        self._last_compiler_failure_reason = None  # cleared each attempt; the
        # caller reads this ONLY when this call returns None, to surface a
        # real diagnostic reason on the fallback citation instead of a bare
        # "AI planner was unavailable" with no way to tell why.
        names = {c["name"] for c in self._COMPILER_CAPABILITIES}
        registry = "\n".join(f"- {c['name']}: {c['does']} | params: {json.dumps(c['params'])}"
                             for c in self._COMPILER_CAPABILITIES)
        # Confirmed live: "show their case id" inside an ongoing Full Dossier
        # thread took ~70s because deep=True's depth_rule unconditionally
        # demands a comprehensive multi-capability sweep REGARDLESS of what
        # was actually asked -- a short, specific follow-up referring back to
        # something already on screen paid the same cost as the original
        # "tell me everything" request. The comprehensive sweep already ran
        # for that original question; a narrow follow-up should get a fast,
        # targeted answer instead of repeating it. Deliberately narrow
        # trigger (short query + a back-reference pronoun + real prior
        # history) so an actual fresh "tell me everything about X" request
        # in Dossier mode is never downgraded.
        # Confirmed live bug: `query` here almost always carries a prepended
        # "[Context: you are speaking with Officer ...]\n\n" block (~50+
        # words, added in main.py whenever the officer's identity is known --
        # i.e. basically always in real use), which blew past the word-count
        # check below on every single real request, so this heuristic never
        # actually fired outside a bare, context-free test call. Strip that
        # known prefix before measuring the query's real length.
        _core_query = re.sub(r"^\[Context:.*?\]\n\n", "", (query or ""), flags=re.DOTALL)
        _FOLLOWUP_PRONOUNS = ("their", "his", "her", "its", "that", "this", "it ", "them", "those", "these")
        _is_narrow_followup = (
            deep and bool(history) and len(_core_query.split()) <= 10
            and any(p in f" {_core_query.strip().lower()} " for p in _FOLLOWUP_PRONOUNS)
        )
        depth_rule = (
            "- NARROW FOLLOW-UP (even though Full Dossier is the overall mode): this message is short and refers "
            "back to something already discussed (\"their\", \"his\", \"it\", \"that\", etc.) -- the comprehensive "
            "sweep already happened for the original question in CONTEXT ABOVE. Plan ONLY the minimal steps that "
            "answer THIS specific follow-up, using CONTEXT ABOVE to resolve what the pronoun refers to. Do not "
            "repeat a full comprehensive sweep for a narrow, specific ask."
            if _is_narrow_followup else
            "- FULL DOSSIER MODE: the officer explicitly chose the deep, comprehensive view -- this is an "
            "instruction to go deep, not just answer the literal wording. This mode has NO fixed template to "
            "fall back on -- YOU decide the complete set of steps. Concretely:\n"
            "  * If ONE named suspect is the subject: include ALL of get_offender_risk, query_graph_network, "
            "get_mo_profile as separate steps (each takes suspect_name), plus find_similar_cases if relevant. "
            "Do not stop at one of these -- a dossier with only a risk score and nothing else is incomplete.\n"
            "  * If ONE case number is the subject: include ALL of query_case, get_case_timeline, "
            "get_case_sections as separate steps (each takes case_no), plus find_similar_cases using the case's "
            "facts if useful.\n"
            "  * If the question specifically asks about TWO named people (a relationship/connection between "
            "them, not one person's profile): do NOT force a single-person sweep -- plan steps that actually "
            "answer the two-person question (e.g. query_graph_network or shared_attribute_links for each name), "
            "and put the direct relationship finding in `intent`.\n"
            "  * If a district is the subject: include get_crime_trends, get_case_types_distribution, and "
            "query_hotspots at minimum.\n"
            "  Use MORE steps than you think necessary rather than fewer -- an incomplete dossier is a worse "
            "failure here than a couple of extra grounded lookups."
            if deep else
            "- STANDARD MODE: plan the MINIMAL steps that actually answer what was asked. Do not add extra "
            "facets the officer didn't ask for -- a short, focused plan is correct here, not a comprehensive one."
        )
        planner_sys = (
            "You are the PLANNER for VAJRA, a Karnataka State Police intelligence system. You do NOT answer the "
            "officer. You COMPILE their request into a JSON execution plan that a deterministic engine runs.\n\n"
            "CAPABILITIES (use ONLY these names):\n" + registry + "\n\n"
            "Output ONLY one JSON object, no prose, no markdown. Schema:\n"
            '{"intent": "<one short sentence>", "steps": [{"id": "s1", "capability": "<name>", "params": {..}}], '
            '"present_as": "auto|pie|bar|line|map|network|timeline|table|text", '
            '"needs_clarification": false}\n\n'
            "RULES:\n"
            "- Give each step a short id (s1, s2, ...). Steps run in order.\n"
            "- DEPENDENCIES: a later step may USE an earlier step's output as a param value with the syntax "
            '"$<id>.<path>". Chainable outputs: get_repeat_offenders -> "$s1.data.offenders.0.suspect" is the top '
            'offender name; rank_districts -> "$s1.data.series.0.name" is the worst district.\n'
            '  Example -- "network of the most active offender": '
            '{"intent":"Network of the top repeat offender","steps":['
            '{"id":"s1","capability":"get_repeat_offenders","params":{}},'
            '{"id":"s2","capability":"query_graph_network","params":{"suspect_name":"$s1.data.offenders.0.suspect"}}],'
            '"present_as":"network"}\n'
            "- Extract quantifiers, district names, suspect names, and case numbers into params.\n"
            "- Use MULTIPLE steps for compound asks. To compare two districts, add get_crime_trends once PER district.\n"
            "- Choose present_as to fit the answer (a distribution -> pie/bar, a network -> network, a route over time -> line).\n"
            "- If the request is a greeting or needs no data, return steps: [] and put a short reply in intent. "
            "Write it like a sharp colleague greeting an officer -- plain, warm, direct, no stiff form-letter "
            "phrasing (\"I am ready to assist you with your queries\") -- but never playful/emoji, this stays a "
            "professional police tool.\n"
            "- ASK, DON'T GUESS (applies to EVERY request, not a special case): if the request is genuinely "
            "ambiguous, or is missing information you would need to answer well -- a name/case/district that "
            "could reasonably mean more than one thing, a request too vague to plan concrete steps for, a "
            "quantifier or scope that isn't clear -- do NOT invent an assumption and plan around it. Set "
            '"needs_clarification": true, "steps": [], and put the EXACT question you would ask the officer in '
            "intent (e.g. \"Which district did you mean -- Bengaluru Urban or Bengaluru Rural?\", \"Which "
            "Ramesh -- can you give a fuller name or a case number?\"). This is a real, first-class outcome, "
            "not a fallback -- a wrong confident guess is worse than asking. Only ask when something is "
            "actually unclear; do not ask for confirmation on a request that's already clear.\n"
            "- NEVER invent capability names or data. Plan only; the engine executes.\n"
            "- CONTEXT ABOVE (if present): earlier turns in this conversation, most recent last. If the last "
            "assistant turn asked a clarifying question and this officer's new message is answering it (a short "
            "reply like a name or district alone), combine that answer with the ORIGINAL request from earlier "
            "in this context to plan the real steps now -- do not ask the same thing again, and do not plan "
            "against the short reply in isolation as if it were the whole request.\n"
            + depth_rule
        )
        try:
            _history_msgs = [h for h in (history or [])[-7:-1] if isinstance(h, dict) and h.get("content")]
            # max_tokens raised from 800 -> 3500 -> 6000. Confirmed live root
            # cause of the planner reliably returning an empty plan (0
            # steps, empty intent) in Dossier mode: the deployed GLM model
            # is a "thinking" model that emits extensive reasoning text
            # BEFORE its actual JSON answer -- catalyst_llm.py's own history
            # documents this exact failure mode once already (its default
            # was raised 1000 -> 2500 for the same reason). 3500 already
            # fixed the observed failure (confirmed live: a 4-step plan
            # compiled successfully), but a deep Dossier plan can run up to
            # 6 steps with a long depth_rule prompt driving longer
            # reasoning -- deliberately generous headroom here per explicit
            # direction, comparable to the 4000 another real call in
            # catalyst_llm.py already uses safely (no documented hard cap
            # found on this endpoint; if the API itself rejects/clips a
            # value this high, lower it and re-test rather than guess again).
            res = self.llm.chat(
                [{"role": "system", "content": planner_sys}] + _history_msgs + [{"role": "user", "content": query}],
                None, max_tokens=6000)
            raw = ""
            if res.get("error"):
                # Confirmed live: this call previously had NO fallback at all
                # -- an outage or GLM's own baked-in guardrail refusal
                # (llm_guardrail_refusal) meant the SAME unreliable call just
                # got retried once more by the caller, hitting the identical
                # failure twice, then silently downgrading to the fixed
                # comprehensive composite regardless of what was actually
                # asked. Try Qwen (a genuinely different model/deployment,
                # confirmed this session to have independent uptime from
                # GLM) before giving up on this attempt.
                logger.warning(f"compiler: GLM planner unavailable ({res.get('error')}); trying Qwen fallback.")
                from catalyst_qwen import CatalystQwen
                qwen_raw = CatalystQwen().plan(planner_sys, query)
                if not qwen_raw:
                    self._last_compiler_failure_reason = f"llm_error: {str(res.get('error'))[:120]} (qwen fallback also failed)"
                    logger.warning("compiler: Qwen planning fallback also failed; falling back.")
                    return None
                raw = qwen_raw
            else:
                raw = (res.get("choices") or [{}])[0].get("message", {}).get("content", "") or ""
            plan = json.loads(self._extract_json(raw))
        except Exception as e:
            self._last_compiler_failure_reason = f"plan_parse_failed: {str(e)[:150]}"
            logger.warning(f"compiler: plan parse failed ({e}); falling back to standard path.")
            return None
        if not isinstance(plan, dict):
            self._last_compiler_failure_reason = f"plan_not_dict: got {type(plan).__name__}"
            return None
        intent = (plan.get("intent") or "").strip()
        present_as = str(plan.get("present_as") or "auto").lower()
        needs_clarification = bool(plan.get("needs_clarification"))
        steps = [s for s in (plan.get("steps") or [])
                 if isinstance(s, dict) and s.get("capability") in names]
        # No-data intent: either a genuine "ask, don't guess" moment (a real,
        # first-class outcome now, not a fallback) or a plain direct reply
        # (greeting / no lookup needed) -- distinguished so the citation
        # tells the truth about which one happened, not a generic "answered
        # directly" label on what's actually a clarifying question.
        if not steps:
            if intent and needs_clarification:
                return {"text": intent, "response_type": "text", "data": {"needs_clarification": True},
                        "citations": [{"type": "Clarification Requested", "id": "ambiguous",
                                       "details": "The request was ambiguous or missing information needed to "
                                                  "answer well -- asked instead of guessing."}],
                        "is_simulated": False, "simulated_reason": ""}
            if intent:
                return {"text": intent, "response_type": "text", "data": {},
                        "citations": [{"type": "AI Execution Plan", "id": "direct",
                                       "details": "Answered directly; the plan required no data lookup."}],
                        "is_simulated": False, "simulated_reason": ""}
            _raw_steps = plan.get("steps")
            self._last_compiler_failure_reason = (
                f"no_valid_steps: plan had {len(_raw_steps) if isinstance(_raw_steps, list) else 0} raw step(s), "
                f"none matched a known capability name (raw intent: {intent[:80]!r})")
            return None
        # DETERMINISTIC EXECUTION -- run each planned step over the grounded tools.
        # Steps can DEPEND on earlier ones: a "$s1.data.offenders.0.suspect" param
        # is resolved from the stored output of step s1 before this step runs.
        # Cap raised 6 -> 10: the depth_rule for Full Dossier explicitly asks
        # for a comprehensive multi-capability sweep, and max_tokens is now
        # 6000 (up from 800) -- 6 steps was leaving real headroom unused for
        # a genuinely broad request. Each step is still a real grounded tool
        # call, so this bounds cost/latency deliberately, just at a truer
        # ceiling for what "comprehensive" should mean now.
        panels, combined, citations, last = [], [], [], None
        results: Dict[str, Any] = {}
        _p = progress_cb or (lambda _msg: None)
        for idx, st in enumerate(steps[:10]):
            sid = st.get("id") or f"s{idx + 1}"
            cap = st["capability"]
            params = {}
            for k, v in (st.get("params") or {}).items():
                rv = self._resolve_plan_ref(v, results) if isinstance(v, str) and v.startswith("$") else v
                if rv not in (None, ""):
                    params[k] = rv
            _p(f"Checking {cap.replace('_', ' ')}...")
            try:
                out = self._execute_tool(cap, params, employee_id, session_id, user_unit_id)
            except Exception as e:
                logger.warning(f"compiler: step '{cap}' failed: {e}")
                results[sid] = {}
                continue
            results[sid] = out
            if out.get("citations"):
                citations.extend(out["citations"])
            rt = out.get("response_type") or "text"
            rtext = (out.get("text_result") or "").strip()
            last = out
            panels.append({"type": rt if rt != "text" else "text", "panel_key": cap,
                           "title_en": cap.replace("_", " ").title(), "title_kn": cap.replace("_", " ").title(),
                           "data": out.get("data"), "text": rtext})
            if rtext:
                combined.append(rtext)
        if not panels or last is None:
            self._last_compiler_failure_reason = (
                f"all_steps_failed_execution: planned {len(steps[:10])} step(s) "
                f"({[s.get('capability') for s in steps[:10]]}), none produced a usable result")
            return None
        if len(panels) == 1:
            resp_type = last.get("response_type") or "text"
            data_payload = last.get("data") or {}
            text_out = (last.get("text_result") or intent or "Done.").strip()
            # honour a chart present_as on chartable data (e.g. "... as a pie chart")
            if present_as in ("pie", "bar") and (data_payload.get("series") or data_payload.get("offenders")):
                series = self._extract_chartable_series(resp_type, data_payload)
                if series:
                    data_payload = {"series": series, "total": sum(s["value"] for s in series),
                                    "district": "", "chart_hint": present_as}
                    resp_type = "case_distribution"
        else:
            resp_type = "dossier"
            data_payload = {"panels": panels}
            # BUG FIX (confirmed live): this used to be `intent or
            # "\n\n".join(combined[:4])` -- since `intent` (the planner's
            # own one-line summary, e.g. "Retrieve risk score, criminal
            # network, and financial links for Sanaya Patla") is almost
            # always non-empty, it ALWAYS won, so the officer's visible
            # answer was just that bare restated question, never the real
            # grounded content each step actually produced (risk score, MO
            # match, network size, etc.) -- even though the right tools ran
            # and the right data was in data.panels the whole time. Now
            # leads with intent as a one-line summary WHEN there is real
            # content to follow, and only falls back to a bare intent/
            # "Done." when a step genuinely produced no text at all.
            _text_parts = ([intent] if intent else []) + (["\n\n".join(combined[:4])] if combined else [])
            text_out = "\n\n".join(_text_parts) if _text_parts else "Done."

            # MULTI-HYPOTHESIS REASONING + DEVIL'S ADVOCATE (Full Dossier
            # only, one bounded extra call, never on the fast Standard path):
            # a genuinely deeper investigative layer on top of the already-
            # grounded findings above -- NOT a replacement for them. Every
            # hypothesis here is explicitly Tier 2 (an inferential working
            # theory, scored, never presented as a fact) and must be
            # supported by SOMETHING already gathered in `combined` -- the
            # model is not asked to invent new facts, only to reason over
            # what these real tool results already show. Best-effort: a
            # failure here silently drops this section, never breaks or
            # delays the grounded Tier-1 dossier above.
            if deep and combined and not _is_narrow_followup:
                hyp = self._generate_hypotheses_and_devils_advocate(query, combined)
                if hyp and hyp.get("hypotheses"):
                    data_payload["hypotheses"] = hyp["hypotheses"]
                    data_payload["devils_advocate"] = hyp.get("devils_advocate")
                    lines = ["\n\n---\n**Tier 2 -- Investigative Working Hypotheses** "
                            "(inferential, not established fact -- verify before acting):"]
                    for h in hyp["hypotheses"]:
                        lines.append(f"- **{h.get('theory', 'Hypothesis')}** (confidence {h.get('confidence', 0):.0%}): "
                                     f"{h.get('rationale', '')}")
                    if hyp.get("devils_advocate"):
                        lines.append(f"\n**Devil's Advocate -- counter-evidence to check before relying on the "
                                     f"leading theory:** {hyp['devils_advocate']}")
                    text_out += "\n".join(lines)
        citations.append({"type": "AI Execution Plan", "id": (intent[:60] or "plan"),
                          "details": (f"Compiled to {len(panels)} grounded step(s): "
                                      f"{', '.join(p['panel_key'] for p in panels)}. "
                                      "The AI planned; a deterministic engine executed each step.")})
        self._write_audit_log(employee_id, "Semantic Compiler", intent[:80], query, text_out, session_id)
        return {"text": text_out, "response_type": resp_type, "data": data_payload,
                "citations": citations, "is_simulated": False, "simulated_reason": ""}

    def _generate_hypotheses_and_devils_advocate(self, query: str, combined_findings: List[str]) -> Optional[Dict[str, Any]]:
        """
        ONE bounded extra LLM call (Full Dossier only) that reasons over the
        ALREADY-GROUNDED findings from this turn's compiled steps -- never a
        separate live data-gathering pass, and never invited to invent new
        facts. Produces 2-3 distinct investigative theories (Tree-of-Thought
        style branches), each scored 0-1 on how well the given findings
        actually support it; branches under 0.30 are pruned before they ever
        reach the officer. Also asks for a Devil's Advocate critique of the
        single leading theory -- the specific counter-evidence, alibi angle,
        or procedural gap an officer should check before trusting it, so
        this never becomes one-sided tunnel vision. Returns None on any
        failure (malformed JSON, LLM error) -- this is an enrichment layer,
        never a hard dependency of the dossier itself.
        """
        findings_text = "\n".join(f"- {f}" for f in combined_findings[:6])[:3000]
        sys_prompt = (
            "You are a senior investigative analyst reviewing ALREADY-GATHERED, grounded findings for one case/"
            "suspect (below). You do NOT have access to any other data and must NOT invent facts not implied by "
            "these findings.\n\n"
            f"GROUNDED FINDINGS:\n{findings_text}\n\n"
            "Task: propose 2-3 DISTINCT investigative hypotheses (different plausible explanations/directions this "
            "could be, e.g. an isolated incident vs. a repeat pattern vs. an organized/financial angle) that are "
            "actually consistent with the findings above. For EACH, give a confidence score 0.0-1.0 for how well "
            "these specific findings support it (be honest -- most real cases don't support a high-confidence "
            "theory from partial data) and a one-sentence rationale citing which finding(s) support it. Then, for "
            "the SINGLE highest-confidence hypothesis, act as a Devil's Advocate: name one concrete counter-"
            "argument, gap, or thing an officer should verify before trusting it (e.g. missing corroboration, an "
            "alternative innocent explanation, a data-quality caveat already visible in the findings).\n\n"
            'Output ONLY one JSON object: {"hypotheses": [{"theory": "...", "confidence": 0.0, "rationale": "..."}], '
            '"devils_advocate": "..."}\n'
            "If the findings are too thin to support ANY real hypothesis distinct from just restating them, return "
            '{"hypotheses": [], "devils_advocate": null} rather than inventing one.'
        )
        try:
            res = self.llm.chat([{"role": "system", "content": sys_prompt},
                                 {"role": "user", "content": query}], None, max_tokens=1200)
            if res.get("error"):
                return None
            raw = (res.get("choices") or [{}])[0].get("message", {}).get("content", "") or ""
            plan = json.loads(self._extract_json(raw))
        except Exception as e:
            logger.warning(f"hypothesis generation failed (non-fatal): {e}")
            return None
        if not isinstance(plan, dict):
            return None
        hyps = [h for h in (plan.get("hypotheses") or [])
                if isinstance(h, dict) and h.get("theory") and float(h.get("confidence") or 0) >= 0.30]
        hyps.sort(key=lambda h: float(h.get("confidence") or 0), reverse=True)
        return {"hypotheses": hyps[:3], "devils_advocate": plan.get("devils_advocate") if hyps else None}

    # ---- 4. GROUNDING -----------------------------------------------------

    def _grounding_safety_net(self, result: Dict[str, Any], employee_id: int, session_id: str) -> Dict[str, Any]:
        """
        THE BRAIN'S HONESTY CHECKPOINT: every single answer -- no matter which
        fast-path, keyword router, or the semantic compiler produced it --
        passes through here exactly once, right before it reaches the
        officer (wired in run_agent_loop, the one public entry point). This
        is deliberately a LAST-LINE safety net, not a replacement for the
        checks already inline in each answer path (_pocso_egress_gate etc.)
        -- it exists because trusting every current AND future call site to
        remember a rule is exactly how the earlier POCSO leak happened
        (generate_case_dossier's summarize_case sub-call fetched a real
        victim name with no check at all, while a sibling path had already
        redacted the same field for the same case). If a future tool is
        added later and forgets to call the inline gate, this still catches
        it before the officer ever sees it.

        Currently enforces: POCSO/juvenile-victim redaction (Section 74 JJA).
        If the outgoing answer names a case that's POCSO-sensitive, this
        re-fetches that case's real victim/complainant names directly and
        scans the outgoing text for either one verbatim; if found (and the
        officer holds no supervisor tier / active access grant), it redacts
        the name in place and flags the catch to audit -- deliberately
        logged distinctly from a normal redaction so a real catch here is
        visible as a signal that some upstream path needs fixing, not
        silently absorbed.

        Cheap by construction: the extra DB round-trip only runs when a case
        number is present in the result AND that case is POCSO-flagged
        (rare) -- zero added cost on the overwhelming majority of answers.
        Fails OPEN on any internal error (returns the original result
        unchanged) -- a bug in this safety net must never itself take down
        an otherwise-good answer.
        """
        try:
            text = result.get("text") or ""
            data = result.get("data") or {}
            case_no = data.get("case_no")
            if not case_no:
                m = re.search(r"\bCR-\d{4}-\d+\b", text, re.IGNORECASE)
                case_no = m.group(0).upper() if m else None
            if not case_no or not catalyst_app:
                return result
            resolved = self._resolve_case_rowid(case_no)
            if not resolved:
                return result
            fr = catalyst_app.zql().execute_query(
                f"SELECT BriefFacts FROM CaseMaster WHERE ROWID = {resolved['rowid']} LIMIT 1")
            brief = (fr[0].get("CaseMaster", {}).get("BriefFacts") or "") if fr else ""
            if not is_pocso_sensitive(brief, case_no):
                return result
            badge = getattr(self, "officer_badge", None)
            if is_supervisor_badge(badge) or has_active_pocso_grant(badge, case_no):
                return result  # entitled to see it -- nothing to catch
            case_id = resolved["case_id"]
            names_to_check: List[str] = []
            try:
                vic = catalyst_app.zql().execute_query(f"SELECT VictimName FROM Victim WHERE CaseMasterID = {case_id}")
                names_to_check += [r.get("Victim", {}).get("VictimName") for r in vic if r.get("Victim", {}).get("VictimName")]
            except Exception:
                pass
            try:
                comp = catalyst_app.zql().execute_query(f"SELECT ComplainantName FROM ComplainantDetails WHERE CaseMasterID = {case_id}")
                names_to_check += [r.get("ComplainantDetails", {}).get("ComplainantName") for r in comp if r.get("ComplainantDetails", {}).get("ComplainantName")]
            except Exception:
                pass
            caught = False
            for name in names_to_check:
                nm = (name or "").strip()
                if len(nm) > 2 and nm in text:
                    text = text.replace(nm, "[REDACTED UNDER POCSO ACT §74 JJA]")
                    caught = True
            if caught:
                logger.warning(f"_grounding_safety_net: caught an unredacted POCSO name an upstream path missed for case {case_no}")
                try:
                    self._write_audit_log(
                        employee_id, "POCSO Safety-Net Catch", case_no,
                        "A downstream answer path returned an unredacted victim/complainant name for a "
                        "POCSO-flagged case; the final grounding gate caught and redacted it before it "
                        "reached the officer.",
                        "Redacted at final gate", session_id)
                except Exception:
                    pass
                result = dict(result)
                result["text"] = text
                data = dict(data)
                data["pocso_redacted"] = True
                data["pocso_safety_net_caught"] = True
                result["data"] = data
        except Exception as e:
            logger.warning(f"_grounding_safety_net check failed (non-fatal, original result returned): {e}")
        return result
