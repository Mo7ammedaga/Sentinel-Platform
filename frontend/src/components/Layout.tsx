import React, { useEffect, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth, isSecurity, isWorkspace, isAdmin } from '../auth/AuthContext';
import { notificationsApi } from '../api/endpoints';

export function Layout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const security = isSecurity(user?.role);
  const workspace = isWorkspace(user?.role);
  const admin = isAdmin(user?.role);
  const [unread, setUnread] = useState(0);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (!user) return;
    const poll = () => notificationsApi.unreadCount().then(setUnread).catch(() => {});
    poll();
    const id = setInterval(poll, 30_000);
    return () => clearInterval(id);
  }, [user]);

  const link = (to: string, label: string) => (
    <NavLink
      to={to}
      onClick={() => setSidebarOpen(false)}
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
      {sidebarOpen && (
        <button
          aria-label="Close menu"
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 z-20 bg-black/50 md:hidden"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-30 w-56 shrink-0 border-r border-slate-800 bg-slate-950 p-4 transition-transform md:static md:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="mb-6 px-2">
          <div className="text-lg font-semibold text-white">Sentinel</div>
          <div className="text-xs text-muted">Security Platform</div>
        </div>
        <nav className="space-y-1">
          {workspace && link('/workspace', 'Workspace')}
          {workspace && link('/chat', 'Team Chat')}
          {workspace && link('/search', 'Search')}
          <NavLink
            to="/notifications"
            onClick={() => setSidebarOpen(false)}
            className={({ isActive }) =>
              `flex items-center justify-between rounded px-3 py-2 text-sm ${
                isActive ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-slate-200'
              }`
            }
          >
            <span>Notifications</span>
            {unread > 0 && (
              <span className="rounded-full bg-critical px-1.5 py-0.5 text-[10px] font-semibold text-white">
                {unread}
              </span>
            )}
          </NavLink>
          {security && link('/dashboard', 'Security Dashboard')}
          {security && link('/alerts', 'Alerts')}
          {admin && link('/admin/users', 'User Management')}
          {link('/account', 'My Account')}
          {link('/my-data', 'My Data')}
          {link('/privacy', 'Privacy Notice')}
        </nav>
      </aside>

      <div className="flex-1">
        <header className="flex items-center justify-between border-b border-slate-800 px-4 py-3 md:px-6">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              aria-label="Open menu"
              className="rounded border border-slate-700 p-2 text-slate-300 md:hidden"
            >
              <span className="block h-0.5 w-4 bg-current" />
              <span className="my-1 block h-0.5 w-4 bg-current" />
              <span className="block h-0.5 w-4 bg-current" />
            </button>
            <div className="text-sm text-muted">
              {user?.name} · <span className="capitalize">{user?.role}</span>
            </div>
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
        <main className="p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
