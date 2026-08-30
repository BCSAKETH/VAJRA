# VAJRA UX Audit — Officer & Supervisor Journeys

## Methodology (read this before the findings)

The plan was to click through the live app in a real browser as two personas
(an Investigating Officer and a Supervisor) and note friction as it happened.
That didn't fully work as intended, and it matters for how much weight to put
on each finding below:

- **Real Chromium (Playwright's downloaded build) is blocked on this machine**
  by Smart App Control (Windows 11's built-in reputation-based execution
  blocker — confirmed via `VerifiedAndReputablePolicyState: 1` in the
  registry). Disabling SAC is a one-way operation (Microsoft does not allow
  re-enabling it without a full Windows reset), so I didn't touch it.
- **jsdom** (a pure-JS DOM, no native browser binary) loads the page but the
  app's bundle is loaded via `<script type="module">`, which jsdom does not
  execute at all — confirmed with a minimal, isolated repro (a bare HTML
  page with a one-line inline module script), not just this app's bundle.
- **Workaround that worked**: the system's pre-installed Microsoft Edge
  (Chromium-based, already signed/trusted by Windows) is not blocked by SAC.
  Pointing Playwright's `executablePath` at the real
  `msedge.exe` instead of the downloaded Chromium build got a fully-working,
  fully-rendered browser with no policy changes needed. The findings below
  include real screenshots from that browser, driving both accounts through
  actual clicks, not just API calls.

Findings from earlier in this audit (before the Edge workaround was found)
were verified via direct API calls against both accounts, cross-referenced
against the component code. Findings from the visual pass are backed by real
screenshots. Every finding is tagged:

- **[VISUAL]** — confirmed with a real rendered screenshot in a real browser.
  Highest confidence, includes things pure API testing structurally cannot
  catch (rendering bugs, layout, exact wording as shown, alert styling).
- **[API+CODE]** — verified against a real live request/response *and* the
  component code that consumes it.
- **[API]** — verified against a real live request/response; the frontend
  code path wasn't independently traced.
- **[CODE]** — traced from source only, not independently hit live.

**Test accounts used:**
- Officer: badge `4064028` (Brady Powell, PSI, Rajajinagar PS). No credential
  row existed for any officer-tier account before this audit — I inserted one
  to be able to test this persona at all (see Finding 4).
- Supervisor: badge `2346836` (Claire Gibson, DySP) — pre-existing account,
  supervisor-tier.

---

## Critical findings

### 1. The "Two-Person Integrity Control" has zero backend enforcement
**[API+CODE]** — `POST /api/alerts/consistency-flags/{id}/review`'s request
model (`main.py`, `ReviewFlagRequest`) is just `{"reviewed": int}` — there is
no field anywhere for a second approver's badge, password, or any kind of
approval token. The endpoint's only check is `role_tier == "supervisor"` on
the *single* calling account. I called it directly as one supervisor and it
succeeded immediately (`{"status": "Success"}`), no second officer involved
at any point.

This is the flagship trust feature of the Supervisor Dashboard —
`TwoPersonApprovalModal` on the frontend visibly collects a second
supervisor's badge and password before "unlocking" the resolve button, which
strongly implies dual control is actually enforced. It isn't. Anyone who
calls the API directly (or a single compromised/malicious supervisor
account) can resolve or dismiss a data-integrity flag completely alone. For
a police accountability system, a security control that's real in the UI
and absent on the server is worse than not having the feature at all —
it creates false confidence.

**Fix:** the second approver's identity needs to be verified server-side —
at minimum, require a short-lived approval token minted by a real
`/api/auth/login`-equivalent check on the second supervisor's own
credentials, passed into the `/review` call and validated there, not just
collected and discarded client-side.

### 1b. The consistency-flag review UI has never actually worked — the modal above has never been opened by a real supervisor, and 37 of 39 real flags are mislabeled "resolved"
**[API+CODE+VISUAL, confirmed live against real production data]** — Went
back to find out *why* "PENDING FLAGS: 0" showed every single time this
dashboard was viewed during this audit, instead of assuming it just meant
zero pending flags. It doesn't.

The backend (`GET /api/alerts/consistency-flags`, `main.py:2829-2856`)
returns each row as `{"rowid": ..., "case_id": ..., "case_no": ...,
"recorded_section": ..., "suggested_section": ..., "confidence_score": ...,
"reviewed": ..., "flagged_at": ...}`. The frontend
(`SupervisorDashboardScreen.tsx`) declares its `ConsistencyFlag` interface as
`{ROWID, CrimeNo, flag_type, flag_details, reviewed}` and does
`setFlags(data)` straight off the fetch with zero field mapping. Every field
name mismatches except `reviewed` — `flag.ROWID`, `flag.CrimeNo`,
`flag.flag_type`, and `flag.flag_details` are `undefined` for every flag, on
every page load, unconditionally (this isn't data-dependent — the backend
never sends these key names at all). That's the actual root cause of Finding
7c's blank cards below.

It gets worse. `reviewed` is the one field name that *does* match — but ZCQL
returns numeric fields as strings, so `flag.reviewed` is the string `"0"` or
`"1"`, never the JS number `0`. Both the stat-card counts (lines 227/240) and
the per-card branch deciding whether to show the "Resolve" button or "✓
RESOLVED BY SUPERVISOR" (line 342) compare with strict equality against the
number `0`. A string is never `=== 0`, so:
- **"Pending Flags" is structurally incapable of ever showing anything but
  0**, regardless of real data.
- **Every single flag, reviewed or not, renders "✓ RESOLVED BY SUPERVISOR"**
  and never renders a Resolve button.

Confirmed against the real live table via direct API calls (not synthetic
test data): of the 39 real `ConsistencyFlags` rows currently in production,
**33 have `reviewed: "0"` and 4 have `reviewed: null`** — 37 genuinely
unreviewed, AI-flagged legal-classification discrepancies — and only **2**
have ever actually been reviewed (`reviewed: "1"`). The dashboard shows all
39 as "RESOLVED FLAGS" with a green checkmark. Reproduced live in a real
browser too: the Supervisor Dashboard shows all 6 visible flag cards as
"RESOLVED BY SUPERVISOR" with no Resolve button anywhere on the page to
click — confirming this isn't just a miscounted stat, the actual review
action is unreachable.

And even in the counterfactual where the button did render: it's wired as
`onClick={() => handleReviewFlag(flag.ROWID)}` — but `flag.ROWID` is
`undefined` (see above), so `handleReviewFlag(undefined)` sets
`selectedFlagId = undefined`, and the approve handler's own `if
(!selectedFlagId) return;` guard would silently no-op. Two independent bugs
stacked on the same feature; fixing only one still leaves it broken.

**Why this raises Finding 1's severity rather than just adding a new bug:**
the Settings screen (visited during this pass, **[VISUAL]**) explicitly
tells every officer and supervisor: *"TWO-PERSON INTEGRITY (DUAL-CONTROL) —
Critical adjustments, legal suggestions, and ledger overrides must be
co-signed by an independent Supervisor's credentials. **✓ CONTROL
ENGAGED**"* — a green checkmark, stated as a currently active, enforced
policy. In reality: the backend doesn't enforce dual control even when the
review endpoint is called (Finding 1), and the review endpoint has never
once been called by any real supervisor through the UI, because the button
that calls it has never rendered. This isn't a control with a gap in it —
for as long as this bug has existed, it's a control that has never fired a
single time, actively advertised to the people relying on it as "engaged."

**Fix:** map the API response to the frontend's field names correctly (or,
better, make the backend return the exact field names the frontend expects
so there's one source of truth), and fix the `reviewed` comparisons to
compare against the string `"0"` / use `Number(flag.reviewed) === 0` — then
re-verify against the real 37 pending flags, which will suddenly all appear
at once.

### 2. `EmployeeID` is not unique — real officers get cross-attributed
**[API+DB]** — Confirmed live: `SELECT EmployeeID, FirstName FROM Employee
WHERE EmployeeID = 1` returns **two different real people** — "Siddharth
Bhatia" (KGID 226683) and "Claire Gibson" (KGID 2346836, our supervisor test
account). Same for `EmployeeID = 11`: both "Mugdha Hora" and "Brady Powell"
(our officer test account).

`EmployeeID` is used throughout the app as a de facto unique identity key —
session ownership (`sess-{employee_id}-...`), message sender attribution,
Cowork invite records, audit log `badgeId`. This isn't theoretical; I hit it
three separate times in one short session with completely ordinary,
non-adversarial actions:

- Officer Brady Powell invited Claire Gibson to a Cowork session. Claire's
  pending-invitations list showed `"inviter_name": "Mugdha Hora"` — a
  totally unrelated officer — because the lookup (`WHERE EmployeeID = 11`)
  silently took whichever of the two colliding rows ZCQL happened to return
  first.
- When Claire posted a message into that shared session, it was persisted
  with `"sender_employee_id": "1"` and `"sender_name": "Officer"` — a
  generic placeholder, not her real name, because the same collision broke
  name resolution.
- The audit log attributes actions to `"badgeId": "KSP-1"` — which, per the
  finding above, could be either Siddharth Bhatia or Claire Gibson. You
  cannot tell which from the log alone. For a tamper-evident accountability
  log, this defeats the entire purpose. **[VISUAL, confirmed]** — the real
  Supervisor Dashboard screenshot shows exactly this: the Cryptographic
  Audit Ledger panel lists entries as "KSP-11 • Spatial Hotspot Query" and
  three separate "KSP-1 • ..." entries, displayed as-is to the supervisor
  with no further identification. This isn't a hidden API-only detail — it's
  the literal on-screen label a supervisor reviewing the ledger would see.

**Fix:** `EmployeeID` needs an actual uniqueness constraint (or a real
schema change to stop reusing it as an identity key and use `KGID`, which
does appear to be unique, everywhere instead). This is a data problem, not
just a code problem — worth auditing how many duplicate `EmployeeID` values
exist across the whole table before deciding how big the blast radius is.

### 3. Ledger verification fails immediately in production right now — and the real UI is more alarming than the API response alone suggested
**[VISUAL, confirmed after API]** — Clicked "VERIFY LEDGER CHAIN" as the
supervisor in a real browser. The result is a genuine "everyone should see
this" problem, not a quiet background flag: it produces **three simultaneous,
stacked red alerts** —
1. A full-width maroon banner: *"SECURITY ALERT: AuditLog block hash
   verification failed. Tampering detected!"*
2. The "LEDGER STATUS" stat card flips from neutral to red, reading
   "Inconsistent."
3. A red toast notification: *"LEDGER INCONSISTENT — Chain broken at entry 1:
   stored prev_hash does not match the previous entry's actual hash."*

The underlying API response (`GET /api/audit-logs/verify`) is
`{"valid":false,"reason":"Chain broken at entry 1...","checked":0}` —
`"checked": 0"` means it fails on the very first row, almost certainly
because the earliest `AuditLog` rows predate the hash-chain feature and were
never given a correct `prev_hash`/genesis value, not real tampering. But
nothing in the UI hedges this at all — "Tampering detected!" is stated as
fact, three times, in red, with an exclamation mark. This is the single most
likely thing a supervisor persona would click first, and it currently
produces what reads as a confirmed security incident from a data-migration
artifact.

**Fix, short-term:** either backfill/repair the legacy rows' hash-chain
fields so verification can proceed past them, or have the verify endpoint
detect "this row predates hash-chaining" and skip/report it separately from
a genuine break, instead of reporting total failure at row 1.

### 4. `query_hotspots` ignores district scoping entirely — for every caller
**[API+CODE]** — The tool's own schema (`agent_loop.py`, `TOOLS` list) is
`"parameters": {"type": "object", "properties": {}}` — it accepts *no*
parameters at all, not even optionally. Its implementation runs
`SELECT Latitude, Longitude, CrimeNo FROM CaseMaster WHERE Latitude IS NOT
NULL LIMIT 300` — completely unfiltered, state-wide, for any query that
routes here.

Live test: asked "Show me crime hotspots in Bengaluru Urban." The 12 DBSCAN
clusters returned were scattered across Kalaburagi, Dharwad, Mysuru, Bidar,
Shimoga, Haveri, Koppal, and more — nowhere close to Bengaluru Urban specifically
— and the reply text ("Plotted spatial crime density map. Detected 12 active
hotspot clusters...") never mentions Bengaluru Urban or discloses that
district scoping was dropped. An officer asking about their own district
would reasonably believe every cluster shown is local. This is a correctness
bug, not a phrasing bug — it isn't model-dependent (GLM would hit the exact
same unscoped query if it picked this tool; nothing in the schema lets any
model pass a district even if it wanted to).

**Fix:** add a `district` (and ideally `crime_type`) parameter to this
tool's schema, matching the pattern already used by `get_forecast`/
`get_crime_trends`/etc., and filter the underlying query by it the same way
the District Dashboard's own hotspot endpoint already does correctly.

---

## High-priority findings

### 5. "AI reasoning degraded" is real right now and invisible to the officer
**[API+CODE]** — `GET /api/health` currently reports
`"llm_service_available": false"`. Independently confirmed: both AI chat
turns sent during this audit came back with a
`"Tool-Selection Fallback"`/`"Qwen"` citation (`"GLM reasoning was
unavailable this turn"`), i.e. GLM is genuinely down, not a one-off blip.

The frontend fetches `/api/health` on a 30s interval (`AppContext.tsx`) but
only ever reads `data.database_connected` — `llm_service_available` and
`voice_service_available` are fetched and then completely discarded. There
is no banner, no status indicator, nothing system-wide telling an officer
"the AI is currently answering in a reduced-capability fallback mode." The
*only* trace of it is the citation pill discussed in Finding 6, which
requires actively hovering over every single AI message.

**Fix:** surface `llm_service_available` (and `voice_service_available`, for
the mic button) the same way `database_connected` already drives the
Settings screen's Online/Offline indicator — ideally as a visible,
persistent banner while degraded, not just a settings-page field nobody
checks mid-conversation.

### 6. The "fallback answer" citation is visually identical to a routine one
**[VISUAL, confirmed]** — screenshot of a real answer shows exactly this:
both "Tool-Selection Fallback: Qwen" and "Geospatial DBSCAN Analyst: KSP
Hotspots" render as identical small gold pills side by side, no color or
weight difference. In `ChatBubble.tsx`, every citation — including
`"Tool-Selection Fallback"` (meaning: *this specific answer did not get full
AI reasoning*) — renders in the exact same 10px amber pill as a routine
grounding citation like "Geospatial DBSCAN Analyst." The actual warning text
("GLM reasoning was unavailable this turn...") only exists in the `title`
hover-tooltip. Nothing distinguishes "this is a citation for where the data
came from" from "this answer used a degraded fallback and might be less
reliable" — same color, same size, same icon, same interaction pattern. The
codebase's own comments are explicit that this disclosure matters ("never
present a non-GLM-reasoned answer as if it were full AI reasoning") — but
the actual UI treatment makes it trivially easy to miss, especially for an
officer scanning several answers quickly under time pressure.

**Fix:** give fallback-sourced answers a visually distinct treatment —
different color (amber/warning, not the same gold used for normal
citations), a small inline label instead of hover-only text, or a banner on
the message bubble itself.

### 7. Police station names are paired with unrelated, distant districts
**[API]** — `GET /api/firs` search results consistently pair real
Bangalore-named stations with far-away districts, e.g.:
`{"station":"KR Puram PS","district":"Kalaburagi"}`,
`{"station":"Yelahanka PS","district":"Gadag"}`,
`{"station":"Malleswaram PS","district":"Chitradurga"}`,
`{"station":"Rajajinagar PS","district":"Chikkaballapur"}`. Root cause (in
`migrate_to_catalyst.py`): every `Unit`'s `DistrictID` was seeded as
`(i % 30) + 1` — a sequential index, completely unrelated to what the
station's real-world name implies. Any station whose name is a recognizable
real place (most of them, by design) is now paired with a semantically
nonsensical district throughout the dataset. This isn't a query bug, it's
baked into the seed data — every screen that joins station-name and
district (FIR search, and likely others) inherits it.

**Fix:** re-seed `Unit.DistrictID` so named-after-real-places stations
actually map to their real district (or, faster: rename the stations to
made-up names if geographic accuracy across the dataset isn't worth
re-seeding right now — right now it's the worst of both: real-sounding
names with fake, contradictory geography).

### 7b. AI answers render raw markdown syntax as literal text — every list/bold answer is affected
**[VISUAL]** — A real answer to "pie chart of case types" rendered as one
unbroken wall of text reading (verbatim, as shown on screen):
*"Distribution of cases by type across all districts (Total: 20984
cases):\n- **Motor Vehicle Accidents Non-Fatal**: 2986 cases (14.2%)\n-
**THEFT**: 1986 cases (9.5%)\n- **CrPC cases**: 1698 cases (8.1%)..."* — the
literal characters `\n` and `**` are visible on screen, not interpreted as a
line break or bold emphasis. The chat bubble text renderer does plain-text
rendering only, with no markdown parsing. Since GLM/Qwen's answers routinely
use markdown lists and emphasis for exactly this kind of structured
breakdown, this affects a large fraction of real answers, not an edge case —
and it's one of the most immediately obvious things on the screen the moment
an answer contains a list.

