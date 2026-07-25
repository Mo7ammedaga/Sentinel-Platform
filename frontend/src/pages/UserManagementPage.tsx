import React, { useCallback, useEffect, useState } from 'react';
import { adminApi } from '../api/endpoints';
import { apiError, API_BASE } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { useToast } from '../components/Toast';
import { ManagedUser, Role } from '../types';
import { Card, Badge, Avatar, ErrorNote } from '../components/ui';
import { Select } from '../components/Field';
import { CardSkeleton } from '../components/Skeleton';

const ROLES: Role[] = ['employee', 'manager', 'analyst', 'admin'];
const roleTone: Record<Role, string> = {
  employee: 'normal', manager: 'normal', analyst: 'investigating', admin: 'critical',
};

export function UserManagementPage() {
  const { user: me } = useAuth();
  const { show } = useToast();
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [savingId, setSavingId] = useState<number | null>(null);

  const load = useCallback(async () => {
    try { setUsers(await adminApi.listUsers()); }
    catch (e) { setError(apiError(e)); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const changeRole = async (u: ManagedUser, role: Role) => {
    if (role === u.role) return;
    setError('');
    setSavingId(u.id);
    try {
      await adminApi.setRole(u.id, role);
      setUsers((prev) => prev.map((x) => (x.id === u.id ? { ...x, role } : x)));
      show(`${u.name} is now ${role}.`, 'success');
    } catch (e) {
      setError(apiError(e));
    } finally {
      setSavingId(null);
    }
  };

  if (loading) return <div className="max-w-3xl"><CardSkeleton rows={5} /></div>;

  return (
    <div className="max-w-3xl space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-white">User Management</h1>
        <p className="text-sm text-surface-500">
          Assign roles. New sign-ups always start as Employee; only an admin can
          grant Manager, Security Analyst, or Admin access.
        </p>
      </div>
      {error && <ErrorNote message={error} />}

      <Card className="!p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-surface-800 text-left text-xs uppercase text-surface-600">
              <tr>
                <th className="px-4 py-3">User</th>
                <th>Role</th>
                <th>Change to</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-t border-surface-800 transition-colors hover:bg-surface-800/30">
                  <td className="px-4 py-2.5">
                    <div className="flex min-w-[10rem] items-center gap-2.5">
                      <Avatar name={u.name} avatarUrl={`${API_BASE}/api/v1/auth/avatar/${u.id}`} size="sm" />
                      <div className="min-w-0">
                        <div className="truncate text-surface-100">
                          {u.name} {u.id === me?.id && <span className="text-xs text-surface-500">(you)</span>}
                        </div>
                        <div className="truncate text-xs text-surface-500">{u.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="whitespace-nowrap"><Badge status={roleTone[u.role]} /></td>
                  <td>
                    <Select
                      value={u.role}
                      disabled={u.id === me?.id || savingId === u.id}
                      onChange={(e) => changeRole(u, e.target.value as Role)}
                      className="w-32 py-1.5 text-xs"
                    >
                      {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                    </Select>
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr><td colSpan={3} className="py-6 text-center text-surface-500">No users.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
      <p className="text-xs text-surface-600">
        You cannot change your own role here (avoids accidentally locking yourself out).
      </p>
    </div>
  );
}
