import React, { Suspense, lazy } from "react";
import { AppProvider, useApp } from "./AppContext";
import { LoginScreen } from "./screens/LoginScreen";
import { MainLayout } from "./components/MainLayout";
import { AIChatScreen } from "./screens/AIChatScreen";
import { SessionTimeoutGuard } from "./components/SessionTimeoutGuard";

// Code-split every screen except Login/AIChat (the two every officer hits on
// every session) so the initial bundle doesn't pay for Leaflet (Spatial) and
// Recharts (Reports) -- previously ~970KB loaded upfront regardless of
// whether a session ever visited those screens. Each import()'s own chunk
// only downloads the first time that screen is actually opened.
const SpatialScreen = lazy(() => import("./screens/SpatialScreen").then((m) => ({ default: m.SpatialScreen })));
const FIRSearchScreen = lazy(() => import("./screens/FIRSearchScreen").then((m) => ({ default: m.FIRSearchScreen })));
const ReportsScreen = lazy(() => import("./screens/ReportsScreen").then((m) => ({ default: m.ReportsScreen })));
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
  const { currentScreen, isAuthenticated } = useApp();

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
    ["spatial", "fir_search", "reports", "supervisor", "audit", "settings", "district_dashboard"].includes(currentScreen)
  );

  const renderOtherScreen = () => {
    switch (currentScreen) {
      case "spatial":
        return <SpatialScreen />;
      case "fir_search":
        return <FIRSearchScreen />;
      case "reports":
        return <ReportsScreen />;
      case "supervisor":
      case "audit":
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
          <AIChatScreen />
        </div>
        {!isChatActive && (
          <Suspense fallback={<ScreenLoadingFallback />}>{renderOtherScreen()}</Suspense>
        )}
      </div>
      <SessionTimeoutGuard />
    </MainLayout>
  );
};

export default function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}
