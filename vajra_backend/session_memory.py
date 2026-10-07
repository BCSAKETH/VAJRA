"""
VAJRA 2.0 - Dual-Tier Omni-State Memory Engine
=============================================
Architecture:
- Tier 1: Micro-Memory (`session:{id}:graph`)
  Tracks active suspects, vehicle plates, phone numbers, active FIRs, and recent topics
  within a single conversation thread. Supports dynamic `shift_context_topic()` for pronoun unbinding.
- Tier 2: Macro-Memory (`officer:{kgid}:profile`)
  Persists the officer's authenticated service profile, station posting, district, assigned cases,
  and interaction preferences across all conversations.
"""

import re
import json
import time
import logging
from typing import Dict, Any, List, Optional, Set
from vajra_core import catalyst_app, cache_get, cache_put, escape_zcql_literal

logger = logging.getLogger("session_memory")

# In-memory dual-tier fallback cache with rolling timestamps (for local dev / cache resilience)
_LOCAL_MICRO_MEMORY: Dict[str, Dict[str, Any]] = {}
_LOCAL_MACRO_MEMORY: Dict[str, Dict[str, Any]] = {}

# Topic Shift & Entity Unbinding Trigger Patterns (English & Kannada)
_FORGET_ENTITY_PATTERNS = [
    re.compile(r"\b(?:forget|drop|ignore|remove|leave)\s+(?:about\s+)?([A-Za-z0-9_\-]+(?:\s+[A-Za-z0-9_\-]+)?)(?:\s+(?:and|or|now|let's|lets|let\s+us|show|tell|check|what|where|why|how)|[\.?!,;]|$)", re.IGNORECASE),
    re.compile(r"\b(?:forget|drop)\s+(?:him|her|them|that|it|this)\b", re.IGNORECASE),
    re.compile(r"\b(?:ಮರೆತುಬಿಡು|ಬಿಟ್ಟುಬಿಡು)\s+([A-Za-z0-9_\-]+)", re.IGNORECASE)
]

_GLOBAL_RESET_PATTERNS = [
    re.compile(r"\b(?:new\s+topic|different\s+case|different\s+suspect|start\s+fresh|reset\s+context|clear\s+memory|fresh\s+query|switch\s+topic|nevermind)\b", re.IGNORECASE),
    re.compile(r"\b(?:ಹೊಸ\s+ವಿಷಯ|ಬೇರೆ\s+ಪ್ರಕರಣ|ಮರುಹೊಂದಿಸು|ಹೊಸದಾಗಿ\s+ಪ್ರಾರಂಭಿಸು)\b", re.IGNORECASE)
]


