"""
VAJRA — Synthetic New-Case Injector

The seeded dataset (see migrate_to_catalyst.py) is a one-time static
snapshot: there is no real FIR-lodging portal feeding the system, so
CaseMaster/Accused never actually grow on their own. That means
functions/proactive_alerts/index.py (which now only fires SPATIAL_SPIKE /
REPEAT_OFFENDER alerts when a district's or offender's case count has
genuinely INCREASED since the last check) has nothing real to react to.

Run this script by hand whenever you want to simulate new activity coming
in. Each run inserts a small, realistic batch of new CaseMaster /
ComplainantDetails / Victim / Accused rows directly into the live Catalyst
DB, in one of three scenarios:

  repeat_offender  -- one new case filed against an EXISTING suspect
                      (their case count goes up by 1 -> should trigger a
                      genuine REPEAT_OFFENDER alert on the next job run)
  new_offender     -- one new case filed against a brand-new suspect
                      (adds volume/color, not itself alert-triggering)
  district_spike   -- a batch of 15-30 new cases concentrated in one
                      district (should trigger a genuine SPATIAL_SPIKE
                      alert on the next job run)

Usage:
    python simulate_new_cases.py                      # one random scenario
    python simulate_new_cases.py --scenario repeat_offender
    python simulate_new_cases.py --scenario new_offender
    python simulate_new_cases.py --scenario district_spike [--district N] [--count N]
    python simulate_new_cases.py --all                 # run all three in one go
    python simulate_new_cases.py --dry-run             # preview, no DB writes
"""
import os
import re
import sys
import random
import argparse
import datetime

sys.path.insert(0, os.path.dirname(__file__))
from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env"))

from faker import Faker
import vajra_core
from migrate_to_catalyst import CRIME_GROUPS, DISTRICT_HOTSPOTS, CASE_STATUSES

fake = Faker("en_IN")
app = vajra_core.catalyst_app

# Real seeded identifiers all follow these formats (see migrate_to_catalyst.py)
# -- validated with regex right before insert so a malformed ID can never
# silently reach the DB and look out of place next to genuine records.
CASE_NO_RE = re.compile(r"^CASE-\d{4}-\d{5}$")
CRIME_NO_RE = re.compile(r"^CR-\d{4}-\d{5}$")
PID_RE = re.compile(r"^PID-\d{6}$")


def zq(query):
    return app.zql().execute_query(query)


def get_max(table, id_col):
    res = zq(f"SELECT MAX({id_col}) FROM {table}")
    val = res[0][table].get(f"MAX({id_col})") if res else None
    return int(val) if val is not None else 0


def next_ids():
    # Re-fetched fresh at the start of every run (and again between scenarios
    # in --all) so IDs never collide even if the DB was touched by another
    # means between runs -- CaseMaster's own MAX is the only safe source of
    # truth here (its live COUNT is actually higher than MAX due to
    # duplicate IDs left over from earlier re-seeds, so COUNT+1 would not be
    # a safe next-ID choice).
    return {
        "case": get_max("CaseMaster", "CaseMasterID") + 1,
        "accused": get_max("Accused", "AccusedMasterID") + 1,
        "complainant": get_max("ComplainantDetails", "ComplainantID") + 1,
        "victim": get_max("Victim", "VictimMasterID") + 1,
    }


def get_unit_to_district():
    rows = zq("SELECT UnitID, DistrictID FROM Unit")
    return {int(r["Unit"]["UnitID"]): int(r["Unit"]["DistrictID"]) for r in rows}


def get_district_names():
    rows = zq("SELECT DistrictID, DistrictName FROM District")
    return {int(r["District"]["DistrictID"]): r["District"]["DistrictName"] for r in rows}


def get_lookup_count(table, id_col):
    res = zq(f"SELECT COUNT({id_col}) FROM {table}")
    return int(res[0][table][f"COUNT({id_col})"]) if res else 0


def sample_existing_offender_names(n=300):
    """A different random page of real (non-'Unknown') AccusedNames each
    call, to either reuse (repeat_offender scenario) or avoid colliding with
    (new_offender scenario). Randomizing the offset means repeated runs of
    this script pick different targets rather than always the same names."""
    total = get_lookup_count("Accused", "AccusedMasterID")
    offset = random.randint(0, max(0, total - n))
    rows = zq(f"SELECT AccusedName FROM Accused LIMIT {offset}, {n}")
    names = [r.get("Accused", {}).get("AccusedName", "") for r in rows]
    return [nm for nm in names if nm and nm.strip() and "unknown" not in nm.lower()]


