import json
import logging
from typing import Dict, Any, Optional
from vajra_core import catalyst_app, cache_get, cache_put

logger = logging.getLogger(__name__)

class VajraSessionMemory:
    """
    Manages conversational memory session context using the Catalyst Cache service.
    Keys stored: last_case_id, last_offender_id, last_location, last_query_entities.

    Uses vajra_core.cache_get/cache_put (direct REST, correct domain) instead of
    catalyst_app.cache().segment(X) -- the SDK's Cache methods hit the same
    wrong-domain bug as the Datastore Table methods (confirmed live), which
    meant get_session_context/update_session_context silently no-op'd on every
    call: multi-turn context (last_case_id/offender/location) AND the
    conversation history list itself never actually persisted between turns,
    regardless of what OAuth scope was granted.
    """
    def __init__(self, segment_name: str = "Default"):
        self.segment_name = segment_name

    def get_session_context(self, session_id: str) -> Dict[str, Any]:
        """
        Retrieves the session context for the given session_id.
        If not found or cache fails, returns an empty context.
        """
        if catalyst_app and session_id:
            try:
                val = cache_get(self.segment_name, session_id)
                if val:
                    context = json.loads(val)
                    # Extend TTL by overwriting with default 48-hour expiration
                    cache_put(self.segment_name, session_id, val)
                    return context
            except Exception as e:
                logger.warning(f"Error fetching session context for '{session_id}': {e}")
        return {
            "last_case_id": None,
            "last_offender_id": None,
            "last_location": None,
            "last_query_entities": {}
        }

    def update_session_context(self, session_id: str, context: Dict[str, Any]):
        """
        Saves the updated session context to Catalyst Cache.
        """
        if catalyst_app and session_id:
            try:
                cache_put(self.segment_name, session_id, json.dumps(context))
            except Exception as e:
                logger.warning(f"Error saving session context for '{session_id}': {e}")

    def clear_session_context(self, session_id: str):
        """
        Clears the session context.
        """
        if catalyst_app and session_id:
            try:
                # Zoho Catalyst segment doesn't have a direct delete key in some versions,
                # so we put an empty JSON context to overwrite/reset it.
                empty_ctx = {
                    "last_case_id": None,
                    "last_offender_id": None,
                    "last_location": None,
                    "last_query_entities": {}
                }
                cache_put(self.segment_name, session_id, json.dumps(empty_ctx))
            except Exception as e:
                logger.warning(f"Error clearing session context for '{session_id}': {e}")