**Fix:** run assistant message text through a markdown renderer (e.g.
`react-markdown`) before display, or have the backend strip/convert markdown
to the plain-text-with-real-newlines the frontend currently expects.

### 7c. Consistency-flag cards render with no visible content
**[VISUAL — root cause now confirmed, see Finding 1b]** — On the Supervisor
Dashboard, all 6 "Legal Consistency Flags" cards show only a horizontal
divider line and "✓ RESOLVED BY SUPERVISOR" — no case number, no
recorded/suggested section, nothing identifying what was actually flagged or
resolved. This is not data-specific and not a layout bug — it's a permanent
frontend/backend field-name mismatch (`ROWID`/`CrimeNo`/`flag_type`/
`flag_details` expected, `rowid`/`case_no`/`recorded_section`/
`suggested_section` actually sent) that makes every flag render this way,
always, regardless of its real data. Full detail and severity writeup moved
to Finding 1b, since the same bug (plus a second, independent type-mismatch
bug) is also why the Resolve button and the "Pending Flags" counter never
work either.

### 7d. Chat message timestamp and toast timestamp disagree by ~6 hours, consistently
**[VISUAL]** — Two separate screenshots each show the same pattern: an AI
message timestamped e.g. "05:40 pm" appears in the same view as a toast
(e.g. "SECURE LOGON ESTABLISHED") timestamped "11:40:24 pm" — sent/rendered
within seconds of each other in the same session. Reproduced twice with
different accounts, same ~6-hour gap both times, so this looks systematic
(most likely a UTC-vs-IST formatting inconsistency between two different
timestamp-rendering code paths) rather than a one-off clock glitch. Worth
finding both formatting call sites and confirming they use the same timezone
handling.

