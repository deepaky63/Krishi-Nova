import mongoose from 'mongoose';

const refreshSessionSchema = new mongoose.Schema({ userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true }, tokenHash: { type: String, required: true, unique: true }, expiresAt: { type: Date, required: true, index: { expires: 0 } }, revokedAt: Date, userAgent: String, ipAddress: String }, { timestamps: true });
export const RefreshSession = mongoose.model('RefreshSession', refreshSessionSchema);
