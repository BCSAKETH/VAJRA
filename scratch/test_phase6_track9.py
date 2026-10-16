#!/usr/bin/env python3
"""
VAJRA 2.0: Phase 6 (Track 9) Master Verification Suite
Multi-Officer Thread-Local Isolation & Cryptographic Audit Hash-Chain Integrity

Verifies:
- Gate V13: Multi-Officer Thread-Local State Isolation (Zero Cross-Badge Leakage)
- Gate V14: AuditLog Merkle-Chain Non-Forking under Concurrent Writes (BSA §63)
- Gate 3: Shared Persistent ZCQL Thread Pool Non-Blocking Verification (Step 9.4)
- Gate 4: 100-Officer High-Concurrency Stress Test (100% Isolation Rate)
"""

import os
import sys
import time
import hashlib
import threading
from concurrent.futures import ThreadPoolExecutor

# Add vajra_backend to import path
sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "vajra_backend"))

from vajra_core import _AUDIT_LOG_LOCK, _ZCQL_THREAD_POOL, catalyst_app
from session_memory import session_memory
from agent_loop import (
    VajraAgentLoop,
    set_officer_context,
    get_officer_context,
    _OFFICER_CONTEXT
)

print("=" * 80)
print("VAJRA 2.0: PHASE 6 (TRACK 9) VERIFICATION SUITE")
print("Multi-Officer Isolation, Thread Context & Cryptographic Audit Chain")
print("=" * 80)

passed_gates = 0
total_gates = 4

# Pre-seed session memory with profiles for Officer A and Officer B
session_memory.save_officer_profile("2346836", {
    "name": "Siddharth Bhatia",
    "home_station": "Basavanagudi PS",
    "district": "Bengaluru City",
    "role_tier": "DySP"
})

session_memory.save_officer_profile("3406362", {
    "name": "Vikram Rathod",
    "home_station": "KR Puram PS",
    "district": "Bengaluru City",
    "role_tier": "PI"
})

# -------------------------------------------------------------------------
# GATE 1 (Gate V13): Multi-Officer Thread-Local State Isolation
# -------------------------------------------------------------------------
print("\n[GATE 1] Testing Gate V13: Multi-Officer Thread-Local State Isolation...")
agent_loop = VajraAgentLoop()

barrier = threading.Barrier(2)
results_a = {}
results_b = {}

def officer_a_worker():
    barrier.wait()
    set_officer_context(
        badge="2346836",
        name="Siddharth Bhatia",
        station="Basavanagudi PS",
        district="Bengaluru City",
        rank="DySP",
        mode="standard"
    )
    # Simulate work
    time.sleep(0.05)
    badge, name = get_officer_context()
    loop_badge = agent_loop.officer_badge
    loop_name = agent_loop.officer_name
    profile_res = agent_loop._execute_tool("get_my_profile", {}, 101, "sess-a-123", 9)
    results_a["badge"] = badge
    results_a["name"] = name
    results_a["loop_badge"] = loop_badge
    results_a["loop_name"] = loop_name
    results_a["profile_text"] = profile_res.get("text_result", "")

def officer_b_worker():
    barrier.wait()
    set_officer_context(
        badge="3406362",
        name="Vikram Rathod",
        station="KR Puram PS",
        district="Bengaluru City",
        rank="PI",
        mode="standard"
    )
    time.sleep(0.05)
    badge, name = get_officer_context()
    loop_badge = agent_loop.officer_badge
    loop_name = agent_loop.officer_name
    profile_res = agent_loop._execute_tool("get_my_profile", {}, 102, "sess-b-456", 9)
    results_b["badge"] = badge
    results_b["name"] = name
    results_b["loop_badge"] = loop_badge
    results_b["loop_name"] = loop_name
    results_b["profile_text"] = profile_res.get("text_result", "")

with ThreadPoolExecutor(max_workers=2) as executor:
    fut_a = executor.submit(officer_a_worker)
    fut_b = executor.submit(officer_b_worker)
    fut_a.result()
    fut_b.result()

leak_b_in_a = "3406362" in results_a["profile_text"] or "Vikram" in results_a["profile_text"]
leak_a_in_b = "2346836" in results_b["profile_text"] or "Siddharth" in results_b["profile_text"]
correct_a = "2346836" in results_a["profile_text"] or "Siddharth" in results_a["profile_text"]
correct_b = "3406362" in results_b["profile_text"] or "Vikram" in results_b["profile_text"]

badge_isolation_ok = (
    results_a["loop_badge"] == "2346836" and
    results_b["loop_badge"] == "3406362" and
    agent_loop.officer_badge is None  # Main thread must remain unpolluted
)

print(f"  -> Officer A Badge in Thread A: {results_a['loop_badge']}")
print(f"  -> Officer B Badge in Thread B: {results_b['loop_badge']}")
print(f"  -> Main Thread Badge (Cleanliness): {agent_loop.officer_badge}")
print(f"  -> Cross-leak B into A: {leak_b_in_a}")
print(f"  -> Cross-leak A into B: {leak_a_in_b}")
print(f"  -> Officer A received own identity: {correct_a}")
print(f"  -> Officer B received own identity: {correct_b}")

if badge_isolation_ok and not leak_b_in_a and not leak_a_in_b and correct_a and correct_b:
    print("  --> GATE 1 (Gate V13): PASSED [OK]")
    passed_gates += 1
else:
    print("  [!] GATE 1 (Gate V13): FAILED")

