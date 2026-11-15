import { expect, test, type Locator, type Page } from '@playwright/test';
import { mockCredentialLogin, signIn } from './helpers/auth';

const projectId = '00000000-0000-0000-0000-000000000701';
const project = {
  id: projectId, title: 'Timezone boundary project', description: 'Synthetic deadline test.',
  status: 'OPEN', companyName: 'Fixture Company', tools: [], partyApplicationCount: 0,
  createdAt: '2030-12-01T10:00:00', deadline: '2031-01-02T00:00:00',
};
const pageResponse = (content: object[]) => ({ content, totalElements: content.length, totalPages: 1, page: 0, size: 20, first: true, last: true });

async function mockApi(page: Page, role: 'STUDENT' | 'COMPANY' | 'COORDINATOR', deadline: string | null = project.deadline) {
  const user = {
    id: '00000000-0000-0000-0000-000000000702', email: 'deadline@example.test',
    firstName: 'Deadline', lastName: 'Fixture', role, status: 'APPROVED', onboardingComplete: true,
    companyProfile: { companyName: 'Fixture Company' }, studentProfile: { skills: [] },
  };
  const writes: { path: string; deadline: string | null }[] = [];
  // Every API request is intercepted, including unexpected paths. No real backend is contacted.
  await page.route(url => url.pathname.startsWith('/api/'), async route => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    const json = (body: unknown) => route.fulfill({ contentType: 'application/json', body: JSON.stringify(body) });
    if (request.method() !== 'GET') {
      const value = path.endsWith('/deadline') ? url.searchParams.get('deadline') : request.postDataJSON()?.deadline;
      writes.push({ path, deadline: value });
      if (path.endsWith('/preview')) return json({ affectedCounts: { OPEN: 1 }, excludedFinishedCount: 0 });
      return json({ ...project, deadline: value });
    }
    if (path === '/api/users/notifications') return json({ notifications: [], unreadCount: 0 });
    if (path === '/api/projects/global-deadline') return json({ enabled: true, deadline });
    if (path === `/api/projects/${projectId}`) return json({ ...project, deadline });
    if (path === '/api/projects/my') return json([{ ...project, deadline }]);
    if (path === '/api/projects' || path === '/api/projects/all' || path === '/api/users/pending') return json(pageResponse(path.includes('projects') ? [{ ...project, deadline }] : []));
    if (path === '/api/parties/rules') return json({ minSize: 2, maxSize: 4, supervisorMaxParties: 2 });
    if (path === '/api/parties/all') return json([{
      id: 'party-7', name: 'Timezone party', status: 'ASSIGNED', members: [], leader: user,
      assignedProjectId: projectId, assignedProjectTitle: project.title, assignedProjectDeadline: deadline,
    }]);
    if (path === '/api/parties/my' || path === '/api/users/my/scorecard') return route.fulfill({ status: 404, body: '{}' });
    if (path === '/api/coordinator/analytics') return json({ projectsByStatus: {}, studentsByStatus: {}, companiesByStatus: {} });
    return json([]);
  });
  await mockCredentialLogin(page, user);
  await signIn(page, user.email);
  await expect(page).toHaveURL(new RegExp(`/${role.toLowerCase()}/dashboard$`));
  return writes;
}

for (const width of [360, 390]) {
  for (const theme of ['light', 'dark'] as const) {
    test(`deadline picker fits ${width}px in ${theme} theme`, async ({ page }) => {
      await page.setViewportSize({ width, height: 844 });
      await page.addInitScript(theme => localStorage.setItem('talentbridge-theme', theme), theme);
      await mockApi(page, 'COMPANY');
      await page.goto(`/company/projects/${projectId}/edit`);
      await expect(page.getByText('Asia/Karachi (UTC+05:00)', { exact: true })).toBeVisible();
      await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
      await page.getByRole('button', { name: /^Choose application deadline/ }).click();
      const calendar = page.getByRole('grid');
      await expect(calendar).toBeVisible();
      const bounds = await calendar.boundingBox();
      expect(bounds).not.toBeNull();
      expect(bounds!.x).toBeGreaterThanOrEqual(0);
      expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    });
  }
}

async function fillWallTime(page: Page, label: string) {
  const group = page.getByRole('group', { name: label, exact: true });
  for (const [segment, value] of Object.entries({ month: '1', day: '2', year: '2031', hour: '1', minute: '30' })) {
    await group.locator(`[data-type="${segment}"]`).fill(value);
  }
  const period = group.locator('[data-type="dayPeriod"]');
  if (await period.count()) await period.press('a');
  await group.locator('[data-type="minute"]').press('Tab');
}

async function clearSegment(segment: Locator) {
  await segment.focus();
  while (await segment.getAttribute('aria-valuenow') !== null) await segment.press('Backspace');
}

