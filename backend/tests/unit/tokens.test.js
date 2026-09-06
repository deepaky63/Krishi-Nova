import test from 'node:test';
import assert from 'node:assert/strict';
import { hashToken } from '../../src/utils/tokens.js';

test('token hashes are deterministic and do not expose the source token', () => {
  assert.equal(hashToken('example-token'), hashToken('example-token'));
  assert.notEqual(hashToken('example-token'), 'example-token');
});
