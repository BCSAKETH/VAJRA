import React, { Suspense, lazy } from "react";
import { AppProvider, useApp } from "./AppContext";
import { LoginScreen } from "./screens/LoginScreen";
import { MainLayout } from "./components/MainLayout";
import { AIChatScreen } from "./screens/AIChatScreen";
import { SessionTimeoutGuard } from "./components/SessionTimeoutGuard";
import { FocusLossCurtain } from "./components/FocusLossCurtain";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { ChangePasswordModal } from "./components/ChangePasswordModal";
import { RemoteEvictionModal } from "./components/RemoteEvictionModal";
import { UnrecognizedLoginWarningModal } from "./components/UnrecognizedLoginWarningModal";

// Code-split every screen except Login/AIChat (the two every officer hits on
// every session) so the initial bundle doesn't pay upfront for chunks a
// session might never visit. Each import()'s own chunk only downloads the
// first time that screen is actually opened.
// Part G (district redesign): SpatialScreen/ReportsScreen removed from here
// -- their functionality now lives as tabs inside District Analytics
// (DistrictSpatialAnalystPanel/DistrictDemographicPanel), not as separate
// routes. Leaflet/Recharts now load as part of DistrictDashboardScreen's
// own chunk instead.
const SupervisorDashboardScreen = lazy(() =>
  import("./screens/SupervisorDashboardScreen").then((m) => ({ default: m.SupervisorDashboardScreen }))
);
// §32: Settings is now a global overlay (SettingsModal), not a screen --
// still lazy-loaded (same chunk-on-first-open discipline as every other
// secondary screen), just via SettingsModal instead of SettingsScreen
// directly (SettingsModal itself imports and renders SettingsScreen).
const SettingsModal = lazy(() => import("./components/SettingsModal").then((m) => ({ default: m.SettingsModal })));
const DistrictDashboardScreen = lazy(() =>
  import("./screens/DistrictDashboardScreen").then((m) => ({ default: m.DistrictDashboardScreen }))
);
const InvestigationsScreen = lazy(() =>
  import("./screens/InvestigationsScreen").then((m) => ({ default: m.InvestigationsScreen }))
);
// "View all conversations" -- reached only via the sidebar's own link, no
// nav-rail icon (same lazy-chunk pattern as every other secondary screen).
const AllChatsScreen = lazy(() =>
  import("./screens/AllChatsScreen").then((m) => ({ default: m.AllChatsScreen }))
);

const ScreenLoadingFallback: React.FC = () => (
  <div className="h-full flex items-center justify-center">
    <div className="flex flex-col items-center gap-3 text-stone-500">
      <div className="w-8 h-8 border-2 border-stone-800 border-t-[#C79A4E] rounded-full animate-spin" />
      <span className="text-[10px] font-mono uppercase tracking-wider">Loading…</span>
    </div>
  </div>
);

