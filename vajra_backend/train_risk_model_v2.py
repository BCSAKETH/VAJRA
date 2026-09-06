"""
Retrain + PROPERLY calibrate the conviction-risk model, v2.

Root-caused why the live /api/admin/model-calibration/run check reported
Brier 0.176 (target <=0.08) despite a ~0% Expected Calibration Error:

  1. train_risk_model.py fits XGBClassifier with `scale_pos_weight = neg/pos`.
     That's a standard trick to improve RECALL/ranking on an imbalanced
     label, but it deliberately DISTORTS the raw predicted probabilities
     away from true calibration -- exactly the wrong choice for a model
     whose whole job is to report an honest probability, not just rank
     suspects. Removing it (this IS a genuine probability-estimation task,
     and 34.8% positive isn't severely imbalanced) should measurably help
     Brier on its own.
  2. calibrate_risk_model.py fits its IsotonicRegression on the model's
     predictions over the SAME full dataset it's evaluated against
     afterward -- in-sample calibration. Isotonic regression is flexible
     enough to make the reliability CURVE look perfect on data it has
     already seen (hence ECE ~0%), without that being real evidence of
     accuracy on a case the model didn't train on. Real calibration must be
     evaluated OUT OF SAMPLE.

Fix here: proper stratified train/test split, calibration fit via
sklearn's CalibratedClassifierCV (cross-validated, so no single fold's
calibrator ever sees the outcomes it's being scored against), and every
reported number computed ONLY on the untouched test split. No target
number is assumed or forced -- whatever the honest held-out Brier score
turns out to be is what gets reported and (if it deploys) documented.

Run from vajra_backend/ with sklearn + xgboost installed. Saves
.v2.joblib artifacts; nothing is deployed by this script.

RESULT (first run, 8 original features): confirmed the honest ceiling is
NOT a calibration-method problem. Best candidate (sigmoid-CV, Brier
0.2268) is statistically indistinguishable from an uninformative
always-predict-the-base-rate baseline (Brier 0.2269) on genuine held-out
data -- the 8-feature set (district/unit/crime-group/FIR-type/month/day/
victim+accused-count) carries essentially no real signal for the
conviction-outcome label.

RESULT (second run, +Prior Offense Count, Item 27 attempt): added a new,
genuinely different feature -- the max number of OTHER cases sharing an
accused person's name on this case (a real repeat-offender signal none of
the original 8 features reference at all). Sanity-checked it against the
label directly before even training: conviction rate is 34.9% at 0 prior
offenses, 33.0% at 1, 22.7% at 2 (only 22 cases in that bucket -- noise,
not signal) -- essentially FLAT, slightly negative if anything. Held-out
Brier with the new feature included: still 0.2268, unchanged from the
8-feature run. Feature importance ranks it lowest of the real (non-zero)
features. Conclusion: this is not a feature-engineering gap fixable by
adding more columns from data already in CCTNS -- either the recorded
case attributes genuinely don't predict this specific outcome variable,
or (very plausible for a datathon's synthetic seed data) CaseStatusID was
assigned independently of these attributes when the dataset was
generated. Real improvement would need either fundamentally different
signal (chargesheet content, evidence strength, court-stage data -- none
of which exist in this schema) or accepting that "conviction risk" isn't
a learnable target on this data and repositioning the feature (e.g. as a
transparent RECIDIVISM/case-load indicator instead of a probability
claim). Nothing here should be re-attempted as a quick retrain -- the
ceiling is data, not modeling technique.
"""
import os
import numpy as np
import pandas as pd
import joblib
import requests
from sklearn.preprocessing import LabelEncoder
from sklearn.model_selection import train_test_split
from sklearn.calibration import CalibratedClassifierCV
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
    """Keyset (seek) pagination -- see train_risk_model.py's docstring for
    why offset pagination is unreliable on this ZCQL deployment."""
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
            if kv in seen:
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

print("Counting accused/victims per case, and each accused's name for a prior-offense feature...")
acc_count, vic_count = {}, {}
name_to_cases: dict = {}   # AccusedName -> set of CaseMasterIDs they appear in
case_to_names: dict = {}   # CaseMasterID -> list of AccusedNames on that case
for r in fetch_all("ROWID, CaseMasterID, AccusedName", "Accused", "ROWID"):
    a = r.get("Accused", {})
    cid = a.get("CaseMasterID")
    if cid is None:
        continue
    cid = int(cid)
    acc_count[cid] = acc_count.get(cid, 0) + 1
    name = (a.get("AccusedName") or "").strip()
    if name:
        name_to_cases.setdefault(name, set()).add(cid)
        case_to_names.setdefault(cid, []).append(name)
