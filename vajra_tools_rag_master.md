# VAJRA: MASTER AGENTIC TOOL REGISTRY & DISPATCH ENCYCLOPEDIA (134 TOOLS)
### Official Semantic Knowledge Base for GLM-4.7 & QuickML Agentic Tool Selection, Natural Language Query Matching, Parameter Resolution, and Bharatiya Nyaya Sanhita (BNS/BNSS/BSA 2023) Legal Grounding
**Karnataka State Police (KSP) • State Crime Records Bureau (SCRB) • Zoho Catalyst QuickML Knowledge Base**

---

## 📌 Knowledge Base Ingestion Guidelines for Zoho Catalyst RAG
1. **Document Role:** Primary semantic knowledge base for Agentic RAG tool selection, ZCQL query generation, parameter extraction, and statutory legal grounding.
2. **Intended Consumers:** GLM-4.7-Flash Cognitive Brain, Qwen-2.5-Coder Assistant, and Catalyst QuickML Vector Embedding Pipeline.
3. **Chunking Configuration:** Semantic Markdown Boundary (800 tokens chunk size, 150 tokens overlap).
4. **Multilingual Support:** Full native support for English, Kannada script (ಕನ್ನಡ), and Romanized Kannada (e.g. *case details thorsu*).

---

## 🧠 GLM-4.7 Cognitive Brain Decision-Making & Tool Selection Protocol

When an officer submits a natural-language inquiry, the GLM planner must adhere to the following strict routing principles:
1. **Single vs. Multi-Faceted Inquiries:**
   - If the officer asks a focused single-dimension question (e.g., *"Show hotspots in Belagavi"*), select the single specialized tool (`query_hotspots`).
   - If the officer asks an investigative compound query (e.g., *"Investigate chain snatching across Bengaluru: check hotspots, repeat offenders, and syndicate ties"*), dispatch all relevant tools **in parallel** (`find_similar_cases`, `query_hotspots`, `get_repeat_offenders`, `query_graph_network`).
2. **Disambiguation Discipline:**
   - Specific Case Number present (`CR-2026-XXXX`, `FIR-2026-XXXX`) $\rightarrow$ Call `query_case` or `generate_case_dossier`.
   - Vague Crime Technique / Pattern / MO across cases $\rightarrow$ Call `find_similar_cases` (NOT `query_case` or `get_crime_trends`).
   - Specific Named Suspect $\rightarrow$ Call `search_accused_by_name` or `get_offender_profile`.
   - Two or More Named People / Connections $\rightarrow$ Call `query_graph_network` or `trace_connection_path`.
   - Geographic Concentration / Map / Area $\rightarrow$ Call `query_hotspots`.
   - Time Series / Rising vs Falling Crime Velocity $\rightarrow$ Call `get_crime_trends` or `get_forecast`.
   - Officer Personal Data (*"who am I", "my rank", "my station"*) $\rightarrow$ Call `get_my_profile`.
3. **Zero Fabrication Invariant:** Never fabricate case numbers, suspect names, or sections. If a record does not exist, disclose it clearly.
4. **Statutory Integrity:** Ground all operational procedures in the appropriate provisions of BNS 2023, BNSS 2023, and BSA 2023.

---

# 📚 COMPLETE 134 OPERATIONAL TOOL REGISTRY


### Tool 1: `generate_case_dossier` — Generate 360-Degree Comprehensive Master Investigation Dossier
* **Exact Tool Name for GLM:** `generate_case_dossier`
* **Operational Purpose & Mission:** Synthesize an end-to-end court-ready investigation dossier combining FIR facts, accused roster, applied BNS sections, statutory default bail clocks, witness statements, and evidence hash provenance into a unified executive package.
* **When to Select this Tool (Disambiguation Rules for GLM):** Use when an officer asks for a 'full dossier', 'complete case review', 'master case report', or 'comprehensive investigation file' for a specific FIR number. Do NOT use for quick single-field lookups (use `query_case` instead).
* **Target Personas:** Investigating Officer (IO), Station House Officer (SHO), Superintendent of Police (SP), Public Prosecutor
* **Backend Data Sources & ZCQL Schemas:** CaseMaster, Accused, Complainant, CaseDiary, Unit, MalkhanaProperty
* **Visual Response Type & UI Card:** `master_case_dossier`
* **Statutory Legal Grounding:** Section 193 BNSS (Police Report / Final Form) & Section 63 BSA (Digital Provenance)
* **Parameters Specification:**
```json
{
  "case_no": {
    "type": "string",
    "description": "The CCTNS Crime or FIR number (e.g., 'CR-2026-46092')",
    "required": true
  }
}
```
* **Representative Officer Queries (Semantic Match Triggers):**
  * "Generate complete dossier for CR-2026-46092"
  * "Give me full investigation dossier of case 104/2026"
  * "ಪ್ರಕರಣ CR-2026-46092 ರ ಸಂಪೂರ್ಣ ತನಿಖಾ ಕಡತ ನೀಡಿ"
  * "full case file for Peenya robbery"

---


### Tool 2: `web_search` — Live Open-Source Intelligence & Public Web Search
* **Exact Tool Name for GLM:** `web_search`
* **Operational Purpose & Mission:** Execute real-time live open-source intelligence (OSINT) searches via DuckDuckGo / Serper to track breaking news, trending public events, company registries, or open-web suspect footprints.
* **When to Select this Tool (Disambiguation Rules for GLM):** Use when an inquiry requires external real-world internet intelligence not present in internal CCTNS databases (e.g., news about a protest, foreign company lookup, recent public incidents). Do NOT use for internal police FIR lookups.
* **Target Personas:** Cyber Crime Officer, Intelligence Wing, Law & Order Inspector
* **Backend Data Sources & ZCQL Schemas:** External Live Search API (DuckDuckGo / Serper)
* **Visual Response Type & UI Card:** `web_search_results`
* **Statutory Legal Grounding:** Section 63 BSA (Electronic evidence provenance)
* **Parameters Specification:**
```json
{
  "query": {
    "type": "string",
    "description": "Search query keywords",
    "required": true
  }
}
```
* **Representative Officer Queries (Semantic Match Triggers):**
  * "Search news for highway protests near Nelamangala toll"
  * "Search internet for latest viral video trends"
  * "ವೈರಲ್ ವೀಡಿಯೊ ಸುದ್ದಿಗಾಗಿ ಹುಡುಕಿ"
  * "lookup company director details on public web"

---


### Tool 3: `get_my_profile` — Authenticated Officer Credentials & Station Posting
* **Exact Tool Name for GLM:** `get_my_profile`
* **Operational Purpose & Mission:** Retrieve the currently logged-in officer's authenticated service profile: Full Name, KGID Badge Number, Rank, Designation, Home Police Station, Assigned District, and Role Tier.
* **When to Select this Tool (Disambiguation Rules for GLM):** Use whenever the user asks about THEMSELVES ('who am I', 'my details', 'what is my rank', 'which police station am I posted at', 'my profile'). Do NOT use to search for suspects or other officers.
* **Target Personas:** All Police Personnel
* **Backend Data Sources & ZCQL Schemas:** Session Auth Token, OfficerMaster, Unit, District
* **Visual Response Type & UI Card:** `officer_profile_card`
* **Statutory Legal Grounding:** Karnataka Police Manual (Service Credentials & RBAC Access Scope)
* **Parameters Specification:**
*None (Takes no input arguments).*
* **Representative Officer Queries (Semantic Match Triggers):**
  * "Who am I?"
  * "What is my badge number and rank?"
  * "ನನ್ನ ಪ್ರೊಫೈಲ್ ವಿವರ ತೋರಿಸಿ"
  * "Which police station am I assigned to?"

---


### Tool 4: `list_cases_sharing_id` — Internal Database ID Collision & Multi-Case Disambiguation
* **Exact Tool Name for GLM:** `list_cases_sharing_id`
* **Operational Purpose & Mission:** Identify and list other cases sharing the same internal database identifier (CaseMasterID). Used for data integrity auditing and resolving non-unique ID collisions across legacy CCTNS rows.
* **When to Select this Tool (Disambiguation Rules for GLM):** Use when an officer specifically asks about cases sharing an internal ID, ID collisions, or data integrity warnings. Do NOT use for finding similar MO cases (use `find_similar_cases`).
* **Target Personas:** CCTNS System Administrator, Court Liaison Officer
* **Backend Data Sources & ZCQL Schemas:** CaseMaster WHERE CaseMasterID = (SELECT CaseMasterID FROM CaseMaster WHERE CrimeNo = ...)
* **Visual Response Type & UI Card:** `case_list`
* **Statutory Legal Grounding:** SCRB Data Quality & Judicial Record Integrity Guidelines
* **Parameters Specification:**
```json
{
  "case_no": {
    "type": "string",
    "description": "Target case number",
    "required": true
  }
}
```
* **Representative Officer Queries (Semantic Match Triggers):**
  * "List cases sharing internal ID with CR-2026-104"
  * "Check ID collisions for case 46092"
  * "ಈ ಐಡಿಯನ್ನು ಹಂಚಿಕೊಳ್ಳುವ ಇತರ ಪ್ರಕರಣಗಳನ್ನು ತೋರಿಸಿ"

---


### Tool 5: `query_case` — Structured 360-Degree FIR Record & Accused Lookup
* **Exact Tool Name for GLM:** `query_case`
* **Operational Purpose & Mission:** Perform a high-precision structured lookup of an individual FIR: extracts brief facts, incident date and time, complainant details, accused roster, applied IPC/BNS statutory sections, and police station jurisdiction.
* **When to Select this Tool (Disambiguation Rules for GLM):** Use when the officer provides a specific Case/FIR number (e.g. 'CR-313/2026', 'FIR 104/2026') and wants its facts and accused roster. Do NOT use for general crime topic searches without a case number.
* **Target Personas:** Investigating Officer, Station House Officer, Magistrate Court Constable
* **Backend Data Sources & ZCQL Schemas:** CaseMaster, Accused, Unit, District
* **Visual Response Type & UI Card:** `case_summary_panel`
* **Statutory Legal Grounding:** Section 173 BNSS (Information in Cognizable Cases)
* **Parameters Specification:**
```json
{
  "case_no": {
    "type": "string",
    "description": "Exact FIR or Crime Number",
    "required": true
  }
}
```
* **Representative Officer Queries (Semantic Match Triggers):**
  * "Get details for case CR-2026-46092"
  * "Show FIR facts for 2026/0420"
  * "ಪ್ರಕರಣ CR-2026-46092 ರ ವಿವರ ತೋರಿಸಿ"
  * "who is the accused in CR-313/2026?"

---


### Tool 6: `summarize_case` — Role-Tailored Executive Case Briefing
* **Exact Tool Name for GLM:** `summarize_case`
* **Operational Purpose & Mission:** Generate a concise, role-adapted executive briefing of an FIR tailored to the specific operational lens of the reader (Investigating Officer, Station House Officer, Superintendent of Police, or Public Prosecutor).
* **When to Select this Tool (Disambiguation Rules for GLM):** Use when an officer asks for a 'summary', 'briefing', 'quick rundown', or 'gist' of a specific case number. Differentiated from `query_case` by producing synthesized analytical summaries rather than raw fields.
* **Target Personas:** Superintendent of Police, Public Prosecutor, Circle Inspector
* **Backend Data Sources & ZCQL Schemas:** CaseMaster, Accused, CaseDiary
* **Visual Response Type & UI Card:** `case_summary_panel`
* **Statutory Legal Grounding:** Section 193 BNSS
* **Parameters Specification:**
```json
{
  "case_no": {
    "type": "string",
    "description": "Target case number",
    "required": true
  },
  "role": {
    "type": "string",
    "description": "Target role lens (IO, SHO, SP, Prosecutor)",
    "required": false,
    "default": "IO"
  }
}
```
* **Representative Officer Queries (Semantic Match Triggers):**
  * "Summarize case CR-2026-46092 for SP review"
  * "Give me a quick prosecutor summary of case 104"
  * "ಈ ಪ್ರಕರಣದ ಸಾರಾಂಶ ನೀಡಿ"

---


### Tool 7: `add_diary_entry` — Record Cryptographic Case Diary Entry (§193(1) BNSS)
* **Exact Tool Name for GLM:** `add_diary_entry`
* **Operational Purpose & Mission:** Write an official daily investigation log into the CCTNS Case Diary table with immutable SHA-256 Merkle hash stamping under Section 193(1) BNSS, recording steps taken, witnesses examined, or scenes visited.
* **When to Select this Tool (Disambiguation Rules for GLM):** Use when an officer instructs to 'add diary entry', 'log to case diary', 'record in case diary', or 'update CD'.
* **Target Personas:** Investigating Officer (PSI / PI)
* **Backend Data Sources & ZCQL Schemas:** CaseDiary (`INSERT INTO CaseDiary`)
* **Visual Response Type & UI Card:** `diary_entry_card`
* **Statutory Legal Grounding:** Section 193(1) BNSS (Mandatory Diary of Proceedings in Investigation) & Section 63 BSA
* **Parameters Specification:**
```json
{
  "case_no": {
    "type": "string",
    "description": "Case number",
    "required": true
  },
  "entry_text": {
    "type": "string",
    "description": "Text describing investigative step",
    "required": true
  },
  "officer_name": {
    "type": "string",
    "description": "Name/Rank of recording officer",
    "required": false
  }
}
```
* **Representative Officer Queries (Semantic Match Triggers):**
  * "Add diary entry for CR-2026-46092: Examined witness Ramesh at scene"
  * "Log to case diary for case 104: Seized CCTV footage"
  * "ಕೇಸ್ ಡೈರಿಗೆ ದಾಖಲಿಸಿ"

---


### Tool 8: `track_statutory_deadlines` — Mandatory BNSS Procedural Timeline & Default Bail Audit
* **Exact Tool Name for GLM:** `track_statutory_deadlines`
* **Operational Purpose & Mission:** Audit all statutory deadlines on a pending investigation: Section 187 BNSS 60/90-day default bail clock, Section 173(3) BNSS 14-day preliminary inquiry window, and mandatory complainant progress notifications.
* **When to Select this Tool (Disambiguation Rules for GLM):** Use when an officer asks about 'deadlines', 'statutory timelines', 'days remaining', 'default bail risk', or 'when is chargesheet due'.
* **Target Personas:** Station House Officer, Sub-Divisional Officer (DySP), Public Prosecutor
* **Backend Data Sources & ZCQL Schemas:** CaseMaster (CrimeRegisteredDate, CrimeStage)
* **Visual Response Type & UI Card:** `statutory_deadlines_card`
* **Statutory Legal Grounding:** Section 173(3), 187(2), 193(3) BNSS
* **Parameters Specification:**
```json
{
  "case_no": {
    "type": "string",
    "description": "Case number",
    "required": true
  }
}
```
* **Representative Officer Queries (Semantic Match Triggers):**
  * "Check statutory deadlines for CR-2026-46092"
  * "How many days left to file chargesheet in case 104?"
  * "ಶಾಸನಬದ್ಧ ಗಡುವನ್ನು ಪರಿಶೀಲಿಸಿ"

---


### Tool 9: `resolve_vague_query` — Vague Narrative Disambiguation & Semantic Candidate Resolver
* **Exact Tool Name for GLM:** `resolve_vague_query`
* **Operational Purpose & Mission:** Disambiguate underspecified, vague, or colloquial police queries (e.g., 'that murder in Hebbal near flyover last month') by matching keywords against historical narratives and returning structured candidates.
* **When to Select this Tool (Disambiguation Rules for GLM):** Use as a fallback when an officer's query does not contain an exact Case Number or exact Suspect Name, but describes an event narrative.
* **Target Personas:** All Officers
* **Backend Data Sources & ZCQL Schemas:** CaseMaster (Full-text narrative search)
* **Visual Response Type & UI Card:** `case_list`
* **Statutory Legal Grounding:** CCTNS Police Query Standard
* **Parameters Specification:**
```json
{
  "query": {
    "type": "string",
    "description": "Descriptive text or fuzzy details",
    "required": true
  }
}
```
* **Representative Officer Queries (Semantic Match Triggers):**
  * "Resolve case about gold heist near railway station"
  * "Find that murder case in Jayanagar last week"
  * "ಕಳೆದ ವಾರ ಜಯನಗರದಲ್ಲಿ ನಡೆದ ಕೊಲೆ ಪ್ರಕರಣ"

---


### Tool 10: `get_case_sections` — Active Statutory Penal Sections & Legal Breakdown
* **Exact Tool Name for GLM:** `get_case_sections`
* **Operational Purpose & Mission:** Extract all active IPC, BNS, and special act (POCSO, NDPS, Arms Act) statutory penal sections registered in a case, complete with legal descriptions, bailability status, and maximum imprisonment terms.
* **When to Select this Tool (Disambiguation Rules for GLM):** Use when an officer asks 'what sections are applied', 'check charges on this case', or 'statutory sections of FIR'.
* **Target Personas:** Investigating Officer, Public Prosecutor
* **Backend Data Sources & ZCQL Schemas:** CaseMaster (ActSection)
* **Visual Response Type & UI Card:** `sections_breakdown_card`
* **Statutory Legal Grounding:** BNS 2023 / IPC 1860 Penal Codes
* **Parameters Specification:**
```json
{
  "case_no": {
    "type": "string",
    "description": "Case number",
    "required": true
  }
}
```
* **Representative Officer Queries (Semantic Match Triggers):**
  * "What sections are applied in CR-2026-46092?"
  * "Show legal sections for case 104"
  * "ಈ ಪ್ರಕರಣದಲ್ಲಿ ದಾಖಲಿಸಲಾದ ಕಲಂಗಳು ಯಾವುವು?"

---


### Tool 11: `get_fir_details` — Raw CCTNS First Information Report Record Extraction
* **Exact Tool Name for GLM:** `get_fir_details`
* **Operational Purpose & Mission:** Fetch verbatim CCTNS First Information Report register entries: complainant statements, exact occurrence timestamps, distance from police station, and initial penal sections.
* **When to Select this Tool (Disambiguation Rules for GLM):** Use when the officer requests the verbatim FIR text, raw complainant statement, or initial registration details.
* **Target Personas:** Investigating Officer, Court Liaison Officer
* **Backend Data Sources & ZCQL Schemas:** CaseMaster, FIR, Complainant
* **Visual Response Type & UI Card:** `fir_details_card`
* **Statutory Legal Grounding:** Section 173 BNSS
* **Parameters Specification:**
```json
{
  "case_no": {
    "type": "string",
    "description": "Case number",
    "required": true
  }
}
```
* **Representative Officer Queries (Semantic Match Triggers):**
  * "Get raw FIR text for CR-2026-46092"
  * "Show FIR complainant statement for case 104"
  * "ಎಫ್‌ಐಆರ್ ವಿವರ ತೋರಿಸಿ"

---


### Tool 12: `search_cases_by_keyword` — Full-Text Lexical CCTNS Narrative Discovery
* **Exact Tool Name for GLM:** `search_cases_by_keyword`
* **Operational Purpose & Mission:** Search across all historical FIR narrative fields (`BriefFacts`, `ActSection`, `PlaceOfOccurence`) for specific weapons, keywords, vehicle makes, or property items across Karnataka State.
* **When to Select this Tool (Disambiguation Rules for GLM):** Use when an officer searches for specific physical keywords (e.g. 'gas cutter', 'pillion snatch', 'fake currency', 'country pistol').
* **Target Personas:** Investigating Officer, Crime Branch Detective
* **Backend Data Sources & ZCQL Schemas:** CaseMaster WHERE BriefFacts LIKE '%keyword%'
* **Visual Response Type & UI Card:** `case_list`
* **Statutory Legal Grounding:** CCTNS Information Retrieval Standard
* **Parameters Specification:**
```json
{
  "keyword": {
    "type": "string",
    "description": "Search phrase or weapon/object name",
    "required": true
  },
  "district": {
    "type": "string",
    "description": "District filter",
    "required": false
  }
}
```
* **Representative Officer Queries (Semantic Match Triggers):**
  * "Search cases involving gas cutter break-ins"
  * "Find cases mentioning country made pistol in Belagavi"
  * "ಗ್ಯಾಸ್ ಕಟ್ಟರ್ ಬಳಸಿದ ಪ್ರಕರಣಗಳನ್ನು ಹುಡುಕಿ"

---


### Tool 13: `get_recent_cases` — Chronological Fresh Case Ledger (Last 24–72 Hours)
* **Exact Tool Name for GLM:** `get_recent_cases`
* **Operational Purpose & Mission:** Fetch newly registered FIRs across assigned precincts or districts within the last 24 to 72 hours for immediate executive triage, morning roll-call, and supervisory allocation.
* **When to Select this Tool (Disambiguation Rules for GLM):** Use when an officer asks for 'recent cases', 'fresh FIRs today', 'latest crimes in my station', or 'new cases this week'.
* **Target Personas:** Station Duty Officer, Control Room In-Charge, Superintendent of Police
* **Backend Data Sources & ZCQL Schemas:** CaseMaster ORDER BY CrimeRegisteredDate DESC
* **Visual Response Type & UI Card:** `case_list`
* **Statutory Legal Grounding:** KSP Daily Crime Incident Reporting Protocol
* **Parameters Specification:**
```json
{
  "limit": {
    "type": "integer",
    "description": "Number of cases to return",
    "required": false,
    "default": 10
  },
  "district": {
    "type": "string",
    "description": "District filter",
    "required": false
  }
}
```
* **Representative Officer Queries (Semantic Match Triggers):**
  * "Show recent cases in Bengaluru Urban"
  * "List latest FIRs registered today"
  * "ಇತ್ತೀಚಿನ ಪ್ರಕರಣಗಳನ್ನು ತೋರಿಸಿ"

---


### Tool 14: `get_case_timeline` — End-to-End Chronological Case Progression Timeline
* **Exact Tool Name for GLM:** `get_case_timeline`
* **Operational Purpose & Mission:** Reconstruct the complete chronological timeline of an investigation: from crime occurrence, FIR registration, scene inspection, witness examination, arrest, FSL sample dispatch, to chargesheet readiness.
* **When to Select this Tool (Disambiguation Rules for GLM):** Use when an officer asks for 'case timeline', 'chronology of investigation', 'timeline of events', or 'how did this case progress'.
* **Target Personas:** Investigating Officer, Public Prosecutor, Supervisory SP
* **Backend Data Sources & ZCQL Schemas:** CaseMaster, CaseDiary ORDER BY EntryDate ASC
* **Visual Response Type & UI Card:** `timeline`
* **Statutory Legal Grounding:** Section 193 BNSS
* **Parameters Specification:**
```json
{
  "case_no": {
    "type": "string",
    "description": "Target case number",
    "required": true
  }
}
```
* **Representative Officer Queries (Semantic Match Triggers):**
  * "Show chronological timeline for CR-2026-46092"
  * "Give me timeline of events in case 104"
  * "ಪ್ರಕರಣದ ಕಾಲಾನುಕ್ರಮ ಘಟನಾವಳಿ ತೋರಿಸಿ"

