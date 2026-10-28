# KSP VAJRA 3.0 — Master ML Retraining, Architecture & Deployment Blueprint

**Document Version:** 3.0.0-PROD  
**Status:** Architecture Approved for Staged Implementation  
**Target Authority:** Karnataka State Police (KSP) Advanced Agentic AI Standards  
**Dataset Scale:** 1,695,718 CCTNS Records (Zoho Catalyst Data Store)  
**Security & Evidence Compliance:** Bharatiya Sakshya Adhiniyam (BSA) 2023 §63, BNSS 2023 §187(3), BNS 2023 §111  

---

## Executive Summary

This document establishes the binding technical, algorithmic, and operational standard for retraining, fine-tuning, and deploying all **five core machine learning capabilities** of Project VAJRA across the full 1.7-million-record database:

1. **Crime Pattern Discovery** (Spatial & Temporal Observed Concentrations)
2. **Criminal Network Analysis** (Multi-Hop Investigative Relationship Graph)
3. **Socio-Demographic Crime Insights** (Aggregate Context & Population-Normalized Risk)
4. **Behavioral & Criminological Profiling** (MO Semantic Retrieval & Procedural Threat Audit)
5. **Proactive Crime Prevention Intelligence** (Spatiotemporal Forecasting & Road-Aware Patrol Dispatch)

All five capabilities are **mandatory and non-negotiable** for KSP operational readiness. This blueprint incorporates strict engineering and legal safeguards: separating observed facts from analytical interpretations, eliminating individual criminality demographic scoring, replacing straight-line distances with road-network routing, and requiring empirical validation against baselines before operational authorization.

---

## 1. Phase 0A: Empirical Data Integrity Baseline

A live read-only audit of the production database (`vajra_backend/audit_cctns_integrity.py`) completed on October 28, 2026, establishes the ground-truth data inventory:

```
+───────────────────────────────────────────────────────────────────────────────────────────────────────────+
|                                    CCTNS PRODUCTION DATA INVENTORY                                        |
+──────────────────────────────+─────────────────+──────────────────────────────────────────────────────────+
| Table Name                   | Verified Count  | Analytical Scope & Purpose                               |
+──────────────────────────────+─────────────────+──────────────────────────────────────────────────────────+
| CaseMaster (Total)           | 1,695,718 rows  | Complete FIR register across Karnataka                   |
| CaseMaster (Geocoded)        |   529,118 rows  | Records with non-null coordinates (31.2% of database)    |
| CaseMaster (Non-Geocoded)    | 1,166,600 rows  | Administrative/beat records with PoliceStationID only    |
| Accused                      |    12,118 rows  | Formally named suspects; grounds Co-Accused Graph        |
| Victim                       |     8,073 rows  | Victim demographic profiles (Age, Gender, Police status) |
| ComplainantDetails           |     8,073 rows  | Complainant demographics (Age, Gender, Caste, Religion)  |
| ChargesheetDetails           |     7,004 rows  | Filed chargesheets; grounds judicial history & remand    |
| Unit (Police Stations)       |     1,112 units | Police stations and specialized squads statewide         |
| District                     |      41 dists   | Administrative police districts and commissionerates     |
| DistrictSocioProfile         |      30 dists   | Socioeconomic indicators (11 districts unprofiled)       |
| CaseCategory                 |       4 types   | Major classifications (Heinous / Non-Heinous / Special)  |
+──────────────────────────────+─────────────────+──────────────────────────────────────────────────────────+
```

### Empirical Quality Findings
1. **Coordinate Quality & Centroid Collisions:**
   - **100.0%** of sampled geocoded coordinates fall strictly within Karnataka’s bounding box ($11.0^\circ\text{N} \le \text{lat} \le 19.0^\circ\text{N}$, $73.5^\circ\text{E} \le \text{lng} \le 79.0^\circ\text{E}$).
   - **1.3% Station Centroid Collision Rate:** Over 98% of geocoded coordinates represent distinct, localized incident locations recorded to 4–6 decimal places ($\approx 1\text{ to }11\text{ meters}$ precision), while only 1.3% default to identical station headquarters coordinates.
