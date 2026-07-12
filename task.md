# VAJRA 3.0 Zoho Catalyst Migration Checklist

## Phase 2 — Backend Build
- [x] 1. Session Memory (session_memory.py using Catalyst Cache segment)
- [x] 2. Agent Loop with Tool Registry
- [x] 3. Vague Case Retrieval (`resolve_vague_query` validation + TF-IDF rerank)
- [x] 4. Section Lookup (CaseMaster -> ActSectionAssociation -> Section/Act)
- [x] 5. Precedent-Grounded Section Suggestions
- [x] 6. Classification-Consistency Flagging (scheduled Job Function)
- [x] 7. Financial Transaction Linking (Neo4j accounts nodes integration)
- [x] 8. Crime Forecasting (train_forecast_model.py + ForecastResults)
- [x] 9. Case Summarization (Bilingual English/Kannada)
- [x] 10. Voice Input/Output Endpoint (Zia STT -> Translate -> Agent -> Translate -> TTS)
- [x] 11. Citations Schema for All Tools
- [x] 12. Real Audit Logging (write_audit_log and removing mock logs)
- [x] 13. Role-Scoped Query Enforcement
- [x] 14. Widget-Trigger Classification
- [x] 15. Conversation Export to PDF (/api/chat/export-pdf)
- [x] 16. Compliance Copy Cleanup (strip 1.6M and Kaggle references from server.ts and frontend)

## Phase 3 — Frontend Build & UI Redesign
- [x] Task 1: Reconfigure Frontend Client to pure minimalist chat layout (AIChatScreen as landing router)
- [x] Task 2: Implement expandable full-screen overlays for maps, connection networks, and trend charts
- [x] Task 3: Map all 27 ER tables into the Catalyst Data Store migration script
- [x] Task 4: Upgrade ZQL queries in FastAPI backend to cover all 27 tables
- [x] Task 5: Launch local servers and verify end-to-end ZQL data queries
