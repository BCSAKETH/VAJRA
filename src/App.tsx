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

  const renderScreen = () => {
    switch (currentScreen) {
      case "ai_chat":
        return <AIChatScreen />;
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
      default:
        return <AIChatScreen />;
    }
  };

  return (
    <MainLayout>
      <Suspense fallback={<ScreenLoadingFallback />}>{renderScreen()}</Suspense>
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
