import assert from 'node:assert/strict';
import { test } from 'node:test';
import { answerPayload, boundedAnswer, questionnaireIsOpen, sameAnswers } from './questionnaireDraft.ts';

test('every save carries all five IDs, including blank drafts', () => {
  const questions = Array.from({ length: 5 }, (_, i) => ({ id: `q${i}`, answer: i ? '' : 'One' }));
  assert.deepEqual(answerPayload(questions), questions.map(q => ({ questionId: q.id, text: q.answer })));
  assert.equal(sameAnswers(answerPayload(questions), answerPayload(questions)), true);
  assert.equal(sameAnswers(answerPayload(questions), [{ questionId: 'q0', text: 'Newer edit' }]), false);
});

test('calibrated deadline closes at the exact boundary and server noneditable wins', () => {
  const window = { editable: true, opensAt: '2026-11-21T00:00:00Z', closesAt: '2026-11-23T00:00:00Z' };
  const end = Date.parse(window.closesAt);
  assert.equal(questionnaireIsOpen(window, end - 1), true);
  assert.equal(questionnaireIsOpen(window, end), false);
  assert.equal(questionnaireIsOpen({ ...window, editable: false }, end - 1), false);
  assert.equal(questionnaireIsOpen({ ...window, closesAt: null }, end - 1), false);
  assert.equal(questionnaireIsOpen(window, Date.parse(window.opensAt) - 1), false);
});

test('clamping a valid emoji at the UTF16 limit never leaves a dangling surrogate', () => {
  assert.equal(boundedAnswer('a'.repeat(1999) + '😀'), 'a'.repeat(1999));
  assert.equal(boundedAnswer('a'.repeat(1998) + '😀'), 'a'.repeat(1998) + '😀');
  assert.equal(boundedAnswer('a'.repeat(2001)).length, 2000);
  assert.equal(boundedAnswer('Keep\0text\uD800'), 'Keep\0text\uD800');
});
