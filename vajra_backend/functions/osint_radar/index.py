"""
Autonomous Viral OSINT Radar (Vajra Plan 04-09-26, Item 28).

Sweeps Google News RSS -- the same stable, key-free, non-scraping feed
endpoint `internet_signals.py` already relies on for the main app's
web_search tool (confirmed live elsewhere in this project: DuckDuckGo/Bing
HTML scraping gets CAPTCHA'd/blocked, but Google News RSS is a documented
feed, not a scrape) -- across a fixed set of statewide crime-threat
categories, and raises a ProactiveAlerts row (AlertType='OSINT_THREAT')
for any genuinely NEW headline per category since the last run.

Deliberately does NOT use SmartBrowz/Dataverse for this: this project has
already confirmed those have real intermittent reliability issues
(blank-rendered search screenshots, Dataverse 500s) unrelated to any code
bug here -- a 6-hourly unattended radar needs the boring, reliable path.

Every inserted alert is explicitly labelled an unverified open-source
lead (Severity capped at "Warning", never "Critical" -- this project's
standing rule that OSINT signals are never presented with the confidence
of a certified CCTNS record applies here exactly as it does in the main
app's web_search tool).

Self-contained (own token fetch, own ZCQL REST calls, no import of the
main vajra_backend package) -- same reasoning as proactive_alerts/index.py:
Catalyst Job functions deploy as an isolated bundle, not alongside the
AppSail app.

SCHEDULING NOTE: this file, once deployed, does not automatically run
every 6 hours by itself -- Zoho Catalyst's Job Scheduling (cron trigger)
is configured in the Catalyst Console (Job Scheduling section), not via
any file in this repo (confirmed already in this project for the
`ai_turn_worker` function: a Job Pool alone doesn't create a schedule).
After deploying, set a recurring schedule (every 6 hours) against this
`osint_radar` job function in the console. Until that one-time console
step is done, this function is code-complete and independently
verifiable (see the `POST /api/admin/osint-radar/run` on-demand endpoint
in main.py, which runs the equivalent sweep inline) but not yet
self-triggering.
"""
import os
import re
import time
import html
import logging
import urllib.parse
import requests

logger = logging.getLogger()
logger.setLevel(logging.INFO)

PROJECT_ID = os.getenv("CATALYST_PROJECT_ID", "50212000000025002")
CLIENT_ID = os.getenv("CATALYST_CLIENT_ID")
CLIENT_SECRET = os.getenv("CATALYST_CLIENT_SECRET")
REFRESH_TOKEN = os.getenv("CATALYST_REFRESH_TOKEN")

ZCQL_URL = f"https://api.catalyst.zoho.in/baas/v1/project/{PROJECT_ID}/query"
TOKEN_URL = "https://accounts.zoho.in/oauth/v2/token"

_UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
       "(KHTML, like Gecko) Chrome/122.0 Safari/537.36")

# Statewide threat categories a KSP intelligence desk actually cares about
# (matches the plan's own "classify statewide threat vectors" framing).
# One Google News RSS query per category, not per-district-per-category --
# 30 districts x 6 categories would be 180 HTTP round-trips per run, far
# past what's worth spending on an unattended 6-hourly job; a category
# headline almost always names the affected city/district in its own
# title anyway (e.g. "Bengaluru cyber fraud gang busted"), so the district
# match below still gives real geographic attribution without that cost.
THREAT_CATEGORIES = [
    ("CYBER_FRAUD", "Karnataka cyber fraud OR cyber crime arrest"),
    ("NARCOTICS", "Karnataka drugs OR narcotics seizure"),
    ("ORGANIZED_CRIME", "Karnataka gang OR organized crime bust"),
    ("TERROR_THREAT", "Karnataka terror OR terrorist threat alert"),
    ("COMMUNAL_UNREST", "Karnataka riot OR communal violence"),
    ("TRAFFICKING", "Karnataka human trafficking OR child trafficking"),
]


def get_token():
    try:
        r = requests.post(TOKEN_URL, data={
            "client_id": CLIENT_ID, "client_secret": CLIENT_SECRET,
            "refresh_token": REFRESH_TOKEN, "grant_type": "refresh_token"}, timeout=15)
        return r.json().get("access_token")
    except Exception as e:
        logger.error(f"Auth token generation failure: {e}")
        return None


def post_with_retry(url, headers, json_body, timeout=20, attempts=3):
    for attempt in range(attempts):
        try:
            return requests.post(url, headers=headers, json=json_body, timeout=timeout)
        except (requests.exceptions.ConnectTimeout, requests.exceptions.ConnectionError):
            if attempt < attempts - 1:
                time.sleep(1.5 * (attempt + 1))
            else:
                raise


def _strip_html(s: str) -> str:
    return html.unescape(re.sub(r"<[^>]+>", "", s or "")).strip()


