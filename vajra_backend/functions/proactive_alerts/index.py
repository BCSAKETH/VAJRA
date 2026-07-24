import os
import re
import time
import requests
import logging
from datetime import datetime

# Logger setup
logger = logging.getLogger()
logger.setLevel(logging.INFO)

# Load environment or use fallbacks
PROJECT_ID = os.getenv("CATALYST_PROJECT_ID", "50212000000025002")
CLIENT_ID = os.getenv("CATALYST_CLIENT_ID")
CLIENT_SECRET = os.getenv("CATALYST_CLIENT_SECRET")
REFRESH_TOKEN = os.getenv("CATALYST_REFRESH_TOKEN")

ZCQL_URL = f"https://api.catalyst.zoho.in/baas/v1/project/{PROJECT_ID}/query"
TOKEN_URL = "https://accounts.zoho.in/oauth/v2/token"

def get_token():
    payload = {
        "client_id": CLIENT_ID,
        "client_secret": CLIENT_SECRET,
        "refresh_token": REFRESH_TOKEN,
        "grant_type": "refresh_token"
    }
    try:
        res = requests.post(TOKEN_URL, data=payload, timeout=10)
        return res.json().get("access_token")
    except Exception as e:
        logger.error(f"Auth token generation failure: {e}")
        return None


def post_with_retry(url, headers, json_body, timeout=20, attempts=4):
    """
    api.catalyst.zoho.in intermittently hangs and connect-times-out under
    this job's own load -- confirmed live twice: a single unlucky timeout on
    one page of a 70-page CaseMaster pagination used to kill the entire run
    (and, worse, at 50/50 odds leave a batch of alerts half-inserted).
    Transient connection errors get a few short retries; anything else
    (a real 4xx/5xx) is returned as-is for the caller to handle.
    """
    for attempt in range(attempts):
        try:
            return requests.post(url, headers=headers, json=json_body, timeout=timeout)
        except (requests.exceptions.ConnectTimeout, requests.exceptions.ConnectionError):
            if attempt < attempts - 1:
                time.sleep(1.5 * (attempt + 1))
            else:
                raise


def fetch_all(headers, select_clause, table, where_clause="", order_by="", max_pages=250):
    """
    ZCQL caps every query at 300 rows, whether or not a LIMIT is given (an
    unbounded query silently returns only the first 300). CaseMaster
    (20,000+ rows and growing via simulate_new_cases.py) and Accused
    (12,000+ rows) both need every row to compute real district/offender
    counts, and ProactiveAlerts' own history can now grow past 300 rows too
    (baselines are no longer capped, see below), so page through with LIMIT
    offset, 300 until a short page signals the end.

    max_pages=250 (75,000 rows) is a generous ceiling above current table
    sizes -- confirmed live that the old default of 50 pages (15,000 rows)
    silently truncated CaseMaster (already past 20,900 rows) mid-table,
    which meant a district's real case count could come back short by
    thousands of rows depending on which page the cutoff landed on. Callers
    against CaseMaster/Accused should also pass an explicit order_by (their
    ID column) -- without one, ZCQL doesn't guarantee the same rows land on
    the same page across repeated calls, so two runs of this same query
    could each truncate a *different* few thousand rows.
    """
    rows = []
    offset = 0
    where_sql = f" WHERE {where_clause}" if where_clause else ""
    order_sql = f" ORDER BY {order_by}" if order_by else ""
    for _ in range(max_pages):
        q = f"SELECT {select_clause} FROM {table}{where_sql}{order_sql} LIMIT {offset}, 300"
        res = post_with_retry(ZCQL_URL, headers, {"query": q}, timeout=20)
        page = res.json().get("data", [])
        rows.extend(page)
        if len(page) < 300:
            break
        offset += 300
    return rows


