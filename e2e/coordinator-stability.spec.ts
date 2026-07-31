import { expect, test } from '@playwright/test';
import type { Page, Route } from '@playwright/test';

const coordinator = {
  id: '00000000-0000-0000-0000-000000000001',
  email: 'coordinator@talentbridge.com',
  firstName: 'Demo',
  lastName: 'Coordinator',
  role: 'COORDINATOR',
  status: 'APPROVED',
  onboardingComplete: true,
};

const pendingStudents = Array.from({ length: 25 }, (_, index) => ({
  id: `00000000-0000-0000-0000-${String(index + 2).padStart(12, '0')}`,
  email: index === 0
    ? 'pending.student@talentbridge.com'
    : `pending${index + 1}.student@talentbridge.com`,
  firstName: index === 0 ? 'Pending' : `Pending${index + 1}`,
  lastName: 'Student',
  role: 'STUDENT',
  status: 'PENDING',
  createdAt: '2026-07-31T10:00:00.000Z',
}));

const openProject = {
  id: '00000000-0000-0000-0000-000000000003',
  title: 'AI Support Copilot',
  description: 'A representative open demo project.',
  scope: 'Build a support assistant.',
  deliverables: 'Working application.',
  evaluationCriteria: 'Quality and usability.',
  tools: ['React', 'Spring Boot'],
  status: 'OPEN',
  deadline: '2030-01-01T10:00:00.000Z',
  companyName: 'Nexa Systems',
  createdByName: 'Nexa Systems',
  partyApplicationCount: 0,
  createdAt: '2026-07-31T10:00:00.000Z',
};

const demoNotifications = Array.from({ length: 12 }, (_, index) => ({
  id: `00000000-0000-0000-0001-${String(index + 1).padStart(12, '0')}`,
  type: 'GENERAL',
  title: `Demo notification ${index + 1}`,
  message: 'Representative demo data is available.',
  read: true,
  createdAt: '2026-07-31T10:00:00.000Z',
}));

const pageResponse = <T>(content: T[]) => ({
  content,
  totalPages: 1,
  totalElements: content.length,
  page: 0,
  size: 100,
  first: true,
  last: true,
});

type CoordinatorApiOptions = {
  onProjects?: (route: Route) => void | Promise<void>;
  onGlobalDeadline?: (route: Route) => void | Promise<void>;
};

async function loginAsCoordinator(page: Page) {
  await page.goto('/login');
  await page.getByRole('button', { name: /Coordinator/ }).click();
  await expect(page).toHaveURL(/\/coordinator\/dashboard$/);
  await expect(page.getByRole('heading', { name: 'Coordinator Dashboard' })).toBeVisible();
}

async function mockCoordinatorApi(page: Page, options: CoordinatorApiOptions = {}) {
  await page.route('**/api/auth/demo-login', route => route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify({
      accessToken: 'demo-access-token',
      refreshToken: 'demo-refresh-token',
      tokenType: 'Bearer',
      user: coordinator,
    }),
  }));
  await page.route('**/api/users/me', route => route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify(coordinator),
  }));
  await page.route('**/api/users/notifications**', route => route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify({ notifications: demoNotifications, unreadCount: 0 }),
  }));
  await page.route('**/api/users/pending**', route => route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify(pageResponse(pendingStudents)),
  }));
  for (const path of ['students', 'companies', 'supervisors', 'coordinators']) {
    await page.route(`**/api/users/${path}`, route => route.fulfill({
      contentType: 'application/json',
      body: '[]',
    }));
  }
  await page.route('**/api/projects/all**', route => options.onProjects
    ? options.onProjects(route)
    : route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify(pageResponse([openProject])),
      }));
  await page.route('**/api/projects/global-deadline', route => options.onGlobalDeadline
    ? options.onGlobalDeadline(route)
    : route.fulfill({ contentType: 'application/json', body: '{}' }));
  await page.route('**/api/parties/all', route => route.fulfill({
    contentType: 'application/json',
    body: '[]',
  }));
  await page.route('**/api/coordinator/analytics', route => route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify({
      projectsByStatus: {},
      usersByRole: {},
      usersByStatus: {},
      submissionsByStatus: {},
      totalParties: 0,
      assignedParties: 0,
      unassignedParties: 0,
      finalizedEvaluations: 0,
      draftEvaluations: 0,
    }),
  }));
}

