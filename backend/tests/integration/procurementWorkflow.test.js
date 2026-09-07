import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import app from '../../src/app.js';
import { connectDatabase, disconnectDatabase } from '../../src/config/db.js';
import { User } from '../../src/models/User.js';
import { Centre } from '../../src/models/Centre.js';
import { Slot } from '../../src/models/Slot.js';
import { Booking } from '../../src/models/Booking.js';
import { QueueEntry } from '../../src/models/QueueEntry.js';
import { Procurement } from '../../src/models/Procurement.js';
import { Settlement } from '../../src/models/Settlement.js';
import { signAccessToken } from '../../src/utils/tokens.js';

test('Procurement Workflow Integration Test Suite', async (t) => {
  const ts = Date.now();
  const testPassword = 'Password123!';

  let adminUser;
  let centre;
  let staff;
  let staffToken;
  let farmerA;
  let farmerAToken;
  let farmerB;
  let farmerBToken;
  let farmerC;
  let farmerCToken;
  let farmerD;
  let farmerDToken;
  let slot;
  let tomorrowDate;

  const createdUserIds = [];
  const createdCentreIds = [];

  t.before(async () => {
    await connectDatabase();

    const hashedPassword = await User.hashPassword(testPassword);
    adminUser = await User.create({
      name: `Admin ProcTest ${ts}`,
      email: `admin_proc_${ts}@example.com`,
      passwordHash: hashedPassword,
      role: 'admin',
      status: 'active'
    });
    createdUserIds.push(adminUser._id);

    centre = await Centre.create({
      name: `Procurement Centre ${ts}`,
      code: `PC-${String(ts).slice(-4)}`,
      centreCode: `PC-${String(ts).slice(-4)}`,
      state: 'Haryana',
      district: 'Karnal',
      address: 'Grain Market Yard, Karnal',
      status: 'active',
      createdBy: adminUser._id
    });
    createdCentreIds.push(centre._id);

    staff = await User.create({
      name: `Staff Member ${ts}`,
      email: `staff_proc_${ts}@example.com`,
      passwordHash: hashedPassword,
      role: 'staff',
      status: 'active',
      assignedCentreIds: [centre._id]
    });
    createdUserIds.push(staff._id);
    staffToken = signAccessToken(staff);

    farmerA = await User.create({
      name: `Farmer Pooja ${ts}`,
      email: `pooja_${ts}@example.com`,
      mobile: `98${String(ts).slice(-8)}`,
      passwordHash: hashedPassword,
      role: 'farmer',
      status: 'active'
    });
    createdUserIds.push(farmerA._id);
    farmerAToken = signAccessToken(farmerA);

    farmerB = await User.create({
      name: `Farmer Mohan ${ts}`,
      email: `mohan_${ts}@example.com`,
      mobile: `97${String(ts).slice(-8)}`,
      passwordHash: hashedPassword,
      role: 'farmer',
      status: 'active'
    });
    createdUserIds.push(farmerB._id);
    farmerBToken = signAccessToken(farmerB);

    farmerC = await User.create({
      name: `Farmer Anil ${ts}`,
      email: `anil_${ts}@example.com`,
      mobile: `96${String(ts).slice(-8)}`,
      passwordHash: hashedPassword,
      role: 'farmer',
      status: 'active'
    });
    createdUserIds.push(farmerC._id);
    farmerCToken = signAccessToken(farmerC);

    farmerD = await User.create({
      name: `Farmer Sunil ${ts}`,
      email: `sunil_${ts}@example.com`,
      mobile: `95${String(ts).slice(-8)}`,
      passwordHash: hashedPassword,
      role: 'farmer',
      status: 'active'
    });
    createdUserIds.push(farmerD._id);
    farmerDToken = signAccessToken(farmerD);

    tomorrowDate = new Date();
    tomorrowDate.setDate(tomorrowDate.getDate() + 1);
    tomorrowDate.setUTCHours(0, 0, 0, 0);

    slot = await Slot.create({
      centreId: centre._id,
      date: tomorrowDate,
      startTime: '10:00',
      endTime: '11:00',
      capacity: 10,
      maxFarmers: 10,
      maxQuantity: 5000,
      bookedCount: 0,
      active: true,
      createdBy: adminUser._id,
      supportedCommodities: ['Wheat', 'Paddy']
    });
  });

  t.after(async () => {
    const allBookings = await Booking.find({ centreId: centre._id });
    const bIds = allBookings.map((b) => b._id);
    await QueueEntry.deleteMany({ centreId: centre._id });
    await Procurement.deleteMany({ bookingId: { $in: bIds } });
    await Settlement.deleteMany({ bookingId: { $in: bIds } });
    await Booking.deleteMany({ centreId: centre._id });
    await Slot.deleteMany({ centreId: centre._id });
    await Centre.deleteMany({ _id: { $in: createdCentreIds } });
    await User.deleteMany({ _id: { $in: createdUserIds } });
    await disconnectDatabase();
  });

  await t.test('1. Full Accept Crop workflow generates settlement, serves queue, and marks booking completed', async () => {
    // 1. Create booking for Farmer A
    const bRes = await request(app)
      .post('/api/bookings')
      .set('Authorization', `Bearer ${farmerAToken}`)
      .send({
        centreId: centre._id.toString(),
        slotId: slot._id.toString(),
        bookingDate: tomorrowDate.toISOString(),
        commodityName: 'Wheat',
        bookedQuantity: 500,
        quantityUnit: 'kg'
      });
    assert.equal(bRes.status, 201);
    const bookingA = bRes.body.data;

    // 2. Staff checks in Farmer A
    const checkInRes = await request(app)
      .post(`/api/staff/bookings/${bookingA._id}/check-in`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send();
    assert.equal(checkInRes.status, 200);
    assert.equal(checkInRes.body.data.status, 'checked_in');

    // 3. Staff updates queue status to processing
    const queueEntryId = checkInRes.body.data._id;
    const procRes = await request(app)
      .patch(`/api/staff/queue/${queueEntryId}/status`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ status: 'processing' });
    assert.equal(procRes.status, 200);
    assert.equal(procRes.body.data.status, 'processing');

    // Verify booking transitioned to quality_check
    const updatedBookingA = await Booking.findById(bookingA._id);
    assert.equal(updatedBookingA.status, 'quality_check');

    // 4. Staff Accepts Crop: POST /procurements/:bookingId/complete
    const completeRes = await request(app)
      .post(`/api/procurements/${bookingA._id}/complete`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({
        acceptedQuantity: 500,
        actualWeighedQuantity: 500,
        qualityGrade: 'Grade A',
        qualityRemarks: 'Moisture at 11.5%, high test weight'
      });
    assert.equal(completeRes.status, 200);
    assert.equal(completeRes.body.data.status, 'completed');
    assert.equal(completeRes.body.data.acceptedQuantity, 500);

    // 5. Verify database records:
    // a. Booking is completed
    const finalBookingA = await Booking.findById(bookingA._id);
    assert.equal(finalBookingA.status, 'completed');

    // b. Queue entry is served (removed from active queue)
    const finalQueueEntryA = await QueueEntry.findById(queueEntryId);
    assert.equal(finalQueueEntryA.status, 'served');

    // c. Settlement record was created automatically
    const settlementA = await Settlement.findOne({ bookingId: bookingA._id });
    assert.ok(settlementA, 'Settlement record must exist for completed procurement');
    assert.equal(settlementA.paymentStatus, 'initiated');
    assert.equal(settlementA.payableAmount, Math.round(500 * 22.75 * 100) / 100); // 11375
    assert.ok(settlementA.paymentReference.startsWith('PAY-'));

    // d. Farmer queue endpoint returns 0 farmers ahead and attached procurement info
    const farmerQRes = await request(app)
      .get(`/api/bookings/${bookingA._id}/queue`)
      .set('Authorization', `Bearer ${farmerAToken}`);
    assert.equal(farmerQRes.status, 200);
    assert.ok(Array.isArray(farmerQRes.body.data));
    assert.equal(farmerQRes.body.data[0].farmersAhead, 0);
    assert.equal(farmerQRes.body.data[0].procurement?.status, 'completed');

    // e. Farmer settlement endpoint returns settlement data
    const farmerPayRes = await request(app)
      .get(`/api/procurements/${bookingA._id}/settlement`)
      .set('Authorization', `Bearer ${farmerAToken}`);
    assert.equal(farmerPayRes.status, 200);
    assert.equal(farmerPayRes.body.data.payableAmount, 11375);
  });

  await t.test('2. Reject Crop workflow requires reason, cancels queue, sets booking rejected, NO settlement', async () => {
    // 1. Create booking for Farmer B
    const bRes = await request(app)
      .post('/api/bookings')
      .set('Authorization', `Bearer ${farmerBToken}`)
      .send({
        centreId: centre._id.toString(),
        slotId: slot._id.toString(),
        bookingDate: tomorrowDate.toISOString(),
        commodityName: 'Wheat',
        bookedQuantity: 300,
        quantityUnit: 'kg'
      });
    assert.equal(bRes.status, 201);
    const bookingB = bRes.body.data;

    // 2. Staff checks in Farmer B
    const checkInRes = await request(app)
      .post(`/api/staff/bookings/${bookingB._id}/check-in`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send();
    assert.equal(checkInRes.status, 200);
    const queueEntryId = checkInRes.body.data._id;

    // 3. Reject WITHOUT reason must fail with 400
    const failReject = await request(app)
      .post(`/api/procurements/${bookingB._id}/reject`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ rejectionReason: '   ' });
    assert.equal(failReject.status, 400);

    // 4. Reject WITH reason must succeed
    const validReason = 'High moisture content (> 15.2%) exceeds FAQ norms';
    const rejectRes = await request(app)
      .post(`/api/procurements/${bookingB._id}/reject`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({
        rejectionReason: validReason,
        qualityRemarks: 'Grain wet to touch, fungus risk'
      });
    assert.equal(rejectRes.status, 200);
    assert.equal(rejectRes.body.data.status, 'rejected');
    assert.equal(rejectRes.body.data.rejectionReason, validReason);

    // 5. Verify database records:
    // a. Booking status is rejected and cancellationReason is saved
    const finalBookingB = await Booking.findById(bookingB._id);
    assert.equal(finalBookingB.status, 'rejected');
    assert.equal(finalBookingB.cancellationReason, validReason);
    assert.equal(finalBookingB.cancelledBy.toString(), staff._id.toString());

    // b. Queue entry is cancelled (removed from active queue)
    const finalQueueB = await QueueEntry.findById(queueEntryId);
    assert.equal(finalQueueB.status, 'cancelled');

    // c. CRITICAL: NO settlement record exists for rejected procurement
    const settlementB = await Settlement.findOne({ bookingId: bookingB._id });
    assert.equal(settlementB, null, 'Rejected procurement must NEVER create a settlement');

    // d. Farmer queue endpoint returns rejection reason and 0 farmers ahead
    const farmerQRes = await request(app)
      .get(`/api/bookings/${bookingB._id}/queue`)
      .set('Authorization', `Bearer ${farmerBToken}`);
    assert.equal(farmerQRes.status, 200);
    assert.equal(farmerQRes.body.data[0].farmersAhead, 0);
    assert.equal(farmerQRes.body.data[0].procurement?.rejectionReason, validReason);

    // e. Farmer settlement endpoint returns null
    const farmerPayRes = await request(app)
      .get(`/api/procurements/${bookingB._id}/settlement`)
      .set('Authorization', `Bearer ${farmerBToken}`);
    assert.equal(farmerPayRes.status, 200);
    assert.equal(farmerPayRes.body.data, null);
  });

  await t.test('3. Dynamic queue recalculation when a farmer is completed or rejected', async () => {
    // Create new booking for Farmer D and Farmer C
    const bResD = await request(app)
      .post('/api/bookings')
      .set('Authorization', `Bearer ${farmerDToken}`)
      .send({
        centreId: centre._id.toString(),
        slotId: slot._id.toString(),
        bookingDate: tomorrowDate.toISOString(),
        commodityName: 'Paddy',
        bookedQuantity: 400,
        quantityUnit: 'kg'
      });
    assert.equal(bResD.status, 201);
    const bookingD = bResD.body.data;

    const bResC = await request(app)
      .post('/api/bookings')
      .set('Authorization', `Bearer ${farmerCToken}`)
      .send({
        centreId: centre._id.toString(),
        slotId: slot._id.toString(),
        bookingDate: tomorrowDate.toISOString(),
        commodityName: 'Paddy',
        bookedQuantity: 600,
        quantityUnit: 'kg'
      });
    assert.equal(bResC.status, 201);
    const bookingC = bResC.body.data;

    // Check in D first, then C
    await request(app)
      .post(`/api/staff/bookings/${bookingD._id}/check-in`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send();

    await request(app)
      .post(`/api/staff/bookings/${bookingC._id}/check-in`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send();

    // Check queue for C: Farmer D is ahead of C -> farmersAhead = 1, totalActive = 2
    const qBefore = await request(app)
      .get(`/api/bookings/${bookingC._id}/queue`)
      .set('Authorization', `Bearer ${farmerCToken}`);
    assert.equal(qBefore.status, 200);
    assert.equal(qBefore.body.data[0].farmersAhead, 1);
    assert.equal(qBefore.body.data[0].queuePosition, 2);
    assert.equal(qBefore.body.data[0].totalActiveInQueue, 2);

    // Staff completes Farmer D
    await request(app)
      .post(`/api/procurements/${bookingD._id}/complete`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ acceptedQuantity: 400, qualityGrade: 'Grade A' });

    // Recheck queue for C: Farmer D was served and removed from active queue!
    // Now C is next in line: farmersAhead = 0, queuePosition = 1, totalActive = 1
    const qAfter = await request(app)
      .get(`/api/bookings/${bookingC._id}/queue`)
      .set('Authorization', `Bearer ${farmerCToken}`);
    assert.equal(qAfter.status, 200);
    assert.equal(qAfter.body.data[0].farmersAhead, 0);
    assert.equal(qAfter.body.data[0].queuePosition, 1);
    assert.equal(qAfter.body.data[0].totalActiveInQueue, 1);
  });
});
