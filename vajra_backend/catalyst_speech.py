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
import logging
import requests
from typing import Optional, Tuple
from vajra_core import get_cached_access_token

logger = logging.getLogger("catalyst_speech")

_REGION = os.getenv("CATALYST_REGION", "IN")
_DOMAIN = "in" if _REGION == "IN" else "com"
_ORG_ID = os.getenv("CATALYST_ORG_ID") or os.getenv("CATALYST_PROJECT_KEY", "") or "60074806366"

_TTS_URL = f"https://api.catalyst.zoho.{_DOMAIN}/quickml/api/v1/models/zia/tts/synthesize"

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
    try:
        res = requests.post(_TTS_URL, headers=headers, json=body, timeout=45)
        if res.status_code == 200 and res.content[:4] == b"RIFF":
            return res.content, "audio/wav"
        logger.warning(f"Zia TTS failed ({res.status_code}): {res.text[:200]}")
    except Exception as e:
        logger.warning(f"Zia TTS request error: {e}")
    return None
