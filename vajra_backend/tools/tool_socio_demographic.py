"""
VAJRA 3.0 Tool: Socio-Demographic Intelligence & Statutory BNSS Audit
====================================================================
Computes population-normalized crime metrics across Karnataka districts and
generates deterministic BNSS Section 187(3) default bail / remand checklists.
"""

from typing import Dict, Any
from tools.registry import VajraTool, ToolManager
from socio_demographic_engine import SocioDemographicEngine

class SocioDemographicTool(VajraTool):
    def get_schema(self) -> dict:
        return {
            "name": "get_socio_demographic_intelligence",
            "description": "Calculates population-normalized crime rates per 100,000 residents across Karnataka districts, victimology distributions, and generates BNSS §187(3) remand checklists.",
            "parameters": {
                "type": "object",
                "properties": {
                    "action": {
                        "type": "string",
                        "enum": ["district_rates", "victimology", "bnss_audit"],
                        "description": "Specific analytical intelligence to produce",
                        "default": "district_rates"
                    },
                    "suspect_name": {
                        "type": "string",
                        "description": "Suspect name for BNSS statutory remand audit (when action='bnss_audit')"
                    },
                    "arrest_date": {
                        "type": "string",
                        "description": "Date of formal arrest (YYYY-MM-DD) for BNSS §187(3) default bail computation"
                    },
                    "offence_punishment_years": {
                        "type": "integer",
                        "description": "Maximum statutory punishment in years for the alleged offense (default: 7)",
                        "default": 7
                    }
                }
            }
        }

    def execute(self, params: dict, context: dict) -> dict:
        action = params.get("action") or "district_rates"

        if action == "bnss_audit":
            suspect = params.get("suspect_name") or "Suspect"
            arr_date = params.get("arrest_date")
            punish_yrs = params.get("offence_punishment_years") or 7
            audit = SocioDemographicEngine.audit_bnss_procedural_compliance(
                suspect_name=suspect,
                arrest_date=arr_date,
                offence_punishment_years=int(punish_yrs),
                has_prior_chargesheet=True,
                co_accused_count=2
            )

            rem = audit.get("section_187_3_remand_audit", {})
            bns = audit.get("bns_section_111_checklist", {})

            lines = [
                f"⚖️ **BNSS 2023 Statutory Procedural Remand Audit: {suspect}**",
                f"• **Statutory Investigation Ceiling**: **{rem.get('statutory_investigation_ceiling_days')} Days** under §187(3) BNSS",
                f"• **Arrest Date**: {rem.get('arrest_date')}",
                f"• **Default Bail Deadline**: **{rem.get('default_bail_deadline')}** ({rem.get('days_remaining_to_filing')} days remaining)",
                f"• **Remand Procedural Status**: **{rem.get('procedural_status')}**\n",
                f"**BNS Section 111 (Organized Crime) Audit:**",
                f"• **Continuing Unlawful Activity**: {'Yes' if bns.get('continuing_unlawful_activity') else 'No'}",
                f"• **Syndicate Structure**: {'Yes' if bns.get('syndicate_structure') else 'No'}",
                f"• **Statutory Directive**: {bns.get('procedural_directive')}\n",
                f"*{audit.get('procedural_framing')}*"
            ]

            return {
                "response_type": "bnss_audit",
                "text_result": "\n".join(lines),
                "data": audit
            }

        elif action == "victimology":
            victim_data = SocioDemographicEngine.get_victimology_breakdown()
            ages = victim_data.get("age_distribution", {})
            genders = victim_data.get("gender_breakdown", {})

            lines = [
                "🛡️ **Karnataka CCTNS Victimology Demographic Profile**",
                f"• **Sampled Victims**: {victim_data.get('sample_size'):,} verified records",
                f"• **Age Breakdown**: Under-18: {ages.get('under_18')}, 18-30: {ages.get('18_to_30')}, 31-50: {ages.get('31_to_50')}, 51-65: {ages.get('51_to_65')}, 65+: {ages.get('senior_65_plus')}",
                f"• **Gender Distribution**: Female: {genders.get('female')}, Male: {genders.get('male')}, Other: {genders.get('other')}",
                "\n*Ethical Guardrail*: Grounded victimology metrics utilized strictly for victim assistance and protective policing."
            ]

            return {
                "response_type": "victimology",
                "text_result": "\n".join(lines),
                "data": victim_data
            }

        else:
            analytics = SocioDemographicEngine.get_district_socioeconomic_analytics()
            rankings = analytics.get("district_rankings", [])
            corr = analytics.get("macro_correlation_stress_vs_rate")

            lines = [
                "📊 **Karnataka District Population-Normalized Crime Intelligence**",
                f"• **Macro Correlation (Economic Stress vs. Crime Rate)**: **{corr if corr is not None else 'Evaluating'}**",
                f"• **Profiled Districts**: **{analytics.get('profiled_districts_count')}/41** (11 administrative units unprofiled in datastore)\n",
                "**Top Districts by Normalized Rate per 100,000 Residents:**"
            ]

            for rank, r in enumerate(rankings[:5], start=1):
                soc = r["socioeconomic_indicators"]
                lines.append(
                    f"{rank}. **{r['district_name']}**: **{r['crime_rate_per_100k']} / 100k** "
                    f"(Cases: {r['recorded_cases_sample']:,}, Pop: {r['census_population']:,}) | "
                    f"Lit: {soc.get('literacy_rate') or 'N/A'}%, Unemp: {soc.get('unemployment_rate') or 'N/A'}%"
                )

            lines.append(f"\n*{analytics.get('epistemic_safeguard')}*")

            return {
                "response_type": "district_rates",
                "text_result": "\n".join(lines),
                "data": analytics
            }

# Register with central ToolManager
ToolManager.register("get_socio_demographic_intelligence", SocioDemographicTool())
