import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth, isSecurity } from './AuthContext';

/** Guards a route: requires a session, and optionally a security role. */
export function ProtectedRoute({
  children,
  requireSecurity = false,
}: {
  children: React.ReactElement;
  requireSecurity?: boolean;
}) {
  const { user, loading } = useAuth();
  if (loading) {
    return <div className="p-8 text-muted">Loading…</div>;
  }
  if (!user) return <Navigate to="/login" replace />;
  if (requireSecurity && !isSecurity(user.role)) {
    return <Navigate to="/my-data" replace />;
  }
  return children;
}
