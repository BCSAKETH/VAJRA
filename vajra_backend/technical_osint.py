"""
VAJRA Technical OSINT Engine (E.2, was Finals.md Part II, corrected per D.2/D.3):
Specialized deterministic resolvers for cybercrime, financial fraud, and
traffic forensics:
  1. IFSC / Bank Branch Reverse Resolver (RBI-style mapping)
  2. Indian / Karnataka RTO Registration Plate Decoder (KA-01 to KA-55)
  3. Passive Domain/IP Geolocation -- SSRF-guarded, LOCAL GeoLite2 database
     only, no per-lookup external call (D.3: replaces Finals.md's
     ip-api.com dependency, which is outside that service's own free-tier
     terms for an operational police tool)

Real, currently-reachable APIs and data sources only -- no invented
endpoints. `resolve_ifsc` tries the real, public Razorpay IFSC lookup
(https://ifsc.razorpay.com/<CODE>, a genuinely free, keyless, publicly
documented service) and falls back to a deterministic bank-prefix routing
table if that's unreachable. The RTO registry below is a hand-typed
reference table, not a sourced government dataset -- verify entries against
the real RTO list before relying on it operationally (Part D's standing
caution on unverified factual claims applies here too).
"""
import re
import socket
import logging
import ipaddress
import urllib.parse
from typing import Dict, Any, Optional
import requests

logger = logging.getLogger("technical_osint")

# geoip2/maxminddb are vendored (see requirements.txt) but the actual
# GeoLite2-City.mmdb binary database (~60MB) requires a free MaxMind
# account + license key to download -- that account signup is a human
# step this pass could not perform. Importing geoip2 itself never fails
# (the package is vendored); only opening the .mmdb file can fail, and
# that failure is handled per-call below (lookup_whois_ip degrades to
# "IP resolved, detailed geolocation unavailable" rather than crashing).
try:
    import geoip2.database
    import geoip2.errors
    _GEOIP2_AVAILABLE = True
except Exception:
    _GEOIP2_AVAILABLE = False

_IFSC_BANK_CODES = {
    "SBIN": "State Bank of India", "HDFC": "HDFC Bank", "ICIC": "ICICI Bank",
    "PUNB": "Punjab National Bank", "BARB": "Bank of Baroda", "CNRB": "Canara Bank",
    "UBIN": "Union Bank of India", "BKID": "Bank of India", "IOBA": "Indian Overseas Bank",
    "IDIB": "Indian Bank", "KKBK": "Kotak Mahindra Bank", "UTIB": "Axis Bank",
    "YESB": "Yes Bank", "INDB": "IndusInd Bank", "KVBL": "Karur Vysya Bank",
    "KARB": "Karnataka Bank", "VIJB": "Vijaya Bank (now Bank of Baroda)",
    "SYNB": "Syndicate Bank (now Canara Bank)", "CORP": "Corporation Bank (now Union Bank of India)",
    "PKGB": "Karnataka Gramin Bank", "FDRL": "Federal Bank", "CIUB": "City Union Bank",
    "IBKL": "IDBI Bank", "PSIB": "Punjab & Sind Bank", "MAHB": "Bank of Maharashtra",
}