2. **Narrative Corpus (`BriefFacts`):**
   - **100.0%** of sampled records contain non-null text (median length: **197 characters**, range: 68–406 characters).
   - **Language:** 100% English/Latin script across sampled partitions (zero Kannada Unicode characters in `BriefFacts`).
   - **Text Structure:** **74.1%** are structured CCTNS summary records (`"Real CCTNS-derived record: <CrimeHead> registered at <Unit>, <Place>. Sections: <Acts> U/s: <Sections>..."`), while **25.0%** are templated beat strings (`"Incident of [crime] reported at [Address]. Official beat patrol logged."`).
3. **Temporal Completeness & As-Of Integrity:**
   - 100% of cases carry valid `IncidentFromDate` and `CrimeRegisteredDate`.
   - **As-Of Rule:** Spatiotemporal forecasting will strictly aggregate on `CrimeRegisteredDate` (administrative availability date) when forecasting station workload, and on `IncidentFromDate` when analyzing temporal patterns, preventing retrospective lookahead leakage.
4. **Socioeconomic Boundary Constraint:**
   - `DistrictSocioProfile` contains records for **30 districts**. The remaining 11 administrative districts do not have socioeconomic profiles in the database. All socioeconomic comparisons must transparently disclose this 30-district boundary constraint and never claim statewide socioeconomic coverage.

---

## 2. The Four-Tier Epistemic Separation Framework

To ensure that statistical models, graph metrics, and similarity scores are never mistaken for verified legal facts or proof of guilt, all VAJRA components enforce strict four-tier separation:

```
+───────────────────────────────────────────────────────────────────────────────────────────────────────────+
|                                    FOUR-TIER CERTAINTY FRAMEWORK                                          |
+──────────────────────────────+─────────────────────────────────────────────+──────────────────────────────+
| Tier Level                   | Technical Definition                        | Mandatory UI Disclosure      |
+──────────────────────────────+─────────────────────────────────────────────+──────────────────────────────+
| Tier 1: Source Record        | Verifiable, immutable entries from CCTNS.   | "Documented CCTNS Record"    |
|                              | (e.g. Individual named in FIR #81977).      | Direct citation + Timestamp  |
+──────────────────────────────+─────────────────────────────────────────────+──────────────────────────────+
| Tier 2: Derived Relationship | Algorithmic associations with confidence    | "Candidate Match"            |
|                              | metrics (e.g. Jaro-Winkler + Age match).    | Score + Match Explanation    |
+──────────────────────────────+─────────────────────────────────────────────+──────────────────────────────+
| Tier 3: Analytical Inference | Graph structural or statistical metrics     | "Investigative Lead"         |
|                              | (e.g. High betweenness centrality bridge).  | Topological property only    |
+──────────────────────────────+─────────────────────────────────────────────+──────────────────────────────+
| Tier 4: Operational Decision | Actions taken exclusively by authorized IOs | "Investigator Determination" |
|                              | (e.g. Warrant request, patrol dispatch).    | Officer KGID + Audit Trail   |
+──────────────────────────────+─────────────────────────────────────────────+──────────────────────────────+
```

---

## 3. Technical Specifications for the 5 Capabilities

