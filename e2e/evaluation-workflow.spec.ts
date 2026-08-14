import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

const ids = {
  party: '00000000-0000-0000-0000-000000000201',
  project: '00000000-0000-0000-0000-000000000202',
  submission: '00000000-0000-0000-0000-000000000203',
  report: '00000000-0000-0000-0000-000000000204',
  student: '00000000-0000-0000-0000-000000000205',
};

const coordinator = {
  id: '00000000-0000-0000-0000-000000000206',
  email: 'coordinator@talentbridge.com',
  firstName: 'System',
  lastName: 'Coordinator',
  role: 'COORDINATOR',
  status: 'APPROVED',
  onboardingComplete: true,
};

const student = {
  id: ids.student,
  email: 'student@talentbridge.com',
  firstName: 'Demo',
  lastName: 'Student',
  role: 'STUDENT',
  status: 'APPROVED',
  onboardingComplete: true,
  studentProfile: { id: 'profile-id', skills: ['React'] },
};

const company = {
  id: '00000000-0000-0000-0000-000000000207',
  email: 'company@talentbridge.com',
  firstName: 'Nexa',
  lastName: 'Systems',
  role: 'COMPANY',
  status: 'APPROVED',
  onboardingComplete: true,
};

const report = {
  id: ids.report,
  submissionId: ids.submission,
  aiDetectionScore: 72,
  aiDetectionNotes: 'The repository shows consistent authorship.',
  codeQualityScore: 65,
  codeQualityNotes: 'The code is structured and readable.',
  functionalityScore: 64,
  functionalityNotes: 'The main workflows operate correctly.',
  scopeAlignmentScore: 70,
  scopeAlignmentNotes: 'The implementation follows the project scope.',
  teamCollaborationScore: 40,
  teamCollaborationNotes: 'Repository contributions are uneven.',
  totalScore: 63,
  overallSummary: 'Strong scope alignment with room for better collaboration.',
  studentScores: [{
    id: 'student-score-id',
    student: {
      id: ids.student,
      firstName: 'Demo',
      lastName: 'Student',
      email: student.email,
      githubUsername: 'tryinnewthings505-a11y',
    },
    totalCommits: 4,
    contributionPercentage: 25,
    individualScore: 54,
    performanceNotes: '4 commits (25.0%). Score: 54.0/100.',
  }],
  evaluatedAt: new Date().toISOString(),
  finalized: false,
};

async function mockLogin(page: Page, user: typeof coordinator | typeof student | typeof company) {
  await page.route('**/api/auth/login', route => route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      tokenType: 'Bearer',
      user,
    }),
  }));
  await page.route('**/api/users/me', route => route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify(user),
  }));
}

async function login(page: Page, user: typeof coordinator | typeof student | typeof company) {
  await page.goto('/login');
  await page.getByPlaceholder('you@example.com').fill(user.email);
  await page.getByPlaceholder('••••••••').fill('Password123!');
  await page.getByRole('button', { name: 'Sign in' }).click();
  const area = user.role === 'COORDINATOR' ? 'coordinator' : user.role === 'COMPANY' ? 'company' : 'student';
  await expect(page).toHaveURL(new RegExp(`/${area}/dashboard$`));
}

test('shows weighted evaluation progress and the completed coordinator report', async ({ page }) => {
  await mockLogin(page, coordinator);
  await page.route('**/api/users/notifications**', route => route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify({ notifications: [], unreadCount: 0 }),
  }));
  await page.route('**/api/parties/all', route => route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify([{
      id: ids.party,
      name: 'Team Catalyst',
      assignedProjectId: ids.project,
      assignedProjectTitle: 'Network Health Monitor',
    }]),
  }));

  let evaluated = false;
  await page.route(`**/api/submissions/${ids.party}`, route => route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify({
      id: ids.submission,
      partyId: ids.party,
      projectId: ids.project,
      status: evaluated ? 'EVALUATED' : 'SUBMITTED',
      repoUrl: 'https://github.com/example/network-health-monitor',
      documentUrls: [],
    }),
  }));
  await page.route(`**/api/evaluations/trigger/${ids.submission}`, async route => {
    await new Promise(resolve => setTimeout(resolve, 700));
    evaluated = true;
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify(report) });
  });
  await page.route(`**/api/evaluations/submission/${ids.submission}`, route => route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify(report),
  }));

  await login(page, coordinator);
  await page.goto('/coordinator/evaluations');
  await page.getByRole('button', { name: 'Evaluate' }).click();

  const progress = page.getByRole('status', { name: 'Evaluation progress' });
  await expect(progress).toBeVisible();
  await expect(progress.getByText('AI Detection')).toBeVisible();
  await expect(progress.getByText('20%')).toHaveCount(2);
  await expect(progress.getByText('25%')).toHaveCount(2);
  await expect(progress.getByText('10%')).toBeVisible();

  await expect(page.getByText('AI Evaluation Report')).toBeVisible();
  await expect(page.getByText(report.overallSummary)).toBeVisible();
  await expect(page.getByRole('link', { name: '@tryinnewthings505-a11y' })).toHaveAttribute(
    'href',
    'https://github.com/tryinnewthings505-a11y',
  );
  await expect(progress.getByLabel('AI Detection complete')).toBeVisible();
  await expect(progress.getByLabel('Team Collaboration complete')).toBeVisible();

  const reevaluationRequest = page.waitForRequest(request =>
    request.url().endsWith(`/api/evaluations/${ids.report}/reevaluate`)
      && request.method() === 'POST');
  await page.route(`**/api/evaluations/${ids.report}/reevaluate`, route => route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify(report),
  }));
  await page.getByRole('button', { name: 'Reevaluate' }).click();
  await reevaluationRequest;
  await expect(page.getByText('AI Evaluation Report')).toBeVisible();
});

