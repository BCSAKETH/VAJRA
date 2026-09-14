import React, { useState, useEffect } from "react";
import {
  UserPlus, ShieldBan, ShieldCheck, UserCheck, RefreshCw, KeyRound,
  AlertTriangle, Trash2, X, Lock, CheckCircle2, UserX, Loader2, Phone, Mail
} from "lucide-react";
import { useApp } from "../AppContext";
import { API_BASE } from "../config";

interface OfficerRosterItem {
  rowid: number;
  kgid: string;
  name: string;
  rank_id: number;
  rank_name: string;
  designation_id: number;
  designation_name: string;
  unit_id: number;
  unit_name: string;
  phone_number?: string;
  email?: string;
  status: "active" | "blocked" | "unprovisioned";
  blocked_details?: {
    blocked_by_kgid?: string;
    blocked_by_name?: string;
    blocked_at?: string;
    reason?: string;
  } | null;
}

export const PersonnelGovernancePanel: React.FC = () => {
  const { lang, addToast } = useApp();
  const [officers, setOfficers] = useState<OfficerRosterItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // Block state
  const [blockTarget, setBlockTarget] = useState<OfficerRosterItem | null>(null);
  const [blockReason, setBlockReason] = useState("Administrative Disciplinary Inquiry pending internal review under KPA 1963 §23");

  // Delete state
  const [deleteTarget, setDeleteTarget] = useState<OfficerRosterItem | null>(null);
  const [deleteReason, setDeleteReason] = useState("Permanent Decommissioning / Official Transfer from KSP");

  const [isSubmitting, setIsSubmitting] = useState(false);

  // New Officer Form State
  const [newBadge, setNewBadge] = useState("");
  const [newName, setNewName] = useState("");
  const [newRankId, setNewRankId] = useState("4"); // PSI default
  const [newDesigId, setNewDesigId] = useState("3"); // SHO default
  const [newUnitId, setNewUnitId] = useState("8"); // Bengaluru City default
  const [newPhone, setNewPhone] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("Vajra@2026");

  const fetchRoster = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/supervisor/officers`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("vajra_token") || ""}` }
      });
      if (!res.ok) throw new Error("Failed to fetch officers roster");
      const data = await res.json();
      setOfficers(data.officers || []);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRoster();
  }, []);

  const handleCreateOfficer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newBadge.trim().length !== 7 || !/^\d+$/.test(newBadge.trim())) {
      addToast(
        lang === "en" ? "Invalid KGID" : "ಅಮಾನ್ಯ KGID",
        lang === "en" ? "Badge number must be exactly 7 numeric digits." : "ಬ್ಯಾಡ್ಜ್ ಸಂಖ್ಯೆಯು ೭ ಅಂಕಿಗಳಾಗಿರಬೇಕು.",
        "Error"
      );
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/api/supervisor/officers/create`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("vajra_token") || ""}`
        },
        body: JSON.stringify({
          badge_no: newBadge.trim(),
          first_name: newName.trim(),
          rank_id: Number(newRankId),
          designation_id: Number(newDesigId),
          unit_id: Number(newUnitId),
          phone_number: newPhone.trim() || undefined,
          email: newEmail.trim() || undefined,
          initial_password: newPassword
        })
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || "Onboarding failed");
      }

      addToast(
        lang === "en" ? "Officer Onboarded" : "ಅಧಿಕಾರಿಯನ್ನು ನೋಂದಾಯಿಸಲಾಗಿದೆ",
        lang === "en" ? `Officer ${newName} (KGID: ${newBadge}) created with active credentials.` : `ಅಧಿಕಾರಿ ${newName} ಖಾತೆಯನ್ನು ಸಕ್ರಿಯಗೊಳಿಸಲಾಗಿದೆ.`,
        "Success"
      );
      setIsAddModalOpen(false);
      setNewBadge("");
      setNewName("");
      setNewPhone("");
      setNewEmail("");
      fetchRoster();
    } catch (err: any) {
      addToast(lang === "en" ? "Error" : "ದೋಷ", err.message, "Error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleBlock = async (officer: OfficerRosterItem) => {
    if (officer.status === "blocked") {
      try {
        const res = await fetch(`${API_BASE}/api/supervisor/officers/${officer.kgid}/unblock`, {
          method: "POST",
          headers: { Authorization: `Bearer ${localStorage.getItem("vajra_token") || ""}` }
        });
        if (!res.ok) throw new Error("Unblock failed");
        addToast(
          lang === "en" ? "Account Reinstated" : "ಖಾತೆ ಮರುಸ್ಥಾಪಿಸಲಾಗಿದೆ",
          lang === "en" ? `Officer ${officer.name} (${officer.kgid}) access restored.` : `ಅಧಿಕಾರಿ ${officer.name} ಪ್ರವೇಶವನ್ನು ಮರುಸ್ಥಾಪಿಸಲಾಗಿದೆ.`,
          "Success"
        );
        fetchRoster();
      } catch (err: any) {
        addToast(lang === "en" ? "Error" : "ದೋಷ", err.message, "Error");
      }
    } else {
      setBlockTarget(officer);
    }
  };

  const confirmBlock = async () => {
    if (!blockTarget) return;
    setIsSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/api/supervisor/officers/${blockTarget.kgid}/block`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("vajra_token") || ""}`
        },
        body: JSON.stringify({ reason: blockReason })
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || "Suspension failed");
      }

      addToast(
        lang === "en" ? "Account Suspended" : "ಖಾತೆ ಅಮಾನತುಗೊಳಿಸಲಾಗಿದೆ",
        lang === "en"
          ? `Officer ${blockTarget.name} (${blockTarget.kgid}) blocked. All active sessions terminated.`
          : `ಅಧಿಕಾರಿ ${blockTarget.name} ಖಾತೆಯನ್ನು ಅಮಾನತುಗೊಳಿಸಲಾಗಿದೆ.`,
        "Warning"
      );
      setBlockTarget(null);
      fetchRoster();
    } catch (err: any) {
      addToast(lang === "en" ? "Error" : "ದೋಷ", err.message, "Error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setIsSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/api/supervisor/officers/${deleteTarget.kgid}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("vajra_token") || ""}`
        },
        body: JSON.stringify({ reason: deleteReason })
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || "Deletion failed");
      }

      addToast(
        lang === "en" ? "Account Purged" : "ಖಾತೆ ಅಳಿಸಲಾಗಿದೆ",
        lang === "en"
          ? `Officer ${deleteTarget.name} (${deleteTarget.kgid}) permanently deleted. Audit chain preserved.`
          : `ಅಧಿಕಾರಿ ${deleteTarget.name} ದಾಖಲೆಗಳನ್ನು ಶಾಶ್ವತವಾಗಿ ಅಳಿಸಲಾಗಿದೆ.`,
        "Success"
      );
      setDeleteTarget(null);
      fetchRoster();
    } catch (err: any) {
      addToast(lang === "en" ? "Error" : "ದೋಷ", err.message, "Error");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="glass-card p-5 border border-stone-850 space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-stone-850 pb-3">
        <div className="flex items-center gap-2">
          <UserCheck className="w-5 h-5 text-[#C79A4E]" />
          <div>
            <h3 className="text-sm font-black uppercase tracking-wider text-stone-100 font-mono">
              {lang === "en" ? "Personnel Governance & Access Control" : "ಅಧಿಕಾರಿ ಸಿಬ್ಬಂದಿ ಆಡಳಿತ ಮತ್ತು ಪ್ರವೇಶ ನಿಯಂತ್ರಣ"}
            </h3>
            <p className="text-[11px] text-stone-500 font-mono">
              {lang === "en"
                ? "Statutory officer provisioning, suspension killswitch (KPA §23), and account decommissioning."
                : "ಅಧಿಕಾರಿಗಳ ನೋಂದಣಿ, ಅಮಾನತು ಮತ್ತು ಶಾಶ್ವತ ನಿರ್ವಹಣೆ."}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchRoster}
            disabled={isLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-stone-800 bg-stone-900/60 hover:bg-stone-800 text-stone-300 text-xs font-bold transition-all cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin text-[#C79A4E]" : ""}`} />
            <span>{lang === "en" ? "Refresh Roster" : "ಮರುಹೊಂದಿಸಿ"}</span>
          </button>
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#C79A4E] hover:bg-[#E4C590] text-stone-950 text-xs font-black uppercase tracking-wider transition-all cursor-pointer shadow-md shadow-[#C79A4E]/20"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>{lang === "en" ? "Onboard Officer" : "ಹೊಸ ಅಧಿಕಾರಿ"}</span>
          </button>
        </div>
      </div>

      {/* Roster Table */}
      {isLoading ? (
        <div className="py-12 text-center text-xs font-mono text-stone-500 flex items-center justify-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin text-[#C79A4E]" />
          <span>{lang === "en" ? "Loading officer roster..." : "ಅಧಿಕಾರಿಗಳ ಪಟ್ಟಿಯನ್ನು ಲೋಡ್ ಮಾಡಲಾಗುತ್ತಿದೆ..."}</span>
        </div>
      ) : officers.length === 0 ? (
        <div className="py-12 text-center text-xs font-mono text-stone-500">
          {lang === "en" ? "No officer records found." : "ಯಾವುದೇ ಅಧಿಕಾರಿ ದಾಖಲೆಗಳು ಕಂಡುಬಂದಿಲ್ಲ."}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-stone-800 text-stone-500 font-mono text-[10px] uppercase">
                <th className="py-2 px-3">{lang === "en" ? "Officer Name" : "ಹೆಸರು"}</th>
                <th className="py-2 px-3">KGID</th>
                <th className="py-2 px-3">{lang === "en" ? "Rank & Designation" : "ಶ್ರೇಣಿ ಮತ್ತು ಪದನಾಮ"}</th>
                <th className="py-2 px-3">{lang === "en" ? "Unit / Station" : "ಠಾಣೆ"}</th>
                <th className="py-2 px-3">{lang === "en" ? "Status" : "ಸ್ಥಿತಿ"}</th>
                <th className="py-2 px-3 text-right">{lang === "en" ? "Administrative Actions" : "ಕ್ರಮಗಳು"}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-850">
              {officers.map((o) => (
                <tr key={o.kgid} className="hover:bg-stone-900/40 transition-colors">
                  <td className="py-2.5 px-3 font-bold text-stone-200">
                    <div className="flex items-center gap-1.5">
                      <span>{o.name}</span>
                    </div>
                  </td>
                  <td className="py-2.5 px-3 font-mono text-stone-400">{o.kgid}</td>
                  <td className="py-2.5 px-3">
                    <div className="text-stone-300 font-semibold">{o.rank_name}</div>
                    <div className="text-[10px] text-stone-500">{o.designation_name}</div>
                  </td>
                  <td className="py-2.5 px-3 text-stone-400 font-mono text-[11px]">{o.unit_name}</td>
                  <td className="py-2.5 px-3">
                    {o.status === "blocked" ? (
                      <div className="space-y-0.5">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/10 border border-rose-500/30 text-rose-400">
                          <ShieldBan className="w-2.5 h-2.5" />
                          <span>{lang === "en" ? "Suspended" : "ಅಮಾನತು"}</span>
                        </span>
                        {o.blocked_details?.reason && (
                          <div className="text-[9px] text-stone-500 truncate max-w-[160px] italic">
                            "{o.blocked_details.reason}"
                          </div>
                        )}
                      </div>
                    ) : o.status === "active" ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
                        <CheckCircle2 className="w-2.5 h-2.5" />
                        <span>{lang === "en" ? "Active" : "ಸಕ್ರಿಯ"}</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 border border-amber-500/30 text-amber-400">
                        <span>{lang === "en" ? "Unprovisioned" : "ರುಜುವಾತುಗಳಿಲ್ಲ"}</span>
                      </span>
                    )}
                  </td>
                  <td className="py-2.5 px-3 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      {/* Block/Unblock Toggle */}
                      <button
                        onClick={() => handleToggleBlock(o)}
                        className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider transition-colors cursor-pointer border ${
                          o.status === "blocked"
                            ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20"
                            : "border-amber-500/30 bg-amber-500/10 text-amber-400 hover:bg-amber-500/20"
                        }`}
                      >
                        {o.status === "blocked"
                          ? (lang === "en" ? "Unblock" : "ಮರುಸ್ಥಾಪಿಸಿ")
                          : (lang === "en" ? "Suspend" : "ಅಮಾನತು")}
                      </button>

                      {/* Delete Account */}
                      <button
                        onClick={() => setDeleteTarget(o)}
                        className="p-1 rounded text-stone-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                        title={lang === "en" ? "Delete Account" : "ಖಾತೆ ಅಳಿಸಿ"}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* MODAL 1: Onboard New Officer */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-stone-900 border border-stone-800 rounded-2xl p-6 shadow-2xl space-y-4 animate-fade-in relative">
            <div className="flex items-center justify-between border-b border-stone-800 pb-3">
              <div className="flex items-center gap-2 text-[#C79A4E]">
                <UserPlus className="w-5 h-5" />
                <h3 className="text-sm font-black uppercase tracking-wider text-stone-100">
                  {lang === "en" ? "Onboard Police Officer" : "ಹೊಸ ಪೊಲೀಸ್ ಅಧಿಕಾರಿಯ ನೋಂದಣಿ"}
                </h3>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-stone-500 hover:text-stone-300 p-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateOfficer} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] text-stone-400 uppercase font-bold block mb-1">
                    KGID / Badge ID *
                  </label>
                  <input
                    type="text"
                    value={newBadge}
                    onChange={(e) => setNewBadge(e.target.value)}
                    placeholder="e.g. 5001234"
                    maxLength={7}
                    required
                    className="w-full bg-stone-950 border border-stone-800 focus:border-[#C79A4E] rounded-lg px-3 py-2 text-stone-100 font-mono"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-stone-400 uppercase font-bold block mb-1">
                    Officer Name *
                  </label>
                  <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="e.g. Ramesh Kumar"
                    required
                    className="w-full bg-stone-950 border border-stone-800 focus:border-[#C79A4E] rounded-lg px-3 py-2 text-stone-100"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-[10px] text-stone-400 uppercase font-bold block mb-1">
                    Rank
                  </label>
                  <select
                    value={newRankId}
                    onChange={(e) => setNewRankId(e.target.value)}
                    className="w-full bg-stone-950 border border-stone-800 focus:border-[#C79A4E] rounded-lg px-2.5 py-2 text-stone-200"
                  >
                    <option value="1">Constable (PC)</option>
                    <option value="2">Head Constable (HC)</option>
                    <option value="3">Assistant Sub-Inspector (ASI)</option>
                    <option value="4">Sub-Inspector (PSI)</option>
                    <option value="5">Police Inspector (PI)</option>
                    <option value="6">Deputy Superintendent (DySP)</option>
                    <option value="7">Superintendent of Police (SP)</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] text-stone-400 uppercase font-bold block mb-1">
                    Designation
                  </label>
                  <select
                    value={newDesigId}
                    onChange={(e) => setNewDesigId(e.target.value)}
                    className="w-full bg-stone-950 border border-stone-800 focus:border-[#C79A4E] rounded-lg px-2.5 py-2 text-stone-200"
                  >
                    <option value="1">Station Duty Officer</option>
                    <option value="2">Investigating Officer (IO)</option>
                    <option value="3">Station House Officer (SHO)</option>
                    <option value="4">Crime Branch Lead</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] text-stone-400 uppercase font-bold block mb-1">
                    Police Unit
                  </label>
                  <select
                    value={newUnitId}
                    onChange={(e) => setNewUnitId(e.target.value)}
                    className="w-full bg-stone-950 border border-stone-800 focus:border-[#C79A4E] rounded-lg px-2.5 py-2 text-stone-200"
                  >
                    <option value="8">Bengaluru City</option>
                    <option value="12">Ballari District</option>
                    <option value="15">Mysuru City</option>
                    <option value="19">CID Cyber Crime</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] text-stone-400 uppercase font-bold block mb-1">
                    Phone Number
                  </label>
                  <input
                    type="text"
                    value={newPhone}
                    onChange={(e) => setNewPhone(e.target.value)}
                    placeholder="9876543210"
                    className="w-full bg-stone-950 border border-stone-800 focus:border-[#C79A4E] rounded-lg px-3 py-2 text-stone-100 font-mono"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-stone-400 uppercase font-bold block mb-1">
                    Official Email
                  </label>
                  <input
                    type="email"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="officer@ksp.gov.in"
                    className="w-full bg-stone-950 border border-stone-800 focus:border-[#C79A4E] rounded-lg px-3 py-2 text-stone-100 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] text-stone-400 uppercase font-bold block mb-1">
                  Initial Password *
                </label>
                <input
                  type="text"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  className="w-full bg-stone-950 border border-stone-800 focus:border-[#C79A4E] rounded-lg px-3 py-2 text-stone-100 font-mono"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-stone-800">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-3.5 py-1.5 rounded-lg text-xs text-stone-400 hover:text-white uppercase font-bold cursor-pointer"
                >
                  {lang === "en" ? "Cancel" : "ರದ್ದುಮಾಡಿ"}
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-1.5 rounded-lg bg-[#C79A4E] text-stone-950 font-black uppercase text-xs hover:bg-[#E4C590] cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? (lang === "en" ? "Creating…" : "ರಚಿಸಲಾಗುತ್ತಿದೆ…") : (lang === "en" ? "Provision Account" : "ಖಾತೆ ರಚಿಸಿ")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Suspend / Block Officer */}
      {blockTarget && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-stone-900 border border-amber-500/40 rounded-2xl p-6 shadow-2xl space-y-4 animate-fade-in relative">
            <div className="flex items-center justify-between border-b border-stone-800 pb-3">
              <div className="flex items-center gap-2 text-amber-500">
                <ShieldBan className="w-5 h-5" />
                <h3 className="text-sm font-black uppercase tracking-wider text-stone-100">
                  {lang === "en" ? "Suspend Officer Access" : "ಅಧಿಕಾರಿ ಖಾತೆ ಅಮಾನತು"}
                </h3>
              </div>
              <button onClick={() => setBlockTarget(null)} className="text-stone-500 hover:text-stone-300 p-1 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-stone-300 leading-relaxed">
              {lang === "en"
                ? `You are initiating an administrative suspension for ${blockTarget.name} (KGID: ${blockTarget.kgid}). All active sessions will be terminated immediately.`
                : `ನೀವು ${blockTarget.name} (KGID: ${blockTarget.kgid}) ಅವರ ಖಾತೆಯನ್ನು ಅಮಾನತುಗೊಳಿಸುತ್ತಿದ್ದೀರಿ.`}
            </p>

            <div>
              <label className="text-[10px] text-stone-400 uppercase font-bold block mb-1">
                Statutory Reason / Inquiry Reference *
              </label>
              <textarea
                value={blockReason}
                onChange={(e) => setBlockReason(e.target.value)}
                rows={3}
                required
                className="w-full bg-stone-950 border border-stone-800 focus:border-amber-500 rounded-lg p-2.5 text-xs text-stone-200"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-stone-800">
              <button
                type="button"
                onClick={() => setBlockTarget(null)}
                className="px-3.5 py-1.5 rounded-lg text-xs text-stone-400 hover:text-white uppercase font-bold cursor-pointer"
              >
                {lang === "en" ? "Cancel" : "ರದ್ದುಮಾಡಿ"}
              </button>
              <button
                onClick={confirmBlock}
                disabled={isSubmitting || blockReason.trim().length < 5}
                className="px-4 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-stone-950 font-black uppercase text-xs cursor-pointer disabled:opacity-50"
              >
                {isSubmitting ? (lang === "en" ? "Suspending…" : "ಅಮಾನತುಗೊಳಿಸಲಾಗುತ್ತಿದೆ…") : (lang === "en" ? "Confirm Suspension" : "ಅಮಾನತು ಖಚಿತಪಡಿಸಿ")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: Permanently Delete Officer */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-stone-900 border border-rose-500/60 rounded-2xl p-6 shadow-2xl space-y-4 animate-fade-in relative">
            <div className="flex items-center justify-between border-b border-stone-800 pb-3">
              <div className="flex items-center gap-2 text-rose-500">
                <Trash2 className="w-5 h-5" />
                <h3 className="text-sm font-black uppercase tracking-wider text-rose-400">
                  {lang === "en" ? "Permanently Delete Officer" : "ಅಧಿಕಾರಿಯನ್ನು ಶಾಶ್ವತವಾಗಿ ಅಳಿಸಿ"}
                </h3>
              </div>
              <button onClick={() => setDeleteTarget(null)} className="text-stone-500 hover:text-stone-300 p-1 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-stone-300 leading-relaxed">
              {lang === "en"
                ? `WARNING: This will permanently purge ${deleteTarget.name} (KGID: ${deleteTarget.kgid}) from the Employee and OfficerCredentials database. Historical audit trails will remain preserved under BSA §63.`
                : `ಎಚ್ಚರಿಕೆ: ಇದು ${deleteTarget.name} (KGID: ${deleteTarget.kgid}) ಅವರ ಖಾತೆಯನ್ನು ಶಾಶ್ವತವಾಗಿ ತೆಗೆದುಹಾಕುತ್ತದೆ.`}
            </p>

            <div>
              <label className="text-[10px] text-stone-400 uppercase font-bold block mb-1">
                Decommissioning Justification *
              </label>
              <textarea
                value={deleteReason}
                onChange={(e) => setDeleteReason(e.target.value)}
                rows={3}
                required
                className="w-full bg-stone-950 border border-stone-800 focus:border-rose-500 rounded-lg p-2.5 text-xs text-stone-200"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-stone-800">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="px-3.5 py-1.5 rounded-lg text-xs text-stone-400 hover:text-white uppercase font-bold cursor-pointer"
              >
                {lang === "en" ? "Cancel" : "ರದ್ದುಮಾಡಿ"}
              </button>
              <button
                onClick={confirmDelete}
                disabled={isSubmitting || deleteReason.trim().length < 5}
                className="px-4 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-black uppercase text-xs cursor-pointer disabled:opacity-50"
              >
                {isSubmitting ? (lang === "en" ? "Deleting…" : "ಅಳಿಸಲಾಗುತ್ತಿದೆ…") : (lang === "en" ? "Purge Record" : "ದಾಖಲೆ ಅಳಿಸಿ")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
