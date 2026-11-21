import { expect, test } from '@playwright/test';
import { sessionToken } from './helpers/questionnaires';

test('student edits and saves a compact submission response without a blank page', async ({ page }) => {
  const pageErrors: Error[] = [];
  page.on('pageerror', error => pageErrors.push(error));
  await page.addInitScript(token => localStorage.setItem('accessToken', token), sessionToken('student@example.com'));
  await page.route('**/api/users/me', route => route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify({
      id: 'student-id', email: 'student@example.com', firstName: 'Demo', lastName: 'Student',
      role: 'STUDENT', status: 'APPROVED', onboardingComplete: true,
      studentProfile: { university: 'Demo University', major: 'Computer Science', skills: ['React'] },
    }),
  }));
  await page.route('**/api/users/notifications**', route => route.fulfill({
    contentType: 'application/json', body: JSON.stringify({ notifications: [], unreadCount: 0 }),
  }));
  await page.route('**/api/parties/my', route => route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify({ id: 'party-id', name: 'Team Orbit', leader: { id: 'student-id' }, assignedProjectId: 'project-id', assignedProjectTitle: 'AI Support Copilot' }),
  }));
  const submission = { id: 'submission-id', partyId: 'party-id', partyName: 'Team Orbit', projectId: 'project-id', projectTitle: 'AI Support Copilot', status: 'DRAFT', version: 7, documentUrls: [], repoUrl: 'https://github.com/example/orbit', repoBranch: 'main' };
  await page.route('**/api/submissions/party-id/draft', route => route.fulfill({
    contentType: 'application/json', body: JSON.stringify({ ...submission, repoBranch: 'release', version: 8 }),
  }));
  await page.route('**/api/submissions/party-id', async route => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify(submission),
    });
  });

  await page.goto('/student/submission');
  await expect(page.getByRole('heading', { name: 'Project Submission' })).toBeVisible();
  await page.getByLabel('Branch').fill('release');
  await page.getByRole('button', { name: 'Save Draft' }).click();
  await expect(page.getByText('Draft saved!')).toBeVisible();
  expect(pageErrors).toEqual([]);
});
