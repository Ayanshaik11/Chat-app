'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { createRateLimiter } = require('../lib/rateLimit');

test('allows up to max then blocks with a retry hint', () => {
  const limit = createRateLimiter({ max: 3, windowMs: 60_000 });

  assert.equal(limit('user-a').ok, true);
  assert.equal(limit('user-a').ok, true);
  assert.equal(limit('user-a').ok, true);

  const blocked = limit('user-a');
  assert.equal(blocked.ok, false);
  assert.ok(blocked.retryAfter >= 1);
});

test('tracks keys independently', () => {
  const limit = createRateLimiter({ max: 1, windowMs: 60_000 });
  assert.equal(limit('a').ok, true);
  assert.equal(limit('b').ok, true);
  assert.equal(limit('a').ok, false);
});

test('window resets after it elapses', async () => {
  const limit = createRateLimiter({ max: 1, windowMs: 15 });
  assert.equal(limit('x').ok, true);
  assert.equal(limit('x').ok, false);
  await new Promise((resolve) => setTimeout(resolve, 25));
  assert.equal(limit('x').ok, true);
});

test('falls back to a safe key for missing values', () => {
  const limit = createRateLimiter({ max: 2, windowMs: 60_000 });
  assert.equal(limit(undefined).ok, true);
  assert.equal(limit(undefined).ok, true);
  assert.equal(limit(undefined).ok, false);
});
