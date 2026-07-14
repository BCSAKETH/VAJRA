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
