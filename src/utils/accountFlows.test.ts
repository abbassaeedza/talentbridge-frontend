import test from 'node:test';
import assert from 'node:assert/strict';
import { profileUpdatePayload, invitationReturnPath } from './accountFlows.ts';

test('profile payload is an editable allowlist for the current role, never identity or cross-role fields', () => {
  const form = { firstName: 'Mira', lastName: 'Fixture', phoneNumber: '', university: 'University', skills: [], gpa: 0,
    companyName: 'Company', industry: 'Software', id: 'other', email: 'other@example.test', role: 'COORDINATOR',
    status: 'APPROVED', password: 'forbidden', companyId: 'other', githubUsername: 'forbidden', githubAccessToken: 'forbidden' };
  assert.deepEqual(profileUpdatePayload('STUDENT', form), { firstName: 'Mira', lastName: 'Fixture', phoneNumber: '', university: 'University', skills: [], gpa: 0 });
  assert.deepEqual(profileUpdatePayload('COMPANY', form), { firstName: 'Mira', lastName: 'Fixture', phoneNumber: '', companyName: 'Company', industry: 'Software' });
  assert.deepEqual(profileUpdatePayload('COORDINATOR', form), { firstName: 'Mira', lastName: 'Fixture', phoneNumber: '' });
});

test('profile payload preserves omissions and explicit clears including zero GPA', () => {
  assert.deepEqual(profileUpdatePayload('STUDENT', { gpa: '0', bio: '', phoneNumber: null, major: undefined }), { gpa: 0, bio: '', phoneNumber: null });
  assert.deepEqual(profileUpdatePayload('STUDENT', { gpa: '' }), { gpa: null });
  assert.deepEqual(profileUpdatePayload('STUDENT', { gpa: null }), { gpa: null });
  assert.deepEqual(profileUpdatePayload('STUDENT', {}), {});
});

test('login return path allows only internal invitation URLs', () => {
  assert.equal(invitationReturnPath('?returnTo=%2Fproject-supervisor-invitations%2Ftoken-123_abc'), '/project-supervisor-invitations/token-123_abc');
  for (const path of ['https://example.test', '//example.test', '/coordinator/dashboard', '/project-supervisor-invitations/token?redirect=evil', '/project-supervisor-invitations/../login']) {
    assert.equal(invitationReturnPath(`?returnTo=${encodeURIComponent(path)}`), '/dashboard');
  }
  assert.equal(invitationReturnPath(''), '/dashboard');
});
