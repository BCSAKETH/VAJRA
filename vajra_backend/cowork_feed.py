"""
Real-time Cowork message feed backing store -- the actually-working
replacement for both the dead WebSocket path and the 4-second poll.

Confirmed live: Zoho Catalyst's AppSail gateway (ZGS) does not proxy
WebSocket upgrade requests in this environment (a raw handshake against
/ws/chat/... comes back a plain HTTP 404, not 101 Switching Protocols) --
so ConnectionManager's WebSocket broadcast in main.py has never actually
reached a browser on the deployed app; the frontend fell back to polling
this session's messages every 4 seconds instead, a real but sluggish
substitute.

SSE (Server-Sent Events) is NOT a protocol upgrade -- it's a plain HTTP GET
with a chunked, long-lived response -- and this app already has independent
proof it survives the exact same gateway: GET /api/chat/progress/{id}'s
live-progress ticker (progress_tracker.py) has been working in production
all session. This module is the same pattern (in-memory per-session log,
lock-protected, polled by a short-interval generator) applied to REAL chat
messages instead of progress strings, so a genuinely instant (sub-second)
Cowork push becomes possible without needing a protocol the gateway blocks.

Threading note: publish() is called from ConnectionManager.broadcast(),
itself called from async request-handling code -- same execution context
as the SSE reader here, so this could technically use an asyncio.Lock, but
a plain threading.Lock is used anyway for consistency with progress_tracker
and because it's never actually contended long enough to matter.
"""
import threading
import time
from typing import Any, Dict, List, Tuple

_lock = threading.Lock()
_feed: Dict[str, List[Tuple[float, Dict[str, Any]]]] = {}
_MAX_PER_SESSION = 300       # ring-buffer cap -- a Cowork thread this deep in
                             # one open stream's lifetime is already unusual
_MAX_AGE_SECONDS = 3600      # stale-session cleanup ceiling


def publish(session_id: str, message: Dict[str, Any]) -> None:
    """Record one real broadcast-worthy event (a persisted chat message) for
    this session's live feed."""
    with _lock:
        lst = _feed.setdefault(session_id, [])
        lst.append((time.time(), message))
        if len(lst) > _MAX_PER_SESSION:
            del lst[: len(lst) - _MAX_PER_SESSION]


def get_since(session_id: str, since_idx: int) -> Tuple[List[Dict[str, Any]], int]:
    """Returns (new_messages, new_total_count) -- callers pass new_total_count
    back as since_idx on their next read."""
    with _lock:
        lst = _feed.get(session_id, [])
        new = [m for (_, m) in lst[since_idx:]]
        return new, len(lst)


def cleanup_stale() -> None:
    """Best-effort sweep so a long-running process doesn't accumulate
    unbounded per-session logs for threads nobody is streaming anymore."""
    cutoff = time.time() - _MAX_AGE_SECONDS
    with _lock:
        stale = [sid for sid, evs in _feed.items() if evs and evs[-1][0] < cutoff]
        for sid in stale:
            _feed.pop(sid, None)
