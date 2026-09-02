# VAJRA — Frontend Changes Spec (for the full implementation plan)

> Every frontend change needed to build the plan, mapped to the REAL components in
> `src/`. "New" = a file that doesn't exist yet. Everything else edits an existing
> file. Design/reskin is separate (§0) because it touches all of them.
> Rule: no logic/RLS/audit/bilingual regressions; `tsc` + `vite build` must stay green.

## Real frontend inventory (what we have)
- **Screens:** AIChatScreen · DistrictDashboardScreen · FIRSearchScreen · LoginScreen · ReportsScreen · SettingsScreen · SpatialScreen · SupervisorDashboardScreen
- **Components:** AppletPanel · ChatBubble · ChatHistoryPanel · ChatInput · CoworkInvitationsPanel · ExpandedOverlay · InlineWidget · MainLayout · NetworkGraph · NewInvestigationModal · NotificationBellPanel · SessionTimeoutGuard · ToastContainer · TwoPersonApprovalModal · VajraLogo · WatermarkOverlay
- **Core:** App · AppContext · config · i18n · index.css · main · mockData

---

## §0. Design system — D2 "Vajra Gold" reskin (touches everything)
- **`src/index.css`** — rewrite CSS token vars to the Vajra-Gold palette (charcoal `#161311/#211f1d/#26231f`, gold `#c79a4e/#e4c590`, teal `#5dcaa5`, danger `#e24b4a`); keep light/dark handling; add mono HUD-label + gold-hairline utility classes; audit the undefined `stone-*` shades that rendered as white borders.
- **Every screen + component** — recolor **through the tokens only** (no logic change). Tactical HUD eyebrows (`◈ RISK · XGBOOST`), tinted user bubbles, bare-text AI answers, big rounded voice composer, expand→side-panel.
- **`VajraLogo.tsx`** — crest in charcoal+gold + login intro animation (fade/scale, ring rotate, bolt pulse), reduced-motion safe.
- **`MainLayout.tsx`** — sidebar/header reskin; fonts: Bricolage Grotesque (display), IBM Plex Sans (body), IBM Plex Mono (HUD).
- Accept: walk every screen; EN/KN toggle intact; `vite build` green.

---

## §0.5. Mobile / responsive UI-UX (field-officer phones + tablets) — applies to ALL screens
The app must work as a genuine mobile field tool, not just a desktop console. Fold this into the reskin (Tailwind responsive utilities; no logic change).
- **`MainLayout.tsx`** — sidebar collapses to a hamburger **drawer** (or bottom tab-bar) under `md`; header condenses (badge chip + bell + lang in an overflow on small screens).
- **`AIChatScreen.tsx`** — full-height mobile chat; the right-hand AppletPanel/ExpandedOverlay becomes a **bottom sheet / full-screen slide-over** on mobile (not a side panel); message thread + composer sized for thumb reach; safe-area insets.
- **`ChatInput.tsx`** — composer wraps on narrow screens; the **mobile-only camera button** (`block md:hidden`) lives here; mic/attach/send are large touch targets (≥44px).
- **`InlineWidget.tsx`** — every widget (map, network, charts, news) is fluid width, horizontally scrollable if needed; maps get a min-height and pinch-zoom; tables scroll inside their own container.
- **`SpatialScreen` / `DistrictDashboardScreen`** — controls stack vertically under `md`; the map goes full-width; sliders become touch-friendly.
- **`SupervisorDashboardScreen`** — the two-column layout stacks; approval queue rows are tap-friendly.
- **`LoginScreen`** — single-column, keyboard-aware.
- **Global:** relative units, `max-width:100%` media, no horizontal body scroll, `prefers-reduced-motion` respected, hit targets ≥44px, test at 360px / 768px / 1280px.
- Accept: walk every screen at 360px and 768px in devtools device mode; nothing overflows or clips; EN/KN both fit.

## Per-plan-item frontend work

### 1. Cognitive Brain — MINIMAL
- **`ChatBubble.tsx` / `AIChatScreen.tsx`** — small intent/route badge on answers (Standard / AI-Reasoning β / Full Dossier already shown in the composer). Optional "resolved intent" chip.

### 2 & 8. POCSO auto-redaction
- **`ChatBubble.tsx`, `InlineWidget.tsx`** — render masked tokens the backend already returns for lower ranks (`[REDACTED · POCSO §74]`, phone `XXXXXX4921`).
- **Supervisor tier only:** an "Unmask (logged)" button → re-request unmasked; shows the audit-logged justification. Backend does the masking; frontend just renders + the unmask control.

### 3. Hawala/UPI money-graph
- **`InlineWidget.tsx`** — new `response_type: "financial_network"` → reuse **`NetworkGraph.tsx`** with a money-flow variant (mule = red, bridge = amber, cash-out = teal; edge thickness = amount; direction arrows).
- **`ExpandedOverlay.tsx`** — full-screen graph on Expand.
- Optional **NEW `FinancialGraphModal.tsx`** if a dedicated modal is wanted; a "⏸ Freeze account notice" action chip.

