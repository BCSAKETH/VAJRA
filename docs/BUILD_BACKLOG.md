# VAJRA — Build Backlog (from implementation_plan.md, grounded against real code)

> Status legend: ✅ built · 🟡 partial (some real, gaps listed) · 🔴 not built.
> "Build as described" flags where the plan's framing is aspirational vs. what's
> actually feasible on the real stack (Catalyst + ZCQL + GLM/Qwen, real CCTNS data).
> Nothing here is being built yet — this is the ordered backlog for when we start.

## A. The 14 engineering steps (plan §16)

### 1. Cognitive Neural Brain — `vajra_cognitive_brain.py`
- **Plan:** BPE tokenizer + multi-head self-attention + semantic DAG compiler + CCTNS grounding firewall + KGID verification.
- **Status: 🟡 partial.** The DAG semantic compiler (`_run_semantic_compiler`), grounding/quarantine, keyword+Kannada routing, and KGID auth already exist in `agent_loop.py` / `vajra_core.py`. There is **no** `vajra_cognitive_brain.py`, and **no custom BPE tokenizer / trained attention network** — VAJRA uses GLM/Qwen via QuickML, it doesn't train its own transformer.
- **To build:** consolidate the real routing+compiler+grounding into one documented module; drop the "we trained a transformer" framing (fictional). Add a phonetic/transliteration matcher (Metaphone) for broken typing — that part is real and useful.

### 2. POCSO Legal Stealth Shield & Auto-Redaction — `vajra_core.py`
- **Plan:** rank-based PII masking of minors + sexual-offence victims (§74 JJA); SP/DIG unmask with logged justification.
- **Status: 🔴 not built.** (The export **pre-screen** already detects these categories — reuse those rules.)
- **To build:** in tool outputs, detect sensitive-category cases → mask victim PII (name/phone) for lower ranks, unmask for supervisor tier with an audit entry. Real + on real data. **High value, moderate effort.**

### 3. Hawala/UPI Mule Money-Trail Graph — `financial_graph.py` + `FinancialGraphModal.tsx`
- **Plan:** BFS/Dijkstra 3–8 hop shortest-path, mule/bridge/cash-out hub detection, D3/Cytoscape graph in chat.
- **Status: 🟡 partial.** `detect_financial_ring` exists (2-hop over `FinancialTransaction` with hub detection). **Missing:** `financial_graph.py`, the `FinancialGraphModal.tsx` UI, and multi-hop (3–8) traversal. **Data caveat:** `FinancialTransaction` is sparse for entities reachable via suspect/case lookups — a live "ring found" demo needs the specific accounts that have data.
- **To build:** extend to multi-hop; add the interactive graph widget; honest "no transactions → no ring" (already the pattern).

### 4. Court-Admissible Provenance HUD — `ChatBubble.tsx`
- **Plan:** collapsible drawer showing exact ZCQL SQL, 5D vector cosine distance, SHA-256 Merkle hash (§65B IEA).
- **Status: 🟡 partial.** The **"Why this answer?"** expander exists (citations + provenance + analysis type). **Missing:** the exact ZCQL query string, a vector distance, and the per-message audit hash surfaced in the drawer.
- **To build:** thread the real executed query + the stored `AuditLog.row_hash` into the citation payload and render them in the expander. Real + reinforces the trust USP. **Low-med effort.**

### 5. 30-Day Crime Horizon Forecaster — `predictive_engine.py`
- **Plan:** time-series over 3y FIR timestamps + festival dates + economic indicators via Zia AutoML; proactive spike alerts.
- **Status: 🔴 not built as described.** Real: `get_forecast` (baseline trend extrapolation from real monthly COUNTs) + `ForecastResults` table + `proactive_alerts` function exist. **Missing:** `predictive_engine.py`, Zia AutoML, festival-date modeling.
- **To build:** a genuine seasonal forecast (ARIMA/Prophet if the 1GB vendor disk allows — check first) + festival-calendar feature. Drop "Zia AutoML" unless that service is actually provisioned. **Med effort, disk-gated.**

