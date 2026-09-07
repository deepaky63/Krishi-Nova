import { Procurement } from '../models/Procurement.js';
import { Booking } from '../models/Booking.js';
import { Settlement } from '../models/Settlement.js';
import { QueueEntry } from '../models/QueueEntry.js';
import { forbidden, notFound, badRequest } from '../utils/errors.js';

async function getBooking(id, actor) {
  const booking = await Booking.findById(id);
  if (!booking) throw notFound('Booking not found');
  if (actor.role === 'farmer' && booking.farmerId.toString() !== actor._id.toString()) throw forbidden();
  if (actor.role === 'staff' && !actor.assignedCentreIds.some((centreId) => (centreId._id || centreId).toString() === booking.centreId.toString())) {
    throw forbidden('You are not assigned to this centre');
  }
  return booking;
}

export async function getByBooking(id, actor) {
  await getBooking(id, actor);
  return Procurement.findOne({ bookingId: id });
}

export async function verify(id, input, actor) {
  const booking = await getBooking(id, actor);
  const isVerified = Boolean(input.verified);
  const now = new Date();

  const record = await Procurement.findOneAndUpdate(
    { bookingId: id },
    {
      bookingId: id,
      farmerId: booking.farmerId,
      centreId: booking.centreId,
      commodityId: booking.commodityId,
      commodityName: booking.commodityName,
      verificationStatus: isVerified ? 'verified' : 'failed',
      verifiedBy: actor._id,
      verifiedAt: now,
      status: isVerified ? 'quality_check' : 'rejected'
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  booking.status = isVerified ? 'quality_check' : 'rejected';
  if (!isVerified) {
    booking.cancellationReason = input.rejectionReason || 'Verification failed';
    booking.cancelledAt = now;
    booking.cancelledBy = actor._id;
    await QueueEntry.findOneAndUpdate({ bookingId: id }, { status: 'cancelled', priorityReason: booking.cancellationReason });
  }
  await booking.save();
  return record;
}

export async function quality(id, input, actor) {
  const booking = await getBooking(id, actor);
  if (!input.qualityStatus) throw badRequest('qualityStatus is required');
  const now = new Date();

  if (input.qualityStatus === 'rejected') {
    if (!input.rejectionReason?.trim()) {
      throw badRequest('Rejection reason is required when rejecting crop quality');
    }
    const reason = input.rejectionReason.trim();

    const record = await Procurement.findOneAndUpdate(
      { bookingId: id },
      {
        bookingId: id,
        farmerId: booking.farmerId,
        centreId: booking.centreId,
        commodityId: booking.commodityId,
        commodityName: booking.commodityName,
        qualityStatus: 'rejected',
        qualityGrade: input.qualityGrade,
        qualityRemarks: input.qualityRemarks,
        rejectionReason: reason,
        qualityCheckedBy: actor._id,
        qualityCheckedAt: now,
        status: 'rejected'
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    booking.status = 'rejected';
    booking.cancellationReason = reason;
    booking.cancelledAt = now;
    booking.cancelledBy = actor._id;
    await booking.save();

    await QueueEntry.findOneAndUpdate({ bookingId: id }, { status: 'cancelled', priorityReason: reason });
    return record;
  }

  const record = await Procurement.findOneAndUpdate(
    { bookingId: id },
    {
      bookingId: id,
      farmerId: booking.farmerId,
      centreId: booking.centreId,
      commodityId: booking.commodityId,
      commodityName: booking.commodityName,
      qualityStatus: input.qualityStatus,
      qualityGrade: input.qualityGrade || 'Grade A',
      qualityRemarks: input.qualityRemarks,
      qualityCheckedBy: actor._id,
      qualityCheckedAt: now,
      status: 'weighed'
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  booking.status = 'weighed';
  await booking.save();
  return record;
}

export async function weighing(id, input, actor) {
  const booking = await getBooking(id, actor);
  const now = new Date();
  const actualWeighed = Number(input.actualWeighedQuantity);
  const accepted = Number(input.acceptedQuantity);
  const rejected = Number(input.rejectedQuantity || 0);

  if (isNaN(actualWeighed) || isNaN(accepted) || isNaN(rejected)) {
    throw badRequest('Valid numeric quantities are required');
  }

  if (Math.abs(accepted + rejected - actualWeighed) > 0.001) {
    throw badRequest('Accepted and rejected quantities must equal actual weighed quantity');
  }

  if (accepted === 0) {
    if (!input.rejectionReason?.trim()) {
      throw badRequest('Rejection reason is required when accepted quantity is zero');
    }
    const reason = input.rejectionReason.trim();

    const record = await Procurement.findOneAndUpdate(
      { bookingId: id },
      {
        actualWeighedQuantity: actualWeighed,
        acceptedQuantity: 0,
        rejectedQuantity: rejected,
        quantityUnit: input.quantityUnit || booking.quantityUnit || 'kg',
        rejectionReason: reason,
        qualityRemarks: input.qualityRemarks,
        weighedBy: actor._id,
        weighedAt: now,
        status: 'rejected'
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    booking.status = 'rejected';
    booking.cancellationReason = reason;
    booking.cancelledAt = now;
    booking.cancelledBy = actor._id;
    await booking.save();

    await QueueEntry.findOneAndUpdate({ bookingId: id }, { status: 'cancelled', priorityReason: reason });
    return record;
  }

  const record = await Procurement.findOneAndUpdate(
    { bookingId: id },
    {
      actualWeighedQuantity: actualWeighed,
      acceptedQuantity: accepted,
      rejectedQuantity: rejected,
      quantityUnit: input.quantityUnit || booking.quantityUnit || 'kg',
      rejectionReason: input.rejectionReason,
      qualityRemarks: input.qualityRemarks,
      weighedBy: actor._id,
      weighedAt: now,
      status: rejected > 0 ? 'partially_accepted' : 'accepted'
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  booking.status = record.status;
  await booking.save();
  return record;
}

export async function reject(id, input, actor) {
  const booking = await getBooking(id, actor);
  if (!input.rejectionReason || !input.rejectionReason.trim()) {
    throw badRequest('Rejection reason is required');
  }
  const reason = input.rejectionReason.trim();
  const remarks = input.qualityRemarks ? input.qualityRemarks.trim() : '';
  const now = new Date();

  const record = await Procurement.findOneAndUpdate(
    { bookingId: id },
    {
      bookingId: id,
      farmerId: booking.farmerId,
      centreId: booking.centreId,
      commodityId: booking.commodityId,
      commodityName: booking.commodityName,
      qualityStatus: 'rejected',
      qualityRemarks: remarks,
      rejectionReason: reason,
      qualityCheckedBy: actor._id,
      qualityCheckedAt: now,
      status: 'rejected'
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  booking.status = 'rejected';
  booking.cancellationReason = reason;
  booking.cancelledAt = now;
  booking.cancelledBy = actor._id;
  await booking.save();

  // Remove from active queue by setting status to cancelled
  await QueueEntry.findOneAndUpdate(
    { bookingId: id },
    { status: 'cancelled', priorityReason: reason }
  );

  // If any settlement was created, mark it cancelled
  await Settlement.findOneAndUpdate(
    { bookingId: booking._id },
    { paymentStatus: 'cancelled', paymentRemarks: `Procurement rejected: ${reason}`, updatedBy: actor._id }
  );

  return record;
}

export async function complete(id, input = {}, actor) {
  const booking = await getBooking(id, actor);
  if (['cancelled', 'rejected'].includes(booking.status)) {
    throw badRequest(`Cannot complete a ${booking.status} booking`);
  }

  let record = await Procurement.findOne({ bookingId: id });
  const now = new Date();

  const actualWeighedQuantity = input.actualWeighedQuantity != null ? Number(input.actualWeighedQuantity) : (record?.actualWeighedQuantity || booking.bookedQuantity);
  const acceptedQuantity = input.acceptedQuantity != null ? Number(input.acceptedQuantity) : (record?.acceptedQuantity || booking.bookedQuantity);
  const rejectedQuantity = input.rejectedQuantity != null ? Number(input.rejectedQuantity) : (record?.rejectedQuantity || 0);

  if (acceptedQuantity <= 0) {
    throw badRequest('Accepted quantity must be greater than zero to complete procurement');
  }

  const qualityGrade = input.qualityGrade || record?.qualityGrade || 'Grade A';
  const qualityRemarks = input.qualityRemarks || record?.qualityRemarks || 'Verified and accepted';

  record = await Procurement.findOneAndUpdate(
    { bookingId: id },
    {
      bookingId: id,
      farmerId: booking.farmerId,
      centreId: booking.centreId,
      commodityId: booking.commodityId,
      commodityName: booking.commodityName,
      verificationStatus: 'verified',
      verifiedBy: record?.verifiedBy || actor._id,
      verifiedAt: record?.verifiedAt || now,
      qualityStatus: rejectedQuantity > 0 ? 'partially_accepted' : 'passed',
      qualityGrade,
      qualityRemarks,
      actualWeighedQuantity,
      acceptedQuantity,
      rejectedQuantity,
      quantityUnit: booking.quantityUnit || 'kg',
      weighedBy: record?.weighedBy || actor._id,
      weighedAt: record?.weighedAt || now,
      completedBy: actor._id,
      completedAt: now,
      status: 'completed'
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  booking.status = 'completed';
  await booking.save();

  // Atomically mark queue entry as served -> removed from active queue
  await QueueEntry.findOneAndUpdate(
    { bookingId: id },
    { status: 'served', servedAt: now }
  );

  // Automatically create / update Settlement using existing architecture
  const defaultMspRate = 22.75; // Standard agricultural benchmark rate (₹22.75 / kg)
  const payableAmount = Math.round(acceptedQuantity * defaultMspRate * 100) / 100;
  const paymentReference = `PAY-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

  await Settlement.findOneAndUpdate(
    { bookingId: booking._id },
    {
      bookingId: booking._id,
      procurementId: record._id,
      farmerId: booking.farmerId,
      centreId: booking.centreId,
      payableAmount,
      paymentStatus: 'initiated',
      paymentReference,
      paidAt: now,
      paymentRemarks: `Automated direct settlement for ${acceptedQuantity} ${booking.quantityUnit || 'kg'} at ₹${defaultMspRate}/kg`,
      createdBy: actor._id,
      updatedBy: actor._id
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  return record;
}

export async function createSettlement(input, actor) {
  const booking = await getBooking(input.bookingId, actor);
  return Settlement.findOneAndUpdate(
    { bookingId: booking._id },
    { ...input, farmerId: booking.farmerId, centreId: booking.centreId, createdBy: actor._id, updatedBy: actor._id },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
}

export const getSettlement = (id, actor) => getBooking(id, actor).then(() => Settlement.findOne({ bookingId: id }));
