import React from "react";
import { useApp } from "../AppContext";
import { Settings, ShieldCheck, Database, Languages, Clock, User } from "lucide-react";

export const SettingsScreen: React.FC = () => {
  const {
    t,
    lang,
    setLang,
    badgeNumber,
    isDbConnected,
    isNeo4jConnected,
    theme,
    setTheme,
  } = useApp();

  return (
    <div className="h-full flex flex-col p-6 space-y-6 bg-slate-950/20 overflow-y-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center border-b border-slate-850 pb-4 shrink-0">
        <div className="space-y-1">
          <h2 className="text-base font-black text-slate-100 uppercase tracking-wider font-mono flex items-center gap-2">
            <Settings className="w-5 h-5 text-[#00C6AD]" />
            <span>{t.navSettings}</span>
          </h2>
          <p className="text-[11px] text-slate-550 leading-relaxed font-mono">
            System diagnostics, security policies, and localization preferences.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
        {/* Left Side: General Prefs & System Health */}
        <div className="space-y-6">
          {/* Card 1: Preferences */}
          <div className="glass-card p-5 border border-slate-850 space-y-4">
            <h3 className="text-xs font-black text-slate-200 uppercase tracking-wider font-mono flex items-center gap-2">
              <Languages className="w-4 h-4 text-[#00C6AD]" />
              <span>Language & Theme Preferences</span>
            </h3>

            <div className="space-y-3.5 pt-2 text-xs">
              {/* Language Selection */}
              <div className="flex justify-between items-center bg-slate-950/40 p-3 rounded-lg border border-slate-900">
                <span className="font-semibold text-slate-400">Application Language</span>
                <select
                  value={lang}
                  onChange={(e) => setLang(e.target.value as any)}
                  className="bg-slate-900 border border-slate-800 focus:border-[#00C6AD] rounded-lg px-2.5 py-1 text-slate-200 font-bold text-xs"
                >
                  <option value="en">English (Bilingual)</option>
                  <option value="kn">ಕನ್ನಡ (Kannada)</option>
                </select>
              </div>

              {/* Theme Selector */}
              <div className="flex justify-between items-center bg-slate-950/40 p-3 rounded-lg border border-slate-900">
                <span className="font-semibold text-slate-400">Display Theme</span>
                <select
                  value={theme}
                  onChange={(e) => setTheme(e.target.value as any)}
                  className="bg-slate-900 border border-slate-800 focus:border-[#00C6AD] rounded-lg px-2.5 py-1 text-slate-200 font-bold text-xs"
                >
                  <option value="high-contrast-dark">High Contrast Dark Mode</option>
                  <option value="light">NIC Standard Light Mode</option>
                </select>
              </div>
            </div>
          </div>

          {/* Card 2: Core Diagnostics */}
          <div className="glass-card p-5 border border-slate-850 space-y-4">
            <h3 className="text-xs font-black text-slate-200 uppercase tracking-wider font-mono flex items-center gap-2">
              <Database className="w-4 h-4 text-[#00C6AD]" />
              <span>Database Client Diagnostics</span>
            </h3>

            <div className="space-y-2.5 pt-2 font-mono text-xs">
              {/* Zoho Catalyst Datastore Status */}
              <div className="flex justify-between items-center p-2.5 rounded bg-slate-950/40 border border-slate-900">
                <span className="text-slate-400">Zoho Catalyst ZCQL Client:</span>
                <span className={`font-bold text-[11px] ${isDbConnected ? "text-[#00C6AD]" : "text-rose-500"}`}>
                  {isDbConnected ? "ONLINE (Catalyst serverless)" : "OFFLINE"}
                </span>
              </div>

              {/* Neo4j Sandbox Status */}
              <div className="flex justify-between items-center p-2.5 rounded bg-slate-950/40 border border-slate-900">
                <span className="text-slate-400">Neo4j Sandbox Syndicate Engine:</span>
                <span className={`font-bold text-[11px] ${isNeo4jConnected ? "text-[#00C6AD]" : "text-rose-500"}`}>
                  {isNeo4jConnected ? "CONNECTED" : "DISCONNECTED (GraphRAG using relation fallback)"}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Side: Security Policies */}
        <div className="glass-card p-5 border border-slate-850 space-y-4">
          <h3 className="text-xs font-black text-slate-200 uppercase tracking-wider font-mono flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-[#00C6AD]" />
            <span>Active Security Policies</span>
          </h3>

          <div className="space-y-3.5 pt-2 text-xs">
            {/* Session Timeout */}
            <div className="bg-slate-950/40 p-4 rounded-xl border border-slate-900 flex gap-3.5 items-start">
              <Clock className="w-6 h-6 text-[#00C6AD] shrink-0 mt-0.5" />
              <div className="space-y-1">
                <span className="font-bold text-slate-200 block text-[12px] font-mono uppercase tracking-wide">
                  Session Timeout Limit
                </span>
                <p className="text-[11px] leading-relaxed text-slate-500">
                  Automatically invalidates session tokens and redirects to Login Screen after <strong>15 minutes</strong> of operator inactivity.
                </p>
                <div className="text-[10px] font-mono text-amber-500 font-bold uppercase tracking-wider">
                  ⚠️ POLICY ENFORCED — READ ONLY
                </div>
              </div>
            </div>

            {/* Two-Person Integrity */}
            <div className="bg-slate-950/40 p-4 rounded-xl border border-slate-900 flex gap-3.5 items-start">
              <User className="w-6 h-6 text-[#00C6AD] shrink-0 mt-0.5" />
              <div className="space-y-1">
                <span className="font-bold text-slate-200 block text-[12px] font-mono uppercase tracking-wide">
                  Two-Person Integrity (Dual-Control)
                </span>
                <p className="text-[11px] leading-relaxed text-slate-500">
                  Critical adjustments, legal suggestions, and ledger overrides must be co-signed by an independent Supervisor's credentials.
                </p>
                <div className="text-[10px] font-mono text-emerald-500 font-bold uppercase tracking-wider">
                  ✓ CONTROL ENGAGED
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
