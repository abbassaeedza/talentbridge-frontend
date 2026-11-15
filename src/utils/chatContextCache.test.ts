import test from 'node:test';
import assert from 'node:assert/strict';
import type { ChatContextSnapshot } from '../types/index.ts';
import { createChatContextCache, isChatContextWrite } from './chatContextCache.ts';

const snapshot = (time: number) => ({ snapshotTimeUTC: new Date(time).toISOString() } as ChatContextSnapshot);

test('cold boot: a 48-second load with a one-second-old snapshot is usable, but expires at snapshot age 30s', async () => {
  let now = 0;
  const cache = createChatContextCache(() => now);
  cache.setOwner('a:COMPANY:session');
  const load = async () => { now = 48_000; return snapshot(47_000); };
  assert.equal((await cache.get('a:COMPANY:session', load)).snapshotTimeUTC, snapshot(47_000).snapshotTimeUTC);
  now = 76_999;
  assert.equal((await cache.get('a:COMPANY:session', async () => { throw Error('must be cached'); })).snapshotTimeUTC, snapshot(47_000).snapshotTimeUTC);
  now = 77_000;
  assert.equal((await cache.get('a:COMPANY:session', async () => snapshot(now))).snapshotTimeUTC, snapshot(now).snapshotTimeUTC);
});

test('old/future/invalid snapshot times are rejected on arrival, not cached', async () => {
  const cache = createChatContextCache(() => 48_000);
  cache.setOwner('a');
  for (const time of [18_000, 0, 48_001]) await assert.rejects(cache.get('a', async () => snapshot(time)), /expired/);
  for (const value of [{ snapshotTime: new Date(48_000).toISOString() }, { snapshotTimeUTC: 'invalidZ' }, {}]) {
    await assert.rejects(cache.get('a', async () => value as ChatContextSnapshot), /expired/);
  }
});

test('single flight and invalidation discard stale responses and their finally cannot clear a newer request', async () => {
  const cache = createChatContextCache(() => 1000);
  cache.setOwner('a');
  let complete!: (value: ChatContextSnapshot) => void;
  let loads = 0;
  const load = () => { loads++; return new Promise<ChatContextSnapshot>(resolve => { complete = resolve; }); };
  const first = cache.get('a', load);
  const second = cache.get('a', load);
  assert.equal(loads, 1);
  cache.clear();
  const fresh = await cache.get('a', async () => snapshot(1000));
  complete(snapshot(1000));
  await assert.rejects(first, /invalidated/);
  await assert.rejects(second, /invalidated/);
  assert.equal(await cache.get('a', async () => { throw Error('cached'); }), fresh);
  cache.setOwner('b');
  await assert.rejects(cache.get('a', async () => snapshot(1000)), /session changed/);
});

test('same owner preserves cache, logout/role/session/conversation changes clear it', async () => {
  const cache = createChatContextCache(() => 1000);
  cache.setOwner('a:STUDENT:0');
  const first = await cache.get('a:STUDENT:0', async () => snapshot(1000));
  cache.setOwner('a:STUDENT:0');
  assert.equal(await cache.get('a:STUDENT:0', async () => { throw Error('cached'); }), first);
  for (const owner of ['', 'b:COMPANY:0', 'a:COORDINATOR:0', 'a:STUDENT:1']) {
    cache.setOwner(owner);
    await assert.rejects(cache.get('a:STUDENT:0', async () => snapshot(1000)));
  }
});

test('only relevant mutation endpoints invalidate context, never chat or read-only previews', () => {
  for (const path of ['/api/projects', '/api/projects/id/deadline', '/api/parties/id/apply', '/api/submissions/id/submit', '/api/evaluations/id/finalize', '/api/users/id/approve', '/api/users/me/profile', '/api/company/project-supervisor-invitations']) {
    for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) assert.equal(isChatContextWrite(method, path), true, `${method} ${path}`);
    assert.equal(isChatContextWrite('get', path), false);
  }
  for (const path of ['/api/chat', '/api/chat/context', '/api/auth/refresh', '/api/projects/global-deadline/preview', '/api/users/notifications/read-all', '/api/users/notification-preferences/PROJECT']) assert.equal(isChatContextWrite('post', path), false, path);
});
