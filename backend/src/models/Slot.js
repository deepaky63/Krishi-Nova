import mongoose from 'mongoose';

const slotSchema = new mongoose.Schema({ centreId: { type: mongoose.Schema.Types.ObjectId, ref: 'Centre', required: true, index: true }, commodityIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Commodity' }], date: { type: Date, required: true, index: true }, startTime: { type: String, required: true }, endTime: { type: String, required: true }, timezone: { type: String, default: 'Asia/Kolkata' }, maxFarmers: { type: Number, required: true, min: 1 }, maxQuantity: { type: Number, min: 0 }, quantityUnit: { type: String, default: 'kg' }, bookingCutoffMinutes: { type: Number, default: 60, min: 0 }, active: { type: Boolean, default: true, index: true }, createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' } }, { timestamps: true });
slotSchema.index({ centreId: 1, date: 1, startTime: 1 });
export const Slot = mongoose.model('Slot', slotSchema);
