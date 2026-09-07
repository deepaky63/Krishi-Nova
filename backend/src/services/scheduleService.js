import { Centre } from '../models/Centre.js';
import { Slot } from '../models/Slot.js';
import { Booking, capacityStatuses } from '../models/Booking.js';
import { ProcurementSchedule } from '../models/ProcurementSchedule.js';
import { badRequest, notFound } from '../utils/errors.js';

const minutes = (time) => {
  const match = String(time || '').match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return NaN;
  return Number(match[1]) * 60 + Number(match[2]);
};

const formatTime = (totalMinutes) => {
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
};

const dateKey = (value) => new Date(value).toISOString().slice(0, 10);

export const cleanCommodities = (list) => {
  if (!Array.isArray(list)) return [];
  const seen = new Set();
  const clean = [];
  for (const item of list) {
    const trimmed = String(item || '').trim();
    const lower = trimmed.toLowerCase();
    if (trimmed && !seen.has(lower)) {
      seen.add(lower);
      clean.push(trimmed);
    }
  }
  return clean;
};

// Generate time intervals for a day [openingTime, closingTime] with slotDurationMinutes
export const generateDailyTimeIntervals = (openingTime, closingTime, slotDurationMinutes) => {
  const startMins = minutes(openingTime);
  const endMins = minutes(closingTime);
  if (!Number.isFinite(startMins) || !Number.isFinite(endMins) || startMins >= endMins) {
    throw badRequest('openingTime must be earlier than closingTime');
  }
  if (!slotDurationMinutes || slotDurationMinutes <= 0) {
    throw badRequest('slotDurationMinutes must be greater than 0');
  }

  const intervals = [];
  let current = startMins;
  while (current + slotDurationMinutes <= endMins) {
    intervals.push({
      startTime: formatTime(current),
      endTime: formatTime(current + slotDurationMinutes),
    });
    current += slotDurationMinutes;
  }
  return intervals;
};

// Calculate preview before committing
export async function preview(input) {
  const centre = await Centre.findOne({ _id: input.centreId, status: 'active' });
  if (!centre) throw badRequest('Procurement centre is not active or does not exist');

  const fromDate = new Date(dateKey(input.effectiveFrom));
  const untilDate = new Date(dateKey(input.effectiveUntil));
  if (fromDate > untilDate) {
    throw badRequest('effectiveFrom date cannot be after effectiveUntil date');
  }

  const intervals = generateDailyTimeIntervals(input.openingTime, input.closingTime, input.slotDurationMinutes);
  if (intervals.length === 0) {
    throw badRequest('No slots can be created within the selected operating hours and slot duration');
  }

  const daysSet = new Set((input.daysOfWeek || []).map(Number));
  let workingDaysCount = 0;
  let closuresSkipped = 0;
  const current = new Date(fromDate);

  while (current <= untilDate) {
    const dayOfWeek = current.getUTCDay();
    if (daysSet.has(dayOfWeek)) {
      const isClosed = centre.closures?.some((item) => dateKey(item.date) === dateKey(current));
      if (isClosed) {
        closuresSkipped += 1;
      } else {
        workingDaysCount += 1;
      }
    }
    current.setUTCDate(current.getUTCDate() + 1);
  }

  const totalSlots = workingDaysCount * intervals.length;

  return {
    workingDaysCount,
    closuresSkipped,
    slotsPerDay: intervals.length,
    totalSlots,
    effectiveFrom: fromDate.toISOString().slice(0, 10),
    effectiveUntil: untilDate.toISOString().slice(0, 10),
    sampleSlots: intervals.slice(0, 5),
  };
}

