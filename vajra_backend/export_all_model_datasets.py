"""
KSP VAJRA 3.0 — Comprehensive ML Training Datasets Exporter
===========================================================
Generates clean, standardized, production-ready training datasets
for all 5 non-negotiable criminological machine learning capabilities:

  1. dataset_1_spatial_patterns.csv        -> Capability 1: Crime Pattern Discovery (Clustering)
  2. dataset_2_criminal_network.csv         -> Capability 2: Criminal Network Analysis (Graph / Link Prediction)
  3. dataset_3_mo_semantic_nlp.csv          -> Capability 3: Modus Operandi Semantic NLP (Text Classification)
  4. dataset_4_incident_forecasting.csv     -> Capability 4: Spatiotemporal Incident Forecaster (Regression)
  5. dataset_5_district_socio_demographics.csv -> Capability 5: Socio-Demographic Intelligence
  5b. dataset_5b_victimology_demographics.csv  -> Capability 5: Victimology Profiles

Exports to: vajra_backend/data/quickml_export/
"""

import os
import sys
import glob
import json
import logging
from datetime import datetime
import numpy as np
import pandas as pd

_backend_dir = os.path.dirname(os.path.abspath(__file__))
if _backend_dir not in sys.path:
    sys.path.insert(0, _backend_dir)

from vajra_core import catalyst_app
from socio_demographic_engine import KARNATAKA_DISTRICT_POPULATION

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("vajra.dataset_exporter")

DATA_DIR = os.path.join(_backend_dir, "data")
PARQUET_DIR = os.path.join(DATA_DIR, "parquet")
EXPORT_DIR = os.path.join(DATA_DIR, "quickml_export")
os.makedirs(EXPORT_DIR, exist_ok=True)


def load_all_parquet() -> pd.DataFrame:
    pfiles = sorted(glob.glob(os.path.join(PARQUET_DIR, "*.parquet")))
    if not pfiles:
        raise FileNotFoundError("No parquet partitions found.")
    dfs = [pd.read_parquet(f) for f in pfiles]
    df = pd.concat(dfs, ignore_index=True)
    logger.info(f"Loaded {len(df):,} total CCTNS records from {len(pfiles)} parquet partitions.")
    return df


def export_dataset_1_spatial(df_cases: pd.DataFrame):
    """Capability 1: Spatial Pattern Discovery (Clustering)"""
    logger.info("Compiling Dataset 1: Crime Pattern Discovery (Spatial Clustering)...")
    cache_path = os.path.join(DATA_DIR, "ksp_spatial_cache.npz")
    
    if os.path.exists(cache_path):
        sp = np.load(cache_path, allow_pickle=True)
        coords = sp["coords"]
        crimes = sp["crime_nos"] if "crime_nos" in sp else [f"CR-{i}" for i in range(len(coords))]
        heads = sp["head_ids"] if "head_ids" in sp else np.zeros(len(coords), dtype=int)
        units = sp["unit_ids"] if "unit_ids" in sp else np.zeros(len(coords), dtype=int)
        dists = sp["district_ids"] if "district_ids" in sp else np.zeros(len(coords), dtype=int)
        timestamps = sp["timestamps"] if "timestamps" in sp else np.zeros(len(coords), dtype=int)
        hours = sp["hours"] if "hours" in sp else np.zeros(len(coords), dtype=int)
        dows = sp["dows"] if "dows" in sp else np.zeros(len(coords), dtype=int)

        df_out = pd.DataFrame({
            "CrimeNo": crimes,
            "latitude": coords[:, 0],
            "longitude": coords[:, 1],
            "PoliceStationID": units,
            "DistrictID": dists,
            "CrimeMajorHeadID": heads,
            "RegisteredTimestamp": timestamps,
            "HourOfDay": hours,
            "DayOfWeek": dows,
            "PrecisionFlag": ["High Precision GPS" if (round(float(c[0]), 4) != round(float(c[0]), 2)) else "Station Centroid" for c in coords]
        })
    else:
        # Fallback to parquet
        geocoded = df_cases[df_cases["latitude"].notna() & df_cases["longitude"].notna()].copy()
        df_out = geocoded[["CrimeNo", "latitude", "longitude", "PoliceStationID", "CrimeMajorHeadID", "CrimeRegisteredDate"]].copy()

    out_file = os.path.join(EXPORT_DIR, "dataset_1_spatial_patterns.csv")
    df_out.to_csv(out_file, index=False)
    logger.info(f"[OK] Exported Dataset 1: {out_file} ({len(df_out):,} rows, {os.path.getsize(out_file)/(1024*1024):.2f} MB)")


