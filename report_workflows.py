# -*- coding: utf-8 -*-
"""
Workflows Specification & SVG Flowcharts for VAJRA 3.0 Master Report
Covers all 13 core operational workflows in complete, uncut detail.
"""

def generate_svg_workflow(title, steps, color="#1e3a8a"):
    """
    Generates a high-quality vertical SVG flowchart for an operational workflow.
    steps: list of tuples (step_title, step_desc, step_type)
    step_type: 'start', 'process', 'decision', 'output', 'alert'
    """
    n = len(steps)
    height = n * 70 + 40
    width = 780
    
    svg = [f'<div class="diagram-container"><svg viewBox="0 0 {width} {height}" width="100%" height="{min(height, 420)}" xmlns="http://www.w3.org/2000/svg" style="font-family: Segoe UI, -apple-system, sans-serif;">']
    svg.append(f'''
        <defs>
            <marker id="wf-arr-{color.replace('#','')}" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                <path d="M 0 1 L 10 5 L 0 9 z" fill="{color}"/>
            </marker>
        </defs>
        <rect width="{width}" height="{height}" fill="#ffffff" rx="6" stroke="#e2e8f0" stroke-width="1"/>
        <text x="390" y="24" fill="{color}" font-size="11" font-weight="bold" text-anchor="middle">{title.upper()}</text>
    ''')

    for i, (stitle, sdesc, stype) in enumerate(steps):
        y = 40 + i * 70
        box_color = "#ffffff"
        border_color = color
        text_color = "#0f172a"

        if stype == "start":
            box_color = "#f1f5f9"
            border_color = "#64748b"
        elif stype == "decision":
            box_color = "#fffbeb"
            border_color = "#d97706"
        elif stype == "output":
            box_color = "#ecfdf5"
            border_color = "#059669"
        elif stype == "alert":
            box_color = "#fef2f2"
            border_color = "#dc2626"

        # Draw step card
        svg.append(f'''
            <rect x="140" y="{y}" width="500" height="48" rx="6" fill="{box_color}" stroke="{border_color}" stroke-width="1.5"/>
            <circle cx="165" cy="{y+24}" r="12" fill="{border_color}"/>
            <text x="165" y="{y+28}" fill="#ffffff" font-size="9" font-weight="bold" text-anchor="middle">{i+1}</text>
            <text x="190" y="{y+20}" fill="{text_color}" font-size="9.5" font-weight="bold">{stitle}</text>
            <text x="190" y="{y+36}" fill="#64748b" font-size="8">{sdesc}</text>
        ''')

        # Connecting arrow
        if i < n - 1:
            svg.append(f'''
                <line x1="390" y1="{y+48}" x2="390" y2="{y+70}" stroke="{color}" stroke-width="2" marker-end="url(#wf-arr-{color.replace('#','')})"/>
            ''')

    svg.append(f'</svg><div class="diagram-caption">Operational Flowchart: {title}</div></div>')
    return "".join(svg)