def get_last_known_counts(headers, alert_type, count_regex, key_field):
    """
    Reads this alert type's own history back out of ProactiveAlerts to
    recover "what count did we last report for this district/offender" --
    without a schema change (ZCQL here doesn't expose ALTER TABLE), the
    count is already sitting in each row's own AlertMessage text, so
    regex-extracting it back out avoids needing a new column just to
    remember state between runs. Paginated (not a single LIMIT 300 query)
    since baselines are no longer capped -- REPEAT_OFFENDER alone can have
    200+ rows once every eligible offender has been baselined once. Rows
    aren't fetched in a globally guaranteed order across pages, so instead
    of relying on "most recent first", each row's own TriggerTime is
    compared explicitly and only kept if it's newer than what's already
    recorded for that key.
    """
    rows = fetch_all(headers, f"{key_field}, AlertMessage, TriggerTime", "ProactiveAlerts", where_clause=f"AlertType = '{alert_type}'")
    history_exists = len(rows) > 0
    last_counts = {}
    last_times = {}
    for r in rows:
        row = r.get("ProactiveAlerts", {})
        raw_key = row.get(key_field)
        msg = row.get("AlertMessage", "")
        trigger_time = row.get("TriggerTime", "")
        if raw_key is None:
            continue
        # ZCQL returns numeric-looking fields (DistrictID here) as strings,
        # not ints -- confirmed live: comparing dist_counts' int keys
        # against this dict's un-cast string keys meant .get() always
        # missed, so every district looked like it had no prior every run.
        key = int(raw_key)
        if key in last_times and trigger_time <= last_times[key]:
            continue
        m = re.search(count_regex, msg)
        if m:
            last_counts[key] = int(m.group(1))
            last_times[key] = trigger_time
    return last_counts, history_exists


def get_last_known_offender_counts(headers):
    """
    Same idea as get_last_known_counts, but keyed on the suspect's name
    parsed out of the message text (AccusedName isn't its own
    ProactiveAlerts column) instead of a table column.
    """
    rows = fetch_all(headers, "AlertMessage, TriggerTime", "ProactiveAlerts", where_clause="AlertType = 'REPEAT_OFFENDER'")
    history_exists = len(rows) > 0
    last_counts = {}
    last_times = {}
    for r in rows:
        row = r.get("ProactiveAlerts", {})
        msg = row.get("AlertMessage", "")
        trigger_time = row.get("TriggerTime", "")
        m = re.search(r"Suspect '(.+?)' detected in (\d+) separate cases", msg)
        if not m:
            continue
        name = m.group(1)
        if name in last_times and trigger_time <= last_times[name]:
            continue
        last_counts[name] = int(m.group(2))
        last_times[name] = trigger_time
    return last_counts, history_exists


def insert_alerts(headers, alerts):
    inserted = 0
    for alert in alerts:
        insert_q = f"""
            INSERT INTO ProactiveAlerts (AlertType, DistrictID, AlertMessage, TriggerTime, Severity, IsRead)
            VALUES ('{alert["AlertType"]}', {alert["DistrictID"]}, '{alert["AlertMessage"].replace("'", "''")}', '{alert["TriggerTime"]}', '{alert["Severity"]}', false)
        """
        res = post_with_retry(ZCQL_URL, headers, {"query": insert_q}, timeout=10)
        if "No such Table" in res.text:
            logger.warning("ProactiveAlerts table does not exist in Catalyst Console Datastore. Skipping insert.")
            break
        inserted += 1
    return inserted


