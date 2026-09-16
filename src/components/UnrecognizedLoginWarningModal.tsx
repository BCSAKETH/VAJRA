import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ShieldAlert, Lock, ShieldCheck } from "lucide-react";
import { useApp } from "../AppContext";
import { API_BASE } from "../config";

interface SecurityIncident {
  rowid: number;
  requester_badge: string;
  officer_name?: string | null;
  officer_unit?: string | null;
  officer_rank?: string | null;
  incident_id: string;
  reported_ip: string;
  reported_device?: string | null;
  officer_statement?: string | null;
  reported_at?: string;
  trigger_time?: string;
  alert_type: string;
}

// Finals-part 3.md Section 97: a supervisor previously only saw an
// unrecognized-login/account-lockout report if they happened to check the
// Supervisor Dashboard's Security tab -- no interrupt, no matter how
// critical. This polls globally (mounted once in App.tsx, gated to
// role_tier === "supervisor", regardless of which screen is open) and
// throws up a full-screen, un-dismissible takeover the moment a NEW
// unread UNAUTHORIZED_LOGOUT_ALERT-type incident appears.
//
// CONFIRMED SCOPING (real WebSocket-by-identity broadcast doesn't exist in
// this codebase -- ConnectionManager is keyed by chat session_id, not by
// officer/role identity, so there is no existing channel to push to "every
// active supervisor" regardless of which chat they're viewing): this uses
// the same 5s-interval polling pattern SupervisorDashboardScreen.tsx
// already uses for its 5 approval queues, reusing the real
// /api/security/unrecognized-logins list this session already ships. Not
// literally real-time, but interrupts within ~5s -- the practical
// difference from a socket push is negligible for this workflow, and this
// avoids inventing a whole new identity-scoped connection registry.
const POLL_INTERVAL_MS = 5000;