---


### Tool 15: `search_diary_entries` — Historical Case Diary Search & Keyword Lookup
* **Exact Tool Name for GLM:** `search_diary_entries`
* **Operational Purpose & Mission:** Search through historical Case Diary folios of a specific case or officer to find witness interviews, alibi verification logs, or vehicle search notes.
* **When to Select this Tool (Disambiguation Rules for GLM):** Use when an officer needs to recall a specific step recorded in past diary entries.
* **Target Personas:** Investigating Officer, Court Prosecutor
* **Backend Data Sources & ZCQL Schemas:** CaseDiary WHERE CaseMasterID = ... AND Summary LIKE ...
* **Visual Response Type & UI Card:** `diary_entry_card`
* **Statutory Legal Grounding:** Section 193(1) BNSS
* **Parameters Specification:**
```json
{
  "case_no": {
    "type": "string",
    "description": "Case number",
    "required": true
  },
  "keyword": {
    "type": "string",
    "description": "Keyword to search within diary",
    "required": false
  }
}
```
* **Representative Officer Queries (Semantic Match Triggers):**
  * "Search diary entries for witness statement in CR-2026-46092"
  * "Find alibi verification in case diary 104"
  * "ಡೈರಿ ದಾಖಲೆಗಳಲ್ಲಿ ಹುಡುಕಿ"

---


### Tool 16: `get_case_diary_stats` — Investigation Recording Frequency & Case Diary Velocity
* **Exact Tool Name for GLM:** `get_case_diary_stats`
* **Operational Purpose & Mission:** Analyze case diary recording velocity: total folios written, average days between entries, lapses exceeding 7 days, and statutory compliance under Karnataka Police Regulations.
* **When to Select this Tool (Disambiguation Rules for GLM):** Use when a supervisory officer inspects whether an IO is updating their case diary promptly.
* **Target Personas:** Station House Officer, Superintendent of Police
* **Backend Data Sources & ZCQL Schemas:** CaseDiary (COUNT, MIN/MAX Date)
* **Visual Response Type & UI Card:** `case_diary_stats_card`
* **Statutory Legal Grounding:** Karnataka Police Manual §1237
* **Parameters Specification:**
```json
{
  "case_no": {
    "type": "string",
    "description": "Case number",
    "required": true
  }
}
```
* **Representative Officer Queries (Semantic Match Triggers):**
  * "Check diary entry statistics for CR-2026-46092"
  * "How frequently is case diary being written for case 104?"
  * "ಕೇಸ್ ಡೈರಿ ಅಂಕಿಅಂಶಗಳನ್ನು ಪರಿಶೀಲಿಸಿ"

---


### Tool 17: `get_case_status` — Official Judicial & Investigation Lifecycle State
* **Exact Tool Name for GLM:** `get_case_status`
* **Operational Purpose & Mission:** Retrieve the certified judicial stage of a case: Pending Investigation, Chargesheeted, Disposed, Quashed by High Court, or Pending Trial.
* **When to Select this Tool (Disambiguation Rules for GLM):** Use when an officer or citizen liaison asks for the current official status of an FIR.
* **Target Personas:** Complainant Liaison Officer, Station Writer
* **Backend Data Sources & ZCQL Schemas:** CaseMaster (CrimeStage)
* **Visual Response Type & UI Card:** `status_pill`
* **Statutory Legal Grounding:** Section 193(3) BNSS
* **Parameters Specification:**
```json
{
  "case_no": {
    "type": "string",
    "description": "Case number",
    "required": true
  }
}
```
* **Representative Officer Queries (Semantic Match Triggers):**
  * "What is the current status of case CR-2026-46092?"
  * "Has chargesheet been filed in case 104?"
  * "ಪ್ರಕರಣದ ಪ್ರಸ್ತುತ ಸ್ಥಿತಿ ಏನು?"

---


### Tool 18: `get_chargesheet_ready_cases` — Final Report Readiness & Chargesheet Radar
* **Exact Tool Name for GLM:** `get_chargesheet_ready_cases`
* **Operational Purpose & Mission:** Identify all active investigations where evidence collection and FSL reports are complete, and Draft Final Form (§193 BNSS) is ready for judicial submission before the Magistrate.
* **When to Select this Tool (Disambiguation Rules for GLM):** Use when reviewing cases ready for chargesheet submission to prevent default bail.
* **Target Personas:** Circle Inspector, Assistant Public Prosecutor
* **Backend Data Sources & ZCQL Schemas:** CaseMaster WHERE CrimeStage = 'Investigation Complete'
* **Visual Response Type & UI Card:** `case_list`
* **Statutory Legal Grounding:** Section 193(2) BNSS
* **Parameters Specification:**
```json
{
  "district": {
    "type": "string",
    "description": "District filter",
    "required": false
  }
}
```
* **Representative Officer Queries (Semantic Match Triggers):**
  * "Show cases ready for chargesheet in Bengaluru Urban"
  * "List cases where final report is pending filing"
  * "ದೋಷಾರೋಪಣಾ ಪಟ್ಟಿ ಸಲ್ಲಿಕೆಗೆ ಸಿದ್ಧವಾಗಿರುವ ಪ್ರಕರಣಗಳು"

---


### Tool 19: `get_offender_risk` — Machine-Learned Recidivism Risk Scoring (XGBoost + SHAP)
* **Exact Tool Name for GLM:** `get_offender_risk`
* **Operational Purpose & Mission:** Calculate calibrated recidivism risk probability (0–100%) and feature importance explanations for an offender using pre-trained XGBoost models and SHAP TreeExplainer values.
* **When to Select this Tool (Disambiguation Rules for GLM):** Use when an officer assesses flight risk, repeat offence probability, or bail suitability.
* **Target Personas:** Investigating Officer, Public Prosecutor, Bail Opposition Cell
* **Backend Data Sources & ZCQL Schemas:** xgboost_risk_model.joblib, shap_explainer.joblib, AccusedMaster
* **Visual Response Type & UI Card:** `risk`
* **Statutory Legal Grounding:** Criminological Recidivism Risk Assessment Standard
* **Parameters Specification:**
```json
{
  "accused_name": {
    "type": "string",
    "description": "Name of accused or case number",
    "required": true
  }
}
```
* **Representative Officer Queries (Semantic Match Triggers):**
  * "Calculate risk score for accused Ramesh Kumar"
  * "What is reoffense risk probability for suspect in CR-46092?"
  * "ಆರೋಪಿಯ ಮರು-ಅಪರಾಧ ಅಪಾಯದ ಸ್ಕೋರ್"

---


### Tool 20: `get_offender_profile` — 360-Degree Comprehensive Accused Profile & History
* **Exact Tool Name for GLM:** `get_offender_profile`
* **Operational Purpose & Mission:** Retrieve complete criminal dossier on a suspect: aliases, parentage, permanent address, physical identification marks, active warrants, historical FIRs, and gang associations.
* **When to Select this Tool (Disambiguation Rules for GLM):** Use when interrogating or profiling a specific suspect whose full background is needed.
* **Target Personas:** Crime Branch Detective, Interrogation Officer
* **Backend Data Sources & ZCQL Schemas:** AccusedMaster, AccusedCaseDetails, CaseMaster
* **Visual Response Type & UI Card:** `offender_profile_card`
* **Statutory Legal Grounding:** CCTNS Criminal Dossier Standard
* **Parameters Specification:**
```json
{
  "accused_name": {
    "type": "string",
    "description": "Accused name or ID",
    "required": true
  }
}
```
* **Representative Officer Queries (Semantic Match Triggers):**
  * "Get full criminal profile of accused Suresh Gowda"
  * "Show suspect history for Ramesh"
  * "ಆರೋಪಿಯ ವಿವರವಾದ ಪ್ರೊಫೈಲ್ ತೋರಿಸಿ"

---


### Tool 21: `find_similar_cases` — Cosine Semantic Modus Operandi Narrative Matching (1.6M+ Scale)
* **Exact Tool Name for GLM:** `find_similar_cases`
* **Operational Purpose & Mission:** Scan statewide CCTNS records using TF-IDF n-grams and Cosine Semantic Similarity to discover past cases with matching Modus Operandi (MO), getaway techniques, weapon signatures, and timing windows.
* **When to Select this Tool (Disambiguation Rules for GLM):** Use whenever the query asks to 'find similar cases', 'match MO', 'similar chain snatching', 'serial burglaries with gas cutter', or 'identify pattern across stations'. Do NOT use for exact case number lookups.
* **Target Personas:** Investigating Officer, Anti-Robbery Squad, SCRB Pattern Analyst
* **Backend Data Sources & ZCQL Schemas:** CaseMaster (TF-IDF & Cosine Semantic Index over BriefFacts)
* **Visual Response Type & UI Card:** `mo_match`
* **Statutory Legal Grounding:** Modus Operandi Criminology & Routine Activity Theory
* **Parameters Specification:**
```json
{
  "query": {
    "type": "string",
    "description": "Crime pattern or MO description",
    "required": true
  }
}
```
* **Representative Officer Queries (Semantic Match Triggers):**
  * "Find similar chain snatching cases in Bengaluru"
  * "Show cases with same MO: gas cutter commercial burglary"
  * "ಇದೇ ತರಹದ ಸರಗಳ್ಳತನ ಪ್ರಕರಣಗಳನ್ನು ಹುಡುಕಿ"
  * "find similar crimes across Karnataka"

---


### Tool 22: `predict_future_crimes` — Spatiotemporal Predictive Crime Forecasting
* **Exact Tool Name for GLM:** `predict_future_crimes`
* **Operational Purpose & Mission:** Forecast high-probability future crime windows, days of the week, and vulnerable precinct zones using kernel density estimation and spatiotemporal ARIMA models.
* **When to Select this Tool (Disambiguation Rules for GLM):** Use when planning preventive policing, night nakabandi, or anticipating crime spikes.
* **Target Personas:** Superintendent of Police, Patrol Commander
* **Backend Data Sources & ZCQL Schemas:** spatiotemporal_forecast.py, CaseMaster
* **Visual Response Type & UI Card:** `forecast`
* **Statutory Legal Grounding:** Predictive Policing & Environmental Criminology
* **Parameters Specification:**
```json
{
  "district": {
    "type": "string",
    "description": "District or zone",
    "required": true
  },
  "crime_type": {
    "type": "string",
    "description": "Crime category",
    "required": false
  }
}
```
* **Representative Officer Queries (Semantic Match Triggers):**
  * "Predict future crime hotspots in Mysuru"
  * "Forecast burglary risk for next month in Belagavi"
  * "ಮುಂದಿನ ಅಪರಾಧ ಸಾಧ್ಯತೆಗಳನ್ನು ಊಹಿಸಿ"

---


### Tool 23: `search_accused_by_name` — Phonetic Soundex & Fuzzy Suspect Name Search
* **Exact Tool Name for GLM:** `search_accused_by_name`
* **Operational Purpose & Mission:** Search for suspects across CCTNS records using phonetic Soundex, Metaphone, and fuzzy string distance to catch offenders using misspelled names or regional dialect aliases.
* **When to Select this Tool (Disambiguation Rules for GLM):** Use when searching for a suspect whose exact spelling is uncertain or varied.
* **Target Personas:** Investigating Officer, Special Squad
* **Backend Data Sources & ZCQL Schemas:** AccusedMaster WHERE Soundex(AccusedName) = ...
* **Visual Response Type & UI Card:** `accused_list`
* **Statutory Legal Grounding:** Criminal Identification Standard
* **Parameters Specification:**
```json
{
  "name": {
    "type": "string",
    "description": "Name or phonetic alias",
    "required": true
  }
}
```
* **Representative Officer Queries (Semantic Match Triggers):**
  * "Search accused named 'Manja' or 'Mahesh'"
  * "Find suspect sounding like 'Sikandar'"
  * "ಹೆಸರಿನ ಮೂಲಕ ಆರೋಪಿಯನ್ನು ಹುಡುಕಿ"

---


### Tool 24: `get_repeat_offenders` — Habitual Offender & Recidivist Roster
* **Exact Tool Name for GLM:** `get_repeat_offenders`
* **Operational Purpose & Mission:** Extract habitual offenders with 3+ historical FIR registrations within a district or crime category, identifying currently active repeat criminals.
* **When to Select this Tool (Disambiguation Rules for GLM):** Use when an officer asks for 'repeat offenders', 'habitual criminals', 'history-sheeters', or 'active rowdies'.
* **Target Personas:** Law & Order Inspector, CCB Rowdy Control Wing
* **Backend Data Sources & ZCQL Schemas:** AccusedMaster JOIN AccusedCaseDetails GROUP BY AccusedID HAVING COUNT(*) >= 3
* **Visual Response Type & UI Card:** `repeat_offenders`
* **Statutory Legal Grounding:** Karnataka Police Act §31 (Habitual Offenders Control)
* **Parameters Specification:**
```json
{
  "district": {
    "type": "string",
    "description": "District name",
    "required": false
  },
  "crime_group": {
    "type": "string",
    "description": "Crime head filter",
    "required": false
  }
}
```
* **Representative Officer Queries (Semantic Match Triggers):**
  * "Show repeat offenders in Bengaluru Urban"
  * "List habitual robbers in Belagavi"
  * "ಪುನರಾವರ್ತಿತ ಅಪರಾಧಿಗಳ ಪಟ್ಟಿ ತೋರಿಸಿ"

---


### Tool 25: `get_bail_history` — Judicial Bail Grants, Breaches & Surety Tracking
* **Exact Tool Name for GLM:** `get_bail_history`
* **Operational Purpose & Mission:** Retrieve complete bail history for an accused: courts applied to, interim vs regular bail, surety names and addresses, bail conditions imposed, and breach history.
* **When to Select this Tool (Disambiguation Rules for GLM):** Use when opposing bail or checking if an accused is on bail for other crimes.
* **Target Personas:** Investigating Officer, Public Prosecutor
* **Backend Data Sources & ZCQL Schemas:** AccusedBailDetails, CaseMaster
* **Visual Response Type & UI Card:** `bail_history_card`
* **Statutory Legal Grounding:** Section 480 / 482 BNSS (Bail Opposition & Cancellation)
* **Parameters Specification:**
```json
{
  "accused_name": {
    "type": "string",
    "description": "Accused name or ID",
    "required": true
  }
}
```
* **Representative Officer Queries (Semantic Match Triggers):**
  * "Check bail history for accused Suresh"
  * "Is the suspect in CR-104 currently on bail?"
  * "ಆರೋಪಿಯ ಜಾಮೀನು ಇತಿಹಾಸವನ್ನು ಪರಿಶೀಲಿಸಿ"

---


### Tool 26: `get_warrants_for_accused` — Active Non-Bailable Warrants (NBW) Ledger
* **Exact Tool Name for GLM:** `get_warrants_for_accused`
* **Operational Purpose & Mission:** Query all unexecuted Non-Bailable Warrants (NBW), proclamation orders under Section 84 BNSS, and property attachment warrants issued against an accused person.
* **When to Select this Tool (Disambiguation Rules for GLM):** Use when checking if a detained suspect is wanted in other courts or jurisdictions.
* **Target Personas:** Court Liaison Constable, Warrant Squad
* **Backend Data Sources & ZCQL Schemas:** WarrantMaster WHERE AccusedID = ...
* **Visual Response Type & UI Card:** `warrants_card`
* **Statutory Legal Grounding:** Sections 72, 84, 85 BNSS
* **Parameters Specification:**
```json
{
  "accused_name": {
    "type": "string",
    "description": "Accused name",
    "required": true
  }
}
```
* **Representative Officer Queries (Semantic Match Triggers):**
  * "Check active warrants for accused Manjunath"
  * "Are there any pending NBWs against Ramesh?"
  * "ಆರೋಪಿಯ ವಿರುದ್ಧದ ವಾರಂಟ್‌ಗಳನ್ನು ಪರಿಶೀಲಿಸಿ"

---


### Tool 27: `get_accused_associates` — Direct Co-Accused & Accomplice Network Ledger
* **Exact Tool Name for GLM:** `get_accused_associates`
* **Operational Purpose & Mission:** Extract all direct accomplices and co-accused named alongside a suspect across multiple FIR registrations, mapping their shared offences.
* **When to Select this Tool (Disambiguation Rules for GLM):** Use when identifying gang members or accomplices who operate together.
* **Target Personas:** Organized Crime Wing, Detective PSI
* **Backend Data Sources & ZCQL Schemas:** AccusedCaseDetails (Self-Join on CaseMasterID)
* **Visual Response Type & UI Card:** `associates_card`
* **Statutory Legal Grounding:** Section 111 BNS (Organized Crime Gang Liability)
* **Parameters Specification:**
```json
{
  "accused_name": {
    "type": "string",
    "description": "Accused name",
    "required": true
  }
}
```
* **Representative Officer Queries (Semantic Match Triggers):**
  * "Who are the criminal associates of accused Ravi?"
  * "Find co-accused linked to suspect in case 104"
  * "ಆರೋಪಿಯ ಸಹಚರರನ್ನು ಹುಡುಕಿ"

---


### Tool 28: `get_accused_property_seizures` — Confiscated Proceeds of Crime & Asset Attachment
* **Exact Tool Name for GLM:** `get_accused_property_seizures`
* **Operational Purpose & Mission:** Retrieve confiscated cash, bullion, vehicles, and attached bank accounts seized from an accused person during arrests and property recoveries.
* **When to Select this Tool (Disambiguation Rules for GLM):** Use when verifying recovery panchanamas or preparing property forfeiture dockets.
* **Target Personas:** Malkhana Officer, Investigating Officer
* **Backend Data Sources & ZCQL Schemas:** MalkhanaProperty WHERE AccusedID = ...
* **Visual Response Type & UI Card:** `property_seizures_card`
* **Statutory Legal Grounding:** Section 106 BNSS (Attachment of Proceeds of Crime)
* **Parameters Specification:**
```json
{
  "accused_name": {
    "type": "string",
    "description": "Accused name",
    "required": true
  }
}
```
* **Representative Officer Queries (Semantic Match Triggers):**
  * "Show property seized from accused Ramesh"
  * "What vehicles or gold were recovered from suspect?"
  * "ಆರೋಪಿಯಿಂದ ವಶಪಡಿಸಿಕೊಂಡ ಆಸ್ತಿ ವಿವರ"

---


### Tool 29: `get_case_intelligence_dossier` — Evidence Synthesis & Lead Correlation Dossier
* **Exact Tool Name for GLM:** `get_case_intelligence_dossier`
* **Operational Purpose & Mission:** Synthesize multi-source intelligence on an ongoing case: cross-checks witness statements against CDR cell towers and alibi consistency.
* **When to Select this Tool (Disambiguation Rules for GLM):** Use during advanced investigation stages to spot contradictions or unpursued leads.
* **Target Personas:** Crime Branch Detective, Supervisory DySP
* **Backend Data Sources & ZCQL Schemas:** CaseMaster, CaseDiary, CDR, WitnessStatements
* **Visual Response Type & UI Card:** `intelligence_dossier`
* **Statutory Legal Grounding:** Advanced Criminalistics & Evidence Correlation
* **Parameters Specification:**
```json
{
  "case_no": {
    "type": "string",
    "description": "Case number",
    "required": true
  }
}
```
* **Representative Officer Queries (Semantic Match Triggers):**
  * "Compile intelligence dossier for CR-2026-46092"
  * "Give me investigative correlation for case 104"
  * "ಪ್ರಕರಣದ ಗುಪ್ತಚರ ಕಡತವನ್ನು ಸಂಕಲಿಸಿ"

---


### Tool 30: `suggest_sections` — AI-Powered Penal Code Section Recommendations for FIR Facts
* **Exact Tool Name for GLM:** `suggest_sections`
* **Operational Purpose & Mission:** Analyze raw incident facts and recommend legally accurate BNS/BNSS/special act penal sections, identifying aggravating factors (gang, weapon, night-time, minor).
* **When to Select this Tool (Disambiguation Rules for GLM):** Use when drafting an FIR or adding supplementary sections during investigation.
* **Target Personas:** Duty PSI, Station House Officer, FIR Reader
* **Backend Data Sources & ZCQL Schemas:** BNS 2023 Statutory Concordance Engine
* **Visual Response Type & UI Card:** `suggested_sections_card`
* **Statutory Legal Grounding:** Bharatiya Nyaya Sanhita (BNS 2023)
* **Parameters Specification:**
```json
{
  "facts": {
    "type": "string",
    "description": "Incident narrative or brief facts",
    "required": true
  }
}
```
* **Representative Officer Queries (Semantic Match Triggers):**
  * "Suggest sections for: two men snatched chain at knife point on motorcycle"
  * "What BNS sections apply to armed jewelry store break-in?"
  * "ಈ ಘಟನೆಗೆ ಸೂಕ್ತವಾದ ಬಿಎನ್‌ಎಸ್ ಕಲಂಗಳನ್ನು ಸೂಚಿಸಿ"

---


### Tool 31: `recommend_sections` — Case-Specific Penal Code Concordance Recommendation
* **Exact Tool Name for GLM:** `recommend_sections`
* **Operational Purpose & Mission:** Examine an existing FIR's brief facts and recommend missing or supplementary sections warranted by evidence discovered during investigation.
* **When to Select this Tool (Disambiguation Rules for GLM):** Use when amending chargesheets or reviewing initial FIR charge adequacy.
* **Target Personas:** Investigating Officer, Public Prosecutor
* **Backend Data Sources & ZCQL Schemas:** CaseMaster (BriefFacts), BNS Engine
* **Visual Response Type & UI Card:** `recommended_sections_card`
* **Statutory Legal Grounding:** BNS 2023 & Section 240 BNSS (Framing of Charges)
* **Parameters Specification:**
```json
{
  "case_no": {
    "type": "string",
    "description": "Case number",
    "required": true
  }
}
```
* **Representative Officer Queries (Semantic Match Triggers):**
  * "Recommend missing sections for case CR-2026-46092"
  * "Review charges on case 104 for additional sections"
  * "ಕಲಂಗಳನ್ನು ಶಿಫಾರಸು ಮಾಡಿ"

