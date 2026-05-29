const Message = require('../models/Message');
const ActivityLog = require('../models/ActivityLog');
const StudySession = require('../models/StudySession');

// roomId → Map<userId, { id, name }>
const onlineUsers = new Map();

// `${roomId}:${userId}` → { session, startedAt, pausedAt, totalPausedMs, intervalId }
const userTimers = new Map();

function timerKey(roomId, userId) {
  return `${roomId}:${userId}`;
}

function getUserElapsed(timer) {
  if (!timer) return 0;
  const { startedAt, pausedAt, totalPausedMs } = timer;
  if (pausedAt) return Math.floor((pausedAt - startedAt - totalPausedMs) / 1000);
  return Math.floor((Date.now() - startedAt - totalPausedMs) / 1000);
}

function getRoomOnline(roomId) {
  return Array.from(onlineUsers.get(roomId)?.values() || []).map((u) => {
    const key = timerKey(roomId, u.id);
    const timer = userTimers.get(key);
    let focusStatus = 'online';
    let focusElapsed = 0;
    if (timer) {
      focusStatus = timer.pausedAt ? 'paused' : 'studying';
      focusElapsed = getUserElapsed(timer);
    }
    return { id: u.id, name: u.name, focusStatus, focusElapsed };
  });
}

async function logActivity(io, roomId, userId, eventType, metadata) {
  try {
    const doc = await ActivityLog.create({ room: roomId, user: userId, eventType, metadata });
    const populated = await ActivityLog.findById(doc._id).populate('user', 'name').lean();
    io.to(roomId).emit('activity:new', { activity: populated });
  } catch (err) {
    console.error('Failed to log activity:', err.message);
  }
}

function setupRoomSocket(io) {
  io.on('connection', (socket) => {
    const { id: userId, name: userName } = socket.user;
    socket.join(`user:${userId}`);

    // ── room:join ──────────────────────────────────────────────
    socket.on('room:join', async ({ roomId }) => {
      if (!roomId) return;
      socket.join(roomId);

      const alreadyOnline = onlineUsers.get(roomId)?.has(userId);
      if (!onlineUsers.has(roomId)) onlineUsers.set(roomId, new Map());

      const now = Date.now();
      const existing = onlineUsers.get(roomId).get(userId);
      onlineUsers.get(roomId).set(userId, {
        id: userId,
        name: userName,
        joinedAt: existing?.joinedAt || now, // preserve original join time on reconnect
      });

      socket.to(roomId).emit('room:user_joined', { user: { id: userId, name: userName } });
      // Broadcast full online list to ALL users in the room (not just the joiner)
      io.to(roomId).emit('room:online_users', { users: getRoomOnline(roomId) });

      // Send this user's own session state
      const key = timerKey(roomId, userId);
      const myTimer = userTimers.get(key);
      if (myTimer) {
        socket.emit('session:state', {
          status: myTimer.pausedAt ? 'PAUSED' : 'ACTIVE',
          sessionId: myTimer.session._id,
          elapsed: getUserElapsed(myTimer),
        });
      } else {
        const active = await StudySession.findOne({
          room: roomId, startedBy: userId, status: { $in: ['ACTIVE', 'PAUSED'] },
        });
        if (active) {
          socket.emit('session:state', { status: active.status, sessionId: active._id, elapsed: 0 });
        } else {
          socket.emit('session:state', { status: 'IDLE' });
        }
      }

      // Cancel any pending leave log (user reconnected within grace period)
      const leaveKey = `${roomId}:${userId}`;
      if (leaveTimers.has(leaveKey)) {
        clearTimeout(leaveTimers.get(leaveKey));
        leaveTimers.delete(leaveKey);
      }

      // Only log USER_JOINED for genuinely new joins, not reconnects
      // A reconnect is when the user was already tracked (alreadyOnline)
      // or rejoined within 10 seconds of leaving
      if (!alreadyOnline) {
        logActivity(io, roomId, userId, 'USER_JOINED');
      }
    });

    socket.on('room:leave', ({ roomId }) => handleLeave(socket, io, roomId, userId));

    // ── session:start — starts THIS USER's personal timer ──────
    socket.on('session:start', async ({ roomId }) => {
      if (!roomId) return;
      const key = timerKey(roomId, userId);

      // Don't start if already running
      if (userTimers.has(key)) {
        socket.emit('session:error', { message: 'Your session is already running' });
        return;
      }

      const session = await StudySession.create({ room: roomId, startedBy: userId, status: 'ACTIVE' });
      const startedAt = Date.now();
      const timer = { session, startedAt, pausedAt: null, totalPausedMs: 0, intervalId: null };

      timer.intervalId = setInterval(() => {
        const t = userTimers.get(key);
        if (!t) return;
        const elapsed = getUserElapsed(t);
        // Send tick only to this user
        socket.emit('session:tick', { elapsed, sessionId: session._id });
        // Broadcast updated presence to the room
        io.to(roomId).emit('room:online_users', { users: getRoomOnline(roomId) });
      }, 1000);

      userTimers.set(key, timer);

      // Tell only this user their session started
      socket.emit('session:state', { status: 'ACTIVE', sessionId: session._id, elapsed: 0 });
      // Tell everyone else this user is now studying
      io.to(roomId).emit('room:online_users', { users: getRoomOnline(roomId) });

      logActivity(io, roomId, userId, 'SESSION_STARTED');
    });

    // ── session:pause — pauses THIS USER's timer ───────────────
    socket.on('session:pause', async ({ roomId, sessionId }) => {
      const key = timerKey(roomId, userId);
      const timer = userTimers.get(key);
      if (!timer || timer.pausedAt) return;

      clearInterval(timer.intervalId);
      timer.intervalId = null;
      timer.pausedAt = Date.now();

      await StudySession.findByIdAndUpdate(sessionId, { status: 'PAUSED' });

      socket.emit('session:state', { status: 'PAUSED', sessionId, elapsed: getUserElapsed(timer) });
      io.to(roomId).emit('room:online_users', { users: getRoomOnline(roomId) });

      logActivity(io, roomId, userId, 'SESSION_PAUSED');
    });

    // ── session:resume — resumes THIS USER's timer ─────────────
    socket.on('session:resume', async ({ roomId, sessionId }) => {
      const key = timerKey(roomId, userId);
      const timer = userTimers.get(key);
      if (!timer || !timer.pausedAt) return;

      timer.totalPausedMs += Date.now() - timer.pausedAt;
      timer.pausedAt = null;

      timer.intervalId = setInterval(() => {
        const t = userTimers.get(key);
        if (!t) return;
        const elapsed = getUserElapsed(t);
        socket.emit('session:tick', { elapsed, sessionId });
        io.to(roomId).emit('room:online_users', { users: getRoomOnline(roomId) });
      }, 1000);

      await StudySession.findByIdAndUpdate(sessionId, { status: 'ACTIVE' });

      socket.emit('session:state', { status: 'ACTIVE', sessionId, elapsed: getUserElapsed(timer) });
      io.to(roomId).emit('room:online_users', { users: getRoomOnline(roomId) });
    });

    // ── session:end — ends THIS USER's timer only ──────────────
    socket.on('session:end', async ({ roomId, sessionId }) => {
      const key = timerKey(roomId, userId);
      const timer = userTimers.get(key);
      if (!timer) return;

      clearInterval(timer.intervalId);
      const durationSeconds = getUserElapsed(timer);
      userTimers.delete(key);

      await StudySession.findByIdAndUpdate(sessionId, {
        status: 'ENDED', endedAt: new Date(), durationSeconds,
      });

      // Only tell THIS user their session ended (with their personal duration)
      socket.emit('session:state', { status: 'ENDED', sessionId, durationSeconds });
      // Update presence for everyone (this user is no longer studying)
      io.to(roomId).emit('room:online_users', { users: getRoomOnline(roomId) });

      logActivity(io, roomId, userId, 'SESSION_ENDED', { durationSeconds });
    });

    // ── chat:send ──────────────────────────────────────────────
    socket.on('chat:send', async ({ roomId, content }) => {
      if (!roomId || !content?.trim()) return;
      const tempMsg = {
        _id: `temp_${Date.now()}`,
        content: content.trim(),
        createdAt: new Date().toISOString(),
        user: { _id: userId, name: userName },
      };
      io.to(roomId).emit('chat:message', { message: tempMsg });
      try {
        const saved = await Message.create({ room: roomId, user: userId, content: content.trim() });
        const populated = await Message.findById(saved._id).populate('user', 'name').lean();
        io.to(roomId).emit('chat:message_saved', { tempId: tempMsg._id, message: populated });
      } catch (err) {
        console.error('Failed to persist message:', err.message);
      }
    });

    socket.on('typing:start', ({ roomId }) => socket.to(roomId).emit('chat:typing', { userId, name: userName }));
    socket.on('typing:stop', ({ roomId }) => socket.to(roomId).emit('chat:typing_stop', { userId }));

    socket.on('disconnecting', () => {
      for (const roomId of socket.rooms) {
        if (roomId !== socket.id) handleLeave(socket, io, roomId, userId);
      }
    });
  });
}