# Karnataka RTO jurisdiction registry -- hand-typed reference table, NOT a
# sourced government dataset (see module docstring). KA-01 through KA-55
# populated below; unpopulated codes fall through to the generic
# "Karnataka Regional Transport Office" response rather than a fabricated
# specific office name.
_KARNATAKA_RTO_REGISTRY = {
    "KA01": {"rto": "Koramangala", "district": "Bengaluru Urban", "zone": "Bengaluru Central"},
    "KA02": {"rto": "Rajajinagar", "district": "Bengaluru Urban", "zone": "Bengaluru West"},
    "KA03": {"rto": "Indiranagar", "district": "Bengaluru Urban", "zone": "Bengaluru East"},
    "KA04": {"rto": "Yeshwanthpur", "district": "Bengaluru Urban", "zone": "Bengaluru North"},
    "KA05": {"rto": "Jayanagar", "district": "Bengaluru Urban", "zone": "Bengaluru South"},
    "KA06": {"rto": "Tumakuru", "district": "Tumakuru", "zone": "Central Zone"},
    "KA07": {"rto": "Kolar", "district": "Kolar", "zone": "Central Zone"},
    "KA08": {"rto": "KGF (Robertsonpet)", "district": "Kolar", "zone": "Central Zone"},
    "KA09": {"rto": "Mysuru West", "district": "Mysuru", "zone": "Southern Zone"},
    "KA10": {"rto": "Chamrajnagar", "district": "Chamarajanagar", "zone": "Southern Zone"},
    "KA11": {"rto": "Mandya", "district": "Mandya", "zone": "Southern Zone"},
    "KA12": {"rto": "Madikeri", "district": "Kodagu", "zone": "Southern Zone"},
    "KA13": {"rto": "Hassan", "district": "Hassan", "zone": "Southern Zone"},
    "KA14": {"rto": "Shivamogga", "district": "Shivamogga", "zone": "Eastern Zone"},
    "KA15": {"rto": "Sagara", "district": "Shivamogga", "zone": "Eastern Zone"},
    "KA16": {"rto": "Chitradurga", "district": "Chitradurga", "zone": "Central Zone"},
    "KA17": {"rto": "Davanagere", "district": "Davanagere", "zone": "Eastern Zone"},
    "KA18": {"rto": "Chikkamagaluru", "district": "Chikkamagaluru", "zone": "Western Zone"},
    "KA19": {"rto": "Mangaluru", "district": "Dakshina Kannada", "zone": "Western Zone"},
    "KA20": {"rto": "Udupi", "district": "Udupi", "zone": "Western Zone"},
    "KA21": {"rto": "Puttur", "district": "Dakshina Kannada", "zone": "Western Zone"},
    "KA22": {"rto": "Belagavi", "district": "Belagavi", "zone": "Northern Zone"},
    "KA23": {"rto": "Chikkodi", "district": "Belagavi", "zone": "Northern Zone"},
    "KA24": {"rto": "Bailhongal", "district": "Belagavi", "zone": "Northern Zone"},
    "KA25": {"rto": "Dharwad", "district": "Dharwad", "zone": "Northern Zone"},
    "KA26": {"rto": "Gadag", "district": "Gadag", "zone": "Northern Zone"},
    "KA27": {"rto": "Haveri", "district": "Haveri", "zone": "Northern Zone"},
    "KA28": {"rto": "Vijayapura", "district": "Vijayapura", "zone": "Northern Zone"},
    "KA29": {"rto": "Bagalkote", "district": "Bagalkote", "zone": "Northern Zone"},
    "KA30": {"rto": "Karwar", "district": "Uttara Kannada", "zone": "Western Zone"},
    "KA31": {"rto": "Sirsi", "district": "Uttara Kannada", "zone": "Western Zone"},
    "KA32": {"rto": "Kalaburagi", "district": "Kalaburagi", "zone": "North-Eastern Zone"},
    "KA33": {"rto": "Yadgir", "district": "Yadgir", "zone": "North-Eastern Zone"},
    "KA34": {"rto": "Ballari", "district": "Ballari", "zone": "Eastern Zone"},
    "KA35": {"rto": "Hosapete", "district": "Vijayanagara", "zone": "Eastern Zone"},
    "KA36": {"rto": "Raichur", "district": "Raichur", "zone": "North-Eastern Zone"},
    "KA37": {"rto": "Koppal", "district": "Koppal", "zone": "North-Eastern Zone"},
    "KA38": {"rto": "Bidar", "district": "Bidar", "zone": "North-Eastern Zone"},
    "KA39": {"rto": "Bhalki", "district": "Bidar", "zone": "North-Eastern Zone"},
    "KA40": {"rto": "Chikkaballapura", "district": "Chikkaballapura", "zone": "Central Zone"},
    "KA41": {"rto": "Jnanabharathi (Kengeri)", "district": "Bengaluru Urban", "zone": "Bengaluru West"},
    "KA50": {"rto": "Yelahanka", "district": "Bengaluru Urban", "zone": "Bengaluru North"},
    "KA51": {"rto": "Electronic City", "district": "Bengaluru Urban", "zone": "Bengaluru South"},
    "KA52": {"rto": "Nelamangala", "district": "Bengaluru Rural", "zone": "Bengaluru Zone"},
    "KA53": {"rto": "K.R. Puram", "district": "Bengaluru Urban", "zone": "Bengaluru East"},
    "KA54": {"rto": "Nagamangala", "district": "Mandya", "zone": "Southern Zone"},
    "KA55": {"rto": "Mysuru East", "district": "Mysuru", "zone": "Southern Zone"},
}

