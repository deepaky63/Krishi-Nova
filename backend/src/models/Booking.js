import mongoose from 'mongoose';

export const capacityStatuses = ['booked', 'checked_in', 'quality_check', 'weighed', 'accepted', 'partially_accepted'];
export const bookingStatuses = [...capacityStatuses, 'rejected', 'completed', 'cancelled', 'no_show'];
const bookingSchema = new mongoose.Schema({ bookingCode: { type: String, required: true, unique: true }, farmerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true }, centreId: { type: mongoose.Schema.Types.ObjectId, ref: 'Centre', required: true, index: true }, slotId: { type: mongoose.Schema.Types.ObjectId, ref: 'Slot', required: true, index: true }, commodityId: { type: mongoose.Schema.Types.ObjectId, ref: 'Commodity' }, commodityName: { type: String, trim: true }, bookedQuantity: { type: Number, required: true, min: 0.001 }, quantityUnit: { type: String, default: 'kg' }, status: { type: String, enum: bookingStatuses, default: 'booked', index: true }, bookingDate: { type: Date, required: true }, cancelledAt: Date, cancelledBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, cancellationReason: String, checkedInAt: Date }, { timestamps: true });
bookingSchema.index({ farmerId: 1, status: 1 });
bookingSchema.index({ centreId: 1, slotId: 1, status: 1 });
export const Booking = mongoose.model('Booking', bookingSchema);
