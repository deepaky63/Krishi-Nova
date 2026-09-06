import mongoose from 'mongoose';
import { Booking, capacityStatuses } from '../../models/Booking.js';
import { Centre } from '../../models/Centre.js';
import { Commodity } from '../../models/Commodity.js';
import { Slot } from '../../models/Slot.js';
import { notFound, badRequest, forbidden } from '../../utils/errors.js';

const active = { status: { $in: capacityStatuses } };
const code = () => `KN-${new Date().getFullYear()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
export async function create(input, farmer) {
  const session = await mongoose.startSession();
  try { let result; await session.withTransaction(async () => {
    const [slot, centre, commodity] = await Promise.all([Slot.findOne({ _id: input.slotId, active: true }).session(session), Centre.findOne({ _id: input.centreId, status: 'active' }).session(session), Commodity.findOne({ _id: input.commodityId, active: true }).session(session)]);
    if (!slot || slot.centreId.toString() !== input.centreId || !slot.commodityIds.some((id) => id.toString() === input.commodityId)) throw badRequest('Selected slot is not available for this centre and commodity');
    if (!centre || !commodity) throw badRequest('Centre or commodity is not active');
    const duplicate = await Booking.findOne({ farmerId: farmer._id, ...active }).session(session); if (duplicate) throw badRequest('Farmer already has an active booking', 'ACTIVE_BOOKING_EXISTS');
    const count = await Booking.countDocuments({ slotId: slot._id, ...active }).session(session); if (count >= slot.maxFarmers) throw badRequest('Slot farmer capacity is full', 'SLOT_FULL');
    if (slot.maxQuantity !== undefined) { const total = await Booking.aggregate([{ $match: { slotId: slot._id, ...active } }, { $group: { _id: null, total: { $sum: '$bookedQuantity' } } }]).session(session); if ((total[0]?.total || 0) + input.bookedQuantity > slot.maxQuantity) throw badRequest('Slot quantity capacity is full', 'SLOT_QUANTITY_FULL'); }
    const bookingDate = new Date(slot.date); const created = await Booking.create([{ ...input, farmerId: farmer._id, bookingCode: code(), bookingDate, quantityUnit: input.quantityUnit || 'kg' }], { session }); result = created[0];
  }); return result;
  } finally { await session.endSession(); }
}
export const mine = (farmerId) => Booking.find({ farmerId }).populate('centreId slotId commodityId').sort({ createdAt: -1 });
export async function get(id, user) { const item = await Booking.findById(id).populate('centreId slotId commodityId farmerId'); if (!item) throw notFound('Booking not found'); if (user.role === 'farmer' && item.farmerId._id.toString() !== user._id.toString()) throw forbidden(); if (user.role === 'staff' && !user.assignedCentreIds.some((centreId) => centreId.toString() === item.centreId._id.toString())) throw forbidden(); return item; }
export async function cancel(id, user, reason) { const item = await get(id, user); if (user.role === 'farmer' && new Date() >= new Date(item.bookingDate.getTime() - 60 * 60 * 1000)) throw badRequest('Booking cancellation cutoff has passed', 'CANCELLATION_CUTOFF'); if (!capacityStatuses.includes(item.status)) throw badRequest('Booking cannot be cancelled in its current status'); item.status = 'cancelled'; item.cancelledAt = new Date(); item.cancelledBy = user._id; item.cancellationReason = reason; await item.save(); return item; }
