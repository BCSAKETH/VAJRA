import React, { useState } from "react";
import { KeyRound, X, AlertTriangle, ShieldCheck, Check } from "lucide-react";
import { useApp } from "../AppContext";
import { API_BASE } from "../config";

interface ChangePasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  isMandatory?: boolean;
}

export const ChangePasswordModal: React.FC<ChangePasswordModalProps> = ({ isOpen, onClose, isMandatory = false }) => {
  const { lang, addToast } = useApp();
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    if (newPassword.length < 8) {
      setValidationError(
        lang === "en"
          ? "New password must be at least 8 characters long."
          : "ಹೊಸ ರಹಸ್ಯಪದ ಕನಿಷ್ಠ ೮ ಅಕ್ಷರಗಳಾಗಿರಬೇಕು."
      );
      return;
    }

    if (newPassword !== confirmNewPassword) {
      setValidationError(
        lang === "en"
          ? "New password and Confirm password do not match."
          : "ಹೊಸ ರಹಸ್ಯಪದ ಮತ್ತು ದೃಢೀಕರಣ ರಹಸ್ಯಪದ ಹೊಂದಿಕೆಯಾಗುತ್ತಿಲ್ಲ."
      );
      return;
    }

    if (oldPassword === newPassword) {
      setValidationError(
        lang === "en"
          ? "New password cannot be identical to your old password."
          : "ಹೊಸ ರಹಸ್ಯಪದವು ಹಳೆಯ ರಹಸ್ಯಪದದಂತೆಯೇ ಇರಬಾರದು."
      );
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/api/auth/change-password`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("vajra_token") || ""}`
        },
        body: JSON.stringify({
          old_password: oldPassword,
          new_password: newPassword,
          confirm_new_password: confirmNewPassword
        })
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || (lang === "en" ? "Password change failed." : "ರಹಸ್ಯಪದ ಬದಲಾವಣೆ ವಿಫಲವಾಗಿದೆ."));
      }

      addToast(
        lang === "en" ? "Password Updated" : "ರಹಸ್ಯಪದ ನವೀಕರಿಸಲಾಗಿದೆ",
        lang === "en"
          ? "Your logon credentials have been securely updated. Please use the new password on your next login."
          : "ನಿಮ್ಮ ಲಾಗಿನ್ ರುಜುವಾತುಗಳನ್ನು ಯಶಸ್ವಿಯಾಗಿ ನವೀಕರಿಸಲಾಗಿದೆ.",
        "Success"
      );
      setOldPassword("");
      setNewPassword("");
      setConfirmNewPassword("");
      onClose();
    } catch (err: any) {
      setValidationError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-stone-900 border border-stone-800 rounded-2xl p-6 shadow-2xl space-y-4 animate-fade-in relative">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-stone-800 pb-3">
          <div className="flex items-center gap-2 text-[#C79A4E]">
            <KeyRound className="w-5 h-5" />
            <h3 className="text-sm font-black uppercase tracking-wider text-stone-100">
              {isMandatory
                ? (lang === "en" ? "Mandatory Password Initialization" : "ಕಡ್ಡಾಯ ರಹಸ್ಯಪದ ಪ್ರಾರಂಭಿಸುವಿಕೆ")
                : (lang === "en" ? "Reset Logon Password" : "ಲಾಗಿನ್ ರಹಸ್ಯಪದವನ್ನು ಮರುಹೊಂದಿಸಿ")}
            </h3>
          </div>
          {!isMandatory && (
            <button
              onClick={onClose}
              className="text-stone-500 hover:text-stone-300 transition-colors p-1 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Security Alert / Advisory */}
        <div className="bg-[#C79A4E]/[0.06] border border-[#C79A4E]/25 rounded-lg p-3 text-[11px] font-sans text-stone-300 leading-relaxed">
          {isMandatory ? (
            lang === "en" ? (
              <>
                <span className="text-amber-400 font-bold">First-Time Logon Policy:</span> Your account was provisioned with a temporary administrative password. You must set a private, secure password before accessing VAJRA intelligence systems.
              </>
            ) : (
              <>
                <span className="text-amber-400 font-bold">ಮೊದಲ ಲಾಗಿನ್ ನೀತಿ:</span> ನಿಮ್ಮ ಖಾತೆಯನ್ನು ತಾತ್ಕಾಲಿಕ ಆಡಳಿತಾತ್ಮಕ ರಹಸ್ಯಪದದೊಂದಿಗೆ ರಚಿಸಲಾಗಿದೆ. ವಜ್ರ ವ್ಯವಸ್ಥೆಯನ್ನು ಬಳಸುವ ಮೊದಲು ನೀವು ಹೊಸ ಖಾಸಗಿ ರಹಸ್ಯಪದವನ್ನು ಹೊಂದಿಸಬೇಕು.
              </>
            )
          ) : lang === "en" ? (
            <>
              Modifying your logon credentials will be{" "}
              <span className="text-[#C79A4E] font-bold">permanently recorded</span> in the Supervisor Audit Ledger under BSA 2023 §63.
            </>
          ) : (
            <>
              ನಿಮ್ಮ ಲಾಗಿನ್ ರುಜುವಾತುಗಳನ್ನು ಬದಲಾಯಿಸುವುದನ್ನು ಬಿಎಸ್‌ಎ ೨೦೨೩ §೬೩ ಅಡಿಯಲ್ಲಿ{" "}
              <span className="text-[#C79A4E] font-bold">ಆಡಿಟ್ ಲೆಡ್ಜರ್‌ನಲ್ಲಿ ದಾಖಲಿಸಲಾಗುತ್ತದೆ</span>.
            </>
          )}
        </div>

        {validationError && (
          <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-mono">
            {validationError}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
          {/* Old Password */}
          <div>
            <label className="text-[10px] text-stone-400 uppercase font-bold block mb-1">
              {lang === "en" ? "Old Password" : "ಹಳೆಯ ರಹಸ್ಯಪದ"}
            </label>
            <input
              type="password"
              value={oldPassword}
              onChange={(e) => setOldPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full bg-stone-950 border border-stone-800 focus:border-[#C79A4E] rounded-lg px-3 py-2 text-stone-100 placeholder-stone-600 focus:outline-none"
              required
            />
          </div>

          {/* New Password */}
          <div>
            <label className="text-[10px] text-stone-400 uppercase font-bold block mb-1">
              {lang === "en" ? "New Password (min 8 characters)" : "ಹೊಸ ರಹಸ್ಯಪದ (ಕನಿಷ್ಠ ೮ ಅಕ್ಷರಗಳು)"}
            </label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full bg-stone-950 border border-stone-800 focus:border-[#C79A4E] rounded-lg px-3 py-2 text-stone-100 placeholder-stone-600 focus:outline-none"
              required
            />
          </div>

          {/* Confirm New Password */}
          <div>
            <label className="text-[10px] text-stone-400 uppercase font-bold block mb-1">
              {lang === "en" ? "Confirm New Password" : "ಹೊಸ ರಹಸ್ಯಪದವನ್ನು ದೃಢೀಕರಿಸಿ"}
            </label>
            <input
              type="password"
              value={confirmNewPassword}
              onChange={(e) => setConfirmNewPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full bg-stone-950 border border-stone-800 focus:border-[#C79A4E] rounded-lg px-3 py-2 text-stone-100 placeholder-stone-600 focus:outline-none"
              required
            />
          </div>

          {/* Buttons */}
          <div className="flex justify-end gap-2 pt-3 border-t border-stone-800">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 rounded-lg text-xs text-stone-400 hover:text-white uppercase font-bold transition-colors cursor-pointer"
            >
              {lang === "en" ? "Cancel" : "ರದ್ದುಮಾಡಿ"}
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-1.5 rounded-lg bg-[#C79A4E] text-stone-950 font-black uppercase text-xs hover:bg-[#E4C590] transition-colors cursor-pointer disabled:opacity-50 shadow-md shadow-[#C79A4E]/10"
            >
              {isSubmitting
                ? (lang === "en" ? "Auditing…" : "ದಾಖಲಿಸಲಾಗುತ್ತಿದೆ…")
                : (lang === "en" ? "Update Password" : "ರಹಸ್ಯಪದ ನವೀಕರಿಸಿ")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
