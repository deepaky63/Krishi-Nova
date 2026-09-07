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

test('Farmer Multiple-Booking Prevention & Staff Visibility Suite', async (t) => {
  const ts = Date.now();
  const farmerMobile = `987${String(ts).slice(-7)}`;
  const farmerEmail = `farmer_booking_${ts}@example.com`;
  const staffEmail = `staff_akgec_${ts}@example.com`;
  const testPassword = 'SecurePassword123!';

  let farmerUser;
  let farmerToken;
  let staffUser;
  let staffToken;
  let testCentre;
  let testSlot1;
  let testSlot2;
  let firstBookingId;

  t.before(async () => {
    await connectDatabase();

    // 1. Create Admin user for creator refs
    const hashedPassword = await User.hashPassword(testPassword);
    const adminUser = await User.create({
      name: `Admin Tester ${ts}`,
      email: `admin_${ts}@example.com`,
      passwordHash: hashedPassword,
      role: 'admin',
      status: 'active'
    });

    // 2. Create a test centre
    testCentre = await Centre.create({
      name: `AKGEC Procurement Hub ${ts}`,
      code: `AKG-${String(ts).slice(-4)}`,
      centreCode: `AKG-${String(ts).slice(-4)}`,
      state: 'Uttar Pradesh',
      district: 'Ghaziabad',
      address: 'AKGEC Campus, NH-24',
      status: 'active',
      operatingHours: [{ day: 1, open: '08:00', close: '18:00' }],
      createdBy: adminUser._id
    });

    // 3. Create two test slots for tomorrow so booking cutoff does not trigger
    const slotDate = new Date();
    slotDate.setDate(slotDate.getDate() + 1);
    slotDate.setHours(0, 0, 0, 0);

    testSlot1 = await Slot.create({
      centreId: testCentre._id,
      date: slotDate,
      startTime: '09:00',
      endTime: '10:00',
      maxFarmers: 10,
      supportedCommodities: ['Wheat', 'Rice'],
      active: true,
      createdBy: adminUser._id
    });

    testSlot2 = await Slot.create({
      centreId: testCentre._id,
      date: slotDate,
      startTime: '10:00',
      endTime: '11:00',
      maxFarmers: 10,
      supportedCommodities: ['Wheat', 'Rice'],
      active: true,
      createdBy: adminUser._id
    });

    // 4. Register Farmer
    const regRes = await request(app)
      .post('/api/auth/register')
      .send({
        name: `Farmer Testing ${ts}`,
        mobile: farmerMobile,
        email: farmerEmail,
        password: testPassword,
        state: 'Haryana',
        district: 'Karnal'
      });
    assert.equal(regRes.status, 201);
    farmerUser = regRes.body.data.user;

    // Login farmer to get access token
    const farmerLoginRes = await request(app)
      .post('/api/auth/login')
      .send({
        identifier: farmerMobile,
        password: testPassword
      });
    assert.equal(farmerLoginRes.status, 200);
    farmerToken = farmerLoginRes.body.data.accessToken;

    // 5. Create Staff user assigned to this centre
    staffUser = await User.create({
      name: `Staff Member ${ts}`,
      email: staffEmail,
      passwordHash: hashedPassword,
      role: 'staff',
      assignedCentreIds: [testCentre._id],
      status: 'active'
    });

    // Login staff to get access token
    const staffLoginRes = await request(app)
      .post('/api/auth/login')
      .send({
        identifier: staffEmail,
        password: testPassword
      });
    assert.equal(staffLoginRes.status, 200);
    staffToken = staffLoginRes.body.data.accessToken;
  });

  t.after(async () => {
    if (farmerUser?._id) {
      await Booking.deleteMany({ farmerId: farmerUser._id });
      await QueueEntry.deleteMany({ farmerId: farmerUser._id });
      await User.deleteOne({ _id: farmerUser._id });
    }
    if (staffUser?._id) {
      await User.deleteOne({ _id: staffUser._id });
    }
    if (testCentre?._id) {
      await Centre.deleteOne({ _id: testCentre._id });
      await Slot.deleteMany({ centreId: testCentre._id });
    }
    await disconnectDatabase();
  });

  // Test 1: Farmer successfully creates 1st booking
  await t.test('Farmer creates 1st booking successfully', async () => {
    const res = await request(app)
      .post('/api/bookings')
      .set('Authorization', `Bearer ${farmerToken}`)
      .send({
        centreId: testCentre._id,
        slotId: testSlot1._id,
        commodityName: 'Wheat',
        bookedQuantity: 50,
        quantityUnit: 'kg'
      });

    assert.equal(res.status, 201, `Failed to create 1st booking: ${JSON.stringify(res.body)}`);
    assert.equal(res.body.success, true);
    assert.ok(res.body.data._id);
    assert.equal(res.body.data.status, 'booked');
    firstBookingId = res.body.data._id;
  });

  // Test 2: Farmer attempts to create 2nd active booking (MUST FAIL)
  await t.test('Farmer is rejected when creating a 2nd active booking', async () => {
    const res = await request(app)
      .post('/api/bookings')
      .set('Authorization', `Bearer ${farmerToken}`)
      .send({
        centreId: testCentre._id,
        slotId: testSlot2._id,
        commodityName: 'Wheat',
        bookedQuantity: 30,
        quantityUnit: 'kg'
      });

    assert.equal(res.status, 400);
    assert.equal(res.body.success, false);
    assert.match(
      res.body.message,
      /already have an active procurement booking/i,
      'Error message must clearly inform farmer of existing active booking'
    );
  });

  // Test 3: Staff assigned to AKGEC can see the farmer's booking
  await t.test('Staff assigned to centre can see bookings via GET /api/staff/bookings', async () => {
    const res = await request(app)
      .get('/api/staff/bookings')
      .query({ centreId: testCentre._id.toString() })
      .set('Authorization', `Bearer ${staffToken}`);

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.ok(Array.isArray(res.body.data));
    const found = res.body.data.find((b) => b._id.toString() === firstBookingId.toString());
    assert.ok(found, 'Staff must see the created booking for their assigned centre');
    assert.equal(found.status, 'booked');
  });

  // Test 4: Staff checks in the farmer -> QueueEntry is generated
  let queueEntryId;
  await t.test('Staff checks in farmer -> generates live QueueEntry', async () => {
    const res = await request(app)
      .post(`/api/staff/bookings/${firstBookingId}/check-in`)
      .set('Authorization', `Bearer ${staffToken}`);

    assert.equal(res.status, 200, `Check-in failed: ${JSON.stringify(res.body)}`);
    assert.equal(res.body.success, true);
    assert.ok(res.body.data.queueNumber, 'Queue token must be assigned');
    queueEntryId = res.body.data._id;
  });

  // Test 5: Staff retrieves the queue -> QueueEntry is visible
  await t.test('Staff can view live queue entries for centre', async () => {
    const res = await request(app)
      .get('/api/staff/queue')
      .query({ centreId: testCentre._id.toString() })
      .set('Authorization', `Bearer ${staffToken}`);

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    const found = res.body.data.find((q) => (q.bookingId?._id || q.bookingId)?.toString() === firstBookingId.toString());
    assert.ok(found, 'Queue entry must be listed for staff');
  });

  // Test 6: Staff updates status to processing and then served
  await t.test('Staff transitions farmer queue entry through processing to served', async () => {
    const procRes = await request(app)
      .patch(`/api/staff/queue/${queueEntryId}/status`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ status: 'processing' });
    assert.equal(procRes.status, 200);
    assert.equal(procRes.body.data.status, 'processing');

    const servedRes = await request(app)
      .patch(`/api/staff/queue/${queueEntryId}/status`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ status: 'served' });
    assert.equal(servedRes.status, 200);
    assert.equal(servedRes.body.data.status, 'served');
  });

  // Test 7: After booking is completed/cancelled, Farmer CAN book a new slot
  await t.test('Farmer can book a new slot after previous booking is completed/cancelled', async () => {
    // Mark previous booking completed (or cancelled)
    await Booking.findByIdAndUpdate(firstBookingId, { status: 'completed' });

    const res = await request(app)
      .post('/api/bookings')
      .set('Authorization', `Bearer ${farmerToken}`)
      .send({
        centreId: testCentre._id,
        slotId: testSlot2._id,
        commodityName: 'Rice',
        bookedQuantity: 40,
        quantityUnit: 'kg'
      });

    assert.equal(res.status, 201, `Farmer should be able to book after completion: ${JSON.stringify(res.body)}`);
    assert.equal(res.body.success, true);
    assert.equal(res.body.data.status, 'booked');
  });
});
