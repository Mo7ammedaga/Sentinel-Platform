import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Camera, Activity, Monitor, ShieldCheck, LogOut, User, Lock, Laptop,
} from 'lucide-react';
import { authApi, privacyApi } from '../api/endpoints';
import { apiError, API_BASE } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { useToast } from '../components/Toast';
import { FullProfile, Session } from '../types';
import { Card, Avatar, ErrorNote } from '../components/ui';
import { Input, Textarea } from '../components/Field';
import { Button } from '../components/Button';
import { CardSkeleton } from '../components/Skeleton';

type Tab = 'profile' | 'security' | 'sessions';

export function AccountPage() {
  const { logout } = useAuth();
  const { show } = useToast();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>('profile');

  const [profile, setProfile] = useState<FullProfile | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [eventCount, setEventCount] = useState<number | null>(null);
  const [revokingId, setRevokingId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [bio, setBio] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);

  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [savingPw, setSavingPw] = useState(false);
  const [pwError, setPwError] = useState('');

  const [uploading, setUploading] = useState(false);

  const load = async () => {
    try {
      const [p, s, ev] = await Promise.all([
        authApi.fullProfile(), authApi.listSessions(), privacyApi.myEvents(1),
      ]);
      setProfile(p);
      setFirstName(p.first_name); setLastName(p.last_name); setBio(p.bio || '');
      setSessions(s);
      setEventCount(ev.pagination.total);
    } catch (e) {
      setError(apiError(e));
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true); setError('');
    try {
      await authApi.updateProfile({ first_name: firstName, last_name: lastName, bio });
      await load();
      show('Profile updated.', 'success');
    } catch (e) {
      setError(apiError(e));
    } finally {
      setSavingProfile(false);
    }
  };

  const savePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwError('');
    if (newPw !== confirmPw) { setPwError('New passwords do not match.'); return; }
    setSavingPw(true);
    try {
      await authApi.changePassword(currentPw, newPw);
      setCurrentPw(''); setNewPw(''); setConfirmPw('');
      show('Password updated.', 'success');
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
      show('Photo updated.', 'success');
    } catch (e) {
      setError(apiError(e));
    } finally {
      setUploading(false);
    }
  };

  const revokeSession = async (s: Session) => {
    setRevokingId(s.id);
    try {
      await authApi.revokeSession(s.id);
      if (s.is_current) {
        logout();
        navigate('/login');
        return;
      }
      setSessions(await authApi.listSessions());
      show('Session signed out.', 'success');
    } catch (e) {
      setError(apiError(e));
    } finally {
      setRevokingId(null);
    }
  };

  if (loading) return <div className="max-w-3xl space-y-4"><CardSkeleton rows={4} /></div>;
  if (!profile) return <ErrorNote message={error || 'Could not load profile.'} />;

  const avatarSrc = profile.avatar_url ? `${API_BASE}${profile.avatar_url}` : undefined;
  const tabs: { key: Tab; label: string; icon: React.ElementType }[] = [
    { key: 'profile', label: 'Profile', icon: User },
    { key: 'security', label: 'Security', icon: Lock },
    { key: 'sessions', label: 'Sessions', icon: Laptop },
  ];

  return (
    <div className="max-w-3xl space-y-5">
      {/* Cover + identity header */}
      <div className="overflow-hidden rounded-xl border border-surface-800">
        <div className="h-28 bg-gradient-to-br from-primary-700 via-primary-600 to-primary-900" />
        <div className="relative bg-surface-900/60 px-6 pb-5">
          <div className="-mt-10 flex items-end gap-4">
            <div className="relative">
              <Avatar name={profile.name} avatarUrl={avatarSrc} size="xl" />
              <label aria-label="Change avatar photo"
                     className="absolute bottom-0 right-0 flex h-6 w-6 cursor-pointer items-center justify-center rounded-full bg-primary-600 text-white shadow-soft hover:bg-primary-500">
                <Camera className="h-3 w-3" />
                <input type="file" accept="image/*" className="hidden" disabled={uploading}
                       onChange={(e) => onAvatarPick(e.target.files?.[0] ?? null)} />
              </label>
            </div>
            <div className="pb-1">
              <div className="text-lg font-semibold text-white">{profile.name}</div>
              <div className="text-sm text-surface-500">{profile.email} · <span className="capitalize">{profile.role}</span></div>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-3 gap-3 border-t border-surface-800 pt-4">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-primary-400" />
              <div>
                <div className="text-sm font-semibold text-surface-100">{eventCount ?? '—'}</div>
                <div className="text-[11px] text-surface-500">events recorded</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Monitor className="h-4 w-4 text-primary-400" />
              <div>
                <div className="text-sm font-semibold text-surface-100">{sessions.length}</div>
                <div className="text-[11px] text-surface-500">active sessions</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-primary-400" />
              <div>
                <div className="text-sm font-semibold capitalize text-surface-100">{profile.role}</div>
                <div className="text-[11px] text-surface-500">access level</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {error && <ErrorNote message={error} />}

      {/* Tabs */}
      <div className="flex gap-1 border-b border-surface-800" role="tablist">
        {tabs.map((t) => (
          <button
            key={t.key}
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
              tab === t.key ? 'border-primary-500 text-primary-300' : 'border-transparent text-surface-500 hover:text-surface-300'
            }`}
          >
            <t.icon className="h-3.5 w-3.5" /> {t.label}
          </button>
        ))}
      </div>

      {tab === 'profile' && (
        <Card>
          <form onSubmit={saveProfile} className="space-y-3">
            <div className="flex gap-3">
              <Input label="First name" value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
              <Input label="Last name" value={lastName} onChange={(e) => setLastName(e.target.value)} required />
            </div>
            <Textarea label="Bio" rows={3} maxLength={500} value={bio}
                      onChange={(e) => setBio(e.target.value)}
                      hint={`${bio.length}/500 — tell your team a bit about yourself`} />
            <Button type="submit" loading={savingProfile}>Save changes</Button>
          </form>
        </Card>
      )}

      {tab === 'security' && (
        <Card>
          <form onSubmit={savePassword} className="max-w-sm space-y-3">
            <h2 className="text-sm font-semibold text-surface-200">Change password</h2>
            {pwError && <ErrorNote message={pwError} />}
            <Input label="Current password" type="password" value={currentPw}
                   onChange={(e) => setCurrentPw(e.target.value)} required />
            <Input label="New password" type="password" value={newPw} minLength={8}
                   onChange={(e) => setNewPw(e.target.value)} required />
            <Input label="Confirm new password" type="password" value={confirmPw} minLength={8}
                   onChange={(e) => setConfirmPw(e.target.value)} required />
            <Button type="submit" loading={savingPw}>Update password</Button>
          </form>
        </Card>
      )}

      {tab === 'sessions' && (
        <Card>
          <h2 className="mb-1 text-sm font-semibold text-surface-200">Sessions & devices</h2>
          <p className="mb-3 text-xs text-surface-500">Every device you've logged in from. Sign out anything you don't recognise.</p>
          {sessions.length === 0 ? (
            <p className="text-sm text-surface-500">No active sessions.</p>
          ) : (
            <ul className="space-y-2">
              {sessions.map((s) => (
                <li key={s.id} className="flex items-center justify-between gap-3 rounded-lg border border-surface-800 px-3.5 py-2.5">
                  <div className="flex items-center gap-3">
                    <Laptop className="h-4 w-4 text-surface-500" />
                    <div>
                      <div className="flex items-center gap-2 text-sm text-surface-200">
                        {s.device}
                        {s.is_current && (
                          <span className="rounded-full border border-success-500/30 bg-success-500/15 px-1.5 py-0.5 text-[10px] text-success-400">this device</span>
                        )}
                      </div>
                      <div className="text-xs text-surface-500">
                        {s.ip_address || 'unknown IP'} · last used {s.last_used_at ? new Date(s.last_used_at).toLocaleString() : 'never'}
                      </div>
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" loading={revokingId === s.id}
                          icon={!revokingId && <LogOut className="h-3 w-3" />}
                          onClick={() => revokeSession(s)}>
                    Sign out
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}
    </div>
  );
}
