const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const RefreshToken = require('../models/RefreshToken');
const { AppError } = require('../middleware/error.middleware');

function signAccessToken(user) {
  return jwt.sign(
    { id: user._id.toString(), name: user.name, email: user.email },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '15m' }
  );
}

function signRefreshToken(user) {
  return jwt.sign(
    { id: user._id.toString() },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d' }
  );
}

async function register({ name, email, password }) {
  const existing = await User.findOne({ email });
  if (existing) throw new AppError('Email already in use', 409, 'EMAIL_TAKEN');

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await User.create({ name, email, passwordHash });

  const accessToken = signAccessToken(user);
  const refreshTokenValue = signRefreshToken(user);
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  try {
    await RefreshToken.create({ user: user._id, token: refreshTokenValue, expiresAt });
  } catch (err) {
    if (err.code !== 11000) throw err; // ignore duplicate, token already stored
  }

  return { user, accessToken, refreshToken: refreshTokenValue };
}

async function login({ email, password }) {
  const user = await User.findOne({ email });
  if (!user) throw new AppError('Invalid credentials', 401, 'INVALID_CREDENTIALS');

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) throw new AppError('Invalid credentials', 401, 'INVALID_CREDENTIALS');

  const accessToken = signAccessToken(user);
  const refreshTokenValue = signRefreshToken(user);
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  try {
    await RefreshToken.create({ user: user._id, token: refreshTokenValue, expiresAt });
  } catch (err) {
    if (err.code !== 11000) throw err; // ignore duplicate, token already stored
  }

  return { user, accessToken, refreshToken: refreshTokenValue };
}

async function refresh(tokenValue) {
  if (!tokenValue) throw new AppError('No refresh token', 401, 'UNAUTHORIZED');

  let payload;
  try {
    payload = jwt.verify(tokenValue, process.env.JWT_REFRESH_SECRET);
  } catch {
    throw new AppError('Invalid refresh token', 401, 'UNAUTHORIZED');
  }

  const stored = await RefreshToken.findOne({ token: tokenValue });
  if (!stored) throw new AppError('Refresh token revoked', 401, 'UNAUTHORIZED');

  // Rotate: delete old, issue new
  await RefreshToken.deleteOne({ _id: stored._id });

  const user = await User.findById(payload.id);
  if (!user) throw new AppError('User not found', 401, 'UNAUTHORIZED');

  const accessToken = signAccessToken(user);
  const newRefreshToken = signRefreshToken(user);
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  await RefreshToken.create({ user: user._id, token: newRefreshToken, expiresAt });

  return { accessToken, refreshToken: newRefreshToken };
}

async function logout(tokenValue) {
  if (tokenValue) {
    await RefreshToken.deleteOne({ token: tokenValue });
  }
}

module.exports = { register, login, refresh, logout };
