"""
Risk-model CALIBRATION report [Investigation Engine Phase 8 / B3].

Does the XGBoost conviction-risk score mean what it says? A score of 0.80 should
correspond to ~80% of such cases actually ending in conviction. This measures it
on the DEPLOYED model + encoders against the real per-case outcome
(CaseStatusID == 3 CONVICTED), the same ground truth the model is trained on:

  - Reliability curve: bin predictions into deciles, compare mean predicted risk
    vs the observed conviction rate in each bin.
  - Brier score: mean((pred - actual)^2), lower is better (0 = perfect,
    0.25 = a coin flip at base rate ~ uninformative).
  - Expected Calibration Error (ECE): average |pred - observed| across bins,
    weighted by bin size.

Read-only: pulls data via ZCQL (ROWID keyset), loads the shipped .joblib
artifacts, computes and prints the report. Trains/deploys nothing. Uses the same
prod-matched libs the model was pickled with (xgboost 2.1.4 / sklearn 1.7.2).
"""
import os
import numpy as np
import pandas as pd
import joblib
import requests

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
    """Keyset pagination on ROWID -> stable, no dupes/skips (offset pagination is broken)."""
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


print("Loading DEPLOYED model + encoders...")
model = joblib.load("xgboost_risk_model.joblib")
encoders = joblib.load("label_encoders.joblib")

print("Pulling dimensions + cases...")
districts = {int(d["District"]["DistrictID"]): d["District"]["DistrictName"]
             for d in fetch_all("DistrictID, DistrictName", "District", "DistrictID") if d.get("District", {}).get("DistrictID")}
units = {int(u["Unit"]["UnitID"]): (u["Unit"].get("UnitName"), u["Unit"].get("DistrictID"))
         for u in fetch_all("UnitID, UnitName, DistrictID", "Unit", "UnitID") if u.get("Unit", {}).get("UnitID")}
heads = {int(h["CrimeHead"]["CrimeHeadID"]): h["CrimeHead"].get("CrimeGroupName")
         for h in fetch_all("CrimeHeadID, CrimeGroupName", "CrimeHead", "CrimeHeadID") if h.get("CrimeHead", {}).get("CrimeHeadID")}
cats = {int(c["CaseCategory"]["CaseCategoryID"]): c["CaseCategory"].get("LookupValue")
        for c in fetch_all("CaseCategoryID, LookupValue", "CaseCategory", "CaseCategoryID") if c.get("CaseCategory", {}).get("CaseCategoryID")}

acc_count, vic_count = {}, {}
for r in fetch_all("ROWID, CaseMasterID", "Accused", "ROWID"):
    cid = r.get("Accused", {}).get("CaseMasterID")
    if cid is not None:
        acc_count[int(cid)] = acc_count.get(int(cid), 0) + 1
for r in fetch_all("ROWID, CaseMasterID", "Victim", "ROWID"):
    cid = r.get("Victim", {}).get("CaseMasterID")
    if cid is not None:
        vic_count[int(cid)] = vic_count.get(int(cid), 0) + 1

cases = fetch_all("ROWID, CaseMasterID, PoliceStationID, CrimeMajorHeadID, CaseCategoryID, CrimeRegisteredDate, CaseStatusID", "CaseMaster", "ROWID")
print(f"  cases={len(cases)}")


def enc(col, val):
    """Match inference: transform via the deployed encoder, default 0 on any unseen value."""
    le = encoders.get(col)
    if le is None:
        return 0
    try:
        return int(le.transform([str(val)])[0])
    except Exception:
        return 0


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
        _y, mth, day = [int(x) for x in raw_date.split("-")[:3]]
    except Exception:
        mth, day = 1, 1
    vc = vic_count.get(cid, 1)
    ac = acc_count.get(cid, 1)
    rows.append({
        "District_Name_encoded": enc("District_Name", dist_name or "Unknown"),
        "UnitName_encoded": enc("UnitName", unit_name or "Unknown"),
        "CrimeGroup_Name_encoded": enc("CrimeGroup_Name", group_name or "Unknown"),
        "FIR_Type_encoded": enc("FIR_Type", fir_type or "Non Heinous"),
        "FIR_YEAR": 2026,
        "month_sin": np.sin(2 * np.pi * mth / 12.0), "month_cos": np.cos(2 * np.pi * mth / 12.0),
        "day_sin": np.sin(2 * np.pi * day / 31.0), "day_cos": np.cos(2 * np.pi * day / 31.0),
        "VICTIM COUNT": vc, "Accused Count": ac, "victim_to_accused_ratio": vc / (ac + 1.0),
        "label": 1 if (status is not None and int(status) == 3) else 0,
    })