// Create schedule and generate concrete Slot documents
export async function createAndGenerate(input, actor) {
  const centre = await Centre.findOne({ _id: input.centreId, status: 'active' });
  if (!centre) throw badRequest('Procurement centre is not active or does not exist');

  const fromDate = new Date(dateKey(input.effectiveFrom));
  const untilDate = new Date(dateKey(input.effectiveUntil));
  if (fromDate > untilDate) {
    throw badRequest('effectiveFrom date cannot be after effectiveUntil date');
  }

  const commodities = cleanCommodities(input.supportedCommodities);
  if (commodities.length === 0) {
    throw badRequest('At least one supported commodity is required');
  }

  const intervals = generateDailyTimeIntervals(input.openingTime, input.closingTime, input.slotDurationMinutes);
  if (intervals.length === 0) {
    throw badRequest('No slots can be created within the selected operating hours and slot duration');
  }

  const daysSet = new Set((input.daysOfWeek || []).map(Number));
  const slotsToCreate = [];
  const current = new Date(fromDate);

  // Find existing active slots in this centre and date range to prevent overlaps/duplicates
  const existingSlots = await Slot.find({
    centreId: input.centreId,
    date: { $gte: fromDate, $lte: untilDate },
    active: true,
  }).select('date startTime endTime');

  const existingMap = new Set(
    existingSlots.map((s) => `${dateKey(s.date)}_${s.startTime}_${s.endTime}`)
  );

  while (current <= untilDate) {
    const dayOfWeek = current.getUTCDay();
    if (daysSet.has(dayOfWeek)) {
      const isClosed = centre.closures?.some((item) => dateKey(item.date) === dateKey(current));
      if (!isClosed) {
        const slotDate = new Date(dateKey(current));
        for (const interval of intervals) {
          const key = `${dateKey(slotDate)}_${interval.startTime}_${interval.endTime}`;
          if (!existingMap.has(key)) {
            slotsToCreate.push({
              centreId: centre._id,
              date: slotDate,
              startTime: interval.startTime,
              endTime: interval.endTime,
              maxFarmers: Number(input.maxFarmersPerSlot),
              maxQuantity: input.maxQuantityPerSlot ? Number(input.maxQuantityPerSlot) : undefined,
              quantityUnit: input.quantityUnit || 'kg',
              bookingCutoffMinutes: Number(input.bookingCutoffMinutes) || 60,
              supportedCommodities: commodities,
              active: true,
              createdBy: actor._id,
              updatedBy: actor._id,
            });
          }
        }
      }
    }
    current.setUTCDate(current.getUTCDate() + 1);
  }

  // Create schedule document
  const schedule = await ProcurementSchedule.create({
    centreId: centre._id,
    name: input.name || `${centre.name} - ${commodities.join(', ')} Schedule`,
    supportedCommodities: commodities,
    effectiveFrom: fromDate,
    effectiveUntil: untilDate,
    daysOfWeek: Array.from(daysSet).sort(),
    openingTime: input.openingTime,
    closingTime: input.closingTime,
    slotDurationMinutes: Number(input.slotDurationMinutes) || 30,
    maxFarmersPerSlot: Number(input.maxFarmersPerSlot),
    maxQuantityPerSlot: input.maxQuantityPerSlot ? Number(input.maxQuantityPerSlot) : undefined,
    quantityUnit: input.quantityUnit || 'kg',
    bookingCutoffMinutes: Number(input.bookingCutoffMinutes) || 60,
    active: true,
    totalSlotsGenerated: slotsToCreate.length,
    createdBy: actor._id,
    updatedBy: actor._id,
  });

  // Attach scheduleId to each generated slot and bulk insert
  if (slotsToCreate.length > 0) {
    const withScheduleId = slotsToCreate.map((slot) => ({ ...slot, scheduleId: schedule._id }));
    await Slot.insertMany(withScheduleId, { ordered: false });
  }

  return {
    ...schedule.toObject(),
    schedule,
    generatedCount: slotsToCreate.length,
    message: `Schedule created and ${slotsToCreate.length} slots generated successfully.`,
  };
}

export async function list(query = {}) {
  const filter = {};
  if (query.centreId) filter.centreId = query.centreId;
  if (query.active !== undefined) filter.active = query.active === 'true';

  const schedules = await ProcurementSchedule.find(filter)
    .populate('centreId', 'name centreCode district address')
    .sort({ createdAt: -1 });

  return schedules;
}

export async function get(id) {
  const schedule = await ProcurementSchedule.findById(id).populate('centreId', 'name centreCode district address');
  if (!schedule) throw notFound('Procurement schedule not found');
  const activeSlotsCount = await Slot.countDocuments({ scheduleId: schedule._id, active: true });
  return { ...schedule.toObject(), activeSlotsCount };
}

export async function getSlots(scheduleId, query = {}) {
  const filter = { scheduleId };
  if (query.date) filter.date = new Date(query.date);
  if (query.active !== undefined) filter.active = query.active === 'true';

  const slots = await Slot.find(filter).populate('centreId', 'name centreCode district').sort({ date: 1, startTime: 1 });
  const ids = slots.map((s) => s._id);

  // Compute booking counts
  const counts = await Booking.aggregate([
    { $match: { slotId: { $in: ids }, status: { $in: capacityStatuses } } },
    { $group: { _id: '$slotId', count: { $sum: 1 }, quantity: { $sum: '$bookedQuantity' } } },
  ]);
  const byId = new Map(counts.map((item) => [item._id.toString(), item]));

  return slots.map((slot) => {
    const count = byId.get(slot._id.toString()) || { count: 0, quantity: 0 };
    return {
      ...slot.toObject(),
      currentBookings: count.count,
      remainingCapacity: Math.max(slot.maxFarmers - count.count, 0),
      bookedQuantity: count.quantity,
    };
  });
}

export async function setStatus(id, active, actor) {
  const schedule = await ProcurementSchedule.findById(id);
  if (!schedule) throw notFound('Procurement schedule not found');

  schedule.active = Boolean(active);
  schedule.updatedBy = actor._id;
  await schedule.save();

  // If deactivating, deactivate only future unbooked slots generated by this schedule
  if (!active) {
    const today = new Date(new Date().toISOString().slice(0, 10));
    // Find slots that have active bookings
    const bookedSlots = await Booking.distinct('slotId', {
      status: { $in: capacityStatuses },
      bookingDate: { $gte: today },
    });

    await Slot.updateMany(
      {
        scheduleId: schedule._id,
        date: { $gte: today },
        active: true,
        _id: { $nin: bookedSlots },
      },
      { $set: { active: false, updatedBy: actor._id } }
    );
  }

  return schedule;
}