def build_case_row(case_id, district_id, unit_to_dist_rev, employee_count, court_count, subhead_count, crime=None):
    reg_date = datetime.date.today()
    crime = crime or random.choice(CRIME_GROUPS)
    crime_no = f"CR-{reg_date.year}-{random.randint(10000, 99999)}"
    case_no = f"CASE-{reg_date.year}-{case_id:05d}"
    assert CRIME_NO_RE.match(crime_no) and CASE_NO_RE.match(case_no), "generated identifier failed format check"

    ps_id = random.choice(unit_to_dist_rev[district_id])
    hotspots = DISTRICT_HOTSPOTS.get(district_id, DISTRICT_HOTSPOTS[4])
    center_lat, center_lng = random.choice(hotspots)
    lat = round(center_lat + random.uniform(-0.003, 0.003), 6)
    lng = round(center_lng + random.uniform(-0.003, 0.003), 6)

    row = {
        "CaseMasterID": case_id,
        "CrimeNo": crime_no,
        "CaseNo": case_no,
        "CrimeRegisteredDate": reg_date.isoformat(),
        "PolicePersonID": random.randint(1, employee_count),
        "PoliceStationID": ps_id,
        "CaseCategoryID": 1,  # FIR
        "GravityOffenceID": random.choices([1, 2], weights=[11.4, 88.6])[0],
        "CrimeMajorHeadID": CRIME_GROUPS.index(crime) + 1,
        "CrimeMinorHeadID": random.randint(1, subhead_count),
        "CaseStatusID": CASE_STATUSES.index("UNDER INVESTIGATION") + 1,
        "CourtID": random.randint(1, court_count),
        "IncidentFromDate": reg_date.isoformat(),
        "IncidentToDate": reg_date.isoformat(),
        "InfoReceivedPSDate": reg_date.isoformat(),
        "Latitude": lat, "Longitude": lng,
        "BriefFacts": (
            f"Incident of {crime.lower()} reported at {fake.street_address().replace(chr(39), '').replace(chr(10), ', ')}. "
            f"[SYNTHETIC -- injected by simulate_new_cases.py on {datetime.datetime.now().isoformat(timespec='seconds')}]"
        ),
    }
    return row, crime


def build_complainant(complainant_id, case_id):
    return {
        "ComplainantID": complainant_id, "CaseMasterID": case_id,
        "ComplainantName": fake.name().replace("'", ""),
        "AgeYear": random.randint(18, 70),
        "OccupationID": random.randint(1, 10), "ReligionID": random.randint(1, 7),
        "CasteID": random.randint(1, 5), "GenderID": random.choice([1, 2]),
    }


def build_victim(victim_id, case_id):
    v_profile = random.choices(
        [(1, 18, 75), (2, 18, 75), (1, 2, 17), (2, 2, 17)],
        weights=[64.0, 28.0, 3.2, 4.8],
    )[0]
    return {
        "VictimMasterID": victim_id, "CaseMasterID": case_id,
        "VictimName": fake.name().replace("'", ""),
        "AgeYear": random.randint(v_profile[1], v_profile[2]),
        "GenderID": v_profile[0], "VictimPolice": random.choice(["0", "1"]),
    }


def build_accused(accused_id, case_id, name=None):
    pid = f"PID-{random.randint(100000, 999999)}"
    assert PID_RE.match(pid), "generated PersonID failed format check"
    return {
        "AccusedMasterID": accused_id, "CaseMasterID": case_id,
        "AccusedName": name or fake.name().replace("'", ""),
        "AgeYear": random.randint(18, 55),
        "GenderID": random.choice([1, 2]),
        "PersonID": pid,
    }


def insert_rows(table, rows, dry_run):
    if dry_run:
        return
    for row in rows:
        vajra_core.zcql_insert_row(table, row)


def scenario_repeat_offender(ids, ctx, dry_run):
    names = sample_existing_offender_names()
    if not names:
        print("No existing offender names found to reuse -- skipping repeat_offender scenario.")
        return
    target_name = random.choice(names)
    district_id = random.choice(list(ctx["unit_to_dist_rev"].keys()))

    case_row, crime = build_case_row(ids["case"], district_id, ctx["unit_to_dist_rev"], ctx["employee_count"], ctx["court_count"], ctx["subhead_count"])
    complainant_row = build_complainant(ids["complainant"], ids["case"])
    victim_row = build_victim(ids["victim"], ids["case"])
    accused_row = build_accused(ids["accused"], ids["case"], name=target_name)

    insert_rows("CaseMaster", [case_row], dry_run)
    insert_rows("ComplainantDetails", [complainant_row], dry_run)
    insert_rows("Victim", [victim_row], dry_run)
    insert_rows("Accused", [accused_row], dry_run)

    d_name = ctx["district_names"].get(district_id, f"District {district_id}")
    print(f"[REPEAT_OFFENDER] New case {case_row['CaseNo']} ({crime}) in {d_name} filed against "
          f"existing suspect '{target_name}' -- their case count just went up by 1.")


