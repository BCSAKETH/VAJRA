"""
KSP VAJRA 3.0: Statewide 529k Spatial Pre-Index Extraction Pipeline
===================================================================
Fetches all 529,118 geocoded FIR coordinates from Zoho Catalyst Data Store
(CaseMaster table) using high-throughput multi-threaded ZCQL pagination.
Compiles contiguous, vectorized NumPy arrays and compresses into
`ksp_spatial_cache.npz` for Stratus upload.
"""

import os
import sys
import time
import logging
from datetime import datetime
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import List, Dict, Any, Tuple
import numpy as np

# Ensure vajra_backend is on path
_base_dir = os.path.dirname(os.path.abspath(__file__))
if _base_dir not in sys.path:
    sys.path.insert(0, _base_dir)

from vajra_core import catalyst_app

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("spatial_extractor")

PAGE_SIZE = 300
MAX_WORKERS = 15
TOTAL_EXPECTED = 529118
OUTPUT_CACHE_PATH = os.path.join(_base_dir, "data", "ksp_spatial_cache.npz")
BACKUP_PATH = os.path.join(os.path.dirname(_base_dir), "ksp_spatial_cache_529k.npz")


def determine_district_id(lat: float, lng: float) -> int:
    """Fast coordinate-based district assignment for Karnataka geography."""
    if 12.8 <= lat <= 13.2 and 77.4 <= lng <= 77.8:
        return 1  # Bengaluru City
    elif 11.7 <= lat <= 12.8 and 75.8 <= lng <= 77.2:
        return 22  # Mysuru
    elif 15.2 <= lat <= 16.9 and 74.0 <= lng <= 75.5:
        return 3   # Belagavi
    elif 14.8 <= lat <= 15.9 and 76.4 <= lng <= 77.3:
        return 2   # Ballari
    elif 16.8 <= lat <= 17.8 and 76.4 <= lng <= 77.5:
        return 17  # Kalaburagi
    elif 15.1 <= lat <= 15.6 and 74.8 <= lng <= 75.4:
        return 13  # Dharwad / Hubballi
    elif 12.7 <= lat <= 13.2 and 74.7 <= lng <= 75.2:
        return 11  # Dakshina Kannada (Mangaluru)
    else:
        return 1   # Default State Command


def fetch_page(offset: int) -> Tuple[int, List[Dict[str, Any]]]:
    """Fetch a single page of 300 rows with retry."""
    query = (
        f"SELECT ROWID, CaseMasterID, CrimeNo, latitude, longitude, "
        f"PoliceStationID, CrimeMajorHeadID, CrimeRegisteredDate "
        f"FROM CaseMaster WHERE latitude IS NOT NULL LIMIT {offset}, {PAGE_SIZE}"
    )
    for attempt in range(4):
        try:
            zcql = catalyst_app.zcql()
            rows = zcql.execute_query(query)
            clean_rows = [r.get("CaseMaster", r) for r in (rows or [])]
            return offset, clean_rows
        except Exception as e:
            if attempt < 3:
                time.sleep(0.5 * (attempt + 1))
            else:
                logger.warning(f"Offset {offset} failed after 4 retries: {e}")
                return offset, []


