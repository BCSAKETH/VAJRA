"""
Retrain the conviction-risk model on the REAL, per-case legal outcome.

Fixes the confirmed defects in the shipped model:
  1. It scored ~0.2% for everyone (no discrimination).
  2. Its encoders knew only 5 districts -> most of Karnataka was unseen.
  3. Raw FIR_YEAR dominated every prediction (a temporal leak).

Label (data-backed, verified this session): CaseMaster.CaseStatusID == 3
("CONVICTED") -- 7,303 of 20,984 cases = 34.8%, a well-balanced, legally-
meaningful outcome that lives on the case row itself.

  WHY NOT the chargesheet join: ChargesheetDetails links by CaseMasterID, but
  CaseMasterID is NOT unique in CaseMaster (value 1 maps to 5 different crimes
  -- it is junk synthetic data; ROWID is the true key). ZCQL COUNT(DISTINCT)
  also lies (reports the row total). Joining on it produced a bogus 87% "label".
  CaseStatusID is a clean per-row field (its GROUP BY sums exactly to 20,984).

Keeps the EXACT 12-feature vector get_offender_risk builds at inference, so
no inference code changes are needed. Neutralizes the year leak by holding
FIR_YEAR constant during training (trees then never split on it; inference
still passes the real year, which is simply ignored). Regenerates the label
encoders across ALL districts/units/crime-groups/FIR-types.

Run from vajra_backend/ with the training libs installed (sklearn 1.9.0 +
xgboost). Saves .new.joblib artifacts + prints the score distribution so we
can confirm real spread BEFORE deploying. Nothing is deployed by this script.
"""
import os, math, json, requests
import numpy as np
import pandas as pd
import joblib
from sklearn.preprocessing import LabelEncoder
from xgboost import XGBClassifier

ENV = {}
for fn in [".env", ".env.local"]:
    if os.path.exists(fn):
        for line in open(fn):
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                ENV[k] = v.strip().strip('"').strip("'")

PID = ENV["CATALYST_PROJECT_ID"]
ZCQL_URL = f"https://api.catalyst.zoho.in/baas/v1/project/{PID}/query"


def token():
    r = requests.post("https://accounts.zoho.in/oauth/v2/token", data={
        "client_id": ENV["CATALYST_CLIENT_ID"], "client_secret": ENV["CATALYST_CLIENT_SECRET"],
        "refresh_token": ENV["CATALYST_REFRESH_TOKEN"], "grant_type": "refresh_token"}, timeout=20)
    return r.json()["access_token"]


HEADERS = {"Authorization": f"Zoho-oauthtoken {token()}", "Content-Type": "application/json",
           "X-Catalyst-Environment": "Development", "environment": "Development"}


def fetch_all(select_clause, table, key_col, max_pages=400):
    """Keyset (seek) pagination on a UNIQUE numeric key -> stable, never dupes
    or skips rows. Offset pagination (LIMIT offset,300) proved unreliable on
    the 20k-row CaseMaster (it duplicated some rows and skipped others, which
    corrupted the chargesheet label rate to 87% instead of the true 33%).
    `key_col` MUST be selected in `select_clause` and be a unique ascending
    numeric column (CaseMasterID or ROWID)."""
    rows, last, seen = [], None, set()
    for _ in range(max_pages):
        where = f"WHERE {key_col} > {last} " if last is not None else ""
        q = f"SELECT {select_clause} FROM {table} {where}ORDER BY {key_col} ASC LIMIT 300"
        res = requests.post(ZCQL_URL, headers=HEADERS, json={"query": q}, timeout=30)
        page = res.json().get("data", [])
        if not page:
            break
        max_key = last
        for r in page:
            kv = r.get(table, {}).get(key_col)
            if kv is None:
                continue
            kv = int(kv)
            if kv in seen:  # belt-and-braces: drop any repeat outright
                continue
            seen.add(kv)
            rows.append(r)
            if max_key is None or kv > max_key:
                max_key = kv
        if max_key == last or len(page) < 300:
            break
        last = max_key
    return rows


