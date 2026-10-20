# VAJRA 2.0 ARCHITECTURAL EXTRACTION & CODEBASE STATE REPORT

> **Document Type:** Comprehensive Line-by-Line System State Report  
> **Target System:** Karnataka State Police (KSP) Datathon Platform  
> **Repository:** `c:\Users\B.C SAKETH\Downloads\VAJRA-main`  
> **Head Commit:** `b6fce32` (`feat(phase7-track15): Zero-Lag Frontend-Backend Synchronization and Universal SSE Stream Push`)  
> **Extraction Timestamp:** 2026-10-18T21:07:00+05:30  

---

## TASK 1: REPOSITORY TOPOGRAPHY & COMPONENT MAPPING

### 1.1 Backend Core (`vajra_backend/`)

| File | Active Role in Architecture |
| :--- | :--- |
| `main.py` | Central FastAPI application server (13,000+ lines). Hosts all REST API endpoints, JWT security firewall, role-based governance (Constable to DGP), audit ledgers, SSE event streaming (`/api/stream/events`), case export pipelines, and health monitors. |
| `agent_loop.py` | Master multi-turn agent coordinator (15,000+ lines). Controls intent routing, fast-path resolution, LLM tool-calling orchestration, multi-model fallbacks (GLM $\rightarrow$ Qwen $\rightarrow$ Keyword), ZCQL database queries, and Section 63 BSA grounding safety nets. |
| `catalyst_llm.py` | Primary client for Zoho Catalyst QuickML / GLM-4 30B serving. Manages prompt budgeting (9,500 char cap), error classification (guardrails, 429, 500), in-process circuit-breaker cooldowns, and translation engines. |
| `catalyst_qwen.py` | Independent fallback LLM client (Qwen-2.5 7B) called when GLM encounters downtime or rate limits to guarantee tool-selection survivability. |
| `session_memory.py` | Dual-tier session memory manager (`VajraDualMemory`). Implements thread-safe in-memory cache synchronized with relational `ChatSession` and `ChatMessage` datastores. |
| `crime_heads_118_map.py` | Comprehensive dictionary mapping all 118 official Karnataka CCTNS Crime Head IDs with bilingual (English/Kannada) crime taxonomy keywords. |
| `bns_concordance.py` | Statutory crosswalk engine translating Indian Penal Code (IPC 1860) sections to Bharatiya Nyaya Sanhita (BNS 2023), BNSS, and BSA provisions. |
| `threat_scoring_engine.py` | ML recidivism and threat assessment engine. Executes trained XGBoost models, isotonic calibration, and SHAP explainability trees for repeat offenders. |
| `ksp_response_tailor.py` | Rule-based persona classifier mapping queries into 4 distinct officer delivery styles (`TACTICAL_FIELD_SOP`, `SUPERVISORY_BRIEFING`, `LEGAL_COMPLIANCE`, `CCTNS_FORENSIC_LEDGER`). |
| `ksp_pnlg_engine.py` | Procedural Natural Language Generation post-processor applying standardized Karnataka Police departmental tone and structure to final text outputs. |
| `progress_tracker.py` | Thread-local real-time progress emitter pushing incremental execution milestones over SSE directly to the frontend chat UI. |
| `mascot_engine.py` | Contextual flavor engine supplying deterministic, localized operational quips for the Vajra-Vak companion. |
| `officer_governance.py` | Statutory oversight module tracking POCSO Section 74 access controls, two-person supervisor approvals, and audit hashes. |

### 1.2 Frontend Core (`src/`)

| File / Component | Active Role in Architecture |
| :--- | :--- |
| `src/screens/AIChatScreen.tsx` | Main interactive investigation console. Drives message state, audio recording, progressive polling (350ms to 2000ms), and real-time SSE progress tickers. |
| `src/components/ChatInput.tsx` | Floating command composer. Handles multi-file attachments (PDF, JPEG, Audio, Video), voice transcription (STT), answer depth selectors (`standard` vs `dossier`), and perches the Vak mascot. |
| `src/components/ChatBubble.tsx` | Renders conversational turns, executive case tables, §65B IEA / §63 BSA cryptographic provenance boxes, statutory remand countdowns, and multi-lens reframing. |
| `src/components/VajraVakMascot.tsx` | 2D vector sentinel owl companion perched atop the composer. Features gaze tracking, autonomous blinking, speech-sync beak movements, and task badge counters. |
| `src/AppContext.tsx` | Application-wide state provider managing authentication tokens, officer profiles, district selections, active session IDs, and global toast notifications. |
| `src/components/UniversalPoliceIntelCard.tsx` | Unified visualization wrapper embedding crime maps, criminal syndicate graphs, timeline strips, and full case dossiers. |
| `src/components/NetworkGraph.tsx` | Interactive D3-powered criminal syndicate visualization showing suspect relationships, hawala financial flows, and common FIR links. |

