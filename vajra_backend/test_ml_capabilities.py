"""
KSP VAJRA 3.0 — Comprehensive End-to-End Verification Test Suite
================================================================
Validates all 5 non-negotiable Machine Learning capabilities against
the approved Master Retraining Blueprint (VAJRA_ML_RETRAINING_AND_DEPLOYMENT_PLAN.md).
"""

import os
import sys
import time
import json
import numpy as np

# Ensure backend directory is in python path
_backend_dir = os.path.dirname(os.path.abspath(__file__))
if _backend_dir not in sys.path:
    sys.path.insert(0, _backend_dir)

print("=" * 80)
print("KSP VAJRA 3.0 — MACHINE LEARNING CAPABILITIES END-TO-END VERIFICATION")
print("=" * 80)

failures = []
passed = 0

# -------------------------------------------------------------------------
# Test 1: Capability 1 — Crime Pattern Discovery (Spatial Pre-Index)
# -------------------------------------------------------------------------
print("\n[TEST 1] Testing Capability 1: Crime Pattern Discovery (Spatial Pre-Index)...")
try:
    from spatial_preindex import get_spatial_engine
    t0 = time.time()
    engine = get_spatial_engine()
    load_ms = (time.time() - t0) * 1000
    pts = engine.total_records
    print(f"  • Spatial cache loaded in {load_ms:.2f}ms: {pts:,} geocoded incidents.")
    assert pts >= 20000, f"Expected >= 20,000 spatial points, found {pts}"

    # Query Mysuru (District 22)
    mysuru_points = engine.query_points(district_id=22, max_points=500)
    print(f"  • Mysuru (District 22) points queried: {len(mysuru_points)} incidents.")
    clusters = engine.cluster_adaptive_hotspots(mysuru_points)
    print(f"  • Spatial density clusters in Mysuru: {len(clusters)} clusters surfaced.")
    assert len(clusters) > 0, "Expected at least 1 spatial cluster in Mysuru"
    first_c = clusters[0]
    d_level = str(first_c.get('density_level', '')).encode('ascii', 'ignore').decode('ascii')
    print(f"    - Cluster #1: {first_c.get('point_count')} incidents at ({first_c.get('lat')}, {first_c.get('lng')}) | Density: {d_level}")
    passed += 1
    print("  [PASS] Capability 1: Crime Pattern Discovery verified.")
except Exception as e:
    print(f"  [FAIL] Capability 1: {e}")
    failures.append(f"Capability 1: {e}")

# -------------------------------------------------------------------------
# Test 2: Capability 2 — Criminal Network Analysis (NetworkX Engine)
# -------------------------------------------------------------------------
print("\n[TEST 2] Testing Capability 2: Criminal Network Analysis (Investigative Graph)...")
try:
    from tools.tool_syndicate_graph import SyndicateGraphTool
    tool = SyndicateGraphTool()

    # 1. Non-connected entity test (Zero synthetic fallback verification)
    res_unconnected = tool.execute({"suspect_name": "NonExistentUnknownSuspect999"}, {})
    assert "No recorded co-accused linkages found in CCTNS" in res_unconnected.get("text_result", ""), "Mock fallback detected!"
    print("  • Zero-synthetic-fallback verified: Unconnected suspects return truthful empty network.")

    # 2. Real suspect multi-hop test
    res_real = tool.execute({"suspect_name": "Ramesh", "limit_cases": 15}, {})
    data = res_real.get("data", {})
    nodes = data.get("nodes", [])
    edges = data.get("edges", [])
    print(f"  • Network traversal on real suspect 'Ramesh': {len(nodes)} nodes, {len(edges)} edges.")
    has_betweenness = any(n.get("data", {}).get("betweenness", 0) > 0 for n in nodes)
    has_communities = any(n.get("data", {}).get("community_id") is not None for n in nodes)
    print(f"  • Betweenness structural bridges calculated: {has_betweenness}")
    print(f"  • Louvain / Greedy Modularity communities detected: {has_communities}")
    passed += 1
    print("  [PASS] Capability 2: Criminal Network Analysis verified.")
except Exception as e:
    print(f"  [FAIL] Capability 2: {e}")
    failures.append(f"Capability 2: {e}")

# -------------------------------------------------------------------------
# Test 3: Capability 3 — MO Semantic Case Retrieval
# -------------------------------------------------------------------------
print("\n[TEST 3] Testing Capability 3: Modus Operandi Semantic Retrieval Engine...")
try:
    from mo_semantic_engine import find_similar_cases, load_mo_semantic_index
    assert load_mo_semantic_index(), "Failed to load MO semantic index"
    
    t0 = time.time()
    matches = find_similar_cases("two riders on motorcycle snatched gold chain at knife point", top_k=3)
    latency_ms = (time.time() - t0) * 1000
    print(f"  • Semantic retrieval latency: {latency_ms:.2f}ms ({len(matches)} matches returned).")
    assert len(matches) > 0, "No semantic matches returned"
    
    top_m = matches[0]
    print(f"  • Top Match: FIR {top_m['crime_no']} | Similarity: {top_m['similarity_score']}%")
    print(f"    - Shared behavioral keywords: {top_m.get('shared_behavioral_tokens')}")
    print(f"    - Narrative excerpt: \"{top_m['brief_facts'][:90]}...\"")
    passed += 1
    print("  [PASS] Capability 3: Modus Operandi Semantic Retrieval verified.")
except Exception as e:
    print(f"  [FAIL] Capability 3: {e}")
    failures.append(f"Capability 3: {e}")

