"""
VAJRA - KSP Human Voice & Probabilistic Natural Language Generator (PNLG)
Finals-part 3.md Section 48, Engine 2 -- ksp_response_tailor.py is Engine 1
(persona classification + directive injection into the GLM system prompt).

HONESTY NOTE (matches this codebase's discipline elsewhere -- see
ksp_response_tailor.py's own docstring correcting the doc's "RoBERTa"
claim): the plan doc names this a "neuro-symbolic Template Lexicon Matrix"
with "stochastic branch selection" -- that description makes it sound like
a trained model. It is not, and this file does not pretend otherwise: it's
a deterministic, seeded template-substitution post-processor. That is
exactly what the doc's own architecture diagram actually specifies once
you read past the branding (a fixed phrase bank + a seeded pick), and it's
genuinely useful for what it's meant to fix -- GLM repeating the identical
robotic opener ("Based on the available data...") turn after turn. No
neural rewriting happens here; every transformation is a real, inspectable
string operation.

WHAT THIS DOES:
1. Strips known robotic/throat-clearing openers GLM's own system prompt
   already tries to prevent (defense in depth -- a second, independent
   check here catches anything that slips through).
2. Deterministically (SHA-256 seed over session_id+officer_badge+query,
   never true randomness -- same inputs always produce the same opener,
   so a re-generated/retried turn is reproducible, not flaky) picks one
   authentic KSP-voice opener phrase matching the officer's persona and
   language, and prepends it as a natural lead-in sentence.
3. Invariant Bracket Guard: verifies every `[XXX-YYY]`-style UI widget
   token present in the original text is STILL present afterward. Since
   this engine only ever STRIPS a leading sentence and PREPENDS a new one
   (never touches the interior of the text), this can't actually drop a
   bracket token by construction -- but the guard runs anyway as a real,
   checked invariant, not an assumed one: if it ever fails for any reason,
   the original text is returned unmodified rather than risking a broken
   frontend widget hydration.
"""
import hashlib
import logging
import random
import re
from typing import Optional

logger = logging.getLogger("ksp_pnlg_engine")

# Same 5 personas as ksp_response_tailor.py's KSPResponseStyle -- imported
# lazily inside apply_pnlg_voice to avoid a module-load-order dependency.

_ROBOTIC_OPENERS_RE = re.compile(
    r"^\s*(?:"
    r"as an ai\b[^.\n]*[.,]?\s*|"
    r"certainly!?\s*(?:here'?s?|i (?:would|can))[^.\n]*[.,]?\s*|"
    r"based on the available data,?\s*(?:it appears that)?\s*|"
    r"according to my analysis,?\s*|"
    r"i'd be happy to help[^.\n]*[.,]?\s*|"
    r"sure,?\s*(?:here'?s?|let me)[^.\n]*[.,]?\s*|"
    r"it is important to note that\s*"
    r")",
    re.IGNORECASE,
)

