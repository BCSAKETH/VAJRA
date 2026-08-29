# VAJRA — Master Build Prompt (for Antigravity / any coding agent)

> Paste this whole file as the agent's instructions. It must build every feature in
> §7 to the SAME bar the current codebase was built to: grounded, honest, verified
> live, deployed on Catalyst, committed as the repo owner. Read §1–§6 fully before
> writing any code. Do NOT skip the verify/deploy loop. Do NOT break existing behavior.

---

## 1. What VAJRA is
VAJRA (ವಜ್ರ) is a bilingual (English + Kannada), voice-enabled AI copilot for the
Karnataka State Police, over a CCTNS-schema crime database. Officers ask in plain
language; VAJRA answers with grounded data + the right inline visualization (map,
risk gauge, network graph, charts). It is deployed **only** on Zoho Catalyst.

## 2. The stack (do not swap any of it)
- **Frontend:** React 19 + TypeScript + Vite + Tailwind v4. Entry screens in `src/screens/`, widgets in `src/components/`. i18n in `src/i18n.ts` (EN + KN).
- **Backend:** Python 3.11 + FastAPI on **Catalyst AppSail**. `vajra_backend/`.
- **Data:** **ZCQL** data store (relational, CCTNS schema). No external DB.
- **AI:** GLM + Qwen via Catalyst **QuickML** (`catalyst_llm.py`, `catalyst_qwen.py`); Zia TTS/STT/translate (`catalyst_speech.py`); XGBoost+SHAP + DBSCAN (models loaded at startup).
- **Deploy:** `catalyst deploy --only appsail` (backend), `catalyst deploy --only client` (frontend, after `npm run build`). Secrets in `vajra_backend/.env`.
- **Live app:** frontend `https://vajra-60074806366.development.catalystserverless.in/app/index.html`, backend `https://vajra-backend-50043584602.development.catalystappsail.in`. **Login: badge `2346836` / password `HackaThon2026`** (this badge is the ONLY supervisor; everyone else is an officer).

