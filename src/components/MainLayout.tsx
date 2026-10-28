import React, { useState } from "react";
import { useApp } from "../AppContext";
import { Sun, Moon, AlertTriangle, ChevronLeft, ChevronRight, PanelLeft } from "lucide-react";
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
    goBack,
    goForward,
    canGoBack,
    canGoForward,
    zenMode,
    toggleZenMode,
    activeChatSessionId,
  } = useApp();

  // §9.1 Unified Sidebar: nav rail, grouped chat/investigation lists, and
  // the officer's profile all now live inside <UnifiedSidebar>, rendered
  // once here (this component never unmounts on a screen switch -- only
  // `children` swaps -- Loophole L1), instead of being split between this
  // file's own icon rail and a chat-screen-local ChatHistoryPanel.
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(() => {
    const saved = localStorage.getItem("vajra_sidebar_expanded");
    return saved !== null ? saved === "true" : true;
  });
  const [isSidebarHovered, setIsSidebarHovered] = useState(false);

  const handleToggleSidebar = () => {
    setIsSidebarExpanded((prev) => {
      const next = !prev;
      localStorage.setItem("vajra_sidebar_expanded", String(next));
      return next;
    });
  };

  if (!isAuthenticated || currentScreen === "login") {
    return <div className="min-h-screen bg-[var(--color-background-dark)] text-[var(--color-text-primary)] flex flex-col transition-colors duration-300">{children}</div>;
  }

  const isExpanded = isSidebarExpanded || isSidebarHovered;

  return (
    <div className="h-screen bg-[var(--color-background-dark)] text-[var(--color-text-primary)] flex flex-col font-sans transition-colors duration-300 overflow-hidden">
      {/* Indian Tricolour Top Accent Strip */}
      <div className="tricolour-strip shrink-0" />

      {/* Main Container */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Unified Sidebar -- completely collapses in Zen Mode for full-width workspace */}
        <div
          onMouseEnter={() => !zenMode && setIsSidebarHovered(true)}
          onMouseLeave={() => !zenMode && setIsSidebarHovered(false)}
          className={zenMode ? "hidden" : "contents"}
        >
          <UnifiedSidebar isExpanded={isExpanded} onToggleExpand={handleToggleSidebar} />
        </div>

        {/* Content Shell */}
        <div className="flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden relative">
          {/* Dedicated Top Row Header Bar (Static, non-overlapping across all screens) */}
          <header className="h-11 shrink-0 border-b border-stone-850 bg-stone-900/95 backdrop-blur-md px-4 sm:px-6 flex items-center justify-between z-30">
            <div className="flex items-center gap-3">
              {zenMode && (
                <button
                  onClick={toggleZenMode}
                  title="Exit Focus Mode (Show Navigation)"
                  className="px-2.5 py-1 rounded-lg bg-stone-850 border border-[#C79A4E]/40 text-[#C79A4E] hover:bg-stone-800 cursor-pointer flex items-center gap-1.5 text-xs font-mono font-bold"
                >
                  <PanelLeft className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">EXIT FOCUS</span>
                </button>
              )}
            </div>

            {/* Top-Right Status Island */}
            <div className="flex items-center gap-2 bg-stone-950/70 border border-stone-800/80 rounded-xl px-3 py-1 shadow-sm">
              {/* Language Selection Toggle */}
              <button
                onClick={() => setLang(lang === "en" ? "kn" : "en")}
                className="text-xs px-2 py-0.5 rounded font-bold text-[#C79A4E] hover:bg-stone-800 transition-colors cursor-pointer"
                title="Toggle Language"
              >
                {lang === "en" ? "ಕನ್ನಡ" : "EN"}
              </button>
              <div className="h-3.5 w-[1px] bg-stone-800" />
              {/* Theme Selector Toggle */}
              <button
                onClick={() => setTheme(theme === "light" ? "high-contrast-dark" : "light")}
                className="p-1 rounded text-stone-400 hover:text-stone-200 hover:bg-stone-800 transition-colors cursor-pointer"
                title="Toggle Theme"
              >
                {theme === "light" ? <Moon className="w-3.5 h-3.5" /> : <Sun className="w-3.5 h-3.5" />}
              </button>
              <div className="h-3.5 w-[1px] bg-stone-800" />
              {/* Notification Bell Panel */}
              <NotificationBellPanel />
              <div className="h-3.5 w-[1px] bg-stone-800 hidden md:block" />
              {/* Operator Badge Display */}
              <span className="hidden md:inline-block text-[10px] font-mono font-bold text-[#C79A4E] bg-[#C79A4E]/10 px-2 py-0.5 rounded border border-[#C79A4E]/20">
                {badgeNumber || "2346836"}
              </span>
            </div>
          </header>

          {/* C.16: persistent AI-degraded banner */}
          {!llmServiceAvailable && (
            <div className="shrink-0 flex items-center gap-2 px-6 py-2 bg-amber-500/10 border-b border-amber-500/25 text-amber-400 z-20">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
              <span className="text-[11px] font-mono">{t.aiDegradedBanner}</span>
            </div>
          )}

          {/* Core Content Display Pane */}
          <main className="flex-1 min-h-0 overflow-hidden relative bg-[var(--color-background-dark)]">
            {children}
          </main>
        </div>
      </div>
      <ToastContainer />
    </div>
  );
};
