import os
import json
import random
import logging
from typing import List, Dict, Any
import pandas as pd
from faker import Faker

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger(__name__)

fake = Faker('en_IN')

# Fallback presets in case CSV is not read
DISTRICTS: List[str] = ["Bengaluru Urban", "Mysuru", "Hubballi-Dharwad", "Mangaluru", "Belagavi"]
STATIONS: List[str] = ["Cubbon Park PS", "Indiranagar PS", "Koramangala PS", "Whitefield PS", "Jayanagar PS"]
CRIME_TYPES: List[str] = ["Theft", "Assault", "Cybercrime", "Fraud", "Narcotics"]

MODUS_OPERANDI_TEMPLATES = [
    {
        "crime": "Theft",
        "templates_en": ["Suspect targeted locked two-wheeler, broke handle lock, and fled.", "Suspect picked pockets in overcrowded bus station."],
        "templates_kn": ["ಶಂಕಿತ ದ್ವಿಚಕ್ರ ವಾಹನದ ಹ್ಯಾಂಡಲ್ ಲಾಕ್ ಮುರಿದು ಪರಾರಿಯಾಗಿದ್ದಾನೆ.", "ಕಿಕ್ಕಿರಿದ ಬಸ್ ನಿಲ್ದಾಣದಲ್ಲಿ ಶಂಕಿತ ಜೇಬುಗಳ್ಳತನ ಮಾಡಿದ್ದಾನೆ."]
    },
    {
        "crime": "Assault",
        "templates_en": ["Physical altercation occurred near residential block following arguments.", "Suspect confronted victim and caused injuries using blunt objects."],
        "templates_kn": ["ಮನೆ ಬಳಿ ಜಗಳ ನಡೆದು ಶಂಕಿತ ಹಲ್ಲೆ ನಡೆಸಿದ್ದಾನೆ.", "ಶಂಕಿತ ವಾಗ್ವಾದ ನಡೆಸಿ ಮಾರಕಾಸ್ತ್ರದಿಂದ ಗಾಯಗೊಳಿಸಿದ್ದಾನೆ."]
    },
    {
        "crime": "Cybercrime",
        "templates_en": ["Victim received phishing link promising cash rewards and lost funds.", "Suspect hacked victim's social account demanding ransom."],
        "templates_kn": ["ಲಾಟರಿ ಆಮಿಷದ ಫಿಶಿಂಗ್ ಲಿಂಕ್ ಮೂಲಕ ವಂಚನೆ ಮಾಡಲಾಗಿದೆ.", "ಸಾಮಾಜಿಕ ಜಾಲತಾಣ ಖಾತೆಯನ್ನು ಹ್ಯಾಕ್ ಮಾಡಿ ಹಣಕ್ಕಾಗಿ ಬೇಡಿಕೆ ಇಡಲಾಗಿದೆ."]
    }
]

def load_real_metadata() -> tuple[List[str], List[str], List[str]]:
    """
    Loads unique categories, districts, and stations from the real CSV file to ground faker.
    """
    script_dir = os.path.dirname(os.path.abspath(__file__))
    csv_path = os.path.join(script_dir, "..", "FIR_Details_Data.csv")
    
    if os.path.exists(csv_path):
        logger.info(f"Extracting grounding metadata categories from '{csv_path}'...")
        try:
            df = pd.read_csv(csv_path, usecols=['District_Name', 'UnitName', 'CrimeGroup_Name'], nrows=80000)
            districts = list(df['District_Name'].dropna().unique())
            stations = list(df['UnitName'].dropna().unique())
            crimes = list(df['CrimeGroup_Name'].dropna().unique())
            
            logger.info(f"Grounding metadata loaded: {len(districts)} districts, {len(stations)} stations, {len(crimes)} crime groups.")
            return districts, stations, crimes
        except Exception as e:
            logger.error(f"Error loading grounding CSV metadata: {e}. Reverting to defaults.")
            
    return DISTRICTS, STATIONS, CRIME_TYPES

