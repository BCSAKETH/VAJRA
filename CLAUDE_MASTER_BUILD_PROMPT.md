# VAJRA — CLAUDE MASTER EXECUTION PROMPT (MAX-CAPACITY 25-MINUTE SPRINT)

> **CRITICAL FLIGHT CLOCK — HARD TERMINATION AT 11:55 PM IST SHARP**  
> **Start Time:** ~11:30 PM IST · **Mandatory Session Exit:** 11:55:00 PM IST (25 Mins Max)  
> **Target Scope:** 6 tightly coupled, high-impact features (plus 1 stretch goal).  
> **Source Blueprints:** All code, exact line numbers, and logic are fully authored in `scratch/Finals-part 5.md`.  
> **NO REMOTE DEPLOYS:** Do NOT run `catalyst deploy` (takes 7+ mins on AppSail). Verify locally via `py_compile` + `npm run build`, commit to `main`, and exit.

---

## 1. MINUTE-BY-MINUTE FLIGHT SCHEDULE (HARD CUTOFF AT 11:55 PM)

| Time (IST) | Phase | Target Module | Hard Exit Gate |
|---|---|---|---|
| **11:30 – 11:38** | Phase 1 (8m) | **Module 1: Sub-3s Query Acceleration Engine** | Pre-router + parallel trends working |
| **11:38 – 11:42** | Phase 2 (4m) | **Module 2: OSINT DB-First Inversion & Offline BNS Dict** | Web search trap eliminated |
| **11:42 – 11:45** | Phase 3 (3m) | **Module 3: Granular Live SSE Progress Ticker** | Real-time database status events |
| **11:45 – 11:48** | Phase 4 (3m) | **Module 4: Desktop Push Notification Formatter** | Clean police alerts, no raw JSON |
| **11:48 – 11:50** | Phase 5 (2m) | **Module 5: Prompt Box Cut Line Polish & Contrast** | Faint horizontal line eradicated |
| **11:50 – 11:52** | Phase 6 (2m) | **Module 6: Autonomous Persona & Toolbar Clean-up** | Composer UI de-cluttered |
| **11:52 – 11:54** | Phase 7 (2m) | *STRETCH / BUFFER:* **Module 7: 22-Block PNLG Palette** | Blueprint 8 into `ksp_pnlg_engine.py` |
| **11:54 – 11:55** | Final (1m) | **Compilation Check (`py_compile` + `npm run build`), Git Commit & TERMINATE** | Clean git exit |

*Emergency Rule:* If the clock reaches **11:53 PM IST**, DROP whatever module is active, run the build checks, commit, and terminate immediately.

---

## 2. THE 6 HIGH-IMPACT CORE MODULES + 1 STRETCH GOAL

Open `scratch/Finals-part 5.md` to reference the exact production blueprints:

### 🚀 MODULE 1: Sub-3s Query Acceleration Engine (Latency Fix)
*Reference: `scratch/Finals-part 5.md` Sections 149–154 (Blueprints 1, 2, 3, 4)*

1. **Fast-Path Intent Pre-Router (`vajra_backend/agent_loop.py`):**
   - At top of `run_agent_loop`, before GLM or heavy scanning:
     - If query matches `"top crimes"`, `"most frequent crimes"`, `"crime breakdown"`, `"crime trends"`, `"recent cases"`, `"station stats"`, `"hotspots"`, bypass GLM entirely and route directly to the grounded CCTNS aggregator.
     - Resolves high-frequency statistical queries in $<20\text{ms}$.
2. **Parallelize 12-Month Trend Queries (`vajra_backend/agent_loop.py`):**
   - In `_execute_tool` under `get_crime_trends`, replace the 12 sequential ZCQL `COUNT` queries with `ThreadPoolExecutor(max_workers=4)`.
   - Collapses 12 sequential WAN round-trips ($11.6\text{s}$) to $1.1\text{s}$.
3. **In-Memory Master Cache for Units & Crime Heads (`vajra_backend/main.py`):**
   - Initialize `_MASTER_CACHE = {"units": None, "crime_heads": None, "ts": 0}` with 1-hour TTL.
   - Cache the 1,112 police stations and 101 crime heads so `query_hotspots` and `get_case_types_distribution` never re-query static tables.
4. **Adaptive LLM Routing Timeout (`vajra_backend/catalyst_llm.py`):**
   - Clamp the first-turn tool-selection GLM call timeout from 90s down to 12s with immediate failover to Qwen or deterministic keyword routing.

---

### 🛡️ MODULE 2: OSINT Database-First Inversion & Offline BNS Knowledgebase
*Reference: `scratch/Finals-part 5.md` Sections 155–157 (Blueprint 6)*

1. **Purge Keyword Traps from `_TOOL_HINTS["web_search"]` (`vajra_backend/agent_loop.py`):**
   - Remove generic stopwords: `"search"`, `"what is"`, `"who is"`, `"tell me about"`, `"cybercrime"`, `"bns"`, `"section"`, `"law"`, `"act"`.
   - Retain strictly external cues: `"news"`, `"press"`, `"current events"`, `"twitter"`, `"telegram"`, `"dark web"`.
2. **Invert Catch-All Hierarchy:**
   - In `_ALWAYS_TOOLS`, replace `"web_search"` with `"query_case"`.
   - At `agent_loop.py:4022`, change the catch-all safety net from `web_search` to `query_case`. CCTNS is the default authority; external search is explicitly gated.
