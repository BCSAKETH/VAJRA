> **STATUS UPDATE (2026-09-15, later same day):** Tier 1 items 2.1-2.4,
> Tier 2 items 3.1/3.2/3.3/3.6/3.7, and Tier 7 item 7b.2 are now BUILT and
> DEPLOYED (see `vajra_cognitive_brain.py`/`agent_loop.py` git history same
> date). Two corrections to this document's own earlier claims, found while
> building: (1) §7b.1's "networkx not yet called anywhere" was WRONG --
> Louvain community detection (`louvain_communities`) was already live in
> `vajra_core.py`/`agent_loop.py` since an earlier commit (`bd03289`,
> predating this doc); that item was already done, not built again. (2)
> §3.1's plan to check "ForensicReport/CCTV/WitnessStatement" tables was
> aspirational -- those tables don't exist in the real schema
> (`docs/SCHEMA.md`, confirmed absent); the shipped version checks real
> existing signals instead (chargesheet filed, arrest/surrender recorded,
> complainant/victim details on file). Still open: 3.4/3.5 (flagged as
> needing a separate design review, not built blind) and 7b.3 (needs an
> actual retrain/redeploy session, not a request-time code change).
>
> ---

# VAJRA Cognitive Brain — Deep Upgrade Plan ("God-Pro-Max" Tier)

> **Scope note:** `docs/VAJRA_God_ProMax_Research_and_Upgrade_Vision.md` and
> `docs/GOD_PROMAX_CRIME_AI_RESEARCH_BLUEPRINT.md` already cover VAJRA's
> *product* surface (voice, maps, network viz, PDF export, RBAC) end to end —
> this doc does not repeat that. This is narrowly about **the Brain itself**
> (`vajra_backend/vajra_cognitive_brain.py`, mixed into `VajraAgentLoop` in
> `agent_loop.py`) — the decision-making layer that decides what to run, how
> to plan multi-step answers, and what to trust before an officer sees it.
> Written 2026-09-15, grounded by actually reading the current file (1180
> lines), not by assumption.

Same discipline the rest of this project holds itself to: **NOW / NEXT / ∞**
per item, and a GREEN/YELLOW/RED feasibility grade against VAJRA's real
constraints (single AppSail process, ~30-36s request kill, one LLM —
GLM-4.7-Flash via Catalyst QuickML, no training infra, ZCQL only). No item
here should be pitched as built until it actually is.

---

## 1. Honest current state (read from the real code, 2026-09-15)

`CognitiveBrainMixin` does exactly four things, and only four:

1. **ROUTING** (`_classify_intent`) — a 3-tier deterministic decider
   (Kannada-script router → multi-tool keyword router → single-tool keyword
   router) that skips the LLM whenever a fast-path already knows the answer.
2. **RELATIONSHIP UNDERSTANDING** (`_detect_relationship_query`,
   `_resolve_accused_name`, `_answer_relationship_between`) — regex-detects
   a two-named-suspect question and answers it as a relationship, not a
   single-person profile.
3. **PLANNING** (`_is_complex_query`, `_run_semantic_compiler`) — ONE LLM
   call compiles the officer's question into a JSON tool-DAG over
   `_COMPILER_CAPABILITIES`, executed deterministically. Both Standard and
   Full Dossier modes share this one planner; `deep=True` just changes the
   depth instruction.
