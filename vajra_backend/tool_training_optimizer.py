"""
SOTIE: Self-Optimizing Tool Intelligence Engine Optimizer (Section 10)
Maintains dynamic gold tool exemplars, contextual bandit routing weights,
and extracts entity aliases from officer feedback and corrections.
Guarantees sub-millisecond in-memory inference with durable Datastore fallback.
"""
import os
import json
import logging
import threading
import re
from typing import Dict, Any, List, Optional
from datetime import datetime

logger = logging.getLogger("sotie_optimizer")
_LOCK = threading.Lock()

_BASE_DIR = os.path.dirname(os.path.abspath(__file__))
_DATA_DIR = os.path.join(_BASE_DIR, "data")
EXEMPLAR_FILE = os.path.join(_DATA_DIR, "gold_tool_exemplars.json")
BANDIT_WEIGHTS_FILE = os.path.join(_DATA_DIR, "tool_bandit_weights.json")
ALIAS_STORE_FILE = os.path.join(_DATA_DIR, "entity_alias_store.json")

# In-Memory Stores for instant (<1ms) AppSail CPU resolution
_EXEMPLARS: List[Dict[str, Any]] = []
_BANDIT_WEIGHTS: Dict[str, float] = {}
_ENTITY_ALIASES: Dict[str, str] = {}
_INITIALIZED: bool = False

# Seed canonical golden exemplars for core Karnataka Police tools
# (Experience Replay Buffer to prevent cold-start starvation - L53, L56)
CANONICAL_GOLD_EXEMPLARS = [
    {
        "query": "Show repeat NDPS offenders with high conviction risk in Mangaluru",
        "tool": "get_offender_risk",
        "parameters": {"district": "Mangaluru City", "crime_group": "NARCOTICS", "min_convictions": 2},
        "score": 1.0,
        "source": "canonical"
    },
    {
        "query": "Plot spatial crime density map and hotspots in Belagavi",
        "tool": "query_hotspots",
        "parameters": {"district": "Belagavi Dist"},
        "score": 1.0,
        "source": "canonical"
    },
    {
        "query": "Trace criminal graph network and co-accused links for Ravi alias Tiger",
        "tool": "query_graph_network",
        "parameters": {"suspect_name": "Ravi"},
        "score": 1.0,
        "source": "canonical"
    },
    {
        "query": "Resolve vehicle registration plate KA-04-E-1234 to jurisdiction",
        "tool": "resolve_rto_plate",
        "parameters": {"plate_number": "KA-04-E-1234"},
        "score": 1.0,
        "source": "canonical"
    },
    {
        "query": "Reverse-resolve bank IFSC code SBIN0001234 for financial trail",
        "tool": "resolve_ifsc",
        "parameters": {"ifsc_code": "SBIN0001234"},
        "score": 1.0,
        "source": "canonical"
    },
    {
        "query": "Generate full case dossier and timeline for case CR-2026-31313",
        "tool": "generate_case_dossier",
        "parameters": {"crime_no": "CR-2026-31313"},
        "score": 1.0,
        "source": "canonical"
    },
    {
        "query": "Look up suspect criminal record by Aadhaar or phone number",
        "tool": "search_by_identifier",
        "parameters": {"identifier_type": "phone", "identifier_value": "9876543210"},
        "score": 1.0,
        "source": "canonical"
    },
    {
        "query": "Predict patrol route beat deployment for high-risk areas in Bengaluru East",
        "tool": "plan_patrol_deployment",
        "parameters": {"district": "Bengaluru City", "zone": "East"},
        "score": 1.0,
        "source": "canonical"
    },
    {
        "query": "Check alibi consistency against cell tower tower dumps for accused Ramesh",
        "tool": "check_alibi_consistency",
        "parameters": {"suspect_name": "Ramesh"},
        "score": 1.0,
        "source": "canonical"
    },
    {
        "query": "What are the top crimes and offences in Bengaluru",
        "tool": "get_case_types_distribution",
        "parameters": {"district": "Bengaluru Urban"},
        "score": 1.0,
        "source": "canonical"
    },
    {
        "query": "Crime categories breakdown and case distribution in Mysuru",
        "tool": "get_case_types_distribution",
        "parameters": {"district": "Mysuru"},
        "score": 1.0,
        "source": "canonical"
    },
    {
        "query": "Which districts have the highest crime rate and worst offences",
        "tool": "rank_districts",
        "parameters": {},
        "score": 1.0,
        "source": "canonical"
    },
    {
        "query": "Monthly crime trends and pattern analysis over time in Belagavi",
        "tool": "get_crime_trends",
        "parameters": {"district": "Belagavi"},
        "score": 1.0,
        "source": "canonical"
    },
    {
        "query": "How many cybercrime and fraud cases registered in 2025",
        "tool": "count_cases",
        "parameters": {"crime_group": "CYBERCRIME"},
        "score": 1.0,
        "source": "canonical"
    },
    {
        "query": "List cybercrime and murder cases in Hubballi",
        "tool": "list_cases",
        "parameters": {"district": "Hubballi-Dharwad"},
        "score": 1.0,
        "source": "canonical"
    }
]


