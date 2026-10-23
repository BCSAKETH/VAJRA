# VAJRA 3.0 Current State Technical Dump & Architecture Blueprint Extraction

**Auditor:** VAJRA 3.0 Lead System Auditor  
**Date:** October 24, 2026  
**Status:** Read-Only Complete Extraction  
**Baseline Commit:** `417cbcc` (origin/main)  

---

## 1. BACKEND: OSINT & SPATIAL CACHING

### 1.1 Web Scraping & OSINT Infrastructure

#### A. Core OSINT Pipeline: `vajra_backend/internet_signals.py`
This module acts as an autonomous, rate-limited, and cached gateway to external web intelligence. All records returned are tagged as **unverified open-source intelligence** and isolated from primary CCTNS grounded evidence.

* **File Path:** `vajra_backend/internet_signals.py`
* **Configuration & Environment:**
  ```python
  # Lines 36-43
  _GNEWS_KEY = os.getenv("GNEWS_API_KEY", "").strip()
  _NEWSAPI_KEY = os.getenv("NEWSAPI_KEY", "").strip()
  _SEARCH_KEY = os.getenv("WEB_SEARCH_API_KEY", "").strip()
  _SEARCH_ENGINE = os.getenv("WEB_SEARCH_ENGINE", "serpapi").strip().lower()
  _NEWS_TTL = int(os.getenv("NEWS_CACHE_TTL_SECONDS", "3600"))  # 1h TTL
  _HTTP_TIMEOUT = 8  # Sub-AppSail 30s limit
  ```
* **Thread-Safe In-Memory TTL Cache:**
  ```python
  # Lines 49-67
  _cache: Dict[str, Any] = {}
  _cache_lock = threading.Lock()

  def _cache_get(key: str) -> Optional[Any]: ...
  def _cache_put(key: str, value: Any, ttl: int) -> None: ...
  ```
* **Core Functions & Signatures:**
  1. `has_internet_connectivity() -> bool` (Lines 87–104): KSWAN low-connectivity probe using `https://www.gstatic.com/generate_204` with 1.5s timeout.
  2. `_scrape_smartbrowz(url: str) -> Optional[str]` (Lines 128–138): Headless browser scraping via SmartBrowz integration.
  3. `_scrape_news_rss(query: str, limit: int) -> List[Dict[str, str]]` (Lines 141–170): Zero-key Google News RSS fallback scraper using `xml.etree.ElementTree`.
  4. `compute_evidence_hash(url: str, title: str, snippet: str, fetch_timestamp: str) -> str` (Lines 224–237): Computes SHA-256 for Section 63 BSA electronic evidence.
  5. `classify_domain(url: str, source_name: str = "") -> Dict[str, str]` (Lines 239–265): Categorizes sources into `OFFICIAL_GOV`, `TRUSTED_NEWS`, or `PUBLIC_WEB`.
  6. `get_district_news(district: str, limit: int = 6) -> Dict[str, Any]` (Lines 268–380): Primary news fetcher with crime keyword expansion (`crime OR police OR arrest OR FIR OR fraud...`).
  7. `_deep_crawl_official_domains(items: List[Dict[str, Any]], original_query: str) -> List[Dict[str, Any]]` (Lines 532–617): Autonomous crawler across `.gov.in`, `.nic.in`, `.karnataka.gov.in`.
  8. `web_search(query: str, limit: int = 24) -> Dict[str, Any]` (Lines 620–788): Comprehensive search aggregator querying SerpAPI, Wikipedia summaries, and RSS feeds.

#### B. Autonomous Portal Automator: `vajra_backend/portal_automator.py`
Simulates browser sessions against state administrative and judicial portals with Section 63 BSA evidence stamping.

* **File Path:** `vajra_backend/portal_automator.py`
* **Class:** `PortalAutomator` (Line 31)
* **API Contracts (Lines 34–53):**
  - `ecourts_karnataka`: `https://karnatakajudiciary.kar.nic.in/case_status/query` (POST)
  - `vahan_karnataka`: `https://transport.karnataka.gov.in/vahan/status` (POST)
  - `sarathi_karnataka`: `https://parivahan.gov.in/sarathi/dlquery` (POST)
