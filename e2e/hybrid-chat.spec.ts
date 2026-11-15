import { expect, test, type Page } from '@playwright/test';
import type { ChatContextSnapshot, SummarySet, UserRole } from '../src/types';

const summary = <T>(items: T[] = [], total = items.length): SummarySet<T> => ({ items, total, truncated: total > items.length });
const user = (role: UserRole = 'COMPANY', id = 'account-a') => ({ id, role, email: `${id}@example.test`, firstName: 'Synthetic', lastName: 'Viewer', status: 'APPROVED', studentProfile: { skills: [] }, supervisorProfile: { expertise: [] }, companyProfile: { companyName: 'Company' } });
function snapshot(viewer: ReturnType<typeof user>, now: number): ChatContextSnapshot {
  return {
    viewer: { id: viewer.id, role: viewer.role, name: 'Synthetic Viewer' }, snapshotTimeUTC: new Date(now).toISOString(),
    globalDeadline: { enabled: false, deadlineUTC: null },
    projects: summary([{ id: 'p1', title: 'Visible workspace project', status: 'DRAFT', companyName: 'Company', deadlineUTC: null, finished: false, partyApplicationCount: 0 }], 72),
    openProjects: summary([], 15), parties: summary([]), partyDirectory: viewer.role === 'PARTY_SUPERVISOR' ? summary([]) : null,
    applications: summary([]), submissions: summary([]), evaluations: summary([]),
    counts: { projectsByStatus: { DRAFT: 72 }, partiesByStatus: {}, applicationsByStatus: {}, submissionsByStatus: {}, finalizedEvaluations: 0, users: viewer.role === 'COORDINATOR' ? { total: 89, byRole: { STUDENT: 80 }, byStatus: { PENDING: 9 } } : null },
    myAssignedProject: null, myScorecard: null,
    upcomingDeadlines: summary([{ projectId: 'outside-first50', title: 'Independent upcoming project', deadlineUTC: '2031-01-01T23:30:00Z' }]),
  };
}
type Options = {
  role?: UserRole; contextStatus?: number; chatStatus?: number; reason?: string; retryHeaderOnly?: boolean;
  contextGate?: Promise<void>; chatGate?: Promise<void>; chatBody?: unknown; writeStatus?: number; writeGate?: Promise<void>;
  snapshot?: (data: ChatContextSnapshot) => ChatContextSnapshot;
};
async function setup(page: Page, options: Options = {}) {
  const appOrigin = new URL(test.info().project.use.baseURL!).origin;
  let viewer = user(options.role);
  const calls = { contexts: 0, chats: 0, writes: 0, refreshes: 0, bodies: [] as any[], errors: [] as string[] };
  page.on('pageerror', error => calls.errors.push(error.message));
  await page.addInitScript(viewer => {
    const payload = btoa(JSON.stringify({ sub: viewer.id, ver: 0, exp: Math.floor(Date.now() / 1000) + 3600 }));
    localStorage.setItem('accessToken', `header.${payload}.signature`);
    localStorage.setItem('refreshToken', 'synthetic-refresh');
  }, viewer);
  await page.context().route('**/*', async route => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    const json = (data: unknown, status = 200) => route.fulfill({ status, json: data });
    if (path.startsWith('/api/')) {
      if (path === '/api/users/me') return json(viewer);
      if (path === '/api/users/notifications') return json({ notifications: [], unreadCount: 0 });
      if (path === '/api/auth/refresh') {
        calls.refreshes++;
        const payload = Buffer.from(JSON.stringify({ sub: viewer.id, ver: 0, exp: Math.floor(Date.now() / 1000) + 7200 })).toString('base64');
        return json({ accessToken: `header.${payload}.renewed`, refreshToken: 'renewed-refresh' });
      }
      if (path === '/api/chat/context') {
        calls.contexts++;
        const data = snapshot(viewer, await page.evaluate(() => Date.now()));
        if (options.contextGate) await options.contextGate;
        return json(options.snapshot ? options.snapshot(data) : data, options.contextStatus ?? 200).catch(() => {});
      }
      if (path === '/api/chat') {
        calls.chats++;
        calls.bodies.push(request.postDataJSON());
        if (options.chatGate) await options.chatGate;
        return route.fulfill({ status: options.chatStatus ?? 200, headers: { 'content-type': 'application/json', 'retry-after': '17', 'access-control-expose-headers': 'Retry-After' }, body: JSON.stringify(options.chatBody ?? (options.chatStatus === 429
          ? { reason: options.reason, ...(options.retryHeaderOnly ? {} : { retryAfterSeconds: 12 }) }
          : { message: 'Synthetic model explanation', model: 'fixture', source: 'llm' })) }).catch(() => {});
      }
      if (request.method() !== 'GET') {
        calls.writes++;
        if (options.writeGate) await options.writeGate;
        return json({ id: 'written' }, options.writeStatus ?? 200);
      }
      if (path === '/api/parties/my') return json({}, 404);
      if (path === '/api/parties/rules') return json({ minSize: 2, maxSize: 4 });
      return json([]);
    }
    if (url.origin === appOrigin) return route.continue();
    return route.fulfill({ status: 200, body: '' });
  });
  await page.goto(`/${viewer.role.toLowerCase().replaceAll('_', '-')}/profile`);
  await page.getByRole('button', { name: 'Open AI assistant' }).click();
  await expect(page.getByRole('dialog', { name: 'TalentBridge assistant' })).toBeVisible();
  return { calls, setViewer: (next: ReturnType<typeof user>) => { viewer = next; } };
}
async function send(page: Page, message: string) {
  await page.getByRole('textbox', { name: 'Message', exact: true }).fill(message);
  await page.getByRole('button', { name: 'Send message' }).click();
}
function gate() { let release!: () => void; const promise = new Promise<void>(resolve => { release = resolve; }); return { promise, release }; }