```
+───────────────────────────────────────────────────────────────────────────────────────────────────────────+
|                                  SYSTEM ARCHITECTURE & CAPABILITY MATRIX                                  |
+───────────────────────────────────────────────────────────────────────────────────────────────────────────+
|                                                                                                           |
|  [Catalyst Data Store: 1,695,718 Cases]                                                                   |
|       │                                                                                                   |
|       ▼ (Keyset Seek Stream: 870 rows/s, zero heap accumulation)                                          |
|  [Verified Offline Feature Engine & Data Lake]                                                            |
|       │                                                                                                   |
|       ├─► Validated Parquet Partition Store (1.69M rows, source reconciled)                               |
|       ├─► Verified Geocode Cache (529,118 points, H3 Res 7-9 pre-indexed)                                |
|       └─► Co-Accused Bipartite Graph (12,118 Accused records, NetworkX engine)                             |
|                                                                                                           |
|  ───────────────────────────────────────────────────────────────────────────────────────────────────────  |
|                                     PRODUCTION ANALYTICAL SERVICES                                        |
|                                                                                                           |
|  Track 1: Spatial Analytics        Track 2: Network Intelligence     Track 3: MO Semantic Retrieval       |
|  * H3 Hexagonal Binning (Res 7-9)  * Multi-Hop Co-Accused Graph      * Multilingual Sentence-BERT         |
|  * Observed Concentrations         * Betweenness Structural Bridges  * FAISS HNSW32 Vector Index          |
|  * Haversine HDBSCAN Clusters      * Louvain Gang Communities        * Explainable Attribute Matching     |
|  * GPS Precision Indicators        * ZERO Synthetic Mock Fallbacks   * [NO IPC-Category Fine-Tuning]      |
|                                                                                                           |
|  Track 4: Forecast & Road Patrol   Track 5: Socio-Demographic Context Track 5b: Procedural Legal Engine   |
|  * Station LightGBM Forecaster     * 30-District Context Rates       * Deterministic BNSS 187(3) Remand   |
|  * Rolling-Origin Backtesting      * Population-Normalized per 100k  * Section 111 BNS Checklist          |
|  * Road-Network OSRM TSP Corridors * Demographic Victimology Profiler* Traceable Procedural Audit Checklist|
|  * Station Volume Stratification   * [NO Individual Criminality ML]  * [NO "Court-Admissible" Claim]      |
|                                                                                                           |
+───────────────────────────────────────────────────────────────────────────────────────────────────────────+
```

---

### Capability 1: Crime Pattern Discovery (Spatial & Temporal Analytics)

- **Framing:** **Observed Incident Concentrations** (not "predictive crime hotspots").
- **Dataset:** All **529,118 verified geocoded incidents** from `CaseMaster`.
- **Spatial Indexing Engine:** Uber H3 Hierarchical Hexagonal Indexing across three operational resolutions:
  - *Resolution 7* (~1.22 km edge): District and jurisdictional macro-hotspots for SPs and Commissioners.
  - *Resolution 8* (~461 m edge): Precinct-level patrol sectors for Inspectors and SHOs.
  - *Resolution 9* (~174 m edge): Street intersections, transit junctions, and commercial blackspots for Beat Constables.
- **Clustering Algorithm:** `HDBSCAN(metric='haversine', min_cluster_size=10, min_samples=4)` on spherical coordinates (radians) to surface localized density clusters without forcing sparse rural points into arbitrary groups.
- **Temporal Weighting & Decay Validation:** Evaluates exponential half-life decay ($w_i = \exp(-\Delta t_i / \tau)$ across $\tau \in \{30, 90, 180\}\text{ days}$) against an unweighted baseline on rolling test windows to measure cluster stability.
- **Coordinate Precision Tagging:** The UI displays explicit precision flags:
  - 🟢 **High Precision GPS:** Distinct incident site coordinates.
  - 🟡 **Station Jurisdiction Centroid:** Geocode defaulted to police station coordinates.
- **Runtime Memory Structure:** Memory-mapped binary NumPy array (`ksp_spatial_cache.npz`, **15.34 MiB** raw buffer) with structured types:
  $$\mathbf{X}_{\text{spatial}} = [\text{lat}: \text{float32}, \text{lng}: \text{float32}, \text{h3\_res8}: \text{uint64}, \text{timestamp}: \text{int64}, \text{head\_id}: \text{int16}, \text{unit\_id}: \text{int16}]$$

---

