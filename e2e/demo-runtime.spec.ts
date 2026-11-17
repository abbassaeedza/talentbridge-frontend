import { expect, test, type Page } from '@playwright/test';
import { fixturePassword, mockCredentialLogin, signIn } from './helpers/auth';

const demo = {
  id: 'dedicated-demo', email: 'rowan.demo@example.test', firstName: 'Rowan', lastName: 'Demo',
  role: 'COORDINATOR', status: 'APPROVED', onboardingComplete: true,
};
const personal = { ...demo, id: 'personal', email: 'personal@example.test', firstName: 'Personal' };
const jwt = (id: string) => `e30.${Buffer.from(JSON.stringify({ sub: id, ver: 0, exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url')}.fixture`;
const demoTokens = { accessToken: jwt(demo.id), refreshToken: 'dedicated-demo-refresh', user: demo };
const button = (page: Page) => page.getByRole('button', { name: 'Open coordinator demo', exact: true });

function deferred() {
  let release!: () => void;
  const promise = new Promise<void>(resolve => { release = resolve; });
  return { promise, release };
}

async function focus(page: Page) {
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
    window.dispatchEvent(new Event('visibilitychange'));
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
    window.dispatchEvent(new Event('visibilitychange'));
  });
}

async function runtime(page: Page, demoMode: boolean) {
  await page.route('**/api/auth/config', route => route.fulfill({ headers: { 'Cache-Control': 'no-store' }, json: { demoMode } }));
}

test.beforeEach(async ({ context }) => {
  await context.route(url => url.pathname.startsWith('/api/'), route => route.fulfill({ status: 503, json: {} }));
});

test('fresh runtime true restores the coordinator demo button', async ({ page }) => {
  let reads = 0;
  await page.route('**/api/auth/config', route => {
    reads += 1;
    expect(route.request().method()).toBe('GET');
    expect(route.request().postData()).toBeNull();
    return route.fulfill({ headers: { 'Cache-Control': 'no-store' }, json: { demoMode: true } });
  });
  await page.goto('/login');
  await expect(button(page)).toBeVisible();
  await expect(page.getByText(/dedicated coordinator demo account, not your personal account/)).toBeVisible();
  await expect(page.getByLabel('Email address', { exact: true })).toHaveValue('');
  await expect(page.getByLabel('Password', { exact: true })).toHaveValue('');
  expect(reads).toBe(1);
});

for (const [label, value] of [
  ['off', { demoMode: false }], ['missing', {}], ['array', []], ['null', null],
  ['bare boolean', true], ['string', 'true'], ['string field', { demoMode: 'true' }],
  ['number field', { demoMode: 1 }], ['null field', { demoMode: null }],
] as const) {
  test(`runtime ${label} fails closed without changing credential login`, async ({ page }) => {
    await page.route('**/api/auth/config', route => route.fulfill({ json: value }));
    await mockCredentialLogin(page, personal);
    const config = page.waitForResponse('**/api/auth/config');
    await page.goto('/login');
    await (await config).finished();
    await expect(button(page)).toHaveCount(0);
    await signIn(page, personal.email);
    await expect(page).toHaveURL(/\/coordinator\/dashboard$/);
  });
}

for (const failure of ['offline', '503'] as const) {
  test(`runtime ${failure} never retries itself and credentials still work`, async ({ page }) => {
    let reads = 0;
    await page.clock.install();
    await page.route('**/api/auth/config', route => {
      reads += 1;
      return failure === 'offline' ? route.abort('internetdisconnected') : route.fulfill({ status: 503, json: {} });
    });
    await mockCredentialLogin(page, personal);
    await page.goto('/login');
    await expect.poll(() => reads).toBe(1);
    await page.clock.fastForward(180_000);
    await expect(button(page)).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeEnabled();
    expect(reads).toBe(1);
    await page.getByLabel('Email address', { exact: true }).fill(personal.email);
    await page.getByLabel('Password', { exact: true }).fill(fixturePassword);
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await expect(page).toHaveURL(/\/coordinator\/dashboard$/);
  });
}

