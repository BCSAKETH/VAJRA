import React, { useState } from "react";
import { useApp } from "../AppContext";
import {
  Shield,
  ArrowRight,
  Lock,
  Key,
  Info,
  HelpCircle,
  ArrowLeft,
  Languages,
} from "lucide-react";

export const LoginScreen: React.FC = () => {
  const {
    t,
    lang,
    setLang,
    setIsAuthenticated,
    setBadgeNumber,
    setCurrentScreen,
    setGlobalLoading,
    addToast,
  } = useApp();
  const [badgeInput, setBadgeInput] = useState("4003385");
  const [passwordInput, setPasswordInput] = useState("vajra-secure");
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
      
      const response = await fetch("http://localhost:8000/api/auth/login", {
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
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col items-center justify-center relative p-4 overflow-hidden">
      {/* STRICT DESIGN RULE 1: NIC Flag Strip */}
      <div className="h-[4px] absolute top-0 left-0 right-0 w-full flex z-50 select-none">
        <div className="flex-1 bg-[#FF9933]"></div>
        <div className="flex-1 bg-white"></div>
        <div className="flex-1 bg-[#138808]"></div>
      </div>

      {/* Floating Language Switcher in Login Page */}
      <div className="absolute top-6 right-6">
        <button
          onClick={() => setLang(lang === "en" ? "kn" : "en")}
          className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white shadow-sm text-[12px] font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
        >
          <Languages className="w-3.5 h-3.5 text-[#1D4ED8]" />
          <span className="kn-text leading-[1.8] font-medium">
            {lang === "en" ? "ಕನ್ನಡ" : "English"}
          </span>
        </button>
      </div>

      <div className="w-full max-w-md space-y-6">
        {/* State Seal and Headers */}
        <div className="text-center space-y-2">
          <div className="inline-flex w-16 h-16 rounded-full bg-white border border-slate-200 shadow-sm items-center justify-center mx-auto text-[#1D4ED8]">
            <Shield className="w-9 h-9 text-[#1D4ED8]" />
          </div>
          <div>
            <h2 className="text-2xl font-display font-extrabold text-slate-950 tracking-tight leading-none">
              VAJRA / ವಜ್ರ
            </h2>
            <p className="text-[11px] font-mono tracking-widest text-[#1D4ED8] uppercase font-bold mt-1">
              {lang === "en"
                ? "CCTNS SECURE CENTRAL SHELL"
                : "ಸಿಐಎಸ್ ಸುರಕ್ಷಿತ ಕೇಂದ್ರ ಶೆಲ್"}
            </p>
          </div>
        </div>

        {/* Central Auth Container */}
        <div
          id="login-container"
          className="bg-white border border-slate-200 rounded-2xl p-8 shadow-xl relative overflow-hidden w-full"
        >
          <div className="absolute top-0 right-0 p-4">
            <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center opacity-50">
              <Shield className="w-6 h-6 text-slate-300" />
            </div>
          </div>

          <div className="border-b border-slate-100 pb-4 mb-6">
            <h3 className="text-[14px] font-bold text-slate-900 uppercase tracking-wide flex items-center space-x-2 kn-text">
              <Lock className="w-4 h-4 text-[#1D4ED8]" />
              <span>{t.loginHeader}</span>
            </h3>
            <p className="text-[11px] text-slate-400 mt-0.5 uppercase tracking-wider">
              Authorized personnel only
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-6">
            {/* Bilingual labels above inputs */}
            <div className="space-y-1">
              <label
                htmlFor="badge-no-input"
                className="block text-[11px] uppercase tracking-wider text-slate-500 font-bold kn-text"
              >
                {lang === "en"
                  ? "Badge No. / ಬ್ಯಾಡ್ಜ್ ಸಂಖ್ಯೆ"
                  : "ಬ್ಯಾಡ್ಜ್ ಸಂಖ್ಯೆ / Badge No."}
              </label>
              <div className="relative">
                <input
                  id="badge-no-input"
                  type="text"
                  value={badgeInput}
                  onChange={(e) => setBadgeInput(e.target.value)}
                  placeholder="4003385"
                  className="w-full h-11 pl-10 pr-4 bg-slate-50 border border-slate-200 rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]/20 transition-all font-mono font-medium"
                  required
                />
                <Shield className="w-4 h-4 text-slate-400 absolute left-3 top-[14px]" />
              </div>
            </div>

            <div className="space-y-1">
              <label
                htmlFor="password-input"
                className="block text-[11px] uppercase tracking-wider text-slate-500 font-bold kn-text"
              >
                {lang === "en" ? "Password / ರಹಸ್ಯಪದ" : "ರಹಸ್ಯಪದ / Password"}
              </label>
              <div className="relative">
                <input
                  id="password-input"
                  type="password"
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  placeholder="••••••••"
                  className="w-full h-11 pl-10 pr-4 bg-slate-50 border border-slate-200 rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]/20 transition-all"
                  required
                />
                <Key className="w-4 h-4 text-slate-400 absolute left-3 top-[14px]" />
              </div>
            </div>

            {/* Error Message Section */}
            {errorMsg && (
              <div className="p-3 bg-red-50 border-l-2 border-[#EF4444] rounded-lg text-[12px] text-red-700 flex items-start space-x-2 animate-fade-in">
                <Info className="w-4 h-4 text-[#EF4444] shrink-0 mt-0.5" />
                <span className="kn-text leading-[1.6]">{errorMsg}</span>
              </div>
            )}

            {/* Information Alert - No Color Only Status */}
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-600 flex items-start space-x-2.5">
              <Info className="w-4 h-4 text-[#1D4ED8] shrink-0 mt-0.5" />
              <div className="text-[12px] space-y-0.5 leading-[1.6]">
                <div className="font-bold text-slate-800 flex items-center space-x-1">
                  <span>Demo Credentials Pre-configured</span>
                </div>
                <div className="text-slate-500 kn-text text-[11px]">
                  {lang === "en"
                    ? "Preloaded for the 2026 Datathon. Unlocked for rapid prototype auditing."
                    : "೨೦೨೬ ರ ದತ್ತಾಂಶ ಹ್ಯಾಕಥಾನ್ ಗಾಗಿ ಮೊದಲೇ ಹೊಂದಿಸಲಾದ ರುಜುವಾತುಗಳು."}
                </div>
              </div>
            </div>

            {/* CTA action buttons */}
            <div className="space-y-3 pt-2">
              {/* STRICT RULE 6: Only one filled --blue-primary button per screen. All others are outline/ghost */}
              <button
                id="btn-login-submit"
                type="submit"
                className="w-full h-11 bg-[#1D4ED8] text-white rounded-lg font-bold text-[13px] uppercase tracking-widest shadow-lg shadow-[#1D4ED8]/20 hover:bg-[#1D4ED8]/90 transition-all flex items-center justify-center space-x-2 cursor-pointer"
              >
                <Shield className="w-4 h-4 text-amber-300" />
                <span className="kn-text">{t.loginButton}</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <button
                id="btn-login-back"
                type="button"
                onClick={() => setCurrentScreen("landing")}
                className="w-full h-11 border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 text-[13px] font-bold rounded-lg flex items-center justify-center space-x-2 transition-colors duration-150 cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
                <span className="kn-text">
                  {lang === "en"
                    ? "Back to Portal Intro"
                    : "ಮುಖಪುಟಕ್ಕೆ ಹಿಂತಿರುಗಿ"}
                </span>
              </button>
            </div>
          </form>

          <div className="mt-8 pt-6 border-t border-slate-100 flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-[#10B981]"></div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              System Online: node-blr-01
            </span>
          </div>
        </div>

        {/* Informative Warning Footer */}
        <div className="text-center">
          <p className="text-[11px] text-slate-400 kn-text">
            {lang === "en"
              ? "Warning: State Intel asset. Unauthorised logins are punishable under IPC & Information Technology Act India."
              : "ಗಮನಿಸಿ: ರಾಜ್ಯ ರಕ್ಷಣಾ ಸ್ವತ್ತು. ಅನಧಿಕೃತ ಲಾಗಿನ್ ಮೂಲಕ ಡೇಟಾ ದುರುಪಯೋಗ ಕಂಡುಬಂದರೆ ಶಿಕ್ಷಾರ್ಹ ಅಪರಾಧ."}
          </p>
        </div>
      </div>
    </div>
  );
};
