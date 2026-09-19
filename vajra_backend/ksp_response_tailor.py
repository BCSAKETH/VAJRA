"""
VAJRA - KSP Investigative Intent & Response Tailor
===================================================
A lightweight per-turn intent classifier that maps incoming officer queries to
investigative intent (Dossier, Crime Stats, Financial Fraud, Statutory Legal, Hotspots)
and selects the appropriate sparse recipe for the 28-Block PNLG Engine.

Eliminates artificial persona roleplaying, enforcing a single disciplined KSP
colleague register with uniform "Officer" address.
"""

import logging
import threading
from typing import Dict, List, Tuple, Optional
from enum import Enum

logger = logging.getLogger("ksp_response_tailor")
_MODEL_LOCK = threading.Lock()


class KSPResponseStyle(str, Enum):
    # Kept as clean aliases for backward compatibility with existing callers
    EXECUTIVE_DISPATCH = "CRIME_STATS"
    CCTNS_FORENSIC_LEDGER = "DOSSIER"
    BNSS_STATUTORY_AUDIT = "STATUTORY_LEGAL"
    TACTICAL_FIELD_SOP = "TACTICAL_ACTION"
    CRIME_SYNDICATE_DOSSIER = "SYNDICATE_NETWORK"


# Canonical Investigative Intents mapping directly to PNLG Sparse Recipes
INVESTIGATIVE_INTENTS = [
    "DOSSIER",
    "CRIME_STATS",
    "SPATIAL_HOTSPOTS",
    "STATUTORY_LEGAL",
    "FINANCIAL_FRAUD",
    "SYNDICATE_NETWORK",
    "VEHICLE_LOOKOUT",
    "GENERAL_INQUIRY",
]

STYLE_LABELS: Dict[KSPResponseStyle, str] = {
    KSPResponseStyle.EXECUTIVE_DISPATCH: "Crime Statistics & Overview",
    KSPResponseStyle.CCTNS_FORENSIC_LEDGER: "Forensic Dossier",
    KSPResponseStyle.BNSS_STATUTORY_AUDIT: "Statutory & Legal Audit",
    KSPResponseStyle.TACTICAL_FIELD_SOP: "Field Action SOP",
    KSPResponseStyle.CRIME_SYNDICATE_DOSSIER: "Syndicate Network Intelligence",
}

# Unified KSP Colleague Directive (Zero-Fluff, Uniform "Officer" Address)
UNIFIED_COLLEAGUE_DIRECTIVE = (
    "VOICE: Senior Karnataka Police Intelligence Colleague. "
    "Address the user strictly as 'Officer'. Never use personal gender pronouns (he/she). "
    "Refer to suspects and victims strictly by their legal designations ('Accused {Name}', 'The complainant'). "
    "Zero conversational pleasantries. High factual density with bold key headers."
)

STYLE_PROMPT_DIRECTIVES: Dict[KSPResponseStyle, str] = {
    KSPResponseStyle.EXECUTIVE_DISPATCH: UNIFIED_COLLEAGUE_DIRECTIVE,
    KSPResponseStyle.CCTNS_FORENSIC_LEDGER: UNIFIED_COLLEAGUE_DIRECTIVE,
    KSPResponseStyle.BNSS_STATUTORY_AUDIT: UNIFIED_COLLEAGUE_DIRECTIVE,
    KSPResponseStyle.TACTICAL_FIELD_SOP: UNIFIED_COLLEAGUE_DIRECTIVE,
    KSPResponseStyle.CRIME_SYNDICATE_DOSSIER: UNIFIED_COLLEAGUE_DIRECTIVE,
}

_SEED_DATA: List[Tuple[str, str]] = [
    ("Give me an executive briefing on crime rate trends in Ballari district", "CRIME_STATS"),
    ("Briefing on Bengaluru City law and order status and statistics", "CRIME_STATS"),
    ("High level summary of unsolved commercial robberies in Belagavi range", "CRIME_STATS"),
    ("Monthly overview of crime trends across Karnataka districts", "CRIME_STATS"),
    ("What are the top crimes in Mysuru district", "CRIME_STATS"),

    ("Show accused Devika Deshmukh previous conviction history and active warrants", "DOSSIER"),
    ("List seized property manifest and witnesses for FIR 84/2024", "DOSSIER"),
    ("Table of repeat offenders in Kalaburagi with current bail status", "DOSSIER"),
    ("Case history and chargesheet details for CR-2024-129", "DOSSIER"),
    ("Full accused roster and FIR details for Muthappa Rai", "DOSSIER"),

    ("What are the mandatory arrest guidelines under BNSS section 35", "STATUTORY_LEGAL"),
    ("What is the chargesheet filing deadline under BNSS 173(2) for dacoity", "STATUTORY_LEGAL"),
    ("Digital evidence certificate requirements under BSA section 63", "STATUTORY_LEGAL"),
    ("What sections apply and what is the default bail eligibility under 187", "STATUTORY_LEGAL"),
    ("Remand custody timeline under the new BNSS provisions", "STATUTORY_LEGAL"),

    ("Map the syndicate structure and mule accounts for this cyber gang", "FINANCIAL_FRAUD"),
    ("Inter-district correlation of MO for this theft gang across districts", "SYNDICATE_NETWORK"),
    ("Hierarchical dossier on this kingpin and his operators", "SYNDICATE_NETWORK"),
    ("Network analysis of accounts linked to this financial fraud ring", "FINANCIAL_FRAUD"),
    ("Trace mule bank accounts and UPI fund diversion trail", "FINANCIAL_FRAUD"),

    ("Show crime hotspot pins and patrol clusters on the map", "SPATIAL_HOTSPOTS"),
    ("Check RTO registration and fastag toll hits for vehicle KA-01-E-1234", "VEHICLE_LOOKOUT"),
]

