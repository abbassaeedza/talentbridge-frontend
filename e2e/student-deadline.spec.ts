import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

const student = {
  id: '00000000-0000-0000-0000-000000000101',
  email: 'student@talentbridge.com',
  firstName: 'Demo',
  lastName: 'Student',
  role: 'STUDENT',
  status: 'APPROVED',
  onboardingComplete: true,
  githubUsername: 'demo-student',
  studentProfile: {
    id: '00000000-0000-0000-0000-000000000104',
    skills: ['React'],
  },
};

const pageResponse = <T>(content: T[]) => ({
  content,
  totalPages: 1,
  totalElements: content.length,
  page: 0,
  size: 20,
  first: true,
  last: true,
});

async function mockStudentApi(page: Page, party: object | null) {
  await page.route('**/api/auth/login', route => route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify({
      accessToken: 'student-access-token',
      refreshToken: 'student-refresh-token',
      tokenType: 'Bearer',
      user: student,
    }),
  }));
  await page.route('**/api/users/me', route => route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify(student),
  }));
  await page.route('**/api/users/notifications**', route => route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify({ notifications: [], unreadCount: 0 }),
  }));
  await page.route('**/api/projects**', route => route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify(pageResponse([])),
  }));
  await page.route('**/api/projects/global-deadline', route => route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify(new Date(Date.now() + 10 * 86_400_000).toISOString()),
  }));
  await page.route('**/api/parties/my', route => party
    ? route.fulfill({ contentType: 'application/json', body: JSON.stringify(party) })
    : route.fulfill({ status: 404, contentType: 'application/json', body: '{}' }));
  await page.route('**/api/users/my/scorecard', route => route.fulfill({
    status: 404,
    contentType: 'application/json',
    body: '{}',
  }));
}

async function login(page: Page) {
  await page.goto('/login');
  await page.getByPlaceholder('you@example.com').fill(student.email);
  await page.getByPlaceholder('••••••••').fill('Student1234!');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/student\/dashboard$/);
}

test('prioritises the assigned project deadline in the large countdown', async ({ page }) => {
  await mockStudentApi(page, {
    id: '00000000-0000-0000-0000-000000000102',
    name: 'Demo Party',
    status: 'ASSIGNED',
    leader: student,
    members: [student],
    assignedProjectId: '00000000-0000-0000-0000-000000000103',
    assignedProjectTitle: 'Assigned Project',
    assignedProjectDeadline: new Date(Date.now() + 36 * 3_600_000).toISOString(),
  });

  await login(page);

  await expect(page.getByText('Assigned project deadline')).toBeVisible();
  await expect(page.getByText('Assigned Project').first()).toBeVisible();
  await expect(page.getByText('Urgent')).toBeVisible();
  await expect(page.getByText('Global application deadline')).toBeHidden();
});

test('shows the saved global deadline when the student has no assigned project', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockStudentApi(page, null);

  await login(page);

  await expect(page.getByText('Global application deadline')).toBeVisible();
  await expect(page.getByText('On track')).toBeVisible();
  await expect(page.getByText('Days')).toBeVisible();
  await expect(page.getByText('Hours')).toBeVisible();
  await expect(page.getByText('Minutes')).toBeVisible();
  await expect(page.getByText('Seconds')).toBeVisible();
});

test('creates a party with a validated semester and academic year', async ({ page }) => {
  let created: Record<string, unknown> | null = null;
  await mockStudentApi(page, null);
  await page.route('**/api/parties/rules', route => route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify({ minSize: 2, maxSize: 3, supervisorMaxParties: 2 }),
  }));
  await page.route('**/api/parties', async route => {
    created = await route.request().postDataJSON();
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        id: '00000000-0000-0000-0000-000000000105',
        ...created,
        status: 'FORMING',
        leader: student,
        members: [student],
      }),
    });
  });
  await login(page);
  await page.goto('/student/party');
  await page.getByRole('button', { name: 'Create Party' }).click();

  await page.getByPlaceholder('Team Phoenix').fill('Team Guardrail');
  await page.getByRole('combobox', { name: 'Semester' }).selectOption('Spring');
  await page.getByRole('spinbutton', { name: 'Academic year' }).fill('2027');
  await page.getByRole('button', { name: 'Create', exact: true }).click();

  await expect.poll(() => created).toEqual({
    name: 'Team Guardrail',
    semester: 'Spring',
    academicYear: 2027,
  });
});

test('joins an active party that is below its configured maximum', async ({ page }) => {
  const partyId = '00000000-0000-0000-0000-000000000106';
  const activeParty = {
    id: partyId,
    name: 'Active Guardrail Team',
    status: 'ACTIVE',
    semester: 'Spring',
    members: [
      { ...student, id: '00000000-0000-0000-0000-000000000107' },
      { ...student, id: '00000000-0000-0000-0000-000000000108' },
    ],
  };
  await mockStudentApi(page, null);
  await page.route('**/api/parties/rules', route => route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify({ minSize: 2, maxSize: 3, supervisorMaxParties: 2 }),
  }));
  await page.route(`**/api/parties/${partyId}`, route => route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify(activeParty),
  }));
  const joinRequest = page.waitForRequest(request =>
    request.url().endsWith(`/api/parties/${partyId}/join`) && request.method() === 'POST');
  await page.route(`**/api/parties/${partyId}/join`, route => route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify({ ...activeParty, members: [...activeParty.members, student] }),
  }));

  await login(page);
  await page.goto(`/join/${partyId}`);
  await expect(page.getByRole('button', { name: 'Join Party' })).toBeEnabled();
  await page.getByRole('button', { name: 'Join Party' }).click();

  await joinRequest;
  await expect(page.getByText("You're in!")).toBeVisible();
});

test('uses actual party size when deciding if a project application is allowed', async ({ page }) => {
  const projectId = '00000000-0000-0000-0000-000000000109';
  await mockStudentApi(page, {
    id: '00000000-0000-0000-0000-000000000110',
    name: 'Stale Active Team',
    status: 'ACTIVE',
    leader: student,
    members: [student],
  });
  await page.route('**/api/parties/rules', route => route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify({ minSize: 2, maxSize: 3, supervisorMaxParties: 2 }),
  }));
  await page.route(`**/api/projects/${projectId}`, route => route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify({
      id: projectId,
      title: 'Guarded Project',
      companyName: 'Demo Company',
      status: 'OPEN',
      tools: [],
      partyApplicationCount: 0,
    }),
  }));

  await login(page);
  await page.goto(`/student/projects/${projectId}`);

  await expect(page.getByText('Your party needs at least 2 members before applying.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Apply Now' })).toBeHidden();
});
