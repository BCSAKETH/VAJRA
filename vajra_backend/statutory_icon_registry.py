"""
Statutory Icon Registry: Maps Indian Penal Sections to exact Lucide SVG Path Strings.
Used for lossless vector stamping into SmartBrowz Court PDF Certificates and frontend UI.
"""
from typing import Dict
import re

STATUTORY_ICON_PATHS: Dict[str, str] = {
    # Sec 303 BNS / 379 IPC (Theft / Property Crimes)
    "bns_303": "M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6",
    # Sec 111 BNS (Organized Crime Syndicate)
    "bns_111": "M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2 M9 7a4 4 0 1 0 0-8 4 4 0 0 0 0 8 M23 21v-2a4 4 0 0 0-3-3.87",
    # Sec 63 BSA (Electronic Evidence Chain of Custody)
    "bsa_63": "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z M9 12l2 2 4-4",
    # Sec 187 BNSS (Statutory Remand 60/90 Day Countdown)
    "bnss_187": "M12 8v4l3 3 M3.05 11a9 9 0 1 1 .5 4m-.5 5v-5h5",
    # Sec 173 BNSS (CCTNS Cognizable FIR Registration)
    "bnss_173": "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6 M16 13H8 M16 17H8 M10 9H8",
    # Sec 193 BNSS (Case Diary & Chargesheet Readiness)
    "bnss_193": "M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5z M6 6h10 M6 10h10",
    # Sec 105 BNSS (Malkhana Seized Property / Search & Seizure)
    "bnss_105": "M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z M3.3 7l8.7 5 8.7-5 M12 22V12",
    # Sec 480 BNSS (Bail Opposition / Prosecutor Docket)
    "bnss_480": "m16 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z M2 16l3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z M7 21h10 M12 3v18 M3 7h2c2 0 5-1 7-2 2 1 5 2 7 2h2",
    # Sec 66 IT Act / Cyber Fraud Freezing
    "it_66": "M12 2H2v10l9.29 9.29c.94.94 2.48.94 3.42 0l6.58-6.58c.94-.94.94-2.48 0-3.42L12 2Z M7 7h.01",
    # Vahan RTO (Vehicle Seizure Telemetry)
    "transport_vahan": "M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.5 2.8C2.1 11.1 2 11.5 2 12v4c0 .6.4 1 1 1h2",
}

def normalize_statute_code(code: str) -> str:
    """
    Normalizes human statute references like '§ 303 BNS', 'Sec 111 BNS', or '63 BSA'
    into exact statutory dictionary lookup keys.
    """
    if not code:
        return "bsa_63"
    
    clean = code.lower().strip()
    
    # Exact key match
    if clean in STATUTORY_ICON_PATHS:
        return clean

    # Regex normalization
    if "303" in clean and ("bns" in clean or "ipc" in clean or "theft" in clean):
        return "bns_303"
    if "111" in clean and ("bns" in clean or "syndicate" in clean or "organized" in clean):
        return "bns_111"
    if "63" in clean and ("bsa" in clean or "evidence" in clean or "electronic" in clean):
        return "bsa_63"
    if "187" in clean and ("bnss" in clean or "remand" in clean or "crpc" in clean):
        return "bnss_187"
    if "173" in clean and ("bnss" in clean or "fir" in clean):
        return "bnss_173"
    if "193" in clean and ("bnss" in clean or "diary" in clean or "chargesheet" in clean):
        return "bnss_193"
    if ("105" in clean or "451" in clean) and ("bnss" in clean or "malkhana" in clean or "property" in clean):
        return "bnss_105"
    if "480" in clean and ("bnss" in clean or "bail" in clean):
        return "bnss_480"
    if "vahan" in clean or "vehicle" in clean or "transport" in clean:
        return "transport_vahan"
    if "it" in clean or "cyber" in clean or "66" in clean:
        return "it_66"
    
    return "bsa_63"

def get_statutory_path(statute_code: str) -> str:
    """Returns the SVG path 'd' string for a given statute."""
    norm_key = normalize_statute_code(statute_code)
    return STATUTORY_ICON_PATHS.get(norm_key, STATUTORY_ICON_PATHS["bsa_63"])

def get_statutory_svg(statute_code: str, stroke: str = "#C79A4E", size: int = 24, stroke_width: float = 2.0) -> str:
    """
    Generates a raw, lossless SVG element string for stamping into court-bound PDFs.
    Directly renders pure vector paths without rasterization or fuzzy image artifacts.
    """
    path_d = get_statutory_path(statute_code)
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{size}" height="{size}" '
        f'viewBox="0 0 24 24" fill="none" stroke="{stroke}" stroke-width="{stroke_width}" '
        f'stroke-linecap="round" stroke-linejoin="round" class="vajra-statute-icon">'
        f'<path d="{path_d}"/>'
        f'</svg>'
    )