* **Stealth Fingerprinting (Lines 25–29, 55–70):**
  Rotates modern Chrome User-Agents and sets `Sec-Ch-Ua`, `Sec-Fetch-*` headers.
* **Core Functions:**
  - `compute_bsa_evidence_hash(raw_data: str, source_url: str) -> Dict[str, str]` (Lines 72–84)
  - `query_ecourts_case_status(case_no: str, year: Optional[str] = None, district: Optional[str] = None) -> Dict[str, Any]` (Lines 85–117)
  - `query_vahan_vehicle_record(reg_no: str) -> Dict[str, Any]` (Lines 119–150)
  - `query_sarathi_license_status(dl_number: str) -> Dict[str, Any]` (Lines 152–177)

#### C. SmartBrowz Integration: `vajra_backend/catalyst_smartbrowz.py`
Interfaces with Zoho Catalyst SmartBrowz for high-fidelity PDF rendering and headless page text extraction.

* **File Path:** `vajra_backend/catalyst_smartbrowz.py`
* **Core Functions:**
  - `_generate_vajra_crest_svg(size: int = 48) -> str` (Lines 409–531): Mathematical 12-point sunburst crest generation.
  - `render_dossier_html(dossier_data: Dict[str, Any], lang: str = "en") -> str` (Lines 534–1205): Comprehensive forensic HTML generation.
  - `convert_html_to_pdf_smartbrowz(html_content: str, timeout: int = 60) -> Optional[bytes]` (Lines 1243–1264): Invokes Catalyst SmartBrowz REST API for binary PDF generation.
  - `smartbrowz_scrape_url(url: str, timeout: int = 10) -> Optional[str]` (Lines 1514–1540): Headless DOM text extraction.

---

### 1.2 Statewide 529k Spatial Pre-Index: `vajra_backend/spatial_preindex.py`

High-performance in-memory spatial index serving statewide CCTNS geocodes with sub-3ms multi-constraint querying.

* **File Path:** `vajra_backend/spatial_preindex.py`
* **Class:** `SpatialPreIndexEngine` (Line 35)
* **RAM Data Structure (Lines 41–54):**
  Uses columnar, contiguous, typed NumPy arrays to store 529,118 geocoded FIR incidents in ~12–16MB RAM:
  ```python
  self.coords: np.ndarray = np.empty((0, 2), dtype=np.float32)  # [lat, lng] (4 bytes each)
  self.timestamps: np.ndarray = np.empty(0, dtype=np.int64)      # Unix timestamp (8 bytes)
  self.hours: np.ndarray = np.empty(0, dtype=np.int8)           # 0-23 (1 byte)
  self.dows: np.ndarray = np.empty(0, dtype=np.int8)            # 0-6 Day of week (1 byte)
  self.head_ids: np.ndarray = np.empty(0, dtype=np.int16)       # CrimeMajorHeadID (2 bytes)
  self.unit_ids: np.ndarray = np.empty(0, dtype=np.int16)       # PoliceStationID (2 bytes)
  self.district_ids: np.ndarray = np.empty(0, dtype=np.int16)   # DistrictID (2 bytes)
  self.crime_nos: List[str] = []                                # Incident identifier string
  ```
* **Persistence & Serialization (Lines 55–101):**
  - Binary file: `vajra_backend/data/ksp_spatial_cache.npz`
  - `load_cache() -> bool`: Loads the pre-compiled `.npz` archive into RAM in <1.2 seconds.
  - `save_cache()`: Serializes in-memory arrays via `np.savez_compressed`.
* **Query Execution:**
  - `query_spatial_incidents(district_id, unit_id, head_id, hour, day_of_week, max_points=2500) -> List[Dict[str, Any]]` (Lines 220–280): Performs vectorized boolean mask operations in NumPy in <3ms.
* **Dynamic k-NN Density Clustering (Lines 282–379):**
  - `cluster_adaptive_hotspots(points, min_samples=5, target_clusters=8, ...)`:
    Estimates optimal epsilon dynamically using the 85th percentile of k-nearest neighbor distances (`NearestNeighbors(n_neighbors=k)`), clamping $\epsilon$ between `0.004` (450m urban) and `0.025` (2.5km rural Ballari mining belts), completely avoiding hardcoded static radiuses.

