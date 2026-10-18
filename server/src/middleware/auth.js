import { getAuth } from '@clerk/express';
import User from '../models/User.js';

export const protect = async (req, res, next) => {
  try {
    const { userId } = getAuth(req);
    if (!userId) return res.status(401).json({ message: 'Sign in to continue.' });
    const user = await User.findOne({ clerkId: userId });
    if (!user) return res.status(404).json({ message: 'Complete your AdPulse profile to continue.', profileRequired: true });
    if (user.isBlocked) return res.status(403).json({ message: 'This account is blocked.' });
    req.user = user;
    return next();
  } catch (error) {
    console.error('Clerk authentication error:', error.message);
    return res.status(401).json({ message: 'Your session could not be verified. Sign in again.' });
  }
};

export const allow = (...roles) => (req, res, next) => roles.includes(req.user.role)
  ? next()
  : res.status(403).json({ message: 'Insufficient permissions' });
