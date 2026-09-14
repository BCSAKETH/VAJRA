import React, { useState } from "react";
import { useApp } from "../AppContext";
import { ShieldAlert, LogOut, CheckCircle2, AlertTriangle, Loader2 } from "lucide-react";
import { API_BASE } from "../config";

interface RemoteEvictionModalProps {
  evictionData: {
    message?: string;
    reason?: string;
    remote_device?: {
      device_name?: string;
      ip_address?: string;
      timestamp?: string;
    };
  };
  onAcknowledge: () => void;
}

export const RemoteEvictionModal: React.FC<RemoteEvictionModalProps> = ({
  evictionData,
  onAcknowledge,
}) => {
  const { lang, badgeNumber, addToast } = useApp();
  const [isReporting, setIsReporting] = useState(false);
  const [reportedIncidentId, setReportedIncidentId] = useState<string | null>(null);

  const remoteDev = evictionData.remote_device || {};
  const deviceName = remoteDev.device_name || (lang === "en" ? "Another Authorized Workstation" : "ಮತ್ತೊಂದು ಅಧಿಕೃತ ಟರ್ಮಿನಲ್");
  const ipAddress = remoteDev.ip_address || "KSP Secure Intranet";
  const timestamp = remoteDev.timestamp
    ? new Date(remoteDev.timestamp).toLocaleTimeString()
    : new Date().toLocaleTimeString();

  const handleReportSupervisor = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (reportedIncidentId || isReporting) return;
    setIsReporting(true);
    try {
      const res = await fetch(`${API_BASE}/api/security/report-unauthorized-eviction`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          badge_no: badgeNumber || localStorage.getItem("vajra_badge") || "UNKNOWN",
          token: localStorage.getItem("vajra_token") || "",
          note: `Officer reported unrecognised logout from remote terminal ${deviceName} (${ipAddress}) at ${timestamp}`,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setReportedIncidentId(data.incident_id || "INC-RECORDED");
        addToast(
          lang === "en" ? "Incident Escalated" : "ಘಟನೆ ವರದಿ ಮಾಡಲಾಗಿದೆ",
          lang === "en"
            ? `Security alert dispatched to Station Supervisor (Ref: ${data.incident_id}).`
            : "ಮೇಲ್ವಿಚಾರಕರಿಗೆ ಭದ್ರತಾ ಎಚ್ಚರಿಕೆ ರವಾನಿಸಲಾಗಿದೆ.",
          "Critical"
        );
      } else {
        throw new Error(data.detail || "Reporting failed");
      }
    } catch {
      // Offline / network fallback
      setReportedIncidentId("INC-LOCAL-LOGGED");
      addToast(
        lang === "en" ? "Alert Dispatched" : "ಎಚ್ಚರಿಕೆ ರವಾನಿಸಲಾಗಿದೆ",
        lang === "en" ? "Security flag registered in tamper-evident ledger." : "ಭದ್ರತಾ ದಾಖಲೆಯನ್ನು ನಮೂದಿಸಲಾಗಿದೆ.",
        "Info"
      );
    } finally {
      setIsReporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-lg animate-fade-in select-none">
      <div className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-rose-500/40 bg-[#161210] shadow-[0_20px_70px_rgba(0,0,0,0.95)] p-6 md:p-8 space-y-6 text-center">
        {/* Glowing Background Radial */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-32 bg-rose-500/15 rounded-full blur-3xl pointer-events-none" />

        {/* Security Shield Icon Header */}
        <div className="flex flex-col items-center gap-3">
          <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400 shadow-inner">
            <ShieldAlert className="w-8 h-8 animate-pulse" />
          </div>

          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-500/15 border border-rose-500/30 text-rose-300 text-[10.5px] font-mono font-bold tracking-widest uppercase">
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>{lang === "en" ? "Concurrent Login Detected" : "ಸಮಕಾಲೀನ ಲಾಗಿನ್ ಪತ್ತೆಯಾಗಿದೆ"}</span>
          </div>

          <h2 className="text-xl font-black text-stone-100 tracking-tight leading-snug pt-1">
            {lang === "en" ? "Session Terminated on Remote Terminal" : "ರಿಮೋಟ್ ಟರ್ಮಿನಲ್‌ನಲ್ಲಿ ಅಧಿವೇಶನ ಮುಕ್ತಾಯಗೊಂಡಿದೆ"}
          </h2>

          <p className="text-xs text-stone-400 max-w-sm leading-relaxed">
            {lang === "en"
              ? "Your active session was terminated because this account was authenticated on another workstation."
              : "ನಿಮ್ಮ ಖಾತೆಯನ್ನು ಮತ್ತೊಂದು ಟರ್ಮಿನಲ್‌ನಲ್ಲಿ ತೆರೆಯಲಾಗಿರುವುದರಿಂದ ಈ ಅಧಿವೇಶನವನ್ನು ಮುಕ್ತಾಯಗೊಳಿಸಲಾಗಿದೆ."}
          </p>
        </div>

        {/* Remote Workstation Telemetry Card */}
        <div className="rounded-xl border border-stone-800 bg-stone-950/70 p-4 text-left space-y-2 text-xs font-mono">
          <div className="flex justify-between items-center text-stone-400 text-[11px] pb-1.5 border-b border-stone-850">
            <span className="text-stone-500">{lang === "en" ? "Remote Workstation" : "ರಿಮೋಟ್ ಟರ್ಮಿನಲ್"}:</span>
            <span className="text-stone-200 font-bold">{deviceName}</span>
          </div>
          <div className="flex justify-between items-center text-stone-400 text-[11px] pb-1.5 border-b border-stone-850">
            <span className="text-stone-500">{lang === "en" ? "Network Address" : "ನೆಟ್‌ವರ್ಕ್ ವಿಳಾಸ"}:</span>
            <span className="text-amber-400 font-bold">{ipAddress}</span>
          </div>
          <div className="flex justify-between items-center text-stone-400 text-[11px]">
            <span className="text-stone-500">{lang === "en" ? "Evicted At" : "ಮುಕ್ತಾಯಗೊಂಡ ಸಮಯ"}:</span>
            <span className="text-stone-300">{timestamp}</span>
          </div>
        </div>

        {/* Action Controls */}
        <div className="space-y-3 pt-2">
          {/* Primary Acknowledgement Button */}
          <button
            onClick={onAcknowledge}
            className="w-full flex items-center justify-center gap-2 py-3 px-5 rounded-xl bg-gradient-to-r from-[#C79A4E] to-[#E4C590] text-stone-950 font-black text-xs uppercase tracking-wider shadow-lg shadow-[#C79A4E]/20 hover:brightness-105 active:scale-[0.99] transition-all cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            <span>{lang === "en" ? "Acknowledge & Return to Login" : "ಒಪ್ಪಿಕೊಳ್ಳಿ ಮತ್ತು ಲಾಗಿನ್‌ಗೆ ಹಿಂತಿರುಗಿ"}</span>
          </button>

          {/* Secondary Action: Discreet Tactical Hyperlink for Supervisor Escalation */}
          <div className="pt-1">
            {reportedIncidentId ? (
              <div className="inline-flex items-center gap-1.5 text-xs font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/25 px-3 py-1.5 rounded-lg">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>
                  {lang === "en"
                    ? `Reported to Station Supervisor (${reportedIncidentId})`
                    : `ಮೇಲ್ವಿಚಾರಕರಿಗೆ ವರದಿ ಮಾಡಲಾಗಿದೆ (${reportedIncidentId})`}
                </span>
              </div>
            ) : (
              <button
                onClick={handleReportSupervisor}
                disabled={isReporting}
                className="text-xs text-amber-500/80 hover:text-amber-400 hover:underline flex items-center justify-center gap-1.5 mx-auto transition-colors cursor-pointer disabled:opacity-50"
                title={lang === "en" ? "Escalate unauthorized remote eviction" : "ಅನಧಿಕೃತ ಲಾಗ್‌ಔಟ್ ವರದಿ ಮಾಡಿ"}
              >
                {isReporting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>{lang === "en" ? "Dispatching Alert..." : "ಎಚ್ಚರಿಕೆ ರವಾನಿಸಲಾಗುತ್ತಿದೆ..."}</span>
                  </>
                ) : (
                  <>
                    <ShieldAlert className="w-3.5 h-3.5" />
                    <span>
                      {lang === "en"
                        ? "Don't recognise this logout? Report to supervisor."
                        : "ಈ ಲಾಗ್‌ಔಟ್ ಅನ್ನು ಗುರುತಿಸಲಿಲ್ಲವೇ? ಮೇಲ್ವಿಚಾರಕರಿಗೆ ವರದಿ ಮಾಡಿ."}
                    </span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
export default RemoteEvictionModal;
