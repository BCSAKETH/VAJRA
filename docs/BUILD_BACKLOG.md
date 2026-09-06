# VAJRA — Build Backlog (from implementation_plan.md, grounded against real code)

> Status legend: ✅ built · 🟡 partial (some real, gaps listed) · 🔴 not built.
> "Build as described" flags where the plan's framing is aspirational vs. what's
> actually feasible on the real stack (Catalyst + ZCQL + GLM/Qwen, real CCTNS data).
>
> **RE-AUDITED 2026-09-06** against the live deployed app (this doc was stale --
> written before several later build sessions). 6 of the 14 items below moved from
> 🔴/🟡 to ✅ since this was last updated: #1 (Cognitive Brain), #2 (POCSO shield),
> #6 (district air-lock), #7 (viral radar/OSINT), #12 (SSE streaming), #13 (video
> keyframes). Each entry below is marked with its ORIGINAL status (kept for
> history) and its CURRENT verified status.

## A. The 14 engineering steps (plan §16)

### 1. Cognitive Neural Brain — `vajra_cognitive_brain.py`
- **Plan:** BPE tokenizer + multi-head self-attention + semantic DAG compiler + CCTNS grounding firewall + KGID verification.
- **Original status: 🟡 partial** (module didn't exist yet).
- **Status now: ✅ built.** `vajra_cognitive_brain.py` is real, exists, and is mixed into `VajraAgentLoop` (`CognitiveBrainMixin`) exactly as this item asked: routing (`_classify_intent`), relationship understanding, planning (`_run_semantic_compiler`), and grounding (`_grounding_safety_net`, now doing TWO real checks — POCSO redaction and, as of 2026-09-06, case-number cross-referencing against an answer's own citations) all live in one documented module. Still honestly no custom BPE tokenizer / trained attention network — VAJRA uses GLM/Qwen via QuickML, and the module's own docstring says so explicitly rather than claiming otherwise.

### 2. POCSO Legal Stealth Shield & Auto-Redaction — `vajra_core.py`
- **Plan:** rank-based PII masking of minors + sexual-offence victims (§74 JJA); SP/DIG unmask with logged justification.
- **Original status: 🔴 not built.**
- **Status now: ✅ built.** `is_pocso_sensitive`, `redact_pocso_name`, `has_active_pocso_grant`, `create_pocso_request`/review workflow, the `_grounding_safety_net` last-line redaction catch, AND acoustic redaction in TTS ("Identity Protected under Section 74 Juvenile Justice Act" spoken instead of a masked/raw name) are all real, live, and independently verified this project across multiple sessions.

### 3. Hawala/UPI Mule Money-Trail Graph — `financial_graph.py` + `FinancialGraphModal.tsx`
- **Plan:** BFS/Dijkstra 3–8 hop shortest-path, mule/bridge/cash-out hub detection, D3/Cytoscape graph in chat.
- **Original status: 🟡 partial** (2-hop only).
- **Status now: ✅ built (multi-hop), no dedicated files.** `detect_financial_ring` in `agent_loop.py` now does true multi-hop BFS (`MAX_HOPS = 6`, bounded to 40 nodes) with hub detection, confirmed matching spec exactly. No separate `financial_graph.py` module or `FinancialGraphModal.tsx` widget exists — the capability reuses the existing network-graph widget contract instead (same pattern as every other tool in this codebase), which is a real, working, lower-effort substitute for a dedicated file, not a gap. Data caveat (sparse `FinancialTransaction` coverage) still applies.

### 4. Court-Admissible Provenance HUD — `ChatBubble.tsx`
- **Plan:** collapsible drawer showing exact ZCQL SQL, 5D vector cosine distance, SHA-256 Merkle hash (§65B IEA).
- **Original status: 🟡 partial** (missing the exact query + hash in the drawer).
- **Status now: ✅ built.** `start_zql_log()`/`get_zql_log()` capture every real SQL string the turn executes and attach it as `data._zcql_provenance`; `ChatBubble.tsx`'s "Why this answer?" expander renders both `_zcql_provenance` (the real queries) and `_provenance.hash` (SHA-256) directly — confirmed in the live component code. Still missing: a literal "5D vector cosine distance" figure in the drawer (MO-similarity scores are shown elsewhere, not in this specific panel) — a minor, low-value gap.

### 5. 30-Day Crime Horizon Forecaster — `predictive_engine.py`
- **Plan:** time-series over 3y FIR timestamps + festival dates + economic indicators via Zia AutoML; proactive spike alerts.
- **Status: 🔴 not built as described — unchanged, deliberately paused.** Real: `get_forecast` (baseline trend extrapolation) + `ForecastResults` + `proactive_alerts` exist. A genuine ARIMA/Prophet seasonal forecaster was scoped and then explicitly paused by the user (compiled-dependency risk on the Linux deploy target, can't dry-run on Windows dev) — see project memory. Still open, still the user's call to reopen.

### 6. Inter-District Security Air-Lock (Two-Person ABAC) — `TwoPersonApprovalModal.tsx`
- **Plan:** cross-district case-diary request → supervisor push + 1-tap OTP → 24h decryption token; Catalyst Circuits.
- **Original status: 🟡 partial** (missing the cross-district request flow + TTL grant).
- **Status now: ✅ built, and extended.** `POST /api/district-access/request` → Supervisor queue → `POST /api/district-access/{id}/review` → `has_active_district_access_grant` TTL grant is real and live, exactly the pattern this item asked for. Beyond the original plan: a Section 185 BNSS **emergency break-glass** variant (`POST /api/district-access/emergency`, self-approved + immediately time-boxed + mandatory ≥30-char statutory justification + always surfaced for supervisor post-hoc review) was added and verified live 2026-09-06. Still no Catalyst Circuits (unnecessary — the TTL-grant pattern achieves the same outcome without it).

### 7. Autonomous Viral Radar & OSINT — `autonomous_viral_radar.py`
- **Plan:** 15-min cron + SmartBrowz crawling trends/Insta/YouTube/news; viral-velocity + toxicity scoring; Cache; instant chat answer.
- **Original status: 🔴 not built.**
- **Status now: ✅ built (as the honest, simpler version this doc itself suggested).** New Catalyst Job function `functions/osint_radar/` sweeps Google News RSS across 6 statewide threat categories (cyber fraud, narcotics, organized crime, terror, communal unrest, trafficking) every run, dedupes by URL, and posts alerts into the real officer notification feed with a §63 BSA unverified-lead disclaimer — verified live (6 real alerts inserted, 0 duplicates on re-run). Deliberately NOT built via SmartBrowz/social-media crawling or "viral velocity/toxicity scoring" (both already correctly flagged here as aspirational) — RSS is the reliable, non-scraping lane this project settled on after confirming DuckDuckGo/Bing scraping gets blocked. One remaining manual step: the recurring cron *schedule* itself needs a one-time setup in the Zoho Catalyst Console (a platform limit, not a code gap).

### 8. Mobile Camera Lens + Live AR HUD — `ChatInput.tsx` + `TacticalLensModal.tsx`
- **Status: 🔴 not built — unchanged, deliberately paused.** Explicitly paused by the user (low value-per-effort, no face-reference DB or live video feed on the real stack) — see project memory. Still correctly assessed as largely infeasible on this stack as originally specced.

### 9. Tactical Geospatial Thermal Density "Gas-Spray" Map — `InlineWidget.tsx` + `agent_loop.py`
- **Status: 🟡 partial — confirmed still a real, open gap (re-checked 2026-09-06).** `query_hotspots` (DBSCAN) + district scoping + pulsing markers + a radar-sweep map animation all exist. Re-grepped `SpatialScreen.tsx`/`InlineWidget.tsx` directly: still no 4-tier heat/KDE gradient layer, and `leaflet.heat` is not an installed dependency (checked `package.json`). Genuinely buildable, low-med effort, not yet done.

### 10. Smart Semantic Chat Titling — `generate_chat_title` in `main.py`
- **Status: 🟡 partial — unchanged, not re-verified as improved.** Sessions still auto-title from the first ~40 characters of the officer's own text. Low effort, still open.

### 11. Golden Crest & Forensic PDF Stamp — `catalyst_smartbrowz.py`
- **Status: ✅ mostly built — unchanged.**

### 12. Sub-200ms Omni-Stream (SSE) — `main.py` + `AIChatScreen.tsx`
- **Plan:** `_SessionSSEManager`, `GET /api/chat/stream/{id}`, optimistic UI, live "thought" streaming.
- **Original status: 🔴 not built** (this was written before `implementation_plan_lag_fix.md`'s SSE plan was executed).
- **Status now: ✅ built.** `cowork_feed.py`'s in-memory ring-buffer SSE publisher backs `GET /api/cowork/stream/{session_id}` (the equivalent of the plan's `_SessionSSEManager`); `AIChatScreen.tsx` consumes it via a `fetch`-based streaming reader (not native `EventSource`, because `EventSource` can't set the `Authorization` header this app needs — a deliberate, documented substitution, not a shortfall) with `client_msg_id`-based dedup of the sender's own optimistic message, confirmed live in the component code. `progress_tracker.py`'s separate SSE ticker (`/api/chat/progress/{id}`) independently covers the "live thought streaming" half of this ask. Not literally sub-200ms end-to-end (that number was never re-measured), but the real mechanism — SSE push replacing 4s polling — is built and live.

### 13. Forensic Audio & Video Keyframe Analysis — `catalyst_speech.py` + `catalyst_qwen.py`
- **Original status: 🟡 partial** (no video keyframe extraction).
- **Status now: ✅ built (keyframes); face matching still correctly not built.** `av_analysis.py` exists: vendored static FFmpeg, deterministic duration probe, evenly-spaced video keyframe extraction, 16kHz audio chunking for Zia STT — confirmed live, matches this item's own "realistic slice" recommendation exactly. 128-d face matching remains not built (no face-reference DB exists on this stack) — correctly still roadmap, not a gap in execution.

### 14. Behavioral MO & Conviction ML Cortex — `vajra_core.py` + `train_risk_model.py`
- **Original status: ✅ mostly built**, missing a surfaced serial-offender MO-similarity flag.
- **Status now: ✅ built, further extended.** The originally-missing piece now exists: `cluster_mo_signatures` (HDBSCAN over 5D MO vectors) is exposed as the `cluster_crime_patterns` tool, reusing the existing crime-groups widget contract. Separately and importantly: the underlying conviction-risk model's calibration was independently audited 2026-09-06 with a proper held-out test split (the existing `calibrate_risk_model.py` evaluates in-sample, which overstates real accuracy) — honest finding: Brier score 0.176 vs. the target ≤0.08, and even after engineering a genuine new feature (prior-offense count), the held-out Brier is statistically identical to an uninformative baseline. The model's ranking/clustering value (MO similarity, repeat-offender detection) is real; its probability-calibration claim is not currently trustworthy and should not be presented as one in a pitch without this caveat.

## B. "All 26 Catalyst capabilities" — the honest gap
The plan claims all 26. Really used: AppSail, ZCQL Data Store, QuickML (GLM/Qwen), Stratus, Cache, Zia Speech+Translate, Auth, Job Scheduling (wired w/ fallback), Cron (proactive_alerts), SmartBrowz (present). **Not used:** NoSQL, Full-Text-Search index, Zia Vision/OCR/ANPR/Face, Zia AutoML, Signals/Event-Bus, Circuits, Mail, Push Notifications, API-Gateway throttling, Connections, Domain Mappings, Pipelines. Adopting each is its own task; several (Vision/ANPR/Face, AutoML) are gated on data/feasibility.

## C. Anything left BEYOND the plan (still-open items I already flagged)
1. **D2 "Vajra Gold" UI/UX reskin** (paused) — every screen, reskin only. Still open; no evidence this was executed.
2. **Widget → image capture in the PDF** (charts/maps as images). Still open, not re-verified as built.
3. **New Investigation** full detailed view + pin-to-case rail. Still open, not re-verified as built.
4. ✅ **DONE (2026-09-06 audit): Cowork fully instant/lag-free.** `implementation_plan_lag_fix.md`'s full SSE plan is built and live — `cowork_feed.py` SSE stream + `client_msg_id` optimistic-echo dedup, confirmed in `AIChatScreen.tsx`.
5. ✅ **DONE: Web-search synthesis.** The "Revamped Internet Search" plan (WS-1 through WS-12) is fully built — citation-aware synthesis directly from search snippets, domain-credibility tiers, SHA-256 evidence hashing, a full collapsible trace-drawer UI, live in-flight progress events, and a Kannada dual-search fallback. See that plan's own status notes for the full breakdown.
6. **Live dashboard push** (WebSocket counts, not just polling) — for the analytics dashboard specifically (distinct from chat, which now has real SSE per #4). Still open.
7. **Job Pool provisioning + ADMIN-scope verification** — ~~to activate the already-wired job path~~. **Partially resolved**: the mechanism itself is now proven working end-to-end via a DIFFERENT, real function (`osint_radar`, deployed 2026-09-06 via `catalyst deploy --only functions:osint_radar`) — Job-type Catalyst functions genuinely deploy and run on this stack. `ai_turn_worker` specifically remains an undeployed stale prototype (wrong schema, fake risk score) — not worth activating as-is; the pattern it needed is now proven elsewhere.
8. **Statewide scale**: widen router, shared aggregate cache, threadpool limiter, rolling-window GLM cooldown, adaptive poll backoff (see `docs/SCALE_AND_JOBS_DESIGN.md`). Still open, not attempted.
9. **Paused "Bureau fixes item B"** (server-side tool-call bounding). Still explicitly paused per the user's own standing instruction — REMIND, don't build without them reopening it.

## Suggested build order (when we start)
1. Quick real wins: #4 provenance HUD, #9 thermal heat map, #10 titling, C.2 widget→PDF, C.5 web synthesis.
2. High-value real: #2 POCSO redaction, #6 cross-district air-lock (reuse approval infra), #3 multi-hop money graph, #14 serial-MO flag.
3. UX: C.1 D2 reskin, C.4 cowork instant, #12 SSE streaming.
4. Infra: C.7 Job Pool activate, C.8 scale, #5 real forecaster (disk-gated).
5. Roadmap / feasibility-gated: #7 viral radar, #8 AR camera/ANPR, #13 face match, B (unused Catalyst services).