test('a cold config never blocks credentials or exposes a stale demo', async ({ page }) => {
  const gate = deferred();
  let reads = 0;
  await page.clock.install();
  await page.route('**/api/auth/config', async route => {
    reads += 1;
    await gate.promise;
    await route.fulfill({ json: { demoMode: true } });
  });
  await mockCredentialLogin(page, personal);
  try {
    await page.goto('/login');
    await expect.poll(() => reads).toBe(1);
    await page.clock.fastForward(89_000);
    await expect(button(page)).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeEnabled();
    expect(reads).toBe(1);
    await page.getByLabel('Email address', { exact: true }).fill(personal.email);
    await page.getByLabel('Password', { exact: true }).fill(fixturePassword);
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await expect(page).toHaveURL(/\/coordinator\/dashboard$/);
    const config = page.waitForResponse('**/api/auth/config');
    gate.release();
    await (await config).finished();
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL(/\/coordinator\/dashboard$/);
    await expect(page.getByText('Personal', { exact: true }).first()).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Sign in', exact: true })).toHaveCount(0);
    await expect(button(page)).toHaveCount(0);
    expect(await page.evaluate(() => [localStorage.getItem('accessToken'), localStorage.getItem('refreshToken')]))
      .toEqual(['fixture-access-token', 'fixture-refresh-token']);
  } finally { gate.release(); }
});

test('delayed config shows availability and cold-start status before the true reply', async ({ page }) => {
  await page.clock.install();
  const gate = deferred();
  let reads = 0;
  let posts = 0;
  page.on('request', request => { if (request.method() === 'POST') posts += 1; });
  await page.route('**/api/auth/config', async route => {
    reads += 1;
    await gate.promise;
    await route.fulfill({ json: { demoMode: true } });
  });
  try {
    await page.goto('/login');
    await expect.poll(() => reads).toBe(1);
    await page.clock.fastForward(5001);
    await expect(page.getByRole('status').filter({ hasText: /server may be starting/ })).toBeVisible();
    await expect(page.getByText('Checking demo availability...', { exact: true })).toBeVisible();
    await expect(button(page)).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeEnabled();
    gate.release();
    await expect(button(page)).toBeVisible();
    await expect(page.getByText('Checking demo availability...', { exact: true })).toHaveCount(0);
    await expect(page.getByRole('status').filter({ hasText: /server may be starting/ })).toHaveCount(0);
    expect(reads).toBe(1);
    expect(posts).toBe(0);
  } finally { gate.release(); }
});

