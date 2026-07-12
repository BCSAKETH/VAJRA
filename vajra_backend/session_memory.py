import json
import logging
from typing import Dict, Any, Optional
from vajra_core import catalyst_app

logger = logging.getLogger(__name__)

class VajraSessionMemory:
    """
    Manages conversational memory session context using the Catalyst Cache service.
    Keys stored: last_case_id, last_offender_id, last_location, last_query_entities.
    """
    def __init__(self, segment_name: str = "Default"):
        self.segment_name = segment_name
        self._segment = None

    def _get_segment(self):
        if self._segment is not None:
            return self._segment
        if catalyst_app:
            try:
                self._segment = catalyst_app.cache().segment(self.segment_name)
                return self._segment
            except Exception as e:
                logger.error(f"Failed to access Catalyst Cache segment '{self.segment_name}': {e}")
        return None

    def get_session_context(self, session_id: str) -> Dict[str, Any]:
        """
        Retrieves the session context for the given session_id.
        If not found or cache fails, returns an empty context.
        """
        segment = self._get_segment()
        if segment and session_id:
            try:
                val = segment.get_value(session_id)
                if val:
                    # Extend TTL by overwriting with default 48-hour expiration
                    context = json.loads(val)
                    segment.put(session_id, val)
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
        segment = self._get_segment()
        if segment and session_id:
            try:
                val = json.dumps(context)
                segment.put(session_id, val)
            except Exception as e:
                logger.warning(f"Error saving session context for '{session_id}': {e}")

    def clear_session_context(self, session_id: str):
        """
        Clears the session context.
        """
        segment = self._get_segment()
        if segment and session_id:
            try:
                # Zoho Catalyst segment doesn't have a direct delete key in some versions,
                # so we put an empty JSON context to overwrite/reset it.
                empty_ctx = {
                    "last_case_id": None,
                    "last_offender_id": None,
                    "last_location": None,
                    "last_query_entities": {}
                }
                segment.put(session_id, json.dumps(empty_ctx))
            except Exception as e:
                logger.warning(f"Error clearing session context for '{session_id}': {e}")
