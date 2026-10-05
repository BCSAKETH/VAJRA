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
            "last_query_entities": {},
            "attachment_entities": {}
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

    def save_attachment_entities(self, session_id: str, entities: Dict[str, Any]):
        """
        Persists structured multimodal extraction (plates, suspect descriptors, weapons, OCR text)
        into the session context so subsequent turns can reference evidence seamlessly.
        """
        if not session_id or not entities:
            return
        ctx = self.get_session_context(session_id)
        current_att = ctx.get("attachment_entities") or {}
        # Merge new entities into existing attachment entities
        for k, v in entities.items():
            if isinstance(v, list):
                existing_list = current_att.get(k) or []
                for item in v:
                    if item not in existing_list:
                        existing_list.append(item)
                current_att[k] = existing_list
            elif isinstance(v, dict):
                current_dict = current_att.get(k) or {}
                current_dict.update(v)
                current_att[k] = current_dict
            else:
                current_att[k] = v
        ctx["attachment_entities"] = current_att
        self.update_session_context(session_id, ctx)

    def get_attachment_entities(self, session_id: str) -> Dict[str, Any]:
        """
        Retrieves extracted forensic entities from uploaded attachments in previous turns.
        """
        ctx = self.get_session_context(session_id)
        return ctx.get("attachment_entities") or {}

    def clear_session_context(self, session_id: str):
        """
        Clears the session context.
        """
        if catalyst_app and session_id:
            try:
                empty_ctx = {
                    "last_case_id": None,
                    "last_offender_id": None,
                    "last_location": None,
                    "last_query_entities": {},
                    "attachment_entities": {}
                }
                cache_put(self.segment_name, session_id, json.dumps(empty_ctx))
            except Exception as e:
                logger.warning(f"Error clearing session context for '{session_id}': {e}")
