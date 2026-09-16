"""
VAJRA - KSP Response Tailor (Finals-part 3.md Section 48/50)

A lightweight per-turn persona classifier that tailors HOW the AI formats its
answer (brevity, table-vs-narrative, legal-citation density) to WHO is
plausibly asking, based on the query's own wording -- an SP wanting a
district status brief and a station IO wanting a full accused/FIR table ask
very differently, and a one-size-fits-all answer format serves neither well.

GROUNDING NOTE: the plan doc calls this "RoBERTa-style" -- it is not a
transformer model. It's exactly what's built below: a TF-IDF char-n-gram +
multinomial logistic regression linear probe (scikit-learn, already a real
dependency here for the offender-risk/MO models), trained on a small set of
hand-written exemplar queries per persona. That's a legitimate, fast,
genuinely-real classifier; calling it anything more than that would be
fabricating sophistication that doesn't exist, the same discipline already
applied throughout this codebase (e.g. spatiotemporal_forecast.py explicitly
rejecting the source doc's fabricated hour-of-day granularity).

This module classifies; it does NOT rewrite the model's prose itself (no
separate template-substitution "PNLG" rewrite layer here) -- the classified
persona's directive text is appended to the existing, already-tuned VOICE/
formatting system prompt in catalyst_llm.py, so the SAME model that already
writes well-formatted, non-robotic answers additionally adapts length/
structure to the persona, rather than a second layer risking mangling
already-good output.
"""

import logging
import threading
from typing import Dict, List, Tuple, Optional
from enum import Enum

logger = logging.getLogger("ksp_response_tailor")
_MODEL_LOCK = threading.Lock()


class KSPResponseStyle(str, Enum):
    EXECUTIVE_DISPATCH = "EXECUTIVE_DISPATCH"
    CCTNS_FORENSIC_LEDGER = "CCTNS_FORENSIC_LEDGER"
    BNSS_STATUTORY_AUDIT = "BNSS_STATUTORY_AUDIT"
    TACTICAL_FIELD_SOP = "TACTICAL_FIELD_SOP"
    CRIME_SYNDICATE_DOSSIER = "CRIME_SYNDICATE_DOSSIER"


STYLE_LABELS: Dict[KSPResponseStyle, str] = {
    KSPResponseStyle.EXECUTIVE_DISPATCH: "Executive Dispatch",
    KSPResponseStyle.CCTNS_FORENSIC_LEDGER: "CCTNS Forensic Ledger",
    KSPResponseStyle.BNSS_STATUTORY_AUDIT: "BNSS Statutory Audit",
    KSPResponseStyle.TACTICAL_FIELD_SOP: "Tactical Field SOP",
    KSPResponseStyle.CRIME_SYNDICATE_DOSSIER: "Crime Syndicate Dossier",
}

# Kept short (<=45 tokens each, per the plan doc's own budget) and phrased as
# an ADDITIVE refinement on top of the existing VOICE directive already in
# catalyst_llm.py, never a conflicting restatement of it.
STYLE_PROMPT_DIRECTIVES: Dict[KSPResponseStyle, str] = {
    KSPResponseStyle.EXECUTIVE_DISPATCH: (
        "ADDITIONAL FORMAT: this reads like a brief for a senior officer (SP/DCP/Range IGP). "
        "Keep it under ~180 words. Lead with the headline number/status, then at most 3 "
        "numbered action items. No accused-level table detail."
    ),
    KSPResponseStyle.CCTNS_FORENSIC_LEDGER: (
        "ADDITIONAL FORMAT: this reads like a Station Crime Register / Case Diary entry for an "
        "investigating officer. Favor a structured table of accused/FIR/bail-status detail over "
        "narrative prose where the data supports it."
    ),
    KSPResponseStyle.BNSS_STATUTORY_AUDIT: (
        "ADDITIONAL FORMAT: this is a legal/statutory question. Cite the specific BNSS/BNS/BSA "
        "section by number wherever one is grounded in the tool result, and flag any remand or "
        "chargesheet deadline explicitly."
    ),
    KSPResponseStyle.TACTICAL_FIELD_SOP: (
        "ADDITIONAL FORMAT: this is a real-time field/scene question. Lead with the single most "
        "urgent action, keep it under ~250 words, and use short numbered steps -- an officer may "
        "be reading this on a phone mid-response."
    ),
    KSPResponseStyle.CRIME_SYNDICATE_DOSSIER: (
        "ADDITIONAL FORMAT: this is an organized-crime/network question. Prioritize the "
        "hierarchy/connections structure (who links to whom) over a flat case summary."
    ),
}