def _fetch_top_news(query: str):
    """One Google News RSS call -> the single most relevant (first) real
    item, or None. Same feed/parsing approach as
    internet_signals._scrape_news_rss, self-contained here since Job
    functions can't import the main app package."""
    try:
        url = ("https://news.google.com/rss/search?q=" + urllib.parse.quote(query)
               + "&hl=en-IN&gl=IN&ceid=IN:en")
        r = requests.get(url, headers={"User-Agent": _UA}, timeout=10)
        if r.status_code != 200:
            logger.warning(f"News RSS {r.status_code} for {query!r}")
            return None
        items = re.findall(r"<item>(.*?)</item>", r.text, re.DOTALL)
        if not items:
            return None
        block = items[0]

        def grab(tag):
            m = re.search(rf"<{tag}[^>]*>(.*?)</{tag}>", block, re.DOTALL)
            return _strip_html(re.sub(r"<!\[CDATA\[|\]\]>", "", m.group(1))) if m else ""

        title = grab("title")
        link = grab("link")
        src = grab("source") or "Google News"
        if not (title and link):
            return None
        return {"title": title, "url": link, "source": src}
    except Exception as e:
        logger.warning(f"News RSS fetch error for {query!r}: {e}")
        return None


def insert_alert(headers, alert_type, district_id, message, severity):
    insert_q = (
        f"INSERT INTO ProactiveAlerts (AlertType, DistrictID, AlertMessage, TriggerTime, Severity, IsRead) "
        f"VALUES ('{alert_type}', {district_id}, '{message.replace(chr(39), chr(39) * 2)}', "
        f"'{time.strftime('%Y-%m-%d %H:%M:%S', time.gmtime())}', '{severity}', false)"
    )
    res = post_with_retry(ZCQL_URL, headers, {"query": insert_q}, timeout=10)
    if "No such Table" in res.text:
        logger.warning("ProactiveAlerts table does not exist. Skipping insert.")
        return False
    return True


def handler(context, basic_val):
    logger.info("Starting Autonomous Viral OSINT Radar (Item 28)...")
    try:
        token = get_token()
        if not token:
            return "Auth failure"
        headers = {
            "Authorization": f"Zoho-oauthtoken {token}",
            "Content-Type": "application/json",
            "X-Catalyst-Environment": "Development",
            "environment": "Development",
        }

        # Districts, for best-effort geographic attribution by matching a
        # real district name inside the headline text.
        d_res = post_with_retry(ZCQL_URL, headers, {"query": "SELECT DistrictID, DistrictName FROM District"}, timeout=15)
        dist_rows = d_res.json().get("data", [])
        districts = {d["District"]["DistrictName"]: int(d["District"]["DistrictID"])
                     for d in dist_rows if d.get("District", {}).get("DistrictID") and d.get("District", {}).get("DistrictName")}
        # Fallback district (state capital / de facto hub) when a headline
        # doesn't name a specific district -- keeps every alert attributable
        # to a real DistrictID row rather than inventing a sentinel value.
        fallback_district_id = districts.get("Bengaluru Urban") or (int(dist_rows[0]["District"]["DistrictID"]) if dist_rows else 1)

        # This job's own alert history, for dedup -- same "don't re-fire on
        # an unchanged headline" discipline as REPEAT_OFFENDER/SPATIAL_SPIKE
        # in proactive_alerts/index.py. Keyed by category, storing the last
        # alerted URL inside the message itself (regex-extracted back out).
        hist_res = post_with_retry(ZCQL_URL, headers, {
            "query": "SELECT AlertMessage FROM ProactiveAlerts WHERE AlertType = 'OSINT_THREAT' "
                     "ORDER BY ROWID DESC LIMIT 60"}, timeout=15)
        seen_urls = set()
        for r in hist_res.json().get("data", []):
            msg = r.get("ProactiveAlerts", {}).get("AlertMessage", "")
            m = re.search(r"\((https?://\S+)\)", msg)
            if m:
                seen_urls.add(m.group(1))

        inserted = 0
        checked = 0
        for alert_type_suffix, query in THREAT_CATEGORIES:
            item = _fetch_top_news(query)
            checked += 1
            if not item or item["url"] in seen_urls:
                continue
            district_id = fallback_district_id
            for name, did in districts.items():
                if name and name.split()[0].lower() in item["title"].lower():
                    district_id = did
                    break
            message = (
                f"OSINT Radar [{alert_type_suffix}]: {item['title']} -- {item['source']} "
                f"({item['url']}). Unverified open-source lead, requires independent "
                f"corroboration before any operational action (Section 63 BSA)."
            )
            if insert_alert(headers, "OSINT_THREAT", district_id, message, "Warning"):
                inserted += 1
                seen_urls.add(item["url"])

        summary = f"OSINT radar run complete: {checked} categories checked, {inserted} new alert(s) inserted."
        logger.info(summary)
        return summary
    except Exception as e:
        logger.exception("OSINT radar job failed")
        return f"Error: {e}"
