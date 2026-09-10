# Build Plan: Day-of-Week Time Filter, H3 Hex Grid, Syndicate Radar (Louvain)

> Captured 2026-09-07, post-deadline. Full codebase research done first (two Explore
> passes, exact file:line citations below) before any design decision — this plan
> corrects two things the original "God Pro Max" doc got slightly wrong once checked
> against the real data and the real code, and makes one explicit new-dependency call.

## Feature 1 — Time filter on the hotspot map (DAY-OF-WEEK, not hour-of-day)

**Correction to the original doc, verified in code, not assumed:** the doc's own
prior work already tried an hour-of-day feature and hit a real dead end —
`vajra_core.py:1050-1074`'s docstring states `CaseMaster.IncidentFromDate` and
`Inv_OccuranceTime.OccurrenceDate` are **date-only** ("2024-10-19") across the
entire real dataset; the original "incident_hour" feature silently fell back to a
hardcoded `hour=12` for every case. An hour-of-day slider would therefore be
decorative/fake on this data. **Day-of-week is real and buildable** — the exact
same file already computes `datetime.strptime(raw_date[:10], "%Y-%m-%d").weekday()`
successfully for the MO-profiling feature. This plan builds day-of-week, not
hour-of-day, and states that distinction to the officer in the UI so it's never
misread as finer-grained than it is.

**Also found and being fixed as part of this work**: `SpatialScreen.tsx`'s existing
EPS-radius and Min-Cluster-Points sliders are currently **decorative** — `GET
/api/cases/spatial-hotspots` (`main.py:676-692`) calls `query_hotspots` with an
empty params dict, so the server always clusters with hardcoded `eps=0.005,
min_samples=6` (`agent_loop.py:3282-3352`) regardless of what the sliders show.
This plan wires them for real at the same time, since leaving them fake while
adding a new (real) slider next to them would be an inconsistent, worse UX.

**Backend changes:**
- `query_hotspots` tool schema (`agent_loop.py:258-268`) gains optional
  `day_of_week` (0=Mon..6=Sun), `eps`, `min_samples` params.
- The `_execute_tool` branch (`agent_loop.py:3916-4072`): after the existing
  180-day-recency coordinate fetch, if `day_of_week` is given, filter the fetched
  rows in Python by `CrimeRegisteredDate`'s weekday (same pattern already proven
  at `vajra_core.py:1050-1074`) before calling `cluster_hotspots`. Thread real
  `eps`/`min_samples` into that call instead of the hardcoded defaults.
- `GET /api/cases/spatial-hotspots` (`main.py:676-692`): accept
  `day_of_week`/`eps`/`min_samples`/`district` query params and pass them through
  to `_execute_tool` instead of `{}`.

**Frontend (`src/screens/SpatialScreen.tsx`) — exact screen behavior:**
- A new slider directly below the existing two (same `<input type="range">` +
  `bg-stone-800 accent-[#C79A4E]` pattern already at lines 157-166/175-184), 8
  discrete positions: "All Days, Mon, Tue, Wed, Thu, Fri, Sat, Sun". The current
  day-name (or "All Days") renders as a live label above the slider as it's dragged.
- Moving ANY of the three sliders (day, eps, min-points) triggers a debounced
  (400ms) refetch of `/api/cases/spatial-hotspots` with the new params — fixing
  the two pre-existing decorative sliders in the same change.
- A one-line caption under the map: *"Showing: All days"* / *"Showing: Saturday
  incidents only (day-of-week, not time-of-day — exact incident times aren't
  recorded in CCTNS)"* — the parenthetical only shown once (e.g. a small (i) tooltip)
  so officers never assume hour-level precision that doesn't exist.
- Loading state: reuse the shimmer-skeleton convention already established in
  `DistrictDashboardScreen.tsx` while a refetch is in flight.

## Feature 2 — H3 hexagonal density grid (alternative to the heat blur)