def generate_vehicle_number() -> str:
    district_code = f"{random.randint(1, 55):02d}"
    series = "".join(random.choices("ABCDEFGHIJKLMNOPQRSTUVWXYZ", k=random.randint(1, 2)))
    num = f"{random.randint(1000, 9999)}"
    return f"KA-{district_code}-{series}-{num}"

def generate_burner_phone() -> str:
    prefix = random.choice(["6", "7", "8", "9"])
    rest = "".join(random.choices("0123456789", k=9))
    return f"+91-{prefix}{rest}"

def get_narrative(crime_type: str, suspect: str, vehicle: str, phone: str) -> tuple[str, str]:
    matching = [t for t in MODUS_OPERANDI_TEMPLATES if t["crime"].lower() in crime_type.lower()]
    if matching:
        tpl = random.choice(matching)
        en_base = random.choice(tpl["templates_en"])
        kn_base = random.choice(tpl["templates_kn"])
    else:
        en_base = f"Incident of {crime_type} was reported in the locality."
        kn_base = f"ಪ್ರದೇಶದಲ್ಲಿ {crime_type} ಪ್ರಕರಣ ದಾಖಲಾಗಿದೆ."
        
    en_narrative = f"{en_base} Suspect identified as '{suspect}'. Fled using vehicle {vehicle}. Phone: {phone}."
    kn_narrative = f"{kn_base} ಶಂಕಿತನನ್ನು '{suspect}' ಎಂದು ಗುರುತಿಸಲಾಗಿದೆ. {vehicle} ವಾಹನ ಬಳಸಿ ಪರಾರಿಯಾಗಿದ್ದಾನೆ. ಫೋನ್: {phone}."
    return en_narrative, kn_narrative

def generate_synthetic_data(num_records: int = 500, output_file: str = "synthetic_fir_data.json"):
    districts, stations, crimes = load_real_metadata()
    logger.info(f"Generating {num_records} synthetic narratives grounded in real Karnataka geography...")
    records = []
    
    for i in range(num_records):
        district = random.choice(districts)
        station = random.choice(stations)
        crime_type = random.choice(crimes)
        suspect = fake.name()
        vehicle = generate_vehicle_number()
        phone = generate_burner_phone()
        
        narrative_en, narrative_kn = get_narrative(crime_type, suspect, vehicle, phone)
        
        # Karnataka boundaries approx: Lat 11.5 to 18.5, Lng 74.0 to 78.5
        lat = round(random.uniform(12.0, 17.5), 6)
        lng = round(random.uniform(74.0, 78.0), 6)
        
        records.append({
            "fir_id": f"FIR-2026-{random.randint(100000, 999999)}",
            "district": district,
            "station": station,
            "crime_type": crime_type,
            "suspect_name": suspect,
            "vehicle_number": vehicle,
            "burner_phone": phone,
            "narrative_english": narrative_en,
            "narrative_kannada": narrative_kn,
            "latitude": lat,
            "longitude": lng,
            "mo_vector": [
                round(random.uniform(0.0, 1.0), 3),
                round(random.uniform(0.0, 1.0), 3),
                round(random.uniform(0.0, 1.0), 3),
                round(random.uniform(0.0, 1.0), 3),
                round(random.uniform(0.0, 1.0), 3)
            ],
            "feature_age": random.randint(18, 65),
            "feature_previous_crimes": random.randint(0, 8),
            "feature_severity_index": round(random.uniform(0.1, 0.95), 2),
            "feature_crime_hour": random.randint(0, 23),
            "feature_crime_day_of_week": random.randint(0, 6)
        })
        
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(records, f, ensure_ascii=False, indent=2)
        
    logger.info(f"Successfully generated and wrote {len(records)} records to {output_file}")

if __name__ == "__main__":
    generate_synthetic_data()
