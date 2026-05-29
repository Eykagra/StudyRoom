import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import api from '../api/client';
import useStore from '../store/useStore';
import AppSidebar from '../components/AppSidebar';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];

const CHIP_COLORS = [
  'bg-indigo-600 hover:bg-indigo-500',
  'bg-amber-600 hover:bg-amber-500',
  'bg-emerald-600 hover:bg-emerald-500',
  'bg-pink-600 hover:bg-pink-500',
  'bg-cyan-600 hover:bg-cyan-500',
];
const SCHED_CHIP = 'bg-violet-700/80 hover:bg-violet-700 border border-violet-500/40';

function chipColor(name = '') {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return CHIP_COLORS[Math.abs(h) % CHIP_COLORS.length];
}

function formatDuration(s) {
  if (!s) return '';
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m`;
  return `${s}s`;
}

function formatTime(dateStr) {
  return new Date(dateStr).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function localDateKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function buildGrid(year, month) {
  const firstDay = new Date(year, month - 1, 1);
  const startOffset = (firstDay.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month, 0).getDate();
  const prevMonthDays = new Date(year, month - 1, 0).getDate();
  const cells = [];
  for (let i = startOffset - 1; i >= 0; i--)
    cells.push({ date: new Date(year, month - 2, prevMonthDays - i), current: false });
  for (let d = 1; d <= daysInMonth; d++)
    cells.push({ date: new Date(year, month - 1, d), current: true });
  let next = 1;
  while (cells.length < 42)
    cells.push({ date: new Date(year, month, next++), current: false });
  return cells;
}

function getWeekDays(date) {
  const d = new Date(date);
  d.setDate(d.getDate() - (d.getDay() + 6) % 7);
  return Array.from({ length: 7 }, (_, i) => { const dd = new Date(d); dd.setDate(d.getDate() + i); return dd; });
}

// ── New Session Modal ──────────────────────────────────────────
function NewSessionModal({ defaultDate, onClose }) {
  const queryClient = useQueryClient();
  const now = new Date();

  const { data: roomsData, refetch: refetchRooms } = useQuery({
    queryKey: ['rooms'],
    queryFn: () => api.get('/api/rooms').then((r) => r.data.rooms),
  });

  const defaultDt = (() => {
    const d = defaultDate ? new Date(defaultDate) : new Date();
    d.setHours(d.getHours() + 1, 0, 0, 0);
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:00`;
  })();

  const [form, setForm] = useState({ roomId: '', scheduledFor: defaultDt, note: '' });
  const [error, setError] = useState('');
  const [showCreateRoom, setShowCreateRoom] = useState(false);
  const [newRoomName, setNewRoomName] = useState('');
  const [creatingRoom, setCreatingRoom] = useState(false);

  const mutation = useMutation({
    mutationFn: (data) => api.post('/api/schedule', data).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendar'] });
      queryClient.invalidateQueries({ queryKey: ['upcoming'] });
      toast.success('Session scheduled');
      onClose();
    },
    onError: (err) => setError(err.response?.data?.error?.message || 'Failed to schedule'),
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');
    if (!form.roomId) { setError('Please select a room'); return; }
    const dt = new Date(form.scheduledFor);
    if (dt <= now) { setError('Please choose a future date and time'); return; }
    mutation.mutate({ roomId: form.roomId, scheduledFor: dt.toISOString(), note: form.note });
  };

  const handleCreateRoom = async () => {
    if (!newRoomName.trim()) return;
    setCreatingRoom(true);
    try {
      const { data } = await api.post('/api/rooms', { name: newRoomName.trim() });
      await refetchRooms();
      queryClient.invalidateQueries({ queryKey: ['rooms'] });
      setForm({ ...form, roomId: data.room._id });
      setShowCreateRoom(false);
      setNewRoomName('');
      toast.success(`Room "${data.room.name}" created`);
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Failed to create room');
    } finally {
      setCreatingRoom(false);
    }
  };

  const minDt = (() => {
    const d = new Date(now.getTime() + 60000);
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  })();

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 px-4">
      <div className="bg-surface-1 border border-border rounded-2xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-semibold text-zinc-100">Schedule a session</h2>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300 transition-colors">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1.5">Room</label>
            {!showCreateRoom ? (
              <>
                <select
                  className="input"
                  value={form.roomId}
                  onChange={(e) => {
                    if (e.target.value === '__create__') { setShowCreateRoom(true); return; }
                    setForm({ ...form, roomId: e.target.value });
                  }}
                  required
                >
                  <option value="">Select a room...</option>
                  {(roomsData || []).map((r) => (
                    <option key={r._id} value={r._id}>{r.name}</option>
                  ))}
                  <option value="__create__">+ Create new room</option>
                </select>
              </>
            ) : (
              <div className="flex gap-2">
                <input
                  className="input flex-1"
                  placeholder="Room name..."
                  value={newRoomName}
                  onChange={(e) => setNewRoomName(e.target.value)}
                  autoFocus
                />
                <button type="button" onClick={handleCreateRoom} disabled={creatingRoom || !newRoomName.trim()}
                  className="btn-primary px-3 text-sm shrink-0">
                  {creatingRoom ? '...' : 'Create'}
                </button>
                <button type="button" onClick={() => setShowCreateRoom(false)}
                  className="btn-ghost px-2 text-sm shrink-0">✕</button>
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1.5">Date & Time</label>
            <input
              type="datetime-local"
              className="input"
              value={form.scheduledFor}
              min={minDt}
              onChange={(e) => setForm({ ...form, scheduledFor: e.target.value })}
              required
            />
            <p className="text-xs text-zinc-600 mt-1">Must be a future date and time</p>
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1.5">
              Note <span className="text-zinc-600">(optional)</span>
            </label>
            <input
              className="input"
              placeholder="e.g. Focus on graphs chapter"
              value={form.note}
              onChange={(e) => setForm({ ...form, note: e.target.value })}
            />
          </div>

          {error && <p className="text-xs text-red-400">{error}</p>}

          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose} className="btn-ghost flex-1">Cancel</button>
            <button type="submit" className="btn-primary flex-1" disabled={mutation.isPending}>
              {mutation.isPending ? 'Scheduling...' : 'Schedule session'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Main Calendar ──────────────────────────────────────────────
export default function Calendar() {
  const user = useStore((s) => s.user);
  const clearAuth = useStore((s) => s.clearAuth);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [view, setView] = useState('month');
  const [weekAnchor, setWeekAnchor] = useState(now);
  const [selected, setSelected] = useState(null);
  const [showNewModal, setShowNewModal] = useState(false);
  const [newModalDate, setNewModalDate] = useState(null);

  const tzOffset = -now.getTimezoneOffset();
  const { data, isLoading } = useQuery({
    queryKey: ['calendar', year, month, tzOffset],
    queryFn: () => api.get('/api/calendar', { params: { year, month, tzOffset } }).then((r) => r.data),
  });

  const cancelScheduled = useMutation({
    mutationFn: (id) => api.delete(`/api/schedule/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['calendar'] }); toast.success('Session cancelled'); },
    onError: () => toast.error('Failed to cancel'),
  });

  const handleLogout = async () => {
    try { await api.post('/api/auth/logout'); } finally { clearAuth(); navigate('/login'); }
  };

  const prevMonth = () => { if (month === 1) { setYear(y => y-1); setMonth(12); } else setMonth(m => m-1); setSelected(null); };
  const nextMonth = () => { if (month === 12) { setYear(y => y+1); setMonth(1); } else setMonth(m => m+1); setSelected(null); };
  const goToday = () => { const t = new Date(); setYear(t.getFullYear()); setMonth(t.getMonth()+1); setWeekAnchor(t); setSelected(null); };
  const prevWeek = () => setWeekAnchor(d => { const n = new Date(d); n.setDate(n.getDate()-7); return n; });
  const nextWeek = () => setWeekAnchor(d => { const n = new Date(d); n.setDate(n.getDate()+7); return n; });

  // Build maps: date key → [past sessions] and [scheduled sessions]
  const sessionMap = {};
  const scheduledMap = {};
  (data?.sessions || []).forEach((s) => {
    const key = localDateKey(new Date(s.startedAt));
    if (!sessionMap[key]) sessionMap[key] = [];
    sessionMap[key].push(s);
  });
  (data?.scheduled || []).forEach((s) => {
    const key = localDateKey(new Date(s.scheduledFor));
    if (!scheduledMap[key]) scheduledMap[key] = [];
    scheduledMap[key].push(s);
  });

  const todayKey = localDateKey(now);
  const grid = buildGrid(year, month);
  const weekDays = getWeekDays(weekAnchor);

  const handleCellClick = (date, sessions, scheduled) => {
    const key = localDateKey(date);
    if (sessions.length || scheduled.length) {
      setSelected({ key, date, sessions, scheduled });
    }
  };

  const openNewModal = (date) => {
    // Don't allow scheduling in the past
    const d = new Date(date);
    d.setHours(23, 59, 59, 999);
    if (d < now) { toast.error("Can't schedule sessions in the past"); return; }
    setNewModalDate(date);
    setShowNewModal(true);
  };

  // Day cell component
  const DayCell = ({ date, current, minH = 'min-h-[90px]', maxChips = 2 }) => {
    const key = localDateKey(date);
    const isToday = key === todayKey;
    const isPast = date < new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const sessions = sessionMap[key] || [];
    const scheduled = scheduledMap[key] || [];
    const isSelected = selected?.key === key;
    const hasItems = sessions.length > 0 || scheduled.length > 0;

    return (
      <div
        className={`${minH} p-2 border-b border-r border-border transition-colors group relative
          ${!current ? 'bg-surface/40' : ''}
          ${hasItems ? 'cursor-pointer hover:bg-surface-2/40' : ''}
          ${isSelected ? 'bg-accent/5 ring-1 ring-inset ring-accent/30' : ''}
        `}
        onClick={() => handleCellClick(date, sessions, scheduled)}
      >
        <div className="flex items-center justify-between mb-1.5">
          <span className={`text-sm font-medium w-7 h-7 flex items-center justify-center rounded-full transition-colors
            ${isToday ? 'bg-accent text-white font-bold' : current ? 'text-zinc-300' : 'text-zinc-600'}`}>
            {date.getDate()}
          </span>
          {/* + button on hover for future dates */}
          {!isPast && current && (
            <button
              onClick={(e) => { e.stopPropagation(); openNewModal(date); }}
              className="opacity-0 group-hover:opacity-100 w-5 h-5 flex items-center justify-center rounded text-zinc-500 hover:text-accent hover:bg-accent/10 transition-all text-xs"
              title="Schedule session"
            >
              +
            </button>
          )}
        </div>
        <div className="space-y-1">
          {/* Past sessions */}
          {sessions.slice(0, maxChips).map((s) => (
            <div key={s._id} className={`${chipColor(s.room?.name || '')} text-white text-xs px-2 py-1 rounded-lg`}>
              <p className="font-medium truncate leading-tight text-[11px]">{s.room?.name || 'Room'}</p>
              <p className="opacity-75 text-[10px] leading-tight">{formatTime(s.startedAt)}</p>
            </div>
          ))}
          {/* Scheduled sessions */}
          {scheduled.slice(0, Math.max(0, maxChips - sessions.length)).map((s) => (
            <div key={s._id} className={`${SCHED_CHIP} text-white text-xs px-2 py-1 rounded-lg`}>
              <p className="font-medium truncate leading-tight text-[11px]">{s.room?.name || 'Room'}</p>
              <p className="opacity-75 text-[10px] leading-tight">📅 {formatTime(s.scheduledFor)}</p>
            </div>
          ))}
          {(sessions.length + scheduled.length) > maxChips && (
            <p className="text-[10px] text-zinc-500 pl-1">+{sessions.length + scheduled.length - maxChips} more</p>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="flex min-h-screen bg-surface">
      <AppSidebar user={user} onLogout={handleLogout} />

      <main className="flex-1 flex flex-col overflow-hidden h-screen">
        <div className="px-8 pt-7 pb-4 shrink-0">
          <h1 className="text-2xl font-bold text-zinc-100">Calendar</h1>
          <p className="text-muted text-sm mt-0.5">View and schedule your study sessions.</p>
        </div>

        {/* Controls — ← Month Year → | Today | Month/Week | + New session */}
        <div className="px-8 pb-4 flex items-center gap-3 shrink-0">
          {/* Month/week nav */}
          <div className="flex items-center gap-1">
            <button onClick={view === 'month' ? prevMonth : prevWeek}
              className="w-8 h-8 flex items-center justify-center rounded-lg bg-surface-1 border border-border hover:bg-surface-2 text-zinc-400 hover:text-zinc-100 transition-colors">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6" /></svg>
            </button>
            <span className="text-base font-semibold text-zinc-100 min-w-[150px] text-center">
              {view === 'month'
                ? `${MONTH_NAMES[month - 1]} ${year}`
                : `${weekDays[0].toLocaleDateString([], { month: 'short', day: 'numeric' })} – ${weekDays[6].toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}`
              }
            </span>
            <button onClick={view === 'month' ? nextMonth : nextWeek}
              className="w-8 h-8 flex items-center justify-center rounded-lg bg-surface-1 border border-border hover:bg-surface-2 text-zinc-400 hover:text-zinc-100 transition-colors">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6" /></svg>
            </button>
          </div>

          <button onClick={goToday}
            className="px-3 py-1.5 text-sm text-zinc-400 hover:text-zinc-100 bg-surface-1 border border-border rounded-lg hover:bg-surface-2 transition-colors">
            Today
          </button>

          <div className="ml-auto flex items-center gap-2">
            <div className="flex bg-surface-2 rounded-xl p-0.5 border border-border">
              {['Month', 'Week'].map((v) => (
                <button key={v} onClick={() => setView(v.toLowerCase())}
                  className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${view === v.toLowerCase() ? 'bg-accent text-white' : 'text-zinc-400 hover:text-zinc-100'}`}>
                  {v}
                </button>
              ))}
            </div>
            <button onClick={() => { setNewModalDate(null); setShowNewModal(true); }} className="btn-primary flex items-center gap-1.5 text-sm">
              <span className="text-base leading-none">+</span> New session
            </button>
          </div>
        </div>

        {/* Calendar grid */}
        <div className="flex-1 px-8 pb-8 overflow-auto">
          <div className="bg-surface-1 border border-border rounded-2xl overflow-hidden flex flex-col" style={{ minHeight: '500px' }}>
            <div className="grid grid-cols-7 border-b border-border shrink-0">
              {WEEKDAYS.map((d) => (
                <div key={d} className="py-3 text-center text-xs font-semibold text-zinc-500 uppercase tracking-wider">{d}</div>
              ))}
            </div>

            {isLoading ? (
              <div className="flex-1 flex items-center justify-center py-20">
                <div className="w-5 h-5 border-2 border-zinc-700 border-t-accent rounded-full animate-spin" />
              </div>
            ) : view === 'month' ? (
              <div className="grid grid-cols-7 flex-1">
                {grid.map((cell, i) => {
                  const isLastRow = i >= 35;
                  const isLastCol = (i + 1) % 7 === 0;
                  return (
                    <div key={i} className={`${isLastRow ? 'border-b-0' : ''} ${isLastCol ? 'border-r-0' : ''}`}
                      style={{ borderBottom: isLastRow ? 'none' : undefined, borderRight: isLastCol ? 'none' : undefined }}>
                      <DayCell date={cell.date} current={cell.current} />
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="grid grid-cols-7 flex-1">
                {weekDays.map((date, i) => (
                  <div key={i} style={{ borderRight: i === 6 ? 'none' : undefined }}>
                    <DayCell date={date} current={true} minH="min-h-[160px]" maxChips={4} />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Legend */}
          <div className="flex items-center gap-4 mt-3 px-1">
            <div className="flex items-center gap-1.5 text-xs text-zinc-500">
              <div className="w-3 h-3 rounded bg-indigo-600" />
              Past session
            </div>
            <div className="flex items-center gap-1.5 text-xs text-zinc-500">
              <div className="w-3 h-3 rounded bg-violet-700 border border-violet-500/40" />
              Scheduled
            </div>
          </div>
        </div>
      </main>

      {/* Day detail panel */}
      {selected && (
        <aside className="w-72 shrink-0 border-l border-border bg-surface-1 flex flex-col overflow-hidden h-screen sticky top-0">
          <div className="px-5 py-4 border-b border-border flex items-center justify-between shrink-0">
            <div>
              <p className="font-semibold text-zinc-100 text-sm">
                {selected.date.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })}
              </p>
              <p className="text-xs text-muted mt-0.5">
                {selected.sessions.length} completed · {selected.scheduled.length} scheduled
              </p>
            </div>
            <button onClick={() => setSelected(null)} className="text-zinc-500 hover:text-zinc-300 p-1">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
            {/* Scheduled sessions */}
            {selected.scheduled.map((s) => (
              <div key={s._id} className="bg-violet-900/20 border border-violet-500/30 rounded-xl p-4">
                <div className="flex items-start justify-between gap-2 mb-1">
                  <div>
                    <p className="font-semibold text-zinc-100 text-sm">{s.room?.name}</p>
                    <p className="text-xs text-violet-300 mt-0.5">📅 {formatTime(s.scheduledFor)}</p>
                  </div>
                  <span className="text-xs bg-violet-500/20 text-violet-300 px-2 py-0.5 rounded-full shrink-0">Scheduled</span>
                </div>
                {s.note && <p className="text-xs text-zinc-400 mt-1.5 italic">"{s.note}"</p>}
                <div className="flex items-center gap-2 mt-3">
                  <button onClick={() => navigate(`/rooms/${s.room?._id}`)}
                    className="flex-1 text-xs text-center py-1.5 rounded-lg bg-accent/10 text-accent hover:bg-accent/20 transition-colors font-medium">
                    Go to room
                  </button>
                  <button onClick={() => cancelScheduled.mutate(s._id)}
                    className="text-xs px-3 py-1.5 rounded-lg text-red-400 hover:bg-red-500/10 transition-colors"
                    disabled={cancelScheduled.isPending}>
                    Cancel
                  </button>
                </div>
              </div>
            ))}

            {/* Past sessions */}
            {selected.sessions.map((s) => (
              <div key={s._id} onClick={() => navigate(`/rooms/${s.room?._id}`)}
                className="bg-surface-2 border border-border rounded-xl p-4 cursor-pointer hover:border-accent/40 transition-colors group">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <p className="font-semibold text-zinc-100 text-sm group-hover:text-accent transition-colors">{s.room?.name}</p>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${chipColor(s.room?.name || '')} text-white shrink-0`}>
                    {formatDuration(s.durationSeconds)}
                  </span>
                </div>
                <p className="text-xs text-muted flex items-center gap-1">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
                  {formatTime(s.startedAt)}{s.endedAt && ` → ${formatTime(s.endedAt)}`}
                </p>
                {s.startedBy && <p className="text-xs text-zinc-600 mt-1">Started by {s.startedBy.name}</p>}
              </div>
            ))}
          </div>

          {selected.sessions.length > 0 && (
            <div className="px-4 py-4 border-t border-border shrink-0">
              <div className="bg-surface-2 rounded-xl p-3 text-center">
                <p className="text-xs text-muted mb-0.5">Total study time</p>
                <p className="text-lg font-bold text-accent tabular-nums">
                  {formatDuration(selected.sessions.reduce((sum, s) => sum + (s.durationSeconds || 0), 0))}
                </p>
              </div>
            </div>
          )}
        </aside>
      )}

      {showNewModal && (
        <NewSessionModal
          defaultDate={newModalDate}
          onClose={() => { setShowNewModal(false); setNewModalDate(null); }}
        />
      )}
    </div>
  );
}
