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
  onParties?: (route: Route) => void | Promise<void>;
};

async function loginAsCoordinator(page: Page) {
  await page.goto('/login');
  await page.getByRole('button', { name: 'Open coordinator demo' }).click();
  await expect(page).toHaveURL(/\/coordinator\/dashboard$/);
  await expect(page.getByRole('heading', { name: 'Overview' })).toBeVisible();
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
      body: JSON.stringify(path === 'students' ? pendingStudents : []),
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
    : route.fulfill({ contentType: 'application/json', body: JSON.stringify({ enabled: false, deadline: null }) }));
  await page.route('**/api/projects/global-deadline/preview', route => route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify({
      affectedCounts: { PENDING_REVIEW: 2, OPEN: 3, ASSIGNED: 1 },
      excludedFinishedCount: 4,
    }),
  }));
  await page.route('**/api/users/notification-preferences', route => route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify([
      { type: 'ACCOUNT_APPROVED', emailEnabled: true },
      { type: 'DEADLINE_REMINDER', emailEnabled: true },
    ]),
  }));
  await page.route('**/api/users/notification-preferences/*', route => route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify({
      type: route.request().url().split('/').pop(),
      emailEnabled: route.request().postDataJSON().emailEnabled,
    }),
  }));
  await page.route('**/api/parties/rules', route => route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify({ minSize: 2, maxSize: 3, supervisorMaxParties: 2 }),
  }));
  await page.route('**/api/parties/all', route => options.onParties
    ? options.onParties(route)
    : route.fulfill({
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

test('navigates from Dashboard to Students without blanking', async ({ page }) => {
  const errors: Error[] = [];
  page.on('pageerror', error => errors.push(error));
  await mockCoordinatorApi(page);
  const pendingRequest = page.waitForRequest(request =>
    request.url().includes('/api/users/pending') && request.method() === 'GET',
  );
  await loginAsCoordinator(page);
  expect(new URL((await pendingRequest).url()).searchParams.get('size')).toBe('100');

  await page.getByRole('link', { name: 'Students', exact: true }).click();

  await expect(page.getByRole('heading', { name: 'Students' })).toBeVisible();
  await expect(page.getByText('pending.student@talentbridge.com').first()).toBeVisible();
  await expect(page.getByText('25 of 25 students shown')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Users', exact: true })).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('previews and shows a new global deadline without reloading', async ({ page }) => {
  let deadline = openProject.deadline;
  let enabled = false;
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
      if (route.request().method() === 'PUT') {
        const payload = await route.request().postDataJSON();
        deadline = payload.deadline;
        enabled = payload.enabled;
        return route.fulfill({ status: 204 });
      }
      return route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({ enabled, deadline: enabled ? deadline : null }),
      });
    },
  });
  await loginAsCoordinator(page);
  await page.getByRole('link', { name: 'Projects', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Manage Projects' })).toBeVisible();
  const fetchesBeforeApply = projectFetches;

  await page.getByRole('switch', { name: 'Enable global deadline' }).press('Space');
  await page.getByLabel('Global deadline date and time').fill('2031-01-02T10:00');
  await page.getByRole('button', { name: 'Preview changes' }).click();

  await expect(page.getByRole('dialog', { name: 'Confirm global deadline' })).toContainText('3 open');
  await expect(page.getByRole('dialog', { name: 'Confirm global deadline' })).toContainText('4 finished projects excluded');
  await page.getByRole('button', { name: 'Confirm and apply' }).click();

  await expect.poll(() => projectFetches).toBeGreaterThan(fetchesBeforeApply);
  await expect(page.getByText('Global deadline is enabled')).toBeVisible();
  await expect(page.getByText(/02 Jan 2031/).first()).toBeVisible();
});

test('keeps project deadlines when global mode is disabled', async ({ page }) => {
  let deadline = openProject.deadline;
  let enabled = false;
  await mockCoordinatorApi(page, {
    onProjects: route => route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify(pageResponse([{ ...openProject, deadline }])),
    }),
    onGlobalDeadline: async route => {
      if (route.request().method() === 'PUT') {
        const payload = await route.request().postDataJSON();
        enabled = payload.enabled;
        if (enabled) deadline = payload.deadline;
        return route.fulfill({ status: 204 });
      }
      return route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({ enabled, deadline }),
      });
    },
  });
  await loginAsCoordinator(page);
  await page.getByRole('link', { name: 'Projects', exact: true }).click();

  await page.getByRole('switch', { name: 'Enable global deadline' }).press('Space');
  await page.getByLabel('Global deadline date and time').fill('2031-01-02T10:00');
  await page.getByRole('button', { name: 'Preview changes' }).click();
  await page.getByRole('button', { name: 'Confirm and apply' }).click();
  await expect(page.getByText(/02 Jan 2031/).first()).toBeVisible();

  await page.getByRole('switch', { name: 'Enable global deadline' }).press('Space');
  await page.getByRole('button', { name: 'Preview changes' }).click();
  await page.getByRole('button', { name: 'Confirm and apply' }).click();

  await expect(page.getByText('Global deadline is disabled')).toBeVisible();
  await expect(page.getByText(/02 Jan 2031/).first()).toBeVisible();
});

