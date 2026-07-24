import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './auth/AuthContext';
import { ProtectedRoute } from './auth/ProtectedRoute';
import { Layout } from './components/Layout';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { AlertsPage } from './pages/AlertsPage';
import { MyDataPage } from './pages/MyDataPage';
import { PrivacyPage } from './pages/PrivacyPage';

function Shell({ children, requireSecurity = false }: { children: React.ReactElement; requireSecurity?: boolean }) {
  return (
    <ProtectedRoute requireSecurity={requireSecurity}>
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
