const express = require('express');
const authService = require('../services/auth.service');
const { authMiddleware } = require('../middleware/auth.middleware');

const router = express.Router();

const COOKIE_OPTS = {
  httpOnly: true,
  sameSite: 'lax',
  secure: process.env.NODE_ENV === 'production',
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
};

router.post('/register', async (req, res, next) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ error: { message: 'name, email and password are required', code: 'VALIDATION_ERROR' } });
    }
    const { user, accessToken, refreshToken } = await authService.register({ name, email, password });
    res.cookie('refreshToken', refreshToken, COOKIE_OPTS);
    res.status(201).json({ user, accessToken });
  } catch (err) {
    next(err);
  }
});

router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: { message: 'email and password are required', code: 'VALIDATION_ERROR' } });
    }
    const { user, accessToken, refreshToken } = await authService.login({ email, password });
    res.cookie('refreshToken', refreshToken, COOKIE_OPTS);
    res.status(200).json({ user, accessToken });
  } catch (err) {
    next(err);
  }
});

router.post('/refresh', async (req, res, next) => {
  try {
    const tokenValue = req.cookies?.refreshToken;
    const { accessToken, refreshToken } = await authService.refresh(tokenValue);
    res.cookie('refreshToken', refreshToken, COOKIE_OPTS);
    res.status(200).json({ accessToken });
  } catch (err) {
    next(err);
  }
});

router.post('/logout', authMiddleware, async (req, res, next) => {
  try {
    const tokenValue = req.cookies?.refreshToken;
    await authService.logout(tokenValue);
    res.clearCookie('refreshToken');
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

module.exports = router;
