# VAJRA — Full Capability Architecture, Security Design & Requirements Cross-Check

---

## PART 1 — SECURITY ARCHITECTURE (answering "what are we going to use")

This is the foundation everything else sits on, so it comes first as requested.

### 1.1 Authentication & Identity
**What we use:** Catalyst Embedded Authentication, mapped to the real police rank hierarchy (DGP → IGP → DIG/SP → station-level officers) confirmed in the explainer call.

- Each rank tier becomes an **organization/role scope** in Catalyst's auth system — not a flat "user" model.
- Public signup is **disabled** — officers are provisioned, not self-registered, matching how a real KSP deployment would actually work (this is also a good talking point for judges: shows you thought about real deployment, not just demo convenience).
- Badge number + password as the credential pair (matches your own UI design tokens doc — "Badge No. / ಬ್ಯಾಡ್ಜ್ ಸಂಖ್ಯೆ").

### 1.2 Authorization / Role-Based Data Access
**What we use:** Data Store's table-level scopes (global / organization / user), confirmed available in the hands-on demo.

- Default posture: **`select`-only** for all application users. `insert`/`update` granted only to specific backend service accounts performing specific actions — never blanket permissions.
- Rank tier determines *what* a query can return — e.g., a station-level officer's queries scope to their district/unit; a DIG's queries scope wider. This needs to be enforced **in the query layer** (your FastAPI backend adds a `WHERE UnitID = ...` or district filter based on the authenticated user's role before it ever reaches Data Store), not just hidden in the frontend — a frontend-only restriction is not real security.

### 1.3 Audit Logging (a named gap we already identified — now the concrete design)
**What we use:** A dedicated `AuditLog` table (not covered by any Catalyst-native service — you build it).

Columns: `log_id`, `employee_id` (who), `action_type` (query/view/export/section-suggestion), `target_entity` (which case/accused/FIR), `query_text` (what was actually asked), `timestamp`, `session_id`.

- Logs **reads**, not just writes — for a police accountability system, "who looked at this case and when" matters as much as edits.
- Every legal-section suggestion (Fork B from our earlier discussion) gets logged with full context — if an officer later relies on a wrong suggestion, there's a traceable record of exactly what the AI said and when.
- Surfaced as a supervisor-only screen (your existing Audit Trail screen design already covers this) — explicitly append-only, no deletes/edits exposed even to admins.

### 1.4 OAuth Scope Management — lessons already learned the hard way
From your actual build process, the working scopes for the *migration/seeding* phase were `ZohoCatalyst.tables.rows.CREATE,ZohoCatalyst.zcql.CREATE`. **This is a dev-time scope, not a production scope** — it's broader than what your actual running application needs day-to-day.

**Design decision:** separate OAuth tokens for separate concerns:
- **Seeding/admin token** (broad scope, used once/rarely, never embedded in the deployed app) — what you used to populate the 30 tables.
- **Runtime application token** (narrow scope — e.g., `ZohoCatalyst.zcql.READ` plus whatever specific write scope a given function actually needs) — this is what your live AppSail backend should authenticate with.
- **Write this down permanently** in a `SECRETS.md` or similar (not committed to git) — you already burned real time rediscovering the right scope string once; don't let that happen again for the runtime token.

### 1.5 Secrets Management
- Dev: `.env`, confirmed already in use — **verify it's in `.gitignore`**, since a public GitHub repo (which your submission requires) leaking a refresh token is a real, immediate risk, not a hypothetical one.
- Production: Catalyst's function-level `config.json`/environment variables (confirmed pattern from the hands-on demo) — never hardcoded in source.

### 1.6 Input Validation / Injection Prevention — a risk specific to your agentic design
This is one **I haven't flagged before and it matters**: your agent extracts entities from natural language (crime type, district, dates) and uses them to build ZCQL queries dynamically. If that extraction-to-query path isn't parameterized carefully, you have a **prompt-injection-to-query-injection** risk — a malicious or malformed natural-language input could manipulate the constructed query.

**Mitigation:** never string-concatenate LLM-extracted values directly into ZCQL. Validate extracted entities against known-good sets (e.g., district name must match an actual row in your `District` table) before using them in any query, and use parameterized query construction, not raw string building.

### 1.7 Rate Limiting & Graceful Degradation
Confirmed constraint: Catalyst rate limits trigger a **10-minute lockout**. Your backend needs a request queue with backoff, not a raw pass-through — a burst of demo-day traffic should degrade to "please wait" messaging, not raw 429 errors surfacing to the officer.

### 1.8 Data Sensitivity & Legal Constraints (already established, restated as a security principle)
- **Synthetic data only** — confirmed rule, already correctly enforced after the CSV episode. This isn't just a compliance checkbox — it's also a security posture: there's no real PII to leak in the first place if the seed data is 100% synthetic, which is itself a defensible design choice worth stating explicitly in your submission.
- **Section-suggestion guardrails** (from our Fork A/B discussion) — every hypothetical legal-section suggestion carries an explicit "confirm with legal officer before filing" disclaimer, logged in the audit trail. This is a security/liability control as much as a UX one.

---

## PART 2 — CAPABILITY-BY-CAPABILITY ARCHITECTURE

For each capability: the design, the Catalyst constraint it runs into, and the specific risk to watch.

### Core Query & Retrieval

**1. Structured FIR lookup**
- Design: direct ZCQL query against `CaseMaster`/`Accused`/`Victim`, filtered by the requesting officer's role scope (Section 1.2).
- Constraint: fast, well within the 30s sync function limit.
- Risk: low — mostly a correctness/schema problem, not a security or scale problem.

**2. Vague/semantic case retrieval**
- Design: structured-filter-first + semantic-rerank (our converged design) — NER extracts whatever's extractable, narrows via ZCQL, then reranks the narrowed set via QuickML RAG/embeddings.
- Constraint: the narrowing step must run before the semantic step — running raw embedding search over the *entire* case table for every vague query doesn't scale and isn't necessary if structured filtering does most of the work.
- Risk: the injection risk from 1.6 applies directly here, since this is the capability that constructs queries from free text.

**3. Multi-turn context resolution**
- Design: Catalyst Cache holds the session's "entities in focus" (case ID, offender ID, location).
- Constraint: Cache's default 48-hour TTL is fine for a single investigation session; make sure the agent explicitly refreshes/extends TTL on each turn of an active conversation so it doesn't expire mid-session.
- Risk: low, but if Cache expires mid-conversation and the agent silently loses context, it needs to gracefully ask "could you remind me which case we're discussing?" rather than hallucinate a wrong one.

**4. Cross-referencing / follow-up chaining**
- Design: this is the core agent-loop behavior — a follow-up triggers a *new* tool call (graph traversal), not a cached repeat.
- Constraint: multi-hop chains risk exceeding 30s → routes through Job Functions, with the frontend showing a "still working" state.
- Risk: none new — this is architecturally the same risk as #4's underlying agent loop generally.

### Legal / Sections Support

**5. Section lookup for existing cases**
- Design: direct ZCQL join, `CaseMaster` → `ActSectionAssociation` → `Section`/`Act`.
- Constraint: none — pure retrieval, fast.
- Risk: low.

**6. Precedent-grounded section suggestions**
- Design: semantic search over similar past cases (reuses #2's infrastructure) + deterministic `CrimeHeadActSection` lookup, always framed as precedent ("similar cases used X"), never as a directive.
- Constraint: depends on QuickML RAG early-access approval (flagged earlier — email Zoho if not done yet).
- Risk: **highest-stakes feature in the whole app** — this is the one place a wrong, overconfident answer has real legal consequences. The disclaimer + audit logging (1.3, 1.8) aren't optional polish here, they're the actual safety mechanism.

**7. Classification-consistency flagging**
- Design: a periodic Job Function that compares a case's recorded section against what similar-narrative cases typically use, flags mismatches for human review.
- Constraint: this is a background/batch job, not a live chat feature — runs as a scheduled Job Function, surfaces as a supervisor-facing alert, not an inline chat answer.
- Risk: false positives (flagging a legitimately unusual but correct classification) — frame these as "worth a second look," not "this is wrong."

### Network & Pattern Analysis

**8. Criminal network queries**
- Design: Neo4j multi-hop traversal, triggered as a tool call from the agent, rendered as an inline graph widget.
- Constraint: Neo4j lives outside Catalyst (no native graph DB service) — your AppSail backend is the integration point. Deep traversals risk the 30s limit → Job Function for anything beyond ~2 hops.
- Risk: query depth needs an explicit cap with user-facing messaging ("showing 3-hop connections; request deeper analysis" as a distinct, throttled action) — an unbounded traversal on a large graph is a real performance/availability risk under concurrent load (this is the exact scaling risk flagged in the original architecture doc).

**9. Financial/transaction link queries**
- Design: extend the same Neo4j graph with a transaction node type (our earlier design) rather than a separate system.
- Constraint: needs the `financial_transactions` table built first (a genuine gap, not yet built as far as I know).
- Risk: same as #8, plus this is explicitly one of the higher-sensitivity data domains — audit logging here should be especially strict.

**10. Hotspot/pattern queries**
- Design: DBSCAN pre-computed via a scheduled Job Function, results cached in Data Store, fast-path sync function just reads the cache.
- Constraint: none significant if pre-computed correctly — this is the "don't overbuild" case from the original doc.
- Risk: low.

**11. Forecast queries**
- Design: simple time-series model (Prophet/seasonal decomposition), trained periodically via Job Function, served from cache.
- Constraint: none significant.
- Risk: over-claiming confidence — always show the forecast alongside the historical data it's based on (ties to Explainability, capability #18).

### Offender Intelligence

**12. Risk score retrieval**
- Design: XGBoost model (kept over Zia AutoML per our earlier reasoning, for SHAP explainability), inference via fast sync function reading a pre-trained model.
- Constraint: retraining is a Job Function; scoring a single offender on demand is fast.
- Risk: this is offender-facing profiling — needs the same "not a directive, a decision-support signal" framing as section suggestions. A risk score should never read as "this person is guilty of X," only "this offender's history pattern resembles Y."

### Investigator Decision Support

**13. Behavioral/MO profiling queries**
- Design: reuses case-history retrieval (#1/#2) with a summarization prompt layered on top.
- Constraint: none new.
- Risk: same framing risk as #12 — profiling language needs care; this is exactly the kind of feature that reads as either "genuinely useful investigative tool" or "algorithmic bias machine" depending entirely on how confidently it's phrased in the UI.

### Investigator Decision Support

**14. Case summarization**
- Design: LLM call (QuickML) over the case's full record set, same agent infrastructure, different system prompt.
- Constraint: none significant if the case isn't enormous; large cases with many linked entities may need chunking.
- Risk: low, but citations (#18) matter here specifically — a summary should reference which records it drew from.

**15. Similar-case retrieval for leads**
- Design: same semantic retrieval infrastructure as #2, applied to "find similar resolved cases" instead of "find this specific case."
- Constraint: shares QuickML RAG early-access dependency.
- Risk: low.

### Language & Accessibility

**16. Bilingual text (English/Kannada)**
- Design: your existing Kannada NLP stack; UI already accounts for this (the `leading-[1.8]` line-height rule in your design tokens).
- Constraint: none new.
- Risk: none security-related.

**17. Voice input/output**
- Design: Zia's STT → translate → LLM → translate → TTS chain (confirmed working in the hands-on demo).
- Constraint: 5 chained API calls will likely exceed 30s for anything beyond a short utterance → route through Job Function, same pattern as the main agent loop.
- Risk: latency expectations need explicit UI handling (a visible "processing" state, not a silent hang).

### Trust, Transparency & Governance

**18. Citations/evidence trail on every answer**
- Design: QuickML's RAG response-breakdown panel gives you this natively for document-sourced answers; for structured-DB answers, your backend needs to explicitly pass back which rows/tables were queried.
- Constraint: none — this is mostly a "make sure you actually wire this through to the UI" discipline problem, not a technical blocker.
- Risk: skipping this is the single biggest risk to your Explainable AI score with judges — it's cheap to build, high-value to have.

**19. Confidence-aware responses**
- Design: the agent should have an explicit "ask for clarification" branch in its tool-calling logic, not just a "best guess" fallback.
- Constraint: this is a prompt-engineering/agent-design discipline, not a platform constraint.
- Risk: the opposite failure (always asking, never answering confidently) is equally bad — needs real tuning against your synthetic test queries, not just built once and assumed correct.

**20. Audit logging of every query/answer**
- Design: covered in 1.3.
- Constraint: none new.
- Risk: none new — already the core control.

**21. Role-aware responses**
- Design: covered in 1.2 — enforced at the query layer, not the UI layer.
- Constraint: none new.
- Risk: this is the one place a UI-only restriction (hiding a button) instead of a backend restriction (blocking the actual query) would be a real, demo-visible security hole if a judge probes it.

### Output/Export

**22. Conversation export to PDF**
- Design: no Catalyst-native PDF service exists (confirmed) — build this yourself, likely client-side (simplest) or via a lightweight PDF library call in your AppSail backend.
- Constraint: none significant — genuinely one of the smaller/simpler features on this list.
- Risk: low — but the exported PDF should probably also go through the audit log (someone exported this conversation, when) since it's leaving the system as a file.

---

## PART 3 — CROSS-CHECK: DID WE MISS ANYTHING THE OFFICIALS SAID?

Going back through every verbal expectation from the explainer call and the hands-on session, checked against everything above:

| Official expectation | Covered? | Where |
|---|---|---|
| Agentic, not simple Q&A | ✅ | Capabilities #4, #19, agent-loop design throughout |
| Deep network analysis, not surface-level | ✅ | Capability #8, three-tier depth model from the earlier doc |
| Production-grade, not throwaway | ✅ | Security section as a whole; audit logging; role scoping |
| Secure and scalable (10 vs 100 users) | ✅ | Section 1.7 (rate limiting), capability #8's depth-cap discussion |
| Sustain a decade | ⚠️ **Partially** | Covered in the earlier doc (config-driven reference data, versioned models) — **not restated here**, worth keeping that section alive alongside this one rather than letting it get lost across documents |
| LLMs must run on Catalyst | ✅ | QuickML throughout |
| Innovative architecture is itself evaluated | ✅ | The whole agent-loop + semantic memory design is the "innovative" surface |
| One challenge only (Statement 1) | ✅ | Already corrected mid-build per your own catch |
| Voice interaction (written brief) | ✅ | Capability #17 |
| PDF export of conversation (written brief) | ✅ | Capability #22 |
| Socio-demographic insights (written brief) | ❌ **Not in this list** | Needs its own capability entry — this is a *data analysis* capability (correlate crime with demographics), distinct from the conversational features above. Worth adding as **Capability #23** if it isn't tracked elsewhere in your dashboard/reports screens. |
| Financial crime & transaction analysis (written brief) | ✅ | Capability #9 |
| Explainable AI across *all* responses, not just risk scores (written brief) | ✅ | Capability #18, but worth double-checking every single capability above actually surfaces a citation, not just the risk-scoring one |
| Secure role-based governance (written brief) | ✅ | Section 1.2, 1.3, capability #21 |
