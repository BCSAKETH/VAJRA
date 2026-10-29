"""
VAJRA 3.0 Tool: Actuarial Threat Score & PSOTI Assessment
=========================================================
Computes court-admissible threat assessment and recidivism index under BNSS 2023.
"""

from typing import Dict, Any
from tools.registry import VajraTool, ToolManager
from threat_scoring_engine import ThreatScoringEngine

class ThreatScoreTool(VajraTool):
    def get_schema(self) -> dict:
        return {
            "name": "get_offender_risk",
            "description": "Assess suspect recidivism risk, flight potential, syndicate nexus, and BNSS remand/bail guidelines using the actuarial PSOTI model.",
            "parameters": {
                "type": "object",
                "properties": {
                    "suspect_name": {"type": "string", "description": "Full name or alias of the accused/suspect"},
                    "case_id": {"type": "integer", "description": "Optional context CaseMasterID"},
                    "district": {"type": "string", "description": "Optional district filter"}
                },
                "required": ["suspect_name"]
            }
        }

    def execute(self, params: dict, context: dict) -> dict:
        suspect = params.get("suspect_name") or params.get("name") or params.get("accused_name") or ""
        context_case_id = params.get("case_id")
        district_name = params.get("district")
        
        dossier = ThreatScoringEngine.evaluate_suspect_threat(
            suspect_name=suspect,
            context_case_id=context_case_id,
            district_name=district_name
        )
        
        suspect_resolved = dossier.get("suspect") or dossier.get("suspect_name") or suspect
        composite_score = dossier.get("psoti_score", dossier.get("risk_score", dossier.get("composite_threat_score", 0)))
        risk_level = dossier.get("threat_tier", dossier.get("risk_rating", dossier.get("risk_tier", "LOW")))
        sub = dossier.get("sub_metrics") or {}
        rrp = sub.get("relapse_potential", dossier.get("relapse_recidivism_potential", 0))
        fer = sub.get("flight_risk", dossier.get("flight_evasion_risk", 0))
        sin = sub.get("syndicate_nexus", dossier.get("syndicate_nexus_score", 0))
        directive_text = dossier.get("tactical_directive") or dossier.get("prosecution_advice") or ""
        directives = dossier.get("procedural_directives") or {}
        statutory_directive = directive_text or directives.get("statutory_directive", "Standard legal compliance (§187 BNSS)")
        bail_rec = directives.get("bail_recommendation", "Assess under judicial guidelines")
        
        text_result = (
            f"⚖️ **PSOTI Threat & Risk Assessment: {suspect_resolved}**\n"
            f"• **Composite Threat Score**: **{composite_score}/100** ({risk_level})\n"
            f"• **Recidivism Potential (RRP)**: {rrp}/100\n"
            f"• **Flight & Evasion Risk (FER)**: {fer}/100\n"
            f"• **Syndicate Nexus (SIN)**: {sin}/100\n"
            f"• **BNSS Remand Guidance**: {statutory_directive}\n"
            f"• **Bail Opposition**: {bail_rec}"
        )

        dossier["type"] = "risk"
        return {
            "response_type": "risk",
            "text_result": text_result,
            "data": dossier,
            "citations": [{
                "type": "PSOTI Risk Engine",
                "id": suspect_resolved,
                "details": f"{risk_level} Risk (Score: {composite_score})"
            }]
        }

# Register with ToolManager
ToolManager.register("get_offender_risk", ThreatScoreTool())
