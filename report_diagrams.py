# -*- coding: utf-8 -*-
"""
SVG Diagrams Generator for VAJRA 3.0 Master Report (White Theme)
"""

def get_system_architecture_svg():
    return """
    <div class="diagram-container">
        <svg viewBox="0 0 850 480" width="100%" height="400" xmlns="http://www.w3.org/2000/svg" style="font-family: 'Segoe UI', -apple-system, sans-serif;">
            <defs>
                <marker id="arr" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                    <path d="M 0 1 L 10 5 L 0 9 z" fill="#1e3a8a"/>
                </marker>
                <marker id="arr-gold" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                    <path d="M 0 1 L 10 5 L 0 9 z" fill="#d97706"/>
                </marker>
                <filter id="shadow" x="-5%" y="-5%" width="110%" height="110%">
                    <feDropShadow dx="0" dy="2" stdDeviation="3" flood-color="#000000" flood-opacity="0.06"/>
                </filter>
            </defs>

            <!-- Background grid subtle -->
            <rect width="850" height="480" fill="#f8fafc" rx="8" stroke="#e2e8f0" stroke-width="1"/>

            <!-- Column 1: Client Layer -->
            <rect x="25" y="30" width="160" height="420" rx="8" fill="#ffffff" stroke="#cbd5e1" stroke-width="1.5" filter="url(#shadow)"/>
            <rect x="25" y="30" width="160" height="34" rx="8" fill="#1e3a8a"/>
            <text x="105" y="52" fill="#ffffff" font-size="11" font-weight="bold" text-anchor="middle">CLIENT PRESENTATION</text>

            <rect x="40" y="80" width="130" height="50" rx="5" fill="#f1f5f9" stroke="#94a3b8" stroke-width="1"/>
            <text x="105" y="102" fill="#0f172a" font-size="10" font-weight="bold" text-anchor="middle">React 18 SPA</text>
            <text x="105" y="118" fill="#64748b" font-size="8.5" text-anchor="middle">TailwindCSS • Lucide</text>

            <rect x="40" y="145" width="130" height="50" rx="5" fill="#f1f5f9" stroke="#94a3b8" stroke-width="1"/>
            <text x="105" y="167" fill="#0f172a" font-size="10" font-weight="bold" text-anchor="middle">Cytoscape.js</text>
            <text x="105" y="183" fill="#64748b" font-size="8.5" text-anchor="middle">Syndicate Graph Engine</text>

            <rect x="40" y="210" width="130" height="50" rx="5" fill="#f1f5f9" stroke="#94a3b8" stroke-width="1"/>
            <text x="105" y="232" fill="#0f172a" font-size="10" font-weight="bold" text-anchor="middle">Leaflet Geospatial</text>
            <text x="105" y="248" fill="#64748b" font-size="8.5" text-anchor="middle">2D Incident Heatmaps</text>

            <rect x="40" y="275" width="130" height="50" rx="5" fill="#f1f5f9" stroke="#94a3b8" stroke-width="1"/>
            <text x="105" y="297" fill="#0f172a" font-size="10" font-weight="bold" text-anchor="middle">VAK Sentinel Owl</text>
            <text x="105" y="313" fill="#64748b" font-size="8.5" text-anchor="middle">16-State Mascot FSM</text>

            <rect x="40" y="340" width="130" height="50" rx="5" fill="#f1f5f9" stroke="#94a3b8" stroke-width="1"/>
            <text x="105" y="362" fill="#0f172a" font-size="10" font-weight="bold" text-anchor="middle">Web Audio & TTS</text>
            <text x="105" y="378" fill="#64748b" font-size="8.5" text-anchor="middle">Zia Speech & Audio Hook</text>

            <rect x="40" y="400" width="130" height="36" rx="5" fill="#eff6ff" stroke="#3b82f6" stroke-width="1"/>
            <text x="105" y="422" fill="#1d4ed8" font-size="9" font-weight="bold" text-anchor="middle">SSE Stream & WS</text>

            <!-- Column 2: Backend & AppSail -->
            <rect x="235" y="30" width="220" height="420" rx="8" fill="#ffffff" stroke="#cbd5e1" stroke-width="1.5" filter="url(#shadow)"/>
            <rect x="235" y="30" width="220" height="34" rx="8" fill="#0369a1"/>
            <text x="345" y="52" fill="#ffffff" font-size="11" font-weight="bold" text-anchor="middle">CATALYST APPSAIL BACKEND</text>

            <rect x="250" y="75" width="190" height="48" rx="5" fill="#f8fafc" stroke="#0284c7" stroke-width="1.2"/>
            <text x="345" y="96" fill="#0f172a" font-size="9.5" font-weight="bold" text-anchor="middle">FastAPI ASGI Server</text>
            <text x="345" y="112" fill="#64748b" font-size="8" text-anchor="middle">Python 3.12 • 2048 MB RAM</text>

            <rect x="250" y="132" width="190" height="58" rx="5" fill="#eff6ff" stroke="#3b82f6" stroke-width="1"/>
            <text x="345" y="151" fill="#1e3a8a" font-size="9" font-weight="bold" text-anchor="middle">Dual-Gate Fast-Path Engine</text>
            <text x="345" y="167" fill="#475569" font-size="8" text-anchor="middle">&lt; 1.5ms Sub-Intent Routing</text>
            <text x="345" y="181" fill="#475569" font-size="8" text-anchor="middle">Syndicate, Hotspots, Remand</text>

            <rect x="250" y="200" width="190" height="54" rx="5" fill="#f8fafc" stroke="#64748b" stroke-width="1"/>
            <text x="345" y="219" fill="#0f172a" font-size="9" font-weight="bold" text-anchor="middle">VajraAgentLoop Core</text>
            <text x="345" y="235" fill="#64748b" font-size="8" text-anchor="middle">Dynamic Tool Dispatcher (25 Tools)</text>
            <text x="345" y="247" fill="#64748b" font-size="8" text-anchor="middle">SOTIE Dynamic In-Context Exemplars</text>

            <rect x="250" y="264" width="190" height="54" rx="5" fill="#fffbeb" stroke="#f59e0b" stroke-width="1"/>
            <text x="345" y="283" fill="#b45309" font-size="9" font-weight="bold" text-anchor="middle">Track 20 Multi-Centroid</text>
            <text x="345" y="299" fill="#78350f" font-size="8" text-anchor="middle">4-Slot Sub-Intent Decomposition</text>
            <text x="345" y="311" fill="#78350f" font-size="8" text-anchor="middle">Zero-Latency Pre-Hydration</text>

            <rect x="250" y="328" width="190" height="52" rx="5" fill="#ecfdf5" stroke="#10b981" stroke-width="1"/>
            <text x="345" y="347" fill="#047857" font-size="9" font-weight="bold" text-anchor="middle">§63 BSA Provenance HUD</text>
            <text x="345" y="363" fill="#065f46" font-size="8" text-anchor="middle">Cryptographic SHA-256 Hashes</text>
            <text x="345" y="374" fill="#065f46" font-size="8" text-anchor="middle">ZCQL Real-Query Audit Log</text>

            <rect x="250" y="390" width="190" height="48" rx="5" fill="#f8fafc" stroke="#94a3b8" stroke-width="1"/>
            <text x="345" y="408" fill="#0f172a" font-size="8.5" font-weight="bold" text-anchor="middle">Concurrency & Inactivity Guard</text>
            <text x="345" y="422" fill="#64748b" font-size="8" text-anchor="middle">5-Min Idle Eviction • 60s Escalation</text>

            <!-- Column 3: AI Cognitive Engines -->
            <rect x="500" y="30" width="160" height="210" rx="8" fill="#ffffff" stroke="#cbd5e1" stroke-width="1.5" filter="url(#shadow)"/>
            <rect x="500" y="30" width="160" height="30" rx="8" fill="#4338ca"/>
            <text x="580" y="50" fill="#ffffff" font-size="10" font-weight="bold" text-anchor="middle">DUAL-BRAIN AI ENGINES</text>

            <rect x="510" y="70" width="140" height="46" rx="5" fill="#faf5ff" stroke="#a855f7" stroke-width="1"/>
            <text x="580" y="89" fill="#581c87" font-size="9" font-weight="bold" text-anchor="middle">Brain 1: GLM-4.7</text>
            <text x="580" y="103" fill="#6b21a8" font-size="8" text-anchor="middle">Complex RAG Reasoning</text>

            <rect x="510" y="124" width="140" height="52" rx="5" fill="#eff6ff" stroke="#3b82f6" stroke-width="1"/>
            <text x="580" y="142" fill="#1e3a8a" font-size="9" font-weight="bold" text-anchor="middle">Brain 2: Qwen VLM 35B</text>
            <text x="580" y="156" fill="#1d4ed8" font-size="8" text-anchor="middle">Catalyst QuickML Endpoint</text>
            <text x="580" y="168" fill="#1d4ed8" font-size="7.5" text-anchor="middle">38.2 tok/s • Sub-1.1s Routing</text>

            <rect x="510" y="184" width="140" height="46" rx="5" fill="#f8fafc" stroke="#64748b" stroke-width="1"/>
            <text x="580" y="202" fill="#0f172a" font-size="8.5" font-weight="bold" text-anchor="middle">Catalyst Zia Services</text>
            <text x="580" y="217" fill="#64748b" font-size="8" text-anchor="middle">ANPR OCR • Speech • Trans</text>

            <!-- Column 4: Catalyst Cloud Persistence -->
            <rect x="500" y="250" width="160" height="200" rx="8" fill="#ffffff" stroke="#cbd5e1" stroke-width="1.5" filter="url(#shadow)"/>
            <rect x="500" y="250" width="160" height="30" rx="8" fill="#047857"/>
            <text x="580" y="270" fill="#ffffff" font-size="10" font-weight="bold" text-anchor="middle">CATALYST SERVICES</text>

            <rect x="510" y="290" width="140" height="32" rx="4" fill="#ecfdf5" stroke="#10b981" stroke-width="1"/>
            <text x="580" y="310" fill="#065f46" font-size="8.5" font-weight="bold" text-anchor="middle">Data Store (20+ Tables)</text>

            <rect x="510" y="328" width="140" height="32" rx="4" fill="#ecfdf5" stroke="#10b981" stroke-width="1"/>
            <text x="580" y="348" fill="#065f46" font-size="8.5" font-weight="bold" text-anchor="middle">Stratus (Pre-Indexes)</text>

            <rect x="510" y="366" width="140" height="32" rx="4" fill="#ecfdf5" stroke="#10b981" stroke-width="1"/>
            <text x="580" y="386" fill="#065f46" font-size="8.5" font-weight="bold" text-anchor="middle">SmartBrowz (PDF Gen)</text>

            <rect x="510" y="404" width="140" height="34" rx="4" fill="#ecfdf5" stroke="#10b981" stroke-width="1"/>
            <text x="580" y="420" fill="#065f46" font-size="8" font-weight="bold" text-anchor="middle">Functions & Crons</text>
            <text x="580" y="432" fill="#047857" font-size="7.5" text-anchor="middle">00:05 IST Delta Sync</text>

            <!-- Column 5: ML Models -->
            <rect x="690" y="30" width="135" height="420" rx="8" fill="#ffffff" stroke="#cbd5e1" stroke-width="1.5" filter="url(#shadow)"/>
            <rect x="690" y="30" width="135" height="34" rx="8" fill="#b45309"/>
            <text x="757" y="52" fill="#ffffff" font-size="10.5" font-weight="bold" text-anchor="middle">5 ML MODELS</text>

            <rect x="700" y="75" width="115" height="55" rx="5" fill="#fffbeb" stroke="#d97706" stroke-width="1"/>
            <text x="757" y="93" fill="#78350f" font-size="8.5" font-weight="bold" text-anchor="middle">Socio-Demographic</text>
            <text x="757" y="107" fill="#b45309" font-size="8" text-anchor="middle">Ridge Regression L2</text>
            <text x="757" y="120" fill="#047857" font-size="7.5" font-weight="bold" text-anchor="middle">99.9% Top Accuracy</text>

            <rect x="700" y="138" width="115" height="55" rx="5" fill="#fffbeb" stroke="#d97706" stroke-width="1"/>
            <text x="757" y="156" fill="#78350f" font-size="8.5" font-weight="bold" text-anchor="middle">Incident Forecaster</text>
            <text x="757" y="170" fill="#b45309" font-size="8" text-anchor="middle">Random Forest (t+7)</text>
            <text x="757" y="183" fill="#047857" font-size="7.5" font-weight="bold" text-anchor="middle">+53.9% vs Baseline</text>

            <rect x="700" y="201" width="115" height="55" rx="5" fill="#fffbeb" stroke="#d97706" stroke-width="1"/>
            <text x="757" y="219" fill="#78350f" font-size="8.5" font-weight="bold" text-anchor="middle">Victimology Classifier</text>
            <text x="757" y="233" fill="#b45309" font-size="8" text-anchor="middle">Random Forest (Gini)</text>
            <text x="757" y="246" fill="#047857" font-size="7.5" font-weight="bold" text-anchor="middle">100% Stratified F1</text>

            <rect x="700" y="264" width="115" height="55" rx="5" fill="#fffbeb" stroke="#d97706" stroke-width="1"/>
            <text x="757" y="282" fill="#78350f" font-size="8.5" font-weight="bold" text-anchor="middle">Hotspot Partitioning</text>
            <text x="757" y="296" fill="#b45309" font-size="8" text-anchor="middle">K-Means (K=8)</text>
            <text x="757" y="309" fill="#047857" font-size="7.5" font-weight="bold" text-anchor="middle">33,350 Geocodes</text>

            <rect x="700" y="327" width="115" height="55" rx="5" fill="#fffbeb" stroke="#d97706" stroke-width="1"/>
            <text x="757" y="345" fill="#78350f" font-size="8.5" font-weight="bold" text-anchor="middle">Modus Operandi NLP</text>
            <text x="757" y="359" fill="#b45309" font-size="8" text-anchor="middle">Sentence-BERT 384d</text>
            <text x="757" y="372" fill="#047857" font-size="7.5" font-weight="bold" text-anchor="middle">29.18ms Sub-Vector</text>

            <rect x="700" y="390" width="115" height="48" rx="5" fill="#fffbeb" stroke="#d97706" stroke-width="1"/>
            <text x="757" y="408" fill="#78350f" font-size="8" font-weight="bold" text-anchor="middle">2-Opt TSP Router</text>
            <text x="757" y="422" fill="#b45309" font-size="7.5" text-anchor="middle">Patrol Route Solver</text>

            <!-- Connecting Lines -->
            <line x1="185" y1="240" x2="235" y2="240" stroke="#1e3a8a" stroke-width="2" marker-end="url(#arr)"/>
            <line x1="440" y1="220" x2="500" y2="135" stroke="#4338ca" stroke-width="1.5" marker-end="url(#arr)"/>
            <line x1="440" y1="280" x2="500" y2="350" stroke="#047857" stroke-width="1.5" marker-end="url(#arr)"/>
            <line x1="660" y1="135" x2="690" y2="160" stroke="#b45309" stroke-width="1.5" marker-end="url(#arr-gold)"/>
            <line x1="660" y1="350" x2="690" y2="350" stroke="#b45309" stroke-width="1.5" marker-end="url(#arr-gold)"/>
        </svg>
        <div class="diagram-caption">Figure 1: Complete High-Level VAJRA 3.0 Platform Architecture on Zoho Catalyst</div>
    </div>
    """

