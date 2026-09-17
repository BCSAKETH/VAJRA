"""
Vajra-Vak mascot flavor text (Section 145-148). Deterministic and local --
no LLM call for a one-line cosmetic quip (matching this codebase's own
preference for a fast, free, always-available deterministic path over an
expensive model call for anything that doesn't need real reasoning; see
GreetingHeader.tsx's own time-bucketed pool for the same pattern on the
frontend side).
"""
import random
from datetime import datetime
from typing import Dict, List

# Shift-aware: Karnataka Police runs 3 nominal shifts (day/evening/night).
# Station humor, never operationally sensitive content.
_QUIP_POOL: Dict[str, Dict[str, List[str]]] = {
    "en": {
        "day": [
            "Eyes on the beat, always.",
            "Day shift -- coffee's optional, vigilance isn't.",
            "Another clean morning roll call.",
        ],
        "evening": [
            "Evening watch. Streetlights on, radar on.",
            "The city's getting louder -- so am I.",
        ],
        "night": [
            "Night shift. I don't blink much, but I do.",
            "Quiet station, busy radar.",
            "Working the graveyard shift with you, Officer.",
        ],
    },
    "kn": {
        "day": ["ಕಣ್ಣು ಕಾವಲಿನಲ್ಲಿ, ಯಾವಾಗಲೂ.", "ಹಗಲು ಪಾಳಿ -- ಜಾಗರೂಕತೆ ಕಡ್ಡಾಯ."],
        "evening": ["ಸಂಜೆ ಕಾವಲು. ದೀಪಗಳು ಆನ್, ರೇಡಾರ್ ಆನ್."],
        "night": ["ರಾತ್ರಿ ಪಾಳಿ. ಶಾಂತ ಠಾಣೆ, ಸಕ್ರಿಯ ರೇಡಾರ್."],
    },
}


def _shift_bucket(hour: int) -> str:
    if hour < 8:
        return "night"
    if hour < 20:
        return "day"
    return "evening"


def get_contextual_quip(lang: str = "en") -> str:
    lang_key = lang if lang in _QUIP_POOL else "en"
    bucket = _shift_bucket(datetime.now().hour)
    pool = _QUIP_POOL[lang_key][bucket]
    return random.choice(pool)
