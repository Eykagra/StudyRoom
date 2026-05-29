import { useState, useEffect } from 'react';
import useStore from '../store/useStore';

const AVATAR_COLORS = ['bg-violet-500', 'bg-blue-500', 'bg-emerald-500', 'bg-orange-500', 'bg-pink-500', 'bg-cyan-500'];
function avatarColor(name = '') {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}

function getPrivacyPrefs() {
  try { return JSON.parse(localStorage.getItem('privacyPrefs') || '{"showOnline":true}'); }
  catch { return { showOnline: true }; }
}

function formatElapsed(s) {
  if (!s) return '';
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m`;
  return `${s}s`;
}

export default function MemberList({ members, roomId, onInvite, currentUserId }) {
  const onlineUsers = useStore((s) => s.onlineUsers[roomId] || []);
  const onlineMap = new Map(onlineUsers.map((u) => [u.id, u]));
  const [myPrivacy, setMyPrivacy] = useState(getPrivacyPrefs);

  useEffect(() => {
    const handler = () => setMyPrivacy(getPrivacyPrefs());
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, []);

  return (
    <div className="flex flex-col h-full">
      <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider px-4 pt-4 pb-3">
        Participants ({members.length})
      </p>
      <ul className="flex-1 overflow-y-auto px-3 space-y-1">
        {members.map((m) => {
          const uid = m.user._id?.toString() || m.user.id;
          const isMe = uid === currentUserId;
          const onlineData = onlineMap.get(uid);
          const isOnline = !!onlineData;
          const showAsOnline = isOnline && (isMe || myPrivacy.showOnline);

          // Focus status from server
          const focusStatus = onlineData?.focusStatus || 'offline'; // studying | paused | online | offline
          const focusElapsed = onlineData?.focusElapsed || 0;

          // Dot color
          const dotColor = !showAsOnline ? 'bg-zinc-600'
            : focusStatus === 'studying' ? 'bg-emerald-400'
            : focusStatus === 'paused' ? 'bg-yellow-400'
            : 'bg-blue-400';

          // Status label
          let statusLabel;
          let statusColor;
          if (!showAsOnline) {
            statusLabel = 'Offline';
            statusColor = 'text-zinc-500';
          } else if (focusStatus === 'studying') {
            statusLabel = focusElapsed > 0 ? `🟢 ${formatElapsed(focusElapsed)}` : '🟢 Studying';
            statusColor = 'text-emerald-400';
          } else if (focusStatus === 'paused') {
            statusLabel = '🟡 Paused';
            statusColor = 'text-yellow-400';
          } else {
            statusLabel = isMe ? 'You' : 'Online';
            statusColor = 'text-blue-400';
          }

          return (
            <li key={m._id} className="flex items-center gap-3 px-2 py-2 rounded-xl hover:bg-surface-2 transition-colors">
              <div className="relative shrink-0">
                <div className={`w-9 h-9 rounded-full ${avatarColor(m.user.name)} flex items-center justify-center text-sm font-semibold text-white`}>
                  {m.user.name[0].toUpperCase()}
                </div>
                <span className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-surface-1 ${dotColor}`} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-zinc-100 truncate leading-tight">
                  {m.user.name}
                  {m.role === 'OWNER' && (
                    <span className="ml-1.5 text-xs text-muted font-normal">(Host)</span>
                  )}
                </p>
                <p className={`text-xs leading-tight ${statusColor}`}>{statusLabel}</p>
              </div>
            </li>
          );
        })}
      </ul>

      {onInvite && (
        <div className="px-3 pb-4 pt-2">
          <button
            onClick={onInvite}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-dashed border-border text-sm text-zinc-400 hover:text-zinc-100 hover:border-accent/50 hover:bg-accent/5 transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Invite members
          </button>
        </div>
      )}
    </div>
  );
}
