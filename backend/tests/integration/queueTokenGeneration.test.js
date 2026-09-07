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
import { QueueCounter } from '../../src/models/QueueCounter.js';
import { signAccessToken } from '../../src/utils/tokens.js';

test('Queue Token Generation & Concurrency Test Suite', async (t) => {
  const ts = Date.now();
  const testPassword = 'Password123!';

  let adminUser;
  let centreA;
  let centreB;
  let staffA;
  let staffAToken;
  let staffB;
  let staffBToken;
  let slotsA = [];
  let slotsB = [];
  let nextDaySlotsA = [];

  const createdUserIds = [];
  const createdCentreIds = [];

  t.before(async () => {
    await connectDatabase();

    const hashedPassword = await User.hashPassword(testPassword);
    adminUser = await User.create({
      name: `Admin QueueTest ${ts}`,
      email: `admin_q_${ts}@example.com`,
      passwordHash: hashedPassword,
      role: 'admin',
      status: 'active'
    });
    createdUserIds.push(adminUser._id);

    // Create Centre A (e.g. AKGEC)
    centreA = await Centre.create({
      name: `Centre A ${ts}`,
      code: `CA-${String(ts).slice(-4)}`,
      centreCode: `CA-${String(ts).slice(-4)}`,
      state: 'Uttar Pradesh',
      district: 'Ghaziabad',
      address: 'AKGEC Campus, Ghaziabad',
      status: 'active',
      createdBy: adminUser._id
    });
    createdCentreIds.push(centreA._id);

    // Create Centre B (Independent centre)
    centreB = await Centre.create({
      name: `Centre B ${ts}`,
      code: `CB-${String(ts).slice(-4)}`,
      centreCode: `CB-${String(ts).slice(-4)}`,
      state: 'Uttar Pradesh',
      district: 'Noida',
      address: 'Sector 62, Noida',
      status: 'active',
      createdBy: adminUser._id
    });
    createdCentreIds.push(centreB._id);

    // Create Staff for Centre A
    staffA = await User.create({
      name: `Staff A ${ts}`,
      email: `staffA_${ts}@example.com`,
      passwordHash: hashedPassword,
      role: 'staff',
      assignedCentreIds: [centreA._id],
      status: 'active'
    });
    createdUserIds.push(staffA._id);

    const staffALogin = await request(app).post('/api/auth/login').send({
      identifier: `staffA_${ts}@example.com`,
      password: testPassword
    });
    assert.equal(staffALogin.status, 200);
    staffAToken = staffALogin.body.data.accessToken;

    // Create Staff for Centre B
    staffB = await User.create({
      name: `Staff B ${ts}`,
      email: `staffB_${ts}@example.com`,
      passwordHash: hashedPassword,
      role: 'staff',
      assignedCentreIds: [centreB._id],
      status: 'active'
    });
    createdUserIds.push(staffB._id);

    const staffBLogin = await request(app).post('/api/auth/login').send({
      identifier: `staffB_${ts}@example.com`,
      password: testPassword
    });
    assert.equal(staffBLogin.status, 200);
    staffBToken = staffBLogin.body.data.accessToken;

    // Create 3 slots for Centre A on Date 1 (tomorrow)
    const date1 = new Date();
    date1.setDate(date1.getDate() + 1);
    date1.setUTCHours(0, 0, 0, 0);

    const slot1A = await Slot.create({
      centreId: centreA._id,
      date: date1,
      startTime: '09:00',
      endTime: '10:00',
      maxFarmers: 10,
      supportedCommodities: ['Wheat'],
      active: true,
      createdBy: adminUser._id
    });
    const slot2A = await Slot.create({
      centreId: centreA._id,
      date: date1,
      startTime: '10:00',
      endTime: '11:00',
      maxFarmers: 10,
      supportedCommodities: ['Wheat'],
      active: true,
      createdBy: adminUser._id
    });
    const slot3A = await Slot.create({
      centreId: centreA._id,
      date: date1,
      startTime: '11:00',
      endTime: '12:00',
      maxFarmers: 10,
      supportedCommodities: ['Wheat'],
      active: true,
      createdBy: adminUser._id
    });
    slotsA = [slot1A, slot2A, slot3A];

    // Create Slot for Centre B on Date 1
    const slotB = await Slot.create({
      centreId: centreB._id,
      date: date1,
      startTime: '09:00',
      endTime: '10:00',
      maxFarmers: 10,
      supportedCommodities: ['Wheat'],
      active: true,
      createdBy: adminUser._id
    });
    slotsB = [slotB];

    // Create Slot for Centre A on Date 2 (day after tomorrow)
    const date2 = new Date(date1);
    date2.setDate(date2.getDate() + 1);
    const slotNextDayA = await Slot.create({
      centreId: centreA._id,
      date: date2,
      startTime: '09:00',
      endTime: '10:00',
      maxFarmers: 10,
      supportedCommodities: ['Wheat'],
      active: true,
      createdBy: adminUser._id
    });
    nextDaySlotsA = [slotNextDayA];
  });

  t.after(async () => {
    await Booking.deleteMany({ centreId: { $in: createdCentreIds } });
    await QueueEntry.deleteMany({ centreId: { $in: createdCentreIds } });
    await QueueCounter.deleteMany({ centreId: { $in: createdCentreIds } });
    await Slot.deleteMany({ centreId: { $in: createdCentreIds } });
    await Centre.deleteMany({ _id: { $in: createdCentreIds } });
    await User.deleteMany({ _id: { $in: createdUserIds } });
    await disconnectDatabase();
  });

  let farmerCount = 0;
  async function createFarmer(index) {
    farmerCount++;
    const mobile = `9${String(100000000 + farmerCount + Math.floor(Math.random() * 800000000)).slice(0, 9)}`;
    const email = `farmer_${ts}_${farmerCount}_${index}@example.com`;
    const user = await User.create({
      name: `Farmer ${index} ${ts}`,
      mobile,
      email,
      passwordHash: await User.hashPassword(testPassword),
      role: 'farmer',
      status: 'active',
      state: 'Uttar Pradesh',
      district: 'Ghaziabad'
    });
    createdUserIds.push(user._id);

    const token = signAccessToken(user);
    return { user, token };
  }

  // Test 1: Sequential check-in of 5 farmers at Centre A across different slots
  const farmersA = [];
  const bookingsA = [];
  const tokensA = [];

  await t.test('5 farmers checked in at Centre A receive sequential unique tokens Q001 to Q005 across slots', async () => {
    // 5 farmers
    for (let i = 1; i <= 5; i++) {
      const f = await createFarmer(i);
      farmersA.push(f);
    }

    // Bookings across 3 different slots:
    // Farmer 1 -> Slot 1
    // Farmer 2 -> Slot 1
    // Farmer 3 -> Slot 2 (different slot!)
    // Farmer 4 -> Slot 2 (different slot!)
    // Farmer 5 -> Slot 3 (different slot!)
    const slotAssignments = [slotsA[0], slotsA[0], slotsA[1], slotsA[1], slotsA[2]];

    for (let i = 0; i < 5; i++) {
      const bookRes = await request(app)
        .post('/api/bookings')
        .set('Authorization', `Bearer ${farmersA[i].token}`)
        .send({
          centreId: centreA._id,
          slotId: slotAssignments[i]._id,
          commodityName: 'Wheat',
          bookedQuantity: 100,
          quantityUnit: 'kg'
        });
      assert.equal(bookRes.status, 201);
      bookingsA.push(bookRes.body.data);
    }

    // Staff checks them in sequentially
    for (let i = 0; i < 5; i++) {
      const checkInRes = await request(app)
        .post(`/api/staff/bookings/${bookingsA[i]._id}/check-in`)
        .set('Authorization', `Bearer ${staffAToken}`);

      assert.equal(checkInRes.status, 200);
      assert.ok(checkInRes.body.data.queueNumber);
      tokensA.push(checkInRes.body.data.queueNumber);
    }

    // Verify tokens are strictly Q001, Q002, Q003, Q004, Q005
    assert.deepEqual(tokensA, ['Q001', 'Q002', 'Q003', 'Q004', 'Q005']);
  });

  // Test 2: Staff Live Queue view displays all 5 farmers with unique tokens
  await t.test('Staff Live Queue displays all 5 farmers with matching distinct tokens', async () => {
    const res = await request(app)
      .get('/api/staff/queue')
      .query({ centreId: centreA._id.toString() })
      .set('Authorization', `Bearer ${staffAToken}`);

    assert.equal(res.status, 200);
    const queueList = res.body.data;
    const activeTokens = queueList.map((q) => q.queueNumber);

    for (const expectedToken of ['Q001', 'Q002', 'Q003', 'Q004', 'Q005']) {
      assert.ok(activeTokens.includes(expectedToken), `Queue should contain ${expectedToken}`);
    }

    // Verify no duplicates
    const uniqueTokens = new Set(activeTokens);
    assert.equal(uniqueTokens.size, activeTokens.length, 'There must be no duplicate tokens in the live queue');
  });

  // Test 3: Farmer Live Queue view displays the exact same persisted backend token
  await t.test('Farmer Live Queue returns the identical backend token for each farmer', async () => {
    for (let i = 0; i < 5; i++) {
      const res = await request(app)
        .get(`/api/bookings/${bookingsA[i]._id}/queue`)
        .set('Authorization', `Bearer ${farmersA[i].token}`);

      assert.equal(res.status, 200);
      assert.ok(res.body.data.length > 0);
      const farmerEntry = res.body.data[0];
      assert.equal(farmerEntry.queueNumber, tokensA[i], `Farmer ${i + 1} view must match Staff token ${tokensA[i]}`);
    }
  });

  // Test 4: Another Centre (Centre B) independently starts from Q001
  await t.test('Different centre (Centre B) independently starts token sequence from Q001', async () => {
    const farmerB1 = await createFarmer(11);
    const farmerB2 = await createFarmer(12);

    const bRes1 = await request(app)
      .post('/api/bookings')
      .set('Authorization', `Bearer ${farmerB1.token}`)
      .send({
        centreId: centreB._id,
        slotId: slotsB[0]._id,
        commodityName: 'Wheat',
        bookedQuantity: 50,
        quantityUnit: 'kg'
      });
    assert.equal(bRes1.status, 201);

    const bRes2 = await request(app)
      .post('/api/bookings')
      .set('Authorization', `Bearer ${farmerB2.token}`)
      .send({
        centreId: centreB._id,
        slotId: slotsB[0]._id,
        commodityName: 'Wheat',
        bookedQuantity: 60,
        quantityUnit: 'kg'
      });
    assert.equal(bRes2.status, 201);

    const checkInB1 = await request(app)
      .post(`/api/staff/bookings/${bRes1.body.data._id}/check-in`)
      .set('Authorization', `Bearer ${staffBToken}`);
    assert.equal(checkInB1.status, 200);
    assert.equal(checkInB1.body.data.queueNumber, 'Q001', 'Centre B first check-in must be Q001');

    const checkInB2 = await request(app)
      .post(`/api/staff/bookings/${bRes2.body.data._id}/check-in`)
      .set('Authorization', `Bearer ${staffBToken}`);
    assert.equal(checkInB2.status, 200);
    assert.equal(checkInB2.body.data.queueNumber, 'Q002', 'Centre B second check-in must be Q002');
  });

  // Test 5: Next day at Centre A starts from Q001
  await t.test('Next day at Centre A independently starts token sequence from Q001', async () => {
    const nextDayFarmer = await createFarmer(21);
    const nextDayBooking = await request(app)
      .post('/api/bookings')
      .set('Authorization', `Bearer ${nextDayFarmer.token}`)
      .send({
        centreId: centreA._id,
        slotId: nextDaySlotsA[0]._id,
        commodityName: 'Wheat',
        bookedQuantity: 70,
        quantityUnit: 'kg'
      });
    assert.equal(nextDayBooking.status, 201);

    const nextDayCheckIn = await request(app)
      .post(`/api/staff/bookings/${nextDayBooking.body.data._id}/check-in`)
      .set('Authorization', `Bearer ${staffAToken}`);
    assert.equal(nextDayCheckIn.status, 200);
    assert.equal(nextDayCheckIn.body.data.queueNumber, 'Q001', 'Next day operational queue must start from Q001');
  });

  // Test 6: Serving a farmer does NOT reset or rewind the sequence
  await t.test('Completing / serving a farmer does not reuse or rewind tokens', async () => {
    // Complete farmer 1 (Q001)
    const queueListRes = await request(app)
      .get('/api/staff/queue')
      .query({ centreId: centreA._id.toString() })
      .set('Authorization', `Bearer ${staffAToken}`);
    assert.equal(queueListRes.status, 200);

    const q1Entry = queueListRes.body.data.find((q) => q.queueNumber === 'Q001');
    assert.ok(q1Entry);

    const servedRes = await request(app)
      .patch(`/api/staff/queue/${q1Entry._id}/status`)
      .set('Authorization', `Bearer ${staffAToken}`)
      .send({ status: 'served' });
    assert.equal(servedRes.status, 200);

    // Now a 6th farmer checks in at Centre A on Date 1: should receive Q006 (NOT Q001!)
    const farmer6 = await createFarmer(6);
    const booking6Res = await request(app)
      .post('/api/bookings')
      .set('Authorization', `Bearer ${farmer6.token}`)
      .send({
        centreId: centreA._id,
        slotId: slotsA[0]._id,
        commodityName: 'Wheat',
        bookedQuantity: 80,
        quantityUnit: 'kg'
      });
    assert.equal(booking6Res.status, 201);

    const checkIn6 = await request(app)
      .post(`/api/staff/bookings/${booking6Res.body.data._id}/check-in`)
      .set('Authorization', `Bearer ${staffAToken}`);
    assert.equal(checkIn6.status, 200);
    assert.equal(checkIn6.body.data.queueNumber, 'Q006', 'New check-in after serving farmer must receive Q006, not rewind to Q001');
  });

  // Test 7: Concurrency test - simultaneous check-ins do not produce duplicate tokens
  await t.test('Simultaneous check-ins under race condition generate distinct sequential tokens', async () => {
    const farmerC1 = await createFarmer(31);
    const farmerC2 = await createFarmer(32);

    const bRes1 = await request(app)
      .post('/api/bookings')
      .set('Authorization', `Bearer ${farmerC1.token}`)
      .send({
        centreId: centreA._id,
        slotId: slotsA[1]._id,
        commodityName: 'Wheat',
        bookedQuantity: 50,
        quantityUnit: 'kg'
      });
    assert.equal(bRes1.status, 201);

    const bRes2 = await request(app)
      .post('/api/bookings')
      .set('Authorization', `Bearer ${farmerC2.token}`)
      .send({
        centreId: centreA._id,
        slotId: slotsA[2]._id,
        commodityName: 'Wheat',
        bookedQuantity: 50,
        quantityUnit: 'kg'
      });
    assert.equal(bRes2.status, 201);

    // Concurrently fire both check-ins
    const [res1, res2] = await Promise.all([
      request(app).post(`/api/staff/bookings/${bRes1.body.data._id}/check-in`).set('Authorization', `Bearer ${staffAToken}`),
      request(app).post(`/api/staff/bookings/${bRes2.body.data._id}/check-in`).set('Authorization', `Bearer ${staffAToken}`)
    ]);

    assert.equal(res1.status, 200);
    assert.equal(res2.status, 200);

    const token1 = res1.body.data.queueNumber;
    const token2 = res2.body.data.queueNumber;

    assert.notEqual(token1, token2, 'Concurrent check-ins must not produce identical tokens');
    const sorted = [token1, token2].sort();
    assert.deepEqual(sorted, ['Q007', 'Q008'], 'Tokens must be Q007 and Q008');
  });
});