---

### 1.3 District Dashboard API & Snapshot-First Caching: `vajra_backend/main.py`

* **File Path:** `vajra_backend/main.py`
* **Configuration:**
  ```python
  # Line 1942
  _DASHBOARD_REFRESH_COOLDOWN_SECONDS = 180  # 3-minute anti-storm cooldown bucket
  ```
* **Caching & Snapshot Mechanics:**
  - `_read_dashboard_snapshot(snapshot_key: str) -> Optional[Dict[str, Any]]` (Lines 1974–1990): Reads cached snapshot JSON from ZCQL `DashboardSnapshot` table in <200ms.
  - `_write_dashboard_snapshot(snapshot_key: str, payload: Dict[str, Any], live_total: int) -> None` (Lines 2002–2030): Inserts/updates `DashboardSnapshot` row with ISO UTC timestamp and validation markers.
  - `_dashboard_snapshot_cooldown_remaining(snapshot_key: str) -> int` (Lines 2032–2050): Returns seconds remaining until another manual refresh is permitted.
* **API Endpoints:**
  - `GET /api/dashboard/districts/summary` (Lines 2252–2275): Fast-path serving. Returns cached snapshot if present, falls back to cold-start compute and self-seeding.
  - `POST /api/dashboard/districts/summary/refresh` (Lines 2277–2307): Manual recomputation endpoint. Evaluates cooldown bucket, runs `_compute_district_summary_live()`, validates against `CaseMaster` live totals, and writes to `DashboardSnapshot`.

---

## 2. FRONTEND: CHAT, UI CARDS & DASHBOARDS

### 2.1 Universal Police Intelligence Card: `src/components/UniversalPoliceIntelCard.tsx`

* **File Path:** `src/components/UniversalPoliceIntelCard.tsx`
* **Props Interface:**
  ```typescript
  // Lines 17-23
  export interface UniversalPoliceIntelCardProps {
    type: string;
    data: any;
    lang?: "en" | "kn";
    onFollowUpQuery?: (query: string) => void;
    onClose?: () => void;
  }
  ```
* **Tactical Metadata Resolver (`getTacticalMeta`, Lines 26–500):**
  Resolves dynamic card metadata based on backend payload types:
  - `bail_countdown` / `statutory_deadline`: Maps to Section 187 BNSS Default Bail Radar (`accent: #EF4444`, `icon: Clock`).
  - `chargesheet_ready`: Section 193 BNSS Readiness Grid (`accent: #F59E0B`, `icon: Scale`).
  - `dossier` / `full_report`: Master Intelligence Dossier (`accent: #C79A4E`, `icon: ShieldAlert`).
  - `mo_match`: Modus Operandi Behavioral Forensics (`icon: Fingerprint`).
  - `electronic_evidence`: Section 63 BSA Digital Evidence Certificate (`icon: Lock`).
* **Visual Presentation & Micro-Interactions (Lines 610–650):**
  - Integrated with `GridPattern`, `Spotlight` (cursor tracking), `BorderBeam` (tactical high-threat aura), and `ShineBorder`.
  - Action Chips: Renders clickable follow-up queries that invoke `onFollowUpQuery(act.query)`.

---

### 2.2 Chat Bubble Architecture: `src/components/ChatBubble.tsx`

* **File Path:** `src/components/ChatBubble.tsx`
* **Props Interface (Lines 24–65):**
  `message: ChatMessage`, `lang: "en" | "kn"`, `voicePersona?: string`, `textSize?: TranscriptTextSize`, `ttsSettings?: TtsSettings`, `onExpandWidget: (type: string, data: any) => void`, `onRetry?: () => void`, `onQuickReply?: (text: string) => void`, `addToast?: (...) => void`, `onEditMessage?: (...) => void`, `onRetryVariant?: (...) => void`, `onTogglePin?: () => void`.
