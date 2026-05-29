const express = require('express');
const StudySession = require('../models/StudySession');
const RoomMember = require('../models/RoomMember');
const User = require('../models/User');
const { authMiddleware } = require('../middleware/auth.middleware');
const { AppError } = require('../middleware/error.middleware');

const router = express.Router();
router.use(authMiddleware);

// GET /api/leaderboard?roomId=xxx&period=week|month|all&scope=my|global
// Returns ranked list of users by total study time
router.get('/', async (req, res, next) => {
  try {
    const { roomId, period = 'all', scope = 'my' } = req.query;
    const userId = req.user.id;

    // Date filter
    let dateFilter = {};
    const now = new Date();
    if (period === 'week') {
      const start = new Date(now);
      start.setUTCDate(now.getUTCDate() - 6);
      start.setUTCHours(0, 0, 0, 0);
      dateFilter = { startedAt: { $gte: start } };
    } else if (period === 'month') {
      const start = new Date(now);
      start.setUTCDate(1);
      start.setUTCHours(0, 0, 0, 0);
      dateFilter = { startedAt: { $gte: start } };
    }

    let roomFilter = {};

    if (scope === 'global') {
      // All sessions on the platform — no room filter
      if (roomId) {
        // Still allow filtering by a specific room even in global scope
        const mongoose = require('mongoose');
        roomFilter = { room: new mongoose.Types.ObjectId(roomId) };
      }
    } else {
      // My rooms only
      let roomIds;
      if (roomId) {
        const membership = await RoomMember.findOne({ room: roomId, user: userId });
        if (!membership) throw new AppError('Access denied', 403, 'FORBIDDEN');
        roomIds = [roomId];
      } else {
        const memberships = await RoomMember.find({ user: userId }).lean();
        roomIds = memberships.map((m) => m.room);
      }
      const mongoose = require('mongoose');
      roomFilter = {
        room: {
          $in: roomIds.map((id) =>
            typeof id === 'string' ? new mongoose.Types.ObjectId(id) : id
          ),
        },
      };
    }

    const results = await StudySession.aggregate([
      {
        $match: {
          ...roomFilter,
          status: 'ENDED',
          durationSeconds: { $gt: 0 },
          ...dateFilter,
        },
      },
      {
        $group: {
          _id: '$startedBy',
          totalSeconds: { $sum: '$durationSeconds' },
          sessionCount: { $sum: 1 },
        },
      },
      { $sort: { totalSeconds: -1 } },
      { $limit: 50 },
    ]);

    const userIds = results.map((r) => r._id);
    const users = await User.find({ _id: { $in: userIds } }).select('name').lean();
    const userMap = {};
    users.forEach((u) => { userMap[u._id.toString()] = u.name; });

    const ranked = results.map((r, i) => ({
      rank: i + 1,
      userId: r._id.toString(),
      name: userMap[r._id.toString()] || 'Unknown',
      totalSeconds: r.totalSeconds,
      sessionCount: r.sessionCount,
      isMe: r._id.toString() === userId,
    }));

    res.json({ ranked, period, scope, roomId: roomId || null });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