test('filters student and company approval states with tabs', async ({ page }) => {
  const students = [
    { ...pendingStudents[0], status: 'PENDING' },
    { ...pendingStudents[1], status: 'APPROVED' },
    { ...pendingStudents[2], status: 'SUSPENDED' },
    { ...pendingStudents[3], status: 'REJECTED' },
  ];
  const companies = students.map((student, index) => ({
    ...student,
    id: `10000000-0000-0000-0000-${String(index + 1).padStart(12, '0')}`,
    role: 'COMPANY',
    firstName: `${student.status} Company`,
    companyProfile: { id: `profile-${index}`, companyName: `${student.status} Company`, industry: 'Software' },
  }));
  await mockCoordinatorApi(page);
  await page.unroute('**/api/users/students');
  await page.route('**/api/users/students', route => route.fulfill({ contentType: 'application/json', body: JSON.stringify(students) }));
  await page.unroute('**/api/users/companies');
  await page.route('**/api/users/companies', route => route.fulfill({ contentType: 'application/json', body: JSON.stringify(companies) }));
  await loginAsCoordinator(page);

  await page.getByRole('link', { name: 'Students', exact: true }).click();
  await expect(page.getByRole('tab', { name: 'All' })).toBeVisible();
  await page.getByRole('tab', { name: 'Pending' }).click();
  await expect(page.getByText('pending.student@talentbridge.com').first()).toBeVisible();
  await expect(page.getByText('pending2.student@talentbridge.com')).toBeHidden();

  await page.getByRole('link', { name: 'Companies', exact: true }).click();
  await expect(page.getByRole('tab', { name: 'All Companies' })).toBeVisible();
  await page.getByRole('tab', { name: 'Rejected' }).click();
  await expect(page.getByText('REJECTED Company', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('APPROVED Company', { exact: true })).toBeHidden();
});

test('selects all filtered students and requires a bulk rejection reason', async ({ page }) => {
  await mockCoordinatorApi(page);
  await page.route('**/api/users/*/reject**', route => route.fulfill({ contentType: 'application/json', body: '{}' }));
  await loginAsCoordinator(page);
  await page.getByRole('link', { name: 'Students', exact: true }).click();

  await page.getByRole('checkbox', { name: /Select all .* filtered students/ }).press('Space');

  await expect(page.getByText('25 selected')).toBeVisible();
  await expect(page.getByRole('button', { name: /Reject 25/ })).toBeDisabled();
  await page.getByPlaceholder('Rejection reason required for reject').fill('Incomplete academic record');
  await expect(page.getByRole('button', { name: /Reject 25/ })).toBeEnabled();
});

test('updates email notification preferences', async ({ page }) => {
  let updated = false;
  await mockCoordinatorApi(page);
  await page.route('**/api/users/notification-preferences/DEADLINE_REMINDER', async route => {
    updated = !(await route.request().postDataJSON()).emailEnabled;
    return route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ type: 'DEADLINE_REMINDER', emailEnabled: false }),
    });
  });
  await loginAsCoordinator(page);
  await page.getByRole('link', { name: 'Settings', exact: true }).click();

  await expect(page.getByRole('heading', { name: 'Notification Settings' })).toBeVisible();
  await page.getByRole('switch', { name: 'Deadline Reminder email' }).press('Space');
  await expect.poll(() => updated).toBe(true);
});