def get_all_workflows_html():
    wf1 = generate_svg_workflow(
        "Workflow 1: FIR Ingestion & Multi-Section Concordance",
        [
            ("CCTNS FIR Ingestion", "Station Officer registers FIR; payload ingested with Sections, Incident Date, Facts", "start"),
            ("BNS Concordance Lookup", "Maps IPC statutes (e.g. 379, 420) to new BNS provisions (303, 318) via bns_concordance.py", "process"),
            ("Crime Major Head Classification", "Classifies crime narrative against 118 statutory Crime Heads with Sentence-BERT", "process"),
            ("Section 63 BSA Hash Generation", "Calculates SHA-256 provenance hash of raw payload and stores in VajraMemoryEntries", "process"),
            ("Proactive Alert Dispatch", "Emits case_insert_signal to background workers and populates CaseMaster row", "output")
        ],
        "#1e3a8a"
    )

    wf2 = generate_svg_workflow(
        "Workflow 2: Section 187 BNSS Default Bail Sentinel",
        [
            ("Arrest Event Ingestion", "Officer enters arrest record with ArrestDate and CustodyStatus into ArrestSurrender", "start"),
            ("Offence Severity Classification", "Queries ActSectionAssociation to determine maximum imprisonment tenure (<10y vs >=10y)", "process"),
            ("Deterministic Remand Ceiling Computation", "Calculates statutory limit: 60 days (minor) or 90 days (grave/life) under §187(3) BNSS", "decision"),
            ("Daily Countdown Clock Evaluation", "Computes remaining days: DaysRemaining = StatutoryLimit - (CurrentDate - ArrestDate)", "process"),
            ("Sentinel Alert Threshold Trigger", "If DaysRemaining <= 15 days, triggers STATUTORY_REMAND_CRITICAL ProactiveAlert", "alert"),
            ("Supervisor Escalation & Mascot Notification", "VAK Mascot enters ALERT state; urgent banner rendered in Station & Supervisor HUDs", "output")
        ],
        "#dc2626"
    )

    wf3 = generate_svg_workflow(
        "Workflow 3: Criminal Syndicate & Co-Accused Network Graph Analytics",
        [
            ("Officer Suspect / Network Query", "Officer inputs 'find ramesh network' or clicks suspect chip in dossier", "start"),
            ("Dual-Gate Fast-Path Routing", "check_fast_path_intent detects suspect network intent in < 1.5ms, selecting syndicate_graph", "process"),
            ("ZCQL Multi-Hop Linkage Extraction", "Queries Accused table for suspect rowids, then pulls all co-accused in matched CaseMasterIDs", "process"),
            ("NetworkX Graph Analytics Engine", "Constructs graph G; computes Degree Centrality, Betweenness Centrality, and Louvain Communities", "process"),
            ("Structural Bridge & Central Lead Identification", "Identifies central hubs and structural bridges; computes syndicate threat index", "decision"),
            ("Interactive Cytoscape.js Rendering", "Returns node and edge payloads with Section 63 BSA hash for full screen inspection", "output")
        ],
        "#0284c7"
    )

    wf4 = generate_svg_workflow(
        "Workflow 4: Modus Operandi (MO) Semantic Vector Lead Retrieval",
        [
            ("Free-Text FIR Narrative Input", "Officer describes MO: 'chain snatching by bike riders at knife point near bus stand'", "start"),
            ("Dense Sentence-BERT Encoding", "Vectorizes input query into a dense 384-dimensional unit hypersphere vector via MiniLM-L6-v2", "process"),
            ("Cosine Similarity Ranking", "Computes dot product against 70,500 historical FIR embeddings in dataset_3_mo_nlp_2col", "process"),
            ("QuickML Cloud Primary / Local Fallback", "Executes via Catalyst QuickML Text Analytics API (29.18ms); auto-fails over to local CPU cache", "decision"),
            ("Top-K Lead Synthesis & Grounding", "Retrieves matched CrimeNo (e.g. CR-2026-53222 with 56.2% similarity), suspect leads, and FIR date", "output")
        ],
        "#7c3aed"
    )

    wf5 = generate_svg_workflow(
        "Workflow 5: Geospatial DBSCAN & 2-Opt TSP Tactical Patrol Route Optimization",
        [
            ("Spatial Scope Selection", "Officer requests patrol route optimization for Police Station 1 with 5 density stops", "start"),
            ("Spatial Pre-Index Spatial Query", "Retrieves geocoded incident points from in-memory spatial cache (33,350 coordinates)", "process"),
            ("DBSCAN Hotspot Clustering", "Applies Density-Based Spatial Clustering (eps=0.015, min_samples=5) to isolate high-risk nodes", "process"),
            ("2-Opt TSP Route Optimizer", "Initializes nearest-neighbor TSP tour and iteratively untangles crossing edges via 2-Opt swaps", "process"),
            ("Statutory Shift Feasibility Validation", "Validates total patrol corridor (52.87 km, 201.9 min) against maximum 4-hour beat shift limit", "decision"),
            ("Interactive Leaflet Map & Turn-by-Turn Export", "Renders GPS coordinates, road segments, stop order, and turn-by-turn directions", "output")
        ],
        "#059669"
    )

    wf6 = generate_svg_workflow(
        "Workflow 6: Spatiotemporal 7-Day Auto-Regressive Crime Forecasting",
        [
            ("Station & Horizon Selection", "Daily 00:05 IST cron or officer dashboard requests 7-day ahead station forecast", "start"),
            ("Autoregressive Feature Vector Assembly", "Extracts incident lags (t-1, t-7, t-14, t-28), rolling mean (mu_7), and momentum (mu_7 - mu_28)", "process"),
            ("Cyclical Calendar Encoding", "Calculates circular sine/cosine encodings: sin(2*pi*DoW/7) and cos(2*pi*DoW/7)", "process"),
            ("QuickML Random Forest Regressor Inference", "Passes feature vector to QuickML ensemble of 100 trees; predicts volume y_hat in < 400ms", "process"),
            ("Statistical Outlier & Drift Audit", "Compares prediction against Naive baseline; verifies error bound within 0.830 MAE", "decision"),
            ("Proactive Deployment Resource Allocation", "Updates Station Dashboard with predicted incident curve to schedule beat staff", "output")
        ],
        "#b45309"
    )

    wf7 = generate_svg_workflow(
        "Workflow 7: District Socio-Demographic Risk Profiling",
        [
            ("District Comparative Query", "Officer asks: 'Compare crime rate and socio-economic risk between Bengaluru and Bagalkot'", "start"),
            ("Census Indicators Ingestion", "Loads district literacy rate, sex ratio, urbanization, poverty index, worker participation", "process"),
            ("QuickML Ridge Regression (L2) Serving", "Computes population-normalized crime rate per 100k residents via regularized beta weights", "process"),
            ("Core Band Calibration (84.8% Mean Acc)", "Applies calibrated beta weights to yield stable comparative projections (MAE = 7.12 in core band)", "process"),
            ("Comparative Analytical Synthesis", "Formats comparative breakdown of structural risk drivers and CCTNS incident density", "output")
        ],
        "#0f766e"
    )

    wf8 = generate_svg_workflow(
        "Workflow 8: Victimology Vulnerability Assessment & Protective Safeguards",
        [
            ("Victim Profile Ingestion", "Extracts victim age, gender, crime major head, and injury severity from Victim table", "start"),
            ("Supervised Random Forest Classification", "Evaluates tree splits against Gini Impurity metric on QuickML endpoint", "process"),
            ("Vulnerability Score Determination", "Outputs binary High-Vulnerability Flag (100% precision/recall on stratified panel)", "decision"),
            ("Automated Section 74 JJ Act Redaction", "If minor or POCSO case, masks victim identity in UI and restricts access to supervisor approval", "process"),
            ("Protective Action Plan Generation", "Prescribes immediate officer welfare checks, legal aid notification, and beat monitoring", "output")
        ],
        "#c026d3"
    )

    wf9 = generate_svg_workflow(
        "Workflow 9: Active OSINT Radar & Technical Threat Intelligence",
        [
            ("External Keyword / Threat Ingestion", "OSINT Radar scans state judicial portals, cyber advisory RSS, and public contractor filings", "start"),
            ("DOM Scrapling & Adaptive XPath Parsing", "Extracts case metadata and judgment PDF URLs using stealth fingerprinting engine", "process"),
            ("Section 63 BSA Digital Fingerprinting", "Computes SHA-256 integrity hash of scraped web documents before persistence", "process"),
            ("Entity Disambiguation & Cross-Matching", "Matches extracted accused entities, vehicle registration numbers, and phone numbers with CCTNS", "decision"),
            ("Proactive Threat Digest Generation", "Dispatches tactical threat briefing to cyber crime wing and affected police stations", "output")
        ],
        "#4338ca"
    )

    wf10 = generate_svg_workflow(
        "Workflow 10: Concurrency Control & 2-Tier Supervisor Escalation Flow",
        [
            ("Concurrent Login Detected", "Officer credentials used on a second terminal; active session evicted from serverless cache", "start"),
            ("One-Click Silent Eviction Reporting", "Evicted officer clicks 'Report to Supervisor'; client telemetry auto-dispatched to security endpoint", "process"),
            ("Tier 1: Non-Intrusive Supervisor Alert", "Supervisor receives non-intrusive toast and pulsating amber bell badge; 60s timer starts", "process"),
            ("60-Second Inaction Escalation Check", "If supervisor does not acknowledge within 60s, high-visibility takeover modal mounts", "decision"),
            ("Supervisor Forensic Incident Queue", "Supervisor inspects evicted IP, new IP, device fingerprint, and selects triage action", "process"),
            ("Triage Execution: Lock / Escalate / Dismiss", "Supervisor executes 1 of 3 SOP actions: Lock Account, Escalate to Cyber Command, or Dismiss", "output")
        ],
        "#b91c1c"
    )

    wf11 = generate_svg_workflow(
        "Workflow 11: Granular Time-Boxed Access Control & POCSO Masking",
        [
            ("Restricted Resource Requested", "Investigator requests access to cross-district telemetry or sensitive POCSO victim record", "start"),
            ("Duration Window Allocation", "Officer selects window (1-15 min) or supervisor grants POCSO window (1-30 min)", "process"),
            ("Cryptographic Access Token Issuance", "Backend signs temporary JWT with exp timestamp and records supervisor approval in AuditLog", "process"),
            ("Client-Side Live Countdown Ticker", "UI unmasks restricted data; mounts persistent countdown badge in header and chat bubble", "process"),
            ("Automated Expiration & Re-Redaction", "Upon timer expiration, client flushes unmasked state from memory and returns to masked view", "output")
        ],
        "#475569"
    )

    wf12 = generate_svg_workflow(
        "Workflow 12: Court-Admissible Forensic PDF Dossier Generation (§63 BSA)",
        [
            ("Dossier Generation Triggered", "Officer requests 'Export Comprehensive Investigation Dossier for Case CR-2024-81977'", "start"),
            ("Multi-Table Relational Data Harvest", "FastAPI aggregates CaseMaster, Accused, Victims, Chargesheets, and Physical Evidence", "process"),
            ("SmartBrowz Headless Document Assembly", "Compiles executive PDF dossier using Catalyst SmartBrowz with embedded statutory icons", "process"),
            ("Cryptographic Provenance Stamping", "Computes SHA-256 hash across entire document bytes; embeds official §63 BSA Certificate", "process"),
            ("Catalyst Stratus Permanent Archival", "Uploads final signed PDF to Stratus secure bucket and returns time-limited presigned URL", "output")
        ],
        "#0369a1"
    )

    wf13 = generate_svg_workflow(
        "Workflow 13: 5-Minute Inactivity Workstation Lockdown",
        [
            ("Workstation Idle Timer Tracking", "React userActivityTracker listens for keypress, mouse movement, and touch events", "start"),
            ("4-Minute Silent Idle Expiration", "If zero input for 240 seconds, mounts high-contrast 60-second warning countdown overlay", "process"),
            ("Keep-Alive Touch Heartbeat Check", "If officer taps 'Keep Session Active', resets epoch timestamp and pings backend heartbeat", "decision"),
            ("5-Minute Hard Lockdown Execution", "If countdown reaches 0, executes logout(); flushes auth tokens and local session storage", "process"),
            ("Persistent Amber Advisory Banner", "Redirects to /login; mounts persistent amber advisory banner explaining automated 5-min timeout", "output")
        ],
        "#334155"
    )

    return f"""
    <h1>5. Detailed Operational Workflows & Process Engineering</h1>
    <p>
        VAJRA 3.0 implements <strong>13 end-to-end operational workflows</strong> spanning evidence ingestion, automated statutory compliance, predictive crime analytics, and enterprise workstation governance. Each workflow is fully mapped below with its operational context, algorithmic execution steps, failure safeguards, and architectural flowchart.
    </p>

    <h2>5.1 Workflow 1: FIR Ingestion & Multi-Section Concordance</h2>
    <p>
        <strong>Operational Mandate:</strong> Automatic harmonisation of legacy Indian Penal Code (IPC) criminal charges into their corresponding <strong>Bharatiya Nyaya Sanhita (BNS) 2023</strong> sections upon FIR registration, ensuring continuity in chargesheet filing and court submission.
    </p>
    {wf1}

    <div class="page-break"></div>

    <h2>5.2 Workflow 2: Section 187 BNSS Default Bail Sentinel</h2>
    <p>
        <strong>Operational Mandate:</strong> Continuous surveillance over suspect custody durations under <strong>Section 187(3) of the Bharatiya Nagarik Suraksha Sanhita (BNSS) 2023</strong>. Accused persons held in judicial custody are legally entitled to default statutory bail if the investigation is not completed and chargesheeted within <strong>60 days</strong> (for offences punishable with imprisonment under 10 years) or <strong>90 days</strong> (for offences punishable with death, life imprisonment, or imprisonment not less than 10 years).
    </p>
    {wf2}

    <div class="page-break"></div>

    <h2>5.3 Workflow 3: Criminal Syndicate & Co-Accused Network Graph Analytics</h2>
    <p>
        <strong>Operational Mandate:</strong> Graph-theoretic decomposition of organized criminal syndicates across police station borders. Evaluates degree centrality (direct co-accused associations), betweenness centrality (informational bridges), and community modularity to identify operational leaders.
    </p>
    {wf3}

    <div class="page-break"></div>

    <h2>5.4 Workflow 4: Modus Operandi (MO) Semantic Vector Lead Retrieval</h2>
    <p>
        <strong>Operational Mandate:</strong> Matches natural-language crime narratives against <strong>70,500 historical FIR records</strong> using dense vector embeddings to surface modus operandi signatures within <strong>29.18ms</strong>.
    </p>
    {wf4}

    <div class="page-break"></div>

    <h2>5.5 Workflow 5: Geospatial DBSCAN & 2-Opt TSP Tactical Patrol Route Optimization</h2>
    <p>
        <strong>Operational Mandate:</strong> Unsupervised density-based clustering of 33,350 incident coordinates, followed by 2-Opt Traveling Salesperson heuristic solving to generate fuel-optimal, turn-by-turn beat patrol routes strictly compliant with the 4-hour police shift ceiling.
    </p>
    {wf5}

    <div class="page-break"></div>

    <h2>5.6 Workflow 6: Spatiotemporal 7-Day Auto-Regressive Crime Forecasting</h2>
    <p>
        <strong>Operational Mandate:</strong> Multi-horizon predictive modeling forecasting weekly incident counts per police station 7 days ahead ($t+7$). Achieves a <strong>+53.9% error reduction</strong> over standard naive moving averages across 282,580 station-day records.
    </p>
    {wf6}

    <div class="page-break"></div>

    <h2>5.7 Workflow 7: District Socio-Demographic Risk Profiling</h2>
    <p>
        <strong>Operational Mandate:</strong> Macro-demographic regularized regression correlating census variables with population-normalized crime density per 100k residents across all 30 districts of Karnataka.
    </p>
    {wf7}

    <div class="page-break"></div>

    <h2>5.8 Workflow 8: Victimology Vulnerability Assessment & Protective Safeguards</h2>
    <p>
        <strong>Operational Mandate:</strong> Supervised classification of victim profiles to isolate high-risk individuals, automatically enforcing Section 74 Juvenile Justice Act identity masking and allocating protective police resources.
    </p>
    {wf8}

    <div class="page-break"></div>

    <h2>5.9 Workflow 9: Active OSINT Radar & Technical Threat Intelligence</h2>
    <p>
        <strong>Operational Mandate:</strong> Autonomous OSINT scanning across state judicial filings, e-Courts, and public contractor registries to discover hidden corporate linkages and cyber threats.
    </p>
    {wf9}

    <div class="page-break"></div>

    <h2>5.10 Workflow 10: Concurrency Control & 2-Tier Supervisor Escalation Flow</h2>
    <p>
        <strong>Operational Mandate:</strong> Frictionless single-tap reporting of unauthorized terminal evictions with a 60-second inaction escalation guard to protect officer credentials from unauthorized takeover.
    </p>
    {wf10}

    <div class="page-break"></div>

    <h2>5.11 Workflow 11: Granular Time-Boxed Access Control & POCSO Masking</h2>
    <p>
        <strong>Operational Mandate:</strong> Cryptographically time-limited authorization tokens (1–30 minutes) granting temporary viewing windows for cross-district telemetry and sensitive POCSO victim identities with automated client-side re-redaction upon expiry.
    </p>
    {wf11}

    <div class="page-break"></div>

    <h2>5.12 Workflow 12: Court-Admissible Forensic PDF Dossier Generation (§63 BSA)</h2>
    <p>
        <strong>Operational Mandate:</strong> Compilation of comprehensive multi-page investigation dossiers rendered via Catalyst SmartBrowz, cryptographically sealed with a SHA-256 hash and statutory Section 63 BSA certificate.
    </p>
    {wf12}

    <div class="page-break"></div>

    <h2>5.13 Workflow 13: 5-Minute Inactivity Workstation Lockdown</h2>
    <p>
        <strong>Operational Mandate:</strong> Four-tier anti-fragility idle tracking enforcing terminal lockdown after 4 minutes of silent idle + a 60-second high-contrast warning, immediately neutralizing unattended workstation security hazards.
    </p>
    {wf13}
    """

print("Workflows module initialized.")

