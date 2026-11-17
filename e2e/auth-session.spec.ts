import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.route('**/api/auth/config', route => route.fulfill({ json: { demoMode: false } }));
});

test('concurrent unauthorized requests share one refresh and retry with fresh credentials', async ({ page }) => {
  let refreshes = 0;
  await page.route('**/api/auth/refresh', async route => {
    refreshes += 1;
    await new Promise(resolve => setTimeout(resolve, 150));
    await route.fulfill({ json: { accessToken: 'fresh-access', refreshToken: 'fresh-refresh' } });
  });
  await page.route('**/api/protected/*', route => route.fulfill(
    route.request().headers().authorization === 'Bearer fresh-access'
      ? { json: { ok: true } }
      : { status: 401, json: { message: 'Token expired' } },
  ));
  await page.goto('/login');
  const values = await page.evaluate(async () => {
    localStorage.setItem('accessToken', 'old-access');
    localStorage.setItem('refreshToken', 'old-refresh');
    const path = '/src/api/client.ts';
    const { default: api } = await import(path);
    return Promise.all([api.get('/api/protected/one'), api.get('/api/protected/two')])
      .then(responses => responses.map(response => response.data.ok));
  });
  expect(values).toEqual([true, true]);
  expect(refreshes).toBe(1);
  expect(await page.evaluate(() => localStorage.getItem('accessToken'))).toBe('fresh-access');
});

test('a failed credential endpoint is not treated as an expired protected request', async ({ page }) => {
  let refreshes = 0;
  await page.route('**/api/auth/refresh', route => {
    refreshes += 1;
    return route.fulfill({ status: 400, json: { message: 'Invalid refresh token' } });
  });
  await page.route('**/api/auth/login', route => route.fulfill({ status: 401, json: { message: 'Invalid credentials' } }));
  await page.goto('/login');
  const status = await page.evaluate(async () => {
    localStorage.setItem('refreshToken', 'old-refresh');
    const path = '/src/api/client.ts';
    const { default: api } = await import(path);
    return api.post('/api/auth/login', { email: 'synthetic@example.test', password: 'SyntheticOnly!' })
      .catch(error => error.response.status);
  });
  expect(status).toBe(401);
  expect(refreshes).toBe(0);
});

test('logging out in one tab invalidates the other authenticated tab', async ({ page, context }) => {
  await context.route(url => url.pathname.startsWith('/api/'), route => route.fulfill({ status: 503, json: { message: 'Isolated test endpoint' } }));
  await context.route('**/api/users/me', route => route.fulfill({ json: {
    id: 'synthetic-user', email: 'synthetic@example.test', firstName: 'Synthetic', lastName: 'User',
    role: 'COORDINATOR', status: 'APPROVED', onboardingComplete: true,
  } }));
  await page.goto('/login');
  await page.evaluate(() => {
    localStorage.setItem('accessToken', 'synthetic-access');
    localStorage.setItem('refreshToken', 'synthetic-refresh');
  });
  await page.goto('/coordinator/dashboard');
  const other = await context.newPage();
  await other.goto('/coordinator/dashboard');
  await expect(other.getByRole('heading', { name: 'Overview', exact: true })).toBeVisible();
  await page.evaluate(async () => {
    const path = '/src/utils/authTokens.ts';
    const { clearAuthTokens } = await import(path);
    clearAuthTokens();
  });
  await expect(page).toHaveURL(/\/login$/);
  await expect(other).toHaveURL(/\/login$/);
  await other.close();
});

test('an old write is never replayed under a different signed-in account', async ({ page }) => {
  let writes = 0;
  let refreshes = 0;
  await page.route('**/api/auth/refresh', route => {
    refreshes += 1;
    return route.fulfill({ json: { accessToken: 'replacement-access', refreshToken: 'replacement-refresh' } });
  });
  await page.route('**/api/protected/save', async route => {
    writes += 1;
    if (writes > 1) return route.fulfill({ json: { saved: true } });
    await page.evaluate(() => {
      const payload = btoa(JSON.stringify({ sub: 'account-b', ver: 0, exp: 2000000000 }));
      localStorage.setItem('accessToken', `e30.${payload}.synthetic`);
      localStorage.setItem('refreshToken', 'account-b-refresh');
    });
    return route.fulfill({ status: 401, json: { message: 'Old session expired' } });
  });
  await page.goto('/login');
  const status = await page.evaluate(async () => {
    const payload = btoa(JSON.stringify({ sub: 'account-a', ver: 0, exp: 2000000000 }));
    localStorage.setItem('accessToken', `e30.${payload}.synthetic`);
    localStorage.setItem('refreshToken', 'account-a-refresh');
    const path = '/src/api/client.ts';
    const { default: api } = await import(path);
    return api.post('/api/protected/save', { title: 'Account A draft' })
      .then(() => 200).catch(error => error.response.status);
  });
  expect(status).toBe(401);
  expect(writes).toBe(1);
  expect(refreshes).toBe(0);
  expect(await page.evaluate(() => localStorage.getItem('refreshToken'))).toBe('account-b-refresh');
});