4. **GROUNDING** (`_grounding_safety_net`) — the one checkpoint every answer
   passes through before the officer sees it. Currently catches exactly TWO
   things: a POCSO-redaction miss, and a fabricated/misquoted **case number**
   (regex cross-check of narrative text against the answer's own citations).

Adjacent, but only loosely coupled to the Brain:
- **SOTIE** (`tool_training_optimizer.py`) — multi-armed bandit tool-weight
  learning + gold exemplars + entity-alias normalization. Feeds telemetry,
  does **not** feed the planner's own tool-selection prompt.
- **Semantic memory** (`vajra_core.VajraSemanticMemory`) — a real vector
  index (SentenceTransformer embeddings, TF-IDF fallback) over FIR
  narratives, ~250 documents live. Used for MO/similar-case matching only;
  not a general long-term memory the Brain consults on every turn.
- **Hypothesis generation** (`_generate_hypotheses_and_devils_advocate`) —
  one bounded, Dossier-only LLM call: 2-3 scored investigative theories +
  one devil's-advocate critique of the leading theory, over already-grounded
  findings. Self-scored by the same model that produced the findings — never
  independently checked against a fresh tool call.

**What "Brain" is NOT, honestly:** not a trained model, not multiple neural
networks, not a real multi-agent system today. One LLM, several deterministic
guardrails and heuristics around it. Every upgrade below either hardens that
honestly, or adds a *second distinct persona/prompt* over the same one model
— never a claim of new trained intelligence VAJRA doesn't have the infra for.

---

## 2. TIER 1 — Harden what exists (highest leverage, lowest new-surface risk)

These are fixes/extensions to the four mechanisms already in production, in
the same spirit as the H.0 fix already shipped this session (a narrow gap in
`_rewrite_query_with_context` that let a short "now try" confirmation slip
past the planner).

### 2.1 Generalize the grounding net beyond case numbers
**File:** `vajra_cognitive_brain.py::_grounding_safety_net`
- **NOW:** extend Item 24's regex cross-check pattern (cited vs. mentioned)
  from case numbers only to any structurally-identifiable entity the
  narrative names but the answer's own `data`/citations never produced:
  phone numbers, vehicle plates, IFSC codes, Aadhaar-shaped numbers. Same
  "flag as UNVERIFIED, never silently absorb" discipline already used.
- **NEXT:** numeric-claim grounding — if the synthesized text states a
  percentage/count (e.g. "72% risk", "14 linked transactions"), verify that
  number actually appears in the raw tool payload (`data.risk_score`,
  `len(data.financial_transactions)`) that produced it. Catches the LLM
  inventing or rounding a number during narrative synthesis.
- **∞:** a general claim-decomposition pass — split the final narrative into
  atomic factual claims, verify each against the turn's own tool outputs,
  and inline-flag any claim with no supporting data. This is the real
  "hallucination detector" version of what Item 24 already does narrowly.
- **Feasibility:** GREEN for NOW/NEXT (pure regex/dict lookups, zero new
  infra, same cost profile as the existing check — "cheap by construction"
  per the function's own docstring). ∞ is YELLOW — needs care that the
  decomposition step itself doesn't become a second hallucination surface;
  keep it regex/structural, not another free-form LLM call grading itself.

### 2.2 Plan self-critique before execution
**File:** `vajra_cognitive_brain.py::_run_semantic_compiler`
- **NOW:** the exact bug class H.0 just fixed for one specific phrasing
  ("now try" after a refusal) generalizes: after the compiler emits a DAG,
  run one cheap deterministic check — does the plan's step list cover every
  clause of a compound request (split on "and"/","; each clause should map
  to ≥1 planned step or an explicit reason it doesn't apply)? If not,
  append a one-line correction instruction and re-ask the compiler once
  before falling back to the original plan.
- **NEXT:** feed the plan-coverage check into `_last_compiler_failure_reason`
  so a genuinely uncovered clause surfaces as a real diagnostic to the
  officer ("I planned steps for X but not Y — please ask Y separately")
  instead of silently dropping it.
- **Feasibility:** GREEN. One extra bounded LLM call only on the
  re-ask path (rare), not on every turn.

### 2.3 Replace the keyword-count complexity classifier
**File:** `vajra_cognitive_brain.py::_is_complex_query`
- **Current:** `_COMPLEX_STRONG_CUES` substring match OR 2+ capability
  keyword hits joined by "and"/",". Same failure shape as the H.0 bug — any
  new phrasing needs a manually-added cue forever.
- **NOW:** widen the cue list with the common paraphrases already known from
  live bugs (already partly done for H.0's confirm-cue case).
- **NEXT:** replace with a cosine-similarity check against a small set of
  known complex-query exemplars using the semantic memory's own
  SentenceTransformer embedder (already vendored, already loaded) — same
  mechanism as SOTIE's gold exemplars, applied to routing instead of tool
  choice. Generalizes instead of needing a new cue per gap.
- **Feasibility:** GREEN — the embedder is already in-process; this is a
  ~10-line addition, not a new dependency.

### 2.4 Wire SOTIE into the planner's own tool-selection
**Files:** `tool_training_optimizer.py`, `vajra_cognitive_brain.py::_run_semantic_compiler`
- **Current:** SOTIE tracks bandit weights + gold exemplars but the
  compiler's `registry` string (built from static `_COMPILER_CAPABILITIES`
  text) never reads them.
- **NEXT:** inject the top-weighted gold exemplars for the query's nearest
  neighbors directly into the compiler's system prompt (few-shot, not fine-
  tuning) and use bandit failure-rate as a soft down-rank hint in the
  capability registry text ("tool X has a recent low success rate for
  queries like this — prefer Y if applicable").
- **Feasibility:** YELLOW — real value, but needs care that a bad bandit
  weight doesn't create a self-reinforcing bad routing loop; ship behind a
  telemetry-only "shadow mode" first (log what it *would* have changed
  without changing behavior) before it affects real routing.

---

## 3. TIER 2 — The Multi-Brain Council (the actual "next level")

Not new trained models — **distinct persona layers** (system prompt + tool
subset + output shape) over the same GLM-4.7-Flash, orchestrated by an
extension of the existing `_classify_intent` routing trail. This is the
honest way to get "specialized brains" on infra with no training pipeline:
prompting-level specialization, not architectural — same pattern the
project already uses for Kannada-vs-English routing.

### 3.1 Investigator Brain (sharpen what exists)
The current planner answers the literal question. A real investigator
proactively names *gaps*: no forensic report on file, CCTV window not
indexed, no second witness statement yet.
- **NOW:** add a standing gap-checklist step to Dossier-mode plans — for a
  case-scoped Dossier, deterministically check for the presence/absence of
  ForensicReport/CCTV/WitnessStatement-adjacent data already in ZCQL results
  and append a "Missing/Pending" section to `_assemble_master_dossier`.
- **Feasibility:** GREEN — pure post-processing over data the plan already
  fetched, no new LLM call.

### 3.2 Officer/Field-Ops Brain
A genuinely different persona for "what do I do right now" queries: short,
procedure-citation-heavy, safety-first, phone-readable — not the same
dossier-shaped prose for every query regardless of who's asking or why.
- **NOW:** a lightweight query-shape detector (imperative + short + no
  analytical keywords, e.g. "what do I do about X") routes to a distinct
  system-prompt variant with a hard output-length cap and mandatory
  statute-citation formatting, reusing the exact tools already selected —
  only the synthesis prompt/persona changes, not the planning.
- **NEXT:** a real UI toggle ("Field Mode") so the officer explicitly picks
  the persona rather than relying on heuristic detection.
- **Feasibility:** GREEN — this is a prompt/formatting fork of the existing
  synthesis step, no new tools or infra.

### 3.3 Legal/Prosecutor Brain
Repurposes the existing devil's-advocate mechanism (today: argues
*investigative* theory only) into a chargesheet-sufficiency critique.
- **NOW:** a second, distinct prompt variant of
  `_generate_hypotheses_and_devils_advocate` — same "reason only over
  already-grounded findings, never invent" discipline — asking specifically:
  does the evidence support the BNS/BNSS sections already cited by
  `check_penal_compliance`? Any chain-of-custody gap visible in the
  findings? Triggered when the query is chargesheet/prosecution-framed
  ("can we charge", "is this enough evidence"), not by default.
- **Feasibility:** GREEN — reuses the exact scaffolding (one bounded call,
  same confidence-pruning, same "return null rather than invent" fallback)
  that already ships and is already proven safe in production.

### 3.4 Supervisor/Command Brain
Pattern-of-patterns across officers/districts/cases — nothing today looks
*across* sessions.
- **NEXT:** a scheduled (not per-turn) aggregation job — reuses
  `case_outcome_analytics`'s existing COUNT pattern per district over a
  rolling window, flags districts/officers with a statistically significant
  delta vs. their own trailing baseline. Surfaces into the Supervisor
  Dashboard as a new panel, not a chat answer.
- **Feasibility:** YELLOW — real value, but is genuinely new
  infrastructure (a background job + a threshold-tuning pass to avoid noisy
  false alarms), not a persona-prompt fork like 3.1-3.3.

### 3.5 Forensic/Technical Brain
Multimodal evidence gets described (Section 9) but nothing tracks what
forensic steps are still outstanding per case.
- **NEXT:** a per-case "evidence checklist" data model (what's been
  uploaded/analyzed vs. what a case of this `CrimeHead` type typically
  needs) surfaced alongside existing multimodal analysis output.
- **Feasibility:** YELLOW — needs a real schema decision (what "typically
  needed" means per crime type) before it's buildable; flag for design
  review before implementation, not a quick prompt fork.

### 3.6 Standing Red-Team Brain
Elevate the hypothesis critique (today: Dossier-only) into an always-on
pass for Standard-mode answers that cross a stakes threshold — an arrest
recommendation, a risk score near a decision boundary, a POCSO-adjacent
answer.
- **NOW:** trigger `_generate_hypotheses_and_devils_advocate`'s
  devil's-advocate half (skip the full hypothesis list) on Standard-mode
  answers matching a narrow, explicit trigger list (risk score within ±10
  of the HIGH/MODERATE boundary already used in `_assemble_master_dossier`,
  or an explicit "should we arrest/charge" query shape).
- **Feasibility:** GREEN — same bounded, already-proven call; the only new
  work is the trigger condition and keeping it narrow enough not to add
  latency to routine lookups.

### 3.7 Orchestrator (ties the council together)
Extends `_classify_intent`'s existing `decided_by` trail from "which router
picked this tool" into "which persona(s) should own this turn" — so a
compound request ("add tasks AND tell me if we can charge under X") routes
pieces to both the Investigator and Legal personas instead of one generic
voice doing both jobs badly.
- **NEXT:** a small persona-routing table keyed off query shape (same
  keyword/embedding techniques as 2.3), logged with its own `decided_by`
  value for traceability — extends an existing, already-audited pattern
  rather than inventing a new decision mechanism.
- **Feasibility:** YELLOW — straightforward once 3.2/3.3/3.6 exist as real
  triggerable personas; do this LAST, after the personas it's orchestrating
  are individually proven.

---

## 4. TIER 3 — Memory & personalization

- **NOW:** nothing — the 250-vector semantic index is already real and
  already used for MO-matching; no gap to close at NOW tier.
- **NEXT:** extend semantic memory from on-demand similarity search into a
  standing "you asked about this before" signal — on a new turn, a cheap
  similarity check against the officer's own recent query history (not the
  whole FIR corpus) surfaces "this is similar to your query from 3 days ago
  about X" as a citation-style note, reusing the same embedder.
- **∞:** per-officer persistent investigation knowledge graph connecting new
  queries to old leads across sessions — already flagged as ∞-tier in the
  existing God-ProMax vision doc; this Brain plan doesn't change that grade.
- **Feasibility:** NEXT is GREEN (same embedder, bounded to one officer's
  own history — small index, cheap). ∞ stays RED per the existing vision
  doc's own infra-constraint reasoning (no external graph DB on this stack).

## 5. TIER 4 — Model-layer & latency

- **NOW:** nothing new needed — the 3-tier deterministic router already
  keeps most queries off the LLM entirely; this is the correct existing
  design, not a gap.
- **NEXT:** for the routing/classification decisions that DO need a model
  call (2.3's embedding classifier is NOT an LLM call — cheap), avoid ever
  reaching for the full "thinking" GLM call for anything except final
  synthesis and planning. Audit `_classify_intent`'s LLM-touching paths to
  confirm none of them already do this needlessly.
- **Feasibility:** GREEN — this is an audit/verification item, likely
  already true; do it before assuming a gap exists.

## 6. TIER 5 — Self-improvement / feedback loop

- **NEXT:** SOTIE currently learns from explicit 👍/👎 only. Add an implicit
  negative signal: if an officer's next message is a close rephrase of their
  immediately-prior message (high embedding similarity, sent within a short
  window), log it as an implicit "that didn't work" signal for the
  original query's chosen tool, feeding the same bandit weight update path
  telemetry already uses.
- **∞:** a fixed regression suite (SOTIE's own gold exemplars, run
  periodically against the live deployment) to catch silent quality
  regressions from prompt/model changes before an officer does.
- **Feasibility:** NEXT is GREEN (pure telemetry addition, same storage
  already used for bandit weights). ∞ is YELLOW — needs a scheduled job
  (Catalyst Cron or similar), real but not exotic infra.

## 7. TIER 6 — Explainability / telemetry

- **NEXT:** extend the `decided_by` routing trail (already real, already
  logged) with a `plan_rationale` string per DAG step — surfaced in the
  existing Court-Admissible Provenance HUD/ZCQL log, not a new UI.
- **NEXT:** a honesty-catch dashboard panel — the grounding net already logs
  every catch distinctly (`grounding_guardrail_caught`,
  `pocso_safety_net_caught`); a Supervisor Dashboard panel surfacing catch
  rate over time closes the loop on whether upstream generation quality is
  improving or regressing, using data that's already being written.
- **Feasibility:** GREEN for both — this is surfacing data that already
  exists, not generating anything new.

---

## 7b. TIER 7 — Real ML, grounded in what's actually vendored (added 2026-09-15)

Per direct request to add "more ML/complex things" to this plan: the honest
answer is NOT more prompt-layer personas (Tier 2 already covers that
ground) but the CLASSICAL ML this stack already has real, working
infrastructure for — XGBoost+SHAP (the risk model) and SentenceTransformer
embeddings (semantic memory) are already load-bearing in production. This
tier is scoped to real, vendored libraries only, confirmed by listing the
actual `vajra_backend/vendor/` directory before writing a single line here
— not assumed from what a typical Python ML stack usually has.

**Confirmed vendored today:** `sklearn`, `xgboost`, `shap` (all already
used), and **`networkx`** — present in vendor/ but, as of this plan's own
2026-09-15 diff, not yet called anywhere in `agent_loop.py`. That changes
the feasibility grade on one specific item from an earlier planning
document (`nifty-marinating-blossom.md`'s own accounting table): "Syndicate
Radar" (Louvain community detection) was graded "confirmed NOT built, no
networkx call anywhere" — true, but the *library* was never actually
missing, only the application code calling it. Worth re-grading GREEN, not
a new-dependency item.

### 7b.1 Syndicate Radar — real Louvain community detection
**Files:** `vajra_backend/agent_loop.py` (new `detect_syndicate_communities`
tool), reuses the existing shared-attribute graph `community_detection`/
`centrality_ranking` already build (phone/vehicle overlap edges).
- **NOW:** `networkx.algorithms.community.louvain_communities` over the
  SAME graph `community_detection` already constructs — real modularity-
  based clustering instead of that tool's current simpler connected-
  components approach, surfacing groups that aren't fully mutually
  connected but still statistically cluster together (the actual definition
  of an emerging syndicate, not just "everyone linked to everyone").
- **Feasibility:** GREEN — `import networkx` inside the tool function
  (lazy, matching this file's own established convention for every other
  optional library), zero new vendor footprint since it's already present.

### 7b.2 Isolation Forest anomaly detection — beyond the existing z-score check
**Files:** `vajra_backend/agent_loop.py` (`anomaly_detection` tool, already
exists per this file's own capability list, currently a monthly z-score +
category-momentum break).
- **NEXT:** `sklearn.ensemble.IsolationForest` (already vendored, zero new
  dependency) over a real per-case feature vector (crime type, station,
  day-of-week, victim/accused counts) to flag individually anomalous CASES,
  not just anomalous monthly aggregates — a genuinely different, finer-
  grained signal than the existing district-level trend break.
- **Feasibility:** GREEN — same vendored sklearn already used for the risk
  model; this is a second, small estimator, not new infrastructure.

### 7b.3 Risk model recalibration — a real, already-known gap
**Files:** `vajra_backend/train_risk_model.py` / `train_risk_model_v2.py`,
`calibrate_risk_model.py` (all already exist).
- Flagged honestly in an earlier planning document
  (`docs/VAJRA_God_ProMax_Research_and_Upgrade_Vision.md`, Part 2 item 7):
  the deployed risk model was confirmed live to predict ~0% for nearly
  every suspect, with one feature ("Year Temporal") dominating every
  prediction — a real calibration gap in the flagship ML feature, not a
  hypothetical. Not re-solved by this document; restated here so it isn't
  lost across planning docs. **NOW:** class-imbalance handling (SMOTE or
  class weights) + isotonic calibration, using the already-vendored
  sklearn/xgboost stack — no new library, a training-script fix.
- **Feasibility:** GREEN, but needs an actual retrain-and-redeploy pass
  (`calibrate_risk_model.py` already exists for exactly this), not a
  request-time code change like everything else in this document.

### 7b.4 Cross-reference: 2.3's embedding classifier is also real ML
Tier 1 item 2.3 (replace the keyword-count complexity classifier with a
cosine-similarity check against the already-loaded SentenceTransformer
embedder) is itself a real ML technique, not just a heuristic swap — noted
here so it isn't read as a lesser fix than this tier's additions.

---

## 8. Build order (dependency-aware, not just impact-ranked)

1. **2.1** (generalize grounding beyond case numbers) — standalone, zero
   dependencies, highest trust-per-effort.
2. **2.3** (embedding-based complexity classifier) — standalone, unlocks
   3.7's routing approach later.
3. **3.3** (Legal/Prosecutor Brain) + **3.6** (Standing Red-Team) — both
   reuse the exact same proven hypothesis-generation scaffolding; build
   together since they share the trigger-detection groundwork.
4. **3.2** (Officer/Field-Ops Brain) — standalone prompt fork, independent
   of everything else.
5. **2.2** (plan self-critique) — build after 2.3 exists, since a better
   complexity classifier reduces how often the compiler is even invoked
   incorrectly in the first place.
6. **3.1** (Investigator gap-checklist) — needs a real per-CrimeHead
   "what's typically expected" list defined first (small design task).
7. **2.4** (SOTIE→planner wiring) — do this only after 2.1-2.3 are stable;
   shadow-mode first per 2.4's own feasibility note.
8. **3.7** (Orchestrator) — last, once 3.2/3.3/3.6 exist as real triggerable
   personas to orchestrate between.
9. **3.4** (Supervisor Brain) / **3.5** (Forensic Brain) — real new
   infrastructure/schema work; treat as a separate design review, not a
   quick addition alongside the rest of this list.
10. **7b.1** (Louvain Syndicate Radar) — standalone, reuses the existing
    shared-attribute graph, do any time after 2.1-2.3 are stable.
11. **7b.2** (Isolation Forest anomaly detection) — standalone, independent
    of everything else in this list.
12. **7b.3** (risk model recalibration) — highest real-world impact of
    anything in this document (the flagship ML feature currently
    under-discriminates), but requires an actual retrain/redeploy cycle,
    not a request-time code change; schedule it as its own work session.

## 9. What this plan deliberately does NOT claim

No fine-tuned model, no separate neural networks per "brain," no external
vector/graph database, no training pipeline — none of that exists on this
stack (single AppSail process, no GPU, no training infra) and this plan
does not pretend otherwise. Every "brain" here is a prompt/persona layer
over one real model (GLM-4.7-Flash) plus deterministic guardrails, exactly
like the four mechanisms already in production. That honesty is itself
part of what makes the existing grounding net credible — a plan that
oversells its own mechanism would undercut the one thing the Brain is
actually for.
