import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import api from '../api/client';
import useStore from '../store/useStore';
import AppSidebar from '../components/AppSidebar';

const AVATAR_COLORS = ['bg-violet-500','bg-blue-500','bg-emerald-500','bg-orange-500','bg-pink-500','bg-cyan-500'];
function avatarColor(name = '') {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}

function formatTime(s) {
  if (!s) return '0s';
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${sec}s`;
  return `${sec}s`;
}

// ── Podium for top 3 ──────────────────────────────────────────
function Podium({ top3 }) {
  const order = [1, 0, 2]; // display order: 2nd, 1st, 3rd
  const heights = ['h-24', 'h-32', 'h-20'];
  const medals = ['🥈', '🥇', '🥉'];
  const crowns = [null, '👑', null];
  const bgColors = [
    'bg-gradient-to-b from-zinc-400/20 to-zinc-400/5 border-zinc-400/30',
    'bg-gradient-to-b from-yellow-400/20 to-yellow-400/5 border-yellow-400/40',
    'bg-gradient-to-b from-amber-600/20 to-amber-600/5 border-amber-600/30',
  ];
  const nameColors = ['text-zinc-300', 'text-yellow-300', 'text-amber-400'];

  return (
    <div className="flex items-end justify-center gap-3 mb-10 px-4">
      {order.map((dataIdx, displayIdx) => {
        const person = top3[dataIdx];
        if (!person) return <div key={displayIdx} className="w-28" />;

        return (
          <div key={displayIdx} className="flex flex-col items-center gap-2 w-28">
            {/* Crown for 1st */}
            {crowns[displayIdx] && (
              <span className="text-2xl animate-bounce">{crowns[displayIdx]}</span>
            )}

            {/* Avatar */}
            <div className="relative">
              <div className={`w-14 h-14 rounded-full ${avatarColor(person.name)} flex items-center justify-center text-xl font-bold text-white ring-4 ${
                displayIdx === 1 ? 'ring-yellow-400/60' : displayIdx === 0 ? 'ring-zinc-400/40' : 'ring-amber-600/40'
              }`}>
                {person.name[0].toUpperCase()}
              </div>
              {person.isMe && (
                <span className="absolute -top-1 -right-1 text-xs bg-accent text-white rounded-full w-4 h-4 flex items-center justify-center font-bold">
                  ✓
                </span>
              )}
            </div>

            {/* Name */}
            <p className={`text-xs font-semibold text-center truncate w-full ${nameColors[displayIdx]}`}>
              {person.isMe ? 'You' : person.name}
            </p>

            {/* Podium block */}
            <div className={`w-full ${heights[displayIdx]} border rounded-t-xl flex flex-col items-center justify-center gap-1 ${bgColors[displayIdx]}`}>
              <span className="text-2xl">{medals[displayIdx]}</span>
              <p className="text-xs font-bold text-zinc-100">{formatTime(person.totalSeconds)}</p>
              <p className="text-[10px] text-zinc-500">{person.sessionCount} session{person.sessionCount !== 1 ? 's' : ''}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Rank badge ────────────────────────────────────────────────
function RankBadge({ rank }) {
  if (rank === 1) return <span className="text-lg">🥇</span>;
  if (rank === 2) return <span className="text-lg">🥈</span>;
  if (rank === 3) return <span className="text-lg">🥉</span>;
  return (
    <span className="w-7 h-7 flex items-center justify-center rounded-full bg-surface-3 text-xs font-bold text-zinc-400">
      {rank}
    </span>
  );
}

export default function Leaderboard() {
  const user = useStore((s) => s.user);
  const clearAuth = useStore((s) => s.clearAuth);
  const navigate = useNavigate();

  const [period, setPeriod] = useState('week');
  const [roomId, setRoomId] = useState('');
  const [scope, setScope] = useState('my'); // my | global

  const { data: roomsData } = useQuery({
    queryKey: ['rooms'],
    queryFn: () => api.get('/api/rooms').then((r) => r.data.rooms),
  });

  const { data, isLoading } = useQuery({
    queryKey: ['leaderboard', period, roomId, scope],
    queryFn: () => {
      const params = { period, scope };
      if (roomId) params.roomId = roomId;
      return api.get('/api/leaderboard', { params }).then((r) => r.data);
    },
  });

  const handleLogout = async () => {
    try { await api.post('/api/auth/logout'); } finally { clearAuth(); navigate('/login'); }
  };

  const ranked = data?.ranked || [];
  const top3 = ranked.slice(0, 3);
  const rest = ranked.slice(3);

  // Find current user's rank if not in top 50
  const myEntry = ranked.find((r) => r.isMe);

  return (
    <div className="flex min-h-screen bg-surface">
      <AppSidebar user={user} onLogout={handleLogout} />

      <main className="flex-1 px-8 py-8 overflow-y-auto">
        {/* Header */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-zinc-100">Leaderboard</h1>
            <p className="text-muted text-sm mt-0.5">Who's putting in the most study hours?</p>
          </div>
        </div>

        {/* Scope tabs */}
        <div className="flex gap-1 mb-5 border-b border-border">
          {[['my', '🏠 My Rooms'], ['global', '🌍 Global']].map(([val, label]) => (
            <button key={val} onClick={() => { setScope(val); setRoomId(''); }}
              className={`px-5 py-2.5 text-sm font-medium transition-colors relative
                ${scope === val ? 'text-zinc-100' : 'text-muted hover:text-zinc-300'}`}>
              {label}
              {scope === val && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent rounded-full" />}
            </button>
          ))}
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3 mb-8 flex-wrap">
          {/* Period */}
          <div className="flex bg-surface-2 rounded-xl p-0.5 border border-border">
            {[['week','This week'],['month','This month'],['all','All time']].map(([val, label]) => (
              <button key={val} onClick={() => setPeriod(val)}
                className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${period === val ? 'bg-accent text-white' : 'text-zinc-400 hover:text-zinc-100'}`}>
                {label}
              </button>
            ))}
          </div>

          {/* Room filter — only for My Rooms scope */}
          {scope === 'my' && (
            <select value={roomId} onChange={(e) => setRoomId(e.target.value)}
              className="input py-1.5 text-sm w-48">
              <option value="">All my rooms</option>
              {(roomsData || []).map((r) => (
                <option key={r._id} value={r._id}>{r.name}</option>
              ))}
            </select>
          )}

          {scope === 'global' && (
            <div className="flex items-center gap-1.5 text-xs text-zinc-500 bg-surface-2 border border-border rounded-lg px-3 py-2">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <line x1="2" y1="12" x2="22" y2="12" />
                <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
              </svg>
              All users on the platform
            </div>
          )}
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-5 h-5 border-2 border-zinc-700 border-t-accent rounded-full animate-spin" />
          </div>
        ) : ranked.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-4xl mb-3">📊</p>
            <p className="text-zinc-300 font-medium mb-1">No data yet</p>
            <p className="text-muted text-sm">
              {scope === 'global'
                ? 'No one has completed a session yet. Be the first!'
                : 'Complete study sessions in your rooms to appear here.'}
            </p>
          </div>
        ) : (
          <>
            {/* Podium */}
            {top3.length > 0 && <Podium top3={top3} />}

            {/* Rest of the list */}
            {rest.length > 0 && (
              <div className="bg-surface-1 border border-border rounded-2xl overflow-hidden max-w-2xl mx-auto">
                <div className="px-5 py-3 border-b border-border">
                  <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Rankings</p>
                </div>
                <ul>
                  {rest.map((person, i) => (
                    <li key={person.userId}
                      className={`flex items-center gap-4 px-5 py-3.5 border-b border-border last:border-0 transition-colors
                        ${person.isMe ? 'bg-accent/5' : 'hover:bg-surface-2'}`}>
                      <RankBadge rank={person.rank} />
                      <div className={`w-9 h-9 rounded-full ${avatarColor(person.name)} flex items-center justify-center text-sm font-bold text-white shrink-0`}>
                        {person.name[0].toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-zinc-100 truncate">
                          {person.isMe ? 'You' : person.name}
                          {person.isMe && <span className="ml-2 text-xs text-accent">(you)</span>}
                        </p>
                        <p className="text-xs text-muted">{person.sessionCount} session{person.sessionCount !== 1 ? 's' : ''}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-semibold text-zinc-100 tabular-nums">{formatTime(person.totalSeconds)}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* My rank if outside top 50 */}
            {!myEntry && (
              <div className="mt-4 max-w-2xl mx-auto bg-accent/5 border border-accent/20 rounded-2xl px-5 py-3.5 flex items-center gap-4">
                <span className="text-sm text-muted">Your rank: not in top 50 yet</span>
                <span className="ml-auto text-xs text-muted">Keep studying to climb the board!</span>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
