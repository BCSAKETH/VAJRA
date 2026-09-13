import React, { useState, useEffect, useRef } from "react";
import { ShieldAlert, X, Send, AlertCircle } from "lucide-react";
import { useApp } from "../AppContext";

// E.1 (was Finals.md Part I): collects a real written justification before an
// export/POCSO/district-access request is raised. D.8 note: this client-side
// check is a UX convenience only -- the actual enforcement lives server-side
// in the request-creation endpoints (main.py), since a direct API call could
// otherwise bypass this component entirely.
interface ReasonCollectionModalProps {
  isOpen: boolean;
  title: string;
  subtitle: string;
  actionLabel?: string;
  placeholder?: string;
  minChars?: number;
  onClose: () => void;
  onSubmit: (reason: string) => Promise<void> | void;
}

export const ReasonCollectionModal: React.FC<ReasonCollectionModalProps> = ({
  isOpen,
  title,
  subtitle,
  actionLabel,
  placeholder,
  minChars = 10,
  onClose,
  onSubmit,
}) => {
  const { lang } = useApp();
  const [reason, setReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      setReason("");
      setError(null);
      setIsSubmitting(false);
      setTimeout(() => textareaRef.current?.focus(), 100);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const trimmed = reason.trim();
  const isValid = trimmed.length >= minChars;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid) {
      setError(
        lang === "en"
          ? `Please provide a detailed justification (minimum ${minChars} characters).`
          : `ದಯವಿಟ್ಟು ವಿವರವಾದ ಸಮರ್ಥನೆಯನ್ನು ಒದಗಿಸಿ (ಕನಿಷ್ಠ ${minChars} ಅಕ್ಷರಗಳು).`
      );
      return;
    }
    setError(null);
    setIsSubmitting(true);
    try {
      await onSubmit(trimmed);
      onClose();
    } catch (err: any) {
      setError(err.message || (lang === "en" ? "Failed to submit request." : "ವಿನಂತಿ ಸಲ್ಲಿಸಲು ವಿಫಲವಾಗಿದೆ."));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/80 backdrop-blur-md animate-fade-in">
      <div className="w-full max-w-lg glass-panel border border-[#C79A4E]/30 rounded-2xl p-6 shadow-2xl space-y-4 relative bg-[#121110]/95">
        <button
          onClick={onClose}
          disabled={isSubmitting}
          className="absolute top-4 right-4 text-stone-400 hover:text-stone-200 transition-colors cursor-pointer p-1"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-start gap-3 border-b border-stone-850 pb-4">
          <div className="w-10 h-10 rounded-xl bg-[#C79A4E]/10 border border-[#C79A4E]/30 flex items-center justify-center shrink-0">
            <ShieldAlert className="w-5 h-5 text-[#C79A4E]" />
          </div>
          <div>
            <h3 className="text-sm font-black text-stone-100 uppercase tracking-wider font-mono">
              {title}
            </h3>
            <p className="text-[11px] text-stone-400 mt-0.5 leading-relaxed font-sans">
              {subtitle}
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="flex items-center justify-between text-[11px] font-mono font-bold text-stone-300 uppercase tracking-wide">
              <span>{lang === "en" ? "Operational Justification" : "ಕಾರ್ಯಾಚರಣೆಯ ಸಮರ್ಥನೆ"}</span>
              <span className={`text-[10px] ${isValid ? "text-emerald-400" : "text-amber-400"}`}>
                {trimmed.length}/{minChars} {lang === "en" ? "chars min" : "ಕನಿಷ್ಠ ಅಕ್ಷರಗಳು"}
              </span>
            </label>
            <textarea
              ref={textareaRef}
              rows={4}
              value={reason}
              onChange={(e) => {
                setReason(e.target.value);
                if (error) setError(null);
              }}
              disabled={isSubmitting}
              placeholder={
                placeholder ||
                (lang === "en"
                  ? "Enter specific case diary reference, court order, or operational necessity..."
                  : "ಪ್ರಕರಣದ ಉಲ್ಲೇಖ ಅಥವಾ ಕಾರ್ಯಾಚರಣೆಯ ಅಗತ್ಯವನ್ನು ನಮೂದಿಸಿ...")
              }
              className="w-full bg-stone-900/90 border border-stone-750 focus:border-[#C79A4E] rounded-xl p-3 text-xs text-stone-100 placeholder:text-stone-600 focus:outline-none transition-colors resize-none font-mono"
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 text-[11px] text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-lg p-2.5">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 rounded-lg border border-stone-750 hover:bg-stone-850 text-xs font-mono font-bold text-stone-400 hover:text-stone-200 transition-colors cursor-pointer"
            >
              {lang === "en" ? "Cancel" : "ರದ್ದುಮಾಡಿ"}
            </button>
            <button
              type="submit"
              disabled={!isValid || isSubmitting}
              className="px-4 py-2 rounded-lg bg-[#C79A4E] hover:bg-[#d8a95d] disabled:opacity-50 text-stone-950 text-xs font-mono font-black uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer shadow-lg shadow-[#C79A4E]/10"
            >
              {isSubmitting ? (
                <div className="w-4 h-4 border-2 border-stone-950 border-t-transparent rounded-full animate-spin" />
              ) : (
                <Send className="w-3.5 h-3.5" />
              )}
              <span>{actionLabel || (lang === "en" ? "Submit Request" : "ವಿನಂತಿ ಸಲ್ಲಿಸಿ")}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ReasonCollectionModal;
