import test from 'node:test';
import assert from 'node:assert/strict';
import { checkRateLimit, rateLimitMessage, RATE_LIMITS } from '../server/rate-limit.js';

test('per-minute AI limit allows 14 requests and rejects the 16th', function () {
  assert.equal(checkRateLimit({ minuteCount: 14, dailyCount: 0 }).allowed, true);
  const result = checkRateLimit({ minuteCount: 15, dailyCount: 0 });
  assert.deepEqual(result, { allowed: false, reason: 'minute' });
  assert.match(rateLimitMessage(result.reason), /Dakikada en fazla 15/);
  assert.equal(RATE_LIMITS.perMinute, 15);
});

test('daily AI limit allows request 300 and rejects request 301', function () {
  assert.equal(checkRateLimit({ minuteCount: 0, dailyCount: 299 }).allowed, true);
  const result = checkRateLimit({ minuteCount: 0, dailyCount: 300 });
  assert.deepEqual(result, { allowed: false, reason: 'daily' });
  assert.match(rateLimitMessage(result.reason), /Günlük 300/);
  assert.equal(RATE_LIMITS.perDay, 300);
});
