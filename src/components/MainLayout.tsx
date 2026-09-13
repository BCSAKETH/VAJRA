import React, { useState } from "react";
import { useApp } from "../AppContext";
import { Sun, Moon, AlertTriangle } from "lucide-react";
import { VajraLogo } from "./VajraLogo";
import { NotificationBellPanel } from "./NotificationBellPanel";
import { ToastContainer } from "./ToastContainer";
import { UnifiedSidebar } from "./UnifiedSidebar";

interface MainLayoutProps {
  children: React.ReactNode;
}

export const MainLayout: React.FC<MainLayoutProps> = ({ children }) => {
  const {
    lang,
    setLang,
    t,
    currentScreen,
    isAuthenticated,
    badgeNumber,
    theme,
    setTheme,
    llmServiceAvailable, // C.16
  } = useApp();

  // §9.1 Unified Sidebar: nav rail, grouped chat/investigation lists, and
  // the officer's profile all now live inside <UnifiedSidebar>, rendered
  // once here (this component never unmounts on a screen switch -- only
  // `children` swaps -- Loophole L1), instead of being split between this
  // file's own icon rail and a chat-screen-local ChatHistoryPanel.
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(false);
  const [isSidebarHovered, setIsSidebarHovered] = useState(false);

  if (!isAuthenticated || currentScreen === "login") {
    return <div className="min-h-screen bg-[#161412] flex flex-col">{children}</div>;
  }

  const isExpanded = isSidebarExpanded || isSidebarHovered;

  return (
    <div className="min-h-screen bg-[var(--color-background-dark)] text-[var(--color-text-primary)] flex flex-col font-sans transition-colors duration-300">
      {/* Indian Tricolour Top Accent Strip */}
      <div className="tricolour-strip shrink-0" />

      {/* Main Container */}
      <div className="flex flex-1 overflow-hidden">
        {/* §9.1 Unified Sidebar -- one merged panel (nav + grouped chat/
            investigation lists + profile), replacing the old icon-only rail
            + chat-screen-local ChatHistoryPanel. Hover-to-expand handlers
            stay on this wrapper (unchanged behavior); the click toggle and
            everything else now lives inside UnifiedSidebar itself. */}
        <div onMouseEnter={() => setIsSidebarHovered(true)} onMouseLeave={() => setIsSidebarHovered(false)} className="contents">
          <UnifiedSidebar isExpanded={isExpanded} onToggleExpand={() => setIsSidebarExpanded(!isSidebarExpanded)} />
        </div>

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

          {/* C.16: persistent AI-degraded banner -- llmServiceAvailable already
              requires 2 consecutive bad /api/health reads before flipping to
              false (AppContext.tsx, Loophole L1), so this only ever appears
              for a real, sustained degradation, never a single poll blip. */}
          {!llmServiceAvailable && (
            <div className="shrink-0 flex items-center gap-2 px-6 py-2 bg-amber-500/10 border-b border-amber-500/25 text-amber-400">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
              <span className="text-[11px] font-mono">{t.aiDegradedBanner}</span>
            </div>
          )}

          {/* Core Content Display Pane -- overflow-hidden (not auto): every
              screen already manages its own internal scroll region (its own
              h-full ... overflow-y-auto), including the chat thread, which
              needs to scroll independently while its composer stays fixed
              at the bottom (Claude-style). A second overflow-y-auto here
              fought that inner region for who owns scrolling and who
              resolves height -- the whole page grew instead of just the
              message list. This is just the bounded frame now. */}
          <main className="flex-1 overflow-hidden relative bg-[var(--color-background-dark)]">
            {children}
          </main>
        </div>
      </div>
      <ToastContainer />
    </div>
  );
};
