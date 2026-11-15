import test from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeProjectDraft } from './projectDraft.ts';

test('draft is an exact allowlist, with bounded text and no persistence or ownership fields', () => {
  assert.deepEqual(sanitizeProjectDraft({ title: ' x '.repeat(100), description: 'd'.repeat(3000), projectField: 'f'.repeat(150),
    scope: ' scope ', deliverables: 5, evaluationCriteria: ' criteria ', tools: [' React ', 'React', 9, '', 'x'.repeat(200)],
    id: 'other', companyId: 'other', status: 'OPEN', saveAsDraft: true, deadline: '2030-01-01', projectSupervisorId: 'other', internalName: 'private' }),
  { title: ' x '.repeat(100).trim().slice(0, 100), description: 'd'.repeat(2000), projectField: 'f'.repeat(100), scope: 'scope', evaluationCriteria: 'criteria', tools: ['React', 'x'.repeat(100)] });
  assert.equal(sanitizeProjectDraft({ tools: Array.from({ length: 30 }, (_, i) => `tool${i}`) }).tools?.length, 20);
});

test('malformed drafts and non-array tools cannot throw or become fields', () => {
  for (const value of [null, undefined, false, 8, 'text', [], ['title']]) assert.deepEqual(sanitizeProjectDraft(value), {});
  for (const tools of ['React', {}, 5, null]) assert.deepEqual(sanitizeProjectDraft({ tools, title: 'Safe' }), { title: 'Safe' });
  assert.deepEqual(sanitizeProjectDraft({ title: ' ', tools: [false, {}, null, ' '] }), {});
  assert.equal(sanitizeProjectDraft({ title: '<img src=x onerror=alert(1)>' }).title, '<img src=x onerror=alert(1)>');
});