test('navigates from Dashboard to Users without blanking', async ({ page }) => {
  const errors: Error[] = [];
  page.on('pageerror', error => errors.push(error));
  await mockCoordinatorApi(page);
  const pendingRequest = page.waitForRequest(request =>
    request.url().includes('/api/users/pending') && request.method() === 'GET',
  );
  await loginAsCoordinator(page);
  expect(new URL((await pendingRequest).url()).searchParams.get('size')).toBe('100');

  await page.getByRole('link', { name: 'Users', exact: true }).click();

  await expect(page.getByRole('heading', { name: 'Manage Users' })).toBeVisible();
  await expect(page.getByText('pending.student@talentbridge.com').first()).toBeVisible();
  await expect(page.getByText(/25 users.*25 pending approvals/)).toBeVisible();
  expect(errors).toEqual([]);
});

test('shows a new global deadline without reloading', async ({ page }) => {
  let deadline = openProject.deadline;
  let projectFetches = 0;
  await mockCoordinatorApi(page, {
    onProjects: route => {
      projectFetches += 1;
      return route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify(pageResponse([{ ...openProject, deadline }])),
      });
    },
    onGlobalDeadline: async route => {
      deadline = (await route.request().postDataJSON()).deadline;
      return route.fulfill({ contentType: 'application/json', body: '{}' });
    },
  });
  await loginAsCoordinator(page);
  await page.getByRole('link', { name: 'Projects', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Manage Projects' })).toBeVisible();
  const fetchesBeforeApply = projectFetches;

  await page.locator('input[type="datetime-local"]').first().fill('2031-01-02T10:00');
  await page.getByRole('button', { name: 'Apply' }).click();

  await expect.poll(() => projectFetches).toBeGreaterThan(fetchesBeforeApply);
  await expect(page.getByText(/02 Jan 2031/)).toBeVisible();
});

test('keeps notifications visible and closes the mobile sidebar', async ({ page }) => {
  await page.setViewportSize({ width: 800, height: 400 });
  await mockCoordinatorApi(page);
  await loginAsCoordinator(page);

  await page.getByRole('button', { name: 'Open sidebar' }).click();
  await expect(page.getByRole('button', { name: 'Close sidebar', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Notifications' }).click();

  await expect(page.getByRole('button', { name: 'Close sidebar overlay' })).toBeHidden();
  const box = await page.locator('#notification-panel').boundingBox();
  expect(box).not.toBeNull();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(800);
  expect(box!.y).toBeGreaterThanOrEqual(0);
  expect(box!.y + box!.height).toBeLessThanOrEqual(400);
});

test('shows a safe backend chatbot failure', async ({ page }) => {
  await mockCoordinatorApi(page);
  await page.route('**/api/chat', route => route.fulfill({
    status: 503,
    contentType: 'application/json',
    body: JSON.stringify({ message: 'AI service is temporarily unavailable' }),
  }));
  await loginAsCoordinator(page);

  await page.getByRole('button', { name: 'Open AI assistant' }).click();
  await page.getByPlaceholder('Ask anything…').fill('Explain this project');
  await page.getByRole('button', { name: 'Send message' }).click();

  await expect(page.getByText('AI service is temporarily unavailable')).toBeVisible();
});

test('uses a safe fallback for malformed chatbot errors', async ({ page }) => {
  await mockCoordinatorApi(page);
  await page.route('**/api/chat', route => route.fulfill({
    status: 503,
    contentType: 'application/json',
    body: JSON.stringify({ message: { detail: 'unsafe' } }),
  }));
  await loginAsCoordinator(page);

  await page.getByRole('button', { name: 'Open AI assistant' }).click();
  await page.getByPlaceholder('Ask anything…').fill('Explain this project');
  await page.getByRole('button', { name: 'Send message' }).click();

  await expect(page.getByText('Sorry, I ran into an error. Please try again.')).toBeVisible();
});