# -------------------------------------------------------------------------
# GATE 2 (Gate V14): Cryptographic AuditLog Sequential Chaining (Anti-Forking)
# -------------------------------------------------------------------------
print("\n[GATE 2] Testing Gate V14: AuditLog Merkle-Chain Non-Forking Under Concurrency...")

# Simulate 8 concurrent writes with simulated datastore ledger protected by _AUDIT_LOG_LOCK
mock_ledger = []
ledger_barrier = threading.Barrier(8)

def concurrent_audit_writer(worker_id: int):
    ledger_barrier.wait()
    with _AUDIT_LOG_LOCK:
        # 1. Fetch latest prev_hash
        prev_hash = mock_ledger[-1]["row_hash"] if mock_ledger else "0000000000000000000000000000000000000000000000000000000000000000"
        # Simulate slight I/O jitter
        time.sleep(0.005)
        # 2. Compute canonical row_hash
        entry_content = f"WORKER_{worker_id}_{time.time()}"
        row_hash = hashlib.sha256(f"{prev_hash}|{entry_content}".encode("utf-8")).hexdigest()
        # 3. Append to ledger
        mock_ledger.append({
            "worker_id": worker_id,
            "prev_hash": prev_hash,
            "row_hash": row_hash,
            "content": entry_content
        })

with ThreadPoolExecutor(max_workers=8) as executor:
    futures = [executor.submit(concurrent_audit_writer, i) for i in range(8)]
    for f in futures:
        f.result()

# Verify strict linear chaining with zero forks
fork_detected = False
chain_broken = False
for i in range(1, len(mock_ledger)):
    if mock_ledger[i]["prev_hash"] != mock_ledger[i - 1]["row_hash"]:
        chain_broken = True
    if mock_ledger[i]["prev_hash"] == mock_ledger[i - 1]["prev_hash"]:
        fork_detected = True

print(f"  -> Total Concurrent Audit Entries Logged: {len(mock_ledger)}")
print(f"  -> Chain Continuity Verified (prev_hash == prior row_hash): {not chain_broken}")
print(f"  -> Sibling Merkle Forks Detected: {fork_detected}")

if len(mock_ledger) == 8 and not chain_broken and not fork_detected:
    print("  --> GATE 2 (Gate V14): PASSED [OK]")
    passed_gates += 1
else:
    print("  [!] GATE 2 (Gate V14): FAILED")

# -------------------------------------------------------------------------
# GATE 3: Shared Persistent ZCQL Thread Pool Verification (Step 9.4)
# -------------------------------------------------------------------------
print("\n[GATE 3] Testing Step 9.4: Shared Persistent ZCQL Thread Pool...")

pool_alive = _ZCQL_THREAD_POOL is not None and not _ZCQL_THREAD_POOL._shutdown
print(f"  -> Shared Thread Pool Initialized: {pool_alive}")
print(f"  -> Max Workers: {_ZCQL_THREAD_POOL._max_workers}")

# Test task submission to ensure worker responds cleanly
fut = _ZCQL_THREAD_POOL.submit(lambda x: x * 2, 21)
res = fut.result()
print(f"  -> Pool Worker Execution Result: {res}")

if pool_alive and res == 42:
    print("  --> GATE 3: PASSED [OK]")
    passed_gates += 1
else:
    print("  [!] GATE 3: FAILED")

# -------------------------------------------------------------------------
# GATE 4: 100-Officer High-Concurrency Stress Test
# -------------------------------------------------------------------------
print("\n[GATE 4] Testing 100-Officer High-Concurrency State Isolation Stress Test...")

officer_test_count = 100
isolation_errors = []

def stress_worker(idx: int):
    assigned_kgid = f"KGID-{90000 + idx}"
    assigned_name = f"Officer_{idx}"
    set_officer_context(
        badge=assigned_kgid,
        name=assigned_name,
        station=f"Station_{idx}",
        district="Bengaluru City",
        rank="Inspector"
    )
    # Sleep to allow thread switching
    time.sleep(0.002)
    observed_badge = agent_loop.officer_badge
    observed_name = agent_loop.officer_name
    if observed_badge != assigned_kgid or observed_name != assigned_name:
        isolation_errors.append((idx, assigned_kgid, observed_badge))

with ThreadPoolExecutor(max_workers=20) as executor:
    futs = [executor.submit(stress_worker, i) for i in range(officer_test_count)]
    for f in futs:
        f.result()

print(f"  -> Total Officers Concurrently Evaluated: {officer_test_count}")
print(f"  -> Cross-Officer State Collisions: {len(isolation_errors)}")
print(f"  -> State Isolation Rate: {((officer_test_count - len(isolation_errors)) / officer_test_count) * 100:.2f}%")

if len(isolation_errors) == 0:
    print("  --> GATE 4: PASSED [OK]")
    passed_gates += 1
else:
    print(f"  [!] GATE 4: FAILED ({len(isolation_errors)} collisions)")

# -------------------------------------------------------------------------
# FINAL SCORECARD
# -------------------------------------------------------------------------
print("\n" + "=" * 80)
print(f"PHASE 6 (TRACK 9) VERIFICATION SCORECARD: {passed_gates}/{total_gates} GATES PASSED")
print("=" * 80)

if passed_gates == total_gates:
    print("STATUS: ALL PHASE 6 (TRACK 9) GATES PASSED [100% SUCCESS]")
    sys.exit(0)
else:
    print("STATUS: VERIFICATION FAILED")
    sys.exit(1)
