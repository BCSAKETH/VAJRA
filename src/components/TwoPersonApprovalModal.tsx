import React, { useState } from "react";
import { useApp } from "../AppContext";
import { API_BASE } from "../config";
import { UserCheck, ShieldAlert, X, Lock } from "lucide-react";
import { BorderBeam } from "./ui/border-beam";
import { RippleButton } from "./ui/ripple-button";

interface TwoPersonApprovalModalProps {
  actionName: string;
  isOpen: boolean;
  onClose: () => void;
  // C.14: the password is now forwarded, not discarded after this modal's own
  // /api/auth/login pre-check -- the actual state-changing endpoint (e.g.
  // /review) must re-verify it server-side itself; a client-side pre-check the
  // real endpoint never sees enforces nothing against a direct API call.
  onApprove: (supervisorBadge: string, supervisorPassword: string) => void;
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

      // Valid Supervisor -- forward the password too (C.14), the caller's
      // own state-changing endpoint re-verifies it server-side.
      onApprove(supBadge, supPassword);
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/85 backdrop-blur-md animate-fade-in">
      <div className="w-full max-w-md glass-panel border border-[#C79A4E]/40 rounded-2xl p-6 shadow-2xl space-y-4 relative overflow-hidden bg-stone-950/95">
        <BorderBeam size={180} duration={12} colorFrom="#C79A4E" colorTo="#F59E0B" borderWidth={1.5} />
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-stone-400 hover:text-stone-200 cursor-pointer z-10"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-3 border-b border-stone-850 pb-3">
          <div className="w-10 h-10 bg-[#C79A4E]/10 border border-[#C79A4E]/30 text-[#C79A4E] rounded-full flex items-center justify-center shrink-0 shadow-inner">
            <UserCheck className="w-5 h-5 text-[#C79A4E]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-black text-stone-100 uppercase tracking-wider font-mono">
                {t.tpTitle}
              </h3>
              <span className="text-[8px] font-mono uppercase px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                §65B IEA
              </span>
            </div>
            <p className="text-[10px] text-stone-400 font-mono">
              {t.tpActionLabel} {actionName}
            </p>
          </div>
        </div>

        <div className="flex gap-2.5 bg-amber-500/10 border border-amber-500/25 rounded-lg p-3 text-[11px] leading-relaxed text-amber-300">
          <ShieldAlert className="w-5 h-5 shrink-0 text-amber-400 mt-0.5" />
          <span>
            {t.tpWarning}
          </span>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 pt-1.5 relative z-10">
          {errorMsg && (
            <div className="p-3 bg-rose-500/15 border border-rose-500/30 text-rose-300 rounded-lg text-[11px] leading-relaxed font-semibold">
              {errorMsg}
            </div>
          )}

          {/* Supervisor Badge */}
          <div className="space-y-1">
            <label className="block text-[10px] font-black text-stone-400 uppercase font-mono">
              {t.tpSupervisorBadgeLabel}
            </label>
            <input
              type="text"
              value={supBadge}
              onChange={(e) => setSupBadge(e.target.value)}
              placeholder="e.g. 4003399"
              className="w-full bg-stone-900/80 border border-stone-800 focus:border-[#C79A4E] rounded-xl py-2.5 px-3 text-xs text-stone-200 focus:outline-none transition-all shadow-inner"
              required
            />
          </div>

          {/* Supervisor Password */}
          <div className="space-y-1">
            <label className="block text-[10px] font-black text-stone-400 uppercase font-mono">
              {t.tpSupervisorPasswordLabel}
            </label>
            <div className="relative">
              <input
                type="password"
                value={supPassword}
                onChange={(e) => setSupPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-stone-900/80 border border-stone-800 focus:border-[#C79A4E] rounded-xl py-2.5 px-3 pr-10 text-xs text-stone-200 focus:outline-none transition-all shadow-inner"
                required
              />
              <Lock className="w-3.5 h-3.5 text-stone-500 absolute right-3 top-3.5" />
            </div>
          </div>

          {/* Submit */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-stone-900 border border-stone-800 hover:border-stone-700 text-stone-400 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer"
            >
              {t.tpCancel}
            </button>
            <RippleButton
              type="submit"
              disabled={isLoading}
              rippleColor="#C79A4E"
              className="flex-1 bg-[#C79A4E]/15 hover:bg-[#C79A4E]/25 border border-[#C79A4E]/40 text-[#C79A4E] py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all disabled:opacity-50 cursor-pointer shadow-lg"
            >
              {isLoading ? t.tpVerifying : t.tpVerifyApprove}
            </RippleButton>
          </div>
        </form>
      </div>
    </div>
  );
};
