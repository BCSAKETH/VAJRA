import os
import sys
sys.path.append("vajra_backend")
from dotenv import load_dotenv

load_dotenv(dotenv_path=os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env"))
from vajra_core import catalyst_app

print("=== TESTING ConsistencyFlags COLUMN NAMES ===")
for col in ["case_id", "CaseID", "recorded_section", "RecordedSection", "suggested_section", "SuggestedSection", "confidence_score", "ConfidenceScore", "reviewed", "Reviewed", "flagged_at", "FlaggedAt"]:
    try:
        res = catalyst_app.datastore().table("ConsistencyFlags").insert_row({col: 1 if "ID" in col or "id" in col or "reviewed" in col or "Reviewed" in col else "TEST"})
        print(f"ConsistencyFlags {col}: Success!")
    except Exception as e:
        print(f"ConsistencyFlags {col}: Failed: {e}")

print("\n=== TESTING FinancialTransaction COLUMN NAMES ===")
for col in ["sender_ref", "SenderRef", "receiver_ref", "ReceiverRef", "amount", "Amount", "txn_time", "TxnTime", "linked_case_id", "LinkedCaseID", "account_or_wallet_id", "AccountOrWalletID"]:
    try:
        res = catalyst_app.datastore().table("FinancialTransaction").insert_row({col: 100.0 if "amount" in col or "Amount" in col or "ID" in col else "TEST"})
        print(f"FinancialTransaction {col}: Success!")
    except Exception as e:
        print(f"FinancialTransaction {col}: Failed: {e}")
