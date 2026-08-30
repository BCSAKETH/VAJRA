"""
VAJRA Cryptographic Audit Ledger Tampering Simulator
---------------------------------------------------
Simulates a malicious insider attack or unauthorized database tampering
by deliberately corrupting a row hash inside the AuditLog table.

After running this script:
The Supervisor Dashboard "VERIFY LEDGER CHAIN" will immediately sound the alarm:
"SECURITY ALERT: AuditLog block hash verification failed. Tampering detected!"
"""
import sys
import os
import hashlib

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from vajra_core import catalyst_app, zcql_update_row

def break_ledger():
    print("=" * 70)
    print("VAJRA TAMPERING SIMULATION ENGINE (MALICIOUS ATTACK DEMO)")
    print("=" * 70)
    
    if not catalyst_app:
        print("[ERROR] Could not initialize Zoho Catalyst connection.")
        return False
        
    print("[1/2] Fetching AuditLog records to select a target row (ROWID ASC)...")
    query = "SELECT ROWID, employee_id, action_type, logged_at, row_hash FROM AuditLog ORDER BY ROWID ASC"
    res = catalyst_app.zql().execute_query(query)
    
    if not res:
        print("[ERROR] No AuditLog records found.")
        return False
        
    # Pick a middle row to tamper
    target_idx = min(15, len(res) - 1)
    target_row = res[target_idx].get("AuditLog", {})
    rowid = target_row.get("ROWID")
    orig_hash = target_row.get("row_hash") or "unknown"
    
    corrupted_hash = "deadbeef" + hashlib.sha256(b"unauthorized_tampering_payload").hexdigest()[8:]
    
    print(f"\n[2/2] Injecting tampering payload into Block #{target_idx + 1} (ROWID: {rowid})...")
    print(f"      Original Hash : {orig_hash[:20]}...")
    print(f"      Tampered Hash : {corrupted_hash[:20]}...")
    
    zcql_update_row("AuditLog", {
        "ROWID": rowid,
        "row_hash": corrupted_hash
    })
    
    print("\n" + "=" * 70)
    print(f"ATTACK SIMULATED: Row #{target_idx + 1} has been maliciously modified in DB.")
    print("Supervisor Compliance Portal will now flag 'Inconsistent / Tampering Detected'.")
    print("=" * 70)
    return True

if __name__ == "__main__":
    break_ledger()
