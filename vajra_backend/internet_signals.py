"""
VAJRA internet layer -- controlled, cached access to public web sources
(news, web search) that feed the "Open-Source Signals" lane.

The ONE rule this module exists to protect: everything it returns is an
UNVERIFIED open-source LEAD, never official CCTNS record. Every item carries
its source, timestamp and link, and the UI renders it in a visually separate
lane (see the Round 2 dossier's trust boundary). Callers must never merge
these results into the grounded FIR/DB answer path.

Design constraints honoured here:
  * AppSail ~30s request kill -> every fetch is short-timeout-bounded and
    results are cached in-process with a TTL, so repeat hits never re-fetch
    and a slow/down provider degrades to an empty lane, never a hung request.
  * Rate limits / cost -> the TTL cache dedupes calls; free provider tiers
    are enough for a demo.
  * Keys live in .env (git-ignored) -> if no key is configured the feature is
    DORMANT (returns a clean "not configured" state), never an error. This is
    what lets the code ship before the operator has provisioned a key.

No key configured == feature off, gracefully. Provisioning GNEWS_API_KEY (or
NEWSAPI_KEY) in .env activates live news with zero code change.
"""
import os
import re
import time
import logging
import threading
import urllib.parse
import requests
from typing import Any, Dict, List, Optional

logger = logging.getLogger("internet_signals")

# --- provider config (all optional; absence = feature dormant) ---
_GNEWS_KEY = os.getenv("GNEWS_API_KEY", "").strip()
_NEWSAPI_KEY = os.getenv("NEWSAPI_KEY", "").strip()
_SEARCH_KEY = os.getenv("WEB_SEARCH_API_KEY", "").strip()     # generic web-search (OSINT / spike-explainer)
_SEARCH_ENGINE = os.getenv("WEB_SEARCH_ENGINE", "serpapi").strip().lower()

_NEWS_TTL = int(os.getenv("NEWS_CACHE_TTL_SECONDS", "3600"))  # 1h default
_HTTP_TIMEOUT = 8  # seconds -- well under the AppSail request kill

# Crime-relevant terms appended to a district query so we surface policing-
# relevant news, not generic city news.
_CRIME_TERMS = "crime OR police OR arrest OR FIR OR fraud OR assault OR theft OR murder OR cybercrime"

# --- tiny thread-safe in-process TTL cache (no schema change needed) ---
_cache: Dict[str, Any] = {}
_cache_lock = threading.Lock()


def _cache_get(key: str) -> Optional[Any]:
    with _cache_lock:
        entry = _cache.get(key)
        if entry and entry[0] > time.time():
            return entry[1]
        if entry:
            _cache.pop(key, None)
    return None


def _cache_put(key: str, value: Any, ttl: int) -> None:
    with _cache_lock:
        _cache[key] = (time.time() + ttl, value)


def news_configured() -> bool:
    """True if any news provider key is set."""
    return bool(_GNEWS_KEY or _NEWSAPI_KEY)


def search_configured() -> bool:
    # Always available: we ship our OWN scraper (DuckDuckGo HTML) that needs no
    # third-party API key. A SerpAPI key, if set, is used as a higher-quality
    # upgrade. Confidentiality note: any web search inevitably sends the query
    # to a search engine -- our scraper just removes the paid middleman.
    return True


_UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
       "(KHTML, like Gecko) Chrome/122.0 Safari/537.36")


def _strip_html(s: str) -> str:
    import html as _html
    return _html.unescape(re.sub(r"<[^>]+>", "", s or "")).strip()


def _scrape_news_rss(query: str, limit: int) -> List[Dict[str, str]]:
    """
    VAJRA's OWN news/search scraper -- Google News RSS. A stable, key-free,
    no-bot-block XML feed of news matching the query (ideal for VAJRA's
    crime-news / name-in-news use cases). Fail-soft: any error returns [].
    Results are open-source LEADS, never official record.
    """
    out: List[Dict[str, str]] = []
    try:
        url = ("https://news.google.com/rss/search?q=" + urllib.parse.quote(query)
               + "&hl=en-IN&gl=IN&ceid=IN:en")
        r = requests.get(url, headers={"User-Agent": _UA}, timeout=_HTTP_TIMEOUT)
        if r.status_code != 200:
            logger.warning(f"News RSS {r.status_code}")
            return out
        for block in re.findall(r"<item>(.*?)</item>", r.text, re.DOTALL)[:limit]:
            def grab(tag):
                m = re.search(rf"<{tag}[^>]*>(.*?)</{tag}>", block, re.DOTALL)
                return _strip_html(re.sub(r"<!\[CDATA\[|\]\]>", "", m.group(1))) if m else ""
            title = grab("title")
            link = grab("link")
            pub = grab("pubDate")
            src = grab("source") or "Google News"
            if title and link:
                out.append(_signal(title, src, pub, link, ""))
    except Exception as e:
        logger.warning(f"News RSS scrape error for {query!r}: {e}")
    return out