def run_extraction():
    logger.info("=" * 70)
    logger.info(f"STARTING COMPILATION OF ALL {TOTAL_EXPECTED:,} GEOCODED FIR RECORDS")
    logger.info(f"Workers: {MAX_WORKERS} threads | Batch Size: {PAGE_SIZE} rows/query")
    logger.info("=" * 70)

    t0 = time.time()
    offsets = list(range(0, TOTAL_EXPECTED + PAGE_SIZE, PAGE_SIZE))
    total_pages = len(offsets)
    logger.info(f"Generated {total_pages} query pages across {TOTAL_EXPECTED:,} rows.")

    page_results: Dict[int, List[Dict[str, Any]]] = {}
    completed_pages = 0

    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
        futures = {executor.submit(fetch_page, off): off for off in offsets}
        for fut in as_completed(futures):
            off, rows = fut.result()
            page_results[off] = rows
            completed_pages += 1
            if completed_pages % 150 == 0 or completed_pages == total_pages:
                pct = (completed_pages / total_pages) * 100
                elapsed = time.time() - t0
                speed = (completed_pages * PAGE_SIZE) / elapsed if elapsed > 0 else 0
                logger.info(f"Progress: {completed_pages}/{total_pages} pages ({pct:.1f}%) | "
                            f"{speed:.0f} rows/sec | Elapsed: {elapsed:.1f}s")

    logger.info("Extraction complete. Processing and vectorizing all records...")
    
    # Process in correct chronological order
    coords_list = []
    timestamps_list = []
    hours_list = []
    dows_list = []
    head_ids_list = []
    unit_ids_list = []
    district_ids_list = []
    crime_nos_list = []

    for off in sorted(page_results.keys()):
        for r in page_results[off]:
            lat = r.get("latitude")
            lng = r.get("longitude")
            if lat is None or lng is None:
                continue
            try:
                flat, flng = float(lat), float(lng)
                if not (11.0 <= flat <= 19.0 and 73.5 <= flng <= 79.0):
                    continue
            except (ValueError, TypeError):
                continue

            # Parse date
            raw_date = r.get("CrimeRegisteredDate") or ""
            dt = None
            if raw_date:
                for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%d", "%Y-%m-%dT%H:%M:%S"):
                    try:
                        dt = datetime.strptime(str(raw_date)[:19], fmt)
                        break
                    except ValueError:
                        continue
            if not dt:
                dt = datetime(2025, 1, 1)

            try:
                head_id = int(r.get("CrimeMajorHeadID") or -1)
            except (ValueError, TypeError):
                head_id = -1

            try:
                unit_id = int(r.get("PoliceStationID") or -1)
            except (ValueError, TypeError):
                unit_id = -1

            d_id = determine_district_id(flat, flng)
            crime_no = str(r.get("CrimeNo") or "")

            coords_list.append([flat, flng])
            timestamps_list.append(int(dt.timestamp()))
            hours_list.append(dt.hour)
            dows_list.append(dt.weekday())
            head_ids_list.append(head_id)
            unit_ids_list.append(unit_id)
            district_ids_list.append(d_id)
            crime_nos_list.append(crime_no)

    total_valid = len(coords_list)
    logger.info(f"Successfully validated {total_valid:,} geocoded incident coordinates.")

    coords_arr = np.array(coords_list, dtype=np.float32)
    timestamps_arr = np.array(timestamps_list, dtype=np.int64)
    hours_arr = np.array(hours_list, dtype=np.int8)
    dows_arr = np.array(dows_list, dtype=np.int8)
    head_ids_arr = np.array(head_ids_list, dtype=np.int16)
    unit_ids_arr = np.array(unit_ids_list, dtype=np.int16)
    district_ids_arr = np.array(district_ids_list, dtype=np.int16)
    crime_nos_arr = np.array(crime_nos_list, dtype=object)

    logger.info("Compressing into .npz archive...")
    os.makedirs(os.path.dirname(OUTPUT_CACHE_PATH), exist_ok=True)
    np.savez_compressed(
        OUTPUT_CACHE_PATH,
        coords=coords_arr,
        timestamps=timestamps_arr,
        hours=hours_arr,
        dows=dows_arr,
        head_ids=head_ids_arr,
        unit_ids=unit_ids_arr,
        district_ids=district_ids_arr,
        crime_nos=crime_nos_arr
    )

    # Save identical copy to project root for easy user download
    np.savez_compressed(
        BACKUP_PATH,
        coords=coords_arr,
        timestamps=timestamps_arr,
        hours=hours_arr,
        dows=dows_arr,
        head_ids=head_ids_arr,
        unit_ids=unit_ids_arr,
        district_ids=district_ids_arr,
        crime_nos=crime_nos_arr
    )

    file_size_bytes = os.path.getsize(OUTPUT_CACHE_PATH)
    file_size_mb = file_size_bytes / (1024 * 1024)
    total_time = time.time() - t0

    logger.info("=" * 70)
    logger.info("✅ SUCCESS! 529K SPATIAL PRE-INDEX COMPILED!")
    logger.info(f"Total Geocoded Incidents: {total_valid:,}")
    logger.info(f"Compressed File Size: {file_size_mb:.2f} MB ({file_size_bytes:,} bytes)")
    logger.info(f"Primary Output Path: {OUTPUT_CACHE_PATH}")
    logger.info(f"Root Convenience Path: {BACKUP_PATH}")
    logger.info(f"Total Compilation Time: {total_time:.1f} seconds ({total_time/60:.2f} minutes)")
    logger.info("=" * 70)


if __name__ == "__main__":
    run_extraction()
