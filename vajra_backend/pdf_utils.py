"""
Defensive type-normalization helpers for the PDF/HTML dossier export pipeline
(main.py's FPDF fallback cards, catalyst_smartbrowz.py's primary SmartBrowz
HTML dossier). Both engines pull semi-structured fields (shap_factors,
hotspots, domains, ...) out of `Dict[str, Any]` message content with
`data.get(key) or []` and then slice them (`factors[:4]`) to cap how much
renders per card. Pydantic's `List[Dict[str, Any]]` on the transcript's own
top level guarantees a list of dicts gets in, but says nothing about what's
INSIDE each dict's values -- a field that should be a list of factor dicts
could, in principle, arrive as a dict, an int, or a string (a synthesis
inconsistency upstream, a stale/malformed cached card, a future tool
response shape change) and `some_dict[:4]` raises `TypeError: unhashable
type: 'slice'` (the slice object's own repr is `slice(None, 4, None)`) --
hard-crashing the ENTIRE export over one malformed card field instead of
just rendering that one card without it.

CONFIRMED via direct code read (2026-09-16), not assumed: found 6 real,
currently-unguarded slice sites across both engines (3 in each) that follow
exactly this `.get(key) or []` pattern with no isinstance check before the
slice -- listed at each call site this module is used from. Not confirmed
to have actually crashed live traffic yet; hardened as a genuine, found
defensive gap, same "never let one malformed card break the whole export"
discipline this codebase already applies everywhere else in this pipeline
(citations_card's own isinstance(cit_list, list) guard, a few lines away
from two of these unguarded ones, is the proof this project already
considers the check worth having -- just missed at these sites).
"""
import logging
from typing import Any, List

logger = logging.getLogger("pdf_utils")


def safe_slice(value: Any, n: int, context: str = "") -> List[Any]:
    """
    Returns value[:n] if value is genuinely a list; otherwise degrades to a
    safe, renderable list instead of raising or silently losing the whole
    card. Never raises. A single dict is wrapped as a 1-item list (the most
    likely real-world shape mismatch: one card's worth of data where a list
    of cards was expected); any other non-list type (int, str, float, None)
    degrades to an empty list, so the card renders with that section simply
    omitted rather than crashing the export the officer is waiting on.
    """
    if isinstance(value, list):
        return value[:n]
    if isinstance(value, dict):
        logger.warning(f"safe_slice: expected a list{f' ({context})' if context else ''}, got a dict -- wrapping as a single-item list.")
        return [value][:n]
    if value:
        logger.warning(f"safe_slice: expected a list{f' ({context})' if context else ''}, got {type(value).__name__} -- degrading to empty.")
    return []
