const express = require('express');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const { authMiddleware } = require('../middleware/auth.middleware');
const { AppError } = require('../middleware/error.middleware');

const router = express.Router();
router.use(authMiddleware);

// GET /api/user/me — current user profile
router.get('/me', async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id).lean();
    if (!user) throw new AppError('User not found', 404, 'NOT_FOUND');
    delete user.passwordHash;
    res.json({ user });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/user/me — update name, email, bio
router.patch('/me', async (req, res, next) => {
  try {
    const { name, email, bio } = req.body;
    const user = await User.findById(req.user.id);
    if (!user) throw new AppError('User not found', 404, 'NOT_FOUND');

    if (name?.trim()) user.name = name.trim();
    if (bio !== undefined) user.bio = bio.trim().slice(0, 100);

    await user.save();
    res.json({ user });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/user/password — change password
router.patch('/password', async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      throw new AppError('currentPassword and newPassword are required', 400, 'VALIDATION_ERROR');
    }
    if (newPassword.length < 8) {
      throw new AppError('New password must be at least 8 characters', 400, 'VALIDATION_ERROR');
    }

    const user = await User.findById(req.user.id);
    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) throw new AppError('Current password is incorrect', 401, 'INVALID_CREDENTIALS');

    user.passwordHash = await bcrypt.hash(newPassword, 12);
    await user.save();
    res.json({ message: 'Password updated' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