_GEOIP_DB_PATH = "vendor/GeoLite2-City.mmdb"
_GEOIP_READER = None
_GEOIP_INIT_TRIED = False


def _get_geoip_reader():
    """Lazy-loaded singleton reader. Returns None (never raises) if the
    .mmdb file hasn't been placed yet -- see module docstring; this is the
    one piece of E.2 that needs a human step (a free MaxMind account +
    license key to download GeoLite2-City.mmdb into vajra_backend/vendor/)."""
    global _GEOIP_READER, _GEOIP_INIT_TRIED
    if _GEOIP_READER is not None:
        return _GEOIP_READER
    if _GEOIP_INIT_TRIED or not _GEOIP2_AVAILABLE:
        return None
    _GEOIP_INIT_TRIED = True
    try:
        _GEOIP_READER = geoip2.database.Reader(_GEOIP_DB_PATH)
    except Exception as e:
        logger.warning(f"GeoLite2-City.mmdb not available at {_GEOIP_DB_PATH}: {e}")
        _GEOIP_READER = None
    return _GEOIP_READER


def resolve_ifsc(ifsc_code: str) -> Dict[str, Any]:
    """Reverse resolves an 11-character Indian Financial System Code (IFSC)."""
    clean_code = (ifsc_code or "").strip().upper().replace(" ", "")
    if not re.match(r"^[A-Z]{4}0[A-Z0-9]{6}$", clean_code):
        return {"valid": False, "ifsc": clean_code,
                "error": "Invalid IFSC format. Must be 11 characters (e.g., SBIN0001234)."}

    bank_prefix = clean_code[:4]
    bank_name = _IFSC_BANK_CODES.get(bank_prefix, "Commercial / Cooperative Bank")

    # Razorpay's IFSC lookup is a real, free, keyless, publicly documented
    # service (https://ifsc.razorpay.com/<CODE>) -- not scraping, a
    # documented JSON API. Short timeout since this must never block a chat
    # turn; falls back to the deterministic table below on any failure.
    try:
        r = requests.get(f"https://ifsc.razorpay.com/{clean_code}", timeout=3.5)
        if r.status_code == 200:
            data = r.json()
            return {
                "valid": True, "ifsc": clean_code, "bank": data.get("BANK") or bank_name,
                "branch": data.get("BRANCH", ""), "address": data.get("ADDRESS", ""),
                "city": data.get("CITY", ""), "district": data.get("DISTRICT", ""),
                "state": data.get("STATE", ""), "micr": data.get("MICR", ""),
                "contact": data.get("CONTACT", ""), "source": "IFSC Public Registry (Live)",
            }
    except Exception as ex:
        logger.debug(f"IFSC live lookup skipped for {clean_code}: {ex}")

    return {
        "valid": True, "ifsc": clean_code, "bank": bank_name,
        "branch": f"Branch code {clean_code[5:]}", "district": "Verify via official bank portal",
        "state": "India", "source": "Deterministic bank-prefix routing table",
        "note": "Live IFSC registry unreachable; resolved via bank-code prefix only -- verify branch details independently.",
    }


