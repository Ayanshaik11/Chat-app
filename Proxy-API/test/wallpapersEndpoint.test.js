'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const handler = require('../api/wallpapers');

function makeRes() {
  return {
    statusCode: 200,
    headers: {},
    body: undefined,
    setHeader(key, value) {
      this.headers[key] = value;
    },
    end(payload) {
      this.body = payload;
    },
  };
}

function makeReq({ method = 'GET', headers = {}, query = {}, body } = {}) {
  return { method, headers, query, body };
}

async function call(req) {
  const res = makeRes();
  await handler(req, res);
  return res;
}

test('OPTIONS returns 204', async () => {
  const res = await call(makeReq({ method: 'OPTIONS', headers: { 'x-forwarded-for': '10.0.0.1' } }));
  assert.equal(res.statusCode, 204);
  assert.equal(res.headers.Allow, 'GET, POST, OPTIONS');
});

test('unsupported method returns 405', async () => {
  const res = await call(makeReq({ method: 'PUT', headers: { 'x-forwarded-for': '10.0.0.1' } }));
  assert.equal(res.statusCode, 405);
});

test('missing Authorization header returns 401', async () => {
  const res = await call(makeReq({ method: 'GET', headers: { 'x-forwarded-for': '10.0.0.1' } }));
  assert.equal(res.statusCode, 401);
  assert.match(JSON.parse(res.body).error, /bearer/i);
});

test('auth is enforced before the body is parsed', async () => {
  const res = await call(makeReq({
    method: 'POST',
    headers: { 'x-forwarded-for': '10.0.0.1' },
    body: '{invalid json',
  }));
  assert.equal(res.statusCode, 401);
});

test('pre-auth rate limiter eventually returns 429', async () => {
  const headers = { 'x-forwarded-for': '10.0.0.2' };
  let saw401 = false;
  let saw429 = false;

  for (let i = 0; i < 130; i += 1) {
    const res = await call(makeReq({ method: 'GET', headers }));
    if (res.statusCode === 401) saw401 = true;
    if (res.statusCode === 429) {
      saw429 = true;
      break;
    }
  }

  assert.equal(saw401, true);
  assert.equal(saw429, true);
});
