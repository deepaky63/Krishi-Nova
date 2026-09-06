import mongoose from 'mongoose';

const schema = new mongoose.Schema({ centreId: { type: mongoose.Schema.Types.ObjectId, ref: 'Centre', required: true }, slotId: { type: mongoose.Schema.Types.ObjectId, ref: 'Slot', required: true }, queueDate: { type: Date, required: true }, nextNumber: { type: Number, default: 1 } });
schema.index({ centreId: 1, slotId: 1, queueDate: 1 }, { unique: true });
export const QueueCounter = mongoose.model('QueueCounter', schema);
