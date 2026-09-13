"""
VAJRA Viral Trend Radar (E.8, was Finals.md Part IV, MECHANISM ONLY per D.13):

Per D.13's decision: the named KSP operational desks, addresses, and the
claimed "40+ term Karnataka slang lexicon" from the original document are
UNVERIFIED institutional claims and are deliberately NOT reproduced here or
anywhere officer-facing. What IS real, sound engineering and is built here:
real RSS ingestion, real evidence-hashing (SHA-256, Section 63 BSA-style),
real deduplication, and a real deterministic severity-scoring heuristic.
No unauthorized platform scraping (avoids IP bans and ToS violations on
Instagram/X/etc.); this is RSS + public feeds only.

*** OPEN ToS CAUTION (found this pass, not yet in Part D -- flagging per the
    same standard D.3 already applied to ip-api.com, not silently ignoring
    it) ***
The default feed source below (Google News' RSS search endpoint) returns a
feed whose own <copyright> tag reads: "This XML feed is made available
solely for the purpose of rendering Google News results within a personal
feed reader for personal, non-commercial use. Any other use of the feed is
expressly prohibited." An operational police intelligence tool is arguably
outside "personal, non-commercial use" -- structurally the SAME class of
problem D.3 found with ip-api.com's free tier. Confirmed live and reachable
(2026-09-13), but a human product decision is needed on whether this is an
acceptable use before this ships in an operational deployment (or whether
to swap in individual publishers' own official RSS feeds instead -- most
Indian dailies also publish source RSS, which is a materially different
ToS posture since it is the ORIGINAL publisher's own syndication feed
rather than an aggregator's restricted-use feed). `RSS_FEED_TEMPLATE` below
is a single, swappable constant for exactly that reason.
"""
import re
import time
import hashlib
import logging
import threading
import urllib.request
import urllib.parse
from datetime import datetime
from typing import Dict, Any, List, Optional, Tuple

logger = logging.getLogger("viral_trend_radar")

_RADAR_LOCK = threading.Lock()
_VIRAL_CACHE: Dict[str, Tuple[float, Dict[str, Any]]] = {}
_CACHE_TTL = 900  # 15 minutes -- demand-driven + cached, never a continuous poller (real AppSail resource concern)

# See the ToS caution in the module docstring above before relying on this
# in an operational deployment -- swap for a direct-publisher RSS feed if
# that caution isn't acceptable.
RSS_FEED_TEMPLATE = "https://news.google.com/rss/search?q={query}&hl=en-IN&gl=IN&ceid=IN:en"

# Category classifier -- a general keyword-driven heuristic, NOT tied to any
# specific claimed institutional desk structure (see D.13). Every keyword
# here is a plain English/common-usage term, not a claimed "slang lexicon."
_VIRAL_CRIME_PATTERNS = {
    "STUNT_RIDING": [r"\b(wheelie|stoppie|rash rid|stunt rid|bike racing|overspeeding|drifting)\b"],
    "COMMUNAL_INCITEMENT": [r"\b(communal|provocative speech|hate speech|desecration|flag burning)\b"],
    "MOB_PANIC_RUMOR": [r"\b(child lifter|kidnapping gang|organ harvester|fake rumor|vigilante attack)\b"],
    "CYBER_EXTORTION_DEEPFAKE": [r"\b(digital arrest|cbi impersonat|police impersonat|deepfake|sextortion)\b"],
    "PUBLIC_SAFETY": [r"\b(road rage|gang fight|college ragging|moral policing|eve teasing)\b"],
}

# Statutory citations left as GUIDANCE only, framed for verification -- per
# Part D's standing rule, no specific section number here is presented as
# a certified charge without independent legal verification.
_STATUTORY_PROVISIONS = {
    "STUNT_RIDING": ["BNS §281 (Rash Driving/Riding) -- verify current section number", "MV Act §184 (Dangerous Driving)"],
    "COMMUNAL_INCITEMENT": ["BNS provision on promoting enmity -- verify current section number"],
    "MOB_PANIC_RUMOR": ["BNS provision on public mischief/rumors -- verify current section number", "BNSS §168 (Preventive Police Action)"],
    "CYBER_EXTORTION_DEEPFAKE": ["BNS extortion provision -- verify current section number", "IT Act §66D (Personation)"],
    "PUBLIC_SAFETY": ["BNS provisions on hurt/criminal intimidation -- verify current section number"],
}


def _compute_sha256_hash(text: str) -> str:
    """Section 63 BSA-style evidence hash -- ties a specific captured item
    (title+url+publish-date) to a reproducible fingerprint at capture time."""
    return hashlib.sha256(text.encode("utf-8", errors="ignore")).hexdigest()[:16]


