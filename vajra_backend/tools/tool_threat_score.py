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
        
        suspect_resolved = dossier.get("suspect_name", suspect)
        composite_score = dossier.get("composite_threat_score", 0)
        risk_level = dossier.get("risk_tier", "LOW")
        rrp = dossier.get("relapse_recidivism_potential", 0)
        fer = dossier.get("flight_evasion_risk", 0)
        sin = dossier.get("syndicate_nexus_score", 0)
        directives = dossier.get("procedural_directives", {})
        
        text_result = (
            f"⚖️ **PSOTI Threat & Risk Assessment: {suspect_resolved}**\n"
            f"• **Composite Threat Score**: **{composite_score}/100** ({risk_level} RISK)\n"
            f"• **Recidivism Potential (RRP)**: {rrp}/100\n"
            f"• **Flight & Evasion Risk (FER)**: {fer}/100\n"
            f"• **Syndicate Nexus (SIN)**: {sin}/100\n"
            f"• **BNSS Remand Guidance**: {directives.get('statutory_directive', 'Standard legal compliance (§187 BNSS)')}\n"
            f"• **Bail Opposition**: {directives.get('bail_recommendation', 'Assess under judicial guidelines')}"
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
