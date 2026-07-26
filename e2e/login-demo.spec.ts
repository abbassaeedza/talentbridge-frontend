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
  await page.getByRole('button', { name: /Coordinator/ }).click();

  expect((await demoRequest).postData()).toBeNull();
  await expect(page).toHaveURL(/\/coordinator\/dashboard$/);
});
