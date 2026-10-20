"""
VAJRA 3.0 Tool: Multimodal Vision & OCR Extractor with Autonomous Tool Chaining
==============================================================================
Extracts textual evidence from uploaded documents, crime scene photos, and FIRs.
Autonomously detects Karnataka license plates and executes downstream RTO lookup.
"""

import re
import base64
import logging
from typing import Dict, Any, Optional
from tools.registry import VajraTool, ToolManager
import catalyst_zia
import catalyst_stratus

logger = logging.getLogger("vajra_tools")

KARNATAKA_PLATE_REGEX = re.compile(r"\b(KA[-\s]?[0-9]{2}[-\s]?[A-Z]{1,2}[-\s]?[0-9]{4})\b", re.IGNORECASE)

class VisionExtractorTool(VajraTool):
    def get_schema(self) -> dict:
        return {
            "name": "vision_extractor",
            "description": "Multimodal Autonomy: Extracts printed/handwritten text from an image or document via Zia OCR/Qwen Vision, identifies Karnataka vehicle license plates (KA-XX), and autonomously queries the RTO Registry.",
            "parameters": {
                "type": "object",
                "properties": {
                    "stratus_key": {
                        "type": "string",
                        "description": "Catalyst Stratus file key of the uploaded evidence attachment"
                    },
                    "image_base64": {
                        "type": "string",
                        "description": "Base64 encoded image string if directly provided"
                    },
                    "language": {
                        "type": "string",
                        "description": "OCR language hint ('eng,kan' for bilingual Karnataka evidence)",
                        "default": "eng,kan"
                    }
                }
            }
        }

    def execute(self, params: dict, context: dict) -> dict:
        stratus_key = params.get("stratus_key")
        image_base64 = params.get("image_base64")
        language = params.get("language") or "eng,kan"
        
        image_bytes: Optional[bytes] = None

        if stratus_key:
            image_bytes = catalyst_stratus.get_attachment_bytes(stratus_key)
            if not image_bytes:
                logger.warning(f"[VisionExtractorTool] Failed to retrieve Stratus object: {stratus_key}")

        if not image_bytes and image_base64:
            try:
                # Strip data URL prefix if present (e.g. data:image/png;base64,...)
                if "," in image_base64:
                    image_base64 = image_base64.split(",", 1)[1]
                image_bytes = base64.b64decode(image_base64)
            except Exception as e:
                logger.warning(f"[VisionExtractorTool] Base64 decode failed: {e}")

        if not image_bytes:
            return {
                "response_type": "text",
                "text_result": "⚠️ **Vision & OCR Extractor**: No valid image payload or Stratus evidence key provided.",
                "data": {"error": "missing_image_payload"}
            }

        # 1. Execute Optical Character Recognition via Catalyst Zia
        ocr_result = catalyst_zia.run_ocr(image_bytes, language=language)
        extracted_text = (ocr_result.get("text") or "").strip()
        confidence = ocr_result.get("confidence")

        # 2. Autonomous License Plate Pattern Detection
        plate_matches = KARNATAKA_PLATE_REGEX.findall(extracted_text)
        unique_plates = []
        for p in plate_matches:
            clean_plate = re.sub(r"[\s-]", "", p.upper())
            if len(clean_plate) >= 8 and clean_plate not in unique_plates:
                unique_plates.append(clean_plate)

        # 3. AUTONOMY TRIGGER: Chain RTO lookup if license plates are discovered
        rto_results = []
        for plate in unique_plates:
            try:
                rto_res = ToolManager.execute_tool("rto_lookup", {"plate_number": plate}, context)
                if rto_res and not rto_res.get("error"):
                    rto_results.append(rto_res)
            except Exception as ex:
                logger.warning(f"[VisionExtractorTool] Autonomous RTO lookup failed for {plate}: {ex}")

        # 4. Formulate Comprehensive Forensic Brief
        preview_text = extracted_text[:400] + ("..." if len(extracted_text) > 400 else "")
        text_lines = [
            "👁️ **Multimodal Optical Evidence Extraction**",
            f"• **Transcript Length**: {len(extracted_text)} characters (Confidence: {confidence or 'High'})",
        ]
        if preview_text:
            text_lines.append(f"• **Extracted Text Sample**:\n> _{preview_text}_")

        if unique_plates:
            text_lines.append(f"\n🚗 **Autonomous License Plate Detection**: Found {len(unique_plates)} plate(s): `{', '.join(unique_plates)}`")
            for rto in rto_results:
                rto_txt = rto.get("text_result", "")
                if rto_txt:
                    text_lines.append(f"\n{rto_txt}")
        else:
            text_lines.append("\nℹ️ No Karnataka vehicle registration plates detected in this document/frame.")

        full_text = "\n".join(text_lines)

        return {
            "response_type": "multimodal_intelligence",
            "text_result": full_text,
            "data": {
                "ocr_transcript": extracted_text,
                "confidence": confidence,
                "plates_found": unique_plates,
                "automated_rto": [r.get("data") for r in rto_results if r.get("data")],
                "has_rto_intelligence": len(rto_results) > 0,
                "trigger_mascot_alert": len(unique_plates) > 0,
                "mascot_state": "SUCCESS" if len(unique_plates) > 0 else "THINKING_DEEP"
            },
            "citations": [
                {"type": "Optical Evidence (Zia OCR)", "id": stratus_key or "image_upload", "details": f"{len(extracted_text)} chars extracted"}
            ] + [cit for r in rto_results for cit in r.get("citations", [])]
        }

# Register with ToolManager
ToolManager.register("vision_extractor", VisionExtractorTool())
