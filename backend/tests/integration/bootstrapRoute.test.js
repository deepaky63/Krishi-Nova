import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import app from '../../src/app.js';

test('bootstrap route is registered and rejects an invalid secret', async () => {
  const response = await request(app)
    .post('/api/auth/bootstrap')
    .set('X-Bootstrap-Secret', 'incorrect-secret')
    .send({ name: 'Validation Only', email: 'validation-only@example.invalid', password: 'NotUsedPassword123!' });

  assert.equal(response.status, 401);
});
