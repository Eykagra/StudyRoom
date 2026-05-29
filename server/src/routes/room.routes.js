const express = require('express');
const roomService = require('../services/room.service');
const Message = require('../models/Message');
const RoomMember = require('../models/RoomMember');
const { authMiddleware } = require('../middleware/auth.middleware');
const { AppError } = require('../middleware/error.middleware');
const { getOnlineUsers } = require('../sockets/room.socket');

const router = express.Router();

// All room routes require auth
router.use(authMiddleware);

router.get('/', async (req, res, next) => {
  try {
    const rooms = await roomService.getUserRooms(req.user.id);
    res.json({ rooms });
  } catch (err) {
    next(err);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const { name, description } = req.body;
    if (!name) {
      return res.status(400).json({ error: { message: 'Room name is required', code: 'VALIDATION_ERROR' } });
    }
    const room = await roomService.createRoom({ name, description, userId: req.user.id });
    res.status(201).json({ room });
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const { room, members } = await roomService.getRoomById(req.params.id, req.user.id);
    res.json({ room, members });
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    await roomService.deleteRoom(req.params.id, req.user.id, req.io);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

router.patch('/:id', async (req, res, next) => {
  try {
    const { name, description } = req.body;
    const room = await roomService.updateRoom({ roomId: req.params.id, userId: req.user.id, name, description });
    res.json({ room });
  } catch (err) {
    next(err);
  }
});

router.post('/join/:inviteCode', async (req, res, next) => {
  try {
    const room = await roomService.joinRoom(req.params.inviteCode, req.user.id);
    res.json({ room });
  } catch (err) {
    next(err);
  }
});

// GET /api/rooms/:id/messages — cursor-based pagination
router.get('/:id/messages', async (req, res, next) => {
  try {
    const { id: roomId } = req.params;
    const { before, limit = '50' } = req.query;

    // Verify membership
    const membership = await RoomMember.findOne({ room: roomId, user: req.user.id });
    if (!membership) throw new AppError('Access denied', 403, 'FORBIDDEN');

    const query = { room: roomId };
    if (before) query._id = { $lt: before };

    const messages = await Message.find(query)
      .sort({ _id: -1 })
      .limit(Math.min(parseInt(limit), 100))
      .populate('user', 'name')
      .lean();

    messages.reverse(); // oldest first

    const nextCursor = messages.length === parseInt(limit) ? messages[0]._id : null;

    res.json({ messages, nextCursor });
  } catch (err) {
    next(err);
  }
});

// GET /api/rooms/:id/online — current online users (for page reload hydration)
router.get('/:id/online', async (req, res, next) => {
  try {
    const { id: roomId } = req.params;
    const membership = await RoomMember.findOne({ room: roomId, user: req.user.id });
    if (!membership) throw new AppError('Access denied', 403, 'FORBIDDEN');
    const users = getOnlineUsers(roomId);
    res.json({ users });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
