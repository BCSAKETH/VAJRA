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
    setGlobalLoading,
    addToast,
  } = useApp();

  const [badgeInput, setBadgeInput] = useState("");
  const [passwordInput, setPasswordInput] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    // Front-end Validation: 7-digit numeric KGID
    const kgidPattern = /^\d{7}$/;
    if (!kgidPattern.test(badgeInput)) {
      setErrorMsg(
        lang === "en"
          ? "Badge ID (KGID) must be exactly 7 numeric digits (e.g., 4003385)"
          : "ಬ್ಯಾಡ್ಜ್ ಐಡಿ (KGID) ನಿಖರವಾಗಿ ೭ ಅಂಕಿಗಳಾಗಿರಬೇಕು (ಉದಾ. ೪೦೦೩೩೮೫)",
      );
      return;
    }

    if (passwordInput.length < 4) {
      setErrorMsg(
        lang === "en"
          ? "Password must be at least 4 characters long"
          : "ರಹಸ್ಯಪದ ಕನಿಷ್ಠ ೪ ಅಕ್ಷರಗಳಾಗಿರಬೇಕು",
      );
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
          badge_no: badgeInput,
          password: passwordInput,
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
    }
  };

  return (
    <div className="min-h-screen bg-[#070F1E] flex flex-col items-center justify-center relative p-4 overflow-hidden">
      {/* Indian Tricolour Top Accent Strip */}
      <div className="tricolour-strip absolute top-0 left-0 right-0 z-50" />

      {/* Floating Language Switcher */}
      <div className="absolute top-6 right-6">
        <button
          onClick={() => setLang(lang === "en" ? "kn" : "en")}
          className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg border border-slate-800 bg-slate-900/60 hover:bg-slate-850/80 text-xs font-semibold text-[#00C6AD] hover:text-white transition-all shadow-lg"
        >
          <Languages className="w-3.5 h-3.5" />
          <span>{lang === "en" ? "ಕನ್ನಡ" : "English"}</span>
        </button>
      </div>

      <div className="w-full max-w-md space-y-6 animate-slide-up">
        {/* State Seal and Headers */}
        <div className="text-center space-y-3">
          <div className="flex justify-center mx-auto pb-1">
            <VajraLogo animated={true} size={64} />
          </div>
          <div>
            <h2 className="text-2xl font-black text-white tracking-tight">
              VAJRA / ವಜ್ರ
            </h2>
            <p className="text-[10px] font-mono tracking-widest text-[#00C6AD] uppercase font-bold mt-1.5">
              {lang === "en"
                ? "CCTNS SECURE CENTRAL SHELL"
                : "ಸಿಐಎಸ್ ಸುರಕ್ಷಿತ ಕೇಂದ್ರ ಶೆಲ್"}
            </p>
          </div>
        </div>

        {/* Central Auth Container */}
        <div className="glass-panel border border-slate-800 rounded-2xl p-8 shadow-2xl relative overflow-hidden w-full">
          <div className="absolute top-0 right-0 p-4">
            <div className="w-12 h-12 bg-slate-900/40 rounded-full flex items-center justify-center">
              <VajraLogo animated={false} size={24} className="opacity-30" />
            </div>
          </div>

          <div className="border-b border-slate-850 pb-4 mb-6">
            <h3 className="text-xs font-black text-slate-350 uppercase tracking-wider flex items-center space-x-2">
              <Lock className="w-4 h-4 text-[#00C6AD]" />
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
              <label className="block text-[11px] font-extrabold text-slate-400 uppercase tracking-wider">
                {t.badgeNo}
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={badgeInput}
                  onChange={(e) => setBadgeInput(e.target.value)}
                  placeholder="e.g. 4003385"
                  className="w-full bg-slate-950/60 border border-slate-800 focus:border-[#00C6AD] rounded-xl py-3 px-10 text-sm text-slate-100 placeholder-slate-600 focus:outline-none transition-all"
                  required
                />
                <Key className="w-4 h-4 text-slate-600 absolute left-3.5 top-3.5" />
              </div>
            </div>

            {/* Password Input */}
            <div className="space-y-1.5">
              <label className="block text-[11px] font-extrabold text-slate-400 uppercase tracking-wider">
                {t.password}
              </label>
              <div className="relative">
                <input
                  type="password"
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-slate-950/60 border border-slate-800 focus:border-[#00C6AD] rounded-xl py-3 px-10 text-sm text-slate-100 placeholder-slate-600 focus:outline-none transition-all"
                  required
                />
                <Lock className="w-4 h-4 text-slate-600 absolute left-3.5 top-3.5" />
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              className="w-full bg-slate-900 border border-slate-800 hover:border-[#00C6AD]/40 text-slate-100 hover:bg-[#00C6AD]/10 py-3 rounded-xl font-bold text-xs uppercase tracking-wider transition-all duration-200 cursor-pointer shadow-md shadow-[#00C6AD]/5"
            >
              {t.loginButton}
            </button>
          </form>
        </div>

        {/* Footer info */}
        <p className="text-center text-[10px] text-slate-600 leading-relaxed max-w-sm mx-auto">
          {t.footerRights}
        </p>
      </div>
    </div>
  );
};
