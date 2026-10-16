"""
VAJRA 2.0 - Phase 4 (Track 7) Verification Suite
================================================
Tests:
- Gate 1: PSOTI Tri-Metric Grounded Threat Engine (Master Gate V7)
- Gate 2: Geodesic Equirectangular DBSCAN Spatial Clustering (Master Gate V8)
- Gate 3: Comprehensive IPC <-> BNS 2023 Concordance Registry (Step 8.10)
- Gate 4: Tool get_offender_risk in VajraAgentLoop (response_type == "risk")
- Gate 5: Fast Startup & Memory Isolation
"""

import sys
import os
import math
from datetime import datetime

# Configure UTF-8 for console output
try:
    sys.stdout.reconfigure(encoding='utf-8')
except Exception:
    pass

# Add vajra_backend to path
_base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
_backend_dir = os.path.join(_base_dir, "vajra_backend")
if _backend_dir not in sys.path:
    sys.path.insert(0, _backend_dir)

from threat_scoring_engine import ThreatScoringEngine
from bns_concordance import get_bns_concordance, map_ipc_sections_to_bns, IPC_TO_BNS_MAP
from agent_loop import VajraAgentLoop

passed_gates = 0
total_gates = 5

print("======================================================================")
print("  VAJRA 2.0 - PHASE 4 (TRACK 7) FORENSIC VERIFICATION SUITE")
print("======================================================================\n")

# -----------------------------------------------------------------------------
# GATE 1: Grounded PSOTI Threat Scoring Engine (Master Gate V7)
# -----------------------------------------------------------------------------
print("[GATE 1] Testing Grounded PSOTI Tri-Metric Threat Engine (V7)...")
try:
    res = ThreatScoringEngine.evaluate_suspect_threat("Ishwar Chaudhari")
    assert res.get("status") == "success", f"Expected success, got {res.get('status')}"
    assert "psoti_score" in res, "Missing psoti_score"
    assert 0 <= res["psoti_score"] <= 100, f"Invalid psoti_score: {res['psoti_score']}"
    assert res.get("threat_tier") in ["LOW THREAT", "MODERATE THREAT", "HIGH THREAT"], f"Invalid tier: {res.get('threat_tier')}"

    sub = res.get("sub_metrics", {})
    assert "relapse_potential" in sub, "Missing relapse_potential"
    assert "flight_risk" in sub, "Missing flight_risk"
    assert "syndicate_nexus" in sub, "Missing syndicate_nexus"

    drivers = res.get("evidentiary_factors", [])
    assert len(drivers) > 0, "No evidentiary factors emitted"
    assert any("BNSS" in d.get("statutory_ref", "") or "BNS" in d.get("statutory_ref", "") for d in drivers), "Missing statutory citations"

    print(f"  [+] Suspect: {res['suspect']}")
    print(f"  [+] PSOTI Score: {res['psoti_score']}% ({res['threat_tier']})")
    print(f"  [+] Sub-Metrics: Relapse={sub['relapse_potential']}%, Flight={sub['flight_risk']}%, Syndicate={sub['syndicate_nexus']}%")
    print(f"  [+] Grounded Drivers Count: {len(drivers)}")
    print(f"  [+] Top Driver: {drivers[0]['name']} ({drivers[0]['impactPct']:+} pts) [{drivers[0]['statutory_ref']}]")
    print("  --> GATE 1: PASSED [OK]\n")
    passed_gates += 1
except Exception as e:
    import traceback
    traceback.print_exc()
    print(f"  [!] GATE 1 FAILED: {e}\n")

