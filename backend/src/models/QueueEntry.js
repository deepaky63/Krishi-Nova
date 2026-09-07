import mongoose from 'mongoose';

const queueSchema = new mongoose.Schema({ bookingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', required: true, unique: true }, farmerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true }, centreId: { type: mongoose.Schema.Types.ObjectId, ref: 'Centre', required: true, index: true }, slotId: { type: mongoose.Schema.Types.ObjectId, ref: 'Slot', required: true, index: true }, queueDate: { type: Date, required: true, index: true }, queueNumber: { type: String, required: true }, status: { type: String, enum: ['waiting', 'checked_in', 'processing', 'served', 'skipped', 'cancelled', 'no_show'], default: 'waiting', index: true }, checkedInAt: Date, processingStartedAt: Date, servedAt: Date, skippedAt: Date, priorityOverride: { type: Boolean, default: false }, priorityReason: String, estimatedWaitMinutes: Number }, { timestamps: true });
queueSchema.index({ centreId: 1, queueDate: 1, queueNumber: 1 }, { unique: true });
queueSchema.index({ centreId: 1, queueDate: 1, status: 1, checkedInAt: 1 });
export const QueueEntry = mongoose.model('QueueEntry', queueSchema);
