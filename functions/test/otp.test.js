'use strict';
/* DoKit — Email OTP logic tests (functions/test/otp.test.js)
 *
 * WHAT: unit tests for the pure logic in otp.js — code generation,
 * hashing, expiry, rate limits, attempt lockout, validation.
 * No Firebase, no network, no secrets: run with `node --test
 * test/otp.test.js` (or `npm test` in functions/). Node's built-in
 * test runner + assert only.
 *
 * NOT tested here (needs a deploy — see README.md): the HTTP handlers
 * in index.js, the Resend send, and the Firestore transactions. */
var test = require('node:test');
var assert = require('node:assert/strict');
var crypto = require('node:crypto');
var otp = require('../otp');

/* Fixed clock so expiry/rate-limit tests are deterministic. */
var NOW = 1800000000000; /* 2027-01-15T08:00:00Z */
var MIN = 60 * 1000;
var HOUR = 60 * MIN;

test('generateCode: always 6 digits, zero-padded', function () {
  assert.equal(otp.generateCode(function () { return 42; }), '000042');
  assert.equal(otp.generateCode(function () { return 0; }), '000000');
  assert.equal(otp.generateCode(function () { return 999999; }), '999999');
  for (var i = 0; i < 200; i++) {
    var c = otp.generateCode();
    assert.match(c, /^\d{6}$/, 'code must be exactly 6 digits: ' + c);
  }
});

test('generateCode: random codes are (almost) all distinct', function () {
  var seen = new Set();
  for (var i = 0; i < 200; i++) { seen.add(otp.generateCode()); }
  assert.ok(seen.size >= 195, 'expected ~200 distinct codes, got ' + seen.size);
});

test('hashCode: deterministic, 64 hex chars, known SHA-256 vector', function () {
  /* SHA-256("123456") — public known-answer vector. */
  assert.equal(
    otp.hashCode('123456'),
    '8d969eef6ecad3c29a3a629280e686cf0c3f5d5a86aff3ca12020c923adc6c92');
  assert.equal(otp.hashCode('123456'), otp.hashCode('123456'));
  assert.notEqual(otp.hashCode('123456'), otp.hashCode('123457'));
  assert.notEqual(otp.hashCode('123456'), otp.hashCode('654321'));
  assert.match(otp.hashCode('000042'), /^[0-9a-f]{64}$/);
});

test('timingSafeEqualHex: equal / different / length mismatch', function () {
  var h = otp.hashCode('123456');
  assert.equal(otp.timingSafeEqualHex(h, h), true);
  assert.equal(otp.timingSafeEqualHex(h, otp.hashCode('123457')), false);
  assert.equal(otp.timingSafeEqualHex(h, 'abc'), false);
  assert.equal(otp.timingSafeEqualHex('', ''), true);
  assert.equal(otp.timingSafeEqualHex(h, ''), false);
  assert.equal(otp.timingSafeEqualHex(null, null), true);
});

test('resetDocId: deterministic, 64 hex, case-insensitive email', function () {
  var a = otp.resetDocId('User@Example.com');
  var b = otp.resetDocId('user@example.com');
  var c = otp.resetDocId('other@example.com');
  assert.equal(a, b);
  assert.notEqual(a, c);
  assert.match(a, /^[0-9a-f]{64}$/);
  assert.equal(a, crypto.createHash('sha256').update('user@example.com').digest('hex'));
});

test('normalizeEmail / isValidEmail / isValidPassword', function () {
  assert.equal(otp.normalizeEmail('  User@Example.COM '), 'user@example.com');
  assert.equal(otp.normalizeEmail(null), '');
  assert.equal(otp.isValidEmail('user@example.com'), true);
  assert.equal(otp.isValidEmail('user+tag@mail.example.co.uk'), true);
  assert.equal(otp.isValidEmail(''), false);
  assert.equal(otp.isValidEmail('not-an-email'), false);
  assert.equal(otp.isValidEmail('a@b'), false);
  assert.equal(otp.isValidEmail('a@b.c'), false); /* TLD needs 2+ chars */
  assert.equal(otp.isValidEmail('a b@c.com'), false);
  assert.equal(otp.isValidEmail('@x.com'), false);
  assert.equal(otp.isValidPassword('123456'), true);
  assert.equal(otp.isValidPassword('12345'), false);
  assert.equal(otp.isValidPassword(''), false);
  assert.equal(otp.isValidPassword(null), false);
  assert.equal(otp.isValidPassword(123456), false);
});

test('isExpired: past / future / exact boundary', function () {
  assert.equal(otp.isExpired(NOW - 1, NOW), true);
  assert.equal(otp.isExpired(NOW + 1, NOW), false);
  assert.equal(otp.isExpired(NOW, NOW), true); /* now >= expiry counts as expired */
});

test('pruneRequestLog: keeps only the last hour', function () {
  var log = [NOW - 2 * HOUR, NOW - 61 * MIN, NOW - 30 * MIN, NOW - 1000];
  assert.deepEqual(otp.pruneRequestLog(log, NOW), [NOW - 30 * MIN, NOW - 1000]);
  assert.deepEqual(otp.pruneRequestLog(null, NOW), []);
  assert.deepEqual(otp.pruneRequestLog('junk', NOW), []);
});