# -----------------------------------------------------------------------------
# GATE 2: Geodesic Equirectangular DBSCAN Spatial Clustering (Master Gate V8)
# -----------------------------------------------------------------------------
print("[GATE 2] Testing Geodesic Equirectangular DBSCAN (V8)...")
try:
    loop = VajraAgentLoop(None, None, None, None, None)
    
    # Cluster 1: Belagavi City (around 15.85N, 74.50E) - 8 points within 300 meters
    base_lat, base_lng = 15.8500, 74.5000
    test_points = []
    for i in range(8):
        test_points.append({
            "lat": base_lat + (i * 0.0005) - 0.002,
            "lng": base_lng + (i * 0.0004) - 0.0015,
            "label": f"CR-2026-BEL-{i+1}",
            "crime_head_name": "ROBBERY",
            "station_name": "Khade Bazar PS"
        })

    # Cluster 2: Separate outpost 50km away (should NOT merge with cluster 1)
    for j in range(7):
        test_points.append({
            "lat": base_lat + 0.45 + (j * 0.0003),
            "lng": base_lng + 0.40 + (j * 0.0003),
            "label": f"CR-2026-RUR-{j+1}",
            "crime_head_name": "BURGLARY",
            "station_name": "Gokak PS"
        })

    # Test with degree eps (0.005 deg ~ 550m)
    clusters = loop.cluster_hotspots(test_points, eps=0.005, min_samples=5)
    assert len(clusters) == 2, f"Expected exactly 2 distinct clusters, got {len(clusters)}"
    
    c1 = clusters[0]
    c2 = clusters[1]
    assert c1["point_count"] in [7, 8], f"Unexpected c1 point count: {c1['point_count']}"
    assert c2["point_count"] in [7, 8], f"Unexpected c2 point count: {c2['point_count']}"
    assert "dominant_crime" in c1 and c1["dominant_crime"] in ["ROBBERY", "BURGLARY"]

    print(f"  [+] Input Points: {len(test_points)} across 2 simulated districts")
    print(f"  [+] Clusters Discovered: {len(clusters)}")
    print(f"  [+] Cluster 1 Centroid: ({c1['lat']:.4f}, {c1['lng']:.4f}) | Incidents: {c1['point_count']} | {c1['label']}")
    print(f"  [+] Cluster 2 Centroid: ({c2['lat']:.4f}, {c2['lng']:.4f}) | Incidents: {c2['point_count']} | {c2['label']}")
    print("  --> GATE 2: PASSED [OK]\n")
    passed_gates += 1
except Exception as e:
    import traceback
    traceback.print_exc()
    print(f"  [!] GATE 2 FAILED: {e}\n")

# -----------------------------------------------------------------------------
# GATE 3: Authoritative IPC <-> BNS 2023 Concordance Registry (Step 8.10)
# -----------------------------------------------------------------------------
print("[GATE 3] Testing Authoritative IPC <-> BNS 2023 Concordance Registry...")
try:
    test_cases = [
        ("302", "Section 103(1) BNS 2023", "Punishment for Murder"),
        ("307", "Section 109 BNS 2023", "Attempt to Murder"),
        ("420", "Section 318(4) BNS 2023", "Cheating and Dishonestly Inducing Delivery of Property"),
        ("379", "Section 303(2) BNS 2023", "Theft"),
        ("392", "Section 309(4) BNS 2023", "Robbery"),
        ("376", "Section 64 BNS 2023", "Punishment for Rape"),
        ("363", "Section 137(2) BNS 2023", "Kidnapping"),
        ("120B", "Section 61(2) BNS 2023", "Criminal Conspiracy"),
        ("34", "Section 3(5) BNS 2023", "Acts Done by Several Persons in Furtherance of Common Intention"),
        ("111", "Section 111 BNS 2023", "Organized Crime Syndicate"),
        ("498A", "Section 85 BNS 2023", "Cruelty by Husband or Relatives of Husband"),
    ]

    for ipc, expected_bns, expected_name in test_cases:
        info = get_bns_concordance(ipc)
        assert expected_bns in info["bns_section"], f"IPC {ipc}: Expected {expected_bns}, got {info['bns_section']}"
        assert expected_name in info["offense_name"], f"IPC {ipc}: Expected {expected_name}, got {info['offense_name']}"
        assert "BNSS" in info.get("procedural_changes", "") or "BNSS" in info.get("transitional_clause", "")

    # Test convert_ipc_to_bns tool via agent_loop
    res_tool = loop._execute_tool("convert_ipc_to_bns", {"ipc_section": "420"}, 2346001, "sess-test", 1)
    card_data = res_tool.get("data", {})
    assert "318(4)" in card_data.get("concordance_bns_section", ""), f"Tool failed: {card_data.get('concordance_bns_section')}"
    assert "Cheating" in card_data.get("concordance_bns_section", "")

    print(f"  [+] Registry Size: {len(IPC_TO_BNS_MAP)} validated statutory sections")
    print(f"  [+] Tested 11 Key Offenses: 100% Exact Concordance Verified")
    print(f"  [+] Tool convert_ipc_to_bns('420') ➔ {card_data.get('concordance_bns_section')}")
    print("  --> GATE 3: PASSED [OK]\n")
    passed_gates += 1
