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
import time
import logging
import threading
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
    return bool(_SEARCH_KEY)


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
        return {"configured": news_configured(), "items": [], "note": "No district specified."}
    if not news_configured():
        return {
            "configured": False, "items": [],
            "note": "Live news is off — set GNEWS_API_KEY (or NEWSAPI_KEY) in .env to activate.",
        }

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
        return {"configured": search_configured(), "items": [], "note": "Empty query."}
    if not search_configured():
        return {
            "configured": False, "items": [],
            "note": "Web search is off — set WEB_SEARCH_API_KEY in .env to activate.",
        }
    ck = f"search::{query.lower()}::{limit}"
    cached = _cache_get(ck)
    if cached is not None:
        return cached

    items: List[Dict[str, str]] = []
    try:
        if _SEARCH_ENGINE == "serpapi":
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
    except Exception as e:
        logger.warning(f"Web search error for {query!r}: {e}")

    result = {"configured": True, "items": items,
              "note": "" if items else "No public results found."}
    _cache_put(ck, result, _NEWS_TTL)
    return result
