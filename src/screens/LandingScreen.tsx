import React from "react";
import { useApp } from "../AppContext";
import {
  Shield,
  Languages,
  Mic,
  Network,
  Map,
  Activity,
  ArrowRight,
  Database,
  Server,
} from "lucide-react";

export const LandingScreen: React.FC = () => {
  const { t, lang, setLang, setCurrentScreen } = useApp();

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col relative overflow-hidden font-sans">
      {/* STRICT DESIGN RULE 1: NIC Flag Strip */}
      <div className="h-[4px] absolute top-0 left-0 right-0 w-full flex z-50 select-none">
        <div className="flex-1 bg-[#FF9933]"></div>
        <div className="flex-1 bg-white"></div>
        <div className="flex-1 bg-[#138808]"></div>
      </div>

      {/* Government Identification Ribbon */}
      <header className="border-b border-slate-200 bg-white shadow-sm mt-[4px]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            {/* Minimalist emblem badge mimicking KSP Seal styling */}
            <div className="w-10 h-10 rounded-lg bg-[#1D4ED8] flex items-center justify-center text-white font-bold shadow-md shadow-blue-500/10 border border-blue-600">
              <Shield className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <div className="text-[11px] font-bold uppercase tracking-widest text-[#1D4ED8] leading-tight">
                {lang === "en"
                  ? "Karnataka State Police"
                  : "ಕರ್ನಾಟಕ ರಾಜ್ಯ ಪೊಲೀಸ್"}
              </div>
              <div className="text-[13px] font-semibold text-slate-800 leading-none mt-0.5 kn-text">
                {lang === "en"
                  ? "State Crime Records Bureau (SCRB)"
                  : "ರಾಜ್ಯ ಅಪರಾಧ ದಾಖಲೆಗಳ ಬ್ಯೂರೋ (SCRB)"}
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            {/* Bilingual toggle button inline */}
            <button
              onClick={() => setLang(lang === "en" ? "kn" : "en")}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded border border-slate-200 bg-slate-50 text-[12px] font-semibold text-slate-700 hover:bg-slate-100 transition-colors"
              title="Switch language / ಭಾಷೆಯನ್ನು ಬದಲಾಯಿಸಿ"
            >
              <Languages className="w-3.5 h-3.5 text-[#1D4ED8]" />
              <span className="kn-text leading-[1.8] font-medium">
                {lang === "en" ? "ಕನ್ನಡ" : "English"}
              </span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Pre-Login Hero section */}
      <main className="flex-grow max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 flex flex-col justify-center">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          {/* Hero details (left) */}
          <div className="lg:col-span-7 space-y-6">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#00C6AD]/5 border border-[#00C6AD]/20">
              <div className="w-1.5 h-1.5 rounded-full bg-[#00C6AD]"></div>
              <span className="text-[11px] font-bold text-[#00C6AD] uppercase tracking-wider leading-[1.8] kn-text">
                AI-Driven Investigation / ಕೃತಕ ಬುದ್ಧಿಮತ್ತೆ ಆಧಾರಿತ ತನಿಖೆ
              </span>
            </div>

            <h1 className="text-4xl sm:text-5xl font-display font-extrabold text-slate-900 tracking-tight leading-[1.1] kn-text">
              {t.landingHeroTitle}
            </h1>

            <p className="text-[15px] leading-[1.8] text-slate-600 max-w-2xl kn-text">
              {t.landingDesc}
            </p>

            <div className="p-4 bg-white border-l-2 border-[#10B981] bg-[#10B981]/5 rounded-r-lg space-y-1">
              <div className="text-[11px] uppercase tracking-wider font-semibold text-[#138808]">
                System Grounding Index
              </div>
              <div className="text-[13px] text-slate-700 leading-relaxed font-mono">
                Dataset Coverage: 1,100+ stations | 1.6M Classified NCRB/CCTNS
                Records
              </div>
            </div>

            <div className="flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-4 pt-2">
              {/* STRICT RULE 6: Only one filled --blue-primary button per screen. All others are ghost/outline */}
              <button
                id="btn-signin-nav"
                onClick={() => setCurrentScreen("login")}
                className="bg-[#1D4ED8] text-white hover:bg-[#1D4ED8]/90 text-[13px] font-bold px-6 py-3.5 rounded-lg shadow-lg shadow-[#1D4ED8]/20 flex items-center justify-center space-x-2 transition-all duration-150 cursor-pointer"
              >
                <Shield className="w-4 h-4 text-amber-300" />
                <span className="kn-text uppercase tracking-wider">
                  {t.signIn}
                </span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <button
                id="btn-read-docs"
                onClick={() =>
                  alert(
                    lang === "en"
                      ? "Classification Level I documentation requires tactical badge authentication."
                      : "ವರ್ಗೀಕೃತ ದಾಖಲೆಗಳನ್ನು ವೀಕ್ಷಿಸಲು ಬ್ಯಾಡ್ಜ್ ದೃಢೀಕರಣದ ಅಗತ್ಯವಿದೆ.",
                  )
                }
                className="border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 text-[13px] font-bold px-6 py-3.5 rounded-lg flex items-center justify-center space-x-2 transition-colors duration-150 cursor-pointer"
              >
                <Database className="w-4 h-4 text-slate-500" />
                <span className="kn-text">
                  {lang === "en"
                    ? "Database Specifications"
                    : "ಡೇಟಾಬೇಸ್ ವಿವರಣೆಗಳು"}
                </span>
              </button>
            </div>
          </div>

          {/* Graphical branding illustration (right) */}
          <div className="lg:col-span-5 flex justify-center">
            <div className="w-full max-w-md bg-white border border-slate-200 rounded-xl p-6 shadow-xl relative backdrop-blur-sm">
              <div className="absolute top-3 right-3 flex space-x-1">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                <span className="text-[9px] font-mono font-semibold text-slate-400">
                  NODE RUNNING
                </span>
              </div>

              <div className="space-y-6">
                <div className="text-center py-4 border-b border-slate-100">
                  <div className="text-[28px] font-display font-extrabold text-slate-900 tracking-wider">
                    VAJRA / ವಜ್ರ
                  </div>
                  <div className="text-[10px] font-mono font-medium text-slate-400 tracking-widest uppercase mt-1">
                    Intelligence Engine Core v2.4
                  </div>
                </div>

                {/* Simulated CCTNS connection statistics */}
                <div className="space-y-3 font-mono text-[11px] text-slate-500">
                  <div className="flex justify-between border-b border-slate-50 pb-1.5">
                    <span>POLICE STATIONS INDEXED</span>
                    <span className="text-slate-800 font-semibold">
                      1,124 / 1,124
                    </span>
                  </div>
                  <div className="flex justify-between border-b border-slate-50 pb-1.5">
                    <span>TOTAL DATABASE RECORDS</span>
                    <span className="text-slate-800 font-semibold pb-1">
                      1,612,492 CCTNS Files
                    </span>
                  </div>
                  <div className="flex justify-between border-b border-slate-50 pb-1.5">
                    <span>NLP TRANSLATOR LAYER</span>
                    <span className="text-emerald-600 font-semibold flex items-center">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1"></span>{" "}
                      ONLINE
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>XGBOOST CORE PIPELINE</span>
                    <span className="text-emerald-700 font-semibold flex items-center">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1"></span>{" "}
                      CALIBRATED
                    </span>
                  </div>
                </div>

                <div className="bg-[#F8FAFC] border border-slate-200 rounded p-4 text-[12px] space-y-1">
                  <div className="font-bold text-slate-700">
                    Classification Level I Authority:
                  </div>
                  <div className="text-slate-500 leading-relaxed kn-text">
                    {lang === "en"
                      ? "Secure access is locked to officers of the Karnataka State Police with calibrated credentials."
                      : "ಕರ್ನಾಟಕ ರಾಜ್ಯ ಪೊಲೀಸ್ ತನಿಖಾಧಿಕಾರಿಗಳು ಮಾತ್ರ ಅಧಿಕೃತ ವಿವರಗಳೊಂದಿಗೆ ಈ ಲಾಗ್ ಪ್ರವೇಶಿಸಬಹುದು."}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Capability Strip with four tactical features cards */}
        <div className="mt-20 pt-10 border-t border-slate-200">
          <div className="text-center mb-10">
            <h2 className="text-xl font-bold text-slate-900 tracking-tight kn-text">
              {t.capabilitiesTitle}
            </h2>
            <div className="h-0.5 w-12 bg-[#1D4ED8] mx-auto mt-2.5"></div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Capability 1: Voice English/Kannada AI */}
            <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm transition-all duration-150 hover:-translate-y-0.5 hover:shadow-md">
              <div className="w-10 h-10 rounded bg-blue-50 flex items-center justify-center text-[#1D4ED8] mb-4">
                <Mic className="w-5 h-5" />
              </div>
              <h3 className="text-[14px] font-bold text-slate-900 mb-2 kn-text">
                {t.capabilityVoice}
              </h3>
              <p className="text-[12px] text-slate-500 leading-[1.7] kn-text">
                {t.capabilityVoiceDesc}
              </p>
            </div>

            {/* Capability 2: GraphRAG */}
            <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm transition-all duration-150 hover:-translate-y-0.5 hover:shadow-md">
              <div className="w-10 h-10 rounded bg-blue-50 flex items-center justify-center text-[#1D4ED8] mb-4">
                <Network className="w-5 h-5" />
              </div>
              <h3 className="text-[14px] font-bold text-slate-900 mb-2 kn-text">
                {t.capabilityGraph}
              </h3>
              <p className="text-[12px] text-slate-500 leading-[1.7] kn-text">
                {t.capabilityGraphDesc}
              </p>
            </div>

            {/* Capability 3: Hotspot Maps */}
            <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm transition-all duration-150 hover:-translate-y-0.5 hover:shadow-md">
              <div className="w-10 h-10 rounded bg-blue-50 flex items-center justify-center text-[#1D4ED8] mb-4">
                <Map className="w-5 h-5" />
              </div>
              <h3 className="text-[14px] font-bold text-slate-900 mb-2 kn-text">
                {t.capabilityHotspot}
              </h3>
              <p className="text-[12px] text-slate-500 leading-[1.7] kn-text">
                {t.capabilityHotspotDesc}
              </p>
            </div>

            {/* Capability 4: SHAP Explanations */}
            <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm transition-all duration-150 hover:-translate-y-0.5 hover:shadow-md">
              <div className="w-10 h-10 rounded bg-blue-50 flex items-center justify-center text-[#1D4ED8] mb-4">
                <Activity className="w-5 h-5" />
              </div>
              <h3 className="text-[14px] font-bold text-slate-900 mb-2 kn-text">
                {t.capabilityRisk}
              </h3>
              <p className="text-[12px] text-slate-500 leading-[1.7] kn-text">
                {t.capabilityRiskDesc}
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-slate-900 text-slate-400 py-8 border-t-2 border-amber-500 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-3">
          <div className="text-[11px] font-mono tracking-widest text-[#EF4444] font-bold uppercase">
            {lang === "en"
              ? "CLASS I CLASSIFIED SYSTEM. UNAUTHORISED LOG IN ATTEMPTS ARE GEOLOCATED AND LOGGED."
              : "ವರ್ಗೀಕೃತ ಇಂಟೆಲಿಜೆನ್ಸ್ ಸಿಸ್ಟಮ್. ಅನಧಿಕೃತ ಲಾಗ್ ಇನ್ ಪ್ರಯತ್ನಗಳನ್ನು ಪತ್ತೆಹಚ್ಚಲಾಗುತ್ತದೆ."}
          </div>
          <div className="text-xs kn-text text-slate-500">{t.footerRights}</div>
          <div className="text-[11px] font-mono text-slate-600">
            Node-ID: {lang === "en" ? "CCTNS-SCRB-BLR-01" : "CCTNS-SCRB-BLR-01"}{" "}
            | Build Platform SEC-Vajra-2026
          </div>
        </div>
      </footer>
    </div>
  );
};
