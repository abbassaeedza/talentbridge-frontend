import { expect, test, type Page } from '@playwright/test';

const fixedNow = new Date('2026-08-15T10:00:00.000Z');
const coordinator = {
  id: '00000000-0000-0000-0000-000000000001',
  email: 'coordinator@talentbridge.com',
  firstName: 'Demo',
  lastName: 'Coordinator',
  role: 'COORDINATOR',
  status: 'APPROVED',
  onboardingComplete: true,
};
const openProject = {
  id: '00000000-0000-0000-0000-000000000003',
  title: 'AI Support Copilot',
  description: 'Build a focused support workspace for customer service teams.',
  scope: 'Deliver searchable guidance, case context, and suggested responses.',
  deliverables: 'Working application, repository, tests, and setup documentation.',
  evaluationCriteria: 'Usability, response quality, maintainability, and scope alignment.',
  tools: ['React', 'Spring Boot', 'PostgreSQL'],
  status: 'OPEN',
  deadline: '2026-09-30T10:00:00.000Z',
  companyName: 'Nexa Systems',
  companyIndustry: 'Software',
  partyApplicationCount: 4,
  createdAt: '2026-07-31T10:00:00.000Z',
};
const company = {
  id: '00000000-0000-0000-0000-000000000020',
  email: 'projects@nexa.example',
  firstName: 'Nexa',
  lastName: 'Systems',
  role: 'COMPANY',
  status: 'APPROVED',
  onboardingComplete: true,
};

async function setTheme(page: Page, theme: 'light' | 'dark') {
  await page.addInitScript((value) => localStorage.setItem('talentbridge-theme', value), theme);
  await page.clock.setFixedTime(fixedNow);
}

async function authenticate(page: Page, user = company) {
  await page.addInitScript(() => localStorage.setItem('accessToken', 'visual-checkpoint-token'));
  await page.route('**/api/users/me', route => route.fulfill({ contentType: 'application/json', body: JSON.stringify(user) }));
  await page.route('**/api/users/notifications**', route => route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify({ notifications: [], unreadCount: 0 }),
  }));
}

async function mockCoordinatorApi(page: Page) {
  const students = Array.from({ length: 12 }, (_, index) => ({
    id: `student-${index + 1}`,
    email: index ? `student${index + 1}@talentbridge.test` : 'carol.iqbal@talentbridge.test',
    firstName: index ? `Student ${index + 1}` : 'Carol',
    lastName: index ? 'Demo' : 'Iqbal',
    role: 'STUDENT',
    status: index < 4 ? 'PENDING' : index < 10 ? 'APPROVED' : 'SUSPENDED',
    createdAt: '2026-08-01T10:00:00.000Z',
  }));
  await page.route('**/api/auth/demo-login', route => route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify({ accessToken: 'demo-token', refreshToken: 'refresh-token', tokenType: 'Bearer', user: coordinator }),
  }));
  await page.route('**/api/users/me', route => route.fulfill({ contentType: 'application/json', body: JSON.stringify(coordinator) }));
  await page.route('**/api/users/notifications**', route => route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify({
      notifications: [
        { id: 'notification-1', title: 'Project awaiting review', message: 'AI Support Copilot needs review.', read: false, createdAt: '2026-08-15T09:30:00.000Z' },
        { id: 'notification-2', title: 'Deadline scheduled', message: 'A project deadline was updated.', read: true, createdAt: '2026-08-14T09:30:00.000Z' },
      ],
      unreadCount: 1,
    }),
  }));
  await page.route('**/api/users/pending**', route => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ content: students.filter(user => user.status === 'PENDING'), totalElements: 4, totalPages: 1 }) }));
  await page.route('**/api/users/students', route => route.fulfill({ contentType: 'application/json', body: JSON.stringify(students) }));
  await page.route('**/api/users/companies', route => route.fulfill({ contentType: 'application/json', body: '[]' }));
  await page.route('**/api/users/supervisors', route => route.fulfill({ contentType: 'application/json', body: '[]' }));
  await page.route('**/api/users/coordinators', route => route.fulfill({ contentType: 'application/json', body: '[]' }));
  await page.route('**/api/projects/all**', route => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ content: [openProject], totalElements: 1, totalPages: 1 }) }));
  await page.route('**/api/parties/all', route => route.fulfill({ contentType: 'application/json', body: '[]' }));
  await page.route('**/api/parties/rules', route => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ minSize: 2, maxSize: 4, supervisorMaxParties: 2 }) }));
  await page.route('**/api/coordinator/analytics', route => route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify({
      projectsByStatus: { OPEN: 6, ASSIGNED: 4, PENDING_REVIEW: 2 },
      usersByRole: { STUDENT: 42, COMPANY: 8, PARTY_SUPERVISOR: 6, PROJECT_SUPERVISOR: 5 },
      usersByStatus: { APPROVED: 53, PENDING: 8, SUSPENDED: 1 },
      submissionsByStatus: { DRAFT: 2, SUBMITTED: 3, EVALUATED: 5 },
      totalParties: 14,
      assignedParties: 9,
      unassignedParties: 5,
      finalizedEvaluations: 4,
      draftEvaluations: 1,
    }),
  }));
}