### Capability 2: Criminal Network Analysis (Investigative Relationship Graph)

- **Framing:** **Investigative Relationship Leads** (not "proof of criminal gang" or "kingpin identification").
- **Dataset:** All **12,118 Accused records** linked across the 1.69M cases.
- **Graph Topology:** Bipartite graph $G = (V_{\text{accused}} \cup V_{\text{case}}, E)$ projected onto a weighted co-accused graph $G' = (V_{\text{accused}}, E')$ where edge weight represents shared case count and crime gravity:
  $$W(u, v) = \sum_{c \in C_u \cap C_v} \frac{\text{GravityOffenceID}(c)}{|A_c| - 1}$$
- **Multi-Hop Traversal:** 2-hop search expanding from target suspects to uncover cross-case syndicate connections across police stations.
- **Centrality Metrics (NetworkX Engine):**
  - *Betweenness Centrality ($C_B$):* Identifies structural network bridges linking separate cases or groups.
  - *Degree Centrality ($C_D$):* Measures direct co-accused count.
- **Community Detection:** Greedy Modularity (Louvain) partitioning to automatically identify co-offending sub-cells and display distinct community colors in Cytoscape.js.
- **Staged Entity Resolution:**
  - Script normalization (Kannada & English).
  - Double Metaphone + Jaro-Winkler ($\ge 0.88$) matching with age proximity gating ($\pm 3$ years) and district overlap.
  - Results labeled **"Candidate Match"** requiring investigating officer confirmation before merging. Original source records remain untouched; all merges are fully reversible with an audit log.
- **Safeguards:** **Zero synthetic mock fallbacks.** Non-connected suspects return a verified `zero_connections` status: *"No recorded co-accused linkages found in CCTNS."*

---

### Capability 3: Modus Operandi (MO) Semantic Retrieval

- **Framing:** **Potentially Similar Historical Cases Ranked by Narrative & Behavioral Attributes**.
- **Dataset:** `BriefFacts` column from all 1.69M cases, enriched with structured crime heads and legal sections.
- **Semantic Vector Engine:**
  - Pretrained multilingual transformer (`paraphrase-multilingual-MiniLM-L12-v2`) generating 384-dimensional dense semantic vectors.
  - **No fine-tuning on shared crime heads:** Avoids training the model to simply predict statutory IPC classifications.
- **Vector Search Index:** Offline indexing via FAISS (HNSW32) decoupled from the web application memory space.
- **Hybrid Similarity Ranking:**
  $$\text{Score}(q, d) = 0.65 \cdot \text{CosineSim}(\mathbf{e}_q, \mathbf{e}_d) + 0.35 \cdot \text{AttributeMatch}(q, d)$$
  where attributes include crime head, day-of-week, gravity score, and target type.
- **Explainability Standard:** Search results display side-by-side feature comparisons:
  - *Matched Behavioral Factors* (entry method, targeted object, weapons)
  - *Matched Statutory Sections*
  - *Differences & Exclusions*

---

### Capability 4: Spatiotemporal Incident Forecasting & Road-Aware Patrol Routing

- **Framing:** **Incident Volume Forecasts & Road-Feasible Beat Patrol Corridors**.
- **Forecasting Engine:** LightGBM regressor predicting 7-day forward incident counts per police station (`UnitID`, 1,112 units) and H3 Res-8 cells.
- **Predictive Regressors:**
  - Lagged incident volumes ($t-1, t-7, t-14, t-28$).
  - Temporal seasonality (day of week, month, pay-day cycles).
  - Karnataka state festival/holiday calendar indicators.
  - Trailing 30-day district economic stress trends.
- **Validation Protocol:** 12-month rolling-origin walk-forward backtests. Must statistically outperform:
  1. Previous week's count ($t-7$).
  2. 4-week trailing rolling average.
  3. Day-of-week seasonal naive baseline.
  - Performance reported separately across station volume tiers (high, medium, and low volume).
  - Outputs include prediction intervals ($\text{P}_{10}, \text{P}_{50}, \text{P}_{90}$) to communicate forecast uncertainty.
