import React, { useState, useEffect, useRef } from "react";
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
  IdCard,
  Building2,
  X,
} from "lucide-react";
import { VajraLogo } from "./VajraLogo";
import { NotificationBellPanel } from "./NotificationBellPanel";
import { ToastContainer } from "./ToastContainer";
import { API_BASE } from "../config";

interface OfficerProfile {
  kgid: string;
  first_name: string | null;
  station: string | null;
  rank: string | null;
  designation: string | null;
  role_tier: string | null;
}

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
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [profile, setProfile] = useState<OfficerProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  // Fetched lazily on first open (not on mount) -- the officer's own rank/
  // station/designation rarely change mid-session, so there's no value in
  // paying this round-trip before the profile card is ever opened.
  useEffect(() => {
    if (!isProfileOpen || profile || profileLoading) return;
    setProfileLoading(true);
    fetch(`${API_BASE}/api/auth/me`, {
      headers: { Authorization: `Bearer ${localStorage.getItem("vajra_token") || ""}` },
    })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("Profile unavailable"))))
      .then((data: OfficerProfile) => setProfile(data))
      .catch(() => setProfile(null))
      .finally(() => setProfileLoading(false));
  }, [isProfileOpen, profile, profileLoading]);

  useEffect(() => {
    if (!isProfileOpen) return;
    const onClickOutside = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) setIsProfileOpen(false);
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [isProfileOpen]);

  if (!isAuthenticated || currentScreen === "login") {
    return <div className="min-h-screen bg-[#161412] flex flex-col">{children}</div>;
  }

  const isExpanded = isSidebarExpanded || isSidebarHovered;

  // Supervisor Dashboard is a supervisory-action screen (two-person approval,
  // ledger verification, consistency-flag review) -- only shown to
  // Supervisor-tier+ officers, matching the backend enforcement on
  // /api/alerts/consistency-flags/{id}/review.
  const navItems = [
    { id: "ai_chat" as ScreenId, label: t.navChat, icon: MessageSquare },
    { id: "district_dashboard" as ScreenId, label: t.navDistrictDashboard, icon: Map },
    ...(roleTier === "supervisor"
      ? [{ id: "supervisor" as ScreenId, label: t.navSupervisor, icon: UserCheck }]
      : []),
    { id: "settings" as ScreenId, label: t.navSettings, icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-[#161412] text-stone-100 flex flex-col font-sans transition-colors duration-300">
      {/* Indian Tricolour Top Accent Strip */}
      <div className="tricolour-strip shrink-0" />

      {/* Main Container */}
      <div className="flex flex-1 overflow-hidden">
        {/* Collapsible Sidebar */}
        <aside
          onMouseEnter={() => setIsSidebarHovered(true)}
          onMouseLeave={() => setIsSidebarHovered(false)}
          className={`glass-panel border-r border-stone-800 flex flex-col justify-between transition-all duration-300 shrink-0 select-none ${
            isExpanded ? "w-64" : "w-16"
          }`}
        >
          {/* Top Branding Section */}
          <div className="p-4 flex flex-col gap-6">
            <div className="flex items-center justify-between">
              {isExpanded ? (
                <div className="flex items-center gap-2">
                  <VajraLogo animated={false} size={24} />
                  <span className="font-black text-sm tracking-widest text-[#C79A4E]">VAJRA 3.0</span>
                </div>
              ) : (
                <VajraLogo animated={false} size={24} className="mx-auto" />
              )}
              {/* No longer hidden below md: hover-to-expand doesn't exist on
                  touch devices, so this click toggle was the only way to
                  ever open the sidebar on mobile -- hiding it left touch
                  users permanently stuck with icon-only nav and no labels. */}
              <button
                onClick={() => setIsSidebarExpanded(!isSidebarExpanded)}
                aria-label={isSidebarExpanded ? "Collapse sidebar" : "Expand sidebar"}
                className="flex p-1 rounded-md border border-stone-800 hover:border-stone-700 bg-stone-900/50 hover:bg-stone-800 text-stone-400 hover:text-stone-200 transition-colors"
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
                        ? "bg-[#C79A4E]/10 border-[#C79A4E]/30 text-[#C79A4E] font-semibold"
                        : "border-transparent hover:bg-stone-800/35 hover:text-stone-200 text-stone-400"
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
          <div className="p-4 border-t border-stone-800 flex flex-col gap-4 bg-stone-950/20 relative" ref={profileRef}>
            {/* Officer profile popover -- anchored above the trigger like a
                ChatGPT/Claude account menu, pulling from /api/auth/me
                (rank/designation/station resolved server-side by the same
                security firewall that gates every other endpoint, never
                client-supplied). */}
            {isProfileOpen && (
              <div className="absolute bottom-full left-3 right-3 sm:left-4 sm:right-auto sm:w-64 mb-2 glass-panel border border-stone-800 rounded-xl shadow-2xl p-4 animate-slide-up z-20">
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-9 h-9 rounded-full bg-[#C79A4E]/15 border border-[#C79A4E]/30 flex items-center justify-center font-black text-xs text-[#C79A4E] shrink-0">
                      {(profile?.first_name || "KG").slice(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-stone-100 truncate">
                        {profileLoading ? "..." : profile?.first_name || t.profileLabel}
                      </p>
                      <p className="text-[10px] text-stone-500 font-mono truncate">{badgeNumber || `KGID: ${profile?.kgid || "—"}`}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setIsProfileOpen(false)}
                    className="p-1 rounded-md text-stone-600 hover:text-stone-300 hover:bg-stone-800 transition-colors shrink-0 cursor-pointer"
                    aria-label="Close"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="space-y-2 border-t border-stone-850 pt-3">
                  <div className="flex items-center gap-2 text-[11px]">
                    <Shield className="w-3.5 h-3.5 text-[#C79A4E] shrink-0" />
                    <span className="text-stone-500">{lang === "en" ? "Rank" : "ಶ್ರೇಣಿ"}</span>
                    <span className="ml-auto text-stone-200 font-semibold truncate">
                      {profileLoading ? "…" : profile?.rank || "—"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-[11px]">
                    <IdCard className="w-3.5 h-3.5 text-[#C79A4E] shrink-0" />
                    <span className="text-stone-500">{lang === "en" ? "Designation" : "ಪದನಾಮ"}</span>
                    <span className="ml-auto text-stone-200 font-semibold truncate">
                      {profileLoading ? "…" : profile?.designation || "—"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-[11px]">
                    <Building2 className="w-3.5 h-3.5 text-[#C79A4E] shrink-0" />
                    <span className="text-stone-500">{lang === "en" ? "Station" : "ಠಾಣೆ"}</span>
                    <span className="ml-auto text-stone-200 font-semibold truncate">
                      {profileLoading ? "…" : profile?.station || "—"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-[11px]">
                    <UserCheck className="w-3.5 h-3.5 text-[#C79A4E] shrink-0" />
                    <span className="text-stone-500">{lang === "en" ? "Access Tier" : "ಪ್ರವೇಶ ಸ್ತರ"}</span>
                    <span className="ml-auto text-[#C79A4E] font-bold uppercase text-[10px] font-mono">
                      {profileLoading ? "…" : profile?.role_tier || roleTier || "—"}
                    </span>
                  </div>
                </div>
              </div>
            )}

            <button
              onClick={() => setIsProfileOpen((v) => !v)}
              className={`flex items-center gap-3 rounded-lg transition-colors cursor-pointer ${
                isExpanded ? "p-1.5 -m-1.5 hover:bg-stone-800/50 w-full" : "mx-auto"
              }`}
              aria-label={t.profileLabel}
            >
              <div
                className={`w-8 h-8 rounded-full bg-stone-800 border flex items-center justify-center font-bold text-xs text-[#C79A4E] shrink-0 transition-colors ${
                  isProfileOpen ? "border-[#C79A4E]" : "border-stone-750"
                }`}
              >
                KG
              </div>
              {isExpanded && (
                <div className="flex-1 min-w-0 text-left">
                  <p className="text-xs font-semibold text-stone-300 truncate">{t.profileLabel}</p>
                  <p className="text-[10px] text-stone-500 truncate">{badgeNumber || "KGID: 4003385"}</p>
                </div>
              )}
            </button>

            <button
              onClick={() => setIsAuthenticated(false)}
              className="flex items-center gap-3 py-2 px-3 rounded-lg text-stone-400 hover:text-rose-400 hover:bg-rose-500/10 border border-transparent hover:border-rose-500/20 transition-all text-left"
            >
              <LogOut className="w-5 h-5 shrink-0 text-stone-400 hover:text-rose-400" />
              {isExpanded && <span className="text-sm">{t.signOut}</span>}
            </button>
          </div>
        </aside>

        {/* Content Shell */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {/* Header Bar */}
          <header className="glass-panel border-b border-stone-800 py-3.5 px-6 flex items-center justify-between z-10 shrink-0">
            <div className="flex items-center gap-3">
              <VajraLogo animated={false} size={20} className="md:hidden" />
              <div className="min-w-0">
                <h1 className="text-sm font-bold text-stone-200 tracking-wide truncate">
                  {t.title}
                </h1>
                <p className="text-[10.5px] text-stone-500 truncate hidden sm:block">
                  {t.ksp} • {t.scrb}
                </p>
              </div>
            </div>

            {/* Header Widgets */}
            <div className="flex items-center gap-3.5">
              {/* Language Selection Toggle */}
              <button
                onClick={() => setLang(lang === "en" ? "kn" : "en")}
                className="text-xs px-2.5 py-1.5 rounded-lg border border-stone-800 hover:border-stone-700 bg-stone-900/60 hover:bg-stone-850/80 font-bold transition-all text-[#C79A4E] flex items-center gap-1.5"
              >
                <span>{lang === "en" ? "ಕನ್ನಡ" : "English"}</span>
              </button>

              {/* Theme Selector Toggle */}
              <button
                onClick={() => setTheme(theme === "light" ? "high-contrast-dark" : "light")}
                className="p-2 rounded-lg border border-stone-800 hover:border-stone-700 bg-stone-900/60 hover:bg-stone-850/80 text-stone-400 hover:text-stone-200 transition-all"
              >
                {theme === "light" ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
              </button>

              {/* Persistent Notification Bell Dropdown -- housing Cowork invitations and System Alerts */}
              <NotificationBellPanel />

              {/* Operator Badge Display */}
              <div className="hidden md:flex items-center gap-2 border-l border-stone-850 pl-3.5">
                <span className="text-[10px] font-mono bg-[#C79A4E]/10 text-[#C79A4E] border border-[#C79A4E]/25 px-2 py-0.5 rounded font-black tracking-wide">
                  {badgeNumber || "KSP-4003385"}
                </span>
              </div>
            </div>
          </header>

          {/* Core Content Display Pane -- overflow-hidden (not auto): every
              screen already manages its own internal scroll region (its own
              h-full ... overflow-y-auto), including the chat thread, which
              needs to scroll independently while its composer stays fixed
              at the bottom (Claude-style). A second overflow-y-auto here
              fought that inner region for who owns scrolling and who
              resolves height -- the whole page grew instead of just the
              message list. This is just the bounded frame now. */}
          <main className="flex-1 overflow-hidden relative bg-[#161412]">
            {children}
          </main>
        </div>
      </div>
      <ToastContainer />
    </div>
  );
};