for (const control of [
  { name: 'project Set', path: '/coordinator/projects', label: `Deadline for ${project.title}`, button: `Set deadline for ${project.title}` },
  { name: 'global Preview', path: '/coordinator/projects', label: 'Global deadline date and time', button: 'Preview changes' },
  { name: 'party Update', path: '/coordinator/parties', label: 'Deadline for party Timezone party', button: 'Update deadline for party Timezone party' },
]) {
  test(`${control.name} blocks incomplete date edits until completed`, async ({ page }, testInfo) => {
    const writes = await mockApi(page, 'COORDINATOR');
    await page.goto(control.path);
    const group = page.getByRole('group', { name: control.label, exact: true });
    const day = group.locator('[data-type="day"]');
    const button = page.getByRole('button', { name: control.button, exact: true });
    await expect(button).toBeEnabled();
    await day.focus();
    await day.press('Backspace');
    await expect(day).toHaveText('dd');
    await day.press('Tab');
    await page.screenshot({ path: testInfo.outputPath('incomplete-date.png') });
    if (await button.isEnabled()) await button.click();
    expect(writes, 'An incomplete visible date must never submit the previous deadline').toEqual([]);
    await expect(button).toBeDisabled();
    await day.fill('3');
    await day.press('Tab');
    await expect(button).toBeEnabled();
    for (const type of ['month', 'year', 'hour', 'minute', 'dayPeriod']) {
      const segment = group.locator(`[data-type="${type}"]`);
      if (!await segment.count()) continue;
      const original = await segment.innerText();
      await clearSegment(segment);
      await expect(button).toBeDisabled();
      if (type === 'dayPeriod') await segment.press(original.toLowerCase().startsWith('a') ? 'a' : 'p');
      else await segment.fill(original);
      await segment.press('Tab');
      await expect(button).toBeEnabled();
    }
    expect(writes).toEqual([]);
    await button.click();
    await expect.poll(() => writes.length).toBe(1);
    expect(writes[0].deadline).toBe('2031-01-03T00:00:00');
  });
}

for (const mode of ['create', 'edit', 'draft'] as const) {
  test(`company ${mode} blocks incomplete date writes until completed`, async ({ page }, testInfo) => {
    const writes = await mockApi(page, 'COMPANY');
    await page.goto(mode === 'edit' ? `/company/projects/${projectId}/edit` : '/company/projects/new');
    if (mode !== 'edit') {
      await page.getByRole('textbox', { name: /^Project title/ }).fill(project.title);
      await page.getByRole('textbox', { name: /^Project description/ }).fill(project.description);
      await fillWallTime(page, 'Application deadline');
    }
    const group = page.getByRole('group', { name: 'Application deadline', exact: true });
    const month = group.locator('[data-type="month"]');
    const button = page.getByRole('button', { name: mode === 'edit' ? 'Save changes' : mode === 'draft' ? 'Save as draft' : 'Submit for review', exact: true });
    await expect(button).toBeEnabled();
    await month.focus();
    await month.press('Backspace');
    await expect(month).toHaveText('mm');
    await month.press('Tab');
    await page.screenshot({ path: testInfo.outputPath('company-incomplete-date.png') });
    if (await button.isEnabled()) await button.click();
    expect(writes, 'Company actions must not submit the old date when a segment is incomplete').toEqual([]);
    await expect(button).toBeDisabled();
    await page.getByRole('textbox', { name: /^Project title/ }).press('Enter');
    expect(writes).toEqual([]);
    await month.fill('2');
    await month.press('Tab');
    await button.click();
    await expect.poll(() => writes.length).toBe(1);
    expect(writes[0].deadline).toBe(mode === 'edit' ? '2031-02-02T00:00:00' : '2031-02-01T20:30:00');
  });
}

for (const mode of ['create', 'edit', 'draft'] as const) {
  test(`company ${mode} allows an optional deadline to be cleared and retains required validation`, async ({ page }) => {
    const writes = await mockApi(page, 'COMPANY');
    await page.goto(mode === 'edit' ? `/company/projects/${projectId}/edit` : '/company/projects/new');
    const title = page.getByRole('textbox', { name: /^Project title/ });
    const description = page.getByRole('textbox', { name: /^Project description/ });
    const button = page.getByRole('button', { name: mode === 'edit' ? 'Save changes' : mode === 'draft' ? 'Save as draft' : 'Submit for review', exact: true });
    await title.fill('');
    await expect(button).toBeDisabled();
    await title.fill(project.title);
    await description.fill('');
    await expect(button).toBeDisabled();
    await description.fill(project.description);
    await fillWallTime(page, 'Application deadline');
    const group = page.getByRole('group', { name: 'Application deadline', exact: true });
    for (const segment of await group.getByRole('spinbutton').all()) {
      await clearSegment(segment);
    }
    await expect(group.locator('[data-type="month"]')).toHaveText('mm');
    await expect(group.locator('[data-type="day"]')).toHaveText('dd');
    await expect(button).toBeEnabled();
    expect(writes).toEqual([]);
    await button.click();
    await expect.poll(() => writes.length).toBe(1);
    expect(writes[0].deadline).toBeUndefined();
  });
}

