# VAJRA 3.0 DIAGNOSTIC AUDIT & CODE DEBT REPORT
## Forensic Code Review: Broken Wiring, Dead Code, Unlinked Components & State Traps

**Classification:** STRICTLY CONFIDENTIAL // ENGINEERING ARCHITECTURE & QA LEAD ONLY  
**System:** VAJRA 3.0 Tier-3 Law Enforcement OS & Cognitive Brain  
**Author:** Principal QA Engineer & Lead Code Reviewer  
**Date:** October 2026 (Live Workspace Audit)  
**Parent Audits:** [VAJRA_COMPREHENSIVE_SYSTEM_AUDIT.md](file:///c:/Users/B.C%20SAKETH/Downloads/VAJRA-main/VAJRA_COMPREHENSIVE_SYSTEM_AUDIT.md), [PHASE_2_ADVANCED_SUBSYSTEMS.md](file:///c:/Users/B.C%20SAKETH/Downloads/VAJRA-main/PHASE_2_ADVANCED_SUBSYSTEMS.md), [PHASE_3_FINAL_INTELLIGENCE.md](file:///c:/Users/B.C%20SAKETH/Downloads/VAJRA-main/PHASE_3_FINAL_INTELLIGENCE.md)

---

## EXECUTIVE SUMMARY

Following the architectural capability mapping in Phases 1–3, this diagnostic sweep focuses exclusively on **latent architectural debt, state machine deadlocks, unlinked UI triggers, hardcoded prototyping remnants, and silent failure patterns**.

### Key Vulnerabilities Discovered:
1. **Critical Mascot State Machine Lock (`VajraVakMascot.tsx`):** `ALERT` and `ALERT_HOLD` states lock the priority at `100`, freezing the mascot in alert mode indefinitely if an unhandled SSE alert fires without manual user click intervention.
2. **Ghost Events on PubSub Bus (`vajraVakEventBus.ts`):** 5 events (`app_loaded`, `idle_timeout`, `user_returned`, `operation_error`, `page_changed`) have registered listeners in the mascot FSM but are **never emitted anywhere in the codebase**.
3. **Hardcoded Mock Fallbacks in Fast-Path (`agent_loop.py`):** Prototype shortcuts remain in production routing, including hardcoding suspect `"Ramesh"` when querying syndicate graphs and defaulting to `"Bengaluru Urban"` when asking for repeat snatchers.
4. **Permanent 503 Route Left Behind (`main.py`):** `/api/voice/process-stream` permanently throws `HTTP 503` as dead legacy scaffolding while the frontend now routes directly through `/api/voice/stt`.
5. **Silent Date Parser Flaws & Statutory False Negatives (`threat_scoring_engine.py`):** Naked `except Exception: pass` blocks in Section 111 BNS and Section 187 BNSS date parsing silently count unparseable chargesheet dates as qualifying, creating severe statutory false positives in court dossiers.

---

## SECTION 1: EVENT BUS & UI WIRING DISCONNECTS (`src/`)

### 1.1 Unlinked & Ghost Events on `vajraVakEventBus.ts`
The Mascot PubSub Event Bus defines 18 event types, and [`VajraVakMascot.tsx`](file:///c:/Users/B.C%20SAKETH/Downloads/VAJRA-main/src/components/VajraVakMascot.tsx) registers listeners for all 18 (lines 106–136). However, a codebase-wide grep reveals that **5 events are NEVER emitted by any component**:

| Event Name | Defined in Bus | Listened by Mascot | Emitted by System | Operational Defect |
| :--- | :---: | :---: | :---: | :--- |
| `app_loaded` | Yes (line 8) | Yes (line 106) | **NEVER** | Mascot never performs the initial `STARTUP` $\to$ `FLY_IN` animation on application mount. |
| `idle_timeout` | Yes (line 24) | Yes (line 134) | **NEVER** | Mascot never transitions to `SLEEP` state when the officer is idle. |
| `user_returned` | Yes (line 25) | Yes (line 135) | **NEVER** | Mascot never executes `WAKE` state transition on user mouse re-entry. |
| `operation_error` | Yes (line 21) | Yes (line 125) | **NEVER** | When network/LLM errors occur in `AIChatScreen.tsx`, `operation_error` is never fired; mascot remains in `THINKING` state. |
| `page_changed` | Yes (line 23) | Yes (line 130) | **NEVER** | Navigation between tabs (e.g. Chat $\to$ District Dashboard) does not trigger mascot spatial flight (`NAVIGATION`). |

#### Fix for `app_loaded`, `idle_timeout`, and `user_returned` in [`src/App.tsx`](file:///c:/Users/B.C%20SAKETH/Downloads/VAJRA-main/src/App.tsx):
```tsx
// Inside App.tsx root component useEffect:
useEffect(() => {
  vakBus.emit("app_loaded");

  let idleTimer: NodeJS.Timeout;
  const resetIdle = () => {
    clearTimeout(idleTimer);
    vakBus.emit("user_returned");
    idleTimer = setTimeout(() => {
      vakBus.emit("idle_timeout");
    }, 180000); // 3 minutes idle
  };

  window.addEventListener("mousemove", resetIdle);
  window.addEventListener("keydown", resetIdle);
  return () => {
    clearTimeout(idleTimer);
    window.removeEventListener("mousemove", resetIdle);
    window.removeEventListener("keydown", resetIdle);
  };
}, []);
```

---

### 1.2 Mascot FSM Priority Trap: Deadlock in `ALERT_HOLD`
**Source:** [`src/components/VajraVakMascot.tsx`](file:///c:/Users/B.C%20SAKETH/Downloads/VAJRA-main/src/components/VajraVakMascot.tsx#L29-L30), lines 29–30 & 95–98:

```typescript
// Lines 29-30:
ALERT: { priority: 100, timeoutMs: 7000, autoNext: "ALERT_HOLD" },
ALERT_HOLD: { priority: 100 },

// Lines 95-98:
if (!force && nextPri < currentPri) {
  return current;
}
```

#### Defect Analysis:
1. When a proactive alert fires (`critical_alert`), the mascot enters `ALERT` (priority 100).
2. After 7,000ms (`timeoutMs`), line 163 auto-transitions to `ALERT_HOLD` (priority 100).
3. `ALERT_HOLD` has **no `timeoutMs` and no `autoNext`**.
4. In lines 140–156, subsequent user interactions (`currentInput`, typing, or `isThinking = false`) call `transitionTo("PERCHED_IDLE")` with `force = false`.
5. Because `PERCHED_IDLE` has priority 10, the priority check (`nextPri < currentPri`, $10 < 100$) rejects the transition.
6. **The mascot remains locked in `ALERT_HOLD` (red eyes, pulsing beacon) forever**, unless the user manually clicks the SVG icon to execute line 216.

#### Remediation Snippet:
```typescript
// Replace lines 29-30 in src/components/VajraVakMascot.tsx:
ALERT: { priority: 100, timeoutMs: 5000, autoNext: "ALERT_HOLD" },
ALERT_HOLD: { priority: 80, timeoutMs: 15000, autoNext: "PERCHED_IDLE" }, // Auto-recovery after 15s
```

---

### 1.3 `AIChatScreen.tsx` Mascot Alert Drop
**Source:** [`src/screens/AIChatScreen.tsx`](file:///c:/Users/B.C%20SAKETH/Downloads/VAJRA-main/src/screens/AIChatScreen.tsx#L745-L751), lines 745–751:

```typescript
if (msg.data?.trigger_mascot_alert) {
  if (msg.data?.mascot_state === "SUCCESS") {
    vakBus.emit("operation_success");
  } else {
    vakBus.emit("critical_alert");
  }
}
```

#### Defect Analysis:
`tool_syndicate_graph.py` (line 212) sends `"mascot_state": "NAVIGATION"` and `"mascot_anchor": "ANCHOR_GRAPH"`. However, `AIChatScreen.tsx` line 746 only checks `msg.data?.mascot_state === "SUCCESS"`. It treats `"NAVIGATION"` as an `else` condition and fires `critical_alert`!
* **Result:** A successful syndicate graph extraction erroneously puts the mascot into **CRITICAL RED ALERT** instead of smoothly flying to the graph panel.

#### Remediation Snippet:
```typescript
// Replace lines 745-751 in src/screens/AIChatScreen.tsx:
if (msg.data?.trigger_mascot_alert) {
  if (msg.data?.mascot_state === "SUCCESS") {
    vakBus.emit("operation_success");
  } else if (msg.data?.mascot_state === "NAVIGATION") {
    vakBus.emit("network_analysis_started", { anchorTarget: msg.data?.mascot_anchor || "ANCHOR_GRAPH" });
  } else {
    vakBus.emit("critical_alert");
  }
}
```

---

## SECTION 2: DEAD CODE & LEGACY GHOSTS (`vajra_backend/`)

### 2.1 Hardcoded Prototype Shortcuts in Fast-Path Intent Router
**Source:** [`vajra_backend/agent_loop.py`](file:///c:/Users/B.C%20SAKETH/Downloads/VAJRA-main/vajra_backend/agent_loop.py#L186-L200), lines 186–200 in `check_fast_path_intent(...)`:

```python
# Lines 186-195 in vajra_backend/agent_loop.py:
c_low = cleaned.lower()
if "stolen" in c_low and ("wheel" in c_low or "bike" in c_low or "vehicle" in c_low or "cross-match" in c_low):
    return {"tool": "find_similar_cases", "parameters": {"query": "stolen two-wheeler motorcycle getaway vehicles"}}
if "trace syndicate" in c_low or "syndicate graph" in c_low:
    return {"tool": "query_graph_network", "parameters": {"suspect_name": "Ramesh"}}
if "hawala" in c_low or "financial trail" in c_low or "mule account" in c_low:
    return {"tool": "find_similar_cases", "parameters": {"query": "hawala mule bank transactions"}}
if "repeat snatchers" in c_low or "repeat offender" in c_low:
    return {"tool": "get_repeat_offenders", "parameters": {"district": "Bengaluru Urban"}}
```

#### Defect Analysis:
1. **The "Ramesh" Hardcode (Line 191):** If an officer types *"trace syndicate"* or *"show me the syndicate graph"*, the system does not ask for or extract a suspect name; it routes directly to `suspect_name = "Ramesh"`! If the officer was investigating a syndicate in Belagavi or Ballari, they are unexpectedly served the profile of "Ramesh".
2. **The "Bengaluru Urban" Default (Line 195):** Any general query asking for *"repeat snatchers"* or *"repeat offenders"* silently defaults to `"Bengaluru Urban"`, regardless of the logged-in officer's actual jurisdiction (e.g., an officer in Dharwad or Udupi).

#### Remediation Snippet:
```python
# Replace lines 190-195 in vajra_backend/agent_loop.py:
if "trace syndicate" in c_low or "syndicate graph" in c_low:
    # Do not hardcode "Ramesh"; extract suspect or let Cognitive Brain resolve it
    suspect_cand = guess_name() if 'guess_name' in locals() else ""
    if suspect_cand:
        return {"tool": "query_graph_network", "parameters": {"suspect_name": suspect_cand}}
    return None  # Fall through to LLM / SOTIE intent classification

if "repeat snatchers" in c_low or "repeat offender" in c_low:
    # Do not hardcode Bengaluru Urban; use officer's session unit/district context
    return None  # Let _classify_intent resolve district from session context
```

---

### 2.2 Permanent 503 Route Left Behind (`main.py`)
**Source:** [`vajra_backend/main.py`](file:///c:/Users/B.C%20SAKETH/Downloads/VAJRA-main/vajra_backend/main.py#L456-L474), lines 456–474:

```python
@app.post("/api/voice/process-stream")
async def process_voice_stream(audio: UploadFile = File(...)):
    """
    ASR Speech-to-text integration endpoint.
    Returns service not configured error as Zia speech modules are not active.
    """
    logger.info(f"Incoming voice stream content type: {audio.content_type}")
    ...
    raise HTTPException(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        detail="Zia Speech-to-Text Voice Service is not configured. Please wire active Zoho Intelligent Assistant SDK credentials."
    )
```

#### Defect Analysis:
This is dead legacy scaffolding from an early sprint. Live speech transcription was successfully implemented in `/api/voice/stt` (lines 9365–9397) using `catalyst_speech.transcribe_audio`. Leaving `/api/voice/process-stream` throwing a hard 503 causes confusion and breaks legacy client scripts attempting to stream audio chunks.

#### Remediation Snippet:
Deprecate the endpoint or alias it to `stt_endpoint` in [`vajra_backend/main.py`](file:///c:/Users/B.C%20SAKETH/Downloads/VAJRA-main/vajra_backend/main.py):
```python
@app.post("/api/voice/process-stream", deprecated=True)
async def process_voice_stream(audio: UploadFile = File(...), location_context: str = Depends(security_firewall)):
    return await stt_endpoint(audio=audio, language="auto", location_context=location_context)
```

---

## SECTION 3: SILENT FAILURES & STATUTORY CALCULATION BUGS

### 3.1 Unhandled Date Parsing in Actuarial Threat Scoring
**Source:** [`vajra_backend/threat_scoring_engine.py`](file:///c:/Users/B.C%20SAKETH/Downloads/VAJRA-main/vajra_backend/threat_scoring_engine.py#L357-L370), lines 357–370:

```python
# Check §111 BNS Statutory Prerequisite: >= 2 chargesheets filed in preceding 10 years
ten_years_ago = date.today() - timedelta(days=3650)
qualifying_cs = 0
for cs in chargesheet_rows:
    cs_raw = cs.get("csdate")
    if cs_raw:
        try:
            cs_date = datetime.strptime(str(cs_raw)[:10], "%Y-%m-%d").date()
            if cs_date >= ten_years_ago:
                qualifying_cs += 1
        except Exception:
            qualifying_cs += 1  # <-- CRITICAL DEFECT
    else:
        qualifying_cs += 1      # <-- CRITICAL DEFECT
```

#### Defect Analysis:
1. Under **Section 111 of the Bharatiya Nyaya Sanhita 2023**, invoking Organized Crime charges requires that **more than one chargesheet has been filed before a competent court within the preceding 10 years**.
2. If `csdate` is unparseable (e.g. formatted as `DD/MM/YYYY` instead of `YYYY-MM-DD`), the `except Exception:` block executes and **increments `qualifying_cs += 1` anyway**!
3. Even worse, if `csdate` is completely `None` (`else` branch on line 369), **it increments `qualifying_cs += 1`**!
4. **Legal Catastrophe:** Chargesheets filed in **1998 or 2005** with missing or malformed date fields are counted as *"within the preceding 10 years"*, generating illegal Section 111 BNS designations that violate statutory requirements in court.

#### Remediation Snippet:
```python
# Replace lines 357-370 in vajra_backend/threat_scoring_engine.py:
ten_years_ago = date.today() - timedelta(days=3650)
qualifying_cs = 0
for cs in chargesheet_rows:
    cs_raw = cs.get("csdate")
    if not cs_raw:
        logger.warning(f"Chargesheet missing date for suspect {accused_id}; excluded from §111 10-year window.")
        continue
    
    parsed_date = None
    for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%d-%m-%Y", "%Y/%m/%d"):
        try:
            parsed_date = datetime.strptime(str(cs_raw)[:10], fmt).date()
            break
        except (ValueError, TypeError):
            continue
            
    if parsed_date and parsed_date >= ten_years_ago:
        qualifying_cs += 1
    elif not parsed_date:
        logger.warning(f"Unparseable chargesheet date format '{cs_raw}'; excluded from §111 qualification.")
```

---

### 3.2 Imminent Default Bail Days-Left Calculation (`threat_scoring_engine.py`)
**Source:** [`vajra_backend/threat_scoring_engine.py`](file:///c:/Users/B.C%20SAKETH/Downloads/VAJRA-main/vajra_backend/threat_scoring_engine.py#L297-L311), lines 297–311:

```python
arr_date = datetime.strptime(str(arrest_dt_str)[:10], "%Y-%m-%d").date()
days_remand = (date.today() - arr_date).days
days_left_60 = max(0, 60 - days_remand)
if 0 < days_left_60 <= 10:
    score += 20
...
except Exception:
    pass  # Silently swallowed!
```

#### Defect Analysis:
If the database stores `ArrestSurrenderDate` with timestamps (e.g. `2026-09-14 18:30:00+05:30`), and string slicing `[:10]` fails due to leading spaces or ISO T-delimiters (`2026-09-14T...`), `strptime` throws and the exception is silently swallowed with `pass`.
* **Result:** The system silently fails to detect that an accused person has only 3 days left before statutory default bail under Section 187(3) BNSS, completely blinding the investigating officer to an impending mandatory release.

#### Remediation Snippet:
```python
# Robust ISO/UTC datetime parsing in threat_scoring_engine.py:
try:
    clean_dt_str = str(arrest_dt_str).strip().replace("T", " ")[:10]
    arr_date = datetime.strptime(clean_dt_str, "%Y-%m-%d").date()
    days_remand = (date.today() - arr_date).days
    days_left_60 = max(0, 60 - days_remand)
    if 0 < days_left_60 <= 10:
        score += 20
        ...
except Exception as ex:
    logger.error(f"Failed to calculate Section 187(3) BNSS remand countdown for date '{arrest_dt_str}': {ex}")
```

---

## SECTION 4: API PAYLOAD MISMATCHES & UNUSED KEYS

### 4.1 Python Tools Send Unused UI Keys
Several backend tools in `vajra_backend/tools/` construct dictionaries with keys that `UniversalPoliceIntelCard.tsx` does not display or utilize:

| Backend Tool | Sent Key | Intended Purpose | Frontend Handling Status |
| :--- | :--- | :--- | :--- |
| `tool_vision_extractor.py` | `"confidence"` | OCR text extraction confidence percentage | **Ignored**; rendered only as raw scalar if not filtered. |
| `tool_syndicate_graph.py` | `"mascot_anchor"` | Target anchor for mascot flight (`"ANCHOR_GRAPH"`) | **Dropped**; `AIChatScreen.tsx` hardcodes `"ANCHOR_GRAPH"` and does not read `msg.data.mascot_anchor`. |
| `threat_scoring_engine.py` | `"peer_average"` | Baseline comparison against Karnataka State CCTNS average | **Partially dropped**; only displayed if user expands technical JSON payload. |

---

## REMEDIATION PRIORITY MATRIX

| Priority | Issue | Location | Risk Impact |
| :---: | :--- | :--- | :--- |
| **P0** | Statutory False Positives under Section 111 BNS | `threat_scoring_engine.py:366-369` | **CRITICAL:** Invalid organized crime charges filed in court. |
| **P0** | Hardcoded Suspect `"Ramesh"` in Fast-Path | `agent_loop.py:191` | **HIGH:** Investigating officers served wrong suspect profiles. |
| **P1** | Mascot FSM Indefinite Lock in `ALERT_HOLD` | `VajraVakMascot.tsx:29-30` | **HIGH:** UI frozen in critical alarm state; requires page reload. |
| **P1** | Silent Swallowing of § 187 BNSS Default Bail Clocks | `threat_scoring_engine.py:310` | **HIGH:** Accused released on default bail due to missed deadline. |
| **P2** | 5 Ghost Events Never Emitted on Bus | `vajraVakEventBus.ts:8-25` | **MEDIUM:** Mascot fails to animate on app load, idle, or errors. |
| **P2** | Dead 503 Route `/api/voice/process-stream` | `main.py:456-474` | **LOW:** Technical debt and legacy client breakage. |

---
**Report Authorized by:** VAJRA 3.0 Principal QA Engineer & Lead Code Reviewer  
**Distribution:** Core Engineering Team, Karnataka State Police Technical Directorate
