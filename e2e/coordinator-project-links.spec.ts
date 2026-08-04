import { expect, test } from '@playwright/test';

const project = {
  id: 'project-id', title: 'AI Support Copilot', description: 'Build a support assistant.',
  tools: ['React'], status: 'ASSIGNED', companyName: 'Nexa Systems', createdByName: 'Nexa Systems',
  assignedPartyId: 'party-id', assignedPartyName: 'Team Orbit',
  projectSupervisorId: 'supervisor-id', projectSupervisorName: 'Sara Khan', partyApplicationCount: 1,
};

test('coordinator sees linked party and supervisor assignments', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('accessToken', 'coordinator-test-token'));
  await page.route('**/api/users/me', route => route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify({ id: 'coordinator-id', email: 'coordinator@example.com', firstName: 'System', lastName: 'Coordinator', role: 'COORDINATOR', status: 'APPROVED' }),
  }));
  await page.route('**/api/users/notifications**', route => route.fulfill({
    contentType: 'application/json', body: JSON.stringify({ notifications: [], unreadCount: 0 }),
  }));
  await page.route('**/api/projects/global-deadline', route => route.fulfill({
    contentType: 'application/json', body: JSON.stringify({ enabled: false, deadline: null }),
  }));
  await page.route('**/api/projects/all**', route => route.fulfill({
    contentType: 'application/json', body: JSON.stringify({ content: [project], totalPages: 1, totalElements: 1, page: 0, size: 20, first: true, last: true }),
  }));
  await page.route('**/api/projects/project-id', route => route.fulfill({
    contentType: 'application/json', body: JSON.stringify(project),
  }));
  await page.route('**/api/users/students', route => route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify([{ id: 'student-id', email: 'student@example.com', firstName: 'Demo', lastName: 'Student', role: 'STUDENT', status: 'APPROVED', partyId: 'party-id', partyName: 'Team Orbit', studentProfile: { university: 'Demo University', major: 'Computer Science', skills: [] } }]),
  }));

  await page.goto('/coordinator/projects');
  await expect(page.getByRole('link', { name: 'Team Orbit' })).toHaveAttribute('href', '/coordinator/parties?party=party-id');
  await expect(page.getByRole('link', { name: 'Sara Khan' })).toHaveAttribute('href', '/coordinator/supervisors?section=PROJECT_SUPERVISOR&supervisor=supervisor-id');
  await page.getByRole('link', { name: 'AI Support Copilot' }).click();
  await expect(page.getByRole('heading', { name: 'AI Support Copilot' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Team Orbit' })).toHaveAttribute('href', '/coordinator/parties?party=party-id');

  await page.goto('/coordinator/students');
  await expect(page.getByRole('link', { name: 'Team Orbit' })).toHaveAttribute('href', '/coordinator/parties?party=party-id');
});
