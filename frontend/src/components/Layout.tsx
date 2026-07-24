import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth, isSecurity, isWorkspace } from '../auth/AuthContext';

export function Layout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const security = isSecurity(user?.role);
  const workspace = isWorkspace(user?.role);

  const link = (to: string, label: string) => (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `block rounded px-3 py-2 text-sm ${
          isActive ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-slate-200'
        }`
      }
    >
      {label}
    </NavLink>
  );

  return (
    <div className="flex min-h-full">
      <aside className="w-56 shrink-0 border-r border-slate-800 bg-slate-900/40 p-4">
        <div className="mb-6 px-2">
          <div className="text-lg font-semibold text-white">Sentinel</div>
          <div className="text-xs text-muted">Security Platform</div>
        </div>
        <nav className="space-y-1">
          {workspace && link('/workspace', 'Workspace')}
          {security && link('/dashboard', 'Security Dashboard')}
          {security && link('/alerts', 'Alerts')}
          {link('/my-data', 'My Data')}
          {link('/privacy', 'Privacy Notice')}
        </nav>
      </aside>

      <div className="flex-1">
        <header className="flex items-center justify-between border-b border-slate-800 px-6 py-3">
          <div className="text-sm text-muted">
            {user?.name} · <span className="capitalize">{user?.role}</span>
          </div>
          <button
            onClick={() => {
              logout();
              navigate('/login');
            }}
            className="rounded border border-slate-700 px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-800"
          >
            Sign out
          </button>
        </header>
        <main className="p-6">{children}</main>
      </div>
    </div>
  );
}