---


### Tool 32: `query_graph_network` — Force-Directed Syndicate & Association Network Graph
* **Exact Tool Name for GLM:** `query_graph_network`
* **Operational Purpose & Mission:** Render an interactive multi-hop criminal network graph connecting suspects, co-accused, shared mobile phone numbers, getaway vehicles, and money laundering accounts.
* **When to Select this Tool (Disambiguation Rules for GLM):** Use when exploring connections between multiple criminals, syndicates, or organized gangs.
* **Target Personas:** Organized Crime Wing, State Intelligence Wing, SP / Commissioner
* **Backend Data Sources & ZCQL Schemas:** VajraGraphRAG (NetworkX / D3.js Force Simulation)
* **Visual Response Type & UI Card:** `network`
* **Statutory Legal Grounding:** Social Network Analysis in Criminology (SNA)
* **Parameters Specification:**
```json
{
  "suspect_name": {
    "type": "string",
    "description": "Target suspect name or case number",
    "required": true
  }
}
```
* **Representative Officer Queries (Semantic Match Triggers):**
  * "Show syndicate graph network for Ramesh"
  * "Map gang connections for suspect in CR-104"
  * "ಅಪರಾಧ ಜಾಲದ ಗ್ರಾಫ್ ತೋರಿಸಿ"
  * "trace network ties for Belagavi gang"

---


### Tool 33: `trace_connection_path` — Shortest Path Link Discovery Between Two Entities
* **Exact Tool Name for GLM:** `trace_connection_path`
* **Operational Purpose & Mission:** Find the exact shortest connection chain between any two disparate suspects, phone numbers, or cases through shared intermediaries, co-accused, or vehicles.
* **When to Select this Tool (Disambiguation Rules for GLM):** Use when establishing conspiracy links between a ground operative and an interstate handler.
* **Target Personas:** Anti-Terrorist Squad, CCB Organized Crime
* **Backend Data Sources & ZCQL Schemas:** VajraGraphRAG (Dijkstra Shortest Path)
* **Visual Response Type & UI Card:** `network`
* **Statutory Legal Grounding:** Section 61 BNS (Criminal Conspiracy Proof)
* **Parameters Specification:**
```json
{
  "source": {
    "type": "string",
    "description": "First suspect/entity",
    "required": true
  },
  "target": {
    "type": "string",
    "description": "Second suspect/entity",
    "required": true
  }
}
```
* **Representative Officer Queries (Semantic Match Triggers):**
  * "Trace connection path between Ramesh and Mohan"
  * "How is suspect A linked to suspect B?"
  * "ಇಬ್ಬರು ಆರೋಪಿಗಳ ನಡುವಿನ ಸಂಪರ್ಕ ಮಾರ್ಗವನ್ನು ಪತ್ತೆಹಚ್ಚಿ"

---


### Tool 34: `find_common_connections` — Shared Intermediary Discovery Across Disparate Gangs
* **Exact Tool Name for GLM:** `find_common_connections`
* **Operational Purpose & Mission:** Identify common brokers, lawyers, bail sureties, pawnbrokers, or safe-houses shared across two seemingly unrelated crime groups.
* **When to Select this Tool (Disambiguation Rules for GLM):** Use when investigating whether two separate sprees share a common fence or financier.
* **Target Personas:** Detective Inspector, Intelligence Analyst
* **Backend Data Sources & ZCQL Schemas:** VajraGraphRAG (Common Neighbor Intersection)
* **Visual Response Type & UI Card:** `network`
* **Statutory Legal Grounding:** Syndicate Infrastructure Analysis
* **Parameters Specification:**
```json
{
  "entity1": {
    "type": "string",
    "description": "First suspect/case",
    "required": true
  },
  "entity2": {
    "type": "string",
    "description": "Second suspect/case",
    "required": true
  }
}
```
* **Representative Officer Queries (Semantic Match Triggers):**
  * "Find common connections between Hebbal snatchers and Jayanagar gang"
  * "Do suspect X and suspect Y share common contacts?"
  * "ಸಾಮಾನ್ಯ ಸಂಪರ್ಕಗಳನ್ನು ಹುಡುಕಿ"

---


### Tool 35: `query_financial_links` — UPI, Bank & Hawala Transaction Money Flow Graph
* **Exact Tool Name for GLM:** `query_financial_links`
* **Operational Purpose & Mission:** Map the financial paper trail of crime proceeds: tracing bank account transfers, UPI transaction handles, and Hawala disbursement nodes.
* **When to Select this Tool (Disambiguation Rules for GLM):** Use when tracking ransom payments, bribe money, cyber mule accounts, or gold fencing proceeds.
* **Target Personas:** Cyber Crime Investigator, Financial Forensics Unit
* **Backend Data Sources & ZCQL Schemas:** BankTransactions, MuleLedger
* **Visual Response Type & UI Card:** `financial_flow_card`
* **Statutory Legal Grounding:** Section 106 BNSS (Attachment of Proceeds of Crime)
* **Parameters Specification:**
```json
{
  "account_or_name": {
    "type": "string",
    "description": "Account number, UPI ID, or suspect name",
    "required": true
  }
}
```
* **Representative Officer Queries (Semantic Match Triggers):**
  * "Trace financial transactions for UPI handle fraud@upi"
  * "Show money flow for accused Ramesh's bank account"
  * "ಹಣಕಾಸು ವಹಿವಾಟುಗಳನ್ನು ಪತ್ತೆಹಚ್ಚಿ"

---


### Tool 36: `detect_financial_ring` — Circular Laundering & Mule Account Ring Detection
* **Exact Tool Name for GLM:** `detect_financial_ring`
* **Operational Purpose & Mission:** Detect circular money laundering cycles, layered shell accounts, and rapid fund dissipation patterns used by cyber fraud and dacoity syndicates.
* **When to Select this Tool (Disambiguation Rules for GLM):** Use when unmasking mule networks operating across bank branches in multiple states.
* **Target Personas:** State Cyber Crime Police (CEN), Economic Offences Wing
* **Backend Data Sources & ZCQL Schemas:** MuleLedger, BankTransactions (Cycle Detection Algorithm)
* **Visual Response Type & UI Card:** `financial_flow_card`
* **Statutory Legal Grounding:** Section 111 BNS (Organized Crime Economic Operations)
* **Parameters Specification:**
```json
{
  "district": {
    "type": "string",
    "description": "District or zone",
    "required": false
  }
}
```
* **Representative Officer Queries (Semantic Match Triggers):**
  * "Detect cyber fraud mule account rings in Bengaluru"
  * "Identify circular money laundering loops"
  * "ಮ್ಯೂಲ್ ಖಾತೆಗಳ ಜಾಲವನ್ನು ಪತ್ತೆಹಚ್ಚಿ"

---


### Tool 37: `get_cdr_analysis` — Call Detail Record (CDR) & Cell Tower Forensics
* **Exact Tool Name for GLM:** `get_cdr_analysis`
* **Operational Purpose & Mission:** Analyze telecommunications records: calling frequency matrices, common interlocutors between co-accused, IMEI hopping across SIM cards, and tower triangulation during crime hours.
* **When to Select this Tool (Disambiguation Rules for GLM):** Use when technical mobile data is available and suspect presence needs verification.
* **Target Personas:** Technical Cell Analyst, Investigating Officer
* **Backend Data Sources & ZCQL Schemas:** CDRData, CellTowerMaster
* **Visual Response Type & UI Card:** `cdr_analysis_panel`
* **Statutory Legal Grounding:** Section 63 BSA (Telecommunications Evidence Admissibility)
* **Parameters Specification:**
```json
{
  "phone_number": {
    "type": "string",
    "description": "Mobile number or IMEI",
    "required": true
  }
}
```
* **Representative Officer Queries (Semantic Match Triggers):**
  * "Analyze CDR for mobile 9845012345 during incident hours"
  * "Check common contacts between suspect 1 and suspect 2"
  * "ಸಿಡಿಆರ್ ವಿಶ್ಲೇಷಣೆ ನಡೆಸಿ"

---


### Tool 38: `get_syndicate_hierarchy` — Organized Crime Gang Command Structure Reconstruction
* **Exact Tool Name for GLM:** `get_syndicate_hierarchy`
* **Operational Purpose & Mission:** Deconstruct an organized crime syndicate into hierarchical command tiers: Kingpin/Financier, Lieutenants, Field Operatives/Snatchers, and Receivers of Stolen Property.
* **When to Select this Tool (Disambiguation Rules for GLM):** Use when preparing dossiers under Section 111 BNS (Organized Crime Syndicate Prosecution).
* **Target Personas:** Anti-Dacoity Squad, Superintendent of Police
* **Backend Data Sources & ZCQL Schemas:** VajraGraphRAG (Hierarchical Centrality Tree)
* **Visual Response Type & UI Card:** `syndicate_hierarchy_card`
* **Statutory Legal Grounding:** Section 111 BNS (Continuing Unlawful Activity)
* **Parameters Specification:**
```json
{
  "syndicate_name": {
    "type": "string",
    "description": "Syndicate name or kingpin name",
    "required": true
  }
}
```
* **Representative Officer Queries (Semantic Match Triggers):**
  * "Reconstruct syndicate hierarchy for Kalappa Gang"
  * "Show command structure for interstate bullion fencing network"
  * "ಅಪರಾಧ ಸಿಂಡಿಕೇಟ್ ಶ್ರೇಣಿ ವ್ಯವಸ್ಥೆ"

---


### Tool 39: `query_hotspots` — DBSCAN Geospatial Crime Density Clustering & Mapping
* **Exact Tool Name for GLM:** `query_hotspots`
* **Operational Purpose & Mission:** Compute geospatial crime density hotspots using machine-learned DBSCAN clustering over latitude/longitude incident coordinates, identifying persistent high-risk corridors.
* **When to Select this Tool (Disambiguation Rules for GLM):** Use whenever the query asks for 'hotspots', 'crime clusters', 'dangerous areas', 'where are crimes happening', or 'spatial map of incidents'.
* **Target Personas:** Patrol Commander, Traffic & Law-Order In-Charge, SP
* **Backend Data Sources & ZCQL Schemas:** CaseMaster, dbscan_hotspots.joblib, Coordinates
* **Visual Response Type & UI Card:** `map`
* **Statutory Legal Grounding:** Spatial Point Pattern Analysis & Environmental Criminology
* **Parameters Specification:**
```json
{
  "district": {
    "type": "string",
    "description": "District or commissionerate",
    "required": true
  },
  "crime_type": {
    "type": "string",
    "description": "Crime category",
    "required": false
  }
}
```
* **Representative Officer Queries (Semantic Match Triggers):**
  * "Show crime hotspots in Bengaluru Urban"
  * "Map theft clusters in Belagavi"
  * "ಅಪರಾಧ ಹಾಟ್‌ಸ್ಪಾಟ್‌ಗಳನ್ನು ತೋರಿಸಿ"
  * "where are robbery hotspots in Mysuru?"

---


### Tool 40: `dynamic_beat_route_optimizer` — TSP Optimal Police Patrol Beat Route Optimizer
* **Exact Tool Name for GLM:** `dynamic_beat_route_optimizer`
* **Operational Purpose & Mission:** Calculate optimal police patrol routes using Traveling Salesperson Problem (TSP) algorithms, maximizing patrol coverage across active DBSCAN hotspot centroids within vehicle shift fuel limits.
* **When to Select this Tool (Disambiguation Rules for GLM):** Use when planning patrol routes for Cheetah motorbikes, Hoysala PCR vans, or foot beats.
* **Target Personas:** Station House Officer, Beat Patrol In-Charge
* **Backend Data Sources & ZCQL Schemas:** Coordinates, DBSCAN Centroids (TSP Optimizer)
* **Visual Response Type & UI Card:** `map`
* **Statutory Legal Grounding:** Preventive Police Deployment & Deterrence Theory
* **Parameters Specification:**
```json
{
  "station_id": {
    "type": "string",
    "description": "Police Station ID",
    "required": true
  }
}
```
* **Representative Officer Queries (Semantic Match Triggers):**
  * "Optimize patrol beat route for Jayanagar Police Station"
  * "Generate dynamic patrol route for Hoysala-12"
  * "ಬೀಟ್ ಗಸ್ತು ಮಾರ್ಗವನ್ನು ಅತ್ಯುತ್ತಮಗೊಳಿಸಿ"

---


### Tool 41: `temporal_spatial_hotspot_matrix` — Day-vs-Hour Incident Probability Heatmap
* **Exact Tool Name for GLM:** `temporal_spatial_hotspot_matrix`
* **Operational Purpose & Mission:** Generate a 7x24 spatiotemporal heat-grid cross-referencing day of the week against hour of the day (00:00–23:00) to identify peak vulnerability strike windows.
* **When to Select this Tool (Disambiguation Rules for GLM):** Use when deciding exact deployment timing and shift rosters.
* **Target Personas:** Superintendent of Police, Law & Order ACP
* **Backend Data Sources & ZCQL Schemas:** CaseMaster (OccurredDate, OccurredTime)
* **Visual Response Type & UI Card:** `temporal_matrix_heatmap`
* **Statutory Legal Grounding:** Temporal Criminology & Shift Planning
* **Parameters Specification:**
```json
{
  "district": {
    "type": "string",
    "description": "District name",
    "required": true
  }
}
```
* **Representative Officer Queries (Semantic Match Triggers):**
  * "Show temporal spatial hotspot matrix for Bengaluru Urban"
  * "What days and hours have highest crime in Mysuru?"
  * "ದಿನ ಮತ್ತು ಸಮಯವಾರು ಅಪರಾಧ ಮ್ಯಾಟ್ರಿಕ್ಸ್"

---


### Tool 42: `generate_jurisdiction_choropleth` — Station-Level Thematic Cartography & Choropleth Maps
* **Exact Tool Name for GLM:** `generate_jurisdiction_choropleth`
* **Operational Purpose & Mission:** Render high-resolution SVG/GeoJSON choropleth maps shading police station jurisdictions by crime volume, violent crime per capita, or disposal efficiency.
* **When to Select this Tool (Disambiguation Rules for GLM):** Use when presenting district-wide spatial comparisons for executive command conferences.
* **Target Personas:** State Crime Records Bureau (SCRB), DGP Headquarters
* **Backend Data Sources & ZCQL Schemas:** UnitPolygons, CaseMaster (ZCQL Spatial Grouping)
* **Visual Response Type & UI Card:** `map`
* **Statutory Legal Grounding:** Cartographic Criminology & Spatial Crime Mapping
* **Parameters Specification:**
```json
{
  "metric": {
    "type": "string",
    "description": "Metric to shade by (e.g. 'crime_density', 'disposal_rate')",
    "required": false,
    "default": "crime_density"
  }
}
```
* **Representative Officer Queries (Semantic Match Triggers):**
  * "Generate jurisdiction choropleth for Karnataka districts"
  * "Show station crime density map"
  * "ಕ್ಷೇತ್ರವಾರು ನಕ್ಷೆ ತೋರಿಸಿ"

---


### Tool 43: `get_live_patrol_gps_tracking` — Real-Time Emergency Response Patrol Telemetry
* **Exact Tool Name for GLM:** `get_live_patrol_gps_tracking`
* **Operational Purpose & Mission:** Stream live GPS coordinates, vehicle speed, crew on duty, and wireless call-sign status for all active Emergency Response Vehicles (ERV) and patrol units.
* **When to Select this Tool (Disambiguation Rules for GLM):** Use during active emergency response or when dispatching the closest unit to a crime scene.
* **Target Personas:** 112 Command Center Dispatcher, PCR Van Commander
* **Backend Data Sources & ZCQL Schemas:** PatrolFleetGPS, UnitMaster
* **Visual Response Type & UI Card:** `patrol_live_map`
* **Statutory Legal Grounding:** Immediate First-Response SLA Protocol
* **Parameters Specification:**
```json
{
  "district": {
    "type": "string",
    "description": "District or zone",
    "required": false
  }
}
```
* **Representative Officer Queries (Semantic Match Triggers):**
  * "Show live patrol vehicles in Bengaluru Central"
  * "Track active Hoysala units near Majestic"
  * "ಲೈವ್ ಗಸ್ತು ವಾಹನಗಳ ಜಿಪಿಎಸ್ ಟ್ರ್ಯಾಕಿಂಗ್"

---


### Tool 44: `get_station_boundary_polygon` — Police Station Territorial Jurisdiction Boundary Coordinates
* **Exact Tool Name for GLM:** `get_station_boundary_polygon`
* **Operational Purpose & Mission:** Retrieve official GeoJSON territorial boundary polygons for a police station or circle to resolve jurisdictional border disputes and transfer Zero FIRs accurately.
* **When to Select this Tool (Disambiguation Rules for GLM):** Use when verifying whether an incident occurred within station limits.
* **Target Personas:** Station House Officer, Zero FIR Transfer Officer
* **Backend Data Sources & ZCQL Schemas:** UnitBoundaryPolygon, Unit
* **Visual Response Type & UI Card:** `boundary_polygon_card`
* **Statutory Legal Grounding:** Section 173(1) BNSS & Karnataka Police Manual Jurisdiction Mandates
* **Parameters Specification:**
```json
{
  "station_id": {
    "type": "string",
    "description": "Police Station ID or Name",
    "required": true
  }
}
```
* **Representative Officer Queries (Semantic Match Triggers):**
  * "Get jurisdiction boundary polygon for Hebbal PS"
  * "Check territorial limits of Peenya station"
  * "ಠಾಣಾ ವ್ಯಾಪ್ತಿಯ ಗಡಿ ರೇಖೆ ತೋರಿಸಿ"

---


### Tool 45: `get_choke_point_nakabandi_plan` — Tactical Highway Checkpoint & Nakabandi Barrier Map
* **Exact Tool Name for GLM:** `get_choke_point_nakabandi_plan`
* **Operational Purpose & Mission:** Generate tactical highway choke points, toll plaza barricades, and escape-route seal-off plans (Nakabandi) for immediate execution following armed robberies or kidnappings.
* **When to Select this Tool (Disambiguation Rules for GLM):** Use immediately after an emergency incident to intercept fleeing getaway vehicles.
* **Target Personas:** City Police Commissioner, ACP Traffic & Law-Order
* **Backend Data Sources & ZCQL Schemas:** TollPlazaMaster, ChokePoints, RoadNetwork
* **Visual Response Type & UI Card:** `nakabandi_plan_card`
* **Statutory Legal Grounding:** Emergency Crime Containment Standard Operating Procedure
* **Parameters Specification:**
```json
{
  "district": {
    "type": "string",
    "description": "District or city zone",
    "required": true
  }
}
```
* **Representative Officer Queries (Semantic Match Triggers):**
  * "Generate nakabandi plan for Mysuru Road corridor"
  * "Set up highway choke points around Belagavi border"
  * "ನಾಕಾಬಂದಿ ಯೋಜನೆ ರೂಪಿಸಿ"

---


### Tool 46: `evaluate_patrol_coverage_efficiency` — GIS Patrol Audit & Spatial Blind-Spot Detection
* **Exact Tool Name for GLM:** `evaluate_patrol_coverage_efficiency`
* **Operational Purpose & Mission:** Compare historical GPS vehicle patrol breadcrumbs against reported incident coordinates to detect unpatrolled dark zones and coverage gaps.
* **When to Select this Tool (Disambiguation Rules for GLM):** Use during monthly administrative inspections to audit beat constable patrolling performance.
* **Target Personas:** Superintendent of Police, DCP Admin
* **Backend Data Sources & ZCQL Schemas:** PatrolGPSHistory, CaseMaster (Spatial Intersection)
* **Visual Response Type & UI Card:** `coverage_efficiency_card`
* **Statutory Legal Grounding:** KSP Administrative Inspection Manual
* **Parameters Specification:**
```json
{
  "station_id": {
    "type": "string",
    "description": "Police station identifier",
    "required": true
  }
}
```
* **Representative Officer Queries (Semantic Match Triggers):**
  * "Evaluate patrol coverage efficiency for Jayanagar PS"
  * "Check patrol blind spots in Hebbal precinct"
  * "ಗಸ್ತು ಕವರೇಜ್ ದಕ್ಷತೆಯನ್ನು ಮೌಲ್ಯಮಾಪನ ಮಾಡಿ"

---


### Tool 47: `get_forecast` — Seasonal Time-Series Crime Volume Forecast (SARIMAX)
* **Exact Tool Name for GLM:** `get_forecast`
* **Operational Purpose & Mission:** Project upcoming crime incidence totals (30, 60, 90 days ahead) using seasonal autoregressive time-series models (SARIMAX) to anticipate holiday or festival crime surges.
* **When to Select this Tool (Disambiguation Rules for GLM):** Use when preparing quarterly police budget allocations or festival bandobast manpower.
* **Target Personas:** State Crime Records Bureau, District SP
* **Backend Data Sources & ZCQL Schemas:** CaseMaster, spatiotemporal_forecast.py
* **Visual Response Type & UI Card:** `forecast`
* **Statutory Legal Grounding:** Predictive Time-Series Criminology
* **Parameters Specification:**
```json
{
  "district": {
    "type": "string",
    "description": "District name",
    "required": true
  },
  "crime_type": {
    "type": "string",
    "description": "Crime category",
    "required": false
  }
}
```
* **Representative Officer Queries (Semantic Match Triggers):**
  * "Forecast property crimes in Mysuru for next quarter"
  * "What is projected crime trend for festive season?"
  * "ಅಪರಾಧ ಮುನ್ಸೂಚನೆ ನೀಡಿ"

---


### Tool 48: `get_crime_trends` — Longitudinal Multi-Year Crime Trend Trajectory
* **Exact Tool Name for GLM:** `get_crime_trends`
* **Operational Purpose & Mission:** Analyze historical crime volume trajectories over multi-year periods: computes year-over-year percentage growth, seasonal peaks, and rising vs. declining crime heads.
* **When to Select this Tool (Disambiguation Rules for GLM):** Use when an officer asks 'are crimes rising or falling', 'show crime trends', or 'compare this year vs last year'.
* **Target Personas:** Superintendent of Police, Home Department Analyst
* **Backend Data Sources & ZCQL Schemas:** CaseMaster (GROUP BY Year, Month)
* **Visual Response Type & UI Card:** `trend`
* **Statutory Legal Grounding:** CCTNS Statistical Reporting Standard
* **Parameters Specification:**
```json
{
  "district": {
    "type": "string",
    "description": "District name",
    "required": true
  },
  "crime_type": {
    "type": "string",
    "description": "Crime head filter",
    "required": false
  }
}
```
* **Representative Officer Queries (Semantic Match Triggers):**
  * "Show crime trends in Belagavi over last 3 years"
  * "Are burglaries increasing in Bengaluru?"
  * "ಅಪರಾಧ ಪ್ರವೃತ್ತಿಗಳನ್ನು ತೋರಿಸಿ"

