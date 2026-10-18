import express from 'express';
import { clerkClient, getAuth } from '@clerk/express';
import User from '../models/User.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();
const safeUser = (user) => ({
  id: user.id,
  _id: user.id,
  clerkId: user.clerkId,
  name: user.name,
  email: user.email,
  role: user.role,
  company: user.company,
  approved: user.approved,
  emailVerified: user.emailVerified,
  avatar: user.avatar
});

router.get('/me', protect, (req, res) => res.json(safeUser(req.user)));

// Clerk owns passwords, sessions, verification and recovery. MongoDB stores only
// AdPulse's app-specific profile and role, linked to the verified Clerk identity.
router.post('/profile', async (req, res) => {
  try {
    const { userId } = getAuth(req);
    if (!userId) return res.status(401).json({ message: 'Sign in to continue.' });

    const clerkUser = await clerkClient.users.getUser(userId);
    const verifiedEmail = clerkUser.emailAddresses.find((address) => address.verification?.status === 'verified');
    if (!verifiedEmail) return res.status(403).json({ message: 'Verify your email in Clerk before continuing.' });

    const email = verifiedEmail.emailAddress.trim().toLowerCase();
    const existing = await User.findOne({ clerkId: userId });
    if (existing) return res.json(safeUser(existing));
    if (await User.exists({ email })) return res.status(409).json({ message: 'That email is already linked to an AdPulse profile. Contact an administrator.' });

    const roleRequested = req.body.role;
    if (!['advertiser', 'publisher'].includes(roleRequested)) {
      return res.status(400).json({ message: 'Choose advertiser or publisher.' });
    }
    const adminEmails = (process.env.CLERK_ADMIN_EMAILS || '').split(',').map((value) => value.trim().toLowerCase()).filter(Boolean);
    const isConfiguredAdmin = adminEmails.includes(email);
    const name = [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(' ').trim()
      || clerkUser.username || email.split('@')[0];
    const profile = await User.create({
      clerkId: userId,
      name,
      email,
      role: isConfiguredAdmin ? 'admin' : roleRequested,
      company: String(req.body.company || '').trim(),
      approved: isConfiguredAdmin,
      emailVerified: true,
      avatar: clerkUser.imageUrl
    });
    return res.status(201).json(safeUser(profile));
  } catch (error) {
    console.error('AdPulse profile setup failed:', error.message);
    return res.status(500).json({ message: 'Could not create your AdPulse profile. Please try again.' });
  }
});

export default router;
