# VAJRA — Data Store Schema (Source of Truth)

Catalyst has no SQL migration tooling and no DDL API — every table below was created
manually in the console. This file exists because that history isn't recoverable any
other way (no `migrations/` folder, no `schema.sql`). **When a table or column changes
in the console, update this file in the same session** — it's the only record.

Compiled directly from the actual seeding code (`vajra_backend/migrate_to_catalyst.py`)
and the actual query code (`vajra_backend/agent_loop.py`, `vajra_backend/vajra_core.py`,
`vajra_backend/main.py`) as of this writing — not from memory or the console UI, so it
reflects what the code actually reads/writes, not just what was originally designed.

---

## Core case data

### `CaseMaster`
The central table — one row per FIR.

| Column | Type | Notes |
|---|---|---|
| CaseMasterID | int | Primary reference, used everywhere as `cid` |
| CrimeNo | text | The FIR number (e.g. `FIR-2026-0814`) |
| CrimeRegisteredDate | date | FIR filing date — used for seasonality, timeline |
| PoliceStationID | int | FK → `Unit` |
| DistrictID | int | FK → `District` |
| CaseCategoryID | int | FK → `CaseCategory` (drives FIR Type: Heinous/Non-Heinous) |
| CrimeMajorHeadID | int | FK → `CrimeHead` |
| CaseStatusID | int | FK → `CaseStatusMaster` |
| CourtID | int | FK → court reference table |
| GravityOffenceID | int | Used in MO behavioral vector |
| AccusedCount | int | |
| VictimCount | int | |
| Latitude / Longitude | float | Used for hotspot/DBSCAN queries |
| IncidentFromDate / IncidentToDate | date | |
| InfoReceivedPSDate | date | |
| BriefFacts | text | Free-text narrative — indexed by `VajraSemanticMemory` for vague-query search |

### `ComplainantDetails`
| Column | Notes |
|---|---|
| ComplainantID, CaseMasterID | |
| ComplainantName, AgeYear | |
| OccupationID, ReligionID, CasteID, GenderID | FKs to lookup tables |

### `Victim`, `Accused`
Per-case victim/accused rows. `Accused.AccusedName` + `Accused.AgeYear` +
`Accused.CaseMasterID` are the fields actually queried by `get_offender_risk` and
`get_mo_profile` (via `LIKE '%name%'` match — no exact-ID lookup path exists yet, which
is a real fuzzy-match risk worth knowing about, not just a schema note).

### `ArrestSurrender`
| Column | Notes |
|---|---|
| ArrestSurrender (ID), CaseMasterID | |
| ArrestSurrenderTypeID | |
| ArrestSurrenderDate | Real date — seeded for ~60% of cases, this is what backs the case-timeline tool |
| ArrestSurrenderStateId, ArrestSurrenderDistrictId, PoliceStationID | |
| IOID, CourtID | |
| AccusedMasterID | |
| IsAccused, IsComplainantAccused | boolean |

### `ChargesheetDetails`
| Column | Notes |
|---|---|
| CSID, CaseMasterID | |
| csdate | Real date — seeded for ~60% of cases |
| cstype | "Regular" / "Supplementary" |
| PolicePersonID | |

### `inv_arrestsurrenderaccused`, `Inv_OccuranceTime`
Junction/detail tables linking arrests to accused and recording occurrence timing.

---

## Legal reference

### `Act`, `Section`, `CrimeHead`, `CrimeSubHead`, `CrimeHeadActSection`, `ActSectionAssociation`
Reference + junction tables. `ActSectionAssociation` (CaseMasterID, ActID, SectionID,
ActOrderID, SectionOrderID) is what `get_case_sections` joins through to answer
"what sections apply to this case." `suggest_sections_for_query` currently does
**keyword-based** matching (not a real DB join) for the hypothetical/new-case case —
see `agent_loop.py`'s `suggest_sections_for_query` method.

---

## Organizational / geographic reference

### `District` (DistrictID, DistrictName, StateID, Active)
Currently ~30 rows, real Karnataka district names. **No socio-economic columns exist
here** — that's what `DistrictSocioProfile` (below) is for; don't add literacy/
unemployment columns directly to `District`.

### `DistrictSocioProfile` *(replaces the hardcoded 7-district dict in `main.py`)*
| Column | Type |
|---|---|
| DistrictID | int |
| LiteracyRate | double |
| UnemploymentRate | double |
| UrbanizationIndex | double |
| MigrationIndex | double |
| EconomicStressIndex | double |