test('config 503 offers an explicit GET-only retry that discovers the demo', async ({ page }) => {
  let reads = 0;
  let posts = 0;
  page.on('request', request => { if (request.method() === 'POST') posts += 1; });
  await page.route('**/api/auth/config', route => {
    reads += 1;
    expect(route.request().method()).toBe('GET');
    return route.fulfill(reads === 1 ? { status: 503, json: {} } : { json: { demoMode: true } });
  });
  await page.goto('/login');
  const retry = page.getByRole('button', { name: 'Retry demo availability', exact: true });
  await expect(retry).toBeVisible();
  await expect(page.getByText("Couldn't check demo availability. You can still sign in with your account.", { exact: true })).toBeVisible();
  await expect(page.getByRole('alert')).toHaveCount(0);
  await expect(button(page)).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeEnabled();
  expect((await retry.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  expect(reads).toBe(1);
  await retry.click();
  await expect(button(page)).toBeVisible();
  await expect(retry).toHaveCount(0);
  expect(reads).toBe(2);
  expect(posts).toBe(0);
});

test('focus requires a fresh successful true, with no polling or persisted config', async ({ page }) => {
  await page.clock.install();
  let reads = 0;
  let value: unknown = { demoMode: true };
  let status = 200;
  let gate = deferred();
  gate.release();
  await page.route('**/api/auth/config', async route => {
    reads += 1;
    await gate.promise;
    await route.fulfill({ status, json: value });
  });
  await page.goto('/login');
  await expect(button(page)).toBeVisible();
  await page.clock.fastForward(180_000);
  expect(reads).toBe(1);
  gate = deferred();
  await focus(page);
  await expect.poll(() => reads).toBe(2);
  await expect(button(page)).toHaveCount(0);
  status = 503;
  gate.release();
  await expect(button(page)).toHaveCount(0);
  await page.waitForLoadState('networkidle');
  status = 200;
  value = { demoMode: true };
  await focus(page);
  await expect(button(page)).toBeVisible();
  value = { demoMode: false };
  await focus(page);
  await expect.poll(() => reads).toBe(4);
  await expect(button(page)).toHaveCount(0);
  expect(await page.evaluate(() => ({ ...localStorage, ...sessionStorage }))).toEqual({});
});

test('demo sends exactly one empty POST, loads its identity, and routes to coordinator', async ({ page }) => {
  await runtime(page, true);
  let writes = 0;
  let identities = 0;
  await page.route('**/api/auth/demo-login', route => {
    writes += 1;
    expect(route.request().method()).toBe('POST');
    expect(route.request().postData()).toBeNull();
    return route.fulfill({ json: demoTokens });
  });
  await page.route('**/api/users/me', route => {
    identities += 1;
    expect(route.request().headers().authorization).toBe(`Bearer ${demoTokens.accessToken}`);
    return route.fulfill({ json: demo });
  });
  await page.goto('/login');
  await button(page).click();
  await expect(page).toHaveURL(/\/coordinator\/dashboard$/);
  await expect(page.getByText('Rowan', { exact: true }).first()).toBeVisible();
  expect(writes).toBe(1);
  expect(identities).toBe(1);
  expect(await page.evaluate(() => [localStorage.getItem('accessToken'), localStorage.getItem('refreshToken')]))
    .toEqual([demoTokens.accessToken, demoTokens.refreshToken]);
});

for (const action of ['demo', 'credentials'] as const) {
  test(`pending ${action} disables both actions and keeps cold-start feedback`, async ({ page }) => {
    await runtime(page, true);
    await page.clock.install();
    await mockCredentialLogin(page, personal);
    const gate = deferred();
    let writes = 0;
    await page.route(`**/api/auth/${action === 'demo' ? 'demo-login' : 'login'}`, async route => {
      writes += 1;
      await gate.promise;
      await route.fulfill({ json: demoTokens });
    });
    let otherWrites = 0;
    await page.route(`**/api/auth/${action === 'demo' ? 'login' : 'demo-login'}`, route => {
      otherWrites += 1;
      return route.fulfill({ status: 503, json: {} });
    });
    try {
      await page.goto('/login');
      await expect(button(page)).toBeVisible();
      await page.getByLabel('Email address', { exact: true }).fill(personal.email);
      await page.getByLabel('Password', { exact: true }).fill(fixturePassword);
      if (action === 'demo') await button(page).dblclick({ force: true });
      else await page.getByRole('button', { name: 'Sign in', exact: true }).click();
      await expect(page.getByRole('button', { name: action === 'demo' ? 'Opening demo...' : 'Signing in...' })).toBeDisabled();
      await expect(page.getByRole('button', { name: action === 'demo' ? 'Sign in' : 'Open coordinator demo', exact: true })).toBeDisabled();
      await page.locator('form').evaluate(form => { (form as HTMLFormElement).requestSubmit(); (form as HTMLFormElement).requestSubmit(); });
      await page.clock.fastForward(5001);
      await expect(page.getByRole('status').filter({ hasText: /server may be starting/ })).toBeVisible();
      await page.clock.fastForward(84_000);
      await expect(page.getByRole('button', { name: action === 'demo' ? 'Opening demo...' : 'Signing in...' })).toBeDisabled();
      expect(await page.evaluate(async () => {
        const path = '/src/api/client.ts';
        return (await import(path)).default.defaults.timeout;
      })).toBe(90_000);
      expect(writes).toBe(1);
      expect(otherWrites).toBe(0);
    } finally { gate.release(); }
  });
}

test('stale demo 404 hides the button and refetches only the safe GET', async ({ page }) => {
  let enabled = true;
  let reads = 0;
  let writes = 0;
  await page.route('**/api/auth/config', route => { reads += 1; return route.fulfill({ json: { demoMode: enabled } }); });
  await page.route('**/api/auth/demo-login', route => {
    writes += 1;
    enabled = false;
    return route.fulfill({ status: 404, json: {} });
  });
  await page.goto('/login');
  await button(page).click();
  await expect(page.getByRole('alert')).toContainText('no longer available');
  await expect.poll(() => reads).toBe(2);
  await expect(button(page)).toHaveCount(0);
  expect(writes).toBe(1);
  expect(await page.evaluate(() => localStorage.getItem('accessToken'))).toBeNull();
});

for (const failure of ['503', 'offline'] as const) {
  test(`demo ${failure} allows manual retry but never retries the POST itself`, async ({ page }) => {
    await runtime(page, true);
    await page.clock.install();
    let writes = 0;
    await page.route('**/api/users/me', route => route.fulfill({ json: demo }));
    await page.route('**/api/auth/demo-login', route => {
      writes += 1;
      if (writes > 1) return route.fulfill({ json: demoTokens });
      return failure === 'offline' ? route.abort('internetdisconnected') : route.fulfill({ status: 503, json: {} });
    });
    await page.goto('/login');
    await button(page).click();
    await expect(page.getByRole('alert')).toContainText(/server.*retry/i);
    await page.clock.fastForward(180_000);
    expect(writes).toBe(1);
    await expect(button(page)).toBeEnabled();
    await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeEnabled();
    await button(page).click();
    await expect(page).toHaveURL(/\/coordinator\/dashboard$/);
    expect(writes).toBe(2);
  });
}

for (const endpoint of ['config', 'demo-login'] as const) {
  test(`public ${endpoint} 401 cannot refresh or clear a replacement session`, async ({ page }) => {
    await runtime(page, false);
    const initialConfig = page.waitForResponse('**/api/auth/config');
    await page.goto('/login');
    await (await initialConfig).finished();
    let calls = 0;
    let refreshes = 0;
    await page.route(`**/api/auth/${endpoint}`, route => { calls += 1; return route.fulfill({ status: 401, json: {} }); });
    await page.route('**/api/auth/refresh', route => { refreshes += 1; return route.fulfill({ status: 401, json: {} }); });
    const result = await page.evaluate(async endpoint => {
      localStorage.setItem('accessToken', 'replacement-access');
      localStorage.setItem('refreshToken', 'replacement-refresh');
      const path = '/src/api/services.ts';
      const { authApi } = await import(path);
      const status = await (endpoint === 'config' ? authApi.getConfig() : authApi.demoLogin()).catch((error: any) => error.response.status);
      return { status, access: localStorage.getItem('accessToken'), refresh: localStorage.getItem('refreshToken') };
    }, endpoint);
    expect(result).toEqual({ status: 401, access: 'replacement-access', refresh: 'replacement-refresh' });
    expect(calls).toBe(1);
    expect(refreshes).toBe(0);
  });
}

for (const status of [200, 401, 503]) {
  for (const action of ['replacement', 'logout'] as const) {
    test(`late demo ${status} cannot overwrite cross-tab ${action}`, async ({ page, context }) => {
      await context.route('**/api/auth/config', route => route.fulfill({ json: { demoMode: true } }));
      const replacement = jwt(personal.id);
      await context.route('**/api/users/me', route => route.fulfill({ json: personal }));
      const gate = deferred();
      let writes = 0;
      let refreshes = 0;
      await page.route('**/api/auth/refresh', route => { refreshes += 1; return route.fulfill({ status: 401, json: {} }); });
      await page.route('**/api/auth/demo-login', async route => {
        writes += 1;
        await gate.promise;
        await route.fulfill({ status, json: status === 200 ? demoTokens : {} });
      });
      await page.goto('/login');
      await button(page).click();
      await expect.poll(() => writes).toBe(1);
      const other = await context.newPage();
      try {
        await other.goto('/login');
        await other.evaluate(token => {
          localStorage.setItem('accessToken', token);
          localStorage.setItem('refreshToken', 'replacement-refresh');
        }, replacement);
        await expect(page).toHaveURL(/\/coordinator\/dashboard$/);
        if (action === 'logout') {
          await other.evaluate(() => { localStorage.removeItem('accessToken'); localStorage.removeItem('refreshToken'); });
          await expect(page).toHaveURL(/\/login$/);
        }
        const response = page.waitForResponse('**/api/auth/demo-login');
        gate.release();
        await (await response).finished();
        await page.waitForLoadState('networkidle');
        expect(await page.evaluate(() => [localStorage.getItem('accessToken'), localStorage.getItem('refreshToken')]))
          .toEqual(action === 'logout' ? [null, null] : [replacement, 'replacement-refresh']);
        await expect(page).toHaveURL(action === 'logout' ? /\/login$/ : /\/coordinator\/dashboard$/);
        expect(writes).toBe(1);
        expect(refreshes).toBe(0);
      } finally { gate.release(); await other.close(); }
    });
  }
}

for (const enabled of [false, true]) {
  test(`credentials preserve invitation return navigation with runtime ${enabled}`, async ({ page }) => {
    await runtime(page, enabled);
    await mockCredentialLogin(page, personal);
    await page.goto('/login?returnTo=%2Fproject-supervisor-invitations%2Ffixture-return');
    await page.getByLabel('Email address', { exact: true }).fill(personal.email);
    await page.getByLabel('Password', { exact: true }).fill(fixturePassword);
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await expect(page).toHaveURL(/\/project-supervisor-invitations\/fixture-return$/);
  });
}

test('same-tab logout while a demo request is pending cannot revive the session', async ({ page }) => {
  await runtime(page, true);
  const gate = deferred();
  let writes = 0;
  let identities = 0;
  await page.route('**/api/users/me', route => { identities += 1; return route.fulfill({ json: demo }); });
  await page.route('**/api/auth/demo-login', async route => {
    writes += 1;
    await gate.promise;
    await route.fulfill({ json: demoTokens });
  });
  try {
    await page.goto('/login');
    await button(page).click();
    await expect.poll(() => writes).toBe(1);
    await page.evaluate(async () => {
      const path = '/src/utils/authTokens.ts';
      (await import(path)).clearAuthTokens();
    });
    const response = page.waitForResponse('**/api/auth/demo-login');
    gate.release();
    await (await response).finished();
    await page.waitForLoadState('networkidle');
    expect(await page.evaluate(() => [localStorage.getItem('accessToken'), localStorage.getItem('refreshToken')])).toEqual([null, null]);
    await expect(page).toHaveURL(/\/login$/);
    expect(identities).toBe(0);
  } finally { gate.release(); }
});

test('demo rejection is recoverable and does not fall back to credential login', async ({ page }) => {
  await runtime(page, true);
  let credentials = 0;
  let refreshes = 0;
  await page.route('**/api/auth/login', route => { credentials += 1; return route.fulfill({ status: 401, json: {} }); });
  await page.route('**/api/auth/refresh', route => { refreshes += 1; return route.fulfill({ status: 401, json: {} }); });
  await page.route('**/api/auth/demo-login', route => route.fulfill({ status: 403, json: {} }));
  await page.goto('/login');
  await button(page).click();
  await expect(page.getByRole('alert')).toContainText('coordinator demo is unavailable');
  await expect(button(page)).toBeEnabled();
  await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeEnabled();
  expect(credentials).toBe(0);
  expect(refreshes).toBe(0);
});

for (const width of [360, 390]) {
  for (const enabled of [false, true]) {
    test(`mobile ${width} runtime ${enabled} stays within the viewport and supports keyboard`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width, height: 844 });
      await runtime(page, enabled);
      await page.goto('/login');
      await expect(page.getByRole('heading', { name: 'Sign in', exact: true })).toBeVisible();
      expect((await page.getByRole('button', { name: 'Sign in', exact: true }).boundingBox())!.height).toBeGreaterThanOrEqual(44);
      if (enabled) {
        await expect(button(page)).toBeVisible();
        expect((await button(page).boundingBox())!.height).toBeGreaterThanOrEqual(44);
        await page.getByRole('link', { name: 'Register', exact: true }).focus();
        await page.keyboard.press('Tab');
        await expect(button(page)).toBeFocused();
      } else await expect(button(page)).toHaveCount(0);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      await page.screenshot({ path: testInfo.outputPath(`demo-mobile-${width}-${enabled}.png`), fullPage: true });
    });
  }
}