for (const role of ['STUDENT', 'COMPANY', 'COORDINATOR', 'PARTY_SUPERVISOR', 'PROJECT_SUPERVISOR'] as const) {
  test(`${role} static rules use zero context/model requests and zero writes`, async ({ page }) => {
    const { calls } = await setup(page, { role });
    await send(page, 'Hello!');
    await send(page, 'How do I apply to a project?');
    await expect(page.getByRole('log')).toContainText('OPEN visibility is not application eligibility');
    expect(calls).toMatchObject({ contexts: 0, chats: 0, writes: 0, errors: [] });
  });
}

test('facts use exact totals, not list lengths or overlapping open projects, and cache for less than 30s', async ({ page }) => {
  await page.clock.install();
  const { calls } = await setup(page);
  await send(page, 'How many projects?');
  await expect(page.getByRole('log')).toContainText('72 workspace projects. Showing 1; this list is incomplete.');
  await send(page, 'How many open projects?');
  await expect(page.getByRole('log')).toContainText('15 open projects. Showing 0; this list is incomplete.');
  expect(calls.contexts).toBe(1);
  await page.clock.fastForward(30_000);
  await send(page, 'How many draft projects?');
  await expect(page.getByRole('log')).toContainText('72 draft workspace projects.');
  expect(calls).toMatchObject({ contexts: 2, chats: 0, writes: 0 });
});

test('upcoming deadlines are independent of truncated projects and display Karachi', async ({ page }) => {
  const { calls } = await setup(page);
  await send(page, 'What are my upcoming deadlines?');
  await expect(page.getByRole('log')).toContainText('Independent upcoming project: 02 Jan 2031, 04:30 (Asia/Karachi)');
  expect(calls).toMatchObject({ contexts: 1, chats: 0, writes: 0 });
});

for (const status of [403, 503]) {
  test(`context ${status} invents no facts and leaves static help usable`, async ({ page }) => {
    const { calls } = await setup(page, { contextStatus: status });
    await send(page, 'How many projects?');
    await expect(page.getByRole('log')).toContainText('Live facts are unavailable.');
    await expect(page.getByRole('log')).not.toContainText('72 workspace projects');
    await send(page, 'How do I create a project?');
    await expect(page.getByRole('log')).toContainText('chat never saves a project');
    expect(calls.chats).toBe(0);
  });
}

for (const reason of ['GLOBAL_DAILY_LIMIT', 'ACCOUNT_RATE_LIMIT', 'ACCOUNT_IN_FLIGHT']) {
  test(`AI ${reason} shows retry timing without automatic retry; static help still works`, async ({ page }) => {
    const { calls } = await setup(page, { chatStatus: 429, reason });
    await send(page, 'Explain the tradeoffs of my design');
    await expect(page.getByRole('log')).toContainText('Try again after 12 seconds.');
    await send(page, 'How do I create a project?');
    await expect(page.getByRole('log')).toContainText('chat never saves a project');
    expect(calls).toMatchObject({ contexts: 0, chats: 1, writes: 0 });
  });
}

