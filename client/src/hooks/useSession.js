import { useState, useEffect, useCallback, useRef } from 'react';
import { getSocket } from './useSocket';

export function useSession(roomId) {
  const [status, setStatus] = useState('IDLE');
  const [elapsed, setElapsed] = useState(0);
  const [sessionId, setSessionId] = useState(null);
  const [lastDuration, setLastDuration] = useState(null);
  const elapsedRef = useRef(0);

  useEffect(() => {
    const socket = getSocket();
    if (!socket || !roomId) return;

    const onState = ({ status: s, sessionId: sid, elapsed: e, durationSeconds }) => {
      setStatus(s);
      if (sid) setSessionId(sid);
      if (e !== undefined) {
        setElapsed(e);
        elapsedRef.current = e;
      }

      if (s === 'ENDED') {
        // session:state ENDED is only sent to the user who ended it
        const myDuration = durationSeconds ?? elapsedRef.current;
        if (myDuration != null) setLastDuration(myDuration);
        setTimeout(() => {
          setStatus('IDLE');
          setElapsed(0);
          elapsedRef.current = 0;
          setSessionId(null);
        }, 100);
      }
    };

    const onTick = ({ elapsed: e, sessionId: sid }) => {
      setElapsed(e);
      elapsedRef.current = e;
      if (sid) setSessionId(sid);
    };

    socket.on('session:state', onState);
    socket.on('session:tick', onTick);

    return () => {
      socket.off('session:state', onState);
      socket.off('session:tick', onTick);
    };
  }, [roomId]);

  const start = useCallback(() => getSocket()?.emit('session:start', { roomId }), [roomId]);
  const pause = useCallback(() => getSocket()?.emit('session:pause', { roomId, sessionId }), [roomId, sessionId]);
  const resume = useCallback(() => getSocket()?.emit('session:resume', { roomId, sessionId }), [roomId, sessionId]);
  const end = useCallback(() => getSocket()?.emit('session:end', { roomId, sessionId }), [roomId, sessionId]);
  const dismissEnd = useCallback(() => setLastDuration(null), []);

  return { status, elapsed, sessionId, lastDuration, start, pause, resume, end, dismissEnd };
}