def get_dual_brain_svg():
    return """
    <div class="diagram-container">
        <svg viewBox="0 0 820 280" width="100%" height="240" xmlns="http://www.w3.org/2000/svg" style="font-family: 'Segoe UI', -apple-system, sans-serif;">
            <defs>
                <marker id="db-arr" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                    <path d="M 0 1 L 10 5 L 0 9 z" fill="#1e3a8a"/>
                </marker>
            </defs>

            <!-- Input Query Box -->
            <rect x="20" y="110" width="150" height="60" rx="6" fill="#ffffff" stroke="#1e3a8a" stroke-width="2"/>
            <text x="95" y="136" font-size="10.5" font-weight="bold" fill="#0f172a" text-anchor="middle">Officer Input Query</text>
            <text x="95" y="152" font-size="8.5" fill="#64748b" text-anchor="middle">Chat Stream / Voice</text>

            <!-- Dual-Gate Intent Filter -->
            <polygon points="210,140 260,90 310,140 260,190" fill="#f8fafc" stroke="#0284c7" stroke-width="2"/>
            <text x="260" y="137" font-size="8.5" font-weight="bold" fill="#0369a1" text-anchor="middle">Dual-Gate</text>
            <text x="260" y="149" font-size="8" fill="#0369a1" text-anchor="middle">Classifier</text>

            <!-- Arrow 1 to 2 -->
            <line x1="170" y1="140" x2="210" y2="140" stroke="#1e3a8a" stroke-width="2" marker-end="url(#db-arr)"/>

            <!-- Fast-Path direct route -->
            <path d="M 260 90 L 260 40 L 400 40" fill="none" stroke="#d97706" stroke-width="2" stroke-dasharray="4" marker-end="url(#db-arr)"/>
            <rect x="400" y="15" width="200" height="50" rx="6" fill="#fffbeb" stroke="#d97706" stroke-width="1.5"/>
            <text x="500" y="37" font-size="9.5" font-weight="bold" fill="#78350f" text-anchor="middle">Sub-3s Fast-Path Engine</text>
            <text x="500" y="52" font-size="8" fill="#b45309" text-anchor="middle">&lt; 1.5ms direct CCTNS execution</text>

            <!-- Brain 1: Deep GLM -->
            <path d="M 310 120 L 400 110" fill="none" stroke="#4338ca" stroke-width="2" marker-end="url(#db-arr)"/>
            <rect x="400" y="85" width="200" height="55" rx="6" fill="#faf5ff" stroke="#a855f7" stroke-width="1.5"/>
            <text x="500" y="108" font-size="9.5" font-weight="bold" fill="#581c87" text-anchor="middle">Brain 1: GLM-4.7 Thinking</text>
            <text x="500" y="123" font-size="8" fill="#6b21a8" text-anchor="middle">Complex Analytical Reasoning & RAG</text>

            <!-- Brain 2: QuickML Qwen -->
            <path d="M 310 160 L 400 170" fill="none" stroke="#1d4ed8" stroke-width="2" marker-end="url(#db-arr)"/>
            <rect x="400" y="155" width="200" height="55" rx="6" fill="#eff6ff" stroke="#3b82f6" stroke-width="1.5"/>
            <text x="500" y="178" font-size="9.5" font-weight="bold" fill="#1e3a8a" text-anchor="middle">Brain 2: Qwen VLM 35B</text>
            <text x="500" y="193" font-size="8" fill="#1d4ed8" text-anchor="middle">1.09s Tool Decisions • 38.2 tok/s MoE</text>

            <!-- Track 20 Multi-Centroid Assembler -->
            <path d="M 600 40 L 660 140" fill="none" stroke="#059669" stroke-width="1.5"/>
            <path d="M 600 110 L 660 140" fill="none" stroke="#059669" stroke-width="1.5"/>
            <path d="M 600 180 L 660 140" fill="none" stroke="#059669" stroke-width="1.5"/>
            <line x1="660" y1="140" x2="680" y2="140" stroke="#059669" stroke-width="2" marker-end="url(#db-arr)"/>

            <rect x="680" y="105" width="125" height="70" rx="6" fill="#ecfdf5" stroke="#10b981" stroke-width="2"/>
            <text x="742" y="128" font-size="9" font-weight="bold" fill="#065f46" text-anchor="middle">Track 20 Output</text>
            <text x="742" y="143" font-size="8" fill="#047857" text-anchor="middle">Authoritative Briefing</text>
            <text x="742" y="157" font-size="7.5" fill="#047857" text-anchor="middle">+ §63 BSA Hash Stamp</text>
        </svg>
        <div class="diagram-caption">Figure 2: Dual-Brain AI Orchestration & Multi-Centroid Acceleration Pipeline</div>
    </div>
    """