---


### Tool 49: `analyze_crime_scene_av` — Multimodal Audio & Video Scene Forensics
* **Exact Tool Name for GLM:** `analyze_crime_scene_av`
* **Operational Purpose & Mission:** Process crime scene CCTV video, mobile witness clips, and 112 audio calls: extracts automatic speech transcription, vehicle number plate OCR, weapon presence, and acoustic alarms.
* **When to Select this Tool (Disambiguation Rules for GLM):** Use when audio/video evidence is uploaded or attached to a case.
* **Target Personas:** Scientific Investigation Officer, Forensic Analyst
* **Backend Data Sources & ZCQL Schemas:** av_analysis.py, Catalyst Stratus, Zia Vision/OCR
* **Visual Response Type & UI Card:** `multimodal_forensic_report`
* **Statutory Legal Grounding:** Section 63 BSA (Admissibility of Electronic Multimedia)
* **Parameters Specification:**
```json
{
  "media_url": {
    "type": "string",
    "description": "URL or Stratus ID of audio/video file",
    "required": true
  }
}
```
* **Representative Officer Queries (Semantic Match Triggers):**
  * "Analyze CCTV video from jewelry heist"
  * "Extract speech and plates from attached footage"
  * "ಅಪರಾಧ ಸ್ಥಳದ ವೀಡಿಯೊ ವಿಶ್ಲೇಷಿಸಿ"

---


### Tool 50: `get_malkhana_property_tracker` — Seized Evidence & Contraband Custody Ledger
* **Exact Tool Name for GLM:** `get_malkhana_property_tracker`
* **Operational Purpose & Mission:** Track all physical evidence deposited in the station Malkhana: gold ornaments, cash, murder weapons, narcotics, and counterfeit currency with shelf/box QR codes.
* **When to Select this Tool (Disambiguation Rules for GLM):** Use during station inspection or before court trial evidence production.
* **Target Personas:** Malkhana Moharrir, Station House Officer
* **Backend Data Sources & ZCQL Schemas:** MalkhanaProperty, CaseMaster
* **Visual Response Type & UI Card:** `malkhana_card`
* **Statutory Legal Grounding:** Section 105 & 503 BNSS (Custody and Disposal of Seized Property)
* **Parameters Specification:**
```json
{
  "station_id": {
    "type": "string",
    "description": "Station ID or Case Number",
    "required": true
  }
}
```
* **Representative Officer Queries (Semantic Match Triggers):**
  * "Show Malkhana property ledger for case CR-2026-46092"
  * "List seized weapons stored in station malkhana"
  * "ಮಾಲ್ಖಾನಾ ಆಸ್ತಿ ವಿವರ"

---


### Tool 51: `get_fsl_tracking_status` — Forensic Science Laboratory Sample Dispatch & Testing Radar
* **Exact Tool Name for GLM:** `get_fsl_tracking_status`
* **Operational Purpose & Mission:** Track the forensic testing lifecycle of biological samples (viscera, blood, DNA), ballistic firearms, and digital hard drives dispatched to State FSL Madiwala or Regional FSLs.
* **When to Select this Tool (Disambiguation Rules for GLM):** Use to verify if forensic reports are ready before filing chargesheet.
* **Target Personas:** Investigating Officer, Circle Inspector
* **Backend Data Sources & ZCQL Schemas:** FSLDispatchMaster, CaseMaster
* **Visual Response Type & UI Card:** `fsl_tracking_card`
* **Statutory Legal Grounding:** Section 180 & 183 BNSS (Forensic Evidence in Investigation)
* **Parameters Specification:**
```json
{
  "case_no": {
    "type": "string",
    "description": "Case number",
    "required": true
  }
}
```
* **Representative Officer Queries (Semantic Match Triggers):**
  * "Check FSL testing status for CR-2026-46092"
  * "Has DNA ballistics report arrived from FSL?"
  * "ಎಫ್‌ಎಸ್‌ಎಲ್ ವರದಿ ಸ್ಥಿತಿ ಪರಿಶೀಲಿಸಿ"

---


### Tool 52: `get_bail_opposition_docket` — Section 480 BNSS Prosecutor Bail Opposition Dossier
* **Exact Tool Name for GLM:** `get_bail_opposition_docket`
* **Operational Purpose & Mission:** Automatically assemble a court-ready bail opposition dossier: past criminal antecedents, risk of witness intimidation (§398 BNSS), gravity of penal punishment, and flight risk.
* **When to Select this Tool (Disambiguation Rules for GLM):** Use when an accused applies for bail and the Public Prosecutor needs to oppose it in court.
* **Target Personas:** Assistant Public Prosecutor (APP), Investigating Officer
* **Backend Data Sources & ZCQL Schemas:** AccusedMaster, CaseMaster, AccusedBailDetails
* **Visual Response Type & UI Card:** `bail_opposition_card`
* **Statutory Legal Grounding:** Section 480 & 482 BNSS (Grounds for Bail Opposition)
* **Parameters Specification:**
```json
{
  "case_no": {
    "type": "string",
    "description": "Case number",
    "required": true
  },
  "accused_name": {
    "type": "string",
    "description": "Accused name",
    "required": false
  }
}
```
* **Representative Officer Queries (Semantic Match Triggers):**
  * "Prepare bail opposition docket for accused in CR-2026-46092"
  * "Generate grounds to oppose bail under §480 BNSS"
  * "ಜಾಮೀನು ವಿರೋಧಿಸುವ ದಾಖಲೆ ಸಿದ್ಧಪಡಿಸಿ"

---


### Tool 53: `get_warrant_execution_tracker` — NBW & Section 84 BNSS Proclamation Pipeline
* **Exact Tool Name for GLM:** `get_warrant_execution_tracker`
* **Operational Purpose & Mission:** Manage court warrant execution lifecycles: Non-Bailable Warrants (NBWs) pending execution, proclamation hearings under §84 BNSS, and attachment orders under §85 BNSS.
* **When to Select this Tool (Disambiguation Rules for GLM):** Use when reviewing unapprehended fugitives across the district.
* **Target Personas:** Court Liaison Officer, Superintendent of Police
* **Backend Data Sources & ZCQL Schemas:** WarrantMaster, CaseMaster
* **Visual Response Type & UI Card:** `warrant_tracker_card`
* **Statutory Legal Grounding:** Sections 72, 84, 85 BNSS
* **Parameters Specification:**
```json
{
  "district": {
    "type": "string",
    "description": "District filter",
    "required": false
  }
}
```
* **Representative Officer Queries (Semantic Match Triggers):**
  * "Track warrant execution pipeline in Bengaluru"
  * "List pending NBWs older than 60 days"
  * "ವಾರಂಟ್ ಜಾರಿ ಸ್ಥಿತಿ ಪರಿಶೀಲಿಸಿ"

---


### Tool 54: `generate_custom_chart` — Server-Side Dynamic Matplotlib Chart Plotting
* **Exact Tool Name for GLM:** `generate_custom_chart`
* **Operational Purpose & Mission:** Plot customized high-resolution charts (bar charts, pie charts, scatter plots, line graphs) summarizing complex CCTNS crime statistics directly as images.
* **When to Select this Tool (Disambiguation Rules for GLM):** Use when an officer requests a specific chart, visual graph, or plotting comparison.
* **Target Personas:** All Officers, SCRB Analyst
* **Backend Data Sources & ZCQL Schemas:** ksp_plot_engine.py, Matplotlib
* **Visual Response Type & UI Card:** `custom_chart`
* **Statutory Legal Grounding:** Data Visualization & Statistical Presentation Standard
* **Parameters Specification:**
```json
{
  "chart_type": {
    "type": "string",
    "description": "bar, line, pie, or scatter",
    "required": true
  },
  "title": {
    "type": "string",
    "description": "Chart title",
    "required": true
  }
}
```
* **Representative Officer Queries (Semantic Match Triggers):**
  * "Generate custom bar chart of crime categories in Mysuru"
  * "Plot monthly theft comparison"
  * "ಕಸ್ಟಮ್ ಚಾರ್ಟ್ ರಚಿಸಿ"

---


### Tool 55: `check_statutory_compliance` — Comprehensive BNSS/BNS Legal Compliance Audit
* **Exact Tool Name for GLM:** `check_statutory_compliance`
* **Operational Purpose & Mission:** Audit an ongoing investigation against all mandatory statutory procedural safeguards: 24-hour arrest production (§58 BNSS), medical examination (§53 BNSS), and search videography (§105 BNSS).
* **When to Select this Tool (Disambiguation Rules for GLM):** Use to ensure the investigation will survive judicial scrutiny without procedural defects.
* **Target Personas:** Supervisory DySP, Public Prosecutor
* **Backend Data Sources & ZCQL Schemas:** CaseMaster, CaseDiary
* **Visual Response Type & UI Card:** `compliance_audit_card`
* **Statutory Legal Grounding:** BNSS 2023 Statutory Procedural Safeguards
* **Parameters Specification:**
```json
{
  "case_no": {
    "type": "string",
    "description": "Case number",
    "required": true
  }
}
```
* **Representative Officer Queries (Semantic Match Triggers):**
  * "Check statutory compliance for CR-2026-46092"
  * "Audit legal defects in case 104"
  * "ಶಾಸನಬದ್ಧ ಅನುಸರಣೆಯನ್ನು ಪರಿಶೀಲಿಸಿ"

---


### Tool 56: `convert_ipc_to_bns` — Bidirectional IPC <-> BNS/BNSS Statutory Concordance Engine
* **Exact Tool Name for GLM:** `convert_ipc_to_bns`
* **Operational Purpose & Mission:** Perform bidirectional translation between Indian Penal Code (IPC 1860) and Bharatiya Nyaya Sanhita (BNS 2023), CrPC to BNSS, and Evidence Act to BSA with penal changes.
* **When to Select this Tool (Disambiguation Rules for GLM):** Use whenever an officer queries an IPC section (e.g. '302 IPC', '420 IPC') or wants the new BNS counterpart.
* **Target Personas:** All Police Officers, Judicial Clerks
* **Backend Data Sources & ZCQL Schemas:** Statutory Concordance Lexicon (BNS / IPC Mapping Table)
* **Visual Response Type & UI Card:** `statutory_conversion_card`
* **Statutory Legal Grounding:** Bharatiya Nyaya Sanhita (Repeal and Savings §358 BNS)
* **Parameters Specification:**
```json
{
  "section": {
    "type": "string",
    "description": "Section string (e.g. '302 IPC' or '103 BNS')",
    "required": true
  },
  "direction": {
    "type": "string",
    "description": "ipc_to_bns or bns_to_ipc",
    "required": false
  }
}
```
* **Representative Officer Queries (Semantic Match Triggers):**
  * "Convert 420 IPC to BNS"
  * "What is Section 302 IPC under new law?"
  * "ಐಪಿಸಿ ಕಲಂ ಅನ್ನು ಬಿಎನ್‌ಎಸ್‌ಗೆ ಪರಿವರ್ತಿಸಿ"
  * "convert 379 IPC to BNS"

---


### Tool 57: `get_default_bail_countdown` — Section 187(2) BNSS Mandatory 60/90-Day Bail Timer
* **Exact Tool Name for GLM:** `get_default_bail_countdown`
* **Operational Purpose & Mission:** Compute the exact days and hours remaining before an arrested accused becomes legally entitled to mandatory default bail due to non-filing of chargesheet under Section 187(2) BNSS.
* **When to Select this Tool (Disambiguation Rules for GLM):** Use whenever an officer tracks remand duration or chargesheet deadline urgency.
* **Target Personas:** Investigating Officer, Circle Inspector
* **Backend Data Sources & ZCQL Schemas:** CaseMaster (CrimeRegisteredDate, ArrestDate)
* **Visual Response Type & UI Card:** `countdown_timer_card`
* **Statutory Legal Grounding:** Section 187(2) BNSS (Default Bail Inviolability)
* **Parameters Specification:**
```json
{
  "case_no": {
    "type": "string",
    "description": "Case number",
    "required": true
  }
}
```
* **Representative Officer Queries (Semantic Match Triggers):**
  * "Check default bail countdown for CR-2026-46092"
  * "How many days left before accused gets default bail?"
  * "ಡೀಫಾಲ್ಟ್ ಜಾಮೀನು ಕೌಂಟ್‌ಡೌನ್ ಪರಿಶೀಲಿಸಿ"

---


### Tool 58: `audit_search_seizure_video` — Section 105 BNSS Mandatory Videography Compliance Audit
* **Exact Tool Name for GLM:** `audit_search_seizure_video`
* **Operational Purpose & Mission:** Audit whether search and seizure operations were continuously recorded on video as mandated by Section 105 BNSS, verifying camera metadata, pancha witnesses present on camera, and hash chain.
* **When to Select this Tool (Disambiguation Rules for GLM):** Use before trial to ensure seized contraband or weapons will not be suppressed in court.
* **Target Personas:** Investigating Officer, Trial Prosecutor
* **Backend Data Sources & ZCQL Schemas:** MalkhanaProperty, SearchSeizureVideoLogs
* **Visual Response Type & UI Card:** `videography_audit_card`
* **Statutory Legal Grounding:** Section 105 BNSS (Mandatory Videography of Search & Seizure)
* **Parameters Specification:**
```json
{
  "case_no": {
    "type": "string",
    "description": "Case number",
    "required": true
  }
}
```
* **Representative Officer Queries (Semantic Match Triggers):**
  * "Audit search seizure video compliance for case CR-46092"
  * "Check if videography mandate under §105 BNSS was fulfilled"
  * "ಶೋಧ ವೀಡಿಯೊ ಪರಿಶೀಲನೆ"

---


### Tool 59: `generate_witness_summons` — Digital Witness Summons Dispatch (§179/180 BNSS)
* **Exact Tool Name for GLM:** `generate_witness_summons`
* **Operational Purpose & Mission:** Draft and electronically dispatch formal statutory summons for witness attendance and statement recording with QR-code cryptographic verification under Sections 179 and 180 BNSS.
* **When to Select this Tool (Disambiguation Rules for GLM):** Use when requiring key witnesses, panchas, or medical officers to attend the police station.
* **Target Personas:** Investigating Officer, Station Writer
* **Backend Data Sources & ZCQL Schemas:** WitnessMaster, CaseMaster
* **Visual Response Type & UI Card:** `summons_dispatch_card`
* **Statutory Legal Grounding:** Section 179 & 180 BNSS (Power to Require Attendance of Witnesses)
* **Parameters Specification:**
```json
{
  "case_no": {
    "type": "string",
    "description": "Case number",
    "required": true
  },
  "witness_name": {
    "type": "string",
    "description": "Witness name",
    "required": true
  },
  "date_time": {
    "type": "string",
    "description": "Attendance date and time",
    "required": true
  }
}
```
* **Representative Officer Queries (Semantic Match Triggers):**
  * "Generate witness summons for witness Ramesh in case CR-46092"
  * "Issue summons under §179 BNSS"
  * "ಸಾಕ್ಷಿ ಸಮನ್ಸ್ ರಚಿಸಿ"

---


### Tool 60: `audit_zero_fir_transfer` — Section 173(1) BNSS Zero FIR Mandatory 24-Hour Transfer
* **Exact Tool Name for GLM:** `audit_zero_fir_transfer`
* **Operational Purpose & Mission:** Track Zero FIRs registered at non-jurisdictional stations and audit strict compliance with the 24-hour physical and electronic transfer mandate to the competent territorial police station.
* **When to Select this Tool (Disambiguation Rules for GLM):** Use to prevent jurisdictional delay reprimands from the High Court.
* **Target Personas:** State Police Control Room, SP Office
* **Backend Data Sources & ZCQL Schemas:** CaseMaster WHERE IsZeroFIR = true
* **Visual Response Type & UI Card:** `zero_fir_card`
* **Statutory Legal Grounding:** Section 173(1) BNSS Proviso (Zero FIR Registration & Immediate Transfer)
* **Parameters Specification:**
```json
{
  "district": {
    "type": "string",
    "description": "District or commissionerate",
    "required": false
  }
}
```
* **Representative Officer Queries (Semantic Match Triggers):**
  * "Audit Zero FIR transfers in Bengaluru"
  * "Check status of transferred Zero FIRs"
  * "ಝೀರೋ ಎಫ್‌ಐಆರ್ ವರ್ಗಾವಣೆ ಸ್ಥಿತಿ"

---


### Tool 61: `generate_preliminary_inquiry_docket` — Section 173(3) BNSS 14-Day Preliminary Inquiry Docket
* **Exact Tool Name for GLM:** `generate_preliminary_inquiry_docket`
* **Operational Purpose & Mission:** Compile mandatory preliminary inquiry findings within the 14-day statutory window for cognizable offences punishable with 3 to 7 years imprisonment, determining prima facie cognizable offence.
* **When to Select this Tool (Disambiguation Rules for GLM):** Use before regular FIR registration in matrimonial, commercial, or medical negligence matters.
* **Target Personas:** Station House Officer (SHO), Circle Inspector
* **Backend Data Sources & ZCQL Schemas:** PreliminaryInquiryTable, ComplaintMaster
* **Visual Response Type & UI Card:** `preliminary_inquiry_card`
* **Statutory Legal Grounding:** Section 173(3) BNSS (Mandatory 14-Day Preliminary Inquiry)
* **Parameters Specification:**
```json
{
  "complaint_no": {
    "type": "string",
    "description": "Preliminary complaint identifier",
    "required": true
  }
}
```
* **Representative Officer Queries (Semantic Match Triggers):**
  * "Generate preliminary inquiry docket for complaint 89/2026"
  * "Compile §173(3) BNSS inquiry report"
  * "ಪ್ರಾಥಮಿಕ ತನಿಖಾ ಡಾಕೆಟ್ ರಚಿಸಿ"

---


### Tool 62: `get_electronic_evidence_cert` — Bharatiya Sakshya Adhiniyam Section 63 Certificate Generator
* **Exact Tool Name for GLM:** `get_electronic_evidence_cert`
* **Operational Purpose & Mission:** Generate the statutory Certificate for Admissibility of Electronic Records under Section 63 BSA, complete with SHA-256 digital cryptographic hash, device serial number, operating custodian, and unedited verification.
* **When to Select this Tool (Disambiguation Rules for GLM):** Use whenever CCTV footage, WhatsApp screenshots, call recordings, or mobile dumps are filed in court.
* **Target Personas:** Investigating Officer, Cyber Forensics Examiner
* **Backend Data Sources & ZCQL Schemas:** EvidenceHashLog, CaseMaster
* **Visual Response Type & UI Card:** `sec63_cert_card`
* **Statutory Legal Grounding:** Section 63 Bharatiya Sakshya Adhiniyam (BSA 2023)
* **Parameters Specification:**
```json
{
  "case_no": {
    "type": "string",
    "description": "Case number",
    "required": true
  },
  "media_type": {
    "type": "string",
    "description": "CCTV, mobile dump, CDR, or audio",
    "required": false
  }
}
```
* **Representative Officer Queries (Semantic Match Triggers):**
  * "Generate Section 63 BSA certificate for CCTV in CR-2026-46092"
  * "Export electronic evidence certificate for trial"
  * "ಸೆಕ್ಷನ್ ೬೩ ಬಿಎಸ್‌ಎ ಪ್ರಮಾಣಪತ್ರ ರಚಿಸಿ"

---


### Tool 63: `get_officer_caseload` — Supervisory Caseload & Investigation Allocation Monitor
* **Exact Tool Name for GLM:** `get_officer_caseload`
* **Operational Purpose & Mission:** Audit active pending FIR caseload per Investigating Officer across a station or subdivision, identifying workload imbalances and burnout risks.
* **When to Select this Tool (Disambiguation Rules for GLM):** Use during weekly station reviews to reassign pending investigations fairly.
* **Target Personas:** Sub-Divisional Officer (DySP / ACP), Superintendent of Police
* **Backend Data Sources & ZCQL Schemas:** CaseMaster JOIN OfficerMaster GROUP BY OfficerID
* **Visual Response Type & UI Card:** `caseload_card`
* **Statutory Legal Grounding:** KSP Personnel Governance & Investigation Distribution Policy
* **Parameters Specification:**
```json
{
  "station_id": {
    "type": "string",
    "description": "Police Station ID or Name",
    "required": true
  }
}
```
* **Representative Officer Queries (Semantic Match Triggers):**
  * "Check officer caseload for Hebbal Police Station"
  * "How many cases are assigned to PSI Suresh?"
  * "ಅಧಿಕಾರಿಗಳ ಕೆಲಸದ ಹೊರೆ ಪರಿಶೀಲಿಸಿ"

---


### Tool 64: `get_unresolved_case_leads` — Cold Case & Unresolved Lead Miner
* **Exact Tool Name for GLM:** `get_unresolved_case_leads`
* **Operational Purpose & Mission:** Scan dormant and unsolved cases for fresh investigative leads: unexamined CDR tower hops, unidentified latent fingerprints, or recently arrested suspects with identical modus operandi.
* **When to Select this Tool (Disambiguation Rules for GLM):** Use to revive cold investigations and solve long-pending offences.
* **Target Personas:** Crime Branch Detective Squad, Supervisory SP
* **Backend Data Sources & ZCQL Schemas:** CaseMaster WHERE CrimeStage = 'Unresolved' OR CrimeStage = 'Pending Leads'
* **Visual Response Type & UI Card:** `unresolved_leads_card`
* **Statutory Legal Grounding:** CCTNS Cold Case Review Standard
* **Parameters Specification:**
```json
{
  "district": {
    "type": "string",
    "description": "District name",
    "required": true
  }
}
```
* **Representative Officer Queries (Semantic Match Triggers):**
  * "Find unresolved case leads in Belagavi"
  * "Revive cold theft cases with matching MO"
  * "ಪರಿಹರಿಸಲಾಗದ ಪ್ರಕರಣಗಳ ಸುಳಿವುಗಳನ್ನು ಹುಡುಕಿ"

---