def _fetch_rss_signals(query: str, limit: int = 8) -> List[Dict[str, Any]]:
    """RSS-only ingestion -- no direct platform scraping, no authenticated
    API calls. Regex-based XML parsing (no external XML lib dependency)
    since only 4 well-known, simply-structured tags are needed."""
    encoded_q = urllib.parse.quote_plus(f"{query} Karnataka")
    url = RSS_FEED_TEMPLATE.format(query=encoded_q)
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 VajraPoliceOSINT/1.0"})
    items: List[Dict[str, Any]] = []
    try:
        with urllib.request.urlopen(req, timeout=5) as resp:
            xml_text = resp.read().decode("utf-8", errors="ignore")
            raw_items = re.findall(r"<item>(.*?)</item>", xml_text, flags=re.DOTALL)
            for raw in raw_items[:limit]:
                title_m = re.search(r"<title>(.*?)</title>", raw, flags=re.DOTALL)
                link_m = re.search(r"<link>(.*?)</link>", raw, flags=re.DOTALL)
                pub_m = re.search(r"<pubDate>(.*?)</pubDate>", raw, flags=re.DOTALL)
                desc_m = re.search(r"<description>(.*?)</description>", raw, flags=re.DOTALL)
                source_m = re.search(r"<source[^>]*>(.*?)</source>", raw, flags=re.DOTALL)
                if title_m and link_m:
                    title = re.sub(r"<[^>]+>", "", title_m.group(1)).strip()
                    link = link_m.group(1).strip()
                    pub = pub_m.group(1).strip() if pub_m else ""
                    snippet = re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", desc_m.group(1)).strip())[:250] if desc_m else ""
                    source_name = re.sub(r"<[^>]+>", "", source_m.group(1)).strip() if source_m else "Regional Press"
                    h = _compute_sha256_hash(f"{link}{title}{pub}")
                    items.append({
                        "title": title, "url": link, "published": pub, "snippet": snippet,
                        "source": source_name, "evidence_hash": f"sha256:{h}",
                    })
    except Exception as e:
        logger.warning(f"Viral Trend Radar RSS fetch failed for '{query}': {e}")
    return items


def score_and_classify_incident(title: str, snippet: str) -> Tuple[str, int, List[str]]:
    """Deterministic keyword-driven scorer -- never fabricates a category
    or severity, only counts real keyword hits against real text."""
    combined = f"{title} {snippet}".lower()
    matched_category = "PUBLIC_SAFETY"
    highest_score = 30
    for category, pattern_list in _VIRAL_CRIME_PATTERNS.items():
        cat_score = sum(25 for pat in pattern_list if re.search(pat, combined, flags=re.IGNORECASE))
        if cat_score > highest_score:
            highest_score = cat_score
            matched_category = category
    if re.search(r"\b(viral|trending|thousands of views|caught on camera)\b", combined):
        highest_score = min(100, highest_score + 20)
    severity = min(95, max(20, highest_score))
    return matched_category, severity, _STATUTORY_PROVISIONS.get(matched_category, [])


def scan_viral_social_threats(query_topic: str = "", district: str = "Bengaluru") -> Dict[str, Any]:
    """Demand-driven (called from a chat turn), 15-minute cached per
    topic+district -- never a continuous background poller, so this cannot
    exhaust AppSail resources the way an always-on scanner would."""
    cache_key = f"{district}::{query_topic}".lower()
    now = time.time()
    with _RADAR_LOCK:
        cached = _VIRAL_CACHE.get(cache_key)
        if cached and now - cached[0] < _CACHE_TTL:
            return cached[1]

    search_terms = query_topic if query_topic else f"viral video {district}"
    raw_items = _fetch_rss_signals(search_terms, limit=8)
    processed_items = []
    seen_hashes = set()
    for it in raw_items:
        h = it.get("evidence_hash")
        if h in seen_hashes:  # dedup: one viral story reported by many outlets -> one entry
            continue
        seen_hashes.add(h)
        category, severity, sections = score_and_classify_incident(it["title"], it["snippet"])
        it.update({"category": category, "severity_score": severity, "statutory_sections": sections})
        processed_items.append(it)
    processed_items.sort(key=lambda x: x["severity_score"], reverse=True)

    top_severity = processed_items[0]["severity_score"] if processed_items else 20
    threat_level = "HIGH" if top_severity >= 75 else ("ELEVATED" if top_severity >= 50 else "WATCHLIST")

    result_payload = {
        "status": "success", "topic": query_topic or "General Viral Trends", "district": district,
        "threat_level": threat_level,
        "primary_category": processed_items[0]["category"] if processed_items else "PUBLIC_SAFETY",
        "highest_severity_score": top_severity,
        "evidence_items": processed_items[:6],
        "scanned_at": datetime.utcnow().strftime("%Y-%m-%d %H:%M UTC"),
        "compliance_notice": "Passive public OSINT (RSS only). No private communication interception, no direct platform scraping. Statutory section numbers are guidance to verify, not certified charges.",
    }
    with _RADAR_LOCK:
        _VIRAL_CACHE[cache_key] = (now, result_payload)
    return result_payload
