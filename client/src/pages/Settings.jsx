import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import api from '../api/client';
import useStore from '../store/useStore';
import AppSidebar from '../components/AppSidebar';

const AVATAR_COLORS = ['bg-violet-500','bg-blue-500','bg-emerald-500','bg-orange-500','bg-pink-500'];
function avatarColor(name = '') {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}

// ── Toggle component ───────────────────────────────────────────
function Toggle({ checked, onChange }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ${checked ? 'bg-accent' : 'bg-surface-3'}`}
    >
      <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${checked ? 'translate-x-5' : 'translate-x-0'}`} />
    </button>
  );
}

// ── Profile tab ────────────────────────────────────────────────
function ProfileTab({ user, onLogout }) {
  const queryClient = useQueryClient();
  const setAuth = useStore((s) => s.setAuth);
  const accessToken = useStore((s) => s.accessToken);

  const [form, setForm] = useState({ name: user?.name || '', email: user?.email || '', bio: user?.bio || '' });
  const [pwForm, setPwForm] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [pwError, setPwError] = useState('');

  useEffect(() => {
    if (user) setForm({ name: user.name, email: user.email, bio: user.bio || '' });
  }, [user]);

  const profileMutation = useMutation({
    mutationFn: (data) => api.patch('/api/user/me', data).then((r) => r.data),
    onSuccess: (data) => {
      setAuth(data.user, accessToken);
      queryClient.invalidateQueries({ queryKey: ['me'] });
      toast.success('Profile updated');
    },
    onError: (err) => toast.error(err.response?.data?.error?.message || 'Failed to update'),
  });

  const pwMutation = useMutation({
    mutationFn: (data) => api.patch('/api/user/password', data).then((r) => r.data),
    onSuccess: () => { toast.success('Password changed'); setPwForm({ currentPassword: '', newPassword: '', confirm: '' }); setPwError(''); },
    onError: (err) => setPwError(err.response?.data?.error?.message || 'Failed to change password'),
  });

  const handlePwSubmit = (e) => {
    e.preventDefault();
    setPwError('');
    if (pwForm.newPassword !== pwForm.confirm) { setPwError('Passwords do not match'); return; }
    if (pwForm.newPassword.length < 8) { setPwError('New password must be at least 8 characters'); return; }
    pwMutation.mutate({ currentPassword: pwForm.currentPassword, newPassword: pwForm.newPassword });
  };

  const memberSince = user?.createdAt
    ? Math.floor((Date.now() - new Date(user.createdAt).getTime()) / (1000 * 60 * 60 * 24))
    : 0;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
      {/* Left — profile form */}
      <div className="lg:col-span-2 space-y-5">
        {/* Profile info */}
        <div className="bg-surface-1 border border-border rounded-2xl p-6">
          <h3 className="font-semibold text-zinc-100 mb-1">Profile information</h3>
          <p className="text-xs text-muted mb-5">Update your personal details and profile.</p>

          <form onSubmit={(e) => { e.preventDefault(); profileMutation.mutate(form); }} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-1.5">Name</label>
              <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-1.5">Email</label>
              <input
                type="email"
                className="input opacity-50 cursor-not-allowed"
                value={form.email}
                disabled
                readOnly
              />
              <p className="text-xs text-zinc-600 mt-1">Email cannot be changed.</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-1.5">Bio</label>
              <div className="relative">
                <textarea
                  className="input resize-none"
                  rows={3}
                  maxLength={100}
                  placeholder="Tell others about yourself..."
                  value={form.bio}
                  onChange={(e) => setForm({ ...form, bio: e.target.value })}
                />
                <span className="absolute bottom-2 right-3 text-xs text-zinc-600">{form.bio.length}/100</span>
              </div>
            </div>

            {/* Avatar */}
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-2">Profile picture</label>
              <div className="flex items-center gap-4">
                <div className={`w-14 h-14 rounded-full ${avatarColor(form.name)} flex items-center justify-center text-xl font-bold text-white`}>
                  {form.name?.[0]?.toUpperCase() || '?'}
                </div>
                <div>
                  <p className="text-xs text-muted">Avatar is generated from your name initial.</p>
                  <p className="text-xs text-zinc-600 mt-0.5">Changes automatically when you update your name.</p>
                </div>
              </div>
            </div>

            <button type="submit" className="btn-primary px-6" disabled={profileMutation.isPending}>
              {profileMutation.isPending ? 'Saving...' : 'Save changes'}
            </button>
          </form>
        </div>

        {/* Change password */}
        <div className="bg-surface-1 border border-border rounded-2xl p-6">
          <h3 className="font-semibold text-zinc-100 mb-1">Change password</h3>
          <p className="text-xs text-muted mb-5">Use a strong password you don't use elsewhere.</p>

          <form onSubmit={handlePwSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-1.5">Current password</label>
              <input type="password" className="input" value={pwForm.currentPassword}
                onChange={(e) => setPwForm({ ...pwForm, currentPassword: e.target.value })} required />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-1.5">New password</label>
              <input type="password" className="input" placeholder="Min. 8 characters" value={pwForm.newPassword}
                onChange={(e) => setPwForm({ ...pwForm, newPassword: e.target.value })} required />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-1.5">Confirm new password</label>
              <input type="password" className="input" value={pwForm.confirm}
                onChange={(e) => setPwForm({ ...pwForm, confirm: e.target.value })} required />
            </div>
            {pwError && <p className="text-xs text-red-400">{pwError}</p>}
            <button type="submit" className="btn-primary px-6" disabled={pwMutation.isPending}>
              {pwMutation.isPending ? 'Updating...' : 'Update password'}
            </button>
          </form>
        </div>
      </div>

      {/* Right — account info */}
      <div className="space-y-4">
        <div className="bg-surface-1 border border-border rounded-2xl p-5">
          <h3 className="font-semibold text-zinc-100 mb-4">Account</h3>
          <div className="space-y-3">
            <div>
              <p className="text-xs text-muted">Account created</p>
              <p className="text-sm font-medium text-zinc-200 mt-0.5">
                {user?.createdAt ? new Date(user.createdAt).toLocaleDateString([], { month: 'long', day: 'numeric', year: 'numeric' }) : '—'}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted">Member since</p>
              <p className="text-sm font-medium text-zinc-200 mt-0.5">
                {memberSince === 0 ? 'Today' : memberSince === 1 ? '1 day' : `${memberSince} days`}
              </p>
            </div>
          </div>
          <button
            onClick={onLogout}
            className="mt-5 w-full flex items-center justify-center gap-2 py-2 rounded-xl border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-colors text-sm font-medium"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Appearance tab ─────────────────────────────────────────────
function AppearanceTab() {
  const [density, setDensity] = useState(() => localStorage.getItem('density') || 'comfortable');

  const save = () => {
    localStorage.setItem('density', density);
    toast.success('Appearance saved');
  };

  return (
    <div className="max-w-2xl">
      <div className="bg-surface-1 border border-border rounded-2xl p-6">
        <h3 className="font-semibold text-zinc-100 mb-1">Appearance</h3>
        <p className="text-xs text-muted mb-5">Customize how StudyRoom looks for you.</p>

        <div className="mb-6">
          <p className="text-sm font-medium text-zinc-300 mb-3">Theme</p>
          <div className="flex gap-3">
            <div className="w-28 border-2 border-accent rounded-xl p-3 cursor-pointer">
              <div className="bg-zinc-900 rounded-lg h-12 mb-2" />
              <p className="text-xs font-medium text-zinc-200 text-center">Dark</p>
            </div>
            <div className="w-28 border-2 border-border rounded-xl p-3 opacity-40 cursor-not-allowed">
              <div className="bg-zinc-100 rounded-lg h-12 mb-2" />
              <p className="text-xs font-medium text-zinc-400 text-center">Light</p>
              <p className="text-[10px] text-zinc-600 text-center">Coming soon</p>
            </div>
          </div>
        </div>

        <div className="mb-6">
          <p className="text-sm font-medium text-zinc-300 mb-3">Density</p>
          <div className="flex gap-3">
            {['compact', 'comfortable', 'spacious'].map((d) => (
              <button key={d} onClick={() => setDensity(d)}
                className={`flex-1 py-2 rounded-xl border text-sm font-medium capitalize transition-colors
                  ${density === d ? 'border-accent bg-accent/10 text-accent' : 'border-border text-zinc-400 hover:text-zinc-100 hover:border-zinc-500'}`}>
                {d}
              </button>
            ))}
          </div>
        </div>

        <button onClick={save} className="btn-primary px-6">Save appearance</button>
      </div>
    </div>
  );
}

// ── Privacy tab ────────────────────────────────────────────────
function PrivacyTab() {
  const [prefs, setPrefs] = useState(() => {
    try { return JSON.parse(localStorage.getItem('privacyPrefs') || '{"showOnline":true,"showActivity":true}'); }
    catch { return { showOnline: true, showActivity: true }; }
  });

  const toggle = (k) => setPrefs((p) => ({ ...p, [k]: !p[k] }));

  const save = () => {
    localStorage.setItem('privacyPrefs', JSON.stringify(prefs));
    // Dispatch a storage event so MemberList picks up the change in the same tab
    window.dispatchEvent(new Event('storage'));
    toast.success('Privacy settings saved');
  };

  return (
    <div className="max-w-2xl">
      <div className="bg-surface-1 border border-border rounded-2xl p-6">
        <h3 className="font-semibold text-zinc-100 mb-1">Privacy</h3>
        <p className="text-xs text-muted mb-2">Control what others can see about you.</p>

        {[
          { k: 'showOnline', label: 'Show online status', desc: "Let others see when you're online" },
          { k: 'showActivity', label: 'Show activity', desc: 'Let others see your recent activity in rooms' },
        ].map(({ k, label, desc }) => (
          <div key={k} className="flex items-center justify-between py-4 border-b border-border last:border-0">
            <div>
              <p className="text-sm font-medium text-zinc-200">{label}</p>
              <p className="text-xs text-muted mt-0.5">{desc}</p>
            </div>
            <Toggle checked={prefs[k]} onChange={() => toggle(k)} />
          </div>
        ))}

        <div className="mt-5">
          <button onClick={save} className="btn-primary px-6">Save privacy settings</button>
        </div>
      </div>
    </div>
  );
}

// ── Main Settings page ─────────────────────────────────────────
const TABS = ['Profile', 'Appearance', 'Privacy'];

export default function Settings() {
  const user = useStore((s) => s.user);
  const clearAuth = useStore((s) => s.clearAuth);
  const navigate = useNavigate();
  const [tab, setTab] = useState('Profile');

  const { data } = useQuery({
    queryKey: ['me'],
    queryFn: () => api.get('/api/user/me').then((r) => r.data.user),
  });

  const handleLogout = async () => {
    try { await api.post('/api/auth/logout'); } finally { clearAuth(); navigate('/login'); }
  };

  const profile = data || user;

  return (
    <div className="flex min-h-screen bg-surface">
      <AppSidebar user={user} onLogout={handleLogout} />

      <main className="flex-1 px-8 py-8 overflow-y-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-zinc-100">Settings</h1>
          <p className="text-muted text-sm mt-0.5">Manage your account and preferences.</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 border-b border-border">
          {TABS.map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-2.5 text-sm font-medium transition-colors relative
                ${tab === t ? 'text-zinc-100' : 'text-muted hover:text-zinc-300'}`}>
              {t}
              {tab === t && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent rounded-full" />
              )}
            </button>
          ))}
        </div>

        {tab === 'Profile' && <ProfileTab user={profile} onLogout={handleLogout} />}
        {tab === 'Appearance' && <AppearanceTab />}
        {tab === 'Privacy' && <PrivacyTab />}
      </main>
    </div>
  );
}