_HEURISTIC_INTENT_KEYWORDS: List[Tuple[str, List[str]]] = [
    ("STATUTORY_LEGAL", ["bnss", "bns ", "bsa", "section", "legal", "bail", "remand", "chargesheet", "court", "ipc"]),
    ("FINANCIAL_FRAUD", ["mule", "bank", "account", "transaction", "upi", "hawala", "fraud", "scam", "crore", "lakh"]),
    ("SYNDICATE_NETWORK", ["syndicate", "gang", "network", "associates", "co-accused", "kingpin", "hierarchy"]),
    ("SPATIAL_HOTSPOTS", ["map", "hotspot", "cluster", "coordinates", "beat", "patrol route"]),
    ("VEHICLE_LOOKOUT", ["vehicle", "car", "rto", "plate", "fastag", "chassis", "ka-", "motorcycle"]),
    ("CRIME_STATS", ["top crimes", "crime rate", "statistics", "trend", "distribution", "overview", "monthly", "volume"]),
    ("DOSSIER", ["accused", "suspect", "fir", "cr.", "cr-", "conviction", "warrant", "arrest", "history", "mo"]),
]


class KSPResponseTailor:
    """Sub-millisecond intent probe for KSP investigative queries."""

    def __init__(self):
        self.vectorizer = None
        self.classifier = None
        self.is_trained = False
        self._fit_seed()

    def _fit_seed(self):
        try:
            from sklearn.feature_extraction.text import TfidfVectorizer
            from sklearn.linear_model import LogisticRegression

            texts = [q[0] for q in _SEED_DATA]
            labels = [q[1] for q in _SEED_DATA]
            self.vectorizer = TfidfVectorizer(ngram_range=(1, 3), analyzer="char_wb", min_df=1, sublinear_tf=True)
            X = self.vectorizer.fit_transform(texts)
            self.classifier = LogisticRegression(C=1.0, max_iter=200, class_weight="balanced")
            self.classifier.fit(X, labels)
            self.is_trained = True
        except Exception as e:
            logger.warning(f"KSPResponseTailor: sklearn unavailable, using heuristic fallback: {e}")
            self.is_trained = False

    def classify_intent(self, query: str) -> str:
        """Classifies investigative intent for sparse recipe assembly."""
        if not query or not query.strip():
            return "GENERAL_INQUIRY"

        q_lower = query.lower()
        # Check heuristics first for exact keywords
        for intent, keywords in _HEURISTIC_INTENT_KEYWORDS:
            if any(k in q_lower for k in keywords):
                return intent

        if self.is_trained and self.vectorizer is not None and self.classifier is not None:
            try:
                X_q = self.vectorizer.transform([query])
                probs = self.classifier.predict_proba(X_q)[0]
                best_idx = probs.argmax()
                if probs[best_idx] >= 0.35:
                    return str(self.classifier.classes_[best_idx])
            except Exception:
                pass

        return "GENERAL_INQUIRY"

    def predict_style(self, query: str, manual_override: Optional[str] = None) -> Tuple[KSPResponseStyle, float, str]:
        """Backward-compatible wrapper returning (style, confidence, prompt_directive)."""
        intent = self.classify_intent(query)
        # Map intent to legacy enum style
        style_map = {
            "CRIME_STATS": KSPResponseStyle.EXECUTIVE_DISPATCH,
            "DOSSIER": KSPResponseStyle.CCTNS_FORENSIC_LEDGER,
            "STATUTORY_LEGAL": KSPResponseStyle.BNSS_STATUTORY_AUDIT,
            "SYNDICATE_NETWORK": KSPResponseStyle.CRIME_SYNDICATE_DOSSIER,
            "FINANCIAL_FRAUD": KSPResponseStyle.CRIME_SYNDICATE_DOSSIER,
        }
        style = style_map.get(intent, KSPResponseStyle.CCTNS_FORENSIC_LEDGER)
        return style, 0.9, UNIFIED_COLLEAGUE_DIRECTIVE


_INSTANCE: Optional[KSPResponseTailor] = None


def get_ksp_response_tailor() -> KSPResponseTailor:
    global _INSTANCE
    if _INSTANCE is None:
        with _MODEL_LOCK:
            if _INSTANCE is None:
                _INSTANCE = KSPResponseTailor()
    return _INSTANCE


def classify_investigative_intent(query: str) -> str:
    return get_ksp_response_tailor().classify_intent(query)


def is_emergency_trigger(query: str) -> bool:
    """
    Returns False: tactical emergency pursuit shortcuts are eliminated in favor of
    grounded analytical copilot responses.
    """
    return False