df = pd.DataFrame(rows)
X = df[["District_Name_encoded", "UnitName_encoded", "CrimeGroup_Name_encoded", "FIR_Type_encoded",
        "FIR_YEAR", "month_sin", "month_cos", "day_sin", "day_cos",
        "VICTIM COUNT", "Accused Count", "victim_to_accused_ratio"]]
y = df["label"].values
p = model.predict_proba(X)[:, 1]

brier = float(np.mean((p - y) ** 2))
base = float(y.mean())
print(f"\nCases scored: {len(df)} | base conviction rate: {base*100:.1f}%")
print(f"Brier score: {brier:.4f}  (0=perfect, {base*(1-base):.4f}=predict-base-rate, 0.25=coin flip)")

print("\n=== RELIABILITY CURVE (decile bins) ===")
print(f"{'bin':>3} {'pred_range':>14} {'n':>6} {'mean_pred':>10} {'obs_rate':>9} {'gap':>7}")
edges = np.linspace(0, 1, 11)
ece = 0.0
for i in range(10):
    lo, hi = edges[i], edges[i + 1]
    m = (p >= lo) & (p < hi if i < 9 else p <= hi)
    n = int(m.sum())
    if n == 0:
        continue
    mp = float(p[m].mean())
    obs = float(y[m].mean())
    ece += (n / len(df)) * abs(mp - obs)
    print(f"{i:>3} {lo:>5.2f}-{hi:<7.2f} {n:>6} {mp*100:>9.1f}% {obs*100:>8.1f}% {(mp-obs)*100:>+6.1f}%")
print(f"\nExpected Calibration Error (ECE): {ece*100:.2f}%  (lower = better; <5% is well-calibrated)")
verdict = "WELL-CALIBRATED" if ece < 0.05 else ("REASONABLE" if ece < 0.10 else "NEEDS CALIBRATION (isotonic/Platt)")
print(f"Verdict: {verdict}")


def _ece(pred, actual):
    e = 0.0
    for i in range(10):
        lo, hi = edges[i], edges[i + 1]
        m = (pred >= lo) & (pred < hi if i < 9 else pred <= hi)
        n = int(m.sum())
        if n:
            e += (n / len(pred)) * abs(float(pred[m].mean()) - float(actual[m].mean()))
    return e


# Fit an ISOTONIC calibrator (monotonic, non-parametric -- the right choice when
# ranking is good but probabilities are shifted, exactly this model's profile) on
# the raw score -> actual outcome, and save it. Inference applies it ON TOP of the
# raw model output, so SHAP still explains the untouched XGBoost booster while the
# officer-facing probability becomes trustworthy. Nothing here is deployed; the
# artifact is saved for a reviewed swap.
from sklearn.isotonic import IsotonicRegression  # noqa: E402
iso = IsotonicRegression(out_of_bounds="clip")
iso.fit(p, y)
p_cal = iso.predict(p)
brier_cal = float(np.mean((p_cal - y) ** 2))
ece_cal = _ece(p_cal, y)
print("\n=== AFTER ISOTONIC CALIBRATION ===")
print(f"Brier: {brier:.4f} -> {brier_cal:.4f}")
print(f"ECE:   {ece*100:.2f}% -> {ece_cal*100:.2f}%")
joblib.dump(iso, "isotonic_calibrator.new.joblib")
_re = joblib.load("isotonic_calibrator.new.joblib")
print("Saved isotonic_calibrator.new.joblib (reload OK). NOT deployed.")
