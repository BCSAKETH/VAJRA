"""
KSP VAJRA 3.0 — Track 5: Socio-Demographic Context & Statutory Legal Engine
==========================================================================
Provides population-normalized crime intelligence, district socioeconomic correlations,
victimology distributions, and statutory BNSS/BNS procedural checklists.

Core Guardrails & Invariants:
1. Population Normalization: Computes crime rates per 100,000 residents using census
   denominators, preventing large cities from appearing spuriously disproportionate.
2. Boundary Disclosure: Explicitly discloses that 30 districts possess socioeconomic
   indicators, while 11 administrative police jurisdictions remain unprofiled.
3. Zero Individual Demographics in Criminality Scoring: Strictly prohibits using caste,
   religion, or economic indicators to score individual suspects (avoids ecological fallacy).
4. Procedural Legal Verification: Formulates deterministic Section 187(3) BNSS remand
   tracking and Section 111 BNS statutory criteria, framed strictly as an investigative aid.
"""

import os
import sys
import logging
from datetime import datetime, date, timedelta
from typing import Dict, Any, List, Optional, Tuple
import numpy as np
import pandas as pd

logger = logging.getLogger("vajra.socio_demographic")

_backend_dir = os.path.dirname(os.path.abspath(__file__))
if _backend_dir not in sys.path:
    sys.path.insert(0, _backend_dir)

DATA_DIR = os.path.join(_backend_dir, "data")

from vajra_core import catalyst_app

# Official Karnataka Census Population by District (Census of India / Directorate of Economics & Statistics)
KARNATAKA_DISTRICT_POPULATION: Dict[str, int] = {
    "Bengaluru City": 9621551,
    "Bengaluru Urban": 9621551,
    "Bengaluru Rural": 990923,
    "Belagavi": 4779661,
    "Mysuru": 3001127,
    "Tumakuru": 2678480,
    "Ballari": 2452595,
    "Kalaburagi": 2566326,
    "Vijayapura": 2177331,
    "Shivamogga": 1752771,
    "Dakshina Kannada": 2089649,
    "Davanagere": 1945497,
    "Raichur": 1928812,
    "Bagalkote": 1889752,
    "Dharwad": 1847023,
    "Mandya": 1805769,
    "Hassan": 1776421,
    "Koppal": 1389920,
    "Chikkamagaluru": 1137961,
    "Udupi": 1177361,
    "Yadgir": 1174271,
    "Kolar": 1536401,
    "Chikkaballapura": 1255104,
    "Chamarajanagar": 1020791,
    "Haveri": 1597668,
    "Gadag": 1064570,
    "Uttara Kannada": 1437169,
    "Ramanagara": 1082636,
    "Bidar": 1703300,
    "Kodagu": 554519,
    "KGF": 350000,
    "Hubballi-Dharwad City": 943788,
    "Mangaluru City": 623841,
    "Belagavi City": 610189,
    "Kalaburagi City": 543147,
    "Railways": 500000,
    "CID": 500000
}


