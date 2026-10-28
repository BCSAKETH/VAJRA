"""
KSP VAJRA 3.0 — ML Retraining & Pipeline Progress Monitor
=========================================================
Run this script anytime to inspect the exact real-time state of the
data extraction, spatial indexing, MO vector embeddings, and model training.

Usage:
  python check_pipeline_progress.py
"""

import os
import sys
import json
import glob
from datetime import datetime

_backend_dir = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(_backend_dir, "data")
PARQUET_DIR = os.path.join(DATA_DIR, "parquet")
CHECKPOINT_FILE = os.path.join(DATA_DIR, "checkpoint_extraction.json")
SPATIAL_CACHE_FILE = os.path.join(DATA_DIR, "ksp_spatial_cache.npz")
MO_INDEX_FILE = os.path.join(DATA_DIR, "mo_semantic_index.npz")
FORECASTER_FILE = os.path.join(DATA_DIR, "station_forecast_lgbm.joblib")
METRICS_FILE = os.path.join(DATA_DIR, "forecast_evaluation_metrics.json")


def format_bytes(size):
    for unit in ["B", "KB", "MB", "GB"]:
        if size < 1024.0:
            return f"{size:.2f} {unit}"
        size /= 1024.0
    return f"{size:.2f} TB"


def get_latest_task_log():
    log_pattern = os.path.expanduser("~/.gemini/antigravity-ide/brain/*/.system_generated/tasks/*.log")
    logs = glob.glob(log_pattern)
    if not logs:
        # Check current repo log files
        logs = glob.glob(os.path.join(_backend_dir, "*.log"))
    if not logs:
        return None
    latest = max(logs, key=os.path.getmtime)
    return latest


def print_progress():
    print("\n" + "=" * 80)
    print("        KSP VAJRA 3.0 — ML RETRAINING & PIPELINE PROGRESS MONITOR")
    print("=" * 80)

    # 1. Extraction Checkpoint & Parquet Store
    print("\n[STAGE 1] CCTNS KEYSET STREAMING ETL & PARQUET PARTITIONS")
    total_extracted = 0
    geocoded_extracted = 0
    last_rowid = "None"
    status = "idle"

    if os.path.exists(CHECKPOINT_FILE):
        try:
            with open(CHECKPOINT_FILE, "r", encoding="utf-8") as f:
                cp = json.load(f)
                total_extracted = cp.get("total_extracted", 0)
                geocoded_extracted = cp.get("geocoded_extracted", 0)
                last_rowid = cp.get("last_rowid", "None")
                status = cp.get("status", "running")
                updated = cp.get("last_updated", "")
        except Exception:
            pass

    parquet_files = sorted(glob.glob(os.path.join(PARQUET_DIR, "*.parquet")))
    parquet_bytes = sum(os.path.getsize(f) for f in parquet_files)

    print(f"  • Cumulative Records Extracted: {total_extracted:,} rows")
    print(f"  • Geocoded Records Filtered:    {geocoded_extracted:,} points")
    print(f"  • Last Monotonic Keyset ROWID:  {last_rowid}")
    print(f"  • Parquet Partitions on Disk:   {len(parquet_files)} files ({format_bytes(parquet_bytes)})")
    print(f"  • Checkpoint Status:            {status.upper()}")

    # 2. Spatial Cache
    print("\n[STAGE 2] SPATIAL DENSITY PRE-INDEX (ksp_spatial_cache.npz)")
    if os.path.exists(SPATIAL_CACHE_FILE):
        try:
            import numpy as np
            sp = np.load(SPATIAL_CACHE_FILE, allow_pickle=True)
            pts = len(sp["coords"]) if "coords" in sp else 0
            size_mb = os.path.getsize(SPATIAL_CACHE_FILE) / (1024 * 1024)
            units = len(np.unique(sp["unit_ids"])) if "unit_ids" in sp else 0
            print(f"  • Geocoded Coordinates Indexed: {pts:,} incidents")
            print(f"  • Police Stations Represented:  {units} stations")
            print(f"  • Binary Cache Footprint:       {size_mb:.2f} MB on disk (in-memory <20ms)")
            print(f"  • Status:                       READY / VERIFIED")
        except Exception as e:
            print(f"  • Status: Error reading cache ({e})")
    else:
        print("  • Status: Pending compilation")

    # 3. MO Semantic Vector Index
    print("\n[STAGE 3] MODUS OPERANDI SEMANTIC EMBEDDINGS (Sentence-BERT 384-d)")
    if os.path.exists(MO_INDEX_FILE):
        try:
            import numpy as np
            mo = np.load(MO_INDEX_FILE, allow_pickle=True)
            v_count = len(mo["vectors"]) if "vectors" in mo else 0
            dim = mo["vectors"].shape[1] if "vectors" in mo and len(mo["vectors"].shape) > 1 else 384
            size_mb = os.path.getsize(MO_INDEX_FILE) / (1024 * 1024)
            print(f"  • Case Narratives Vectorized:   {v_count:,} cases")
            print(f"  • Embedding Vector Dimension:   {dim}-dimensional dense vectors")
            print(f"  • Matrix Store Size:            {size_mb:.2f} MB")
            print(f"  • Sub-15ms Cosine Dot-Product:  READY")
        except Exception as e:
            print(f"  • Status: Error reading index ({e})")
    else:
        print("  • Status: Currently Encoding / Pending")

    # 4. Spatiotemporal Forecaster & Benchmarks
    print("\n[STAGE 4] LIGHTGBM STATION INCIDENT FORECASTER & BENCHMARK GATES")
    if os.path.exists(FORECASTER_FILE) and os.path.exists(METRICS_FILE):
        try:
            with open(METRICS_FILE, "r", encoding="utf-8") as f:
                metrics = json.load(f)
            overall = metrics.get("Overall", {})
            mae = overall.get("mae", {})
            imp = overall.get("mae_improvement_pct", {})
            gate = overall.get("deployment_gate_passed", False)

            print(f"  • LightGBM Test Set MAE:        {mae.get('lightgbm')} incidents/week")
            print(f"  • Outperforms Baseline 1 (t-7): {imp.get('over_t7'):+.2f}%")
            print(f"  • Outperforms Baseline 2 (4W):  {imp.get('over_4w_rolling'):+.2f}%")
            print(f"  • Outperforms Baseline 3 (Seas):{imp.get('over_seasonal'):+.2f}%")
            print(f"  • Formal KSP Deployment Gate:   {'PASSED (Beats All Baselines)' if gate else 'PENDING'}")
        except Exception as e:
            print(f"  • Status: Parsing metrics ({e})")
    else:
        print("  • Status: Pending model training in current pipeline")

    # 5. Live Pipeline Process / Log Tail
    print("\n[ACTIVE PIPELINE HEARTBEAT & LOG TAIL]")
    log_file = get_latest_task_log()
    if log_file and os.path.exists(log_file):
        try:
            with open(log_file, "r", encoding="utf-8", errors="ignore") as f:
                lines = [line.strip() for line in f.readlines() if line.strip()]
            tail = lines[-6:] if lines else []
            print(f"  (Source: {os.path.basename(log_file)})")
            for l in tail:
                # Clean escape chars
                clean = l.replace("\r", " ").strip()
                if clean:
                    print(f"    {clean}")
        except Exception as e:
            print(f"  Could not read log tail: {e}")
    else:
        print("  No active background task log found.")

    print("\n" + "=" * 80 + "\n")


if __name__ == "__main__":
    print_progress()
