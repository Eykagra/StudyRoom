import { useEffect, useState } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { getSocket } from '../hooks/useSocket';
import api from '../api/client';

const AVATAR_COLORS = ['bg-violet-500', 'bg-blue-500', 'bg-emerald-500', 'bg-orange-500', 'bg-pink-500'];
function avatarColor(name = '') {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}

const EVENT_CONFIG = {
  ROOM_CREATED:    { label: 'created the room',   color: 'text-accent',      show: true },
  USER_JOINED:     { label: 'joined the room',     color: 'text-emerald-400', show: true },
  USER_LEFT:       { label: 'left the room',       color: 'text-zinc-500',    show: true },
  SESSION_STARTED: { label: 'started a session',   color: 'text-accent',      show: true },
  SESSION_PAUSED:  { label: 'paused their session',color: 'text-yellow-400',  show: true },
  SESSION_ENDED:   { label: 'ended their session', color: 'text-zinc-400',    show: true },
  MESSAGE_SENT:    { label: 'sent a message',      color: 'text-zinc-500',    show: false }, // too noisy
};

function formatTime(dateStr) {
  return new Date(dateStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatDuration(seconds) {
  if (!seconds) return '';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return ` · ${h}h ${m}m`;
  if (m > 0) return ` · ${m}m ${s}s`;
  return ` · ${s}s`;
}

// Deduplicate: remove consecutive same-user same-event within 30s
function deduplicateActivities(activities) {
  const result = [];
  for (const a of activities) {
    const last = result[result.length - 1];
    const sameUser = last?.user?._id === a.user?._id || last?.user?.name === a.user?.name;
    const sameEvent = last?.eventType === a.eventType;
    const within30s = last && (new Date(a.createdAt) - new Date(last.createdAt)) < 30000;
    if (sameUser && sameEvent && within30s) continue;
    result.push(a);
  }
  return result;
}

export default function ActivityFeed({ roomId }) {
  const [liveActivities, setLiveActivities] = useState([]);

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery({
    queryKey: ['activity', roomId],
    queryFn: ({ pageParam }) => {
      const params = { limit: 30 };
      if (pageParam) params.before = pageParam;
      return api.get(`/api/dashboard/rooms/${roomId}/activity`, { params }).then((r) => r.data);
    },
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    initialPageParam: undefined,
  });

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;
    const onActivity = ({ activity }) => {
      const config = EVENT_CONFIG[activity.eventType];
      if (!config?.show) return; // filter noisy events in real-time too
      setLiveActivities((prev) => [...prev, activity]);
    };
    socket.on('activity:new', onActivity);
    return () => socket.off('activity:new', onActivity);
  }, []);

  const historical = (data?.pages.flatMap((p) => p.activities) ?? [])
    .filter((a) => EVENT_CONFIG[a.eventType]?.show !== false);

  const historicalIds = new Set(historical.map((a) => String(a._id)));
  const raw = [...historical, ...liveActivities.filter((a) => !historicalIds.has(String(a._id)))];
  const merged = deduplicateActivities(raw);

  return (
    <div className="flex flex-col h-full">
      <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider px-4 pt-4 pb-3">
        Activity
      </p>

      <div className="flex-1 overflow-y-auto px-3 space-y-0.5">
        {merged.length === 0 && (
          <p className="text-xs text-zinc-600 px-2 py-2">No activity yet.</p>
        )}
        {merged.map((a) => {
          const config = EVENT_CONFIG[a.eventType] || { label: a.eventType, color: 'text-zinc-400' };
          const name = a.user?.name ?? 'Someone';
          const duration = a.metadata?.durationSeconds ? formatDuration(a.metadata.durationSeconds) : '';

          return (
            <div key={a._id} className="flex items-start gap-2.5 px-2 py-2 rounded-xl hover:bg-surface-2 transition-colors">
              <div className={`w-7 h-7 rounded-full ${avatarColor(name)} flex items-center justify-center text-xs font-semibold text-white shrink-0 mt-0.5`}>
                {name[0].toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-zinc-100 leading-tight truncate">{name}</p>
                <p className={`text-xs ${config.color} leading-tight`}>
                  {config.label}{duration && <span className="text-zinc-500">{duration}</span>}
                </p>
                <p className="text-xs text-zinc-600 mt-0.5">{formatTime(a.createdAt)}</p>
              </div>
            </div>
          );
        })}
      </div>

      {hasNextPage && (
        <div className="px-4 pb-3 pt-1">
          <button onClick={() => fetchNextPage()} disabled={isFetchingNextPage}
            className="text-xs text-muted hover:text-zinc-300 transition-colors">
            {isFetchingNextPage ? 'Loading...' : 'Load earlier'}
          </button>
        </div>
      )}
    </div>
  );
}