test('429 can use Retry-After header; provider failure retains help', async ({ page }) => {
  const { calls } = await setup(page, { chatStatus: 429, reason: 'ACCOUNT_RATE_LIMIT', retryHeaderOnly: true });
  await send(page, 'Explain my choices');
  await expect(page.getByRole('log')).toContainText('Try again after 17 seconds.');
  expect(calls.chats).toBe(1);
});

test('provider failure does not execute injected HTML and leaves quick help', async ({ page }) => {
  const { calls } = await setup(page, { chatStatus: 503 });
  await send(page, 'Explain my choices');
  await expect(page.getByRole('log')).toContainText('AI is temporarily unavailable.');
  await expect(page.getByRole('link', { name: 'Open projects', exact: true })).toBeVisible();
  expect(calls.chats).toBe(1);
});

for (const kind of ['model', 'context'] as const) {
  test(`clear conversation discards late ${kind} response and cannot disturb a newer request`, async ({ page }) => {
    const held = gate();
    const { calls } = await setup(page, kind === 'model' ? { chatGate: held.promise } : { contextGate: held.promise });
    await send(page, kind === 'model' ? 'Explain my design' : 'How many projects?');
    await expect.poll(() => kind === 'model' ? calls.chats : calls.contexts).toBe(1);
    await page.getByRole('button', { name: 'Clear conversation' }).click();
    await send(page, 'How do I create a project?');
    await expect(page.getByRole('log')).toContainText('chat never saves a project');
    held.release();
    await send(page, 'Hello');
    await expect(page.getByRole('button', { name: 'Send message' })).toBeDisabled();
    await expect(page.getByRole('log')).not.toContainText('Synthetic model explanation');
    await expect(page.getByRole('log')).not.toContainText('72 workspace projects');
    expect(calls.writes).toBe(0);
  });
}

test('relevant writes invalidate cached facts, while chat and deadline preview do not', async ({ page }) => {
  const { calls } = await setup(page);
  await send(page, 'How many projects?');
  await expect(page.getByRole('log')).toContainText('72 workspace projects');
  await page.evaluate(async () => {
    const { default: api } = await import('/src/api/client.ts');
    await api.post('/api/projects/global-deadline/preview', {});
  });
  await send(page, 'How many draft projects?');
  await expect(page.getByRole('log')).toContainText('72 draft workspace projects');
  expect(calls.contexts).toBe(1);
  await page.evaluate(async () => {
    const { default: api } = await import('/src/api/client.ts');
    await api.put('/api/projects/p1/deadline', null);
  });
  await send(page, 'How many projects?');
  await expect.poll(() => calls.contexts).toBe(2);
  expect(calls.chats).toBe(0);
});

test('same-session token renewal preserves conversation and its fresh facts', async ({ page }) => {
  const { calls } = await setup(page);
  await send(page, 'How many projects?');
  await expect(page.getByRole('log')).toContainText('72 workspace projects');
  await page.evaluate(async () => {
    const { setAuthTokens } = await import('/src/utils/authTokens.ts');
    const payload = btoa(JSON.stringify({ sub: 'account-a', ver: 0, exp: Math.floor(Date.now() / 1000) + 7200 }));
    setAuthTokens(`header.${payload}.renewed`, 'synthetic-refresh');
  });
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByRole('log')).toContainText('72 workspace projects');
  await send(page, 'How many draft projects?');
  await expect(page.getByRole('log')).toContainText('72 draft workspace projects');
  expect(calls.contexts).toBe(1);
});

test('unauthorized chat renews the session but never automatically replays the POST', async ({ page }) => {
  const { calls } = await setup(page, { chatStatus: 401 });
  await send(page, 'Explain my design');
  await expect(page.getByRole('log')).toContainText('Navigation and workflow help are still available.');
  expect(calls).toMatchObject({ chats: 1, refreshes: 1, writes: 0 });
  await send(page, 'How do I create a project?');
  await expect(page.getByRole('log')).toContainText('chat never saves a project');
  expect(calls.chats).toBe(1);
});

test('unknown write outcomes invalidate cached snapshots rather than presenting stale facts', async ({ page }) => {
  const { calls } = await setup(page, { writeStatus: 503 });
  await send(page, 'How many projects?');
  await expect(page.getByRole('log')).toContainText('72 workspace projects');
  await page.evaluate(async () => {
    const { default: api } = await import('/src/api/client.ts');
    await api.post('/api/projects', {}).catch(() => {});
  });
  await send(page, 'How many draft projects?');
  await expect(page.getByRole('log')).toContainText('72 draft workspace projects');
  expect(calls.contexts).toBe(2);
});