class DualTierMemoryManager:
    """
    Manages Dual-Tier Conversational & Officer Context:
    1. Micro-Memory: Active session entity graph & pronoun resolution state.
    2. Macro-Memory: Officer service profile & cross-session preferences.
    """
    def __init__(self, segment_name: str = "Default"):
        self.segment_name = segment_name

    # =========================================================================
    # TIER 1: MICRO-MEMORY (Session-Scoped Entity Graph)
    # =========================================================================
    def _micro_key(self, session_id: str) -> str:
        return f"session:{session_id}:graph"

    def get_micro_context(self, session_id: str) -> Dict[str, Any]:
        """
        Retrieves active entity graph for a specific conversation session.
        Keys: active_suspects, active_vehicles, active_phones, active_cases,
              last_case_id, last_offender_id, last_location, attachment_entities.
        """
        if not session_id:
            return self._empty_micro_context()

        cache_key = self._micro_key(session_id)
        # 1. Try Catalyst Cache
        if catalyst_app:
            try:
                val = cache_get(self.segment_name, cache_key)
                if val:
                    data = json.loads(val)
                    _LOCAL_MICRO_MEMORY[session_id] = data
                    return data
            except Exception as e:
                logger.debug(f"Catalyst Cache miss for micro-memory '{cache_key}': {e}")

        # 2. Try In-Memory Fallback
        if session_id in _LOCAL_MICRO_MEMORY:
            return _LOCAL_MICRO_MEMORY[session_id]

        # 3. Legacy key compatibility fallback (session_id direct key)
        if catalyst_app:
            try:
                val = cache_get(self.segment_name, session_id)
                if val:
                    legacy_data = json.loads(val)
                    converted = self._convert_legacy_to_micro(legacy_data)
                    self.update_micro_context(session_id, converted)
                    return converted
            except Exception:
                pass

        return self._empty_micro_context()

    def update_micro_context(self, session_id: str, context: Dict[str, Any]) -> None:
        """Persists updated micro-memory graph to Catalyst Cache and local memory."""
        if not session_id:
            return
        context["_last_updated"] = time.time()
        _LOCAL_MICRO_MEMORY[session_id] = context

        if catalyst_app:
            try:
                cache_key = self._micro_key(session_id)
                cache_put(self.segment_name, cache_key, json.dumps(context))
                # Also write legacy key for backwards compatibility
                cache_put(self.segment_name, session_id, json.dumps(context))
            except Exception as e:
                logger.warning(f"Failed to persist micro-memory for '{session_id}': {e}")

    def bind_entities(self, session_id: str, entities: Dict[str, Any]) -> Dict[str, Any]:
        """
        Dynamically updates active entities (suspects, vehicles, cases, phones)
        from recent conversational turns.
        """
        ctx = self.get_micro_context(session_id)

        # Merge suspects
        if "suspect" in entities and entities["suspect"]:
            s = entities["suspect"].strip()
            if s and s not in ctx["active_suspects"]:
                ctx["active_suspects"].append(s)
            ctx["last_offender_id"] = s

        # Merge cases
        if "case_no" in entities and entities["case_no"]:
            c = entities["case_no"].strip()
            if c and c not in ctx["active_cases"]:
                ctx["active_cases"].append(c)
            ctx["last_case_id"] = c

        # Merge vehicles
        if "vehicle" in entities and entities["vehicle"]:
            v = entities["vehicle"].strip().upper()
            if v and v not in ctx["active_vehicles"]:
                ctx["active_vehicles"].append(v)

        # Merge phones
        if "phone" in entities and entities["phone"]:
            p = entities["phone"].strip()
            if p and p not in ctx["active_phones"]:
                ctx["active_phones"].append(p)

        # Merge location
        if "location" in entities and entities["location"]:
            ctx["last_location"] = entities["location"].strip()

        self.update_micro_context(session_id, ctx)
        return ctx

    def shift_context_topic(self, session_id: str, query_text: str) -> bool:
        """
        Detects topic transition or entity unbinding keywords (e.g. 'forget Imran',
        'new topic', 'different case', 'start fresh').
        Unbinds active entities so subsequent pronouns ('Where is his bike?') don't
        incorrectly reference the previous subject.
        Returns True if a topic shift occurred.
        """
        if not session_id or not query_text:
            return False

        q = query_text.strip().lower()
        ctx = self.get_micro_context(session_id)
        shifted = False

        # 1. Global Reset / New Topic Pattern
        for pattern in _GLOBAL_RESET_PATTERNS:
            if pattern.search(q):
                logger.info(f"[DualTierMemory] Global topic reset detected for session '{session_id}'")
                ctx["active_suspects"] = []
                ctx["active_vehicles"] = []
                ctx["active_phones"] = []
                ctx["active_cases"] = []
                ctx["last_case_id"] = None
                ctx["last_offender_id"] = None
                ctx["last_query_entities"] = {}
                self.update_micro_context(session_id, ctx)
                return True

        # 2. Targeted Entity Unbinding ("forget Imran", "drop case 104")
        for pattern in _FORGET_ENTITY_PATTERNS:
            match = pattern.search(q)
            if match:
                target = match.group(1).strip().lower() if match.groups() else ""
                # Strip common trailing stop words
                target = re.sub(r"\b(?:and|or|now|about|the|case|suspect|vehicle|details)\b", "", target).strip()
                if not target or target in ("him", "her", "them", "that", "it", "this"):
                    # Unbind most recent entity
                    if ctx["active_suspects"]:
                        removed = ctx["active_suspects"].pop()
                        logger.info(f"[DualTierMemory] Unbound latest suspect '{removed}' from session '{session_id}'")
                        ctx["last_offender_id"] = ctx["active_suspects"][-1] if ctx["active_suspects"] else None
                        shifted = True
                else:
                    # Unbind specific matching suspect or case
                    ctx["active_suspects"] = [s for s in ctx["active_suspects"] if target not in s.lower() and not any(w in s.lower() for w in target.split())]
                    ctx["active_cases"] = [c for c in ctx["active_cases"] if target not in c.lower() and not any(w in c.lower() for w in target.split())]
                    ctx["active_vehicles"] = [v for v in ctx["active_vehicles"] if target not in v.lower() and not any(w in v.lower() for w in target.split())]
                    if ctx["last_offender_id"] and (target in ctx["last_offender_id"].lower() or any(w in ctx["last_offender_id"].lower() for w in target.split())):
                        ctx["last_offender_id"] = ctx["active_suspects"][-1] if ctx["active_suspects"] else None
                    if ctx["last_case_id"] and (target in str(ctx["last_case_id"]).lower() or any(w in str(ctx["last_case_id"]).lower() for w in target.split())):
                        ctx["last_case_id"] = ctx["active_cases"][-1] if ctx["active_cases"] else None
                    logger.info(f"[DualTierMemory] Unbound target '{target}' from session '{session_id}'")
                    shifted = True

        if shifted:
            self.update_micro_context(session_id, ctx)

        return shifted

    def save_attachment_entities(self, session_id: str, entities: Dict[str, Any]) -> None:
        """Persists structured OCR and vision extractions into micro-memory."""
        if not session_id or not entities:
            return
        ctx = self.get_micro_context(session_id)
        current_att = ctx.get("attachment_entities") or {}
        for k, v in entities.items():
            if isinstance(v, list):
                existing = current_att.get(k) or []
                for item in v:
                    if item not in existing:
                        existing.append(item)
                current_att[k] = existing
            elif isinstance(v, dict):
                cur_dict = current_att.get(k) or {}
                cur_dict.update(v)
                current_att[k] = cur_dict
            else:
                current_att[k] = v
        ctx["attachment_entities"] = current_att
        self.update_micro_context(session_id, ctx)

    def get_attachment_entities(self, session_id: str) -> Dict[str, Any]:
        ctx = self.get_micro_context(session_id)
        return ctx.get("attachment_entities") or {}

    def clear_session_context(self, session_id: str) -> None:
        """Completely clears micro-memory for a session."""
        self.update_micro_context(session_id, self._empty_micro_context())

    # =========================================================================
    # TIER 2: MACRO-MEMORY (Officer-Scoped Profile & Preferences)
    # =========================================================================
    def _macro_key(self, kgid: str) -> str:
        clean_kgid = str(kgid).strip()
        return f"officer:{clean_kgid}:profile"

    def get_macro_profile(self, kgid: str) -> Dict[str, Any]:
        """
        Retrieves global officer profile across all sessions.
        Keys: officer_name, badge_no, rank, designation, station, district,
              role_tier, assigned_cases, pinned_cases, preferred_lang, preferred_voice.
        """
        if not kgid:
            return self._default_macro_profile()

        clean_kgid = str(kgid).strip()
        cache_key = self._macro_key(clean_kgid)

        # 1. Try Catalyst Cache
        if catalyst_app:
            try:
                val = cache_get(self.segment_name, cache_key)
                if val:
                    data = json.loads(val)
                    _LOCAL_MACRO_MEMORY[clean_kgid] = data
                    return data
            except Exception as e:
                logger.debug(f"Macro-memory cache miss for '{cache_key}': {e}")

        # 2. Try Local Memory
        if clean_kgid in _LOCAL_MACRO_MEMORY:
            return _LOCAL_MACRO_MEMORY[clean_kgid]

        # 3. Auto-sync from Employee table
        return self.sync_macro_from_employee_table(clean_kgid)

    def update_macro_profile(self, kgid: str, profile_data: Dict[str, Any]) -> None:
        """Saves updated officer profile to Catalyst Cache and local memory."""
        if not kgid:
            return
        clean_kgid = str(kgid).strip()
        profile_data["_last_synced"] = time.time()
        _LOCAL_MACRO_MEMORY[clean_kgid] = profile_data

        if catalyst_app:
            try:
                cache_key = self._macro_key(clean_kgid)
                cache_put(self.segment_name, cache_key, json.dumps(profile_data))
            except Exception as e:
                logger.warning(f"Failed to persist macro-profile for '{clean_kgid}': {e}")

    def get_officer_profile(self, kgid: str) -> Dict[str, Any]:
        """Convenience alias for get_macro_profile with normalized keys."""
        prof = self.get_macro_profile(kgid)
        return {
            "name": prof.get("officer_name") or prof.get("name") or "Officer",
            "home_station": prof.get("station") or prof.get("home_station") or "Police Station",
            "district": prof.get("district") or "Karnataka",
            "role_tier": prof.get("rank") or prof.get("role_tier") or "Investigating Officer",
            "assigned_cases": prof.get("assigned_cases") or [],
            "raw": prof
        }

    def save_officer_profile(self, officer_kgid: str, profile_data: Dict[str, Any]) -> None:
        """Convenience alias for update_macro_profile."""
        normalized = dict(profile_data)
        if "name" in normalized and "officer_name" not in normalized:
            normalized["officer_name"] = normalized["name"]
        if "home_station" in normalized and "station" not in normalized:
            normalized["station"] = normalized["home_station"]
        self.update_macro_profile(officer_kgid, normalized)

    def sync_macro_from_employee_table(self, kgid: str) -> Dict[str, Any]:
        """Loads officer credentials, rank, unit, and district from Database."""
        clean_kgid = str(kgid).strip()
        profile = self._default_macro_profile()
        profile["badge_no"] = clean_kgid
        profile["kgid"] = clean_kgid

        if not catalyst_app:
            _LOCAL_MACRO_MEMORY[clean_kgid] = profile
            return profile

        try:
            emp_res = catalyst_app.zql().execute_query(
                f"SELECT EmployeeID, KGID, FirstName, UnitID, RankID, DesignationID, Email "
                f"FROM Employee WHERE KGID = '{escape_zcql_literal(clean_kgid)}' LIMIT 1"
            )
            if emp_res:
                emp = emp_res[0].get("Employee", {})
                first = emp.get("FirstName") or ""
                profile["officer_name"] = first.strip() or f"Officer {clean_kgid}"
                profile["unit_id"] = emp.get("UnitID")
                profile["rank_id"] = emp.get("RankID")
                profile["designation_id"] = emp.get("DesignationID")
                profile["role_tier"] = "officer"
                profile["email"] = emp.get("Email")

                # Resolve Unit & District Names
                if profile["unit_id"]:
                    u_res = catalyst_app.zql().execute_query(
                        f"SELECT UnitName, DistrictID FROM Unit WHERE UnitID = {profile['unit_id']} LIMIT 1"
                    )
                    if u_res:
                        u = u_res[0].get("Unit", {})
                        profile["station"] = u.get("UnitName", "Assigned Police Station")
                        profile["district_id"] = u.get("DistrictID")
                        if profile["district_id"]:
                            d_res = catalyst_app.zql().execute_query(
                                f"SELECT DistrictName FROM District WHERE DistrictID = {profile['district_id']} LIMIT 1"
                            )
                            if d_res:
                                profile["district"] = d_res[0].get("District", {}).get("DistrictName", "Karnataka")

                # Resolve Rank Name
                if profile["rank_id"]:
                    r_res = catalyst_app.zql().execute_query(
                        f"SELECT RankName FROM Rank WHERE RankID = {profile['rank_id']} LIMIT 1"
                    )
                    if r_res:
                        profile["rank"] = r_res[0].get("Rank", {}).get("RankName") or "Officer"
                        profile["rank_name"] = profile["rank"]

            self.update_macro_profile(clean_kgid, profile)
        except Exception as e:
            logger.warning(f"Error syncing macro-profile from Employee table for '{clean_kgid}': {e}")
            _LOCAL_MACRO_MEMORY[clean_kgid] = profile

        return profile

    # =========================================================================
    # COMBINED OMNI-STATE RESOLUTION
    # =========================================================================
    def get_combined_context(self, session_id: str, kgid: Optional[str] = None) -> Dict[str, Any]:
        """
        Fuses Micro-Memory (current chat active graph) and Macro-Memory (officer profile)
        into a unified context object for the AI prompt engine.
        """
        micro = self.get_micro_context(session_id)
        macro = self.get_macro_profile(kgid) if kgid else self._default_macro_profile()

        return {
            "micro": micro,
            "macro": macro,
            "active_focus": {
                "current_suspect": micro.get("last_offender_id") or (micro["active_suspects"][-1] if micro["active_suspects"] else None),
                "current_case": micro.get("last_case_id") or (micro["active_cases"][-1] if micro["active_cases"] else None),
                "current_vehicle": micro["active_vehicles"][-1] if micro["active_vehicles"] else None,
                "current_location": micro.get("last_location") or macro.get("district")
            }
        }

    # =========================================================================
    # INTERNAL HELPERS
    # =========================================================================
    def _empty_micro_context(self) -> Dict[str, Any]:
        return {
            "active_suspects": [],
            "active_vehicles": [],
            "active_phones": [],
            "active_cases": [],
            "last_case_id": None,
            "last_offender_id": None,
            "last_location": None,
            "last_query_entities": {},
            "attachment_entities": {},
            "_created_at": time.time()
        }

    def _default_macro_profile(self) -> Dict[str, Any]:
        return {
            "officer_name": "Officer",
            "badge_no": "KSP-POLICE",
            "kgid": "KSP-POLICE",
            "rank": "Investigating Officer",
            "designation": "Police Inspector",
            "station": "Police Station",
            "district": "Karnataka",
            "unit_id": None,
            "district_id": None,
            "role_tier": "officer",
            "assigned_cases": [],
            "pinned_cases": [],
            "preferred_lang": "en",
            "preferred_voice": "authoritative"
        }

    def _convert_legacy_to_micro(self, legacy: Dict[str, Any]) -> Dict[str, Any]:
        ctx = self._empty_micro_context()
        ctx["last_case_id"] = legacy.get("last_case_id")
        ctx["last_offender_id"] = legacy.get("last_offender_id")
        ctx["last_location"] = legacy.get("last_location")
        ctx["last_query_entities"] = legacy.get("last_query_entities") or {}
        ctx["attachment_entities"] = legacy.get("attachment_entities") or {}
        if ctx["last_offender_id"]:
            ctx["active_suspects"].append(ctx["last_offender_id"])
        if ctx["last_case_id"]:
            ctx["active_cases"].append(str(ctx["last_case_id"]))
        return ctx


    # Backward compatibility aliases on DualTierMemoryManager
    def get_session_context(self, session_id: str) -> Dict[str, Any]:
        return self.get_micro_context(session_id)

    def update_session_context(self, session_id: str, context: Dict[str, Any]) -> None:
        self.update_micro_context(session_id, context)


# =============================================================================
# BACKWARD COMPATIBILITY ALIAS
# =============================================================================
class VajraSessionMemory(DualTierMemoryManager):
    """
    Direct drop-in replacement maintaining 100% backward compatibility
    with existing codebase call sites.
    """
    pass


# Export global singleton instance
dual_memory = VajraSessionMemory()
session_memory = dual_memory


