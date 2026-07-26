# Supervisor Dashboard — What It's For & How to Demo It

I can't literally record a video (no screen/audio capture in this environment), so here's a script you can read from while you record it yourself — 2-3 minutes, hits every real feature.

## What it actually is

Not a case-management or analytics view (that's the District Dashboard). This is a **data-integrity oversight console** for supervisory-rank officers: reviewing flagged legal-classification errors, and auditing/verifying the tamper-evident access log. It only shows up in the sidebar for `role_tier === "supervisor"`, and the one write action on the page (`POST /api/alerts/consistency-flags/{id}/review`) is enforced **server-side** — checked live just now: a supervisor-tier login (DySP rank) gets 200, and the check is `if request.state.role_tier != "supervisor": raise 403`, not just a hidden nav link. Non-supervisor accounts physically cannot resolve a flag even by calling the API directly.

`role_tier` is derived from the officer's real `RankID` (`derive_role_tier` in `vajra_core.py`): RankID ≥ 5 (PI and above in the seeded rank hierarchy) = supervisor, everything below = officer.

## The three real scenarios it serves

**1. Legal-classification consistency review.** The system flags cases where the recorded IPC/CrPC section looks inconsistent with the case's actual facts (a `ConsistencyFlags` table, populated by the classification-consistency check elsewhere in the pipeline). A supervisor reviews each flag and either confirms it needs correction or dismisses it as a false positive.

**2. Two-person integrity control on that review.** Resolving a flag isn't a single click — it opens `TwoPersonApprovalModal`, which requires a *second* supervisor's badge number + password (verified against real stored credentials, not just typed in) before the action goes through. The modal explicitly rejects using the same badge that's already logged in. This models a real dual-control requirement: one officer can't unilaterally clear an integrity flag.

**3. Tamper-evident audit ledger verification.** Every sensitive action gets logged to `AuditLog` with a SHA-256 hash chain (`row_hash` linked to the previous entry's `prev_hash`, genesis hash `000...0`). "Verify Ledger" doesn't just check formatting — it recomputes the whole hash chain server-side from the stored fields and reports the exact entry where it breaks, if any. This is what a supervisor would use after an incident to confirm no log entries were altered or deleted.

## Live walkthrough steps (badge 2346836 is supervisor-tier, DySP)

1. Log in as `2346836`. Sidebar shows a "Supervisor" entry — point out this literally doesn't appear for a regular officer account, then mention the *server* also enforces it (not just hidden UI).
2. Open Supervisor Dashboard. Point out the three sections: Consistency Flags, Audit Ledger, Audit Log stream.
3. Click "Verify Ledger" — show it come back valid, explain it just recomputed every hash server-side, not merely checked formatting.
4. Pick a pending consistency flag, click Resolve → the Two-Person Approval modal opens. Try entering the *same* badge you're logged in as → show the rejection. Then enter a second real supervisor badge + password → show it going through.
5. Scroll the Audit Log stream, point out every action (including the resolve you just did) is already in there with a hash.

## One honest caveat

`GET /api/audit-logs`, `GET /api/audit-logs/verify`, and `GET /api/alerts/consistency-flags` (read-only) are reachable by any authenticated officer, not gated to supervisor-only — only the *resolve* action is. That's defensible (read transparency vs. write control are different concerns) but worth stating out loud if a judge asks, rather than implying the whole page is locked down.
