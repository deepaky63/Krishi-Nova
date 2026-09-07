import { QueueCounter } from '../../models/QueueCounter.js';
import { QueueEntry } from '../../models/QueueEntry.js';
import { Booking } from '../../models/Booking.js';
import { badRequest, forbidden, notFound } from '../../utils/errors.js';

export async function checkIn(bookingId, actor) {
  const booking = await Booking.findById(bookingId);
  if (!booking) throw notFound('Booking not found');
  if (actor.role === 'staff' && !actor.assignedCentreIds.some((id) => (id._id || id).toString() === booking.centreId.toString())) {
    throw forbidden('You are not assigned to this centre');
  }
  if (booking.status !== 'booked') throw badRequest('Booking is not ready for check-in');
  const now = new Date();
  const counter = await QueueCounter.findOneAndUpdate(
    { centreId: booking.centreId, slotId: booking.slotId, queueDate: booking.bookingDate },
    { $inc: { nextNumber: 1 } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  const queueNumber = `Q${String(counter.nextNumber - 1).padStart(3, '0')}`;
  const entry = await QueueEntry.create({
    bookingId,
    farmerId: booking.farmerId,
    centreId: booking.centreId,
    slotId: booking.slotId,
    queueDate: booking.bookingDate,
    queueNumber,
    status: 'checked_in',
    checkedInAt: now
  });
  booking.status = 'checked_in';
  booking.checkedInAt = now;
  await booking.save();
  return entry;
}

export async function list(filter, user) {
  const queryFilter = { ...filter };
  if (user.role === 'staff') {
    const staffCentres = (user.assignedCentreIds || []).map((id) => (id._id || id).toString());
    if (queryFilter.centreId) {
      const qId = (queryFilter.centreId._id || queryFilter.centreId).toString();
      if (!staffCentres.includes(qId)) throw forbidden('You are not assigned to this centre');
      queryFilter.centreId = qId;
    } else {
      queryFilter.centreId = { $in: user.assignedCentreIds };
    }
  } else if (queryFilter.centreId) {
    queryFilter.centreId = queryFilter.centreId._id || queryFilter.centreId;
  }
  return QueueEntry.find(queryFilter).populate('bookingId farmerId slotId').sort({ priorityOverride: -1, checkedInAt: 1 });
}

export async function forBooking(bookingId, user) {
  const booking = await Booking.findById(bookingId);
  if (!booking) throw notFound('Booking not found');
  if (user.role === 'farmer' && booking.farmerId.toString() !== user._id.toString()) throw forbidden();
  return QueueEntry.find({ bookingId }).populate('bookingId farmerId slotId').sort({ checkedInAt: 1 });
}

export async function updateStatus(id, status, actor) {
  const entry = await QueueEntry.findById(id).populate('bookingId');
  if (!entry) throw notFound('Queue entry not found');
  if (actor.role === 'staff' && !actor.assignedCentreIds.some((centreId) => (centreId._id || centreId).toString() === entry.centreId.toString())) {
    throw forbidden('You are not assigned to this centre');
  }
  entry.status = status;
  if (status === 'processing') entry.processingStartedAt = new Date();
  if (status === 'served') {
    entry.servedAt = new Date();
    if (entry.bookingId) {
      entry.bookingId.status = 'completed';
      await entry.bookingId.save();
    }
  }
  await entry.save();
  return entry;
}

export async function skip(id, actor, reason) {
  const entry = await updateStatus(id, 'skipped', actor);
  entry.skippedAt = new Date();
  entry.priorityReason = reason;
  await entry.save();
  return entry;
}