# Small, hand-written exemplar set per persona -- honest about being a seed
# set, not a large labeled corpus. Good enough for a linear char-n-gram probe
# to separate 5 genuinely distinct vocabularies (legal citations vs tactical
# urgency vs executive-summary language read very differently even at this
# scale); the heuristic keyword fallback below covers the rest.
_SEED_DATA: List[Tuple[str, KSPResponseStyle]] = [
    ("Give me an executive briefing on crime rate trends in Ballari district for the SP", KSPResponseStyle.EXECUTIVE_DISPATCH),
    ("Briefing for DGP: Bengaluru City law and order status", KSPResponseStyle.EXECUTIVE_DISPATCH),
    ("High level KPI summary of unsolved commercial robberies in Belagavi range", KSPResponseStyle.EXECUTIVE_DISPATCH),
    ("Monthly overview of crime trends across Karnataka districts", KSPResponseStyle.EXECUTIVE_DISPATCH),
    ("Overall district status summary for range review", KSPResponseStyle.EXECUTIVE_DISPATCH),

    ("Show accused Devika Deshmukh previous conviction history and active warrants", KSPResponseStyle.CCTNS_FORENSIC_LEDGER),
    ("List seized property manifest and witnesses for FIR 84/2024", KSPResponseStyle.CCTNS_FORENSIC_LEDGER),
    ("Table of repeat offenders in Kalaburagi with current bail status", KSPResponseStyle.CCTNS_FORENSIC_LEDGER),
    ("Case history and chargesheet details for CR-2024-129", KSPResponseStyle.CCTNS_FORENSIC_LEDGER),
    ("Full accused roster and FIR details for this case number", KSPResponseStyle.CCTNS_FORENSIC_LEDGER),

    ("What are the mandatory arrest guidelines under BNSS section 35 for financial fraud", KSPResponseStyle.BNSS_STATUTORY_AUDIT),
    ("What is the chargesheet filing deadline under BNSS 173(2) for armed burglary", KSPResponseStyle.BNSS_STATUTORY_AUDIT),
    ("Digital evidence certificate requirements under BSA section 63", KSPResponseStyle.BNSS_STATUTORY_AUDIT),
    ("What sections apply and what is the bail eligibility here", KSPResponseStyle.BNSS_STATUTORY_AUDIT),
    ("Remand custody timeline under the new BNSS provisions", KSPResponseStyle.BNSS_STATUTORY_AUDIT),

    ("Suspect is fleeing near the railway station right now, what should patrol do", KSPResponseStyle.TACTICAL_FIELD_SOP),
    ("Immediate SOP for patrol responding to an armed robbery in progress", KSPResponseStyle.TACTICAL_FIELD_SOP),
    ("Checklist for securing a scene before forensic team arrives", KSPResponseStyle.TACTICAL_FIELD_SOP),
    ("Suspect armed and barricaded inside a house, what's the protocol", KSPResponseStyle.TACTICAL_FIELD_SOP),
    ("Hostage situation developing, immediate response steps", KSPResponseStyle.TACTICAL_FIELD_SOP),

    ("Map the syndicate structure and mule accounts for this cyber gang", KSPResponseStyle.CRIME_SYNDICATE_DOSSIER),
    ("Inter-district correlation of MO for this theft gang across districts", KSPResponseStyle.CRIME_SYNDICATE_DOSSIER),
    ("Hierarchical dossier on this kingpin and his operators", KSPResponseStyle.CRIME_SYNDICATE_DOSSIER),
    ("Network analysis of accounts linked to this financial fraud ring", KSPResponseStyle.CRIME_SYNDICATE_DOSSIER),
    ("Who are the co-accused and how are they connected across cases", KSPResponseStyle.CRIME_SYNDICATE_DOSSIER),
]

_EMERGENCY_TRIGGERS = {"armed", "fleeing", "pursuit", "sos", "in progress", "barricaded", "hostage", "firing", "active shooter"}

