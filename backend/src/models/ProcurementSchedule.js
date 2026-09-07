import mongoose from 'mongoose';

const procurementScheduleSchema = new mongoose.Schema({
  centreId: { type: mongoose.Schema.Types.ObjectId, ref: 'Centre', required: true, index: true },
  name: { type: String, trim: true },
  supportedCommodities: [{ type: String, trim: true, required: true }],
  effectiveFrom: { type: Date, required: true },
  effectiveUntil: { type: Date, required: true },
  daysOfWeek: [{ type: Number, min: 0, max: 6, required: true }],
  openingTime: { type: String, required: true },
  closingTime: { type: String, required: true },
  slotDurationMinutes: { type: Number, required: true, min: 5, max: 480, default: 30 },
  maxFarmersPerSlot: { type: Number, required: true, min: 1 },
  maxQuantityPerSlot: { type: Number, min: 0 },
  quantityUnit: { type: String, default: 'kg' },
  bookingCutoffMinutes: { type: Number, default: 60, min: 0 },
  active: { type: Boolean, default: true, index: true },
  totalSlotsGenerated: { type: Number, default: 0 },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

procurementScheduleSchema.index({ centreId: 1, effectiveFrom: 1, effectiveUntil: 1, active: 1 });

export const ProcurementSchedule = mongoose.model('ProcurementSchedule', procurementScheduleSchema);
