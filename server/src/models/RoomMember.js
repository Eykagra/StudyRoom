const mongoose = require('mongoose');

const roomMemberSchema = new mongoose.Schema({
  room: { type: mongoose.Schema.Types.ObjectId, ref: 'Room', required: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  role: { type: String, enum: ['OWNER', 'MEMBER'], default: 'MEMBER' },
  joinedAt: { type: Date, default: Date.now },
});

roomMemberSchema.index({ room: 1, user: 1 }, { unique: true });

module.exports = mongoose.model('RoomMember', roomMemberSchema);
