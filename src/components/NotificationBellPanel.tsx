import React, { useEffect, useState } from "react";
import { useApp } from "../AppContext";
import { API_BASE } from "../config";
import { Bell, Check, X, ShieldAlert, AlertTriangle, Info, CheckCircle, Trash2, CheckSquare } from "lucide-react";

interface CoworkInvitation {
  invitation_id: string;
  session_id: string;
  case_no: string;
  inviter_name: string;
  created_at: string;
}

export const NotificationBellPanel: React.FC = () => {
  const {
    t,
    lang,
    notifications,
    clearNotifications,
    markAllAsRead,
    removeNotification,
  } = useApp();

  const [invitations, setInvitations] = useState<CoworkInvitation[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"alerts" | "cowork">("alerts");

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

  const unreadAlertsCount = notifications.filter((n) => !n.read).length;
  const pendingCoworkCount = invitations.length;
  const totalCount = unreadAlertsCount + pendingCoworkCount;

  const getSeverityStyles = (severity: string) => {
    switch (severity) {
      case "Critical":
        return {
          bg: "bg-rose-500/10 border-rose-500/30",
          text: "text-rose-450",
          icon: <ShieldAlert className="w-3.5 h-3.5 text-rose-500 shrink-0" />,
        };
      case "Warning":
        return {
          bg: "bg-amber-500/10 border-amber-500/30",
          text: "text-amber-500",
          icon: <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0" />,
        };
      case "Success":
        return {
          bg: "bg-[#00C6AD]/10 border-[#00C6AD]/30",
          text: "text-[#00C6AD]",
          icon: <CheckCircle className="w-3.5 h-3.5 text-[#00C6AD] shrink-0" />,
        };
      default:
        return {
          bg: "bg-blue-500/10 border-blue-500/30",
          text: "text-blue-400",
          icon: <Info className="w-3.5 h-3.5 text-blue-400 shrink-0" />,
        };
    }
  };

  return (
    <div className="relative">
      {/* Bell Icon Trigger */}
      <button
        onClick={() => setIsOpen((v) => !v)}
        className={`relative p-2 rounded-lg border transition-all cursor-pointer ${
          isOpen
            ? "border-[#00C6AD]/40 bg-slate-800 text-[#00C6AD]"
            : "border-slate-800 hover:border-slate-700 bg-slate-900/60 hover:bg-slate-850/80 text-slate-400 hover:text-slate-200"
        }`}
      >
        <Bell className="w-4 h-4" />
        {totalCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[9px] font-black text-white ring-2 ring-slate-950 animate-pulse">
            {totalCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl z-50 overflow-hidden">
          {/* Header Tabs */}
          <div className="flex border-b border-slate-850">
            <button
              onClick={() => setActiveTab("alerts")}
              className={`flex-1 py-2 text-center text-[10px] font-extrabold uppercase tracking-wider transition-colors cursor-pointer border-b-2 ${
                activeTab === "alerts"
                  ? "text-[#00C6AD] border-[#00C6AD] bg-slate-850/30"
                  : "text-slate-500 border-transparent hover:text-slate-350"
              }`}
            >
              {lang === "en" ? "System Alerts" : "ಸಿಸ್ಟಮ್ ಎಚ್ಚರಿಕೆಗಳು"}{" "}
              {unreadAlertsCount > 0 && `(${unreadAlertsCount})`}
            </button>
            <button
              onClick={() => setActiveTab("cowork")}
              className={`flex-1 py-2 text-center text-[10px] font-extrabold uppercase tracking-wider transition-colors cursor-pointer border-b-2 ${
                activeTab === "cowork"
                  ? "text-[#00C6AD] border-[#00C6AD] bg-slate-850/30"
                  : "text-slate-500 border-transparent hover:text-slate-350"
              }`}
            >
              {t.coworkInvitationsTitle || (lang === "en" ? "Cowork Invites" : "ಸಹೋದ್ಯೋಗ ಆಹ್ವಾನಗಳು")}{" "}
              {pendingCoworkCount > 0 && `(${pendingCoworkCount})`}
            </button>
          </div>

          {/* Active Tab Content */}
          <div className="max-h-80 overflow-y-auto">
            {activeTab === "alerts" ? (
              <div className="flex flex-col h-full">
                {/* System Alerts Header Actions */}
                {notifications.length > 0 && (
                  <div className="flex justify-between items-center px-3 py-1.5 bg-slate-950/40 border-b border-slate-850 text-[9px] font-mono text-slate-450 font-black">
                    <button
                      onClick={markAllAsRead}
                      className="flex items-center gap-1 hover:text-[#00C6AD] transition-colors cursor-pointer"
                    >
                      <CheckSquare className="w-3 h-3" />
                      {lang === "en" ? "Mark all read" : "ಎಲ್ಲವನ್ನೂ ಓದಿದ್ದು ಎಂದು ಗುರುತಿಸಿ"}
                    </button>
                    <button
                      onClick={clearNotifications}
                      className="flex items-center gap-1 hover:text-rose-400 transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-3 h-3" />
                      {lang === "en" ? "Clear all" : "ಎಲ್ಲವನ್ನೂ ತೆರವುಗೊಳಿಸಿ"}
                    </button>
                  </div>
                )}

                {/* System Alerts List */}
                {notifications.length === 0 ? (
                  <div className="px-3 py-8 text-center text-[11px] text-slate-500 font-mono">
                    {lang === "en" ? "No system alerts" : "ಯಾವುದೇ ಸಿಸ್ಟಮ್ ಎಚ್ಚರಿಕೆಗಳಿಲ್ಲ"}
                  </div>
                ) : (
                  <div className="divide-y divide-slate-850">
                    {notifications.map((notif) => {
                      const style = getSeverityStyles(notif.severity);
                      return (
                        <div
                          key={notif.id}
                          className={`p-3 transition-colors flex gap-2.5 items-start group relative ${
                            notif.read ? "opacity-60 bg-slate-900/10" : "bg-slate-850/15"
                          }`}
                        >
                          {style.icon}
                          <div className="flex-1 space-y-0.5 min-w-0 pr-4">
                            <div className="flex justify-between items-baseline">
                              <span className={`text-[10px] font-black uppercase tracking-wider font-mono ${style.text}`}>
                                {notif.title}
                              </span>
                              <span className="text-[9px] text-slate-500 font-mono shrink-0">
                                {notif.timestamp}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-350 leading-relaxed font-sans break-words">
                              {notif.message}
                            </p>
                          </div>

                          {/* Individual Delete / Dismiss Button */}
                          <button
                            onClick={() => removeNotification(notif.id)}
                            className="absolute right-2 top-2 p-1 rounded hover:bg-slate-800 text-slate-500 hover:text-rose-400 opacity-0 group-hover:opacity-100 transition-all cursor-pointer"
                            title={lang === "en" ? "Dismiss" : "ತೆಗೆದುಹಾಕಿ"}
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : (
              /* Cowork Invitations */
              <div>
                {invitations.length === 0 ? (
                  <div className="px-3 py-8 text-center text-[11px] text-slate-500 font-mono">
                    {t.noPendingInvitations || (lang === "en" ? "No pending invitations" : "ಯಾವುದೇ ಸಹೋದ್ಯೋಗ ಆಹ್ವಾನಗಳಿಲ್ಲ")}
                  </div>
                ) : (
                  <div className="divide-y divide-slate-850">
                    {invitations.map((inv) => (
                      <div key={inv.invitation_id} className="p-3 bg-slate-850/10">
                        <p className="text-[11px] text-slate-300 font-sans leading-relaxed">
                          <span className="font-bold text-[#00C6AD]">{inv.inviter_name}</span>{" "}
                          {t.invitedYouOnCase || (lang === "en" ? "invited you on Case" : "ಪ್ರಕರಣದಲ್ಲಿ ನಿಮ್ಮನ್ನು ಆಹ್ವಾನಿಸಿದ್ದಾರೆ")}
                          {inv.case_no ? ` #${inv.case_no}` : ""}.
                        </p>
                        <div className="flex gap-2 mt-2.5">
                          <button
                            onClick={() => respond(inv.invitation_id, "accept")}
                            className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1 rounded bg-[#00C6AD]/10 border border-[#00C6AD]/20 hover:border-[#00C6AD]/40 text-[#00C6AD] text-[10px] font-black uppercase tracking-wider hover:bg-[#00C6AD]/20 transition-all cursor-pointer"
                          >
                            <Check className="w-3.5 h-3.5" />
                            {t.accept || (lang === "en" ? "Accept" : "ಸ್ವೀಕರಿಸಿ")}
                          </button>
                          <button
                            onClick={() => respond(inv.invitation_id, "reject")}
                            className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1 rounded bg-slate-800 border border-slate-700 text-slate-400 text-[10px] font-black uppercase tracking-wider hover:bg-slate-750 transition-all cursor-pointer"
                          >
                            <X className="w-3.5 h-3.5" />
                            {t.reject || (lang === "en" ? "Reject" : "ತಿರಸ್ಕರಿಸಿ")}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