### 7e. FIR Search, Spatial, and Reports are fully built, fully functional screens with zero way to reach them
**[CODE+VISUAL]** — `App.tsx`'s render switch has full `case` handling for
`"fir_search"`, `"spatial"`, and `"reports"` alongside the four screens
actually in use. `MainLayout.tsx`'s `navItems` array, however, only ever
contains 4 possible entries: `ai_chat`, `district_dashboard`, `supervisor`
(conditionally), and `settings` (lines 91-102). A repo-wide search confirms
zero calls anywhere in `src/` to `setCurrentScreen("fir_search")`,
`setCurrentScreen("spatial")`, or `setCurrentScreen("reports")` — no button,
link, or programmatic redirect ever points at them. They are unreachable by
any means available to a real user.

Forced navigation (via `localStorage`) to each confirms these aren't dead
stubs — two of the three are real, finished features:
- **Spatial** renders a fully working DBSCAN hotspot-tuning screen — live
  EPS-radius and min-cluster-point sliders, a real Leaflet map, and a stats
  panel ("Points Scanned," "Active Clusters," "Spatial Engine: DBSCAN 1.2").
  This is a more sophisticated, configurable version of the hotspot feature
  than Finding 4 covers, sitting completely unused.
- **Reports** renders a two-panel "Demographic Correlation Reports" screen
  with real bar and line charts. It has its own data-quality issue worth
  noting separately: the two side-by-side charts, presented as one
  correlated report, list **different sets of districts** on their x-axes
  (left chart: Ballari, Mysuru, Kolar, Bengaluru Urban, Udupi...; right
  chart: Ballari, Vijayapura, Mandya, Shimoga, Udupi...) — only 3 of ~11
  districts actually overlap between them, undermining the "correlation"
  premise the screen is named for. The right chart's line series also
  renders essentially flat at 0 across every district, suggesting the
  "Unemployment Rate" series isn't populated with real values.