test('a write invalidates an already in-flight snapshot, not only cached data', async ({ page }) => {
  const held = gate();
  const { calls } = await setup(page, { contextGate: held.promise });
  await send(page, 'How many projects?');
  await expect.poll(() => calls.contexts).toBe(1);
  await page.evaluate(async () => {
    const { default: api } = await import('/src/api/client.ts');
    await api.put('/api/projects/p1/deadline', null);
  });
  held.release();
  await expect(page.getByRole('log')).toContainText('Live facts are unavailable.');
  await expect(page.getByRole('log')).not.toContainText('72 workspace projects');
  await send(page, 'How many projects?');
  await expect(page.getByRole('log')).toContainText('72 workspace projects');
  expect(calls.contexts).toBe(2);
});

test('mismatched snapshot identity and malformed metadata cannot become facts or LLM fallback', async ({ page }) => {
  const { calls } = await setup(page, { snapshot: data => ({ ...data, viewer: { ...data.viewer, id: 'foreign-account' } }) });
  await send(page, 'How many projects?');
  await expect(page.getByRole('log')).toContainText('Live facts are unavailable.');
  await expect(page.getByRole('log')).not.toContainText('72 workspace projects');
  expect(calls.chats).toBe(0);
});

test('an old account write response cannot invalidate the replacement account snapshot', async ({ page, context }) => {
  const held = gate();
  const { calls, setViewer } = await setup(page, { writeGate: held.promise, writeStatus: 503 });
  const other = await context.newPage();
  await other.goto('/company/profile');
  const oldWrite = page.evaluate(async () => {
    const { default: api } = await import('/src/api/client.ts');
    await api.post('/api/projects', {}).catch(() => {});
  });
  await expect.poll(() => calls.writes).toBe(1);
  setViewer(user('COMPANY', 'account-b'));
  await other.evaluate(() => {
    const payload = btoa(JSON.stringify({ sub: 'account-b', ver: 0, exp: Math.floor(Date.now() / 1000) + 3600 }));
    localStorage.setItem('accessToken', `header.${payload}.signature`);
  });
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('button', { name: 'Open AI assistant' }).click();
  await send(page, 'How many projects?');
  await expect(page.getByRole('log')).toContainText('72 workspace projects');
  expect(calls.contexts).toBe(1);
  held.release();
  await oldWrite;
  await send(page, 'How many draft projects?');
  await expect(page.getByRole('log')).toContainText('72 draft workspace projects');
  expect(calls.contexts).toBe(1);
  await other.close();
});

for (const kind of ['model', 'context'] as const) {
  test(`account switch discards late ${kind} data and clears old conversation`, async ({ page, context }) => {
    const held = gate();
    const { calls, setViewer } = await setup(page, kind === 'model' ? { chatGate: held.promise } : { contextGate: held.promise });
    const other = await context.newPage();
    await other.goto('/company/profile');
    await send(page, kind === 'model' ? 'Explain old account project' : 'How many projects?');
    await expect.poll(() => kind === 'model' ? calls.chats : calls.contexts).toBe(1);
    setViewer(user('COMPANY', 'account-b'));
    await other.evaluate(() => {
      const payload = btoa(JSON.stringify({ sub: 'account-b', ver: 0, exp: Math.floor(Date.now() / 1000) + 3600 }));
      localStorage.setItem('accessToken', `header.${payload}.signature`);
    });
    await expect(page.getByRole('dialog')).toHaveCount(0);
    held.release();
    await page.getByRole('button', { name: 'Open AI assistant' }).click();
    await send(page, 'How do I create a project?');
    await expect(page.getByRole('log')).toContainText('chat never saves a project');
    await expect(page.getByRole('log')).not.toContainText('Explain old account project');
    await expect(page.getByRole('log')).not.toContainText('Synthetic model explanation');
    await expect(page.getByRole('log')).not.toContainText('72 workspace projects');
    expect(calls.writes).toBe(0);
    await other.close();
  });
}

