import { expect, test, type Page } from '@playwright/test';
import { mockCredentialLogin, signIn } from './helpers/auth';

const project = {
  id: 'dashboard-project', title: 'Research workspace', status: 'OPEN',
  description: 'A synthetic project.', companyName: 'Fixture company',
  partyApplicationCount: 3, deadline: '2035-12-01T10:00:00Z',
};
const party = {
  id: 'dashboard-party', name: 'Research team', status: 'ASSIGNED', members: [],
  assignedProjectId: project.id, assignedProjectTitle: project.title,
  assignedProjectDeadline: project.deadline,
};
const paged = (content: unknown[]) => ({ content, totalElements: content.length, totalPages: 1 });
const dashboards = [
  { role: 'STUDENT', path: '/student/dashboard', endpoint: '/api/parties/my', section: 'My party', populated: party.name, empty: "You're not in a party yet.", falseEmpty: 'No party' },
  { role: 'COMPANY', path: '/company/dashboard', endpoint: '/api/projects/my', section: 'Recent projects', populated: project.title, empty: 'No projects yet', falseEmpty: 'No projects yet' },
  { role: 'COORDINATOR', path: '/coordinator/dashboard', endpoint: '/api/projects/all', section: 'Recent projects', populated: project.title, empty: 'No projects available.', falseEmpty: 'No projects available.' },
  { role: 'PROJECT_SUPERVISOR', path: '/project-supervisor/overview', endpoint: '/api/projects/supervised', section: 'Supervised projects', populated: project.title, empty: 'No supervised projects yet.', falseEmpty: 'No supervised projects yet.' },
  { role: 'PARTY_SUPERVISOR', path: '/party-supervisor/overview', endpoint: '/api/parties/supervised', section: 'Supervised parties', populated: project.title, empty: 'No supervised parties yet.', falseEmpty: 'No supervised parties yet.' },
];
type Dashboard = typeof dashboards[number];

