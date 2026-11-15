import { expect, test } from '@playwright/test';

test.setTimeout(30_000);

const jwt = (id: string) => `e30.${Buffer.from(JSON.stringify({ sub: id, ver: 0, exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url')}.fixture`;
const account = (id: string) => ({ id, email: `${id}@example.test`, firstName: id, lastName: 'Fixture', role: 'COORDINATOR', status: 'APPROVED' });

for (const action of ['replacement', 'logout'] as const) {
  test(`late credential response cannot overwrite ${action} in another tab`, async ({ page }) => {
    const a = account('old-login');
    const b = account('replacement');
    const oldToken = jwt(a.id);
    let writes = 0;
    let release!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    await page.route(url => url.pathname.startsWith('/api/'), route => route.fulfill({ status: 503, json: {} }));
    await page.route('**/api/users/me', route => route.fulfill({ json: route.request().headers().authorization === `Bearer ${oldToken}` ? a : b }));
    await page.route('**/api/auth/login', async route => {
      writes += 1;
      await gate;
      await route.fulfill({ json: { accessToken: oldToken, refreshToken: 'old-login-refresh', user: a } });
    });
    await page.goto('/login');
    await page.getByLabel('Email address', { exact: true }).fill(a.email);
    await page.getByLabel('Password', { exact: true }).fill('SyntheticOnly123!');
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await expect.poll(() => writes).toBe(1);
    await page.evaluate(token => {
      const previous = localStorage.getItem('accessToken');
      localStorage.setItem('accessToken', token);
      localStorage.setItem('refreshToken', 'replacement-refresh');
      window.dispatchEvent(new StorageEvent('storage', { key: 'accessToken', oldValue: previous, newValue: token, storageArea: localStorage }));
    }, jwt(b.id));
    await expect(page).toHaveURL(/\/coordinator\/dashboard$/);
    await expect(page.getByRole('heading', { name: 'Overview', exact: true })).toBeVisible();
    if (action === 'logout') {
      await page.evaluate(() => {
        const previous = localStorage.getItem('accessToken');
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        window.dispatchEvent(new StorageEvent('storage', { key: 'accessToken', oldValue: previous, newValue: null, storageArea: localStorage }));
      });
      await expect(page).toHaveURL(/\/login$/);
    }
    const response = page.waitForResponse('**/api/auth/login');
    release();
    await response;
    // A following read waits until the credential continuation and identity loading settle.
    await expect.poll(async () => page.evaluate(() => localStorage.getItem('refreshToken'))).toBe(action === 'logout' ? null : 'replacement-refresh');
    await page.waitForLoadState('networkidle');
    expect(await page.evaluate(() => localStorage.getItem('refreshToken'))).toBe(action === 'logout' ? null : 'replacement-refresh');
    await expect(page).toHaveURL(action === 'logout' ? /\/login$/ : /\/coordinator\/dashboard$/);
    expect(writes).toBe(1);
  });
}
