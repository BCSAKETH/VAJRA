import React, { useState } from "react";
import { useApp } from "../AppContext";
import { ShieldAlert, Monitor, Laptop, Smartphone, AlertTriangle, ArrowRight, XCircle, Loader2 } from "lucide-react";
import { API_BASE } from "../config";

interface DeviceConflictModalProps {
  conflictData: {
    message?: string;
    active_session: {
      device_name: string;
      ip_address: string;
      login_time?: string;
      last_active?: string;
      is_alive?: boolean;
    };
    continuation_token: string;
  };
  onSuccess: (authData: any) => void;
  onCancel: () => void;
}

export const DeviceConflictModal: React.FC<DeviceConflictModalProps> = ({
  conflictData,
  onSuccess,
  onCancel,
}) => {
  const { lang, addToast } = useApp();
  const [isResolving, setIsResolving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const { active_session, continuation_token } = conflictData;

  const handleResolveConflict = async () => {
    setIsResolving(true);
    setErrorMsg(null);
    try {
      const res = await fetch(`${API_BASE}/api/auth/resolve-session-conflict`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ continuation_token }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || (lang === "en" ? "Conflict resolution failed. Please retry login." : "ಅಧಿವೇಶನ ಪರಿಹಾರ ವಿಫಲವಾಗಿದೆ."));
      }

      addToast(
        lang === "en" ? "Terminal Cleared" : "ಟರ್ಮಿನಲ್ ತೆರವುಗೊಳಿಸಲಾಗಿದೆ",
        lang === "en" ? "Prior workstation session terminated. Access granted to this terminal." : "ಹಿಂದಿನ ಟರ್ಮಿನಲ್ ಅಧಿವೇಶನವನ್ನು ಮುಕ್ತಾಯಗೊಳಿಸಲಾಗಿದೆ.",
        "Success"
      );

      onSuccess(data);
    } catch (err: any) {
      console.error("Conflict resolution failed:", err);
      setErrorMsg(err.message || (lang === "en" ? "Failed to terminate remote session." : "ದೋಷ ಸಂಭವಿಸಿದೆ."));
    } finally {
      setIsResolving(false);
    }
  };

  const getDeviceIcon = (devName: string) => {
    const lower = devName.toLowerCase();
    if (lower.includes("mobile") || lower.includes("android") || lower.includes("ios") || lower.includes("phone")) {
      return <Smartphone className="w-5 h-5 text-[#C79A4E]" />;
    }
    if (lower.includes("laptop") || lower.includes("mac")) {
      return <Laptop className="w-5 h-5 text-[#C79A4E]" />;
    }
    return <Monitor className="w-5 h-5 text-[#C79A4E]" />;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-2xl overflow-hidden rounded-2xl border border-[#C79A4E]/40 bg-[#141210] shadow-[0_10px_50px_rgba(0,0,0,0.9)] grid grid-cols-1 md:grid-cols-12">
        {/* Left Column: Visual Hardware Illustration & Police Alert Badge */}
        <div className="md:col-span-5 p-6 bg-gradient-to-b from-[#1c1815] to-[#12100e] border-b md:border-b-0 md:border-r border-[#C79A4E]/20 flex flex-col justify-between relative overflow-hidden">
          <div className="absolute -right-8 -bottom-8 w-36 h-36 bg-[#C79A4E]/10 rounded-full blur-2xl pointer-events-none" />

          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-400 text-[10px] font-mono uppercase tracking-wider mb-4">
              <ShieldAlert className="w-3.5 h-3.5" />
              <span>{lang === "en" ? "Device Limit Reached" : "ಸಾಧನ ಮಿತಿ ತಲುಪಿದೆ"}</span>
            </div>

            <h3 className="text-base font-black text-stone-100 tracking-tight leading-snug">
              {lang === "en" ? "1-Terminal Clearance Policy" : "1-ಟರ್ಮಿನಲ್ ಅನುಮತಿ ನೀತಿ"}
            </h3>
            <p className="text-xs text-stone-400 mt-2 leading-relaxed">
              {lang === "en"
                ? "Karnataka Police Cyber Security Protocol §23 mandates that an active officer account may only be operational on a single verified workstation."
                : "ಕರ್ನಾಟಕ ಪೊಲೀಸ್ ಸೈಬರ್ ಭದ್ರತಾ ಪ್ರೋಟೋಕಾಲ್ §23 ರ ಪ್ರಕಾರ, ಅಧಿಕಾರಿಯ ಖಾತೆಯು ಒಂದೇ ಸಮಯದಲ್ಲಿ ಒಂದೇ ಟರ್ಮಿನಲ್‌ನಲ್ಲಿ ಕಾರ್ಯನಿರ್ವಹಿಸಬಹುದು."}
            </p>
          </div>

          <div className="mt-6 pt-4 border-t border-stone-800/80">
            <div className="flex items-center gap-2 text-[10px] font-mono text-stone-500">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
              <span>{lang === "en" ? "Active Session Running" : "ಸಕ್ರಿಯ ಅಧಿವೇಶನ ಚಾಲನೆಯಲ್ಲಿದೆ"}</span>
            </div>
          </div>
        </div>

        {/* Right Column: Active Terminal Card & Action Buttons */}
        <div className="md:col-span-7 p-6 flex flex-col justify-between space-y-5">
          <div>
            <div className="flex items-center justify-between pb-2 border-b border-stone-850">
              <h4 className="text-xs font-bold text-stone-300 uppercase tracking-wider font-mono">
                {lang === "en" ? "Log Out 1 Device to Continue" : "ಮುಂದುವರಿಯಲು ಸಕ್ರಿಯ ಸಾಧನ ಲಾಗ್‌ಔಟ್ ಮಾಡಿ"}
              </h4>
              <button
                onClick={onCancel}
                disabled={isResolving}
                className="text-stone-500 hover:text-stone-300 transition-colors p-1"
                title={lang === "en" ? "Cancel & Return" : "ರದ್ದುಮಾಡಿ"}
              >
                <XCircle className="w-4 h-4" />
              </button>
            </div>

            {errorMsg && (
              <div className="mt-3 p-2.5 rounded-lg bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Active Device Card */}
            <div className="mt-4 p-3.5 rounded-xl border border-stone-800 bg-stone-950/60 flex items-start gap-3">
              <div className="p-2.5 rounded-lg bg-[#C79A4E]/10 border border-[#C79A4E]/25 shrink-0 mt-0.5">
                {getDeviceIcon(active_session.device_name || "")}
              </div>
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex items-baseline justify-between gap-2">
                  <h5 className="text-xs font-bold text-stone-100 truncate">
                    {active_session.device_name || (lang === "en" ? "Desktop Workstation" : "ಡೆಸ್ಕ್‌ಟಾಪ್ ಟರ್ಮಿನಲ್")}
                  </h5>
                  <span className="text-[10px] font-mono text-amber-400/90 shrink-0">
                    {active_session.last_active || (lang === "en" ? "Active recently" : "ಇತ್ತೀಚೆಗೆ ಸಕ್ರಿಯ")}
                  </span>
                </div>
                <p className="text-[11px] font-mono text-stone-400 truncate">
                  IP: <span className="text-stone-300">{active_session.ip_address || "10.14.22.84"}</span>
                </p>
                <div className="flex items-center gap-1.5 text-[9.5px] font-mono text-stone-500 pt-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  <span>{lang === "en" ? "Live CCTNS Dialout Active" : "ಲೈವ್ CCTNS ಸಂಪರ್ಕ ಸಕ್ರಿಯವಾಗಿದೆ"}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="space-y-2 pt-2">
            <button
              onClick={handleResolveConflict}
              disabled={isResolving}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-gradient-to-r from-[#C79A4E] to-[#E4C590] text-stone-950 font-bold text-xs shadow-lg shadow-[#C79A4E]/20 hover:brightness-105 active:scale-[0.99] transition-all cursor-pointer disabled:opacity-50 disabled:cursor-wait"
            >
              {isResolving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>{lang === "en" ? "Terminating Remote Terminal..." : "ಟರ್ಮಿನಲ್ ಮುಕ್ತಾಯಗೊಳಿಸಲಾಗುತ್ತಿದೆ..."}</span>
                </>
              ) : (
                <>
                  <span>{lang === "en" ? "Terminate Terminal Session & Continue" : "ಅಧಿವೇಶನ ಮುಕ್ತಾಯಗೊಳಿಸಿ ಮುಂದುವರಿಯಿರಿ"}</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>

            <button
              onClick={onCancel}
              disabled={isResolving}
              className="w-full py-2 text-center text-xs font-mono text-stone-400 hover:text-stone-200 transition-colors cursor-pointer"
            >
              {lang === "en" ? "Cancel & Return to Login" : "ರದ್ದುಮಾಡಿ ಮತ್ತು ಲಾಗಿನ್‌ಗೆ ಹಿಂತಿರುಗಿ"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
export default DeviceConflictModal;
