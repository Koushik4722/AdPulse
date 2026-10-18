import mongoose from 'mongoose';
const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true }, email: { type: String, required: true, unique: true, lowercase: true },
  password: { type: String, required: true, minlength: 8 }, role: { type: String, enum: ['admin', 'advertiser', 'publisher'], default: 'advertiser' },
  company: String, approved: { type: Boolean, default: false }, isBlocked: { type: Boolean, default: false }, avatar: String,
  emailVerified: { type: Boolean, default: false },
  emailVerificationTokenHash: { type: String, select: false }, emailVerificationExpires: { type: Date, select: false },
  passwordResetTokenHash: { type: String, select: false }, passwordResetExpires: { type: Date, select: false }
}, { timestamps: true });
export default mongoose.model('User', userSchema);
