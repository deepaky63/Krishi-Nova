import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import mongoose from 'mongoose';
import app from '../../src/app.js';
import { connectDatabase, disconnectDatabase } from '../../src/config/db.js';
import { signAccessToken } from '../../src/utils/tokens.js';
import { Centre } from '../../src/models/Centre.js';
import { Commodity } from '../../src/models/Commodity.js';
import { User } from '../../src/models/User.js';
import { Slot } from '../../src/models/Slot.js';
import { ProcurementSchedule } from '../../src/models/ProcurementSchedule.js';
import { Booking } from '../../src/models/Booking.js';
import { QueueEntry } from '../../src/models/QueueEntry.js';

test('Procurement Schedule & Automatic Slot Generation E2E Test Suite', async (t) => {
  let adminToken;
  let farmerToken;
  let staffToken;
  let testCentre;
  let testCommodity;
  let testFarmer;
  let testStaff;
  let testAdmin;

  t.before(async () => {
    await connectDatabase();

    // Create unique test users
    const ts = Date.now();
    testAdmin = await User.create({
      name: 'Test Admin',
      email: `admin_${ts}@example.com`,
      passwordHash: '$2a$10$abcdefghijklmnopqrstuvwxyz123456',
      role: 'admin',
      status: 'active',
      district: 'Jaipur',
    });

    testFarmer = await User.create({
      name: 'Ramesh Kumar',
      email: `farmer_${ts}@example.com`,
      mobile: `987${String(ts).slice(-7)}`,
      passwordHash: '$2a$10$abcdefghijklmnopqrstuvwxyz123456',
      role: 'farmer',
      status: 'active',
      district: 'Jaipur',
    });

    testCentre = await Centre.create({
      centreCode: `C-${String(ts).slice(-6)}`,
      name: `Jaipur Mandi Centre ${ts}`,
      address: 'Main Mandi Road',
      district: 'Jaipur',
      state: 'Rajasthan',
      status: 'active',
      operatingHours: [0, 1, 2, 3, 4, 5, 6].map((day) => ({
        day,
        open: '08:00',
        close: '18:00',
        closed: false,
      })),
      closures: [
        {
          date: new Date(new Date(Date.now() + 86400000 * 2).toISOString().slice(0, 10)), // Day 2 closed
          reason: 'National Holiday',
          closureType: 'holiday',
          createdBy: testAdmin._id,
        },
      ],
    });

    testStaff = await User.create({
      name: 'Mandi Officer',
      email: `staff_${ts}@example.com`,
      passwordHash: '$2a$10$abcdefghijklmnopqrstuvwxyz123456',
      role: 'staff',
      status: 'active',
      district: 'Jaipur',
      assignedCentreIds: [testCentre._id],
    });

    testCommodity = await Commodity.create({
      name: `Traditional Wheat ${ts}`,
      code: `WHT-${String(ts).slice(-4)}`,
      quantityUnit: 'kg',
      active: true,
    });

    adminToken = signAccessToken(testAdmin);
    farmerToken = signAccessToken(testFarmer);
    staffToken = signAccessToken(testStaff);
  });

  t.after(async () => {
    // Cleanup created test records
    if (testCentre) {
      await Booking.deleteMany({ centreId: testCentre._id });
      await QueueEntry.deleteMany({ centreId: testCentre._id });
      await Slot.deleteMany({ centreId: testCentre._id });
      await ProcurementSchedule.deleteMany({ centreId: testCentre._id });
      await Centre.deleteOne({ _id: testCentre._id });
    }
    if (testCommodity) await Commodity.deleteOne({ _id: testCommodity._id });
    if (testAdmin) await User.deleteOne({ _id: testAdmin._id });
    if (testFarmer) await User.deleteOne({ _id: testFarmer._id });
    if (testStaff) await User.deleteOne({ _id: testStaff._id });
    await disconnectDatabase();
  });

  // 1. Validation & Preview Tests
  await t.test('Preview Schedule: validates date range and operating hours', async () => {
    // Invalid operating hours: opening >= closing
    const resInvalidHours = await request(app)
      .post('/api/admin/schedules/preview')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        centreId: testCentre._id.toString(),
        effectiveFrom: new Date(Date.now() + 86400000).toISOString().slice(0, 10),
        effectiveUntil: new Date(Date.now() + 86400000 * 5).toISOString().slice(0, 10),
        daysOfWeek: [1, 2, 3, 4, 5],
        openingTime: '17:00',
        closingTime: '09:00',
        slotDurationMinutes: 30,
        maxFarmersPerSlot: 15,
      });
    assert.equal(resInvalidHours.status, 400);

    // Invalid date range: effectiveFrom > effectiveUntil
    const resInvalidDates = await request(app)
      .post('/api/admin/schedules/preview')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        centreId: testCentre._id.toString(),
        effectiveFrom: new Date(Date.now() + 86400000 * 10).toISOString().slice(0, 10),
        effectiveUntil: new Date(Date.now() + 86400000 * 2).toISOString().slice(0, 10),
        daysOfWeek: [1, 2, 3, 4, 5],
        openingTime: '09:00',
        closingTime: '17:00',
        slotDurationMinutes: 30,
        maxFarmersPerSlot: 15,
      });
    assert.equal(resInvalidDates.status, 400);

    // Valid preview
    const validFrom = new Date(Date.now() + 86400000); // tomorrow
    const validUntil = new Date(Date.now() + 86400000 * 4); // 4 days later
    const resValidPreview = await request(app)
      .post('/api/admin/schedules/preview')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        centreId: testCentre._id.toString(),
        effectiveFrom: validFrom.toISOString().slice(0, 10),
        effectiveUntil: validUntil.toISOString().slice(0, 10),
        daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
        openingTime: '09:00',
        closingTime: '11:00', // 2 hours = 4 slots of 30 min per day
        slotDurationMinutes: 30,
        maxFarmersPerSlot: 20,
      });

    assert.equal(resValidPreview.status, 200);
    assert.equal(resValidPreview.body.success, true);
    assert.equal(resValidPreview.body.data.slotsPerDay, 4);
    assert.ok(resValidPreview.body.data.totalSlots > 0);
  });

  // 2. Schedule Generation with Free-Text Commodities & Duplication Sanitization
  let generatedScheduleId;
  await t.test('Admin: Generates schedule with free-text commodities and creates concrete slots', async () => {
    const validFrom = new Date(Date.now() + 86400000); // tomorrow
    const validUntil = new Date(Date.now() + 86400000 * 3); // 3 days window

    const res = await request(app)
      .post('/api/admin/schedules')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        centreId: testCentre._id.toString(),
        name: 'Rabi 2026 Procurement Drive',
        supportedCommodities: ['Wheat', 'Rice', 'Mustard', 'wheat', '  RICE  '], // Contains duplicates and case variations
        effectiveFrom: validFrom.toISOString().slice(0, 10),
        effectiveUntil: validUntil.toISOString().slice(0, 10),
        daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
        openingTime: '09:00',
        closingTime: '11:00', // 2 hrs / 30m = 4 slots/day
        slotDurationMinutes: 30,
        maxFarmersPerSlot: 10,
        maxQuantityPerSlot: 500,
        quantityUnit: 'kg',
        bookingCutoffMinutes: 60,
      });

    assert.equal(res.status, 201);
    assert.equal(res.body.success, true);
    const sched = res.body.data;
    generatedScheduleId = sched._id;

    // Check commodity sanitization & deduplication
    assert.deepEqual(sched.supportedCommodities, ['Wheat', 'Rice', 'Mustard']);
    assert.ok(sched.totalSlotsGenerated > 0);

    // Verify concrete Slot documents in DB
    const createdSlots = await Slot.find({ scheduleId: sched._id });
    assert.equal(createdSlots.length, sched.totalSlotsGenerated);

    // Verify all slots carry supportedCommodities
    for (const slot of createdSlots) {
      assert.deepEqual(slot.supportedCommodities, ['Wheat', 'Rice', 'Mustard']);
      assert.equal(slot.active, true);
      assert.equal(slot.maxFarmers, 10);
      assert.equal(slot.maxQuantity, 500);
    }

    // Verify closure date was skipped
    const closureDateStr = new Date(Date.now() + 86400000 * 2).toISOString().slice(0, 10);
    const slotsOnClosedDay = createdSlots.filter(
      (s) => new Date(s.date).toISOString().slice(0, 10) === closureDateStr
    );
    assert.equal(slotsOnClosedDay.length, 0, 'Slots should not be generated on centre closure date');
  });

  // 3. Inspect Schedule Slots Endpoint
  await t.test('Admin: Inspects generated slots for schedule', async () => {
    const res = await request(app)
      .get(`/api/admin/schedules/${generatedScheduleId}/slots`)
      .set('Authorization', `Bearer ${adminToken}`);

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.ok(Array.isArray(res.body.data));
    assert.ok(res.body.data.length > 0);
    assert.equal(res.body.data[0].remainingCapacity, 10);
    assert.equal(res.body.data[0].currentBookings, 0);
  });

  // 4. Backward Compatibility: Ad-hoc Single Slot (scheduleId = null)
  let adhocSlotId;
  await t.test('Admin: Creates ad-hoc single slot without scheduleId (backward compatibility)', async () => {
    const singleDate = new Date(Date.now() + 86400000 * 5).toISOString().slice(0, 10);
    const res = await request(app)
      .post('/api/admin/slots')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        centreId: testCentre._id.toString(),
        date: singleDate,
        startTime: '14:00',
        endTime: '15:00',
        maxFarmers: 5,
        supportedCommodities: ['Special Organic Millet'],
        bookingCutoffMinutes: 30,
      });

    assert.equal(res.status, 201);
    const slot = res.body.data;
    adhocSlotId = slot._id;
    assert.equal(slot.scheduleId, undefined);
    assert.deepEqual(slot.supportedCommodities, ['Special Organic Millet']);

    // Check DB document directly
    const dbSlot = await Slot.findById(adhocSlotId);
    assert.equal(dbSlot.scheduleId, undefined);
  });

  // 5. Farmer Flow: Book slot using Admin-entered free-text commodity
  let createdBookingId;
  let bookedSlotDoc;
  await t.test('Farmer: Books an automated slot using Admin-entered commodityName', async () => {
    // Find one generated slot
    bookedSlotDoc = await Slot.findOne({ scheduleId: generatedScheduleId, active: true });
    assert.ok(bookedSlotDoc, 'Must have at least one generated slot');

    const res = await request(app)
      .post('/api/bookings')
      .set('Authorization', `Bearer ${farmerToken}`)
      .send({
        centreId: testCentre._id.toString(),
        slotId: bookedSlotDoc._id.toString(),
        commodityName: 'Wheat', // Matches slot.supportedCommodities
        bookedQuantity: 150,
        quantityUnit: 'kg',
      });

    assert.equal(res.status, 201);
    assert.equal(res.body.success, true);
    const booking = res.body.data;
    createdBookingId = booking._id;
    assert.equal(booking.commodityName, 'Wheat');
    assert.equal(booking.status, 'booked');
    assert.ok(booking.bookingCode.startsWith('KN-'));
  });

  // 6. Staff Queue Flow: Check-in, View Queue, and Process to completion
  await t.test('Staff: Checks in farmer, manages queue, and serves booking', async () => {
    // 6a. Check in
    const resCheckIn = await request(app)
      .post('/api/staff/check-in')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ bookingId: createdBookingId });

    assert.ok(resCheckIn.status === 200 || resCheckIn.status === 201);
    assert.equal(resCheckIn.body.success, true);
    const entry = resCheckIn.body.data;
    assert.equal(entry.status, 'checked_in');
    assert.ok(entry.queueNumber.startsWith('Q'));

    // 6b. View Queue
    const resQueue = await request(app)
      .get(`/api/queue?centreId=${testCentre._id}`)
      .set('Authorization', `Bearer ${staffToken}`);

    assert.equal(resQueue.status, 200);
    const queueList = resQueue.body.data;
    assert.ok(queueList.some((q) => q._id === entry._id));

    // 6c. Start processing
    const resProcessing = await request(app)
      .patch(`/api/queue/${entry._id}/status`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ status: 'processing' });
    assert.equal(resProcessing.status, 200);
    assert.equal(resProcessing.body.data.status, 'processing');

    // 6d. Mark served (completes booking)
    const resServed = await request(app)
      .patch(`/api/queue/${entry._id}/status`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ status: 'served' });
    assert.equal(resServed.status, 200);
    assert.equal(resServed.body.data.status, 'served');

    // Verify booking completed
    const updatedBooking = await Booking.findById(createdBookingId);
    assert.equal(updatedBooking.status, 'completed');
  });

  // 7. Safe Schedule Deactivation: preserves booked slots, deactivates future unbooked slots
  await t.test('Safe Deactivation: preserves booked slot, pauses only unbooked slots', async () => {
    // Create a new fresh booking on another future slot
    const farmer2 = await User.create({
      name: 'Kisan 2',
      email: `farmer2_${Date.now()}@example.com`,
      mobile: `987${String(Date.now()).slice(-7)}`,
      passwordHash: '$2a$10$abcdefghijklmnopqrstuvwxyz123456',
      role: 'farmer',
      status: 'active',
      district: 'Jaipur',
    });
    const farmer2Token = signAccessToken(farmer2);

    // Pick an unbooked slot
    const slots = await Slot.find({ scheduleId: generatedScheduleId, _id: { $ne: bookedSlotDoc._id } });
    const slotToBook = slots[0];
    const slotToRemainUnbooked = slots[1];

    const resBook2 = await request(app)
      .post('/api/bookings')
      .set('Authorization', `Bearer ${farmer2Token}`)
      .send({
        centreId: testCentre._id.toString(),
        slotId: slotToBook._id.toString(),
        commodityName: 'Rice',
        bookedQuantity: 50,
        quantityUnit: 'kg',
      });
    assert.equal(resBook2.status, 201);

    // Now Admin deactivates the schedule
    const resDeactivate = await request(app)
      .patch(`/api/admin/schedules/${generatedScheduleId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ active: false });

    assert.equal(resDeactivate.status, 200);
    assert.equal(resDeactivate.body.data.active, false);

    // Verify slot with active booking REMAINED ACTIVE
    const checkBookedSlot = await Slot.findById(slotToBook._id);
    assert.equal(checkBookedSlot.active, true, 'Slot with active booking must remain active');

    // Verify unbooked slot was deactivated
    if (slotToRemainUnbooked) {
      const checkUnbookedSlot = await Slot.findById(slotToRemainUnbooked._id);
      assert.equal(checkUnbookedSlot.active, false, 'Unbooked slot must be deactivated');
    }

    await User.deleteOne({ _id: farmer2._id });
  });
});