for r in fetch_all("ROWID, CaseMasterID", "Victim", "ROWID"):
    cid = r.get("Victim", {}).get("CaseMasterID")
    if cid is not None:
        vic_count[int(cid)] = vic_count.get(int(cid), 0) + 1


def prior_offense_count(cid: int) -> int:
    """Real, new feature (Item 27 attempt): the MAX, over every accused
    person named on this case, of how many OTHER cases (by CaseMasterID)
    that same AccusedName also appears on. A genuine repeat-offender
    signal, distinct from the existing 8 features (none of which reference
    the accused's own history at all) -- criminologically, a repeat
    offender is plausibly more likely to be convicted (established MO,
    prior evidence-gathering experience by the investigating unit).
    CaseMasterID collisions (documented elsewhere: ~2.6 genuinely different
    cases share each value on average) add noise to this signal but don't
    invalidate it -- the honest held-out Brier score below is the real
    arbiter, not this reasoning alone.
    """
    names = case_to_names.get(cid) or []
    if not names:
        return 0
    return max((len(name_to_cases.get(n, set())) - 1 for n in names), default=0)

print("Pulling CaseMaster...")
cases = fetch_all("ROWID, CaseMasterID, PoliceStationID, CrimeMajorHeadID, CaseCategoryID, CrimeRegisteredDate, CaseStatusID", "CaseMaster", "ROWID")
print(f"  cases={len(cases)}")
CONVICTED_STATUS = 3

rows = []
for c in cases:
    cm = c.get("CaseMaster", {})
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
        "Prior Offense Count": prior_offense_count(cid),
        "label": 1 if (status is not None and int(status) == CONVICTED_STATUS) else 0,
    })

df = pd.DataFrame(rows)
pos_rate = 100 * df["label"].mean()
print(f"Training rows={len(df)} | positive(CONVICTED)={int(df['label'].sum())} ({pos_rate:.1f}%)")
assert 28 <= pos_rate <= 42, f"Label rate {pos_rate:.1f}% off the verified ~34.8% base rate -- aborting."
assert abs(len(df) - 20984) <= 5, f"Row count {len(df)} != ~20984 -- fetch incomplete."

encoders = {}
for col in ["District_Name", "UnitName", "CrimeGroup_Name", "FIR_Type"]:
    le = LabelEncoder()
    df[col + "_enc"] = le.fit_transform(df[col].astype(str))
    encoders[col] = le

df["month_sin"] = np.sin(2 * np.pi * df["month"] / 12.0)
df["month_cos"] = np.cos(2 * np.pi * df["month"] / 12.0)
df["day_sin"] = np.sin(2 * np.pi * df["day"] / 31.0)
df["day_cos"] = np.cos(2 * np.pi * df["day"] / 31.0)
df["victim_to_accused_ratio"] = df["VICTIM COUNT"] / (df["Accused Count"] + 1.0)
df["FIR_YEAR"] = 0  # neutralize the temporal leak, same as train_risk_model.py

FEATURES = ["District_Name_enc", "UnitName_enc", "CrimeGroup_Name_enc", "FIR_Type_enc",
            "FIR_YEAR", "month_sin", "month_cos", "day_sin", "day_cos",
            "VICTIM COUNT", "Accused Count", "victim_to_accused_ratio", "Prior Offense Count"]
INFER_COLS = ["District_Name_encoded", "UnitName_encoded", "CrimeGroup_Name_encoded", "FIR_Type_encoded",
              "FIR_YEAR", "month_sin", "month_cos", "day_sin", "day_cos",
              "VICTIM COUNT", "Accused Count", "victim_to_accused_ratio", "prior_offense_count"]
X = df[FEATURES].copy()
X.columns = INFER_COLS
y = df["label"].values

# HONEST held-out split -- every reported metric below is computed ONLY on
# X_test/y_test, which neither the base model nor the calibrator ever see
# during fitting. Stratified so the 34.8% base rate holds in both halves.
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.25, stratify=y, random_state=42)
print(f"\nTrain={len(X_train)} Test={len(X_test)} (held out, untouched until final scoring)")