### Tool 65: `flag_stalled_investigations` — Stalled Case Radar (No Diary Entries in 30+ Days)
* **Exact Tool Name for GLM:** `flag_stalled_investigations`
* **Operational Purpose & Mission:** Flag cases where investigation has stalled with zero case diary entries or procedural action recorded in the last 30 to 60 days.
* **When to Select this Tool (Disambiguation Rules for GLM):** Use for supervisory vigilance inspections to identify neglected files.
* **Target Personas:** Superintendent of Police, Range IGP
* **Backend Data Sources & ZCQL Schemas:** CaseMaster LEFT JOIN CaseDiary (Days Since Last Entry > 30)
* **Visual Response Type & UI Card:** `stalled_cases_card`
* **Statutory Legal Grounding:** Karnataka Police Manual Supervisory Inspection Norms
* **Parameters Specification:**
```json
{
  "station_id": {
    "type": "string",
    "description": "Station ID or District",
    "required": false
  }
}
```
* **Representative Officer Queries (Semantic Match Triggers):**
  * "Flag stalled investigations in Jayanagar PS"
  * "Show cases with no progress in last 30 days"
  * "ಸ್ಥಗಿತಗೊಂಡ ತನಿಖೆಗಳನ್ನು ಗುರುತಿಸಿ"

---


### Tool 66: `get_station_summary` — Police Station Executive Health & Disposal Overview
* **Exact Tool Name for GLM:** `get_station_summary`
* **Operational Purpose & Mission:** Generate a comprehensive monthly performance scorecard for a police station: total reported crimes, disposal rate, pending inquests, warrant execution percentage, and malkhana volume.
* **When to Select this Tool (Disambiguation Rules for GLM):** Use when an SP or DySP conducts an official inspection of a police station.
* **Target Personas:** Superintendent of Police, Station House Officer
* **Backend Data Sources & ZCQL Schemas:** CaseMaster, Unit, MalkhanaProperty
* **Visual Response Type & UI Card:** `station_summary_card`
* **Statutory Legal Grounding:** Police Station Annual Inspection Manual
* **Parameters Specification:**
```json
{
  "station_id": {
    "type": "string",
    "description": "Police Station ID or Name",
    "required": true
  }
}
```
* **Representative Officer Queries (Semantic Match Triggers):**
  * "Give me executive station summary for Peenya PS"
  * "Show performance scorecard of Hebbal station"
  * "ಠಾಣೆಯ ಕಾರ್ಯಕ್ಷಮತೆ ಸಾರಾಂಶ"

---


### Tool 67: `generate_supervisory_review` — Automated SP/DCP Monthly Inspection Docket
* **Exact Tool Name for GLM:** `generate_supervisory_review`
* **Operational Purpose & Mission:** Compile an automated supervisory inspection review for senior officers: highlights investigation defects, overdue chargesheets, POCSO compliance, and conviction trends.
* **When to Select this Tool (Disambiguation Rules for GLM):** Use for mandatory monthly reviews submitted to the Range IGP.
* **Target Personas:** Superintendent of Police (SP), Range IGP
* **Backend Data Sources & ZCQL Schemas:** CaseMaster, Unit, OfficerPerformance
* **Visual Response Type & UI Card:** `supervisory_review_docket`
* **Statutory Legal Grounding:** KSP Supervisory Review Protocol
* **Parameters Specification:**
```json
{
  "district": {
    "type": "string",
    "description": "District name",
    "required": true
  }
}
```
* **Representative Officer Queries (Semantic Match Triggers):**
  * "Generate supervisory review docket for Mysuru District"
  * "Compile SP monthly review report"
  * "ಮೇಲ್ವಿಚಾರಣಾ ಪರಿಶೀಲನಾ ಡಾಕೆಟ್ ರಚಿಸಿ"

---


### Tool 68: `audit_evidence_chain` — Uninterrupted Forensic Chain of Custody Audit
* **Exact Tool Name for GLM:** `audit_evidence_chain`
* **Operational Purpose & Mission:** Audit the continuous legal custody chain of physical and forensic evidence: from scene seizure, station malkhana deposit, FSL transit, to court presentation without evidentiary breaks.
* **When to Select this Tool (Disambiguation Rules for GLM):** Use before high-stakes murder or narcotics trials to preempt defense tampering claims.
* **Target Personas:** Public Prosecutor, Senior Investigating Officer
* **Backend Data Sources & ZCQL Schemas:** MalkhanaProperty, FSLDispatchMaster, CustodyTransferLog
* **Visual Response Type & UI Card:** `evidence_chain_card`
* **Statutory Legal Grounding:** Section 105 BNSS & Indian Law of Evidence
* **Parameters Specification:**
```json
{
  "case_no": {
    "type": "string",
    "description": "Case number",
    "required": true
  }
}
```
* **Representative Officer Queries (Semantic Match Triggers):**
  * "Audit evidence chain of custody for CR-2026-46092"
  * "Verify physical evidence custody logs for murder weapon"
  * "ಸಾಕ್ಷ್ಯಗಳ ಸರಣಿ ದಾಖಲೆಯನ್ನು ಆಡಿಟ್ ಮಾಡಿ"

---


### Tool 69: `get_pocso_compliance_tracker` — POCSO Act §35 Mandatory 60-Day Investigation Shield
* **Exact Tool Name for GLM:** `get_pocso_compliance_tracker`
* **Operational Purpose & Mission:** Audit strict compliance with the POCSO Act: mandatory 60-day investigation completion, legal aid allocation, recording of statement by woman magistrate (§183 BNSS), and Section 74 identity redaction.
* **When to Select this Tool (Disambiguation Rules for GLM):** Use to ensure zero violations of child protection laws.
* **Target Personas:** Special Juvenile Police Unit (SJPU), Superintendent of Police
* **Backend Data Sources & ZCQL Schemas:** CaseMaster (POCSO Acts), AccusedMaster
* **Visual Response Type & UI Card:** `pocso_tracker_card`
* **Statutory Legal Grounding:** POCSO Act 2012 §35 & Juvenile Justice Act §74
* **Parameters Specification:**
```json
{
  "case_no": {
    "type": "string",
    "description": "POCSO case number",
    "required": true
  }
}
```
* **Representative Officer Queries (Semantic Match Triggers):**
  * "Check POCSO compliance tracker for case CR-2026-46092"
  * "Audit 60-day deadline on child protection case"
  * "ಪೋಕ್ಸೋ ಕಾಯ್ದೆಯ ಅನುಸರಣೆ ಪರಿಶೀಲಿಸಿ"

---


### Tool 70: `get_district_crime_matrix` — Multi-Dimensional District Crime Performance Matrix
* **Exact Tool Name for GLM:** `get_district_crime_matrix`
* **Operational Purpose & Mission:** Generate a comprehensive comparative matrix ranking all 31 Karnataka police districts across crime detection rate, heinous crime disposal, recovery valuation, and public response time.
* **When to Select this Tool (Disambiguation Rules for GLM):** Use for state-level strategic crime allocation and DGP quarterly reviews.
* **Target Personas:** Director General of Police (DGP), SCRB Director
* **Backend Data Sources & ZCQL Schemas:** District, CaseMaster (ZCQL Multi-Group Aggregation)
* **Visual Response Type & UI Card:** `district_crime_matrix_card`
* **Statutory Legal Grounding:** Statewide Crime Reporting Standards
* **Parameters Specification:**
```json
{
  "metric": {
    "type": "string",
    "description": "Metric to rank by",
    "required": false
  }
}
```
* **Representative Officer Queries (Semantic Match Triggers):**
  * "Show district crime matrix for Karnataka State"
  * "Compare district detection rates statewide"
  * "ಜಿಲ್ಲಾವಾರು ಅಪರಾಧ ಮ್ಯಾಟ್ರಿಕ್ಸ್"

---


### Tool 71: `get_officer_performance_score` — Quantitative Investigation Quality & Conviction Index
* **Exact Tool Name for GLM:** `get_officer_performance_score`
* **Operational Purpose & Mission:** Compute objective performance scores for an Investigating Officer: chargesheet quality index, trial conviction percentage, average disposal velocity, and statutory defect frequency.
* **When to Select this Tool (Disambiguation Rules for GLM):** Use during annual performance appraisals (APAR) and promotion reviews.
* **Target Personas:** Superintendent of Police, Establishment Section
* **Backend Data Sources & ZCQL Schemas:** OfficerPerformanceMaster, CaseMaster
* **Visual Response Type & UI Card:** `officer_score_card`
* **Statutory Legal Grounding:** Karnataka Civil Services (Performance Appraisal Rules)
* **Parameters Specification:**
```json
{
  "employee_id": {
    "type": "string",
    "description": "Officer KGID or Name",
    "required": true
  }
}
```
* **Representative Officer Queries (Semantic Match Triggers):**
  * "Calculate officer performance score for KGID 2346836"
  * "Show investigation conviction rate for PSI Kumar"
  * "ಅಧಿಕಾರಿಯ ಕಾರ್ಯಕ್ಷಮತೆ ಸ್ಕೋರ್"

---


### Tool 72: `generate_parliamentary_qa_report` — Official Legislative Assembly & Parliament QA Dossier
* **Exact Tool Name for GLM:** `generate_parliamentary_qa_report`
* **Operational Purpose & Mission:** Formulate court-verified, aggregated statistical answers for Karnataka Legislative Assembly / Lok Sabha questions regarding crime trends, women safety, or cyber fraud within 30 seconds.
* **When to Select this Tool (Disambiguation Rules for GLM):** Use when legislative questions require certified statistical data from CCTNS records.
* **Target Personas:** Home Department Liaison Officer, DGP Control Room
* **Backend Data Sources & ZCQL Schemas:** CaseMaster, District (Statewide Aggregate Engine)
* **Visual Response Type & UI Card:** `parliamentary_qa_docket`
* **Statutory Legal Grounding:** Legislative Assembly Procedure Rules
* **Parameters Specification:**
```json
{
  "topic": {
    "type": "string",
    "description": "Topic or question keywords",
    "required": true
  }
}
```
* **Representative Officer Queries (Semantic Match Triggers):**
  * "Generate parliamentary QA report on cyber crimes in Karnataka"
  * "Answer legislative question regarding chain snatching statistics"
  * "ವಿಧಾನಸಭಾ ಪ್ರಶ್ನೋತ್ತರ ವರದಿ ರಚಿಸಿ"

---


### Tool 73: `get_sp_monthly_crime_review` — Superintendent of Police Monthly Command Conference Brief
* **Exact Tool Name for GLM:** `get_sp_monthly_crime_review`
* **Operational Purpose & Mission:** Assemble the complete monthly crime review slide deck for the District SP: summarizes law & order, communal tension indicators, pending murder trials, and road accidents.
* **When to Select this Tool (Disambiguation Rules for GLM):** Use for monthly district officer meetings.
* **Target Personas:** Superintendent of Police, District Crime Record Bureau (DCRB)
* **Backend Data Sources & ZCQL Schemas:** CaseMaster, District, Unit
* **Visual Response Type & UI Card:** `sp_crime_review_docket`
* **Statutory Legal Grounding:** KSP District Command Review Guidelines
* **Parameters Specification:**
```json
{
  "district": {
    "type": "string",
    "description": "District name",
    "required": true
  }
}
```
* **Representative Officer Queries (Semantic Match Triggers):**
  * "Generate SP monthly crime review for Belagavi District"
  * "Compile monthly crime presentation for commissioner"
  * "ಎಸ್ಪಿ ಮಾಸಿಕ ಅಪರಾಧ ಪರಿಶೀಲನಾ ವರದಿ"

---


### Tool 74: `mobile_patrol_quick_scan` — Rapid 2-Second Mobile Field Verification Scan
* **Exact Tool Name for GLM:** `mobile_patrol_quick_scan`
* **Operational Purpose & Mission:** Execute an ultra-fast 2-second check on vehicle registration plate, suspect name, or phone number from mobile patrol phones, returning an immediate green/red flag with active warrants.
* **When to Select this Tool (Disambiguation Rules for GLM):** Use by beat constables on night highway nakabandi or vehicle interception.
* **Target Personas:** Beat Constable on Patrol, Highway Patrol Crew
* **Backend Data Sources & ZCQL Schemas:** AccusedMaster, WarrantMaster, StolenVehicleMaster
* **Visual Response Type & UI Card:** `quick_scan_badge`
* **Statutory Legal Grounding:** Beat Constable Rapid Interception SOP
* **Parameters Specification:**
```json
{
  "query": {
    "type": "string",
    "description": "Vehicle number, suspect name, or phone",
    "required": true
  }
}
```
* **Representative Officer Queries (Semantic Match Triggers):**
  * "Quick scan vehicle KA-04-MB-1234"
  * "Scan suspect Suresh on street check"
  * "ಕ್ಷಿಪ್ರ ತಪಾಸಣೆ ನಡೆಸಿ"

---


### Tool 75: `get_emergency_112_dispatch_board` — Live Dial 112 Emergency Dispatch & Response Queue
* **Exact Tool Name for GLM:** `get_emergency_112_dispatch_board`
* **Operational Purpose & Mission:** Monitor real-time incoming 112 emergency calls: response time SLA breaches, active distress priority ranking, and closest available vehicle dispatch recommendations.
* **When to Select this Tool (Disambiguation Rules for GLM):** Use in police control rooms managing emergency response.
* **Target Personas:** Dial 112 Command Dispatcher, PCR In-Charge
* **Backend Data Sources & ZCQL Schemas:** Emergency112Calls, PatrolFleetGPS
* **Visual Response Type & UI Card:** `emergency_112_board`
* **Statutory Legal Grounding:** Emergency Response Support System (ERSS 112) National Guidelines
* **Parameters Specification:**
```json
{
  "district": {
    "type": "string",
    "description": "District name",
    "required": false
  }
}
```
* **Representative Officer Queries (Semantic Match Triggers):**
  * "Show live 112 emergency dispatch board for Bengaluru"
  * "Check pending 112 emergency calls"
  * "ತುರ್ತು ೧೧೨ ಕರಪತ್ರ ಮತ್ತು ವಾಹನ ನಿಯೋಜನೆ"

---


### Tool 76: `get_scrb_statewide_crime_bulletin` — State Crime Records Bureau Statewide Daily Intelligence
* **Exact Tool Name for GLM:** `get_scrb_statewide_crime_bulletin`
* **Operational Purpose & Mission:** Retrieve the daily confidential intelligence bulletin issued by SCRB Karnataka: high-risk interstate criminal gang movements, child kidnapping alerts, and trending cyber vectors.
* **When to Select this Tool (Disambiguation Rules for GLM):** Use for daily morning briefings across all police stations.
* **Target Personas:** All Station House Officers, Superintendents of Police
* **Backend Data Sources & ZCQL Schemas:** SCRB Statewide Intelligence Feed
* **Visual Response Type & UI Card:** `scrb_bulletin_card`
* **Statutory Legal Grounding:** State Crime Records Bureau SOP
* **Parameters Specification:**
```json
{
  "date": {
    "type": "string",
    "description": "Date of bulletin (optional)",
    "required": false
  }
}
```
* **Representative Officer Queries (Semantic Match Triggers):**
  * "Fetch latest SCRB statewide crime bulletin"
  * "Show daily police intelligence bulletin"
  * "ದೈನಂದಿನ ಅಪರಾಧ ಗುಪ್ತಚರ ಬುಲೆಟಿನ್"

---


### Tool 77: `get_arms_ammunition_custody_tracker` — Police Armory & Licensed Firearm Custody Ledger
* **Exact Tool Name for GLM:** `get_arms_ammunition_custody_tracker`
* **Operational Purpose & Mission:** Track departmentally issued Glock pistols, INSAS rifles, and ammunition stocks, as well as civilian licensed firearms deposited during election code of conduct periods.
* **When to Select this Tool (Disambiguation Rules for GLM):** Use during armory audits and election security preparations.
* **Target Personas:** District Armory In-Charge, Reserve Police Inspector
* **Backend Data Sources & ZCQL Schemas:** ArmsArmoryMaster, CivilianWeaponDepositLedger
* **Visual Response Type & UI Card:** `arms_custody_card`
* **Statutory Legal Grounding:** Arms Act 1959 & Election Commission Weapon Deposit Mandates
* **Parameters Specification:**
```json
{
  "station_id": {
    "type": "string",
    "description": "Station ID or District",
    "required": true
  }
}
```
* **Representative Officer Queries (Semantic Match Triggers):**
  * "Audit arms and ammunition custody ledger for station"
  * "List civilian firearms deposited during elections"
  * "ಶಸ್ತ್ರಾಸ್ತ್ರ ಮತ್ತು ಮದ್ದುಗುಂಡುಗಳ ಲೆಡ್ಜರ್"

---


### Tool 78: `get_court_trial_calendar` — Prosecution Witness & Trial Hearing Calendar
* **Exact Tool Name for GLM:** `get_court_trial_calendar`
* **Operational Purpose & Mission:** Track upcoming court trial hearings: witness summons return dates, cross-examination schedules, and evidence production dates before Sessions and Magistrate courts.
* **When to Select this Tool (Disambiguation Rules for GLM):** Use by prosecutors and court constables to ensure witnesses attend on trial dates.
* **Target Personas:** Assistant Public Prosecutor, Court Liaison Officer
* **Backend Data Sources & ZCQL Schemas:** CourtHearingMaster, CaseMaster
* **Visual Response Type & UI Card:** `trial_calendar_card`
* **Statutory Legal Grounding:** Criminal Procedure & Court Case Management System
* **Parameters Specification:**
```json
{
  "court_name": {
    "type": "string",
    "description": "Court name or Case Number",
    "required": false
  }
}
```
* **Representative Officer Queries (Semantic Match Triggers):**
  * "Show court trial calendar for this week"
  * "When is witness cross-examination scheduled for case 46092?"
  * "ನ್ಯಾಯಾಲಯದ ವಿಚಾರಣಾ ವೇಳಾಪಟ್ಟಿ"

---


### Tool 79: `get_interstate_fugitive_alert` — Cross-Border Fugitive & Inter-State Lookout Radar
* **Exact Tool Name for GLM:** `get_interstate_fugitive_alert`
* **Operational Purpose & Mission:** Issue and monitor interstate fugitive alerts across neighboring state police forces (Maharashtra, Andhra Pradesh, Tamil Nadu, Kerala, Goa) for fleeing dacoity and murder suspects.
* **When to Select this Tool (Disambiguation Rules for GLM):** Use when a suspect escapes across state borders.
* **Target Personas:** State Intelligence Wing, CID Interstate Cell
* **Backend Data Sources & ZCQL Schemas:** InterstateFugitiveRegistry, AccusedMaster
* **Visual Response Type & UI Card:** `interstate_alert_card`
* **Statutory Legal Grounding:** Inter-State Police Coordination Council Norms
* **Parameters Specification:**
```json
{
  "accused_name": {
    "type": "string",
    "description": "Suspect name or photo hash",
    "required": true
  }
}
```
* **Representative Officer Queries (Semantic Match Triggers):**
  * "Check interstate fugitive alerts for accused Sikandar"
  * "Issue cross-border alert to Maharashtra Police"
  * "ಅಂತಾರಾಜ್ಯ ಪರಾರಿ ಆರೋಪಿ ಎಚ್ಚರಿಕೆ"

---


### Tool 80: `get_cyber_fraud_1930_docket` — National Cyber Crime Reporting Portal (1930) Docket
* **Exact Tool Name for GLM:** `get_cyber_fraud_1930_docket`
* **Operational Purpose & Mission:** Ingest complaints from National Cybercrime Reporting Portal (1930): identifies beneficiary mule bank accounts, frozen amounts, and auto-dispatches Section 106 BNSS notices.
* **When to Select this Tool (Disambiguation Rules for GLM):** Use for immediate 'Golden Hour' cyber fraud financial freezes.
* **Target Personas:** Cyber Crime Police Station (CEN), Tech Cell
* **Backend Data Sources & ZCQL Schemas:** Cyber1930Complaints, BankMuleLedger
* **Visual Response Type & UI Card:** `cyber_1930_docket`
* **Statutory Legal Grounding:** Section 106 BNSS & IT Act Section 66D
* **Parameters Specification:**
```json
{
  "acknowledgement_no": {
    "type": "string",
    "description": "1930 Complaint acknowledgement number",
    "required": true
  }
}
```
* **Representative Officer Queries (Semantic Match Triggers):**
  * "Fetch 1930 cyber fraud complaint docket for ack 2341908"
  * "Freeze beneficiary bank account from 1930 cyber report"
  * "೧೯೩೦ ಸೈಬರ್ ವಂಚನೆ ದೂರು"

---


### Tool 81: `get_missing_persons_facial_recon` — Biometric & Visual Missing Persons Matching
* **Exact Tool Name for GLM:** `get_missing_persons_facial_recon`
* **Operational Purpose & Mission:** Cross-reference photographs of unidentified dead bodies (UIDB) and discovered children against SCRB and NCRB missing persons repositories using facial embedding vectors.
* **When to Select this Tool (Disambiguation Rules for GLM):** Use when an unidentified person or body is discovered.
* **Target Personas:** Anti-Human Trafficking Unit (AHTU), Station IO
* **Backend Data Sources & ZCQL Schemas:** MissingPersonsMaster, FacialVectors
* **Visual Response Type & UI Card:** `missing_person_match_card`
* **Statutory Legal Grounding:** SOP on Missing Children & Unidentified Deceased
* **Parameters Specification:**
```json
{
  "photo_url": {
    "type": "string",
    "description": "Image URL or Stratus ID",
    "required": true
  }
}
```
* **Representative Officer Queries (Semantic Match Triggers):**
  * "Match photograph against missing persons database"
  * "Identify unknown deceased person from photo"
  * "ನಾಪತ್ತೆಯಾದ ವ್ಯಕ್ತಿಗಳ ಮುಖ ಗುರುತಿಸುವಿಕೆ"

---


### Tool 82: `get_vip_route_security_plan` — VIP Convoy Route Security & Anti-Sabotage Protocol
* **Exact Tool Name for GLM:** `get_vip_route_security_plan`
* **Operational Purpose & Mission:** Generate tactical route sanitization protocols, emergency hospital evacuation routes, and pilot/tail car deployment plans for visiting dignitaries and VIP convoys.
* **When to Select this Tool (Disambiguation Rules for GLM):** Use during VVIP visits, CM/Governor convoys, and public rallies.
* **Target Personas:** DCP Security, Traffic Command Center
* **Backend Data Sources & ZCQL Schemas:** VIPRouteMaster, RoadNetwork
* **Visual Response Type & UI Card:** `vip_security_plan_card`
* **Statutory Legal Grounding:** Blue Book Security Regulations for Protected Persons
* **Parameters Specification:**
```json
{
  "route_name": {
    "type": "string",
    "description": "Starting and destination point",
    "required": true
  }
}
```
* **Representative Officer Queries (Semantic Match Triggers):**
  * "Generate VIP route security plan from Airport to Vidhana Soudha"
  * "Sanitize convoy route for CM visit"
  * "ವಿಐಪಿ ಮಾರ್ಗ ಭದ್ರತಾ ಯೋಜನೆ"

