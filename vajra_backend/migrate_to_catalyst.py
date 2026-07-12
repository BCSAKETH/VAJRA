"""
VAJRA 3.0 — Synthetic Data Seeder for Zoho Catalyst
Uses ZCQL INSERT statements (which work with table names, no IDs needed).
100% synthetic data — no CSV files used.
Recalibrated at Real Volume (~8,000 cases).
"""
import os
import requests
import json
import random
import logging
import time
import datetime
from concurrent.futures import ThreadPoolExecutor
from dotenv import load_dotenv
from faker import Faker

load_dotenv(dotenv_path=os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env"))

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)

fake = Faker('en_IN')

# --- Zoho Catalyst Auth ---
CLIENT_ID = os.getenv("CATALYST_CLIENT_ID")
CLIENT_SECRET = os.getenv("CATALYST_CLIENT_SECRET")
REFRESH_TOKEN = os.getenv("CATALYST_REFRESH_TOKEN")
PROJECT_ID = os.getenv("CATALYST_PROJECT_ID")

ACCOUNTS_URL = "https://accounts.zoho.in/oauth/v2/token"
ZCQL_URL = f"https://api.catalyst.zoho.in/baas/v1/project/{PROJECT_ID}/query"

_current_token = None

def get_access_token():
    global _current_token
    # Try reading from token cache first
    token_cache_path = os.path.join(os.path.dirname(__file__), ".token_cache")
    if os.path.exists(token_cache_path):
        with open(token_cache_path, "r") as f:
            _current_token = f.read().strip()
        logger.info("Access token loaded from cache.")
        return _current_token

    payload = {
        "client_id": CLIENT_ID,
        "client_secret": CLIENT_SECRET,
        "refresh_token": REFRESH_TOKEN,
        "grant_type": "refresh_token"
    }
    response = requests.post(ACCOUNTS_URL, data=payload)
    data = response.json()
    if "access_token" not in data:
        raise Exception(f"Auth failed: {json.dumps(data)}")
    _current_token = data["access_token"]
    # Cache it
    with open(token_cache_path, "w") as f:
        f.write(_current_token)
    logger.info("OAuth access token acquired and cached.")
    return _current_token

def zcql_insert(table_name, row_dict):
    """Insert a row using ZCQL INSERT statement with rate-limiting retries."""
    columns = ", ".join(row_dict.keys())
    values = []
    for v in row_dict.values():
        if v is None:
            values.append("NULL")
        elif isinstance(v, bool):
            values.append("true" if v else "false")
        elif isinstance(v, (int, float)):
            values.append(str(v))
        else:
            # Escape single quotes in strings
            escaped = str(v).replace("'", "''")
            values.append(f"'{escaped}'")
    values_str = ", ".join(values)
    
    query = f"INSERT INTO {table_name} ({columns}) VALUES ({values_str})"
    
    headers = {
        "Authorization": f"Zoho-oauthtoken {_current_token}",
        "Content-Type": "application/json",
        "X-Catalyst-Environment": "Development",
        "environment": "Development"
    }
    
    for attempt in range(6):
        try:
            res = requests.post(ZCQL_URL, headers=headers, json={"query": query})
            if res.status_code in (200, 201):
                return True
            elif res.status_code == 429:
                sleep_time = 0.5 * (2 ** attempt) + random.uniform(0.1, 0.3)
                time.sleep(sleep_time)
                continue
            else:
                # Table might not exist (e.g. DistrictSocioProfile)
                if "No such Table with the given name exists" in res.text:
                    return "table_missing"
                logger.warning(f"ZCQL INSERT {table_name} failed: {res.status_code} - {res.text[:200]}")
                return False
        except Exception as e:
            logger.warning(f"ZCQL INSERT {table_name} exception: {e}")
            time.sleep(0.5)
    return False

def seed_table(table_name, rows, max_workers=20):
    """Seed a table with multiple rows in parallel."""
    if not rows:
        return 0
    success = 0
    t0 = time.time()
    
    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        futures = [executor.submit(zcql_insert, table_name, row) for row in rows]
        for fut in futures:
            res = fut.result()
            if res == True:
                success += 1
            elif res == "table_missing":
                logger.warning(f"Skipping table {table_name} — Table does not exist in Catalyst Console Datastore.")
                return 0
                
    t1 = time.time()
    logger.info(f"  {table_name}: {success}/{len(rows)} rows inserted in {t1 - t0:.2f}s.")
    return success

