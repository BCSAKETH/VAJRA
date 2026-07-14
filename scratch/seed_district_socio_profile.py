"""
Standalone seed for DistrictSocioProfile only. Extracted from migrate_to_catalyst.py
(~lines 296-335) so we don't have to re-run the full seeder, which deletes and
rebuilds every table.
"""
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "vajra_backend"))

import random
import logging
from vajra_core import catalyst_app

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("seed_socio")

KARNATAKA_DISTRICTS = [
    "Bagalkot", "Ballari", "Belagavi", "Bengaluru Urban", "Bengaluru Rural",
    "Bidar", "Chamarajanagar", "Chikkaballapur", "Chikkamagaluru", "Chitradurga",
    "Dakshina Kannada", "Davanagere", "Dharwad", "Gadag", "Hassan",
    "Haveri", "Kalaburagi", "Kodagu", "Kolar", "Koppal",
    "Mandya", "Mysuru", "Raichur", "Ramanagara", "Shimoga",
    "Tumakuru", "Udupi", "Uttara Kannada", "Vijayapura", "Yadgir"
]


def main():
    existing = catalyst_app.zql().execute_query("SELECT DistrictID FROM DistrictSocioProfile")
    existing_ids = {r.get("DistrictSocioProfile", {}).get("DistrictID") for r in existing}
    if existing_ids:
        logger.info(f"DistrictSocioProfile already has {len(existing_ids)} rows. Skipping to avoid duplicates.")
        return

    socio_profiles = []
    for i, d in enumerate(KARNATAKA_DISTRICTS):
        if i + 1 == 4:
            literacy, unemp, urban, mig, stress = 88.5, 3.5, 0.95, 0.75, 0.3
        elif d in ["Yadgir", "Kalaburagi", "Raichur", "Koppal"]:
            literacy = round(random.uniform(60.0, 66.0), 2)
            unemp = round(random.uniform(7.5, 10.0), 2)
            urban = round(random.uniform(0.15, 0.3), 2)
            mig = round(random.uniform(0.35, 0.5), 2)
            stress = round(random.uniform(0.65, 0.8), 2)
        else:
            literacy = round(random.uniform(68.0, 82.0), 2)
            unemp = round(random.uniform(4.0, 7.5), 2)
            urban = round(random.uniform(0.35, 0.7), 2)
            mig = round(random.uniform(0.15, 0.4), 2)
            stress = round(random.uniform(0.35, 0.6), 2)

        socio_profiles.append({
            "DistrictID": i + 1,
            "LiteracyRate": literacy,
            "UnemploymentRate": unemp,
            "UrbanizationIndex": urban,
            "MigrationIndex": mig,
            "EconomicStressIndex": stress
        })

    inserted = 0
    for row in socio_profiles:
        try:
            catalyst_app.datastore().table("DistrictSocioProfile").insert_row(row)
            inserted += 1
        except Exception as e:
            logger.error(f"Failed to insert DistrictID {row['DistrictID']}: {e}")
    logger.info(f"DistrictSocioProfile: {inserted}/{len(socio_profiles)} rows inserted.")


if __name__ == "__main__":
    main()
