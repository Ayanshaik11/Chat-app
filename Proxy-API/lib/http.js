'use strict';

/* KING X — tiny request/response helpers shared by the API routes. */

/**
 * Send a JSON response. Never caches (responses contain signed URLs / errors).
 */
function sendJson(res, status, body, extraHeaders) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  if (extraHeaders) {
    for (const [key, value] of Object.entries(extraHeaders)) res.setHeader(key, value);
  }
  res.end(JSON.stringify(body));
}

/**
 * Parse a JSON request body defensively.
 * Vercel parses JSON bodies automatically, but a raw string is handled too.
 *
 * @returns {object|null} the parsed body, or `null` when it isn't valid JSON.
 */
function parseJsonBody(req) {
  const body = req?.body;
  if (body === undefined || body === null || body === '') return {};
  if (typeof body === 'object') return body;
  if (typeof body === 'string') {
    try {
      const parsed = JSON.parse(body);
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return null;
    }
  }
  return {};
}

/** Best-effort client IP for pre-auth rate limiting (Vercel sets these). */
function getClientIp(req) {
  const forwarded = req?.headers?.['x-forwarded-for'] || req?.headers?.['x-real-ip'];
  if (typeof forwarded === 'string' && forwarded) {
    return forwarded.split(',')[0].trim();
  }
  return req?.socket?.remoteAddress || 'unknown';
}

module.exports = { sendJson, parseJsonBody, getClientIp };