**New dependency**: `h3-py`. Already pre-vetted safe in this project's own research
doc (`docs/VAJRA_God_ProMax_Research_and_Upgrade_Vision.md:170`, GREEN tier: "h3
py lib is small"). Verified live: `vajra_backend/vendor` is currently 468MB
against the documented 1GB/1024MB AppSail disk cap — ~550MB of real headroom.
h3-py has no heavy native ML dependencies, safe to add.

**Backend**: extend `query_hotspots`'s data payload with a parallel `hexbins`
field — bin each fetched coordinate (same 300-row ZCQL fetch already happening,
no new query) into an H3 cell via `h3.latlng_to_cell(lat, lng, resolution)`
(resolution 8 as the starting default, ~0.7km² per cell — reasonable at
city/station scale; flagged in this plan as the one number worth empirically
tuning against real coordinate density once live, not fixed in stone). Aggregate
per cell: `{"h3_index": str, "count": int, "boundary": [[lat,lng], ...]}` using
`h3.cell_to_boundary()` server-side, so the **frontend needs zero H3 library** —
it just draws the polygon coordinates it's given. Keeps the frontend bundle
untouched (no `h3-js` needed).

**Frontend — exact screen behavior:**
- A small segmented control at the top of the map card: **"Heat" | "Hex Grid"**
  (two-button toggle, matches the app's existing pill-button visual language).
- "Heat" (default) = today's existing `leaflet.heat` thermal layer, unchanged.
- "Hex Grid" = renders one `Polygon` (react-leaflet) per returned hexbin, filled
  using the SAME 4-tier `HEAT_GRADIENT` already defined (`SpatialScreen.tsx:25-30`)
  for visual consistency between the two modes — just a different geometry
  (honeycomb cells vs. a blurred gradient) over the identical underlying density.
  Each hex shows an exact incident count in a `Popup` on click — the concrete
  "this cell has 12 incidents" precision a blurred heat layer can't give.

## Feature 3 — "Syndicate Radar": Louvain community detection over a real 2-signal graph

**New dependency**: `networkx`. This is the one explicit trade-off worth stating
plainly: the codebase's own established convention (`detect_financial_ring`,
`agent_loop.py:3730-3732`) deliberately avoided `networkx` once already
("respecting the vendor disk cap") and hand-rolled BFS in pure Python/dicts
instead. But (a) real headroom is now confirmed (550MB free, see Feature 2),
(b) `networkx`'s installed footprint is small (pure-Python, no compiled/ML
dependencies, nowhere near xgboost/shap's size), and (c) the project's own
"God Pro Max" doc explicitly scoped THIS exact feature as "NetworkX community
detection (Louvain)" — hand-rolling a from-scratch modularity optimizer would be
a worse approximation of an already-agreed-on approximation. Recommendation:
add `networkx`, use its built-in `nx.community.louvain_communities(G,
weight="weight", seed=42)` — the fixed seed matters: this project's own
demo/verification discipline requires reproducible results across runs, not a
different grouping every time a judge re-asks the same question.

**What actually elevates `detect_crime_groups`** (`agent_loop.py:5409-5517`):
today it only has ONE signal — shared CaseMasterID, thresholded at ≥2 shared
cases, connected via union-find (a real but crude form of grouping: a hard
pairwise cutoff, no weighting, no notion of "loosely but genuinely connected
cluster"). This plan adds a SECOND real signal already sitting in the database
and already used elsewhere — `AccusedContact`'s shared phone/vehicle links
(confirmed live-seeded: 1500 rows, `main.py:5674-5678`) — and replaces the hard
threshold with weighted-graph Louvain modularity, which is exactly what finds
"a group that's statistically converging but never crossed the ≥2-shared-case
bar on any single pair" — the literal USP-5 pitch line.

- Build one `networkx.Graph()`: nodes = accused names (same 300-row `Accused`
  fetch already happening); edges = shared-case pairs (weight = shared case
  count, same computation already in `agent_loop.py:5427-5442`) PLUS
  shared-phone/shared-vehicle pairs from `AccusedContact` (weight 1 each, reusing
  the exact lookup pattern already proven at `vajra_core.py:1443-1465` and
  `main.py:5665-5772`'s district-syndicate endpoint).
- Run Louvain; keep communities with ≥3 members; compute each community's
  modularity contribution and its hub (max weighted-degree member, reusing the
  `detect_financial_ring`-style degree-threshold hub logic already proven at
  `agent_loop.py:3855`).
- **Mandatory honesty disclosure baked into the output, not optional**: since
  shared-case edges are real CCTNS data but shared-phone/vehicle edges are
  synthetic demo data (`docs/SCHEMA.md:260-273` says so explicitly), every
  community's text result states which edge types it actually contains, e.g.
  *"This group is connected by 2 real shared cases AND 1 demo-seeded shared
  phone number."* Never let a synthetic link read as if it were a real
  telecom/RTO record.
- **Output shape upgrade**: today `detect_crime_groups` has no `nodes`/`edges` at
  all (renders only as member-chip cards, `ExpandedOverlay.tsx:1198-1245`). This
  plan adds a real `nodes`/`edges` payload (matching the existing convention from
  `query_graph_network`/`detect_financial_ring`) PLUS a new `community` field per
  node, so the SAME `NetworkGraph.tsx` component used everywhere else can render
  it, instead of building a one-off visualization.

**Frontend — exact screen behavior:**
- The inline chat answer for "detect syndicates" / "find emerging groups" keeps
  today's quick member-chip card view as the primary summary (works well, no
  reason to remove it) — now with the honesty disclosure line added per group.
- New: an "Expand ⤢" opens the existing side-panel `NetworkGraph.tsx` view,
  extended with one new visual encoding — a colored RING/border per node
  indicating its Louvain community (fill color stays the existing `type`-based
  suspect/case/person/vehicle/phone scheme, so the two encodings don't collide).
  Cross-community edges render dimmed/thin; within-community edges render at
  full weight — the visual "found a hidden cluster" moment the USP is built
  around. Community colors come from the same validated-palette approach already
  used for the existing `NODE_COLORS` map (`NetworkGraph.tsx:29-35`), extended
  dynamically since community count isn't fixed in advance.
- Legend: extend the existing `presentTypes` mechanism (`NetworkGraph.tsx:172-182`)
  with a second small legend row for community colors, shown only when ≥2
  communities are present in the current graph (mirrors the existing rule for
  when a legend is shown at all).

## Files touched (all three features)
- `vajra_backend/agent_loop.py` — `query_hotspots` tool + `cluster_hotspots`
  (Feature 1+2), `detect_crime_groups` (Feature 3)
- `vajra_backend/main.py` — `/api/cases/spatial-hotspots` param passthrough
  (Feature 1+2)
- `vajra_backend/vajra_core.py` — reused (not modified) shared-attribute lookup
  pattern for Feature 3's second edge type
- `vajra_backend/requirements.txt` — add `h3` and `networkx`
- `src/screens/SpatialScreen.tsx` — day-of-week slider + Heat/Hex toggle
- `src/components/NetworkGraph.tsx` — community ring-color encoding + legend row
- `src/components/ExpandedOverlay.tsx` — honesty-disclosure line on syndicate
  group cards, wire the Expand-to-graph path for `detect_crime_groups`

## Verification plan
- Feature 1: query hotspots for each of the 7 real weekdays against the live
  deployed app; confirm the returned cluster set actually changes and confirm
  the EPS/min-points sliders now measurably change cluster count (proving they
  stopped being decorative).
- Feature 2: toggle Heat/Hex on a real district with known dense clusters;
  confirm hex counts sum sensibly against the same underlying point set the
  heat layer uses (same data, two renderings, numbers must agree).
- Feature 3: run against a known repeat-offender name (already flagged in
  `ProactiveAlerts`) and confirm Louvain surfaces a community around them; run
  the SAME query twice and confirm identical output (seed=42 reproducibility);
  confirm the honesty-disclosure line correctly separates real vs. synthetic
  edges for at least one mixed-signal group.
- `python -m py_compile` + `npx tsc --noEmit` clean, same discipline as every
  other change this session, before considering any of the three done.

**Status: plan complete, grounded in two full Explore-agent research passes with exact file:line citations — awaiting approval to build.**
