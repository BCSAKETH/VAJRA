import React, { useState } from "react";
import { useApp, ScreenId } from "../AppContext";
import {
  MessageSquare,
  Map,
  Search,
  BarChart3,
  UserCheck,
  FileText,
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Shield,
  Sun,
  Moon,
} from "lucide-react";
import { VajraLogo } from "./VajraLogo";
import { CoworkInvitationsPanel } from "./CoworkInvitationsPanel";

interface MainLayoutProps {
  children: React.ReactNode;
}

export const MainLayout: React.FC<MainLayoutProps> = ({ children }) => {
  const {
    lang,
    setLang,
    t,
    currentScreen,
    setCurrentScreen,
    isAuthenticated,
    setIsAuthenticated,
    badgeNumber,
    roleTier,
    theme,
    setTheme,
  } = useApp();

  const [isSidebarExpanded, setIsSidebarExpanded] = useState(false);
  const [isSidebarHovered, setIsSidebarHovered] = useState(false);

  if (!isAuthenticated || currentScreen === "login") {
    return <div className="min-h-screen bg-[#070F1E] flex flex-col">{children}</div>;
  }

  const isExpanded = isSidebarExpanded || isSidebarHovered;

  // Supervisor Dashboard is a supervisory-action screen (two-person approval,
  // ledger verification, consistency-flag review) -- only shown to
  // Supervisor-tier+ officers, matching the backend enforcement on
  // /api/alerts/consistency-flags/{id}/review.
  const navItems = [
    { id: "ai_chat" as ScreenId, label: t.navChat, icon: MessageSquare },
    ...(roleTier === "supervisor"
      ? [{ id: "supervisor" as ScreenId, label: t.navSupervisor, icon: UserCheck }]
      : []),
    { id: "settings" as ScreenId, label: t.navSettings, icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-[#070F1E] text-slate-100 flex flex-col font-sans transition-colors duration-300">
      {/* Indian Tricolour Top Accent Strip */}
      <div className="tricolour-strip shrink-0" />

      {/* Main Container */}
      <div className="flex flex-1 overflow-hidden">
        {/* Collapsible Sidebar */}
        <aside
          onMouseEnter={() => setIsSidebarHovered(true)}
          onMouseLeave={() => setIsSidebarHovered(false)}
          className={`glass-panel border-r border-slate-800 flex flex-col justify-between transition-all duration-300 shrink-0 select-none ${
            isExpanded ? "w-64" : "w-16"
          }`}
        >
          {/* Top Branding Section */}
          <div className="p-4 flex flex-col gap-6">
            <div className="flex items-center justify-between">
              {isExpanded ? (
                <div className="flex items-center gap-2">
                  <VajraLogo animated={false} size={24} />
                  <span className="font-black text-sm tracking-widest text-[#00C6AD]">VAJRA 3.0</span>
                </div>
              ) : (
                <VajraLogo animated={false} size={24} className="mx-auto" />
              )}
              <button
                onClick={() => setIsSidebarExpanded(!isSidebarExpanded)}
                className="hidden md:flex p-1 rounded-md border border-slate-800 hover:border-slate-700 bg-slate-900/50 hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
              >
                {isSidebarExpanded ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              </button>
            </div>

            {/* Navigation List */}
            <nav className="flex flex-col gap-1.5 mt-2">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = currentScreen === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => setCurrentScreen(item.id)}
                    className={`flex items-center gap-3 py-2.5 px-3 rounded-lg border text-left transition-all duration-200 ${
                      isActive
                        ? "bg-[#00C6AD]/10 border-[#00C6AD]/30 text-[#00C6AD] font-semibold"
                        : "border-transparent hover:bg-slate-800/35 hover:text-slate-200 text-slate-400"
                    }`}
                  >
                    <Icon className="w-5 h-5 shrink-0" />
                    {isExpanded && <span className="text-sm truncate">{item.label}</span>}
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Bottom Sidebar Controls */}
          <div className="p-4 border-t border-slate-800 flex flex-col gap-4 bg-slate-950/20">
            {isExpanded ? (
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-750 flex items-center justify-center font-bold text-xs text-[#00C6AD]">
                  KG
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-slate-300 truncate">Investigator Profile</p>
                  <p className="text-[10px] text-slate-500 truncate">{badgeNumber || "KGID: 4003385"}</p>
                </div>
              </div>
            ) : (
              <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-750 flex items-center justify-center font-bold text-xs text-[#00C6AD] mx-auto">
                KG
              </div>
            )}

            <button
              onClick={() => setIsAuthenticated(false)}
              className="flex items-center gap-3 py-2 px-3 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 border border-transparent hover:border-rose-500/20 transition-all text-left"
            >
              <LogOut className="w-5 h-5 shrink-0 text-slate-400 hover:text-rose-400" />
              {isExpanded && <span className="text-sm">Sign Out</span>}
            </button>
          </div>
        </aside>

        {/* Content Shell */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {/* Header Bar */}
          <header className="glass-panel border-b border-slate-800 py-3.5 px-6 flex items-center justify-between z-10 shrink-0">
            <div className="flex items-center gap-3">
              <VajraLogo animated={false} size={20} className="md:hidden" />
              <div className="min-w-0">
                <h1 className="text-sm font-bold text-slate-200 tracking-wide truncate">
                  {t.title}
                </h1>
                <p className="text-[10.5px] text-slate-500 truncate hidden sm:block">
                  {t.ksp} • {t.scrb}
                </p>
              </div>
            </div>

            {/* Header Widgets */}
            <div className="flex items-center gap-3.5">
              {/* Language Selection Toggle */}
              <button
                onClick={() => setLang(lang === "en" ? "kn" : "en")}
                className="text-xs px-2.5 py-1.5 rounded-lg border border-slate-800 hover:border-slate-700 bg-slate-900/60 hover:bg-slate-850/80 font-bold transition-all text-[#00C6AD] flex items-center gap-1.5"
              >
                <span>{lang === "en" ? "ಕನ್ನಡ" : "English"}</span>
              </button>

              {/* Theme Selector Toggle */}
              <button
                onClick={() => setTheme(theme === "light" ? "high-contrast-dark" : "light")}
                className="p-2 rounded-lg border border-slate-800 hover:border-slate-700 bg-slate-900/60 hover:bg-slate-850/80 text-slate-400 hover:text-slate-200 transition-all"
              >
                {theme === "light" ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
              </button>

              {/* Real pending Cowork invitations -- previously just a
                  decorative icon with a permanently-on ping dot regardless
                  of whether anything was actually pending. */}
              <CoworkInvitationsPanel />

              {/* Operator Badge Display */}
              <div className="hidden md:flex items-center gap-2 border-l border-slate-850 pl-3.5">
                <span className="text-[10px] font-mono bg-[#00C6AD]/10 text-[#00C6AD] border border-[#00C6AD]/25 px-2 py-0.5 rounded font-black tracking-wide">
                  {badgeNumber || "KSP-4003385"}
                </span>
              </div>
            </div>
          </header>

          {/* Core Content Display Pane */}
          <main className="flex-1 overflow-y-auto relative bg-[#070F1E]">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
};
