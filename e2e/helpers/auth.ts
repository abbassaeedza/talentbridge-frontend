import { expect, type Page } from '@playwright/test';

// Synthetic credentials for intercepted requests only, never a seeded account password.
export const fixturePassword = 'FixtureOnlyPassword!';

export async function mockCredentialLogin(page: Page, user: { email: string }) {
  await page.route('**/api/auth/login', async route => {
    expect(route.request().method()).toBe('POST');
    expect(route.request().postDataJSON()).toEqual({ email: user.email, password: fixturePassword });
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        accessToken: 'fixture-access-token',
        refreshToken: 'fixture-refresh-token',
        tokenType: 'Bearer',
        user,
      }),
    });
  });
  await page.route('**/api/users/me', route => route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify(user),
  }));
}

export async function signIn(page: Page, email: string) {
  await page.goto('/login');
  await page.getByLabel('Email address').fill(email);
  await page.getByRole('textbox', { name: /^Password/ }).fill(fixturePassword);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
}
