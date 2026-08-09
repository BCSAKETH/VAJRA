# VAJRA — Master Investigation Intelligence `/loop` Prompt

Combines two tracks into one execution plan:
- **Track A** — the per-case Investigation Intelligence Engine (replaces the
  serial 8-call Full-Dossier orchestration).
- **Track B** — the platform-wide roadmap (network centrality, cross-district
  linkage, risk calibration, hotspot trend, MO embeddings, external
  news/social signals, multi-lens explainability).

Track A is deliberately staged first: it builds the concurrent-fetch,
graceful-degradation, and single-synthesis patterns that every later Track B
phase reuses instead of reinventing.

Fill in a local test login before running live-verification steps — do not
commit real credentials, this repo is public (see landmine #16). Not run yet;
saved for reuse across sessions. Copy the fenced block into `/loop` when ready.

```
/loop Build VAJRA's Investigation Intelligence Engine (Track A) and then extend
it into the platform-wide Investigation Intelligence Layer (Track B). Self-paced
loop: one vertical slice per iteration, verify + deploy + live-check + commit
each slice, score against the rubric, and fix anything below 4/5 before moving
on. Do NOT batch many unverified changes. Stop when the rubric passes live for
every phase attempted and the whole layer is resilient to a GLM outage.

==================================================================
ROLE
==================================================================
You are the founding core AI/systems engineer for a Karnataka State Police
crime-intelligence platform (VAJRA, Zoho Catalyst). You think in two hats each
iteration:
  1) SYSTEMS ENGINEER — correctness, latency, resilience, clean data, platform
     limits (Catalyst-specific, see landmines).
  2) INVESTIGATING OFFICER / CHIEF / CRIMINOLOGIST — does this output actually
     help solve or prevent a case? Is the reasoning across signals coherent,
     evidence-backed, and actionable, not just decorative?

==================================================================
OBJECTIVE
==================================================================
TRACK A — Investigation Intelligence Engine (per case)
Replace generate_case_dossier's serial chain of 8 blocking sub-tool calls
(each doing its own GLM/ZCQL round-trip) with a purpose-built engine:
  A1. CONSOLIDATED DATA LAYER — one batched, CONCURRENT pass of ZCQL reads
      (case facts, accused, victims, applied sections, timeline events,
      similar cases, co-accused network edges, risk features). No per-panel
      LLM round-trips for data fetching.
  A2. DETERMINISTIC ANALYTICS (no LLM) — XGBoost+SHAP conviction risk,
      graph/DBSCAN network + centrality, timeline sort, cosine similar-cases.
      All local, fast, reliable.
  A3. CROSS-SIGNAL REASONING — connect risk drivers <-> network centrality <->
      timeline anomalies <-> similar-case MO into ONE coherent assessment,
      plus a prioritized "what to investigate next." This is the actual
      dossier value, not stapled tool outputs.
  A4. ONE synthesis + ONE batched EN->KN translation at the end (not 6 GLM
      calls).
  A5. GRACEFUL DEGRADATION — ~90% is deterministic, so the engine MUST
      complete with fully-populated panels even when GLM/translation are
      DOWN, degrading only the narrative to a clean template. NEVER crash
      prod, NEVER fabricate data.
Target: dossier wall-clock from sum(sub-calls) to ~max(single slowest fetch);
completes even under a GLM outage.

TRACK B — Platform-Wide Investigation Intelligence Layer
Extends Track A's patterns outward from single-case to district/state scope:
  B1. Network centrality is already built in A2 — surface it standalone in
      detect_crime_groups too (hub member per organized-crime group), not
      just inside dossiers.
  B2. CROSS-DISTRICT LINKAGE — detect when an accused name (name + age-bracket
      match, not name alone) appears in cases across more than one district;
      surface as a confidence-labeled lead in the District Analytics tab, with
      a full investigation-report drill-down reusing A3's cross-signal
      reasoning and A1's per-case data layer.
  B3. RISK MODEL CALIBRATION — reliability curve + Brier score for
      get_offender_risk's XGBoost output, so a 0.8 score means ~80% real
      reoffense rate, not just a ranking. Datathon-submission deliverable.
  B4. HOTSPOT TREND DELTA — diff DBSCAN cluster density across two time
      windows (e.g. last 60 days vs prior 60) to flag growing vs shrinking
      hotspots, reusing cluster_hotspots.
  B5. MO EMBEDDING SIMILARITY — precomputed (never live-per-query) embeddings
      of case narratives, cached, cheap cosine-similarity scan at query time,
      to catch MO matches beyond exact keyword overlap.
  B6. EXTERNAL SIGNALS (news/social) — scheduled ingestion from curated
      official sources only (no private-account scraping), rule-based entity/
      location extraction (no per-article GLM calls), matched against
      existing offender/location data with the SAME confidence discipline as
      B2, surfaced as a district-scoped alert with source citation.
  B7. MULTI-LENS EXPLAINABILITY — one GLM call producing three short sections
      (Investigator / Supervisor / Compliance) from the same evidence, not
      three separate calls. Compliance lens must flag any sociological
      correlation that risks becoming a biased proxy (e.g. migration/
      economic-stress indicators used as if they were guilt signals).

==================================================================
HARD INVARIANTS (breaking any = the iteration fails)
==================================================================
- NEVER fabricate data. Missing/unavailable -> say so plainly (honest
  fallback), same discipline as the rest of the codebase.
- Keep auth/RLS (security_firewall, unit_filter), the audit hash-chain,
  two-person approval, and full bilingual EN/KN. (Note: the dossier Facts
  panel is intentionally case-scoped, not unit-RLS-filtered, for dossier
  coherence — keep that behavior.)
- Every AI-surfaced link/score (dossier risk, cross-district lead, external
  signal) is a LEAD with a confidence label and evidence trail, never
  presented as confirmed fact. Nothing auto-notifies another district without
  an officer confirming first.
- Every new scheduled/heavy computation goes through a Catalyst Job Scheduler
  function or the existing async+poll pattern — never a synchronous AppSail
  endpoint doing more than ~25s of real work.
- Verify before every deploy: `python -m py_compile` (backend),
  `npx tsc --noEmit` + `npx vite build` (frontend). Deploy via
  `catalyst deploy --only appsail|client`. Then LIVE-verify (see
  VERIFICATION).
- One change -> deploy -> verify -> commit. Commit messages explain the WHY.
  Do not batch multiple phases into one commit.

==================================================================
KNOWN LANDMINES + REQUIRED SOLUTIONS (do NOT rediscover these the hard way)
==================================================================
1. ZCQL OFFSET PAGINATION IS BROKEN at scale — `LIMIT offset,300` silently
   DUPLICATES and SKIPS rows over ~20k. SOLUTION: keyset-paginate on ROWID
   only: `WHERE ROWID > <last> ORDER BY ROWID ASC LIMIT 300`, track max ROWID,
   dedupe.
2. CaseMasterID IS NON-UNIQUE JUNK — the value 1 maps to 5 unrelated crimes.
   NOT a case identifier, NOT a safe join/uniqueness key. SOLUTION: use ROWID
   for row identity and CrimeNo for the business case number. Accused/Victim
   link by CaseMasterID is many-to-noisy; treat those counts as approximate
   and keep train<->serve feature construction identical.
3. ZCQL COUNT(DISTINCT) LIES — returns the row total, not distinct count.
   SOLUTION: never trust it; verify counts by enumeration or GROUP BY (GROUP
   BY aggregates ARE reliable and sum correctly).
4. CASE OUTCOME lives on the row: CaseMaster.CaseStatusID (3 = CONVICTED, per
   CaseStatusMaster). Do NOT derive outcomes via the broken ChargesheetDetails
   join. Risk model is trained on CaseStatusID==3 (~34.8% base rate).
5. ZCQL has NO JOINs / NO subqueries and a 300-row cap per non-aggregate
   query. SOLUTION: fetch tables separately, join in Python; page everything
   via ROWID keyset (#1).
6. KANNADA DOUBLE-JSON-ENCODING — real Kannada in a dict, json.dumps(default
   ensure_ascii=True) -> "\uXXXX" in the string (reversible if loaded ONCE). A
   SECOND dumps produces "\\uXXXX" -> after one load you get literal "ಪ" text
   = gibberish on screen. SOLUTIONS: (a) store dicts and dump exactly ONCE,
   never re-serialize already-serialized data; (b) keep the frontend's
   defensive decode of literal \uXXXX at render (decodeDisplayText in
   ChatBubble); (c) prefer ensure_ascii=False where you control the response.
7. data_json PERSISTENCE CAP — stored data_json is capped at 60000 chars
   (column takes ~100k). Keep panel payloads LEAN (no giant raw dumps) so
   dossiers/reports persist intact; truncation mid-JSON silently wipes the
   message.
8. APPSAIL ~30-36s REQUEST KILL — no LLM-backed or heavy-compute path can run
   inline in the request. SOLUTION: fast "pending" ack, run as a background
   task, client polls GET /api/sessions/{id}/messages until the assistant
   message with data.panels appears. Persist as soon as data is ready, enrich
   narrative after — don't let a worker recycle mid-run lose the result.
9. CONCURRENCY MODEL — run_agent_loop runs SYNC inside a threadpool worker.
   Use concurrent.futures.ThreadPoolExecutor for parallel ZCQL/ML fetches
   there. In main.py's async layer, use asyncio.gather + run_in_threadpool.
   Do NOT mix an event loop into the sync agent loop.
10. GLM/ZIA ARE FLAKY — intermittently "temporarily unavailable," and NOT on
    the critical path. SOLUTIONS: deterministic core must finish without
    them; wrap every LLM/translate call in try/except with a templated
    fallback; only attempt panel-body translation when translation is proven
    healthy (main answer's text_kn actually contains Kannada script) so an
    outage never stacks timeouts.
11. SPURIOUS QUERY TRANSLATION — in Kannada mode an already-English query
    still gets sent kn->en and can fail the whole turn. SOLUTION: detect
    already-Latin/English text and SKIP the kn->en step.
12. TRANSLATION LATENCY — never translate panel bodies one-by-one serially.
    Batch or run concurrently; skip widget panels (they render a visual, not
    text). Store text_kn per panel; frontend prefers text_kn in Kannada mode.
13. ML ARTIFACT VERSION LOCK — models MUST be pickled with the prod vendor
    versions (xgboost 2.1.4, scikit-learn 1.7.2, numpy 2.2.6, scipy 1.16.3) or
    they silently load as None in Catalyst. SHAP TreeExplainer is rebuilt from
    the model at load; FIR_YEAR is held constant (leak neutralized) — don't
    reintroduce the year leak.
14. FRONTEND CONTRACT — panels are data.panels[]: {type, panel_key, title_en,
    title_kn, text, text_kn, data}. Widget panels use WIDGET_PANEL_TYPES and
    render via InlineWidget; non-widget panels render decoded text. Don't
    break this shape when adding B2/B6 panels.
15. NEVER let a bad/slow model or a down service degrade into a crash or a
    fabricated answer. Degrade gracefully, disclose honestly.
16. CREDENTIALS — this repo is PUBLIC. Never commit real login credentials,
    API keys, or tokens into any file (including loop prompts, test scripts,
    or commit messages). Use local-only env vars / a gitignored secrets file.
17. CATALYST ENVIRONMENT IS DEVELOPMENT, NOT PRODUCTION — confirmed live via
    .catalystrc (active env id 2 = Development) and the X-Catalyst-Environment
    header in functions/proactive_alerts/index.py. A commonly-cited "5,000
    rows/table, 25,000 rows/project" Development cap does NOT hold for this
    project — CaseMaster is already 20,900+ rows and Accused ~14,000 (35,000+
    combined) and the app runs fine, so that figure is stale/inapplicable here
    and is NOT a blocker. Still: don't assume unlimited headroom either — if a
    new Track B table write ever fails with a quota/limit error, that's the
    signal to check actual current limits directly (Catalyst console or
    support), not this outdated number. No STOP condition from this landmine
    alone.
18. FUNCTION-TYPE CONFUSION — Basic/Advanced I/O functions cap at 30s; only
    Job Scheduler/Cron functions get 15 min. proactive_alerts.py's own
    full-table pagination proves it must already run as a Job Scheduler
    function. Any new scheduled work (B2, B6) must be registered the same
    way — verify the function type in the Catalyst console before assuming
    a 15-minute budget.
19. NAME-ONLY ENTITY MATCHING = FALSE POSITIVES — Accused has no unique
    ID/alias field (per SCHEMA.md). Any cross-referencing (B2, B6) on name
    alone will collide on common names. SOLUTION: require name + age-bracket
    agreement minimum, always show the confidence basis, never auto-notify
    without officer confirmation.
20. SQL STRING ESCAPING — new ZCQL inserts built via f-strings (as
    proactive_alerts/index.py already does) must escape entity-derived text
    the same way it does: .replace("'", "''"). Reuse the pattern, don't
    rewrite it.
21. NO LIVE PER-ITEM LLM CALLS FOR BULK WORK — NER on news articles (B6) or
    embeddings for MO similarity (B5) must NEVER run one-call-per-item at
    request time or inside a tight job loop: GLM is 15-140s/call, which blows
    both the 30s AppSail gateway and the 15-min job budget past a handful of
    items. SOLUTION: rule-based/regex extraction for bulk NER; precompute and
    cache embeddings in the scheduled job (incremental, only new/changed
    cases); reserve GLM for one summary call per CONFIRMED match, never per
    raw item.
22. HIGH-VOLUME RAW TEXT -> OBJECT STORAGE, NOT ZCQL — raw articles (B6) and
    embedding vectors (B5) belong in Stratus (already wired via
    catalyst_stratus.py), not new ZCQL table rows, to protect the 25k-row
    project cap in landmine #17.
23. LEGAL/ToS — no scraping of private social-media accounts for B6. Official
    APIs / public RSS feeds only.

==================================================================
PER-ITERATION WORKFLOW
==================================================================
Suggested phase order (Track A first — it's the reusable substrate; Track B
phases lean on A1's concurrent-fetch pattern and A3's cross-signal reasoning
rather than reinventing them):

Phase 0  Platform verification: confirm Production vs Development environment
         (landmine #17) and the function type of any job you'll extend
         (landmine #18). Do this before any other phase.
Phase 1  [A1] Consolidated concurrent data layer + ROWID keyset pagination,
         returning one structured dossier data bundle.
Phase 2  [A2] Deterministic analytics wired off that bundle: risk+SHAP,
         network graph + centrality, timeline sort, similar-cases — no new
         LLM calls.
Phase 3  [A5] Graceful-degradation path: full panels with templated narrative
         when GLM/translation are stubbed/unavailable. Prove it by simulating
         an outage.
Phase 4  [A4] Single batched synthesis + concurrent EN->KN translation,
         health-guarded per landmine #10.
Phase 5  [A3] Cross-signal reasoning + "what to investigate next" panel.
Phase 6  [B1] Surface centrality standalone in detect_crime_groups (reuses
         Phase 2's graph code).
Phase 7  [B2] Cross-district linkage: scheduled-job detection (reuse Phase 1's
         keyset pattern) + District Analytics panel + drill-down report
         (reuse Phase 5's cross-signal reasoning per linked case).
Phase 8  [B3] Risk model calibration (reliability curve + Brier score),
         wired into get_offender_risk.
Phase 9  [B4] Hotspot trend delta (two-window DBSCAN diff).
Phase 10 [B5] MO embedding similarity — precomputed cache, live path is
         cosine-similarity only.
Phase 11 [B6] External news/social signal pipeline — curated sources, rule-
         based extraction, confidence-labeled district alerts.
Phase 12 [B7] Multi-lens explainability — apply across dossier (Phase 5),
         chat responses, and B2/B6 reports.
Phase 13 Latency + payload-size hardening pass across everything (lean
         data_json per landmine #7, cache within a turn).

Per phase:
1. Implement the one slice.
2. Verify: py_compile / tsc / vite build as applicable.
3. Deploy the affected target.
4. LIVE-verify (see below). For Track A phases, include a NEGATIVE test:
   force/stub a GLM failure and confirm the dossier STILL returns
   fully-populated panels (no crash, no fake data). For Track B phases whose
   alerts depend on baselining (B2, B6), verify a rerun does NOT duplicate an
   already-surfaced lead.
5. Score against the rubric. If any dimension < 4/5, fix before continuing.
6. Commit + push a verified checkpoint (repo: https://github.com/BCSAKETH/VAJRA).

==================================================================
VERIFICATION (must be live, not assumed)
==================================================================
- Login with a local test account (badge/password from your own local env —
  see landmine #16; do not hardcode here) -> Bearer token.
- Track A: POST /api/chat {message:"full dossier for case CR-2024-81977",
  lang:"en"|"kn", answer_mode:"dossier"} -> expect a fast "pending" ack. Poll
  GET /api/sessions/{session_id}/messages until data.panels appears. Confirm:
    * all expected panels present and POPULATED (not empty),
    * kn mode: titles AND bodies in real Kannada, no literal \u gibberish,
    * risk panel score VARIES across suspects, FIR_YEAR SHAP ~ 0,
    * total time materially lower than the old serial dossier,
    * NEGATIVE test: with GLM/translate unavailable, panels still fully
      populated via deterministic core + templated narrative.
- Track B: for B2/B6, seed a known test case pair (or article) that SHOULD
  trigger a lead; confirm it surfaces once, with confidence + evidence shown,
  in the correct district panel(s); confirm a rerun doesn't duplicate it. For
  B3, produce the calibration table/plot as an actual artifact, not just code.
- /api/health shows dbscan/xgboost/shap/encoders active after any model
  touch.
- Because Catalyst services are intermittently degraded, do NOT claim
  "verified" until you have actually observed a clean result come back; if
  the service is down, say so and retry rather than asserting success.

==================================================================
RUBRIC (score each 1-5 every iteration; all must reach >=4 to stop)
==================================================================
1. Correctness & no-fabrication (grounded in real ZCQL/ML; honest on gaps).
2. Resilience (completes under GLM/translation outage; never crashes prod).
3. Speed (Track A ~max-single-call not sum, measured live; Track B stays
   inside Job Scheduler/AppSail time budgets).
4. Investigative value (coherent cross-signal analysis + actionable next
   steps — judged with the officer/chief/criminologist hat).
5. Invariants intact (auth/RLS/audit/two-person/bilingual, frontend panel
   contract, lead-not-fact discipline).
6. Platform safety (environment/function-type verified before any new table
   or scheduled job per landmines #17-18; row-cap budget checked).
7. Verified live (observed a clean end-to-end result, incl. any negative
   test).

Stop when all phases attempted score >=4 live. If a phase can't reach 4 due to
a service outage (not the code), pause and report honestly rather than
forcing a green.
```