test('successful password changes clear the current local session', async ({ page }) => {
  await page.route('**/api/auth/password', route => route.fulfill({ status: 204 }));
  await page.goto('/login');
  const tokens = await page.evaluate(async () => {
    localStorage.setItem('accessToken', 'synthetic-access');
    localStorage.setItem('refreshToken', 'synthetic-refresh');
    const path = '/src/api/services.ts';
    const { authApi } = await import(path);
    await authApi.changePassword('InitialPassword!', 'ReplacementPassword!');
    return { access: localStorage.getItem('accessToken'), refresh: localStorage.getItem('refreshToken') };
  });
  expect(tokens).toEqual({ access: null, refresh: null });
});

test('a refresh finishing after logout cannot resurrect the session', async ({ page }) => {
  await page.route('**/api/protected/one', route => route.fulfill({ status: 401, json: { message: 'Token expired' } }));
  await page.route('**/api/auth/refresh', async route => {
    await page.evaluate(async () => {
      const path = '/src/utils/authTokens.ts';
      const { clearAuthTokens } = await import(path);
      clearAuthTokens();
    });
    return route.fulfill({ json: { accessToken: 'late-access', refreshToken: 'late-refresh' } });
  });
  await page.goto('/login');
  const tokens = await page.evaluate(async () => {
    localStorage.setItem('accessToken', 'synthetic-access');
    localStorage.setItem('refreshToken', 'synthetic-refresh');
    const path = '/src/api/client.ts';
    const { default: api } = await import(path);
    await api.get('/api/protected/one').catch(() => undefined);
    return { access: localStorage.getItem('accessToken'), refresh: localStorage.getItem('refreshToken') };
  });
  expect(tokens).toEqual({ access: null, refresh: null });
});

test('manual session renewal shares the refresh used by unauthorized requests', async ({ page }) => {
  let refreshes = 0;
  await page.route('**/api/auth/refresh', async route => {
    refreshes += 1;
    await new Promise(resolve => setTimeout(resolve, 150));
    return route.fulfill({ json: { accessToken: 'fresh-access', refreshToken: 'fresh-refresh' } });
  });
  await page.route('**/api/protected/one', route => route.fulfill(
    route.request().headers().authorization === 'Bearer fresh-access'
      ? { json: { ok: true } } : { status: 401, json: { message: 'Expired' } },
  ));
  await page.goto('/login');
  await page.evaluate(async () => {
    localStorage.setItem('accessToken', 'old-access');
    localStorage.setItem('refreshToken', 'old-refresh');
    const servicesPath = '/src/api/services.ts';
    const clientPath = '/src/api/client.ts';
    const [{ authApi }, { default: api }] = await Promise.all([import(servicesPath), import(clientPath)]);
    await Promise.all([authApi.refresh('old-refresh'), api.get('/api/protected/one')]);
  });
  expect(refreshes).toBe(1);
});

test('same-session renewal in another tab preserves an unsaved project form', async ({ page, context }) => {
  await context.route(url => url.pathname.startsWith('/api/'), route => route.fulfill({ status: 503, json: { message: 'Isolated fixture endpoint' } }));
  await context.route('**/api/users/me', route => route.fulfill({ json: {
    id: 'company-account', email: 'company@example.test', firstName: 'Company', lastName: 'Fixture',
    role: 'COMPANY', status: 'APPROVED', onboardingComplete: true,
  } }));
  await page.addInitScript(() => {
    if (sessionStorage.getItem('session-fixture-ready')) return;
    sessionStorage.setItem('session-fixture-ready', 'yes');
    const payload = btoa(JSON.stringify({ sub: 'company-account', ver: 0, exp: Math.floor(Date.now() / 1000) + 3600 }));
    localStorage.setItem('accessToken', `e30.${payload}.old`);
    localStorage.setItem('refreshToken', 'old-refresh');
  });
  await page.goto('/company/projects/new');
  await page.getByLabel('Project title', { exact: true }).fill('Unsaved work must survive');
  const other = await context.newPage();
  await other.goto('/company/dashboard');
  await other.evaluate(() => {
    const payload = btoa(JSON.stringify({ sub: 'company-account', ver: 0, exp: Math.floor(Date.now() / 1000) + 7200 }));
    localStorage.setItem('accessToken', `e30.${payload}.renewed`);
    localStorage.setItem('refreshToken', 'renewed-refresh');
  });
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await expect(page.getByLabel('Project title', { exact: true })).toHaveValue('Unsaved work must survive');
  await other.close();
});

