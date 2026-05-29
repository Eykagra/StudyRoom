const express = require('express');
const StudySession = require('../models/StudySession');
const ScheduledSession = require('../models/ScheduledSession');
const RoomMember = require('../models/RoomMember');
const { authMiddleware } = require('../middleware/auth.middleware');
const { AppError } = require('../middleware/error.middleware');

const router = express.Router();
router.use(authMiddleware);

// GET /api/rooms/:id/sessions — session history for a room
router.get('/rooms/:id/sessions', async (req, res, next) => {
  try {
    const { id: roomId } = req.params;
    const membership = await RoomMember.findOne({ room: roomId, user: req.user.id });
    if (!membership) throw new AppError('Access denied', 403, 'FORBIDDEN');

    const sessions = await StudySession.find({ room: roomId })
      .sort({ startedAt: -1 })
      .limit(50)
      .populate('startedBy', 'name')
      .lean();

    res.json({ sessions });
  } catch (err) {
    next(err);
  }
});

// GET /api/upcoming — next scheduled sessions across all user's rooms
router.get('/upcoming', async (req, res, next) => {
  try {
    const memberships = await RoomMember.find({ user: req.user.id }).lean();
    const roomIds = memberships.map((m) => m.room);

    const upcoming = await ScheduledSession.find({
      room: { $in: roomIds },
      scheduledFor: { $gt: new Date() },
    })
      .sort({ scheduledFor: 1 })
      .limit(20)
      .populate('room', 'name')
      .populate('createdBy', 'name')
      .lean();

    res.json({ upcoming });
  } catch (err) {
    next(err);
  }
});

// GET /api/calendar?year=2025&month=5&tzOffset=330 — sessions for a given month
// tzOffset is minutes ahead of UTC (e.g. IST = 330, EST = -300)
router.get('/calendar', async (req, res, next) => {
  try {
    const { year, month, tzOffset } = req.query;
    const y = parseInt(year) || new Date().getUTCFullYear();
    const m = parseInt(month) || new Date().getUTCMonth() + 1;
    const tz = parseInt(tzOffset) || 0; // minutes ahead of UTC

    // Widen the window by the timezone offset so local-midnight sessions aren't missed
    const offsetMs = tz * 60 * 1000;
    const start = new Date(Date.UTC(y, m - 1, 1) - offsetMs);
    const end = new Date(Date.UTC(y, m, 1) - offsetMs + 24 * 60 * 60 * 1000);

    const memberships = await RoomMember.find({ user: req.user.id }).lean();
    const roomIds = memberships.map((mb) => mb.room);

    const sessions = await StudySession.find({
      room: { $in: roomIds },
      startedAt: { $gte: start, $lt: end },
      status: 'ENDED',
    })
      .populate('room', 'name')
      .populate('startedBy', 'name')
      .sort({ startedAt: 1 })
      .lean();

    const scheduled = await ScheduledSession.find({
      room: { $in: roomIds },
      scheduledFor: { $gte: start, $lt: end },
    })
      .populate('room', 'name')
      .populate('createdBy', 'name')
      .sort({ scheduledFor: 1 })
      .lean();

    res.json({ sessions, scheduled });
  } catch (err) {
    next(err);
  }
});

// POST /api/schedule — create a scheduled session
router.post('/schedule', async (req, res, next) => {
  try {
    const { roomId, scheduledFor, note } = req.body;
    if (!roomId || !scheduledFor) {
      throw new AppError('roomId and scheduledFor are required', 400, 'VALIDATION_ERROR');
    }

    // Must be a future date
    if (new Date(scheduledFor) <= new Date()) {
      throw new AppError('Scheduled time must be in the future', 400, 'PAST_DATE');
    }

    // Must be a member of the room
    const membership = await RoomMember.findOne({ room: roomId, user: req.user.id });
    if (!membership) throw new AppError('Access denied', 403, 'FORBIDDEN');

    const scheduled = await ScheduledSession.create({
      room: roomId,
      createdBy: req.user.id,
      scheduledFor: new Date(scheduledFor),
      note,
    });

    const populated = await ScheduledSession.findById(scheduled._id)
      .populate('room', 'name')
      .populate('createdBy', 'name')
      .lean();

    res.status(201).json({ session: populated });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/schedule/:id — cancel a scheduled session
router.delete('/schedule/:id', async (req, res, next) => {
  try {
    const s = await ScheduledSession.findById(req.params.id);
    if (!s) throw new AppError('Not found', 404, 'NOT_FOUND');
    if (s.createdBy.toString() !== req.user.id) throw new AppError('Forbidden', 403, 'FORBIDDEN');
    await ScheduledSession.deleteOne({ _id: s._id });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

module.exports = router;