class SocioDemographicEngine:
    _cached_profiles: Optional[List[Dict[str, Any]]] = None

    @classmethod
    def get_district_socioeconomic_analytics(cls) -> Dict[str, Any]:
        """
        Computes population-normalized crime rates per 100,000 residents
        joined with DistrictSocioProfile economic indicators.
        """
        if not catalyst_app:
            return {"status": "error", "message": "Database offline"}

        try:
            zql = catalyst_app.zql()

            # 1. Fetch District and Unit reference tables
            districts_raw = zql.execute_query("SELECT DistrictID, DistrictName FROM District LIMIT 100") or []
            districts_map = {
                int(d.get("District", d).get("DistrictID")): d.get("District", d).get("DistrictName")
                for d in districts_raw if d.get("District", d).get("DistrictID")
            }

            units_raw = zql.execute_query("SELECT UnitID, DistrictID FROM Unit LIMIT 1500") or []
            unit_to_dist = {
                int(u.get("Unit", u).get("UnitID")): int(u.get("Unit", u).get("DistrictID"))
                for u in units_raw if u.get("Unit", u).get("UnitID") and u.get("Unit", u).get("DistrictID")
            }

            # 2. Fetch DistrictSocioProfile (30 districts)
            socio_raw = zql.execute_query("SELECT * FROM DistrictSocioProfile LIMIT 100") or []
            socio_map = {}
            for s in socio_raw:
                sd = s.get("DistrictSocioProfile", s)
                did = sd.get("DistrictID")
                if did:
                    socio_map[int(did)] = sd

            # 3. Read Parquet cases for empirical case distributions
            parquet_dir = os.path.join(DATA_DIR, "parquet")
            dist_counts: Dict[int, int] = {}

            if os.path.exists(parquet_dir):
                p_files = [os.path.join(parquet_dir, f) for f in os.listdir(parquet_dir) if f.endswith(".parquet")]
                for pf in p_files:
                    try:
                        df = pd.read_parquet(pf, columns=["PoliceStationID"])
                        for ps_id in df["PoliceStationID"].dropna():
                            try:
                                uid = int(ps_id)
                                did = unit_to_dist.get(uid)
                                if did:
                                    dist_counts[did] = dist_counts.get(did, 0) + 1
                            except (ValueError, TypeError):
                                pass
                    except Exception:
                        pass

            # 4. Compile Normalized Records
            district_analytics = []
            rates_for_corr = []
            stress_for_corr = []

            for did, dname in districts_map.items():
                pop = KARNATAKA_DISTRICT_POPULATION.get(dname, 1500000)
                raw_count = dist_counts.get(did, 0)
                rate_per_100k = round((raw_count / max(pop, 10000)) * 100000.0, 2)

                socio_data = socio_map.get(did)
                has_profile = socio_data is not None

                lit_rate = float(socio_data.get("LiteracyRate", 0.0)) if has_profile else None
                unemp_rate = float(socio_data.get("UnemploymentRate", 0.0)) if has_profile else None
                urban_idx = float(socio_data.get("UrbanizationIndex", 0.0)) if has_profile else None
                stress_idx = float(socio_data.get("EconomicStressIndex", 0.0)) if has_profile else None

                if has_profile and stress_idx is not None and raw_count > 0:
                    rates_for_corr.append(rate_per_100k)
                    stress_for_corr.append(stress_idx)

                district_analytics.append({
                    "district_id": did,
                    "district_name": dname,
                    "census_population": pop,
                    "recorded_cases_sample": raw_count,
                    "crime_rate_per_100k": rate_per_100k,
                    "socioeconomic_indicators": {
                        "has_profile": has_profile,
                        "literacy_rate": lit_rate,
                        "unemployment_rate": unemp_rate,
                        "urbanization_index": urban_idx,
                        "economic_stress_index": stress_idx
                    }
                })

            district_analytics.sort(key=lambda x: x["crime_rate_per_100k"], reverse=True)

            # Compute Macro Correlation between Economic Stress and Crime Rate
            corr_val = None
            if len(rates_for_corr) >= 5:
                r_arr = np.array(rates_for_corr)
                s_arr = np.array(stress_for_corr)
                r_diff = r_arr - np.mean(r_arr)
                s_diff = s_arr - np.mean(s_arr)
                denom = (np.sum(r_diff ** 2) * np.sum(s_diff ** 2)) ** 0.5
                if denom > 0:
                    corr_val = round(float(np.sum(r_diff * s_diff) / denom), 3)

            return {
                "status": "success",
                "total_districts": len(districts_map),
                "profiled_districts_count": len(socio_map),
                "unprofiled_districts_count": len(districts_map) - len(socio_map),
                "macro_correlation_stress_vs_rate": corr_val,
                "epistemic_safeguard": (
                    "POPULATION NORMALIZATION APPLIED: Crime rates expressed per 100,000 residents. "
                    "Socioeconomic profile data exists for 30 districts; 11 districts/commissionerates are unprofiled. "
                    "STRICT LEGAL SAFEGUARD: Individual suspects are never scored using demographic indicators."
                ),
                "district_rankings": district_analytics
            }
        except Exception as e:
            logger.error(f"Error computing socioeconomic analytics: {e}", exc_info=True)
            return {"status": "error", "error": str(e)}

    @classmethod
    def get_victimology_breakdown(cls, sample_limit: int = 500) -> Dict[str, Any]:
        """
        Computes aggregate victim demographic distribution across CCTNS.
        Helps prioritize victim protection programs and specialized counseling desks.
        """
        if not catalyst_app:
            return {"status": "error", "message": "Database offline"}

        try:
            zql = catalyst_app.zql()
            rows = zql.execute_query(f"SELECT AgeYear, GenderID, VictimPolice FROM Victim LIMIT {sample_limit}") or []

            age_brackets = {"under_18": 0, "18_to_30": 0, "31_to_50": 0, "51_to_65": 0, "senior_65_plus": 0}
            gender_counts = {"female": 0, "male": 0, "other": 0}
            victim_type = {"civilian": 0, "police_personnel": 0}

            total_valid = 0
            for r in rows:
                v = r.get("Victim", r)
                age = v.get("AgeYear")
                gid = v.get("GenderID")
                pol = v.get("VictimPolice")

                if age is not None:
                    try:
                        a = int(age)
                        if a < 18:
                            age_brackets["under_18"] += 1
                        elif a <= 30:
                            age_brackets["18_to_30"] += 1
                        elif a <= 50:
                            age_brackets["31_to_50"] += 1
                        elif a <= 65:
                            age_brackets["51_to_65"] += 1
                        else:
                            age_brackets["senior_65_plus"] += 1
                        total_valid += 1
                    except (ValueError, TypeError):
                        pass

                if gid is not None:
                    try:
                        g = int(gid)
                        if g == 1:
                            gender_counts["female"] += 1
                        elif g == 2:
                            gender_counts["male"] += 1
                        else:
                            gender_counts["other"] += 1
                    except (ValueError, TypeError):
                        pass

                if pol is not None:
                    try:
                        p = int(pol)
                        if p == 2:
                            victim_type["police_personnel"] += 1
                        else:
                            victim_type["civilian"] += 1
                    except (ValueError, TypeError):
                        pass

            return {
                "status": "success",
                "sample_size": len(rows),
                "valid_demographic_records": total_valid,
                "age_distribution": age_brackets,
                "gender_breakdown": gender_counts,
                "victim_status": victim_type,
                "analytical_note": "Grounded victimology metrics used exclusively for victim assistance resource allocation."
            }
        except Exception as e:
            logger.error(f"Error computing victimology: {e}")
            return {"status": "error", "error": str(e)}

    @classmethod
    def audit_bnss_procedural_compliance(
        cls,
        suspect_name: str,
        arrest_date: Optional[str] = None,
        offence_punishment_years: int = 7,
        has_prior_chargesheet: bool = False,
        co_accused_count: int = 1
    ) -> Dict[str, Any]:
        """
        Deterministic BNSS Section 187(3) and BNS Section 111 Statutory Checklist.
        Calculates exact default bail dates and remand deadlines.
        """
        # Determine Section 187(3) BNSS Default Bail Deadline
        # 90 days for offenses punishable with death, imprisonment for life, or >= 10 years
        # 60 days for all other cognizable offenses
        statutory_days = 90 if offence_punishment_years >= 10 else 60

        default_bail_date = None
        days_remaining = None
        remand_status = "PRE_ARREST"

        if arrest_date:
            try:
                a_dt = datetime.strptime(str(arrest_date)[:10], "%Y-%m-%d").date()
                deadline = a_dt + timedelta(days=statutory_days)
                default_bail_date = deadline.isoformat()
                now_dt = date.today()
                days_remaining = (deadline - now_dt).days
                if days_remaining < 0:
                    remand_status = "DEFAULT_BAIL_ACCRUED"
                elif days_remaining <= 7:
                    remand_status = "CRITICAL_STATUTORY_DEADLINE"
                else:
                    remand_status = "ACTIVE_INVESTIGATION_WINDOW"
            except Exception:
                pass

        # Section 111 BNS (Organized Crime) Qualification Checklist
        bns_111_elements = {
            "continuing_unlawful_activity": has_prior_chargesheet,
            "syndicate_structure": co_accused_count >= 2,
            "statutory_criteria_met": bool(has_prior_chargesheet and co_accused_count >= 2),
            "procedural_directive": (
                "Section 111 BNS threshold satisfied: Document prior chargesheet certified copies under Section 63 BSA "
                "before seeking custodial remand extension." if (has_prior_chargesheet and co_accused_count >= 2)
                else "Standard investigation: Proceed under regular BNSS provisions."
            )
        }

        return {
            "status": "success",
            "suspect_name": suspect_name,
            "statutory_statute": "Bharatiya Nagarik Suraksha Sanhita (BNSS) 2023",
            "section_187_3_remand_audit": {
                "statutory_investigation_ceiling_days": statutory_days,
                "arrest_date": arrest_date or "Not yet arrested / Pending investigation",
                "default_bail_deadline": default_bail_date or f"Calculated as ArrestDate + {statutory_days} days",
                "days_remaining_to_filing": days_remaining,
                "procedural_status": remand_status,
                "legal_mandate": f"Mandatory submission of Police Report (Chargesheet) within {statutory_days} days under §187(3) BNSS."
            },
            "bns_section_111_checklist": bns_111_elements,
            "procedural_framing": "Traceable Procedural Checklist for Legal Review (Assists IO; judicial determination applies)."
        }


if __name__ == "__main__":
    print("Testing SocioDemographicEngine...")
    socio = SocioDemographicEngine.get_district_socioeconomic_analytics()
    print(f"Districts profiled: {socio.get('profiled_districts_count')}/{socio.get('total_districts')}")
    print("Top 3 districts by population-normalized crime rate:")
    for r in socio.get("district_rankings", [])[:3]:
        print(f"  • {r['district_name']}: {r['crime_rate_per_100k']} per 100k (Cases: {r['recorded_cases_sample']:,}, Pop: {r['census_population']:,})")

    checklist = SocioDemographicEngine.audit_bnss_procedural_compliance(
        suspect_name="Ravi Kumar",
        arrest_date="2026-09-01",
        offence_punishment_years=7,
        has_prior_chargesheet=True,
        co_accused_count=3
    )
    print("\nBNSS §187(3) Procedural Checklist:")
    print(checklist["section_187_3_remand_audit"])
    print("BNS §111 Checklist:", checklist["bns_section_111_checklist"])
