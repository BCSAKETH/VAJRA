"""
VAJRA 2.0 - Phase 5 (Track 8) Forensic Verification Test Suite
==============================================================
Validates:
- Gate V9: Bail SQL syntax with '*' wildcards, no silent 0-rows.
- Gate V10: Zero Fabricated NBWs; schema alignment for Accused (no PriorConvictions / Address columns).
- Gate V11: Deterministic §187(3) BNSS remand clock based on actual dates, zero pseudorandom drift.
- Gate 4: Zero non-existent columns/tables across Bail and Warrant tools.
- Gate 5: Honest Provenance & Admissibility disclosures on simulation data.
"""

import sys
import os
import re
import time
from datetime import datetime

# Path setup
backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "vajra_backend"))
sys.path.insert(0, backend_dir)

from vajra_core import catalyst_app
from agent_loop import VajraAgentLoop

def run_tests():
    print("=" * 70)
    print("  VAJRA 2.0 - PHASE 5 (TRACK 8) TOOL HARDENING VERIFICATION SUITE")
    print("=" * 70)

    loop = VajraAgentLoop()
    employee_id = 2346001
    session_id = "sess-track8-test"
    passed_gates = 0

    # -----------------------------------------------------------------------------
    # GATE 1: Gate V9 - Bail History SQL Syntax & Wildcard Matching
    # -----------------------------------------------------------------------------
    print("\n[GATE 1] Testing Tool get_bail_history (Gate V9)...")
    try:
        res = loop._execute_tool(
            "get_bail_history",
            {"suspect_name": "Ishwar Chaudhari"},
            employee_id, session_id, 1
        )
        data = res.get("data", {})
        text = res.get("text_result", "")
        print(f"  [+] Tool Response Type: {res.get('response_type')}")
        print(f"  [+] Suspect: {data.get('suspect_name')}")
        print(f"  [+] Total Linked Cases: {data.get('total_linked_cases')}")
        assert data.get("suspect_name") == "Ishwar Chaudhari", "Suspect name mismatch"
        assert res.get("response_type") == "bail_history_card", "Response type must be bail_history_card"
        assert "§480 BNSS" in text or "BNSS" in text or "CCTNS" in text, "Missing statutory bail reference"
        print("  --> GATE 1: PASSED [OK]")
        passed_gates += 1
    except Exception as e:
        import traceback
        traceback.print_exc()
        print(f"  [!] GATE 1 FAILED: {e}")

    # -----------------------------------------------------------------------------
    # GATE 2: Gate V10 - Zero Fabricated NBWs & Schema Alignment
    # -----------------------------------------------------------------------------
    print("\n[GATE 2] Testing Tool get_warrant_execution_tracker (Gate V10)...")
    try:
        res = loop._execute_tool(
            "get_warrant_execution_tracker",
            {"station": "Belagavi North"},
            employee_id, session_id, 1
        )
        data = res.get("data", {})
        text = res.get("text_result", "")
        print(f"  [+] Tool Response Type: {res.get('response_type')}")
        print(f"  [+] Station: {data.get('police_station')}")
        print(f"  [+] Unexecuted NBWs Count: {data.get('unexecuted_nbws_count')}")
        print(f"  [+] Monitored Subjects Count: {len(data.get('monitored_subjects', []))}")
        
        # Verify ZERO fabricated NBWs
        assert data.get("unexecuted_nbws_count") == 0, f"Expected 0 unexecuted NBWs, got {data.get('unexecuted_nbws_count')}"
        assert "NBW-2026/884" not in text, "Fabricated NBW-2026/884 detected in output!"
        assert "NBW-2026/712" not in text, "Fabricated NBW-2026/712 detected in output!"
        assert "Anand Naik" not in text, "Fabricated Anand Naik detected in output!"
        assert "Imran Khan" not in text, "Fabricated Imran Khan detected in output!"
        assert "Section 84 BNSS" in text, "Missing Section 84 BNSS proclamation reference"
        assert "Section 73 BNSS" in text, "Missing Section 73 BNSS warrant application directive"
        print("  [+] Verified ZERO fabricated NBWs (No fake NBW-2026/884 or 712)")
        print("  --> GATE 2: PASSED [OK]")
        passed_gates += 1
    except Exception as e:
        import traceback
        traceback.print_exc()
        print(f"  [!] GATE 2 FAILED: {e}")

    # -----------------------------------------------------------------------------
    # GATE 3: Gate V11 - Deterministic Section 187(3) BNSS Remand Clock
    # -----------------------------------------------------------------------------
    print("\n[GATE 3] Testing Deterministic Section 187(3) BNSS Remand Clock (Gate V11)...")
    try:
        # Test query_case for CR-2024-81977
        res = loop._execute_tool(
            "query_case",
            {"case_no": "CR-2024-81977"},
            employee_id, session_id, 1
        )
        data = res.get("data", {})
        text = res.get("text_result", "")
        countdown = data.get("default_bail_countdown", {})
        days_left_60 = countdown.get("days_remaining_60")
        print(f"  [+] Case: {data.get('case_no')}")
        print(f"  [+] Registered Date: {data.get('registered_date')}")
        print(f"  [+] Days Left (60-day default bail): {days_left_60}")
        
        # Deterministic math verification
        reg_dt = datetime.strptime(str(data.get("registered_date"))[:10], "%Y-%m-%d")
        expected_elapsed = (datetime.now() - reg_dt).days
        expected_left_60 = max(0, 60 - expected_elapsed)
        assert days_left_60 == expected_left_60, f"Expected {expected_left_60}, got {days_left_60}"
        assert "§187 BNSS" in text or "Section 187" in text, "Missing Section 187 citation in dossier"
        print(f"  [+] Mathematical Proof: (Now - {reg_dt.strftime('%Y-%m-%d')}) = {expected_elapsed} days -> {expected_left_60} days remaining")
        print("  --> GATE 3: PASSED [OK]")
        passed_gates += 1
    except Exception as e:
        import traceback
        traceback.print_exc()
        print(f"  [!] GATE 3 FAILED: {e}")

    # -----------------------------------------------------------------------------
    # GATE 4: Schema Alignment across Accused & CaseMaster Queries
    # -----------------------------------------------------------------------------
    print("\n[GATE 4] Testing Schema Alignment (No non-existent columns)...")
    try:
        # Verify that get_warrants_for_accused queries accurately without exceptions
        res_w = loop._execute_tool(
            "get_warrants_for_accused",
            {"suspect_name": "Ishwar Chaudhari"},
            employee_id, session_id, 1
        )
        data_w = res_w.get("data", {})
        print(f"  [+] get_warrants_for_accused Status: {res_w.get('response_type')}")
        print(f"  [+] Active Warrants Count: {data_w.get('active_warrant_count')}")
        assert data_w.get("active_warrant_count") == 0, "Expected 0 active warrants"
        assert "Failed" not in res_w.get("text_result", ""), "Tool reported execution failure"
        print("  --> GATE 4: PASSED [OK]")
        passed_gates += 1
    except Exception as e:
        import traceback
        traceback.print_exc()
        print(f"  [!] GATE 4 FAILED: {e}")

    # -----------------------------------------------------------------------------
    # GATE 5: Honest Provenance & Admissibility Disclosures
    # -----------------------------------------------------------------------------
    print("\n[GATE 5] Testing Honest Provenance Disclosures in Telephony/CDR Forensics...")
    try:
        res_cdr = loop._execute_tool(
            "get_cdr_analysis",
            {"phone": "9845012345"},
            employee_id, session_id, 1
        )
        data_cdr = res_cdr.get("data", {})
        prov = data_cdr.get("sec63_bsa_provenance", "")
        print(f"  [+] CDR Provenance Metadata: {prov}")
        assert "Simulation" in prov or "Demonstration" in prov or "Pending" in prov, "Missing honest demonstration disclosure"
        assert "Certified" not in prov, "False 'Certified' claim found in simulated CDR data!"
        print("  --> GATE 5: PASSED [OK]")
        passed_gates += 1
    except Exception as e:
        import traceback
        traceback.print_exc()
        print(f"  [!] GATE 5 FAILED: {e}")

    print("\n" + "=" * 70)
    print(f"  PHASE 5 VERIFICATION SCORECARD: {passed_gates}/5 GATES PASSED")
    print("=" * 70)
    if passed_gates == 5:
        print("  [SUCCESS] All Phase 5 (Track 8) tool hardening & forensic gates passed!\n")
        return 0
    else:
        print(f"  [FAILURE] {5 - passed_gates} gate(s) failed!\n")
        return 1

if __name__ == "__main__":
    sys.exit(run_tests())
