import { Centre } from '../models/Centre.js';
import { Slot } from '../models/Slot.js';
import { Booking, capacityStatuses } from '../models/Booking.js';
import { Commodity } from '../models/Commodity.js';
import { notFound, badRequest } from '../utils/errors.js';

const minutes = (time) => { const match = String(time).match(/^(\d{1,2}):(\d{2})$/); if (!match) return NaN; return Number(match[1]) * 60 + Number(match[2]); };
const dateKey = (value) => new Date(value).toISOString().slice(0, 10);
const slotStart = (date, time) => new Date(`${dateKey(date)}T${time}:00+05:30`);
async function validateCentreWindow(input, centre) { const start = minutes(input.startTime); const end = minutes(input.endTime); if (!Number.isFinite(start) || !Number.isFinite(end) || start >= end) throw badRequest('startTime must be earlier than endTime'); if (new Date(input.date) < new Date(new Date().toISOString().slice(0, 10))) throw badRequest('Slot date cannot be in the past'); const day = new Date(input.date).getUTCDay(); const hours = centre.operatingHours?.find((item) => item.day === day); if (hours?.closed || (hours && (start < minutes(hours.open) || end > minutes(hours.close)))) throw badRequest('Slot must be within centre operating hours', 'OUTSIDE_OPERATING_HOURS'); const closure = centre.closures?.find((item) => dateKey(item.date) === dateKey(input.date) && (!item.startTime || start < minutes(item.endTime) && end > minutes(item.startTime))); if (closure) throw badRequest('Centre is closed during the selected slot', 'CENTRE_CLOSED'); }
export async function assertNoOverlap(input, excludeId, centre) { const existing = await Slot.find({ centreId: input.centreId, date: input.date, active: true, ...(excludeId ? { _id: { $ne: excludeId } } : {}) }); const start = minutes(input.startTime); const end = minutes(input.endTime); await validateCentreWindow(input, centre); if (existing.some((slot) => start < minutes(slot.endTime) && end > minutes(slot.startTime))) throw badRequest('Slot overlaps an existing active slot', 'SLOT_OVERLAP'); }
async function withAvailability(slots) { const ids = slots.map((slot) => slot._id); const counts = await Booking.aggregate([{ $match: { slotId: { $in: ids }, status: { $in: capacityStatuses } } }, { $group: { _id: '$slotId', count: { $sum: 1 }, quantity: { $sum: '$bookedQuantity' } } }]); const byId = new Map(counts.map((item) => [item._id.toString(), item])); return slots.map((slot) => { const count = byId.get(slot._id.toString()) || { count: 0, quantity: 0 }; return { ...slot.toObject(), currentBookings: count.count, remainingCapacity: Math.max(slot.maxFarmers - count.count, 0), bookedQuantity: count.quantity, remainingQuantity: slot.maxQuantity == null ? null : Math.max(slot.maxQuantity - count.quantity, 0) }; }); }
import { cleanCommodities } from './scheduleService.js';

export async function list(query) {
  const filter = { active: query.active === undefined ? true : query.active === 'true' };
  if (query.centreId) filter.centreId = query.centreId;
  if (query.scheduleId) filter.scheduleId = query.scheduleId;
  if (query.date) filter.date = new Date(query.date);
  else if (query.active === undefined) filter.date = { $gte: new Date(new Date().toISOString().slice(0, 10)) };

  if (query.commodityId) {
    filter.$or = [{ commodityIds: query.commodityId }];
  }
  if (query.commodity) {
    const regex = new RegExp(`^${query.commodity.trim()}$`, 'i');
    if (filter.$or) filter.$or.push({ supportedCommodities: regex });
    else filter.$or = [{ supportedCommodities: regex }];
  }

  const slots = await Slot.find(filter).populate('centreId commodityIds').sort({ date: 1, startTime: 1 });
  return withAvailability(slots);
}

export async function listAdmin(query) {
  const filter = {};
  if (query.centreId) filter.centreId = query.centreId;
  if (query.scheduleId) filter.scheduleId = query.scheduleId;
  if (query.active !== undefined) filter.active = query.active === 'true';

  const slots = await Slot.find(filter).populate('centreId commodityIds').sort({ date: 1, startTime: 1 });
  return withAvailability(slots);
}

export async function get(id) {
  const slot = await Slot.findById(id).populate('centreId commodityIds');
  if (!slot) throw notFound('Slot not found');
  return slot;
}

export async function create(input, actor) {
  const centre = await Centre.findOne({ _id: input.centreId, status: 'active' });
  if (!centre) throw badRequest('Centre is not active');

  if (input.supportedCommodities) {
    input.supportedCommodities = cleanCommodities(input.supportedCommodities);
  }
  const hasSupported = input.supportedCommodities && input.supportedCommodities.length > 0;
  const hasCommodityIds = input.commodityIds && input.commodityIds.length > 0;
  if (!hasSupported && !hasCommodityIds) {
    throw badRequest('At least one supported commodity is required');
  }

  if (hasCommodityIds) {
    const commodities = await Commodity.countDocuments({ _id: { $in: input.commodityIds }, active: true });
    if (commodities !== input.commodityIds.length) throw badRequest('One or more commodities are invalid');
  }

  await assertNoOverlap(input, undefined, centre);
  return Slot.create({ ...input, createdBy: actor._id, updatedBy: actor._id });
}

export async function update(id, input, actor) {
  const current = await Slot.findById(id);
  if (!current) throw notFound('Slot not found');
  const onlyDeactivation = input.active === false && Object.keys(input).every((key) => key === 'active');
  if (!onlyDeactivation) {
    const merged = { ...current.toObject(), ...input };
    const centre = await Centre.findOne({ _id: merged.centreId, status: 'active' });
    if (!centre) throw badRequest('Centre is not active');
    await assertNoOverlap(merged, id, centre);

    if (input.supportedCommodities !== undefined) {
      input.supportedCommodities = cleanCommodities(input.supportedCommodities);
    }
    if (input.commodityIds && input.commodityIds.length > 0) {
      const commodities = await Commodity.countDocuments({ _id: { $in: input.commodityIds }, active: true });
      if (commodities !== input.commodityIds.length) throw badRequest('One or more commodities are invalid');
    }
  }
  return Slot.findByIdAndUpdate(id, { ...input, updatedBy: actor._id }, { new: true, runValidators: true });
}

export { slotStart };