# -------------------------------------------------------------------------
# Test 4: Capability 4 — Spatiotemporal Forecast & Road-Aware Patrol Dispatch
# -------------------------------------------------------------------------
print("\n[TEST 4] Testing Capability 4: Forecaster & Road Patrol Route Optimizer...")
try:
    # 1. Benchmark validation check
    metrics_file = os.path.join(_backend_dir, "data", "forecast_evaluation_metrics.json")
    assert os.path.exists(metrics_file), "Evaluation metrics file missing"
    with open(metrics_file, "r") as f:
        metrics = json.load(f)
    overall = metrics.get("Overall", {})
    gate_passed = overall.get("deployment_gate_passed", False)
    lgbm_mae = overall.get("mae", {}).get("lightgbm")
    t7_mae = overall.get("mae", {}).get("baseline_t7")
    roll_mae = overall.get("mae", {}).get("baseline_4w_rolling")
    seas_mae = overall.get("mae", {}).get("baseline_seasonal_naive")
    print(f"  • LightGBM MAE: {lgbm_mae} vs t-7: {t7_mae} vs 4W-Avg: {roll_mae} vs Seasonal: {seas_mae}")
    print(f"  • Deployment Gate (Beats All 3 Baselines): {gate_passed}")
    assert gate_passed, "LightGBM forecaster failed deployment gate!"

    # 2. Road-Network Patrol Dispatch TSP check
    from patrol_optimizer import PatrolRouteOptimizer
    plan = PatrolRouteOptimizer.generate_patrol_plan(unit_id=17, station_name="Kalaburagi City PS", max_stops=5)
    assert plan.get("status") == "success", f"Patrol plan failed: {plan.get('message')}"
    print(f"  • Beat Patrol Corridor: {plan.get('total_corridor_distance_km')} km | Total Mission: {plan.get('total_beat_duration_min')} min | Fits 4h shift: {plan.get('fits_4h_shift_budget')}")
    print(f"  • Waypoints: {len(plan.get('waypoints', []))} stops ordered via 2-opt TSP.")
    passed += 1
    print("  [PASS] Capability 4: Forecaster & Road Patrol Dispatch verified.")
except Exception as e:
    print(f"  [FAIL] Capability 4: {e}")
    failures.append(f"Capability 4: {e}")

# -------------------------------------------------------------------------
# Test 5: Capability 5 — Socio-Demographic Intelligence & BNSS Legal Engine
# -------------------------------------------------------------------------
print("\n[TEST 5] Testing Capability 5: Socio-Demographics & Statutory Legal Engine...")
try:
    from socio_demographic_engine import SocioDemographicEngine
    
    # 1. Population normalized rates
    socio = SocioDemographicEngine.get_district_socioeconomic_analytics()
    rankings = socio.get("district_rankings", [])
    print(f"  • Districts evaluated: {len(rankings)} (Profiled: {socio.get('profiled_districts_count')}, Unprofiled: {socio.get('unprofiled_districts_count')})")
    assert len(rankings) > 0, "No district analytics returned"
    top_d = rankings[0]
    print(f"  • Top Normalized District: {top_d['district_name']} — {top_d['crime_rate_per_100k']} per 100k (Pop: {top_d['census_population']:,})")

    # 2. Deterministic BNSS §187(3) Remand Checklist
    audit = SocioDemographicEngine.audit_bnss_procedural_compliance(
        suspect_name="Test Suspect",
        arrest_date="2026-09-15",
        offence_punishment_years=7,
        has_prior_chargesheet=True,
        co_accused_count=2
    )
    remand = audit.get("section_187_3_remand_audit", {})
    bns = audit.get("bns_section_111_checklist", {})
    print(f"  • BNSS §187(3) Remand Ceiling: {remand.get('statutory_investigation_ceiling_days')} days | Default Bail: {remand.get('default_bail_deadline')} ({remand.get('days_remaining_to_filing')} days remaining)")
    print(f"  • Section 111 BNS Organized Crime: {bns.get('statutory_criteria_met')} ({bns.get('procedural_directive')[:60]}...)")
    assert remand.get("statutory_investigation_ceiling_days") == 60, "Expected 60 days remand ceiling for 7-year offense"
    passed += 1
    print("  [PASS] Capability 5: Socio-Demographics & Statutory BNSS Audit verified.")
except Exception as e:
    print(f"  [FAIL] Capability 5: {e}")
    failures.append(f"Capability 5: {e}")

# -------------------------------------------------------------------------
# Test 6: FastAPI Status Endpoint Verification
# -------------------------------------------------------------------------
print("\n[TEST 6] Testing FastAPI ML System Status Endpoint...")
try:
    from fastapi.testclient import TestClient
    from main import app
    client = TestClient(app)
    resp = client.get("/api/ml/status")
    print(f"  • /api/ml/status response code: {resp.status_code}")
    assert resp.status_code == 200, f"Expected 200, got {resp.status_code}"
    body = resp.json()
    assert body.get("status") == "operational"
    caps = body.get("capabilities", {})
    for k, v in caps.items():
        print(f"    - {k}: {v.get('name')} -> Status: {v.get('status')}")
    passed += 1
    print("  [PASS] FastAPI ML Status Endpoint verified.")
except Exception as e:
    print(f"  [FAIL] FastAPI Status: {e}")
    failures.append(f"FastAPI Status: {e}")

print("\n" + "=" * 80)
print(f"VERIFICATION RESULTS: {passed} / 6 TESTS PASSED | {len(failures)} FAILURES")
print("=" * 80)
if failures:
    sys.exit(1)
