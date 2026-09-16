"""
VAJRA Case Forensic Intelligence Engine (Finals-part 3.md Section 40/42)

Backs both the Case Registry's dossier panel (DistrictFIRPanel.tsx) and the
AI Copilot's get_case_intelligence_dossier tool with the SAME real data:
accused roster, asset contacts, cross-case co-offending connections, and
syndicate affiliation -- previously the dossier showed only the 5 flat
CaseMaster fields (registration date, precinct, brief facts, victim/accused
counts), with no accused names, connections, or syndicate context at all.

GROUNDING NOTE (why this diverges from the plan doc's own blueprint): the
doc's blueprint assumed field names that don't exist on the live schema
(Section.SectionTitle/SectionNumber; Section already correctly resolved
elsewhere -- ActSectionAssociation.SectionID is a 1-based ORDINAL into
Section, not a foreign key, a bug already found and fixed in
agent_loop.py's get_sections_for_case/_get_section_ordinal_map, reused here
rather than re-broken) and a syndicate-cluster shape (cluster_name, kingpin,
lieutenants, modus_operandi, 0-100 threat_score) that doesn't match what
vajra_core.py's real Louvain detector (_compute_syndicate_clusters) actually
returns (members, hub, threat_score on a 0-1 scale, cross_district,
districts_involved, synthetic_data_disclosure). Every field below is taken
from that real shape -- no syndicate name/MO/hierarchy tier is invented for
a signal the detector doesn't actually compute.
"""

import logging
from typing import Any, Dict, List

from vajra_core import catalyst_app, escape_zcql_literal, get_cached_syndicate_clusters

logger = logging.getLogger("case_intelligence")

_MAX_CONNECTIONS = 15


def _victim_count(case_id: int) -> int:
    """Real count from the Victim table -- CaseMaster has no VictimCount
    column (confirmed via direct ZCQL query; _build_fir_records in main.py
    computes this the same way)."""
    try:
        res = catalyst_app.zql().execute_query(f"SELECT COUNT(ROWID) FROM Victim WHERE CaseMasterID = {case_id}")
        if res:
            return int(res[0].get("Victim", {}).get("COUNT(ROWID)") or 0)
    except Exception as e:
        logger.warning(f"Victim count query failed for case_id={case_id}: {e}")
    return 0