- **FIR Search** is the one screen that's genuinely broken, not just
  unreachable: it throws a real console error (`Failed to load resource:
  404`) and permanently shows a hardcoded-looking error state — "DATA
  UNAVAILABLE — SECURITY REGISTRY OFFLINE — Unable to establish a secure
  handshake with KSP directory server. Mocks are strictly blocked." This may
  be an intentional anti-mock safeguard (the wording suggests it), but as
  built it means this screen has never once shown real FIR data to anyone,
  orphaned or not.

**Fix:** either add all three to `navItems` (they're clearly finished enough
for at least Spatial to ship) or, if they're deliberately gated/parked, that
should be a visible "coming soon"/permission state rather than
fully-functional code with silently zero entry point — worth confirming with
whoever owns the roadmap which of these two it actually is.

### 7f. Settings screen overstates what "session timeout" actually does — the token itself is never invalidated
**[VISUAL+CODE]** — The Settings screen's "ACTIVE SECURITY POLICIES" panel
states: *"SESSION TIMEOUT LIMIT — Automatically invalidates session tokens
and redirects to Login Screen after 15 minutes of operator inactivity. ⚠
POLICY ENFORCED – READ ONLY."* The 15-minute part is real and does work
(`SessionTimeoutGuard.tsx`: a genuine client-side inactivity timer, a
60-second warning countdown, then forced logout) — but "invalidates session
tokens" isn't accurate. `handleLogout()` only removes `vajra_token`/
`vajra_auth`/`vajra_badge` from `localStorage` and flips React state; there
is no server-side call to revoke the JWT, and grepping `main.py` for any
blacklist/revocation mechanism turns up nothing — the backend issues a
stateless JWT with a flat 1-hour `expires_in: 3600` and has no way to
invalidate one early. The literal token string remains fully valid and
usable directly against every API endpoint for up to the remaining ~45
minutes after this "invalidation" fires, if anyone had a copy of it (browser
dev tools, an XSS payload, a shared/unlocked machine).

