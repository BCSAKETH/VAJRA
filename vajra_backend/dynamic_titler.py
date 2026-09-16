"""
VAJRA - Dynamic Conversation Titling

CONFIRMED LIVE GAP (2026-09-16): a new chat session's title was the
officer's own first message, hard-truncated to 40 characters -- e.g. "show
me all cases in mysuru related to theft in the la...". That's raw text, not
a title, and it regularly cuts off mid-word. This generates a short,
specific title via a bounded one-shot LLM call, with a deterministic
(truncation, same as before) fallback whenever the LLM is slow or
unavailable -- same bounded-executor pattern already used by
/api/charts/explain in main.py, and the same "never fabricate, fall back to
something derived directly from the real input" discipline as
_deterministic_chart_explanation.
"""
import logging
from concurrent.futures import ThreadPoolExecutor
from typing import Any

logger = logging.getLogger("dynamic_titler")

_TITLE_TIMEOUT_SECONDS = 4
_MAX_TITLE_LEN = 60


def _deterministic_title(first_message: str) -> str:
    text = (first_message or "").strip()
    if not text:
        return "New Conversation"
    return text[:40] + ("..." if len(text) > 40 else "")


def generate_conversation_title(first_message: str, agent_loop_instance: Any) -> str:
    """Best-effort short title (<=60 chars) for a new chat session, derived
    from its first message. `agent_loop_instance` is the shared VajraAgentLoop
    instance (main.py's module-level `agent_loop`) -- reused rather than
    building a second LLM client. Never blocks session creation more than
    _TITLE_TIMEOUT_SECONDS, and never fabricates a title unrelated to what
    the officer actually typed: on any failure this returns the same plain
    truncation the caller would have used before this module existed."""
    text = (first_message or "").strip()
    fallback = _deterministic_title(text)
    if not text or agent_loop_instance is None:
        return fallback
    try:
        from agent_loop import VajraAgentLoop
        prompt = (
            f"Officer's message: \"{text[:400]}\"\n\n"
            f"Write a short, specific chat title (max 6 words, no quotes, no trailing "
            f"punctuation) summarizing what this conversation is about. Output ONLY the title, "
            f"nothing else."
        )
        with ThreadPoolExecutor(max_workers=1) as ex:
            res = ex.submit(
                agent_loop_instance.llm.chat, [{"role": "user", "content": prompt}], None, False, 40
            ).result(timeout=_TITLE_TIMEOUT_SECONDS)
        content = (res.get("choices") or [{}])[0].get("message", {}).get("content", "") or ""
        title = VajraAgentLoop._strip_think(content).strip().strip('"').strip("'").strip()
        # Sanity bounds -- a real short title, not empty/huge/instruction-echo/multi-line.
        if title and 2 <= len(title) <= _MAX_TITLE_LEN and "\n" not in title:
            return title
    except Exception as e:
        logger.debug(f"generate_conversation_title: LLM path failed, using deterministic fallback: {e}")
    return fallback
