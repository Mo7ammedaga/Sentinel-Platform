import React, { useEffect, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  Shield, LayoutDashboard, AlertTriangle, ShieldAlert, Briefcase, MessageSquare, Search,
  Bell, Users, UserCircle, Lock, Menu, LogOut, ChevronDown,
} from 'lucide-react';
import { useAuth, isSecurity, isWorkspace, isAdmin } from '../auth/AuthContext';
import { notificationsApi } from '../api/endpoints';
import { Avatar } from './ui';
import { CommandPalette } from './CommandPalette';

export function Layout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const security = isSecurity(user?.role);
  const workspace = isWorkspace(user?.role);
  const admin = isAdmin(user?.role);
  const [unread, setUnread] = useState(0);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (!user) return;
    const poll = () => notificationsApi.unreadCount().then(setUnread).catch(() => {});
    poll();
    const id = setInterval(poll, 30_000);
    return () => clearInterval(id);
  }, [user]);

  const link = (to: string, label: string, Icon: React.ElementType, badge?: number) => (
    <NavLink
      to={to}
      onClick={() => setSidebarOpen(false)}
      className={({ isActive }) =>
        `group flex items-center justify-between rounded-lg px-3 py-2 text-sm font-medium transition-colors duration-150 ${
          isActive
            ? 'bg-primary-500/10 text-primary-300'
            : 'text-surface-400 hover:bg-surface-800/70 hover:text-surface-100'
        }`
      }
    >
      {({ isActive }) => (
        <>
          <span className="flex items-center gap-2.5">
            <Icon className={`h-4 w-4 ${isActive ? 'text-primary-400' : 'text-surface-500 group-hover:text-surface-300'}`} />
            {label}
          </span>
          {!!badge && badge > 0 && (
            <span className="rounded-full bg-danger-500 px-1.5 py-0.5 text-[10px] font-semibold text-white">
              {badge}
            </span>
          )}
        </>
      )}
    </NavLink>
  );

  return (
    <div className="flex min-h-full">
      {sidebarOpen && (
        <button
          aria-label="Close menu"
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 z-20 bg-black/60 backdrop-blur-sm md:hidden"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-30 flex w-64 shrink-0 flex-col border-r border-surface-800
          bg-surface-950 transition-transform duration-200 md:static md:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center gap-2 px-5 py-5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary-500 to-primary-700 shadow-glow">
            <Shield className="h-4.5 w-4.5 text-white" strokeWidth={2.25} />
          </div>
          <div>
            <div className="text-sm font-semibold leading-none text-white">Sentinel</div>
            <div className="mt-0.5 text-[11px] leading-none text-surface-500">Security Platform</div>
          </div>
        </div>

        <nav className="flex-1 space-y-0.5 overflow-y-auto px-3">
          {workspace && (
            <>
              <div className="px-3 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-wider text-surface-600">Workspace</div>
              {link('/workspace', 'Workspace', Briefcase)}
              {link('/chat', 'Team Chat', MessageSquare)}
              {link('/search', 'Search', Search)}
            </>
          )}

          {security && (
            <>
              <div className="px-3 pb-1 pt-4 text-[10px] font-semibold uppercase tracking-wider text-surface-600">Security</div>
              {link('/dashboard', 'Dashboard', LayoutDashboard)}
              {link('/alerts', 'Alerts', AlertTriangle)}
              {link('/incidents', 'Incidents', ShieldAlert)}
            </>
          )}

          <div className="px-3 pb-1 pt-4 text-[10px] font-semibold uppercase tracking-wider text-surface-600">Personal</div>
          {link('/notifications', 'Notifications', Bell, unread)}
          {admin && link('/admin/users', 'User Management', Users)}
          {link('/my-data', 'My Data', Lock)}
        </nav>

        <div className="border-t border-surface-800 p-3">
          <div className="relative">
            <button
              onClick={() => setMenuOpen((v) => !v)}
              className="flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left transition-colors hover:bg-surface-800/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/50"
            >
              <Avatar name={user?.name || '?'} size="sm" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-surface-200">{user?.name}</span>
                <span className="block truncate text-xs capitalize text-surface-500">{user?.role}</span>
              </span>
              <ChevronDown className="h-3.5 w-3.5 shrink-0 text-surface-500" />
            </button>
            {menuOpen && (
              <div className="absolute bottom-full left-0 right-0 mb-2 animate-scaleIn overflow-hidden rounded-lg border border-surface-700 bg-surface-800 shadow-elevated">
                <button
                  onClick={() => { setMenuOpen(false); navigate('/account'); }}
                  className="flex w-full items-center gap-2 px-3 py-2.5 text-sm text-surface-300 hover:bg-surface-700 hover:text-white"
                >
                  <UserCircle className="h-4 w-4" /> My Account
                </button>
                <div className="h-px bg-surface-700" />
                <button
                  onClick={() => { logout(); navigate('/login'); }}
                  className="flex w-full items-center gap-2 px-3 py-2.5 text-sm text-surface-300 hover:bg-surface-700 hover:text-white"
                >
                  <LogOut className="h-4 w-4" /> Sign out
                </button>
              </div>
            )}
          </div>
        </div>
      </aside>

      <div className="flex-1">
        <header className="flex items-center justify-between border-b border-surface-800 bg-surface-950/60 px-4 py-3 backdrop-blur md:px-6">
          <button
            onClick={() => setSidebarOpen(true)}
            aria-label="Open menu"
            className="rounded-lg border border-surface-700 p-2 text-surface-300 hover:bg-surface-800 md:hidden"
          >
            <Menu className="h-4 w-4" />
          </button>
          {workspace ? (
            <button
              onClick={() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }))}
              className="hidden items-center gap-2 rounded-lg border border-surface-800 bg-surface-900/60 px-3 py-1.5 text-xs text-surface-500 transition-colors hover:border-surface-700 hover:text-surface-300 md:flex"
            >
              Search… <kbd className="rounded border border-surface-700 px-1 text-[10px]">⌘K</kbd>
            </button>
          ) : <div className="hidden md:block" />}
          <div className="text-sm text-surface-500 md:hidden">Sentinel</div>
          <div />
        </header>
        {workspace && <CommandPalette />}
        <main className="animate-fadeIn p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
