import React, { useState } from "react";
import { useApp } from "../AppContext";
import { Sun, Moon, AlertTriangle, ChevronLeft, ChevronRight } from "lucide-react";
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
    return <div className="min-h-screen bg-[#161412] flex flex-col">{children}</div>;
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
        <div className="flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden">
          {/* Header Bar */}
          <header className="glass-panel border-b border-stone-800 py-3 px-6 flex items-center justify-between z-10 shrink-0">
            <div className="flex items-center gap-3">
              {/* One-Click Zen Collapse Toggle [|] */}
              <button
                onClick={toggleZenMode}
                title={zenMode ? "Exit Zen Canvas [|]" : "Enter Zen Canvas [|]"}
                className={`p-1.5 px-2 rounded-lg border text-xs font-mono font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  zenMode
                    ? "bg-[#C79A4E]/20 text-[#C79A4E] border-[#C79A4E]/50 shadow-[0_0_12px_rgba(199,154,78,0.25)]"
                    : "border-stone-800 hover:border-stone-700 bg-stone-900/60 hover:bg-stone-850 text-stone-400 hover:text-stone-200"
                }`}
              >
                <span>[|]</span>
                <span className="text-[11px] font-mono tracking-wider">
                  {zenMode ? "ZEN MODE (ON)" : "ZEN"}
                </span>
              </button>

              {zenMode ? (
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-stone-600">|</span>
                  <span className="text-xs font-mono text-stone-300 font-semibold truncate hidden sm:inline">
                    KSP VAJRA 3.0 • SECURE WORKSPACE
                  </span>
                  <span className="text-stone-600 hidden sm:inline">|</span>
                  <span className="text-xs font-mono text-[#C79A4E] font-bold truncate">
                    SESSION: {activeChatSessionId || "CR-89/2026 INQUEST"}
                  </span>
                </div>
              ) : (
                <>
                  {/* Back/Forward screen navigation */}
                  <div className="hidden sm:flex items-center gap-1 mr-1">
                    <button
                      onClick={goBack}
                      disabled={!canGoBack}
                      aria-label="Back"
                      title={lang === "en" ? "Back" : "ಹಿಂದೆ"}
                      className="p-1.5 rounded-lg border border-stone-800 hover:border-stone-700 bg-stone-900/60 hover:bg-stone-850/80 text-stone-400 hover:text-stone-200 transition-all disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <button
                      onClick={goForward}
                      disabled={!canGoForward}
                      aria-label="Forward"
                      title={lang === "en" ? "Forward" : "ಮುಂದೆ"}
                      className="p-1.5 rounded-lg border border-stone-800 hover:border-stone-700 bg-stone-900/60 hover:bg-stone-850/80 text-stone-400 hover:text-stone-200 transition-all disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                  <VajraLogo animated={false} size={20} className="md:hidden" />
                  <div className="min-w-0">
                    <h1 className="text-sm font-bold text-stone-200 tracking-wide truncate">
                      {t.title}
                    </h1>
                    <p className="text-[10.5px] text-stone-500 truncate hidden sm:block">
                      {t.ksp} • {t.scrb}
                    </p>
                  </div>
                </>
              )}
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
          <main className="flex-1 min-h-0 overflow-hidden relative bg-[var(--color-background-dark)]">
            {children}
          </main>
        </div>
      </div>
      <ToastContainer />
    </div>
  );
};
