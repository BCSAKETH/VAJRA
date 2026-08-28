# VAJRA — Scale & Job-Scheduling Design (DESIGN ONLY — not yet implemented)

> Two linked concerns: (A) AppSail's ~30s request timeout vs GLM's 15–140s turns,
> and (B) statewide worst-case concurrency. (A) is a **prerequisite** for most of (B).
> Nothing here is built yet. Open questions that need live verification are flagged **⚠**.

---

## 0. Resolve-first (procurement / platform, not code)

These may reorder or moot everything below — settle them before coding:

- **⚠ Catalyst billing tier.** Free tier hard-caps at **5,000 Data Store insertions/month, account-wide**. Every chat message, audit row, and session bump is an insertion — a statewide surge could exhaust it in hours. Past free tier it's a billing trigger (min $5/project), not a hard block. → Procurement conversation with the KSP Catalyst account owner.
- **⚠ AppSail ceiling:** 5 instances × 100 concurrent req = **500 concurrent** total, raised only via `support@zohocatalyst.com` (same channel as the 30s-timeout exception).
- **⚠ QuickML (GLM/Qwen) inference capacity** is unknown to us and **no VAJRA-side architecture multiplies it**. Guaranteed statewide throughput needs a reserved-capacity/SLA conversation with Zoho for the model deployment.

---

## 1. Job-Scheduling migration (highest priority)

**Problem.** Today `chat_endpoint` returns a fast "pending" ack and runs the GLM turn as a fire-and-forget `asyncio.create_task` **inside the AppSail process**; the frontend polls `GET /api/sessions/{id}/messages` every 3s. This works for GLM's real range but has an **unconfirmed ceiling**: AppSail scales down inactive instances after ~5 min of uptime — a long turn with no other traffic on that instance could be killed mid-run, with no chance to persist even an honest failure.

**Target.** Move GLM-turn execution to Catalyst **Job Scheduling "instant job"** (on-demand). AppSail's job shrinks to *accept → validate → enqueue → return* (ms); each of the 500 slots turns over almost instantly instead of being held ~140s, so the same ceiling services far more real traffic.

**Already-confirmed facts (do not re-derive):**
- `vendor/zcatalyst_sdk/job_scheduling/_job.py` has `submit_job()` (POST `/job_scheduling/job`, `source_type: "API"`) and `get_job(job_id)` (returns `job_status`: Submitted/Pending/Running/Successful/Failure) — vendored, currently unused.
- Function-targeted jobs get a **15-min execution ceiling**, decoupled from AppSail's instance lifecycle → removes the 5-min risk entirely.
- `job_config` supports `number_of_retires`/`retry_interval` → free automatic retry (which `_ai_turn_done` lacks today).
- Precedent: `vajra_backend/functions/proactive_alerts/index.py` reimplements its own token fetch + direct ZCQL REST because Functions run isolated from the AppSail-bound `catalyst_app` singleton.

**Design of the new flow:**
1. `chat_endpoint`: persist the user message (as today), then `submit_job()` with params `{session_id, employee_id, unit_id, processed_query, lang, answer_mode, client_msg_id}` instead of `asyncio.create_task`. Return the same fast `pending` ack **plus** `job_id`.
2. **New Function** `functions/chat_turn/index.py` (standalone, proactive_alerts pattern): must reach `agent_loop.py`'s tool-calling, `catalyst_llm.py`'s GLM wire contract, and `catalyst_qwen.py`'s Qwen contract from a Function context — none of which can import the AppSail `catalyst_app`. It runs the turn and **persists the assistant message via the existing ChatMessage path** (its own token + direct ZCQL, like proactive_alerts) so the frontend's existing poll keeps working unchanged.
3. Frontend: unchanged poll of `GET /api/sessions/{id}/messages` still works. **Optionally** also poll `get_job(job_id)` for richer status (Submitted/Pending/Running) to power honest backpressure (§6).

**Open items to verify LIVE before building:**
- **⚠ `submit_job()` uses `CredentialUser.ADMIN`** — unconfirmed whether this app's credentials have admin scope. (We already hit `OAUTH_SCOPE_MISMATCH` on the table-admin API, so this is a real risk.) **Test first.**
- **⚠ Job Pool** must be created + memory-provisioned once in the Catalyst Console before any function can be targeted — a manual step, not code.
- **⚠ Porting effort** for `agent_loop.py` into a standalone Function context (it currently imports `vajra_core.catalyst_app`) — measure before committing.

---