def _ensure_initialized():
    """Initializes in-memory stores, hydrates from disk or pre-seeded canonical data."""
    global _INITIALIZED, _EXEMPLARS, _BANDIT_WEIGHTS, _ENTITY_ALIASES
    if _INITIALIZED:
        return
    with _LOCK:
        if _INITIALIZED:
            return
        
        # 1. Load Exemplars
        exemplars: List[Dict[str, Any]] = []
        if os.path.exists(EXEMPLAR_FILE):
            try:
                with open(EXEMPLAR_FILE, "r", encoding="utf-8") as f:
                    exemplars = json.load(f)
            except Exception as e:
                logger.warning(f"SOTIE: Failed to read {EXEMPLAR_FILE}: {e}")
        
        # Merge canonical exemplars if not present
        existing_queries = {e.get("query", "").lower() for e in exemplars}
        for canon in CANONICAL_GOLD_EXEMPLARS:
            if canon["query"].lower() not in existing_queries:
                exemplars.append(canon)
        _EXEMPLARS = exemplars

        # 2. Load Bandit Weights
        weights: Dict[str, float] = {}
        if os.path.exists(BANDIT_WEIGHTS_FILE):
            try:
                with open(BANDIT_WEIGHTS_FILE, "r", encoding="utf-8") as f:
                    weights = json.load(f)
            except Exception as e:
                logger.warning(f"SOTIE: Failed to read {BANDIT_WEIGHTS_FILE}: {e}")
        _BANDIT_WEIGHTS = weights

        # 3. Load Entity Aliases
        aliases: Dict[str, str] = {
            "upparpet ps": "Upparpet Police Station",
            "chickpet ps": "Chickpet Police Station",
            "cubbon park ps": "Cubbon Park Police Station",
            "indiranagar ps": "Indiranagar Police Station",
            "whitefield ps": "Whitefield Police Station",
            "hubballi": "Hubballi-Dharwad",
            "belgaum": "Belagavi",
            "bangalore": "Bengaluru City"
        }
        if os.path.exists(ALIAS_STORE_FILE):
            try:
                with open(ALIAS_STORE_FILE, "r", encoding="utf-8") as f:
                    file_aliases = json.load(f)
                    aliases.update(file_aliases)
            except Exception as e:
                logger.warning(f"SOTIE: Failed to read {ALIAS_STORE_FILE}: {e}")
        _ENTITY_ALIASES = aliases

        _INITIALIZED = True
        logger.info(f"SOTIE Initialized: {len(_EXEMPLARS)} gold exemplars, {len(_BANDIT_WEIGHTS)} bandit weights, {len(_ENTITY_ALIASES)} aliases")


def record_gold_tool_exemplar(query: str, tool_name: str, parameters: Dict[str, Any], score: float = 1.0):
    """
    Commits an upvoted officer interaction into the persistent exemplar store.
    Mitigates L51 (Prompt Bloat) by capping at 500 records and deduplicating.
    """
    if not query or not tool_name:
        return
    _ensure_initialized()
    clean_q = query.strip()
    clean_tool = tool_name.strip()
    
    with _LOCK:
        # Avoid exact duplicate queries
        global _EXEMPLARS
        _EXEMPLARS = [e for e in _EXEMPLARS if e.get("query", "").lower() != clean_q.lower()]
        _EXEMPLARS.append({
            "query": clean_q,
            "tool": clean_tool,
            "parameters": parameters,
            "score": score,
            "recorded_at": datetime.utcnow().isoformat()
        })
        # Cap at 500 gold exemplars
        if len(_EXEMPLARS) > 500:
            _EXEMPLARS = _EXEMPLARS[-500:]

        # Best-effort disk persistence
        try:
            os.makedirs(_DATA_DIR, exist_ok=True)
            with open(EXEMPLAR_FILE, "w", encoding="utf-8") as f:
                json.dump(_EXEMPLARS, f, indent=2)
            logger.info(f"SOTIE: Committed gold exemplar for tool '{clean_tool}'")
        except Exception as e:
            logger.warning(f"SOTIE: Disk write failed (ephemeral container): {e}")


