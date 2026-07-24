import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { apiError } from '../api/client';
import { ErrorNote } from '../components/ui';

const field =
  'w-full rounded border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 outline-none focus:border-accent';

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
    <div className="flex min-h-full items-center justify-center p-6">
      <form onSubmit={submit} className="w-full max-w-sm space-y-4 rounded-lg border border-slate-800 bg-slate-900/60 p-6">
        <div>
          <div className="text-xl font-semibold text-white">Create your account</div>
          <div className="text-sm text-muted">You'll join as an employee. Roles are assigned by an admin.</div>
        </div>
        {error && <ErrorNote message={error} />}
        <div className="flex gap-3">
          <input placeholder="First name" value={form.first_name} onChange={set('first_name')} required className={field} />
          <input placeholder="Last name" value={form.last_name} onChange={set('last_name')} required className={field} />
        </div>
        <input type="email" placeholder="Email" value={form.email} onChange={set('email')} required className={field} />
        <input type="password" placeholder="Password (min 8 characters)" value={form.password}
               onChange={set('password')} minLength={8} required className={field} />
        <button type="submit" disabled={busy}
                className="w-full rounded bg-accent px-3 py-2 text-sm font-medium text-white disabled:opacity-60">
          {busy ? 'Creating…' : 'Create account'}
        </button>
        <div className="text-center text-xs text-muted">
          Already have an account? <Link to="/login" className="text-accent">Sign in</Link>
        </div>
      </form>
    </div>
  );
}
