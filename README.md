# VAJRA (ವಜ್ರ) — AI Crime Intelligence Copilot

### Karnataka State Police Datathon 2026 — Challenge 01

VAJRA is a bilingual (English / Kannada) AI copilot for Karnataka State Police
investigators. Officers ask questions in plain language — voice or text — and
get answers grounded in the live CCTNS case database: suspect risk scores
with SHAP-explained reasoning, criminal network graphs, DBSCAN spatial
hotspot clustering, MO-behavioral matching, and crime-trend forecasting, all
rendered inline in a single conversation thread instead of a separate
dashboard-per-feature layout.

**Live deployment:** https://vajra-60074806366.development.catalystserverless.in/app/index.html
(Zoho Catalyst only, per submission requirements)

---

## What it actually does

- **Conversational query engine** — ask in English or Kannada, by typing or
  speaking. A GLM "thinking" model reasons over the request, selects and
  runs a real database tool (never a canned response), and answers in both
  languages so switching the UI language never re-triggers a model call.
- **Inline visualizations** — every answer that has a shape renders as a
  live chart/map/graph directly in the chat thread: spatial hotspot maps
  (Leaflet + DBSCAN), criminal network graphs, offender risk gauges with
  SHAP feature contributions, seasonal forecasts, case timelines, MO-match
  scoring, repeat-offender and organized-crime-group detection, socio-
  demographic correlation, and crime-type distribution — eleven distinct
  visualization types, each expandable into a full side panel.
- **District Analytics Dashboard** — a statewide heat-grid of all districts
  by active case load, drilling into per-district socio-economic profile,
  DBSCAN hotspot map, crime-type breakdown, case outcomes, most-wanted
  suspect, and recent case activity — every figure a live query, never
  cached or pre-aggregated.
- **Cowork sessions** — multiple officers share one live investigation
  thread over a real WebSocket connection, with role-based access (viewer /
  collaborator) and @-mention control over when the AI is actually invoked
  versus officers just discussing amongst themselves.
- **Investigations** — named, case-linked conversation threads distinct
  from quick one-off chats, auto-opened with a real case summary pulled
  from the linked FIR record.
- **Attachment analysis** — upload a PDF or photo of a case document; it's
  analyzed and the extracted findings are available to the conversation.

## Security & data integrity

These are enforced server-side on every request, not just hidden in the UI:

- **Authentication** — 7-digit KGID badge number + bcrypt-hashed password.
- **Row-level security** — every query is scoped to the authenticated
  officer's own station; no client-supplied parameter can widen that scope.
- **Tamper-evident audit log** — every query is logged with a SHA-256
  hash-chain across entries; the Supervisor Dashboard's "Verify Ledger"
  action recomputes the full chain server-side and compares, not a format
  check.
- **Two-person approval** — resolving a data-consistency flag requires a
  second Supervisor-tier officer's credentials.
- **Honest data, always** — synthetic or sampled figures are disclosed
  inline wherever they appear (e.g. the socio-economic charts are marked
  "illustrative synthetic estimates, not official Census/NCRB data";
  most-wanted and hotspot computations disclose they're bounded-sample, not
  exhaustive). The system never presents a fabricated number as if it were
  real — if the database has nothing to say, it says so.
- **DPDPA 2023 / IT Act 2000** — AI-synthesized outputs carry advisory
  language reminding officers to validate before entering findings into a
  formal case brief.

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | React 19, TypeScript, Vite, Tailwind CSS v4, Leaflet (react-leaflet), Recharts |
| Backend | Python, FastAPI, Uvicorn, running on Zoho Catalyst AppSail (a persistent process, not serverless-per-request) |
| Database | Zoho Catalyst ZCQL Data Store |
| File storage | Zoho Catalyst Stratus |
| LLM reasoning | GLM (via Catalyst QuickML), with a hand-rolled JSON tool-calling protocol |
| Translation | Zia fast-translate → GLM → Qwen fallback chain, with an honest failure state |
| ML models | XGBoost + SHAP (recidivism risk scoring), scikit-learn DBSCAN (spatial hotspot clustering) |
| Real-time | Native WebSocket (Cowork shared sessions) |

## Project structure

```
src/                    React frontend (screens, components, i18n)
vajra_backend/
  main.py               FastAPI routes, auth, RLS enforcement
  agent_loop.py          Tool registry + LLM reasoning loop
  catalyst_llm.py         GLM integration
  catalyst_qwen.py        Qwen fallback
  vajra_core.py           Security firewall, session tokens
  *.joblib                Trained XGBoost / DBSCAN / label-encoder artifacts
docs/SCHEMA.md          Reference for the underlying data model
```

## Running locally

**Frontend**
```bash
npm install
npm run dev
```

**Backend** (requires a Zoho Catalyst project with ZCQL Data Store, AppSail,
and QuickML configured — see `vajra_backend/.env` for the expected
credentials)
```bash
cd vajra_backend
pip install -r requirements.txt
python main.py
```

## Deploying

Deployment is exclusively via the Zoho Catalyst CLI, from the project root:

```bash
catalyst deploy --only client,appsail:vajra-backend
```

## License & attribution

Developed for the Karnataka State Police Datathon 2026. Authorized for
internal evaluation and pilot deployment.
