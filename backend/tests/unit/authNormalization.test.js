import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeIdentifier } from '../../src/services/auth/authService.js';

test('normalizes email identifiers before lookup', () => {
  assert.deepEqual(normalizeIdentifier('  FARMER@EXAMPLE.COM '), { email: 'farmer@example.com' });
});

test('normalizes mobile identifiers before lookup', () => {
  assert.deepEqual(normalizeIdentifier(' +91 98765 43210 '), { mobile: '9876543210' });
});