## 2. Widen the keyword router (only lever that *reduces* GLM demand)

`_keyword_route_tool` / `_route_kannada` in `agent_loop.py`. Every query the free deterministic router answers **never touches GLM** — the one resource nothing here can multiply. Under a statewide surge, "fraction of queries that need GLM at all" is the highest-leverage number.

- Widen pattern coverage (more phrasings per intent); extract shared `_guess_*` helpers (district/crime/case/name already exist — consolidate).
- **Reorder the cascade** to try keyword-router → Qwen (independent QuickML deployment) → GLM, so GLM is the last resort not the first.
- Frame explicitly as a **scale lever**, not just latency: this is the surge multiplier.

---

## 3. Shared short-TTL cache for questioner-independent aggregates

Realistic worst case = a major incident makes many officers ask **close to the same thing** within minutes. A 5–15 min cache on DB-grounded, param-only (not who-is-asking) tool outputs turns that surge into **one computed answer reused by everyone**.

- Targets in `_execute_tool`: `query_hotspots`, `get_crime_trends`, `get_case_types_distribution`, `rank_districts`, `count_cases`, distribution/anomaly — anything keyed on district/timeframe/type only.
- Copy the exact shape already in `internet_signals.py` (`_cache_get`/`_cache_put`: module-level dict + `threading.Lock` + TTL). `agent_loop.py` already has `_AGG_CACHE` for a couple of these — generalize it to the list above.
- Per-process (not Catalyst Cache) — see §4 on why cross-instance sharing widens blast radius.

---

## 4. Threadpool / concurrency tuning (second-order — how gracefully it degrades)

- **AnyIO default limiter = `CapacityLimiter(40)`** shared by *every* `run_in_threadpool` (GLM, Qwen, translate, news, web-search, page-fetch all compete). Raise it at startup (`anyio.to_thread.current_default_thread_limiter().total_tokens = N`, sized by load test) **and** give the GLM/agent call its **own** `CapacityLimiter` via `anyio.to_thread.run_sync(..., limiter=...)` so a burst of long chat turns can't starve short translate/news/search calls. **⚠ Much less relevant if §1 moves GLM off AppSail** — but still matters for translate/news/search.
- **`catalyst_llm.py` `_down_until` is a single global timestamp** — one failed request marks the *whole instance* down 45–300s, degrading every concurrent officer into fallback. Replace with a **rolling-window counter** (e.g. 3 failures within 30s) before tripping. **Keep it per-process** — do NOT share via Catalyst Cache (one instance's bad luck would degrade ALL instances' officers).
- **Two unlocked lazy-init races** (`_get_mo_profiler`, `_get_section_ordinal_map`) can cause a thundering herd of identical expensive DB queries under simultaneous first-hits (most likely right after a deploy). Move both to the **eager-startup path** already used for dbscan/xgboost/label_encoders in `main.py`'s `VajraAgentLoop(...)` construction — matches convention, no new locking, cost moves to deploy time.

---

## 5. Adaptive polling backoff (frontend)

`AIChatScreen.tsx`'s pending-reply poll is a fixed 3s for ~2 min. At fleet scale that's meaningful aggregate volume. Start tighter (~2s) and back off the longer a turn stays pending (up to 6–8s) — cuts surge poll traffic without hurting the common-case feel.

---

## 6. Honest backpressure / queue signalling

A true worst-case surge WILL saturate something. Today that shows as a silent long wait then a generic "taking longer than expected" — reads like a break, not load. If §1 lands, surface its real `job_status` (Submitted/Pending/Running → "queued · status X") instead of a vague timeout.

---

## Priority-ordered implementation plan
1. **Resolve §0** (billing tier, AppSail ceiling ask, QuickML SLA) — may reorder everything.
2. **§1 Job Scheduling** — verify ⚠ ADMIN scope + create Job Pool first; then chat_endpoint→submit_job, new standalone `chat_turn` Function reusing ChatMessage persistence.
3. **§2 Router widening** — pure demand reduction on GLM.
4. **§3 Shared aggregate cache** — surge de-duplication.
5. **§4 Concurrency tuning** — cooldown window + eager init first (cheap, safe); threadpool limiter re-evaluated post-§1.
6. **§5 polling backoff**, **§6 backpressure signalling** — polish once §1 gives real job states.

**Verify-live-before-building:** ADMIN credential scope for `submit_job`; AppSail real scaling behaviour under this app's traffic; the actual `data_json`/insertion cost per turn against the billing tier.