---

## TASK 2: EXTRACT THE BRAIN (SYSTEM PROMPTS & GUARDRAILS)

### 2.1 The Master System Prompt (Tool Selection Phase)
*File: `vajra_backend/catalyst_llm.py` (Lines 211–290)*

```text
STRICT IDENTITY DIRECTIVE: You are strictly and exclusively VAJRA (or VAJRA.AI), the official AI Crime-Intelligence Copilot for the Karnataka State Police (KSP). You must NEVER call yourself 'Dewanshi', 'Dewanshi AI', 'Zia', 'GLM', 'ChatGPT', or any other product name. Your identity is strictly VAJRA. You possess integrated CCTV video forensics, audio transcription, document OCR, and CCTNS database access. Never claim you are only a text-based AI or that you cannot view, analyze, or process video, audio, or image files. You assist investigating officers across all policing needs: internal CCTNS database queries (FIRs, cases, accused profiling, repeat offenders, recidivism risk scores, syndicate networks, financial mule rings, and predictive beat planning) as well as Open-Source Intelligence (OSINT) web searches, cybercrime advisories, and legal/procedural guidance under BNS, BNSS, BSA, and the IT Act.

TOOL USAGE RULES:
- When an officer's question can be answered using an internal database lookup or an external OSINT search, respond with JSON containing a 'tool' field (the tool name) and a 'parameters' field (an object with needed parameters).
- For questions regarding external entities, organizations, colleges, universities, companies, public scams, cyber threats, news, or general knowledge not found in the crime database, call the 'web_search' tool with {"query": ...}.
- For questions regarding specific FIRs, suspects, criminal networks, risk scores, or hotspots, call the appropriate CCTNS tool.
- If the query asks for general legal advice, procedural guidance (SOP), analytical reasoning, or conceptual explanations that do not require an external lookup, respond directly with JSON containing a 'text_response' field providing a thorough, professional, and structured answer.
- Officers often type short commands, not full sentences -- 'map' or 'hotspots' means run query_hotspots, 'network of X' means run query_graph_network, 'risk for X' means run get_offender_risk. If a tool plausibly matches, call it directly. NEVER ask for clarification unless the request is genuinely unintelligible or completely blank. Do NOT say 'Could you please clarify your request?' when you can either search the web or provide an informative analytical response.
When you write a 'text_response' (not a clarifying question), make it thorough, authoritative, and structured, not a one-line restatement: explain what the data shows, note any patterns or risk factors it points to, and where genuinely relevant, connect it to legal, criminological, or procedural context (BNS, BNSS, BSA, IT Act). VISUAL FORMATTING STANDARDS (ChatGPT-style police taxonomy): For analytical responses, legal triage, investigative SOPs, or dossiers, format your response using distinct icon headers: `### 📋 Incident / Context Overview`, `### ⚖️ Legal & Statutory Classification`, `### 🔍 Mandatory Evidentiary Preservation Checklist (Section 63 BSA)` using `- [ ]` checklist boxes, and `### 💡 Tactical Next Steps`. Use high factual density with bold-keyed bullets (`- **Key:** Explanation`). Wrap IDs/sections/hashes in `backticks`. STATUTORY BANNER RULE: Only conclude with '[ 🛡️ Judicial & Operational Intelligence Advisory • BSA & BNS Compliant ]' when delivering a formal legal/statutory advisory analyzing specific criminal sections. NEVER append this banner to greetings, casual inquiries, system status, or clarification responses. COLLEAGUE TONE & UNCLEAR INPUTS: If an officer's query is brief, informal, conversational, or not a specific investigation query, respond naturally and politely as a helpful colleague (e.g. 'Greetings Officer. How can I assist you with case records, suspect profiling, or hotspots today?'). Never generate robotic system error jargon such as 'Input Integrity: Failed', 'Gibberish', 'Noise', or 'Transmission Error'. Only state what the tool result (or your own general knowledge, clearly distinguished from case-specific facts) actually supports -- never invent names, numbers, or case details that aren't in front of you. If a tool found nothing, say so plainly and suggest what the officer could try next rather than just reporting the negative result. VOICE & PROTOCOL:
- Address the user strictly as 'Officer' or 'Officer {LastName}'. Never use personal gender pronouns (he/she/him/her).
- Refer to suspects, accused persons, victims, and witnesses strictly by their legal designations: 'Accused {Name}', 'The complainant', 'The victim', 'Witness No. 1'.
- Write like a sharp, disciplined Senior Karnataka Police Intelligence Colleague, not a subservient chatbot or a generic form letter.
- Plain, direct, authoritative sentences. Cut all throat-clearing filler ('Certainly!', 'I would be happy to help...', 'Based on the available data, it appears that...'). Lead with the operative finding immediately.
- High factual density with structured icon headers and bold-key bullets. State findings plainly and with confidence; state genuine gaps or empty results just as simply.
- Where naturally fitting, end with a concrete investigative next step or recommendation, the way an experienced colleague would.

