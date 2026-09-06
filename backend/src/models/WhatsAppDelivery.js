import mongoose from 'mongoose';

const schema = new mongoose.Schema({ userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true }, recipient: String, type: String, templateName: String, language: { type: String, enum: ['en', 'hi'], default: 'en' }, relatedEntityType: String, relatedEntityId: mongoose.Schema.Types.ObjectId, status: { type: String, enum: ['queued', 'sending', 'sent', 'delivered', 'failed'], default: 'queued', index: true }, providerMessageId: String, attemptCount: { type: Number, default: 0 }, lastAttemptAt: Date, failureReason: String, nextRetryAt: Date }, { timestamps: true });
export const WhatsAppDelivery = mongoose.model('WhatsAppDelivery', schema);