_HEURISTIC_KEYWORDS: List[Tuple[KSPResponseStyle, List[str]]] = [
    (KSPResponseStyle.BNSS_STATUTORY_AUDIT, ["bnss", "bns ", "bsa", "section", "legal", "bail", "remand", "chargesheet", "court"]),
    (KSPResponseStyle.EXECUTIVE_DISPATCH, ["overview", "summary", "brief", "kpi", "district status", "range review"]),
    (KSPResponseStyle.TACTICAL_FIELD_SOP, ["sop", "checklist", "scene", "patrol", "immediate", "protocol", "right now"]),
    (KSPResponseStyle.CRIME_SYNDICATE_DOSSIER, ["syndicate", "gang", "network", "mule", "hawala", "kingpin", "hierarchy"]),
]


class KSPResponseTailor:
    """Sub-millisecond persona probe. Falls back to a plain keyword
    heuristic (never a hard failure) if scikit-learn is unavailable."""

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
            labels = [q[1].value for q in _SEED_DATA]
            self.vectorizer = TfidfVectorizer(ngram_range=(1, 3), analyzer="char_wb", min_df=1, sublinear_tf=True)
            X = self.vectorizer.fit_transform(texts)
            self.classifier = LogisticRegression(C=1.0, max_iter=200, class_weight="balanced")
            self.classifier.fit(X, labels)
            self.is_trained = True
        except Exception as e:
            logger.warning(f"KSPResponseTailor: sklearn unavailable, using heuristic-only fallback: {e}")
            self.is_trained = False

    def predict_style(self, query: str) -> Tuple[KSPResponseStyle, float, str]:
        """Returns (style, confidence, prompt_directive)."""
        if not query or not query.strip():
            return KSPResponseStyle.CCTNS_FORENSIC_LEDGER, 0.0, STYLE_PROMPT_DIRECTIVES[KSPResponseStyle.CCTNS_FORENSIC_LEDGER]

        q_lower = query.lower()
        if any(trigger in q_lower for trigger in _EMERGENCY_TRIGGERS):
            return KSPResponseStyle.TACTICAL_FIELD_SOP, 1.0, STYLE_PROMPT_DIRECTIVES[KSPResponseStyle.TACTICAL_FIELD_SOP]

        if self.is_trained and self.vectorizer is not None and self.classifier is not None:
            try:
                X_q = self.vectorizer.transform([query])
                probs = self.classifier.predict_proba(X_q)[0]
                best_idx = probs.argmax()
                confidence = float(probs[best_idx])
                style = KSPResponseStyle(self.classifier.classes_[best_idx])
                # CONFIRMED (smoke-tested against real query examples): with
                # only ~5 exemplars per class, the linear probe's confidence
                # is genuinely diffuse -- clamping straight to the default
                # ledger style on low confidence threw away cases the plain
                # keyword heuristic below gets right (e.g. "district status
                # summary", "hawala syndicate"). Defer to the heuristic
                # instead of a hardcoded default; it only falls through to
                # the plain ledger default itself when NEITHER signal has an
                # opinion.
                if confidence < 0.35:
                    return self._heuristic_fallback(q_lower)
                return style, round(confidence, 3), STYLE_PROMPT_DIRECTIVES[style]
            except Exception as e:
                logger.warning(f"KSPResponseTailor inference error, falling back to heuristic: {e}")

        return self._heuristic_fallback(q_lower)

    def _heuristic_fallback(self, q_lower: str) -> Tuple[KSPResponseStyle, float, str]:
        for style, keywords in _HEURISTIC_KEYWORDS:
            if any(k in q_lower for k in keywords):
                return style, 0.6, STYLE_PROMPT_DIRECTIVES[style]
        return KSPResponseStyle.CCTNS_FORENSIC_LEDGER, 0.4, STYLE_PROMPT_DIRECTIVES[KSPResponseStyle.CCTNS_FORENSIC_LEDGER]


_INSTANCE: Optional[KSPResponseTailor] = None


def get_ksp_response_tailor() -> KSPResponseTailor:
    global _INSTANCE
    if _INSTANCE is None:
        with _MODEL_LOCK:
            if _INSTANCE is None:
                _INSTANCE = KSPResponseTailor()
    return _INSTANCE
