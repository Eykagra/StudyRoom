const express = require('express');
const StudySession = require('../models/StudySession');
const ActivityLog = require('../models/ActivityLog');
const RoomMember = require('../models/RoomMember');
const { authMiddleware } = require('../middleware/auth.middleware');
const { AppError } = require('../middleware/error.middleware');

const router = express.Router();
router.use(authMiddleware);

// GET /api/dashboard/stats
router.get('/stats', async (req, res, next) => {
  try {
    const userId = req.user.id;

    // Rooms the user currently belongs to
    const memberships = await RoomMember.find({ user: userId }).lean();
    const totalRooms = memberships.length;

    // All ended sessions the user participated in:
    // - sessions they started (covers deleted rooms / rooms they left)
    // - sessions in rooms they're currently a member of
    // Union of both so historical data is never lost
    const roomIds = memberships.map((m) => m.room);

    const sessions = await StudySession.find({
      $or: [
        { startedBy: userId },
        { room: { $in: roomIds } },
      ],
      status: 'ENDED',
    }).lean();

    // Deduplicate by _id (a session could match both conditions)
    const sessionMap = new Map();
    sessions.forEach((s) => sessionMap.set(s._id.toString(), s));
    const uniqueSessions = Array.from(sessionMap.values());

    const totalSeconds = uniqueSessions.reduce((sum, s) => sum + (s.durationSeconds || 0), 0);
    const totalSessions = uniqueSessions.length;

    // Daily breakdown
    const todayUTC = new Date();
    todayUTC.setUTCHours(23, 59, 59, 999);
    const windowStart = new Date(todayUTC);
    windowStart.setUTCDate(todayUTC.getUTCDate() - 6);
    windowStart.setUTCHours(0, 0, 0, 0);

    const recentSessions = uniqueSessions.filter((s) => new Date(s.startedAt) >= windowStart);

    const dailyMap = {};
    for (let i = 0; i < 7; i++) {
      const d = new Date(windowStart);
      d.setUTCDate(windowStart.getUTCDate() + i);
      dailyMap[d.toISOString().slice(0, 10)] = 0;
    }
    for (const s of recentSessions) {
      const key = new Date(s.startedAt).toISOString().slice(0, 10);
      if (dailyMap[key] !== undefined) {
        dailyMap[key] += s.durationSeconds || 0;
      }
    }

    // Use seconds (not minutes) so sub-minute sessions still count for the chart
    const dailyData = Object.entries(dailyMap).map(([date, seconds]) => ({
      date,
      seconds,
      minutes: seconds / 60, // keep as float for chart accuracy
    }));

    // Streak: count consecutive days (ending today) where the user's rooms
    // had at least one ended session — even a 1-second session counts
    let streak = 0;
    for (let i = dailyData.length - 1; i >= 0; i--) {
      if (dailyData[i].seconds > 0) streak++;
      else break;
    }

    res.json({ totalSeconds, totalSessions, totalRooms, dailyData, streak });
  } catch (err) {
    next(err);
  }
});

// GET /api/dashboard/rooms/:id/activity
router.get('/rooms/:id/activity', async (req, res, next) => {
  try {
    const { id: roomId } = req.params;
    const { before, limit = '30' } = req.query;

    const membership = await RoomMember.findOne({ room: roomId, user: req.user.id });
    if (!membership) throw new AppError('Access denied', 403, 'FORBIDDEN');

    const query = { room: roomId };
    if (before) query._id = { $lt: before };

    const activities = await ActivityLog.find(query)
      .sort({ _id: -1 })
      .limit(Math.min(parseInt(limit), 100))
      .populate('user', 'name')
      .lean();

    activities.reverse();

    const nextCursor = activities.length === parseInt(limit) ? activities[0]._id : null;

    res.json({ activities, nextCursor });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
