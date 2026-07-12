# VAJRA — Phase 0 Complete Codebase Audit & Gap Analysis

---

## 1. BACKEND FILES (`vajra_backend/`)

| File | Current Purpose | Change Needed | Effort (small/moderate/rewrite) | Notes |
| :--- | :--- | :--- | :--- | :--- |
| `main.py` | FastAPI server entry point defining HTTP endpoints. | Refactor `/api/chat` into a real agent tool-calling loop; add session memory reading/writing; implement new `/api/voice/process` pipeline and `/api/chat/export-pdf` routes; apply role-scoped filters to all database queries. | **Moderate refactor** | Preserves existing route framework but routes queries through the centralized agent loop. |
| `vajra_core.py` | Core intelligence classes (firewall, GraphRAG, MO behavioral profiler, TF-IDF semantic memory). | Implement `resolve_vague_query` with strict parameter validation; extend `VajraGraphRAG` to traverse the new `FinancialTransaction` table in Neo4j; add precedent-grounded `suggest_sections` logic with auditing. | **Moderate refactor** | Keeps the custom local scikit-learn based `VajraSemanticMemory` as requested. |
| `train_models.py` | Offline script to train XGBoost outcome risk and DBSCAN hotspot models using local CSV files. | Remove all dependencies/references to real CSV files (`FIR_Details_Data.csv`); retrain models using synthetic data loaded from the Catalyst database. | **Moderate refactor** | Needs to pull records from the live Datastore instead of reading raw CSV datasets. |
| `migrate_to_catalyst.py` | Database seeding script to populate the 30 tables with Faker synthetic records. | Add support for seeding the new `FinancialTransaction` table to enable relationship/network tracing tests. | **Small addition** | Runs once to seed the new transaction schema. |
| `clear_database.py` | Database truncation script to clear all Catalyst tables. | Add the 4 new tables (`AuditLog`, `FinancialTransaction`, `ForecastResults`, `ConsistencyFlags`) to the clear list. | **Small addition** | Keeps cleanup operations in sync. |
| `verify_server.py` | Diagnostic script to perform local GET checks against backend routes. | Add verification tests for the new PDF export, voice processing, and audit log querying endpoints. | **Small addition** | Diagnostic utility. |
| `Dockerfile` | Builds the Docker image for AppSail runtime. | Stays as-is (add system dependencies if needed for PDF conversion). | **Stays as-is** | Standard lightweight slim Python container. |
| `app-config.json` | Manifest detailing command runtime for Zoho Catalyst AppSail. | Stays as-is. | **Stays as-is** | Command executes FastAPI properly on port `$PORT`. |
| `requirements.txt` | Python pip dependencies list. | Add `fpdf2` for server-side PDF conversion and export. | **Small addition** | Minimally expands container size. |

---

## 2. FRONTEND FILES (`src/` and `src/screens/`)