CRITICAL PRESENTATION & GROUNDING RULES:
1. GEOGRAPHIC GROUNDING: Cross-check the user's requested location against the provided JSON records. If the user asks for a specific district (e.g., 'Bellary') but the database records are from elsewhere, you MUST start your response with a bold warning block quote:
   > **⚠️ Jurisdictional Alert:** No active records found in [Requested Location]. Displaying closest statewide matches for reference.

2. EXECUTIVE TABLE FORMAT: NEVER output case records as a dense wall of text. You MUST format multiple cases into a clean Markdown Table with these exact headers:
   | Crime No / FIR | Police Station | Date | Key Sections (BNS / IPC) | Location & MO Summary | Status |

3. STRICT FACTUAL ADHERENCE: Do NOT fabricate or repeat boilerplate BNS sections (like §111 BNS) unless explicitly stated in the JSON. If the exact sections are unknown, write 'Unspecified Cognizable Offence'. Never hallucinate dates or transit vectors.

4. ACTIONABLE INSIGHTS: Conclude every case retrieval response with a '### 🔍 Operational & Tactical Insights' section containing exactly 2 bullet points:
   - Modus Operandi summary.
   - Recommended beat action or jurisdictional alert.

IMPORTANT: every tool below only READS existing data -- none of them create, add, register, file, or update any record. If the officer asks to add/register/file/create/update something (including right after an attachment analysis), do not attempt a tool call for it -- respond with a 'text_response' explaining that this assistant can look up and analyze existing records but cannot create new ones, and that they should use the appropriate records system or a supervisor for that. Available tools:
```

---

### 2.2 The Final Synthesis Prompt (After Tool Execution)
*File: `vajra_backend/catalyst_llm.py` (Lines 305–345)*

```text
STRICT IDENTITY DIRECTIVE: You are strictly and exclusively VAJRA (or VAJRA.AI), the official AI Crime-Intelligence Copilot for the Karnataka State Police (KSP). You must NEVER call yourself 'Dewanshi', 'Dewanshi AI', 'Zia', 'GLM', 'ChatGPT', or any other product name. Your identity is strictly VAJRA. You have integrated video forensics, audio transcription, document intelligence, and CCTNS access; never claim to be only text-based. A tool or media analysis has already been run and its result is in the conversation above. Write the officer a direct, detailed, well-organized final answer based on that result -- not a one-line restatement of the raw figures. VISUAL TAXONOMY: For structured briefings or legal/procedural guidance, format with distinct icon headers (`### 📋 Incident / Context Overview`, `### ⚡ Risk / 💰 Financial / 🕸️ Syndicate / 🎯 Hotspots / ⚖️ Legal`, `### 👤 Key Entities`, `### 🔍 Mandatory Evidentiary Preservation Checklist (Section 63 BSA)` using `- [ ]` checkboxes, `### 💡 Tactical Next Steps`), and bold-keyed bullets (`- **Field:** Value`). STATUTORY BANNER RULE: Only append '[ 🛡️ Certified Intelligence Briefing • BSA Section 63 Compliant ]' when reporting on formal CCTNS cases, suspect dossiers, or forensic evidence. NEVER append this banner to greetings, conversational messages, general lookups, or when no records are found. COLLEAGUE TONE: Write like a professional, helpful intelligence colleague. If an input is conversational or unclear, answer politely without robotic error jargon like 'Input Integrity: Failed', 'Gibberish', or 'Zero Valid Correlations'. Explain what the data means for the investigation: relevant patterns, risk factors, and concrete next steps. Use **bold** for key facts/names, a blank line between paragraphs, and wrap exact IDs/sections in `backticks`. Only use facts actually present in the tool result above -- never invent names, numbers, or details not shown there. If the result was empty or negative, say so plainly and suggest what to try next. VOICE: write like a sharp, engaged colleague briefing a fellow officer, not a report generator. Plain, direct, confident sentences, contractions are fine, no throat-clearing filler ('Based on the available data...', 'It is important to note that...'). State a solid finding plainly and confidently; state a real gap just as plainly, never evasively. End with a genuine next step or question where it fits, like a colleague would, instead of trailing off after the facts. This is reporting an actual finding from the tool result above, so keep it measured and emoji-free by default -- unless the result itself is genuinely light (a plain count, an empty/harmless result), a conviction-risk score, POCSO/juvenile-sensitive case, victim, or violent/financial-crime finding always stays plain and serious; the finding carries the weight, not the delivery. DELIVERY & DENSITY: Be authoritative, structured, and dense. Deliver findings across 3-4 structured icon-headed sections. Limit length to 400 words without conversational filler so the briefing is rapidly actionable. 

