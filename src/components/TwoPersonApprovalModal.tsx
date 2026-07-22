import React, { useState } from "react";
import { useApp } from "../AppContext";
import { API_BASE } from "../config";
import { UserCheck, ShieldAlert, X, Lock } from "lucide-react";

interface TwoPersonApprovalModalProps {
  actionName: string;
  isOpen: boolean;
  onClose: () => void;
  onApprove: (supervisorBadge: string) => void;
}

export const TwoPersonApprovalModal: React.FC<TwoPersonApprovalModalProps> = ({
  actionName,
  isOpen,
  onClose,
  onApprove,
}) => {
  const { badgeNumber, lang, t } = useApp();
  const [supBadge, setSupBadge] = useState("");
  const [supPassword, setSupPassword] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    // Front-end Checks
    if (supBadge === badgeNumber) {
      setErrorMsg(
        lang === "en"
          ? "Two-Person Integrity Error: Supervisor cannot be the same as the active operator."
          : "ದ್ವಿ-ವ್ಯಕ್ತಿ ಸಮಗ್ರತೆಯ ದೋಷ: ಮೇಲ್ವಿಚಾರಕರು ಸಕ್ರಿಯ ಆಪರೇಟರ್ ಆಗಿರಲು ಸಾಧ್ಯವಿಲ್ಲ."
      );
      return;
    }

    const kgidPattern = /^\d{7}$/;
    if (!kgidPattern.test(supBadge)) {
      setErrorMsg(
        lang === "en"
          ? "Supervisor KGID must be exactly 7 numeric digits."
          : "ಮೇಲ್ವಿಚಾರಕರ KGID ನಿಖರವಾಗಿ ೭ ಅಂಕಿಗಳಾಗಿರಬೇಕು."
      );
      return;
    }

    try {
      setIsLoading(true);
      
      // Perform credential check on the server
      const response = await fetch(`${API_BASE}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          badge_no: supBadge,
          password: supPassword,
        }),
      });

      if (!response.ok) {
        throw new Error(
          lang === "en"
            ? "Supervisor authentication failed. Unauthorized credentials."
            : "ಮೇಲ್ವಿಚಾರಕರ ದೃಢೀಕರಣ ವಿಫಲವಾಗಿದೆ. ಅನಧಿಕೃತ ರುಜುವಾತುಗಳು."
        );
      }

      const data = await response.json();
      // Previously this only checked the badge differed from the active
      // operator's own badge -- any two valid officer accounts could
      // co-sign each other regardless of rank. role_tier is now resolved
      // server-side from the co-signer's real RankID.
      if (data.role_tier !== "supervisor") {
        throw new Error(
          lang === "en"
            ? "Two-Person Integrity Error: Co-signing officer does not hold Supervisor-tier clearance (PI and above)."
            : "ದ್ವಿ-ವ್ಯಕ್ತಿ ಸಮಗ್ರತೆಯ ದೋಷ: ಸಹಿ ಮಾಡುವ ಅಧಿಕಾರಿಗೆ ಮೇಲ್ವಿಚಾರಕ ಹಂತದ ಅನುಮತಿ ಇಲ್ಲ."
        );
      }

      // Valid Supervisor
      onApprove(supBadge);
      setSupBadge("");
      setSupPassword("");
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to authenticate supervisor.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-md glass-panel border border-[#00C6AD]/30 rounded-2xl p-6 shadow-2xl space-y-4 relative">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-200 cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-3 border-b border-slate-850 pb-3">
          <div className="w-10 h-10 bg-[#00C6AD]/10 border border-[#00C6AD]/25 text-[#00C6AD] rounded-full flex items-center justify-center shrink-0">
            <UserCheck className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-xs font-black text-slate-100 uppercase tracking-wider font-mono">
              {t.tpTitle}
            </h3>
            <p className="text-[10px] text-slate-500 font-mono">
              {t.tpActionLabel} {actionName}
            </p>
          </div>
        </div>

        <div className="flex gap-2.5 bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 text-[11px] leading-relaxed text-amber-450">
          <ShieldAlert className="w-5 h-5 shrink-0 text-amber-500 mt-0.5" />
          <span>
            {t.tpWarning}
          </span>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 pt-1.5">
          {errorMsg && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-450 rounded-lg text-[11px] leading-relaxed font-semibold">
              {errorMsg}
            </div>
          )}

          {/* Supervisor Badge */}
          <div className="space-y-1">
            <label className="block text-[10px] font-black text-slate-450 uppercase font-mono">
              {t.tpSupervisorBadgeLabel}
            </label>
            <input
              type="text"
              value={supBadge}
              onChange={(e) => setSupBadge(e.target.value)}
              placeholder="e.g. 4003399"
              className="w-full bg-slate-950/60 border border-slate-850 focus:border-[#00C6AD] rounded-xl py-2.5 px-3 text-xs text-slate-200 focus:outline-none transition-all"
              required
            />
          </div>

          {/* Supervisor Password */}
          <div className="space-y-1">
            <label className="block text-[10px] font-black text-slate-450 uppercase font-mono">
              {t.tpSupervisorPasswordLabel}
            </label>
            <div className="relative">
              <input
                type="password"
                value={supPassword}
                onChange={(e) => setSupPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-slate-950/60 border border-slate-850 focus:border-[#00C6AD] rounded-xl py-2.5 px-3 pr-10 text-xs text-slate-200 focus:outline-none transition-all"
                required
              />
              <Lock className="w-3.5 h-3.5 text-slate-600 absolute right-3 top-3.5" />
            </div>
          </div>

          {/* Submit */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-400 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all"
            >
              {t.tpCancel}
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="flex-1 bg-[#00C6AD]/10 hover:bg-[#00C6AD]/20 border border-[#00C6AD]/30 text-[#00C6AD] py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all disabled:opacity-50"
            >
              {isLoading ? t.tpVerifying : t.tpVerifyApprove}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