def resolve_rto_plate(plate_number: str) -> Dict[str, Any]:
    """Resolves Indian vehicle registration plates, focusing on Karnataka (KA-01 to KA-55)."""
    clean = re.sub(r"[^A-Z0-9]", "", (plate_number or "").upper())
    if not clean.startswith("KA") or len(clean) < 4:
        state_prefix = clean[:2] if len(clean) >= 2 else ""
        return {
            "valid": len(clean) >= 4, "plate": plate_number, "state_code": state_prefix,
            "rto": "Out of State / Central Defense",
            "district": "Non-Karnataka Jurisdiction" if state_prefix and state_prefix != "KA" else "Unknown",
        }

    rto_code = clean[:4]
    info = _KARNATAKA_RTO_REGISTRY.get(rto_code)
    if info:
        return {
            "valid": True, "plate": plate_number, "rto_code": rto_code,
            "rto_office": info["rto"], "district": info["district"], "police_zone": info["zone"],
            "jurisdiction": f"{info['rto']} RTO, {info['district']}",
            "source": "Hand-maintained Karnataka RTO reference table -- verify against the official RTO list before operational use.",
        }

    return {"valid": True, "plate": plate_number, "rto_code": rto_code,
            "rto_office": "Karnataka Regional Transport Office", "district": "Karnataka State",
            "police_zone": "General State Transport"}


def lookup_whois_ip(target: str) -> Dict[str, Any]:
    """Resolves a domain/hostname/IP to a rough public geolocation, using a
    LOCAL GeoLite2 database only (D.3) -- no per-lookup external call, no
    rate limit, and the target IP is never sent to any third party.

    D.2 fix: the SSRF guard uses Python's `ipaddress` module directly
    instead of a hand-typed private-range prefix list -- correctly covers
    the FULL private/loopback/link-local/reserved ranges (including all of
    172.16.0.0/12, and IPv6 equivalents), not just a partial hand-typed
    subset."""
    clean = (target or "").strip().lower()
    if not clean:
        return {"ok": False, "target": target, "error": "No target provided."}
    if clean.startswith(("http://", "https://")):
        clean = urllib.parse.urlparse(clean).hostname or clean
    clean = clean.split(":")[0].split("/")[0]

    try:
        ip_addr = socket.gethostbyname(clean)
    except Exception:
        return {"ok": False, "target": target, "error": "Could not resolve host."}

    # D.2: one correct, hard-to-get-wrong check via the stdlib `ipaddress`
    # module, replacing a hand-typed prefix list that missed 172.19.x
    # through 172.31.x entirely in the original design.
    try:
        parsed = ipaddress.ip_address(ip_addr)
    except ValueError:
        return {"ok": False, "target": target, "error": "Resolved address is not a valid IP."}
    if parsed.is_private or parsed.is_loopback or parsed.is_link_local or parsed.is_reserved or parsed.is_multicast:
        return {"ok": False, "target": target, "error": "SSRF Guard: target resolves to a non-public address."}

    reader = _get_geoip_reader()
    if reader is None:
        return {
            "ok": True, "target": clean, "ip_address": ip_addr,
            "note": "Host resolved; local GeoLite2 database not installed on this server -- detailed geolocation unavailable.",
            "disclaimer": "Passive OSINT telemetry. Unverified lead under §63 BSA.",
        }
    try:
        resp = reader.city(ip_addr)
        return {
            "ok": True, "target": clean, "ip_address": ip_addr,
            "country": resp.country.name, "region": resp.subdivisions.most_specific.name,
            "city": resp.city.name,
            "isp": None,  # GeoLite2-City doesn't carry ISP/ASN -- would need the separate GeoLite2-ASN db
            "disclaimer": "Passive OSINT telemetry (local database, no external call made). Unverified lead under §63 BSA.",
        }
    except geoip2.errors.AddressNotFoundError:
        return {"ok": True, "target": clean, "ip_address": ip_addr,
                "note": "IP resolved but not present in the local geolocation database (common for newer allocations)."}
    except Exception as e:
        logger.debug(f"GeoIP lookup failed for {ip_addr}: {e}")
        return {"ok": True, "target": clean, "ip_address": ip_addr, "note": "Resolved IP; detailed geo-lookup unavailable."}