---


### Tool 83: `get_riot_crowd_control_sop` — Public Order Escalation & Riot Crowd Dispersal SOP
* **Exact Tool Name for GLM:** `get_riot_crowd_control_sop`
* **Operational Purpose & Mission:** Provide structured, legally graded crowd dispersal standard operating procedures: lawful assembly warnings (§189 BNSS), water cannon, tear gas, lathi charge, and executive magistrate orders.
* **When to Select this Tool (Disambiguation Rules for GLM):** Use during civil unrest, communal clashes, or unlawful protest demonstrations.
* **Target Personas:** Executive Magistrate, Law & Order DCP / SP
* **Backend Data Sources & ZCQL Schemas:** PublicOrderSOPMaster
* **Visual Response Type & UI Card:** `crowd_control_sop_card`
* **Statutory Legal Grounding:** Sections 148, 189 BNSS & Police Use of Force Guidelines
* **Parameters Specification:**
```json
{
  "situation_severity": {
    "type": "string",
    "description": "low, medium, or high riot escalation",
    "required": true
  }
}
```
* **Representative Officer Queries (Semantic Match Triggers):**
  * "Get riot crowd control SOP for violent assembly"
  * "What are legal escalation steps for mob dispersal under BNSS?"
  * "ಗಲಭೆ ನಿಯಂತ್ರಣ ಮಾರ್ಗಸೂಚಿ"

---


### Tool 84: `get_community_policing_outreach` — Citizen Beat Committee & Neighborhood Watch Ledger
* **Exact Tool Name for GLM:** `get_community_policing_outreach`
* **Operational Purpose & Mission:** Track community policing outreach: monthly citizen beat committee meetings, senior citizen welfare checks, and public grievance redressal records.
* **When to Select this Tool (Disambiguation Rules for GLM):** Use to evaluate neighborhood police-public trust and intelligence gathering.
* **Target Personas:** Community Policing Officer, Beat PSI
* **Backend Data Sources & ZCQL Schemas:** CommunityPolicingLog, Unit
* **Visual Response Type & UI Card:** `community_outreach_card`
* **Statutory Legal Grounding:** Karnataka Community Policing Policy
* **Parameters Specification:**
```json
{
  "station_id": {
    "type": "string",
    "description": "Police Station ID",
    "required": true
  }
}
```
* **Representative Officer Queries (Semantic Match Triggers):**
  * "Show community policing meetings in Hebbal precinct"
  * "List senior citizen visits recorded this month"
  * "ಸಮುದಾಯ ಪೋಲೀಸಿಂಗ್ ವಿವರ"

---


### Tool 85: `get_cctns_offline_sync_status` — Remote Station CCTNS Offline Database Sync Monitor
* **Exact Tool Name for GLM:** `get_cctns_offline_sync_status`
* **Operational Purpose & Mission:** Monitor database replication and offline data sync queues across remote Western Ghats and border stations with intermittent internet connectivity.
* **When to Select this Tool (Disambiguation Rules for GLM):** Use to verify whether remote FIRs and arrest records are synced to state central servers.
* **Target Personas:** Police IT & Wireless Division, CCTNS State Administrator
* **Backend Data Sources & ZCQL Schemas:** OfflineSyncQueue, Unit
* **Visual Response Type & UI Card:** `sync_status_card`
* **Statutory Legal Grounding:** CCTNS Disaster Recovery & Synchronization Architecture
* **Parameters Specification:**
```json
{
  "station_id": {
    "type": "string",
    "description": "Station ID",
    "required": false
  }
}
```
* **Representative Officer Queries (Semantic Match Triggers):**
  * "Check CCTNS offline sync status for remote stations"
  * "Are Western Ghats precinct FIRs synced to central database?"
  * "ಸಿಸಿಟಿಎನ್‌ಎಸ್ ಸಿಂಕ್ ಸ್ಥಿತಿ"

---


### Tool 86: `get_traffic_accident_blackspot_radar` — High-Fatality Road Traffic Accident Blackspot Radar
* **Exact Tool Name for GLM:** `get_traffic_accident_blackspot_radar`
* **Operational Purpose & Mission:** Map and analyze road accident blackspots on state and national highways, correlating fatal crashes with lighting defects, sharp road curves, and missing warning signages.
* **When to Select this Tool (Disambiguation Rules for GLM):** Use for highway engineering interventions and speed-trap camera deployment.
* **Target Personas:** Traffic Police Superintendent, Highway Patrol
* **Backend Data Sources & ZCQL Schemas:** TrafficAccidentMaster, HighwayBlackspots
* **Visual Response Type & UI Card:** `blackspot_radar_card`
* **Statutory Legal Grounding:** Ministry of Road Transport & Highways Blackspot Protocol
* **Parameters Specification:**
```json
{
  "highway_or_district": {
    "type": "string",
    "description": "Highway number or district",
    "required": true
  }
}
```
* **Representative Officer Queries (Semantic Match Triggers):**
  * "Show accident blackspots on Bengaluru-Mysuru Expressway"
  * "Identify fatal road crash clusters in Belagavi"
  * "ರಸ್ತೆ ಅಪಘಾತದ ಬ್ಲಾಕ್‌ಸ್ಪಾಟ್ ನಕ್ಷೆ"

---


### Tool 87: `get_drug_peddling_ndps_tracker` — NDPS Commercial Contraband Seizure & Peddler Ledger
* **Exact Tool Name for GLM:** `get_drug_peddling_ndps_tracker`
* **Operational Purpose & Mission:** Track illicit narcotics operations: MDMA, synthetic drugs, hydroponic weed, coastal transit hauls, darknet drops, and Section 68-F NDPS property forfeiture.
* **When to Select this Tool (Disambiguation Rules for GLM):** Use when investigating narcotics syndicates or executing anti-drug crackdowns.
* **Target Personas:** Anti-Narcotics Wing (CCB / CID), Superintendent of Police
* **Backend Data Sources & ZCQL Schemas:** NDPSSeizureMaster, ContrabandPeddlers
* **Visual Response Type & UI Card:** `ndps_tracker_card`
* **Statutory Legal Grounding:** NDPS Act 1985 & Section 68-F Asset Forfeiture
* **Parameters Specification:**
```json
{
  "district": {
    "type": "string",
    "description": "District or coastal zone",
    "required": false
  }
}
```
* **Representative Officer Queries (Semantic Match Triggers):**
  * "Show drug peddling NDPS tracker for Bengaluru"
  * "Track synthetic narcotics seizures in coastal corridor"
  * "ಮಾದಕ ವಸ್ತು ಜಾಲದ ಟ್ರ್ಯಾಕರ್"

---


### Tool 88: `get_illegal_sand_mining_tracker` — Riverbed Environmental Crime & Seized Tipper Tracker
* **Exact Tool Name for GLM:** `get_illegal_sand_mining_tracker`
* **Operational Purpose & Mission:** Monitor illegal riverbed sand mining extraction points, seized tipper trucks, and repeat offending tractor syndicates operating across taluk river basins.
* **When to Select this Tool (Disambiguation Rules for GLM):** Use during joint crackdowns with Revenue and Mines & Geology departments.
* **Target Personas:** Rural Police Inspector, Tahsildar / Executive Magistrate
* **Backend Data Sources & ZCQL Schemas:** SandMiningCases, SeizedVehicleMaster
* **Visual Response Type & UI Card:** `sand_mining_card`
* **Statutory Legal Grounding:** Mines and Minerals (Development and Regulation) Act
* **Parameters Specification:**
```json
{
  "district": {
    "type": "string",
    "description": "District name",
    "required": true
  }
}
```
* **Representative Officer Queries (Semantic Match Triggers):**
  * "Track illegal sand mining cases in Belagavi river basin"
  * "Show seized tipper trucks in sand smuggling"
  * "ಅಕ್ರಮ ಮರಳು ಗಣಿಗಾರಿಕೆ ಪ್ರಕರಣಗಳು"

---


### Tool 89: `get_gambling_matka_den_radar` — Organized Matka Betting & Gambling Den Intelligence
* **Exact Tool Name for GLM:** `get_gambling_matka_den_radar`
* **Operational Purpose & Mission:** Map organized illegal Matka betting dens, online cricket gambling bookies, and cash collection bookmakers operating across urban areas.
* **When to Select this Tool (Disambiguation Rules for GLM):** Use by Special Crime Branches executing simultaneous vice raids.
* **Target Personas:** City Crime Branch (CCB), Special Squad PSI
* **Backend Data Sources & ZCQL Schemas:** GamblingDenMaster, MatkaCases
* **Visual Response Type & UI Card:** `matka_radar_card`
* **Statutory Legal Grounding:** Karnataka Police Act §78, §87 (Gambling & Matka Prevention)
* **Parameters Specification:**
```json
{
  "district": {
    "type": "string",
    "description": "District or city zone",
    "required": true
  }
}
```
* **Representative Officer Queries (Semantic Match Triggers):**
  * "Map illegal Matka betting dens in Bengaluru Central"
  * "Show gambling bookie locations in Belagavi"
  * "ಮಟ್ಕಾ ಅಡ್ಡೆಗಳ ಗುಪ್ತಚರ ರೇಡಾರ್"

---


### Tool 90: `get_juvenile_jj_board_tracker` — Child in Conflict with Law & Juvenile Justice Board Oversight
* **Exact Tool Name for GLM:** `get_juvenile_jj_board_tracker`
* **Operational Purpose & Mission:** Monitor cases involving children in conflict with law (CCL): Social Investigation Reports (SIR), observation home placement, child welfare committee hearings, and adult-transfer evaluation under Section 15 JJ Act.
* **When to Select this Tool (Disambiguation Rules for GLM):** Use to guarantee strict compliance with statutory juvenile protection norms.
* **Target Personas:** Child Welfare Police Officer (CWPO), Juvenile Justice Board Member
* **Backend Data Sources & ZCQL Schemas:** JuvenileMaster, CaseMaster
* **Visual Response Type & UI Card:** `jjb_tracker_card`
* **Statutory Legal Grounding:** Juvenile Justice (Care and Protection of Children) Act 2015
* **Parameters Specification:**
```json
{
  "case_no": {
    "type": "string",
    "description": "Case number",
    "required": true
  }
}
```
* **Representative Officer Queries (Semantic Match Triggers):**
  * "Check Juvenile Justice Board tracker for case CR-46092"
  * "Show Social Investigation Report status for minor accused"
  * "ಬಾಲ ನ್ಯಾಯ ಮಂಡಳಿ ಟ್ರ್ಯಾಕರ್"

---


### Tool 91: `get_police_welfare_grievance_ledger` — Departmental Personnel Welfare & Grievance Redressal
* **Exact Tool Name for GLM:** `get_police_welfare_grievance_ledger`
* **Operational Purpose & Mission:** Manage internal police personnel welfare: medical insurance claim approvals, official quarters housing allocation, transfer petitions, and grievance redressals.
* **When to Select this Tool (Disambiguation Rules for GLM):** Use by SP Headquarters and welfare officers caring for the police force.
* **Target Personas:** Superintendent of Police (Admin), Police Welfare Officer
* **Backend Data Sources & ZCQL Schemas:** PoliceWelfareGrievanceMaster
* **Visual Response Type & UI Card:** `welfare_grievance_card`
* **Statutory Legal Grounding:** Karnataka Police Welfare Regulations
* **Parameters Specification:**
```json
{
  "district": {
    "type": "string",
    "description": "District or unit",
    "required": false
  }
}
```
* **Representative Officer Queries (Semantic Match Triggers):**
  * "Show police personnel welfare grievances in district"
  * "Check pending police health insurance approvals"
  * "ಪೋಲೀಸ್ ಕಲ್ಯಾಣ ಮತ್ತು ಕುಂದುಕೊರತೆ"

---


### Tool 92: `get_intelligence_secret_service_fund_audit` — Confidential Informant & Secret Service Fund Audit
* **Exact Tool Name for GLM:** `get_intelligence_secret_service_fund_audit`
* **Operational Purpose & Mission:** Maintain cryptographic, pseudonymized audits of Secret Service Fund (SSF) cash disbursements to confidential human intelligence (HUMINT) sources and informants.
* **When to Select this Tool (Disambiguation Rules for GLM):** Use strictly by authorized Intelligence SPs and internal vigilance auditors.
* **Target Personas:** SP Special Branch / Intelligence, Internal Vigilance
* **Backend Data Sources & ZCQL Schemas:** SecretServiceFundLedger (Encrypted)
* **Visual Response Type & UI Card:** `ssf_audit_card`
* **Statutory Legal Grounding:** Special Service Fund Financial Rules & Intelligence Secrecy Standards
* **Parameters Specification:**
```json
{
  "unit_id": {
    "type": "string",
    "description": "Intelligence Unit ID",
    "required": true
  }
}
```
* **Representative Officer Queries (Semantic Match Triggers):**
  * "Audit Secret Service Fund disbursements for Intelligence Unit 4"
  * "Check confidential informant expense ledger"
  * "ರಹಸ್ಯ ಸೇವಾ ನಿಧಿಯ ಆಡಿಟ್"

---


### Tool 93: `get_inter_agency_nia_cbi_coordination` — Central Enforcement Agency (NIA/CBI/ED/NCB) Operations
* **Exact Tool Name for GLM:** `get_inter_agency_nia_cbi_coordination`
* **Operational Purpose & Mission:** Coordinate joint operations with central enforcement agencies: National Investigation Agency (terrorist links), CBI (interstate corruption), ED (money laundering), and NCB (international narcotics).
* **When to Select this Tool (Disambiguation Rules for GLM):** Use when state FIRs are scheduled for federal agency takeover or joint warrants.
* **Target Personas:** State Anti-Terrorist Squad (ATS), CID State Liaison Officer
* **Backend Data Sources & ZCQL Schemas:** InterAgencyDockets, CaseMaster
* **Visual Response Type & UI Card:** `inter_agency_card`
* **Statutory Legal Grounding:** National Investigation Agency Act & Central Agency Coordination Protocols
* **Parameters Specification:**
```json
{
  "agency_name": {
    "type": "string",
    "description": "NIA, CBI, ED, or NCB",
    "required": false
  }
}
```
* **Representative Officer Queries (Semantic Match Triggers):**
  * "Show NIA and CBI coordinated dockets in Karnataka"
  * "Check cases referred to Enforcement Directorate"
  * "ಕೇಂದ್ರ ತನಿಖಾ ಸಂಸ್ಥೆಗಳ ಸಮನ್ವಯ"

---


### Tool 94: `get_jail_prison_inmate_release_radar` — Central Prison Discharge & Bail Release Radar
* **Exact Tool Name for GLM:** `get_jail_prison_inmate_release_radar`
* **Operational Purpose & Mission:** Receive real-time alerts on habitual offenders released on bail or sentence completion from major Karnataka prisons (Parappana Agrahara, Hindalga Belagavi, Bellary Central Prison).
* **When to Select this Tool (Disambiguation Rules for GLM):** Use to immediately place surveillance on released burglars and chain snatchers.
* **Target Personas:** Crime Branch Detective, Station House Officer
* **Backend Data Sources & ZCQL Schemas:** PrisonReleaseLog, CentralPrisonMaster
* **Visual Response Type & UI Card:** `prison_release_card`
* **Statutory Legal Grounding:** Prison-to-Police Intelligence Sharing Protocol
* **Parameters Specification:**
```json
{
  "district": {
    "type": "string",
    "description": "District or prison name",
    "required": false
  }
}
```
* **Representative Officer Queries (Semantic Match Triggers):**
  * "Show inmates released from Parappana Agrahara this week"
  * "Alert for habitual burglars released from Hindalga prison"
  * "ಜೈಲಿನಿಂದ ಬಿಡುಗಡೆಯಾದ ಅಪರಾಧಿಗಳ ರೇಡಾರ್"

---


### Tool 95: `get_district_annual_crime_review` — Annual Statistical Crime Yearbook & Comprehensive Audit
* **Exact Tool Name for GLM:** `get_district_annual_crime_review`
* **Operational Purpose & Mission:** Generate comprehensive annual statistical crime reviews: longitudinal comparisons across 5 years, conviction rates by crime head, property recovery percentages, and demographic trends.
* **When to Select this Tool (Disambiguation Rules for GLM):** Use when preparing the official District Annual Administration Report.
* **Target Personas:** Superintendent of Police, SCRB Director
* **Backend Data Sources & ZCQL Schemas:** CaseMaster, District, CourtOutcomes
* **Visual Response Type & UI Card:** `annual_crime_review_docket`
* **Statutory Legal Grounding:** National Crime Records Bureau (NCRB) Annual Reporting Guidelines
* **Parameters Specification:**
```json
{
  "district": {
    "type": "string",
    "description": "District name",
    "required": true
  },
  "year": {
    "type": "integer",
    "description": "Review year",
    "required": false,
    "default": 2025
  }
}
```
* **Representative Officer Queries (Semantic Match Triggers):**
  * "Generate annual crime review for Belagavi District"
  * "Show 2025 annual crime audit for Bengaluru Urban"
  * "ವಾರ್ಷಿಕ ಅಪರಾಧ ಪರಿಶೀಲನಾ ವರದಿ"

---


### Tool 96: `check_alibi_consistency` — Suspect Alibi Cross-Check with Multi-Source Digital Evidence
* **Exact Tool Name for GLM:** `check_alibi_consistency`
* **Operational Purpose & Mission:** Cross-reference a suspect's claimed alibi against CDR mobile tower locations, CCTV toll passes, ATM transaction timestamps, and independent witness statements.
* **When to Select this Tool (Disambiguation Rules for GLM):** Use during interrogation when a suspect claims they were in another city during the crime.
* **Target Personas:** Investigating Officer, Interrogation Specialist
* **Backend Data Sources & ZCQL Schemas:** CDRData, TollPlazaLogs, WitnessMaster
* **Visual Response Type & UI Card:** `alibi_audit_card`
* **Statutory Legal Grounding:** Section 103 Indian Evidence Act / BSA (Burden of Proving Fact within Knowledge)
* **Parameters Specification:**
```json
{
  "suspect_name": {
    "type": "string",
    "description": "Suspect name",
    "required": true
  },
  "claimed_location": {
    "type": "string",
    "description": "Claimed alibi location",
    "required": true
  },
  "incident_time": {
    "type": "string",
    "description": "Date and time of crime",
    "required": true
  }
}
```
* **Representative Officer Queries (Semantic Match Triggers):**
  * "Check alibi consistency for suspect claiming he was in Mysuru during Bengaluru robbery"
  * "Verify alibi of Ramesh against mobile tower logs"
  * "ಆರೋಪಿಯ ಅಲಿಬಿ ಪರಿಶೀಲಿಸಿ"

---


### Tool 97: `cluster_crime_patterns` — Unsupervised Machine Learning Crime Pattern Clustering
* **Exact Tool Name for GLM:** `cluster_crime_patterns`
* **Operational Purpose & Mission:** Execute unsupervised clustering (K-Means / HDBSCAN) over statewide CCTNS FIR features (time of occurrence, target premise, weapon used, entry method) to discover emergent serial patterns.
* **When to Select this Tool (Disambiguation Rules for GLM):** Use to detect unknown active criminal groups striking across multiple police subdivisions.
* **Target Personas:** SCRB Pattern Analyst, Crime Intelligence Specialist
* **Backend Data Sources & ZCQL Schemas:** CaseMaster, scikit-learn Clustering Pipeline
* **Visual Response Type & UI Card:** `crime_cluster_card`
* **Statutory Legal Grounding:** Advanced Criminological Pattern Detection
* **Parameters Specification:**
```json
{
  "district": {
    "type": "string",
    "description": "District or commissionerate",
    "required": true
  }
}
```
* **Representative Officer Queries (Semantic Match Triggers):**
  * "Cluster crime patterns in Bengaluru Urban to find emergent serial sprees"
  * "Run unsupervised pattern discovery across property crimes"
  * "ಅಪರಾಧ ಮಾದರಿಗಳನ್ನು ಕ್ಲಸ್ಟರ್ ಮಾಡಿ"

---


### Tool 98: `get_mo_profile` — Behavioral Modus Operandi Trait Fingerprint
* **Exact Tool Name for GLM:** `get_mo_profile`
* **Operational Purpose & Mission:** Construct a behavioral MO fingerprint: point of entry (roof, window, lock picking), getaway transport, weapons carried, disguise, and post-offence property disposal channel.
* **When to Select this Tool (Disambiguation Rules for GLM):** Use to profile unidentified offenders from physical evidence at the scene.
* **Target Personas:** Investigating Officer, Forensic Profiler
* **Backend Data Sources & ZCQL Schemas:** MOBehavioralProfiler, CaseMaster
* **Visual Response Type & UI Card:** `mo_profile_card`
* **Statutory Legal Grounding:** Behavioral Analysis in Criminology
* **Parameters Specification:**
```json
{
  "crime_type": {
    "type": "string",
    "description": "Crime type (e.g. 'burglary', 'snatching')",
    "required": true
  }
}
```
* **Representative Officer Queries (Semantic Match Triggers):**
  * "Get MO profile for night-time house break-ins in Bengaluru"
  * "Show behavioral signature of chain snatching gangs"
  * "ಎಂಒ ಪ್ರೊಫೈಲ್ ತೋರಿಸಿ"

---


### Tool 99: `ask_clarifying_question` — Structured Tactical Clarification Inquest Assistant
* **Exact Tool Name for GLM:** `ask_clarifying_question`
* **Operational Purpose & Mission:** Generate structured multi-step clarifying inquests with selectable options and write-in placeholders when an inquiry lacks parameters (district, crime head, timeframe).
* **When to Select this Tool (Disambiguation Rules for GLM):** Use automatically when a query is broad or underspecified.
* **Target Personas:** All Officers
* **Backend Data Sources & ZCQL Schemas:** Clarification Inquest Engine
* **Visual Response Type & UI Card:** `clarification_inquest_modal`
* **Statutory Legal Grounding:** Conversational AI Clarification Protocol
* **Parameters Specification:**
```json
{
  "query": {
    "type": "string",
    "description": "Original user query",
    "required": true
  }
}
```
* **Representative Officer Queries (Semantic Match Triggers):**
  * "Clarify chain snatching inquiry"
  * "Ask narrowing questions for syndicate search"
  * "ಸ್ಪಷ್ಟೀಕರಣ ಪ್ರಶ್ನೆ ಕೇಳಿ"

