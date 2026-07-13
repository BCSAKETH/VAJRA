# VAJRA — Full Requirements & Architecture Blueprint
### Challenge 01: Intelligent Conversational AI for KSP Crime Database
### Merged: Official Written Brief + Verbal Expectations from the Explainer Call

---

## How to read this document

Every one of the 10 official capability areas below now folds in the relevant verbal
expectations stated live by the judges (agentic behavior, depth of network analysis,
production-grade quality, scalability, decade-long thinking). For each area you get:

- **What it means** (plain explanation)
- **How to build it** (concrete approach)
- **Why this approach, not an alternative** (trade-off reasoning)
- **Catalyst constraint/mapping** (what platform limit or service this touches)

Two cross-cutting sections at the end cover **decade-long architecture** and
**security & scalability** in depth, since those aren't features — they're qualities
that cut across everything above.

---

## 1. Conversational Crime Intelligence Interface *(+ agentic requirement folded in)*

**What it means:** A chat interface where investigators ask questions in plain
English or Kannada and get answers grounded in the FIR database — but the judges
were explicit: **"we are way past a simple Q&A with a chatbot."** They want an
**agent**, not a lookup tool.

**The functional difference between "chatbot" and "agent"** — this is the single
most important distinction in the whole brief, so it's worth being precise:

