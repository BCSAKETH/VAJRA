"""
Zoho Catalyst Zia speech services -- real Kannada/English/Hindi text-to-speech
(and, once wired, audio-to-text). Confirmed live against the deployed Zia
QuickML NLP models:

  TTS  POST /quickml/api/v1/models/zia/tts/synthesize
       JSON in: {text, language, speaker, pitch, speed, emotion}
       -> HTTP 200, Content-Type audio/wav, raw WAV bytes (RIFF), plus an
          X-Audio-Info header. Verified: Kannada "ನಮಸ್ಕಾರ ಅಧಿಕಾರಿ" -> 76KB WAV,
          speaker "Anu", 24kHz.

This replaces the browser SpeechSynthesis path for Kannada, which mispronounced
Kannada whenever no Kannada voice was installed on the device (device-dependent,
often silent-garbage). Zia TTS is server-side and language-correct.
"""
import os
import re
import logging
import requests
from typing import Optional, Tuple
from vajra_core import get_cached_access_token

logger = logging.getLogger("catalyst_speech")

_REGION = os.getenv("CATALYST_REGION", "IN")
_DOMAIN = "in" if _REGION == "IN" else "com"
_ORG_ID = os.getenv("CATALYST_ORG_ID") or os.getenv("CATALYST_PROJECT_KEY", "") or "60074806366"

_TTS_URL = f"https://api.catalyst.zoho.{_DOMAIN}/quickml/api/v1/models/zia/tts/synthesize"
_STT_URL = f"https://api.catalyst.zoho.{_DOMAIN}/quickml/api/v1/models/zia/audio/transcribe"

# Default female speaker per supported language (from the model's Speaker list).
# Female chosen for consistency; swappable later if an officer preference is added.
_SPEAKER_BY_LANG = {"en": "Anna", "kn": "Anu", "hi": "Divya"}
_SUPPORTED = {"en", "kn", "hi"}
_MAX_TTS_CHARS = 4800  # model limit is 5000; leave headroom


def synthesize_speech(text: str, lang: str = "en") -> Optional[Tuple[bytes, str]]:
    """
    Turn text into spoken WAV audio via Zia TTS. Returns (wav_bytes, "audio/wav")
    on success, or None on any failure (caller should fall back to browser TTS
    or just skip playback -- never surface a hard error for an optional feature).
    """
    if not text or not text.strip():
        return None
    lang = lang if lang in _SUPPORTED else "en"
    token = get_cached_access_token()
    if not token:
        logger.warning("TTS skipped: no Catalyst access token.")
        return None
    body = {
        "text": text.strip()[:_MAX_TTS_CHARS],
        "language": lang,
        "speaker": _SPEAKER_BY_LANG.get(lang, "Anna"),
        "pitch": "moderate",
        "speed": "moderate",
        "emotion": "neutral",
    }
    headers = {
        "CATALYST-ORG": _ORG_ID,
        "Authorization": f"Zoho-oauthtoken {token}",
        "Content-Type": "application/json",
    }
    # Zia TTS flaps intermittently (502/500) even when the model is healthy --
    # confirmed live that the SAME request 502s then succeeds seconds later, for
    # both English and Kannada. A single immediate retry catches most of these
    # transient failures so the officer actually hears the answer instead of the
    # browser-voice fallback (which mispronounces Kannada). Two attempts x 12s
    # stays under the AppSail ~30s request kill.
    for attempt in range(2):
        try:
            res = requests.post(_TTS_URL, headers=headers, json=body, timeout=12)
            if res.status_code == 200 and res.content[:4] == b"RIFF":
                return res.content, "audio/wav"
            logger.warning(f"Zia TTS failed (attempt {attempt + 1}, {res.status_code}): {res.text[:200]}")
        except Exception as e:
            logger.warning(f"Zia TTS request error (attempt {attempt + 1}): {e}")
    return None


def _looks_degenerate(text: str) -> bool:
    """
    Detect a runaway STT repetition-loop hallucination (e.g. "the one who is the
    one who is ..." repeated dozens of times) so it can be discarded rather than
    pasted into the composer. Two cheap signals: (1) a very low unique-word ratio
    over a long transcript, and (2) a short phrase that repeats far more than any
    natural sentence would. Short, genuinely varied transcripts always pass.
    """
    if not text:
        return False
    words = text.split()
    if len(words) < 12:
        return False  # too short to judge; let it through
    lowered = [w.lower() for w in words]
    unique_ratio = len(set(lowered)) / len(lowered)
    if unique_ratio < 0.22:
        return True
    # Most-frequent 3-gram: a natural sentence rarely repeats one 3-word phrase
    # more than a handful of times; a loop repeats it dozens.
    from collections import Counter
    trigrams = Counter(tuple(lowered[i:i + 3]) for i in range(len(lowered) - 2))
    if trigrams:
        top_count = trigrams.most_common(1)[0][1]
        if top_count >= 8 and top_count / max(1, len(lowered) - 2) > 0.25:
            return True
    return False