## 3. NON-NEGOTIABLE INVARIANTS (breaking any of these fails the task)
1. **Never fabricate.** Every name/number/station/date/section MUST come from a real ZCQL/ML result. If the data lacks it, say so honestly ("not recorded"). No random/simulated values, ever. (A fabrication fallback was already removed once — do not reintroduce that pattern.)
2. **Preserve auth, RLS, audit, bilingual.** Server-side row-level security (queries scoped to the officer's unit/station), the tamper-evident SHA-256 audit hash-chain, KGID auth + role tiers, and EN/KN parity must keep working. Supervisor tier = badge `2346836` only (`SUPERVISOR_KGIDS` in `vajra_core.py`); the Supervisor tab is hidden for officers.
3. **Never leak the model's chain-of-thought.** `_strip_think` guards this; keep it.
4. **No secrets in commits.** `.env` stays untracked.

## 4. ZCQL & platform gotchas (already learned the hard way — obey them)
- **ZCQL `LIKE` uses `*` as the wildcard, NOT SQL `%`.** (`WHERE col LIKE '*term*'`.)
- **No JOINs / no subqueries.** Resolve relations in Python (fetch, map by id). Example: CaseMaster has no DistrictID — map `PoliceStationID → Unit → DistrictID` in code.
- **Non-aggregate SELECT is capped at 300 rows.** `COUNT`/`GROUP BY` are NOT capped — prefer them for totals.
- **ROWID is the true key.** `CaseMasterID` is non-unique junk. Escape single quotes in any interpolated value.
- **Inserts:** use `zcql_insert_row` / `zcql_update_row` from `vajra_core.py` (they route to the correct API host; the SDK's `insert_row` silently POSTs to the wrong domain and fails). `zcql_insert_row` returns None — to get a new row back, embed a uuid in a field and re-`SELECT ... LIKE '*uuid*'`.
- **AppSail kills any HTTP request at ~30s.** GLM turns take 15–140s. The chat flow already handles this: `chat_endpoint` returns a fast `pending` ack and runs the turn as a background task; the frontend polls `GET /api/sessions/{id}/messages`. Keep this pattern for anything slow. (The permanent fix is §7.9 Job Scheduling.)
- **`ChatMessage.data_json` truncates at ~10,000 chars.** Oversized payloads get hard-sliced into invalid JSON → the widget renders blank. `_fit_json` (main.py) must keep JSON valid by trimming lists/fields; the cap is 9200. Any new large payload MUST go through `_fit_json` or be trimmed to fit.
- **GLM is slow and flaky.** Always provide a deterministic grounded fallback so a query returns a real answer even when GLM is down (route via `_keyword_route_tool` / the specific `_handle_*` handlers; the loop's `last_tool_text_result` shows grounded tool output when synthesis fails). Prefer the fast deterministic path; use GLM only when needed.
- **Deploys take ~5 min.** You cannot run two `catalyst deploy` at once.

## 5. Codebase map (where things live)
- `vajra_backend/main.py` — all FastAPI endpoints; `chat_endpoint` (async pending+background), `_persist_chat_message` + `_fit_json`, PDF `export_pdf_endpoint` + `_screen_export_sensitivity` + export-approval endpoints (`/api/exports/*`), attachments (`upload_chat_attachments`, `_rasterize_pdf`, `_stitch_vertical`), alerts, cowork, consistency flags, `connection_manager` (WebSocket broadcast).
- `vajra_backend/agent_loop.py` — `run_agent_loop` (the brain: header strip → Kannada route → attachment handling → entity resolve → thinking-lane handlers → semantic compiler → multi/fast keyword route → GLM loop → synthesis/fallback); `_keyword_route_tool`, `_keyword_route_multi`, `_route_kannada`, `_resolve_entities` (+ `_NAME_STOPWORDS`), `_execute_tool` (all tool branches), `_run_semantic_compiler`, `_is_complex_query`, `_compute_*` grounded aggregates, `_AGG_CACHE`.
- `vajra_backend/catalyst_llm.py` — GLM chat + `translate_fast` + `_down_until` cooldown. `catalyst_qwen.py` — Qwen fallback. `catalyst_speech.py` — Zia TTS/STT. `internet_signals.py` — `web_search` (dual scraper, `_cache_get/_put` TTL pattern). `vajra_core.py` — `zcql_insert_row/update_row`, RLS, audit hash-chain, `SUPERVISOR_KGIDS`, `derive_role_tier`, cache helpers.
- `vajra_backend/functions/proactive_alerts/index.py` — **precedent** for a standalone Catalyst Function (its own token + direct ZCQL REST, no AppSail `catalyst_app`). Copy this shape for any new Function.
- `src/screens/AIChatScreen.tsx` — chat screen (composer, modes Standard/AI-Reasoning/Dossier, export flow, polling), `SupervisorDashboardScreen.tsx` (ledger, flags, live export-approval queue), `DistrictDashboardScreen.tsx` (analytics), `SpatialScreen.tsx` (leaflet + DBSCAN).
- `src/components/InlineWidget.tsx` (`NewsView` + all widget types), `ChatBubble.tsx`, `ChatInput.tsx`, `NetworkGraph.tsx` (2D SVG).

## 6. THE WORKING LOOP (do this for EVERY change — this is "the way it's built")
1. **Investigate first** — read the real file/function; find the existing pattern to copy. Don't invent new patterns when one exists.
2. **Edit** minimally and in the surrounding style.
3. **Verify it compiles** BEFORE deploy: backend `python -m py_compile vajra_backend/*.py`; frontend `npm run build` (tsc + vite must be green).
4. **Deploy** the right target (`--only appsail` and/or `--only client`).
5. **Verify LIVE** — log in as `2346836/HackaThon2026`, run the real query end-to-end, and confirm the actual output (poll `ChatMessage` in ZCQL or hit the endpoint). Never claim success without a live check. `.env` has `CATALYST_PROJECT_ID/CLIENT_ID/CLIENT_SECRET/REFRESH_TOKEN` for direct ZCQL verification.
6. **Commit + push** as the repo owner (author BCSAKETH). **Never add a `Co-Authored-By` trailer.** One focused commit per logical change, with a message saying what + the live-verified result.
7. **Don't regress** — after each change, smoke-test the other response types (hotspots/network/risk/trend/count/news/case) still work.

---

## 7. THE BUILD LIST (build ALL of these, each to §6's bar)

### 7.1 D2 "Vajra Gold" UI/UX redesign (reskin only — zero logic change)
- **Goal:** apply the Vajra Gold identity across every screen. Reference: the published design spec (warm charcoal `#161311/#211f1d`, soft gold `#c79a4e/#e4c590`, teal `#5dcaa5`, danger `#e24b4a`; display *Bricolage Grotesque*, body *IBM Plex Sans*, mono *IBM Plex Mono* for HUD labels). Tactical HUD eyebrows (`◈ RISK · XGBOOST`), gold hairlines, tinted user bubbles, bare-text AI answers, big rounded voice composer, expand→side-panel.
- **Files:** `src/index.css` (token vars), then every screen/component in `src/screens/` + `src/components/`. Recolor only.
- **HARD RULE:** do NOT touch `AppContext` logic, `i18n.ts` strings, API contracts, RLS/audit/two-person/EN-KN behavior, or data. Keep light+dark handling.
- **Accept:** `npm run build` green; walk every screen (Login, AI Chat + all widget types, New Investigation, Cowork, Spatial, Analytics, Supervisor, Settings, Expand panel) — same data/flows, new skin; EN/KN toggle still works.

### 7.2 Widget → image capture in the PDF
- **Goal:** the exported PDF embeds the ACTUAL chart/map/network images, not "see console".
- **Approach:** on export, the frontend captures each rendered widget to PNG (SVG widgets → serialize `<svg>` → canvas → dataURL; leaflet map → `leaflet-image` or capture the canvas/tiles; Recharts is SVG). Send `{transcript, widget_images:[{msg_id, dataUri}]}` to `export_pdf_endpoint`. Backend decodes each dataURI and places it via fpdf `pdf.image()` under the matching message, sized to the content width.
- **Files:** `src/screens/AIChatScreen.tsx` (`handleExportPDF`/`buildTranscript`), `src/components/InlineWidget.tsx` (expose a capture hook per widget), `vajra_backend/main.py` (`export_pdf_endpoint` — accept + embed images; they count toward the size budget, downscale like `_downscale_image`).
- **Accept:** export a chat with a hotspots map + a risk chart + a network graph → the PDF shows those images inline, under the right messages, on the existing letterhead/watermark/seal. Text-only messages unaffected.

### 7.3 New Investigation — full detailed view + USP
- **Goal:** a real case workspace, not just a titled chat. Bind an FIR/CR number → auto-summary; invite officers; a persistent **evidence rail** where any widget can be pinned; a case snapshot (station, registered date, accused count, sections, linked cases).
- **Approach:** reuse `generate_case_dossier` / the grounded case bundle (`_handle_case_question`) for the snapshot; reuse the cowork participant model for invites; "pin to case" stores the widget spec on the session. Persist within existing tables (ChatSession/CoworkParticipant) — do NOT rely on creating new ZCQL tables (admin scope unavailable; reuse existing tables like the export approval flow reused ProactiveAlerts).
- **Files:** `src/screens/AIChatScreen.tsx` (New Investigation modal + rail), `NewInvestigationModal`, `vajra_backend/main.py` (case snapshot endpoint if needed, pin storage).
- **Accept:** create an investigation bound to a real CR number → snapshot shows grounded facts; pin a widget → it persists on reload; invite flow works; nothing fabricated.

### 7.4 Cowork — detailed view + USP + fully instant/lag-free
- **Goal:** live multi-officer thread that feels instant. Presence dots, per-officer color, typing indicator, `@vajra` gating (already exists), instant message delivery + instant history load.
- **Approach:** messages already broadcast over `connection_manager` WebSocket — ensure the client renders optimistically on send (local echo, dedupe by `client_msg_id`) and subscribes to the session WS for others' messages (no full refetch). History loads instantly from the durable `ChatMessage` store. Presence via a lightweight WS "join/leave/typing" event.
- **Files:** `src/screens/AIChatScreen.tsx` (WS subscription, optimistic echo, presence), `CoworkInvitationsPanel`, `vajra_backend/main.py` (`connection_manager`, add presence/typing broadcast events).
- **Accept:** two browsers in one cowork session → a message from A appears on B in <1s with no refresh; history loads instantly on open; `@vajra` still gates the AI.

### 7.5 Hotspots USP — time-slider + time×location depth
- **Goal:** beyond a static DBSCAN map: a time-of-day × day-of-week heat matrix per district, and a time-slider that recomputes clusters per time-block ("thefts cluster on Market Rd 20:00–02:00").
- **Approach:** pure ZCQL aggregate over `CaseMaster` timestamps + `Inv_OccuranceTime` (hour/day buckets) + existing DBSCAN on lat/long filtered by the selected time-block. Cache via the `_AGG_CACHE` TTL pattern. Client renders the matrix + slider.
- **Files:** `vajra_backend/agent_loop.py` (new grounded aggregate + a `query_hotspots` time param), `src/screens/SpatialScreen.tsx` / `InlineWidget.tsx` (matrix + slider).
- **Accept:** the heat matrix numbers reconcile with real COUNT aggregates; moving the slider changes the clusters; grounded, cached, fast.

### 7.6 Web search "analyze + structure" (synthesis)
- **Goal:** the deep 60-result sweep should produce a *structured analysis* (key themes, who/what/where, a short synthesis + the sources), not just a card list.
- **Approach:** after `internet_signals.web_search(q, 60)`, synthesize the titles+snippets into structured findings (a bounded GLM/Qwen call, with a deterministic fallback that groups by source/keyword if the model is down). Keep the honest "unverified open-web leads, not official record" boundary. Respect the ~10k `data_json` cap via `_fit_json` (store the synthesis text + a trimmed source list).
- **Files:** `vajra_backend/agent_loop.py` (`web_search` branch in `_execute_tool`), `src/components/InlineWidget.tsx` (`NewsView` — show the synthesis above the source cards).
- **Accept:** "analyse the internet about cyber crime in Karnataka" → a structured summary (themes + sources) renders and persists as valid JSON; never presents web leads as official records.

### 7.7 Live/instant dashboard counts (WebSocket, no refresh)
- **Goal:** supervisor dashboard counts (pending exports, flags, alerts) update with no manual refresh, pushed not just polled.
- **Approach:** broadcast a lightweight WS event on the relevant writes (new export request, new flag) to a supervisor channel; the dashboard updates its counts on receipt. Keep the 5s poll as the reliable fallback (multi-worker AppSail). Do NOT make cooldown/global state cross-instance-shared.
- **Files:** `vajra_backend/main.py` (`connection_manager` supervisor channel + broadcasts), `src/screens/SupervisorDashboardScreen.tsx`.
- **Accept:** an officer's flagged export appears in the supervisor's queue count within ~1s without refresh; polling still works if WS drops.

### 7.8 (Do §7.1–§7.7 first; these are the designed architecture items.)

### 7.9 Job Scheduling migration — permanent "AI never times out" fix
- **Follow `docs/SCALE_AND_JOBS_DESIGN.md` exactly.** Move GLM-turn execution off AppSail onto Catalyst Job Scheduling instant jobs (`vendor/zcatalyst_sdk/job_scheduling/_job.py` → `submit_job()`/`get_job()`). `chat_endpoint` submits a job instead of `asyncio.create_task`; a new standalone Function `functions/chat_turn/index.py` (copy `proactive_alerts` isolation pattern) runs the turn and persists via the existing ChatMessage path so the frontend poll is unchanged.
- **VERIFY LIVE FIRST (blockers — do before building):** (a) does this account's credentials have **ADMIN scope** for `submit_job`? (we already hit `OAUTH_SCOPE_MISMATCH` on the table-admin API — test a trivial `submit_job` first); (b) create + memory-provision a **Job Pool** in the Catalyst Console (manual, one-time); (c) measure the effort to make `agent_loop.py` importable from a standalone Function (it currently binds `vajra_core.catalyst_app`). If (a) fails, STOP and report — do not fake it.
- **Accept:** a 120s GLM turn completes and persists via a job (no 30s/5-min-scaledown death); frontend shows the answer via the same poll; surface `job_status` (Submitted/Pending/Running) as honest "queued" signaling.

### 7.10 Statewide scale — per `docs/SCALE_AND_JOBS_DESIGN.md`, in priority order
- **§0 resolve first (report, don't code):** billing tier (free tier caps 5,000 DB insertions/month — every chat msg/audit row/session bump counts), AppSail 500-concurrent ceiling, QuickML inference SLA.
- **Then:** (2) widen `_keyword_route_tool` + reorder cascade to keyword→Qwen→GLM (reduces GLM demand); (3) shared short-TTL cache on questioner-independent aggregates (`query_hotspots`, `get_crime_trends`, `get_case_types_distribution`, `rank_districts`, `count_cases`) via the `internet_signals` `_cache_get/_put` shape / extend `_AGG_CACHE`; (4) raise AnyIO thread limiter + give the GLM call its own `CapacityLimiter`; replace `catalyst_llm._down_until` single-trip with a rolling-window (3 fails/30s) **per-process** counter; move `_get_mo_profiler`/`_get_section_ordinal_map` lazy-init to eager startup (main.py `VajraAgentLoop(...)`); (5) adaptive frontend poll backoff (2s→6-8s); (6) honest backpressure using real `job_status`.
- **Accept:** load-tested behavior documented; no fabrication; each item follows the existing pattern named above.

---

## 8. Final checklist for the agent
- [ ] Every item §7.1–§7.10 built, each verified LIVE (login 2346836/HackaThon2026), deployed on Catalyst.
- [ ] `python -m py_compile` + `npm run build` green before every deploy.
- [ ] No fabricated data anywhere; honest "not recorded" where data is absent.
- [ ] RLS, SHA-256 audit chain, KGID auth + supervisor-only tab, EN/KN parity all still pass.
- [ ] ZCQL `*` wildcards, no JOINs, 300-row cap respected; large payloads through `_fit_json`.
- [ ] One focused commit per change, authored as the repo owner, **no `Co-Authored-By`**, message states the live-verified result.
- [ ] No secrets committed.
- [ ] Existing response types (hotspots/network/risk/trend/count/news/case, EN+KN) still work after each change.
