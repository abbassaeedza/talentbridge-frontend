import assert from 'node:assert/strict';
import test from 'node:test';
import { defaultAvatarUrl } from './avatar.ts';

const approvedAvatars = new Set([
  'https://heroui-assets.nyc3.cdn.digitaloceanspaces.com/avatars/purple.jpg',
  'https://heroui-assets.nyc3.cdn.digitaloceanspaces.com/avatars/red.jpg',
  'https://heroui-assets.nyc3.cdn.digitaloceanspaces.com/avatars/blue.jpg',
]);

test('default avatars are deterministic approved HeroUI assets', () => {
  const first = defaultAvatarUrl('student-1');
  assert.equal(first, defaultAvatarUrl('student-1'));
  assert.ok(approvedAvatars.has(first));
});