// Grace period map: `roomId:userId` → timeout
// If user reconnects within 5s, cancel the leave entirely
const leaveTimers = new Map();

function handleLeave(socket, io, roomId, userId) {
  socket.leave(roomId);

  const leaveKey = `${roomId}:${userId}`;

  // Cancel any existing leave timer (duplicate disconnecting events)
  if (leaveTimers.has(leaveKey)) clearTimeout(leaveTimers.get(leaveKey));

  // Delay actual removal — if user reconnects within 5s this gets cancelled
  const t = setTimeout(() => {
    leaveTimers.delete(leaveKey);

    const roomMap = onlineUsers.get(roomId);
    const wasOnline = roomMap?.has(userId);
    if (!wasOnline) return; // already rejoined

    roomMap.delete(userId);
    if (roomMap.size === 0) onlineUsers.delete(roomId);

    // Auto-save session if they had one running
    const key = timerKey(roomId, userId);
    const timer = userTimers.get(key);
    if (timer) {
      clearInterval(timer.intervalId);
      const durationSeconds = getUserElapsed(timer);
      userTimers.delete(key);
      StudySession.findByIdAndUpdate(timer.session._id, {
        status: 'ENDED', endedAt: new Date(), durationSeconds,
      }).catch(() => {});
    }

    io.to(roomId).emit('room:user_left', { userId });
    io.to(roomId).emit('room:online_users', { users: getRoomOnline(roomId) });

    logActivity(io, roomId, userId, 'USER_LEFT');
  }, 5000); // 5s grace period — covers page refresh

  leaveTimers.set(leaveKey, t);
}

module.exports = { setupRoomSocket, getOnlineUsers: (roomId) => getRoomOnline(roomId) };
