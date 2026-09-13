import React, { useState, useEffect } from "react";
import { EyeOff, Lock } from "lucide-react";
import { useApp } from "../AppContext";

// E.7 (was Finals.md Part VII / "ScreenCaptureShield.tsx", honest half only
// -- see D.12): dims the screen on focus loss / tab-hide as a casual-capture
// deterrent. Per D.12's correction, this component ONLY does what a webpage
// can actually do:
//   - Does NOT intercept PrintScreen (the OS can capture the screen buffer
//     before the browser even receives the key event).
//   - Does NOT purge the clipboard.
//   - Does NOT block Ctrl+P / Ctrl+S / DevTools hotkeys (these only annoy a
//     legitimate officer workflow without stopping anything a screenshot
//     taken outside the browser can't already do).
// All UI copy here says "reduces the chance of," never "prevents" -- the
// actual, honest behavior change from Finals.md's original overclaiming.
export const FocusLossCurtain: React.FC = () => {
  const { isAuthenticated, badgeNumber, lang } = useApp();
  const [isActive, setIsActive] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) return;
    const handleBlur = () => setIsActive(true);
    const handleFocus = () => setIsActive(false);
    const handleVisibility = () => setIsActive(document.hidden);

    window.addEventListener("blur", handleBlur);
    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      window.removeEventListener("blur", handleBlur);
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [isAuthenticated]);

  if (!isAuthenticated || !isActive) return null;

  return (
    <div className="fixed inset-0 z-[99999] bg-[#0c0a09] flex flex-col items-center justify-center p-6 text-center select-none">
      <div className="w-full max-w-md p-8 rounded-2xl bg-stone-950 border border-amber-500/40 shadow-2xl space-y-5">
        <div className="mx-auto w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
          <EyeOff className="w-8 h-8" />
        </div>
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-500/15 border border-rose-500/30 text-rose-400 text-[10px] font-mono font-bold uppercase tracking-wider">
            <Lock className="w-3 h-3" />
            {lang === "en" ? "Confidential Police Record" : "ಗೌಪ್ಯ ಪೊಲೀಸ್ ದಾಖಲೆ"}
          </div>
          <h3 className="text-base font-black text-stone-100 font-mono tracking-wide uppercase">
            {lang === "en" ? "Display Dimmed" : "ಪರದೆ ಮಂದಗೊಳಿಸಲಾಗಿದೆ"}
          </h3>
          {/* D.12: honest copy -- "reduces the chance of," never "prevents" */}
          <p className="text-xs text-stone-400 leading-relaxed font-sans">
            {lang === "en"
              ? "Window lost focus. This reduces the chance of an accidental casual screen capture while you're away — it does not block deliberate photography or screen recording."
              : "ವಿಂಡೋ ಫೋಕಸ್ ಕಳೆದುಕೊಂಡಿದೆ. ಇದು ಆಕಸ್ಮಿಕ ಸ್ಕ್ರೀನ್ ಕ್ಯಾಪ್ಚರ್ ಸಾಧ್ಯತೆಯನ್ನು ಕಡಿಮೆ ಮಾಡುತ್ತದೆ -- ಉದ್ದೇಶಪೂರ್ವಕ ಛಾಯಾಗ್ರಹಣ ಅಥವಾ ಸ್ಕ್ರೀನ್ ರೆಕಾರ್ಡಿಂಗ್ ಅನ್ನು ಇದು ತಡೆಯುವುದಿಲ್ಲ."}
          </p>
        </div>
        <div className="p-3 rounded-xl bg-stone-900/60 border border-stone-850 text-[11px] font-mono text-stone-400">
          {lang === "en" ? "Active Session:" : "ಸಕ್ರಿಯ ಅಧಿವೇಶನ:"}{" "}
          <span className="text-[#C79A4E] font-bold">{badgeNumber || "KSP-AUTHORIZED"}</span>
        </div>
      </div>
    </div>
  );
};

export default FocusLossCurtain;
