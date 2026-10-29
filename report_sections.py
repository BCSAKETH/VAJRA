# -*- coding: utf-8 -*-
"""
Report Sections Builder for VAJRA 3.0 Master Report
"""

def get_cover_and_executive():
    return """
    <div class="cover-page">
        <div class="cover-header">
            <span class="ksp-badge">GOVERNMENT OF KARNATAKA • POLICE DEPARTMENT</span>
            <div class="cover-title">PROJECT VAJRA 3.0</div>
            <div class="cover-subtitle">Proactive Operational Intelligence & Cognitive Police Copilot Platform</div>
            <div style="font-size: 10pt; color: #1e3a8a; font-weight: 600;">COMPREHENSIVE MASTER TECHNICAL, DATA SCIENCE & ARCHITECTURAL REPORT</div>
        </div>

        <div style="margin: 20px 0;">
            <p style="font-size: 10.5pt; color: #334155; line-height: 1.6;">
                This document serves as the formal, authoritative technical blueprint, mathematical verification ledger, and operational handbook for <strong>VAJRA 3.0</strong>. Designed and engineered for the Karnataka State Police (KSP), VAJRA transitions police computing from passive, reactive crime recording to active, proactive, and predictive intelligence.
            </p>

            <div class="stats-grid">
                <div class="stat-box">
                    <div class="stat-num">100%</div>
                    <div class="stat-desc">Census Evaluation (30/30 Districts)</div>
                </div>
                <div class="stat-box">
                    <div class="stat-num">+53.9%</div>
                    <div class="stat-desc">Forecast Error Reduction vs Baseline</div>
                </div>
                <div class="stat-box">
                    <div class="stat-num">1.09s</div>
                    <div class="stat-desc">QuickML Tool Decision Latency</div>
                </div>
                <div class="stat-box">
                    <div class="stat-num">₹40.5k</div>
                    <div class="stat-desc">Statewide Run Cost / Month</div>
                </div>
            </div>

            <div class="meta-grid">
                <div class="meta-card">
                    <div class="meta-card-label">Statutory Compliance Framework</div>
                    <div class="meta-card-value">BNS 2023 • BNSS 2023 • BSA 2023 (§63)</div>
                </div>
                <div class="meta-card">
                    <div class="meta-card-label">Primary Cloud Platform</div>
                    <div class="meta-card-value">Zoho Catalyst (AppSail, Data Store, QuickML)</div>
                </div>
                <div class="meta-card">
                    <div class="meta-card-label">Cognitive AI Architecture</div>
                    <div class="meta-card-value">Dual-Brain (GLM-4.7 Reasoning + Qwen VLM 35B)</div>
                </div>
                <div class="meta-card">
                    <div class="meta-card-label">Dataset Provenance</div>
                    <div class="meta-card-value">70,500 FIRs • 33,350 Geocodes • 282k Station-Days</div>
                </div>
            </div>
        </div>

        <div class="cover-footer">
            <div><strong>Classification:</strong> OFFICIAL POLICE PRIVILEGED // AUDITED</div>
            <div><strong>Date of Audit:</strong> October 29, 2026</div>
            <div><strong>Deployment Target:</strong> Bangalore Command & 30 Districts</div>
        </div>
    </div>

    <div class="page-break"></div>

    <h1>1. Executive Summary & Strategic Imperative</h1>

    <h3>1.1 Context and Operational Genesis</h3>
    <p>
        The administration of criminal justice in India has undergone its most historic overhaul in over a century with the enactment of the <strong>Bharatiya Nyaya Sanhita (BNS) 2023</strong>, the <strong>Bharatiya Nagarik Suraksha Sanhita (BNSS) 2023</strong>, and the <strong>Bharatiya Sakshya Adhiniyam (BSA) 2023</strong>. For frontline Station House Officers (SHOs), Circle Inspectors (CIs), and District Superintendents of Police (SPs), these statutory changes introduce strict evidentiary mandates: mandatory digital videography of crime scenes (§105 BNSS), stringent 60/90-day statutory remand ceilings before default bail accrues (§187(3) BNSS), and rigorous electronic record authentication with tamper-evident provenance (§63 BSA).
    </p>
    <p>
        Simultaneously, traditional police databases (such as legacy CCTNS deployments) function purely as archival repositories. They record what has happened, but provide zero assistance on what will happen, where syndicates operate, or when statutory default bail deadlines are breached. <strong>KSP VAJRA 3.0</strong> was engineered as an operational co-pilot to resolve this epistemic gap.
    </p>

    <div class="callout callout-gold">
        <div class="callout-title">Operational Doctrine: The Four Non-Negotiables of Police AI</div>
        <ol style="margin: 0; padding-left: 18px; font-size: 8.5pt;">
            <li><strong>Zero Legal Hallucination:</strong> Legal sections, statutory remand dates, and penal consequences must be computed deterministically. An LLM must NEVER calculate a default bail deadline.</li>
            <li><strong>Tamper-Evident Forensic Provenance (§63 BSA):</strong> Every database row, telemetry query, and AI response is signed with a cryptographic SHA-256 hash.</li>
            <li><strong>Sub-3-Second Officer Response Time:</strong> High-frequency analytical intents (crime hotspots, criminal syndicate networks, recidivism risk) bypass slow reasoning loops via direct fast-paths.</li>
            <li><strong>Epistemic Segregation:</strong> Probabilistic machine learning inferences (e.g. 7-day crime forecasts, MO similarity) are clearly disclosed with confidence intervals and separated from certified facts.</li>
        </ol>
    </div>

    <h3>1.2 High-Level Architecture Overview</h3>
    <p>
        VAJRA 3.0 operates as a full-stack, serverless cloud platform deployed natively on <strong>Zoho Catalyst</strong> in the India region. The backend runs as a high-concurrency ASGI Python service on <strong>Catalyst AppSail</strong>, leveraging <strong>Catalyst Data Store</strong> for relational CCTNS persistence, <strong>Catalyst QuickML</strong> for low-latency machine learning and vision-language inference, <strong>Catalyst SmartBrowz</strong> for court-admissible PDF dossier generation, and <strong>Catalyst Stratus</strong> for large-scale spatial pre-indexes.
    </p>
    """