# Frequent English tokens (function words + common VAJRA query words). Used to
# tell whether an utterance was actually English: a genuine English sentence is
# dense with these, whereas Kannada speech force-decoded as English comes back as
# transliteration ("Vijayapuradalli aparadha...") almost devoid of them.
_EN_COMMON = {
    "the", "a", "an", "is", "are", "was", "were", "of", "to", "in", "on", "at", "for", "and",
    "or", "with", "from", "by", "this", "that", "these", "those", "it", "i", "you", "me", "my",
    "we", "who", "what", "where", "when", "why", "how", "which", "many", "much", "show", "list",
    "give", "tell", "find", "get", "all", "most", "any", "some", "recent", "crime", "crimes",
    "case", "cases", "hotspot", "hotspots", "network", "risk", "suspect", "suspects", "offender",
    "offenders", "repeat", "district", "districts", "police", "station", "report", "connected",
    "related", "between", "about", "please", "map", "plot", "over", "last", "days", "profile",
}


def detect_spoken_language(text_en: Optional[str], text_kn: Optional[str]) -> tuple:
    """
    Given the SAME audio transcribed under both "en" and "kn", decide which
    language was actually spoken and return (best_text, detected_lang). Zia STT
    has no auto-detect (language is mandatory), so the mic runs both and this
    picks. Degenerate loops (already filtered to None by transcribe_audio) and
    empties drop out first; when both look valid, the English candidate's density
    of real English words is the discriminator.
    """
    en_ok = bool(text_en and text_en.strip())
    kn_ok = bool(text_kn and text_kn.strip())
    if en_ok and not kn_ok:
        return text_en, "en"
    if kn_ok and not en_ok:
        return text_kn, "kn"
    if not en_ok and not kn_ok:
        return None, None
    toks = re.findall(r"[a-zA-Z]+", (text_en or "").lower())
    if not toks:
        return text_kn, "kn"
    hits = sum(1 for t in toks if t in _EN_COMMON)
    if hits >= 2 or (hits / len(toks)) >= 0.34:
        return text_en, "en"
    return text_kn, "kn"


def transcribe_audio(audio_bytes: bytes, filename: str, content_type: str, lang: str = "en") -> Optional[str]:
    """
    Turn recorded audio into text via Zia STT (Audio-to-Text). Contract
    confirmed live (round-trip TTS->STT returned the exact Kannada input):
    multipart/form-data with `file` (the audio) + `language` -> JSON
    {"status","language","text","processing_time_ms"}. Returns the transcript
    string, or None on any failure (caller falls back to the browser
    recognizer). Real Kannada accuracy the browser Web Speech API can't match.
    """
    if not audio_bytes:
        return None
    lang = lang if lang in _SUPPORTED else "en"
    token = get_cached_access_token()
    if not token:
        logger.warning("STT skipped: no Catalyst access token.")
        return None
    headers = {"CATALYST-ORG": _ORG_ID, "Authorization": f"Zoho-oauthtoken {token}"}
    try:
        res = requests.post(
            _STT_URL, headers=headers,
            files={"file": (filename or "speech.wav", audio_bytes, content_type or "audio/wav")},
            data={"language": lang}, timeout=25,  # under AppSail ~30s kill -> graceful None instead of hard 408
        )
        if res.status_code == 200:
            data = res.json()
            if data.get("status") == "success":
                text = data.get("text") or ""
                if _looks_degenerate(text):
                    # A Whisper-style STT fed language-mismatched or low-energy
                    # audio can collapse into a runaway repetition loop ("the one
                    # who is the one who is ..." x200). Confirmed live after a
                    # Kannada utterance was decoded as English. Returning that
                    # wall of text into the composer is worse than nothing, so
                    # treat it as a failure -> the client shows the type-instead
                    # notice instead of pasting garbage.
                    logger.warning(f"STT discarded degenerate/looping transcript ({len(text)} chars, lang={lang}).")
                    return None
                return text
        logger.warning(f"Zia STT failed ({res.status_code}): {res.text[:200]}")
    except Exception as e:
        logger.warning(f"Zia STT request error: {e}")
    return None
