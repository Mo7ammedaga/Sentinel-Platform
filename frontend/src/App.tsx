import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './auth/AuthContext';
import { ProtectedRoute } from './auth/ProtectedRoute';
import { Layout } from './components/Layout';
import { LoginPage } from './pages/LoginPage';
import { SignupPage } from './pages/SignupPage';
import { DashboardPage } from './pages/DashboardPage';
import { AlertsPage } from './pages/AlertsPage';
import { MyDataPage } from './pages/MyDataPage';
import { PrivacyPage } from './pages/PrivacyPage';
import { WorkspacePage } from './pages/WorkspacePage';
import { ChatPage } from './pages/ChatPage';

function Shell({ children, requireSecurity = false, requireWorkspace = false }: {
  children: React.ReactElement; requireSecurity?: boolean; requireWorkspace?: boolean;
}) {
  return (
    <ProtectedRoute requireSecurity={requireSecurity} requireWorkspace={requireWorkspace}>
      <Layout>{children}</Layout>
    </ProtectedRoute>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route path="/workspace" element={<Shell requireWorkspace><WorkspacePage /></Shell>} />
          <Route path="/chat" element={<Shell requireWorkspace><ChatPage /></Shell>} />
          <Route path="/dashboard" element={<Shell requireSecurity><DashboardPage /></Shell>} />
          <Route path="/alerts" element={<Shell requireSecurity><AlertsPage /></Shell>} />
          <Route path="/my-data" element={<Shell><MyDataPage /></Shell>} />
          <Route path="/privacy" element={<Shell><PrivacyPage /></Shell>} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
