import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema({ userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true }, type: { type: String, required: true }, title: { type: String, required: true }, message: { type: String, required: true }, language: { type: String, enum: ['en', 'hi'], default: 'en' }, relatedEntityType: String, relatedEntityId: mongoose.Schema.Types.ObjectId, readAt: Date, expiresAt: { type: Date, index: { expires: 0 } } }, { timestamps: true });
notificationSchema.index({ userId: 1, createdAt: -1 });
export const Notification = mongoose.model('Notification', notificationSchema);