### 6. Inter-District Security Air-Lock (Two-Person ABAC) — `TwoPersonApprovalModal.tsx`
- **Plan:** cross-district case-diary request → supervisor push + 1-tap OTP → 24h decryption token; Catalyst Circuits.
- **Status: 🟡 partial.** RLS already scopes data by unit/district; `TwoPersonApprovalModal.tsx` exists; the **export-approval loop** I just built is the exact pattern (request → supervisor queue → approve → time-boxed grant). **Missing:** the cross-district access request flow + temporary token; no Catalyst Circuits.
- **To build:** reuse the export-approval infra for a "request cross-district access" flow with a TTL grant. Real + buildable without Circuits. **Med effort.**

### 7. Autonomous Viral Radar & OSINT — `autonomous_viral_radar.py`
- **Plan:** 15-min cron + SmartBrowz crawling trends/Insta/YouTube/news; viral-velocity + toxicity scoring; Cache; instant chat answer.
- **Status: 🔴 not built.** Real: `internet_signals.py` scraper (Google News RSS + DuckDuckGo) + `get_live_news`. **Missing:** the autonomous cron radar, velocity/toxicity scoring, viral ranking, Cache pre-warm.
- **To build:** a cron job (via the existing `functions/` pattern) that periodically scrapes crime-relevant news, ranks by recency/frequency, caches a "live radar." "Viral velocity derivatives / toxicity vectors" is aspirational — build a simpler honest ranking. **Med effort.**

### 8. Mobile Camera Lens + Live AR HUD — `ChatInput.tsx` + `TacticalLensModal.tsx`
- **Plan:** mobile-only camera → WebRTC AR viewfinder; ANPR plate + suspect-face detection at 30 FPS.
- **Status: 🔴 not built (largely fictional on this stack).** **Missing:** everything — no `TacticalLensModal.tsx`, no WebRTC, no ANPR, no face match. Needs Zia Vision/Face (not wired) + real plate/face reference data (not available).
- **To build:** realistic slice = a mobile camera capture → send frame to Qwen for description/OCR (works today). Live 30fps ANPR/face-match is **not feasible** on the real stack/data — keep as roadmap. **High effort / partly infeasible.**

### 9. Tactical Geospatial Thermal Density "Gas-Spray" Map — `InlineWidget.tsx` + `agent_loop.py`
- **Plan:** strict district scoping, DBSCAN density, relative intensity normalization, 4-tier thermal color spray (green→red halos), auto-`fitBounds`.
- **Status: 🟡 partial.** `query_hotspots` (DBSCAN) + district scoping + pulsing markers exist. **Missing:** the 4-tier heat/KDE gradient layer + intensity normalization + auto-fit.
- **To build:** add a client-side heat layer (leaflet.heat / KDE) colored by the 4 density tiers over the existing real clusters. Real + very demo-friendly. **Low-med effort.**

### 10. Smart Semantic Chat Titling — `generate_chat_title` in `main.py`
- **Status: 🟡 partial.** Sessions auto-title from the first ~40 chars. **Missing:** clean LLM-generated bilingual (EN+KN) titles.
- **To build:** a small cached titling call (or deterministic template) → tidy EN/KN session titles. **Low effort.**

