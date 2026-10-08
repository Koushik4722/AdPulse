import mongoose from 'mongoose';
export default mongoose.model('FraudEvent', new mongoose.Schema({ campaign: { type: mongoose.Schema.Types.ObjectId, ref: 'Campaign' }, ip: String, reason: String, clicks: Number, severity: { type: String, default: 'medium' }, resolved: { type: Boolean, default: false } }, { timestamps: true }));