export const UnrecognizedLoginWarningModal: React.FC = () => {
  const { lang, roleTier, isAuthenticated, addToast } = useApp();
  const [queue, setQueue] = useState<SecurityIncident[]>([]);
  const [dismissedIds, setDismissedIds] = useState<Set<number>>(new Set());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showJustification, setShowJustification] = useState(false);
  const [justification, setJustification] = useState("");
  const audioCtxRef = useRef<AudioContext | null>(null);
  const seenIdsRef = useRef<Set<number>>(new Set());

  useEffect(() => {
    if (!isAuthenticated || roleTier !== "supervisor") return;
    let cancelled = false;
    const poll = async () => {
      try {
        const r = await fetch(`${API_BASE}/api/security/unrecognized-logins`, {
          headers: { "Authorization": `Bearer ${localStorage.getItem("vajra_token") || ""}` },
        });
        if (!r.ok || cancelled) return;
        const d = await r.json();
        const pending: SecurityIncident[] = (d.pending || []).filter((p: SecurityIncident) => !dismissedIds.has(p.rowid));
        setQueue(pending);
      } catch { /* transient -- next poll retries */ }
    };
    poll();
    const iv = setInterval(poll, POLL_INTERVAL_MS);
    return () => { cancelled = true; clearInterval(iv); };
  }, [isAuthenticated, roleTier, dismissedIds]);

  const active = queue[0] || null;

  // Audible tactical alert tone (Web Audio API, no asset file) -- fires
  // once per NEWLY-seen incident, not on every poll tick or re-render.
  useEffect(() => {
    if (!active || seenIdsRef.current.has(active.rowid)) return;
    seenIdsRef.current.add(active.rowid);
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = audioCtxRef.current || new AudioCtx();
      audioCtxRef.current = ctx;
      [880, 660, 880].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "square";
        osc.frequency.value = freq;
        gain.gain.value = 0.06;
        osc.connect(gain);
        gain.connect(ctx.destination);
        const start = ctx.currentTime + i * 0.22;
        osc.start(start);
        osc.stop(start + 0.18);
      });
    } catch { /* audio is a nicety -- never block the takeover on it */ }
  }, [active]);

  if (!active) return null;

  const triage = async (action: "locked" | "escalated" | "authorized_handover") => {
    if (action === "authorized_handover" && justification.trim().length < 10) {
      setShowJustification(true);
      return;
    }
    setIsSubmitting(true);
    try {
      if (action === "locked") {
        const blockRes = await fetch(`${API_BASE}/api/supervisor/officers/${encodeURIComponent(active.requester_badge)}/block`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${localStorage.getItem("vajra_token") || ""}` },
          body: JSON.stringify({ reason: `Locked from unrecognized-login incident ${active.incident_id} (Sec 97 takeover).` }),
        });
        if (!blockRes.ok) {
          const err = await blockRes.json().catch(() => ({}));
          addToast(
            lang === "en" ? "Lock Failed" : "ಲಾಕ್ ವಿಫಲವಾಗಿದೆ",
            err.detail || (lang === "en" ? "Could not lock the account." : "ಖಾತೆಯನ್ನು ಲಾಕ್ ಮಾಡಲು ಸಾಧ್ಯವಾಗಲಿಲ್ಲ."),
            "Critical"
          );
          setIsSubmitting(false);
          return;
        }
      }
      const r = await fetch(`${API_BASE}/api/security/unrecognized-logins/${active.rowid}/dismiss`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${localStorage.getItem("vajra_token") || ""}` },
        body: JSON.stringify({ action, justification: action === "authorized_handover" ? justification.trim() : undefined }),
      });
      if (r.ok) {
        setDismissedIds((prev) => new Set(prev).add(active.rowid));
        setQueue((prev) => prev.filter((p) => p.rowid !== active.rowid));
        setJustification("");
        setShowJustification(false);
        addToast(
          action === "locked"
            ? (lang === "en" ? "Account Locked" : "ಖಾತೆ ಲಾಕ್ ಆಗಿದೆ")
            : action === "escalated"
            ? (lang === "en" ? "Escalated to Cyber Cell" : "ಸೈಬರ್ ಸೆಲ್‌ಗೆ ಉಲ್ಬಣ")
            : (lang === "en" ? "Marked as Authorized" : "ಅಧಿಕೃತ ಎಂದು ಗುರುತಿಸಲಾಗಿದೆ"),
          lang === "en" ? `Incident ${active.incident_id} triaged and logged.` : `ಘಟನೆ ${active.incident_id} ದಾಖಲಿಸಲಾಗಿದೆ.`,
          "Success"
        );
      }
    } catch { /* keep the modal up -- supervisor can retry */ } finally {
      setIsSubmitting(false);
    }
  };

  const officerLabel = active.officer_name
    ? `${active.officer_name} (KSP-${active.requester_badge})`
    : `KSP-${active.requester_badge}`;
  const reportedTime = active.reported_at || active.trigger_time;

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-stone-950/90 backdrop-blur-xl animate-fade-in"
      role="alertdialog"
      aria-modal="true"
    >
      <div className="w-full max-w-2xl bg-stone-950 border-2 border-rose-500/60 rounded-2xl shadow-[0_0_60px_rgba(225,29,72,0.25)] overflow-hidden">
        <div className="bg-rose-500/15 border-b border-rose-500/40 px-5 py-3.5 flex items-center gap-2.5">
          <ShieldAlert className="w-5 h-5 text-rose-400 shrink-0 animate-pulse" />
          <div className="min-w-0">
            <div className="text-[13px] font-black text-rose-300 uppercase tracking-wider font-mono">
              {lang === "en" ? "Critical Security Breach Alert" : "ಗಂಭೀರ ಭದ್ರತಾ ಉಲ್ಲಂಘನೆ ಎಚ್ಚರಿಕೆ"}
            </div>
            <div className="text-[10.5px] text-rose-400/80 font-mono">
              {lang === "en" ? "Incident Reference" : "ಘಟನೆ ಉಲ್ಲೇಖ"}: {active.incident_id}
            </div>
          </div>
        </div>

        <div className="p-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 font-mono text-[11px]">
            <div className="bg-stone-900/60 border border-stone-800 rounded-lg p-3 space-y-1">
              <div className="text-[9.5px] font-bold text-stone-500 uppercase tracking-wide mb-1.5">
                {lang === "en" ? "Victim Officer Particulars" : "ಬಲಿಪಶು ಅಧಿಕಾರಿ ವಿವರ"}
              </div>
              <div className="text-stone-200 font-bold">{officerLabel}</div>
              {active.officer_unit && <div className="text-stone-400">{active.officer_unit}</div>}
              {active.officer_rank && <div className="text-stone-500">{active.officer_rank}</div>}
            </div>
            <div className="bg-stone-900/60 border border-stone-800 rounded-lg p-3 space-y-1">
              <div className="text-[9.5px] font-bold text-stone-500 uppercase tracking-wide mb-1.5">
                {lang === "en" ? "Rogue Terminal Telemetry" : "ಅಪರಿಚಿತ ಟರ್ಮಿನಲ್ ವಿವರ"}
              </div>
              <div className="text-stone-200">{lang === "en" ? "IP" : "ಐಪಿ"}: <span className="font-bold">{active.reported_ip || "—"}</span></div>
              {active.reported_device && <div className="text-stone-400 truncate" title={active.reported_device}>{active.reported_device}</div>}
              {reportedTime && <div className="text-stone-500">{new Date(reportedTime).toLocaleString()}</div>}
            </div>
          </div>

          {active.officer_statement && (
            <div className="bg-stone-900/40 border border-stone-800 rounded-lg p-3">
              <div className="text-[9.5px] font-bold text-stone-500 uppercase tracking-wide mb-1 font-mono">
                {lang === "en" ? "Officer Incident Statement" : "ಅಧಿಕಾರಿ ಹೇಳಿಕೆ"}
              </div>
              <p className="text-[11.5px] text-stone-300 italic leading-relaxed">"{active.officer_statement}"</p>
            </div>
          )}

          {showJustification && (
            <div className="space-y-1.5">
              <label className="text-[10.5px] font-bold text-stone-400 font-mono">
                {lang === "en" ? "Justification (min 10 characters) — required to dismiss as authorized" : "ಸಮರ್ಥನೆ (ಕನಿಷ್ಠ 10 ಅಕ್ಷರಗಳು)"}
              </label>
              <textarea
                value={justification}
                onChange={(e) => setJustification(e.target.value)}
                rows={2}
                className="w-full bg-stone-900 border border-stone-700 rounded-lg px-3 py-2 text-xs text-stone-200 focus:outline-none focus:border-[#C79A4E]"
                placeholder={lang === "en" ? "e.g. Officer confirmed by phone this was a field-issued backup device." : ""}
              />
            </div>
          )}

          <div className="space-y-2 pt-1">
            <div className="text-[9.5px] font-bold text-stone-500 uppercase tracking-wide font-mono">
              {lang === "en" ? "Supervisor Triage Actions" : "ಮೇಲ್ವಿಚಾರಕ ಕ್ರಮಗಳು"}
            </div>
            <button
              onClick={() => triage("locked")}
              disabled={isSubmitting}
              className="w-full flex items-center gap-2.5 px-4 py-2.5 rounded-lg bg-rose-500/15 border border-rose-500/50 text-rose-300 hover:bg-rose-500/25 disabled:opacity-50 cursor-pointer font-bold text-[12px] font-mono transition-colors"
            >
              <Lock className="w-4 h-4 shrink-0" />
              {lang === "en" ? "Lock Officer Account & Revoke All Sessions" : "ಅಧಿಕಾರಿ ಖಾತೆ ಲಾಕ್ ಮಾಡಿ"}
            </button>
            <button
              onClick={() => triage("escalated")}
              disabled={isSubmitting}
              className="w-full flex items-center gap-2.5 px-4 py-2.5 rounded-lg bg-amber-500/10 border border-amber-500/40 text-amber-300 hover:bg-amber-500/20 disabled:opacity-50 cursor-pointer font-bold text-[12px] font-mono transition-colors"
            >
              <ShieldAlert className="w-4 h-4 shrink-0" />
              {lang === "en" ? "Acknowledge & Escalate to Cyber Cell" : "ಸೈಬರ್ ಸೆಲ್‌ಗೆ ಉಲ್ಬಣಿಸಿ"}
            </button>
            <button
              onClick={() => triage("authorized_handover")}
              disabled={isSubmitting}
              className="w-full flex items-center gap-2.5 px-4 py-2.5 rounded-lg bg-stone-800 border border-stone-700 text-stone-300 hover:bg-stone-750 disabled:opacity-50 cursor-pointer font-bold text-[12px] font-mono transition-colors"
            >
              <ShieldCheck className="w-4 h-4 shrink-0" />
              {lang === "en" ? "Dismiss as Authorized Field Handover" : "ಅಧಿಕೃತ ಹಸ್ತಾಂತರ ಎಂದು ವಜಾಗೊಳಿಸಿ"}
            </button>
          </div>

          {queue.length > 1 && (
            <div className="text-[10px] text-stone-500 font-mono text-center pt-1">
              {lang === "en" ? `${queue.length - 1} more incident(s) queued after this one` : `${queue.length - 1} ಇನ್ನಷ್ಟು ಘಟನೆಗಳು ಬಾಕಿ`}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};