async function loginAsCoordinator(page: Page) {
  await page.goto('/login');
  await page.getByRole('button', { name: 'Open coordinator demo' }).click();
  await expect(page.getByRole('heading', { name: 'Overview' })).toBeVisible();
}

test('login desktop light', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await setTheme(page, 'light');
  await page.goto('/login');
  await expect(page).toHaveScreenshot('login-desktop-light.png', { animations: 'disabled' });
});

test('registration mobile dark', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await setTheme(page, 'dark');
  await page.goto('/register');
  await expect(page.getByRole('heading', { name: 'Create an account' })).toBeVisible();
  await expect(page).toHaveScreenshot('registration-mobile-dark.png', { animations: 'disabled' });
});

test('coordinator dashboard desktop dark', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await setTheme(page, 'dark');
  await mockCoordinatorApi(page);
  await loginAsCoordinator(page);
  await expect(page).toHaveScreenshot('coordinator-dashboard-desktop-dark.png', { animations: 'disabled' });
});

test('student directory desktop light', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await setTheme(page, 'light');
  await mockCoordinatorApi(page);
  await loginAsCoordinator(page);
  await page.getByRole('link', { name: 'Students', exact: true }).click();
  await expect(page.getByText('12 of 12 students shown')).toBeVisible();
  await page.getByRole('checkbox', { name: /Select all .* filtered students/ }).check({ force: true });
  await expect(page.getByText(/selected/).last()).toBeVisible();
  await expect(page).toHaveScreenshot('student-directory-desktop-light.png', { animations: 'disabled' });
});

test('company project form desktop light', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await setTheme(page, 'light');
  await authenticate(page);
  await page.route('**/api/company/project-supervisors', route => route.fulfill({ contentType: 'application/json', body: '[]' }));
  await page.goto('/company/projects/new');
  await expect(page.getByRole('heading', { name: 'Create project' })).toBeVisible();
  await expect(page).toHaveScreenshot('company-project-form-desktop-light.png', { animations: 'disabled' });
});

test('shared project detail desktop dark', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await setTheme(page, 'dark');
  await authenticate(page, coordinator);
  await page.route(`**/api/projects/${openProject.id}`, route => route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify({
      ...openProject,
      status: 'ASSIGNED',
      assignedPartyId: '00000000-0000-0000-0000-000000000042',
      assignedPartyName: 'Team Catalyst',
      projectSupervisorId: '00000000-0000-0000-0000-000000000043',
      projectSupervisorName: 'Maya Chen',
    }),
  }));
  await page.goto(`/coordinator/projects/${openProject.id}`);
  await expect(page.getByRole('heading', { name: openProject.title })).toBeVisible();
  await expect(page).toHaveScreenshot('project-detail-desktop-dark.png', { animations: 'disabled' });
});

test('mobile shell notifications light', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await setTheme(page, 'light');
  await mockCoordinatorApi(page);
  await loginAsCoordinator(page);
  await page.getByRole('button', { name: 'Notifications' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page).toHaveScreenshot('mobile-notifications-light.png', { animations: 'disabled' });
});

test('mobile chatbot dark', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await setTheme(page, 'dark');
  await mockCoordinatorApi(page);
  await loginAsCoordinator(page);
  await page.getByRole('button', { name: 'Open AI assistant' }).click();
  await expect(page.getByTestId('chat-panel')).toBeVisible();
  await expect(page).toHaveScreenshot('mobile-chatbot-dark.png', { animations: 'disabled' });
});
