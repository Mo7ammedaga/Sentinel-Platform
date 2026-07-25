import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { ProtectedRoute } from './ProtectedRoute';
import { useAuth } from './AuthContext';

// isSecurity/isWorkspace/isAdmin are real (pure, already covered by
// AuthContext.test.tsx); only the hook itself is mocked so each test can
// control the logged-in user directly.
jest.mock('./AuthContext', () => ({
  ...jest.requireActual('./AuthContext'),
  useAuth: jest.fn(),
}));
const mockUseAuth = useAuth as jest.Mock;

function renderAt(initialPath: string, protectedRoute: React.ReactElement) {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="/" element={protectedRoute} />
        <Route path="/login" element={<div>Login Page</div>} />
        <Route path="/dashboard" element={<div>Dashboard Page</div>} />
        <Route path="/my-data" element={<div>My Data Page</div>} />
      </Routes>
    </MemoryRouter>
  );
}

describe('ProtectedRoute', () => {
  it('shows a loading state while auth is resolving', () => {
    mockUseAuth.mockReturnValue({ user: null, loading: true });
    renderAt('/', <ProtectedRoute><div>Secret</div></ProtectedRoute>);
    expect(screen.getByText('Loading…')).toBeInTheDocument();
  });

  it('redirects to /login when there is no user', () => {
    mockUseAuth.mockReturnValue({ user: null, loading: false });
    renderAt('/', <ProtectedRoute><div>Secret</div></ProtectedRoute>);
    expect(screen.getByText('Login Page')).toBeInTheDocument();
  });

  it('renders the protected content for an authorized role', () => {
    mockUseAuth.mockReturnValue({ user: { role: 'analyst' }, loading: false });
    renderAt('/', <ProtectedRoute requireSecurity><div>Secret</div></ProtectedRoute>);
    expect(screen.getByText('Secret')).toBeInTheDocument();
  });

  it('sends an employee away from a security-only route to /my-data', () => {
    mockUseAuth.mockReturnValue({ user: { role: 'employee' }, loading: false });
    renderAt('/', <ProtectedRoute requireSecurity><div>Secret</div></ProtectedRoute>);
    expect(screen.getByText('My Data Page')).toBeInTheDocument();
    expect(screen.queryByText('Secret')).not.toBeInTheDocument();
  });

  it('sends a non-admin away from an admin-only route to /dashboard', () => {
    mockUseAuth.mockReturnValue({ user: { role: 'manager' }, loading: false });
    renderAt('/', <ProtectedRoute requireAdmin><div>Secret</div></ProtectedRoute>);
    expect(screen.getByText('Dashboard Page')).toBeInTheDocument();
  });
});
