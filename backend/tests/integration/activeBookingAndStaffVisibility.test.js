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

  // Test 5: Farmer checks live queue -> sees queuePosition #1 and 0 farmers ahead
  await t.test('Farmer 1 sees queuePosition = 1 and farmersAhead = 0', async () => {
    const res = await request(app)
      .get(`/api/bookings/${firstBookingId}/queue`)
      .set('Authorization', `Bearer ${farmerToken}`);

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.ok(Array.isArray(res.body.data));
    const entry = res.body.data[0];
    assert.ok(entry);
    assert.equal(entry.queuePosition, 1, 'First farmer in queue must have position 1');
    assert.equal(entry.farmersAhead, 0, 'First farmer in queue must have 0 farmers ahead');
    assert.equal(entry.totalActiveInQueue, 1);
  });

  // Test 6: A second farmer books and checks in -> has queuePosition #2 and 1 farmer ahead
  let farmer2User;
  let farmer2Token;
  let booking2Id;
  await t.test('Second farmer books and checks in -> has queuePosition 2 and 1 farmer ahead', async () => {
    const farmer2Mobile = `986${String(ts).slice(-7)}`;
    const farmer2Email = `farmer2_${ts}@example.com`;

    const regRes = await request(app)
      .post('/api/auth/register')
      .send({
        name: `Farmer Two ${ts}`,
        mobile: farmer2Mobile,
        email: farmer2Email,
        password: testPassword,
        state: 'Haryana',
        district: 'Karnal'
      });
    assert.equal(regRes.status, 201);
    farmer2User = regRes.body.data.user;

    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ identifier: farmer2Mobile, password: testPassword });
    assert.equal(loginRes.status, 200);
    farmer2Token = loginRes.body.data.accessToken;

    const bookRes = await request(app)
      .post('/api/bookings')
      .set('Authorization', `Bearer ${farmer2Token}`)
      .send({
        centreId: testCentre._id,
        slotId: testSlot1._id,
        commodityName: 'Wheat',
        bookedQuantity: 25,
        quantityUnit: 'kg'
      });
    assert.equal(bookRes.status, 201);
    booking2Id = bookRes.body.data._id;

    // Staff checks in farmer 2
    const checkInRes = await request(app)
      .post(`/api/staff/bookings/${booking2Id}/check-in`)
      .set('Authorization', `Bearer ${staffToken}`);
    assert.equal(checkInRes.status, 200);

    // Check Farmer 2's queue position
    const q2Res = await request(app)
      .get(`/api/bookings/${booking2Id}/queue`)
      .set('Authorization', `Bearer ${farmer2Token}`);
    assert.equal(q2Res.status, 200);
    const entry2 = q2Res.body.data[0];
    assert.equal(entry2.queuePosition, 2, 'Second farmer should have position 2');
    assert.equal(entry2.farmersAhead, 1, 'Second farmer should have 1 farmer ahead');
    assert.equal(entry2.totalActiveInQueue, 2);
  });

  // Test 7: Staff retrieves the queue -> both entries visible
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

  // Test 8: Staff sets Farmer 1 to processing and then served -> Farmer 2 moves to #1 with 0 ahead
  await t.test('When Farmer 1 completes, Farmer 2 becomes #1 with 0 farmers ahead', async () => {
    // Process Farmer 1
    const procRes = await request(app)
      .patch(`/api/staff/queue/${queueEntryId}/status`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ status: 'processing' });
    assert.equal(procRes.status, 200);

    // Serve Farmer 1
    const servedRes = await request(app)
      .patch(`/api/staff/queue/${queueEntryId}/status`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ status: 'served' });
    assert.equal(servedRes.status, 200);

    // Now Farmer 2 checks their queue: should be position 1 with 0 ahead!
    const q2Res = await request(app)
      .get(`/api/bookings/${booking2Id}/queue`)
      .set('Authorization', `Bearer ${farmer2Token}`);
    assert.equal(q2Res.status, 200);
    const entry2 = q2Res.body.data[0];
    assert.equal(entry2.queuePosition, 1, 'Farmer 2 must now be #1');
    assert.equal(entry2.farmersAhead, 0, 'Farmer 2 must now have 0 farmers ahead');
  });

  // Test 9: After booking is completed/cancelled, Farmer 1 CAN book a new slot
  await t.test('Farmer can book a new slot after previous booking is completed/cancelled', async () => {
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
