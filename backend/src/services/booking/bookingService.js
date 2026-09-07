import mongoose from 'mongoose';
import { Booking, capacityStatuses } from '../../models/Booking.js';
import { Centre } from '../../models/Centre.js';
import { Commodity } from '../../models/Commodity.js';
import { Slot } from '../../models/Slot.js';
import { slotStart } from '../slotService.js';
import { notFound, badRequest, forbidden } from '../../utils/errors.js';

const active = { status: { $in: capacityStatuses } };
const code = () => `KN-${new Date().getFullYear()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
export async function create(input, farmer) {
  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async () => {
      const [slot, centre] = await Promise.all([
        Slot.findOne({ _id: input.slotId, active: true }).session(session),
        Centre.findOne({ _id: input.centreId, status: 'active' }).session(session),
      ]);
      if (!slot || slot.centreId.toString() !== input.centreId) {
        throw badRequest('Selected slot is not available for this centre and commodity');
      }
      if (!centre) throw badRequest('Centre is not active');

      let resolvedCommodityId = input.commodityId || undefined;
      let resolvedCommodityName = input.commodityName ? String(input.commodityName).trim() : '';
      let isSupported = false;

      if (resolvedCommodityId) {
        const commodity = await Commodity.findOne({ _id: resolvedCommodityId, active: true }).session(session);
        if (!commodity) throw badRequest('Commodity is not active');
        if (!resolvedCommodityName) resolvedCommodityName = commodity.name;
        if (slot.commodityIds?.some((id) => id.toString() === resolvedCommodityId.toString())) {
          isSupported = true;
        }
        if (!isSupported && slot.supportedCommodities?.some((name) => name.toLowerCase() === commodity.name.toLowerCase())) {
          isSupported = true;
        }
      } else if (resolvedCommodityName) {
        const targetLower = resolvedCommodityName.toLowerCase();
        if (slot.supportedCommodities?.some((name) => name.toLowerCase() === targetLower)) {
          isSupported = true;
        }
        if (!isSupported && slot.commodityIds?.length) {
          const registered = await Commodity.find({ _id: { $in: slot.commodityIds }, active: true }).session(session);
          const found = registered.find((c) => c.name.toLowerCase() === targetLower);
          if (found) {
            isSupported = true;
            resolvedCommodityId = found._id;
          }
        }
      }

      if (!isSupported) {
        throw badRequest('Selected slot is not available for this centre and commodity');
      }

      if (new Date() >= new Date(slotStart(slot.date, slot.startTime).getTime() - slot.bookingCutoffMinutes * 60 * 1000)) {
        throw badRequest('Booking cutoff has passed', 'BOOKING_CUTOFF');
      }
      const duplicate = await Booking.findOne({ farmerId: farmer._id, ...active }).session(session);
      if (duplicate) throw badRequest('Farmer already has an active booking', 'ACTIVE_BOOKING_EXISTS');
      const count = await Booking.countDocuments({ slotId: slot._id, ...active }).session(session);
      if (count >= slot.maxFarmers) throw badRequest('Slot farmer capacity is full', 'SLOT_FULL');
      if (slot.maxQuantity !== undefined) {
        const total = await Booking.aggregate([{ $match: { slotId: slot._id, ...active } }, { $group: { _id: null, total: { $sum: '$bookedQuantity' } } }]).session(session);
        if ((total[0]?.total || 0) + input.bookedQuantity > slot.maxQuantity) throw badRequest('Slot quantity capacity is full', 'SLOT_QUANTITY_FULL');
      }
      const bookingDate = new Date(slot.date);
      const bookingPayload = {
        ...input,
        commodityId: resolvedCommodityId,
        commodityName: resolvedCommodityName,
        farmerId: farmer._id,
        bookingCode: code(),
        bookingDate,
        quantityUnit: input.quantityUnit || 'kg',
      };
      const created = await Booking.create([bookingPayload], { session });
      result = created[0];
    });
    return result;
  } finally {
    await session.endSession();
  }
}

export const mine = (farmerId) => Booking.find({ farmerId }).populate('centreId slotId commodityId').sort({ createdAt: -1 });
export async function get(id, user) { const item = await Booking.findById(id).populate('centreId slotId commodityId farmerId'); if (!item) throw notFound('Booking not found'); if (user.role === 'farmer' && item.farmerId._id.toString() !== user._id.toString()) throw forbidden(); if (user.role === 'staff' && !user.assignedCentreIds.some((centreId) => centreId.toString() === item.centreId._id.toString())) throw forbidden(); return item; }
export async function cancel(id, user, reason) { const item = await get(id, user); if (user.role === 'farmer' && new Date() >= new Date(item.bookingDate.getTime() - 60 * 60 * 1000)) throw badRequest('Booking cancellation cutoff has passed', 'CANCELLATION_CUTOFF'); if (!capacityStatuses.includes(item.status)) throw badRequest('Booking cannot be cancelled in its current status'); item.status = 'cancelled'; item.cancelledAt = new Date(); item.cancelledBy = user._id; item.cancellationReason = reason; await item.save(); return item; }
