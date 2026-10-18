import mongoose from 'mongoose';

const dailyStatSchema = new mongoose.Schema({
  date: { type: String, required: true },
  campaign: { type: mongoose.Schema.Types.ObjectId, ref: 'Campaign' },
  advertiser: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  site: { type: mongoose.Schema.Types.ObjectId, ref: 'PublisherSite' },
  publisher: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  impressions: { type: Number, default: 0 },
  clicks: { type: Number, default: 0 },
  spent: { type: Number, default: 0 },
  earnings: { type: Number, default: 0 }
}, { timestamps: true });

dailyStatSchema.index({ date: 1, campaign: 1, site: 1 }, { unique: true });
dailyStatSchema.index({ date: 1, advertiser: 1 });
dailyStatSchema.index({ date: 1, publisher: 1 });

export const utcDateKey = (d = new Date()) => d.toISOString().slice(0, 10);

export async function bumpDailyStat({ campaign, site, impressions = 0, clicks = 0, spent = 0, earnings = 0 }) {
  await mongoose.model('DailyStat').findOneAndUpdate(
    { date: utcDateKey(), campaign: campaign._id, site: site._id },
    {
      $inc: { impressions, clicks, spent, earnings },
      $setOnInsert: { advertiser: campaign.advertiser, publisher: site.publisher }
    },
    { upsert: true }
  );
}

export default mongoose.model('DailyStat', dailyStatSchema);