---


### Tool 100: `add_case_diary_entry` — Secondary Case Diary Recording Gateway
* **Exact Tool Name for GLM:** `add_case_diary_entry`
* **Operational Purpose & Mission:** Alternate named endpoint to record investigation entries into the official CCTNS Case Diary table with cryptographic integrity checks.
* **When to Select this Tool (Disambiguation Rules for GLM):** Use interchangeably with `add_diary_entry`.
* **Target Personas:** Investigating Officer
* **Backend Data Sources & ZCQL Schemas:** CaseDiary
* **Visual Response Type & UI Card:** `diary_entry_card`
* **Statutory Legal Grounding:** Section 193(1) BNSS
* **Parameters Specification:**
```json
{
  "case_no": {
    "type": "string",
    "description": "Case number",
    "required": true
  },
  "entry_text": {
    "type": "string",
    "description": "Investigation action details",
    "required": true
  }
}
```
* **Representative Officer Queries (Semantic Match Triggers):**
  * "Add case diary entry for case 104/2026"
  * "Record scene inspection in diary"
  * "ಕೇಸ್ ಡೈರಿ ಎಂಟ್ರಿ ಸೇರಿಸಿ"

---


### Tool 101: `add_investigation_task` — Create Supervised Guided Investigation Task
* **Exact Tool Name for GLM:** `add_investigation_task`
* **Operational Purpose & Mission:** Create a structured, mandatory investigation task for an officer (e.g. 'Collect CCTV from Junction X', 'Examine eye-witness Y') with required completion notes and evidence photo uploads.
* **When to Select this Tool (Disambiguation Rules for GLM):** Use by SHOs and Circle Inspectors assigning specific tasks to investigating officers.
* **Target Personas:** Station House Officer, Investigating Officer
* **Backend Data Sources & ZCQL Schemas:** InvestigationTasksTable
* **Visual Response Type & UI Card:** `task_card`
* **Statutory Legal Grounding:** Supervisory Investigation Management SOP
* **Parameters Specification:**
```json
{
  "case_no": {
    "type": "string",
    "description": "Case number",
    "required": true
  },
  "task_description": {
    "type": "string",
    "description": "Instruction for IO",
    "required": true
  }
}
```
* **Representative Officer Queries (Semantic Match Triggers):**
  * "Add investigation task for CR-46092: Collect CCTV from Nayar Ganj junction"
  * "Assign task to verify victim statement"
  * "ತನಿಖಾ ಕಾರ್ಯವನ್ನು ನಿಯೋಜಿಸಿ"

---


### Tool 102: `get_offender_timeline` — Longitudinal Criminal Trajectory & Incarceration History
* **Exact Tool Name for GLM:** `get_offender_timeline`
* **Operational Purpose & Mission:** Construct the complete longitudinal criminal career of an offender: first juvenile infraction, adult arrests, prison sentences served, bail grants, and re-offence velocity.
* **When to Select this Tool (Disambiguation Rules for GLM):** Use when assessing chronic habitual offenders under Section 31 Karnataka Police Act.
* **Target Personas:** Detective Inspector, Prosecutor
* **Backend Data Sources & ZCQL Schemas:** AccusedMaster, CaseMaster ORDER BY CrimeRegisteredDate ASC
* **Visual Response Type & UI Card:** `offender_timeline`
* **Statutory Legal Grounding:** Life-Course Criminology & Recidivism Trajectory
* **Parameters Specification:**
```json
{
  "accused_name": {
    "type": "string",
    "description": "Accused name",
    "required": true
  }
}
```
* **Representative Officer Queries (Semantic Match Triggers):**
  * "Show criminal career timeline for accused Suresh"
  * "How has suspect's criminal trajectory evolved over 5 years?"
  * "ಆರೋಪಿಯ ಅಪರಾಧ ಜೀವನದ ಕಾಲಾನುಕ್ರಮ"

---


### Tool 103: `get_demographic_correlation` — Socio-Economic & Demographic Crime Correlation Indices
* **Exact Tool Name for GLM:** `get_demographic_correlation`
* **Operational Purpose & Mission:** Correlate local crime rates with socio-economic census factors: youth unemployment rates, literacy, rapid urbanization, migrant labor concentrations, and highway corridors.
* **When to Select this Tool (Disambiguation Rules for GLM):** Use for root-cause criminological analysis and social prevention planning.
* **Target Personas:** Policymakers, SCRB Director
* **Backend Data Sources & ZCQL Schemas:** CensusData, CaseMaster
* **Visual Response Type & UI Card:** `correlation`
* **Statutory Legal Grounding:** Social Disorganization Theory & Urban Criminology
* **Parameters Specification:**
```json
{
  "district": {
    "type": "string",
    "description": "District name",
    "required": true
  }
}
```
* **Representative Officer Queries (Semantic Match Triggers):**
  * "Show demographic crime correlation for Bengaluru Urban"
  * "Correlate unemployment and property theft in Mysuru"
  * "ಜನಸಂಖ್ಯಾ ಮತ್ತು ಸಾಮಾಜಿಕ-ಆರ್ಥಿಕ ಸಂಬಂಧಗಳು"

---


### Tool 104: `list_suspects_by_crime_type` — Specialized Suspect Roster by Criminal Vertical
* **Exact Tool Name for GLM:** `list_suspects_by_crime_type`
* **Operational Purpose & Mission:** Retrieve all historical suspects specialized in a specific crime category (e.g. safe-crackers, dacoits, chain snatchers, SIM swap cyber fraudsters, bullion fencers).
* **When to Select this Tool (Disambiguation Rules for GLM):** Use when investigating a specialized crime and compiling a suspect lineup.
* **Target Personas:** Anti-Theft Squad, Cyber Crime Wing
* **Backend Data Sources & ZCQL Schemas:** AccusedMaster JOIN CaseMaster ON CrimeMajorHeadID
* **Visual Response Type & UI Card:** `suspect_list`
* **Statutory Legal Grounding:** Criminal Specialty Classification Standards
* **Parameters Specification:**
```json
{
  "crime_type": {
    "type": "string",
    "description": "Crime category or head",
    "required": true
  },
  "district": {
    "type": "string",
    "description": "District filter",
    "required": false
  }
}
```
* **Representative Officer Queries (Semantic Match Triggers):**
  * "List suspects specialized in chain snatching in Bengaluru"
  * "Show known commercial burglary offenders"
  * "ಅಪರಾಧ ಪ್ರಕಾರದ ಪ್ರಕಾರ ಶಂಕಿತರ ಪಟ್ಟಿ"

---


### Tool 105: `list_cases` — Multi-Parameter CCTNS Case Ledger Filtering
* **Exact Tool Name for GLM:** `list_cases`
* **Operational Purpose & Mission:** Filter and retrieve CCTNS case records across multiple simultaneous parameters: year range, police station, crime stage, applied sections, and property value.
* **When to Select this Tool (Disambiguation Rules for GLM):** Use for targeted case retrieval when specific filters are given.
* **Target Personas:** Station Writer, Crime Branch
* **Backend Data Sources & ZCQL Schemas:** CaseMaster WHERE ...
* **Visual Response Type & UI Card:** `case_list`
* **Statutory Legal Grounding:** CCTNS General Query Interface
* **Parameters Specification:**
```json
{
  "district": {
    "type": "string",
    "description": "District filter",
    "required": false
  },
  "year": {
    "type": "integer",
    "description": "Year",
    "required": false
  },
  "status": {
    "type": "string",
    "description": "Investigation status",
    "required": false
  }
}
```
* **Representative Officer Queries (Semantic Match Triggers):**
  * "List theft cases registered in 2025 in Mysuru"
  * "Filter cases under investigation in Hebbal PS"
  * "ಪ್ರಕರಣಗಳನ್ನು ಫಿಲ್ಟರ್ ಮಾಡಿ"

---


### Tool 106: `search_by_identifier` — Targeted Statutory National Identifier Lookup
* **Exact Tool Name for GLM:** `search_by_identifier`
* **Operational Purpose & Mission:** Lookup criminal records by national statutory identifiers: Aadhaar number hash, PAN card, Voter ID (EPIC), Passport Number, or Karnataka Police KGID.
* **When to Select this Tool (Disambiguation Rules for GLM):** Use when establishing definitive biometric identity of a detained suspect.
* **Target Personas:** Special Branch, Court Liaison Officer
* **Backend Data Sources & ZCQL Schemas:** AccusedMaster WHERE IdentifierHash = ...
* **Visual Response Type & UI Card:** `accused_profile_card`
* **Statutory Legal Grounding:** Criminal Identification & Identity Verification Standard
* **Parameters Specification:**
```json
{
  "identifier_type": {
    "type": "string",
    "description": "aadhaar, pan, voter_id, passport",
    "required": true
  },
  "identifier_value": {
    "type": "string",
    "description": "Identifier number",
    "required": true
  }
}
```
* **Representative Officer Queries (Semantic Match Triggers):**
  * "Search suspect by PAN card ABCDE1234F"
  * "Lookup records for passport number"
  * "ಗುರುತಿನ ಚೀಟಿ ಮೂಲಕ ಹುಡುಕಿ"

---


### Tool 107: `list_wanted_accused` — Proclaimed Absconders & Section 84 BNSS Wanted Roster
* **Exact Tool Name for GLM:** `list_wanted_accused`
* **Operational Purpose & Mission:** List all active proclaimed offenders, declared absconders under Section 84 BNSS, and fugitives carrying court cash rewards across Karnataka State.
* **When to Select this Tool (Disambiguation Rules for GLM):** Use for periodic absconder apprehension drives.
* **Target Personas:** Warrant Execution Squad, Superintendent of Police
* **Backend Data Sources & ZCQL Schemas:** AccusedMaster WHERE IsProclaimedOffender = true
* **Visual Response Type & UI Card:** `wanted_list_card`
* **Statutory Legal Grounding:** Section 84 & 85 BNSS
* **Parameters Specification:**
```json
{
  "district": {
    "type": "string",
    "description": "District name",
    "required": false
  }
}
```
* **Representative Officer Queries (Semantic Match Triggers):**
  * "List wanted proclaimed offenders in Belagavi"
  * "Show absconding dacoits carrying rewards"
  * "ಘೋಷಿತ ಪರಾರಿ ಅಪರಾಧಿಗಳ ಪಟ್ಟಿ"

---


### Tool 108: `list_cases_by_status` — Case Ledger Grouped by Judicial Investigation Stage
* **Exact Tool Name for GLM:** `list_cases_by_status`
* **Operational Purpose & Mission:** Retrieve case records filtered strictly by their procedural stage: Under Investigation, Pending FSL, Chargesheeted, Under Trial, or Compounded.
* **When to Select this Tool (Disambiguation Rules for GLM):** Use to audit disposal backlogs across a subdivision.
* **Target Personas:** Sub-Divisional ACP, Public Prosecutor
* **Backend Data Sources & ZCQL Schemas:** CaseMaster WHERE CrimeStage = ...
* **Visual Response Type & UI Card:** `case_list`
* **Statutory Legal Grounding:** Section 193 BNSS
* **Parameters Specification:**
```json
{
  "status": {
    "type": "string",
    "description": "Investigation stage",
    "required": true
  }
}
```
* **Representative Officer Queries (Semantic Match Triggers):**
  * "List cases currently under investigation in Bengaluru"
  * "Show all chargesheeted cases in Mysuru"
  * "ಸ್ಥಿತಿವಾರು ಪ್ರಕರಣಗಳ ಪಟ್ಟಿ"

---


### Tool 109: `list_victims_by_category` — Victimology & Vulnerable Citizen Roster
* **Exact Tool Name for GLM:** `list_victims_by_category`
* **Operational Purpose & Mission:** Filter and analyze crime victim records by vulnerable demographics: senior citizens, women, children, scheduled castes/tribes, and migrant workers.
* **When to Select this Tool (Disambiguation Rules for GLM):** Use when planning citizen protection schemes and vulnerable witness safeguarding.
* **Target Personas:** Social Welfare Liaison, SJPU Inspector
* **Backend Data Sources & ZCQL Schemas:** VictimMaster, CaseMaster
* **Visual Response Type & UI Card:** `victim_list_card`
* **Statutory Legal Grounding:** Victimology & Section 398 BNSS (Witness & Victim Protection)
* **Parameters Specification:**
```json
{
  "category": {
    "type": "string",
    "description": "senior_citizen, woman, child, sc_st",
    "required": true
  }
}
```
* **Representative Officer Queries (Semantic Match Triggers):**
  * "List senior citizen crime victims this quarter"
  * "Show cases involving vulnerable child victims"
  * "ಸಂತ್ರಸ್ತರ ವರ್ಗೀಕೃತ ಪಟ್ಟಿ"

---


### Tool 110: `detect_crime_groups` — Algorithmic Discovery of Emergent Criminal Syndicates
* **Exact Tool Name for GLM:** `detect_crime_groups`
* **Operational Purpose & Mission:** Run graph community detection algorithms to automatically discover emergent criminal gangs based on dense shared co-accused edges, common getaway vehicles, and shared mobile IMEI hops.
* **When to Select this Tool (Disambiguation Rules for GLM):** Use to unmask previously unclassified criminal syndicates operating across station boundaries.
* **Target Personas:** Organized Crime Wing, State Intelligence Wing
* **Backend Data Sources & ZCQL Schemas:** VajraGraphRAG (Louvain Community Detection)
* **Visual Response Type & UI Card:** `crime_groups`
* **Statutory Legal Grounding:** Section 111 BNS & Criminological Syndicate Discovery
* **Parameters Specification:**
```json
{
  "district": {
    "type": "string",
    "description": "District or zone",
    "required": false
  }
}
```
* **Representative Officer Queries (Semantic Match Triggers):**
  * "Detect organized crime groups operating in Bengaluru"
  * "Discover emergent criminal syndicates in Belagavi"
  * "ಸಂಘಟಿತ ಅಪರಾಧ ಗ್ಯಾಂಗ್‌ಗಳನ್ನು ಪತ್ತೆಹಚ್ಚಿ"

---


### Tool 111: `get_case_types_distribution` — Categorical Crime Breakdown & Distribution Funnels
* **Exact Tool Name for GLM:** `get_case_types_distribution`
* **Operational Purpose & Mission:** Compute the exact percentage breakdown of registered cases across crime heads (Violent Crime, Property Theft, Cyber Crime, Narcotics, White-Collar Fraud).
* **When to Select this Tool (Disambiguation Rules for GLM):** Use when asking for 'crime breakdown', 'distribution of crimes', or 'what crimes happen most'.
* **Target Personas:** Superintendent of Police, SCRB Analyst
* **Backend Data Sources & ZCQL Schemas:** CaseMaster (GROUP BY CrimeMajorHeadID)
* **Visual Response Type & UI Card:** `case_distribution`
* **Statutory Legal Grounding:** CCTNS Statistical Categorization Standard
* **Parameters Specification:**
```json
{
  "district": {
    "type": "string",
    "description": "District or commissionerate",
    "required": true
  }
}
```
* **Representative Officer Queries (Semantic Match Triggers):**
  * "Show crime distribution in Bengaluru Urban"
  * "What are the most frequent crime types in Mysuru?"
  * "ಅಪರಾಧ ಪ್ರಕಾರಗಳ ಹಂಚಿಕೆ ತೋರಿಸಿ"

---


### Tool 112: `get_priority_concerns` — Executive Priority Concerns & High-Severity Threat Radar
* **Exact Tool Name for GLM:** `get_priority_concerns`
* **Operational Purpose & Mission:** Extract top high-severity crime categories exhibiting sharp positive acceleration or involving heinous violence, alerting leadership to critical intervention priorities.
* **When to Select this Tool (Disambiguation Rules for GLM):** Use by Police Chiefs and Home Department officials assessing top operational threats.
* **Target Personas:** Director General of Police, City Police Commissioner
* **Backend Data Sources & ZCQL Schemas:** CaseMaster, PriorityThreatMatrix
* **Visual Response Type & UI Card:** `priority_concerns`
* **Statutory Legal Grounding:** Strategic Policing Priority Guidelines
* **Parameters Specification:**
```json
{
  "district": {
    "type": "string",
    "description": "District name",
    "required": false
  }
}
```
* **Representative Officer Queries (Semantic Match Triggers):**
  * "What are top priority crime concerns in Karnataka?"
  * "Show high-severity threats in Bengaluru"
  * "ಪ್ರಮುಖ ಆದ್ಯತೆಯ ಅಪರಾಧ ಕಾಳಜಿಗಳು"

---


### Tool 113: `rank_districts` — Statewide District Safety & Crime Intensity Ranking
* **Exact Tool Name for GLM:** `rank_districts`
* **Operational Purpose & Mission:** Rank all 31 districts of Karnataka by crime volume per capita, disposal efficiency, and conviction rates, providing executive benchmark comparisons.
* **When to Select this Tool (Disambiguation Rules for GLM):** Use when comparing safety rankings across Karnataka districts.
* **Target Personas:** DGP State Police Headquarters, Legislative Assembly Liaison
* **Backend Data Sources & ZCQL Schemas:** District, CaseMaster (ZCQL Statewide Grouping)
* **Visual Response Type & UI Card:** `district_benchmark`
* **Statutory Legal Grounding:** State Police Performance Index
* **Parameters Specification:**
```json
{
  "metric": {
    "type": "string",
    "description": "Metric to rank by",
    "required": false
  }
}
```
* **Representative Officer Queries (Semantic Match Triggers):**
  * "Rank Karnataka districts by crime rate"
  * "Which district has highest conviction rate?"
  * "ಜಿಲ್ಲೆಗಳ ಶ್ರೇಯಾಂಕ ಪಟ್ಟಿ"

---


### Tool 114: `get_live_news` — Real-Time Law Enforcement & Breaking Crime News Feed
* **Exact Tool Name for GLM:** `get_live_news`
* **Operational Purpose & Mission:** Fetch breaking law enforcement news, highway blockade alerts, and public safety news from verified Karnataka news sources in real time.
* **When to Select this Tool (Disambiguation Rules for GLM):** Use to stay informed of breaking public order incidents occurring outside the police station.
* **Target Personas:** Control Room In-Charge, Media Liaison Officer
* **Backend Data Sources & ZCQL Schemas:** Live News RSS / Serper News API
* **Visual Response Type & UI Card:** `live_news_feed`
* **Statutory Legal Grounding:** Open-Source Intelligence Integration
* **Parameters Specification:**
```json
{
  "query": {
    "type": "string",
    "description": "News topic or location",
    "required": false,
    "default": "Karnataka police law order"
  }
}
```
* **Representative Officer Queries (Semantic Match Triggers):**
  * "Get live crime news for Bengaluru"
  * "Show latest breaking news on highway bandh"
  * "ಲೈವ್ ಅಪರಾಧ ಸುದ್ದಿ ತೋರಿಸಿ"

---


### Tool 115: `case_outcome_analytics` — Judicial Conviction, Acquittal & Trial Analytics
* **Exact Tool Name for GLM:** `case_outcome_analytics`
* **Operational Purpose & Mission:** Compute judicial trial outcomes: conviction rates, acquittal causes (hostile witnesses, defective evidence, delay), and compounding frequencies by court and judge.
* **When to Select this Tool (Disambiguation Rules for GLM):** Use by the Directorate of Prosecution evaluating case win-rates.
* **Target Personas:** Director of Public Prosecutions, Superintendent of Police
* **Backend Data Sources & ZCQL Schemas:** CourtOutcomes, CaseMaster
* **Visual Response Type & UI Card:** `case_funnel`
* **Statutory Legal Grounding:** National Judicial Data Grid & Criminal Justice Performance Index
* **Parameters Specification:**
```json
{
  "district": {
    "type": "string",
    "description": "District or court",
    "required": false
  }
}
```
* **Representative Officer Queries (Semantic Match Triggers):**
  * "Show conviction rate analytics for Mysuru courts"
  * "What are primary reasons for acquittals in robbery cases?"
  * "ಪ್ರಕರಣದ ಫಲಿತಾಂಶಗಳ ವಿಶ್ಲೇಷಣೆ"

---


### Tool 116: `get_unit_scorecards` — Police Station Operational Unit Scorecards
* **Exact Tool Name for GLM:** `get_unit_scorecards`
* **Operational Purpose & Mission:** Generate comparative operational efficiency scorecards for individual police stations: evaluates response times, chargesheet speed, warrant disposal, and public satisfaction.
* **When to Select this Tool (Disambiguation Rules for GLM):** Use for monthly police commissioner operational unit reviews.
* **Target Personas:** Police Commissioner, DCP Admin
* **Backend Data Sources & ZCQL Schemas:** UnitScorecards, UnitMaster
* **Visual Response Type & UI Card:** `unit_scorecards`
* **Statutory Legal Grounding:** KSP Station Governance Index
* **Parameters Specification:**
```json
{
  "district": {
    "type": "string",
    "description": "District or city zone",
    "required": true
  }
}
```
* **Representative Officer Queries (Semantic Match Triggers):**
  * "Show unit scorecards for all police stations in Bengaluru West"
  * "Compare station efficiency in Belagavi"
  * "ಠಾಣೆಗಳ ಸ್ಕೋರ್‌ಕಾರ್ಡ್ ತೋರಿಸಿ"

---


### Tool 117: `get_district_benchmark` — Cross-District Comparative Operational Benchmarking
* **Exact Tool Name for GLM:** `get_district_benchmark`
* **Operational Purpose & Mission:** Benchmark a specific police district against state averages across disposal velocity, officer caseload, violent crime containment, and digital evidence certification rate.
* **When to Select this Tool (Disambiguation Rules for GLM):** Use when identifying districts requiring departmental resources or supervision.
* **Target Personas:** Inspector General of Police (IGP), SCRB Director
* **Backend Data Sources & ZCQL Schemas:** DistrictBenchmarkEngine, CaseMaster
* **Visual Response Type & UI Card:** `district_benchmark`
* **Statutory Legal Grounding:** Comparative Criminology & Administrative Benchmarks
* **Parameters Specification:**
```json
{
  "district": {
    "type": "string",
    "description": "Target district name",
    "required": true
  }
}
```
* **Representative Officer Queries (Semantic Match Triggers):**
  * "Benchmark Belagavi against state crime average"
  * "Compare Mysuru operational metrics with statewide standard"
  * "ಜಿಲ್ಲಾ ಮಾನದಂಡ ಹೋಲಿಕೆ"

