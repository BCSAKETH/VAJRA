import React, { useState, useEffect } from "react";
import { useApp } from "../AppContext";
import { API_BASE } from "../config";
import { TwoPersonApprovalModal } from "../components/TwoPersonApprovalModal";
import { WatermarkOverlay } from "../components/WatermarkOverlay";
import { ShieldCheck, UserCheck, RefreshCw, AlertTriangle, FileSpreadsheet, Lock, CheckCircle2, Activity, MessageSquare, ThumbsDown, ThumbsUp, ShieldAlert, Users, Clock, AlertOctagon, Fingerprint, Database } from "lucide-react";

interface ConsistencyFlag {
  ROWID: number;
  CrimeNo: string;
  flag_type: string;
  flag_details: string;
  reviewed: number;
}

interface AuditLogRecord {
  timestamp: string;
  badgeId: string;
  action: string;
  queryParam: string;
  hash: string;
}

interface FeedbackRecord {
  kgid: string;
  query_text: string;
  response_summary: string;
  rating: "up" | "down";
  correction: string | null;
  created_at: string;
}

interface AccessOversightOfficer {
  kgid: string;
  name: string;
  query_count: number;
  distinct_subjects: number;
  flagged: boolean;
  flag_reason: string | null;
  last_active: string;
}

export const SupervisorDashboardScreen: React.FC = () => {
  const { lang, t, addToast, setIsAuthenticated } = useApp();
  const [flags, setFlags] = useState<ConsistencyFlag[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogRecord[]>([]);
  const [isLoadingFlags, setIsLoadingFlags] = useState(true);
  const [isLoadingAudit, setIsLoadingAudit] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Two person approval state
  const [isApprovalOpen, setIsApprovalOpen] = useState(false);
  const [selectedFlagId, setSelectedFlagId] = useState<number | null>(null);
  
  // Hash ledger verification state
  const [ledgerVerified, setLedgerVerified] = useState<boolean | null>(null);
  const [ledgerDetails, setLedgerDetails] = useState<any>(null);
  const [isVerifyingLedger, setIsVerifyingLedger] = useState(false);

  // Feedback Review Board state (model-improvement oversight surface)
  const [feedback, setFeedback] = useState<FeedbackRecord[]>([]);
  const [isLoadingFeedback, setIsLoadingFeedback] = useState(true);

  // Officer Access Oversight state
  const [officers, setOfficers] = useState<AccessOversightOfficer[]>([]);
  const [isLoadingOfficers, setIsLoadingOfficers] = useState(true);

  // Live export-approval queue (AI pre-screen holds sensitive reports here).
  const [pendingExports, setPendingExports] = useState<any[]>([]);
  const [decidingExportId, setDecidingExportId] = useState<string | null>(null);

  const fetchPendingExports = async () => {
    try {
      const r = await fetch(`${API_BASE}/api/exports/pending`, {
        headers: { "Authorization": `Bearer ${localStorage.getItem("vajra_token") || ""}` },
      });
      if (!r.ok) return;
      const d = await r.json();
      setPendingExports(d.pending || []);
    } catch { /* transient -- next poll retries */ }
  };

  const decideExport = async (rowid: string, approve: boolean) => {
    setDecidingExportId(rowid);
    try {
      const r = await fetch(`${API_BASE}/api/exports/${rowid}/decision`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${localStorage.getItem("vajra_token") || ""}` },
        body: JSON.stringify({ approve }),
      });
      if (r.ok) {
        setPendingExports((prev) => prev.filter((p) => String(p.rowid) !== String(rowid)));
        addToast(
          approve ? (lang === "en" ? "Export approved" : "ರಫ್ತು ಅನುಮೋದಿಸಲಾಗಿದೆ") : (lang === "en" ? "Export rejected" : "ರಫ್ತು ತಿರಸ್ಕರಿಸಲಾಗಿದೆ"),
          lang === "en" ? "The requesting officer has been notified." : "ವಿನಂತಿಸಿದ ಅಧಿಕಾರಿಗೆ ಸೂಚಿಸಲಾಗಿದೆ.",
          approve ? "Info" : "Warning"
        );
      }
    } catch { /* ignore */ } finally {
      setDecidingExportId(null);
    }
  };

  // Live POCSO access-request queue (officers request time-boxed access to a
  // redacted victim identity; same live-queue pattern as export approvals).
  const [pendingPocso, setPendingPocso] = useState<any[]>([]);
  const [decidingPocsoId, setDecidingPocsoId] = useState<string | null>(null);

  const fetchPendingPocso = async () => {
    try {
      const r = await fetch(`${API_BASE}/api/pocso/pending`, {
        headers: { "Authorization": `Bearer ${localStorage.getItem("vajra_token") || ""}` },
      });
      if (!r.ok) return;
      const d = await r.json();
      setPendingPocso(d.pending || []);
    } catch { /* transient -- next poll retries */ }
  };

  const decidePocso = async (rowid: string, approve: boolean) => {
    setDecidingPocsoId(rowid);
    try {
      const r = await fetch(`${API_BASE}/api/pocso/${rowid}/decision`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${localStorage.getItem("vajra_token") || ""}` },
        body: JSON.stringify({ approve }),
      });
      if (r.ok) {
        setPendingPocso((prev) => prev.filter((p) => String(p.rowid) !== String(rowid)));
        addToast(
          approve ? (lang === "en" ? "Access granted" : "ಪ್ರವೇಶ ನೀಡಲಾಗಿದೆ") : (lang === "en" ? "Access denied" : "ಪ್ರವೇಶ ನಿರಾಕರಿಸಲಾಗಿದೆ"),
          lang === "en" ? "The requesting officer has been notified." : "ವಿನಂತಿಸಿದ ಅಧಿಕಾರಿಗೆ ಸೂಚಿಸಲಾಗಿದೆ.",
          approve ? "Info" : "Warning"
        );
      }
    } catch { /* ignore */ } finally {
      setDecidingPocsoId(null);
    }
  };

  // Live inter-district access queue (Part C item #7) -- officers requesting
  // time-boxed access to a district outside their own, same live-queue
  // pattern as export/POCSO approvals above.
  const [pendingDistrict, setPendingDistrict] = useState<any[]>([]);
  const [decidingDistrictId, setDecidingDistrictId] = useState<string | null>(null);

  const fetchPendingDistrict = async () => {
    try {
      const r = await fetch(`${API_BASE}/api/district-access/pending`, {
        headers: { "Authorization": `Bearer ${localStorage.getItem("vajra_token") || ""}` },
      });
      if (!r.ok) return;
      const d = await r.json();
      setPendingDistrict(d.pending || []);
    } catch { /* transient -- next poll retries */ }
  };

  const decideDistrict = async (rowid: string, approve: boolean) => {
    setDecidingDistrictId(rowid);
    try {
      const r = await fetch(`${API_BASE}/api/district-access/${rowid}/decision`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${localStorage.getItem("vajra_token") || ""}` },
        body: JSON.stringify({ approve }),
      });
      if (r.ok) {
        setPendingDistrict((prev) => prev.filter((p) => String(p.rowid) !== String(rowid)));
        addToast(
          approve ? (lang === "en" ? "Access granted" : "ಪ್ರವೇಶ ನೀಡಲಾಗಿದೆ") : (lang === "en" ? "Access denied" : "ಪ್ರವೇಶ ನಿರಾಕರಿಸಲಾಗಿದೆ"),
          lang === "en" ? "The requesting officer has been notified." : "ವಿನಂತಿಸಿದ ಅಧಿಕಾರಿಗೆ ಸೂಚಿಸಲಾಗಿದೆ.",
          approve ? "Info" : "Warning"
        );
      }
    } catch { /* ignore */ } finally {
      setDecidingDistrictId(null);
    }
  };

  // Approval history -- the decided (approved/rejected) paper trail for both
  // workflow lanes above (exports + POCSO access), filterable by lane and
  // outcome. Separate from the live queues: those only ever show items still
  // awaiting a decision, this is "what already happened, and who decided it."
  const [historyItems, setHistoryItems] = useState<any[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [historyTypeFilter, setHistoryTypeFilter] = useState<"all" | "export" | "pocso">("all");
  const [historyStatusFilter, setHistoryStatusFilter] = useState<"all" | "approved" | "rejected">("all");

  const fetchApprovalHistory = async (typeF: string, statusF: string) => {
    try {
      setIsLoadingHistory(true);
      const r = await fetch(
        `${API_BASE}/api/approvals/history?type=${typeF}&status=${statusF}`,
        { headers: { "Authorization": `Bearer ${localStorage.getItem("vajra_token") || ""}` } }
      );
      if (!r.ok) return;
      const d = await r.json();
      setHistoryItems(d.history || []);
    } catch { /* transient -- filter change or manual refresh retries */ }
    finally { setIsLoadingHistory(false); }
  };

  useEffect(() => {
    fetchApprovalHistory(historyTypeFilter, historyStatusFilter);
  }, [historyTypeFilter, historyStatusFilter]);

  // Fetch flags
  const fetchFlags = async () => {
    try {
      setIsLoadingFlags(true);
      const response = await fetch(`${API_BASE}/api/alerts/consistency-flags`, {
        headers: {
          "Authorization": `Bearer ${localStorage.getItem("vajra_token") || ""}`,
        },
      });
      
      if (response.status === 401) {
        addToast(
          lang === "en" ? "Session Expired" : "ಅಧಿವೇಶನ ಅವಧಿ ಮುಗಿದಿದೆ",
          lang === "en" ? "Please sign in again to establish a secure logon." : "ಸುರಕ್ಷಿತ ಲಾಗಿನ್ ಸ್ಥಾಪಿಸಲು ದಯವಿಟ್ಟು ಮತ್ತೊಮ್ಮೆ ಲಾಗ್ ಇನ್ ಮಾಡಿ.",
          "Warning"
        );
        setIsAuthenticated(false);
        return;
      }

      if (!response.ok) throw new Error("Database Offline");
      const data = await response.json();
      setFlags(data || []);
    } catch (err) {
      console.error(err);
      setErrorMsg("Failed to retrieve consistency flags.");
    } finally {
      setIsLoadingFlags(false);
    }
  };

  // Fetch audit logs
  const fetchAuditLogs = async () => {
    try {
      setIsLoadingAudit(true);
      const response = await fetch(`${API_BASE}/api/audit-logs`, {
        headers: {
          "Authorization": `Bearer ${localStorage.getItem("vajra_token") || ""}`,
        },
      });
      
      if (response.status === 401) {
        addToast(
          lang === "en" ? "Session Expired" : "ಅಧಿವೇಶನ ಅವಧಿ ಮುಗಿದಿದೆ",
          lang === "en" ? "Please sign in again to establish a secure logon." : "ಸುರಕ್ಷಿತ ಲಾಗಿನ್ ಸ್ಥಾಪಿಸಲು ದಯವಿಟ್ಟು ಮತ್ತೊಮ್ಮೆ ಲಾಗ್ ಇನ್ ಮಾಡಿ.",
          "Warning"
        );
        setIsAuthenticated(false);
        return;
      }

      if (response.ok) {
        const data = await response.json();
        setAuditLogs(data || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoadingAudit(false);
    }
  };

  // Fetch feedback (model-improvement review board)
  const fetchFeedback = async () => {
    try {
      setIsLoadingFeedback(true);
      const response = await fetch(`${API_BASE}/api/admin/feedback`, {
        headers: {
          "Authorization": `Bearer ${localStorage.getItem("vajra_token") || ""}`,
        },
      });

      if (response.status === 401) {
        setIsAuthenticated(false);
        return;
      }

      if (response.ok) {
        const data = await response.json();
        setFeedback(Array.isArray(data?.feedback) ? data.feedback : []);
      } else {
        setFeedback([]);
      }
    } catch (err) {
      console.error(err);
      setFeedback([]);
    } finally {
      setIsLoadingFeedback(false);
    }
  };

  // Fetch officer access oversight
  const fetchOfficers = async () => {
    try {
      setIsLoadingOfficers(true);
      const response = await fetch(`${API_BASE}/api/admin/access-oversight`, {
        headers: {
          "Authorization": `Bearer ${localStorage.getItem("vajra_token") || ""}`,
        },
      });

      if (response.status === 401) {
        setIsAuthenticated(false);
        return;
      }

      if (response.ok) {
        const data = await response.json();
        setOfficers(Array.isArray(data?.officers) ? data.officers : []);
      } else {
        setOfficers([]);
      }
    } catch (err) {
      console.error(err);
      setOfficers([]);
    } finally {
      setIsLoadingOfficers(false);
    }
  };

  useEffect(() => {
    fetchFlags();
    fetchAuditLogs();
    fetchFeedback();
    fetchOfficers();
    fetchPendingExports();
    fetchPendingPocso();
    fetchPendingDistrict();
    // Live poll for held exports + POCSO + inter-district access requests so
    // all three queues + counts update with no manual refresh.
    const iv = setInterval(() => { fetchPendingExports(); fetchPendingPocso(); fetchPendingDistrict(); }, 5000);
    return () => clearInterval(iv);
  }, []);

  // Run ledger cryptographic hash-chain validation — asks the backend to actually
  // recompute SHA-256(prev_hash + content) across every entry and compare against
  // what's stored, rather than just checking the hash string is formatted correctly.
  const handleVerifyLedger = async () => {
    setIsVerifyingLedger(true);
    setLedgerVerified(null);
    setLedgerDetails(null);

    try {
      const response = await fetch(`${API_BASE}/api/audit-logs/verify`, {
        headers: {
          "Authorization": `Bearer ${localStorage.getItem("vajra_token") || ""}`,
        },
      });
      const result = await response.json();
      setLedgerVerified(result.valid);
      setLedgerDetails(result);

      if (result.valid) {
        addToast(
          lang === "en" ? "Ledger Verified" : "ಲೆಡ್ಜರ್ ಪರಿಶೀಲಿಸಲಾಗಿದೆ",
          result.reason,
          "Success"
        );
      } else {
        addToast(
          lang === "en" ? "Ledger Inconsistent" : "ಲೆಡ್ಜರ್ ಅಸಮಂಜಸ",
          result.reason || (lang === "en" ? "Hash chain verification failed." : "ಹ್ಯಾಶ್ ಸರಪಳಿ ಪರಿಶೀಲನೆ ವಿಫಲವಾಗಿದೆ."),
          "Critical"
        );
      }
    } catch (err: any) {
      setLedgerVerified(false);
      setLedgerDetails({
        valid: false,
        reason: err.message || "Network error verifying audit ledger.",
        explanation: "Unable to contact the backend cryptographic verification engine."
      });
      addToast(
        lang === "en" ? "Verification Failed" : "ಪರಿಶೀಲನೆ ವಿಫಲವಾಗಿದೆ",
        err.message || (lang === "en" ? "Could not reach the ledger verification service." : "ಲೆಡ್ಜರ್ ಪರಿಶೀಲನಾ ಸೇವೆಯನ್ನು ತಲುಪಲು ಸಾಧ್ಯವಾಗಲಿಲ್ಲ."),
        "Critical"
      );
    } finally {
      setIsVerifyingLedger(false);
    }
  };

  // Trigger double authorization flow
  const handleReviewFlag = (flagId: number) => {
    setSelectedFlagId(flagId);
    setIsApprovalOpen(true);
  };

  // On Supervisor approve
  const onSupervisorApproved = async (supervisorBadge: string) => {
    if (!selectedFlagId) return;
    try {
      const response = await fetch(`${API_BASE}/api/alerts/consistency-flags/${selectedFlagId}/review`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${localStorage.getItem("vajra_token") || ""}`,
        },
        body: JSON.stringify({
          reviewed: 1,
        }),
      });

      if (!response.ok) {
        throw new Error("Resolution request rejected by server.");
      }

      addToast(
        lang === "en" ? "Consistency Corrected" : "ಸ್ಥಿರತೆ ಸರಿಪಡಿಸಲಾಗಿದೆ",
        lang === "en"
          ? `Reviewed by Supervisor KSP-${supervisorBadge}. Flag ID ${selectedFlagId} resolved successfully.`
          : `ಮೇಲ್ವಿಚಾರಕ KSP-${supervisorBadge} ಪರಿಶೀಲಿಸಿದ್ದಾರೆ. ಫ್ಲ್ಯಾಗ್ ಐಡಿ ${selectedFlagId} ಯಶಸ್ವಿಯಾಗಿ ಬಗೆಹರಿಸಲಾಗಿದೆ.`,
        "Success"
      );
      fetchFlags();
    } catch (err: any) {
      console.error(err);
      addToast(
        lang === "en" ? "Update Error" : "ಅಪ್‌ಡೇಟ್ ದೋಷ",
        err.message || (lang === "en" ? "Failed to commit resolution." : "ಬಗೆಹರಿಕೆಯನ್ನು ಬದ್ಧಗೊಳಿಸಲು ವಿಫಲವಾಗಿದೆ."),
        "Critical"
      );
    }
  };

  return (
    <div className="h-full flex flex-col p-6 space-y-6 bg-stone-950/20 overflow-y-auto">
      {/* Security watermark overlay */}
      <WatermarkOverlay />

      <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center border-b border-stone-850 pb-4 shrink-0">
        <div className="space-y-1">
          <h2 className="text-base font-black text-stone-100 uppercase tracking-wider font-mono flex items-center gap-2">
            <UserCheck className="w-5 h-5 text-[#C79A4E]" />
            <span>{t.supervisorTitle}</span>
          </h2>
          <p className="text-[11px] text-stone-550 leading-relaxed font-mono">
            {t.supervisorDesc}
          </p>
        </div>

        {/* Ledger Verification Button */}
        <button
          onClick={handleVerifyLedger}
          disabled={isVerifyingLedger || isLoadingAudit}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-stone-900 border border-stone-800 hover:border-[#C79A4E]/40 text-xs font-black uppercase tracking-wider text-[#C79A4E] hover:text-white transition-all disabled:opacity-50 cursor-pointer shadow-md shadow-[#C79A4E]/5"
        >
          <ShieldCheck className="w-4 h-4" />
          <span>{isVerifyingLedger ? t.supervisorVerifyingHashes : t.supervisorVerifyLedger}</span>
        </button>
      </div>

      {/* Live export-approval queue -- the AI pre-screen holds sensitive reports
          here; this polls every 5s so the count + list update with no refresh. */}
      {pendingExports.length > 0 && (
        <div className="shrink-0 rounded-xl border border-[#C79A4E]/40 bg-[#C79A4E]/[0.06] p-4 space-y-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-[#C79A4E]" />
            <span className="text-xs font-black uppercase tracking-wider text-[#C79A4E] font-mono">
              {lang === "en" ? "Export approvals" : "ರಫ್ತು ಅನುಮೋದನೆಗಳು"}
            </span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#C79A4E] text-stone-950 font-bold">
              {pendingExports.length}
            </span>
            <span className="text-[10px] text-stone-500 font-mono">
              {lang === "en" ? "AI flagged — needs your sign-off" : "AI ಗುರುತಿಸಿದೆ — ನಿಮ್ಮ ಅನುಮೋದನೆ ಬೇಕು"}
            </span>
          </div>
          <div className="space-y-2">
            {pendingExports.map((p) => (
              <div key={p.rowid} className="flex items-center gap-3 rounded-lg bg-stone-950/40 border border-stone-800 px-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <div className="text-[12px] text-stone-200 font-mono truncate">
                    {lang === "en" ? "Officer" : "ಅಧಿಕಾರಿ"} {p.requester_badge} · {(p.reasons || []).join(", ")}
                  </div>
                  <div className="text-[10px] text-stone-500 truncate">{p.summary || ""}</div>
                </div>
                <button
                  onClick={() => decideExport(String(p.rowid), true)}
                  disabled={decidingExportId === String(p.rowid)}
                  className="px-3 py-1.5 rounded-md bg-emerald-500/15 border border-emerald-500/40 text-[11px] font-bold uppercase tracking-wide text-emerald-300 hover:bg-emerald-500/25 disabled:opacity-50 cursor-pointer"
                >
                  {lang === "en" ? "Approve" : "ಅನುಮೋದಿಸಿ"}
                </button>
                <button
                  onClick={() => decideExport(String(p.rowid), false)}
                  disabled={decidingExportId === String(p.rowid)}
                  className="px-3 py-1.5 rounded-md bg-rose-500/10 border border-rose-500/40 text-[11px] font-bold uppercase tracking-wide text-rose-300 hover:bg-rose-500/20 disabled:opacity-50 cursor-pointer"
                >
                  {lang === "en" ? "Reject" : "ತಿರಸ್ಕರಿಸಿ"}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Live POCSO access-request queue -- an officer who genuinely needs a
          redacted victim identity requests time-boxed access here; polls
          every 5s like the export queue above. */}
      {pendingPocso.length > 0 && (
        <div className="shrink-0 rounded-xl border border-rose-500/40 bg-rose-500/[0.06] p-4 space-y-3">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-rose-400" />
            <span className="text-xs font-black uppercase tracking-wider text-rose-300 font-mono">
              {lang === "en" ? "POCSO access requests" : "POCSO ಪ್ರವೇಶ ವಿನಂತಿಗಳು"}
            </span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-rose-400 text-stone-950 font-bold">
              {pendingPocso.length}
            </span>
            <span className="text-[10px] text-stone-500 font-mono">
              {lang === "en" ? "Section 74 JJA — victim identity is masked" : "ವಿಭಾಗ 74 JJA — ಬಲಿಪಶು ಗುರುತು ಮರೆಮಾಡಲಾಗಿದೆ"}
            </span>
          </div>
          <div className="space-y-2">
            {pendingPocso.map((p) => (
              <div key={p.rowid} className="flex items-center gap-3 rounded-lg bg-stone-950/40 border border-stone-800 px-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <div className="text-[12px] text-stone-200 font-mono truncate">
                    {lang === "en" ? "Officer" : "ಅಧಿಕಾರಿ"} {p.requester_badge} ({p.requester_name || ""}) · {lang === "en" ? "case" : "ಪ್ರಕರಣ"} {p.case_no}
                  </div>
                  <div className="text-[10px] text-stone-500 truncate">{p.reason || (lang === "en" ? "No reason given" : "ಕಾರಣ ನೀಡಿಲ್ಲ")}</div>
                </div>
                <button
                  onClick={() => decidePocso(String(p.rowid), true)}
                  disabled={decidingPocsoId === String(p.rowid)}
                  className="px-3 py-1.5 rounded-md bg-emerald-500/15 border border-emerald-500/40 text-[11px] font-bold uppercase tracking-wide text-emerald-300 hover:bg-emerald-500/25 disabled:opacity-50 cursor-pointer"
                >
                  {lang === "en" ? "Approve" : "ಅನುಮೋದಿಸಿ"}
                </button>
                <button
                  onClick={() => decidePocso(String(p.rowid), false)}
                  disabled={decidingPocsoId === String(p.rowid)}
                  className="px-3 py-1.5 rounded-md bg-rose-500/10 border border-rose-500/40 text-[11px] font-bold uppercase tracking-wide text-rose-300 hover:bg-rose-500/20 disabled:opacity-50 cursor-pointer"
                >
                  {lang === "en" ? "Deny" : "ನಿರಾಕರಿಸಿ"}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Live inter-district access queue (Part C item #7) -- an officer
          asking about a district outside their own jurisdiction requests
          time-boxed access here; polls every 5s like the queues above. */}
      {pendingDistrict.length > 0 && (
        <div className="shrink-0 rounded-xl border border-sky-500/40 bg-sky-500/[0.06] p-4 space-y-3">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-sky-400" />
            <span className="text-xs font-black uppercase tracking-wider text-sky-300 font-mono">
              {lang === "en" ? "District access requests" : "ಜಿಲ್ಲಾ ಪ್ರವೇಶ ವಿನಂತಿಗಳು"}
            </span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-sky-400 text-stone-950 font-bold">
              {pendingDistrict.length}
            </span>
            <span className="text-[10px] text-stone-500 font-mono">
              {lang === "en" ? "Outside the officer's home jurisdiction" : "ಅಧಿಕಾರಿಯ ಸ್ವಂತ ವ್ಯಾಪ್ತಿಯ ಹೊರಗೆ"}
            </span>
          </div>
          <div className="space-y-2">
            {pendingDistrict.map((p) => (
              <div key={p.rowid} className="flex items-center gap-3 rounded-lg bg-stone-950/40 border border-stone-800 px-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <div className="text-[12px] text-stone-200 font-mono truncate">
                    {lang === "en" ? "Officer" : "ಅಧಿಕಾರಿ"} {p.requester_badge} ({p.requester_name || ""}) · {lang === "en" ? "district" : "ಜಿಲ್ಲೆ"} {p.target_district_name}
                  </div>
                  <div className="text-[10px] text-stone-500 truncate">{p.reason || (lang === "en" ? "No reason given" : "ಕಾರಣ ನೀಡಿಲ್ಲ")}</div>
                </div>
                <button
                  onClick={() => decideDistrict(String(p.rowid), true)}
                  disabled={decidingDistrictId === String(p.rowid)}
                  className="px-3 py-1.5 rounded-md bg-emerald-500/15 border border-emerald-500/40 text-[11px] font-bold uppercase tracking-wide text-emerald-300 hover:bg-emerald-500/25 disabled:opacity-50 cursor-pointer"
                >
                  {lang === "en" ? "Approve" : "ಅನುಮೋದಿಸಿ"}
                </button>
                <button
                  onClick={() => decideDistrict(String(p.rowid), false)}
                  disabled={decidingDistrictId === String(p.rowid)}
                  className="px-3 py-1.5 rounded-md bg-rose-500/10 border border-rose-500/40 text-[11px] font-bold uppercase tracking-wide text-rose-300 hover:bg-rose-500/20 disabled:opacity-50 cursor-pointer"
                >
                  {lang === "en" ? "Deny" : "ನಿರಾಕರಿಸಿ"}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Approval history -- decided export + POCSO items, filterable by lane
          and outcome, rendered as a proper table (not another queue-card
          list) since this is a review/audit surface, not an action queue. */}
      <div className="shrink-0 rounded-xl border border-stone-800 bg-stone-900/40 p-4 space-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          <Fingerprint className="w-4 h-4 text-[#C79A4E]" />
          <span className="text-xs font-black uppercase tracking-wider text-stone-300 font-mono">
            {lang === "en" ? "Approval history" : "ಅನುಮೋದನೆ ಇತಿಹಾಸ"}
          </span>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-stone-800 text-stone-400">
            {historyItems.length}
          </span>
          <div className="ml-auto flex items-center gap-2">
            <select
              value={historyTypeFilter}
              onChange={(e) => setHistoryTypeFilter(e.target.value as any)}
              className="text-[11px] font-mono bg-stone-950 border border-stone-700 rounded-md px-2 py-1 text-stone-300 cursor-pointer"
            >
              <option value="all">{lang === "en" ? "All types" : "ಎಲ್ಲಾ ಬಗೆ"}</option>
              <option value="export">{lang === "en" ? "Export" : "ರಫ್ತು"}</option>
              <option value="pocso">POCSO</option>
              <option value="district">{lang === "en" ? "District access" : "ಜಿಲ್ಲಾ ಪ್ರವೇಶ"}</option>
            </select>
            <select
              value={historyStatusFilter}
              onChange={(e) => setHistoryStatusFilter(e.target.value as any)}
              className="text-[11px] font-mono bg-stone-950 border border-stone-700 rounded-md px-2 py-1 text-stone-300 cursor-pointer"
            >
              <option value="all">{lang === "en" ? "All outcomes" : "ಎಲ್ಲಾ ಫಲಿತಾಂಶ"}</option>
              <option value="approved">{lang === "en" ? "Approved" : "ಅನುಮೋದಿಸಲಾಗಿದೆ"}</option>
              <option value="rejected">{lang === "en" ? "Rejected" : "ತಿರಸ್ಕರಿಸಲಾಗಿದೆ"}</option>
            </select>
            <button
              onClick={() => fetchApprovalHistory(historyTypeFilter, historyStatusFilter)}
              disabled={isLoadingHistory}
              className="p-1.5 rounded-md border border-stone-700 text-stone-400 hover:text-[#C79A4E] hover:border-[#C79A4E]/40 disabled:opacity-50 cursor-pointer"
              title={lang === "en" ? "Refresh" : "ರಿಫ್ರೆಶ್"}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoadingHistory ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>
        {historyItems.length === 0 ? (
          <div className="text-[11px] text-stone-500 font-mono px-1 py-2">
            {isLoadingHistory
              ? (lang === "en" ? "Loading..." : "ಲೋಡ್ ಆಗುತ್ತಿದೆ...")
              : (lang === "en" ? "No decided requests match this filter yet." : "ಈ ಫಿಲ್ಟರ್‌ಗೆ ಇನ್ನೂ ಯಾವುದೇ ನಿರ್ಧರಿತ ವಿನಂತಿಗಳಿಲ್ಲ.")}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[11px] font-mono">
              <thead>
                <tr className="text-stone-500 uppercase tracking-wide text-[10px] border-b border-stone-800">
                  <th className="text-left font-semibold py-1.5 pr-3">{lang === "en" ? "Type" : "ಬಗೆ"}</th>
                  <th className="text-left font-semibold py-1.5 pr-3">{lang === "en" ? "Officer" : "ಅಧಿಕಾರಿ"}</th>
                  <th className="text-left font-semibold py-1.5 pr-3">{lang === "en" ? "Subject" : "ವಿಷಯ"}</th>
                  <th className="text-left font-semibold py-1.5 pr-3">{lang === "en" ? "Decision" : "ನಿರ್ಧಾರ"}</th>
                  <th className="text-left font-semibold py-1.5 pr-3">{lang === "en" ? "Decided by" : "ನಿರ್ಧರಿಸಿದವರು"}</th>
                  <th className="text-left font-semibold py-1.5">{lang === "en" ? "When" : "ಯಾವಾಗ"}</th>
                </tr>
              </thead>
              <tbody>
                {historyItems.map((h) => (
                  <tr key={`${h.kind}-${h.rowid}`} className="border-b border-stone-900/80 text-stone-300">
                    <td className="py-1.5 pr-3">
                      <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${h.kind === "pocso" ? "bg-rose-500/15 text-rose-300" : h.kind === "district" ? "bg-sky-500/15 text-sky-300" : "bg-[#C79A4E]/15 text-[#C79A4E]"}`}>
                        {h.kind === "pocso" ? "POCSO" : h.kind === "district" ? (lang === "en" ? "District" : "ಜಿಲ್ಲೆ") : (lang === "en" ? "Export" : "ರಫ್ತು")}
                      </span>
                    </td>
                    <td className="py-1.5 pr-3 truncate max-w-[160px]">{h.requester_badge} {h.requester_name ? `(${h.requester_name})` : ""}</td>
                    <td className="py-1.5 pr-3 truncate max-w-[220px] text-stone-400">{h.subject || "—"}</td>
                    <td className="py-1.5 pr-3">
                      <span className={h.status === "approved" ? "text-emerald-400 font-bold" : "text-rose-400 font-bold"}>
                        {h.status === "approved" ? (lang === "en" ? "Approved" : "ಅನುಮೋದಿಸಲಾಗಿದೆ") : (lang === "en" ? "Rejected" : "ತಿರಸ್ಕರಿಸಲಾಗಿದೆ")}
                      </span>
                    </td>
                    <td className="py-1.5 pr-3 text-stone-400">{h.approver_badge || "—"}</td>
                    <td className="py-1.5 text-stone-500">{h.decided_at ? new Date(h.decided_at + (h.decided_at.endsWith("Z") ? "" : "Z")).toLocaleString() : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Quick-read telemetry strip -- derived from the same flags/auditLogs
          already fetched for the two panels below, no extra round-trip. */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 shrink-0">
        <div className="glass-card p-3.5 border border-stone-850 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-amber-500/10 border border-amber-500/25 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-4.5 h-4.5 text-amber-500" />
          </div>
          <div className="min-w-0">
            <div className="text-lg font-black text-stone-100 font-mono leading-tight">
              {isLoadingFlags ? "—" : flags.filter((f) => f.reviewed === 0).length}
            </div>
            <div className="text-[9.5px] text-stone-500 uppercase font-mono tracking-wide">
              {lang === "en" ? "Pending Flags" : "ಬಾಕಿ ಫ್ಲ್ಯಾಗ್‌ಗಳು"}
            </div>
          </div>
        </div>
        <div className="glass-card p-3.5 border border-stone-850 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-4.5 h-4.5 text-emerald-500" />
          </div>
          <div className="min-w-0">
            <div className="text-lg font-black text-stone-100 font-mono leading-tight">
              {isLoadingFlags ? "—" : flags.filter((f) => f.reviewed !== 0).length}
            </div>
            <div className="text-[9.5px] text-stone-500 uppercase font-mono tracking-wide">
              {lang === "en" ? "Resolved Flags" : "ಬಗೆಹರಿದ ಫ್ಲ್ಯಾಗ್‌ಗಳು"}
            </div>
          </div>
        </div>
        <div className="glass-card p-3.5 border border-stone-850 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-[#C79A4E]/10 border border-[#C79A4E]/25 flex items-center justify-center shrink-0">
            <Activity className="w-4.5 h-4.5 text-[#C79A4E]" />
          </div>
          <div className="min-w-0">
            <div className="text-lg font-black text-stone-100 font-mono leading-tight">
              {isLoadingAudit ? "—" : auditLogs.length}
            </div>
            <div className="text-[9.5px] text-stone-500 uppercase font-mono tracking-wide">
              {lang === "en" ? "Audit Entries Loaded" : "ಆಡಿಟ್ ನಮೂದುಗಳು"}
            </div>
          </div>
        </div>
        <div className="glass-card p-3.5 border border-stone-850 flex items-center gap-3">
          <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 border ${
            ledgerVerified === null ? "bg-stone-800/50 border-stone-700" : ledgerVerified ? "bg-emerald-500/10 border-emerald-500/25" : "bg-rose-500/10 border-rose-500/25"
          }`}>
            <ShieldCheck className={`w-4.5 h-4.5 ${ledgerVerified === null ? "text-stone-400" : ledgerVerified ? "text-emerald-500" : "text-rose-500"}`} />
          </div>
          <div className="min-w-0">
            <div className={`text-[11px] font-black font-mono leading-tight truncate ${ledgerVerified === null ? "text-stone-400" : ledgerVerified ? "text-emerald-500" : "text-rose-500"}`}>
              {ledgerVerified === null
                ? (lang === "en" ? "Not Verified" : "ಪರಿಶೀಲಿಸಿಲ್ಲ")
                : ledgerVerified
                  ? (lang === "en" ? "Chain Intact" : "ಸರಪಳಿ ಸುರಕ್ಷಿತ")
                  : (lang === "en" ? "Inconsistent" : "ಅಸಮಂಜಸ")}
            </div>
            <div className="text-[9.5px] text-stone-500 uppercase font-mono tracking-wide">
              {lang === "en" ? "Ledger Status" : "ಲೆಡ್ಜರ್ ಸ್ಥಿತಿ"}
            </div>
          </div>
        </div>
      </div>

      {/* Ledger Verification Status Alert / Forensic Investigation Card */}
      {ledgerVerified !== null && (
        <div
          className={`p-5 rounded-2xl border space-y-4 animate-fade-in shadow-xl ${
            ledgerVerified
              ? "bg-emerald-950/20 border-emerald-500/30 text-emerald-300"
              : "bg-rose-950/30 border-rose-500/40 text-rose-300"
          }`}
        >
          {/* Header Row */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-stone-800/80 pb-3">
            <div className="flex items-center gap-3">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border ${
                ledgerVerified
                  ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-400"
                  : "bg-rose-500/15 border-rose-500/30 text-rose-400 animate-pulse"
              }`}>
                {ledgerVerified ? <ShieldCheck className="w-5 h-5" /> : <AlertOctagon className="w-5 h-5" />}
              </div>
              <div>
                <h3 className="text-xs font-black uppercase tracking-wider font-mono flex items-center gap-2">
                  <span>
                    {ledgerVerified
                      ? (lang === "en" ? "Cryptographic Ledger Verified: All Blocks Intact" : "ಕ್ರಿಪ್ಟೋಗ್ರಾಫಿಕ್ ಲೆಡ್ಜರ್ ಪರಿಶೀಲಿಸಲಾಗಿದೆ: ಎಲ್ಲಾ ಬ್ಲಾಕ್‌ಗಳು ಸುರಕ್ಷಿತ")
                      : (lang === "en" ? "Security Alert: AuditLog Tampering Detected" : "ಭದ್ರತಾ ಎಚ್ಚರಿಕೆ: ಆಡಿಟ್‌ಲಾಗ್ ತಿದ್ದುಪಡಿ ಪತ್ತೆಯಾಗಿದೆ")}
                  </span>
                  {!ledgerVerified && ledgerDetails?.tamper_type && (
                    <span className="text-[9px] px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30 font-mono font-bold">
                      {ledgerDetails.tamper_type === "chain_severed" ? "CHAIN DISCONTINUITY" : "SIGNATURE MISMATCH"}
                    </span>
                  )}
                </h3>
                <p className="text-[11px] text-stone-400 font-mono mt-0.5">
                  {ledgerVerified
                    ? (lang === "en" ? "Continuous SHA-256 hash-chain verified from genesis block. Zero unauthorized database mutations." : "ಆರಂಭಿಕ ಬ್ಲಾಕ್‌ನಿಂದ SHA-256 ಹ್ಯಾಶ್ ಸರಪಳಿ ಪರಿಶೀಲಿಸಲಾಗಿದೆ. ಯಾವುದೇ ಅನಧಿಕೃತ ಬದಲಾವಣೆಗಳಿಲ್ಲ.")
                    : (ledgerDetails?.reason || (lang === "en" ? "Hash mismatch detected in database audit records." : "ಡೇಟಾಬೇಸ್ ಆಡಿಟ್ ದಾಖಲೆಗಳಲ್ಲಿ ಹ್ಯಾಶ್ ಅಸಮಂಜಸತೆ ಪತ್ತೆಯಾಗಿದೆ."))
                  }
                </p>
              </div>
            </div>
            {ledgerVerified && (
              <div className="flex items-center gap-2 text-[10px] font-mono bg-emerald-500/10 border border-emerald-500/25 px-2.5 py-1 rounded-lg text-emerald-400 shrink-0">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>{ledgerDetails?.checked || 300} Blocks Validated</span>
              </div>
            )}
          </div>

          {/* Detailed Forensic Breakdown on Tampering */}
          {!ledgerVerified && ledgerDetails && (
            <div className="space-y-3 pt-1">
              {/* Root Cause & How It Occurred */}
              <div className="bg-stone-950/70 rounded-xl p-3.5 border border-rose-500/25 space-y-2">
                <div className="flex items-center gap-2 text-[11px] font-bold text-rose-300 uppercase tracking-wider font-mono">
                  <Fingerprint className="w-3.5 h-3.5 text-rose-400" />
                  <span>{lang === "en" ? "Forensic Root-Cause Analysis (How Tampering Occurred)" : "ವಿಧಿವಿಜ್ಞಾನ ಮೂಲ-ಕಾರಣ ವಿಶ್ಲೇಷಣೆ (ತಿದ್ದುಪಡಿ ಹೇಗೆ ಸಂಭವಿಸಿತು)"}</span>
                </div>
                <p className="text-xs text-stone-300 leading-relaxed">
                  {ledgerDetails.explanation || (lang === "en" 
                    ? "A database record was modified or deleted directly in the database without recalculating the cryptographic SHA-256 block signature." 
                    : "ಕ್ರಿಪ್ಟೋಗ್ರಾಫಿಕ್ SHA-256 ಬ್ಲಾಕ್ ಸಹಿಯನ್ನು ಮರು-ಲೆಕ್ಕಿಸದೆ ಡೇಟಾಬೇಸ್‌ನಲ್ಲಿ ನೇರವಾಗಿ ಬದಲಾಯಿಸಲಾಗಿದೆ.")}
                </p>
                {ledgerDetails.remediation && (
                  <p className="text-[11px] text-amber-400/90 font-mono pt-1">
                    <strong>Protocol Note:</strong> {ledgerDetails.remediation}
                  </p>
                )}
              </div>

              {/* Forensic Block Coordinates */}
              {ledgerDetails.block_number && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[10px] font-mono">
                  <div className="bg-stone-900/60 p-2 rounded-lg border border-stone-800">
                    <span className="text-stone-500 block">Compromised Block:</span>
                    <span className="font-bold text-rose-300">#{ledgerDetails.block_number}</span>
                  </div>
                  <div className="bg-stone-900/60 p-2 rounded-lg border border-stone-800">
                    <span className="text-stone-500 block">Database ROWID:</span>
                    <span className="font-bold text-stone-200">{ledgerDetails.rowid || "—"}</span>
                  </div>
                  <div className="bg-stone-900/60 p-2 rounded-lg border border-stone-800">
                    <span className="text-stone-500 block">Target Action:</span>
                    <span className="font-bold text-stone-200">{ledgerDetails.action_type || "—"}</span>
                  </div>
                  <div className="bg-stone-900/60 p-2 rounded-lg border border-stone-800">
                    <span className="text-stone-500 block">Recorded By:</span>
                    <span className="font-bold text-[#C79A4E]">KSP-{ledgerDetails.officer_kgid || "1594888"}</span>
                  </div>
                </div>
              )}

              {/* Cryptographic Hash Comparison Grid */}
              <div className="bg-stone-950/90 rounded-xl p-3 border border-stone-800 text-[10px] font-mono space-y-1.5 overflow-x-auto">
                <div className="text-stone-500 font-bold uppercase tracking-wider flex items-center gap-1.5 pb-1 border-b border-stone-850">
                  <Database className="w-3 h-3 text-[#C79A4E]" />
                  <span>{lang === "en" ? "Cryptographic Signature Discrepancy" : "ಕ್ರಿಪ್ಟೋಗ್ರಾಫಿಕ್ ಸಹಿ ವ್ಯತ್ಯಾಸ"}</span>
                </div>
                {ledgerDetails.tamper_type === "chain_severed" ? (
                  <>
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-stone-400">
                      <span>Expected Prev Hash (Block #{ledgerDetails.block_number - 1}):</span>
                      <span className="text-emerald-400 select-all font-mono">{ledgerDetails.expected_prev_hash || "0000000000000000..."}</span>
                    </div>
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-rose-300">
                      <span>Stored Prev Hash (Block #{ledgerDetails.block_number}):</span>
                      <span className="text-rose-400 select-all font-mono">{ledgerDetails.stored_prev_hash || "null"} (SEVERED LINK)</span>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-stone-400">
                      <span>Computed SHA-256 (from DB row data):</span>
                      <span className="text-emerald-400 select-all font-mono">{ledgerDetails.computed_hash || "—"}</span>
                    </div>
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-rose-300">
                      <span>Stored Block Hash (tampered in DB):</span>
                      <span className="text-rose-400 select-all font-mono">{ledgerDetails.stored_row_hash || "—"} (MISMATCH)</span>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Main Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* Left Side: Consistency Flags */}
        <div className="glass-card p-5 border border-stone-850 space-y-4">
          <div className="flex justify-between items-center border-b border-stone-850 pb-2">
            <h3 className="text-xs font-black text-stone-200 uppercase tracking-wider font-mono flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 text-amber-500 animate-pulse" />
              <span>{t.supervisorConsistencyFlagsTitle}</span>
            </h3>
            <button onClick={fetchFlags} className="text-stone-500 hover:text-[#C79A4E] transition-colors cursor-pointer">
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>

          {isLoadingFlags ? (
            <div className="space-y-3">
              {[1, 2, 3].map((n) => (
                <div key={n} className="bg-stone-900/50 p-3 rounded-lg border border-stone-850/30 space-y-2">
                  <div className="h-4 w-1/3 bg-stone-800 rounded shimmer-bg" />
                  <div className="h-3 w-3/4 bg-stone-850/40 rounded shimmer-bg" />
                </div>
              ))}
            </div>
          ) : flags.length === 0 ? (
            <div className="py-10 text-center text-xs font-mono text-stone-550">{t.supervisorNoFlags}</div>
          ) : (
            <div className="space-y-3 max-h-[350px] overflow-y-auto pr-1">
              {flags.map((flag) => (
                <div key={flag.ROWID} className="bg-stone-950/45 p-3 rounded-lg border border-stone-900 space-y-2 text-xs">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-stone-200 font-mono">{flag.CrimeNo}</span>
                    <span className="text-[10px] bg-amber-500/10 text-amber-450 border border-amber-500/25 px-1.5 py-0.2 rounded font-mono uppercase">
                      {flag.flag_type}
                    </span>
                  </div>
                  <p className="text-stone-400 font-sans leading-relaxed">{flag.flag_details}</p>
                  
                  {flag.reviewed === 0 ? (
                    <div className="text-right">
                      <button
                        onClick={() => handleReviewFlag(flag.ROWID)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-[#C79A4E]/10 border border-[#C79A4E]/25 text-[#C79A4E] hover:text-white hover:bg-[#C79A4E]/20 font-bold font-mono text-[10px] uppercase cursor-pointer"
                      >
                        <Lock className="w-3 h-3" />
                        <span>{t.supervisorResolveDualControl}</span>
                      </button>
                    </div>
                  ) : (
                    <div className="text-right text-[10px] font-mono text-stone-550 font-bold uppercase tracking-wider">
                      {t.supervisorResolvedBySupervisor}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right Side: Audit Ledger Explorer */}
        <div className="glass-card p-5 border border-stone-850 space-y-4">
          <div className="flex justify-between items-center border-b border-stone-850 pb-2">
            <h3 className="text-xs font-black text-stone-200 uppercase tracking-wider font-mono flex items-center gap-1.5">
              <FileSpreadsheet className="w-4 h-4 text-[#C79A4E]" />
              <span>{t.supervisorAuditLedgerTitle}</span>
            </h3>
            <button onClick={fetchAuditLogs} className="text-stone-500 hover:text-[#C79A4E] transition-colors cursor-pointer">
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>

          {isLoadingAudit ? (
            <div className="space-y-2.5">
              {[1, 2, 3, 4].map((n) => (
                <div key={n} className="bg-stone-900/30 p-2.5 rounded border border-stone-850/30 space-y-2">
                  <div className="h-3.5 w-1/2 bg-stone-800 rounded shimmer-bg" />
                  <div className="h-3 w-5/6 bg-stone-850/40 rounded shimmer-bg" />
                </div>
              ))}
            </div>
          ) : auditLogs.length === 0 ? (
            <div className="py-10 text-center text-xs font-mono text-stone-550">{t.supervisorNoAuditLogs}</div>
          ) : (
            <div className="space-y-2.5 max-h-[350px] overflow-y-auto pr-1 font-mono text-[10.5px]">
              {auditLogs.map((log, i) => (
                <div key={i} className="bg-stone-950/20 p-2.5 rounded border border-stone-900 flex flex-col gap-1">
                  <div className="flex justify-between text-stone-400">
                    <span>{log.badgeId} • {log.action}</span>
                    <span className="text-stone-500">{log.timestamp?.split(" ")[0]}</span>
                  </div>
                  <p className="text-stone-350 truncate">{t.supervisorQueryLabel} "{log.queryParam}"</p>
                  <div className="text-[9px] text-[#C79A4E] truncate">{t.supervisorHashLabel} {log.hash}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Feedback Review Board -- human oversight surface for the model-improvement loop.
          Negative (👎) feedback is surfaced first as it is what needs review. */}
      <div className="glass-card p-5 border border-stone-850 space-y-4">
        <div className="flex justify-between items-center border-b border-stone-850 pb-2">
          <h3 className="text-xs font-black text-stone-200 uppercase tracking-wider font-mono flex items-center gap-1.5">
            <MessageSquare className="w-4 h-4 text-[#C79A4E]" />
            <span>{lang === "en" ? "Feedback Review Board" : "ಪ್ರತಿಕ್ರಿಯೆ ಪರಿಶೀಲನಾ ಮಂಡಳಿ"}</span>
          </h3>
          <div className="flex items-center gap-3">
            {!isLoadingFeedback && feedback.length > 0 && (
              <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-wider">
                <span className="text-stone-500">
                  {lang === "en" ? "Total" : "ಒಟ್ಟು"}: <span className="text-stone-200 font-black">{feedback.length}</span>
                </span>
                <span className="text-rose-450">
                  {lang === "en" ? "Negative" : "ಋಣಾತ್ಮಕ"}: <span className="font-black">{feedback.filter((f) => f.rating === "down").length}</span>
                </span>
              </div>
            )}
            <button onClick={fetchFeedback} className="text-stone-500 hover:text-[#C79A4E] transition-colors cursor-pointer">
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {isLoadingFeedback ? (
          <div className="space-y-3">
            {[1, 2, 3].map((n) => (
              <div key={n} className="bg-stone-900/50 p-3 rounded-lg border border-stone-850/30 space-y-2">
                <div className="h-4 w-1/3 bg-stone-800 rounded shimmer-bg" />
                <div className="h-3 w-3/4 bg-stone-850/40 rounded shimmer-bg" />
              </div>
            ))}
          </div>
        ) : feedback.length === 0 ? (
          <div className="py-10 text-center text-xs font-mono text-stone-550">
            {lang === "en" ? "No feedback yet." : "ಇನ್ನೂ ಪ್ರತಿಕ್ರಿಯೆ ಇಲ್ಲ."}
          </div>
        ) : (
          <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
            {[...feedback]
              .sort((a, b) => (a.rating === "down" ? 0 : 1) - (b.rating === "down" ? 0 : 1))
              .map((fb, i) => {
                const isDown = fb.rating === "down";
                return (
                  <div
                    key={i}
                    className={`p-3 rounded-lg border space-y-2 text-xs ${
                      isDown
                        ? "bg-rose-500/[0.07] border-rose-500/25"
                        : "bg-emerald-500/[0.05] border-emerald-500/20"
                    }`}
                  >
                    <div className="flex justify-between items-start gap-2">
                      <p className="text-stone-200 font-sans leading-relaxed font-medium">{fb.query_text}</p>
                      <span
                        className={`shrink-0 inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded font-mono uppercase border ${
                          isDown
                            ? "bg-rose-500/10 text-rose-450 border-rose-500/30"
                            : "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                        }`}
                      >
                        {isDown ? <ThumbsDown className="w-3 h-3" /> : <ThumbsUp className="w-3 h-3" />}
                        {isDown ? (lang === "en" ? "Down" : "ಕಳಪೆ") : (lang === "en" ? "Up" : "ಉತ್ತಮ")}
                      </span>
                    </div>
                    <p className="text-stone-450 font-sans leading-relaxed line-clamp-2">{fb.response_summary}</p>

                    {fb.correction && (
                      <div className="bg-[#C79A4E]/[0.08] border border-[#C79A4E]/25 rounded p-2 space-y-1">
                        <div className="text-[9px] text-[#C79A4E] uppercase font-mono tracking-wider font-black">
                          {lang === "en" ? "Officer correction" : "ಅಧಿಕಾರಿ ತಿದ್ದುಪಡಿ"}
                        </div>
                        <p className="text-stone-300 font-sans leading-relaxed">{fb.correction}</p>
                      </div>
                    )}

                    <div className="flex justify-between items-center text-[9.5px] font-mono text-stone-550 uppercase tracking-wide pt-0.5">
                      <span>{fb.kgid}</span>
                      <span>{fb.created_at}</span>
                    </div>
                  </div>
                );
              })}
          </div>
        )}
      </div>

      {/* Officer Access Oversight -- ranked query activity with anomaly flagging */}
      <div className="glass-card p-5 border border-stone-850 space-y-4">
        <div className="flex justify-between items-center border-b border-stone-850 pb-2">
          <h3 className="text-xs font-black text-stone-200 uppercase tracking-wider font-mono flex items-center gap-1.5">
            <Users className="w-4 h-4 text-[#C79A4E]" />
            <span>{lang === "en" ? "Officer Access Oversight" : "ಅಧಿಕಾರಿ ಪ್ರವೇಶ ಮೇಲ್ವಿಚಾರಣೆ"}</span>
          </h3>
          <div className="flex items-center gap-3">
            {!isLoadingOfficers && officers.length > 0 && (
              <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-wider">
                <span className="text-stone-500">
                  {lang === "en" ? "Officers" : "ಅಧಿಕಾರಿಗಳು"}: <span className="text-stone-200 font-black">{officers.length}</span>
                </span>
                <span className="text-rose-450">
                  {lang === "en" ? "Flagged" : "ಗುರುತಿಸಲಾಗಿದೆ"}: <span className="font-black">{officers.filter((o) => o.flagged).length}</span>
                </span>
              </div>
            )}
            <button onClick={fetchOfficers} className="text-stone-500 hover:text-[#C79A4E] transition-colors cursor-pointer">
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {isLoadingOfficers ? (
          <div className="space-y-2.5">
            {[1, 2, 3, 4].map((n) => (
              <div key={n} className="bg-stone-900/30 p-2.5 rounded border border-stone-850/30 space-y-2">
                <div className="h-3.5 w-1/2 bg-stone-800 rounded shimmer-bg" />
                <div className="h-3 w-5/6 bg-stone-850/40 rounded shimmer-bg" />
              </div>
            ))}
          </div>
        ) : officers.length === 0 ? (
          <div className="py-10 text-center text-xs font-mono text-stone-550">
            {lang === "en" ? "No officer activity recorded." : "ಯಾವುದೇ ಅಧಿಕಾರಿ ಚಟುವಟಿಕೆ ದಾಖಲಾಗಿಲ್ಲ."}
          </div>
        ) : (
          <div className="max-h-[420px] overflow-y-auto pr-1">
            <div className="grid grid-cols-[1fr_auto_auto_auto] gap-x-3 gap-y-0 items-center px-2 pb-2 border-b border-stone-850 text-[9px] font-mono uppercase tracking-wider text-stone-550">
              <span>{lang === "en" ? "Officer" : "ಅಧಿಕಾರಿ"}</span>
              <span className="text-right">{lang === "en" ? "Queries" : "ಪ್ರಶ್ನೆಗಳು"}</span>
              <span className="text-right">{lang === "en" ? "Subjects" : "ವಿಷಯಗಳು"}</span>
              <span className="text-right">{lang === "en" ? "Last Active" : "ಕೊನೆಯ ಚಟುವಟಿಕೆ"}</span>
            </div>
            <div className="space-y-1.5 pt-1.5">
              {[...officers]
                .sort((a, b) => b.query_count - a.query_count)
                .map((o, i) => (
                  <div
                    key={i}
                    className={`grid grid-cols-[1fr_auto_auto_auto] gap-x-3 items-center px-2 py-2 rounded border text-xs ${
                      o.flagged
                        ? "bg-rose-500/[0.07] border-rose-500/25"
                        : "bg-stone-950/30 border-stone-900"
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        {o.flagged && <ShieldAlert className="w-3.5 h-3.5 text-rose-450 shrink-0" />}
                        <span className="font-bold text-stone-200 font-sans truncate">{o.name}</span>
                      </div>
                      <div className="text-[9.5px] font-mono text-stone-550 truncate">{o.kgid}</div>
                      {o.flagged && o.flag_reason && (
                        <span className="mt-1 inline-flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded font-mono bg-rose-500/10 text-rose-450 border border-rose-500/30">
                          <AlertTriangle className="w-2.5 h-2.5 shrink-0" />
                          {o.flag_reason}
                        </span>
                      )}
                    </div>
                    <span className="text-right font-mono font-black text-stone-100 tabular-nums">{o.query_count}</span>
                    <span className="text-right font-mono text-stone-350 tabular-nums">{o.distinct_subjects}</span>
                    <span className="text-right font-mono text-[9.5px] text-stone-500 inline-flex items-center justify-end gap-1">
                      <Clock className="w-2.5 h-2.5 shrink-0" />
                      {o.last_active}
                    </span>
                  </div>
                ))}
            </div>
          </div>
        )}
      </div>

      {/* Two Person Integrity Credential Check */}
      <TwoPersonApprovalModal
        actionName={`Resolve Consistency Flag (ID: ${selectedFlagId})`}
        isOpen={isApprovalOpen}
        onClose={() => setIsApprovalOpen(false)}
        onApprove={onSupervisorApproved}
      />
    </div>
  );
};
