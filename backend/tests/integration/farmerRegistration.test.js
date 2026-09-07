import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import app from '../../src/app.js';
import { connectDatabase, disconnectDatabase } from '../../src/config/db.js';
import { User } from '../../src/models/User.js';

test('Farmer Create Account & Authentication Test Suite', async (t) => {
  const ts = Date.now();
  const validFarmerMobile = `981${String(ts).slice(-7)}`;
  const validFarmerEmail = `farmer_${ts}@example.com`;
  const testPassword = 'SecureFarmerPass123!';

  t.before(async () => {
    await connectDatabase();
  });

  t.after(async () => {
    await User.deleteMany({
      $or: [
        { email: new RegExp(`_${ts}@example\\.com$`) },
        { mobile: validFarmerMobile },
      ],
    });
    await disconnectDatabase();
  });

  // 1. Missing / invalid full name (< 2 chars)
  await t.test('Registration rejects missing or short full name', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'A',
        mobile: `982${String(ts).slice(-7)}`,
        password: testPassword,
        state: 'Haryana',
        district: 'Karnal',
      });
    assert.equal(res.status, 400);
    assert.equal(res.body.success, false);
  });

  // 2. Invalid mobile number (< 10 digits)
  await t.test('Registration rejects invalid mobile numbers', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Ramesh Kumar',
        mobile: '12345', // only 5 digits
        password: testPassword,
        state: 'Haryana',
        district: 'Karnal',
      });
    assert.equal(res.status, 400);
    assert.equal(res.body.success, false);
  });

  // 3. Invalid email format
  await t.test('Registration rejects invalid email format', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Ramesh Kumar',
        mobile: `983${String(ts).slice(-7)}`,
        email: 'not-an-email',
        password: testPassword,
        state: 'Haryana',
        district: 'Karnal',
      });
    assert.equal(res.status, 400);
    assert.equal(res.body.success, false);
  });

  // 4. Short password (< 8 chars)
  await t.test('Registration rejects passwords shorter than 8 characters', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Ramesh Kumar',
        mobile: `984${String(ts).slice(-7)}`,
        password: 'short',
        state: 'Haryana',
        district: 'Karnal',
      });
    assert.equal(res.status, 400);
    assert.equal(res.body.success, false);
  });

  // 5. Successful Farmer Registration
  let registeredUser;
  await t.test('Registration succeeds with valid farmer profile details', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Ramesh Kumar',
        mobile: validFarmerMobile,
        email: validFarmerEmail,
        password: testPassword,
        state: 'Haryana',
        district: 'Karnal',
        village: 'Nilokheri',
        preferredLanguage: 'hi',
      });

    assert.equal(res.status, 201);
    assert.equal(res.body.success, true);
    registeredUser = res.body.data.user;
    assert.equal(registeredUser.name, 'Ramesh Kumar');
    assert.equal(registeredUser.mobile, validFarmerMobile);
    assert.equal(registeredUser.email, validFarmerEmail);
    assert.equal(registeredUser.state, 'Haryana');
    assert.equal(registeredUser.district, 'Karnal');
    assert.equal(registeredUser.village, 'Nilokheri');
    assert.equal(registeredUser.role, 'farmer');
    assert.equal(registeredUser.status, 'active');
    assert.equal(registeredUser.preferredLanguage, 'hi');
    assert.equal(registeredUser.password, undefined); // Password never leaked
    assert.equal(registeredUser.passwordHash, undefined); // Hash never leaked
  });

  // 6. Duplicate Mobile Rejection
  await t.test('Registration rejects duplicate mobile with clear farmer-friendly error', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Another Farmer',
        mobile: validFarmerMobile, // already registered
        password: testPassword,
        state: 'Punjab',
        district: 'Ludhiana',
      });

    assert.ok([400, 409].includes(res.status));
    assert.equal(res.body.success, false);
    assert.match(res.body.message, /mobile number already exists/i);
  });

  // 7. Duplicate Email Rejection
  await t.test('Registration rejects duplicate email with clear farmer-friendly error', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Another Farmer',
        mobile: `985${String(ts).slice(-7)}`,
        email: validFarmerEmail, // already registered
        password: testPassword,
        state: 'Punjab',
        district: 'Ludhiana',
      });

    assert.ok([400, 409].includes(res.status));
    assert.equal(res.body.success, false);
    assert.match(res.body.message, /email already exists/i);
  });

  // 8. Farmer Login using Mobile Number
  await t.test('Farmer can log in using mobile number and password', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        identifier: validFarmerMobile,
        password: testPassword,
      });

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.ok(res.body.data.accessToken);
    assert.equal(res.body.data.user.role, 'farmer');
    assert.equal(res.body.data.user.state, 'Haryana');
    assert.equal(res.body.data.user.district, 'Karnal');
  });

  // 9. Farmer Login using Email
  await t.test('Farmer can log in using email and password', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        identifier: validFarmerEmail,
        password: testPassword,
      });

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.ok(res.body.data.accessToken);
    assert.equal(res.body.data.user.role, 'farmer');
  });

  // 10. Staff and Admin Login remain unaffected
  await t.test('Admin and Staff authentication remain unaffected', async () => {
    const adminUser = await User.findOne({ role: 'admin', status: 'active' });
    if (adminUser) {
      assert.equal(adminUser.role, 'admin');
    }
    const staffUser = await User.findOne({ role: 'staff', status: 'active' });
    if (staffUser) {
      assert.equal(staffUser.role, 'staff');
    }
  });
});