---


### Tool 118: `count_cases` — Statewide Dynamic Case Volume Aggregation (1.6M+ Scale)
* **Exact Tool Name for GLM:** `count_cases`
* **Operational Purpose & Mission:** Execute fast, database-side `COUNT(*)` queries across all 1.6M+ CCTNS records with dynamic filtering by crime head, year, station, or stage without loading rows into RAM.
* **When to Select this Tool (Disambiguation Rules for GLM):** Use when an officer asks 'how many cases', 'total crimes registered', 'count of thefts', or 'statewide case totals'.
* **Target Personas:** All Police Officers, SCRB Analyst
* **Backend Data Sources & ZCQL Schemas:** CaseMaster (`SELECT COUNT(*) FROM CaseMaster WHERE ...`)
* **Visual Response Type & UI Card:** `stat_number_card`
* **Statutory Legal Grounding:** Database-Side High-Throughput Aggregation
* **Parameters Specification:**
```json
{
  "district": {
    "type": "string",
    "description": "District filter",
    "required": false
  },
  "crime_type": {
    "type": "string",
    "description": "Crime category",
    "required": false
  },
  "year": {
    "type": "integer",
    "description": "Year",
    "required": false
  }
}
```
* **Representative Officer Queries (Semantic Match Triggers):**
  * "How many narcotics cases were registered in Karnataka?"
  * "Count total chain snatching cases in 2025"
  * "ಕರ್ನಾಟಕದಲ್ಲಿ ಒಟ್ಟು ಎಷ್ಟು ಪ್ರಕರಣಗಳು ದಾಖಲಾಗಿವೆ?"

---


### Tool 119: `shared_attribute_links` — Shared Address, Vehicle & Lawyer Attribute Cross-Links
* **Exact Tool Name for GLM:** `shared_attribute_links`
* **Operational Purpose & Mission:** Detect hidden links between suspects sharing the same residential address, defense advocate, bail surety, or registered two-wheeler.
* **When to Select this Tool (Disambiguation Rules for GLM):** Use when uncovering front companies and common legal syndicates defending habitual criminals.
* **Target Personas:** Detective Inspector, CID Intelligence
* **Backend Data Sources & ZCQL Schemas:** AccusedMaster, CaseMaster (Multi-Attribute Matching)
* **Visual Response Type & UI Card:** `network`
* **Statutory Legal Grounding:** Criminal Association Analysis
* **Parameters Specification:**
```json
{
  "accused_name": {
    "type": "string",
    "description": "Accused name",
    "required": true
  }
}
```
* **Representative Officer Queries (Semantic Match Triggers):**
  * "Find suspects sharing same bail surety as Ramesh"
  * "Check common vehicle registrations across accused"
  * "ಹಂಚಿಕೆಯ ಗುಣಲಕ್ಷಣಗಳ ಸಂಪರ್ಕಗಳನ್ನು ಹುಡುಕಿ"

---


### Tool 120: `community_detection` — Graph Louvain Modularity Syndicate Community Clustering
* **Exact Tool Name for GLM:** `community_detection`
* **Operational Purpose & Mission:** Apply Louvain community detection algorithms on the criminal graph to isolate distinct, self-contained sub-gangs and local cells operating within larger syndicates.
* **When to Select this Tool (Disambiguation Rules for GLM):** Use for intelligence containment strategies dismantling whole gangs at once.
* **Target Personas:** State Crime Records Bureau, CCB Gang Unit
* **Backend Data Sources & ZCQL Schemas:** VajraGraphRAG (Louvain Community Algorithm)
* **Visual Response Type & UI Card:** `network`
* **Statutory Legal Grounding:** Graph Theory & Network Partitioning
* **Parameters Specification:**
```json
{
  "district": {
    "type": "string",
    "description": "District filter",
    "required": false
  }
}
```
* **Representative Officer Queries (Semantic Match Triggers):**
  * "Run community detection on Bengaluru organized crime graph"
  * "Partition criminal networks into discrete gang clusters"
  * "ಅಪರಾಧ ಸಮುದಾಯ ಪತ್ತೆ"

---


### Tool 121: `centrality_ranking` — Betweenness & PageRank Kingpin Centrality Identification
* **Exact Tool Name for GLM:** `centrality_ranking`
* **Operational Purpose & Mission:** Compute Betweenness Centrality, Degree Centrality, and PageRank across criminal networks to mathematically identify the mastermind or kingpin who controls information and money flow.
* **When to Select this Tool (Disambiguation Rules for GLM):** Use to identify the true gang leader rather than disposable street operatives.
* **Target Personas:** Organized Crime Wing, State Intelligence Wing
* **Backend Data Sources & ZCQL Schemas:** VajraGraphRAG (NetworkX Centrality Engine)
* **Visual Response Type & UI Card:** `centrality_ranking_card`
* **Statutory Legal Grounding:** Network Centrality in Criminological Analysis
* **Parameters Specification:**
```json
{
  "network_id": {
    "type": "string",
    "description": "Network or syndicate identifier",
    "required": true
  }
}
```
* **Representative Officer Queries (Semantic Match Triggers):**
  * "Who has highest centrality ranking in Kalappa Gang?"
  * "Identify kingpin using PageRank on criminal graph"
  * "ಕೇಂದ್ರೀಯತೆ ಶ್ರೇಯಾಂಕದ ಮೂಲಕ ಕಿಂಗ್‌ಪಿನ್ ಗುರುತಿಸಿ"

---


### Tool 122: `anomaly_detection` — Graph Outlier & Structural Inconsistency Detection
* **Exact Tool Name for GLM:** `anomaly_detection`
* **Operational Purpose & Mission:** Identify abnormal graph structures: bridge nodes connecting two completely separate crime families, or unexpected financial transactions across disparate crime heads.
* **When to Select this Tool (Disambiguation Rules for GLM):** Use to discover covert intermediaries or mole networks.
* **Target Personas:** Internal Vigilance, Intelligence Wing
* **Backend Data Sources & ZCQL Schemas:** VajraGraphRAG (Graph Outlier Isolation)
* **Visual Response Type & UI Card:** `anomaly_card`
* **Statutory Legal Grounding:** Graph Anomaly Detection Standards
* **Parameters Specification:**
```json
{
  "district": {
    "type": "string",
    "description": "District name",
    "required": false
  }
}
```
* **Representative Officer Queries (Semantic Match Triggers):**
  * "Detect anomalous connections in organized crime graph"
  * "Find bridge nodes between narcotics and extortion syndicates"
  * "ಗ್ರಾಫ್ ಅಸಂಗತತೆಗಳನ್ನು ಪತ್ತೆಹಚ್ಚಿ"

---


### Tool 123: `detect_case_anomalies` — Factual Contradiction & Procedural Delay Anomaly Detector
* **Exact Tool Name for GLM:** `detect_case_anomalies`
* **Operational Purpose & Mission:** Scan FIR facts and case diary logs for procedural anomalies: delays exceeding 48 hours in FIR transmission to Magistrate (§173(2) BNSS), discrepancies between medical report and FIR injuries, or missing recovery panchanamas.
* **When to Select this Tool (Disambiguation Rules for GLM):** Use during supervisory audits to prevent case dismissal in court.
* **Target Personas:** Supervisory DySP, Public Prosecutor
* **Backend Data Sources & ZCQL Schemas:** CaseMaster, MedicalReports, CaseDiary
* **Visual Response Type & UI Card:** `case_anomalies_card`
* **Statutory Legal Grounding:** Section 173 & 193 BNSS Procedural Verification
* **Parameters Specification:**
```json
{
  "case_no": {
    "type": "string",
    "description": "Case number",
    "required": true
  }
}
```
* **Representative Officer Queries (Semantic Match Triggers):**
  * "Detect case anomalies in CR-2026-46092"
  * "Check evidentiary contradictions in case 104"
  * "ಪ್ರಕರಣದ ಅಸಂಗತತೆಗಳನ್ನು ಪತ್ತೆಹಚ್ಚಿ"

---


### Tool 124: `summarize_url` — External Webpage & Digital News Document Summarizer
* **Exact Tool Name for GLM:** `summarize_url`
* **Operational Purpose & Mission:** Fetch external news links, legal court order URLs, or official bulletins and generate structured, concise intelligence summaries for investigative files.
* **When to Select this Tool (Disambiguation Rules for GLM):** Use when an officer pastes a web link or High Court judgment URL and asks for its key points.
* **Target Personas:** All Officers, Legal Advisor
* **Backend Data Sources & ZCQL Schemas:** HTTP Fetcher, BeautifulSoup / TextRank Summarizer
* **Visual Response Type & UI Card:** `url_summary_card`
* **Statutory Legal Grounding:** Open-Source Intelligence Verification
* **Parameters Specification:**
```json
{
  "url": {
    "type": "string",
    "description": "Webpage or document URL",
    "required": true
  }
}
```
* **Representative Officer Queries (Semantic Match Triggers):**
  * "Summarize this news report link on gold heist"
  * "Extract key facts from High Court judgment URL"
  * "ವೆಬ್‌ಪುಟದ ಸಾರಾಂಶ ನೀಡಿ"

---


### Tool 125: `analyze_online_abuse` — Social Media Toxicity, Threat & Cyber Harassment Analyzer
* **Exact Tool Name for GLM:** `analyze_online_abuse`
* **Operational Purpose & Mission:** Analyze threatening social media posts, abusive WhatsApp text logs, or stalking messages to compute legal toxicity severity, detect extortion threats, and recommend Section 79 BNS / 66E IT Act charges.
* **When to Select this Tool (Disambiguation Rules for GLM):** Use when investigating cyber stalking, extortion, or communal hate speech.
* **Target Personas:** Cyber Crime Police (CEN), Women Safety Cell
* **Backend Data Sources & ZCQL Schemas:** NLP Threat Classifier, BNS Engine
* **Visual Response Type & UI Card:** `threat_analysis_card`
* **Statutory Legal Grounding:** Section 79 BNS (Word, gesture or act intended to insult modesty) & IT Act §66E
* **Parameters Specification:**
```json
{
  "text": {
    "type": "string",
    "description": "Abusive text message or social media post",
    "required": true
  }
}
```
* **Representative Officer Queries (Semantic Match Triggers):**
  * "Analyze threatening WhatsApp message: 'give 10 lakh or face consequences'"
  * "Evaluate online abuse text for statutory cyber charges"
  * "ಆನ್‌ಲೈನ್ ಬೆದರಿಕೆ ಸಂದೇಶವನ್ನು ವಿಶ್ಲೇಷಿಸಿ"

---


### Tool 126: `get_database_overview` — Master CCTNS Database Health, Shard & Table Telemetry
* **Exact Tool Name for GLM:** `get_database_overview`
* **Operational Purpose & Mission:** Provide complete real-time system health of the CCTNS database: total records across all tables (CaseMaster, Accused, FIR, Unit, District), active ZCQL latency, and replication status.
* **When to Select this Tool (Disambiguation Rules for GLM):** Use to verify database connectivity and state-wide record totals.
* **Target Personas:** System Administrator, Police Command Leadership
* **Backend Data Sources & ZCQL Schemas:** Catalyst Datastore Telemetry (ZCQL Table Counts)
* **Visual Response Type & UI Card:** `database_overview_card`
* **Statutory Legal Grounding:** CCTNS System Infrastructure & Diagnostic Guidelines
* **Parameters Specification:**
*None (Takes no input arguments).*
* **Representative Officer Queries (Semantic Match Triggers):**
  * "Check database health and overview"
  * "How many total records are stored in CCTNS datastore?"
  * "ದತ್ತಸಂಚಯ ಸ್ಥಿತಿ ಮತ್ತು ಅವಲೋಕನ"

---


### Tool 127: `generate_full_report` — Judicial High Court & Sessions Trial Investigation Report Export
* **Exact Tool Name for GLM:** `generate_full_report`
* **Operational Purpose & Mission:** Compile and export a court-certified, High Court-formatted complete investigation report: incorporates FIR facts, seizure lists, FSL expert certificates, witness statements, and cryptographic Section 63 BSA validation.
* **When to Select this Tool (Disambiguation Rules for GLM):** Use when submitting the formal police report to the High Court or Sessions Judge.
* **Target Personas:** Investigating Officer, Public Prosecutor
* **Backend Data Sources & ZCQL Schemas:** PDF Export Engine, CaseMaster, Accused, CaseDiary
* **Visual Response Type & UI Card:** `report_export_card`
* **Statutory Legal Grounding:** Section 193 BNSS (Final Form Report to Magistrate)
* **Parameters Specification:**
```json
{
  "case_no": {
    "type": "string",
    "description": "Case number",
    "required": true
  }
}
```
* **Representative Officer Queries (Semantic Match Triggers):**
  * "Generate full High Court report for CR-2026-46092"
  * "Export complete court dossier for case 104"
  * "ನ್ಯಾಯಾಲಯದ ಪೂರ್ಣ ವರದಿ ರಫ್ತು ಮಾಡಿ"

---


### Tool 128: `generate_crime_overview` — Executive Strategic Crime Landscape & Command Briefing
* **Exact Tool Name for GLM:** `generate_crime_overview`
* **Operational Purpose & Mission:** Produce an executive crime landscape briefing across a district or commissionerate: highlights major criminal syndicates, rising crime categories, fatal accident trends, and pending judicial inquests.
* **When to Select this Tool (Disambiguation Rules for GLM):** Use for high-level command meetings with the Home Minister or Chief Secretary.
* **Target Personas:** Director General of Police, Superintendent of Police
* **Backend Data Sources & ZCQL Schemas:** CaseMaster, District, Unit (Executive Synthesis)
* **Visual Response Type & UI Card:** `crime_overview_card`
* **Statutory Legal Grounding:** State Police Strategic Command Doctrine
* **Parameters Specification:**
```json
{
  "district": {
    "type": "string",
    "description": "District name",
    "required": true
  }
}
```
* **Representative Officer Queries (Semantic Match Triggers):**
  * "Generate executive crime overview for Belagavi District"
  * "Provide strategic crime landscape of Bengaluru City"
  * "ಕಾರ್ಯನಿರ್ವಾಹಕ ಅಪರಾಧ ಅವಲೋಕನ"

---


### Tool 129: `plan_patrol_deployment` — Predictive Patrol Force Allocation & Manpower Shift Planner
* **Exact Tool Name for GLM:** `plan_patrol_deployment`
* **Operational Purpose & Mission:** Calculate optimal allocation of patrol vehicles, check-posts, and beat personnel across police station sectors based on predictive crime risk forecasts and historical hotspot densities.
* **When to Select this Tool (Disambiguation Rules for GLM):** Use by station commanders planning weekly duty rosters.
* **Target Personas:** Station House Officer, Law & Order ACP
* **Backend Data Sources & ZCQL Schemas:** Coordinates, CaseMaster, PatrolShiftOptimizer
* **Visual Response Type & UI Card:** `patrol_plan_card`
* **Statutory Legal Grounding:** Routine Activity Theory & Preventive Police Manpower Allocation
* **Parameters Specification:**
```json
{
  "station_id": {
    "type": "string",
    "description": "Police Station ID",
    "required": true
  }
}
```
* **Representative Officer Queries (Semantic Match Triggers):**
  * "Plan patrol deployment for Jayanagar Police Station"
  * "Allocate night patrol units based on risk forecasts"
  * "ಗಸ್ತು ನಿಯೋಜನಾ ಯೋಜನೆ"

---


### Tool 130: `send_investigation_email` — Automated Official Police Intimation & Alert Dispatcher
* **Exact Tool Name for GLM:** `send_investigation_email`
* **Operational Purpose & Mission:** Dispatch encrypted official email notifications, legal notices, or supervisory briefings directly to registered police station email addresses or bank nodal officers under Section 106 BNSS.
* **When to Select this Tool (Disambiguation Rules for GLM):** Use to issue official freeze letters to banks or dispatch case dockets to superior officers.
* **Target Personas:** Investigating Officer, Cyber Crime Nodal Officer
* **Backend Data Sources & ZCQL Schemas:** Catalyst Mail API, Official Police Domain
* **Visual Response Type & UI Card:** `email_dispatch_card`
* **Statutory Legal Grounding:** Official Police Electronic Communication Protocol
* **Parameters Specification:**
```json
{
  "recipient": {
    "type": "string",
    "description": "Recipient email address",
    "required": true
  },
  "subject": {
    "type": "string",
    "description": "Email subject",
    "required": true
  },
  "body": {
    "type": "string",
    "description": "Email message content",
    "required": true
  }
}
```
* **Representative Officer Queries (Semantic Match Triggers):**
  * "Send official freeze notice email to bank manager for account 123456"
  * "Email case briefing to SP office"
  * "ಅಧಿಕೃತ ಇಮೇಲ್ ಕಳುಹಿಸಿ"

---


### Tool 131: `resolve_ifsc` — Bank Branch & IFSC Routing Directory Lookup
* **Exact Tool Name for GLM:** `resolve_ifsc`
* **Operational Purpose & Mission:** Lookup bank branch details, physical branch address, district, state, and designated nodal contact from an Indian Financial System Code (IFSC) to route statutory freeze notices.
* **When to Select this Tool (Disambiguation Rules for GLM):** Use in cyber fraud investigations to identify where fraudulent funds were deposited.
* **Target Personas:** Cyber Crime Investigator, Financial Forensics Unit
* **Backend Data Sources & ZCQL Schemas:** IFSC Bank Directory API
* **Visual Response Type & UI Card:** `ifsc_card`
* **Statutory Legal Grounding:** Section 106 BNSS (Bank Account Freeze Mandates)
* **Parameters Specification:**
```json
{
  "ifsc_code": {
    "type": "string",
    "description": "11-character IFSC code (e.g. 'SBIN0000813')",
    "required": true
  }
}
```
* **Representative Officer Queries (Semantic Match Triggers):**
  * "Resolve bank branch for IFSC SBIN0000813"
  * "Which bank branch belongs to IFSC HDFC0001234?"
  * "ಐಎಫ್‌ಎಸ್‌ಸಿ ಕೋಡ್ ಮೂಲಕ ಬ್ಯಾಂಕ್ ಶಾಖೆ ಹುಡುಕಿ"

---


### Tool 132: `resolve_rto_plate` — National RTO Vehicle Registration & Ownership Verification
* **Exact Tool Name for GLM:** `resolve_rto_plate`
* **Operational Purpose & Mission:** Query national RTO databases for vehicle registration plates: owner name, vehicle make and model, chassis and engine number, insurance validity, and registration date.
* **When to Select this Tool (Disambiguation Rules for GLM):** Use when checking suspicious vehicles intercepted on highway nakabandis or getaway bikes.
* **Target Personas:** Beat Constable on Patrol, Investigating Officer
* **Backend Data Sources & ZCQL Schemas:** RTO Vahan Directory API
* **Visual Response Type & UI Card:** `rto_vehicle_card`
* **Statutory Legal Grounding:** Motor Vehicles Act 1988 & Section 106 BNSS
* **Parameters Specification:**
```json
{
  "plate_number": {
    "type": "string",
    "description": "Vehicle registration plate (e.g. 'KA-04-MB-1234')",
    "required": true
  }
}
```
* **Representative Officer Queries (Semantic Match Triggers):**
  * "Lookup vehicle registration plate KA-04-MB-1234"
  * "Who is the owner of getaway bike KA-01-EE-4567?"
  * "ವಾಹನ ನೋಂದಣಿ ಸಂಖ್ಯೆ ತಪಾಸಣೆ"

---


### Tool 133: `lookup_whois_ip` — Cyber IP Geolocation, ASN & WHOIS Intelligence
* **Exact Tool Name for GLM:** `lookup_whois_ip`
* **Operational Purpose & Mission:** Perform WHOIS registry lookups and geographic IP geolocation: resolves hosting provider, Autonomous System Number (ASN), country, city, and abuse contact.
* **When to Select this Tool (Disambiguation Rules for GLM):** Use during cyber phishing, mule portal, or darknet IP investigations.
* **Target Personas:** Cyber Crime Specialist, Tech Cell
* **Backend Data Sources & ZCQL Schemas:** WHOIS / IP Geolocation API
* **Visual Response Type & UI Card:** `whois_ip_card`
* **Statutory Legal Grounding:** Information Technology Act 2000 (Cyber Traceability)
* **Parameters Specification:**
```json
{
  "ip_or_domain": {
    "type": "string",
    "description": "IP address or domain name (e.g. '103.21.244.0' or 'fake-ksp.in')",
    "required": true
  }
}
```
* **Representative Officer Queries (Semantic Match Triggers):**
  * "Lookup IP address 103.21.244.15 for cyber fraud source"
  * "Check WHOIS registration for phishing website fake-ksp.in"
  * "ಐಪಿ ವಿಳಾಸ ಮತ್ತು ಡೊಮೇನ್ ತನಿಖೆ"

---


### Tool 134: `scan_viral_social_threats` — Social Media Viral Threat & Public Unrest Radar
* **Exact Tool Name for GLM:** `scan_viral_social_threats`
* **Operational Purpose & Mission:** Monitor public social media signals and trending hashtags to detect viral rumors, communal misinformation spikes, and emerging law-and-order flashpoints.
* **When to Select this Tool (Disambiguation Rules for GLM):** Use for proactive public order intelligence before protests or unrest materialize.
* **Target Personas:** Social Media Monitoring Cell, Intelligence Special Branch
* **Backend Data Sources & ZCQL Schemas:** viral_trend_radar.py, Public Social Feeds
* **Visual Response Type & UI Card:** `viral_threat_card`
* **Statutory Legal Grounding:** Section 189 & 192 BNS (Provocation with Intent to Cause Riot)
* **Parameters Specification:**
```json
{
  "keywords_or_area": {
    "type": "string",
    "description": "Location or trending phrase",
    "required": true
  }
}
```
* **Representative Officer Queries (Semantic Match Triggers):**
  * "Scan social media for viral unrest threats in Belagavi"
  * "Check viral rumors regarding highway blockade"
  * "ಸಾಮಾಜಿಕ ಮಾಧ್ಯಮ ವೈರಲ್ ಬೆದರಿಕೆಗಳನ್ನು ಸ್ಕ್ಯಾನ್ ಮಾಡಿ"

---