* **Streaming & Markdown Deferral (Lines 925–935):**
  ```typescript
  const displayText = decodeDisplayText(rawDisplayText).replace(/^\n+/, "");
  // React 19 concurrent deferral to prevent UI thread lock during 50 tokens/sec streaming
  const deferredDisplayText = React.useDeferredValue(displayText);
  const renderedRichContent = React.useMemo(() => {
    return renderRich(deferredDisplayText, sizeStyles);
  }, [deferredDisplayText, sizeStyles]);
  ```
* **Rich AST Parsing (`renderRich`, Lines 302–430):**
  - Headings (H1–H3), blockquotes, code blocks (`CodeBlock` with clipboard copy).
  - Entity Chips: `TECHNICAL_BADGE_RE` (CR numbers, hashes, mule accounts), `STATUTORY_CITATION_RE` (Section 187 BNSS, Section 63 BSA, currency, percentages).
* **Multi-Modal Embedded Panels:**
  - Inline voice synthesis via Zia TTS with SpeechSynthesis fallback.
  - Tactical Inquest clarification chips (`onQuickReply`).
  - Inline Evidence / Citation drawer (`showEvidence`).
  - POCSO statutory unmasking modal trigger (`showPocsoModal`).

---

### 2.3 District Command Dashboard: `src/screens/DistrictDashboardScreen.tsx`

* **File Path:** `src/screens/DistrictDashboardScreen.tsx`
* **Refresh Execution & Cooldown Handling (Lines 795–821):**
  ```typescript
  const handleRefreshSummary = useCallback(async () => {
    setIsRefreshingSummary(true);
    try {
      const res = await fetch(`${API_BASE}/api/dashboard/districts/summary/refresh`, {
        method: "POST",
        headers: { Authorization: `Bearer ${localStorage.getItem("vajra_token") || ""}` },
      });
      const data = await res.json().catch(() => ({}));
      if (data.status === "rejected") {
        addToast(
          lang === "en" ? "Refresh Not Applied" : "ರಿಫ್ರೆಶ್ ಅನ್ವಯಿಸಲಾಗಿಲ್ಲ",
          data.reason || "Previous data retained.",
          "Warning"
        );
        return;
      }
      await fetchSummary();
    } finally {
      setIsRefreshingSummary(false);
    }
  }, [fetchSummary, lang, addToast]);
  ```
* **Section 187 Threat Indicators in UI:**
  - Line 1668: Embedded inside the CCTNS Live Wire Marquee:
    `<span className="mx-4 text-emerald-400">🛡️ §187 BNSS 60/90-DAY BAIL RADAR: 99.1% COMPLIANCE</span>`
  - Statutory clocks expand inside `ExpandedOverlay.tsx` (`⚖️ §187 Bail Clock`).

---

### 2.4 Unified Sidebar & Floating Input Capsule

#### A. Unified Sidebar: `src/components/UnifiedSidebar.tsx`
* **File Path:** `src/components/UnifiedSidebar.tsx`
* **Layout Structure (Lines 185–206):**
  - One-click expand/collapse: `isExpanded ? "w-64" : "w-16"`.
  - Toggle Button: Lines 199–205 render `ChevronLeft` when expanded and `ChevronRight` when collapsed.
  - Fixed Nav: "New Chat" button, followed by Navigation items (`ai_chat`, `investigations`, `district_dashboard`, `supervisor`, `audit`, `settings`).

#### B. Floating Composer Capsule: `src/screens/AIChatScreen.tsx`
* **File Path:** `src/screens/AIChatScreen.tsx`
* **Layout & Styling (Lines 2315–2333):**
  ```tsx
  <div className="pointer-events-none absolute inset-x-0 bottom-0 z-30 print:hidden">
    {/* Centered translucent floating input capsule */}
    <div
      ref={composerRef}
      className="p-4 pt-2 pb-[max(1rem,env(safe-area-inset-bottom))]"
    >
      {composerContent}
    </div>
  </div>
  ```
  - The capsule utilizes `.glass-panel` and `.composer-elevation`. Outer gutters maintain `pointer-events: none` so underlying messages remain clickable.

---

## 3. AGENTS, VAK MASCOT & MEMORY

### 3.1 Mascot FSM & Event Bus

