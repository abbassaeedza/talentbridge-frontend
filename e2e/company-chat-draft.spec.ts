import { expect, test, type Page } from '@playwright/test';

const company = { id: '00000000-0000-0000-0000-000000000020', email: 'company@example.test', firstName: 'Company', lastName: 'Fixture', role: 'COMPANY', status: 'APPROVED', onboardingComplete: true };
const draft = { title: 'AI Customer Support Portal', description: 'A portal that helps support agents answer customer questions.', scope: 'Build the web portal and searchable knowledge base.', deliverables: 'Working application and documentation.', evaluationCriteria: 'Usability, accuracy, and code quality.', projectField: 'Software', tools: ['React', 'Spring Boot'] };
const existing = { id: 'existing', title: 'Existing title', description: 'Existing description', status: 'DRAFT', tools: [], partyApplicationCount: 0, createdAt: '2030-01-01T00:00:00', deadline: null };

async function setup(page: Page, options: { draft?: unknown; save?: 'ok' | 'network' | 'server' | 'malformed' | 'validation' } = {}) {
  const appOrigin = new URL(test.info().project.use.baseURL!).origin;
  const writes: { path: string; method: string; data: any }[] = [];
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(company => {
    const payload = btoa(JSON.stringify({ sub: company.id, ver: 0, exp: Math.floor(Date.now() / 1000) + 3600 }));
    localStorage.setItem('accessToken', `header.${payload}.signature`);
  }, company);
  await page.route('**/*', async route => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    const json = (value: unknown, status = 200) => route.fulfill({ status, json: value });
    if (path.startsWith('/api/')) {
      if (path === '/api/users/me') return json(company);
      if (path === '/api/users/notifications') return json({ notifications: [], unreadCount: 0 });
      if (path === '/api/chat') return json({ message: 'Here is a project suggestion. Review it before filling the form.', model: 'fixture', source: 'llm', projectDraft: options.draft ?? draft });
      if (request.method() !== 'GET') {
        writes.push({ path, method: request.method(), data: request.postDataJSON() });
        if (options.save === 'network') return route.abort('connectionreset');
        if (options.save === 'server') return json({ message: 'Server failed after accepting request' }, 503);
        if (options.save === 'malformed') return json({});
        if (options.save === 'validation') return json({ message: 'Title is not valid' }, 400);
        return json({ ...existing, ...request.postDataJSON(), id: 'saved', status: 'DRAFT' });
      }
      if (path === '/api/projects/existing' || path === '/api/projects/saved') return json(existing);
      if (path === '/api/projects/my') return json([existing]);
      return json([]);
    }
    if (url.origin === appOrigin) return route.continue();
    return route.fulfill({ status: 200, body: '' });
  });
  await page.goto('/company/projects/new');
  await expect(page.getByRole('heading', { name: 'Create project' })).toBeVisible();
  return { writes, errors };
}

async function askForDraft(page: Page) {
  await page.getByRole('button', { name: 'Open AI assistant' }).click();
  await page.getByPlaceholder('Ask about TalentBridge').fill('Create an AI support portal using React and Spring Boot');
  await page.getByRole('button', { name: 'Send message' }).click();
  await expect(page.getByText('Here is a project suggestion. Review it before filling the form.', { exact: true })).toBeVisible();
}

