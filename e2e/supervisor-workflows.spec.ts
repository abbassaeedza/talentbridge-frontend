import { expect, test } from '@playwright/test';
import type { Page, Route } from '@playwright/test';

const ids = {
  company: '00000000-0000-0000-0000-000000000101',
  projectSupervisor: '00000000-0000-0000-0000-000000000102',
  partySupervisor: '00000000-0000-0000-0000-000000000103',
  project: '00000000-0000-0000-0000-000000000104',
  party: '00000000-0000-0000-0000-000000000105',
  student: '00000000-0000-0000-0000-000000000106',
  submission: '00000000-0000-0000-0000-000000000107',
};

const users = {
  company: {
    id: ids.company,
    email: 'projects@nexa.example',
    firstName: 'Nexa',
    lastName: 'Systems',
    role: 'COMPANY',
    status: 'APPROVED',
    onboardingComplete: true,
    companyProfile: { id: ids.company, companyName: 'Nexa Systems' },
  },
  projectSupervisor: {
    id: ids.projectSupervisor,
    email: 'sara@nexa.example',
    firstName: 'Sara',
    lastName: 'Khan',
    role: 'PROJECT_SUPERVISOR',
    status: 'APPROVED',
    onboardingComplete: true,
    supervisorProfile: {
      id: ids.projectSupervisor,
      jobTitle: 'Engineering Manager',
      department: 'Platform',
      bio: 'Guides delivery teams.',
    },
  },
  partySupervisor: {
    id: ids.partySupervisor,
    email: 'mentor@university.example',
    firstName: 'Ayesha',
    lastName: 'Ali',
    role: 'PARTY_SUPERVISOR',
    status: 'APPROVED',
    onboardingComplete: true,
    supervisorProfile: {
      id: ids.partySupervisor,
      jobTitle: 'Lecturer',
      department: 'Computer Science',
      bio: 'Mentors capstone teams.',
    },
  },
};

const project = {
  id: ids.project,
  title: 'AI Support Copilot',
  description: 'Build a support assistant for internal teams.',
  scope: 'A responsive web application and API.',
  deliverables: 'Source code, tests, and documentation.',
  evaluationCriteria: 'Functionality, code quality, and usability.',
  tools: ['React', 'Spring Boot'],
  status: 'ASSIGNED',
  deadline: '2030-01-15T10:00:00.000Z',
  companyName: 'Nexa Systems',
  companyId: ids.company,
  projectSupervisorId: ids.projectSupervisor,
  projectSupervisorName: 'Sara Khan',
  assignedPartyId: ids.party,
  assignedPartyName: 'Team Orbit',
  createdByName: 'Nexa Systems',
  partyApplicationCount: 2,
  createdAt: '2026-08-01T10:00:00.000Z',
};

const party = {
  id: ids.party,
  name: 'Team Orbit',
  status: 'SUBMITTED',
  semester: 'Fall',
  academicYear: 2026,
  leader: {
    id: ids.student,
    firstName: 'Amir',
    lastName: 'Iqbal',
    email: 'amir@example.com',
    skills: ['React'],
  },
  members: [{
    id: ids.student,
    firstName: 'Amir',
    lastName: 'Iqbal',
    email: 'amir@example.com',
    skills: ['React'],
  }],
  supervisorId: ids.partySupervisor,
  supervisorName: 'Ayesha Ali',
  assignedProjectId: ids.project,
  assignedProjectTitle: project.title,
  assignedProjectDeadline: project.deadline,
};

const submission = {
  id: ids.submission,
  partyId: ids.party,
  partyName: party.name,
  projectId: ids.project,
  projectTitle: project.title,
  repoUrl: 'https://github.com/example/orbit',
  repoBranch: 'main',
  documentUrls: ['https://files.example/report.pdf'],
  status: 'EVALUATED',
  submittedAt: '2026-12-12T10:00:00.000Z',
  notes: 'Final release.',
};

const evaluation = {
  id: '00000000-0000-0000-0000-000000000108',
  submission: { id: ids.submission },
  aiDetectionScore: 8,
  aiDetectionNotes: 'Low detected usage.',
  codeQualityScore: 88,
  codeQualityNotes: 'Clear and maintainable.',
  functionalityScore: 92,
  functionalityNotes: 'All core flows work.',
  scopeAlignmentScore: 90,
  scopeAlignmentNotes: 'Matches the brief.',
  teamCollaborationScore: 86,
  teamCollaborationNotes: 'Balanced contribution.',
  totalScore: 89,
  overallSummary: 'A strong submission.',
  studentScores: [{
    id: '00000000-0000-0000-0000-000000000109',
    student: party.members[0],
    totalCommits: 42,
    contributionPercentage: 100,
    individualScore: 91,
    performanceNotes: 'Owned the frontend delivery.',
  }],
  evaluatedAt: '2026-12-13T10:00:00.000Z',
  finalized: true,
};

