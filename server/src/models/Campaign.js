import mongoose from 'mongoose';
const campaignSchema = new mongoose.Schema({
  advertiser: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, name: { type: String, required: true }, description: String,
  budget: { type: Number, required: true, min: 1 }, spent: { type: Number, default: 0 }, bidType: { type: String, enum: ['CPC', 'CPM'], default: 'CPC' }, bidAmount: { type: Number, default: 0 },
  startDate: Date, endDate: Date, targetCountry: String, targetAge: { min: Number, max: Number }, keywords: [String], adType: { type: String, enum: ['banner', 'native', 'video'], default: 'banner' },
  imageUrl: String, landingPageUrl: String, status: { type: String, enum: ['draft', 'pending', 'active', 'paused', 'rejected', 'completed', 'blocked'], default: 'pending' },
  impressions: { type: Number, default: 0 }, clicks: { type: Number, default: 0 }, conversions: { type: Number, default: 0 }, rejectionReason: String
}, { timestamps: true });
campaignSchema.virtual('ctr').get(function () { return this.impressions ? Number(((this.clicks / this.impressions) * 100).toFixed(2)) : 0; });
campaignSchema.set('toJSON', { virtuals: true });
export default mongoose.model('Campaign', campaignSchema);
