# -*- coding: utf-8 -*-
"""
Master Compiler for VAJRA 3.0 Comprehensive Technical & Data Science PDF Report
"""
import os
import sys
import subprocess
import time

from report_sections import get_cover_and_executive
from report_diagrams import get_system_architecture_svg, get_dual_brain_svg, get_database_er_svg
from report_workflows import get_all_workflows_html
from report_datascience_and_costs import get_datascience_and_costs_html

def main():
    print("=================================================================")
    print("  VAJRA 3.0 COMPREHENSIVE MASTER REPORT COMPILER (WHITE THEME)  ")
    print("=================================================================")

    with open("vajra_report_styles.css", "r", encoding="utf-8") as f:
        css = f.read()

    print("Assembling master report chapters...")

    html_parts = [
        "<!DOCTYPE html>",
        '<html lang="en">',
        "<head>",
        '    <meta charset="UTF-8">',
        '    <meta name="viewport" content="width=device-width, initial-scale=1.0">',
        "    <title>VAJRA 3.0 Comprehensive Master Technical Report</title>",
        f"    <style>\n{css}\n    </style>",
        "</head>",
        "<body>",
        get_cover_and_executive(),
        '    <div class="page-break"></div>',
        '    <h1>2. Platform Architecture & Core Technology Stack</h1>',
        '    <p>VAJRA 3.0 employs a distributed serverless multi-tier architecture designed for continuous police operations with zero single points of failure. The platform orchestrates presentation, cognitive intelligence, relational persistence, and external signals into an interconnected system:</p>',
        get_system_architecture_svg(),
        '    <div class="page-break"></div>',
        '    <h1>3. Dual-Brain AI & Agent Cognitive Architecture</h1>',
        '    <p>To deliver deep investigative reasoning without sacrificing sub-second response times, VAJRA 3.0 introduces the <strong>Dual-Brain Cognitive Architecture</strong>. Brain 1 (GLM-4.7) conducts complex multi-hop epistemic RAG, while Brain 2 (Catalyst QuickML Qwen VLM 35B) drives zero-latency tool routing, high-speed command briefing synthesis, and multimodal vision analysis:</p>',
        get_dual_brain_svg(),
        '    <div class="page-break"></div>',
        '    <h1>4. Relational Database Architecture & CCTNS Schema</h1>',
        '    <p>Persistent storage is governed by the <strong>Catalyst Data Store</strong> with Row-Level Security (RLS) enforcement. The relational schema maps the complete life cycle of criminal investigations across 20+ interconnected tables:</p>',
        get_database_er_svg(),
        '    <div class="page-break"></div>',
        get_all_workflows_html(),
        '    <div class="page-break"></div>',
        get_datascience_and_costs_html(),
        "</body>",
        "</html>"
    ]

    full_html = "\n".join(html_parts)
    html_path = os.path.abspath("VAJRA_Comprehensive_Master_Report.html")
    pdf_path = os.path.abspath("VAJRA_Comprehensive_Master_Report.pdf")

    with open(html_path, "w", encoding="utf-8") as f:
        f.write(full_html)

    print(f"Master HTML generated: {html_path} ({os.path.getsize(html_path):,} bytes)")

    chrome_paths = [
        r"C:\Program Files\Google\Chrome\Application\chrome.exe",
        r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
        r"C:\Program Files\Microsoft\Edge\Application\msedge.exe"
    ]
    browser = next((p for p in chrome_paths if os.path.exists(p)), None)
    if not browser:
        print("ERROR: No Chrome or Edge browser executable found.")
        sys.exit(1)

    print(f"Compiling PDF via Headless Browser: {browser}...")
    t0 = time.time()
    cmd = [
        browser,
        "--headless",
        "--disable-gpu",
        "--no-pdf-header-footer",
        f"--print-to-pdf={pdf_path}",
        html_path
    ]
    subprocess.run(cmd, check=True)
    t1 = time.time()

    if os.path.exists(pdf_path):
        size_kb = os.path.getsize(pdf_path) / 1024
        print(f"SUCCESS: PDF Report compiled successfully in {t1 - t0:.2f}s!")
        print(f"PDF Location: {pdf_path}")
        print(f"File Size: {size_kb:.2f} KB")

        # Check page count using PyMuPDF (fitz)
        try:
            import fitz
            doc = fitz.open(pdf_path)
            print(f"Total Page Count: {len(doc)} pages")
            doc.close()
        except Exception as e:
            print(f"Could not read page count: {e}")
    else:
        print("ERROR: PDF was not generated.")

if __name__ == "__main__":
    main()

