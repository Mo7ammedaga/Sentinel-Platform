import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth, isSecurity, isWorkspace, isAdmin } from './AuthContext';

/** Guards a route: requires a session, and optionally a capability. */
export function ProtectedRoute({
  children,
  requireSecurity = false,
  requireWorkspace = false,
  requireAdmin = false,
}: {
  children: React.ReactElement;
  requireSecurity?: boolean;
  requireWorkspace?: boolean;
  requireAdmin?: boolean;
}) {
  const { user, loading } = useAuth();
  if (loading) {
    return <div className="p-8 text-muted">Loading…</div>;
  }
  if (!user) return <Navigate to="/login" replace />;
  if (requireSecurity && !isSecurity(user.role)) {
    return <Navigate to="/my-data" replace />;
  }
  if (requireWorkspace && !isWorkspace(user.role)) {
    return <Navigate to="/dashboard" replace />;
  }
  if (requireAdmin && !isAdmin(user.role)) {
    return <Navigate to="/dashboard" replace />;
  }
  return children;
}