test('aligns the student score with its notification and includes the evaluation report', async ({ page }) => {
  await mockLogin(page, student);
  await page.route('**/api/parties/my', route => route.fulfill({ status: 404, body: '{}' }));
  await page.route('**/api/users/notifications**', route => route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify({
      unreadCount: 1,
      notifications: [{
        id: 'notification-id',
        title: 'Evaluation Complete',
        message: 'Your score: 54.0/100. Team project score: 63.0/100.',
        type: 'EVALUATION_COMPLETE',
        read: false,
        createdAt: new Date().toISOString(),
      }],
    }),
  }));
  await page.route('**/api/users/my/scorecard', route => route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify({
      id: 'scorecard-id',
      studentId: ids.student,
      averageScore: 54,
      totalProjects: 1,
      entries: [{
        id: 'entry-id',
        project: { id: ids.project, title: 'Network Health Monitor' },
        score: 54,
        createdAt: new Date().toISOString(),
        evaluationReport: report,
      }],
    }),
  }));

  await login(page, student);
  await page.goto('/student/scorecard');

  await expect(page.getByText('Your score: 54/100')).toBeVisible();
  await expect(page.getByText('Team project score: 63/100')).toBeVisible();
  await expect(page.getByText(report.overallSummary)).toBeVisible();

  const switchToLight = page.getByRole('button', { name: 'Switch to light mode' });
  if (await switchToLight.isVisible()) await switchToLight.click();
  await expect(page.getByRole('button', { name: 'Switch to dark mode' })).toBeVisible();
  await expect(page.locator('.evaluation-report-panel')).toHaveCSS('background-color', 'rgb(255, 255, 255)');
  await expect(page.getByText(report.overallSummary)).toHaveCSS('color', 'rgb(71, 85, 105)');

  await page.getByRole('button', { name: 'Notifications' }).click();
  await expect(page.getByText('Your score: 54.0/100. Team project score: 63.0/100.')).toBeVisible();
});

test('shows the completed evaluation report to the project company', async ({ page }) => {
  await mockLogin(page, company);
  await page.route('**/api/users/notifications**', route => route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify({ notifications: [], unreadCount: 0 }),
  }));
  await page.route(`**/api/projects/${ids.project}`, route => route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify({
      id: ids.project,
      title: 'Network Health Monitor',
      companyName: 'Nexa Systems',
      description: 'Monitor network health.',
      status: 'ASSIGNED',
      tools: ['React'],
      partyApplicationCount: 1,
      deadline: new Date(Date.now() + 86_400_000).toISOString(),
      createdAt: new Date().toISOString(),
    }),
  }));
  await page.route(`**/api/parties/projects/${ids.project}/applications`, route => route.fulfill({
    contentType: 'application/json',
    body: '[]',
  }));
  await page.route(`**/api/submissions/project/${ids.project}`, route => route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify([{
      id: ids.submission,
      projectId: ids.project,
      partyId: ids.party,
      status: 'EVALUATED',
      documentUrls: [],
    }]),
  }));
  await page.route(`**/api/evaluations/submission/${ids.submission}`, route => route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify(report),
  }));

  await login(page, company);
  await page.goto(`/company/projects/${ids.project}`);

  await expect(page.getByText('AI Evaluation Report')).toBeVisible();
  await expect(page.getByText(report.overallSummary)).toBeVisible();
  await expect(page.getByText('Team project score /100')).toBeVisible();
});