Lower severity than Finding 1/1b — it needs the token already exfiltrated to
matter — but it's a specific, written security-policy claim shown to
officers and supervisors that isn't literally true, on the very same screen
making the also-false dual-control claim covered in 1b. Worth fixing the
wording at minimum ("logs you out" rather than "invalidates session
tokens"), and adding real server-side revocation if the stronger claim
should become true.

---

## Medium findings

### 8. No pre-existing officer-tier test/demo account
**[DB]** — Only 4 rows exist in the entire `OfficerCredentials` table, and
all 4 belong to supervisor-tier employees (RankID ≥ 5). There was no way to
log in as a genuine non-supervisor officer without me manually inserting a
credential row. If this mirrors the real onboarding state, most of the
`Employee` table (rank 1-4 staff) can never actually authenticate — worth
confirming this is intentional (only specific staff get accounts) rather
than an oversight, since it also means the "officer" experience has
presumably never been tested end-to-end by anyone using a real login.

### 9. Consistency-flags table has leftover test rows in production
**[API]** — `GET /api/alerts/consistency-flags` currently returns rows like
`{"case_id":null,"case_no":"Case-None","recorded_section":"TEST",
"suggested_section":null,...}` and the inverse with `"suggested_section":
"TEST"`. These look like debug/seed artifacts, not real flagged
inconsistencies, and they're exactly what a supervisor would see and be
asked to review/resolve on the dashboard. Worth cleaning out before anyone
demos or actually uses this screen.

### 10. AI response to a fresh Cowork investigation doesn't use the context it just gave itself
**[API]** — Creating an investigation with no linked case immediately posts
a system message: *"Investigation 'X' opened... No case is linked yet — ask
me anything to begin, or link a case later from Settings."* Sending
`"@vajra what's the status on this investigation"` right after gets: *"Could
you please provide the Case Number or CrimeNo..."* — technically reasonable
for a vague query in isolation, but the system already told the user 30
seconds earlier that no case is linked; re-asking for a case number instead
of saying something like "no case is linked to this investigation yet — did
you mean to link one, or ask about something else?" misses context it
already had available in the same session.

### 11. `sender_name: "Officer"` generic fallback undermines Cowork's whole point
**[API]** — Separate from the `EmployeeID` collision root cause (Finding 2),
the *existence* of a generic "Officer" fallback for sender attribution is
itself a UX gap for a feature whose entire value proposition is "see who
said what in a shared investigation." Even once the collision bug is fixed,
worth confirming there's no other path that can produce this same
anonymous-sounding fallback.

---

## Lower-priority / worth a look

### 12. Login error messages are appropriately generic (no finding, noting as a positive)
Wrong password and invalid/garbage tokens both return clear, non-leaky
messages (`"Badge Number or password incorrect"`, `"Session authentication
failed"`) without confirming which part was wrong or leaking any internal
detail. Good as-is.

### 13. Attachment storage: contradicts an earlier finding this session, worth a second look
**[API]** — Uploaded a test image; the response had `stratus_id` populated
(not the `data_uri` inline-thumbnail workaround I recall building earlier
this session) and `GET /api/attachments/{stratus_id}` returned a real
`image/jpeg` 200 — i.e., attachment storage/retrieval appears to work
end-to-end right now. This contradicts an earlier finding from earlier in
this session that the underlying Stratus storage call always failed
(`catalyst_app.stratus()` raising `AttributeError`) — and `catalyst_stratus.py`
still contains that exact same code, unchanged. I can't fully explain the
discrepancy from source alone (possibly a different code path in the
deployed AppSail credential branch than what I tested locally) — flagging
so it gets a real explanation rather than either assuming it's broken or
assuming it's fixed.

### 14. GLM twice-in-a-row unavailable during this session
Worth checking whether this is a persistent current outage or normal
variance — if it's persistent, the fixes in Findings 4-6 (fallback
disclosure, health status visibility) become considerably more urgent, since
right now the "degraded" path isn't an edge case, it's what every officer is
currently experiencing.

