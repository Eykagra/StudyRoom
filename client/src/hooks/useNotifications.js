import { useEffect } from 'react';
import { getSocket } from './useSocket';
import { notify, requestNotificationPermission } from '../utils/notifications';
import useStore from '../store/useStore';

// This hook attaches global socket listeners for notifications.
// Mounted once at the app level in App.jsx.
export function useNotifications() {
  const user = useStore((s) => s.user);
  const accessToken = useStore((s) => s.accessToken);

  useEffect(() => {
    if (!accessToken || !user) return;

    // Request permission on first load (non-blocking)
    requestNotificationPermission();

    // We need to wait for the socket to be available.
    // Poll briefly since useSocket creates it in the same render cycle.
    let socket = getSocket();
    let retryTimer = null;
    let cleaned = false;

    function attach(s) {
      // ── Session started/ended ──────────────────────────────
      const onSessionState = ({ status, durationSeconds, isNew }) => {
        // Only notify on fresh events, not on sync (room:join sends state without isNew)
        if (!isNew) return;
        if (status === 'ACTIVE') {
          notify('sessionStart', 'Session started', 'A study session has begun in your room.');
        }
        if (status === 'ENDED') {
          const dur = durationSeconds ? `${Math.floor(durationSeconds / 60)}m` : '';
          notify('sessionEnd', 'Session ended', dur ? `Great session! ${dur} of focused study.` : 'The study session has ended.');
        }
      };

      // ── New message ────────────────────────────────────────
      const onChatMessage = ({ message }) => {
        const senderId = message?.user?._id?.toString() || message?.user?.id;
        if (senderId === user?.id) return;
        const name = message?.user?.name || 'Someone';
        const content = message?.content?.slice(0, 50) || '';
        notify('newMessage', `${name}`, content);
      };

      // ── Member joined ──────────────────────────────────────
      const onUserJoined = ({ user: u }) => {
        if (u?.id === user?.id) return;
        notify('memberJoined', `${u?.name || 'Someone'} joined`, 'A new member joined the room.');
      };

      // ── Member left ────────────────────────────────────────
      const onUserLeft = ({ userId }) => {
        if (userId === user?.id) return;
        notify('memberLeft', 'Member left', 'A member left the room.');
      };

      // ── Room deleted ───────────────────────────────────────
      const onRoomDeleted = ({ roomName }) => {
        notify('roomDeleted', 'Room deleted', `"${roomName}" was deleted by the owner.`);
      };

      s.on('session:state', onSessionState);
      s.on('chat:message', onChatMessage);
      s.on('room:user_joined', onUserJoined);
      s.on('room:user_left', onUserLeft);
      s.on('room:deleted', onRoomDeleted);

      return () => {
        s.off('session:state', onSessionState);
        s.off('chat:message', onChatMessage);
        s.off('room:user_joined', onUserJoined);
        s.off('room:user_left', onUserLeft);
        s.off('room:deleted', onRoomDeleted);
      };
    }

    let detach = null;

    if (socket) {
      detach = attach(socket);
    } else {
      // Retry until socket is available (max 3s)
      let attempts = 0;
      retryTimer = setInterval(() => {
        if (cleaned) { clearInterval(retryTimer); return; }
        socket = getSocket();
        if (socket) {
          clearInterval(retryTimer);
          detach = attach(socket);
        }
        if (++attempts > 30) clearInterval(retryTimer);
      }, 100);
    }

    return () => {
      cleaned = true;
      if (retryTimer) clearInterval(retryTimer);
      if (detach) detach();
    };
  }, [accessToken, user?.id]);
}
