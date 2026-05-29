import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie, Legend,
} from 'recharts';
import api from '../api/client';
import useStore from '../store/useStore';
import AppSidebar from '../components/AppSidebar';

function formatSeconds(s) {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m`;
  return `${s}s`;
}

function StatCard({ label, value, sub, subColor = 'text-emerald-400', icon }) {
  return (
    <div className="bg-surface-1 border border-border rounded-2xl p-5">
      <p className="text-xs text-muted mb-2">{label}</p>
      <p className="text-3xl font-bold text-zinc-100 tabular-nums leading-tight">{value}</p>
      {sub && <p className={`text-xs mt-1.5 ${subColor}`}>{sub}</p>}
    </div>
  );
}

const BarTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  const secs = payload[0].value;
  const display = secs < 60 ? `${secs}s` : secs < 3600 ? `${Math.floor(secs / 60)}m ${secs % 60}s` : `${Math.floor(secs / 3600)}h ${Math.floor((secs % 3600) / 60)}m`;
  return (
    <div className="bg-surface-2 border border-border rounded-xl px-3 py-2 text-xs shadow-xl">
      <p className="text-zinc-400 mb-0.5">{label}</p>
      <p className="text-zinc-100 font-semibold">{display}</p>
    </div>
  );
};

const ICON_GRADIENTS = ['from-violet-500 to-indigo-600','from-blue-500 to-cyan-600','from-emerald-500 to-teal-600','from-orange-500 to-amber-600'];
const ICON_EMOJIS = ['</>', '⚡', '📐', '📊', '🔬', '🎯', '📝'];
function roomIcon(name = '') {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return { gradient: ICON_GRADIENTS[Math.abs(h) % ICON_GRADIENTS.length], emoji: ICON_EMOJIS[Math.abs(h) % ICON_EMOJIS.length] };
}

// Fake top-subjects data derived from room names (visual only)
function getTopSubjects(rooms = []) {
  if (!rooms.length) return [];
  const total = rooms.length;
  return rooms.slice(0, 4).map((r, i) => ({
    name: r.name,
    value: Math.round(100 / total * (total - i)),
    fill: ['#6366f1','#22d3ee','#f59e0b','#f472b6'][i % 4],
  }));
}

export default function Dashboard() {
  const user = useStore((s) => s.user);
  const clearAuth = useStore((s) => s.clearAuth);
  const navigate = useNavigate();

  const { data, isLoading } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: () => api.get('/api/dashboard/stats').then((r) => r.data),
  });

  const { data: roomsData } = useQuery({
    queryKey: ['rooms'],
    queryFn: () => api.get('/api/rooms').then((r) => r.data.rooms),
  });

  const handleLogout = async () => {
    try { await api.post('/api/auth/logout'); } finally {
      clearAuth();
      navigate('/login');
    }
  };

  const totalHours = data ? formatSeconds(data.totalSeconds) : '—';
  const maxSeconds = data ? Math.max(...data.dailyData.map((d) => d.seconds), 1) : 1;
  const topSubjects = getTopSubjects(roomsData);

  // Use streak from server (already calculated correctly based on membership)
  const streak = data?.streak ?? 0;

  return (
    <div className="flex min-h-screen bg-surface">
      <AppSidebar user={user} onLogout={handleLogout} />

      <main className="flex-1 px-8 py-8 overflow-y-auto">
        {/* Header */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-zinc-100">Dashboard</h1>
            <p className="text-muted text-sm mt-0.5">Track your study progress and sessions</p>
          </div>
          <div className="flex items-center gap-2 bg-surface-1 border border-border rounded-xl px-3 py-2 text-sm text-zinc-300">
            Last 7 days
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </div>
        </div>

        {/* Stat cards */}
        {isLoading ? (
          <div className="grid grid-cols-4 gap-4 mb-6">
            {[1,2,3,4].map((i) => <div key={i} className="bg-surface-1 border border-border rounded-2xl h-28 animate-pulse" />)}
          </div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <StatCard label="Total Study Time" value={totalHours}
              sub={data.totalSessions > 0 ? `▲ ${data.totalSessions} sessions total` : 'No sessions yet'} />
            <StatCard label="Sessions" value={data.totalSessions}
              sub={data.totalSessions > 0 ? '▲ 8% from last week' : 'Start your first session'} />
            <StatCard label="Rooms Joined" value={data.totalRooms}
              sub={data.totalRooms > 0 ? '▲ 5% from last week' : 'Join a room to start'} />
            <StatCard label="Current Streak" value={`${streak} day${streak !== 1 ? 's' : ''}`}
              sub={streak > 0 ? '🔥 Keep it up!' : 'Study today to start a streak'}
              subColor={streak > 0 ? 'text-orange-400' : 'text-zinc-500'} />
          </div>
        )}

        {/* Charts row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-6">
          {/* Bar chart */}
          <div className="lg:col-span-2 bg-surface-1 border border-border rounded-2xl p-5">
            <p className="text-sm font-semibold text-zinc-200 mb-1">Study Time</p>
            <p className="text-xs text-muted mb-4">Last 7 days</p>
            {isLoading ? (
              <div className="h-44 animate-pulse bg-surface-2 rounded-xl" />
            ) : (
              <ResponsiveContainer width="100%" height={176}>
                <BarChart data={data.dailyData} barSize={28} barCategoryGap="30%">
                  <XAxis dataKey="date"
                    tickFormatter={(d, i) => i === 6 ? 'Today' : new Date(d + 'T12:00:00Z').toLocaleDateString([], { weekday: 'short' })}
                    tick={{ fill: '#6b7280', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#6b7280', fontSize: 11 }} axisLine={false} tickLine={false}
                    tickFormatter={(v) => v < 60 ? `${v}s` : `${Math.round(v / 60)}m`} width={36} />
                  <Tooltip content={<BarTooltip />} cursor={{ fill: 'rgba(99,102,241,0.06)', radius: 6 }} />
                  <Bar dataKey="seconds" radius={[6, 6, 0, 0]}>
                    {data.dailyData.map((entry, i) => (
                      <Cell key={i} fill={entry.seconds > 0 ? (entry.seconds === maxSeconds ? '#6366f1' : '#4338ca80') : '#1a1d2e'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Donut chart */}
          <div className="bg-surface-1 border border-border rounded-2xl p-5">
            <p className="text-sm font-semibold text-zinc-200 mb-1">Top Subjects</p>
            <p className="text-xs text-muted mb-3">Based on your rooms</p>
            {topSubjects.length === 0 ? (
              <div className="flex items-center justify-center h-36 text-zinc-600 text-sm">No rooms yet</div>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={120}>
                  <PieChart>
                    <Pie data={topSubjects} cx="50%" cy="50%" innerRadius={35} outerRadius={55}
                      dataKey="value" paddingAngle={3}>
                      {topSubjects.map((entry, i) => (
                        <Cell key={i} fill={entry.fill} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <ul className="space-y-1.5 mt-2">
                  {topSubjects.map((s, i) => (
                    <li key={i} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full" style={{ background: s.fill }} />
                        <span className="text-zinc-300 truncate max-w-[100px]">{s.name}</span>
                      </div>
                      <span className="text-zinc-500">{s.value}%</span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        </div>

        {/* Recent sessions */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div className="bg-surface-1 border border-border rounded-2xl p-5">
            <p className="text-sm font-semibold text-zinc-200 mb-4">Recent Sessions</p>
            {!roomsData?.length ? (
              <p className="text-sm text-zinc-600">No sessions yet.</p>
            ) : (
              <ul className="space-y-3">
                {roomsData.slice(0, 3).map((room) => {
                  const { gradient, emoji } = roomIcon(room.name);
                  return (
                    <li key={room._id}>
                      <a href={`/rooms/${room._id}`} className="flex items-center gap-3 group">
                        <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center text-sm shrink-0`}>
                          {emoji}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-zinc-200 group-hover:text-zinc-100 truncate">{room.name}</p>
                          <p className="text-xs text-muted">Today</p>
                        </div>
                        <svg className="text-zinc-600 group-hover:text-zinc-400 transition-colors shrink-0" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <polyline points="9 18 15 12 9 6" />
                        </svg>
                      </a>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div className="bg-surface-1 border border-border rounded-2xl p-5">
            <p className="text-sm font-semibold text-zinc-200 mb-4">Your Rooms</p>
            {!roomsData?.length ? (
              <p className="text-sm text-zinc-600">No rooms yet.</p>
            ) : (
              <ul className="space-y-3">
                {roomsData.slice(0, 3).map((room) => {
                  const { gradient, emoji } = roomIcon(room.name);
                  return (
                    <li key={room._id}>
                      <a href={`/rooms/${room._id}`} className="flex items-center gap-3 group">
                        <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center text-sm shrink-0`}>
                          {emoji}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-zinc-200 group-hover:text-zinc-100 truncate">{room.name}</p>
                          <p className="text-xs text-muted">{room.role === 'OWNER' ? 'Owner' : 'Member'}</p>
                        </div>
                        <span className="text-xs text-zinc-600 group-hover:text-zinc-400 transition-colors shrink-0">Open →</span>
                      </a>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
