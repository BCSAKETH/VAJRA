"""
Real, timestamped audio/video attachment analysis via a vendored static
ffmpeg binary (imageio_ffmpeg -- bundles an actual Linux x86_64 ffmpeg
executable directly in its wheel, no runtime download, no extra native
dependency risk beyond the binary itself).

Every public function here returns an EMPTY result (never raises past its
own boundary, never fabricates a timestamp or a description) on any
failure -- missing package, missing/non-executable binary, corrupt media,
ffmpeg timeout. Callers in main.py treat an empty result as "analysis
unavailable for this file" and fall back to the honest store-only path
that already existed before this module.
"""
import os
import re
import logging
import subprocess
import tempfile
from typing import List, Optional, Tuple

logger = logging.getLogger("av_analysis")

_ffmpeg_path_cache: Optional[str] = None
_ffmpeg_checked = False
# TEMPORARY diagnostic capture -- this deploy environment can only be
# verified live (no server-log access from the dev side), so the LAST
# duration-probe attempt's detail is captured here for main.py to attach to
# an upload response on request. Remove once ffmpeg execution is confirmed
# working end-to-end in production.
_last_debug: dict = {}


def get_last_debug() -> dict:
    return dict(_last_debug)


def get_ffmpeg_path() -> Optional[str]:
    """
    Locates the vendored ffmpeg binary. Cached after the first call (a
    missing/broken binary won't magically appear mid-process, so there's
    no value re-probing on every attachment).
    """
    global _ffmpeg_path_cache, _ffmpeg_checked
    if _ffmpeg_checked:
        return _ffmpeg_path_cache
    _ffmpeg_checked = True
    try:
        import imageio_ffmpeg
        path = imageio_ffmpeg.get_ffmpeg_exe()
        # A zip->unzip deploy round-trip via Windows tooling doesn't
        # preserve the Unix execute bit -- force it back rather than fail
        # with a silent PermissionError on first real use.
        try:
            os.chmod(path, 0o755)
        except Exception:
            pass
        if not os.path.exists(path):
            logger.warning(f"ffmpeg binary path reported but missing: {path}")
            return None
        _ffmpeg_path_cache = path
        return path
    except Exception as e:
        logger.warning(f"ffmpeg unavailable: {e}")
        return None


def get_media_duration(file_bytes: bytes, ext: str) -> Optional[float]:
    """Real duration in seconds via ffmpeg's own stderr report -- None on
    any failure (unsupported/corrupt file, ffmpeg missing, timeout)."""
    global _last_debug
    _last_debug = {}
    ffmpeg = get_ffmpeg_path()
    _last_debug["ffmpeg_path"] = ffmpeg
    if not ffmpeg:
        _last_debug["error"] = "ffmpeg_path_none"
        return None
    tmp_path = None
    try:
        with tempfile.NamedTemporaryFile(suffix=f".{ext}", delete=False) as tf:
            tf.write(file_bytes)
            tmp_path = tf.name
        proc = subprocess.run(
            [ffmpeg, "-i", tmp_path, "-f", "null", "-"],
            capture_output=True, text=True, timeout=15
        )
        _last_debug["returncode"] = proc.returncode
        _last_debug["stderr_tail"] = (proc.stderr or "")[-800:]
        m = re.search(r"Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)", proc.stderr or "")
        if m:
            h, mn, s = m.groups()
            dur = int(h) * 3600 + int(mn) * 60 + float(s)
            _last_debug["duration_parsed"] = dur
            return dur
        _last_debug["error"] = "duration_regex_no_match"
    except Exception as e:
        _last_debug["error"] = f"exception: {type(e).__name__}: {e}"
        logger.warning(f"ffmpeg duration probe failed: {e}")
    finally:
        if tmp_path:
            try:
                os.unlink(tmp_path)
            except Exception:
                pass
    return None


def extract_video_frames(file_bytes: bytes, ext: str, max_frames: int = 3) -> List[Tuple[float, bytes]]:
    """
    Up to max_frames JPEG frames spaced evenly across the video's real
    duration. Each entry is (real_timestamp_seconds, jpeg_bytes) -- never a
    guessed timestamp. Empty list on any failure.
    """
    ffmpeg = get_ffmpeg_path()
    if not ffmpeg:
        return []
    duration = get_media_duration(file_bytes, ext)
    if not duration or duration <= 0:
        duration = float(max_frames * 3)  # last-resort spacing if probing failed
    if max_frames <= 1:
        timestamps = [max(duration / 2, 0.1)]
    else:
        timestamps = [duration * (i + 1) / (max_frames + 1) for i in range(max_frames)]

    frames: List[Tuple[float, bytes]] = []
    tmp_path = None
    try:
        with tempfile.NamedTemporaryFile(suffix=f".{ext}", delete=False) as tf:
            tf.write(file_bytes)
            tmp_path = tf.name
        for ts in timestamps:
            out_path = f"{tmp_path}_{ts:.2f}.jpg"
            try:
                subprocess.run(
                    [ffmpeg, "-ss", f"{ts:.2f}", "-i", tmp_path, "-frames:v", "1", "-q:v", "3", "-y", out_path],
                    capture_output=True, timeout=15
                )
                if os.path.exists(out_path) and os.path.getsize(out_path) > 0:
                    with open(out_path, "rb") as fh:
                        frames.append((ts, fh.read()))
            except Exception as e:
                logger.warning(f"ffmpeg frame extraction at {ts:.2f}s failed: {e}")
            finally:
                if os.path.exists(out_path):
                    try:
                        os.unlink(out_path)
                    except Exception:
                        pass
    finally:
        if tmp_path:
            try:
                os.unlink(tmp_path)
            except Exception:
                pass
    return frames