# ============================================================
# KARNATAKA-SPECIFIC REFERENCE DATA
# ============================================================
KARNATAKA_DISTRICTS = [
    "Bagalkot", "Ballari", "Belagavi", "Bengaluru Urban", "Bengaluru Rural",
    "Bidar", "Chamarajanagar", "Chikkaballapur", "Chikkamagaluru", "Chitradurga",
    "Dakshina Kannada", "Davanagere", "Dharwad", "Gadag", "Hassan",
    "Haveri", "Kalaburagi", "Kodagu", "Kolar", "Koppal",
    "Mandya", "Mysuru", "Raichur", "Ramanagara", "Shimoga",
    "Tumakuru", "Udupi", "Uttara Kannada", "Vijayapura", "Yadgir"
]

POLICE_STATIONS = [
    "Cubbon Park PS", "Indiranagar PS", "Koramangala PS", "Whitefield PS",
    "Jayanagar PS", "HSR Layout PS", "Marathahalli PS", "Rajajinagar PS",
    "Basavanagudi PS", "Malleswaram PS", "Yeshwantpur PS", "Peenya PS",
    "Electronic City PS", "Yelahanka PS", "Banashankari PS", "Vijayanagar PS",
    "KR Puram PS", "Hebbal PS", "RT Nagar PS", "Sadashivanagar PS",
    "Amengad PS", "Badami PS", "Bilgi PS", "Guledgudda PS", "Hunagund PS",
    "Jamkhandi PS", "Mudhol PS", "Rabakavi PS", "Bagalkot Town PS", "Ilkal PS"
]

CRIME_GROUPS = [
    "THEFT", "BURGLARY", "ROBBERY", "DACOITY", "MURDER",
    "ATTEMPT TO MURDER", "KIDNAPPING", "ASSAULT", "CHEATING", "FRAUD",
    "CYBERCRIME", "NARCOTICS", "ARMS ACT", "DOWRY DEATH", "DOMESTIC VIOLENCE",
    "MOTOR VEHICLE THEFT", "CHAIN SNATCHING", "SEXUAL OFFENCES", "RIOTS", "ARSON",
    "Motor Vehicle Accidents Non-Fatal", "CrPC cases", "Missing Person",
    "Karnataka Police Act 1963", "Karnataka State Local Act", "Motor Vehicle Accidents Fatal",
    "Molestation", "Public Safety"
]

CRIME_SUBHEADS = [
    "House Breaking By Night", "Pick Pocketing", "Vehicle Theft",
    "Online Banking Fraud", "Identity Theft", "Drug Possession",
    "Grievous Hurt", "Simple Hurt", "Criminal Intimidation",
    "Cheating By Personation", "Forgery", "Counterfeiting",
    "Extortion", "Criminal Breach Of Trust", "Mischief",
    "Outraging Modesty", "Eve Teasing", "Stalking", "Acid Attack", "Missing Person"
]

ACTS = [
    ("IPC", "Indian Penal Code", "IPC"), 
    ("CrPC", "Code of Criminal Procedure", "CrPC"),
    ("IEA", "Indian Evidence Act", "IEA"), 
    ("NDPS", "Narcotic Drugs and Psychotropic Substances Act", "NDPS"),
    ("Arms", "Arms Act 1959", "Arms"), 
    ("IT", "Information Technology Act 2000", "IT Act"),
    ("POCSO", "Protection of Children from Sexual Offences Act", "POCSO"),
    ("SC_ST", "SC/ST Prevention of Atrocities Act", "SC/ST"),
    ("DV", "Protection of Women from Domestic Violence Act", "DV Act"),
    ("MV", "Motor Vehicles Act", "MV Act"),
    ("KPA", "Karnataka Police Act", "KPA")
]