*Synthetic, illustrative values — every response using this data must state so
explicitly, not present it as authoritative Census/NCRB data.*

### `Unit`, `UnitType` (police stations)
`Unit.DistrictID` links a station to its district. `Unit.TypeID` → `UnitType`
(Police Station / City Armed Reserve / Traffic PS).

### `Employee`
| Column | Notes |
|---|---|
| EmployeeID, UnitID, KGID | KGID is the badge number, used as the login identity |
| RankID | FK → `Rank` — **exists but is not currently queried by `VajraSecurityFirewall`** (only EmployeeID/UnitID/KGID/FirstName are fetched) — real data, not yet wired to auth context or the frontend |
| DesignationID | FK → `Designation` — same gap as RankID |

### `Rank`, `Designation`
Real seeded reference tables (Investigating Officer, Station House Officer, Beat
Constable, Traffic Constable, etc. for Designation; a hierarchy-ordered rank list for
Rank). Exists, seeded, unused downstream as of this writing.

### `CaseStatusMaster` (CaseStatusID, CaseStatusName)
Backs `CaseMaster.CaseStatusID`. Includes "Pending Trial," "Convicted," "Undetected,"
"Dis/Acq," "BoundOver," and others — this is the real status vocabulary, don't
hardcode a different status list elsewhere.

### `CasteMaster`, `ReligionMaster`, `OccupationMaster`
Lookup tables for complainant/accused demographic fields. Column naming is
inconsistent with the rest of the schema (lowercase `caste_master_id` vs the usual
PascalCase `CaseMasterID` pattern) — known quirk, not a bug, don't "fix" the casing
without checking every query that references it first.

---

## Governance / security

### `AuditLog`
| Column | Notes |
|---|---|
| employee_id, action_type, target_entity | |
| query_text, response_summary | Truncated in code (`[:500]`, `[:200]`) before insert |
| session_id, logged_at | |
| prev_hash, row_hash | SHA-256 hash chain — `row_hash = SHA256(prev_hash + serialized_row)`, computed in `_write_audit_log` |

**⚠️ As of this writing, live ZCQL calls against this table fail** — `"Unkown Table
AuditLog or Unkown Column row_hash in SELECT"`. Either the table doesn't exist in the
current live project, or exists without the `prev_hash`/`row_hash` columns the code
expects. Verify and fix in the console before trusting audit logging is actually
working — the code is correct, the live table apparently isn't.

### `ProactiveAlerts`
| Column | Type |
|---|---|
| AlertID | int |
| DistrictID | int |
| AlertType | text |
| AlertMessage | text |
| TriggerTime | text (ISO 8601) |
| Severity | text |
| IsRead | boolean |

*Written by a Catalyst Job Function (`functions/proactive_alerts/index.py`), not by
the main AppSail app — see `docs/VAJRA_Catalyst_Migration_Blueprint.md` for the
function deployment structure.*

---

## Analytics / ML-adjacent

### `FinancialTransaction`
sender_ref, receiver_ref, amount, txn_time, account_or_wallet_id — queried by
`query_financial_links` and folded into `query_graph_network`'s output.

### `ForecastResults`
district, crime_type, forecast_period, predicted_count, historical_avg,
confidence_score — read by `get_forecast`; falls back to a single synthetic estimate
row if empty.

### `ConsistencyFlags`
Reserved for classification-consistency flagging (case recorded as one crime type but
narrative suggests another) — **not** the table for proactive early-warning alerts,
those get their own `ProactiveAlerts` table (see above) to avoid conflating two
unrelated features.

### `AccidentReports`
accident_reports_id, CrimeNo, and accident-specific fields (cause, severity, weather,
collision type, etc.) — separate from `CaseMaster`, read by `/api/analytics/accident-spots`.

---

## Known schema gaps (things the problem statement wants that no column currently backs)

- No court hearing date field exists anywhere (only FIR-registered, arrest, and
  chargesheet dates are real) — a "full court timeline" beyond chargesheet isn't
  buildable without adding a new field/table first.
- No `Role`/permission-tier distinction beyond `Rank`/`Designation` — there's no
  explicit "Investigator vs Analyst vs Supervisor vs Policymaker" access-tier field;
  today's role gating is by which screen you navigate to, not a real data-layer scope
  keyed off rank.