print("Pulling dimension tables...")
districts = {int(d["District"]["DistrictID"]): d["District"]["DistrictName"]
             for d in fetch_all("DistrictID, DistrictName", "District", "DistrictID") if d.get("District", {}).get("DistrictID")}
units = {int(u["Unit"]["UnitID"]): (u["Unit"].get("UnitName"), u["Unit"].get("DistrictID"))
         for u in fetch_all("UnitID, UnitName, DistrictID", "Unit", "UnitID") if u.get("Unit", {}).get("UnitID")}
heads = {int(h["CrimeHead"]["CrimeHeadID"]): h["CrimeHead"].get("CrimeGroupName")
         for h in fetch_all("CrimeHeadID, CrimeGroupName", "CrimeHead", "CrimeHeadID") if h.get("CrimeHead", {}).get("CrimeHeadID")}
cats = {int(c["CaseCategory"]["CaseCategoryID"]): c["CaseCategory"].get("LookupValue")
        for c in fetch_all("CaseCategoryID, LookupValue", "CaseCategory", "CaseCategoryID") if c.get("CaseCategory", {}).get("CaseCategoryID")}
print(f"  districts={len(districts)} units={len(units)} crimeheads={len(heads)} categories={len(cats)}")

print("Counting accused/victims per case (by CaseMasterID -- same join the")
print("inference path uses, so the feature is consistent train<->serve)...")
acc_count, vic_count = {}, {}
for r in fetch_all("ROWID, CaseMasterID", "Accused", "ROWID"):
    cid = r.get("Accused", {}).get("CaseMasterID")
    if cid is not None:
        acc_count[int(cid)] = acc_count.get(int(cid), 0) + 1
for r in fetch_all("ROWID, CaseMasterID", "Victim", "ROWID"):
    cid = r.get("Victim", {}).get("CaseMasterID")
    if cid is not None:
        vic_count[int(cid)] = vic_count.get(int(cid), 0) + 1
print(f"  cases with accused={len(acc_count)} with victims={len(vic_count)}")

print("Pulling CaseMaster...")
# Key on ROWID, NOT CaseMasterID: ROWID is Catalyst's guaranteed-monotonic
# system key. CaseMasterID is non-unique junk (see module docstring), so keying
# on it made keyset terminate early at 8,074 rows.
cases = fetch_all("ROWID, CaseMasterID, PoliceStationID, CrimeMajorHeadID, CaseCategoryID, CrimeRegisteredDate, CaseStatusID", "CaseMaster", "ROWID")
print(f"  cases={len(cases)} (distinct keyset-fetched)")
CONVICTED_STATUS = 3  # CaseStatusMaster: 3 == "CONVICTED"

rows = []
for c in cases:
    cm = c.get("CaseMaster", {})
    # CaseMasterID is only a (noisy) join key for accused/victim counts now, not
    # the label and not a row filter -- rows with a null one are still real cases.
    raw_cid = cm.get("CaseMasterID")
    cid = int(raw_cid) if raw_cid is not None else -1
    status = cm.get("CaseStatusID")
    ps = cm.get("PoliceStationID")
    unit_name, dist_id = (units.get(int(ps), (None, None)) if ps else (None, None))
    dist_name = districts.get(int(dist_id)) if dist_id else None
    group_name = heads.get(int(cm["CrimeMajorHeadID"])) if cm.get("CrimeMajorHeadID") else None
    fir_type = cats.get(int(cm["CaseCategoryID"])) if cm.get("CaseCategoryID") else None
    raw_date = (cm.get("CrimeRegisteredDate") or "2026-01-01 00:00:00").split()[0]
    try:
        y, m, d = [int(x) for x in raw_date.split("-")[:3]]
    except Exception:
        y, m, d = 2026, 1, 1
    rows.append({
        "District_Name": dist_name or "Unknown", "UnitName": unit_name or "Unknown",
        "CrimeGroup_Name": group_name or "Unknown", "FIR_Type": fir_type or "Non Heinous",
        "month": m, "day": d,
        "VICTIM COUNT": vic_count.get(cid, 1), "Accused Count": acc_count.get(cid, 1),
        "label": 1 if (status is not None and int(status) == CONVICTED_STATUS) else 0,
    })

