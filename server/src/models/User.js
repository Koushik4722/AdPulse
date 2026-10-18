import mongoose from 'mongoose';
const userSchema = new mongoose.Schema({
  clerkId: { type: String, required: true, unique: true, index: true },
  name: { type: String, required: true, trim: true }, email: { type: String, required: true, unique: true, lowercase: true },
  role: { type: String, enum: ['admin', 'advertiser', 'publisher'], default: 'advertiser' },
  company: String, approved: { type: Boolean, default: false }, isBlocked: { type: Boolean, default: false }, avatar: String,
  emailVerified: { type: Boolean, default: true }
}, { timestamps: true });
export default mongoose.model('User', userSchema);
