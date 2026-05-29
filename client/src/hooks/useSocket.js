import { useEffect } from 'react';
import { io } from 'socket.io-client';
import useStore from '../store/useStore';

let socketInstance = null;

export function getSocket() {
  return socketInstance;
}

export function useSocket() {
  const accessToken = useStore((s) => s.accessToken);

  useEffect(() => {
    if (!accessToken) {
      if (socketInstance) {
        socketInstance.disconnect();
        socketInstance = null;
      }
      return;
    }

    // Reuse if already connected with the same token
    if (socketInstance && socketInstance.connected) return;

    // If a disconnected instance exists, clean it up before making a new one
    if (socketInstance) {
      socketInstance.disconnect();
      socketInstance = null;
    }

    socketInstance = io(import.meta.env.VITE_SOCKET_URL || 'http://localhost:4000', {
      auth: { token: accessToken },
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });

    socketInstance.on('connect_error', (err) => {
      console.error('Socket connection error:', err.message);
    });
  }, [accessToken]);

  return socketInstance;
}
