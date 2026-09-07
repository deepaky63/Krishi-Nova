import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema({
  role: { type: String, enum: ['farmer', 'staff', 'admin'], default: 'farmer', index: true },
  name: { type: String, required: true, trim: true, maxlength: 120 },
  loginId: { type: String, trim: true, uppercase: true },
  email: { type: String, trim: true, lowercase: true },
  mobile: { type: String, trim: true },
  passwordHash: { type: String, required: true, select: false },
  status: { type: String, enum: ['active', 'pending_verification', 'suspended', 'deleted'], default: 'active', index: true },
  emailVerifiedAt: Date,
  mobileVerifiedAt: Date,
  state: { type: String, trim: true },
  district: { type: String, trim: true },
  village: { type: String, trim: true },
  preferredLanguage: { type: String, enum: ['en', 'hi'], default: 'en' },
  assignedCentreIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Centre' }],
  refreshTokenVersion: { type: Number, default: 0 },
  lastLoginAt: Date,
  deletedAt: Date,
}, { timestamps: true });

const liveStatuses = ['active', 'pending_verification', 'suspended'];
userSchema.index({ email: 1 }, { unique: true, partialFilterExpression: { email: { $type: 'string' }, status: { $in: liveStatuses } } });
userSchema.index({ mobile: 1 }, { unique: true, partialFilterExpression: { mobile: { $type: 'string' }, status: { $in: liveStatuses } } });
userSchema.index({ loginId: 1 }, { unique: true, partialFilterExpression: { loginId: { $type: 'string' }, status: { $in: liveStatuses } } });
userSchema.methods.comparePassword = function comparePassword(password) { return bcrypt.compare(password, this.passwordHash); };
userSchema.statics.hashPassword = (password) => bcrypt.hash(password, 12);

export const User = mongoose.model('User', userSchema);
