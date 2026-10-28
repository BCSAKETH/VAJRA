"""
KSP VAJRA 3.0 — Master End-to-End ML Pipeline Orchestrator
===========================================================
Executes the complete pipeline:
  Stage 1: High-Throughput Streaming Keyset ETL from Zoho Catalyst Data Store
  Stage 2: Spatial Density Pre-Index Compilation & Vectorization
  Stage 3: Sentence-BERT Modus Operandi Semantic Embeddings Indexing
  Stage 4: LightGBM Spatiotemporal Incident Forecaster & Road-Network TSP
  Stage 5: Comprehensive 5-Capability Automated Verification & Deployment Gate Validation
"""

import os
import sys
import time
import subprocess
import logging

_backend_dir = os.path.dirname(os.path.abspath(__file__))
if _backend_dir not in sys.path:
    sys.path.insert(0, _backend_dir)

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("vajra.master_pipeline")


def run_pipeline(target_records=None, chunk_size=10000):
    start_time = time.time()
    print("=" * 85)
    print("      KSP VAJRA 3.0 — MASTER MACHINE LEARNING RETRAINING & DEPLOYMENT SUITE")
    print("=" * 85)

    # ---------------------------------------------------------------------
    # STAGE 1: Streaming Keyset ETL
    # ---------------------------------------------------------------------
    print("\n" + "=" * 85)
    print(">>> STAGE 1: HIGH-THROUGHPUT STREAMING KEYSET ETL & SPATIAL CACHE UPGRADE")
    print("=" * 85)
    from extract_cctns_parquet import stream_extraction
    t0 = time.time()
    stream_extraction(target_records=target_records, chunk_size=chunk_size)
    print(f"\n[OK] Stage 1 Completed in {time.time() - t0:.2f}s.")

    # ---------------------------------------------------------------------
    # STAGE 2: Spatial Index Refresh & Verification
    # ---------------------------------------------------------------------
    print("\n" + "=" * 85)
    print(">>> STAGE 2: SPATIAL PRE-INDEX ENGINE VERIFICATION")
    print("=" * 85)
    from spatial_preindex import get_spatial_engine
    t0 = time.time()
    engine = get_spatial_engine()
    engine.load_cache()
    pts = engine.total_records
    print(f"[OK] Spatial pre-index verified: {pts:,} geocoded incidents in RAM (loaded in {(time.time() - t0)*1000:.2f}ms).")

    # ---------------------------------------------------------------------
    # STAGE 3: Modus Operandi (MO) Semantic Vector Indexing
    # ---------------------------------------------------------------------
    print("\n" + "=" * 85)
    print(">>> STAGE 3: MODUS OPERANDI SEMANTIC EMBEDDINGS (Sentence-BERT 384-d)")
    print("=" * 85)
    from mo_semantic_engine import build_mo_semantic_index, find_similar_cases
    t0 = time.time()
    build_mo_semantic_index(max_cases=50000)
    test_res = find_similar_cases("two riders on motorcycle snatched gold chain at weapon point", top_k=2)
    print(f"[OK] MO Semantic Index verified in {time.time() - t0:.2f}s. Test query returned {len(test_res)} matches:")
    for r in test_res:
        print(f"     • FIR {r['crime_no']} | Score: {r['similarity_score']}% | Keywords: {r.get('shared_behavioral_tokens')}")

    # ---------------------------------------------------------------------
    # STAGE 4: LightGBM Spatiotemporal Incident Forecaster & Road Patrol
    # ---------------------------------------------------------------------
    print("\n" + "=" * 85)
    print(">>> STAGE 4: LIGHTGBM WORKLOAD FORECASTER & ROAD-NETWORK BEAT PATROL")
    print("=" * 85)
    from train_spatiotemporal_forecaster import evaluate_and_train
    t0 = time.time()
    evaluate_and_train()
    print(f"[OK] Forecaster trained & evaluated in {time.time() - t0:.2f}s.")

    from patrol_optimizer import PatrolRouteOptimizer
    test_patrol = PatrolRouteOptimizer.generate_patrol_plan(unit_id=17, station_name="Kalaburagi PS", max_stops=5)
    print(f"[OK] Road Patrol TSP verified: {test_patrol.get('total_corridor_distance_km')} km in {test_patrol.get('total_beat_duration_min')} min (4h Feasible: {test_patrol.get('fits_4h_shift_budget')}).")

    # ---------------------------------------------------------------------
    # STAGE 5: End-to-End Capabilities Verification
    # ---------------------------------------------------------------------
    print("\n" + "=" * 85)
    print(">>> STAGE 5: END-TO-END CAPABILITIES VERIFICATION (6/6 SUITES)")
    print("=" * 85)
    test_script = os.path.join(_backend_dir, "test_ml_capabilities.py")
    ret = subprocess.call([sys.executable, test_script])
    if ret != 0:
        print("[!] Verification suite failed. Please check logs.")
        sys.exit(ret)

    total_pipeline_time = time.time() - start_time
    print("\n" + "=" * 85)
    print(f"[SUCCESS] ALL ML RETRAINING & DEPLOYMENT STAGES COMPLETED IN {total_pipeline_time:.2f}s.")
    print("=" * 85)


if __name__ == "__main__":
    # Support target records argument or stream full database
    arg = sys.argv[1].lower() if len(sys.argv) > 1 else "50000"
    target = None if arg in ("all", "-1", "full") else int(arg)
    run_pipeline(target_records=target, chunk_size=10000)
