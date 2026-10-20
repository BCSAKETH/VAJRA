"""
VAJRA 3.0 Tool: RTO Vehicle Registration Lookup
===============================================
Decodes Indian vehicle registration plates, specializing in Karnataka (KA-01 to KA-55).
"""

from typing import Dict, Any
from tools.registry import VajraTool, ToolManager
import technical_osint

class RTOLookupTool(VajraTool):
    def get_schema(self) -> dict:
        return {
            "name": "resolve_rto_plate",
            "description": "Decode an Indian vehicle registration plate (e.g. KA-04-E-1234) into its Karnataka RTO office, district jurisdiction, and police operational zone.",
            "parameters": {
                "type": "object",
                "properties": {
                    "plate_number": {"type": "string", "description": "Vehicle registration number (e.g., KA04E1234, KA-01-AB-1234)"}
                },
                "required": ["plate_number"]
            }
        }

    def execute(self, params: dict, context: dict) -> dict:
        plate = params.get("plate_number") or params.get("plate") or params.get("vehicle_no") or ""
        res = technical_osint.resolve_rto_plate(plate)
        
        if not res.get("valid"):
            text_result = f"⚠️ **Vehicle Registration Lookup ({plate})**\nCould not resolve plate to an official Karnataka RTO office."
        else:
            rto_off = res.get("rto_office", "Unknown RTO")
            dist = res.get("district", "Karnataka")
            zone = res.get("police_zone", "General State Transport")
            text_result = (
                f"🚗 **Vehicle Registration Forensics: {res.get('plate')}**\n"
                f"• **Jurisdiction**: {res.get('jurisdiction', f'{rto_off}, {dist}')}\n"
                f"• **RTO Office**: {rto_off} ({res.get('rto_code', 'KA')})\n"
                f"• **Police Operational Zone**: {zone}\n"
                f"• **Administrative District**: {dist}\n"
                f"• *Verification Source*: {res.get('source', 'Karnataka Transport Registry')}"
            )

        return {
            "response_type": "rto_lookup",
            "text_result": text_result,
            "data": res,
            "citations": [{
                "type": "Transport Registry",
                "id": plate,
                "details": f"{res.get('rto_office', 'Karnataka')} RTO"
            }]
        }

# Register with ToolManager
ToolManager.register("resolve_rto_plate", RTOLookupTool())