### 4, 9(prov), 17. Court-admissible Provenance HUD
- **`ChatBubble.tsx`** — expand the existing **"Why this answer?"** into a richer collapsible drawer: exact ZCQL query (monospace block), cited record IDs, model features, and the **SHA-256 audit hash** for that message. Backend enriches the citations payload with `query`+`row_hash`.

### 5. 30-day forecaster
- **`InlineWidget.tsx`** — dashed **projection band** on the trend chart (Recharts area).
- **`DistrictDashboardScreen.tsx`** — forecast band on the district trend.
- **`NotificationBellPanel.tsx`** — proactive spike alerts ("⚠️ +22% chain-snatching near Majestic this Fri").

### 6. Inter-district access air-lock
- **`ChatBubble.tsx` / `AIChatScreen.tsx`** — when RLS blocks a record, show a "Outside your jurisdiction — Request cross-district access" CTA (reuses the export-approval request flow).
- **`SupervisorDashboardScreen.tsx`** — a cross-district approval queue (same live-queue pattern as the export approvals) + **`TwoPersonApprovalModal.tsx`**.

### 7. Viral radar
- **`InlineWidget.tsx`** — new `response_type: "viral_radar"` → top-10 trending crime matters as cards with velocity + severity badges (news-card style).
- **`DistrictDashboardScreen.tsx`** — optional "Live Viral Radar" dashboard panel.

### 8. Mobile AR camera lens (biggest new frontend piece)
- **`ChatInput.tsx`** — mobile-only camera button (`block md:hidden`).
- **NEW `TacticalLensModal.tsx`** — fullscreen `getUserMedia` WebRTC viewfinder + a canvas HUD overlay; capture frame → POST to backend → Qwen OCR/description. (Live 30fps ANPR/face is roadmap; the buildable slice is capture→analyze.)

### 9 & 15. Thermal "gas-spray" heat map
- Add **`leaflet.heat`** (frontend dep). **`InlineWidget.tsx`** (map widget) + **`SpatialScreen.tsx`** — render a 4-tier density gradient (green→yellow→orange→red) weighted by cluster intensity; auto `fitBounds`. Backend returns per-point intensity `I∈[0,1]`.

### 10 & 16. Smart bilingual chat titling
- **`ChatHistoryPanel.tsx` / `AIChatScreen.tsx`** — already render session titles; just show the LLM-generated EN/KN title. Near-zero UI change.

### 12 & 18. Sub-200ms SSE omni-stream (big change)
- **`AIChatScreen.tsx`** — replace the pending-reply **polling** with an **`EventSource`** SSE subscription to `GET /api/chat/stream/{session_id}`; render an **optimistic** user bubble on send; show a live "thinking" stream (Searching CCTNS → Scoring → Synthesizing) that morphs into the final answer.
- **`ChatBubble.tsx`** — a streaming/typing state for the in-flight answer.

### 13. Audio/video keyframe analysis
- **`ChatInput.tsx`** — extend attach to accept audio/video; **`ChatBubble.tsx`** — show transcript + keyframe analysis.

### 14 & 20. Serial-offender MO flag
- **`InlineWidget.tsx`** — a "Serial-offender MO match · 0.9x" chip in the risk/network widget.

### 21. Neuroplastic auto-learning
- **`ChatBubble.tsx`** — thumbs 👍/👎 already exist; add an optional "suggest a correction" field on 👎.

---

## "Anything-left" items (frontend)
- **Widget → PDF image capture:** `AIChatScreen.tsx` (`handleExportPDF` — capture each rendered widget to PNG) + `InlineWidget.tsx` (expose per-widget capture refs).
- **New Investigation full view:** `NewInvestigationModal.tsx` + `AIChatScreen.tsx` (case snapshot, invite, evidence rail, pin-to-case).
- **Cowork fully instant:** `AIChatScreen.tsx` (WebSocket subscribe + optimistic echo + dedupe by client_msg_id + presence/typing) + `CoworkInvitationsPanel.tsx`.
- **Live dashboard push:** `SupervisorDashboardScreen.tsx` (WebSocket for pending-export / flag counts; polling stays as fallback).

## New frontend files to create
- `src/components/TacticalLensModal.tsx` (camera AR)
- `src/components/FinancialGraphModal.tsx` (optional — money graph)
- (heat layer + all other work edits existing files)

## New frontend deps
- `leaflet.heat` (thermal map). Everything else uses existing deps (leaflet, recharts, motion, lucide).

## Verification (every change)
- `npm run build` (tsc + vite) green · walk the screen in `npm run dev` (points at localhost or live backend via `config.ts`) · EN/KN toggle works · no regression to auth/RLS/audit widgets.