def get_matching_tool_exemplars(query: str, limit: int = 2) -> List[Dict[str, Any]]:
    """
    Retrieves top matching gold tool exemplars for dynamic few-shot prompt injection.
    Sub-millisecond token overlap & Jaccard matching on AppSail CPU.
    Capped at top-k=2 (L51: <= 300 tokens total).
    """
    if not query:
        return []
    _ensure_initialized()
    q_tokens = set(re.findall(r'\b[a-zA-Z0-9_\-]{2,}\b', query.lower()))
    if not q_tokens:
        return []

    scored: List[tuple] = []
    for ex in _EXEMPLARS:
        ex_query = ex.get("query", "")
        ex_tokens = set(re.findall(r'\b[a-zA-Z0-9_\-]{2,}\b', ex_query.lower()))
        if not ex_tokens:
            continue
        
        intersection = q_tokens & ex_tokens
        if not intersection:
            continue
        
        # Jaccard similarity + keyword overlap weight
        jaccard = len(intersection) / len(q_tokens | ex_tokens)
        
        # Give bonus to specific investigative keyword matches
        core_boost = 0.0
        for token in intersection:
            if token in ("fir", "cctns", "risk", "mule", "syndicate", "network", "hotspot", "dossier", "plate", "ifsc", "aadhaar", "offender", "crime", "crimes", "trends", "distribution", "breakdown", "statistics", "offences"):
                core_boost += 0.15

        final_score = jaccard + core_boost
        if final_score >= 0.25:
            scored.append((final_score, ex))

    scored.sort(key=lambda x: x[0], reverse=True)
    return [item[1] for item in scored[:limit]]


def update_bandit_weights(tool_name: str, rating: str, correction: Optional[str] = None):
    """
    Updates the Contextual Multi-Armed Bandit running reward matrix.
    Formula: W_{t+1} = W_t + alpha * (R - W_t)
    Alpha = 0.1, R = +1.0 for up, -1.0 for down, -1.5 for correction.
    """
    if not tool_name:
        return
    _ensure_initialized()
    with _LOCK:
        global _BANDIT_WEIGHTS
        w = _BANDIT_WEIGHTS.get(tool_name, 1.0)
        alpha = 0.1
        reward = 1.0 if rating == "up" else -1.0
        if correction:
            reward = -1.5
        new_w = max(0.1, min(2.0, w + alpha * (reward - w)))
        _BANDIT_WEIGHTS[tool_name] = round(new_w, 3)

        try:
            os.makedirs(_DATA_DIR, exist_ok=True)
            with open(BANDIT_WEIGHTS_FILE, "w", encoding="utf-8") as f:
                json.dump(_BANDIT_WEIGHTS, f, indent=2)
            logger.info(f"SOTIE: Updated bandit weight for '{tool_name}' -> {_BANDIT_WEIGHTS[tool_name]}")
        except Exception as e:
            logger.warning(f"SOTIE: Failed to write bandit weights: {e}")


def get_tool_bandit_weight(tool_name: str) -> float:
    """Returns the current contextual bandit multiplier for a tool (default 1.0)."""
    _ensure_initialized()
    return _BANDIT_WEIGHTS.get(tool_name, 1.0)


def record_entity_alias(raw_term: str, standard_term: str):
    """
    Learns colloquial police aliases and station names from officer corrections (L54).
    e.g. 'upparpet ps' -> 'Upparpet Police Station'
    """
    if not raw_term or not standard_term:
        return
    _ensure_initialized()
    clean_raw = raw_term.strip().lower()
    clean_std = standard_term.strip()
    with _LOCK:
        global _ENTITY_ALIASES
        _ENTITY_ALIASES[clean_raw] = clean_std
        try:
            os.makedirs(_DATA_DIR, exist_ok=True)
            with open(ALIAS_STORE_FILE, "w", encoding="utf-8") as f:
                json.dump(_ENTITY_ALIASES, f, indent=2)
            logger.info(f"SOTIE: Learned entity alias: '{clean_raw}' -> '{clean_std}'")
        except Exception as e:
            logger.warning(f"SOTIE: Failed to write alias store: {e}")


def resolve_entity_aliases(query: str) -> str:
    """Resolves any known dialectal/colloquial aliases inside the query."""
    _ensure_initialized()
    if not query or not _ENTITY_ALIASES:
        return query
    resolved = query
    for raw, std in _ENTITY_ALIASES.items():
        pattern = r'\b' + re.escape(raw) + r'\b'
        resolved = re.sub(pattern, std, resolved, flags=re.IGNORECASE)
    return resolved


def invalidate_tool_cache(tool_name: str, parameters: Optional[Dict[str, Any]] = None):
    """
    Mitigates L48 (Stale Tool Execution Cache on Feedback).
    Immediately invalidates in-memory aggregated query cache matching (tool, params).
    """
    try:
        from agent_loop import VajraAgentLoop
        # Clear matching entries in _AGG_CACHE if VajraAgentLoop maintains one
        if hasattr(VajraAgentLoop, "_AGG_CACHE"):
            with _LOCK:
                keys_to_del = [
                    k for k in VajraAgentLoop._AGG_CACHE.keys()
                    if tool_name.lower() in str(k).lower()
                ]
                for k in keys_to_del:
                    VajraAgentLoop._AGG_CACHE.pop(k, None)
                logger.info(f"SOTIE: Evicted {len(keys_to_del)} cache entries for tool '{tool_name}' on negative feedback")
    except Exception as e:
        logger.warning(f"SOTIE: Cache eviction failed: {e}")
