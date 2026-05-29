import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../api/client';
import useStore from '../store/useStore';
import { useSocket, getSocket } from '../hooks/useSocket';
import AppSidebar from '../components/AppSidebar';

// ── Room icon — random gradient per room name ──────────────────
const ICON_GRADIENTS = [
  'from-violet-500 to-indigo-600',
  'from-blue-500 to-cyan-600',
  'from-emerald-500 to-teal-600',
  'from-orange-500 to-amber-600',
  'from-pink-500 to-rose-600',
];
const ICON_EMOJIS = ['</>', '⚡', '📐', '📊', '🔬', '🎯', '📝'];

function roomIcon(name = '') {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return {
    gradient: ICON_GRADIENTS[Math.abs(h) % ICON_GRADIENTS.length],
    emoji: ICON_EMOJIS[Math.abs(h) % ICON_EMOJIS.length],
  };
}

// ── Avatar stack ───────────────────────────────────────────────
const AVATAR_COLORS = ['bg-violet-500','bg-blue-500','bg-emerald-500','bg-orange-500','bg-pink-500'];

// ── Room modal ─────────────────────────────────────────────────
function RoomModal({ room, onClose }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const isEdit = !!room;
  const [form, setForm] = useState({ name: room?.name || '', description: room?.description || '' });
  const [scheduleSession, setScheduleSession] = useState(false);
  const [scheduledFor, setScheduledFor] = useState(() => {
    const d = new Date();
    d.setHours(d.getHours() + 1, 0, 0, 0);
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:00`;
  });

  const minDt = (() => {
    const d = new Date(Date.now() + 60000);
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  })();

  const mutation = useMutation({
    mutationFn: async (data) => {
      if (isEdit) {
        return api.patch(`/api/rooms/${room._id}`, data).then((r) => r.data);
      }
      // Create room
      const res = await api.post('/api/rooms', data).then((r) => r.data);
      // If schedule toggle is on, also schedule a session
      if (scheduleSession && scheduledFor) {
        const dt = new Date(scheduledFor);
        if (dt > new Date()) {
          await api.post('/api/schedule', { roomId: res.room._id, scheduledFor: dt.toISOString() }).catch(() => {});
        }
      }
      return res;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['rooms'] });
      queryClient.invalidateQueries({ queryKey: ['upcoming'] });
      queryClient.invalidateQueries({ queryKey: ['calendar'] });
      if (isEdit) {
        queryClient.invalidateQueries({ queryKey: ['room', room._id] });
        toast.success('Room updated');
        onClose();
      } else {
        toast.success(scheduleSession ? 'Room created & session scheduled' : 'Room created');
        navigate(`/rooms/${data.room._id}`);
      }
    },
    onError: (err) => toast.error(err.response?.data?.error?.message || 'Something went wrong'),
  });

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 px-4">
      <div className="bg-surface-1 border border-border rounded-2xl w-full max-w-md p-6">
        <h2 className="font-semibold text-zinc-100 mb-5">{isEdit ? 'Edit room' : 'New study room'}</h2>
        <form onSubmit={(e) => { e.preventDefault(); mutation.mutate(form); }} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1.5">Room name</label>
            <input className="input" placeholder="e.g. DSA prep" value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })} required autoFocus />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1.5">
              Description <span className="text-zinc-600">(optional)</span>
            </label>
            <input className="input" placeholder="What are you studying?" value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>

          {/* Schedule first session toggle — only on create */}
          {!isEdit && (
            <div className="border border-border rounded-xl p-4 space-y-3">
              <label className="flex items-center justify-between cursor-pointer">
                <div>
                  <p className="text-sm font-medium text-zinc-200">Schedule first session?</p>
                  <p className="text-xs text-muted mt-0.5">Set a time so your team knows when to show up</p>
                </div>
                <button type="button" role="switch" aria-checked={scheduleSession}
                  onClick={() => setScheduleSession(!scheduleSession)}
                  className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ${scheduleSession ? 'bg-accent' : 'bg-surface-3'}`}>
                  <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${scheduleSession ? 'translate-x-5' : ''}`} />
                </button>
              </label>
              {scheduleSession && (
                <div>
                  <input
                    type="datetime-local"
                    className="input"
                    value={scheduledFor}
                    min={minDt}
                    onChange={(e) => setScheduledFor(e.target.value)}
                  />
                  <p className="text-xs text-zinc-600 mt-1">Must be a future date</p>
                </div>
              )}
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose} className="btn-ghost flex-1">Cancel</button>
            <button type="submit" className="btn-primary flex-1" disabled={mutation.isPending}>
              {mutation.isPending ? (isEdit ? 'Saving...' : 'Creating...') : (isEdit ? 'Save changes' : 'Create room')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Room card ──────────────────────────────────────────────────
function RoomCard({ room, onEdit, nextSession }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const user = useStore((s) => s.user);
  const isOwner = room.role === 'OWNER';
  const { gradient, emoji } = roomIcon(room.name);

  const deleteMutation = useMutation({
    mutationFn: () => api.delete(`/api/rooms/${room._id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rooms'] });
      toast.success('Room deleted');
    },
    onError: () => toast.error('Failed to delete room'),
  });

  const memberCount = room.memberCount || 1;
  const displayCount = Math.min(memberCount, 3);
  const extra = memberCount > 3 ? memberCount - 3 : 0;

  // Format next session time
  const nextSessionLabel = (() => {
    if (!nextSession) return null;
    const dt = new Date(nextSession.scheduledFor);
    const now = new Date();
    const diffMs = dt - now;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const time = dt.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    if (diffDays === 0) return `Today, ${time}`;
    if (diffDays === 1) return `Tomorrow, ${time}`;
    return `${dt.toLocaleDateString([], { month: 'short', day: 'numeric' })}, ${time}`;
  })();

  return (
    <div className="group flex items-center gap-4 bg-surface-1 border border-border hover:border-accent/40 rounded-2xl px-5 py-4 transition-all">
      {/* Icon */}
      <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center text-lg shrink-0`}>
        {emoji}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-zinc-100 truncate">{room.name}</h3>
          {isOwner && (
            <span className="text-xs bg-accent/10 text-accent px-2 py-0.5 rounded-full shrink-0">Owner</span>
          )}
        </div>
        {room.description && (
          <p className="text-sm text-muted truncate mt-0.5">{room.description}</p>
        )}
        {/* Next scheduled session badge */}
        {nextSessionLabel && (
          <p className="text-xs text-violet-400 mt-1 flex items-center gap-1">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" />
            </svg>
            {nextSessionLabel}
          </p>
        )}
      </div>

      {/* Member avatars + count */}
      <div className="flex items-center gap-3 shrink-0">
        <div className="flex items-center gap-1.5">
          <div className="flex -space-x-1.5">
            {[...Array(displayCount)].map((_, i) => (
              <div key={i} className={`w-6 h-6 rounded-full border-2 border-surface-1 ${AVATAR_COLORS[i % AVATAR_COLORS.length]}`} />
            ))}
          </div>
          {extra > 0 && (
            <span className="text-xs text-muted">+{extra}</span>
          )}
        </div>
        <div className="flex items-center gap-1 text-xs text-muted">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
          {memberCount}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 shrink-0">
        {isOwner && (
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button onClick={(e) => { e.stopPropagation(); onEdit(room); }}
              className="p-1.5 text-zinc-500 hover:text-zinc-200 hover:bg-surface-3 rounded-lg transition-colors" title="Edit">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); if (window.confirm('Delete this room?')) deleteMutation.mutate(); }}
              className="p-1.5 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
              disabled={deleteMutation.isPending} title="Delete">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                <path d="M10 11v6M14 11v6" />
              </svg>
            </button>
          </div>
        )}
        <button
          onClick={() => navigate(`/rooms/${room._id}`)}
          className="btn-primary py-1.5 px-4 text-sm rounded-lg"
        >
          Enter
        </button>
      </div>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────
export default function Rooms() {
  const user = useStore((s) => s.user);
  const clearAuth = useStore((s) => s.clearAuth);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [modal, setModal] = useState(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all'); // all | mine | joined

  useSocket();

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;
    const onRoomDeleted = ({ roomName }) => {
      queryClient.invalidateQueries({ queryKey: ['rooms'] });
      toast.error(`"${roomName}" was deleted by the owner`);
    };
    socket.on('room:deleted', onRoomDeleted);
    return () => socket.off('room:deleted', onRoomDeleted);
  }, [queryClient]);

  const { data, isLoading } = useQuery({
    queryKey: ['rooms'],
    queryFn: () => api.get('/api/rooms').then((r) => r.data.rooms),
  });

  // Fetch upcoming scheduled sessions to show on room cards
  const { data: upcomingData } = useQuery({
    queryKey: ['upcoming'],
    queryFn: () => api.get('/api/upcoming').then((r) => r.data.upcoming),
  });

  // Map: roomId → next scheduled session
  const nextSessionByRoom = {};
  (upcomingData || []).forEach((s) => {
    const rid = s.room?._id?.toString() || s.room;
    if (!nextSessionByRoom[rid]) nextSessionByRoom[rid] = s;
  });

  const handleLogout = async () => {
    try { await api.post('/api/auth/logout'); } finally {
      clearAuth();
      navigate('/login');
    }
  };

  const filtered = (data || []).filter((r) => {
    const matchSearch = r.name.toLowerCase().includes(search.toLowerCase()) ||
      (r.description || '').toLowerCase().includes(search.toLowerCase());
    const matchFilter = filter === 'all' || (filter === 'mine' && r.role === 'OWNER') || (filter === 'joined' && r.role !== 'OWNER');
    return matchSearch && matchFilter;
  });

  return (
    <div className="flex min-h-screen bg-surface">
      <AppSidebar user={user} onLogout={handleLogout} />

      <main className="flex-1 px-8 py-8 overflow-y-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-zinc-100">
            Hey, {user?.name?.split(' ')[0]} 👋
          </h1>
          <p className="text-muted text-sm mt-1">Pick a room to study in, or create a new one.</p>
        </div>

        {/* Search + New room */}
        <div className="flex items-center gap-3 mb-5">
          <div className="relative flex-1 max-w-xs">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
            </svg>
            <input
              className="input pl-9 py-2"
              placeholder="Search rooms..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <button onClick={() => setModal('create')} className="btn-primary flex items-center gap-1.5 shrink-0">
            <span className="text-lg leading-none">+</span> New room
          </button>
        </div>

        {/* Filter tabs */}
        <div className="flex items-center gap-2 mb-6">
          {[['all','All'],['mine','My rooms'],['joined','Joined']].map(([val, label]) => (
            <button
              key={val}
              onClick={() => setFilter(val)}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                filter === val
                  ? 'bg-accent text-white'
                  : 'text-zinc-400 hover:text-zinc-100 hover:bg-surface-2'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Room list */}
        {isLoading ? (
          <div className="space-y-3">
            {[1,2,3].map((i) => (
              <div key={i} className="bg-surface-1 border border-border rounded-2xl h-20 animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 border border-dashed border-border rounded-2xl">
            <p className="text-3xl mb-3">📚</p>
            <p className="text-zinc-300 font-medium mb-1">
              {search ? 'No rooms match your search' : 'No rooms yet'}
            </p>
            <p className="text-muted text-sm mb-5">
              {search ? 'Try a different search term.' : 'Create one and invite your study partners.'}
            </p>
            {!search && (
              <button onClick={() => setModal('create')} className="btn-primary">
                Create your first room
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((room) => (
              <RoomCard key={room._id} room={room} onEdit={(r) => setModal(r)} nextSession={nextSessionByRoom[room._id]} />
            ))}
          </div>
        )}
      </main>

      {modal && (
        <RoomModal room={modal === 'create' ? null : modal} onClose={() => setModal(null)} />
      )}
    </div>
  );
}