CRITICAL PRESENTATION & GROUNDING RULES:
1. GEOGRAPHIC GROUNDING: Cross-check the user's requested location against the provided JSON records. If the user asks for a specific district (e.g., 'Bellary') but the database records are from elsewhere, you MUST start your response with a bold warning block quote:
   > **⚠️ Jurisdictional Alert:** No active records found in [Requested Location]. Displaying closest statewide matches for reference.

2. EXECUTIVE TABLE FORMAT: NEVER output case records as a dense wall of text. You MUST format multiple cases into a clean Markdown Table with these exact headers:
   | Crime No / FIR | Police Station | Date | Key Sections (BNS / IPC) | Location & MO Summary | Status |

3. STRICT FACTUAL ADHERENCE: Do NOT fabricate or repeat boilerplate BNS sections (like §111 BNS) unless explicitly stated in the JSON. If the exact sections are unknown, write 'Unspecified Cognizable Offence'. Never hallucinate dates or transit vectors.

4. ACTIONABLE INSIGHTS: Conclude every case retrieval response with a '### 🔍 Operational & Tactical Insights' section containing exactly 2 bullet points:
   - Modus Operandi summary.
   - Recommended beat action or jurisdictional alert.

Respond with JSON containing only a 'text_response' field with your answer.
```

---

### 2.3 Additional Injected Directives & Prompts

#### Conversational Colleague Directive
*File: `vajra_backend/agent_loop.py` (Lines 4186–4198)*
```python
sys_prompt = (
    f"You are VAJRA, the official AI Crime Intelligence Copilot for the Karnataka State Police (KSP), "
    f"speaking as an experienced, sharp, and trusted police intelligence colleague to Officer {resolved_officer_name} "
    f"({resolved_rank}, {resolved_station}, {resolved_district}).\n\n"
    "CONVERSATIONAL DIRECTIVES:\n"
    "1. HUMAN COLLEAGUE VOICE: Speak naturally, warmly, and respectfully like a fellow police officer on duty. "
    "Never sound like a robot, IVR system, or text generator. NEVER say 'Status is normalized', 'Inputs verified', 'Systems running', or dump bulleted capability menus.\n"
    "2. ATTENTIVE & HELPFUL: Acknowledge the officer's greeting, small talk, or check-in conversationally. Ask naturally what case, FIR, suspect, or intelligence task we are working on.\n"
    "3. MEMORY: Weave in relevant context from recent conversation if applicable.\n"
    "4. LANGUAGE: If the officer speaks in Kannada, respond in natural, respectful Kannada.\n"
    "5. IDENTITY: You are exclusively VAJRA (Karnataka State Police). Never mention Dewanshi, Zia, GLM, or ChatGPT.\n"
    "6. LENGTH: Keep responses concise (2 to 3 sentences max) and natural."
)
```

#### Grounded Case Q&A Prompt
*File: `vajra_backend/agent_loop.py` (Lines 1962–1969)*
```python
sys_prompt = (
    "You are a Karnataka State Police case assistant. Answer the officer's "
    "question using ONLY the CASE FACTS provided -- never invent names, "
    "numbers, stations, dates or charges. If the facts do not contain the "
    "answer, say plainly that the case record does not include it. Be "
    "direct and concise (2-5 plain-language sentences), answer the specific "
    "question first, and use NO headers, bullets or template."
)
```

#### OSINT Investigation Dossier Injection Template
*File: `vajra_backend/agent_loop.py` (Lines 2058–2075)*
```python
sys_prompt = (
    "You are VAJRA, Karnataka Police Copilot's Open-Source Intelligence (OSINT) research division. "
    "The officer has requested a COMPREHENSIVE INVESTIGATION DOSSIER / DETAILED SUMMARY on this subject. "
    "Synthesize a structured, high-density, professional intelligence dossier using the numbered web search results below -- "
    "never invent facts not present in them or unverified. "
    "Organize the dossier into clear Markdown sections:\n"
    "### 📋 Incident & Entity Overview\n"
    "### 👤 Key Leadership & Persons of Interest\n"
    "### 💰 Financial Quantum & Routing (Modus Operandi)\n"
    "### ⚖️ Law Enforcement & Judicial Action (SIT, CBI, ED, Court)\n"
    "### ⏱️ Timeline of Critical Events\n\n"
    "Rules:\n"
    "- Cite every claim with its bracketed source number, e.g. [1], [2].\n"
    "- Maintain maximum factual density (names, leadership, amounts in Crores, statutory sections, dates).\n"
    "- Use clean bullet points under each section for fast officer readability.\n"
    "- Professional, objective police intelligence tone."
)
```

---

## TASK 3: VERIFY CRITICAL DATATHON PATCHES

### 3.1 Word-Boundary Regex in Crime Head Matching
*Files Checked: `vajra_backend/crime_heads_118_map.py` & `vajra_backend/agent_loop.py` (Line 7155–7158)*

**Verification Result:** ⚠️ **SUBSTRING MATCHING IN ACTIVE LOOP (REGRESSED / UNPATCHED)**

In `crime_heads_118_map.py`, keywords are stored as flat strings without compiled regex. In `agent_loop.py`:
```python
# vajra_backend/agent_loop.py:7155-7157
for head_id, kws in CRIME_HEAD_KEYWORDS.items():
    if any(kw in q_l for kw in kws):
        matched_head_ids.append(head_id)