IPC_SECTIONS = [
    ("IPC", "302", "Murder"), ("IPC", "307", "Attempt to Murder"), ("IPC", "376", "Rape"),
    ("IPC", "379", "Theft"), ("IPC", "380", "Theft in dwelling house"), ("IPC", "392", "Robbery"),
    ("IPC", "395", "Dacoity"), ("IPC", "420", "Cheating"), ("IPC", "406", "Criminal breach of trust"),
    ("IPC", "498A", "Cruelty by husband"), ("IPC", "304B", "Dowry death"), ("IPC", "323", "Voluntarily causing hurt"),
    ("IPC", "324", "Voluntarily causing hurt by dangerous weapons"), ("IPC", "354", "Assault on woman"),
    ("IPC", "506", "Criminal intimidation"), ("IPC", "509", "Word gesture to insult modesty"),
    ("IPC", "341", "Wrongful restraint"), ("IPC", "363", "Kidnapping"), ("IPC", "279", "Rash driving"),
    ("IPC", "304A", "Death by negligence"), ("CrPC", "107", "Security for keeping peace"),
    ("KPA", "87", "Karnataka Police Act Sec 87"), ("IPC", "283", "Danger in public way"),
    ("IPC", "337", "Causing hurt by endangering life"), ("IPC", "338", "Causing grievous hurt by endangering life"),
    ("IPC", "419", "Cheating by personation"), ("IT", "66(D)", "Computer cheating"),
    ("IT", "66(C)", "Identity theft"), ("IPC", "457", "House trespass by night"),
    ("NDPS", "27(b)", "NDPS small quantity possession")
]

RANKS = ["Constable", "Head Constable", "ASI", "PSI", "PI", "DySP", "SP", "DIG", "IGP", "DGP"]
DESIGNATIONS = ["Investigating Officer", "Station House Officer", "Beat Constable", "Traffic Constable",
                "Cyber Cell Officer", "Dog Squad Handler", "Forensic Officer", "Control Room Operator"]
CASE_CATEGORIES = ["FIR", "NCR", "UICR", "Suo Motu"]
GRAVITY_LEVELS = ["Heinous", "Non Heinous"]
CASE_STATUSES = [
    "UNDER INVESTIGATION", "CHARGESHEETED", "CONVICTED", "ACQUITTED",
    "PENDING TRIAL", "CLOSED", "REFERRED", "COMPROMISED", "UNDETECTED", "BOUND OVER"
]
CASTES = ["General", "OBC", "SC", "ST", "Other"]
RELIGIONS = ["Hindu", "Muslim", "Christian", "Jain", "Buddhist", "Sikh", "Other"]
OCCUPATIONS = ["Agriculture", "Business", "Government Service", "Private Service", "Student",
               "Unemployed", "Daily Wage", "Self Employed", "Retired", "Housewife"]
COURT_TYPES = ["JMFC", "CJM", "Sessions Court", "High Court", "District Court"]
ACCIDENT_LOCATIONS = [
    "MG Road Junction", "Silk Board Junction", "Hebbal Flyover", "KR Puram Bridge",
    "Mysore Road", "Tumkur Road NH-48", "Bellary Road", "Hosur Road",
    "Old Airport Road", "Outer Ring Road", "NICE Road Km 42",
    "Dharwad-Hubballi Highway", "Mangalore-Udupi Highway", "Belgaum Bypass",
    "Raichur-Gulbarga Road", "Hassan-Mangalore Highway", "Shimoga Bypass",
    "Mandya-Mysuru Highway", "Chitradurga Fort Road", "Kolar Gold Fields Road"
]

