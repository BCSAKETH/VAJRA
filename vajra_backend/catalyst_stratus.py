import logging
import uuid
from typing import Optional
from vajra_core import catalyst_app

logger = logging.getLogger("catalyst_stratus")

ATTACHMENTS_BUCKET = "vajra-evidence-attachments"


def store_attachment(file_bytes: bytes, extension: str, content_type: str) -> Optional[str]:
    """
    Stores a processed attachment (already-downscaled image, or a rasterized
    PDF page) in Stratus -- Catalyst's current file/object storage. Not the
    deprecated File Store, which is past its 30 Apr 2026 end-of-life.

    Returns the Stratus object key on success, or None if storage isn't
    available (bucket not yet created in console, or the current refresh
    token's OAuth scope doesn't include Stratus access) -- the caller must
    treat a None return as "couldn't persist," not fail the whole attachment
    flow, since the in-memory bytes are still usable for the Qwen call in
    the same request.
    """
    if not catalyst_app:
        return None
    key = f"{uuid.uuid4().hex}.{extension}"
    try:
        bucket = catalyst_app.stratus().bucket(ATTACHMENTS_BUCKET)
        bucket.put_object(key=key, body=file_bytes, options={"content_type": content_type})
        return key
    except Exception as e:
        logger.warning(f"Could not store attachment in Stratus bucket '{ATTACHMENTS_BUCKET}': {e}")
        return None


def get_attachment_bytes(stratus_key: str) -> Optional[bytes]:
    """
    Fetches a previously-stored attachment's raw bytes back out of Stratus --
    the read half of store_attachment, needed for the task-completion
    evidence-verification flow (a just-uploaded file must be re-read to be
    analyzed, not just referenced). Mirrors main.py's /api/attachments/
    {stratus_key} endpoint's own fetch pattern exactly, so the two never
    drift on how a Stratus object is retrieved. Returns None on any failure
    (bucket unavailable, key not found) -- callers must treat that as
    "couldn't re-fetch," never crash the flow that's asking for it.
    """
    if not catalyst_app or not stratus_key or "/" in stratus_key or ".." in stratus_key:
        return None
    try:
        bucket = catalyst_app.stratus().bucket(ATTACHMENTS_BUCKET)
        obj = bucket.get_object(key=stratus_key)
        return obj.content if hasattr(obj, "content") else obj
    except Exception as e:
        logger.warning(f"Could not retrieve attachment '{stratus_key}' from Stratus: {e}")
        return None
