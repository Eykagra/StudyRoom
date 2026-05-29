import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useNavigate, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../api/client';
import useStore from '../store/useStore';
import { useSocket, getSocket } from '../hooks/useSocket';
import { useSession } from '../hooks/useSession';
import MemberList from '../components/MemberList';
import Chat from '../components/Chat';
import Timer from '../components/Timer';
import SessionControls from '../components/SessionControls';
import ActivityFeed from '../components/ActivityFeed';
import SessionEndModal from '../components/SessionEndModal';

function DeleteRoomModal({ room, sessionStatus, onConfirm, onClose, isPending }) {
  const sessionActive = sessionStatus === 'ACTIVE' || sessionStatus === 'PAUSED';
  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 px-4">
      <div className="bg-surface-1 border border-border rounded-2xl w-full max-w-sm p-6">
        {sessionActive ? (
          <>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 rounded-full bg-yellow-500/10 flex items-center justify-center shrink-0">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#eab308" strokeWidth="2">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                  <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
              </div>
              <h2 className="font-semibold text-zinc-100">Session in progress</h2>
            </div>
            <p className="text-sm text-zinc-400 mb-5">End the active session before deleting so study time is saved to everyone's stats.</p>
            <button onClick={onClose} className="btn-primary w-full">Got it</button>
          </>
        ) : (
          <>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 rounded-full bg-red-500/10 flex items-center justify-center shrink-0">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2">
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                  <path d="M10 11v6M14 11v6M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                </svg>
              </div>
              <h2 className="font-semibold text-zinc-100">Delete "{room.name}"?</h2>
            </div>
            <p className="text-sm text-zinc-400 mb-5">This permanently deletes all messages, sessions, and member access. Cannot be undone.</p>
            <div className="flex gap-2">
              <button onClick={onClose} className="btn-ghost flex-1" disabled={isPending}>Cancel</button>
              <button onClick={onConfirm} disabled={isPending}
                className="flex-1 bg-red-600 hover:bg-red-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors disabled:opacity-50">
                {isPending ? 'Deleting...' : 'Delete room'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function EditRoomModal({ room, onClose }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ name: room.name, description: room.description || '' });
  const mutation = useMutation({
    mutationFn: (data) => api.patch(`/api/rooms/${room._id}`, data).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['room', room._id] });
      queryClient.invalidateQueries({ queryKey: ['rooms'] });
      toast.success('Room updated');
      onClose();
    },
    onError: (err) => toast.error(err.response?.data?.error?.message || 'Failed to update room'),
  });
  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 px-4">
      <div className="bg-surface-1 border border-border rounded-2xl w-full max-w-md p-6">
        <h2 className="font-semibold text-zinc-100 mb-5">Edit room</h2>
        <form onSubmit={(e) => { e.preventDefault(); mutation.mutate(form); }} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1.5">Room name</label>
            <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required autoFocus />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1.5">Description <span className="text-zinc-600">(optional)</span></label>
            <input className="input" placeholder="What are you studying?" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose} className="btn-ghost flex-1">Cancel</button>
            <button type="submit" className="btn-primary flex-1" disabled={mutation.isPending}>{mutation.isPending ? 'Saving...' : 'Save changes'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function RoomDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const user = useStore((s) => s.user);
  const setOnlineUsers = useStore((s) => s.setOnlineUsers);
  const updateOnlineUsers = useStore((s) => s.updateOnlineUsers);
  const addOnlineUser = useStore((s) => s.addOnlineUser);
  const removeOnlineUser = useStore((s) => s.removeOnlineUser);
  const [showEdit, setShowEdit] = useState(false);
  const [showDelete, setShowDelete] = useState(false);

  useSocket();
  const { status, elapsed, lastDuration, start, pause, resume, end, dismissEnd } = useSession(id);

  // Hydrate online users immediately from REST on mount (fixes reload showing everyone offline)
  useEffect(() => {
    api.get(`/api/rooms/${id}/online`)
      .then(({ data }) => setOnlineUsers(id, data.users))
      .catch(() => {}); // silently ignore — socket will sync shortly
  }, [id, setOnlineUsers]);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['room', id],
    queryFn: () => api.get(`/api/rooms/${id}`).then((r) => r.data),
  });

  useEffect(() => {
    const socket = getSocket();
    if (!socket || !id) return;
    const joinRoom = () => socket.emit('room:join', { roomId: id });
    if (socket.connected) joinRoom();
    socket.on('connect', joinRoom);
    const onOnlineUsers = ({ users }) => setOnlineUsers(id, users);
    const onUserJoined = ({ user: u }) => { addOnlineUser(id, u); queryClient.invalidateQueries({ queryKey: ['room', id] }); };
    const onUserLeft = ({ userId }) => { removeOnlineUser(id, userId); queryClient.invalidateQueries({ queryKey: ['room', id] }); };
    const onRoomDeleted = ({ roomName }) => { queryClient.invalidateQueries({ queryKey: ['rooms'] }); toast.error(`"${roomName}" was deleted`); navigate('/rooms', { replace: true }); };
    // Update per-user focus status on every tick and session state change
    const onSessionTick = ({ onlineUsers: users }) => { if (users) updateOnlineUsers(id, users); };
    const onSessionState = ({ onlineUsers: users }) => { if (users) updateOnlineUsers(id, users); };
    socket.on('room:online_users', onOnlineUsers);
    socket.on('room:user_joined', onUserJoined);
    socket.on('room:user_left', onUserLeft);
    socket.on('room:deleted', onRoomDeleted);
    socket.on('session:tick', onSessionTick);
    socket.on('session:state', onSessionState);
    return () => {
      socket.emit('room:leave', { roomId: id });
      socket.off('connect', joinRoom);
      socket.off('room:online_users', onOnlineUsers);
      socket.off('room:user_joined', onUserJoined);
      socket.off('room:user_left', onUserLeft);
      socket.off('room:deleted', onRoomDeleted);
      socket.off('session:tick', onSessionTick);
      socket.off('session:state', onSessionState);
    };
  }, [id, setOnlineUsers, addOnlineUser, removeOnlineUser, navigate, queryClient]);

  const deleteMutation = useMutation({
    mutationFn: () => api.delete(`/api/rooms/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['rooms'] }); setShowDelete(false); navigate('/rooms'); },
    onError: () => toast.error('Failed to delete room'),
  });

  const copyInviteLink = () => {
    navigator.clipboard.writeText(`${window.location.origin}/join/${data.room.inviteCode}`);
    toast.success('Invite link copied');
  };

  if (isLoading) return (
    <div className="min-h-screen flex items-center justify-center bg-surface">
      <div className="flex items-center gap-2 text-muted text-sm">
        <div className="w-4 h-4 border-2 border-zinc-700 border-t-accent rounded-full animate-spin" />
        Loading room...
      </div>
    </div>
  );

  if (isError) return (
    <div className="min-h-screen flex items-center justify-center bg-surface">
      <div className="text-center">
        <p className="text-muted text-sm">Room not found or access denied.</p>
        <Link to="/rooms" className="text-accent text-sm mt-2 inline-block hover:underline">← Back to rooms</Link>
      </div>
    </div>
  );

  const { room, members } = data;
  const isOwner = room.owner._id === user?.id || room.owner === user?.id;

  return (
    <div className="h-screen flex flex-col bg-surface">
      {/* Header */}
      <header className="border-b border-border px-5 py-3 flex items-center justify-between shrink-0 bg-surface-1">
        <div className="flex items-center gap-3 min-w-0">
          <Link to="/rooms" className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-surface-2 text-muted hover:text-zinc-100 transition-colors shrink-0">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 12H5M12 5l-7 7 7 7" />
            </svg>
          </Link>
          {/* Room icon */}
          <div className="w-8 h-8 rounded-lg bg-accent/20 flex items-center justify-center text-sm shrink-0">📚</div>
          <div className="min-w-0">
            <h1 className="font-semibold text-zinc-100 truncate text-sm leading-tight">{room.name}</h1>
            {room.description && <p className="text-xs text-muted truncate leading-tight">{room.description}</p>}
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {isOwner && (
            <button onClick={() => setShowEdit(true)}
              className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-100 px-3 py-1.5 rounded-lg hover:bg-surface-2 transition-colors border border-border">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
              Settings
            </button>
          )}
          {isOwner && (
            <button onClick={() => setShowDelete(true)}
              className="flex items-center gap-1.5 text-xs text-red-400 hover:text-red-300 px-3 py-1.5 rounded-lg hover:bg-red-500/10 transition-colors border border-red-500/30"
              disabled={deleteMutation.isPending}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                <path d="M10 11v6M14 11v6" />
              </svg>
              Delete
            </button>
          )}
        </div>
      </header>

      {/* 3-column body */}
      <div className="flex-1 flex overflow-hidden">

        {/* Left — participants */}
        <aside className="w-52 shrink-0 border-r border-border bg-surface-1 flex flex-col overflow-hidden">
          <MemberList members={members} roomId={id} currentUserId={user?.id} onInvite={copyInviteLink} />
        </aside>

        {/* Center — timer + chat */}
        <div className="flex-1 flex flex-col overflow-hidden bg-surface">
          {/* Timer */}
          <div className="shrink-0 border-b border-border px-8 py-6 flex flex-col items-center bg-surface-1/50">
            <Timer elapsed={elapsed} status={status} />
            <SessionControls status={status} onStart={start} onPause={pause} onResume={resume} onEnd={end} />
          </div>

          {/* Chat */}
          <div className="flex-1 flex flex-col overflow-hidden min-h-0">
            <div className="px-5 py-3 border-b border-border shrink-0">
              <h2 className="text-sm font-semibold text-zinc-300">Chat</h2>
            </div>
            <Chat roomId={id} />
          </div>
        </div>

        {/* Right — activity */}
        <aside className="w-56 shrink-0 border-l border-border bg-surface-1 flex flex-col overflow-hidden">
          <ActivityFeed roomId={id} />
        </aside>
      </div>

      {showEdit && <EditRoomModal room={room} onClose={() => setShowEdit(false)} />}
      {showDelete && (
        <DeleteRoomModal room={room} sessionStatus={status}
          onConfirm={() => deleteMutation.mutate()} onClose={() => setShowDelete(false)} isPending={deleteMutation.isPending} />
      )}
      {lastDuration != null && <SessionEndModal durationSeconds={lastDuration} onDismiss={dismissEnd} />}
    </div>
  );
}