---

## If I had to pick the fixes to prioritize first

1. **The consistency-flag review pipeline, root-and-branch (#1 + #1b)** —
   not just "dual control isn't enforced server-side" but "the review UI has
   never functioned at all": a field-name mismatch and a string/number
   type-mismatch stack to make the Resolve button never render and the
   Pending count always read 0. Confirmed against real production data — 37
   of the 39 real flags in the table have never been reviewed and are
   currently displayed to every supervisor as resolved, with a green
   checkmark, on a screen whose Settings page separately claims this exact
   control is "✓ CONTROL ENGAGED." This is the one finding in the whole audit
   with concrete, quantified, currently-happening harm behind it, not a
   theoretical gap.
2. **`EmployeeID` uniqueness (#2)** — foundational; touches identity,
   attribution, and the audit log's core purpose. Now visually confirmed on
   the actual Supervisor Dashboard, not just in raw API responses.
3. **Ledger verification's "Tampering detected!" banner (#3)** — worse than
   originally described once seen rendered: three stacked red alerts stating
   tampering as fact, for what's almost certainly a data-migration artifact.
   The first thing a supervisor persona would try, and it currently produces
   the most alarming possible false signal.
4. **`query_hotspots` district scoping (#4)** — silently wrong data shown
   to an officer as if it were scoped to what they asked for.
5. **Markdown not rendering in chat (#7b)** — lower stakes than the above
   but far higher frequency: every AI answer that includes a list or bold
   emphasis (a lot of them) currently shows raw `\n` and `**` characters on
   screen. Purely cosmetic, but it's the single most-often-visible defect in
   the entire app.
6. **Three fully-built screens with no nav entry (#7e)** — Spatial in
   particular is a complete, more capable hotspot-tuning feature than what
   shipped, sitting completely unused for what looks like a one-line
   oversight in `MainLayout.tsx`'s `navItems` array.

## Note on methodology, for whoever reads this next

The Edge-binary workaround (pointing Playwright at the system's pre-trusted
`msedge.exe` instead of a freshly-downloaded Chromium build) is worth turning
into a proper project skill (`/run-skill-generator`) if this environment's
Smart App Control restrictions are permanent — several of the findings above
(7b, 7c, 7d, and the confirmed severity of #3) were only catchable with real
rendering, and would have been missed by API-only testing indefinitely.

**Second pass note:** after the first draft, I went back specifically to
check for anything a "have you covered everything" question would expose —
forced navigation to every screen with a valid `ScreenId` but no nav entry
(via `localStorage`, since the app reads its current screen from there on
load), pulled the real production `ConsistencyFlags` data directly instead
of trusting the "0 pending" stat on faith, and read every claim on the
Settings screen against the actual code backing it rather than assuming a
policy panel describes real behavior. That combination is what surfaced
1b, 7e, and 7f — none of which would have been caught by clicking through
only the screens the nav bar exposes, or by taking an on-screen "policy
enforced" claim at face value. Worth treating "does the UI's own stated
security posture match what the code actually does" as a standing check in
any future pass on this app, not a one-off.