| Chatbot (what NOT to build) | Agent (what's expected) |
|---|---|
| One question → one DB query → one answer | Question → agent decides *which* tools/data sources it needs, possibly multiple, in sequence |
| No memory beyond the current message | Maintains conversation state; "that offender" in a follow-up resolves correctly without re-stating the case ID |
| Fixed query template | Reasons about ambiguous questions, asks clarifying questions when the query is under-specified |
| Single-hop retrieval | Multi-hop: e.g. "any other cases linked to him?" triggers a **second** graph traversal, not just a repeat of the first query |

**How to build it:**
- Use an LLM (GLM 4.7 via QuickML) in an **agent loop pattern**: the model is given tool definitions (query_fir_table, query_neo4j_graph, get_offender_history, run_risk_score) and decides which to call, potentially chaining several before answering — not a single prompt-in/answer-out call.
- Maintain a **session/conversation state object** (stored per user session, e.g. in Data Store or in-memory cache) holding the current entities in focus (case IDs, offender IDs, locations mentioned) so pronouns and follow-ups resolve correctly.
- This is exactly where your existing GraphRAG + Neo4j setup is actually a strength — most teams will bolt a chatbot onto a flat table; you already have a graph to reason over multi-hop.

**Why this approach:** A single-shot Q&A bot fails the very first evaluation criterion stated live by the judges. Agentic behavior isn't a "nice to have" layered on top — it's foundational to how the whole interface must work, so it needs to be an architectural decision made now, not a later feature toggle.

**Catalyst constraint:** Multi-hop agent reasoning (LLM call → tool call → LLM call → tool call → final answer) will very likely blow past the **30-second standard function timeout**. This must run as a **Job Function** (15-min cap), with the frontend polling for completion or receiving a callback — not as a synchronous Advanced I/O function. Plan the UI for this: a "thinking..." state with progressive updates, not a spinner assuming a sub-second reply.

**Also required in this section (written brief, unchanged):**
- Retrieve FIRs, accused, victims, locations, investigation status, criminal history
- Save conversation history as **PDF, locally** — generate this client-side or via a function that assembles the transcript into a PDF (a lightweight PDF library call, not a Catalyst-native feature — Catalyst doesn't have a PDF-generation service listed in its capability table, so this is one you build yourself in your AppSail backend)
- English + Kannada — voice interaction (see Section 11 below, since it recurs across areas)

---

## 2. Criminal Network & Relationship Analysis *(+ "deep, not surface-level" requirement folded in)*

**What it means:** Link accused, victims, locations, financial accounts, and incidents — but the judges repeatedly stressed that **today's crimes are networked, not individual** (cyber, crypto, dark web, cross-border), and said explicitly: "the deeper you can go... the more attractive the solution will be." Surface-level "these two people were in the same FIR" linking will read as thin.

**How to build it — three depth tiers, aim for at least tier 2:**

| Tier | What it shows | Effort |
|---|---|---|
| **Tier 1 (surface)** | Direct co-occurrence: accused A and accused B appear in the same FIR | Baseline — don't stop here |
| **Tier 2 (relational)** | Multi-hop: A and B never share an FIR directly, but both are linked to the same phone number / bank account / address / vehicle across *different* cases | This is where Neo4j earns its place — a relational DB can't do this without expensive joins; a graph traversal does it natively |
| **Tier 3 (behavioral)** | Cluster detection: group of offenders whose combined MO, timing, and geography suggests a coordinated network (not just linked, but operating *as* a network) | Requires community-detection graph algorithms (e.g. Louvain, label propagation) on top of Neo4j — worth attempting since this directly answers "detect organized crime groups" |

**Why Neo4j over a pure relational join for this:** multi-hop relationship queries (find everyone connected to X within 3 hops, through *any* shared attribute) are what graph databases exist for — a SQL join across 3-4 tables to do the same thing gets slow and unreadable fast, and Catalyst's Data Store doesn't have native graph traversal. Keeping Neo4j alongside Catalyst (rather than forcing everything into Data Store) is the right call — nothing in Catalyst's capability table maps to graph DB, so an external graph store is defensible, not a compliance risk.

**Catalyst constraint:** Neo4j lives outside Catalyst (hosted separately, e.g. Neo4j Aura or self-hosted) — your AppSail-hosted FastAPI backend is the thing that talks to both Neo4j *and* Catalyst Data Store, acting as the integration layer. This needs to be explicit in your architecture diagram so it doesn't look like you're dodging the "use Catalyst services" recommendation — the recommendation only applies where a matching Catalyst service exists, and graph DB isn't one of the 26 listed capabilities.

---

## 3. Crime Pattern & Trend Analytics

**What it means:** Trends by time, geography, crime type, MO; hotspot/cluster detection; seasonal/event-based patterns.

**How to build it:** Your existing DBSCAN clustering for hotspots is solid for spatial density — keep it. Layer time-series decomposition on top (weekly/monthly/seasonal patterns) using a simple statistical method (e.g. STL decomposition or even rolling averages) rather than reaching for something heavier — this is a case where the judges want **insight quality**, not algorithmic novelty for its own sake.

**Why not overbuild this one:** the brief doesn't ask for cutting-edge trend detection here specifically — it asks for accessible, drill-down-able trend views (Problem Statement 2's officers wanted "immediate sense of what is going on" from a glance). Simple, well-visualized statistics beat a complex model that's hard to explain — which also serves the Explainable AI requirement (Section 9).

**Catalyst constraint:** Pre-computed hotspot coordinates (from your DBSCAN job) should be **cached results served fast** — this is a Tier 1 sync-function job (< 30s), not something recomputed live per query. Run the clustering itself as a periodic **Job Function**, scheduled via **Job Scheduling** — not Cron, which reached End of Life 30 Apr 2026 (confirmed via Zoho's own deprecation notice) and should not be used for any new or existing scheduling in this project. Store results in Data Store, and have the fast-path function just read the pre-computed table.

---

## 4. Sociological Crime Insights

**What it means:** Correlate crime with age, gender, socio-economic background, urbanization, migration, economic stress, education.

**How to build it:** This needs demographic fields in your synthetic data schema (age bracket, gender, occupation category, district urbanization tier, etc. on the accused/victim tables) — if these columns don't exist yet in your schema draft, add them now before you create tables in the console, since schema changes later mean re-migrating data.

**Why this is lower architectural risk but higher data-design risk:** there's no new infrastructure needed here — it's really a data modeling and analysis problem. The risk is in generating *realistic* synthetic correlations (e.g., don't just randomly assign age/crime-type pairs — build believable distributions, since judges (domain experts) will notice data that looks statistically implausible).

**Catalyst constraint:** None specific — this is standard Data Store querying (ZCQL aggregation queries), well within the 30-second sync limit for most cases.

---

## 5. Criminology-Based Offender Profiling

**What it means:** Repeat offender ID, behavioral/MO analysis, risk scoring.

**How to build it:** Your existing XGBoost/SHAP setup is a good fit — keep it, but note the judges' own suggestion (Zia AutoML) is an alternative, not a requirement. **Recommendation: keep XGBoost/SHAP.** Reasoning: SHAP gives you per-prediction, per-feature explainability that directly serves Section 9 (Explainable AI) — swapping to Zia AutoML risks losing that explainability granularity unless you've confirmed Zia's output includes comparable feature-attribution detail, which isn't guaranteed. Don't swap a working explainable model for a Catalyst-native one unless the Catalyst one is at least as explainable — "use Catalyst where possible" is a recommendation weighed against submission validity, not an instruction to sacrifice a core requirement (explainability) to satisfy a soft preference.

**Catalyst constraint:** Model training/refitting is a **Job Function** (periodic, scheduled), not something retrained per-request. Inference (scoring a single offender on demand) can be a fast sync function if you're just applying an already-trained model, not retraining.

---

## 6. Investigator Decision Support

**What it means:** Automated case summaries, timelines, similar-case retrieval, investigative lead suggestions.

**How to build it:** This is a natural extension of the agentic interface in Section 1 — "find similar past cases" is itself a tool the agent can call (vector similarity search or graph-pattern matching against case embeddings). If you're already doing RAG-style retrieval, case summarization can reuse the same LLM call with a different system prompt rather than needing separate infrastructure.

**Why fold this into the agent rather than build separately:** building it as a standalone feature duplicates the LLM-calling and context-management logic you already need for Section 1. One agent, many callable tools/skills, is architecturally cleaner and easier to demo coherently than several disconnected features.

**Catalyst constraint:** Case summarization for a single case is fast enough for a sync function; similarity search across the whole case corpus (if done as an on-demand full scan) may need to be pre-indexed and cached rather than computed live.

---

## 7. Financial Crime & Transaction Link Analysis *(gap identified — new for VAJRA)*

**What it means:** Detect financial transactions linked to crimes, trace money trails, identify suspicious transaction networks.

**How to build it:** This needs a **new table** (financial_transactions: sender, receiver, amount, timestamp, linked_case_id, account/wallet identifiers) feeding into the same Neo4j graph as an additional node/edge type — money trails are structurally the same problem as criminal network analysis (Section 2), just with financial entities as an additional node type in the graph rather than a separate system.

**Why extend the existing graph rather than build a separate module:** a transaction is fundamentally a relationship (A sent money to B) — that's exactly what a graph models. Building a separate financial-analysis subsystem would duplicate the graph-traversal logic you already have for criminal networks. Treat "financial account" as just another node type connected to accused/case nodes, and most of your Section 2 code (multi-hop traversal, cluster detection) becomes directly reusable here with no new algorithm needed.

**Constraint to flag honestly:** this is a genuine gap in your current build — budget real time for it, since it's a distinct data domain (transaction records) even if the analysis technique reuses your graph infrastructure.

---

## 8. Crime Forecasting & Early Warning *(gap identified — distinct from hotspot clustering)*

**What it means:** This is explicitly **predictive**, not descriptive. DBSCAN hotspot clustering tells you *where crime has already clustered* — it does not tell you *where crime is likely to increase next*. The brief and the judges (who called prediction "a very very important topic") both draw this distinction clearly.

**How to build it — pick the simplest defensible option, not the fanciest:**
- **Recommended:** a time-series forecasting model (even something as straightforward as Prophet, or a seasonal ARIMA) per district/crime-type combination, trained on your synthetic historical data, producing a short-horizon forecast (e.g., "burglary incidents in District X are trending up over the next 30 days").
- **Not recommended for a hackathon timeline:** deep learning spatiotemporal models (e.g. ConvLSTM over a crime-density grid) — technically more impressive, but far higher implementation risk for the time you have, and harder to explain to a jury of police officers and architects who explicitly value clarity and production-readiness over algorithmic sophistication for its own sake.

**Why the simpler model is the *correct* choice, not just the easier one:** the judges explicitly said they value solutions that can go to real production and be maintained — "sustain at least a decade." A well-understood, well-documented statistical forecasting model that a future maintainer (who isn't you) can actually understand and retrain is more production-viable than a complex model that only you understand today. This directly serves the decade-long-architecture requirement, not just your timeline.

**Catalyst constraint:** Forecasting model training = Job Function (scheduled, e.g. weekly retraining). Serving a pre-computed forecast to the UI = fast sync function reading cached results, same pattern as Section 3.

---

## 9. Explainable AI & Transparent Analytics *(gap identified — needs to be a user-facing feature, not just internal SHAP values)*

**What it means:** The brief wants every AI response backed by visible data references and reasoning-path visualization — this needs to be **surfaced in the UI**, not just computed and logged internally.

**How to build it — concretely, for each AI-driven feature:**
- **Agentic chat answers:** when the agent calls a tool (e.g., queries the FIR table, traverses the graph), the UI should show *which* records/tool-calls contributed to the answer — e.g., a collapsible "sources" panel listing the FIR numbers or graph nodes the answer drew from. This is a UI/UX decision as much as a backend one.
- **Risk scores:** your existing SHAP values are the right backend — the gap is exposing them visually (e.g., a bar chart of top contributing features per offender risk score), not just having them available in a log file.
- **Forecasts:** show the historical data underlying a forecast alongside the prediction line, so an officer can see *why* the model thinks a trend is emerging, not just the number.

**Why this matters more than it might seem:** this is explicitly tied to "compliance with law enforcement accountability requirements" in the brief — for a real police deployment, an AI system that can't show its work is a liability, not just a UX nicety. Judges evaluating for production-readiness will specifically look for this.

**Catalyst constraint:** None specific — this is primarily a frontend (Slate/React) concern layered on top of data your backend already computes; low infrastructure cost, high evaluation payoff, worth prioritizing given the effort-to-impact ratio.

---

## 10. Secure Role-Based Access & Governance *(+ audit-log gap folded in)*

**What it means:** Role-based access (investigators, analysts, supervisors, policymakers), secure sensitive-data handling, audit logs, traceability, data-protection compliance.

**How to build it — mapped directly to Catalyst's native capabilities, which fit this requirement well:**
- **Role-based access:** Catalyst Authentication + Data Store's **table-level scopes and permissions** (global / organization / user level, as demonstrated in the hands-on session) — this maps almost exactly onto your rank hierarchy (DGP/IGP/DIG/SP down to station level) confirmed in the explainer call. Model each rank tier as an organization/role scope in Catalyst's permission system.
- **Audit logs (the identified gap):** Catalyst doesn't have a dedicated "audit log" service in its capability table, so this needs to be **built explicitly** — a dedicated `audit_log` table (user_id, action, target_record, timestamp, IP/session) written to on every sensitive read/write, populated via a lightweight logging call in your AppSail backend on each request. This should be a **visible, queryable feature** (e.g., a supervisor-only "activity log" screen), not just implicit request logging, since the brief asks for traceability as a feature, not an implementation detail.

**Why build audit logging as a first-class table rather than relying on default request logs:** default infrastructure logs (if Catalyst has them) are typically operational/debugging logs, not designed for compliance review by a supervisor. A police accountability system needs audit trails that are queryable by a human in a UI, filterable by user/date/action — that's a data modeling decision, not something you get for free.

---

## 11. Voice Interaction *(recurring requirement across Sections 1 and elsewhere — consolidated here)*

**How to build it:** Zia's chained pipeline — **speech-to-text → text translation (Kannada↔English) → LLM reasoning → text-to-speech** — confirmed working in the Catalyst hands-on demo. Chain these three Zia services rather than sourcing a separate speech stack; keeping the whole pipeline inside Catalyst avoids you needing a separate LLM-hosting justification for something the brief already asks for.

**Why chain through English rather than reason natively in Kannada:** the LLM's reasoning quality is almost certainly stronger in English (most models are English-dominant in training data) — translating to English for the reasoning step, then translating the final answer back to Kannada for speech output, gets you better reasoning *and* native language output, rather than forcing the model to reason directly in a lower-resource language.

**Catalyst constraint:** Each leg of this chain (STT, translate, LLM, translate, TTS) is itself a QuickML/Zia API call — sequencing five calls together will likely also exceed the 30-second sync limit for anything beyond a short utterance, so voice queries should probably route through the same Job Function pathway as the agentic chat (Section 1), with the frontend showing a "processing" state.

---

## Cross-Cutting Concern A: "Sustain at least a decade" — what this actually requires

This phrase from the judges isn't a vague aspiration — it maps to concrete architectural decisions. Here's what decade-scale thinking actually means, broken down:

**1. Don't hardcode what will change.** District names, rank hierarchies, crime-type taxonomies — these should be **configurable data, not hardcoded logic**. If Karnataka reorganizes districts or adds a new crime classification in year 3, the system shouldn't need a code change to accommodate it. Store these as reference tables in Data Store, not as enums baked into your application code.

**2. Version everything that an LLM touches.** Prompts, model versions, schema versions — a decade-scale system will go through multiple LLM model upgrades (GLM 4.7 will not be Zoho's latest model in 2030). Structure your QuickML integration so the model identifier is a config value, not hardcoded in application logic, and log which model version produced which answer (this also serves your audit-trail requirement in Section 10).

**3. Design for schema evolution, given Catalyst's constraint.** Since Catalyst has **no SQL migration tooling** (confirmed — schema changes are manual console operations), a decade of schema evolution means someone will be manually adding columns for years. Document your schema decisions in a maintained markdown file (a `SCHEMA.md` in your repo) as the source of truth, since there's no `migrations/` folder auto-generating that history for you the way Supabase or Django would. **Done — see `docs/SCHEMA.md`,** created directly from the actual live seeder/tool code rather than re-derived from the console each time someone needs it.

**6. Extensibility is already architecturally real, not just aspirational — here's the evidence.** `agent_loop.py`'s `TOOLS` registry (a list of name/description/parameter-schema dicts fed to GLM-4.7-Flash for function-calling) means adding a new capability is: define a new tool entry + a new `_execute_tool` branch — the agent loop, session memory, citation handling, and audit logging around it are all shared infrastructure that doesn't need to change per new tool. This is a real, working pattern already, not a future intention — 13 tools exist today (case lookup, vague retrieval, legal sections x2, network, financial links, hotspots, forecast, offender risk, MO profile, case summary, similar cases, clarifying questions), and the same pattern is how case-timeline, demographic-correlation, and MO-match tools are being added now.

**4. Separate "what the model decided" from "what the data says."** AI outputs (risk scores, forecasts, agent answers) should be stored as their own versioned records, separate from the underlying ground-truth data — so that as models improve over the years, you can compare old predictions against new ones without losing historical record of what the system believed at the time. This also directly serves accountability (Section 9/10) since it creates a permanent record of AI decision history.

**5. Plan for the graph to outgrow the demo.** Neo4j scales well for this, but a decade of Karnataka crime data (potentially tens of millions of nodes/edges) needs index planning from day one — even in your hackathon prototype, add indexes on the fields you'll traverse most (offender ID, case ID, location ID) rather than relying on full graph scans, since retrofitting indexes onto a production graph later is disruptive.

---

## Cross-Cutting Concern B: Security and Scalability — concretely, not just as a statement

The judges' "10 users vs. 100 users" warning is specific — here's what actually breaks first, and how to pre-empt it:

**What breaks first as load increases (in likely order) — updated with what's actually
been observed running the live dev server, not just predicted:**

| Failure point | Why it breaks | Mitigation | Status |
|---|---|---|---|
| **LLM endpoint misconfigured** | `catalyst_llm.py` posts to a guessed endpoint URL pattern; Catalyst returns `404 INVALID_URL_PATTERN`. Every chat response has been running on the local fallback simulation, never the real model, until this is fixed at the console. | Retrieve the real endpoint from Catalyst Console → QuickML → Generative AI → LLM Serving → GLM-4.7-Flash → View API and set as `CATALYST_LLM_ENDPOINT`. | 🔴 Confirmed broken as of last live test — this is the actual current #1 scalability/reliability blocker, ahead of anything hypothetical below |
| **Catalyst Cache OAuth scope mismatch** | Session memory writes fail with `OAUTH_SCOPE_MISMATCH` — multi-turn context resolution is silently non-functional right now, not just under load | Grant the correct Cache read/write scope to the connection in Cloudscale → Connections | 🔴 Confirmed broken |
| **AuditLog schema mismatch** | Live ZCQL calls fail with "Unkown Table AuditLog or Unkown Column row_hash" — audit logging (Section 10) is silently failing on every tool call | Verify the actual live table has `row_hash`/`prev_hash` columns matching what `agent_loop.py` writes | 🔴 Confirmed broken |
| Job Function queue backing up | Multiple agentic/voice queries running concurrently each take 15-min-capable slots; under load, users queue behind each other | Design the UI to show queue position/estimated wait, and consider a request-priority system (e.g., supervisor queries prioritized over routine lookups) rather than pure FIFO | ⚪ Not yet load-tested |
| Neo4j query performance | Deep multi-hop traversals (Section 2/7) get expensive as the graph grows and as concurrent traversal requests increase | Cache common traversal patterns; add query depth limits with clear UI messaging ("showing 3-hop connections; request deeper analysis" as an explicit, throttled action) rather than letting one user's request degrade everyone's | ⚪ Currently moot — Neo4j is offline in the dev environment; `VajraGraphRAG` transparently falls back to relational ZCQL tracing against Catalyst Data Store instead. This fallback path itself needs the same performance discipline (indexed lookups, not full scans) since it's the path actually running today, not just the backup. |
| LLM rate limits | Catalyst confirmed rate limits trigger a **10-minute lockout** on hitting the cap | Build a request queue/backoff layer in your AppSail backend so a burst of demo-day traffic degrades gracefully (queued, with user-facing wait messaging) rather than throwing raw errors | ⚪ Not yet built — `catalyst_llm.py` currently retries by falling through to local simulation, not a queue/backoff |
| Data Store `select`-only default permissions | Confirmed default is read-only for app users; anything requiring write (seeding, audit logging) needs explicit permission escalation — a security feature, but one that needs correct configuration or writes silently fail | Explicitly document which functions need `insert`/`update` scope and grant only those, not blanket permissions — least-privilege by design, which also directly satisfies the security requirement in Section 10 | 🟢 Working — OAuth scope `ZohoCatalyst.tables.rows.CREATE,ZohoCatalyst.zcql.CREATE` confirmed functional for seeding |
| **Data volume too thin to prove scalability** | Live seeded data is currently ~80 CaseMaster rows — DBSCAN, semantic memory TF-IDF indexing, trend/seasonal analysis, and district-skew queries all behave qualitatively differently at this volume than at real scale, so "it works" on the demo dataset doesn't demonstrate "it scales" | Re-seed at ~8,000-10,000 rows using distributions calibrated against real aggregate KSP/NCRB-style statistics (crime-type ratios, seasonality, district skew, outcome funnel — computed and documented separately), rather than uniform-random generation | 🟡 Calibration weights computed, generator update in progress |

**Security specifics for a police system (beyond generic app security):**
- **Role-based data segmentation is not optional here** — a junior investigator plausibly shouldn't see everything a DIG sees. Use Data Store's org/user-level scoping (confirmed available) to enforce this at the data layer, not just hidden in the UI — a UI-only restriction that the API doesn't enforce is not real security.
- **Audit every read of sensitive data, not just writes** — for a police accountability system, "who looked at this case file and when" matters as much as "who edited it." Your audit_log table (Section 10) should log reads on sensitive tables, not just writes.
- **Synthetic data still deserves realistic security modeling** — even though your actual submission data is synthetic (confirmed, no real PII involved), building the security architecture *as if* it were real production data is exactly the "production-grade, not throwaway" quality the judges said they're evaluating for.

---

## Summary: Priority Order for Remaining Build Work

*(Original priority list below, kept for record — see status column for what's actually
true as of the latest live verification, not the original plan.)*

| # | Item | Status |
|---|---|---|
| 1 | Agentic conversation loop with tool-calling + session memory | 🟡 Real LLM function-calling loop exists (`agent_loop.py`, 13 tools) — but the actual GLM-4.7-Flash endpoint call is misconfigured (404) and session memory Cache writes fail on OAuth scope, so the *architecture* is right but neither is functioning live yet |
| 2 | Explainability UI surfacing existing SHAP/graph data | 🟢 Done — SHAP waterfall chart, citation pills on every tool response, `isSimulated` degraded-mode banner |
| 3 | Audit log table + supervisor-facing activity view | 🟡 Hash-chained audit logging is implemented in code (`_write_audit_log`, real SHA-256 chaining) but the live `AuditLog` table doesn't match the expected schema, so it's failing silently on every call |
| 4 | Financial transaction node type added to existing graph | 🟢 Done — `query_financial_links` tool, real ZCQL against `FinancialTransaction` |
| 5 | Simple time-series forecasting layer | 🟢 Done for on-request forecasting (`get_forecast`); proactive/unprompted early-warning alerts are a newer addition, in progress |
| 6 | Voice pipeline via Zia chaining | 🔴 Not done — `/api/voice/process-stream` is a hardcoded mock, always returns the same canned transcription regardless of actual audio |
| 7 | PDF export of conversation history | 🟢 Done — real FPDF generation, real button in `AIChatScreen.tsx` |

**Also since this document was first written:** DBSCAN hotspot clustering exists as a
trained model (`dbscan_hotspots.joblib`) but was never wired into the `query_hotspots`
tool — fix in progress. Kannada translation (`IndicTrans2Translator`) is a hardcoded
two-phrase stub, not a real translator, despite the class name — this is a launch
blocker given bilingual support is the problem statement's first written requirement,
not yet fixed as of this writing.

---

*This document should live in your repo (e.g., docs/REQUIREMENTS_ARCHITECTURE.md) as the source of truth judges and teammates can reference against your actual build — directly demonstrating the "production-grade thinking" the judges said they're evaluating for.*