| File / Screen | Current Purpose | Change Needed | Effort (small/moderate/rewrite) | Notes |
| :--- | :--- | :--- | :--- | :--- |
| `screens/AIChatScreen.tsx` | Conversational bilingual chat panel. | **Rebuild as the hero interface**. Implement widget rendering for responses of type `network`, `map`, `risk_breakdown`, and `forecast`. Add expand-to-fullscreen modals, a "still analyzing" Job Function progress state, and PDF export trigger. | **Rewrite** | Will serve as the primary landing hub post-authentication. |
| `screens/CommandCenterScreen.tsx` | Dashboard displaying Recharts stats, maps, and list aggregates. | Refactor to allow loading maps/charts as inline widgets in chat; link listed FIR cards to immediately set focus in chat. | **Moderate refactor** | Standalone screen remains accessible but works in tandem with chat focus. |
| `screens/CaseWorkspaceScreen.tsx` | Grounded case dossier workspace. | Replace local `appendAuditLog` mock calls with real backend logging API calls. | **Moderate refactor** | Remains reachable for deep cases reviews, with updated logging. |
| `screens/AccusedProfileScreen.tsx` | Profile dossier of accused persons. | Replace local `appendAuditLog` mock calls with real backend logging. | **Small addition** | Integrates real audit trails. |
| `screens/SpatialScreen.tsx` | Leaflet geospatial visualization map. | Integrate as an inline map widget for chat, and replace mock audit logger calls with backend API queries. | **Moderate refactor** | Standalone remains navigable; widget provides inline focus. |
| `screens/NetworkScreen.tsx` | Relationship network graph visualizer. | Integrate as an inline network widget for chat; replace mock audit log calls with real backend queries. | **Moderate refactor** | Uses the new `FinancialTransaction` nodes in Neo4j. |
| `screens/AuditTrailScreen.tsx` | Query ledger access log viewer. | Query data directly from the new `/api/audit-logs` endpoint instead of `mockAuditLogs`. Remove local mock appending. | **Moderate refactor** | Restrictive supervisor-only view. |
| `screens/AlertsFeedScreen.tsx` | Computed threat notifications list. | Replace local mock audit log calls with backend queries. | **Small addition** | Relies on backend threat detections. |
| `screens/ReportsScreen.tsx` | Correlation and demographic graphs. | Connect charts to read live forecasting data from the `ForecastResults` table. | **Moderate refactor** | Surfaced from time-series Job Functions. |
| `screens/FIRSearchScreen.tsx` | Searchable case registry table. | Stays as-is (reads dynamic case data). | **Stays as-is** | Serves as the search lookup. |
| `screens/SettingsScreen.tsx` | Core settings panel (Language, Theme, Connection statuses). | Stays as-is. | **Stays as-is** | Standard controls. |
| `screens/LandingScreen.tsx` | Initial system landing page. | Stays as-is. | **Stays as-is** | Branding introduction. |
| `screens/LoginScreen.tsx` | Authentication KGID/Password form. | Stays as-is. | **Stays as-is** | Standard validation. |
| `mockData.ts` | Fallback and mock data arrays. | Keep the interface definitions but remove the mock append methods and telemetry logging variables once backend logging is active. | **Moderate refactor** | Cleans up local sandbox telemetry. |

---

## 3. AUDITED `appendAuditLog` CALLS (To be replaced with real backend calls)

