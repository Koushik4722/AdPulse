import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';

// Load env from server/.env
dotenv.config({ path: path.resolve(process.cwd(), '.env') }); // Since we will run it from server directory

import User from './models/User.js';
import Campaign from './models/Campaign.js';
import PublisherSite from './models/PublisherSite.js';
import { bumpDailyStat } from './models/DailyStat.js';

async function simulate() {
  console.log('Connecting to database...');
  await mongoose.connect(process.env.MONGODB_URI);

  const advertiser = await User.findOne({ role: 'advertiser' });
  const publisher = await User.findOne({ role: 'publisher' });

  if (!advertiser || !publisher) {
    console.error('Demo users not found. Please run `npm run seed --prefix server` first.');
    process.exit(1);
  }

  console.log('Creating demo campaign...');
  let campaign = await Campaign.findOne({ name: 'Test Campaign for Metrics' });
  if (!campaign) {
    campaign = await Campaign.create({
      name: 'Test Campaign for Metrics',
      advertiser: advertiser._id,
      budget: 5000,
      bidAmount: 10,
      bidType: 'CPC',
      targetCountry: 'US',
      imageUrl: 'https://via.placeholder.com/728x90.png?text=AdPulse+Test+Ad',
      landingPageUrl: 'https://example.com',
      status: 'active',
      impressions: 0,
      clicks: 0,
      spent: 0,
    });
  }

  console.log('Creating demo publisher site...');
  let site = await PublisherSite.findOne({ url: 'https://test-publisher.com' });
  if (!site) {
    site = await PublisherSite.create({
      name: 'Tech Daily Hub',
      url: 'https://test-publisher.com',
      publisher: publisher._id,
      status: 'approved',
      impressions: 0,
      clicks: 0,
      earnings: 0,
    });
  }

  const isFraudMode = process.argv.includes('--fraud');

  if (isFraudMode) {
    console.log('Simulating automated Bot Attack / Click-Fraud on Campaign...');
    const FraudEvent = (await import('./models/FraudEvent.js')).default;
    const botIps = ['198.51.100.42', '203.0.113.19', '192.0.2.77'];
    for (const ip of botIps) {
      await FraudEvent.create({
        campaign: campaign._id,
        ip,
        reason: 'Rapid click velocity burst (12 automated clicks within 5 seconds)',
        clicks: 12,
        severity: 'critical',
        rule: 'velocity',
        resolved: false
      });
    }
    console.log('--------------------------------------------------');
    console.log('🛡️ Click-Fraud Simulation Complete!');
    console.log(`Generated 3 high-severity fraud events for Campaign "${campaign.name}".`);
    console.log('Advertiser spend was protected from bot exhaustion.');
    console.log('Open Admin Center -> Fraud Alerts tab to view them.');
    console.log('--------------------------------------------------');
    await mongoose.disconnect();
    return;
  }

  console.log(`Simulating traffic for Campaign (${campaign.name}) and Site (${site.url})...`);
  
  // Simulate 1000 impressions and 45 clicks
  const impressionsToAdd = 1000;
  const clicksToAdd = 45;

  campaign.impressions += impressionsToAdd;
  site.impressions += impressionsToAdd;

  // In CPC, only clicks cost money
  campaign.clicks += clicksToAdd;
  site.clicks += clicksToAdd;

  const cost = clicksToAdd * campaign.bidAmount;
  campaign.spent += cost;
  site.earnings += cost * 0.7; // 70% goes to publisher

  await campaign.save();
  await site.save();
  await bumpDailyStat({
    campaign,
    site,
    impressions: impressionsToAdd,
    clicks: clicksToAdd,
    spent: cost,
    earnings: cost * 0.7
  });

  console.log('--------------------------------------------------');
  console.log(`Traffic simulated successfully!`);
  console.log(`Added ${impressionsToAdd} impressions and ${clicksToAdd} clicks.`);
  console.log(`Campaign Spent: ₹${campaign.spent}`);
  console.log(`Publisher Earnings: ₹${site.earnings}`);
  console.log('--------------------------------------------------');
  console.log('Tip: Run `node src/simulate-traffic.js --fraud` to simulate bot attacks.');
  console.log('You can now log in to the dashboard to view these metrics.');
  
  await mongoose.disconnect();
}

simulate().catch(err => {
  console.error(err);
  process.exit(1);
});