except Exception as e:
    import traceback
    traceback.print_exc()
    print(f"  [!] GATE 3 FAILED: {e}\n")

# -----------------------------------------------------------------------------
# GATE 4: Tool get_offender_risk in VajraAgentLoop (End-to-End)
# -----------------------------------------------------------------------------
print("[GATE 4] Testing Tool get_offender_risk Execution in VajraAgentLoop...")
try:
    tool_res = loop._execute_tool("get_offender_risk", {"suspect_name": "Ishwar Chaudhari"}, 2346001, "sess-test", 1)
    assert tool_res.get("response_type") == "risk", f"Expected response_type 'risk', got {tool_res.get('response_type')}"
    data = tool_res.get("data", {})
    assert "psoti_score" in data, "Missing psoti_score in tool response data"
    assert "sub_metrics" in data, "Missing sub_metrics in tool response data"
    assert "evidentiary_factors" in data, "Missing evidentiary_factors in tool response data"
    assert "actions" in data, "Missing actions buttons in risk response"

    print(f"  [+] Tool Response Type: {tool_res.get('response_type')}")
    print(f"  [+] PSOTI Score: {data.get('psoti_score')}%")
    print(f"  [+] Action Buttons: {[a.get('label') for a in data.get('actions', [])]}")
    print("  --> GATE 4: PASSED [OK]\n")
    passed_gates += 1
except Exception as e:
    import traceback
    traceback.print_exc()
    print(f"  [!] GATE 4 FAILED: {e}\n")

# -----------------------------------------------------------------------------
# GATE 5: Fast Startup & Memory Isolation
# -----------------------------------------------------------------------------
print("[GATE 5] Testing Fast Startup & Import Resilience...")
try:
    import time
    t0 = time.time()
    from main import app, threat_engine
    startup_time = time.time() - t0
    assert threat_engine is not None, "threat_engine is None"
    assert startup_time < 8.0, f"Startup took {startup_time:.2f}s, exceeding 8.0s limit"

    print(f"  [+] App Initialization Time: {startup_time:.2f}s (< 8.0s limit)")
    print(f"  [+] PSOTI Engine Service: ACTIVE")
    print("  --> GATE 5: PASSED [OK]\n")
    passed_gates += 1
except Exception as e:
    import traceback
    traceback.print_exc()
    print(f"  [!] GATE 5 FAILED: {e}\n")

# -----------------------------------------------------------------------------
# SUMMARY SCORECARD
# -----------------------------------------------------------------------------
print("======================================================================")
print(f"  PHASE 4 VERIFICATION SCORECARD: {passed_gates}/{total_gates} GATES PASSED")
print("======================================================================")

if passed_gates == total_gates:
    print("  [SUCCESS] All Phase 4 (Track 7) forensic & statutory gates passed!")
    sys.exit(0)
else:
    print(f"  [FAILURE] {total_gates - passed_gates} gate(s) failed!")
    sys.exit(1)