def handler(context, basic_val):
    logger.info("Starting Proactive Alerts Job Function...")
    try:
        token = get_token()
        if not token:
            logger.error("Failed to fetch access token.")
            return "Auth failure"

        headers = {
            "Authorization": f"Zoho-oauthtoken {token}",
            "Content-Type": "application/json",
            "X-Catalyst-Environment": "Development",
            "environment": "Development"
        }

        # 1. District Case-Volume Spike Detection
        # Fetch case master station links (paginated -- CaseMaster has ~8000 rows,
        # far past ZCQL's 300-row-per-query cap)
        cases_list = fetch_all(headers, "CaseMasterID, PoliceStationID", "CaseMaster", order_by="CaseMasterID")
        case_to_ps = {
            int(c["CaseMaster"]["CaseMasterID"]): int(c["CaseMaster"]["PoliceStationID"])
            for c in cases_list
            if c.get("CaseMaster", {}).get("CaseMasterID") and c.get("CaseMaster", {}).get("PoliceStationID")
        }

        # Fetch station to district mapping (Unit is small, one page is enough)
        units_q = "SELECT UnitID, DistrictID FROM Unit"
        res = post_with_retry(ZCQL_URL, headers, {"query": units_q}, timeout=15)
        units_list = res.json().get("data", [])
        unit_to_dist = {int(u["Unit"]["UnitID"]): int(u["Unit"]["DistrictID"]) for u in units_list if u.get("Unit", {}).get("UnitID") and u.get("Unit", {}).get("DistrictID")}

        # Fetch districts lookup (small, one page)
        d_q = "SELECT DistrictID, DistrictName FROM District"
        res = post_with_retry(ZCQL_URL, headers, {"query": d_q}, timeout=15)
        dist_list = res.json().get("data", [])
        dist_names = {int(d["District"]["DistrictID"]): d["District"]["DistrictName"] for d in dist_list if d.get("District", {}).get("DistrictID")}

        # Count cases per district
        dist_counts = {}
        for c in cases_list:
            ps_id = c.get("CaseMaster", {}).get("PoliceStationID")
            if ps_id and int(ps_id) in unit_to_dist:
                d_id = unit_to_dist[int(ps_id)]
                dist_counts[d_id] = dist_counts.get(d_id, 0) + 1

        # Last count THIS job itself reported per district, recovered from
        # ProactiveAlerts' own history -- not a fixed threshold. A district
        # sitting at 600 cases forever used to re-fire "spike" on every run
        # just for existing above 250; now it only fires when the count has
        # genuinely grown since the last time this job checked it. A
        # district seen for the first time gets a one-time, quiet baseline
        # record instead of being called a spike.
        last_spatial_counts, spatial_history_exists = get_last_known_counts(
            headers, "SPATIAL_SPIKE", r"logged (\d+) incidents", "DistrictID"
        )

        # Baselines and genuine spikes are tracked separately and capped
        # separately -- confirmed live this matters: with ~30 real districts
        # (and, worse, 238 eligible repeat offenders below) all competing for
        # one shared top-20 cap, only a partial slice ever got baselined per
        # run, and since the underlying fetch has no ORDER BY, a DIFFERENT
        # partial slice won the cap each time -- so entities kept looking
        # "new" and re-baselining indefinitely instead of ever converging.
        # Baselines are quiet bookkeeping (Info severity, not a real alert),
        # so there's no flooding risk in inserting all of them in one pass;
        # only genuine spikes need a cap, since those are what actually
        # interrupt an officer.
        #
        # "prior is None" means two different things depending on whether
        # SPATIAL_SPIKE has ANY history yet. If the table is empty, every
        # district over 250 is legacy/seed data -- nothing "new" happened,
        # so it's quietly baselined. But once that one-time sweep has run,
        # the full eligible population has a record; a district with no
        # record after that point didn't exist in the last sweep and has
        # just now crossed the threshold for the first time -- that IS new
        # activity and deserves a real alert, not silent baselining.
        # Confirmed live: a district_spike test run landed exactly on this
        # case (a district crossing 250 for the first time) and the old
        # logic silently swallowed it as a baseline.
        spatial_baselines = []
        spatial_spikes = []
        for d_id, count in dist_counts.items():
            if count <= 250:
                continue
            d_name = dist_names.get(d_id, f"District {d_id}")
            prior = last_spatial_counts.get(d_id)
            base = {
                "AlertType": "SPATIAL_SPIKE", "DistrictID": d_id,
                "TriggerTime": datetime.now().isoformat(), "IsRead": False, "_sort_key": count
            }
            if prior is None and not spatial_history_exists:
                # Wording deliberately echoes the real-spike phrasing ("logged
                # N incidents") so the SAME regex above can read this count
                # back out as next run's prior.
                spatial_baselines.append({**base, "AlertMessage": f"Baseline: {d_name} has logged {count} incidents on record (first check, not yet a spike).", "Severity": "Info"})
            elif prior is None:
                spatial_spikes.append({**base, "AlertMessage": (
                    f"Volume Spike Warning: {d_name} has logged {count} incidents, newly crossing the alert "
                    f"threshold for the first time since monitoring began."
                ), "Severity": "Critical"})
            elif count > prior:
                delta = count - prior
                spatial_spikes.append({**base, "AlertMessage": (
                    f"Volume Spike Warning: {d_name} has logged {count} incidents, up {delta} since the last "
                    f"check ({prior}), exceeding normal threshold limits."
                ), "Severity": "Critical"})
            # else: no genuine increase since we last checked -- don't re-fire

        # 2. Repeat Offender Check (paginated -- Accused has ~14000 rows)
        acc_list = fetch_all(headers, "AccusedName, CaseMasterID", "Accused", order_by="AccusedMasterID")

        acc_counts = {}
        acc_last_district = {}
        for a in acc_list:
            name = a.get("Accused", {}).get("AccusedName")
            case_id = a.get("Accused", {}).get("CaseMasterID")
            if name and name.strip() and "unknown" not in name.lower():
                acc_counts[name] = acc_counts.get(name, 0) + 1
                ps_id = case_to_ps.get(int(case_id)) if case_id else None
                if ps_id and ps_id in unit_to_dist:
                    acc_last_district[name] = unit_to_dist[ps_id]

        last_offender_counts, offender_history_exists = get_last_known_offender_counts(headers)

        # Same "prior is None means two different things" fix as spatial
        # above: only the very first-ever sweep (no REPEAT_OFFENDER history
        # at all) should silently baseline. After that, an offender with no
        # record just crossed from a single case to a repeat offender for
        # the first time since monitoring began -- genuinely new, not stale
        # history, so it gets a real alert.
        offender_baselines = []
        offender_spikes = []
        for name, count in acc_counts.items():
            if count <= 1:
                continue
            prior = last_offender_counts.get(name)
            d_id = acc_last_district.get(name, 1)
            base = {
                "AlertType": "REPEAT_OFFENDER", "DistrictID": d_id,
                "TriggerTime": datetime.now().isoformat(), "IsRead": False, "_sort_key": count
            }
            if prior is None and not offender_history_exists:
                offender_baselines.append({**base, "AlertMessage": f"Baseline: Suspect '{name}' detected in {count} separate cases (first check, not yet flagged as new activity).", "Severity": "Info"})
            elif prior is None:
                offender_spikes.append({**base, "AlertMessage": f"Repeat Offender Alert: Suspect '{name}' detected in {count} separate cases for the first time since monitoring began.", "Severity": "Critical" if count > 3 else "Warning"})
            elif count > prior:
                offender_spikes.append({**base, "AlertMessage": f"Repeat Offender Alert: Suspect '{name}' detected in {count} separate cases (up from {prior}).", "Severity": "Critical" if count > 3 else "Warning"})
            # else: no new case for this offender since we last checked

        # Genuine spikes are capped at 20 per type (most severe/highest
        # count first) so a real surge doesn't flood the officer with alerts
        # -- but baselines are never capped, precisely to avoid the
        # partial-coverage bug described above.
        spatial_spikes.sort(key=lambda a: a["_sort_key"], reverse=True)
        offender_spikes.sort(key=lambda a: a["_sort_key"], reverse=True)
        alerts_to_insert = spatial_baselines + spatial_spikes[:20] + offender_baselines + offender_spikes[:20]

        inserted = insert_alerts(headers, alerts_to_insert)

        logger.info(
            f"Proactive Alerts Job completed successfully. Inserted {inserted} rows "
            f"({len(spatial_baselines)} spatial baseline, {len(spatial_spikes[:20])} spatial spike, "
            f"{len(offender_baselines)} offender baseline, {len(offender_spikes[:20])} offender spike)."
        )
        return "Success"
    except Exception as e:
        logger.error(f"Error in Proactive Alerts Job: {e}")
        return "Error"