def get_case_intelligence(case_no: str, agent_loop_instance: Any) -> Dict[str, Any]:
    """Fetches the full forensic case dossier for one CrimeNo. `agent_loop_instance`
    is the shared VajraAgentLoop instance (main.py's module-level `agent_loop`) --
    reused for _resolve_case_no/get_sections_for_case rather than duplicating
    their already-fixed CaseMaster/Section resolution logic."""
    if not catalyst_app or not case_no:
        return {"error": "Database offline or invalid case number"}

    case_no = case_no.strip()
    case_id = agent_loop_instance._resolve_case_no(case_no) if agent_loop_instance else None
    if case_id is None:
        return {"error": f"Case {case_no} not found"}

    try:
        # CONFIRMED LIVE (verified via direct ZCQL query): CaseMaster has no
        # VictimCount/AccusedCount columns -- those are computed elsewhere
        # (_build_fir_records in main.py) via COUNT(ROWID) GROUP BY over the
        # real Victim/Accused tables. Don't re-request nonexistent columns
        # here; accused_count is free below (len(accused_roster)), and
        # victim_count gets its own scalar COUNT query.
        cm_res = catalyst_app.zql().execute_query(
            f"SELECT CaseMasterID, CrimeNo, BriefFacts, CrimeRegisteredDate, PoliceStationID, "
            f"CaseCategoryID FROM CaseMaster WHERE CaseMasterID = {case_id} LIMIT 1"
        )
    except Exception as e:
        logger.error(f"Failed to fetch CaseMaster for {case_no}: {e}")
        return {"error": str(e)}
    if not cm_res:
        return {"error": f"Case {case_no} not found"}

    cm = cm_res[0].get("CaseMaster", {})
    police_station_id = cm.get("PoliceStationID")

    # 1. Unit/district reference (same 2-step resolution used throughout this
    # codebase -- ZCQL has no JOINs).
    unit_name, district_name = "Unknown PS", "Karnataka"
    try:
        if police_station_id:
            u_res = catalyst_app.zql().execute_query(f"SELECT UnitName, DistrictID FROM Unit WHERE UnitID = {police_station_id} LIMIT 1")
            if u_res:
                unit_name = u_res[0].get("Unit", {}).get("UnitName", unit_name)
                dist_id = u_res[0].get("Unit", {}).get("DistrictID")
                if dist_id:
                    d_res = catalyst_app.zql().execute_query(f"SELECT DistrictName FROM District WHERE DistrictID = {dist_id} LIMIT 1")
                    if d_res:
                        district_name = d_res[0].get("District", {}).get("DistrictName", district_name)
    except Exception as e:
        logger.warning(f"Error resolving unit/district for {case_no}: {e}")

    # 2. Legal sections -- reuses the already-fixed ordinal-index resolution.
    legal_sections: List[str] = []
    try:
        if agent_loop_instance:
            legal_sections = agent_loop_instance.get_sections_for_case(case_id)
    except Exception as e:
        logger.warning(f"Error resolving legal sections for {case_no}: {e}")

    # 3. Accused roster with demographics, asset contacts, and arrest status.
    accused_roster: List[Dict[str, Any]] = []
    accused_names: List[str] = []
    try:
        acc_res = catalyst_app.zql().execute_query(
            f"SELECT AccusedMasterID, AccusedName, AgeYear, GenderID FROM Accused WHERE CaseMasterID = {case_id}"
        )
        for a in acc_res:
            acc_data = a.get("Accused", {})
            name = (acc_data.get("AccusedName") or "").strip()
            if not name:
                continue
            accused_names.append(name)
            accused_master_id = acc_data.get("AccusedMasterID")

            safe_name = escape_zcql_literal(name)
            contact_info: Dict[str, Any] = {}
            try:
                contact_res = catalyst_app.zql().execute_query(
                    f"SELECT PhoneNumber, VehicleNumber FROM AccusedContact WHERE AccusedName = '{safe_name}' LIMIT 1"
                )
                if contact_res:
                    contact_info = contact_res[0].get("AccusedContact", {})
            except Exception as e:
                logger.warning(f"AccusedContact lookup failed for {name}: {e}")

            # Keyed on THIS accused's own AccusedMasterID, not just the case --
            # a case-level-only join would show the same arrest record for
            # every accused in a multi-accused case, regardless of who it's
            # actually about.
            status = "Under Investigation"
            try:
                if accused_master_id is not None:
                    arrest_res = catalyst_app.zql().execute_query(
                        f"SELECT ArrestSurrenderDate FROM ArrestSurrender WHERE AccusedMasterID = {accused_master_id} LIMIT 1"
                    )
                    if arrest_res:
                        adate = arrest_res[0].get("ArrestSurrender", {}).get("ArrestSurrenderDate")
                        if adate:
                            status = f"Arrested on {adate}"
            except Exception as e:
                logger.warning(f"ArrestSurrender lookup failed for {name}: {e}")

            gender_id = acc_data.get("GenderID")
            accused_roster.append({
                "accused_master_id": accused_master_id,
                "name": name,
                "age": acc_data.get("AgeYear"),
                "gender": "Male" if str(gender_id) == "1" else "Female" if str(gender_id) == "2" else "Unknown",
                "phone": contact_info.get("PhoneNumber") or None,
                "vehicle": contact_info.get("VehicleNumber") or None,
                "status": status,
            })
    except Exception as e:
        logger.error(f"Error fetching accused roster for {case_no}: {e}")

    # 4. Cross-case co-offending connections + 2nd-degree associates, capped
    # so one heavily-linked accused can't blow up the response.
    network_nodes: List[Dict[str, str]] = [{"id": case_no, "label": case_no, "type": "case"}]
    network_edges: List[Dict[str, str]] = []
    connections: List[Dict[str, Any]] = []

    for acc in accused_roster:
        acc_name = acc["name"]
        network_nodes.append({"id": acc_name, "label": acc_name, "type": "accused"})
        network_edges.append({"source": case_no, "target": acc_name, "label": "Charged In"})
        if len(connections) >= _MAX_CONNECTIONS:
            continue
        safe_acc = escape_zcql_literal(acc_name)
        try:
            other_res = catalyst_app.zql().execute_query(
                f"SELECT CaseMasterID FROM Accused WHERE AccusedName = '{safe_acc}' AND CaseMasterID != {case_id} LIMIT 10"
            )
            linked_ids = [r.get("Accused", {}).get("CaseMasterID") for r in other_res if r.get("Accused", {}).get("CaseMasterID")]
            if not linked_ids:
                continue
            ids_str = ",".join(str(c) for c in linked_ids[:10])
            other_firs = catalyst_app.zql().execute_query(
                f"SELECT CrimeNo FROM CaseMaster WHERE CaseMasterID IN ({ids_str})"
            )
            for f in other_firs:
                other_no = f.get("CaseMaster", {}).get("CrimeNo")
                if not other_no or len(connections) >= _MAX_CONNECTIONS:
                    continue
                connections.append({"accused": acc_name, "linked_case": other_no, "type": "Prior Repeat Offence"})
                network_nodes.append({"id": other_no, "label": other_no, "type": "case"})
                network_edges.append({"source": acc_name, "target": other_no, "label": "Accused In"})

            co_res = catalyst_app.zql().execute_query(
                f"SELECT DISTINCT AccusedName FROM Accused WHERE CaseMasterID IN ({ids_str}) LIMIT 10"
            )
            for co in co_res:
                co_name = (co.get("Accused", {}).get("AccusedName") or "").strip()
                if not co_name or co_name == acc_name or len(connections) >= _MAX_CONNECTIONS:
                    continue
                connections.append({"accused": acc_name, "associate": co_name, "type": "Co-Accused Partner"})
                network_nodes.append({"id": co_name, "label": co_name, "type": "associate"})
                network_edges.append({"source": acc_name, "target": co_name, "label": "Co-Offender"})
        except Exception as e:
            logger.warning(f"Error resolving associates for {acc_name}: {e}")

    # 5. Syndicate affiliation -- ONLY the fields the real Louvain detector
    # (vajra_core._compute_syndicate_clusters) actually computes. No
    # syndicate name, hierarchy tier, or modus-operandi string is invented
    # for a signal that detector doesn't produce.
    cache = get_cached_syndicate_clusters()
    syndicate_info: Dict[str, Any] = {
        "detection_status": cache.get("status", "never_run"),
        "is_syndicate_member": False,
    }
    if cache.get("status") == "done" and cache.get("result"):
        for cluster in cache["result"]:
            members = cluster.get("members", [])
            matched = [m for m in accused_names if m in members]
            if not matched:
                continue
            hub = cluster.get("hub")
            syndicate_info.update({
                "is_syndicate_member": True,
                "cluster_members": members,
                "cluster_size": len(members),
                "is_hub": matched[0] == hub,
                "hub_name": hub,
                # Real 0-1 scale from vajra_core -- presented as a whole-percent
                # for readability, same convention as _deterministic_chart_explanation.
                "threat_score_pct": round(cluster.get("threat_score", 0.0) * 100),
                "threat_components": cluster.get("threat_components", {}),
                "shared_case_count": cluster.get("shared_case_count", 0),
                "cross_district": cluster.get("cross_district", False),
                "districts_involved": cluster.get("districts_involved", []),
                "synthetic_data_disclosure": cluster.get("synthetic_data_disclosure", False),
                "resembles_past_syndicate": cluster.get("resembles_past_syndicate"),
            })
            break

    # Section 111 BNS (organized crime) eligibility -- a disclosed HEURISTIC
    # (real syndicate membership, or >=2 independently-verified cross-case
    # connections), never presented as a legal determination.
    section_111_eligible = syndicate_info["is_syndicate_member"] or len(connections) >= 2

    return {
        "case_no": case_no,
        "registered_date": cm.get("CrimeRegisteredDate", "Unknown"),
        "unit_name": unit_name,
        "district_name": district_name,
        "brief_facts": cm.get("BriefFacts", "No narrative compiled."),
        "victim_count": _victim_count(case_id),
        "accused_count": len(accused_roster),
        "legal_sections": legal_sections,
        "accused_roster": accused_roster,
        "connections": connections,
        "syndicate": syndicate_info,
        "section_111_bns_eligible": section_111_eligible,
        "network_graph": {
            "nodes": list({n["id"]: n for n in network_nodes}.values()),
            "edges": network_edges,
        },
    }