for (const timezoneId of ['UTC', 'America/Los_Angeles', 'Asia/Karachi']) {
  test.describe(timezoneId, () => {
    test.use({ timezoneId });

    test('naive UTC countdown expires exactly at the server boundary', async ({ page }) => {
      const now = new Date('2031-01-01T23:59:58Z');
      await page.clock.setFixedTime(now);
      await mockApi(page, 'STUDENT');
      await page.goto(`/student/projects/${projectId}`);
      await expect(page.getByText('0d 00:00:02', { exact: true })).toBeVisible();
      await expect(page.getByText('Due 02 Jan 2031, 05:00 (Asia/Karachi)', { exact: true })).toBeVisible();
      await page.clock.setFixedTime(new Date('2031-01-02T00:00:00Z'));
      await expect(page.getByText('Expired', { exact: true })).toBeVisible();
    });

    test('offset-aware stored deadline is displayed in Karachi without a write', async ({ page }) => {
      const writes = await mockApi(page, 'COORDINATOR', '2031-01-02T05:00:45.123+05:00');
      await page.goto('/coordinator/projects');
      const group = page.getByRole('group', { name: 'Global deadline date and time', exact: true });
      await expect(group.locator('[data-type="hour"]')).toHaveText('5');
      await expect(group.locator('[data-type="minute"]')).toHaveText('00');
      await expect(page.getByText('02 Jan 2031, 05:00 (Asia/Karachi)', { exact: true }).first()).toBeVisible();
      await expect(page.getByText('Asia/Karachi (UTC+05:00)', { exact: true }).first()).toBeVisible();
      expect(writes).toEqual([]);
    });

    test('global preview and save send Karachi input as naive UTC across midnight', async ({ page }) => {
      const writes = await mockApi(page, 'COORDINATOR');
      await page.goto('/coordinator/projects');
      await fillWallTime(page, 'Global deadline date and time');
      await page.getByRole('button', { name: 'Preview changes', exact: true }).click();
      await expect(page.getByRole('heading', { name: 'Confirm global deadline' })).toBeVisible();
      await page.getByRole('button', { name: 'Confirm and apply' }).click();
      await expect.poll(() => writes).toEqual([
        { path: '/api/projects/global-deadline/preview', deadline: '2031-01-01T20:30:00' },
        { path: '/api/projects/global-deadline', deadline: '2031-01-01T20:30:00' },
      ]);
    });

    test('individual project and party controls send naive UTC query parameters', async ({ page }) => {
      const writes = await mockApi(page, 'COORDINATOR');
      await page.goto('/coordinator/projects');
      await fillWallTime(page, `Deadline for ${project.title}`);
      await page.getByRole('button', { name: `Set deadline for ${project.title}`, exact: true }).click();
      await expect.poll(() => writes.length).toBe(1);
      await page.goto('/coordinator/parties');
      await fillWallTime(page, 'Deadline for party Timezone party');
      await page.getByRole('button', { name: 'Update deadline for party Timezone party', exact: true }).click();
      await expect.poll(() => writes).toEqual([
        { path: `/api/projects/${projectId}/deadline`, deadline: '2031-01-01T20:30:00' },
        { path: `/api/projects/${projectId}/deadline`, deadline: '2031-01-01T20:30:00' },
      ]);
    });

    test('company edit preserves untouched UTC precision and converts changed wall time', async ({ page }) => {
      const writes = await mockApi(page, 'COMPANY', '2031-01-02T00:00:45.123456');
      await page.goto(`/company/projects/${projectId}/edit`);
      await expect(page.getByRole('group', { name: 'Application deadline', exact: true }).locator('[data-type="hour"]')).toHaveText('5');
      await page.getByRole('button', { name: 'Save changes', exact: true }).click();
      await expect.poll(() => writes[0]?.deadline).toBe('2031-01-02T00:00:45.123456');
      await page.goto(`/company/projects/${projectId}/edit`);
      await fillWallTime(page, 'Application deadline');
      await page.getByRole('button', { name: 'Save changes', exact: true }).click();
      await expect.poll(() => writes[1]?.deadline).toBe('2031-01-01T20:30:00');
    });

    test('invalid timestamps show unavailable instead of NaN or a fabricated countdown', async ({ page }) => {
      const errors: string[] = [];
      page.on('pageerror', error => errors.push(error.message));
      await mockApi(page, 'STUDENT', 'not-a-deadline');
      await page.goto(`/student/projects/${projectId}`);
      await expect(page.getByText('Deadline unavailable', { exact: true })).toBeVisible();
      await expect(page.getByText(/NaN|Invalid Date/)).toHaveCount(0);
      expect(errors).toEqual([]);
    });

    test('missing timestamps remain no deadline', async ({ page }) => {
      await mockApi(page, 'STUDENT', null);
      await page.goto(`/student/projects/${projectId}`);
      await expect(page.getByText('No deadline', { exact: true })).toBeVisible();
    });
  });
}
