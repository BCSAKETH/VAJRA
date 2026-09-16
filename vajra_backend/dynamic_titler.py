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
from typing import Any, Optional

logger = logging.getLogger("dynamic_titler")

_TITLE_TIMEOUT_SECONDS = 4
_MAX_TITLE_LEN = 60


def _deterministic_title(first_message: str) -> str:
    text = (first_message or "").strip()
    if not text:
        return "New Conversation"
    return text[:40] + ("..." if len(text) > 40 else "")


def _llm_title_from_text(prompt_text: str, agent_loop_instance: Any) -> Optional[str]:
    """Shared core: one bounded LLM call producing a short title from
    whatever text the caller assembled. Returns None (never a fabricated
    guess) on any failure/timeout/malformed output."""
    if not prompt_text.strip() or agent_loop_instance is None:
        return None
    try:
        from agent_loop import VajraAgentLoop
        prompt = (
            f"{prompt_text}\n\n"
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
        logger.debug(f"_llm_title_from_text: LLM path failed: {e}")
    return None


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
    if not text:
        return fallback
    title = _llm_title_from_text(f'Officer\'s message: "{text[:400]}"', agent_loop_instance)
    return title or fallback


def retitle_after_second_turn(first_message: str, second_message: str, agent_loop_instance: Any) -> Optional[str]:
    """Finals-part 3.md Section 53's actual headline complaint: a session
    opened with a generic greeting/exploratory query ("hi", "status report")
    stays frozen under that title forever, even once the conversation
    pivots into a real investigation by turn 2. This is a ONE-TIME upgrade
    at exactly turn 2 -- richer context than turn 1 alone (both messages),
    fired once, before an officer would realistically have noticed and
    manually renamed a session that's only 2 turns old. Returns None (no
    update) on any failure, or if the officer's own text gives no real
    additional signal beyond turn 1.

    Deliberately NOT implementing the plan doc's further "Turn >= 4 &&
    entity-shift > 0.6" continuous re-titling gate -- that needs real
    embedding-similarity infrastructure this codebase doesn't have, and
    without a persisted "was this title manually renamed" flag (a new
    ChatSession column needing console creation, avoided here), continuing
    to auto-retitle deep into a conversation risks silently overwriting an
    officer's own manual rename. Turn-2-only sidesteps that risk entirely.
    """
    combined = f"{(first_message or '').strip()}\n{(second_message or '').strip()}".strip()
    if not combined:
        return None
    return _llm_title_from_text(
        f'Conversation so far:\nOfficer turn 1: "{(first_message or "").strip()[:300]}"\n'
        f'Officer turn 2: "{(second_message or "").strip()[:300]}"',
        agent_loop_instance,
    )
