import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../api/client';
import useStore from '../store/useStore';

export default function Register() {
  const navigate = useNavigate();
  const setAuth = useStore((s) => s.setAuth);
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.password.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }
    setLoading(true);
    try {
      const { data } = await api.post('/api/auth/register', form);
      setAuth(data.user, data.accessToken);
      navigate('/rooms');
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left — illustration panel */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-surface-1">
        <div className="absolute inset-0 bg-gradient-to-br from-accent/20 via-surface-1 to-surface" />
        <div className="absolute top-20 left-20 w-64 h-64 bg-accent/10 rounded-full blur-3xl" />
        <div className="absolute bottom-20 right-10 w-48 h-48 bg-violet-500/10 rounded-full blur-3xl" />

        {/* Floating cards illustration */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="relative w-72 h-72">
            {/* Card 1 */}
            <div className="absolute top-8 left-4 w-52 bg-surface-2 border border-border rounded-2xl p-4 rotate-[-4deg] shadow-xl">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-8 h-8 rounded-lg bg-accent/20 flex items-center justify-center text-sm">📖</div>
                <div>
                  <div className="text-xs font-medium text-zinc-200">DSA Prep</div>
                  <div className="text-xs text-muted">6 members</div>
                </div>
              </div>
              <div className="flex -space-x-1.5">
                {['bg-violet-500','bg-blue-500','bg-emerald-500','bg-orange-500'].map((c,i) => (
                  <div key={i} className={`w-5 h-5 rounded-full ${c} border border-surface-2`} />
                ))}
                <div className="w-5 h-5 rounded-full bg-surface-3 border border-surface-2 flex items-center justify-center text-[9px] text-zinc-400">+2</div>
              </div>
            </div>
            {/* Card 2 */}
            <div className="absolute bottom-12 right-0 w-48 bg-surface-2 border border-border rounded-2xl p-4 rotate-[3deg] shadow-xl">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-2 h-2 rounded-full bg-emerald-400" />
                <span className="text-xs text-zinc-300 font-medium">Session active</span>
              </div>
              <div className="text-2xl font-bold text-accent tabular-nums">01:24:07</div>
              <div className="text-xs text-muted mt-1">3 studying now</div>
            </div>
          </div>
        </div>

        <div className="absolute bottom-16 left-10 right-10">
          <h2 className="text-3xl font-bold text-white leading-tight mb-2">
            Study smarter.<br />
            <span className="text-accent">Together.</span>
          </h2>
          <p className="text-zinc-400 text-sm leading-relaxed">
            Join study rooms, track your sessions, and stay accountable with your peers.
          </p>
          <div className="flex gap-2 mt-6">
            <div className="w-2 h-2 rounded-full bg-zinc-600" />
            <div className="w-2 h-2 rounded-full bg-accent" />
            <div className="w-2 h-2 rounded-full bg-zinc-600" />
          </div>
        </div>
      </div>

      {/* Right — form */}
      <div className="flex-1 flex items-center justify-center px-6 py-12 bg-surface">
        <div className="w-full max-w-sm">
          <div className="flex items-center gap-2 mb-10">
            <span className="text-2xl">📚</span>
            <span className="font-semibold text-zinc-100 text-lg">StudyRoom</span>
          </div>

          <h1 className="text-2xl font-bold text-zinc-100 mb-1">Create account ✨</h1>
          <p className="text-muted text-sm mb-8">Start studying with others today</p>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-2">Name</label>
              <input
                type="text"
                className="input"
                placeholder="Your name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-2">Email</label>
              <input
                type="email"
                className="input"
                placeholder="hello@gmail.com"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-2">Password</label>
              <input
                type="password"
                className="input"
                placeholder="Min. 8 characters"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                required
              />
            </div>
            <button type="submit" className="btn-primary w-full py-2.5 rounded-lg text-base" disabled={loading}>
              {loading ? 'Creating account...' : 'Create account'}
            </button>
          </form>

          <p className="text-center text-sm text-muted mt-6">
            Already have an account?{' '}
            <Link to="/login" className="text-accent hover:text-accent-hover transition-colors font-medium">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