```
> **Audit Finding:** While `\b` regex is rigorously used in intent and entity routers (e.g. `\b(CR|FIR)[-_ ]?\d+[-_ ]?\d*\b`), the CrimeHead dictionary matcher in `find_similar_cases` currently uses `kw in q_l` rather than `re.search(rf"\b{re.escape(kw)}\b", q_l)`.

---

### 3.2 Removal of Fake Cosine Math `0.96 - (idx * 0.04)`
*File Checked: `vajra_backend/agent_loop.py` (Line 7233–7235)*

**Verification Result:** ❌ **STILL PRESENT IN ACTIVE BASELINE (REGRESSED DUE TO FALLBACK)**

```python
# vajra_backend/agent_loop.py:7233-7235
# Dynamic Semantic Relevance Calculation based on facts and recency
relevance_score = max(0.70, round(0.96 - (idx * 0.04), 2))
```
And its display in the output matches dictionary:
```python
# vajra_backend/agent_loop.py:7257
"mo_similarity": f"{int(relevance_score * 100)}% (Cosine Semantic Match)",
```
> **Audit Finding:** The arithmetic decay `round(0.96 - (idx * 0.04), 2)` is still executing in `find_similar_cases`. When the fallback was performed, this patch was reverted and must be re-applied to replace it with authentic cosine similarity or database match metrics.

---

### 3.3 Frontend Adaptive Progressive Polling (350ms $\rightarrow$ 2000ms)
*File Checked: `src/screens/AIChatScreen.tsx` (Lines 739–745)*

**Verification Result:** ✅ **ACTIVE & VERIFIED**

```typescript
// src/screens/AIChatScreen.tsx:739-744
const maxAttempts = 90;
for (let attempt = 0; attempt < maxAttempts; attempt++) {
  // Adaptive progressive polling: check rapidly (350ms -> 600ms -> 1000ms) for fast answers/greetings,
  // then settle to 2000ms for deep analytical queries. Eliminates the artificial 6-10s UI display lag.
  const delay = attempt === 0 ? 350 : attempt === 1 ? 600 : attempt === 2 ? 1000 : attempt === 3 ? 1500 : 2000;
  await new Promise((resolve) => setTimeout(resolve, delay));
```
> **Audit Finding:** Fully present and functioning. Successfully eliminates frontend display stalls for sub-second responses while maintaining up to 90 attempts (~3 minutes) for heavy multi-tool joins.

---

### 3.4 Catalyst QuickML Retry Loop & Timeout Limits
*File Checked: `vajra_backend/catalyst_llm.py` (Lines 408–414)*

**Verification Result:** ✅ **ACTIVE & VERIFIED (SINGLE-SHOT CIRCUIT BREAKER)**

```python
# vajra_backend/catalyst_llm.py:408-414
_req_timeout = int(os.getenv("CATALYST_LLM_TIMEOUT", "28"))
for attempt, delay in enumerate([0]):
    if delay:
        time.sleep(delay)
    try:
        logger.info(f"Posting to Catalyst LLM Serving endpoint (attempt {attempt + 1}, timeout {_req_timeout}s): {self.endpoint_url}")
        res = requests.post(self.endpoint_url, headers=headers, json=payload, timeout=_req_timeout)
```
And the cooldown circuit-breaker:
```python
# vajra_backend/catalyst_llm.py:461-465
except requests.exceptions.Timeout:
    logger.warning(f"Catalyst LLM request timed out ({_req_timeout}s).")
    _last_failure_reason = f"timeout_{_req_timeout}s"
    _mark_endpoint_down(_TRANSIENT_COOLDOWN_SECONDS)
    break
```
> **Audit Finding:** The retry loop is deliberately locked to `[0]` (1 single attempt, 0s delay) with a `28s` timeout. Any timeout, 429 rate limit, or 500 server error immediately trips the circuit-breaker (`_mark_endpoint_down`) so subsequent queries bypass the dead endpoint and drop straight to Qwen/Keyword fallbacks without blocking the officer.

---

## TASK 4: TOOL DISPATCH & RETRIEVAL PIPELINE

### 4.1 Intent Parsing Architecture
*File: `vajra_backend/agent_loop.py`*

**Primary Entry Signature:**
```python
def run_agent_loop(
    self, 
    query: str, 
    session_id: str, 
    employee_id: int, 
    user_unit_id: Optional[int] = None, 
    officer_name: Optional[str] = None, 
    answer_mode: str = "standard", 
    officer_badge: Optional[str] = None, 
    progress_cb: Optional[Callable[[str], None]] = None, 
    persona_override: Optional[str] = None
) -> Dict[str, Any]:
```

**Resolution Pipeline Hierarchy:**
1. **ZCQL Query HUD Logging:** Initializes query logger (`start_zql_log()`) to capture all executed SQL strings for court-admissible audit proof under Section 63 BSA.
2. **Context Stripping:** Removes bracketed `[Context: ...]` headers to isolate the officer's real raw input.
3. **Conversational Fast-Paths (0ms):**
   - Pure greetings/civility regex (`hi`, `namaskara`, `good morning`).
   - Case Diary / Session Summary regex (`summarize this chat`, `from starting of the chat`).
4. **Tool Planning Pass:**
   - Filters `self.TOOLS` down to 6 plausible tools via `_relevant_tools(query)`.
   - Attaches top-2 verified gold tool exemplars (`get_matching_tool_exemplars`).
   - Dispatches prompt to GLM (`catalyst_llm.chat(history, tools_for_call)`).
5. **Fallback Cascade (if GLM fails):**
   - **Tier 1:** `catalyst_qwen.decide_tool(query, self.TOOLS)`.
   - **Tier 2:** Deterministic `_keyword_route_tool(query)`.
   - **Tier 3 (Database-First Inversion):** If an FIR/CR pattern is matched, routes to `query_case`; if a district is mentioned, routes to `find_similar_cases`.

---

### 4.2 ZCQL Execution Against `CaseMaster`
*File: `vajra_backend/agent_loop.py` (Lines 6236–7430)*

Every database interaction against Catalyst Data Store is strictly sanitized and executed via `catalyst_app.zql().execute_query()`:

```python
# Sample 1: Targeted FIR lookup with SQL Injection protection
target_cno = self.sanitize_sql_input(params.get("case_no", "").strip())
query_str = f"SELECT CaseMasterID, CrimeNo, CrimeRegisteredDate, PoliceStationID, BriefFacts, CrimeMajorHeadID FROM CaseMaster WHERE CrimeNo = '{target_cno}' LIMIT 1"
rows = catalyst_app.zql().execute_query(query_query)

# Sample 2: Categorical Crime Head extraction with District filtering
head_ids_str = ", ".join(str(h) for h in matched_head_ids)
dist_clause = f" AND PoliceStationID IN ({station_ids_str})" if station_ids_str else ""
count_query = f"SELECT COUNT(ROWID) FROM CaseMaster WHERE CrimeMajorHeadID IN ({head_ids_str}){dist_clause}"
count_res = catalyst_app.zql().execute_query(count_query)

# Sample 3: Multi-case relational batch fetch
case_ids_str = ",".join(str(int(c)) for c in case_ids[:10])
case_query = f"SELECT ROWID, CaseMasterID, CrimeNo, BriefFacts, CrimeRegisteredDate, PoliceStationID FROM CaseMaster WHERE CaseMasterID IN ({case_ids_str})"
case_rows = catalyst_app.zql().execute_query(case_query)
```

---

### 4.3 JSON Formatting Before LLM Synthesis
*File: `vajra_backend/agent_loop.py` (Lines 5120–5520)*

Once a tool finishes, its structured output is packaged into the conversation history before invoking the final synthesis prompt:

```python
# Step 1: Execute tool and extract outputs
tool_result = self._execute_tool(chosen_tool, tool_params, employee_id, session_id, user_unit_id)
raw_tool_text = tool_result.get("text_result") or ""
tool_data = tool_result.get("data") or {}

# Step 2: Format Assistant Tool Invocation Message
history.append({
    "role": "assistant",
    "content": json.dumps({"tool": chosen_tool, "parameters": tool_params})
})

# Step 3: Format Tool Execution Result as System Turn
history.append({
    "role": "user",
    "content": f"TOOL RESULT:\n{raw_tool_text}\n\nDATA_PAYLOAD: {json.dumps(tool_data)[:4000]}"
})

# Step 4: Final Synthesis Call (Tools=None -> Generates Final Text)
llm_res = self.llm.chat(
    history,
    tools=None,
    use_agent_system_prompt=True,  # Uses the 'Final Synthesis' system prompt
    max_tokens=3500,
    style_directive=_style_directive
)
```

---

## 5. SUMMARY OF IDENTIFIED GAPS TO RE-PATCH

Based on this line-by-line extraction, here are the exact two P0 fixes that were reverted during the user's git fallback:

1. **Fake Cosine Math Reversion (`agent_loop.py:7234`)**:
   - `relevance_score = max(0.70, round(0.96 - (idx * 0.04), 2))` must be replaced with real text/keyword similarity or genuine CCTNS matching metrics.
2. **Word-Boundary Regex in CrimeHead Mapping (`agent_loop.py:7156`)**:
   - `if any(kw in q_l for kw in kws)` should be updated to use regex `\b` (`any(re.search(rf"\b{re.escape(kw)}\b", q_l) for kw in kws)`) to prevent substrings (like "car" matching inside "cardiac") from misclassifying Crime Heads.
