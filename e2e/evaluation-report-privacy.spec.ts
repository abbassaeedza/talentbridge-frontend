import { expect, test } from '@playwright/test';
import { sessionToken } from './helpers/questionnaires';
import { sharedReport } from './helpers/evaluations';

for (const role of ['STUDENT', 'COMPANY', 'PROJECT_SUPERVISOR', 'PARTY_SUPERVISOR']) for (const finalized of [false, true]) {
  test(`${role} shared caller ${finalized ? 'renders finalized v2 aggregate and decimals' : 'does not render a v2 draft'}`, async ({ page }) => {
    const user = { id: 'reader-1', email: 'reader@example.test', firstName: 'Frozen', lastName: 'Reader', role,
      status: 'APPROVED', onboardingComplete: true, studentProfile: { skills: [] }, companyProfile: { companyName: 'Test company' }, supervisorProfile: { jobTitle: 'Supervisor' } };
    await page.addInitScript(token => localStorage.setItem('accessToken', token), sessionToken(user.email));
    await page.route(url => url.pathname.startsWith('/api/'), route => route.fulfill({ status: 404, json: { message: 'Fixture not found' } }));
    await page.route('**/api/users/me', route => route.fulfill({ json: user }));
    await page.route('**/api/users/notifications**', route => route.fulfill({ json: { notifications: [], unreadCount: 0 } }));
    const project = { id: 'project-1', title: 'Frozen project', companyName: 'Test company', description: 'Frozen brief',
      status: 'ASSIGNED', tools: [], partyApplicationCount: 1, deadline: null, createdAt: '2026-11-18T12:00:00Z', assignedPartyId: 'party-1' };
    const party = { id: 'party-1', name: 'Frozen team', status: 'SUBMITTED', leader: { id: 'reader-1' }, members: [], assignedProjectId: 'project-1', assignedProjectTitle: project.title };
    const submission = { id: 'submission-1', partyId: 'party-1', projectId: 'project-1', assessmentVersion: 2, version: 8,
      status: 'EVALUATED', repoUrl: 'https://github.com/example/frozen', repoBranch: 'main', documentUrls: [] };
    await page.route('**/api/projects/project-1', route => route.fulfill({ json: project }));
    await page.route('**/api/parties/my', route => route.fulfill({ json: party }));
    await page.route('**/api/parties/party-1', route => route.fulfill({ json: party }));
    await page.route('**/api/parties/party-1/applications', route => route.fulfill({ json: [] }));
    await page.route('**/api/parties/projects/project-1/applications', route => route.fulfill({ json: [] }));
    await page.route('**/api/questionnaires/my', route => route.fulfill({ json: [] }));
    await page.route('**/api/submissions/party-1', route => route.fulfill({ json: submission }));
    await page.route('**/api/submissions/project/project-1', route => route.fulfill({ json: [submission] }));
    let reportReads = 0;
    await page.route('**/api/evaluations/submission/submission-1', route => {
      reportReads++;
      return route.fulfill({ json: sharedReport({ finalized }) });
    });
    const requests: string[] = [];
    const errors: string[] = [];
    page.on('request', request => requests.push(new URL(request.url()).pathname));
    page.on('pageerror', error => errors.push(error.message));
    const path = role === 'STUDENT' ? '/student/submission' : role === 'COMPANY' ? '/company/projects/project-1'
      : role === 'PROJECT_SUPERVISOR' ? '/project-supervisor/projects/project-1' : '/party-supervisor/parties/party-1';
    await page.goto(path);
    await expect.poll(() => reportReads).toBe(1);
    if (finalized) {
      await expect(page.getByText('Combined team score /100')).toBeVisible();
      await expect(page.getByText('81.0', { exact: true })).toBeVisible();
      await expect(page.getByText('80.9', { exact: true })).toBeVisible();
      await expect(page.getByText('Team questionnaire score /100')).toBeVisible();
    } else {
      await expect(page.locator('.evaluation-report-panel')).toBeHidden();
      await expect(page.getByText('81.0', { exact: true })).toBeHidden();
      await expect(page.getByText('Shared repository-only summary.')).toBeHidden();
    }
    await expect(page.getByRole('button', { name: /Save correction|Finalize Report|Reevaluate/ })).toHaveCount(0);
    expect(requests.some(path => path.endsWith('/questionnaire') || path.endsWith('/questionnaire-review'))).toBe(false);
    await expect(page.getByText('Hidden rubric', { exact: false })).toBeHidden();
    await expect(page.getByText('Locked private answer', { exact: false })).toBeHidden();
    expect(errors).toEqual([]);
  });
}