- **Road-Network Patrol Route Optimization:**
  - Extracts the top 5 predicted hotspot centroids within a station's jurisdiction.
  - Solves the Traveling Salesperson Problem (TSP) using a **road-network travel distance matrix** (OSRM / OpenStreetMap street geometry) rather than straight-line Haversine.
  - Respects one-way streets, restricted roads, and station jurisdictional boundaries to generate feasible 4-hour beat corridors.

---

### Capability 5: Socio-Demographic Context & Statutory Legal Assessment

- **Framing:** **Aggregate Socioeconomic Context Dashboard & Traceable Procedural Legal Checklist**.
- **Component A: Aggregate Socioeconomic Context Analytics:**
  - Calculates population-normalized crime rates per 100,000 residents across the 30 profiled districts using census denominators.
  - Correlates district socioeconomic indicators (`LiteracyRate`, `UnemploymentRate`, `UrbanizationIndex`, `EconomicStressIndex`) with crime gravity trends.
  - Analyzes victimology distributions (victim age/gender breakdowns across crime heads).
  - **Strict Safeguard:** **Zero individual-level criminality scoring or proxy discrimination.** Socioeconomic data is used exclusively for aggregate resource allocation and community policing.
- **Component B: Procedural Compliance & Statutory Audit Engine:**
  - Completely separate from semantic embeddings and demographic scoring.
  - Deterministic procedural checklist under BNS 2023 / BNSS 2023:
    1. Verified prior chargesheet count (`ChargesheetDetails`).
    2. Active Non-Bailable Warrants (NBW) status.
    3. Statutory remand deadlines and default bail tracking under Section 187(3) BNSS 2023.
    4. Section 111 BNS (Organized Crime) statutory criteria checklist.
  - **Terminology Standard:** Reported as a **"Traceable Procedural Checklist for Legal Review"** (not "court-admissible"). Software assists authorized personnel in tracking statutory timelines; legal admissibility is a judicial determination.

---

## 4. Capability Evaluation Matrix & Formal Deployment Gates

Every capability must satisfy its formal deployment gate before being authorized for operational use:

```
+───────────────────────────────────────────────────────────────────────────────────────────────────────────+
|                                     EVALUATION MATRIX & DEPLOYMENT GATES                                  |
+────────────────────────────+─────────────────────────────+──────────────────────────────+──────────────────+
| Capability                 | Baseline Benchmark          | Quantitative Metric          | Deployment Gate  |
+────────────────────────────+─────────────────────────────+──────────────────────────────+──────────────────+
| 1. Spatial Analytics       | Fixed-radius unweighted grid| Cluster stability index &    | Coordinate       |
|    (H3 & Concentrations)   | Uniform spatial density     | temporal persistence across  | precision flags  |
|                            |                             | 30d/90d/180d decay windows.  | rendered in UI.  |
+────────────────────────────+─────────────────────────────+──────────────────────────────+──────────────────+
| 2. Network Intelligence    | Single-case isolated lookup | Link precision & candidate   | Zero fake fall-  |
|    (Co-Accused Graph)      | (1-hop without cross-FIR)   | recall on known test pairs;  | backs; Staged    |
|                            |                             | Modularity score Q > 0.4.    | human approval.  |
+────────────────────────────+─────────────────────────────+──────────────────────────────+──────────────────+
| 3. MO Semantic Retrieval   | Keyword exact search;       | Precision@5, Precision@10,   | Side-by-side     |
|    (Multilingual BriefFacts| Direct IPC section match    | and Recall@10 on reviewed    | feature match    |
|    Search)                 |                             | historical case pairs.       | explainability.  |
+────────────────────────────+─────────────────────────────+──────────────────────────────+──────────────────+
| 4. Spatiotemporal Forecast | Previous week count (t-7),  | Out-of-sample MAE & RMSE     | Must beat all 3  |
|    (Station Incident Vol   | 4-week rolling average,     | on 12-month rolling-origin   | baselines across |
|    & Road Patrol Routing)  | Seasonal naive day-of-week. | walk-forward backtests.      | 80%+ of stations.|
+────────────────────────────+─────────────────────────────+──────────────────────────────+──────────────────+
| 5. Context & Legal Engine  | Raw unnormalized crime count| Standardized rate per 100k;  | Rule correctness |
|    (Socio-Demographics &   | Static calendar date math   | Provenance traceability for  | verified against |
|    BNSS Compliance Audit)  |                             | BNSS §187(3) remand rules.   | statutory text.  |
+────────────────────────────+─────────────────────────────+──────────────────────────────+──────────────────+
```