df = pd.DataFrame(rows)
pos_rate = 100 * df["label"].mean()
print(f"Training rows={len(df)} | positive(CONVICTED)={int(df['label'].sum())} ({pos_rate:.1f}%)")
# Ground truth (verified via GROUP BY, which sums exactly to 20,984): CONVICTED
# = 7,303 / 20,984 = 34.8%. If the fetched label rate drifts far from that, the
# pull is corrupted -> refuse to train rather than ship a mislabeled risk model.
assert 28 <= pos_rate <= 42, (
    f"Label rate {pos_rate:.1f}% is off the verified 34.8% CONVICTED base rate -- "
    f"data pull is corrupted, aborting before training a bad model."
)
assert abs(len(df) - 20984) <= 5, f"Row count {len(df)} != ~20984 cases -- fetch incomplete/duplicated."

encoders = {}
for col in ["District_Name", "UnitName", "CrimeGroup_Name", "FIR_Type"]:
    le = LabelEncoder()
    df[col + "_enc"] = le.fit_transform(df[col].astype(str))
    encoders[col] = le
    print(f"  encoder {col}: {len(le.classes_)} classes")

df["month_sin"] = np.sin(2 * np.pi * df["month"] / 12.0)
df["month_cos"] = np.cos(2 * np.pi * df["month"] / 12.0)
df["day_sin"] = np.sin(2 * np.pi * df["day"] / 31.0)
df["day_cos"] = np.cos(2 * np.pi * df["day"] / 31.0)
df["victim_to_accused_ratio"] = df["VICTIM COUNT"] / (df["Accused Count"] + 1.0)
# Neutralize the FIR_YEAR leak: constant in training -> the model can never
# split on it, so the real year passed at inference is simply ignored.
df["FIR_YEAR"] = 0

FEATURES = ["District_Name_enc", "UnitName_enc", "CrimeGroup_Name_enc", "FIR_Type_enc",
            "FIR_YEAR", "month_sin", "month_cos", "day_sin", "day_cos",
            "VICTIM COUNT", "Accused Count", "victim_to_accused_ratio"]
INFER_COLS = ["District_Name_encoded", "UnitName_encoded", "CrimeGroup_Name_encoded", "FIR_Type_encoded",
              "FIR_YEAR", "month_sin", "month_cos", "day_sin", "day_cos",
              "VICTIM COUNT", "Accused Count", "victim_to_accused_ratio"]
X = df[FEATURES].copy()
X.columns = INFER_COLS  # match the exact column names get_offender_risk builds
y = df["label"].values

pos = max(int(y.sum()), 1)
neg = len(y) - pos
model = XGBClassifier(
    n_estimators=300, max_depth=5, learning_rate=0.08, subsample=0.9, colsample_bytree=0.9,
    scale_pos_weight=neg / pos, eval_metric="logloss", random_state=42,
)
model.fit(X, y)

proba = model.predict_proba(X)[:, 1]
print("\n=== SCORE DISTRIBUTION (calibrated proba) ===")
for p in [0, 10, 25, 50, 75, 90, 100]:
    print(f"  {p}th pct: {np.percentile(proba, p)*100:.1f}%")
print(f"  mean={proba.mean()*100:.1f}% std={proba.std()*100:.1f}% unique-ish spread={len(np.unique(np.round(proba,2)))} buckets")
imp = sorted(zip(INFER_COLS, model.feature_importances_), key=lambda t: -t[1])
print("Top features:", [(n, round(float(v), 3)) for n, v in imp[:5]])

joblib.dump(model, "xgboost_risk_model.new.joblib")
joblib.dump(encoders, "label_encoders.new.joblib")
# sanity re-load
m2 = joblib.load("xgboost_risk_model.new.joblib"); joblib.load("label_encoders.new.joblib")
print("\nSaved .new.joblib artifacts and re-loaded OK. NOT yet swapped/deployed.")
