"""
VAJRA 3.0 Dynamic Jurisdiction Resolver (Domain 7: Eradication of Static Hardcoding)
===================================================================================
Authoritative resolver for jurisdictional context (District & Police Station).
Permanently eradicates legacy hardcoded fallbacks ("Belagavi", "Belagavi North", etc.)
by dynamically resolving targets from:
  1. Explicit prompt extraction (ZCQL-sanitized)
  2. Authenticated Officer Session Context (KGID / Employee Master via Thread-Local)
  3. Interactive 0-token Clarification Directives when jurisdiction is ambiguous
"""

from typing import Dict, Any, Optional, Tuple
import threading
import logging
import re

logger = logging.getLogger("vajra.jurisdiction_resolver")

# Thread-local storage reference for Officer Context
_OFFICER_CONTEXT = threading.local()

class AmbiguousJurisdictionError(Exception):
    """
    Raised when a tool requires a specific district or police station,
    neither was provided in the query, and officer session context is absent.
    """
    def __init__(self, message: str, required_scope: str = "district", suggested_options: Optional[list] = None):
        super().__init__(message)
        self.required_scope = required_scope
        self.suggested_options = suggested_options or []


class DynamicJurisdictionResolver:
    """
    Zero-hardcoding resolver that binds tool parameters to verified CCTNS units.
    """

    @staticmethod
    def sanitize_input(val: Any) -> str:
        if not val or not isinstance(val, str):
            return ""
        # Strip potential SQL / script injection characters
        cleaned = re.sub(r"['\";\\]", "", val).strip()
        return cleaned

    @classmethod
    def get_officer_context(cls, officer_ref: Optional[Any] = None) -> Dict[str, Optional[str]]:
        """
        Retrieves the authenticated officer's geographic assignment from
        the provided officer reference (e.g. self) or active thread-local session.
        """
        if officer_ref is not None:
            if isinstance(officer_ref, dict):
                return {
                    "badge": officer_ref.get("badge") or officer_ref.get("kgid"),
                    "name": officer_ref.get("name"),
                    "station": officer_ref.get("station") or officer_ref.get("resolved_station"),
                    "district": officer_ref.get("district") or officer_ref.get("resolved_district"),
                    "rank": officer_ref.get("rank") or officer_ref.get("resolved_rank"),
                }
            # Object instance (e.g. VajraAgentLoop self)
            return {
                "badge": getattr(officer_ref, "officer_badge", None) or getattr(officer_ref, "badge", None),
                "name": getattr(officer_ref, "resolved_officer_name", None) or getattr(officer_ref, "officer_name", None),
                "station": getattr(officer_ref, "resolved_station", None) or getattr(officer_ref, "station", None),
                "district": getattr(officer_ref, "resolved_district", None) or getattr(officer_ref, "district", None),
                "rank": getattr(officer_ref, "resolved_rank", None) or getattr(officer_ref, "rank", None),
            }

        return {
            "badge": getattr(_OFFICER_CONTEXT, "badge", None),
            "name": getattr(_OFFICER_CONTEXT, "name", None),
            "station": getattr(_OFFICER_CONTEXT, "station", None) or getattr(_OFFICER_CONTEXT, "resolved_station", None),
            "district": getattr(_OFFICER_CONTEXT, "district", None) or getattr(_OFFICER_CONTEXT, "resolved_district", None),
            "rank": getattr(_OFFICER_CONTEXT, "rank", None) or getattr(_OFFICER_CONTEXT, "resolved_rank", None),
        }

    @classmethod
    def resolve_district(
        cls,
        params: Dict[str, Any],
        param_key: str = "district",
        allow_statewide: bool = False,
        clarification_prompt: bool = True,
        officer_ref: Optional[Any] = None
    ) -> Tuple[str, bool]:
        """
        Resolves the operational District.
        Returns: (resolved_district_name, is_clarification_required)
        """
        raw_val = cls.sanitize_input(params.get(param_key, ""))
        
        # 1. Direct explicit parameter
        if raw_val and raw_val.lower() not in ["none", "null", "undefined", "default", "auto"]:
            return raw_val, False

        # 2. Officer Authenticated Session Context
        ctx = cls.get_officer_context(officer_ref)
        officer_district = ctx.get("district")
        if officer_district and officer_district.lower() not in ["none", "null", "undefined", "auto"]:
            logger.info(f"Resolved district '{officer_district}' from Officer Session Context (KGID: {ctx.get('badge')})")
            return officer_district, False

        # 3. Statewide Fallback if permissible
        if allow_statewide:
            return "Karnataka Statewide", False

        # 4. Clarification Request (0-token prompt)
        if clarification_prompt:
            logger.warning("Ambiguous District: Not specified in prompt and absent in Officer Context.")
            return "", True

        raise AmbiguousJurisdictionError(
            "Target district could not be resolved from prompt or officer credentials. "
            "Please specify a district (e.g., 'Bengaluru City', 'Hubballi-Dharwad', 'Mysuru').",
            required_scope="district"
        )

    @classmethod
    def resolve_station(
        cls,
        params: Dict[str, Any],
        param_key: str = "station",
        fallback_to_headquarters: bool = False,
        clarification_prompt: bool = True,
        officer_ref: Optional[Any] = None
    ) -> Tuple[str, bool]:
        """
        Resolves the operational Police Station.
        Returns: (resolved_station_name, is_clarification_required)
        """
        raw_val = cls.sanitize_input(params.get(param_key, ""))
        
        # 1. Direct explicit parameter
        if raw_val and raw_val.lower() not in ["none", "null", "undefined", "default", "auto"]:
            return raw_val, False

        # 2. Officer Authenticated Session Context
        ctx = cls.get_officer_context(officer_ref)
        officer_station = ctx.get("station")
        if officer_station and officer_station.lower() not in ["none", "null", "undefined", "auto"]:
            logger.info(f"Resolved police station '{officer_station}' from Officer Session Context (KGID: {ctx.get('badge')})")
            return officer_station, False

        # 3. Station HQ Fallback if permissible
        if fallback_to_headquarters and ctx.get("district"):
            return f"{ctx.get('district')} Town PS", False

        # 4. Clarification Request (0-token prompt)
        if clarification_prompt:
            logger.warning("Ambiguous Station: Not specified in prompt and absent in Officer Context.")
            return "", True

        raise AmbiguousJurisdictionError(
            "Target police station could not be resolved from prompt or officer credentials. "
            "Please specify a police station (e.g., 'Khade Bazar PS', 'Indiranagar PS').",
            required_scope="station"
        )

    @classmethod
    def build_clarification_response(cls, scope: str = "station", context_hint: str = "") -> Dict[str, Any]:
        """
        Constructs a structured 0-token clarification payload to guide the officer.
        """
        if scope == "district":
            msg = (
                "📍 **Jurisdiction Clarification Required**\n\n"
                "To execute this command, please specify the target **District**.\n"
                "*(e.g., 'Belagavi', 'Bengaluru City', 'Hubballi-Dharwad', 'Kalaburagi', 'Mysuru')*"
            )
        else:
            msg = (
                "🚔 **Precinct Clarification Required**\n\n"
                "To deploy tactical telematics, boundary polygons, or nakabandi plans, "
                "please specify the target **Police Station**.\n"
                f"*(e.g., 'Khade Bazar PS', 'Market PS', 'Vidyanagar PS'){f' within {context_hint}' if context_hint else ''}*"
            )
        
        return {
            "status": "clarification_needed",
            "scope": scope,
            "message": msg,
            "response_type": "clarification_badge"
        }
