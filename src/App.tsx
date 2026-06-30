/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { AppProvider, useApp } from './AppContext';
import { LandingScreen } from './screens/LandingScreen';
import { LoginScreen } from './screens/LoginScreen';
import { MainLayout } from './components/MainLayout';

// Import All 11 Operational Screens
import { CommandCenterScreen } from './screens/CommandCenterScreen';
import { AIChatScreen } from './screens/AIChatScreen';
import { SpatialScreen } from './screens/SpatialScreen';
import { NetworkScreen } from './screens/NetworkScreen';
import { CaseWorkspaceScreen } from './screens/CaseWorkspaceScreen';
import { AccusedProfileScreen } from './screens/AccusedProfileScreen';
import { FIRSearchScreen } from './screens/FIRSearchScreen';
import { AlertsFeedScreen } from './screens/AlertsFeedScreen';
import { ReportsScreen } from './screens/ReportsScreen';
import { AuditTrailScreen } from './screens/AuditTrailScreen';
import { SettingsScreen } from './screens/SettingsScreen';

const AppContent: React.FC = () => {
  const { currentScreen, isAuthenticated } = useApp();

  // If investigator is not authenticated, restrict view strictly to landing or login
  if (!isAuthenticated) {
    if (currentScreen === 'landing') {
      return <LandingScreen />;
    }
    return <LoginScreen />;
  }

  // Define operational router rendering based on currentScreen ID
  const renderOperationalScreen = () => {
    switch (currentScreen) {
      case 'command_center':
        return <CommandCenterScreen />;
      case 'ai_chat':
        return <AIChatScreen />;
      case 'spatial':
        return <SpatialScreen />;
      case 'network':
        return <NetworkScreen />;
      case 'case_workspace':
        return <CaseWorkspaceScreen />;
      case 'accused_profile':
        return <AccusedProfileScreen />;
      case 'fir_search':
        return <FIRSearchScreen />;
      case 'alerts_feed':
        return <AlertsFeedScreen />;
      case 'reports':
        return <ReportsScreen />;
      case 'audit_trail':
        return <AuditTrailScreen />;
      case 'settings':
        return <SettingsScreen />;
      default:
        return <CommandCenterScreen />;
    }
  };

  // If authenticated, we wrap all operational views with MainLayout
  return (
    <MainLayout>
      {renderOperationalScreen()}
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