test('separates pending, party, and project supervisors', async ({ page }) => {
  await mockCoordinatorApi(page);
  await page.unroute('**/api/users/supervisors');
  await page.route('**/api/users/supervisors', route => route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify([
      { ...pendingStudents[0], role: 'PARTY_SUPERVISOR', firstName: 'Pending', lastName: 'Mentor' },
      { ...pendingStudents[1], role: 'PARTY_SUPERVISOR', status: 'APPROVED', firstName: 'Party', lastName: 'Mentor' },
      { ...pendingStudents[2], role: 'PROJECT_SUPERVISOR', status: 'APPROVED', firstName: 'Project', lastName: 'Mentor' },
    ]),
  }));
  await loginAsCoordinator(page);
  await page.getByRole('link', { name: 'Supervisors', exact: true }).click();

  await expect(page.getByRole('tab', { name: 'Pending Requests' })).toBeVisible();
  await page.getByRole('tab', { name: 'Party Supervisors' }).click();
  await expect(page.getByText('Party Mentor')).toBeVisible();
  await page.getByRole('tab', { name: 'Project Supervisors' }).click();
  await expect(page.getByText('Project Mentor')).toBeVisible();
  await expect(page.getByText('Party Mentor')).toBeHidden();
});

test('allows an assigned project deadline to be changed individually', async ({ page }) => {
  const assignedProject = {
    ...openProject,
    title: 'Assigned Deadline Project',
    status: 'ASSIGNED',
  };
  let requestedDeadline = '';
  await mockCoordinatorApi(page, {
    onProjects: route => route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify(pageResponse([assignedProject])),
    }),
  });
  await page.route('**/api/projects/*/deadline**', route => {
    requestedDeadline = new URL(route.request().url()).searchParams.get('deadline') ?? '';
    return route.fulfill({ contentType: 'application/json', body: JSON.stringify(assignedProject) });
  });
  await loginAsCoordinator(page);
  await page.getByRole('link', { name: 'Projects', exact: true }).click();

  await page.getByLabel('Deadline for Assigned Deadline Project', { exact: true }).fill('2031-02-03T10:00');
  await page.getByRole('button', { name: 'Set deadline for Assigned Deadline Project' }).click();

  await expect.poll(() => requestedDeadline).toContain('2031-02-03');
});

test('changes an assigned project deadline from the party view', async ({ page }) => {
  const assignedParty = {
    id: '00000000-0000-0000-0000-000000000201',
    name: 'Deadline Party',
    status: 'ASSIGNED',
    semester: 'Fall',
    academicYear: 2026,
    leader: pendingStudents[0],
    members: [pendingStudents[0], pendingStudents[1]],
    assignedProjectId: openProject.id,
    assignedProjectTitle: openProject.title,
    assignedProjectDeadline: openProject.deadline,
  };
  let requestedProject = '';
  await mockCoordinatorApi(page, {
    onParties: route => route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify([assignedParty]),
    }),
  });
  await page.route('**/api/projects/*/deadline**', route => {
    requestedProject = route.request().url();
    return route.fulfill({ contentType: 'application/json', body: JSON.stringify(openProject) });
  });
  await loginAsCoordinator(page);
  await page.getByRole('link', { name: 'Parties', exact: true }).click();

  await page.getByLabel('Deadline for party Deadline Party', { exact: true }).fill('2031-03-04T10:00');
  await page.getByRole('button', { name: 'Update deadline for party Deadline Party' }).click();

  await expect.poll(() => requestedProject).toContain(openProject.id);
});