# ============================================================
# MAIN
# ============================================================
def main():
    logger.info("=" * 60)
    logger.info("VAJRA 3.0 — Synthetic Data Seeder (ZCQL INSERT)")
    logger.info("=" * 60)

    get_access_token()

    # --- Clear Tables first ---
    logger.info("Clearing tables...")
    tables_to_clear = [
        "State", "District", "UnitType", "Unit", "Rank", "Designation",
        "CaseCategory", "GravityOffence", "CaseStatusMaster", "CasteMaster",
        "ReligionMaster", "OccupationMaster", "Court", "Act", "Section",
        "CrimeHead", "CrimeSubHead", "CrimeHeadActSection", "Employee", "CaseMaster",
        "ComplainantDetails", "Victim", "Accused", "ArrestSurrender", "ChargesheetDetails",
        "ActSectionAssociation", "inv_arrestsurrenderaccused", "Inv_OccuranceTime",
        "AccidentReports", "CrimeData", "DistrictSocioProfile"
    ]
    for tbl in tables_to_clear:
        q = f"DELETE FROM {tbl}"
        headers = {
            "Authorization": f"Zoho-oauthtoken {_current_token}",
            "Content-Type": "application/json",
            "X-Catalyst-Environment": "Development",
            "environment": "Development"
        }
        res = requests.post(ZCQL_URL, headers=headers, json={"query": q})
        if res.status_code == 200:
            logger.info(f"  Cleared {tbl}")
        else:
            logger.warning(f"  Could not clear {tbl}: {res.status_code}")

    # --- Phase 1: Lookup Tables ---
    logger.info("\n--- Phase 1: Lookup Tables ---")

    seed_table("State", [{"StateID": 1, "StateName": "Karnataka", "NationalityID": 1, "Active": True}])

    seed_table("District", [
        {"DistrictID": i+1, "DistrictName": d, "StateID": 1, "Active": True}
        for i, d in enumerate(KARNATAKA_DISTRICTS)
    ])

    # Seed DistrictSocioProfile (Phase 3 socio table)
    socio_profiles = []
    for i, d in enumerate(KARNATAKA_DISTRICTS):
        # DistrictID is i+1
        # Skew Bengaluru Urban (DistrictID = 4)
        if i + 1 == 4:
            literacy = 88.5
            unemp = 3.5
            urban = 0.95
            mig = 0.75
            stress = 0.3
        elif d in ["Yadgir", "Kalaburagi", "Raichur", "Koppal"]:
            # Skew northern Karnataka districts lower literacy, higher unemp
            literacy = round(random.uniform(60.0, 66.0), 2)
            unemp = round(random.uniform(7.5, 10.0), 2)
            urban = round(random.uniform(0.15, 0.3), 2)
            mig = round(random.uniform(0.35, 0.5), 2)
            stress = round(random.uniform(0.65, 0.8), 2)
        else:
            # Baseline other districts
            literacy = round(random.uniform(68.0, 82.0), 2)
            unemp = round(random.uniform(4.0, 7.5), 2)
            urban = round(random.uniform(0.35, 0.7), 2)
            mig = round(random.uniform(0.15, 0.4), 2)
            stress = round(random.uniform(0.35, 0.6), 2)
            
        socio_profiles.append({
            "DistrictID": i+1,
            "LiteracyRate": literacy,
            "UnemploymentRate": unemp,
            "UrbanizationIndex": urban,
            "MigrationIndex": mig,
            "EconomicStressIndex": stress
        })
    seed_table("DistrictSocioProfile", socio_profiles)

    seed_table("UnitType", [
        {"UnitTypeID": 1, "UnitTypeName": "Police Station", "CityDistState": "District", "Hierarchy": 1, "Active": True},
        {"UnitTypeID": 2, "UnitTypeName": "City Armed Reserve", "CityDistState": "City", "Hierarchy": 2, "Active": True},
        {"UnitTypeID": 3, "UnitTypeName": "Traffic PS", "CityDistState": "City", "Hierarchy": 1, "Active": True},
    ])

    seed_table("Unit", [
        {"UnitID": i+1, "UnitName": ps, "TypeID": 1, "ParentUnit": 0,
         "NationalityID": 1, "StateID": 1, "DistrictID": (i % 30) + 1, "Active": True}
        for i, ps in enumerate(POLICE_STATIONS)
    ])

    seed_table("Rank", [
        {"RankID": i+1, "RankName": r, "Hierarchy": i+1, "Active": True}
        for i, r in enumerate(RANKS)
    ])

    seed_table("Designation", [
        {"DesignationID": i+1, "DesignationName": d, "Active": True, "SortOrder": i+1}
        for i, d in enumerate(DESIGNATIONS)
    ])

    seed_table("CaseCategory", [
        {"CaseCategoryID": i+1, "LookupValue": c} for i, c in enumerate(CASE_CATEGORIES)
    ])

    seed_table("GravityOffence", [
        {"GravityOffenceID": i+1, "LookupValue": g} for i, g in enumerate(GRAVITY_LEVELS)
    ])

    seed_table("CaseStatusMaster", [
        {"CaseStatusID": i+1, "CaseStatusName": s} for i, s in enumerate(CASE_STATUSES)
    ])

    seed_table("CasteMaster", [
        {"caste_master_id": i+1, "caste_master_name": c} for i, c in enumerate(CASTES)
    ])

    seed_table("ReligionMaster", [
        {"ReligionID": i+1, "ReligionName": r} for i, r in enumerate(RELIGIONS)
    ])

    seed_table("OccupationMaster", [
        {"OccupationID": i+1, "OccupationName": o} for i, o in enumerate(OCCUPATIONS)
    ])

    court_rows = []
    cid = 1
    for di, dn in enumerate(KARNATAKA_DISTRICTS[:10], 1):
        for ct in random.sample(COURT_TYPES, 2):
            court_rows.append({"CourtID": cid, "CourtName": f"{dn} {ct}", "DistrictID": di, "StateID": 1, "Active": True})
            cid += 1
    seed_table("Court", court_rows)

    seed_table("Act", [
        {"ActCode": a[0], "ActDescription": a[1]} for a in ACTS
    ])

    seed_table("Section", [
        {"ActCode": s[0], "SectionCode": s[1], "SectionDescription": s[2], "Active": True} for s in IPC_SECTIONS
    ])

    seed_table("CrimeHead", [
        {"CrimeHeadID": i+1, "CrimeGroupName": c, "Active": True} for i, c in enumerate(CRIME_GROUPS)
    ])

    seed_table("CrimeSubHead", [
        {"CrimeSubHeadID": i+1, "CrimeHeadID": (i%20)+1, "CrimeHeadName": s, "SeqID": i+1}
        for i, s in enumerate(CRIME_SUBHEADS)
    ])

    seed_table("CrimeHeadActSection", [
        {"id": i+1, "CrimeHeadID": (i%20)+1, "ActCode": "IPC", "SectionCode": IPC_SECTIONS[i%20][1]}
        for i in range(20)
    ])


    # --- Phase 2: Employee ---
    logger.info("\n--- Phase 2: Employee ---")
    employees = []
    for i in range(30):
        employees.append({
            "EmployeeID": i+1, "DistrictID": random.randint(1, 30),
            "UnitID": random.randint(1, 30), "RankID": random.randint(1, 10),
            "DesignationID": random.randint(1, 8),
            "KGID": str(random.randint(100000, 999999)),
            "FirstName": fake.name().replace("'", ""),
            "EmployeeDOB": fake.date_of_birth(minimum_age=25, maximum_age=58).isoformat(),
            "GenderID": random.choice([1, 2]), "BloodGroupID": random.randint(1, 8),
            "PhysicallyChallenged": False,
            "AppointmentDate": fake.date_between(start_date="-20y", end_date="-1y").isoformat()
        })
    seed_table("Employee", employees)

    # --- Phase 3: Cases & Transactions ---
    logger.info("\n--- Phase 3: Cases & Transactions (REAL SCALE) ---")
    
    # Volume target: ~8,000 cases
    NUM_CASES = 8000

    # 1. District Weights
    district_ids = list(range(1, 31))
    district_weights = [1.0] * 30
    # Bengaluru Urban (index 3) is 25%
    district_weights[3] = 25.0
    # Tier 2: Belagavi (index 2), Bengaluru Rural (index 4), Hassan (index 14), Mandya (index 20), Mysuru (index 21), Shimoga (index 24), Tumakuru (index 25) get 3.5% each
    for idx in [2, 4, 14, 20, 21, 24, 25]:
        district_weights[idx] = 3.5
    # Remainder split uniformly among remaining 22 districts
    rem_weight = (100.0 - 25.0 - 7 * 3.5) / 22.0
    for i in range(30):
        if i not in [3, 2, 4, 14, 20, 21, 24, 25]:
            district_weights[i] = rem_weight

    # 2. Crime Group Weights
    crime_groups_weights = [1.0] * len(CRIME_GROUPS)
    crime_weights_map = {
        "Motor Vehicle Accidents Non-Fatal": 14.5,
        "THEFT": 9.5,
        "CrPC cases": 8.2,
        "ASSAULT": 7.5,
        "Missing Person": 7.5,
        "Karnataka Police Act 1963": 6.4,
        "Karnataka State Local Act": 5.4,
        "Motor Vehicle Accidents Fatal": 5.0,
        "CYBERCRIME": 4.7,
        "CHEATING": 2.9,
        "Molestation": 2.6,
        "Public Safety": 2.5,
        "RIOTS": 2.2,
        "BURGLARY": 2.1,
        "NARCOTICS": 1.7
    }
    for cname, wt in crime_weights_map.items():
        if cname in CRIME_GROUPS:
            idx = CRIME_GROUPS.index(cname)
            crime_groups_weights[idx] = wt
    # Distribute the remaining ~15% across others
    sum_fixed = sum(crime_weights_map.values())
    rem_wt = (100.0 - sum_fixed) / (len(CRIME_GROUPS) - len(crime_weights_map))
    for i in range(len(CRIME_GROUPS)):
        if CRIME_GROUPS[i] not in crime_weights_map:
            crime_groups_weights[i] = rem_wt

    # 3. Months Seasonality Weights
    months_weights = [12.2, 13.1, 13.0, 12.0, 11.4, 11.5, 11.5, 11.3, 10.6, 10.6, 10.6, 10.6]

    # 4. Case Status Weights
    # "UNDER INVESTIGATION", "CHARGESHEETED", "CONVICTED", "ACQUITTED", "PENDING TRIAL", "CLOSED", "REFERRED", "COMPROMISED", "UNDETECTED", "BOUND OVER"
    status_weights = [1.0] * len(CASE_STATUSES)
    status_weights[CASE_STATUSES.index("PENDING TRIAL")] = 29.8
    status_weights[CASE_STATUSES.index("CONVICTED")] = 20.5
    status_weights[CASE_STATUSES.index("UNDETECTED")] = 11.2
    status_weights[CASE_STATUSES.index("ACQUITTED")] = 8.0
    status_weights[CASE_STATUSES.index("BOUND OVER")] = 6.7
    sum_status_fixed = 29.8 + 20.5 + 11.2 + 8.0 + 6.7
    rem_status_wt = (100.0 - sum_status_fixed) / (len(CASE_STATUSES) - 5)
    for i in range(len(CASE_STATUSES)):
        if CASE_STATUSES[i] not in ["PENDING TRIAL", "CONVICTED", "UNDETECTED", "ACQUITTED", "BOUND OVER"]:
            status_weights[i] = rem_status_wt

    cases = []
    complainants = []
    victims = []
    accused_list = []
    arrests = []
    chargesheets = []
    act_assocs = []
    arrest_accused = []
    occurrences = []

    acc_id_counter = 1
    arrest_id_counter = 1
    cs_id_counter = 1
    assoc_id_counter = 1
    link_id_counter = 1

    for i in range(NUM_CASES):
        cid = i + 1
        
        # 1. Seasonality Date
        month = random.choices(range(1, 13), weights=months_weights)[0]
        year = random.choice([2024, 2025, 2026])
        day = random.randint(1, 28)
        reg_date = datetime.date(year, month, day)

        # 2. Weighted District & Coordinate Bound
        dist_id = random.choices(district_ids, weights=district_weights)[0]
        
        # Map Coordinates based on District
        # Skew around Bengaluru center (12.97, 77.59) for District 4, else random Karnataka
        if dist_id == 4:
            lat = round(random.uniform(12.85, 13.10), 6)
            lng = round(random.uniform(77.45, 77.75), 6)
        else:
            lat = round(random.uniform(12.0, 17.5), 6)
            lng = round(random.uniform(74.0, 78.0), 6)

        # 3. Weighted Crime Group
        crime = random.choices(CRIME_GROUPS, weights=crime_groups_weights)[0]

        # 4. Strict Heinous (11.4%) vs. Non Heinous (88.6%)
        # GravityOffenceID: 1=Heinous, 2=Non Heinous
        gravity_id = random.choices([1, 2], weights=[11.4, 88.6])[0]

        # 5. Weighted Case Status
        status_id = random.choices(range(1, len(CASE_STATUSES) + 1), weights=status_weights)[0]

        cases.append({
            "CaseMasterID": cid,
            "CrimeNo": f"CR-{reg_date.year}-{random.randint(10000, 99999)}",
            "CaseNo": f"CASE-{reg_date.year}-{cid:05d}",
            "CrimeRegisteredDate": reg_date.isoformat(),
            "PolicePersonID": random.randint(1, 30),
            "PoliceStationID": random.randint(1, 30),
            "CaseCategoryID": random.randint(1, 4),
            "GravityOffenceID": gravity_id,
            "CrimeMajorHeadID": CRIME_GROUPS.index(crime) + 1,
            "CrimeMinorHeadID": random.randint(1, 20),
            "CaseStatusID": status_id,
            "CourtID": random.randint(1, 20),
            "IncidentFromDate": reg_date.isoformat(),
            "IncidentToDate": reg_date.isoformat(),
            "InfoReceivedPSDate": reg_date.isoformat(),
            "latitude": lat, "longitude": lng,
            "BriefFacts": f"Incident of {crime.lower()} reported at {fake.street_address().replace(chr(39), '')}. Official beat patrol logged."
        })

        complainants.append({
            "ComplainantID": cid, "CaseMasterID": cid,
            "ComplainantName": fake.name().replace("'", ""),
            "AgeYear": random.randint(18, 70),
            "OccupationID": random.randint(1, 10), "ReligionID": random.randint(1, 7),
            "CasteID": random.randint(1, 5), "GenderID": random.choice([1, 2])
        })

        # 6. Weighted Victim Profile
        # Male 64%, Female 28%, Boy 3.2%, Girl 4.8%
        v_profile = random.choices(
            [("Male", 1, 18, 75), ("Female", 2, 18, 75), ("Boy", 1, 2, 17), ("Girl", 2, 2, 17)],
            weights=[64.0, 28.0, 3.2, 4.8]
        )[0]
        
        victims.append({
            "VictimMasterID": cid, "CaseMasterID": cid,
            "VictimName": fake.name().replace("'", ""),
            "AgeYear": random.randint(v_profile[2], v_profile[3]),
            "GenderID": v_profile[1], "VictimPolice": random.choice(["0", "1"])
        })

        # 7. Outcome Funnel Seeding
        # Generate 1 or 2 Accused
        num_accused = random.randint(1, 2)
        for _ in range(num_accused):
            accused_list.append({
                "AccusedMasterID": acc_id_counter, "CaseMasterID": cid,
                "AccusedName": fake.name().replace("'", ""),
                "AgeYear": random.randint(18, 55),
                "GenderID": random.choice([1, 2]),
                "PersonID": f"PID-{random.randint(100000, 999999)}"
            })
            
            # Outcome Funnel: ~50% Arrest
            if random.random() <= 0.50:
                arrests.append({
                    "ArrestSurrenderID": arrest_id_counter, "CaseMasterID": cid,
                    "ArrestSurrenderTypeID": random.choice([1, 2]),
                    "ArrestSurrenderDate": fake.date_between(start_date=reg_date, end_date="today").isoformat(),
                    "ArrestSurrenderStateId": 1,
                    "ArrestSurrenderDistrictId": dist_id,
                    "PoliceStationID": random.randint(1, 30),
                    "IOID": random.randint(1, 30), "CourtID": random.randint(1, 20),
                    "AccusedMasterID": acc_id_counter,
                    "IsAccused": True, "IsComplainantAccused": False
                })
                arrest_accused.append({
                    "id": link_id_counter,
                    "ArrestSurrenderID": arrest_id_counter,
                    "AccusedMasterID": acc_id_counter
                })
                arrest_id_counter += 1
                link_id_counter += 1
                
            acc_id_counter += 1

        # Outcome Funnel: ~87% Chargesheet
        if random.random() <= 0.87:
            chargesheets.append({
                "CSID": cs_id_counter, "CaseMasterID": cid,
                "csdate": fake.date_between(start_date=reg_date, end_date="today").isoformat(),
                "cstype": random.choice(["Regular", "Supplementary"]),
                "PolicePersonID": random.randint(1, 30)
            })
            cs_id_counter += 1

        # Outcome Funnel: ~19% Convicted Overrides Status
        if random.random() <= 0.19:
            cases[-1]["CaseStatusID"] = CASE_STATUSES.index("CONVICTED") + 1

        # 8. Act / Section Weighted Associations
        act_sel = random.choices(
            [
                ("IPC", "379"), ("CrPC", "107"), ("KPA", "87"), ("IPC", "283"),
                ("IPC", "279"), ("IPC", "420"), ("IPC", "363"), ("IPC", "457"), ("NDPS", "27(b)"),
                ("random", "random")
            ],
            weights=[7.5, 4.7, 2.9, 1.9, 1.6, 1.5, 1.2, 1.1, 1.0, 76.6]
        )[0]
        
        if act_sel[0] == "random":
            a_idx = random.randint(1, 10)
            s_idx = random.randint(1, 20)
        else:
            # Look up indices from ACTS and IPC_SECTIONS
            act_idx_search = [a[0] for a in ACTS]
            a_idx = act_idx_search.index(act_sel[0]) + 1 if act_sel[0] in act_idx_search else 1
            sec_idx_search = [s[1] for s in IPC_SECTIONS]
            s_idx = sec_idx_search.index(act_sel[1]) + 1 if act_sel[1] in sec_idx_search else 1

        act_assocs.append({
            "id": assoc_id_counter, "CaseMasterID": cid,
            "ActID": a_idx, "SectionID": s_idx,
            "ActOrderID": 1, "SectionOrderID": 1
        })
        assoc_id_counter += 1

        occurrences.append({
            "id": cid, "CaseMasterID": cid, "OccurrenceDate": reg_date.isoformat()
        })

    # Bulk insert cases, complaints, victims, accused, arrests, chargesheets
    seed_table("CaseMaster", cases)
    seed_table("ComplainantDetails", complainants)
    seed_table("Victim", victims)
    seed_table("Accused", accused_list)
    seed_table("ArrestSurrender", arrests)
    seed_table("ChargesheetDetails", chargesheets)
    seed_table("ActSectionAssociation", act_assocs)
    seed_table("inv_arrestsurrenderaccused", arrest_accused)
    seed_table("Inv_OccuranceTime", occurrences)

    # --- Phase 4: Supplementary ---
    logger.info("\n--- Phase 4: Supplementary ---")

    # Seed Accident Reports & encode causes/severity/weather inside the Location string
    accident_causes = ["Human Error", "Vehicle Defect", "Road Environment Defect"]
    accident_causes_w = [79.4, 2.4, 0.4]
    
    accident_severities = ["Grievous Injury", "Simple Injury", "Fatal", "Damage Only"]
    accident_severities_w = [42.7, 23.5, 22.7, 8.2]
    
    accident_weathers = ["Clear", "Fine", "Cloudy", "Rain", "Fog", "Storm"]
    accident_weathers_w = [42.9, 32.2, 2.6, 12.3, 5.0, 5.0]
    
    accident_hitruns = ["No", "Yes", "Not Applicable"]
    accident_hitruns_w = [65.5, 16.5, 18.0]

    accident_rows = []
    for i in range(150):
        cause = random.choices(accident_causes, weights=accident_causes_w)[0]
        severity = random.choices(accident_severities, weights=accident_severities_w)[0]
        weather = random.choices(accident_weathers, weights=accident_weathers_w)[0]
        hitrun = random.choices(accident_hitruns, weights=accident_hitruns_w)[0]
        
        raw_loc = random.choice(ACCIDENT_LOCATIONS)
        loc_str = f"{raw_loc} (Cause: {cause} | Severity: {severity} | Weather: {weather} | Hit & Run: {hitrun})"
        
        accident_rows.append({
            "accident_reports_id": i+1,
            "CrimeNo": f"ACC-{random.randint(2024,2026)}-{random.randint(10000,99999)}",
            "Latitude": round(random.uniform(12.0, 17.5), 6),
            "Longitude": round(random.uniform(74.0, 78.0), 6),
            "Location": loc_str
        })
    seed_table("AccidentReports", accident_rows)

    months = ["January", "February", "March", "April", "May", "June",
              "July", "August", "September", "October", "November", "December"]
    seed_table("CrimeData", [
        {"crime_data_id": i+1,
         "major_crime_head": random.choice(CRIME_GROUPS),
         "crime_head_and_section": f"IPC {IPC_SECTIONS[i%20][1]} - {IPC_SECTIONS[i%20][0]}",
         "minor_crime_head": random.choice(CRIME_SUBHEADS),
         "commits": random.randint(1, 250),
         "crime_month": random.choice(months)}
        for i in range(100)
    ])

    logger.info("\n" + "=" * 60)
    logger.info("ALL DONE! Synthetic data seeding complete.")
    logger.info("=" * 60)

if __name__ == "__main__":
    main()