Every occurrence of mock data logging in `src/screens/` was located:
*   [src/screens/SpatialScreen.tsx:L172](file:///c:/Users/B.C%20SAKETH/Downloads/VAJRA-main/src/screens/SpatialScreen.tsx#L172) — Logs spatial map loads.
*   [src/screens/SpatialScreen.tsx:L423](file:///c:/Users/B.C%20SAKETH/Downloads/VAJRA-main/src/screens/SpatialScreen.tsx#L423) — Logs hotspot cluster calculations.
*   [src/screens/NetworkScreen.tsx:L149](file:///c:/Users/B.C%20SAKETH/Downloads/VAJRA-main/src/screens/NetworkScreen.tsx#L149) — Logs syndicate relationship fetches.
*   [src/screens/CaseWorkspaceScreen.tsx:L196](file:///c:/Users/B.C%20SAKETH/Downloads/VAJRA-main/src/screens/CaseWorkspaceScreen.tsx#L196) — Logs dossier detail fetches.
*   [src/screens/CaseWorkspaceScreen.tsx:L213](file:///c:/Users/B.C%20SAKETH/Downloads/VAJRA-main/src/screens/CaseWorkspaceScreen.tsx#L213) — Logs case timeline calculations.
*   [src/screens/AuditTrailScreen.tsx:L23](file:///c:/Users/B.C%20SAKETH/Downloads/VAJRA-main/src/screens/AuditTrailScreen.tsx#L23) — Logs ledger manual refreshes.
*   [src/screens/AlertsFeedScreen.tsx:L56](file:///c:/Users/B.C%20SAKETH/Downloads/VAJRA-main/src/screens/AlertsFeedScreen.tsx#L56) — Logs alerts feed page loads.
*   [src/screens/AlertsFeedScreen.tsx:L67](file:///c:/Users/B.C%20SAKETH/Downloads/VAJRA-main/src/screens/AlertsFeedScreen.tsx#L67) — Logs alert acknowledgment actions.
*   [src/screens/AIChatScreen.tsx:L122](file:///c:/Users/B.C%20SAKETH/Downloads/VAJRA-main/src/screens/AIChatScreen.tsx#L122) — Logs conversational grounded chats.
*   [src/screens/AccusedProfileScreen.tsx:L104](file:///c:/Users/B.C%20SAKETH/Downloads/VAJRA-main/src/screens/AccusedProfileScreen.tsx#L104) — Logs offender profile lookups.

---

## 4. COMPLIANCE & RISK CLEANUP GAPS

To comply with the strict **synthetic data only** mandate and prevent conflicting or misleading branding, the following text references must be removed/renamed:

*   **Real CSV files in Workspace**:
    *   `FIR_Details_Data.csv` (contains real/sensitive data)
    *   `Copy of AccidentReports.csv` (contains real/sensitive data)
    *   `Crime_Data.csv` (contains real/sensitive data)
*   **Stray Real-World Copy**:
    *   `server.ts:L60` — `You have access to 1.6 Million historical CCTNS Karnataka Police records.`
    *   `src/screens/FIRSearchScreen.tsx:L96` — `desc: "Instant search of 1.6 Million historical entries from the Kaggle SCRB dataset. Instantly filter by police station jurisdiction and file processing state."`
    *   `src/screens/ReportsScreen.tsx:L254` — `KAGGLE-KARNATAKA-SCRB-1.6M`
    *   `src/screens/LandingScreen.tsx:L90` — `Dataset Coverage: 1,100+ stations | 1.6M Classified NCRB/CCTNS`
    *   `src/screens/CommandCenterScreen.tsx:L724` — `kpiTotalFIRsSub: "1.6M+ Historical Coverage"`
    *   `src/screens/AIChatScreen.tsx:L81` — `? "VAJRA Bilingual AI Core operational. I have index-grounding connection over the real 1.6M Karnataka Police FIR dataset (Kaggled). Provide text or speech input to begin."`
    *   `src/screens/AIChatScreen.tsx:L336` — `en: "List the 1.6M Karnataka dataset core properties."`
    *   `src/i18n.ts:L51` — `landingDesc` containing `1.6M+ historical records` and associated Kannada translations.

---

## 5. DOCUMENTATION & INVENTORY GAPS

*   **Architecture Docs**: There are three separate architecture documents (`docs/VAJRA_Requirements_Architecture.md`, `docs/VAJRA_Security_Requirements_Crosscheck.md`, and `docs/VAJRA_New_Tables_Schema.md`). They need to be merged into a single canonical architecture guide for the judges.
*   **Living Schemas**: No canonical `SCHEMA.md` detailing the column and relationship mappings of the 30+ tables exists.
*   **Secrets & Scopes Guide**: No `SECRETS.md` document exists detailing OAuth runtime scopes vs seeding scopes.

---

## 6. INVENTORY SUMMARY

### Files to delete
*   `FIR_Details_Data.csv` (contains real/sensitive data, compliance hazard)
*   `Copy of AccidentReports.csv` (contains real/sensitive data, compliance hazard)
*   `Crime_Data.csv` (contains real/sensitive data, compliance hazard)

### Files to create
*   `vajra_backend/session_memory.py` — Manages multi-turn conversation context utilizing the Catalyst Cache service.
*   `vajra_backend/train_forecast_model.py` — Background Job Function script performing seasonal forecasting per district/crime head.
*   `vajra_backend/flag_section_mismatches.py` — Background Job Function checking classification consistency against the semantic database.

---

**STOP HERE.** 

Please review this Phase 0 report and provide your feedback. Do not proceed to Phase 1 until you explicitly instruct to do so.