def brier_ece(p, y_true, label):
    p = np.asarray(p)
    brier = float(np.mean((p - y_true) ** 2))
    edges = np.linspace(0, 1, 11)
    ece = 0.0
    for i in range(10):
        lo, hi = edges[i], edges[i + 1]
        m = (p >= lo) & (p < hi if i < 9 else p <= hi)
        n = int(m.sum())
        if n:
            ece += (n / len(p)) * abs(float(p[m].mean()) - float(y_true[m].mean()))
    print(f"  [{label}] Brier={brier:.4f}  ECE={ece*100:.2f}%  n={len(p)}")
    return brier, ece


print("\n=== Sanity check: does Prior Offense Count actually correlate with conviction? ===")
print(df.groupby(pd.cut(df["Prior Offense Count"], [-1, 0, 1, 2, 5, 1000]))["label"].agg(["mean", "count"]))

print("\n=== CANDIDATE A: current approach (scale_pos_weight) + in-sample-style isotonic ===")
pos = max(int(y_train.sum()), 1)
neg = len(y_train) - pos
model_a = XGBClassifier(n_estimators=300, max_depth=5, learning_rate=0.08, subsample=0.9,
                         colsample_bytree=0.9, scale_pos_weight=neg / pos, eval_metric="logloss", random_state=42)
model_a.fit(X_train, y_train)
brier_ece(model_a.predict_proba(X_test)[:, 1], y_test, "A: raw, no reweight-fix, TEST")

print("\n=== CANDIDATE B: no scale_pos_weight (this IS a probability task, not a ranking task) ===")
model_b = XGBClassifier(n_estimators=300, max_depth=5, learning_rate=0.08, subsample=0.9,
                         colsample_bytree=0.9, eval_metric="logloss", random_state=42)
model_b.fit(X_train, y_train)
brier_ece(model_b.predict_proba(X_test)[:, 1], y_test, "B: raw, TEST")

print("\n=== CANDIDATE C: B + CalibratedClassifierCV (isotonic, cv=5, proper out-of-fold) ===")
model_c_base = XGBClassifier(n_estimators=300, max_depth=5, learning_rate=0.08, subsample=0.9,
                              colsample_bytree=0.9, eval_metric="logloss", random_state=42)
model_c = CalibratedClassifierCV(model_c_base, method="isotonic", cv=5)
model_c.fit(X_train, y_train)
brier_ece(model_c.predict_proba(X_test)[:, 1], y_test, "C: isotonic-CV, TEST")

print("\n=== CANDIDATE D: B + CalibratedClassifierCV (sigmoid/Platt, cv=5) ===")
model_d_base = XGBClassifier(n_estimators=300, max_depth=5, learning_rate=0.08, subsample=0.9,
                              colsample_bytree=0.9, eval_metric="logloss", random_state=42)
model_d = CalibratedClassifierCV(model_d_base, method="sigmoid", cv=5)
model_d.fit(X_train, y_train)
brier_ece(model_d.predict_proba(X_test)[:, 1], y_test, "D: sigmoid-CV, TEST")

print("\n=== CANDIDATE E: shallower/simpler tree (less overfit -> often better calibrated) + isotonic-CV ===")
model_e_base = XGBClassifier(n_estimators=150, max_depth=3, learning_rate=0.05, subsample=0.8,
                              colsample_bytree=0.8, eval_metric="logloss", random_state=42)
model_e = CalibratedClassifierCV(model_e_base, method="isotonic", cv=5)
model_e.fit(X_train, y_train)
brier_ece(model_e.predict_proba(X_test)[:, 1], y_test, "E: shallow+isotonic-CV, TEST")

print("\n=== Always-predict-base-rate baseline (uninformative reference point) ===")
base_p = np.full_like(y_test, y_train.mean(), dtype=float)
brier_ece(base_p, y_test, "baseline: constant base rate, TEST")

print("\n=== Feature importances (model B, raw, unweighted by calibration) ===")
imp = sorted(zip(INFER_COLS, model_b.feature_importances_), key=lambda t: -t[1])
for name, val in imp:
    print(f"  {name}: {val:.4f}")

print("\nPick whichever candidate has the lowest TEST Brier score above.")
print("Saving candidate C (isotonic-CV) and E (shallow+isotonic-CV) for comparison; "
      "re-run this script's printed numbers to choose before deploying anything.")
joblib.dump(model_c, "risk_model_candidate_C.joblib")
joblib.dump(model_e, "risk_model_candidate_E.joblib")
joblib.dump(encoders, "label_encoders.v2.joblib")
print("Done. NOTHING deployed -- inspect the printed Brier scores above and pick a winner.")
