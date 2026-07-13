"""
Targeted re-seed for Employee (7-digit KGID fix) and ArrestSurrender
(ArrestSurrenderID -> ArrestSurrender column fix) only.
Does NOT touch CaseMaster, Accused, Victim, or any other table already
seeded successfully in the main run.
"""
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "vajra_backend"))

import random
import logging
import datetime
from faker import Faker
from vajra_core import catalyst_app

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("targeted_reseed")
fake = Faker()


def clear_table(table_name):
    try:
        res = catalyst_app.zql().execute_query(f"SELECT ROWID FROM {table_name}")
        rowids = [r.get(table_name, {}).get("ROWID") for r in res if r.get(table_name, {}).get("ROWID")]
        for rid in rowids:
            try:
                catalyst_app.datastore().table(table_name).delete_row(rid)
            except Exception as e:
                logger.warning(f"Could not delete row {rid} from {table_name}: {e}")
        logger.info(f"Cleared {table_name}: {len(rowids)} rows removed")
    except Exception as e:
        logger.warning(f"Could not clear {table_name} (may be empty or not exist): {e}")


def main():
    # ---- 1. Re-seed Employee with real 7-digit KGIDs ----
    logger.info("=== Re-seeding Employee (7-digit KGID) ===")
    clear_table("Employee")

    employees = []
    for i in range(30):
        employees.append({
            "EmployeeID": i + 1, "DistrictID": random.randint(1, 30),
            "UnitID": random.randint(1, 30), "RankID": random.randint(1, 10),
            "DesignationID": random.randint(1, 8),
            "KGID": str(random.randint(1000000, 9999999)),
            "FirstName": fake.name().replace("'", ""),
            "EmployeeDOB": fake.date_of_birth(minimum_age=25, maximum_age=58).isoformat(),
            "GenderID": random.choice([1, 2]), "BloodGroupID": random.randint(1, 8),
            "PhysicallyChallenged": False,
            "AppointmentDate": fake.date_between(start_date="-20y", end_date="-1y").isoformat()
        })

    inserted = 0
    for emp in employees:
        try:
            catalyst_app.datastore().table("Employee").insert_row(emp)
            inserted += 1
        except Exception as e:
            logger.error(f"Failed to insert employee {emp['EmployeeID']}: {e}")
    logger.info(f"Employee: {inserted}/{len(employees)} rows inserted.")
    logger.info(f"SAMPLE REAL KGID FOR LOGIN TESTING: {employees[0]['KGID']}")
    logger.info(f"ALL SEEDED KGIDs: {[e['KGID'] for e in employees]}")

    # ---- 2. Re-seed ArrestSurrender + inv_arrestsurrenderaccused using REAL existing data ----
    logger.info("=== Re-seeding ArrestSurrender + inv_arrestsurrenderaccused ===")
    clear_table("inv_arrestsurrenderaccused")
    clear_table("ArrestSurrender")

    logger.info("Fetching a real batch of Accused rows (Catalyst LIMIT cap = 300)...")
    accused_res = catalyst_app.zql().execute_query("SELECT AccusedMasterID, CaseMasterID FROM Accused LIMIT 300")
    accused_pairs = [
        (r.get("Accused", {}).get("AccusedMasterID"), r.get("Accused", {}).get("CaseMasterID"))
        for r in accused_res
    ]
    logger.info(f"Fetched {len(accused_pairs)} real accused records.")

    case_ids = list(set(cid for _, cid in accused_pairs if cid))
    case_ids_str = ",".join(str(c) for c in case_ids)
    case_res = catalyst_app.zql().execute_query(
        f"SELECT CaseMasterID, CrimeRegisteredDate, PoliceStationID FROM CaseMaster WHERE CaseMasterID IN ({case_ids_str})"
    )
    case_lookup = {}
    for r in case_res:
        cm = r.get("CaseMaster", {})
        case_lookup[cm.get("CaseMasterID")] = {
            "reg_date": cm.get("CrimeRegisteredDate"),
            "police_station_id": cm.get("PoliceStationID")
        }
    logger.info(f"Resolved {len(case_lookup)} real case records for date/district context.")

    arrests = []
    arrest_accused = []
    arrest_id_counter = 1
    link_id_counter = 1

    for acc_id, case_id in accused_pairs:
        if not case_id or case_id not in case_lookup:
            continue
        if random.random() > 0.50:
            continue
        case_info = case_lookup[case_id]
        reg_date_str = case_info["reg_date"]
        try:
            reg_date = datetime.date.fromisoformat(reg_date_str.split()[0] if reg_date_str else "2024-01-01")
        except Exception:
            reg_date = datetime.date(2024, 1, 1)
        arrest_date = reg_date + datetime.timedelta(days=random.randint(1, 180))

        arrests.append({
            "ArrestSurrender": arrest_id_counter, "CaseMasterID": case_id,
            "ArrestSurrenderTypeID": random.choice([1, 2]),
            "ArrestSurrenderDate": arrest_date.isoformat(),
            "ArrestSurrenderStateId": 1,
            "ArrestSurrenderDistrictId": random.randint(1, 30),
            "PoliceStationID": case_info["police_station_id"] or random.randint(1, 30),
            "IOID": random.randint(1, 30), "CourtID": random.randint(1, 20),
            "AccusedMasterID": acc_id,
            "IsAccused": True, "IsComplainantAccused": False
        })
        arrest_accused.append({
            "id": link_id_counter,
            "ArrestSurrenderID": arrest_id_counter,
            "AccusedMasterID": acc_id
        })
        arrest_id_counter += 1
        link_id_counter += 1

    logger.info(f"Generated {len(arrests)} real arrest records linked to real cases/accused (partial batch of {len(accused_pairs)} accused — Catalyst's 300-row query cap limits how many of the full ~14,000 accused this pass can cover).")

    inserted = 0
    for row in arrests:
        try:
            catalyst_app.datastore().table("ArrestSurrender").insert_row(row)
            inserted += 1
        except Exception as e:
            logger.error(f"Failed to insert ArrestSurrender row {row['ArrestSurrender']}: {e}")
    logger.info(f"ArrestSurrender: {inserted}/{len(arrests)} rows inserted.")

    inserted = 0
    for row in arrest_accused:
        try:
            catalyst_app.datastore().table("inv_arrestsurrenderaccused").insert_row(row)
            inserted += 1
        except Exception as e:
            logger.error(f"Failed to insert inv_arrestsurrenderaccused row {row['id']}: {e}")
    logger.info(f"inv_arrestsurrenderaccused: {inserted}/{len(arrest_accused)} rows inserted.")

    logger.info("=" * 60)
    logger.info("TARGETED RE-SEED COMPLETE")
    logger.info("=" * 60)


if __name__ == "__main__":
    main()
