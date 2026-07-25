import React, { useState } from "react";
import { useApp } from "../AppContext";
import { API_BASE } from "../config";
import { Shield, Lock, Key, Languages } from "lucide-react";
import { VajraLogo } from "../components/VajraLogo";

export const LoginScreen: React.FC = () => {
  const {
    t,
    lang,
    setLang,
    setIsAuthenticated,
    setBadgeNumber,
    setRoleTier,
    setGlobalLoading,
    addToast,
  } = useApp();

  const [badgeInput, setBadgeInput] = useState("");
  const [passwordInput, setPasswordInput] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setErrorMsg(null);
    setIsSubmitting(true);

    // Front-end Validation: 7-digit numeric KGID
    const kgidPattern = /^\d{7}$/;
    const trimmedBadge = badgeInput.trim();
    if (!kgidPattern.test(trimmedBadge)) {
      setErrorMsg(
        lang === "en"
          ? "Badge ID (KGID) must be exactly 7 numeric digits (e.g., 4003385)"
          : "ಬ್ಯಾಡ್ಜ್ ಐಡಿ (KGID) ನಿಖರವಾಗಿ ೭ ಅಂಕಿಗಳಾಗಿರಬೇಕು (ಉದಾ. ೪೦೦೩೩೮೫)",
      );
      setIsSubmitting(false);
      return;
    }

    if (passwordInput.length < 4) {
      setErrorMsg(
        lang === "en"
          ? "Password must be at least 4 characters long"
          : "ರಹಸ್ಯಪದ ಕನಿಷ್ಠ ೪ ಅಕ್ಷರಗಳಾಗಿರಬೇಕು",
      );
      setIsSubmitting(false);
      return;
    }

    try {
      setGlobalLoading(true, lang === "en" ? "Authenticating with CCTNS gateway..." : "ಸಿಐಎಸ್ ದ್ವಾರದೊಂದಿಗೆ ದೃಢೀಕರಿಸಲಾಗುತ್ತಿದೆ...");
      
      const response = await fetch(`${API_BASE}/api/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          badge_no: trimmedBadge,
          password: passwordInput.trim(),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || "Authentication failed. Please verify credentials.");
      }

      const data = await response.json();
      
      // Store credentials locally for API requests
      localStorage.setItem("vajra_token", data.access_token);
      localStorage.setItem("vajra_badge", badgeInput);

      // Success Authentication
      setIsAuthenticated(true);
      setBadgeNumber(badgeInput);
      setRoleTier(data.role_tier === "supervisor" ? "supervisor" : "officer");

      addToast(
        lang === "en" ? "Secure Logon Established" : "ಸುರಕ್ಷಿತ ಲಾಗಿನ್ ಸ್ಥಾಪಿಸಲಾಗಿದೆ",
        lang === "en" 
          ? `Welcome Officer (KGID: ${badgeInput}). Credentials validated via live KSP directory.`
          : `ಸ್ವಾಗತ ಅಧಿಕಾರಿ (KGID: ${badgeInput}). ಸಿಐಎಸ್ ಪಟ್ಟಿಯ ಮೂಲಕ ರುಜುವಾತುಗಳನ್ನು ಪರಿಶೀಲಿಸಲಾಗಿದೆ.`,
        "Success"
      );
    } catch (err: any) {
      console.error("Authentication Error:", err);
      setErrorMsg(err.message || "Logon gateway unresponsive. Check backend server.");
    } finally {
      setGlobalLoading(false);
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#161412] flex flex-col items-center justify-center relative p-4 overflow-hidden">
      {/* Indian Tricolour Top Accent Strip */}
      <div className="tricolour-strip absolute top-0 left-0 right-0 z-50" />

      {/* Floating Language Switcher */}
      <div className="absolute top-6 right-6">
        <button
          onClick={() => setLang(lang === "en" ? "kn" : "en")}
          className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg border border-stone-800 bg-stone-900/60 hover:bg-stone-850/80 text-xs font-semibold text-[#C79A4E] hover:text-white transition-all shadow-lg"
        >
          <Languages className="w-3.5 h-3.5" />
          <span>{lang === "en" ? "ಕನ್ನಡ" : "English"}</span>
        </button>
      </div>

      {/* Staged entrance: crest settles in first, then the wordmark, then the
          auth card -- a deliberate sequence rather than one flat fade,
          each beat holding its pre-animation state via fill-mode:both. */}
      <div className="w-full max-w-md space-y-6">
        {/* State Seal and Headers */}
        <div className="text-center space-y-3">
          <div className="flex justify-center mx-auto pb-1 animate-crest-in">
            <VajraLogo animated={true} size={64} />
          </div>
          <div className="animate-fade-in" style={{ animationDelay: "280ms" }}>
            <h2 className="text-2xl font-black text-white tracking-tight">
              VAJRA / ವಜ್ರ
            </h2>
            <p className="text-[10px] font-mono tracking-widest text-[#C79A4E] uppercase font-bold mt-1.5">
              {lang === "en"
                ? "CCTNS SECURE CENTRAL SHELL"
                : "ಸಿಐಎಸ್ ಸುರಕ್ಷಿತ ಕೇಂದ್ರ ಶೆಲ್"}
            </p>
          </div>
        </div>

        {/* Central Auth Container */}
        <div
          className="glass-panel border border-stone-800 rounded-2xl p-8 shadow-2xl relative overflow-hidden w-full animate-slide-up"
          style={{ animationDelay: "420ms" }}
        >
          <div className="absolute top-0 right-0 p-4">
            <div className="w-12 h-12 bg-stone-900/40 rounded-full flex items-center justify-center">
              <VajraLogo animated={false} size={24} className="opacity-30" />
            </div>
          </div>

          <div className="border-b border-stone-850 pb-4 mb-6">
            <h3 className="text-xs font-black text-stone-350 uppercase tracking-wider flex items-center space-x-2">
              <Lock className="w-4 h-4 text-[#C79A4E]" />
              <span>{t.loginHeader}</span>
            </h3>
          </div>

          <form onSubmit={handleLogin} className="space-y-5">
            {errorMsg && (
              <div className="p-3.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-semibold leading-relaxed">
                {errorMsg}
              </div>
            )}

            {/* Badge ID Input */}
            <div className="space-y-1.5">
              <label className="block text-[11px] font-extrabold text-stone-400 uppercase tracking-wider">
                {t.badgeNo}
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={badgeInput}
                  onChange={(e) => setBadgeInput(e.target.value)}
                  placeholder="e.g. 4003385"
                  className="w-full bg-stone-950/60 border border-stone-800 focus:border-[#C79A4E] rounded-xl py-3 px-10 text-sm text-stone-100 placeholder-stone-600 focus:outline-none transition-all"
                  required
                />
                <Key className="w-4 h-4 text-stone-600 absolute left-3.5 top-3.5" />
              </div>
            </div>

            {/* Password Input */}
            <div className="space-y-1.5">
              <label className="block text-[11px] font-extrabold text-stone-400 uppercase tracking-wider">
                {t.password}
              </label>
              <div className="relative">
                <input
                  type="password"
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-stone-950/60 border border-stone-800 focus:border-[#C79A4E] rounded-xl py-3 px-10 text-sm text-stone-100 placeholder-stone-600 focus:outline-none transition-all"
                  required
                />
                <Lock className="w-4 h-4 text-stone-600 absolute left-3.5 top-3.5" />
              </div>
            </div>

            {/* Submit Button -- solid gold fill so the one primary action on
                this screen reads as primary, not another bordered ghost
                control indistinguishable from the language toggle. */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-[#C79A4E] hover:bg-[#d4ab5c] text-[#211F1D] py-3 rounded-xl font-bold text-xs uppercase tracking-wider transition-all duration-200 cursor-pointer disabled:opacity-60 disabled:cursor-wait shadow-md shadow-[#C79A4E]/20"
            >
              {isSubmitting
                ? (lang === "en" ? "Authenticating…" : "ದೃಢೀಕರಿಸಲಾಗುತ್ತಿದೆ…")
                : t.loginButton}
            </button>
          </form>
        </div>

        {/* Footer info */}
        <p
          className="text-center text-[10px] text-stone-600 leading-relaxed max-w-sm mx-auto animate-fade-in"
          style={{ animationDelay: "560ms" }}
        >
          {t.footerRights}
        </p>
      </div>
    </div>
  );
};