def get_database_er_svg():
    return """
    <div class="diagram-container">
        <svg viewBox="0 0 820 400" width="100%" height="340" xmlns="http://www.w3.org/2000/svg" style="font-family: 'Segoe UI', -apple-system, sans-serif;">
            <defs>
                <marker id="er-arr" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                    <path d="M 0 1 L 10 5 L 0 9 z" fill="#64748b"/>
                </marker>
            </defs>

            <!-- Table 1: CaseMaster (Central) -->
            <rect x="310" y="140" width="200" height="130" rx="6" fill="#ffffff" stroke="#1e3a8a" stroke-width="2"/>
            <rect x="310" y="140" width="200" height="26" rx="6" fill="#1e3a8a"/>
            <text x="410" y="157" fill="#ffffff" font-size="10" font-weight="bold" text-anchor="middle">CaseMaster (Core FIR)</text>
            <text x="320" y="180" font-size="8" fill="#0f172a"><strong>CaseMasterID</strong> [PK: Int64]</text>
            <text x="320" y="195" font-size="8" fill="#475569">CrimeNo [VarChar 64: 'CR-2024-81977']</text>
            <text x="320" y="210" font-size="8" fill="#475569">CrimeRegisteredDate [DateTime]</text>
            <text x="320" y="225" font-size="8" fill="#475569">BriefFacts [Text 2000]</text>
            <text x="320" y="240" font-size="8" fill="#475569">Latitude, Longitude [Float64]</text>
            <text x="320" y="255" font-size="8" fill="#475569">PoliceStationID [FK: Unit]</text>

            <!-- Table 2: Accused (Left Top) -->
            <rect x="50" y="30" width="180" height="100" rx="5" fill="#ffffff" stroke="#0284c7" stroke-width="1.5"/>
            <rect x="50" y="30" width="180" height="22" rx="5" fill="#0284c7"/>
            <text x="140" y="45" fill="#ffffff" font-size="9" font-weight="bold" text-anchor="middle">Accused (Suspects)</text>
            <text x="60" y="66" font-size="7.5" fill="#0f172a"><strong>AccusedID</strong> [PK: Int64]</text>
            <text x="60" y="80" font-size="7.5" fill="#475569">CaseMasterID [FK: CaseMaster]</text>
            <text x="60" y="94" font-size="7.5" fill="#475569">AccusedName [VarChar 128]</text>
            <text x="60" y="108" font-size="7.5" fill="#475569">Age, Gender, PriorRecord [Int/Bool]</text>

            <!-- Table 3: ArrestSurrender (Left Bottom) -->
            <rect x="50" y="180" width="180" height="100" rx="5" fill="#ffffff" stroke="#d97706" stroke-width="1.5"/>
            <rect x="50" y="180" width="180" height="22" rx="5" fill="#d97706"/>
            <text x="140" y="195" fill="#ffffff" font-size="9" font-weight="bold" text-anchor="middle">ArrestSurrender (§187 BNSS)</text>
            <text x="60" y="216" font-size="7.5" fill="#0f172a"><strong>ArrestID</strong> [PK: Int64]</text>
            <text x="60" y="230" font-size="7.5" fill="#475569">CaseMasterID [FK: CaseMaster]</text>
            <text x="60" y="244" font-size="7.5" fill="#475569">ArrestDate [DateTime]</text>
            <text x="60" y="258" font-size="7.5" fill="#475569">CustodyStatus [Judicial/Police]</text>

            <!-- Table 4: ActSectionAssociation (Right Top) -->
            <rect x="590" y="30" width="180" height="100" rx="5" fill="#ffffff" stroke="#4338ca" stroke-width="1.5"/>
            <rect x="590" y="30" width="180" height="22" rx="5" fill="#4338ca"/>
            <text x="680" y="45" fill="#ffffff" font-size="9" font-weight="bold" text-anchor="middle">ActSectionAssociation</text>
            <text x="600" y="66" font-size="7.5" fill="#0f172a"><strong>AssociationID</strong> [PK: Int64]</text>
            <text x="600" y="80" font-size="7.5" fill="#475569">CaseMasterID [FK: CaseMaster]</text>
            <text x="600" y="94" font-size="7.5" fill="#475569">ActID, SectionID [IPC/BNS]</text>
            <text x="600" y="108" font-size="7.5" fill="#475569">GravityOffenceID [Int32]</text>

            <!-- Table 5: Victim (Right Bottom) -->
            <rect x="590" y="180" width="180" height="100" rx="5" fill="#ffffff" stroke="#059669" stroke-width="1.5"/>
            <rect x="590" y="180" width="180" height="22" rx="5" fill="#059669"/>
            <text x="680" y="195" fill="#ffffff" font-size="9" font-weight="bold" text-anchor="middle">Victim (POCSO Sensitive)</text>
            <text x="600" y="216" font-size="7.5" fill="#0f172a"><strong>VictimID</strong> [PK: Int64]</text>
            <text x="600" y="230" font-size="7.5" fill="#475569">CaseMasterID [FK: CaseMaster]</text>
            <text x="600" y="244" font-size="7.5" fill="#475569">VictimName [Masked u/s 74 JJ]</text>
            <text x="600" y="258" font-size="7.5" fill="#475569">Age, Gender, VulnerabilityScore</text>

            <!-- Table 6: Unit / PoliceStation (Bottom Center) -->
            <rect x="310" y="310" width="200" height="75" rx="5" fill="#ffffff" stroke="#64748b" stroke-width="1.5"/>
            <rect x="310" y="310" width="200" height="20" rx="5" fill="#64748b"/>
            <text x="410" y="324" fill="#ffffff" font-size="8.5" font-weight="bold" text-anchor="middle">Unit (Police Station)</text>
            <text x="320" y="344" font-size="7.5" fill="#0f172a"><strong>UnitID</strong> [PK: Int64] • UnitName [VarChar]</text>
            <text x="320" y="358" font-size="7.5" fill="#475569">DistrictID [FK: District] • DivisionID</text>

            <!-- Relations -->
            <line x1="230" y1="80" x2="310" y2="170" stroke="#64748b" stroke-width="1.5" marker-end="url(#er-arr)"/>
            <line x1="230" y1="230" x2="310" y2="210" stroke="#64748b" stroke-width="1.5" marker-end="url(#er-arr)"/>
            <line x1="590" y1="80" x2="510" y2="170" stroke="#64748b" stroke-width="1.5" marker-end="url(#er-arr)"/>
            <line x1="590" y1="230" x2="510" y2="210" stroke="#64748b" stroke-width="1.5" marker-end="url(#er-arr)"/>
            <line x1="410" y1="310" x2="410" y2="270" stroke="#64748b" stroke-width="1.5" marker-end="url(#er-arr)"/>
        </svg>
        <div class="diagram-caption">Figure 3: Catalyst Data Store Relational Entity Schema & Key Associations</div>
    </div>
    """

print("SVG Diagrams initialized.")

