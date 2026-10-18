'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { parseJsonBody, getClientIp, sendJson } = require('../lib/http');

test('parseJsonBody handles object, string and invalid bodies', () => {
  assert.deepEqual(parseJsonBody({ body: { ids: ['lava'] } }), { ids: ['lava'] });
  assert.deepEqual(parseJsonBody({ body: '{"ids":["lava"]}' }), { ids: ['lava'] });
  assert.deepEqual(parseJsonBody({ body: '' }), {});
  assert.equal(parseJsonBody({ body: '{not json' }), null);
});

test('getClientIp prefers the first forwarded address', () => {
  assert.equal(getClientIp({ headers: { 'x-forwarded-for': '1.2.3.4, 5.6.7.8' } }), '1.2.3.4');
  assert.equal(getClientIp({ headers: { 'x-real-ip': '9.9.9.9' } }), '9.9.9.9');
  assert.equal(getClientIp({ headers: {}, socket: { remoteAddress: '::1' } }), '::1');
  assert.equal(getClientIp({}), 'unknown');
});

test('sendJson writes no-store JSON with the given status', () => {
  const calls = { headers: {} };
  const res = {
    setHeader: (k, v) => { calls.headers[k] = v; },
    end: (payload) => { calls.payload = payload; },
  };

  sendJson(res, 201, { ok: true });

  assert.equal(res.statusCode, 201);
  assert.equal(calls.headers['Content-Type'], 'application/json; charset=utf-8');
  assert.equal(calls.headers['Cache-Control'], 'no-store, max-age=0');
  assert.deepEqual(JSON.parse(calls.payload), { ok: true });
});