---

## 5. Implementation Roadmap: Phases 0B through 5

```
+───────────────────────────────────────────────────────────────────────────────────────────────────────────+
|                                        STAGED IMPLEMENTATION ROADMAP                                      |
+───────────────────────────────────────────────────────────────────────────────────────────────────────────+
|                                                                                                           |
|  Phase 0A: Read-Only Data Integrity Audit                                   [COMPLETED]                   |
|  * Profiled 1.69M CaseMaster, 529k geocoded points, 12k Accused records.                                  |
|  * Generated DATA_INTEGRITY_AUDIT_REPORT.md.                                                              |
|                                                                                                           |
|  Phase 0B: High-Throughput Streaming Keyset ETL                             [IMMEDIATE NEXT STEP]         |
|  * Build vajra_backend/extract_cctns_parquet.py with seek pagination (ROWID > last_rowid).                |
|  * Stream records to local Parquet partitions in 10,000-row chunks with zero heap accumulation.           |
|  * Maintain checkpoint.json for 100% resumability.                                                        |
|                                                                                                           |
|  Phase 1: Spatial Pre-Index & Concentration Engine                                                        |
|  * Ingest all 529,118 geocoded incidents into ksp_spatial_cache.npz (15.34 MiB).                          |
|  * Pre-compute H3 Resolution 7, 8, 9 indices for the state of Karnataka.                                  |
|  * Implement HDBSCAN Haversine density clustering with precision tagging.                                 |
|                                                                                                           |
|  Phase 2: Network Intelligence Graph Engine                                                               |
|  * Build NetworkX statewide co-accused graph from all 12,118 Accused records.                             |
|  * Implement Betweenness Centrality, Greedy Modularity community detection, and staged entity matching.   |
|                                                                                                           |
|  Phase 3: MO Semantic Retrieval Engine                                                                    |
|  * Encode BriefFacts narratives using multilingual Sentence-BERT into 384-d vectors.                     |
|  * Build FAISS HNSW32 vector index with side-by-side feature explainability.                              |
|                                                                                                           |
|  Phase 4: Spatiotemporal Forecasting & Road Patrol Optimization                                           |
|  * Aggregate daily incident counts per station (1,112 units).                                             |
|  * Train LightGBM forecaster evaluated against the 3 baselines via rolling-origin backtests.              |
|  * Implement road-network OSRM TSP patrol routing for forecasted sectors.                                 |
|                                                                                                           |
|  Phase 5: Aggregate Context Dashboard & Legal Procedural Engine                                           |
|  * Deploy population-normalized crime rate dashboard across the 30 profiled districts.                    |
|  * Deploy deterministic BNSS Section 187(3) remand tracking checklist with case-level provenance.         |
|                                                                                                           |
+───────────────────────────────────────────────────────────────────────────────────────────────────────────+
```

---

## Conclusion & Readiness Confirmation

This blueprint represents the complete, vetted, and institutionally defensible architecture for VAJRA's ML subsystem. It delivers all five capabilities required by the Karnataka State Police while maintaining rigorous engineering standards, ethical safeguards, and empirical validation gates.
