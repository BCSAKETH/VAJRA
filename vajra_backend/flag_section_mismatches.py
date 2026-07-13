# Classification-consistency flagging Job Function for Zoho Catalyst
import os
import json
import logging
from datetime import datetime
from dotenv import load_dotenv

load_dotenv(dotenv_path=os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env"))
from vajra_core import catalyst_app

logger = logging.getLogger("flag_section_mismatches")
logging.basicConfig(level=logging.INFO)

def run_consistency_check():
    logger.info("Initializing Legal Classification Consistency Check...")
    if not catalyst_app:
        logger.error("Zoho Catalyst SDK not initialized.")
        return
        
    try:
        # 1. Fetch recent cases from CaseMaster
        logger.info("Fetching CaseMaster records...")
        cases_res = catalyst_app.zql().execute_query(
            "SELECT CaseMasterID, CrimeNo, CrimeMajorHeadID FROM CaseMaster LIMIT 100"
        )
        
        flagged_count = 0
        
        for r in cases_res:
            cm = r.get("CaseMaster", {})
            case_id = cm.get("CaseMasterID")
            crime_no = cm.get("CrimeNo")
            major_head_id = cm.get("CrimeMajorHeadID")
            
            if not case_id or not major_head_id:
                continue
                
            # 2. Get recorded sections for this case
            recorded_sections = []
            try:
                assoc_query = f"SELECT SectionID FROM ActSectionAssociation WHERE CaseMasterID = {case_id}"
                assoc_res = catalyst_app.zql().execute_query(assoc_query)
                for assoc_row in assoc_res:
                    sec_id = assoc_row.get("ActSectionAssociation", {}).get("SectionID")
                    if sec_id:
                        sec_query = f"SELECT SectionCode, ActCode FROM Section WHERE ROWID = {sec_id}"
                        sec_res = catalyst_app.zql().execute_query(sec_query)
                        if sec_res:
                            sec_data = sec_res[0].get("Section", {})
                            recorded_sections.append(f"{sec_data.get('ActCode')} {sec_data.get('SectionCode')}")
            except Exception as e:
                logger.warning(f"Error querying recorded sections for case {case_id}: {e}")
            
            # 3. Get suggested sections from CrimeHeadActSection mapping
            suggested_sec = "IPC 379"
            try:
                map_res = catalyst_app.zql().execute_query(
                    f"SELECT ActCode, SectionCode FROM CrimeHeadActSection WHERE CrimeHeadID = {major_head_id} LIMIT 1"
                )
                if map_res:
                    map_data = map_res[0].get("CrimeHeadActSection", {})
                    suggested_sec = f"{map_data.get('ActCode')} {map_data.get('SectionCode')}"
            except Exception as e:
                logger.warning(f"Error querying suggested mapping for MajorHead {major_head_id}: {e}")
                
            # 4. Check consistency
            is_consistent = any(suggested_sec.lower() in rec.lower() for rec in recorded_sections) if recorded_sections else False
            
            if not is_consistent:
                try:
                    exists_res = catalyst_app.zql().execute_query(
                        f"SELECT ROWID FROM ConsistencyFlags WHERE case_id = {case_id} LIMIT 1"
                    )
                    if not exists_res:
                        # Write divergence to ConsistencyFlags
                        row = {
                            "case_id": case_id,
                            "recorded_section": ", ".join(recorded_sections) if recorded_sections else "None",
                            "suggested_section": suggested_sec,
                            "confidence_score": 0.95,
                            "reviewed": 0,
                            "flagged_at": datetime.utcnow().isoformat()
                        }
                        catalyst_app.datastore().table("ConsistencyFlags").insert_row(row)
                        logger.info(f"Flagged inconsistency for Case {crime_no} (CaseID: {case_id}): recorded={recorded_sections}, suggested={suggested_sec}")
                        flagged_count += 1
                except Exception as ex:
                    logger.error(f"Error inserting consistency flag: {ex}")
                    
        logger.info(f"Consistency check finished. Flagged {flagged_count} new classification mismatches.")
        
    except Exception as e:
        logger.error(f"Error running classification consistency job: {e}")

if __name__ == "__main__":
    run_consistency_check()