3. **Offline BNS/BNSS Statutory Dictionary (`vajra_backend/agent_loop.py`):**
   - Add an in-memory dictionary of core Bharatiya Nyaya Sanhita (BNS) & Bharatiya Nagarik Suraksha Sanhita (BNSS) sections (BNS 111 Organized Crime, BNS 103 Murder, BNSS 185 Exigent Pursuit, BNS 63-72 POCSO/Rape, BNS 316-318 Cheating/Cyber Fraud).
   - If an officer asks about a legal section, answer instantly from internal grounded text instead of running a live web search.

---

### ⚡ MODULE 3: Granular Live SSE Progress Ticker
*Reference: `scratch/Finals-part 5.md` Section 154 (Blueprint 5)*

1. **Micro-Progress Updates (`vajra_backend/agent_loop.py`):**
   - During tool execution in `_execute_tool`, emit live SSE progress events via `_progress()`:
     - Trend queries: `"Aggregating 12-month temporal patterns..."`
     - Hotspots: `"Scanning spatial coordinates across 1,112 units..."`
     - Case search: `"Cross-referencing CCTNS CaseMaster records..."`
     - Synthesis: `"Formatting Section 63 BSA compliant briefing..."`
   - Prevents UI ticker starvation and eliminates user confusion.

---

### 🚨 MODULE 4: Desktop Push Notification Formatting Engine
*Reference: `scratch/Finals-part 5.md` Section 169 (Blueprint 17)*

1. **Backend Payload Formatter (`vajra_backend/vajra_core.py`):**
   - Add `format_push_notification_payload(alert_type, raw_payload)`.
   - Safely parse JSON strings or dictionaries and generate human-readable police alert titles/bodies:
     - `POCSO_ACCESS` $\to$ Title: `⚠️ POCSO Unmasking Request · {case_no}`, Body: `Investigator {name} (Badge {badge}) requested victim identity access: "{reason}"` (clamped to 120 chars), URL: `/supervisor?tab=pocso&case_no={case_no}`.
     - `EXPORT_APPROVAL` $\to$ Title: `📄 §63 BSA Evidentiary Export Request`, Body: `Officer {name} requested dossier export for {case_no}.`, URL: `/supervisor?tab=approvals`.
     - `DISTRICT_ACCESS` $\to$ Title: `🚨 §185 BNSS Pursuit Notice`, Body: `Officer {name} invoked emergency pursuit into {district}.`.
   - In `insert_proactive_alert()` (line ~357), pass the formatted title and body to `send_push_to_kgids()`.
2. **Service Worker Defensive Shield (`public/sw.js` and `client/sw.js`):**
   - In the `push` event listener, if `event.data.json().body` is a raw JSON string, safely unpack it so raw braces (`{"request_id":...`) never display on the officer's desktop.

---

### 🎨 MODULE 5: Prompt Box Ergonomics Overhaul (Cut Line Removal)
*Reference: `scratch/Finals-part 5.md` Section 164 (Blueprint 10)*

1. **Eradicate Horizontal Cut Line (`src/screens/AIChatScreen.tsx`):**
   - Remove the `border-t border-white/5` or horizontal divider above the floating composer.
   - Apply a smooth CSS vertical alpha mask on the bottom message thread so messages glide seamlessly behind the composer without an abrupt cut line.
2. **Deepen Dark-Mode Glassmorphism (`src/components/ChatInput.tsx`):**
   - Adjust composer container styling: `bg-[#161412]/85 backdrop-blur-xl border border-white/10 shadow-2xl` with subtle focus-within gold glow.

---

### 🎭 MODULE 6: Pure Autonomous Persona Routing & Toolbar Clean-up
*Reference: `scratch/Finals-part 5.md` Section 163*

1. **De-Clutter Composer Toolbar (`src/components/ChatInput.tsx`):**
   - Remove or unmount the manual `PersonaSelectorBadge` button from the composer bar.
   - The system now operates 100% autonomously: `ksp_response_tailor.py` classifies the query intent on every turn into one of the 5 KSP personas automatically.
   - Keep the emergency detection alert in `ChatBubble.tsx` if a high-threat incident is triggered.

---

### 🌟 MODULE 7 (STRETCH GOAL): 22-Block Modular PNLG Section Palette
*Reference: `scratch/Finals-part 5.md` Sections 158–162 (Blueprint 8)*
*ONLY ATTEMPT IF CLOCK IS BEFORE 11:52 PM IST*

1. **Expand `vajra_backend/ksp_pnlg_engine.py`:**
   - Add the 22-block modular section palette (covering Greetings, Case Overviews, Trends, Hotspots, Syndicate Centrality, Statutory Remand, and Prevention Advisories).
   - Implement sparse recipe assembly (selecting 2 to 5 blocks per answer) with turn-hash deterministic seeding.

---

## 3. VERIFICATION & COMMIT PROTOCOL (11:53 – 11:55 PM IST)

1. **Compile Backend:**
   ```bash
   python -m py_compile vajra_backend/*.py
   ```
   Must exit with code 0.
2. **Compile Frontend:**
   ```bash
   npm run build
   ```
   Must exit with code 0.
3. **Git Commit:**
   - Author: `BCSAKETH <bcsaketh@gmail.com>`
   - Message: `feat: sub-3s query acceleration, db-first routing, notification formatter, promptbox polish & autonomous persona`
   - **DO NOT add `Co-Authored-By` trailer.**
4. **Terminate:** Output a bulleted completion summary and stop all tools at or before **11:55 PM IST sharp**.
