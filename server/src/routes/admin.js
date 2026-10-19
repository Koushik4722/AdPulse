import express from 'express'; import User from '../models/User.js'; import Campaign from '../models/Campaign.js'; import PublisherSite from '../models/PublisherSite.js'; import FraudEvent from '../models/FraudEvent.js'; import {protect,allow} from '../middleware/auth.js';
const router=express.Router(); router.use(protect,allow('admin'));
router.get('/overview', async (req, res) => {
  const now = new Date();
  await Campaign.updateMany({ status: 'scheduled', startDate: { $lte: now } }, { $set: { status: 'active' } });
  await Campaign.updateMany({ status: 'active', endDate: { $lt: now } }, { $set: { status: 'completed' } });
  const [users, campaigns, sites, fraud] = await Promise.all([
    User.find().select('name email role company isBlocked emailVerified'),
    Campaign.find().populate('advertiser', 'name'),
    PublisherSite.find(),
    FraudEvent.find().populate('campaign', 'name').sort('-createdAt').limit(20)
  ]);
  const revenue = campaigns.reduce((s, c) => s + c.spent, 0);
  res.json({
    revenue,
    activeCampaigns: campaigns.filter(c => c.status === 'active').length,
    users,
    campaigns,
    sites,
    fraud,
    topAdvertisers: users
      .filter(u => u.role === 'advertiser')
      .map(u => ({
        name: u.name,
        value: campaigns
          .filter(c => String(c.advertiser?._id || c.advertiser) === String(u._id))
          .reduce((s, c) => s + c.spent, 0)
      }))
  });
});

router.patch('/users/:id', async (req, res) => {
  const updates = {};
  ['isBlocked'].forEach(k => {
    if (typeof req.body[k] === 'boolean') updates[k] = req.body[k];
  });
  const user = await User.findByIdAndUpdate(req.params.id, { $set: updates }, { new: true }).select('-password');
  if (!user) return res.status(404).json({ message: 'User not found' });
  res.json(user);
});

router.patch('/sites/:id', async (req, res) => {
  if (!['pending', 'approved', 'rejected', 'blocked'].includes(req.body.status))
    return res.status(400).json({ message: 'Invalid site status' });
  const site = await PublisherSite.findByIdAndUpdate(req.params.id, { $set: { status: req.body.status } }, { new: true });
  if (!site) return res.status(404).json({ message: 'Site not found' });
  res.json(site);
});

router.patch('/fraud/:id', async (req, res) => {
  const fraud = await FraudEvent.findByIdAndUpdate(
    req.params.id,
    { $set: { resolved: req.body.resolved !== undefined ? req.body.resolved : true } },
    { new: true }
  ).populate('campaign', 'name');
  if (!fraud) return res.status(404).json({ message: 'Fraud event not found' });
  res.json(fraud);
});

router.delete('/fraud/:id', async (req, res) => {
  await FraudEvent.findByIdAndDelete(req.params.id);
  res.status(204).end();
});

export default router;
