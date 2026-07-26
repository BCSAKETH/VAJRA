import React, { useEffect, useState } from "react";
import { useApp } from "../AppContext";
import { API_BASE } from "../config";
import { Settings, ShieldCheck, Database, Languages, Clock, User, IdCard, MapPin } from "lucide-react";

interface OfficerProfile {
  kgid: string;
  first_name: string | null;
  station: string | null;
  rank: string | null;
  designation: string | null;
  role_tier: string | null;
}

export const SettingsScreen: React.FC = () => {
  const {
    t,
    lang,
    setLang,
    badgeNumber,
    roleTier,
    isDbConnected,
    theme,
    setTheme,
  } = useApp();

  const [profile, setProfile] = useState<OfficerProfile | null>(null);
  useEffect(() => {
    fetch(`${API_BASE}/api/auth/me`, {
      headers: { Authorization: `Bearer ${localStorage.getItem("vajra_token") || ""}` },
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => { if (data) setProfile(data); })
      .catch(() => {});
  }, []);

  return (
    <div className="h-full flex flex-col p-6 space-y-6 bg-stone-950/20 overflow-y-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center border-b border-stone-850 pb-4 shrink-0">
        <div className="space-y-1">
          <h2 className="text-base font-black text-stone-100 uppercase tracking-wider font-mono flex items-center gap-2">
            <Settings className="w-5 h-5 text-[#C79A4E]" />
            <span>{t.navSettings}</span>
          </h2>
          <p className="text-[11px] text-stone-550 leading-relaxed font-mono">
            {t.settingsDesc}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
        {/* Left Side: General Prefs & System Health */}
        <div className="space-y-6">
          {/* Card 0: Officer Profile -- same /api/auth/me the sidebar
              popover uses, surfaced here too as the canonical "who am I,
              what can I see" reference point. */}
          <div className="glass-card p-5 border border-stone-850 space-y-4">
            <h3 className="text-xs font-black text-stone-200 uppercase tracking-wider font-mono flex items-center gap-2">
              <IdCard className="w-4 h-4 text-[#C79A4E]" />
              <span>{lang === "en" ? "Officer Profile" : "ಅಧಿಕಾರಿ ಪ್ರೊಫೈಲ್"}</span>
            </h3>
            <div className="grid grid-cols-2 gap-2.5 pt-1 font-mono text-[11px]">
              <div className="bg-stone-950/40 p-2.5 rounded-lg border border-stone-900">
                <div className="text-[9px] text-stone-550 uppercase">{lang === "en" ? "Name" : "ಹೆಸರು"}</div>
                <div className="font-bold text-stone-200 truncate">{profile?.first_name || "—"}</div>
              </div>
              <div className="bg-stone-950/40 p-2.5 rounded-lg border border-stone-900">
                <div className="text-[9px] text-stone-550 uppercase">KGID</div>
                <div className="font-bold text-stone-200 truncate">{profile?.kgid || badgeNumber || "—"}</div>
              </div>
              <div className="bg-stone-950/40 p-2.5 rounded-lg border border-stone-900">
                <div className="text-[9px] text-stone-550 uppercase">{lang === "en" ? "Rank" : "ಶ್ರೇಣಿ"}</div>
                <div className="font-bold text-stone-200 truncate">{profile?.rank || "—"}</div>
              </div>
              <div className="bg-stone-950/40 p-2.5 rounded-lg border border-stone-900">
                <div className="text-[9px] text-stone-550 uppercase">{lang === "en" ? "Designation" : "ಪದನಾಮ"}</div>
                <div className="font-bold text-stone-200 truncate">{profile?.designation || "—"}</div>
              </div>
              <div className="bg-stone-950/40 p-2.5 rounded-lg border border-stone-900 col-span-2">
                <div className="text-[9px] text-stone-550 uppercase">{lang === "en" ? "Home Station" : "ಠಾಣೆ"}</div>
                <div className="font-bold text-stone-200 truncate">{profile?.station || "—"}</div>
              </div>
            </div>
          </div>

          {/* Card 1: Preferences */}
          <div className="glass-card p-5 border border-stone-850 space-y-4">
            <h3 className="text-xs font-black text-stone-200 uppercase tracking-wider font-mono flex items-center gap-2">
              <Languages className="w-4 h-4 text-[#C79A4E]" />
              <span>{t.settingsLangThemeTitle}</span>
            </h3>

            <div className="space-y-3.5 pt-2 text-xs">
              {/* Language Selection */}
              <div className="flex justify-between items-center bg-stone-950/40 p-3 rounded-lg border border-stone-900">
                <span className="font-semibold text-stone-400">{t.settingsAppLanguage}</span>
                <select
                  value={lang}
                  onChange={(e) => setLang(e.target.value as any)}
                  className="bg-stone-900 border border-stone-800 focus:border-[#C79A4E] rounded-lg px-2.5 py-1 text-stone-200 font-bold text-xs"
                >
                  <option value="en">{t.settingsLangOptEn}</option>
                  <option value="kn">{t.settingsLangOptKn}</option>
                </select>
              </div>

              {/* Theme Selector */}
              <div className="flex justify-between items-center bg-stone-950/40 p-3 rounded-lg border border-stone-900">
                <span className="font-semibold text-stone-400">{t.settingsDisplayTheme}</span>
                <select
                  value={theme}
                  onChange={(e) => setTheme(e.target.value as any)}
                  className="bg-stone-900 border border-stone-800 focus:border-[#C79A4E] rounded-lg px-2.5 py-1 text-stone-200 font-bold text-xs"
                >
                  <option value="high-contrast-dark">{t.settingsThemeDark}</option>
                  <option value="light">{t.settingsThemeLight}</option>
                </select>
              </div>
            </div>
          </div>

          {/* Card 2: Core Diagnostics */}
          <div className="glass-card p-5 border border-stone-850 space-y-4">
            <h3 className="text-xs font-black text-stone-200 uppercase tracking-wider font-mono flex items-center gap-2">
              <Database className="w-4 h-4 text-[#C79A4E]" />
              <span>{t.settingsDbDiagTitle}</span>
            </h3>

            <div className="space-y-2.5 pt-2 font-mono text-xs">
              {/* Zoho Catalyst Datastore Status */}
              <div className="flex justify-between items-center p-2.5 rounded bg-stone-950/40 border border-stone-900">
                <span className="text-stone-400">{t.settingsZcqlLabel}</span>
                <span className={`font-bold text-[11px] ${isDbConnected ? "text-[#C79A4E]" : "text-rose-500"}`}>
                  {isDbConnected ? t.settingsOnline : t.settingsOffline}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Side: Security Policies */}
        <div className="glass-card p-5 border border-stone-850 space-y-4">
          <h3 className="text-xs font-black text-stone-200 uppercase tracking-wider font-mono flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-[#C79A4E]" />
            <span>{t.settingsSecurityPoliciesTitle}</span>
          </h3>

          <div className="space-y-3.5 pt-2 text-xs">
            {/* Access Scope -- explains what this officer's own role_tier
                actually gates, grounded in the real enforcement (station-
                scoped RLS for everyone, Supervisor Dashboard + consistency-
                flag review gated to role_tier == "supervisor" server-side). */}
            <div className="bg-stone-950/40 p-4 rounded-xl border border-stone-900 flex gap-3.5 items-start">
              <MapPin className="w-6 h-6 text-[#C79A4E] shrink-0 mt-0.5" />
              <div className="space-y-1 flex-1">
                <span className="font-bold text-stone-200 block text-[12px] font-mono uppercase tracking-wide">
                  {lang === "en" ? "Access Scope" : "ಪ್ರವೇಶ ವ್ಯಾಪ್ತಿ"}
                </span>
                <p className="text-[11px] leading-relaxed text-stone-500">
                  {lang === "en"
                    ? "Every query is row-level scoped to your own station -- you only ever see cases, suspects, and analytics for your assigned unit, enforced server-side on every request, not just hidden in the UI."
                    : "ಪ್ರತಿ ಪ್ರಶ್ನೆಯು ನಿಮ್ಮ ಸ್ವಂತ ಠಾಣೆಗೆ ಸೀಮಿತವಾಗಿದೆ -- ಪ್ರತಿ ವಿನಂತಿಯಲ್ಲಿ ಸರ್ವರ್-ಸೈಡ್ ಜಾರಿಗೊಳಿಸಲಾಗಿದೆ, ಕೇವಲ UI ಯಲ್ಲಿ ಮರೆಮಾಡಿಲ್ಲ."}
                </p>
                <div className="text-[10px] font-mono text-[#C79A4E] font-bold uppercase tracking-wider">
                  {lang === "en" ? "Tier: " : "ಸ್ತರ: "}{roleTier === "supervisor" ? (lang === "en" ? "Supervisor (PI and above)" : "ಮೇಲ್ವಿಚಾರಕ") : (lang === "en" ? "Officer" : "ಅಧಿಕಾರಿ")}
                </div>
                {roleTier === "supervisor" ? (
                  <p className="text-[10.5px] text-stone-600 leading-relaxed pt-0.5">
                    {lang === "en"
                      ? "Additionally unlocks the Supervisor Dashboard: consistency-flag review/dismissal and audit ledger verification."
                      : "ಹೆಚ್ಚುವರಿಯಾಗಿ ಮೇಲ್ವಿಚಾರಕ ಡ್ಯಾಶ್‌ಬೋರ್ಡ್ ಅನ್ನು ಅನ್‌ಲಾಕ್ ಮಾಡುತ್ತದೆ: ಸ್ಥಿರತೆ-ಫ್ಲ್ಯಾಗ್ ಪರಿಶೀಲನೆ ಮತ್ತು ಆಡಿಟ್ ಲೆಡ್ಜರ್ ಪರಿಶೀಲನೆ."}
                  </p>
                ) : (
                  <p className="text-[10.5px] text-stone-600 leading-relaxed pt-0.5">
                    {lang === "en"
                      ? "The Supervisor Dashboard (consistency-flag review, ledger verification) requires PI rank or above -- gated server-side, not just hidden from the sidebar."
                      : "ಮೇಲ್ವಿಚಾರಕ ಡ್ಯಾಶ್‌ಬೋರ್ಡ್‌ಗೆ PI ಶ್ರೇಣಿ ಅಥವಾ ಅದಕ್ಕಿಂತ ಹೆಚ್ಚಿನ ಅಗತ್ಯವಿದೆ -- ಸರ್ವರ್-ಸೈಡ್ ನಿರ್ಬಂಧಿಸಲಾಗಿದೆ."}
                  </p>
                )}
              </div>
            </div>

            {/* Session Timeout */}
            <div className="bg-stone-950/40 p-4 rounded-xl border border-stone-900 flex gap-3.5 items-start">
              <Clock className="w-6 h-6 text-[#C79A4E] shrink-0 mt-0.5" />
              <div className="space-y-1">
                <span className="font-bold text-stone-200 block text-[12px] font-mono uppercase tracking-wide">
                  {t.settingsSessionTimeoutTitle}
                </span>
                <p className="text-[11px] leading-relaxed text-stone-500">
                  {lang === "en" ? (
                    <>Automatically invalidates session tokens and redirects to Login Screen after <strong>15 minutes</strong> of operator inactivity.</>
                  ) : (
                    <>ಆಪರೇಟರ್ ನಿಷ್ಕ್ರಿಯತೆಯ <strong>೧೫ ನಿಮಿಷಗಳ</strong> ನಂತರ ಅಧಿವೇಶನ ಟೋಕನ್‌ಗಳನ್ನು ಸ್ವಯಂಚಾಲಿತವಾಗಿ ಅಮಾನ್ಯಗೊಳಿಸಿ ಲಾಗಿನ್ ಪರದೆಗೆ ಮರುನಿರ್ದೇಶಿಸುತ್ತದೆ.</>
                  )}
                </p>
                <div className="text-[10px] font-mono text-amber-500 font-bold uppercase tracking-wider">
                  {t.settingsPolicyEnforced}
                </div>
              </div>
            </div>

            {/* Two-Person Integrity */}
            <div className="bg-stone-950/40 p-4 rounded-xl border border-stone-900 flex gap-3.5 items-start">
              <User className="w-6 h-6 text-[#C79A4E] shrink-0 mt-0.5" />
              <div className="space-y-1">
                <span className="font-bold text-stone-200 block text-[12px] font-mono uppercase tracking-wide">
                  {t.settingsTwoPersonTitle}
                </span>
                <p className="text-[11px] leading-relaxed text-stone-500">
                  {t.settingsTwoPersonDesc}
                </p>
                <div className="text-[10px] font-mono text-emerald-500 font-bold uppercase tracking-wider">
                  {t.settingsControlEngaged}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
