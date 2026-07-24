import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { apiError } from '../api/client';
import { ErrorNote } from '../components/ui';

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await login(email, password);
      // Land on the dashboard; ProtectedRoute redirects non-security users to
      // /my-data automatically.
      navigate('/dashboard');
    } catch (err) {
      setError(apiError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-full items-center justify-center p-6">
      <form onSubmit={submit} className="w-full max-w-sm space-y-4 rounded-lg border border-slate-800 bg-slate-900/60 p-6">
        <div>
          <div className="text-xl font-semibold text-white">Sentinel</div>
          <div className="text-sm text-muted">Sign in to the security platform</div>
        </div>
        {error && <ErrorNote message={error} />}
        <div>
          <label className="mb-1 block text-xs text-muted">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full rounded border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 outline-none focus:border-accent"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-muted">Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="w-full rounded border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 outline-none focus:border-accent"
          />
        </div>
        <button
          type="submit"
          disabled={busy}
          className="w-full rounded bg-accent px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  );
}
