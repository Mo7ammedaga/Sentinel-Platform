import React, { useCallback, useEffect, useState } from 'react';
import { adminApi } from '../api/endpoints';
import { apiError } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { ManagedUser, Role } from '../types';
import { Card, Badge, Spinner, ErrorNote } from '../components/ui';

const ROLES: Role[] = ['employee', 'manager', 'analyst', 'admin'];

const roleTone: Record<Role, string> = {
  employee: 'normal',
  manager: 'normal',
  analyst: 'investigating',
  admin: 'critical',
};

export function UserManagementPage() {
  const { user: me } = useAuth();
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
    } catch (e) {
      setError(apiError(e));
    } finally {
      setSavingId(null);
    }
  };

  if (loading) return <Spinner />;

  return (
    <div className="max-w-3xl space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-white">User Management</h1>
        <p className="text-sm text-muted">
          Assign roles. New sign-ups always start as Employee; only an admin can
          grant Manager, Security Analyst, or Admin access.
        </p>
      </div>
      {error && <ErrorNote message={error} />}

      <Card>
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase text-muted">
            <tr>
              <th className="py-2">Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Change to</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-t border-slate-800">
                <td className="py-2 text-slate-100">
                  {u.name} {u.id === me?.id && <span className="text-xs text-muted">(you)</span>}
                </td>
                <td className="text-muted">{u.email}</td>
                <td><Badge status={roleTone[u.role]} /> <span className="ml-1 text-xs capitalize text-slate-400">{u.role}</span></td>
                <td>
                  <select
                    value={u.role}
                    disabled={u.id === me?.id || savingId === u.id}
                    onChange={(e) => changeRole(u, e.target.value as Role)}
                    className="rounded border border-slate-700 bg-slate-800 px-2 py-1 text-xs text-slate-200 disabled:opacity-50"
                  >
                    {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                  </select>
                </td>
              </tr>
            ))}
            {users.length === 0 && (
              <tr><td colSpan={4} className="py-4 text-center text-muted">No users.</td></tr>
            )}
          </tbody>
        </table>
      </Card>
      <p className="text-xs text-muted">
        You cannot change your own role here (avoids accidentally locking yourself out).
      </p>
    </div>
  );
}
