import React from "react";
import { AppProvider, useApp } from "./AppContext";
import { LoginScreen } from "./screens/LoginScreen";
import { MainLayout } from "./components/MainLayout";
import { AIChatScreen } from "./screens/AIChatScreen";
import { SpatialScreen } from "./screens/SpatialScreen";
import { FIRSearchScreen } from "./screens/FIRSearchScreen";
import { ReportsScreen } from "./screens/ReportsScreen";
import { SupervisorDashboardScreen } from "./screens/SupervisorDashboardScreen";
import { SettingsScreen } from "./screens/SettingsScreen";
import { SessionTimeoutGuard } from "./components/SessionTimeoutGuard";

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
      {renderScreen()}
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
