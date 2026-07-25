import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Shield, ArrowRight } from 'lucide-react';
import { useAuth, isSecurity, isWorkspace } from '../auth/AuthContext';
import { apiError } from '../api/client';
import { ErrorNote } from '../components/ui';
import { Input } from '../components/Field';
import { Button } from '../components/Button';

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
      const user = await login(email, password);
      // Land on whichever home actually applies to this role, instead of
      // always trying /dashboard and bouncing workspace-only users off it.
      navigate(isSecurity(user.role) ? '/dashboard' : isWorkspace(user.role) ? '/workspace' : '/my-data');
    } catch (err) {
      setError(apiError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative flex min-h-full items-center justify-center overflow-hidden p-6">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(37,99,235,0.12),transparent_50%)]" />

      <form onSubmit={submit} className="relative w-full max-w-sm animate-slideUp space-y-5 rounded-2xl border border-surface-800 bg-surface-900/80 p-7 shadow-elevated backdrop-blur">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 shadow-glow">
            <Shield className="h-5 w-5 text-white" strokeWidth={2.25} />
          </div>
          <div>
            <div className="text-lg font-semibold text-white">Sentinel</div>
            <div className="text-sm text-surface-500">Sign in to the security platform</div>
          </div>
        </div>

        {error && <ErrorNote message={error} />}

        <div className="space-y-3">
          <Input label="Email" type="email" value={email} autoFocus
                 onChange={(e) => setEmail(e.target.value)} required />
          <Input label="Password" type="password" value={password}
                 onChange={(e) => setPassword(e.target.value)} required />
        </div>

        <Button type="submit" loading={busy} className="w-full" icon={!busy && <ArrowRight className="h-3.5 w-3.5" />}>
          {busy ? 'Signing in…' : 'Sign in'}
        </Button>

        <div className="text-center text-xs text-surface-500">
          No account? <Link to="/signup" className="font-medium text-primary-400 hover:text-primary-300">Create one</Link>
        </div>
      </form>
    </div>
  );
}
