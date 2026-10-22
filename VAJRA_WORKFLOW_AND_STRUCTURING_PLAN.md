# VAJRA 3.0 WORKFLOW AUDIT & MASTER STRUCTURING PLAN
## Single-Session Reporting Root-Cause Fix & Autonomous Subsystem Blueprint

**Classification:** STRICTLY CONFIDENTIAL // KARNATAKA POLICE TECHNICAL HEADQUARTERS  
**System:** VAJRA Tier-3 Law Enforcement Operating System & Sentinel Copilot  
**Author:** VAJRA 3.0 Principal Systems Architect & Lead QA Engineer  
**Date:** October 2026 (Live Audit & Structuring Plan)  
**Parent Audits:** [VAJRA_COMPREHENSIVE_SYSTEM_AUDIT.md](file:///c:/Users/B.C%20SAKETH/Downloads/VAJRA-main/VAJRA_COMPREHENSIVE_SYSTEM_AUDIT.md), [PHASE_2_ADVANCED_SUBSYSTEMS.md](file:///c:/Users/B.C%20SAKETH/Downloads/VAJRA-main/PHASE_2_ADVANCED_SUBSYSTEMS.md), [PHASE_3_FINAL_INTELLIGENCE.md](file:///c:/Users/B.C%20SAKETH/Downloads/VAJRA-main/PHASE_3_FINAL_INTELLIGENCE.md), [VAJRA_DIAGNOSTIC_AND_DEBT_REPORT.md](file:///c:/Users/B.C%20SAKETH/Downloads/VAJRA-main/VAJRA_DIAGNOSTIC_AND_DEBT_REPORT.md)

---

## EXECUTIVE SUMMARY

This report executes two critical directives:
1. **Target 1: Root-Cause Analysis and Code Fix for the "One Session Only" Reporting Bug:** Diagnoses why reports submitted from [`RemoteEvictionModal.tsx`](file:///c:/Users/B.C%20SAKETH/Downloads/VAJRA-main/src/components/RemoteEvictionModal.tsx) succeed over HTTP but never appear on the [SupervisorDashboardScreen.tsx](file:///c:/Users/B.C%20SAKETH/Downloads/VAJRA-main/src/screens/SupervisorDashboardScreen.tsx).
2. **Target 2: Autonomous Systems Structuring Plan (Memory, Sub-Agents & Vak Mascot Synergy):** Formulates a 3-tier memory hierarchy, a deterministic agent ticket handoff protocol, and an active emblem/state link connecting the precinct divisions to the Sentinel Owl mascot.

---

# TARGET 1: THE "ONE SESSION PER USER" REPORTING BUG

### 1.1 Architectural Trace Across the Stack

```
                             TELEMETRY & REPORT TRACE
                             
  1. USER TERMINAL (EVICTED)                           3. SUPERVISOR DASHBOARD
  RemoteEvictionModal.tsx                              SupervisorDashboardScreen.tsx
  -----------------------                              -----------------------------
  Clicks: "Report to supervisor"                       Polls: GET /api/security/unrecognized-logins
  POST -> /api/security/report-unauthorized-eviction   Expects: { pending: [ ... ] }
  Payload: { badge_no, token, note }                   Result: [] (EMPTY LIST)
           |                                                      ^
           v                                                      |
  2. BACKEND API (main.py)                             4. BACKEND QUERY MISMATCH (main.py:11590)
  report_unauthorized_eviction_endpoint                -----------------------------------------
  -------------------------------------                SELECT ROWID, AlertType, AlertMessage,
  WRITES TO ProactiveAlerts:                           TriggerTime, IsRead FROM ProactiveAlerts
  • AlertType: "UNAUTHORIZED_LOGOUT_ALERT"             WHERE AlertType = 'UNAUTHORIZED_LOGOUT_ALERT'
  • Status: "ACTIVE"                                   ORDER BY ROWID DESC
  • CreatedTime: datetime.utcnow()                     
  • Severity: "CRITICAL"                               >>> FAIL 1: Column 'TriggerTime' was omitted
                                                           on INSERT! ZCQL returns null/empty.
                                                       >>> FAIL 2: Column 'IsRead' was omitted
                                                           on INSERT! Defaults or evaluates to true!
                                                       >>> FAIL 3: Column 'DistrictID' was omitted!
```

### 1.2 Deep Forensic Analysis: The Exact Insertion Mismatch
Look at the insertion block in [`vajra_backend/main.py`](file:///c:/Users/B.C%20SAKETH/Downloads/VAJRA-main/vajra_backend/main.py#L911-L917):

```python
# Lines 911-917 in vajra_backend/main.py (THE BUG):
zcql_insert_row("ProactiveAlerts", {
    "AlertType": "UNAUTHORIZED_LOGOUT_ALERT",
    "AlertMessage": json.dumps(alert_payload),
    "Status": "ACTIVE",
    "Severity": "CRITICAL",
    "CreatedTime": datetime.utcnow().isoformat()
})
```

Now examine the ZCQL query executed by [`list_unrecognized_logins`](file:///c:/Users/B.C%20SAKETH/Downloads/VAJRA-main/vajra_backend/main.py#L11589-L11596):

```python
# Lines 11589-11596 in vajra_backend/main.py:
res = catalyst_app.zql().execute_query(
    "SELECT ROWID, AlertType, AlertMessage, TriggerTime, IsRead FROM ProactiveAlerts "
    "WHERE AlertType = 'UNAUTHORIZED_LOGOUT_ALERT' OR AlertType = 'ACCOUNT_LOCKOUT_ALERT' "
    "ORDER BY ROWID DESC LIMIT 60")
for r in res:
    a = r.get("ProactiveAlerts", {})
    if a.get("IsRead") is True:
        continue
    ...
    m["trigger_time"] = a.get("TriggerTime")
```

#### Why it fails:
1. **Schema Field Name Discrepancy (`TriggerTime` vs `CreatedTime`):**
   The insert writes `CreatedTime`, but the read query strictly selects `TriggerTime`. In Zoho Catalyst Data Store, columns not populated default to `NULL`.
2. **Boolean `IsRead` Flag Omission:**
   The insertion did not set `IsRead: False`. In ZCQL table definitions with default constraints or nullable booleans, unassigned boolean columns can resolve as boolean truthy or trip the filter `if a.get("IsRead") is True: continue`.
3. **Missing `DistrictID`:**
   In `ProactiveAlerts`, every standard system alert includes `DistrictID` for jurisdictional scoping. When `DistrictID` is omitted, downstream supervisor filters configured for the supervisor's station/district drop the unassigned record.

---

### 1.3 The Exact Backend Code Fix

#### File: [`vajra_backend/main.py`](file:///c:/Users/B.C%20SAKETH/Downloads/VAJRA-main/vajra_backend/main.py#L911-L918)
```python
<<<< PREVIOUS BROKEN CODE (Lines 911-917)
            zcql_insert_row("ProactiveAlerts", {
                "AlertType": "UNAUTHORIZED_LOGOUT_ALERT",
                "AlertMessage": json.dumps(alert_payload),
                "Status": "ACTIVE",
                "Severity": "CRITICAL",
                "CreatedTime": datetime.utcnow().isoformat()
            })

==== NEW HARDENED CODE (Lines 911-921)
            now_iso = datetime.utcnow().isoformat()
            zcql_insert_row("ProactiveAlerts", {
                "AlertType": "UNAUTHORIZED_LOGOUT_ALERT",
                "AlertMessage": json.dumps(alert_payload),
                "DistrictID": unit_id if 'unit_id' in locals() and unit_id else 1,
                "TriggerTime": now_iso,
                "CreatedTime": now_iso,
                "Severity": "CRITICAL",
                "Status": "ACTIVE",
                "IsRead": False
            })
>>>>
```

#### File: [`vajra_backend/main.py`](file:///c:/Users/B.C%20SAKETH/Downloads/VAJRA-main/vajra_backend/main.py#L11593-L11604)
Harden the supervisor fetch query to handle both `CreatedTime` and `TriggerTime` fallbacks gracefully:

```python
<<<< PREVIOUS READ LOOP (Lines 11593-11604)
            for r in res:
                a = r.get("ProactiveAlerts", {})
                if a.get("IsRead") is True:
                    continue
                try:
                    m = json.loads(a.get("AlertMessage") or "{}")
                except Exception:
                    continue
                m["rowid"] = a.get("ROWID")
                m["trigger_time"] = a.get("TriggerTime")
                m["alert_type"] = a.get("AlertType")
                out.append(m)

==== NEW HARDENED READ LOOP (Lines 11593-11606)
            for r in res:
                a = r.get("ProactiveAlerts", {})
                # Strictly check for true, ignore null/None
                if a.get("IsRead") is True or a.get("IsRead") == "true":
                    continue
                try:
                    m = json.loads(a.get("AlertMessage") or "{}")
                except Exception:
                    continue
                m["rowid"] = a.get("ROWID")
                # Fallback between TriggerTime and CreatedTime
                m["trigger_time"] = a.get("TriggerTime") or a.get("CreatedTime") or m.get("reported_at")
                m["alert_type"] = a.get("AlertType")
                out.append(m)
>>>>
```

---

# TARGET 2: AGENT, VAK, & MEMORY MASTER STRUCTURING PLAN

```
                        VAJRA 3.0 TRI-TIER AUTONOMOUS ARCHITECTURE
                        
 +---------------------------------------------------------------------------------------+
 |                            COGNITIVE MEMORY SYSTEM (ZCQL + REDIS)                     |
 |  [Tier 1: Ephemeral Context]    [Tier 2: Active Case Dockets]   [Tier 3: Institutional]
 |  • Pronoun unbinding            • FIR facts & witnesses        • Penal statute dict  |
 |  • Rolling 6-turn buffer        • §63 BSA hash seals           • KSP jurisdictional  |
 |  • Auto-flushed on topic switch • Persistent across sessions   • Permanent offline   |
 +-------------------------------------------+-------------------------------------------+
                                             ^
                                             |
 +-------------------------------------------+-------------------------------------------+
 |                    PAPERCLIP AUTONOMOUS AGENT ORCHESTRATOR                            |
 |                                                                                       |
 |  [CYBER DIVISION]          [LEGAL DIVISION]             [FORENSICS DIVISION]          |
 |  Insp. Pradeep K.          PP Deshpande                 Dr. Ananya Sharma             |
 |  • 1930 Portal & Mule Ring • BNSS §187 Custody Clocks   • MuJoCo Crash Physics        |
 |  • UPI & Bank Freeze Docs  • 60/90-Day Default Bail     • 3D Ballistic Trajectories   |
 +-------------------------------------------+-------------------------------------------+
                                             | (PubSub Emblems & Heartbeats)
                                             v
 +---------------------------------------------------------------------------------------+
 |                         VAJRA-VAK SENTINEL OWL EMOTE & OPTICS                         |
 |  • Chest Core: Pulses Cyan/Gold/Crimson depending on active division                  |
 |  • Head Visor: Displays Departmental Crest (Cyber Shield / Scales of Justice / FSL)   |
 |  • Eye Gaze: Locks to Active Panel during Autonomous Handoff                          |
 +---------------------------------------------------------------------------------------+
```

---

## 2.1 COGNITIVE MEMORY STRUCTURING PLAN (`session_memory.py`)

### Problem Identified:
Currently, `session_memory.py` uses an ad-hoc dictionary (`_LOCAL_MICRO_MEMORY`) and basic Catalyst Cache keys (`session:{id}:graph`). Over multi-turn interrogations, active suspects and entities from prior queries poison downstream searches (e.g., investigating a robbery in Belagavi after asking about a chain snatching in Bengaluru pulls old suspect names into pronoun resolution).

### The Proposed 3-Tier Memory Architecture:

```
+-----------------------------------------------------------------------------------+
| TIER 1: WORKING CONTEXT (Ephemeral / Rolling Turn Buffer)                        |
| • Scope: Active conversation thread.                                              |
| • TTL: 30 minutes of operator inactivity.                                         |
| • Structure: FIFO Sliding Window of 6 turns + Unbinding regex.                    |
| • Unbinding Rule: Emits `shift_context_topic()` when queries contain reset cues   |
|   ("forget him", "start new case", "ಬೇರೆ ಪ್ರಕರಣ").                                |
+-----------------------------------------------------------------------------------+
                                      |
                                      v
+-----------------------------------------------------------------------------------+
| TIER 2: EPISODIC CASE DOCKET (Durable Investigation Memory)                       |
| • Scope: Tied to canonical `CrimeNo` (e.g., `CR-2026-55018`).                     |
| • Persistence: ZCQL Table `InvestigationCaseLink` + `CaseMaster`.                 |
| • Data: Verified Accused IDs, Seized Malkhana properties, FSL lab reports,       |
|   and Section 63 BSA SHA-256 evidence digests.                                   |
| • Protection: Read-only; cannot be cleared by conversational resets.              |
+-----------------------------------------------------------------------------------+
                                      |
                                      v
+-----------------------------------------------------------------------------------+
| TIER 3: INSTITUTIONAL FACT VAULT (Immutable Law Enforcement Knowledge)            |
| • Scope: System-wide across all officers and stations.                            |
| • Structure: Offline JSON dictionary & Spatial Pre-index (NumPy binary arrays).   |
| • Data: BNS/BNSS/BSA statute concordances, police station GPS polygons,          |
|   and 118 Crime Group hierarchy maps.                                             |
+-----------------------------------------------------------------------------------+
```

---

## 2.2 AGENT ORCHESTRATION & DYNAMIC HANDOFF PROTOCOL (`paperclip_orchestrator.py`)

### Problem Identified:
`paperclip_orchestrator.py` currently loads departmental leads (Cyber, Legal, Forensics) and tickets from `paperclip_tickets.json`, but operates as a passive ticker rather than an active multi-agent delegator. When a complex query arrives, the main agent loop in `vajra_core.py` executes monolithically rather than handing off sub-tasks.

### The Proposed Agent Handoff Protocol:

```
                            DISPATCH CYCLE & TICKET PIPELINE
                            
    OFFICER QUERY: "Accused Raju arrested 52 days ago with country pistol in hit-and-run"
                                          |
                                          v
                         +---------------------------------+
                         | VAJRA TIER-3 COGNITIVE DISPATCH |
                         | (paperclip_orchestrator.py)     |
                         +----------------+----------------+
                                          |
               +--------------------------+--------------------------+
               |                          |                          |
               v                          v                          v
      [LEGAL SUB-AGENT]          [FORENSICS SUB-AGENT]       [CYBER SUB-AGENT]
      PP Deshpande               Dr. Ananya Sharma           Insp. Pradeep K.
      -----------------          ---------------------       -----------------
      • Evaluates BNSS § 187     • Computes MuJoCo Crash     • Traces Hawala /
        custody clock              skid velocity ($v=\sqrt{2\mu gd}$)  Mule Accounts
      • Flags 8 days to default  • Solves 3D ballistic       • Freezes 1930
        bail release               trajectory (§ 109 BNS)      bank dockets
               |                          |                          |
               +--------------------------+--------------------------+
                                          |
                                          v
                         +---------------------------------+
                         | CONSOLIDATED MASTER DOSSIER     |
                         | - Unified Evidence Ledger       |
                         | - Section 63 BSA Tamper Stamp   |
                         | - Tactical Prosecution Strategy |
                         +---------------------------------+
```

#### Deterministic Delegation Specs:
1. **The Handoff Schema:**
   The orchestrator exposes `dispatch_subagent_task(department, task_payload, timeout_sec=15)`.
2. **Quota Guards:**
   Before a sub-agent executes, `check_token_budget(department)` verifies that the department has not exceeded its daily token cap (Cyber: 50k, Legal: 40k, Forensics: 60k).
3. **Structured Ticket Lifecycle:**
   Tickets transition through `SCHEDULED` $\to$ `PROCESSING` $\to$ `AUDITED_BSA63` $\to$ `CLOSED`. If an agent times out or crashes, the ticket is flagged `DEGRADED_FALLBACK`, alerting the primary copilot without crashing the user session.

---

## 2.3 VAJRA-VAK MASCOT SYNERGY PLAN (`VajraVakMascot.tsx` & Event Bus)

### Problem Identified:
While the Mascot FSM handles basic typing, thinking, and alert states, it lacks departmental awareness. When a sub-agent (e.g. Dr. Ananya running ballistic trajectories) executes, the mascot shows a generic amber thinking indicator.

### Proposed Visual & Emote Architecture:

#### 1. Departmental State & Color Matrix:
Link the sub-agent division directly to the Mascot's **Optical Sensors** and **Chest Core Aperture**:

```typescript
export interface DepartmentEmblemConfig {
  department: "cyber" | "legal" | "forensics" | "surveillance" | "standard";
  opticColor: string;
  coreGlow: string;
  visorEmblemPath: string;
  quipSubtitle: string;
}

export const VAK_DEPARTMENT_THEMES: Record<string, DepartmentEmblemConfig> = {
  cyber: {
    department: "cyber",
    opticColor: "#0EA5E9", // Sky Blue
    coreGlow: "rgba(14, 165, 233, 0.4)",
    visorEmblemPath: "M100 45 L112 55 L108 72 L100 68 L92 72 L88 55 Z", // Cyber Shield
    quipSubtitle: "Cyber Division • 1930 Mule Telematics Active"
  },
  legal: {
    department: "legal",
    opticColor: "#A855F7", // Purple / Scales of Justice
    coreGlow: "rgba(168, 85, 247, 0.4)",
    visorEmblemPath: "M100 42 L115 58 L85 58 Z", // Scales Triangle
    quipSubtitle: "Legal Cell • Section 187 BNSS Remand Radar Active"
  },
  forensics: {
    department: "forensics",
    opticColor: "#06B6D4", // Cyan Laboratory Scanner
    coreGlow: "rgba(6, 182, 212, 0.4)",
    visorEmblemPath: "M95 44 L105 44 L105 60 L112 72 L88 72 L95 60 Z", // FSL Retort / Flask
    quipSubtitle: "Forensic Science Lab • MuJoCo Kinematics Online"
  },
  surveillance: {
    department: "surveillance",
    opticColor: "#F59E0B", // Tactical Amber
    coreGlow: "rgba(245, 158, 11, 0.4)",
    visorEmblemPath: "M100 40 L106 52 L118 55 L108 63 L111 76 L100 68 L89 76 Z", // KSP Vajra Star
    quipSubtitle: "Field Patrol • ANPR Highway Intercept Radar"
  }
};
```

#### 2. Event Bus Integration:
Add `agent_delegated` to `vajraVakEventBus.ts`:
```typescript
vakBus.emit("agent_delegated", {
  department: "cyber",
  quipText: "Insp. Pradeep K. tracing 1930 mule account routing..."
});
```

When this fires:
* The mascot's chest core transitions to **Sky Blue (`#0EA5E9`)**.
* The forehead emblem morphs into the **Cyber Shield vector**.
* The mascot turns its visor 4 degrees toward the Network Graph panel.
* If a critical statutory violation is discovered (e.g. 15-day custody expiry), it shifts smoothly into `ALERT` without deadlocking.

---

## IMPLEMENTATION TIMELINE & MILESTONES

| Phase | Milestone | Files Modified | Deliverable |
| :---: | :--- | :--- | :--- |
| **P0** | Session Reporting Fix | `vajra_backend/main.py:911, 11590` | Reports appear in Supervisor Security tab with zero loss. |
| **P1** | 3-Tier Memory Engine | `vajra_backend/session_memory.py` | Topic unbinding prevents entity poisoning across cases. |
| **P1** | Sub-Agent Ticket Dispatcher | `vajra_backend/paperclip_orchestrator.py` | Dynamic delegation to Cyber, Legal, and Forensics sub-agents. |
| **P2** | Mascot Departmental Emblems | `src/components/VajraVakMascot.tsx` | Visual feedback matching active sub-agent divisions. |

---
**Plan Authorized by:** VAJRA 3.0 Principal Systems Architect  
**Distribution:** Core Engineering Team, Karnataka State Police Technical Directorate
