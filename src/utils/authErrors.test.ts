import assert from 'node:assert/strict';
import test from 'node:test';
import { AxiosError, type AxiosResponse } from 'axios';
import { isAuthRejection } from './authErrors.ts';

test('only definitive credential rejection invalidates auth, not network or startup failures', () => {
  for (const status of [400, 401, 403]) {
    assert.equal(isAuthRejection(new AxiosError('', undefined, undefined, undefined, { status } as AxiosResponse)), true);
  }
  for (const status of [408, 429, 500, 502, 503, 504]) {
    assert.equal(isAuthRejection(new AxiosError('', undefined, undefined, undefined, { status } as AxiosResponse)), false);
  }
  assert.equal(isAuthRejection(new AxiosError('Network Error', 'ERR_NETWORK')), false);
  assert.equal(isAuthRejection(new AxiosError('timeout', 'ECONNABORTED')), false);
  assert.equal(isAuthRejection(new Error('Session changed during refresh')), false);
});