#### A. Event Bus: `src/services/vajraVakEventBus.ts`
* **File Path:** `src/services/vajraVakEventBus.ts`
* **Supported Events (Lines 7–25):**
  `app_loaded`, `input_focused`, `user_typing`, `query_submitted`, `ai_processing_started`, `retrieval_started`, `file_uploaded`, `file_analysis_started`, `map_analysis_started`, `network_analysis_started`, `result_ready`, `assistant_speaking`, `operation_success`, `operation_error`, `critical_alert`, `page_changed`, `idle_timeout`, `user_returned`.
* **Singleton:** `export const vakBus = new VajraVakEventBus();`

#### B. Mascot Vector Puppet Rig: `src/components/VajraVakMascot.tsx`
* **File Path:** `src/components/VajraVakMascot.tsx`
* **State Machine Configs (`STATE_CONFIGS`, Lines 19–36):**
  16 states with strict priority ordering:
  - Priority 100: `ALERT`, `ALERT_HOLD`
  - Priority 70: `ERROR`
  - Priority 60: `SUCCESS`
  - Priority 50: `STARTUP`, `FLY_IN`
  - Priority 45: `RESULT_READY`
  - Priority 40: `QUERY_SUBMITTED`, `RESPONDING`
  - Priority 35: `THINKING_DEEP`
  - Priority 30: `THINKING`
  - Priority 25: `NAVIGATION`
  - Priority 20: `USER_FOCUS`, `WAKE`
  - Priority 10: `PERCHED_IDLE`
  - Priority 5: `SLEEP`
* **Puppet Rig Rendering (Lines 338–530):**
  Authoritative 38-layer SVG vector puppet rig with articulated wing rotation (`rotate(24deg)` on alert), blinking eyelids, beak speech movement, and talons gripping the anchor perch.

---

### 3.2 Precinct Multi-Agent Orchestrator: `vajra_backend/paperclip_orchestrator.py`

* **File Path:** `vajra_backend/paperclip_orchestrator.py`
* **Departmental Hierarchy & Token Caps (Lines 27–56):**
  ```python
  PRECINCT_DEPARTMENTS = {
      "cyber": {
          "name": "Cyber Crime Division",
          "lead": "Insp. Pradeep K. (Cyber Cell)",
          "cadence": "Every 15 mins",
          "budget_cap": "50,000 tokens/day"
      },
      "legal": {
          "name": "Legal & Remand Division",
          "lead": "Public Prosecutor Deshpande & PSI Raghavendra",
          "cadence": "Daily at 06:00 IST",
          "budget_cap": "40,000 tokens/day"
      },
      "forensics": {
          "name": "Forensic & Crash Physics Division",
          "lead": "Dr. Ananya Sharma (Forensic Science Lab)",
          "cadence": "On-Demand Inquest",
          "budget_cap": "60,000 tokens/day"
      },
      "surveillance": {
          "name": "Field Patrol & Tactical Radar Division",
          "lead": "Control Room Sub-Inspector (CRSI) Patil",
          "cadence": "Real-time SSE Stream",
          "budget_cap": "80,000 tokens/day"
      }
  }
  ```
* **Persistent Ticket Store (Lines 25, 60–114):**
  Persisted to `vajra_backend/paperclip_tickets.json`.
* **Agent Dispatch Integration (`vajra_backend/agent_loop.py`, Lines 13502–13515):**
  Tool `paperclip_orchestrate_agents` schedules asynchronous background tickets and generates court-admissible Section 63 BSA audit trails.

---

### 3.3 Cognitive Memory Vault & Session Memory

#### A. Settings Screen Memory & Reflect UI: `src/screens/SettingsScreen.tsx`
* **File Path:** `src/screens/SettingsScreen.tsx`
* **Cognitive Memory Vault UI (Lines 797–940):**
  - Exact Claude Desktop 2-level UI.
  - Active filter tabs: `"all"`, `"persona"`, `"session"`, `"procedural"`.
  - Natural language memory input bar calling `POST /api/memory/vault/update`.
  - Individual fact cards with single-click prune calling `POST /api/memory/vault/delete`.
