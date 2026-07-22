import React, { useEffect, useState } from "react";
import { useApp } from "../AppContext";
import { API_BASE } from "../config";
import { Bell, Check, X } from "lucide-react";

interface CoworkInvitation {
  invitation_id: string;
  session_id: string;
  case_no: string;
  inviter_name: string;
  created_at: string;
}

export const CoworkInvitationsPanel: React.FC = () => {
  const { t } = useApp();
  const [invitations, setInvitations] = useState<CoworkInvitation[]>([]);
  const [isOpen, setIsOpen] = useState(false);

  const loadInvitations = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/cowork/invitations`, {
        headers: { "Authorization": `Bearer ${localStorage.getItem("vajra_token") || ""}` },
      });
      if (res.ok) {
        setInvitations(await res.json());
      }
    } catch (err) {
      console.error("Failed to load cowork invitations:", err);
    }
  };

  useEffect(() => {
    loadInvitations();
    // Real-time push would need a dedicated notification channel; polling
    // every 20s for pending invitations is a reasonable tradeoff for
    // something this infrequent (unlike in-session messages, which use a
    // real WebSocket for live updates).
    const interval = setInterval(loadInvitations, 20000);
    return () => clearInterval(interval);
  }, []);

  const respond = async (invitationId: string, action: "accept" | "reject") => {
    try {
      const res = await fetch(`${API_BASE}/api/cowork/invitations/${invitationId}/respond`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${localStorage.getItem("vajra_token") || ""}`,
        },
        body: JSON.stringify({ action }),
      });
      if (res.ok) {
        setInvitations((prev) => prev.filter((i) => i.invitation_id !== invitationId));
      }
    } catch (err) {
      console.error("Failed to respond to invitation:", err);
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen((v) => !v)}
        className="p-2 rounded-lg border border-slate-800 hover:border-slate-700 bg-slate-900/60 hover:bg-slate-850/80 text-slate-400 hover:text-slate-200 transition-all cursor-pointer"
      >
        <Bell className="w-4 h-4" />
      </button>
      {invitations.length > 0 && (
        <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-rose-500 animate-ping" />
      )}

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-72 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl z-50 overflow-hidden">
          <div className="px-3 py-2 border-b border-slate-850 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
            {t.coworkInvitationsTitle}
          </div>
          <div className="max-h-72 overflow-y-auto">
            {invitations.length === 0 ? (
              <div className="px-3 py-6 text-center text-[11px] text-slate-600">{t.noPendingInvitations}</div>
            ) : (
              invitations.map((inv) => (
                <div key={inv.invitation_id} className="px-3 py-2.5 border-b border-slate-850 last:border-0">
                  <p className="text-xs text-slate-300">
                    <span className="font-bold text-[#00C6AD]">{inv.inviter_name}</span> {t.invitedYouOnCase}
                    {inv.case_no ? ` ${t.onCaseLabel} ${inv.case_no}` : ""}.
                  </p>
                  <div className="flex gap-2 mt-2">
                    <button
                      onClick={() => respond(inv.invitation_id, "accept")}
                      className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg bg-[#00C6AD]/10 border border-[#00C6AD]/30 text-[#00C6AD] text-[11px] font-bold hover:bg-[#00C6AD]/20 transition-all cursor-pointer"
                    >
                      <Check className="w-3 h-3" /> {t.accept}
                    </button>
                    <button
                      onClick={() => respond(inv.invitation_id, "reject")}
                      className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-400 text-[11px] font-bold hover:bg-slate-750 transition-all cursor-pointer"
                    >
                      <X className="w-3 h-3" /> {t.reject}
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};