async function mockAuthenticated(page: Page, user: typeof users.company) {
  await page.addInitScript(() => localStorage.setItem('accessToken', 'test-access-token'));
  await page.route('**/api/users/me', route => route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify(user),
  }));
  await page.route('**/api/users/notifications**', route => route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify({ notifications: [], unreadCount: 0 }),
  }));
}

async function fulfillJson(route: Route, value: unknown, status = 200) {
  await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(value) });
}

test('accepts a project supervisor invitation and opens the supervisor workspace', async ({ page }) => {
  let accepted: Record<string, unknown> | undefined;
  await page.route('**/api/project-supervisor-invitations/invite-token', route =>
    fulfillJson(route, {
      id: '00000000-0000-0000-0000-000000000110',
      email: users.projectSupervisor.email,
      companyName: 'Nexa Systems',
      status: 'PENDING',
      expiresAt: '2030-01-01T00:00:00.000Z',
    }));
  await page.route('**/api/project-supervisor-invitations/invite-token/accept', async route => {
    accepted = await route.request().postDataJSON();
    return fulfillJson(route, {
      accessToken: 'accepted-access-token',
      refreshToken: 'accepted-refresh-token',
      tokenType: 'Bearer',
      user: users.projectSupervisor,
    });
  });
  await page.route('**/api/users/me', route => fulfillJson(route, users.projectSupervisor));
  await page.route('**/api/users/notifications**', route => fulfillJson(route, { notifications: [], unreadCount: 0 }));
  await page.route('**/api/projects/supervised', route => fulfillJson(route, []));

  await page.goto('/project-supervisor-invitations/invite-token');

  await expect(page.locator(`input[value="${users.projectSupervisor.email}"]`)).toBeDisabled();
  await page.getByLabel('First name').fill('Sara');
  await page.getByLabel('Last name').fill('Khan');
  await page.getByLabel('Phone number').fill('+92 300 1234567');
  await page.getByLabel('Job title').fill('Engineering Manager');
  await page.getByLabel('Department').fill('Platform');
  await page.getByLabel('Bio').fill('Guides delivery teams.');
  await page.getByLabel('LinkedIn URL').fill('https://linkedin.com/in/sara-khan');
  await page.getByLabel('Password', { exact: true }).fill('Password123!');
  await page.getByLabel('Confirm password').fill('Password123!');
  await page.getByRole('button', { name: 'Accept invitation' }).click();

  await expect(page).toHaveURL(/\/project-supervisor\/overview$/);
  expect(accepted).toMatchObject({
    firstName: 'Sara',
    lastName: 'Khan',
    jobTitle: 'Engineering Manager',
    department: 'Platform',
    password: 'Password123!',
  });
  await expect(page.getByRole('heading', { name: 'Project Supervisor Overview' })).toBeVisible();
});