test('a stale stay-logged-in callback cannot sign out the replacement account', async ({ page, context }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.stack || error.message));
  const userA = { id: 'account-a', email: 'first@example.test', firstName: 'First', lastName: 'Fixture', role: 'COORDINATOR', status: 'APPROVED', onboardingComplete: true };
  const userB = { ...userA, id: 'account-b', email: 'second@example.test', firstName: 'Second' };
  let current = userA;
  let refreshes = 0;
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  await context.route(url => url.pathname.startsWith('/api/'), route => route.fulfill({ status: 503, json: { message: 'Isolated fixture endpoint' } }));
  await context.route('**/api/users/me', route => route.fulfill({ json: current }));
  await context.route('**/api/auth/refresh', async route => {
    refreshes += 1;
    await gate;
    return route.fulfill({ json: { accessToken: 'old-account-renewed', refreshToken: 'old-account-refresh', user: userA } });
  });
  await page.clock.install({ time: new Date() });
  await page.addInitScript(() => {
    if (sessionStorage.getItem('session-fixture-ready')) return;
    sessionStorage.setItem('session-fixture-ready', 'yes');
    const payload = btoa(JSON.stringify({ sub: 'account-a', ver: 0, exp: Math.floor(Date.now() / 1000) + 35 }));
    localStorage.setItem('accessToken', `e30.${payload}.initial`);
    localStorage.setItem('refreshToken', 'account-a-refresh');
  });
  await page.goto('/coordinator/dashboard');
  await expect(page.getByRole('heading', { name: 'Overview', exact: true })).toBeVisible();
  await page.clock.fastForward(6000);
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(resolve)));
  expect(errors).toEqual([]);
  await page.getByRole('button', { name: 'Stay logged in', exact: true }).click();
  await expect.poll(() => refreshes).toBe(1);
  try {
    const other = await context.newPage();
    await other.goto('/login');
    current = userB;
    await other.evaluate(() => {
      const payload = btoa(JSON.stringify({ sub: 'account-b', ver: 0, exp: Math.floor(Date.now() / 1000) + 3600 }));
      localStorage.setItem('accessToken', `e30.${payload}.replacement`);
      localStorage.setItem('refreshToken', 'account-b-refresh');
    });
    await expect(page.getByText('Second', { exact: true }).first()).toBeVisible();
    const settled = page.waitForResponse(response => new URL(response.url()).pathname === '/api/auth/refresh');
    release();
    await (await settled).finished();
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    await expect.poll(() => page.evaluate(() => localStorage.getItem('refreshToken'))).toBe('account-b-refresh');
    await expect(page).not.toHaveURL(/\/login$/);
    await other.close();
  } finally { release(); }
});

test('an already scheduled expiry cannot clear a replacement token before its storage event arrives', async ({ page, context }) => {
  await context.route(url => url.pathname.startsWith('/api/'), route => route.fulfill({ status: 503, json: {} }));
  await context.route('**/api/users/me', route => route.fulfill({ json: {
    id: 'account-a', email: 'first@example.test', firstName: 'First', lastName: 'Fixture',
    role: 'COORDINATOR', status: 'APPROVED', onboardingComplete: true,
  } }));
  await page.clock.install({ time: new Date() });
  await page.addInitScript(() => {
    if (sessionStorage.getItem('session-fixture-ready')) return;
    sessionStorage.setItem('session-fixture-ready', 'yes');
    const payload = btoa(JSON.stringify({ sub: 'account-a', ver: 0, exp: Math.floor(Date.now() / 1000) + 35 }));
    localStorage.setItem('accessToken', `e30.${payload}.initial`);
    localStorage.setItem('refreshToken', 'account-a-refresh');
  });
  await page.goto('/coordinator/dashboard');
  await expect(page.getByRole('heading', { name: 'Overview', exact: true })).toBeVisible();
  await page.evaluate(() => {
    const payload = btoa(JSON.stringify({ sub: 'account-b', ver: 0, exp: Math.floor(Date.now() / 1000) + 3600 }));
    localStorage.setItem('accessToken', `e30.${payload}.replacement`);
    localStorage.setItem('refreshToken', 'account-b-refresh');
  });
  await page.clock.fastForward(36000);
  await expect.poll(() => page.evaluate(() => localStorage.getItem('refreshToken'))).toBe('account-b-refresh');
});

test('an old identity request failure cannot clear a replacement token', async ({ page, context }) => {
  let release!: () => void;
  let requested = false;
  const gate = new Promise<void>(resolve => { release = resolve; });
  await context.route('**/api/users/me', async route => {
    requested = true;
    await gate;
    return route.fulfill({ status: 503, json: { message: 'Temporary error in the old request' } });
  });
  await page.addInitScript(() => {
    if (sessionStorage.getItem('session-fixture-ready')) return;
    sessionStorage.setItem('session-fixture-ready', 'yes');
    const payload = btoa(JSON.stringify({ sub: 'account-a', ver: 0, exp: Math.floor(Date.now() / 1000) + 3600 }));
    localStorage.setItem('accessToken', `e30.${payload}.initial`);
    localStorage.setItem('refreshToken', 'account-a-refresh');
  });
  await page.goto('/coordinator/dashboard');
  await expect.poll(() => requested).toBe(true);
  await page.evaluate(() => {
    const payload = btoa(JSON.stringify({ sub: 'account-b', ver: 0, exp: Math.floor(Date.now() / 1000) + 3600 }));
    localStorage.setItem('accessToken', `e30.${payload}.replacement`);
    localStorage.setItem('refreshToken', 'account-b-refresh');
  });
  const response = page.waitForResponse(result => new URL(result.url()).pathname === '/api/users/me');
  release();
  await (await response).finished();
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await expect.poll(() => page.evaluate(() => localStorage.getItem('refreshToken'))).toBe('account-b-refresh');
});
