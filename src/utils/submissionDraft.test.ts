import assert from 'node:assert/strict';
import { test } from 'node:test';
import { canFinalizeSubmission, matchesSavedDraft, submissionFields } from './submissionDraft.ts';

const saved = { id: 'saved', status: 'DRAFT' as const, version: 7, repoUrl: 'https://github.com/example/repo', repoBranch: 'main', notes: 'Saved', documentUrls: ['one.pdf'] };
const fields = { repoUrl: saved.repoUrl, branch: 'main', notes: 'Saved' };

test('finalization requires the exact saved draft, a version, leader and idle requests', () => {
  assert.equal(canFinalizeSubmission(saved, fields, 0, true, false), true);
  for (const changed of [{ repoUrl: '' }, { branch: '' }, { notes: '' }]) {
    assert.equal(canFinalizeSubmission(saved, { ...fields, ...changed }, 0, true, false), false);
  }
  assert.equal(canFinalizeSubmission(saved, fields, 1, true, false), false);
  assert.equal(canFinalizeSubmission(saved, fields, 0, false, false), false);
  assert.equal(canFinalizeSubmission(saved, fields, 0, true, true), false);
  assert.equal(canFinalizeSubmission({ ...saved, version: undefined }, fields, 0, true, false), false);
  assert.equal(canFinalizeSubmission(null, fields, 0, true, false), false);
});

test('server-retained optional values never make cleared local fields clean', () => {
  assert.equal(matchesSavedDraft(saved, { ...fields, branch: '' }, 0), false);
  assert.equal(matchesSavedDraft(saved, { ...fields, notes: '' }, 0), false);
  assert.equal(matchesSavedDraft({ ...saved, notes: '' }, { ...fields, notes: '' }, 0), true);
  assert.equal(submissionFields({ ...saved, repoBranch: undefined }).branch, '');
  assert.equal(submissionFields(null).branch, 'main');
});