* **VAJRA Reflect Telemetry Digest (Lines 943–1020):**
  - Fetches from `GET /api/reflect/telemetry`.
  - Displays monthly cycle (e.g., "October 2026"), narrative shift digest, total inquest count, night-shift percentage, resolved dark-spot hotspots, and top BNS penal statutes.

#### B. Dual-Tier Memory Manager: `vajra_backend/session_memory.py`
* **File Path:** `vajra_backend/session_memory.py`
* **Architecture:**
  - **Tier 1: Micro-Memory (`session:{id}:graph`, Lines 49–108):**
    Tracks active suspects, vehicle plates, phone numbers, and active case IDs within an active session. Supports dynamic topic unbinding via `shift_context_topic()`.
  - **Tier 2: Macro-Memory (`officer:{kgid}:profile`, Lines 242–370):**
    Persists authenticated officer profile, station posting, district, and interaction preferences across sessions.
  - **Dual Caching:** Primary lookups route to Catalyst Cache Segment `Default`; falls back gracefully to in-process rolling dictionary cache `_LOCAL_MICRO_MEMORY`.

---

## 4. DEPENDENCIES & HARDCODING AUDIT

### 4.1 Frontend Dependencies: `package.json`

```json
{
  "dependencies": {
    "@google/genai": "^2.4.0",
    "@tailwindcss/vite": "^4.1.14",
    "@vitejs/plugin-react": "^5.0.4",
    "d3-geo": "^3.1.1",
    "dotenv": "^17.2.3",
    "express": "^4.21.2",
    "leaflet": "^1.9.4",
    "leaflet.heat": "^0.2.0",
    "lucide-react": "^0.546.0",
    "motion": "^12.23.24",
    "react": "^19.0.1",
    "react-dom": "^19.0.1",
    "react-leaflet": "^5.0.0",
    "recharts": "^3.9.0",
    "vite": "^6.2.3"
  }
}
```

---

### 4.2 Legacy Fallbacks & Hardcoding in Backend

* **File Path:** `vajra_backend/agent_loop.py`
* **Belagavi Fallback Invocations:**
  - Line 7616: `district = self.sanitize_sql_input(params.get("district", "Belagavi")).strip()`
  - Line 9252: `station = self.sanitize_sql_input(params.get("station", "Belagavi North")).strip()`
  - Line 9271: `station = self.sanitize_sql_input(params.get("station", "Belagavi North")).strip()`
  - Line 9291: `station = self.sanitize_sql_input(params.get("station", "Belagavi North")).strip()`
  - Line 9312: `station = self.sanitize_sql_input(params.get("station", "Belagavi North")).strip()`
  - Line 10671: `station = self.sanitize_sql_input(params.get("station", "Belagavi North")).strip()`

---

### 4.3 Public Safety Threat Scoring Engine: `vajra_backend/threat_scoring_engine.py`

* **File Path:** `vajra_backend/threat_scoring_engine.py`
* **Actuarial Sub-Metrics (Lines 78–82):**
  1. $RRP$ (Relapse & Recidivism Potential): 0–100 (Prior convictions $\times 35$, pending chargesheets $\times 15$, recency velocity multiplier).
  2. $FER$ (Flight & Procedural Evasion Risk): 0–100 (Unexecuted NBWs $\times 30$, proclamation flags, inter-district evasion).
  3. $SIN$ (Syndicate vs. Individual Nexus): 0–100 (Co-accused density $\ge 5$, Section 111 BNS organized crime eligibility).
* **Composite Formulation (Lines 83–96):**
  ```python
  if has_organized:
      w_relapse, w_flight, w_syndicate = 0.30, 0.30, 0.40
  elif has_violent:
      w_relapse, w_flight, w_syndicate = 0.45, 0.35, 0.20
  else:
      w_relapse, w_flight, w_syndicate = 0.40, 0.35, 0.25

  raw_composite = (w_relapse * rrp) + (w_flight * fer) + (w_syndicate * sin)
  composite_score = max(0, min(100, int(round(raw_composite))))
  ```
* **Statutory Directives (Lines 114–120):**
  Directly triggers Section 187 BNSS 60/90-day statutory remand directives and Section 35(3) BNSS mandatory notice requirements based on the composite score and threat tier.
