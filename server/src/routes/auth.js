import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { createHash, randomBytes } from 'node:crypto';
import User from '../models/User.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const attempts = new Map();
const genericRecoveryMessage = 'If the account exists, recovery instructions are available.';
const tokenFor = (id) => jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '24h' });
const frontendUrl = () => (process.env.CLIENT_URL || 'http://localhost:5173').replace(/\/$/, '');
const hashToken = (token) => createHash('sha256').update(token).digest('hex');
const makeToken = () => randomBytes(32).toString('hex');
const safeUser = (user) => ({
  id: user.id, _id: user.id, name: user.name, email: user.email, role: user.role,
  company: user.company, approved: user.approved, emailVerified: user.emailVerified,
  avatar: user.avatar
});
const deliverLink = async ({ user, token, kind }) => {
  const verify = kind === 'verification';
  const url = `${frontendUrl()}/login?${verify ? 'verify' : 'reset'}=${encodeURIComponent(token)}`;
  // Free demo mode: show account links in the app instead of using a paid email API.
  return { previewLink: url };
};

// Keep repeated guesses from hammering the login endpoint. The map is per process;
// a shared store can replace it if the app is later scaled to multiple instances.
const isThrottled = (key) => {
  const now = Date.now();
  const current = attempts.get(key);
  if (current && current.until > now && current.count >= 8) return true;
  if (!current || current.until <= now) attempts.set(key, { count: 0, until: now + 15 * 60 * 1000 });
  return false;
};
const recordFailure = (key) => {
  const current = attempts.get(key) || { count: 0, until: Date.now() + 15 * 60 * 1000 };
  current.count += 1;
  attempts.set(key, current);
};

router.post('/register', async (req, res) => {
  try {
    const name = String(req.body.name || '').trim();
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = String(req.body.password || '');
    const role = req.body.role;
    if (name.length < 2) return res.status(400).json({ message: 'Enter your full name.' });
    if (!emailPattern.test(email)) return res.status(400).json({ message: 'Enter a valid email address.' });
    if (password.length < 8) return res.status(400).json({ message: 'Use a password with at least 8 characters.' });
    if (!['advertiser', 'publisher'].includes(role)) return res.status(400).json({ message: 'Choose advertiser or publisher.' });
    if (await User.findOne({ email })) return res.status(409).json({ message: 'That email is already registered. Sign in or reset its password.' });

    const token = makeToken();
    const user = await User.create({
      name, email, password: await bcrypt.hash(password, 12), role,
      company: String(req.body.company || '').trim(), approved: false,
      emailVerificationTokenHash: hashToken(token), emailVerificationExpires: new Date(Date.now() + 30 * 60 * 1000)
    });
    const preview = await deliverLink({ user, token, kind: 'verification' });
    return res.status(201).json({ message: 'Account created. Open the one-time demo verification link below to continue.', verificationRequired: true, ...preview });
  } catch (error) {
    console.error('Registration error:', error.message);
    return res.status(400).json({ message: 'Unable to create account. Check the details and try again.' });
  }
});

router.post('/verify-email/link', async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  if (!emailPattern.test(email)) return res.status(400).json({ message: 'Enter a valid email address.' });
  const user = await User.findOne({ email }).select('+emailVerificationTokenHash +emailVerificationExpires');
  if (!user || user.emailVerified || user.role === 'admin') return res.json({ message: genericRecoveryMessage });
  const token = makeToken();
  user.emailVerificationTokenHash = hashToken(token);
  user.emailVerificationExpires = new Date(Date.now() + 30 * 60 * 1000);
  await user.save();
  const preview = await deliverLink({ user, token, kind: 'verification' });
  return res.json({ message: 'One-time demo verification link generated.', ...preview });
});

router.post('/verify-email/confirm', async (req, res) => {
  const token = String(req.body.token || '');
  if (!token) return res.status(400).json({ message: 'Verification link is invalid or expired.' });
  const user = await User.findOne({ emailVerificationTokenHash: hashToken(token), emailVerificationExpires: { $gt: new Date() } })
    .select('+emailVerificationTokenHash +emailVerificationExpires');
  if (!user) return res.status(400).json({ message: 'Verification link is invalid or expired. Request a new one.' });
  user.emailVerified = true;
  user.emailVerificationTokenHash = undefined;
  user.emailVerificationExpires = undefined;
  await user.save();
  return res.json({ message: 'Email verified. Welcome to AdPulse.', token: tokenFor(user.id), user: safeUser(user) });
});

router.post('/login', async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const key = `${req.ip}:${email}`;
  if (isThrottled(key)) return res.status(429).json({ message: 'Too many sign-in attempts. Please wait 15 minutes and try again.' });
  const user = await User.findOne({ email });
  if (!user || !(await bcrypt.compare(String(req.body.password || ''), user.password))) {
    recordFailure(key);
    return res.status(401).json({ message: 'Invalid email or password.' });
  }
  if (user.isBlocked) return res.status(403).json({ message: 'This account is blocked. Contact an administrator.' });
  // Existing administrator accounts predate email verification; keep the admin
  // console accessible while requiring verification for new advertiser/publisher accounts.
  if (!user.emailVerified && user.role !== 'admin') return res.status(403).json({ message: 'Your account needs verification before sign-in.', verificationRequired: true });
  attempts.delete(key);
  res.json({ token: tokenFor(user.id), user: safeUser(user) });
});

router.get('/me', protect, (req, res) => res.json(safeUser(req.user)));

router.post('/forgot-password', async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  if (!emailPattern.test(email)) return res.status(400).json({ message: 'Enter a valid email address.' });
  const user = await User.findOne({ email }).select('+passwordResetTokenHash +passwordResetExpires');
  if (user && !user.isBlocked) {
    // Never return a password-reset bearer token from the public production API.
    // Without an email provider, production recovery must be handled by an admin.
    if (process.env.NODE_ENV === 'production') return res.json({ message: genericRecoveryMessage });
    const token = makeToken();
    user.passwordResetTokenHash = hashToken(token);
    user.passwordResetExpires = new Date(Date.now() + 30 * 60 * 1000);
    await user.save();
    const preview = await deliverLink({ user, token, kind: 'reset' });
    return res.json({ message: 'One-time local password-reset link generated.', ...preview });
  }
  res.json({ message: genericRecoveryMessage });
});

router.post('/reset-password', async (req, res) => {
  const token = String(req.body.token || '');
  const password = String(req.body.password || '');
  if (password.length < 8) return res.status(400).json({ message: 'Use a password with at least 8 characters.' });
  const user = await User.findOne({ passwordResetTokenHash: hashToken(token), passwordResetExpires: { $gt: new Date() } })
    .select('+passwordResetTokenHash +passwordResetExpires');
  if (!user) return res.status(400).json({ message: 'Reset link is invalid or expired. Request a new one.' });
  user.password = await bcrypt.hash(password, 12);
  user.passwordResetTokenHash = undefined;
  user.passwordResetExpires = undefined;
  await user.save();
  res.json({ message: 'Password updated. You can now sign in.' });
});

export default router;
