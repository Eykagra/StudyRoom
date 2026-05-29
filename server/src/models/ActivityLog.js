const mongoose = require('mongoose');

const activityLogSchema = new mongoose.Schema({
  room: { type: mongoose.Schema.Types.ObjectId, ref: 'Room', required: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  eventType: {
    type: String,
    enum: ['ROOM_CREATED', 'USER_JOINED', 'USER_LEFT', 'SESSION_STARTED', 'SESSION_PAUSED', 'SESSION_ENDED', 'MESSAGE_SENT'],
    required: true,
  },
  metadata: { type: mongoose.Schema.Types.Mixed },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('ActivityLog', activityLogSchema);
