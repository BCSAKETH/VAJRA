"""
Zoho Catalyst Zia platform AI (OCR, image moderation, face comparison,
barcode scanning) -- distinct from the custom-deployed QuickML models
(GLM/Qwen/TTS/STT) wired in catalyst_llm.py/catalyst_qwen.py/catalyst_speech.py,
which need their own dedicated scoped OAuth token because the main app
token was never issued the QuickML.deployment.READ scope (see
vajra_core.get_quickml_access_token's own docstring). Zia's platform APIs
(ml/ocr, ml/imagemoderation, ml/facecomparison, ml/barcode) are reached
through the vendored zcatalyst_sdk's Zia component (app.zia()), using
whatever credentials `catalyst_app` already carries for every other SDK
call (zql/stratus) -- no separate token dance needed.

Every function here follows the same fail-soft contract as the rest of
this codebase's catalyst_*.py wrappers: a real result on success, a clear
"unavailable" status on any failure (missing catalyst_app, network error,
Zia not provisioned/enabled for this project) -- NEVER an exception that
takes down the caller, and never a fabricated result standing in for a
real one.
"""
import io
import logging
from typing import Any, Dict, Optional

from vajra_core import catalyst_app

logger = logging.getLogger("catalyst_zia")


def _reader(data: bytes) -> io.BufferedReader:
    return io.BufferedReader(io.BytesIO(data))


def run_ocr(image_bytes: bytes, language: str = "eng,kan") -> Dict[str, Any]:
    """Extracts printed/handwritten text from a scanned FIR/complaint page.
    `language` is a best-effort hint for Zia's OCR model_type=GENERAL --
    if bilingual Kannada+English isn't accepted as one combined value,
    Zia still returns whatever it can read; this never blocks the fallback
    Qwen vision description already run on every attachment."""
    if not catalyst_app:
        return {"status": "unavailable", "text": "", "reason": "Database client offline."}
    try:
        data = catalyst_app.zia().extract_optical_characters(
            _reader(image_bytes), options={"language": language, "model_type": "GENERAL"}
        ) or {}
        text = (data.get("text") or "").strip()
        return {"status": "success", "text": text, "confidence": data.get("confidence")}
    except Exception as e:
        logger.warning(f"Zia OCR unavailable: {e}")
        return {"status": "unavailable", "text": "", "reason": str(e)}


def check_image_moderation(image_bytes: bytes) -> Dict[str, Any]:
    """Flags graphic/explicit crime-scene imagery for click-to-reveal
    shielding (Section 141/POCSO safety) instead of showing it inline by
    default. Fails CLOSED on error side of "not sensitive" -- an
    unavailable moderation call must never itself become the reason a
    sensitive image gets blocked from an officer who needs to see it, but
    it also never claims a real classification it didn't get."""
    if not catalyst_app:
        return {"status": "unavailable", "is_sensitive": False, "categories": []}
    try:
        data = catalyst_app.zia().moderate_image(_reader(image_bytes)) or {}
        preds = data.get("predictions") or data
        categories = [k for k, v in preds.items() if isinstance(v, (int, float)) and v > 0.5]
        is_sensitive = any(
            isinstance(preds.get(cat), (int, float)) and preds.get(cat, 0) > threshold
            for cat, threshold in (("violence", 0.6), ("gore", 0.5), ("nudity", 0.4))
        )
        return {"status": "success", "is_sensitive": is_sensitive, "categories": categories}
    except Exception as e:
        logger.warning(f"Zia image moderation unavailable: {e}")
        return {"status": "unavailable", "is_sensitive": False, "categories": []}


def scan_barcode(image_bytes: bytes) -> Dict[str, Any]:
    """Decodes an evidence-bag barcode/QR (Malkhana chain-of-custody tags)
    from a photographed attachment."""
    if not catalyst_app:
        return {"status": "unavailable", "code_value": None}
    try:
        data = catalyst_app.zia().scan_barcode(_reader(image_bytes), options={"format": "ALL"}) or {}
        codes = data.get("barcodes") or data.get("codes") or []
        if not codes:
            return {"status": "not_found", "code_value": None}
        first = codes[0]
        return {
            "status": "success",
            "code_value": first.get("value") or first.get("data"),
            "format": first.get("format"),
        }
    except Exception as e:
        logger.warning(f"Zia barcode scan unavailable: {e}")
        return {"status": "unavailable", "code_value": None}


def compare_faces(source_bytes: bytes, query_bytes: bytes) -> Dict[str, Any]:
    """Pairwise face-match confidence (0-100%) between two images -- an
    investigative lead for suspect/CCTV comparison, never a biometric
    identification or courtroom-grade result on its own."""
    if not catalyst_app:
        return {"status": "unavailable", "match_confidence": None}
    try:
        data = catalyst_app.zia().compare_face(_reader(source_bytes), _reader(query_bytes)) or {}
        confidence = data.get("matchConfidence")
        if confidence is None:
            confidence = data.get("confidence")
        return {"status": "success", "match_confidence": confidence}
    except Exception as e:
        logger.warning(f"Zia face comparison unavailable: {e}")
        return {"status": "unavailable", "match_confidence": None}