# Authentic KSP openers per persona, EN + KN -- drawn directly from the plan
# doc's own §32.4 examples plus natural variants in the same register.
_OPENERS = {
    "EXECUTIVE_DISPATCH": {
        "en": [
            "Sir, situation brief follows:",
            "Command summary for your review:",
            "Range status, condensed for immediate action:",
        ],
        "kn": [
            "ಸರ್, ಪರಿಸ್ಥಿತಿ ಸಂಕ್ಷಿಪ್ತ ವರದಿ:",
            "ತಕ್ಷಣದ ಕ್ರಮಕ್ಕಾಗಿ ಸಾರಾಂಶ:",
        ],
    },
    "CCTNS_FORENSIC_LEDGER": {
        "en": [
            "Reviewing the Station Crime Register records:",
            "Case Diary cross-check complete --",
            "CCTNS trace on this case:",
        ],
        "kn": [
            "ಠಾಣಾ ಅಪರಾಧ ದಾಖಲೆಗಳ ಪರಿಶೀಲನೆಯಂತೆ:",
            "ಕೇಸ್ ಡೈರಿ ಪರಿಶೀಲನೆ ಪೂರ್ಣಗೊಂಡಿದೆ --",
        ],
    },
    "BNSS_STATUTORY_AUDIT": {
        "en": [
            "For statutory/legal review:",
            "Admissibility and procedural note:",
        ],
        "kn": [
            "ಶಾಸನಬದ್ಧ ಪರಿಶೀಲನೆಗಾಗಿ:",
        ],
    },
    "TACTICAL_FIELD_SOP": {
        "en": [
            "Operational directive for field units:",
            "Immediate action brief:",
        ],
        "kn": [
            "ಕ್ಷೇತ್ರ ಸಿಬ್ಬಂದಿಗೆ ಕಾರ್ಯಾಚರಣೆ ನಿರ್ದೇಶನ:",
        ],
    },
    "CRIME_SYNDICATE_DOSSIER": {
        "en": [
            "Network intelligence dossier:",
            "Syndicate trace, cross-district:",
        ],
        "kn": [
            "ಜಾಲ ಗುಪ್ತಚರ ವರದಿ:",
        ],
    },
}

_BRACKET_TAG_RE = re.compile(r"\[[A-Z][A-Z0-9\-]{2,20}\]")

# A response this short (a plain factual one-liner, a yes/no, an empty
# result) reads WORSE with a prepended opener, not better -- skip it.
_MIN_LEN_FOR_OPENER = 60


def _extract_bracket_tags(text: str) -> set:
    return set(_BRACKET_TAG_RE.findall(text or ""))


def apply_pnlg_voice(text: str, style: str, session_id: str, officer_badge: Optional[str], query: str, lang: str = "en") -> str:
    """Engine 2 entry point. `style` is a KSPResponseStyle value string (see
    ksp_response_tailor.py). Returns the transformed text, or the original
    text unchanged on any failure/guard trip -- never raises, never risks
    losing content."""
    if not text or len(text) < _MIN_LEN_FOR_OPENER:
        return text
    try:
        original_tags = _extract_bracket_tags(text)

        stripped = _ROBOTIC_OPENERS_RE.sub("", text, count=1)
        # Re-capitalize the new first letter if the strip left a lowercase start.
        if stripped and stripped[0].islower():
            stripped = stripped[0].upper() + stripped[1:]

        openers = _OPENERS.get(style, {}).get(lang if lang in ("en", "kn") else "en")
        if not openers:
            openers = _OPENERS.get(style, {}).get("en", [])
        if not openers:
            # Unknown persona -- nothing to inject, just return the
            # throat-clearing-stripped version.
            return stripped if _extract_bracket_tags(stripped) >= original_tags else text

        # Skip injecting a second opener if the text already opens with a
        # natural officer-address phrase (avoid "Sir, Sir, ...").
        _ALREADY_NATURAL_RE = re.compile(r"^\s*(sir|ma'am|officer|ಸರ್|ಮೇಡಂ)\b", re.IGNORECASE)
        if _ALREADY_NATURAL_RE.match(stripped):
            return stripped if _extract_bracket_tags(stripped) >= original_tags else text

        seed_src = f"{session_id or ''}|{officer_badge or ''}|{(query or '').strip()}"
        seed_int = int(hashlib.sha256(seed_src.encode("utf-8")).hexdigest()[:16], 16)
        opener = random.Random(seed_int).choice(openers)

        rewritten = f"{opener} {stripped}"

        # Invariant Bracket Guard: this transformation only strips a leading
        # phrase and prepends a new one, so it cannot structurally drop a
        # bracket token -- but check the real invariant anyway rather than
        # assuming it.
        if not (_extract_bracket_tags(rewritten) >= original_tags):
            logger.warning("PNLG bracket guard tripped -- returning original text unmodified.")
            return text
        return rewritten
    except Exception as e:
        logger.warning(f"PNLG voice transform failed (non-fatal, returning original text): {e}")
        return text