const AppContent: React.FC = () => {
  const {
    currentScreen,
    isAuthenticated,
    roleTier,
    lang,
    mustChangePassword,
    setMustChangePassword,
    evictionNotice,
    setEvictionNotice,
    setIsAuthenticated,
    isSettingsOpen,
    closeSettings,
  } = useApp();

  const handleAcknowledgeEviction = () => {
    setEvictionNotice(null);
    setIsAuthenticated(false);
  };

  if (evictionNotice) {
    return (
      <RemoteEvictionModal
        evictionData={evictionNotice}
        onAcknowledge={handleAcknowledgeEviction}
      />
    );
  }

  if (!isAuthenticated || currentScreen === "login") {
    return <LoginScreen />;
  }

  // AIChatScreen renders ALWAYS-MOUNTED, hidden via CSS instead of switched
  // out of the DOM -- previously it unmounted on every screen navigation,
  // which destroyed its local state (activeSessionId, isThinking, the
  // WebSocket connection) entirely. A running query commonly takes 15-140s
  // (see the thinking-indicator comment in AIChatScreen.tsx); checking the
  // map or another screen while waiting is a normal workflow, and coming
  // back used to lose the in-progress answer and reset the conversation.
  // Every other screen is fine to unmount/remount (no long-lived state to
  // preserve) and stays lazy/code-split as before.
  const isChatActive = currentScreen === "ai_chat" || !(
    ["supervisor", "audit", "district_dashboard", "investigations", "all_chats"].includes(currentScreen)
  );

  const renderOtherScreen = () => {
    switch (currentScreen) {
      case "investigations":
        return <InvestigationsScreen />;
      case "all_chats":
        return <AllChatsScreen />;
      case "supervisor":
      case "audit":
        if (roleTier !== "supervisor") {
          return (
            <div className="h-full flex items-center justify-center p-6">
              <div className="max-w-sm text-center space-y-2">
                <p className="text-sm font-bold text-rose-400">
                  {lang === "en" ? "Access Restricted" : "ಪ್ರವೇಶ ನಿರ್ಬಂಧಿಸಲಾಗಿದೆ"}
                </p>
                <p className="text-xs text-stone-500">
                  {lang === "en"
                    ? "The Supervisor Dashboard requires Supervisor-tier clearance (PI and above)."
                    : "ಸೂಪರ್‌ವೈಸರ್ ಡ್ಯಾಶ್‌ಬೋರ್ಡ್‌ಗೆ ಸೂಪರ್‌ವೈಸರ್-ಹಂತದ ಅನುಮತಿ ಅಗತ್ಯವಿದೆ (PI ಮತ್ತು ಮೇಲ್ಪಟ್ಟು)."}
                </p>
              </div>
            </div>
          );
        }
        return <SupervisorDashboardScreen />;
      case "district_dashboard":
        return <DistrictDashboardScreen />;
      default:
        return null;
    }
  };

  return (
    <MainLayout>
      <div className="h-full relative">
        <div className="absolute inset-0" style={{ display: isChatActive ? "block" : "none" }}>
          <ErrorBoundary
            fallbackTitle={lang === "en" ? "AI Copilot Hub Encountered an Issue" : "AI ಕೊಪೈಲಟ್ ಹಬ್‌ನಲ್ಲಿ ದೋಷ ಸಂಭವಿಸಿದೆ"}
            fallbackMessage={lang === "en" ? "A message in this session could not be rendered. Click Reset to restore normal conversation." : "ಈ ಅಧಿವೇಶನದಲ್ಲಿ ಸಂದೇಶವನ್ನು ರೆಂಡರ್ ಮಾಡಲು ಸಾಧ್ಯವಾಗಲಿಲ್ಲ. ಮರುಸ್ಥಾಪಿಸಲು ರೀಸೆಟ್ ಕ್ಲಿಕ್ ಮಾಡಿ."}
          >
            <AIChatScreen />
          </ErrorBoundary>
        </div>
        {!isChatActive && (
          <Suspense fallback={<ScreenLoadingFallback />}>
            <ErrorBoundary
              fallbackTitle={lang === "en" ? "Screen Render Interrupted" : "ಪರದೆಯ ರೆಂಡರ್ ಅಡಚಣೆಯಾಗಿದೆ"}
              fallbackMessage={lang === "en" ? "An unexpected error occurred while rendering this workspace. Click Reset to retry." : "ಈ ಕಾರ್ಯಕ್ಷೇತ್ರವನ್ನು ರೆಂಡರ್ ಮಾಡುವಾಗ ಅನಿರೀಕ್ಷಿತ ದೋಷ ಸಂಭವಿಸಿದೆ. ಮರುಪ್ರಯತ್ನಿಸಲು ರೀಸೆಟ್ ಕ್ಲಿಕ್ ಮಾಡಿ."}
            >
              {renderOtherScreen()}
            </ErrorBoundary>
          </Suspense>
        )}
      </div>
      {mustChangePassword && (
        <ChangePasswordModal
          isOpen={true}
          isMandatory={true}
          onClose={() => setMustChangePassword(false)}
        />
      )}
      {isSettingsOpen && (
        <Suspense
          fallback={
            <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 backdrop-blur-md">
              <div className="w-8 h-8 border-2 border-stone-800 border-t-[#C79A4E] rounded-full animate-spin" />
            </div>
          }
        >
          <SettingsModal isOpen={isSettingsOpen} onClose={closeSettings} />
        </Suspense>
      )}
    </MainLayout>
  );
};

export default function App() {
  return (
    <ErrorBoundary>
      <AppProvider>
        {/* E.4: single global mount (was previously duplicated in both the
            login-screen branch and the authenticated MainLayout branch of
            AppContent above) -- a duplicate mount meant two independent
            copies of this guard's timers/localStorage listeners ran at
            once. One mount here covers both states since the component
            itself already no-ops via `if (!isAuthenticated) return;`. */}
        <SessionTimeoutGuard />
        {/* E.7: global focus-loss deterrent curtain (D.12 honest half) --
            single mount here covers every screen; the officer-attribution
            watermark half stays mounted per-screen (WatermarkOverlay.tsx),
            as it already was. */}
        <FocusLossCurtain />
        {/* Section 97: single global mount, same self-gating pattern as
            SessionTimeoutGuard above -- no-ops entirely unless the signed-in
            officer is a supervisor, so it's safe to mount unconditionally
            here rather than duplicating it per-screen. */}
        <UnrecognizedLoginWarningModal />
        <AppContent />
      </AppProvider>
    </ErrorBoundary>
  );
}