### 11. Golden Crest & Forensic PDF Stamp — `catalyst_smartbrowz.py`
- **Status: ✅ mostly built.** Official PDF (crest letterhead, diagonal watermark, circular seal, SHA-256 integrity hash, real station names) exists via **fpdf** (not SmartBrowz). "14-layer SVG / gold-foil" is embellishment; the drawn seal is real.
- **Left:** optional — embed the actual chart/map images (that's the separate "widget→PDF capture" item).

### 12. Sub-200ms Omni-Stream (SSE) — `main.py` + `AIChatScreen.tsx`
- **Plan:** `_SessionSSEManager`, `GET /api/chat/stream/{id}`, optimistic UI, live "thought" streaming.
- **Status: 🔴 not built.** Real: fast pending ack + 3–4s polling. **Missing:** SSE streaming, live reasoning stream, `_SessionSSEManager`.
- **To build:** SSE endpoint streaming reasoning steps + optimistic bubble render. Real UX win (feels instant), but AppSail long-lived SSE connections need care under the 30s/scale limits. **Med effort.**

### 13. Forensic Audio & Video Keyframe Analysis — `catalyst_speech.py` + `catalyst_qwen.py`
- **Status: 🟡 partial.** Zia STT (Kannada voice-in) + Qwen image analysis exist. **Missing:** video keyframe extraction (OpenCV/PyAV) + 128-d face matching.
- **To build:** sample video frames → Qwen description/OCR (feasible). Face matching needs a face DB (not available) — roadmap. **Med effort, partly data-gated.**

### 14. Behavioral MO & Conviction ML Cortex — `vajra_core.py` + `train_risk_model.py`
- **Status: ✅ mostly built.** 12-feature XGBoost + SHAP + isotonic calibration (`train_risk_model.py`, `calibrate_risk_model.py`) + `MOBehavioralProfiler` (`get_mo_profile`) all exist. **Missing:** an explicit "5D MO vector cosine ≥0.88 serial-offender flag" surfaced as a feature, and Zia AutoML auto-retrain (retrain is manual scripts today).
- **To build:** surface a serial-offender MO-similarity match; optional AutoML retrain if that service is provisioned. **Low-med effort.**

## B. "All 26 Catalyst capabilities" — the honest gap
The plan claims all 26. Really used: AppSail, ZCQL Data Store, QuickML (GLM/Qwen), Stratus, Cache, Zia Speech+Translate, Auth, Job Scheduling (wired w/ fallback), Cron (proactive_alerts), SmartBrowz (present). **Not used:** NoSQL, Full-Text-Search index, Zia Vision/OCR/ANPR/Face, Zia AutoML, Signals/Event-Bus, Circuits, Mail, Push Notifications, API-Gateway throttling, Connections, Domain Mappings, Pipelines. Adopting each is its own task; several (Vision/ANPR/Face, AutoML) are gated on data/feasibility.

## C. Anything left BEYOND the plan (still-open items I already flagged)
1. **D2 "Vajra Gold" UI/UX reskin** (paused) — every screen, reskin only.
2. **Widget → image capture in the PDF** (charts/maps as images).
3. **New Investigation** full detailed view + pin-to-case rail.
4. **Cowork** fully instant/lag-free (optimistic echo + presence).
5. **Web-search synthesis** (structure the 60 deep results into findings).
6. **Live dashboard push** (WebSocket counts, not just polling).
7. **Job Pool provisioning + ADMIN-scope verification** (to activate the already-wired job path).
8. **Statewide scale**: widen router, shared aggregate cache, threadpool limiter, rolling-window GLM cooldown, adaptive poll backoff (see `docs/SCALE_AND_JOBS_DESIGN.md`).
9. **Paused "Bureau fixes item B"** (server-side tool-call bounding).

## Suggested build order (when we start)
1. Quick real wins: #4 provenance HUD, #9 thermal heat map, #10 titling, C.2 widget→PDF, C.5 web synthesis.
2. High-value real: #2 POCSO redaction, #6 cross-district air-lock (reuse approval infra), #3 multi-hop money graph, #14 serial-MO flag.
3. UX: C.1 D2 reskin, C.4 cowork instant, #12 SSE streaming.
4. Infra: C.7 Job Pool activate, C.8 scale, #5 real forecaster (disk-gated).
5. Roadmap / feasibility-gated: #7 viral radar, #8 AR camera/ANPR, #13 face match, B (unused Catalyst services).
