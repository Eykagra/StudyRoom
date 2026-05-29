import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../api/client';
import useStore from '../store/useStore';

export default function Login() {
  const navigate = useNavigate();
  const setAuth = useStore((s) => s.setAuth);
  const [form, setForm] = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data } = await api.post('/api/auth/login', form);
      setAuth(data.user, data.accessToken);
      navigate('/rooms');
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left — illustration panel */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-surface-1">
        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-br from-accent/20 via-surface-1 to-surface" />

        {/* Decorative circles */}
        <div className="absolute top-20 left-20 w-64 h-64 bg-accent/10 rounded-full blur-3xl" />
        <div className="absolute bottom-20 right-10 w-48 h-48 bg-violet-500/10 rounded-full blur-3xl" />

        {/* Desk illustration — pure CSS */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="relative w-72 h-72">
            {/* Window */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-40 h-52 bg-gradient-to-b from-indigo-900/60 to-blue-900/40 rounded-2xl border border-indigo-700/30 overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-b from-indigo-950/80 to-transparent" />
              {/* Stars */}
              {[...Array(8)].map((_, i) => (
                <div key={i} className="absolute w-0.5 h-0.5 bg-white rounded-full opacity-70"
                  style={{ top: `${10 + i * 11}%`, left: `${15 + (i % 3) * 30}%` }} />
              ))}
              {/* Moon */}
              <div className="absolute top-4 right-6 w-5 h-5 bg-yellow-200/80 rounded-full" />
              {/* Mountain silhouette */}
              <div className="absolute bottom-0 left-0 right-0 h-16 bg-indigo-950/60"
                style={{ clipPath: 'polygon(0 100%, 30% 30%, 50% 60%, 70% 20%, 100% 100%)' }} />
            </div>
            {/* Desk surface */}
            <div className="absolute bottom-8 left-0 right-0 h-3 bg-gradient-to-r from-zinc-700 to-zinc-600 rounded-sm" />
            {/* Lamp */}
            <div className="absolute bottom-11 left-8">
              <div className="w-1 h-14 bg-zinc-500 rounded-full" />
              <div className="absolute top-0 left-0 w-8 h-5 bg-amber-400/80 rounded-t-full -translate-x-3 -translate-y-1" />
              <div className="absolute top-1 left-0 w-6 h-6 bg-amber-300/20 rounded-full blur-md -translate-x-2" />
            </div>
            {/* Monitor */}
            <div className="absolute bottom-11 right-6 w-20 h-14 bg-zinc-800 rounded-lg border border-zinc-700 flex items-center justify-center">
              <div className="w-16 h-10 bg-gradient-to-br from-indigo-900 to-indigo-800 rounded flex items-center justify-center">
                <div className="space-y-1">
                  <div className="w-8 h-0.5 bg-accent/60 rounded" />
                  <div className="w-6 h-0.5 bg-accent/40 rounded" />
                  <div className="w-7 h-0.5 bg-accent/40 rounded" />
                </div>
              </div>
            </div>
            {/* Chair */}
            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-16 h-8 bg-zinc-700 rounded-t-xl" />
          </div>
        </div>

        {/* Text */}
        <div className="absolute bottom-16 left-10 right-10">
          <h2 className="text-3xl font-bold text-white leading-tight mb-2">
            Focus together.<br />
            <span className="text-accent">Achieve more.</span>
          </h2>
          <p className="text-zinc-400 text-sm leading-relaxed">
            StudyRoom helps you stay focused, collaborate, and reach your goals together.
          </p>
          {/* Dots */}
          <div className="flex gap-2 mt-6">
            <div className="w-2 h-2 rounded-full bg-accent" />
            <div className="w-2 h-2 rounded-full bg-zinc-600" />
            <div className="w-2 h-2 rounded-full bg-zinc-600" />
          </div>
        </div>
      </div>

      {/* Right — form */}
      <div className="flex-1 flex items-center justify-center px-6 py-12 bg-surface">
        <div className="w-full max-w-sm">
          {/* Logo */}
          <div className="flex items-center gap-2 mb-10">
            <span className="text-2xl">📚</span>
            <span className="font-semibold text-zinc-100 text-lg">StudyRoom</span>
          </div>

          <h1 className="text-2xl font-bold text-zinc-100 mb-1">Welcome back 👋</h1>
          <p className="text-muted text-sm mb-8">Sign in to your account</p>

          <form onSubmit={handleSubmit} className="space-y-5">
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
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-zinc-300">Password</label>
              </div>
              <input
                type="password"
                className="input"
                placeholder="••••••••"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                required
              />
            </div>
            <button type="submit" className="btn-primary w-full py-2.5 rounded-lg text-base" disabled={loading}>
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          <p className="text-center text-sm text-muted mt-6">
            No account?{' '}
            <Link to="/register" className="text-accent hover:text-accent-hover transition-colors font-medium">
              Create one
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
