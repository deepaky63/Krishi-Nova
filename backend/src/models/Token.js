import mongoose from 'mongoose';

const tokenSchema = new mongoose.Schema({ userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true }, tokenHash: { type: String, required: true, unique: true }, type: { type: String, enum: ['email_verification', 'password_reset'], required: true }, expiresAt: { type: Date, required: true, index: { expires: 0 } }, usedAt: Date }, { timestamps: true });
export const Token = mongoose.model('Token', tokenSchema);
