import { expect, test } from '@playwright/test';

const coordinator = {
  id: '00000000-0000-0000-0000-000000000001',
  email: 'coordinator@talentbridge.com',
  firstName: 'Demo',
  lastName: 'Coordinator',
  role: 'COORDINATOR',
  status: 'APPROVED',
  onboardingComplete: true,
};

test('demo card logs in without exposing a password', async ({ page }) => {
  await page.route('**/api/auth/demo-login', (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        accessToken: 'demo-access-token',
        refreshToken: 'demo-refresh-token',
        tokenType: 'Bearer',
        user: coordinator,
      }),
    }),
  );
  await page.route('**/api/users/me', (route) =>
    route.fulfill({ contentType: 'application/json', body: JSON.stringify(coordinator) }),
  );
  const demoRequest = page.waitForRequest(
    (request) =>
      request.url().endsWith('/api/auth/demo-login') && request.method() === 'POST',
  );

  await page.goto('/login');
  await page.getByRole('button', { name: 'Open coordinator demo' }).click();

  expect((await demoRequest).postData()).toBeNull();
  await expect(page).toHaveURL(/\/coordinator\/dashboard$/);
});

test('shows loading feedback while demo login is pending', async ({ page }) => {
  await page.route('**/api/auth/demo-login', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 400));
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        accessToken: 'demo-access-token',
        refreshToken: 'demo-refresh-token',
        tokenType: 'Bearer',
        user: coordinator,
      }),
    });
  });
  await page.route('**/api/users/me', (route) =>
    route.fulfill({ contentType: 'application/json', body: JSON.stringify(coordinator) }),
  );

  await page.goto('/login');
  await page.getByRole('button', { name: 'Open coordinator demo' }).click();
  await expect(page.getByRole('button', { name: 'Opening demo...' })).toBeVisible();
  await expect(page).toHaveURL(/\/coordinator\/dashboard$/);
});