for (const theme of ['light', 'dark']) for (const width of [360, 390]) {
  test(`coordinator launcher clears last recent project: ${theme} ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    await page.addInitScript(value => localStorage.setItem('talentbridge-theme', value), theme);
    const api = await dashboardApi(page, dashboards[2]);
    await page.route('**/api/projects/all*', route => route.fulfill({ json: paged(
      Array.from({ length: 5 }, (_, index) => ({ ...project, id: `clearance-${index}`, title: `Recent project ${index + 1}` })),
    ) }));
    await api.open();
    const row = page.getByRole('region', { name: 'Recent projects', exact: true }).getByRole('link').last();
    await expect(row).toContainText('Recent project 5');
    const main = page.locator('main');
    expect(await main.evaluate(element => element.scrollHeight > element.clientHeight)).toBeTruthy();
    await main.evaluate(element => { element.scrollTop = element.scrollHeight; });
    const launcher = page.getByRole('button', { name: 'Open AI assistant', exact: true });
    await expect(launcher).toBeVisible();
    await expect.poll(async () => {
      const rowBox = await row.boundingBox();
      const launcherBox = await launcher.boundingBox();
      expect(rowBox).not.toBeNull();
      expect(launcherBox).not.toBeNull();
      return rowBox!.x < launcherBox!.x + launcherBox!.width
        && rowBox!.x + rowBox!.width > launcherBox!.x
        && rowBox!.y < launcherBox!.y + launcherBox!.height
        && rowBox!.y + rowBox!.height > launcherBox!.y;
    }).toBe(false);
  });
}

async function dashboardApi(page: Page, dashboard: Dashboard) {
  const user = {
    id: 'dashboard-user', email: 'dashboard@example.test', firstName: 'Research', lastName: 'User',
    role: dashboard.role, status: 'APPROVED', onboardingComplete: true,
    githubUsername: 'fixture-user', studentProfile: { skills: ['Research'] },
    companyProfile: { companyName: 'Fixture company' },
    supervisorProfile: { jobTitle: 'Research mentor', department: 'Computing', bio: 'Guides synthetic project teams.' },
  };
  const state = { empty: false, failures: new Set<string>(), held: new Set<string>() };
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  await page.route(url => url.pathname.startsWith('/api/'), async route => {
    const path = new URL(route.request().url()).pathname;
    if (state.held.has(path)) await gate;
    if (state.failures.has(path)) {
      await route.fulfill({ status: 503, json: { message: 'Temporarily unavailable' } });
      return;
    }
    const values: Record<string, unknown> = {
      '/api/auth/config': { demoMode: false },
      '/api/users/notifications': { notifications: [], unreadCount: 0 },
      '/api/parties/my': state.empty ? null : party,
      '/api/projects': state.empty ? paged([]) : { ...paged([project]), totalElements: 22 },
      '/api/projects/global-deadline': { enabled: !state.empty, deadline: state.empty ? null : project.deadline },
      '/api/users/my/scorecard': state.empty ? null : { averageScore: 87, totalProjects: 2, entries: [{ id: 'entry', project, score: 87 }] },
      '/api/projects/my': state.empty ? [] : [project],
      '/api/projects/supervised': state.empty ? [] : [project],
      '/api/parties/supervised': state.empty ? [] : [party],
      '/api/projects/all': paged(state.empty ? [] : [project]),
      '/api/parties/all': state.empty ? [] : [party],
      '/api/users/pending': paged(state.empty ? [] : [{ ...user, id: 'pending-user', firstName: 'Pending', status: 'PENDING' }]),
      '/api/coordinator/analytics': { projectsByStatus: state.empty ? {} : { OPEN: 1 }, usersByRole: state.empty ? {} : { STUDENT: 4 }, submissionsByStatus: state.empty ? {} : { EVALUATED: 2 } },
    };
    expect(path in values, `Unexpected API request: ${path}`).toBeTruthy();
    if (path === '/api/parties/my' && state.empty) {
      await route.fulfill({ status: 404, json: { message: 'You are not in any party yet' } });
    } else if (path === '/api/users/my/scorecard' && state.empty) {
      await route.fulfill({ status: 200, body: '' });
    } else {
      await route.fulfill({ json: values[path] });
    }
  });
  await mockCredentialLogin(page, user);
  return { state, release, async open() {
    await signIn(page, user.email);
    await expect(page).toHaveURL(dashboard.path);
  } };
}

for (const dashboard of dashboards) {
  test(`${dashboard.role}: slow sections never claim empty or zero`, async ({ page }) => {
    const api = await dashboardApi(page, dashboard);
    api.state.held.add(dashboard.endpoint);
    try {
      await api.open();
      await expect(page.getByText(dashboard.falseEmpty, { exact: true })).toBeHidden();
      const section = page.getByRole('region', { name: dashboard.section, exact: true });
      await expect(section.getByRole('status')).toContainText('Loading');
      await expect(section).toHaveAttribute('aria-busy', 'true');
      api.release();
      await expect(section.getByText(dashboard.populated, { exact: true }).first()).toBeVisible();
    } finally { api.release(); }
  });

  test(`${dashboard.role}: 503 is retryable, not empty`, async ({ page }) => {
    const api = await dashboardApi(page, dashboard);
    api.state.failures.add(dashboard.endpoint);
    await api.open();
    await expect(page.getByText(dashboard.falseEmpty, { exact: true })).toBeHidden();
    const section = page.getByRole('region', { name: dashboard.section, exact: true });
    await expect(section.getByRole('alert')).toContainText("Couldn't load");
    const retry = section.getByRole('button', { name: `Retry ${dashboard.section.toLowerCase()}`, exact: true });
    const box = await retry.boundingBox();
    expect(box!.height).toBeGreaterThanOrEqual(44);
    expect(box!.width).toBeGreaterThanOrEqual(44);
    api.state.failures.clear();
    await retry.click();
    await expect(section.getByText(dashboard.populated, { exact: true }).first()).toBeVisible();
    await expect(section.getByRole('alert')).toBeHidden();
  });

  test(`${dashboard.role}: refetch retains data through pending and error`, async ({ page }) => {
    const api = await dashboardApi(page, dashboard);
    await api.open();
    const section = page.getByRole('region', { name: dashboard.section, exact: true });
    await expect(section.getByText(dashboard.populated, { exact: true }).first()).toBeVisible();
    api.state.held.add(dashboard.endpoint);
    await page.clock.setFixedTime(new Date(Date.now() + 60_000));
    await page.evaluate(() => window.dispatchEvent(new Event('visibilitychange')));
    try {
      await expect(section.getByRole('status')).toContainText('Updating');
      await expect(section.getByText(dashboard.populated, { exact: true }).first()).toBeVisible();
      api.state.failures.add(dashboard.endpoint);
      api.release();
      await expect(section.getByRole('alert')).toContainText('Showing last available data');
      await expect(section.getByText(dashboard.populated, { exact: true }).first()).toBeVisible();
      api.state.failures.clear();
      await section.getByRole('button', { name: `Retry ${dashboard.section.toLowerCase()}`, exact: true }).click();
      await expect(section.getByRole('alert')).toBeHidden();
    } finally { api.release(); }
  });

  test(`${dashboard.role}: successful empty response shows genuine absence`, async ({ page }) => {
    const api = await dashboardApi(page, dashboard);
    api.state.empty = true;
    await api.open();
    await expect(page.getByText(dashboard.empty, { exact: true })).toBeVisible();
    await expect(page.getByRole('alert')).toBeHidden();
    if (dashboard.role === 'STUDENT') {
      await expect(page.getByText('No evaluations yet.', { exact: true })).toBeVisible();
      await expect(page.getByText('No deadline scheduled', { exact: true })).toBeVisible();
    }
  });
}

test('student independent failures preserve successful sections and never invent scores or deadlines', async ({ page }) => {
  const api = await dashboardApi(page, dashboards[0]);
  api.state.empty = true;
  api.state.failures.add('/api/users/my/scorecard');
  api.state.failures.add('/api/projects/global-deadline');
  await api.open();
  await expect(page.getByText("You're not in a party yet.", { exact: true })).toBeVisible();
  await expect(page.getByText('No evaluations yet.', { exact: true })).toBeHidden();
  await expect(page.getByText('No deadline scheduled', { exact: true })).toBeHidden();
  await expect(page.getByRole('region', { name: 'My scorecard', exact: true }).getByRole('alert')).toBeVisible();
  await expect(page.getByRole('region', { name: 'Application deadline', exact: true }).getByRole('alert')).toBeVisible();
  await expect(page.getByRole('region', { name: 'Projects completed', exact: true }).getByText('0', { exact: true })).toBeHidden();
});

test('coordinator partial analytics failure keeps approvals and projects available', async ({ page }) => {
  const api = await dashboardApi(page, dashboards[2]);
  api.state.failures.add('/api/coordinator/analytics');
  await api.open();
  await expect(page.getByRole('region', { name: 'Recent projects', exact: true }).getByText(project.title)).toBeVisible();
  await expect(page.getByRole('region', { name: 'Pending approvals list', exact: true }).getByText('Pending User')).toBeVisible();
  await expect(page.getByRole('region', { name: 'Projects by status', exact: true }).getByRole('alert')).toBeVisible();
  await expect(page.getByText('No data available.')).toHaveCount(0);
});

test('student scorecard 404 stays an error, not a missing evaluation', async ({ page }) => {
  const api = await dashboardApi(page, dashboards[0]);
  await page.route('**/api/users/my/scorecard', route => route.fulfill({ status: 404, json: { message: 'Not found' } }));
  await api.open();
  await expect(page.getByRole('region', { name: 'My scorecard', exact: true }).getByRole('alert')).toContainText("Couldn't load");
  await expect(page.getByText('No evaluations yet.', { exact: true })).toBeHidden();
  await expect(page.getByRole('region', { name: 'My party', exact: true }).getByText(party.name)).toBeVisible();
});

test('student successful null scorecard is a genuine empty result', async ({ page }) => {
  const api = await dashboardApi(page, dashboards[0]);
  await page.route('**/api/users/my/scorecard', route => route.fulfill({ json: null }));
  await api.open();
  await expect(page.getByText('No evaluations yet.', { exact: true })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Projects completed', exact: true }).getByText('0', { exact: true })).toBeVisible();
  await expect(page.getByRole('alert')).toBeHidden();
});

for (const theme of ['light', 'dark']) {
  for (const width of [360, 390, 1440]) {
    for (const dashboard of dashboards) {
      test(`${dashboard.role}: ${theme} ${width}px remains contained`, async ({ page }, testInfo) => {
        await page.setViewportSize({ width, height: 900 });
        await page.addInitScript(value => localStorage.setItem('talentbridge-theme', value), theme);
        const errors: string[] = [];
        page.on('pageerror', error => errors.push(error.message));
        const api = await dashboardApi(page, dashboard);
        api.state.held.add(dashboard.endpoint);
        const section = page.getByRole('region', { name: dashboard.section, exact: true });
        const contained = async () => {
          expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
          const overflow = await page.locator('main [role="region"]').evaluateAll(elements => elements
            .filter(element => element.scrollWidth > element.clientWidth + 1)
            .map(element => element.getAttribute('aria-label')));
          expect(overflow).toEqual([]);
        };
        try {
          await api.open();
          await expect(section.getByRole('status')).toContainText('Loading');
          await contained();
          api.state.failures.add(dashboard.endpoint);
          api.release();
          await expect(section.getByRole('alert')).toBeVisible();
          await contained();
          if (width === 390 || width === 1440) await page.screenshot({ path: testInfo.outputPath('dashboard-error.png'), fullPage: true });
          const retry = section.getByRole('button', { name: `Retry ${dashboard.section.toLowerCase()}`, exact: true });
          const box = await retry.boundingBox();
          expect(box!.height).toBeGreaterThanOrEqual(44);
          expect(box!.width).toBeGreaterThanOrEqual(44);
          api.state.failures.clear();
          await retry.click();
          await expect(section.getByText(dashboard.populated, { exact: true }).first()).toBeVisible();
          await contained();
          if (width === 390 || width === 1440) await page.screenshot({ path: testInfo.outputPath('dashboard.png'), fullPage: true });
          api.state.empty = true;
          await page.clock.setFixedTime(new Date(Date.now() + 60_000));
          await page.evaluate(() => window.dispatchEvent(new Event('visibilitychange')));
          await expect(page.getByText(dashboard.empty, { exact: true })).toBeVisible();
          await contained();
          expect(errors).toEqual([]);
        } finally { api.release(); }
      });
    }
  }
}
