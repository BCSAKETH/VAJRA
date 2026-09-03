"""
Live-progress ticker backing store (Part C item #8, honestly scoped).

The chat pipeline is async by necessity on this platform (AppSail kills any
request at ~30-36s; GLM turns run 3-140s -- see _run_ai_turn_and_persist in
main.py), so the frontend has always had to blindly poll for the final
answer with zero visibility into what's actually happening in between. This
module is the minimal, real mechanism behind a live SSE ticker: a small
in-memory per-session log of short status strings, appended to from inside
the agent loop as it actually reaches each real step (tool selection, a
specific tool running, final synthesis) -- never fabricated busywork text,
and never asserting a specific latency number (the CTO review flagged
"<16ms/<30ms/<80ms" in the original plan as asserted, not measured; this
avoids that mistake entirely by only ever emitting what step is happening,
not how fast).

Threading note: emit() is called from the worker thread the agent loop runs
on (main.py hands it to run_in_threadpool); the SSE endpoint reads it from
the asyncio event loop. A plain threading.Lock is correct here, not an
asyncio.Lock, since writer and reader are on different execution contexts.
"""
import threading
import time
from typing import Dict, List, Tuple

_lock = threading.Lock()
_events: Dict[str, List[Tuple[float, str]]] = {}
_done: Dict[str, bool] = {}
_MAX_AGE_SECONDS = 600  # stale-session cleanup ceiling


def start_turn(session_id: str) -> None:
    """Call once at the start of a turn -- resets any stale progress from a
    previous turn in the same session so the ticker never shows old steps."""
    with _lock:
        _events[session_id] = []
        _done[session_id] = False


def emit(session_id: str, message: str) -> None:
    """Record one real step. Silently no-ops if start_turn was never called
    for this session (e.g. a code path that doesn't wire progress_cb through)
    -- the ticker is a UX nicety, never a hard dependency of the turn itself."""
    with _lock:
        if session_id in _events:
            _events[session_id].append((time.time(), message))


def finish_turn(session_id: str) -> None:
    with _lock:
        _done[session_id] = True


def get_since(session_id: str, since_idx: int) -> Tuple[List[str], bool, int]:
    """Returns (new_messages, is_done, new_total_count) -- callers pass back
    new_total_count as since_idx on their next poll."""
    with _lock:
        events = _events.get(session_id, [])
        new = [m for (_, m) in events[since_idx:]]
        done = _done.get(session_id, True)  # unknown session = nothing to stream, treat as done
        return new, done, len(events)


def cleanup_stale() -> None:
    """Best-effort sweep so a long-running process doesn't accumulate an
    unbounded number of finished sessions' progress logs in memory."""
    cutoff = time.time() - _MAX_AGE_SECONDS
    with _lock:
        stale = [sid for sid, evs in _events.items() if evs and evs[-1][0] < cutoff]
        for sid in stale:
            _events.pop(sid, None)
            _done.pop(sid, None)
