import { expect, test } from '@playwright/test';
import { fixturePassword, mockCredentialLogin, signIn } from './helpers/auth';

const coordinator = {
  id: '00000000-0000-0000-0000-000000000001',
  email: 'coordinator@example.test',
  firstName: 'Test',
  lastName: 'Coordinator',
  role: 'COORDINATOR',
  status: 'APPROVED',
  onboardingComplete: true,
};

test.beforeEach(async ({ page }) => {
  // Keep the login tests isolated from every live API, including dashboard requests.
  await page.route(url => url.pathname.startsWith('/api/'), route => route.fulfill({
    status: 503,
    contentType: 'application/json',
    body: JSON.stringify({ message: 'Test service unavailable' }),
  }));
  await mockCredentialLogin(page, coordinator);
});

test('requires credentials and offers no password-free demo shortcut', async ({ page }) => {
  const authRequests: string[] = [];
  page.on('request', request => {
    if (request.url().includes('/api/auth/')) authRequests.push(request.url());
  });

  await page.goto('/login');
  await expect(page.getByRole('button', { name: /demo/i })).toHaveCount(0);
  await expect(page.getByText('Demo environment', { exact: true })).toHaveCount(0);
  await expect(page.getByLabel('Email address')).toHaveValue('');
  const password = page.getByRole('textbox', { name: /^Password/ });
  await expect(password).toHaveValue('');
  await expect(password).toHaveAttribute('type', 'password');

  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await page.getByLabel('Email address').fill(coordinator.email);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  expect(authRequests).toEqual([]);
  expect(await page.evaluate(() => localStorage.getItem('accessToken'))).toBeNull();
});

test('signs in with an email and password through the normal login endpoint', async ({ page }) => {
  const request = page.waitForRequest(request =>
    request.url().endsWith('/api/auth/login') && request.method() === 'POST',
  );
  await signIn(page, coordinator.email);

  expect((await request).postDataJSON()).toEqual({
    email: coordinator.email,
    password: fixturePassword,
  });
  await expect(page).toHaveURL(/\/coordinator\/dashboard$/);
  await expect(page.getByRole('heading', { name: 'Overview' })).toBeVisible();
  expect(await page.evaluate(() => ({
    accessToken: localStorage.getItem('accessToken'),
    refreshToken: localStorage.getItem('refreshToken'),
  }))).toEqual({ accessToken: 'fixture-access-token', refreshToken: 'fixture-refresh-token' });
});

test('shows loading feedback and prevents duplicate submissions while login is pending', async ({ page }) => {
  let releaseLogin!: () => void;
  const pending = new Promise<void>(resolve => { releaseLogin = resolve; });
  let loginRequests = 0;
  await page.route('**/api/auth/login', async route => {
    loginRequests += 1;
    await pending;
    await route.fallback();
  });

  try {
    await signIn(page, coordinator.email);
    const button = page.getByRole('button', { name: 'Signing in...' });
    await expect(button).toBeVisible();
    await expect(button).toBeDisabled();
    await expect(page).toHaveURL(/\/login$/);
    await expect.poll(() => loginRequests).toBe(1);
    await page.locator('form').evaluate(form => (form as HTMLFormElement).requestSubmit());
    expect(loginRequests).toBe(1);
  } finally {
    releaseLogin();
  }
  await expect(page).toHaveURL(/\/coordinator\/dashboard$/);
  expect(loginRequests).toBe(1);
});

test('shows a login error and allows a credential-based retry', async ({ page }) => {
  await page.route('**/api/auth/login', route => route.fulfill({
    status: 503,
    contentType: 'application/json',
    body: JSON.stringify({ message: 'Sign in is temporarily unavailable' }),
  }), { times: 1 });

  await signIn(page, coordinator.email);
  await expect(page.getByText('Sign in is temporarily unavailable', { exact: true })).toBeVisible();
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeEnabled();
  expect(await page.evaluate(() => localStorage.getItem('accessToken'))).toBeNull();

  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).toHaveURL(/\/coordinator\/dashboard$/);
});
