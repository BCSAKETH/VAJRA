# VAJRA 3.0 Lead Systems Architectural Audit: Live Capability Inventory & Baseline

**Target System**: VAJRA 2.0 / 3.0 Cognitive Crime Intelligence Copilot  
**Author**: VAJRA 3.0 Lead Systems Architect  
**Classification**: Karnataka State Police (KSP) / Internal Architecture Audit  
**Date**: October 2026  
**Scope**: Comprehensive capability extraction across `vajra_backend/` and `src/`  

---

## Executive Summary

This audit establishes the **true grounded capability baseline** of the VAJRA platform. The codebase is significantly more advanced than a standard CCTNS chatbot. It contains:
1. A **multimodal ingestion pipeline** utilizing dual-engine vision (Qwen VL + Zoho Zia OCR/Moderation/Barcode/Face Match), vendored static FFmpeg for audio/video frame extraction and chunking, PyMuPDF for document rasterization, and server-side Kannada Speech-to-Text.
2. A **140+ tool dispatch ecosystem** spanning technical OSINT (live IFSC resolution, Karnataka RTO registration decoding, local GeoLite2 IP analysis), multi-hop criminal graph analytics (Cytoscape, Louvain syndicate detection, betweenness centrality), and spatiotemporal crime forecasting.
3. A **3-tier cascading Kannada translation architecture** with colloquial dialect normalization, character allowlists, and native bilingual speech synthesis (Anu/Anna).
4. An **actuarial ML and governance framework** featuring the Public Safety & Operational Threat Index (PSOTI), DBSCAN spatial clustering, XGBoost models with TreeSHAP explanations, SOTIE contextual multi-armed bandit optimization, headless Chromium PDF dossier generation with cryptographic SHA-256 seals, and statutory compliance with the Bharatiya Nyaya Sanhita (BNS 2023), BNSS 2023, BSA 2023, and KPA 1963.

---

## 1. MULTIMODAL INGESTION (Vision, OCR, PDF, Audio)

### 1.1 Images & CCTV Analysis
VAJRA deploys a **hybrid dual-engine architecture** combining a large Vision-Language Model (VLM) with dedicated computer vision and forensic APIs.

