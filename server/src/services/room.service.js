const { nanoid } = require('nanoid');
const Room = require('../models/Room');
const RoomMember = require('../models/RoomMember');
const ActivityLog = require('../models/ActivityLog');
const StudySession = require('../models/StudySession');
const { AppError } = require('../middleware/error.middleware');

async function createRoom({ name, description, userId }) {
  const inviteCode = nanoid(10);
  const room = await Room.create({ name, description, inviteCode, owner: userId });

  // Add owner as a member with OWNER role
  await RoomMember.create({ room: room._id, user: userId, role: 'OWNER' });

  await ActivityLog.create({ room: room._id, user: userId, eventType: 'ROOM_CREATED' });

  return room;
}

async function getUserRooms(userId) {
  const memberships = await RoomMember.find({ user: userId })
    .populate({ path: 'room', populate: { path: 'owner', select: 'name email' } })
    .lean();

  // Get member counts for all rooms in one query
  const roomIds = memberships.map((m) => m.room?._id).filter(Boolean);
  const counts = await RoomMember.aggregate([
    { $match: { room: { $in: roomIds } } },
    { $group: { _id: '$room', count: { $sum: 1 } } },
  ]);
  const countMap = {};
  counts.forEach((c) => { countMap[c._id.toString()] = c.count; });

  return memberships.map((m) => ({
    ...m.room,
    role: m.role,
    memberCount: countMap[m.room?._id?.toString()] || 1,
  }));
}

async function getRoomById(roomId, userId) {
  const room = await Room.findById(roomId).populate('owner', 'name email').lean();
  if (!room) throw new AppError('Room not found', 404, 'NOT_FOUND');

  const membership = await RoomMember.findOne({ room: roomId, user: userId });
  if (!membership) throw new AppError('Access denied', 403, 'FORBIDDEN');

  const members = await RoomMember.find({ room: roomId })
    .populate('user', 'name email')
    .lean();

  return { room, members };
}

async function updateRoom({ roomId, userId, name, description }) {
  const room = await Room.findById(roomId);
  if (!room) throw new AppError('Room not found', 404, 'NOT_FOUND');
  if (room.owner.toString() !== userId) throw new AppError('Only the owner can edit this room', 403, 'FORBIDDEN');

  if (name) room.name = name.trim();
  if (description !== undefined) room.description = description.trim();
  await room.save();
  return room;
}

async function deleteRoom(roomId, userId, io) {
  const room = await Room.findById(roomId);
  if (!room) throw new AppError('Room not found', 404, 'NOT_FOUND');
  if (room.owner.toString() !== userId) throw new AppError('Only the owner can delete this room', 403, 'FORBIDDEN');

  // End any active/paused session and save duration so it counts toward stats
  const activeSession = await StudySession.findOne({ room: roomId, status: { $in: ['ACTIVE', 'PAUSED'] } });
  if (activeSession) {
    const durationSeconds = Math.floor((Date.now() - activeSession.startedAt.getTime()) / 1000);
    await StudySession.findByIdAndUpdate(activeSession._id, {
      status: 'ENDED',
      endedAt: new Date(),
      durationSeconds,
    });
  }

  // Fetch all members before deleting so we can notify them
  const members = await RoomMember.find({ room: roomId }).lean();

  await Room.deleteOne({ _id: roomId });
  await RoomMember.deleteMany({ room: roomId });

  // Notify every member via their personal socket room — works whether they're
  // inside the room, on the rooms list, or anywhere else in the app
  if (io) {
    members.forEach((m) => {
      io.to(`user:${m.user.toString()}`).emit('room:deleted', { roomId, roomName: room.name });
    });
  }
}

async function joinRoom(inviteCode, userId) {
  const room = await Room.findOne({ inviteCode });
  if (!room) throw new AppError('Invalid invite code', 404, 'NOT_FOUND');

  const existing = await RoomMember.findOne({ room: room._id, user: userId });
  if (existing) return room; // Already a member, just redirect

  try {
    await RoomMember.create({ room: room._id, user: userId, role: 'MEMBER' });
    await ActivityLog.create({ room: room._id, user: userId, eventType: 'USER_JOINED' });
  } catch (err) {
    // Handle race condition: if duplicate key error, user is already a member
    if (err.code === 11000) return room;
    throw err;
  }

  return room;
}

module.exports = { createRoom, getUserRooms, getRoomById, updateRoom, deleteRoom, joinRoom };