def _scrape_duckduckgo(query: str, limit: int) -> List[Dict[str, str]]:
    """
    VAJRA's OWN web scraper -- no third-party API. Fetches DuckDuckGo's HTML
    results page and parses the result links, titles and snippets. Bounded and
    fail-soft: any block/change returns [] (the caller degrades to an empty
    lane), never an error. Results are open-source LEADS, never official record.
    """
    out: List[Dict[str, str]] = []
    try:
        r = requests.post("https://html.duckduckgo.com/html/",
                          data={"q": query}, headers={"User-Agent": _UA},
                          timeout=_HTTP_TIMEOUT)
        if r.status_code != 200:
            logger.warning(f"DDG scrape {r.status_code}")
            return out
        html = r.text
        # each result: <a ... class="result__a" href="URL">TITLE</a>
        blocks = re.findall(r'<a[^>]+class="result__a"[^>]+href="([^"]+)"[^>]*>(.*?)</a>', html, re.DOTALL)
        snippets = re.findall(r'<a[^>]+class="result__snippet"[^>]*>(.*?)</a>', html, re.DOTALL)
        for i, (href, title) in enumerate(blocks[:limit]):
            # DDG wraps links as //duckduckgo.com/l/?uddg=<url-encoded target>
            m = re.search(r"uddg=([^&]+)", href)
            url = urllib.parse.unquote(m.group(1)) if m else href
            if url.startswith("//"):
                url = "https:" + url
            snip = _strip_html(snippets[i]) if i < len(snippets) else ""
            src = ""
            try:
                src = urllib.parse.urlparse(url).netloc
            except Exception:
                src = "web"
            out.append(_signal(_strip_html(title), src or "web", "", url, snip))
    except Exception as e:
        logger.warning(f"DDG scrape error for {query!r}: {e}")
    return out


def _signal(title: str, source: str, published: str, url: str, snippet: str = "") -> Dict[str, str]:
    """Uniform open-source-signal shape: always carries provenance."""
    return {
        "title": (title or "").strip(),
        "source": (source or "web").strip(),
        "published": (published or "").strip(),
        "url": (url or "").strip(),
        "snippet": (snippet or "").strip()[:240],
        "kind": "open_source_signal",          # marks the trust lane, never official
        "disclaimer": "Open-source signal — unverified lead, not an official record.",
    }


def get_district_news(district: str, limit: int = 5) -> Dict[str, Any]:
    """
    Recent crime-relevant news for a district, cached. Returns a dict:
      {configured: bool, items: [...signals...], note: str}
    Never raises. When no key is set, configured=False and items=[] with a
    note explaining how to activate -- so the UI can show a tidy dormant state.
    """
    district = (district or "").strip()
    if not district:
        return {"configured": True, "items": [], "note": "No district specified."}

    ck = f"news::{district.lower()}::{limit}"
    cached = _cache_get(ck)
    if cached is not None:
        return cached

    items: List[Dict[str, str]] = []
    try:
        if _GNEWS_KEY:
            q = f'"{district}" ({_CRIME_TERMS})'
            r = requests.get(
                "https://gnews.io/api/v4/search",
                params={"q": q, "country": "in", "lang": "en", "max": limit, "apikey": _GNEWS_KEY},
                timeout=_HTTP_TIMEOUT,
            )
            if r.status_code == 200:
                for a in (r.json().get("articles") or [])[:limit]:
                    items.append(_signal(
                        a.get("title", ""), (a.get("source") or {}).get("name", "GNews"),
                        a.get("publishedAt", ""), a.get("url", ""), a.get("description", ""),
                    ))
            else:
                logger.warning(f"GNews {r.status_code}: {r.text[:160]}")
        elif _NEWSAPI_KEY:
            q = f"{district} AND (crime OR police OR arrest OR fraud)"
            r = requests.get(
                "https://newsapi.org/v2/everything",
                params={"q": q, "language": "en", "sortBy": "publishedAt", "pageSize": limit},
                headers={"X-Api-Key": _NEWSAPI_KEY}, timeout=_HTTP_TIMEOUT,
            )
            if r.status_code == 200:
                for a in (r.json().get("articles") or [])[:limit]:
                    items.append(_signal(
                        a.get("title", ""), (a.get("source") or {}).get("name", "NewsAPI"),
                        a.get("publishedAt", ""), a.get("url", ""), a.get("description", ""),
                    ))
            else:
                logger.warning(f"NewsAPI {r.status_code}: {r.text[:160]}")
        if not items:
            # No key (or the key returned nothing) -> VAJRA's OWN scraper. Google
            # News RSS needs no key, so live district news works out of the box.
            items = _scrape_news_rss(f"{district} (crime OR police OR arrest OR fraud OR FIR)", limit)
    except Exception as e:
        logger.warning(f"News fetch error for {district!r}: {e}")

    result = {
        "configured": True, "items": items,
        "note": "" if items else "No recent crime-relevant news found for this district.",
    }
    # Cache even an empty result briefly so a quiet district doesn't re-hit the
    # provider on every hover; a shorter TTL for empties so news appears sooner.
    _cache_put(ck, result, _NEWS_TTL if items else min(_NEWS_TTL, 900))
    return result