#### A. Vision-Language Model (VLM)
* **Engine**: `VL-Qwen3.6-35B-A3B` hosted on Catalyst QuickML.
* **File Path**: [`vajra_backend/catalyst_qwen.py`](file:///c:/Users/B.C%20SAKETH/Downloads/VAJRA-main/vajra_backend/catalyst_qwen.py)
* **Function**: `CatalystQwen.analyze(image_bytes_list: List[bytes], instruction: Optional[str] = None)`
* **Operational Mechanism**:
  * Accepts up to 3 images per request.
  * Encodes images to Base64 and dispatches multipart requests to the QuickML VLM endpoint.
  * **Resilience Guard**: Automatically injects a 1x1 transparent PNG (`_BLANK_PNG_B64`) when calling text-only routines, neutralizing a known QuickML HTTP 500 error (`"Problem in the input image"`).
```python
# catalyst_qwen.py (Lines 86-93)
safe_images = images_b64 if (images_b64 and len(images_b64) > 0) else [_BLANK_PNG_B64]
files = [
    ("images", (None, json.dumps(safe_images))),
    ("prompt", (None, prompt)),
]
res = requests.post(self.endpoint_url, headers=headers, files=files, timeout=90)
```

#### B. Dedicated Platform Vision & Forensic APIs
* **Engine**: Zoho Catalyst Zia Platform AI (`zcatalyst_sdk.app.zia()`).
* **File Path**: [`vajra_backend/catalyst_zia.py`](file:///c:/Users/B.C%20SAKETH/Downloads/VAJRA-main/vajra_backend/catalyst_zia.py)
* **Capabilities**:
  1. **Optical Character Recognition (OCR)**:
     * `run_ocr(image_bytes: bytes, language: str = "eng,kan") -> Dict[str, Any]`
     * Extracts printed and handwritten text from scanned FIRs, complaints, and charge sheets with bilingual Kannada and English support.
  2. **Crime Scene Image Moderation**:
     * `check_image_moderation(image_bytes: bytes) -> Dict[str, Any]`
     * Flags graphic violence (`> 0.6`), gore (`> 0.5`), and nudity (`> 0.4`) under Section 74 JJA and POCSO compliance. Triggered images are automatically shielded behind click-to-reveal curtains.
  3. **Malkhana Barcode / QR Scanner**:
     * `scan_barcode(image_bytes: bytes) -> Dict[str, Any]`
     * Scans evidence-bag QR codes and barcodes to preserve chain-of-custody tracking.
  4. **Facial Comparison**:
     * `compare_faces(source_bytes: bytes, query_bytes: bytes) -> Dict[str, Any]`
     * Computes pairwise 0–100% facial similarity between CCTV stills and suspect mugshots for investigative leads.

---

### 1.2 PDF Ingestion & Forensic Document Parsing
* **File Paths**: 
  * Ingestion & Rasterization: [`vajra_backend/main.py#L427-L436`](file:///c:/Users/B.C%20SAKETH/Downloads/VAJRA-main/vajra_backend/main.py#L427-L436)
  * Safe Card Normalization: [`vajra_backend/pdf_utils.py`](file:///c:/Users/B.C%20SAKETH/Downloads/VAJRA-main/vajra_backend/pdf_utils.py)
  * High-Fidelity Export: [`vajra_backend/catalyst_smartbrowz.py`](file:///c:/Users/B.C%20SAKETH/Downloads/VAJRA-main/vajra_backend/catalyst_smartbrowz.py)
* **Parsing Engine**: `fitz` (`PyMuPDF`).
* **Implementation**:
  * Instead of naive plain-text extraction (which fails on handwritten or stamped police FIRs), `_rasterize_pdf` rasterizes the first 3 pages into 150 DPI JPEG images.
  * Pages are downscaled to `MAX_IMAGE_DIMENSION`, individually persisted into Catalyst Stratus object storage, and routed through Zia OCR and Qwen VLM for contextual legal analysis.
```python
# main.py (Lines 427-436)
def _rasterize_pdf(pdf_bytes: bytes, max_pages: int = 3) -> List[bytes]:
    """Renders the first max_pages pages of a PDF to JPEG bytes."""
    import fitz
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    page_images = []
    for page_num in range(min(len(doc), max_pages)):
        page = doc.load_page(page_num)
        pix = page.get_pixmap(dpi=150)
        page_images.append(pix.tobytes("jpeg"))
    doc.close()
    return page_images
```

---

### 1.3 Audio & Voice Processing
* **File Paths**: 
  * Speech Engine: [`vajra_backend/catalyst_speech.py`](file:///c:/Users/B.C%20SAKETH/Downloads/VAJRA-main/vajra_backend/catalyst_speech.py)
  * Audio/Video Chunking: [`vajra_backend/av_analysis.py`](file:///c:/Users/B.C%20SAKETH/Downloads/VAJRA-main/vajra_backend/av_analysis.py)
  * Endpoints: [`vajra_backend/main.py#L11280-L11340`](file:///c:/Users/B.C%20SAKETH/Downloads/VAJRA-main/vajra_backend/main.py#L11280-L11340)
* **Kannada Voice Transcription (STT)**:
  * Uses **Zoho Catalyst Zia Speech-to-Text** (`https://api.catalyst.zoho.in/quickml/api/v1/models/zia/audio/transcribe`).
  * Supported languages: Kannada (`kn`), English (`en`), Hindi (`hi`).
  * **Dual-Language Parallel Transcription**: When `language="auto"`, `/api/voice/stt` dispatches simultaneous STT requests under both English and Kannada via `asyncio.gather` and automatically selects the spoken language.
  * **Anti-Degeneration Guard**: `_looks_degenerate(text)` intercepts and discards runaway repetitive decoding loops common to acoustic decoders.
* **Video & Long Audio Segmentation (`av_analysis.py`)**:
  * Utilizes a bundled static `ffmpeg` executable (via `imageio_ffmpeg`).
  * `extract_video_frames`: Uniformly extracts up to 3 timestamped keyframes across video duration for VLM scene analysis.
  * `chunk_audio`: Splits long recordings (`> 30s`) into clean 25-second windows, transcribes each segment, and deduplicates boundary overlaps.
* **Voice Output (TTS)**:
  * Uses Zia Text-to-Speech (`synthesize_speech`).
  * Dedicated native voices: Kannada female voice **"Anu"** (24kHz), English **"Anna"**, Hindi **"Divya"**.
  * Pre-configured police acoustic personas: `authoritative`, `buttery`, `calm`, `urgent`.
  * Multi-tier audio caching: in-memory LRU (200 entries) + persistent disk cache.

---

### 1.4 Exact File Upload & Multimedia Endpoints

| Endpoint | Method | Handling File | Function / Logic |
| :--- | :--- | :--- | :--- |
| `/api/chat/attachments` | `POST` | `vajra_backend/main.py` | `upload_chat_attachments`: Accepts PDF/PNG/JPG/Audio/Video (up to 20MB aggregate). Runs PyMuPDF rasterization, Zia OCR, Zia safety moderation, Zia barcode scan, FFmpeg frame extraction, Zia STT, and Qwen VLM analysis. |
| `/api/investigations/{session_id}/tasks/upload` | `POST` | `vajra_backend/main.py` | `upload_task_attachment`: Storage-only upload for investigative task evidence into Catalyst Stratus (8MB cap). |
| `/api/attachments/{stratus_key}` | `GET` | `vajra_backend/main.py` | `get_attachment`: Streams raw attachment bytes from Catalyst Stratus. |
| `/api/voice/stt` | `POST` | `vajra_backend/main.py` | `stt_endpoint`: Server-side Zia Audio-to-Text transcription with auto-language resolution. |
| `/api/voice/process-stream` | `POST` | `vajra_backend/main.py` | Streams audio chunks to Zia STT with immediate interim feedback. |
| `/api/voice/tts` | `POST` | `vajra_backend/main.py` | `tts_endpoint`: Server-side Zia speech synthesis with voice persona selection. |
| `/api/chat/export-pdf` | `POST` | `vajra_backend/main.py` | Headless Chromium PDF dossier generation via `catalyst_smartbrowz.py`. |

---

## 2. EXISTING TOOL ECOSYSTEM & THIRD-PARTY APIS

Beyond standard CCTNS queries, the VAJRA engine features **140+ registered tool dispatch branches** in [`vajra_backend/agent_loop.py`](file:///c:/Users/B.C%20SAKETH/Downloads/VAJRA-main/vajra_backend/agent_loop.py).

### 2.1 Technical OSINT & Vehicle Forensics
* **File Path**: [`vajra_backend/technical_osint.py`](file:///c:/Users/B.C%20SAKETH/Downloads/VAJRA-main/vajra_backend/technical_osint.py)

#### 1. RTO Vehicle Registration Plate Decoder
* **Tool / Function**: `resolve_rto_plate(plate_number: str)`
* **Coverage**: Complete mapping of Karnataka RTO series (`KA-01` through `KA-55`).
* **Output**: RTO Office, District, Police Operational Zone, and jurisdictional mapping.
```python
# technical_osint.py (Lines 172-192)
def resolve_rto_plate(plate_number: str) -> Dict[str, Any]:
    clean = re.sub(r"[^A-Z0-9]", "", (plate_number or "").upper())
    rto_code = clean[:4]
    info = _KARNATAKA_RTO_REGISTRY.get(rto_code)
    if info:
        return {
            "valid": True, "plate": plate_number, "rto_code": rto_code,
            "rto_office": info["rto"], "district": info["district"], 
            "police_zone": info["zone"],
            "jurisdiction": f"{info['rto']} RTO, {info['district']}",
        }
```

#### 2. Live Bank IFSC / Branch Reverse Resolver
* **Tool / Function**: `resolve_ifsc(ifsc_code: str)`
* **Integration**: Live API call to public registry `https://ifsc.razorpay.com/{CODE}` with deterministic fallback to `_IFSC_BANK_CODES` prefix routing. Returns Bank Name, Branch, Address, MICR, and District.

#### 3. Passive IP Geolocation with Hardened SSRF Guard
* **Tool / Function**: `lookup_whois_ip(target: str)`
* **Integration**: Local MaxMind `GeoLite2-City.mmdb` database lookup (no external API calls, zero traffic leak).
* **Security Guard**: Strict Python `ipaddress` validation blocking queries against private, loopback, link-local, multicast, or reserved networks.

---

### 2.2 GIS, Spatial Hotspots & Spatiotemporal Forecasting
* **File Paths**: 
  * Forecast Engine: [`vajra_backend/spatiotemporal_forecast.py`](file:///c:/Users/B.C%20SAKETH/Downloads/VAJRA-main/vajra_backend/spatiotemporal_forecast.py)
  * ML Clustering: [`vajra_backend/dbscan_hotspots.joblib`](file:///c:/Users/B.C%20SAKETH/Downloads/VAJRA-main/vajra_backend/dbscan_hotspots.joblib)
  * Frontend UI: [`src/components/DistrictSpatialAnalystPanel.tsx`](file:///c:/Users/B.C%20SAKETH/Downloads/VAJRA-main/src/components/DistrictSpatialAnalystPanel.tsx), [`src/lib/basemap.ts`](file:///c:/Users/B.C%20SAKETH/Downloads/VAJRA-main/src/lib/basemap.ts)
* **Key Endpoints & Tools**:
  * `query_hotspots`: Uses DBSCAN spatial clustering over coordinates to detect dense incident epicenters.
  * `/api/geospatial/station-forecast`: Calculates station-level crime density deviations using historical Day-of-Week statistical z-score models.
  * `/api/cases/near`: Spatial radius search around latitude/longitude coordinates.
  * `/api/analytics/accident-spots`: High-frequency road accident blackspot clustering.
  * `dynamic_beat_route_optimizer`: Generates optimized tactical patrol routes across prioritized hotspots.
  * `get_choke_point_nakabandi_plan`: Calculates strategic road check-points based on getaway corridors.

---

### 2.3 Criminal Network Graphing & Syndicate Detection
* **File Paths**:
  * Core Graph Algorithms: [`vajra_backend/vajra_core.py`](file:///c:/Users/B.C%20SAKETH/Downloads/VAJRA-main/vajra_backend/vajra_core.py) (`_compute_syndicate_clusters`, `VajraGraphRAG`)
  * Case Intelligence: [`vajra_backend/case_intelligence.py`](file:///c:/Users/B.C%20SAKETH/Downloads/VAJRA-main/vajra_backend/case_intelligence.py)
  * Frontend Visualization: [`src/components/NetworkGraph.tsx`](file:///c:/Users/B.C%20SAKETH/Downloads/VAJRA-main/src/components/NetworkGraph.tsx) (Cytoscape.js force-directed canvas)
* **Key Graph Capabilities**:
  1. **Louvain Syndicate Community Detection**:
     * Runs community detection over co-accused links across 12,000+ accused persons.
     * Identifies organized crime syndicates, central kingpin hubs, and cross-district operational footprints.
  2. **Betweenness & Degree Centrality**:
     * `centrality_ranking`: Discovers hidden connectors linking seemingly unrelated criminal cells.
  3. **Multi-Hop Traversal**:
     * `trace_connection_path`: Finds the shortest co-accused path connecting Suspect A to Suspect B.
     * `find_common_connections`: Pinpoints shared associates between suspects.
  4. **Financial Mule Ring Detection**:
     * `detect_financial_ring`: Traces circular fund routing, shared UPI IDs, and bank account clusters.

---

### 2.4 Complete LLM Tool Functions Catalog

The LLM agent loop (`VajraAgentLoop`) selects and executes tools from a 140+ functional catalog:

1. **Identity & Officer Context**: `get_my_profile`, `get_officer_caseload`, `get_officer_performance_score`.
2. **CCTNS FIR & Case Records**: `query_case`, `summarize_case`, `list_cases`, `list_cases_sharing_id`, `resolve_vague_query`, `get_case_sections`, `get_fir_details`, `search_cases_by_keyword`, `get_recent_cases`, `get_case_timeline`, `get_case_status`, `get_chargesheet_ready_cases`, `get_case_intelligence_dossier`, `count_cases`.
3. **Accused & Criminal History**: `search_accused_by_name`, `get_repeat_offenders`, `get_bail_history`, `get_warrants_for_accused`, `get_accused_associates`, `get_accused_property_seizures`, `list_wanted_accused`, `list_suspects_by_crime_type`, `get_offender_timeline`, `get_offender_profile`.
4. **Threat Assessment & Risk**: `get_offender_risk` (PSOTI Actuarial Threat Score), `predict_future_crimes`, `check_alibi_consistency`, `detect_case_anomalies`.
5. **Modus Operandi & Patterns**: `cluster_crime_patterns`, `get_mo_profile`, `find_similar_cases`, `detect_crime_groups`.
6. **Network & Syndicate Graph**: `query_graph_network`, `trace_connection_path`, `find_common_connections`, `query_financial_links`, `detect_financial_ring`, `get_cdr_analysis`, `get_syndicate_hierarchy`, `community_detection`, `centrality_ranking`, `shared_attribute_links`.
7. **Geospatial & Patrol Deployment**: `query_hotspots`, `dynamic_beat_route_optimizer`, `temporal_spatial_hotspot_matrix`, `generate_jurisdiction_choropleth`, `get_live_patrol_gps_tracking`, `get_station_boundary_polygon`, `get_choke_point_nakabandi_plan`, `evaluate_patrol_coverage_efficiency`, `get_forecast`, `get_traffic_accident_blackspot_radar`, `plan_patrol_deployment`.
8. **Statutory & Legal Compliance (BNS / BNSS / BSA / POCSO)**: `suggest_sections`, `recommend_sections`, `convert_ipc_to_bns`, `check_statutory_compliance`, `get_default_bail_countdown`, `audit_search_seizure_video`, `generate_witness_summons`, `audit_zero_fir_transfer`, `generate_preliminary_inquiry_docket`, `get_electronic_evidence_cert`, `get_pocso_compliance_tracker`, `get_bail_opposition_docket`.
9. **Technical OSINT & Open Web**: `resolve_rto_plate`, `resolve_ifsc`, `lookup_whois_ip`, `scan_viral_social_threats`, `web_search`, `get_live_news`, `summarize_url`, `analyze_online_abuse`.
10. **Evidence & Forensics**: `analyze_crime_scene_av`, `get_malkhana_property_tracker`, `get_fsl_tracking_status`, `audit_evidence_chain`, `get_missing_persons_facial_recon`.
11. **Supervisory & Command Governance**: `get_district_crime_matrix`, `generate_parliamentary_qa_report`, `get_sp_monthly_crime_review`, `get_emergency_112_dispatch_board`, `get_scrb_statewide_crime_bulletin`, `get_station_summary`, `generate_supervisory_review`, `get_unit_scorecards`, `get_district_benchmark`.
12. **Case Diary & Collaboration**: `add_diary_entry`, `add_case_diary_entry`, `search_diary_entries`, `get_case_diary_stats`, `add_investigation_task`, `send_investigation_email`, `generate_case_dossier`, `generate_full_report`.

---

## 3. KANNADA LANGUAGE PROCESSING

### 3.1 3-Tier Cascading Translation Engine
Translation is handled by `GLMTranslator` in [`vajra_backend/main.py#L463-L585`](file:///c:/Users/B.C%20SAKETH/Downloads/VAJRA-main/vajra_backend/main.py#L463-L585). It implements a fail-soft cascade:

```
[Input Text (English or Kannada)]
               │
               ▼
   [Slang Normalization Pre-Pass] (DIALECT_MAP)
               │
               ▼
   [Zia Fast Character Sanitizer] (_ZIA_UNSAFE_CHARS)
               │
               ▼
┌──────────────────────────────────────────────┐
│ Tier 1: Zoho Zia Fast Text Translation       │ ── Success (0.7s - 2.0s) ──► Return Output
│ (CatalystLLM.translate_fast)                 │
└──────────────────────────────────────────────┘
               │ (Fails / Character Mismatch)
               ▼
┌──────────────────────────────────────────────┐
│ Tier 2: GLM Chat LLM Translation             │ ── Success ──────────────► Return Output
│ (CatalystLLM.translate)                      │
└──────────────────────────────────────────────┘
               │ (Fails / Timeout / Outage)
               ▼
┌──────────────────────────────────────────────┐
│ Tier 3: Qwen VLM Translation Fallback        │ ── Success ──────────────► Return Output
│ (CatalystQwen.translate)                     │
└──────────────────────────────────────────────┘
               │ (All Tiers Fail)
               ▼
      [Return Original Text]
```

### 3.2 Spoken Slang Normalization Pre-Pass
Normalizes colloquial spoken North/South Karnataka police dialects into formal legal Kannada:
```python
# main.py (Lines 473-485)
DIALECT_MAP = {
    "ಮಾಡ್ಬುಟ್ಟೆ": "ಮಾಡಿದ್ದೇನೆ",
    "ಹೋದ": "ತೆರಳಿದ್ದಾನೆ",
    "ಹೇಳ್ದ": "ತಿಳಿಸಿದ್ದಾನೆ",
    "ಗೊತ್ತಾಯ್ತು": "ತಿಳಿದಿದೆ",
    "ಆಯ್ತು": "ಸರಿ"
}
```

### 3.3 Zia Input Character Allowlisting
Zia's fast translate API rejects unescaped punctuation with undocumented `400 PATTERN_NOT_MATCHED` errors. VAJRA implements strict allowlist regex filtering:
```python
# main.py (Lines 498-518)
_ZIA_UNSAFE_CHARS = re.compile(r"[^\w\s.,:\-'\"!?&/@₹]", re.UNICODE)
```

### 3.4 Native LLM Kannada Comprehension
The LLM system prompt in `agent_loop.py` instructs the model to natively parse queries entered in Kannada script (ಕನ್ನಡ ಲಿಪಿ) or Kannada transliteration (Kanglish). The model retrieves official CCTNS records and uses the Probabilistic Natural Language Generator (`ksp_pnlg_engine.py`) to construct formatted Kannada outputs.

### 3.5 Frontend Localization (`src/i18n.ts`)
Comprehensive client-side internationalization containing hundreds of translated keys for navigation items, crime heads (118 heads), risk levels, procedural directives, and UI labels.

---

## 4. ARCHITECTURAL LAYOUT & UNDISCOVERED GEMS

### 4.1 Directory Topography

```
c:\Users\B.C SAKETH\Downloads\VAJRA-main\
├── vajra_backend/
│   ├── assets/fonts/
│   │   └── NotoSansKannada-Regular.ttf      # Embedded font for Kannada PDF rendering
│   ├── data/
│   │   ├── entity_alias_store.json          # Extracted entity aliases & CCTNS nicknames
│   │   ├── gold_tool_exemplars.json         # Few-shot exemplars for tool routing
│   │   └── tool_bandit_weights.json         # SOTIE contextual multi-armed bandit weights
│   ├── functions/                           # Catalyst Serverless & Cron Functions
│   │   ├── ai_turn_worker/                  # Async AI execution worker
│   │   ├── case_insert_signal/              # DB Signal for real-time serial MO profiling
│   │   ├── osint_radar/                     # 6-hourly automated OSINT intelligence scraper
│   │   └── proactive_alerts/                # Scheduled job computing statewide crime spikes
│   ├── agent_loop.py                        # Multi-turn LLM agent loop & 140+ tool dispatch
│   ├── av_analysis.py                       # FFmpeg keyframe extraction & audio chunker
│   ├── bns_concordance.py                   # Authoritative IPC 1860 to BNS 2023 concordance registry
│   ├── calibrate_risk_model.py              # Isotonic regression calibrator script
│   ├── case_intelligence.py                 # Multi-accused dossier & syndicate context
│   ├── catalyst_llm.py                      # GLM Chat LLM client & Zia fast-translation
│   ├── catalyst_qwen.py                     # Qwen-VL 35B vision & emergency fallback
│   ├── catalyst_smartbrowz.py               # Headless Chromium Browser360 PDF dossier generator
│   ├── catalyst_speech.py                   # Zia STT / TTS engine with police voice personas
│   ├── catalyst_stratus.py                  # Catalyst Stratus object storage client
│   ├── catalyst_zia.py                      # Zia OCR, Moderation, Barcode, Face Match
│   ├── cowork_feed.py                       # Multi-officer collaborative investigation sync
│   ├── crime_heads_118_map.py               # 118 KSP Crime Head taxonomic mapper
│   ├── dbscan_hotspots.joblib               # Serialized DBSCAN spatial clustering model
│   ├── internet_signals.py                  # Controlled RSS & Google News OSINT ingestion
│   ├── isotonic_calibrator.joblib           # Calibrated risk probabilities artifact
│   ├── ksp_plot_engine.py                   # Dark-themed universal SVG/PNG charting engine
│   ├── ksp_pnlg_engine.py                   # 28-block Probabilistic Natural Language Generator
│   ├── ksp_response_tailor.py               # Response framing for rank-appropriate briefs
│   ├── label_encoders.joblib                # Categorical encoders for ML models
│   ├── main.py                              # FastAPI core gateway & API routes (12,786 lines)
│   ├── mascot_engine.py                     # Vajra-Vak bilingual officer quip generator
│   ├── officer_governance.py                # KPA §23 / BNSS §126 personnel access engine
│   ├── pdf_utils.py                         # Defensive type-normalization slice helpers
│   ├── progress_tracker.py                  # Real-time WebSocket/polling turn status tracker
│   ├── session_manager.py                   # Distributed multi-tab session management
│   ├── session_memory.py                    # Multi-turn conversational memory & entity tracking
│   ├── shap_explainer.joblib                # TreeSHAP explainer for ML factor attribution
│   ├── spatiotemporal_forecast.py           # Day-of-Week station crime density z-scores
│   ├── technical_osint.py                   # RTO plate decoder, live IFSC resolver, GeoIP
│   ├── threat_scoring_engine.py             # Grounded PSOTI actuarial threat index
│   ├── tool_training_optimizer.py           # SOTIE multi-armed bandit optimizer
│   ├── train_risk_model_v2.py               # Rigorous stratified ML evaluation suite
│   ├── vajra_cognitive_brain.py             # Semantic compiler & cognitive planning engine
│   ├── vajra_core.py                        # ZCQL database helpers, Louvain clustering, security
│   ├── viral_trend_radar.py                 # Public RSS trend analyzer
│   └── xgboost_risk_model.joblib            # Trained XGBoost recidivism model
│
└── src/                                     # React 18 + Vite Frontend
    ├── assets/                              # Karnataka district GeoJSON geometries
    ├── components/
    │   ├── ChatBubble.tsx                   # Interactive message bubble with widget renderer
    │   ├── ChatInput.tsx                    # Audio recording, attachment dock & mascot mount
    │   ├── DistrictSpatialAnalystPanel.tsx  # Interactive Leaflet geospatial hotspot board
    │   ├── ExpandedOverlay.tsx              # Deep inspection modal for charts, cards & dossiers
    │   ├── NetworkGraph.tsx                 # Cytoscape.js criminal network visualizer
    │   ├── OSINTCard.tsx                    # Open-source intelligence trust-separated cards
    │   ├── PersonnelGovernancePanel.tsx     # Officer management, killswitches, audit logs
    │   ├── UniversalPoliceIntelCard.tsx     # High-contrast multi-panel intelligence cards
    │   ├── VajraVakMascot.tsx               # Interactive Sentinel Owl companion
    │   └── WatermarkOverlay.tsx             # Cryptographic tamper-evident officer watermark
    ├── lib/
    │   ├── basemap.ts                       # Leaflet dark-cockpit cartographic basemaps
    │   └── designTokens.ts                  # Gold/emerald/amber police UI design tokens
    └── screens/
        ├── AIChatScreen.tsx                 # Real-time cognitive intelligence chat cockpit
        ├── DistrictDashboardScreen.tsx      # Statewide crime matrices & spatial analytics
        ├── InvestigationsScreen.tsx         # Multi-officer case boards & tasks
        └── SupervisorDashboardScreen.tsx    # Governance approvals (POCSO, district overrides)
```

---

### 4.2 Highlighted Undiscovered Gems in the Codebase

#### 1. Self-Optimizing Tool Intelligence Engine (SOTIE)
* **File Path**: [`vajra_backend/tool_training_optimizer.py`](file:///c:/Users/B.C%20SAKETH/Downloads/VAJRA-main/vajra_backend/tool_training_optimizer.py)
* **Implementation**: Uses a **contextual multi-armed bandit algorithm** that dynamically adjusts tool selection probabilities based on real officer feedback and corrections. Stores learned weights in `data/tool_bandit_weights.json` and updates golden exemplars in `data/gold_tool_exemplars.json` with sub-millisecond in-memory inference.

#### 2. KSP 28-Block Modular Probabilistic Natural Language Generator (PNLG)
* **File Path**: [`vajra_backend/ksp_pnlg_engine.py`](file:///c:/Users/B.C%20SAKETH/Downloads/VAJRA-main/vajra_backend/ksp_pnlg_engine.py)
* **Implementation**: Replaces slow secondary LLM calls with a deterministic, DAG-based synthesis engine. Assembles publication-grade forensic briefs in **< 5ms** using a palette of 28 dynamic blocks. 
* **Judicial Reproducibility**: Uses deterministic turn-hash seeding (`int(SHA256(SessionID || TurnID || Query)[:16], 16)`), ensuring 100% bitwise reproducibility for High Court audits under **Section 63 BSA**.

#### 3. Grounded Public Safety & Operational Threat Index (PSOTI)
* **File Path**: [`vajra_backend/threat_scoring_engine.py`](file:///c:/Users/B.C%20SAKETH/Downloads/VAJRA-main/vajra_backend/threat_scoring_engine.py)
* **Implementation**: Replaced uncalibrated raw XGBoost conviction probabilities with an actuarial threat scoring framework compliant with Supreme Court precedents (*Satender Kumar Antil v. CBI*, *Arnesh Kumar v. State of Bihar*). Computes:
  * Relapse / Recidivism Potential (RRP: 0–100)
  * Flight & Procedural Evasion Risk (FER: 0–100)
  * Syndicate vs. Individual Nexus (SIN: 0–100)
  * Statutory Remand & Bail Directives under BNSS §35(3), §84, §187(3), §480.

#### 4. Headless Chromium SmartBrowz Dossier Generator
* **File Path**: [`vajra_backend/catalyst_smartbrowz.py`](file:///c:/Users/B.C%20SAKETH/Downloads/VAJRA-main/vajra_backend/catalyst_smartbrowz.py)
* **Implementation**: 1,535 lines of production-grade reporting infrastructure. Leverages Zoho Catalyst SmartBrowz (Browser360) to render pixel-perfect PDF dossiers with official Karnataka Police letterhead, bundled Noto Sans Kannada Unicode fonts, and embedded visual charts. Injects a cryptographic **SHA-256 seal** and dynamic officer watermarks.

#### 5. BNS 2023 Statutory Concordance Engine
* **File Path**: [`vajra_backend/bns_concordance.py`](file:///c:/Users/B.C%20SAKETH/Downloads/VAJRA-main/vajra_backend/bns_concordance.py)
* **Implementation**: Authoritative in-memory legal concordance engine mapping legacy Indian Penal Code (IPC 1860) sections to Bharatiya Nyaya Sanhita (BNS 2023), including classification (bailable/cognizable), trial jurisdiction, procedural shifts under BNSS 2023, and transitional clauses (§358 BNS / §531 BNSS).

#### 6. Autonomous Serverless Cron & DB Signals
* **File Paths**: `vajra_backend/functions/`
  * `proactive_alerts/index.py`: Catalyst cron job paginating across 20,000+ CaseMaster rows and 12,000+ Accused records to calculate crime spikes and insert proactive warning alerts.
  * `osint_radar/index.py`: 6-hourly autonomous news intelligence scraper sweeping statewide public threat feeds.
  * `case_insert_signal/index.py`: Event signal fired on `CaseMaster` table inserts to automatically trigger real-time MO behavioral profiling.

---

## 5. Architectural Gap Analysis: Built vs. Available vs. Active

| Capability Area | Designed Specification | Backend Code Status | Frontend Active Status |
| :--- | :--- | :--- | :--- |
| **Qwen VLM Vision Ingestion** | Full multimodal image reasoning | **100% Built** (`catalyst_qwen.py`) | **Active** via `/api/chat/attachments` |
| **Zia OCR, Moderation & Barcode** | Scanned FIR OCR, crime scene moderation | **100% Built** (`catalyst_zia.py`) | **Active** (Shielding & barcode cards render) |
| **Video & Long Audio FFmpeg** | Timestamped keyframe sampling & chunking | **100% Built** (`av_analysis.py`) | **Active** (Processed on upload) |
| **Zia Server-Side STT & TTS** | Real Kannada Speech-to-Text & Speech Synthesis | **100% Built** (`catalyst_speech.py`) | **Active** (Mic button + speaker buttons) |
| **RTO & IFSC Resolvers** | Vehicle plate KA-01..55 & IFSC resolution | **100% Built** (`technical_osint.py`) | **Active** as LLM tools |
| **Network Graphing (Cytoscape)** | Co-accused & syndicate visualization | **100% Built** (`vajra_core.py`, `NetworkGraph.tsx`) | **Active** (Renders in expanded overlay) |
| **DBSCAN & Spatial Forecast** | Density clustering & day-of-week z-score | **100% Built** (`spatiotemporal_forecast.py`) | **Active** in `DistrictSpatialAnalystPanel` |
| **PSOTI Threat Scoring** | Actuarial recidivism & bail compliance | **100% Built** (`threat_scoring_engine.py`) | **Active** (Renders grounded threat cards) |
| **BNS 2023 Concordance** | IPC to BNS/BNSS translation | **100% Built** (`bns_concordance.py`) | **Active** (Invoked in legal advice tools) |
| **SmartBrowz PDF Dossier** | Chromium PDF export with Kannada fonts & SHA-256 | **100% Built** (`catalyst_smartbrowz.py`) | **Active** via "Export PDF" button |
| **Vajra-Vak Sentinel Owl** | 16-state animated companion with waypoints | **20% Built** (3 states active, flat SVG) | **Partial** (Fixed anchor above input) |

---

## Conclusion
VAJRA is already a robust, hardened, and highly capable platform. Its backend engine combines modern generative AI (QuickML Qwen VLM and GLM) with deterministic statutory legal rules (BNS 2023), actuarial threat indices (PSOTI), forensic computer vision (Zia), and headless browser automation (SmartBrowz).
