import React, { useEffect, useState } from 'react';
import { authApi } from '../api/endpoints';
import { apiError, API_BASE } from '../api/client';
import { FullProfile } from '../types';
import { Card, Spinner, ErrorNote } from '../components/ui';

const field =
  'w-full rounded border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 outline-none focus:border-accent';

export function AccountPage() {
  const [profile, setProfile] = useState<FullProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [bio, setBio] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [saved, setSaved] = useState('');

  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [savingPw, setSavingPw] = useState(false);
  const [pwError, setPwError] = useState('');
  const [pwSaved, setPwSaved] = useState('');

  const [uploading, setUploading] = useState(false);

  const load = async () => {
    try {
      const p = await authApi.fullProfile();
      setProfile(p);
      setFirstName(p.first_name);
      setLastName(p.last_name);
      setBio(p.bio || '');
    } catch (e) {
      setError(apiError(e));
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true); setSaved(''); setError('');
    try {
      await authApi.updateProfile({ first_name: firstName, last_name: lastName, bio });
      await load();
      setSaved('Saved.');
    } catch (e) {
      setError(apiError(e));
    } finally {
      setSavingProfile(false);
    }
  };

  const savePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwError(''); setPwSaved('');
    if (newPw !== confirmPw) { setPwError('New passwords do not match.'); return; }
    setSavingPw(true);
    try {
      await authApi.changePassword(currentPw, newPw);
      setCurrentPw(''); setNewPw(''); setConfirmPw('');
      setPwSaved('Password updated.');
    } catch (e) {
      setPwError(apiError(e));
    } finally {
      setSavingPw(false);
    }
  };

  const onAvatarPick = async (file: File | null) => {
    if (!file) return;
    setUploading(true); setError('');
    try {
      await authApi.uploadAvatar(file);
      await load();
    } catch (e) {
      setError(apiError(e));
    } finally {
      setUploading(false);
    }
  };

  if (loading) return <Spinner />;
  if (!profile) return <ErrorNote message={error || 'Could not load profile.'} />;

  const initials = profile.name.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase();

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-white">My Account</h1>
        <p className="text-sm text-muted">Manage your profile, photo, and password.</p>
      </div>
      {error && <ErrorNote message={error} />}

      <Card>
        <div className="flex items-center gap-4">
          {profile.avatar_url ? (
            <img src={`${API_BASE}${profile.avatar_url}`} alt=""
                 className="h-16 w-16 rounded-full object-cover" />
          ) : (
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-slate-700 text-lg font-semibold text-slate-200">
              {initials || '?'}
            </div>
          )}
          <div>
            <label className="inline-block cursor-pointer rounded border border-slate-700 px-3 py-1.5 text-sm text-slate-200 hover:bg-slate-800">
              {uploading ? 'Uploading…' : 'Change photo'}
              <input type="file" accept="image/*" className="hidden" disabled={uploading}
                     onChange={(e) => onAvatarPick(e.target.files?.[0] ?? null)} />
            </label>
            <p className="mt-1 text-xs text-muted">
              {profile.email} · <span className="capitalize">{profile.role}</span>
            </p>
          </div>
        </div>
      </Card>

      <Card>
        <form onSubmit={saveProfile} className="space-y-3">
          <h2 className="text-sm font-semibold text-slate-200">Profile</h2>
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="mb-1 block text-xs text-muted">First name</label>
              <input className={field} value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
            </div>
            <div className="flex-1">
              <label className="mb-1 block text-xs text-muted">Last name</label>
              <input className={field} value={lastName} onChange={(e) => setLastName(e.target.value)} required />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted">Bio</label>
            <textarea className={field} rows={3} maxLength={500} value={bio}
                      onChange={(e) => setBio(e.target.value)}
                      placeholder="Tell your team a bit about yourself…" />
            <p className="mt-1 text-right text-xs text-slate-600">{bio.length}/500</p>
          </div>
          <div className="flex items-center gap-3">
            <button className="rounded bg-accent px-3 py-1.5 text-sm font-medium text-white disabled:opacity-60"
                    disabled={savingProfile}>
              {savingProfile ? 'Saving…' : 'Save changes'}
            </button>
            {saved && <span className="text-xs text-emerald-400">{saved}</span>}
          </div>
        </form>
      </Card>

      <Card>
        <form onSubmit={savePassword} className="space-y-3">
          <h2 className="text-sm font-semibold text-slate-200">Change password</h2>
          {pwError && <ErrorNote message={pwError} />}
          <div>
            <label className="mb-1 block text-xs text-muted">Current password</label>
            <input type="password" className={field} value={currentPw}
                   onChange={(e) => setCurrentPw(e.target.value)} required />
          </div>
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="mb-1 block text-xs text-muted">New password</label>
              <input type="password" className={field} value={newPw} minLength={8}
                     onChange={(e) => setNewPw(e.target.value)} required />
            </div>
            <div className="flex-1">
              <label className="mb-1 block text-xs text-muted">Confirm new password</label>
              <input type="password" className={field} value={confirmPw} minLength={8}
                     onChange={(e) => setConfirmPw(e.target.value)} required />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button className="rounded bg-accent px-3 py-1.5 text-sm font-medium text-white disabled:opacity-60"
                    disabled={savingPw}>
              {savingPw ? 'Updating…' : 'Update password'}
            </button>
            {pwSaved && <span className="text-xs text-emerald-400">{pwSaved}</span>}
          </div>
        </form>
      </Card>
    </div>
  );
}
