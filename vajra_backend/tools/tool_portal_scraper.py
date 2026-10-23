"""
VAJRA 3.0 Tool: Portal Scrape Live Contract
============================================
Executes stealth DOM scraping and live intelligence extraction against state judicial,
transport, and police portals using TLS fingerprinting, preflight CSRF handshakes,
and Section 63 BSA electronic evidence locking.
"""

from typing import Dict, Any
from tools.registry import VajraTool, ToolManager
import scrapling_engine

class PortalScraperTool(VajraTool):
    def get_schema(self) -> dict:
        return {
            "name": "portal_scrape_live_contract",
            "description": "Execute live stealth DOM scraping against state judicial and transport portals (e-Courts, Vahan RTO, Sarathi DL) using TLS fingerprinting and Section 63 BSA evidence locking.",
            "parameters": {
                "type": "object",
                "properties": {
                    "portal_key": {
                        "type": "string",
                        "description": "Portal contract key: 'ecourts_karnataka', 'vahan_karnataka', 'sarathi_karnataka', 'highcourt_karnataka'"
                    },
                    "caseno": {"type": "string", "description": "Case number for e-Courts search (e.g. 'CR-2026-81977')"},
                    "caseyear": {"type": "string", "description": "Year of filing (e.g. '2026')"},
                    "district": {"type": "string", "description": "District court jurisdiction"},
                    "reg_no": {"type": "string", "description": "Vehicle registration plate for Vahan lookup"},
                    "dl_no": {"type": "string", "description": "Driving license number for Sarathi lookup"}
                },
                "required": ["portal_key"]
            }
        }

    def execute(self, params: dict, context: dict) -> dict:
        portal_key = params.get("portal_key") or "ecourts_karnataka"
        
        # Consolidate target query params
        req_params = {k: v for k, v in params.items() if k != "portal_key"}
        if "case_no" in params and "caseno" not in req_params:
            req_params["caseno"] = params["case_no"]
        if "plate_number" in params and "reg_no" not in req_params:
            req_params["reg_no"] = params["plate_number"]
        if "dl_number" in params and "dl_no" not in req_params:
            req_params["dl_no"] = params["dl_number"]

        result = scrapling_engine.execute_portal_scrape(portal_key, req_params)
        evidence = result.get("evidence_certificate", {})
        payload = result.get("extracted_payload", {})
        portal_name = result.get("portal", portal_key)
        ev_hash = evidence.get("evidence_hash", "63BSA-PENDING")

        # Format grounded tactical text
        lines = [
            f"🏛️ **Stealth OSINT Extraction — {portal_name}**",
            f"• **Statutory Evidence Hash**: `{ev_hash}` ({evidence.get('statutory_compliance', 'Section 63 BSA')})",
            f"• **Source Endpoint**: {result.get('source_url', 'Authenticated Portal')}",
            f"• **Capture Timestamp (UTC)**: {evidence.get('captured_at_utc', '')}",
            f"• **Handshake Cipher**: {result.get('session_handshake', {}).get('tls_cipher', 'Chromium TLS 1.3')}",
            ""
        ]

        if portal_key == "vahan_karnataka":
            lines.extend([
                f"**Vehicle Telemetry Record:**",
                f"• Registration No: `{payload.get('registration_no')}`",
                f"• Registered Owner: **{payload.get('owner_name')}**",
                f"• Class: {payload.get('vehicle_class')}",
                f"• RTO Office: {payload.get('rto_office')}",
                f"• Chassis / Engine: `{payload.get('chassis_no')}` / `{payload.get('engine_no')}`",
                f"• Status: {payload.get('blacklist_status', 'Active')}"
            ])
        elif portal_key == "sarathi_karnataka":
            lines.extend([
                f"**Driving License Intelligence:**",
                f"• DL Number: `{payload.get('dl_number')}`",
                f"• Holder: **{payload.get('holder_name')}** (S/o {payload.get('father_name')})",
                f"• Issuing Authority: {payload.get('issue_rto')}",
                f"• Validity: Valid through {payload.get('valid_until')}",
                f"• Endorsement Status: {payload.get('status')}"
            ])
        else: # e-Courts
            lines.extend([
                f"**Judicial Hearing & Remand Ledger:**",
                f"• Case Record: `{payload.get('case_number')}` ({payload.get('year')})",
                f"• Court: {payload.get('court')}",
                f"• Current Hearing Stage: **{payload.get('hearing_stage')}**",
                f"• Next Hearing Date: `{payload.get('next_hearing_date')}`",
                f"• Remand Status: {payload.get('statutory_remand_countdown', 'Under Section 187 BNSS')}",
                f"• Latest Judicial Order: *{payload.get('last_order')}*"
            ])

        text_result = "\n".join(lines)

        return {
            "response_type": "portal_scrape",
            "text_result": text_result,
            "data": result,
            "citations": [{
                "type": "Stealth OSINT Extraction",
                "id": ev_hash,
                "details": f"{portal_name} • Captured under {evidence.get('statutory_compliance', 'Section 63 BSA 2023')}"
            }]
        }

# Register with ToolManager
scraper_tool_instance = PortalScraperTool()
ToolManager.register("portal_scrape_live_contract", scraper_tool_instance)
ToolManager.register("portal_scraper", scraper_tool_instance)