def web_search(query: str, limit: int = 5) -> Dict[str, Any]:
    """
    Generic public web search for OSINT / spike-explainer. Same dormant-without-
    key contract as news. Supports SerpAPI (default) via WEB_SEARCH_API_KEY.
    Every result is an open-source signal (unverified lead), never official.
    """
    query = (query or "").strip()
    if not query:
        return {"configured": True, "items": [], "note": "Empty query."}
    ck = f"search::{query.lower()}::{limit}"
    cached = _cache_get(ck)
    if cached is not None:
        return cached

    items: List[Dict[str, str]] = []
    try:
        if _SEARCH_KEY and _SEARCH_ENGINE == "serpapi":
            # Optional higher-quality upgrade if an operator provides a key.
            r = requests.get(
                "https://serpapi.com/search.json",
                params={"q": query, "num": limit, "hl": "en", "gl": "in", "api_key": _SEARCH_KEY},
                timeout=_HTTP_TIMEOUT,
            )
            if r.status_code == 200:
                for a in (r.json().get("organic_results") or [])[:limit]:
                    items.append(_signal(
                        a.get("title", ""), a.get("displayed_link", "web"),
                        a.get("date", ""), a.get("link", ""), a.get("snippet", ""),
                    ))
            else:
                logger.warning(f"SerpAPI {r.status_code}: {r.text[:160]}")
        if not items:
            # Default: VAJRA's own scraper -- no key, no paid middleman. Google
            # News RSS is the reliable primary; DDG HTML is a secondary fallback.
            items = _scrape_news_rss(query, limit) or _scrape_duckduckgo(query, limit)
    except Exception as e:
        logger.warning(f"Web search error for {query!r}: {e}")

    result = {"configured": True, "items": items,
              "note": "" if items else "No public results found."}
    _cache_put(ck, result, _NEWS_TTL)
    return result


def _is_blocked_host(url: str) -> bool:
    """SSRF guard: never let the reader hit internal/private hosts."""
    try:
        host = (urllib.parse.urlparse(url).hostname or "").lower()
    except Exception:
        return True
    if not host or host in ("localhost", "127.0.0.1", "0.0.0.0", "::1", "metadata.google.internal"):
        return True
    if host.endswith((".internal", ".local")):
        return True
    if host.startswith(("10.", "192.168.", "169.254.", "172.16.", "172.17.", "172.18.",
                        "172.19.", "172.2", "172.30.", "172.31.")):
        return True
    return False


def fetch_page(url: str, max_chars: int = 4500) -> Dict[str, Any]:
    """
    VAJRA's own reader for ANY public web page -- fetches the URL and extracts
    its readable text, so the agent can read a specific article / public page
    (not just search-result snippets). Cached. SSRF-guarded (public http/https
    only), size- and time-bounded, and fail-soft. The content is an OPEN-SOURCE
    LEAD -- unverified, for context only, never official record.
    """
    url = (url or "").strip()
    if not url.startswith(("http://", "https://")):
        return {"url": url, "ok": False, "title": "", "text": "", "note": "Only http/https URLs are supported."}
    if _is_blocked_host(url):
        return {"url": url, "ok": False, "title": "", "text": "", "note": "Blocked internal/private host."}
    ck = f"page::{url}"
    cached = _cache_get(ck)
    if cached is not None:
        return cached
    result = {"url": url, "ok": False, "title": "", "text": "", "note": "Could not fetch this page."}
    try:
        r = requests.get(url, headers={"User-Agent": _UA}, timeout=_HTTP_TIMEOUT, allow_redirects=True)
        ct = (r.headers.get("content-type") or "").lower()
        if r.status_code != 200 or ("html" not in ct and "text" not in ct):
            result["note"] = f"Unreadable page (status {r.status_code}, type {ct or 'unknown'})."
        else:
            html = r.text
            tm = re.search(r"<title[^>]*>(.*?)</title>", html, re.DOTALL | re.I)
            title = _strip_html(re.sub(r"<!\[CDATA\[|\]\]>", "", tm.group(1))) if tm else ""
            # drop non-content blocks, then strip tags
            body = re.sub(r"(?is)<(script|style|noscript|nav|header|footer|aside|svg|form)[^>]*>.*?</\1>", " ", html)
            text = re.sub(r"\s+", " ", _strip_html(body)).strip()[:max_chars]
            result = {"url": url, "ok": bool(text), "title": title, "text": text,
                      "note": "Open-source content — unverified, read for context only."}
    except Exception as e:
        logger.warning(f"fetch_page error for {url!r}: {e}")
    _cache_put(ck, result, _NEWS_TTL)
    return result