test('logout drops an in-flight model response and cannot revive the conversation', async ({ page }) => {
  const held = gate();
  const { calls } = await setup(page, { chatGate: held.promise });
  await send(page, 'Explain old account project');
  await expect.poll(() => calls.chats).toBe(1);
  await page.evaluate(async () => { const { clearAuthTokens } = await import('/src/utils/authTokens.ts'); clearAuthTokens(); });
  held.release();
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByText('Synthetic model explanation')).toHaveCount(0);
  expect(calls.writes).toBe(0);
});

test('history is capped at ten turns of 2000 characters and rendered model text is never HTML', async ({ page }) => {
  const { calls } = await setup(page, { chatBody: { message: '<img src=x onerror=alert(1)>' + 'a'.repeat(2400), model: 'fixture' } });
  for (let i = 0; i < 6; i++) {
    await send(page, `Explain design ${i}`);
    await expect(page.getByRole('log').getByText(/^<img src=x/)).toHaveCount(i + 1);
  }
  expect(calls.bodies.at(-1).history).toHaveLength(10);
  expect(calls.bodies.every(body => body.message.length <= 2000 && body.history.every((turn: any) => turn.content.length <= 2000))).toBe(true);
  await expect(page.getByRole('dialog').locator('img')).toHaveCount(0);
  expect(calls.writes).toBe(0);
});

for (const width of [360, 390, 1280]) {
  for (const theme of ['light', 'dark']) {
    test(`${width}px ${theme} chat keeps keyboard focus, 44px actions, and no overflow`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width, height: 844 });
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.addInitScript(theme => localStorage.setItem('talentbridge-theme', theme), theme);
      const { calls } = await setup(page);
      const panel = page.getByRole('dialog');
      const layers = await panel.evaluate(element => ({
        chat: Number(getComputedStyle(element.closest('[data-slot="modal-backdrop"]')!).zIndex),
        appHeader: Number(getComputedStyle(document.querySelector('header')!).zIndex),
      }));
      expect(layers.chat).toBeGreaterThan(layers.appHeader);
      await expect(page.getByRole('textbox', { name: 'Message', exact: true })).toBeFocused();
      for (let i = 0; i < 12; i++) { await page.keyboard.press('Tab'); expect(await panel.evaluate(element => element.contains(document.activeElement))).toBe(true); }
      const bounds = await panel.boundingBox();
      expect(bounds!.x).toBeGreaterThanOrEqual(0);
      expect(bounds!.y).toBeGreaterThanOrEqual(0);
      expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(844);
      expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width);
      const close = page.getByRole('button', { name: 'Close AI assistant' });
      const closeBox = await close.boundingBox();
      expect(closeBox!.y).toBeGreaterThanOrEqual(0);
      expect(await close.evaluate(element => {
        const bounds = element.getBoundingClientRect();
        return element.contains(document.elementFromPoint(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2));
      })).toBe(true);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
      for (const button of await panel.getByRole('button').all()) {
        const box = await button.boundingBox();
        if (box) { expect(box.height).toBeGreaterThanOrEqual(44); expect(box.width).toBeGreaterThanOrEqual(44); }
      }
      await page.screenshot({ path: testInfo.outputPath('chat-panel.png') });
      await page.keyboard.press('Escape');
      await expect(panel).toHaveCount(0);
      await expect(page.getByRole('button', { name: 'Open AI assistant' })).toBeFocused();
      expect(calls.errors).toEqual([]);
    });
  }
}

for (const width of [320, 360, 390, 1280]) {
  test(`${width}px normal-motion chat stays inside the viewport throughout opening`, async ({ page }) => {
    await page.setViewportSize({ width, height: 568 });
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    const { calls } = await setup(page);
    const samples = await page.getByRole('dialog').evaluate(async panel => {
      const samples = [];
      const start = performance.now();
      do {
        const bounds = panel.getBoundingClientRect();
        const style = getComputedStyle(panel.closest('[data-slot="modal-container"]')!);
        samples.push({ x: bounds.x, y: bounds.y, right: bounds.right, bottom: bounds.bottom, transform: style.transform, willChange: style.willChange });
        await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
      } while (performance.now() - start < 300);
      return samples;
    });
    for (const sample of samples) {
      expect(sample.x).toBeGreaterThanOrEqual(0);
      expect(sample.y).toBeGreaterThanOrEqual(0);
      expect(sample.right).toBeLessThanOrEqual(width);
      expect(sample.bottom).toBeLessThanOrEqual(568);
      expect(sample.transform).toBe('none');
      expect(sample.willChange).not.toContain('transform');
    }
    expect(calls.errors).toEqual([]);
  });
}
