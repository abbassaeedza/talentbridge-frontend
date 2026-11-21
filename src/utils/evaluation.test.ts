import assert from 'node:assert/strict';
import test from 'node:test';
import { correctionPayload, gradingPollInterval, windowExpired } from './evaluation.ts';

test('a correction requires an explicit integer 0..20 and a bounded nonblank reason', () => {
  for (const mark of ['', ' ', '-1', '21', '20.1', 'NaN', 'Infinity', '2e1']) assert.equal(correctionPayload(mark, 'Evidence'), null, mark);
  for (const reason of ['', '   ', 'x'.repeat(2001), 'x\0', 'x\u0001', 'x\u000B', 'x\uD800', 'x\uDC00']) assert.equal(correctionPayload('20', reason), null);
  for (let i = 0; i <= 20; i++) assert.deepEqual(correctionPayload(String(i), 'Evidence'), { mark: i, reason: 'Evidence' });
  const reason = ' اردو 😀 e\u0301\t\n\r code \\u0001 ';
  assert.deepEqual(correctionPayload('20', reason), { mark: 20, reason });
  assert.deepEqual(correctionPayload('0', 'x'.repeat(1998) + '😀'), { mark: 0, reason: 'x'.repeat(1998) + '😀' });
});

test('poll only an actual active unfinished run, never terminal or long quota deferrals', () => {
  const running = { status: 'RUNNING', steps: [{ status: 'DISPATCHED' }, { status: 'PENDING' }] };
  assert.equal(gradingPollInterval(running), 2000);
  assert.equal(gradingPollInterval(undefined), false);
  for (const status of ['REVIEW', 'FAILED', 'FINALIZED', 'SUPERSEDED']) assert.equal(gradingPollInterval({ ...running, status }), false);
  assert.equal(gradingPollInterval({ ...running, steps: [{ status: 'DEFERRED' }] }), false);
  assert.equal(gradingPollInterval({ ...running, steps: [{ status: 'FAILED' }] }), false);
  assert.equal(gradingPollInterval({ ...running, steps: [{ status: 'SUCCEEDED' }] }), false);
  assert.equal(gradingPollInterval({ ...running, steps: [] }), false);
  assert.equal(gradingPollInterval({ ...running, steps: [{ status: 'PENDING', errorCode: 'DISPATCH_UNAVAILABLE' }] }), false);
});

test('publication and full expiry are required, including the exact deadline boundary', () => {
  const window = { opensAt: '2026-11-18T12:00:00Z', closesAt: '2026-11-20T12:00:00Z' };
  const closes = Date.parse(window.closesAt);
  assert.equal(windowExpired(window, closes - 1), false);
  assert.equal(windowExpired(window, closes), true);
  assert.equal(windowExpired(window, closes + 1), true);
  assert.equal(windowExpired({ ...window, opensAt: null }, closes), false);
  assert.equal(windowExpired({ ...window, closesAt: null }, closes), false);
});