def export_dataset_2_network(df_cases: pd.DataFrame):
    """Capability 2: Criminal Network Analysis (Bipartite Co-Accused Graph)"""
    logger.info("Compiling Dataset 2: Criminal Syndicate & Co-Accused Graph...")
    zql = catalyst_app.zql()
    accused_rows = []
    last_rowid = None
    
    # Keyset fetch all Accused rows
    for _ in range(50):  # up to 15,000 accused records
        where = f"WHERE ROWID > '{last_rowid}' " if last_rowid else ""
        res = zql.execute_query(f"SELECT ROWID, AccusedMasterID, AccusedName, CaseMasterID, AgeYear, GenderID FROM Accused {where}ORDER BY ROWID ASC LIMIT 300")
        if not res:
            break
        for r in res:
            acc = r.get("Accused", r)
            rid = acc.get("ROWID")
            if rid:
                last_rowid = str(rid)
                accused_rows.append(acc)
        if len(res) < 300:
            break

    df_acc = pd.DataFrame(accused_rows)
    logger.info(f"Fetched {len(df_acc):,} Accused records from Catalyst Data Store.")

    # Join with case attributes
    df_cases_sub = df_cases[["CaseMasterID", "CrimeNo", "CrimeMajorHeadID", "GravityOffenceID", "PoliceStationID"]].drop_duplicates(subset=["CaseMasterID"]).copy()
    df_acc["CaseMasterID"] = df_acc["CaseMasterID"].astype(str)
    df_cases_sub["CaseMasterID"] = df_cases_sub["CaseMasterID"].astype(str)

    merged = pd.merge(df_acc, df_cases_sub, on="CaseMasterID", how="left")
    
    # Calculate Co-Accused count per case
    case_counts = merged.groupby("CaseMasterID")["AccusedName"].transform("count")
    merged["CoAccusedCount"] = case_counts

    out_file = os.path.join(EXPORT_DIR, "dataset_2_criminal_network.csv")
    merged.to_csv(out_file, index=False)
    logger.info(f"[OK] Exported Dataset 2: {out_file} ({len(merged):,} rows, {os.path.getsize(out_file)/(1024*1024):.2f} MB)")


def export_dataset_3_mo_nlp(df_cases: pd.DataFrame):
    """Capability 3: Modus Operandi Semantic NLP (Text Classification / Intent)"""
    logger.info("Compiling Dataset 3: Modus Operandi Semantic NLP Dataset...")
    valid_text = df_cases[df_cases["BriefFacts"].fillna("").str.len() > 10].copy()
    
    df_out = valid_text[[
        "CaseMasterID", "CrimeNo", "BriefFacts", "CrimeMajorHeadID",
        "GravityOffenceID", "PoliceStationID", "CrimeRegisteredDate"
    ]].copy()

    # Add Day of week
    df_out["DayOfWeek"] = pd.to_datetime(df_out["CrimeRegisteredDate"].astype(str).str.slice(0, 10), errors="coerce").dt.dayofweek.fillna(0).astype(int)

    out_file = os.path.join(EXPORT_DIR, "dataset_3_mo_semantic_nlp.csv")
    df_out.to_csv(out_file, index=False)
    logger.info(f"[OK] Exported Dataset 3: {out_file} ({len(df_out):,} rows, {os.path.getsize(out_file)/(1024*1024):.2f} MB)")