def scenario_new_offender(ids, ctx, dry_run):
    existing_names = set(sample_existing_offender_names())
    name = fake.name().replace("'", "")
    tries = 0
    while name in existing_names and tries < 5:
        name = fake.name().replace("'", "")
        tries += 1

    district_id = random.choice(list(ctx["unit_to_dist_rev"].keys()))
    case_row, crime = build_case_row(ids["case"], district_id, ctx["unit_to_dist_rev"], ctx["employee_count"], ctx["court_count"], ctx["subhead_count"])
    complainant_row = build_complainant(ids["complainant"], ids["case"])
    victim_row = build_victim(ids["victim"], ids["case"])
    accused_row = build_accused(ids["accused"], ids["case"], name=name)

    insert_rows("CaseMaster", [case_row], dry_run)
    insert_rows("ComplainantDetails", [complainant_row], dry_run)
    insert_rows("Victim", [victim_row], dry_run)
    insert_rows("Accused", [accused_row], dry_run)

    d_name = ctx["district_names"].get(district_id, f"District {district_id}")
    print(f"[NEW_OFFENDER] New case {case_row['CaseNo']} ({crime}) in {d_name} filed against "
          f"first-time suspect '{name}'.")


def scenario_district_spike(ids, ctx, dry_run, district_id=None, count=None):
    unit_to_dist_rev = ctx["unit_to_dist_rev"]
    district_id = district_id if district_id is not None else random.choice(list(unit_to_dist_rev.keys()))
    if district_id not in unit_to_dist_rev:
        print(f"DistrictID {district_id} has no mapped police stations -- skipping district_spike scenario.")
        return
    count = count or random.randint(15, 30)
    existing_names = sample_existing_offender_names()

    case_id, complainant_id = ids["case"], ids["complainant"]
    victim_id, accused_id = ids["victim"], ids["accused"]
    case_rows, complainant_rows, victim_rows, accused_rows = [], [], [], []

    for _ in range(count):
        case_row, crime = build_case_row(case_id, district_id, unit_to_dist_rev, ctx["employee_count"], ctx["court_count"], ctx["subhead_count"])
        case_rows.append(case_row)
        complainant_rows.append(build_complainant(complainant_id, case_id))
        victim_rows.append(build_victim(victim_id, case_id))
        # Mostly new suspects, a few reused ones -- either way it's new case
        # volume in this district, which is what the spatial check reacts to.
        name = random.choice(existing_names) if existing_names and random.random() < 0.3 else None
        accused_rows.append(build_accused(accused_id, case_id, name=name))
        case_id += 1
        complainant_id += 1
        victim_id += 1
        accused_id += 1

    insert_rows("CaseMaster", case_rows, dry_run)
    insert_rows("ComplainantDetails", complainant_rows, dry_run)
    insert_rows("Victim", victim_rows, dry_run)
    insert_rows("Accused", accused_rows, dry_run)

    d_name = ctx["district_names"].get(district_id, f"District {district_id}")
    print(f"[DISTRICT_SPIKE] Injected {count} new cases into {d_name} -- should push its total "
          f"past the last known baseline on the next proactive_alerts run.")


SCENARIOS = ["repeat_offender", "new_offender", "district_spike"]


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--scenario", choices=SCENARIOS, help="Which scenario to run. Omit for a random one each run.")
    parser.add_argument("--district", type=int, help="Force district_spike to target a specific DistrictID (1-30).")
    parser.add_argument("--count", type=int, help="Number of cases for district_spike (default: random 15-30).")
    parser.add_argument("--all", action="store_true", help="Run all three scenarios in one go.")
    parser.add_argument("--dry-run", action="store_true", help="Preview what would be inserted without writing to the DB.")
    args = parser.parse_args()

    if not app:
        print("Catalyst SDK failed to initialize -- check .env credentials.")
        return

    unit_to_dist = get_unit_to_district()
    unit_to_dist_rev = {}
    for uid, did in unit_to_dist.items():
        unit_to_dist_rev.setdefault(did, []).append(uid)

    ctx = {
        "unit_to_dist_rev": unit_to_dist_rev,
        "district_names": get_district_names(),
        "employee_count": get_lookup_count("Employee", "EmployeeID"),
        "court_count": get_lookup_count("Court", "CourtID"),
        "subhead_count": get_lookup_count("CrimeSubHead", "CrimeSubHeadID"),
    }

    to_run = list(SCENARIOS) if args.all else [args.scenario or random.choice(SCENARIOS)]

    if args.dry_run:
        print("=== DRY RUN -- no rows will be written ===")

    for name in to_run:
        ids = next_ids()
        print(f"\n--- Running scenario: {name} ---")
        if name == "district_spike":
            scenario_district_spike(ids, ctx, args.dry_run, district_id=args.district, count=args.count)
        elif name == "repeat_offender":
            scenario_repeat_offender(ids, ctx, args.dry_run)
        elif name == "new_offender":
            scenario_new_offender(ids, ctx, args.dry_run)

    print("\nDone. Run the proactive_alerts job next (or wait for its schedule) to see these reflected as genuine alerts.")


if __name__ == "__main__":
    main()