test('keeps notifications visible and closes the mobile sidebar', async ({ page }) => {
  await page.setViewportSize({ width: 800, height: 400 });
  await mockCoordinatorApi(page);
  await loginAsCoordinator(page);

  await page.getByRole('button', { name: 'Open navigation' }).click();
  await expect(page.getByRole('button', { name: 'Close navigation', exact: true }).last()).toBeVisible();
  await page.getByRole('button', { name: 'Notifications' }).click();

  await expect(page.getByTestId('navigation-overlay')).toHaveCount(0);
  const box = await page.getByRole('dialog').boundingBox();
  expect(box).not.toBeNull();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(800);
  expect(box!.y).toBeGreaterThanOrEqual(0);
  expect(box!.y + box!.height).toBeLessThanOrEqual(400);
});

test('right-aligns header controls and anchors notifications below the bell', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await mockCoordinatorApi(page);
  await loginAsCoordinator(page);

  const header = await page.getByRole('banner').boundingBox();
  const profile = await page.getByRole('button', { name: 'DC Demo', exact: true }).boundingBox();
  const bellButton = page.getByRole('button', { name: 'Notifications' });
  const bell = await bellButton.boundingBox();
  await bellButton.click();
  const panel = await page.getByRole('dialog').boundingBox();

  expect(header).not.toBeNull();
  expect(profile).not.toBeNull();
  expect(bell).not.toBeNull();
  expect(panel).not.toBeNull();
  expect(header!.x + header!.width - (profile!.x + profile!.width)).toBeLessThanOrEqual(32);
  expect(panel!.y).toBeGreaterThanOrEqual(bell!.y + bell!.height);
  expect(Math.abs(panel!.x + panel!.width - (bell!.x + bell!.width))).toBeLessThanOrEqual(1);
});

test('shows the nearest deadline prominently with four upcoming deadlines', async ({ page }) => {
  const projects = Array.from({ length: 5 }, (_, index) => ({
    ...openProject,
    id: `00000000-0000-0000-0002-${String(index + 1).padStart(12, '0')}`,
    title: `Deadline project ${index + 1}`,
    deadline: new Date(Date.now() + (index === 0 ? 3 : index + 10) * 86_400_000).toISOString(),
  }));
  await mockCoordinatorApi(page, {
    onProjects: route => route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify(pageResponse(projects)),
    }),
  });

  await loginAsCoordinator(page);

  await expect(page.getByRole('heading', { name: 'Upcoming deadlines' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Deadline project 1' })).toBeVisible();
  await expect(page.getByText('Deadline project 5').first()).toBeVisible();
  await expect(page.getByText('Due soon')).toBeVisible();
  await expect(page.getByLabel(/On track:/).first()).toBeVisible();
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
  await page.getByPlaceholder('Ask about TalentBridge').fill('Explain this project');
  await page.getByRole('button', { name: 'Send message' }).click();

  await expect(page.getByText('AI service is temporarily unavailable')).toBeVisible();
});

test('uses a safe fallback for malformed chatbot errors', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await mockCoordinatorApi(page);
  await page.route('**/api/chat', route => route.fulfill({
    status: 503,
    contentType: 'application/json',
    body: JSON.stringify({ message: { detail: 'unsafe' } }),
  }));
  await loginAsCoordinator(page);

  await page.getByRole('button', { name: 'Open AI assistant' }).click();
  const panel = page.getByTestId('chat-panel');
  const bounds = await panel.boundingBox();
  expect(bounds).not.toBeNull();
  expect(bounds!.x).toBeGreaterThanOrEqual(0);
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(320);
  await page.getByPlaceholder('Ask about TalentBridge').fill('Explain this project');
  await page.getByRole('button', { name: 'Send message' }).click();

  await expect(page.getByText('Sorry, I ran into an error. Please try again.')).toBeVisible();
});