def export_dataset_4_forecasting():
    """Capability 4: Spatiotemporal Incident Forecaster (Regression)"""
    logger.info("Compiling Dataset 4: Spatiotemporal Forecaster Dataset...")
    src_csv = os.path.join(DATA_DIR, "quickml_forecaster_dataset.csv")
    out_file = os.path.join(EXPORT_DIR, "dataset_4_incident_forecasting.csv")
    
    if os.path.exists(src_csv):
        df_fc = pd.read_csv(src_csv)
    else:
        from train_spatiotemporal_forecaster import load_parquet_cases, build_station_daily_panel
        df_cases = load_parquet_cases()
        df_fc = build_station_daily_panel(df_cases)

    df_fc.to_csv(out_file, index=False)
    logger.info(f"[OK] Exported Dataset 4: {out_file} ({len(df_fc):,} rows, {os.path.getsize(out_file)/(1024*1024):.2f} MB)")


def export_dataset_5_socio_demographics(df_cases: pd.DataFrame):
    """Capability 5: Socio-Demographics & Victimology"""
    logger.info("Compiling Dataset 5: Socio-Demographic Intelligence & Victimology...")
    from socio_demographic_engine import SocioDemographicEngine
    
    # 5A. District Socioeconomic Profiles
    analytics = SocioDemographicEngine.get_district_socioeconomic_analytics()
    rankings = analytics.get("district_rankings", [])
    
    rows_socio = []
    for r in rankings:
        soc = r["socioeconomic_indicators"]
        rows_socio.append({
            "DistrictID": r["district_id"],
            "DistrictName": r["district_name"],
            "CensusPopulation": r["census_population"],
            "RecordedCasesSample": r["recorded_cases_sample"],
            "CrimeRatePer100k": r["crime_rate_per_100k"],
            "HasSocioProfile": soc["has_profile"],
            "LiteracyRate": soc["literacy_rate"],
            "UnemploymentRate": soc["unemployment_rate"],
            "UrbanizationIndex": soc["urbanization_index"],
            "EconomicStressIndex": soc["economic_stress_index"]
        })
    df_socio = pd.DataFrame(rows_socio)
    out_file_5a = os.path.join(EXPORT_DIR, "dataset_5_district_socio_demographics.csv")
    df_socio.to_csv(out_file_5a, index=False)
    logger.info(f"[OK] Exported Dataset 5A: {out_file_5a} ({len(df_socio)} districts)")

    # 5B. Victimology Demographics
    zql = catalyst_app.zql()
    victim_rows = []
    last_rowid = None
    for _ in range(30):  # up to 9,000 victim records
        where = f"WHERE ROWID > '{last_rowid}' " if last_rowid else ""
        res = zql.execute_query(f"SELECT ROWID, VictimMasterID, CaseMasterID, AgeYear, GenderID, VictimPolice FROM Victim {where}ORDER BY ROWID ASC LIMIT 300")
        if not res:
            break
        for r in res:
            v = r.get("Victim", r)
            rid = v.get("ROWID")
            if rid:
                last_rowid = str(rid)
                victim_rows.append(v)
        if len(res) < 300:
            break

    df_vic = pd.DataFrame(victim_rows)
    out_file_5b = os.path.join(EXPORT_DIR, "dataset_5b_victimology_demographics.csv")
    df_vic.to_csv(out_file_5b, index=False)
    logger.info(f"[OK] Exported Dataset 5B: {out_file_5b} ({len(df_vic):,} rows, {os.path.getsize(out_file_5b)/(1024*1024):.2f} MB)")


def main():
    print("=" * 80)
    print("KSP VAJRA 3.0 — EXPORTING COMPLETE TRAINING DATASETS FOR ALL 5 ML MODELS")
    print("=" * 80)
    df_cases = load_all_parquet()
    export_dataset_1_spatial(df_cases)
    export_dataset_2_network(df_cases)
    export_dataset_3_mo_nlp(df_cases)
    export_dataset_4_forecasting()
    export_dataset_5_socio_demographics(df_cases)
    print("\n" + "=" * 80)
    print(f"[COMPLETED] ALL 5 ML DATASETS SUCCESSFULLY EXPORTED TO:\n{EXPORT_DIR}")
    print("=" * 80)


if __name__ == "__main__":
    main()
