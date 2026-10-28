"""
VAJRA 3.0 Tool: Criminal Syndicate Graph (Network Analytics)
============================================================
Reconstructs criminal network topologies, co-accused linkages, and gang hierarchies
from CCTNS Accused and CaseMaster records formatted for Cytoscape.js visualization.
"""

import logging
from typing import Dict, Any, List, Set
from collections import defaultdict
from tools.registry import VajraTool, ToolManager
from vajra_core import catalyst_app, escape_zcql_literal

logger = logging.getLogger("vajra_tools")

class SyndicateGraphTool(VajraTool):
    def get_schema(self) -> dict:
        return {
            "name": "syndicate_graph",
            "description": "Constructs a Criminal Syndicate Graph (Cytoscape network topology) by analyzing co-accused associations across CCTNS case records, calculating degree centrality, and identifying the criminal kingpin.",
            "parameters": {
                "type": "object",
                "properties": {
                    "suspect_name": {
                        "type": "string",
                        "description": "Name or alias of the primary suspect to anchor the criminal network"
                    },
                    "crime_head_id": {
                        "type": "integer",
                        "description": "Optional CCTNS CrimeMajorHeadID filter (e.g. 17 for Property Offense/Theft, 116 for Missing Persons, 10 for Organized Crime)"
                    },
                    "limit_cases": {
                        "type": "integer",
                        "description": "Maximum cases to traverse for co-accused expansion",
                        "default": 20
                    }
                },
                "required": ["suspect_name"]
            }
        }

    def execute(self, params: dict, context: dict) -> dict:
        suspect = (params.get("suspect_name") or params.get("suspect") or "").strip()
        crime_head_id = params.get("crime_head_id")
        limit_cases = params.get("limit_cases") or 20

        if not suspect:
            return {
                "response_type": "text",
                "text_result": "⚠️ **Criminal Syndicate Graph**: Please specify a suspect name to reconstruct the network.",
                "data": {"error": "missing_suspect"}
            }

        if not catalyst_app:
            return {
                "response_type": "text",
                "text_result": "⚠️ **Criminal Syndicate Graph**: CCTNS Database offline.",
                "data": {"error": "db_offline"}
            }

        zcql_service = catalyst_app.zcql() if hasattr(catalyst_app, "zcql") else catalyst_app.zql()
        esc_suspect = escape_zcql_literal(suspect)

        # 1. Locate primary cases linked to target suspect
        case_ids: Set[int] = set()
        primary_accused_names: Set[str] = set()

        try:
            q1 = f"SELECT CaseMasterID, AccusedName FROM Accused WHERE AccusedName LIKE '*{esc_suspect}*' LIMIT {limit_cases}"
            rows1 = zcql_service.execute_query(q1)
            for r in rows1:
                acc = r.get("Accused", r)
                cid = acc.get("CaseMasterID")
                name = (acc.get("AccusedName") or "").strip()
                if cid:
                    case_ids.add(int(cid))
                if name:
                    primary_accused_names.add(name)
        except Exception as e:
            logger.warning(f"[SyndicateGraphTool] Primary accused search error: {e}")

        canonical_suspect = sorted(primary_accused_names, key=len)[0] if primary_accused_names else suspect

        if not case_ids:
            # Clean, truthful report when no records exist -- ZERO synthetic fallbacks
            return {
                "response_type": "text",
                "text_result": (
                    f"🔍 **Criminal Association Graph: {canonical_suspect}**\n\n"
                    f"• **Status**: No recorded co-accused linkages found in CCTNS for suspect '{canonical_suspect}'.\n"
                    f"• **Investigative Assessment**: The entity has no co-accused associations in registered FIRs. "
                    f"Recorded either as a lone subject or unindexed in the active co-offending registry."
                ),
                "data": {
                    "nodes": [{
                        "data": {
                            "id": canonical_suspect,
                            "label": canonical_suspect,
                            "type": "suspect",
                            "case_count": 0,
                            "degree": 0,
                            "betweenness": 0.0,
                            "community": 0
                        }
                    }],
                    "edges": [],
                    "target_suspect": canonical_suspect,
                    "kingpin": canonical_suspect,
                    "central_lead": canonical_suspect,
                    "syndicate_size": 1,
                    "edge_count": 0,
                    "community_count": 0,
                    "is_large_syndicate": False,
                    "is_mock": False
                },
                "citations": [
                    {"type": "CCTNS Accused Registry", "id": "Query-Zero", "details": "Direct CCTNS search returned 0 linked cases"}
                ]
            }

        # 2. Retrieve all co-accused across primary cases (Hop 1)
        case_map: Dict[int, List[str]] = defaultdict(list)
        case_details: Dict[int, str] = {}
        cids_str = ", ".join(str(cid) for cid in sorted(case_ids)[:50])

        try:
            q2 = f"SELECT AccusedName, CaseMasterID FROM Accused WHERE CaseMasterID IN ({cids_str}) LIMIT 300"
            rows2 = zcql_service.execute_query(q2)
            for r in rows2:
                acc = r.get("Accused", r)
                cid = int(acc.get("CaseMasterID"))
                aname = (acc.get("AccusedName") or "").strip()
                if aname and aname not in case_map[cid]:
                    case_map[cid].append(aname)
        except Exception as e:
            logger.warning(f"[SyndicateGraphTool] Co-accused retrieval error: {e}")

        # Optional Hop 2: For key co-accused, expand to other shared cases
        hop1_associates = {name for names in case_map.values() for name in names if name != canonical_suspect}
        if hop1_associates and len(hop1_associates) < 15:
            sample_associates = list(hop1_associates)[:5]
            for assoc in sample_associates:
                esc_assoc = escape_zcql_literal(assoc)
                try:
                    q_hop2 = f"SELECT CaseMasterID FROM Accused WHERE AccusedName LIKE '*{esc_assoc}*' LIMIT 5"
                    rows_h2 = zcql_service.execute_query(q_hop2)
                    for r in rows_h2:
                        acc = r.get("Accused", r)
                        cid_h2 = acc.get("CaseMasterID")
                        if cid_h2 and int(cid_h2) not in case_map:
                            cid_int = int(cid_h2)
                            case_ids.add(cid_int)
                            case_map[cid_int].append(assoc)
                except Exception:
                    pass

        # Fetch case numbers for edge labels
        try:
            all_cids_str = ", ".join(str(cid) for cid in sorted(case_map.keys())[:60])
            if all_cids_str:
                q_cases = f"SELECT CaseMasterID, CrimeNo FROM CaseMaster WHERE CaseMasterID IN ({all_cids_str}) LIMIT 60"
                rows_cm = zcql_service.execute_query(q_cases)
                for r in rows_cm:
                    cm = r.get("CaseMaster", r)
                    cid = int(cm.get("CaseMasterID"))
                    cno = cm.get("CrimeNo") or f"CR-{cid}"
                    case_details[cid] = cno
        except Exception as e:
            logger.warning(f"[SyndicateGraphTool] CaseMaster details error: {e}")

        # 3. Construct Graph with NetworkX (or resilient pure-Python fallback)
        try:
            import networkx as nx
            G = nx.Graph()
            has_nx = True
        except ImportError:
            nx = None
            G = None
            has_nx = False
        nodes_dict: Dict[str, dict] = {}
        edges_list: List[dict] = []
        edge_set: Set[str] = set()

        for cid, suspects_in_case in case_map.items():
            case_no = case_details.get(cid, f"CR-{cid}")
            for s in suspects_in_case:
                if s not in nodes_dict:
                    nodes_dict[s] = {
                        "data": {
                            "id": s,
                            "label": s,
                            "type": "suspect" if s == canonical_suspect else "person",
                            "case_count": 0,
                            "degree": 0,
                            "betweenness": 0.0,
                            "community": 0
                        }
                    }
                    if has_nx and G is not None:
                        G.add_node(s)
                nodes_dict[s]["data"]["case_count"] += 1

            # Build pairwise co-accused edges within the case
            for i in range(len(suspects_in_case)):
                for j in range(i + 1, len(suspects_in_case)):
                    u = suspects_in_case[i]
                    v = suspects_in_case[j]
                    pair_key = tuple(sorted([u, v])) + (cid,)
                    if pair_key not in edge_set:
                        edge_set.add(pair_key)
                        edges_list.append({
                            "data": {
                                "id": f"{pair_key[0]}--{pair_key[1]}--{cid}",
                                "source": pair_key[0],
                                "target": pair_key[1],
                                "label": "co-accused",
                                "case": case_no,
                                "weight": 1
                            }
                        })
                        if has_nx and G is not None:
                            if G.has_edge(u, v):
                                G[u][v]["weight"] = G[u][v].get("weight", 1) + 1
                            else:
                                G.add_edge(u, v, weight=1)

        # 4. Compute Network Metrics: Degree, Betweenness Centrality, and Communities
        if has_nx and G is not None:
            betweenness = nx.betweenness_centrality(G) if len(G) > 2 else {n: 0.0 for n in G.nodes()}
            degrees = dict(G.degree())
            try:
                from networkx.algorithms.community import greedy_modularity_communities
                communities = list(greedy_modularity_communities(G)) if len(G.edges()) > 1 else []
            except Exception:
                communities = []
        else:
            betweenness = {n: 0.0 for n in nodes_dict}
            degrees = {n: 0 for n in nodes_dict}
            for e in edges_list:
                src, tgt = e["data"]["source"], e["data"]["target"]
                degrees[src] = degrees.get(src, 0) + 1
                degrees[tgt] = degrees.get(tgt, 0) + 1
            communities = []

        node_community_map = {}
        for comm_id, comm_nodes in enumerate(communities):
            for node in comm_nodes:
                node_community_map[node] = comm_id + 1

        # Populate metrics back to Cytoscape node payloads
        top_betweenness_lead = canonical_suspect
        max_bw = -1.0
        max_deg = 0
        central_lead = canonical_suspect

        for node_id, node_obj in nodes_dict.items():
            bw = round(float(betweenness.get(node_id, 0.0)), 4)
            deg = int(degrees.get(node_id, 0))
            comm = int(node_community_map.get(node_id, 0))

            node_obj["data"]["betweenness"] = bw
            node_obj["data"]["degree"] = deg
            node_obj["data"]["community"] = comm

            if bw > max_bw:
                max_bw = bw
                top_betweenness_lead = node_id

            if deg > max_deg:
                max_deg = deg
                central_lead = node_id

        # Flag structural bridges and centrality leads (replaces crude "kingpin")
        if central_lead in nodes_dict:
            nodes_dict[central_lead]["data"]["is_central_hub"] = True
            nodes_dict[central_lead]["data"]["type"] = "central_hub"
            nodes_dict[central_lead]["data"]["is_kingpin"] = True  # Backward compatibility for UI

        if top_betweenness_lead in nodes_dict and top_betweenness_lead != central_lead and max_bw > 0.15:
            nodes_dict[top_betweenness_lead]["data"]["is_broker"] = True
            nodes_dict[top_betweenness_lead]["data"]["type"] = "network_bridge"

        nodes = list(nodes_dict.values())
        edges = edges_list

        # 5. Format Investigative Intelligence Summary
        is_large_syndicate = len(nodes) > 5
        num_communities = len(communities) if communities else (1 if nodes else 0)

        text_result = (
            f"🕸️ **Criminal Association Network: {canonical_suspect}**\n\n"
            f"• **Network Topology**: {len(nodes)} identified entities, {len(edges)} co-accused linkages across {len(case_map)} case records.\n"
            f"• **Centrality Lead**: **{central_lead}** (Degree: {max_deg} direct linkages)\n"
            f"• **Structural Network Bridge**: **{top_betweenness_lead}** (Betweenness Score: {max_bw:.3f})\n"
            f"• **Syndicate Sub-Clusters**: {num_communities} distinct community modules detected.\n"
            f"• **Investigative Note**: Connections reflect documented co-accused FIR associations under CCTNS §63 BSA evidentiary provenance."
        )

        return {
            "response_type": "network",
            "text_result": text_result,
            "data": {
                "nodes": nodes,
                "edges": edges,
                "target_suspect": canonical_suspect,
                "kingpin": central_lead,
                "central_lead": central_lead,
                "network_bridge": top_betweenness_lead,
                "syndicate_size": len(nodes),
                "edge_count": len(edges),
                "community_count": num_communities,
                "is_large_syndicate": is_large_syndicate,
                "is_mock": False,
                "trigger_mascot_alert": True,
                "mascot_state": "SUCCESS" if is_large_syndicate else "NAVIGATION",
                "mascot_anchor": "ANCHOR_GRAPH"
            },
            "citations": [
                {"type": "CCTNS Accused Registry", "id": f"Cases-{len(case_map)}", "details": f"{len(nodes)} linked entities across {len(case_map)} verified FIRs"}
            ]
        }

# Register with ToolManager
ToolManager.register("syndicate_graph", SyndicateGraphTool())
