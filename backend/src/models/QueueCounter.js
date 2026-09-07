import mongoose from 'mongoose';

const schema = new mongoose.Schema({
  centreId: { type: mongoose.Schema.Types.ObjectId, ref: 'Centre', required: true },
  queueDate: { type: Date, required: true },
  sequence: { type: Number, default: 0 }
});
schema.index({ centreId: 1, queueDate: 1 }, { unique: true });
export const QueueCounter = mongoose.model('QueueCounter', schema);