test('company manages supervisor invitations and assigns an accepted supervisor to a project', async ({ page }) => {
  await mockAuthenticated(page, users.company);
  let invitations = [{
    id: '00000000-0000-0000-0000-000000000111',
    email: 'pending@nexa.example',
    companyName: 'Nexa Systems',
    status: 'PENDING',
    expiresAt: '2030-01-01T00:00:00.000Z',
  }];
  let createdProject: Record<string, unknown> | undefined;
  await page.route('**/api/company/project-supervisor-invitations', async route => {
    if (route.request().method() === 'POST') {
      const request = await route.request().postDataJSON();
      invitations = [...invitations, {
        id: '00000000-0000-0000-0000-000000000112',
        email: request.email,
        companyName: 'Nexa Systems',
        status: 'PENDING',
        expiresAt: '2030-01-02T00:00:00.000Z',
      }];
      return fulfillJson(route, invitations.at(-1), 201);
    }
    return fulfillJson(route, [...invitations, {
      id: '00000000-0000-0000-0000-000000000113',
      email: users.projectSupervisor.email,
      companyName: 'Nexa Systems',
      status: 'ACCEPTED',
      expiresAt: '2029-12-01T00:00:00.000Z',
    }]);
  });
  await page.route('**/api/company/project-supervisor-invitations/*/resend', route => fulfillJson(route, invitations[0]));
  await page.route('**/api/company/project-supervisor-invitations/*', route => route.fulfill({ status: 204 }));
  await page.route('**/api/company/project-supervisors', route => fulfillJson(route, [users.projectSupervisor]));
  await page.route('**/api/projects/my', route => fulfillJson(route, []));
  await page.route('**/api/projects', async route => {
    if (route.request().method() !== 'POST') return route.fallback();
    createdProject = await route.request().postDataJSON();
    return fulfillJson(route, { ...project, ...createdProject, status: 'PENDING_REVIEW' }, 201);
  });

  await page.goto('/company/dashboard');
  await page.getByRole('link', { name: 'Project Supervisors' }).click();
  await expect(page.getByRole('heading', { name: 'Project Supervisors' })).toBeVisible();
  await expect(page.getByText('Pending', { exact: true })).toBeVisible();
  await expect(page.getByText('Accepted', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Invite supervisor' }).click();
  await page.getByLabel('Work email').fill('new.supervisor@nexa.example');
  await page.getByRole('button', { name: 'Send invitation', exact: true }).click();
  await expect(page.getByText('new.supervisor@nexa.example')).toBeVisible();

  await page.getByRole('link', { name: 'Projects', exact: true }).click();
  await page.getByRole('link', { name: 'Post New Project' }).click();
  await page.getByLabel('Project title').fill('Operations Dashboard');
  await page.getByLabel('Project description').fill('Build an operations dashboard.');
  await page.getByRole('button', { name: /No project supervisor/ }).click();
  await page.getByRole('option', { name: /Sara Khan/ }).click();
  await page.getByRole('button', { name: 'Submit for review' }).click();

  await expect.poll(() => createdProject).toMatchObject({ projectSupervisorId: ids.projectSupervisor });
});

test('project supervisor navigates projects and reads assigned party evaluation', async ({ page }) => {
  const pageErrors: Error[] = [];
  page.on('pageerror', error => pageErrors.push(error));
  await mockAuthenticated(page, users.projectSupervisor);
  const unsubmittedProject = { ...project, id: 'unsubmitted-project', title: 'Unsubmitted Portal', assignedPartyId: undefined, assignedPartyName: undefined };
  await page.route('**/api/projects/supervised', route => fulfillJson(route, [project, unsubmittedProject]));
  await page.route(`**/api/projects/${ids.project}`, route => fulfillJson(route, project));
  await page.route(`**/api/parties/${ids.party}`, route => fulfillJson(route, party));
  await page.route(`**/api/parties/projects/${ids.project}/applications`, route => fulfillJson(route, []));
  await page.route('**/api/submissions/project/*', route => fulfillJson(route, route.request().url().endsWith(ids.project) ? [submission] : []));
  await page.route(`**/api/evaluations/submission/${ids.submission}`, route => fulfillJson(route, evaluation));

  await page.goto('/project-supervisor/overview');
  await expect(page.getByRole('heading', { name: 'Project Supervisor Overview' })).toBeVisible();
  await expect(page.getByText('AI Support Copilot')).toBeVisible();
  await page.getByRole('link', { name: 'Projects', exact: true }).click();
  await page.getByRole('button', { name: /Submission/ }).click();
  await page.getByRole('option', { name: 'Evaluated' }).click();
  await expect(page.getByText('Unsubmitted Portal')).toHaveCount(0);
  await page.getByRole('button', { name: /Submission/ }).click();
  await page.getByRole('option', { name: 'All' }).click();
  await page.getByPlaceholder('Search projects').fill('support');
  await page.getByRole('link', { name: /AI Support Copilot/ }).click();

  await expect(page.getByRole('heading', { name: 'AI Support Copilot' })).toBeVisible();
  await expect(page.getByText('Team Orbit')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Amir Iqbal' })).toHaveAttribute('href', `/supervisor/students/${ids.student}`);
  await expect(page.getByText('A strong submission.')).toBeVisible();
  await expect(page.getByText('91')).toBeVisible();
  await expect(page.getByRole('button', { name: /finalize|trigger/i })).toHaveCount(0);
  expect(pageErrors).toEqual([]);
});

test('party supervisor uses supervised and browse endpoints without coordinator access', async ({ page }) => {
  const pageErrors: Error[] = [];
  page.on('pageerror', error => pageErrors.push(error));
  await mockAuthenticated(page, users.partySupervisor);
  const requested: string[] = [];
  page.on('request', request => requested.push(new URL(request.url()).pathname));
  await page.route('**/api/parties/supervised', route => fulfillJson(route, [party]));
  await page.route('**/api/parties/browse', route => fulfillJson(route, [party, { ...party, id: 'browse-party', name: 'Team Nova', supervisorId: undefined, supervisorName: undefined }]));
  await page.route(`**/api/parties/${ids.party}`, route => fulfillJson(route, party));
  await page.route(`**/api/parties/${ids.party}/applications`, route => fulfillJson(route, []));
  await page.route(`**/api/submissions/${ids.party}`, route => fulfillJson(route, submission));
  await page.route(`**/api/evaluations/submission/${ids.submission}`, route => fulfillJson(route, evaluation));

  await page.goto('/party-supervisor/overview');
  await expect(page.getByRole('heading', { name: 'Party Supervisor Overview' })).toBeVisible();
  await page.getByRole('link', { name: 'My Parties' }).click();
  await page.getByRole('link', { name: /Team Orbit/ }).click();
  await expect(page.getByText('A strong submission.')).toBeVisible();
  await page.getByRole('link', { name: 'Browse Parties' }).click();
  await expect(page.getByText('Team Nova')).toBeVisible();
  await expect(page.getByText('My party')).toBeVisible();
  await expect(page.getByText('Party supervisor: Ayesha Ali')).toBeVisible();

  expect(requested).toContain('/api/parties/browse');
  expect(requested).not.toContain('/api/parties/all');
  expect(pageErrors).toEqual([]);
});