test('checkRequestRateLimit: empty log allows', function () {
  assert.deepEqual(otp.checkRequestRateLimit([], NOW), { allowed: true, reason: '' });
  assert.deepEqual(otp.checkRequestRateLimit(null, NOW), { allowed: true, reason: '' });
});

test('checkRequestRateLimit: 1 request per minute', function () {
  assert.deepEqual(
    otp.checkRequestRateLimit([NOW - 30 * 1000], NOW),
    { allowed: false, reason: 'too-soon' });
  assert.deepEqual(
    otp.checkRequestRateLimit([NOW - 59 * 1000], NOW),
    { allowed: false, reason: 'too-soon' });
  assert.deepEqual(
    otp.checkRequestRateLimit([NOW - 60 * 1000], NOW),
    { allowed: true, reason: '' });
  assert.deepEqual(
    otp.checkRequestRateLimit([NOW - 5 * MIN], NOW),
    { allowed: true, reason: '' });
});

test('checkRequestRateLimit: 5 requests per hour', function () {
  var five = [NOW - 50 * MIN, NOW - 40 * MIN, NOW - 30 * MIN, NOW - 20 * MIN, NOW - 10 * MIN];
  assert.deepEqual(
    otp.checkRequestRateLimit(five, NOW),
    { allowed: false, reason: 'too-many' });
  var four = [NOW - 50 * MIN, NOW - 40 * MIN, NOW - 30 * MIN, NOW - 20 * MIN];
  assert.deepEqual(otp.checkRequestRateLimit(four, NOW), { allowed: true, reason: '' });
  /* 5 in the log but one is older than an hour -> only 4 count. */
  var fiveWithOld = [NOW - 61 * MIN, NOW - 40 * MIN, NOW - 30 * MIN, NOW - 20 * MIN, NOW - 10 * MIN];
  assert.deepEqual(otp.checkRequestRateLimit(fiveWithOld, NOW), { allowed: true, reason: '' });
});

test('checkVerifyAllowed: missing / used / expired / locked / ok', function () {
  var good = { used: false, expiresAtMs: NOW + 5 * MIN, attempts: 0 };
  assert.deepEqual(otp.checkVerifyAllowed(null, NOW), { allowed: false, reason: 'invalid' });
  assert.deepEqual(
    otp.checkVerifyAllowed({ used: true, expiresAtMs: NOW + 5 * MIN, attempts: 0 }, NOW),
    { allowed: false, reason: 'invalid' });
  assert.deepEqual(
    otp.checkVerifyAllowed({ used: false, expiresAtMs: NOW - 1, attempts: 0 }, NOW),
    { allowed: false, reason: 'invalid' });
  assert.deepEqual(
    otp.checkVerifyAllowed({ used: false, expiresAtMs: NOW + 5 * MIN, attempts: 5 }, NOW),
    { allowed: false, reason: 'locked' });
  assert.deepEqual(
    otp.checkVerifyAllowed({ used: false, expiresAtMs: NOW + 5 * MIN, attempts: 4 }, NOW),
    { allowed: true, reason: '' });
  assert.deepEqual(otp.checkVerifyAllowed(good, NOW), { allowed: true, reason: '' });
});

test('buildResetDoc: shape, 10-min expiry, fresh attempt budget', function () {
  var doc = otp.buildResetDoc({
    email: 'User@Example.com', uid: 'uid-1', codeHash: 'abc', nowMs: NOW,
    requestLog: [NOW - 5 * MIN, NOW]
  });
  assert.equal(doc.email, 'user@example.com');
  assert.equal(doc.uid, 'uid-1');
  assert.equal(doc.codeHash, 'abc');
  assert.equal(doc.expiresAtMs, NOW + 10 * MIN);
  assert.equal(doc.attempts, 0);
  assert.equal(doc.used, false);
  assert.equal(doc.createdAtMs, NOW);
  assert.deepEqual(doc.requestLog, [NOW - 5 * MIN, NOW]);
  /* Default log is [now] when the caller passes none. */
  var doc2 = otp.buildResetDoc({ email: 'a@b.com', uid: null, codeHash: 'x', nowMs: NOW });
  assert.deepEqual(doc2.requestLog, [NOW]);
  assert.equal(doc2.uid, null);
});

test('constants: limits match the documented values', function () {
  assert.equal(otp.OTP_LENGTH, 6);
  assert.equal(otp.OTP_TTL_MS, 10 * 60 * 1000);
  assert.equal(otp.OTP_MAX_ATTEMPTS, 5);
  assert.equal(otp.OTP_REQUEST_MIN_GAP_MS, 60 * 1000);
  assert.equal(otp.OTP_REQUESTS_PER_HOUR, 5);
  assert.equal(otp.OTP_MIN_PASSWORD_LEN, 6);
});
