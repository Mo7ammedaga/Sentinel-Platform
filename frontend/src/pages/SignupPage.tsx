import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { UserPlus } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { apiError } from '../api/client';
import { ErrorNote } from '../components/ui';
import { Input } from '../components/Field';
import { Button } from '../components/Button';

export function SignupPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ first_name: '', last_name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm({ ...form, [k]: e.target.value });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await register(form);
      navigate('/my-data'); // new accounts are employees → workspace/my-data
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
        <div className="text-center">
          <div className="text-lg font-semibold text-white">Create your account</div>
          <div className="mt-1 text-sm text-surface-500">You'll join as an employee — roles are assigned by an admin.</div>
        </div>

        {error && <ErrorNote message={error} />}

        <div className="space-y-3">
          <div className="flex gap-3">
            <Input label="First name" value={form.first_name} onChange={set('first_name')} required autoFocus />
            <Input label="Last name" value={form.last_name} onChange={set('last_name')} required />
          </div>
          <Input label="Email" type="email" value={form.email} onChange={set('email')} required />
          <Input label="Password" type="password" hint="Minimum 8 characters" value={form.password}
                 onChange={set('password')} minLength={8} required />
        </div>

        <Button type="submit" loading={busy} className="w-full" icon={!busy && <UserPlus className="h-3.5 w-3.5" />}>
          {busy ? 'Creating…' : 'Create account'}
        </Button>

        <div className="text-center text-xs text-surface-500">
          Already have an account? <Link to="/login" className="font-medium text-primary-400 hover:text-primary-300">Sign in</Link>
        </div>
      </form>
    </div>
  );
}
