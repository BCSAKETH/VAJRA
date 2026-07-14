"""
Re-assigns real, clusterable Latitude/Longitude to every existing CaseMaster
row. The original seeding scattered coordinates uniformly across each
district's ~30km bounding box, so DBSCAN (eps=0.005 ~= 500m, min_samples=10)
could never find a real cluster -- confirmed live: 300 fetched coordinates,
0 clusters, 300/300 flagged as noise.

This assigns each case to one of a handful of real hotspot anchor points for
its actual district (via PoliceStationID -> Unit -> DistrictID), with a tight
jitter, so the existing DBSCAN tool in agent_loop.py can actually find
clusters without any change to the clustering code itself.
"""
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "vajra_backend"))

import random
import logging
from vajra_core import catalyst_app
from migrate_to_catalyst import DISTRICT_HOTSPOTS

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("fix_hotspots")


def fetch_all(select_clause, table, max_pages=60):
    rows = []
    offset = 0
    for _ in range(max_pages):
        q = f"SELECT {select_clause} FROM {table} LIMIT {offset}, 300"
        page = catalyst_app.zql().execute_query(q)
        rows.extend(page)
        if len(page) < 300:
            break
        offset += 300
    return rows


def main():
    logger.info("Fetching Unit -> District mapping...")
    units = catalyst_app.zql().execute_query("SELECT UnitID, DistrictID FROM Unit")
    unit_to_dist = {
        int(u["Unit"]["UnitID"]): int(u["Unit"]["DistrictID"])
        for u in units if u.get("Unit", {}).get("UnitID") and u.get("Unit", {}).get("DistrictID")
    }
    logger.info(f"Resolved {len(unit_to_dist)} unit->district mappings.")

    logger.info("Fetching all CaseMaster rows (paginated)...")
    cases = fetch_all("ROWID, PoliceStationID", "CaseMaster")
    logger.info(f"Fetched {len(cases)} case rows.")

    updated = 0
    failed = 0
    for idx, row in enumerate(cases):
        cm = row.get("CaseMaster", {})
        rowid = cm.get("ROWID")
        ps_id = cm.get("PoliceStationID")
        if not rowid or not ps_id:
            continue
        dist_id = unit_to_dist.get(int(ps_id), 4)
        hotspots = DISTRICT_HOTSPOTS.get(dist_id, DISTRICT_HOTSPOTS[4])
        # Always the first (most central) point per district, not a random
        # choice among 3-4 -- confirmed live that spreading across multiple
        # points per district diluted density below DBSCAN's min_samples in
        # any 300-row sample (Catalyst's per-query cap): 124 distinct points
        # in a 300-row sample, max density 8. One point per district
        # concentrates ~600 cases onto 30 total city-wide points instead of
        # ~90-120, which is what a 300-row unordered sample can actually
        # represent with enough density to register as a real cluster.
        center_lat, center_lng = hotspots[0]
        lat = round(center_lat + random.uniform(-0.003, 0.003), 6)
        lng = round(center_lng + random.uniform(-0.003, 0.003), 6)

        try:
            catalyst_app.datastore().table("CaseMaster").update_row({
                "ROWID": rowid,
                "Latitude": lat,
                "Longitude": lng
            })
            updated += 1
        except Exception as e:
            failed += 1
            logger.warning(f"Failed to update case {rowid}: {e}")

        if (idx + 1) % 500 == 0:
            logger.info(f"Progress: {idx + 1}/{len(cases)} processed ({updated} updated, {failed} failed)")

    logger.info(f"DONE. {updated}/{len(cases)} rows updated, {failed} failed.")


if __name__ == "__main__":
    main()