test('does not write or prefill a project after an AI reply without explicit review', async ({ page }) => {
  const { writes, errors } = await setup(page);
  await askForDraft(page);
  expect(writes).toEqual([]);
  await expect(page.getByLabel('Project title')).toHaveValue('');
  await expect(page.getByLabel('Project description')).toHaveValue('');
  await expect(page.getByRole('button', { name: 'Fill empty fields' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Review suggestion' }).click();
  expect(writes).toEqual([]);
  await expect(page.getByLabel('Project title')).toHaveValue('');
  await page.getByRole('button', { name: 'Fill empty fields' }).click();
  await expect(page.getByLabel('Project title')).toHaveValue(draft.title);
  await expect(page.getByLabel('Project description')).toHaveValue(draft.description);
  await expect(page.getByRole('button', { name: 'Software', exact: true })).toHaveAttribute('aria-pressed', 'true');
  expect(writes).toEqual([]);
  await page.getByRole('button', { name: 'Save as draft', exact: true }).click();
  await expect.poll(() => writes.length).toBe(1);
  expect(writes[0]).toMatchObject({ method: 'POST', path: '/api/projects', data: { ...draft, saveAsDraft: true } });
  expect(errors).toEqual([]);
});

test('review and explicit prefill preserve user text and existing edit fields', async ({ page }) => {
  const { writes } = await setup(page);
  await page.goto('/company/projects/existing/edit');
  await page.getByLabel('Project scope').fill('My handwritten scope');
  await askForDraft(page);
  await page.getByRole('button', { name: 'Review suggestion' }).click();
  await page.getByRole('button', { name: 'Fill empty fields' }).click();
  await expect(page.getByLabel('Project title')).toHaveValue(existing.title);
  await expect(page.getByLabel('Project description')).toHaveValue(existing.description);
  await expect(page.getByLabel('Project scope')).toHaveValue('My handwritten scope');
  await expect(page.getByLabel('Expected deliverables')).toHaveValue(draft.deliverables);
  expect(writes).toEqual([]);
  await page.getByRole('button', { name: 'Save changes', exact: true }).click();
  await expect.poll(() => writes.length).toBe(1);
  expect(writes[0]).toMatchObject({ path: '/api/projects/existing', method: 'PUT', data: { title: existing.title, scope: 'My handwritten scope' } });
});

test('malformed tools and injected ownership/persistence fields never crash, execute HTML, or reach the form save', async ({ page }) => {
  const { writes, errors } = await setup(page, { draft: { title: '<img src=x onerror=alert(1)>', description: 'Safe description', tools: 'not-an-array', id: 'attacker', companyId: 'attacker', deadline: '2000-01-01T00:00:00', projectSupervisorId: 'attacker', saveAsDraft: false, status: 'OPEN' } });
  await askForDraft(page);
  await page.getByRole('button', { name: 'Review suggestion' }).click();
  await expect(page.getByRole('dialog').locator('img')).toHaveCount(0);
  await page.getByRole('button', { name: 'Fill empty fields' }).click();
  await expect(page.getByLabel('Project title')).toHaveValue('<img src=x onerror=alert(1)>');
  expect(writes).toEqual([]);
  await page.getByRole('button', { name: 'Save as draft', exact: true }).click();
  await expect.poll(() => writes.length).toBe(1);
  expect(writes[0].data.tools).toEqual([]);
  for (const field of ['id', 'companyId', 'status']) expect(writes[0].data).not.toHaveProperty(field);
  expect(writes[0].data.deadline).toBeUndefined();
  expect(writes[0].data.projectSupervisorId).toBeUndefined();
  expect(errors).toEqual([]);
});

for (const mode of ['create', 'draft', 'edit'] as const) {
  for (const failure of ['network', 'server', 'malformed'] as const) {
    test(`${mode} ${failure} save outcome is unknown and blocks immediate repeated writes`, async ({ page }) => {
      const { writes } = await setup(page, { save: failure });
      if (mode === 'edit') await page.goto('/company/projects/existing/edit');
      else {
        await page.getByLabel('Project title').fill('Manual title');
        await page.getByLabel('Project description').fill('Manual description');
      }
      const save = page.getByRole('button', { name: mode === 'edit' ? 'Save changes' : mode === 'draft' ? 'Save as draft' : 'Submit for review', exact: true });
      await save.click();
      await expect(page.getByRole('alert').filter({ hasText: 'Save outcome unknown' })).toBeVisible();
      await expect(save).toBeDisabled();
      await expect(page.getByRole('link', { name: 'Inspect projects' })).toHaveAttribute('href', '/company/projects');
      await page.getByLabel('Project title').press('Enter');
      expect(writes).toHaveLength(1);
    });
  }
}

test('definitive validation rejection preserves input and allows a corrected explicit submission', async ({ page }) => {
  const { writes } = await setup(page, { save: 'validation' });
  await page.getByLabel('Project title').fill('Manual title');
  await page.getByLabel('Project description').fill('Manual description');
  await page.getByRole('button', { name: 'Save as draft', exact: true }).click();
  await expect(page.getByText('Title is not valid')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Save as draft', exact: true })).toBeEnabled();
  await expect(page.getByRole('link', { name: 'Inspect projects' })).toHaveCount(0);
  expect(writes).toHaveLength(1);
});
