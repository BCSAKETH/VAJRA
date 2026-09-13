import React, { Suspense, lazy } from "react";
import { AppProvider, useApp } from "./AppContext";
import { LoginScreen } from "./screens/LoginScreen";
import { MainLayout } from "./components/MainLayout";
import { AIChatScreen } from "./screens/AIChatScreen";
import { SessionTimeoutGuard } from "./components/SessionTimeoutGuard";
import { ErrorBoundary } from "./components/ErrorBoundary";

// Code-split every screen except Login/AIChat (the two every officer hits on
// every session) so the initial bundle doesn't pay upfront for chunks a
// session might never visit. Each import()'s own chunk only downloads the
// first time that screen is actually opened.
// Part G (district redesign): SpatialScreen/ReportsScreen removed from here
// -- their functionality now lives as tabs inside District Analytics
// (DistrictSpatialAnalystPanel/DistrictDemographicPanel), not as separate
// routes. Leaflet/Recharts now load as part of DistrictDashboardScreen's
// own chunk instead.
const FIRSearchScreen = lazy(() => import("./screens/FIRSearchScreen").then((m) => ({ default: m.FIRSearchScreen })));
const SupervisorDashboardScreen = lazy(() =>
  import("./screens/SupervisorDashboardScreen").then((m) => ({ default: m.SupervisorDashboardScreen }))
);
const SettingsScreen = lazy(() => import("./screens/SettingsScreen").then((m) => ({ default: m.SettingsScreen })));
const DistrictDashboardScreen = lazy(() =>
  import("./screens/DistrictDashboardScreen").then((m) => ({ default: m.DistrictDashboardScreen }))
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
  const { currentScreen, isAuthenticated, roleTier, lang } = useApp();

  if (!isAuthenticated || currentScreen === "login") {
    return (
      <>
        <LoginScreen />
        <SessionTimeoutGuard />
      </>
    );
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
    ["fir_search", "supervisor", "audit", "settings", "district_dashboard"].includes(currentScreen)
  );

  const renderOtherScreen = () => {
    switch (currentScreen) {
      case "fir_search":
        return <FIRSearchScreen />;
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
      case "settings":
        return <SettingsScreen />;
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
      <SessionTimeoutGuard />
    </MainLayout>
  );
};

export default function App() {
  return (
    <ErrorBoundary>
      <AppProvider>
        <AppContent />
      </AppProvider>
    </ErrorBoundary>
  );
}