def chunk_audio(file_bytes: bytes, ext: str, chunk_sec: int = 20, max_chunks: int = 3, overlap_sec: int = 0) -> List[Tuple[float, float, bytes]]:
    """
    Splits audio into up to max_chunks segments of chunk_sec seconds each,
    re-encoded to 16kHz mono WAV (the format Zia STT is confirmed to
    accept). Each entry is (real_start_sec, real_end_sec, wav_bytes) -- the
    timestamps are exactly what was cut, never estimated from the
    transcript. Empty list if the clip is too short to be worth chunking,
    or on any ffmpeg failure -- caller falls back to single-shot
    transcription of the whole file in that case.

    5.1: overlap_sec (0 by default, preserving every existing caller's exact
    prior behavior) slides each chunk's start back by that many seconds so
    consecutive chunks share a small window -- a word landing exactly on a
    hard chunk boundary is fully captured in at least one of the two
    chunks, instead of being cut in half and lost from both. The caller
    (main.py) is responsible for the overlap-dedup merge on the transcript
    side; this function only ever returns exactly what was cut, real
    timestamps, nothing estimated.
    """
    ffmpeg = get_ffmpeg_path()
    if not ffmpeg:
        return []
    duration = get_media_duration(file_bytes, ext)
    if not duration or duration <= chunk_sec * 1.5:
        return []

    stride = max(1, chunk_sec - overlap_sec)  # advance per chunk; overlap_sec >= chunk_sec would be nonsensical
    n_chunks = min(max_chunks, int(duration // stride) + 1)
    chunks: List[Tuple[float, float, bytes]] = []
    tmp_path = None
    try:
        with tempfile.NamedTemporaryFile(suffix=f".{ext}", delete=False) as tf:
            tf.write(file_bytes)
            tmp_path = tf.name
        for i in range(n_chunks):
            start = i * stride
            if start >= duration:
                break
            length = min(chunk_sec, duration - start)
            out_path = f"{tmp_path}_chunk{i}.wav"
            try:
                subprocess.run(
                    [ffmpeg, "-ss", str(start), "-t", str(length), "-i", tmp_path,
                     "-ar", "16000", "-ac", "1", "-y", out_path],
                    capture_output=True, timeout=20
                )
                if os.path.exists(out_path) and os.path.getsize(out_path) > 44:
                    with open(out_path, "rb") as fh:
                        chunks.append((start, start + length, fh.read()))
            except Exception as e:
                logger.warning(f"ffmpeg audio chunk {i} failed: {e}")
            finally:
                if os.path.exists(out_path):
                    try:
                        os.unlink(out_path)
                    except Exception:
                        pass
    finally:
        if tmp_path:
            try:
                os.unlink(tmp_path)
            except Exception:
                pass
    return chunks


def dedupe_consecutive_transcripts(transcripts: List[str], max_check_words: int = 12) -> List[str]:
    """
    5.1: consecutive audio chunks now share `overlap_sec` of real audio
    (chunk_audio above), specifically so a word landing on a hard boundary
    is fully captured in at least one chunk instead of split in half. That
    same overlap means both chunks' independent STT passes may transcribe
    the shared window twice.

    Returns a list the SAME LENGTH as the input, in the same order --
    entry 0 unchanged, every entry after it trimmed of whatever leading
    words duplicate the END of the PREVIOUS entry's ORIGINAL (untrimmed)
    text. Deliberately list-preserving, not a single merged blob: each
    segment's real start/end timestamp still applies to exactly the text
    returned for that segment, so the caller keeps a genuinely per-segment
    timestamped transcript (what the officer actually needs -- "who said
    what, when"), just without the boundary word/phrase appearing twice.

    Simple, honest word-level dedup: checks only the last/first
    `max_check_words` of each pair (the overlap is a few real seconds,
    never the bulk of a 20s+ chunk), case/punctuation-insensitive for
    finding the match only -- the kept text's original casing/punctuation
    is untouched. A failed match (no common suffix/prefix found) leaves
    that entry exactly as transcribed, same as no dedup ever ran.
    """
    if len(transcripts) <= 1:
        return list(transcripts)
    result = [transcripts[0]]
    prev_original = transcripts[0]
    for nxt in transcripts[1:]:
        prev_words = prev_original.split()
        nxt_words = nxt.split()
        tail = prev_words[-max_check_words:] if len(prev_words) > max_check_words else prev_words
        head = nxt_words[:max_check_words] if len(nxt_words) > max_check_words else nxt_words
        tail_norm = [w.lower().strip(".,!?") for w in tail]
        head_norm = [w.lower().strip(".,!?") for w in head]
        best_overlap = 0
        for n in range(min(len(tail_norm), len(head_norm)), 1, -1):
            if tail_norm[-n:] == head_norm[:n]:
                best_overlap = n
                break
        result.append(" ".join(nxt_words[best_overlap:]))
        prev_original = nxt  # compare each pair against the ORIGINAL text, not the trimmed one
    return result


def format_timestamp(seconds: float) -> str:
    """m:ss for a real, computed timestamp -- never invented."""
    seconds = max(0, int(seconds))
    return f"{seconds // 60}:{seconds % 60:02d}"
