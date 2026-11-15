import { expect, test, type Page } from '@playwright/test';
import { signIn } from './helpers/auth';

const user = {
  id: 'cold-start-user', email: 'cold@example.test', firstName: 'Cold', lastName: 'Fixture',
  role: 'COORDINATOR', status: 'APPROVED', onboardingComplete: true,
};
const warming = 'The server may be starting. Keep this page open; each request can wait up to 90 seconds.';

function jwt(seconds = 3600, suffix = 'initial') {
  return `e30.${Buffer.from(JSON.stringify({ sub: user.id, ver: 0, exp: Math.floor(Date.now() / 1000) + seconds })).toString('base64url')}.${suffix}`;
}

async function seed(page: Page, seconds = 3600) {
  await page.addInitScript(({ accessToken }) => {
    if (sessionStorage.getItem('cold-fixture')) return;
    sessionStorage.setItem('cold-fixture', 'yes');
    localStorage.setItem('accessToken', accessToken);
    localStorage.setItem('refreshToken', 'cold-refresh');
  }, { accessToken: jwt(seconds) });
}

test.beforeEach(async ({ page }) => {
  await page.route(url => url.pathname.startsWith('/api/'), route => route.fulfill({ status: 503, json: {} }));
  await page.route('**/api/users/me', route => route.fulfill({ json: user }));
  await page.route('**/api/auth/login', route => route.fulfill({ json: { accessToken: jwt(), refreshToken: 'cold-refresh', user } }));
});

for (const failure of [500, 503, 'offline', 'timeout'] as const) {
  test(`bootstrap ${failure} keeps credentials and offers explicit identity retry before redirect`, async ({ page }) => {
    await seed(page);
    let failing = true;
    await page.route('**/api/users/me', route => failing
      ? typeof failure === 'string' ? route.abort(failure === 'offline' ? 'internetdisconnected' : 'timedout') : route.fulfill({ status: failure, json: {} })
      : route.fulfill({ json: user }));
    await page.goto('/coordinator/dashboard');
    const retry = page.getByRole('button', { name: 'Retry', exact: true });
    await expect(retry).toBeVisible();
    await expect(page).toHaveURL(/\/coordinator\/dashboard$/);
    expect(await page.evaluate(() => localStorage.getItem('refreshToken'))).toBe('cold-refresh');
    await page.screenshot({ path: test.info().outputPath(`bootstrap-${failure}.png`) });
    failing = false;
    await retry.focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('heading', { name: 'Overview', exact: true })).toBeVisible();
  });
}

test('slow bootstrap announces warming only after five seconds', async ({ page }) => {
  await seed(page);
  const start = new Date();
  await page.clock.install({ time: new Date(start.getTime() - 1000) });
  await page.clock.pauseAt(start);
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/api/users/me', async route => { await gate; await route.fulfill({ json: user }); });
  await page.goto('/coordinator/dashboard');
  try {
    await expect(page.getByText('Loading TalentBridge', { exact: true })).toBeVisible();
    await page.clock.runFor(4900);
    await expect(page.getByText(warming, { exact: true })).toHaveCount(0);
    await page.clock.runFor(100);
    await expect(page.getByRole('status').filter({ hasText: warming })).toBeVisible();
    await page.screenshot({ path: test.info().outputPath('bootstrap-warming.png') });
  } finally { release(); }
  await expect(page.getByRole('heading', { name: 'Overview', exact: true })).toBeVisible();
});

for (const role of ['STUDENT', 'PARTY_SUPERVISOR'] as const) {
  test(`${role} onboarding identity 503 retains submitted fields and retries only identity`, async ({ page }) => {
    await seed(page);
    const account = { ...user, role };
    const student = role === 'STUDENT';
    const profile = student
      ? { studentProfile: { id: 'profile', university: 'Saved University', skills: ['React'] } }
      : { supervisorProfile: { id: 'profile', jobTitle: 'Saved title', department: 'Platform', bio: 'Saved bio' } };
    let writes = 0;
    let photos = 0;
    let identities = 0;
    let failing = true;
    await page.route('**/api/users/me', route => {
      identities += 1;
      return route.fulfill(writes && failing ? { status: 503, json: {} } : { json: { ...account, ...(writes ? profile : {}) } });
    });
    await page.route(`**/api/users/${student ? 'onboarding' : 'supervisor-onboarding'}`, route => {
      writes += 1;
      return route.fulfill({ json: profile });
    });
    await page.route('**/api/users/supervisor-profile-photo', route => { photos += 1; return route.fulfill({ json: profile }); });
    await page.goto('/onboarding');
    const field = page.getByLabel(student ? 'University' : 'Job title', { exact: true });
    await field.fill(student ? 'Saved University' : 'Saved title');
    if (student) {
      await page.getByLabel('Major or field of study', { exact: true }).fill('Computer science');
      await page.getByRole('button', { name: 'Year of study' }).click();
      await page.getByRole('option', { name: '3rd Year', exact: true }).click();
      await page.getByRole('button', { name: '+ React', exact: true }).click();
    } else {
      await page.getByLabel('Department', { exact: true }).fill('Platform');
      await page.getByLabel('Bio', { exact: true }).fill('Saved bio');
      await page.getByLabel('Profile photo', { exact: true }).setInputFiles({ name: 'profile.png', mimeType: 'image/png', buffer: Buffer.from('synthetic photo') });
    }
    const initialIdentities = identities;
    await page.getByRole('button', { name: 'Complete profile', exact: true }).click();
    await expect(page.getByRole('alert').filter({ hasText: /profile.*saved.*retry/i })).toBeVisible();
    await expect(field).toHaveValue(student ? 'Saved University' : 'Saved title');
    await expect(page).toHaveURL(/\/onboarding$/);
    expect(identities).toBe(initialIdentities + 1);
    const retry = page.getByRole('button', { name: 'Retry', exact: true });
    await retry.click();
    await expect.poll(() => identities).toBe(initialIdentities + 2);
    await expect(retry).toBeEnabled();
    await expect(field).toHaveValue(student ? 'Saved University' : 'Saved title');
    expect(writes).toBe(1);
    expect(photos).toBe(student ? 0 : 1);
    expect(await page.evaluate(() => localStorage.getItem('refreshToken'))).toBe('cold-refresh');
    failing = false;
    await retry.click();
    await expect(page).toHaveURL(student ? /\/student\/dashboard$/ : /\/party-supervisor\/overview$/);
    expect(writes).toBe(1);
    expect(photos).toBe(student ? 0 : 1);
  });
}

test('bootstrap identity 503 still expires credentials at the access deadline without a loaded user', async ({ page }) => {
  await seed(page, 35);
  const start = new Date();
  await page.clock.install({ time: new Date(start.getTime() - 1000) });
  await page.route('**/api/users/me', route => route.fulfill({ status: 503, json: {} }));
  await page.goto('/coordinator/dashboard');
  await expect(page.getByRole('button', { name: 'Retry', exact: true })).toBeVisible();
  await page.clock.pauseAt(new Date(start.getTime() + 1000));
  const remaining = await page.evaluate(() => JSON.parse(atob(localStorage.getItem('accessToken')!.split('.')[1])).exp * 1000 - Date.now());
  await page.clock.runFor(remaining - 1);
  expect(await page.evaluate(() => localStorage.getItem('refreshToken'))).toBe('cold-refresh');
  await page.clock.runFor(1);
  await expect(page).toHaveURL(/\/login$/);
  expect(await page.evaluate(() => localStorage.getItem('accessToken'))).toBeNull();
  expect(await page.evaluate(() => localStorage.getItem('refreshToken'))).toBeNull();
});

test('bootstrap 401 followed by a transient refresh 503 preserves the session for retry', async ({ page }) => {
  await seed(page);
  let failing = true;
  let refreshes = 0;
  await page.route('**/api/users/me', route => route.fulfill(failing ? { status: 401, json: {} } : { json: user }));
  await page.route('**/api/auth/refresh', route => { refreshes += 1; return route.fulfill({ status: 503, json: {} }); });
  await page.goto('/coordinator/dashboard');
  await expect(page.getByRole('button', { name: 'Retry', exact: true })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('refreshToken'))).toBe('cold-refresh');
  expect(refreshes).toBe(1);
  failing = false;
  await page.getByRole('button', { name: 'Retry', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Overview', exact: true })).toBeVisible();
});

test('a suspended identity still clears credentials instead of showing a retry or pending screen', async ({ page }) => {
  await seed(page);
  await page.route('**/api/users/me', route => route.fulfill({ json: { ...user, status: 'SUSPENDED' } }));
  await page.goto('/coordinator/dashboard');
  await expect(page).toHaveURL(/\/login$/);
  expect(await page.evaluate(() => localStorage.getItem('accessToken'))).toBeNull();
});

test('a real 35 second cold login survives the former timeout and blocks duplicate submits', async ({ page }) => {
  test.setTimeout(90_000);
  let requests = 0;
  await page.route('**/api/auth/login', async route => {
    requests += 1;
    await new Promise(resolve => setTimeout(resolve, 35_000));
    await route.fulfill({ json: { accessToken: jwt(), refreshToken: 'cold-refresh', user } });
  });
  await signIn(page, user.email);
  await expect(page.getByRole('button', { name: 'Signing in...' })).toBeDisabled();
  await page.locator('form').evaluate(form => { (form as HTMLFormElement).requestSubmit(); (form as HTMLFormElement).requestSubmit(); });
  await expect.soft(page.getByText(warming, { exact: true })).toBeVisible({ timeout: 7000 });
  await page.screenshot({ path: test.info().outputPath('login-warming.png') });
  await expect(page).toHaveURL(/\/coordinator\/dashboard$/, { timeout: 40_000 });
  expect(requests).toBe(1);
  expect(await page.evaluate(async () => { const path = '/src/api/client.ts'; return (await import(path)).default.defaults.timeout; })).toBe(90_000);
});

test('offline login explains server recovery rather than incorrect credentials', async ({ page }) => {
  await page.route('**/api/auth/login', route => route.abort('internetdisconnected'), { times: 1 });
  await signIn(page, user.email);
  await expect(page.getByRole('alert').filter({ hasText: /server.*retry/i })).toBeVisible();
  await expect(page.getByText('Email or password is incorrect', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).toHaveURL(/\/coordinator\/dashboard$/);
});

test('wrong credential 401 keeps its existing message and does not refresh', async ({ page }) => {
  let refreshes = 0;
  await page.route('**/api/auth/refresh', route => { refreshes += 1; return route.fulfill({ status: 400 }); });
  await page.route('**/api/auth/login', route => route.fulfill({ status: 401, json: {} }));
  await signIn(page, user.email);
  await expect(page.getByText('Email or password is incorrect', { exact: true })).toBeVisible();
  expect(refreshes).toBe(0);
});

test('login timeout retains a recoverable server error and can be retried', async ({ page }) => {
  await page.route('**/api/auth/login', route => route.abort('timedout'), { times: 1 });
  await signIn(page, user.email);
  await expect(page.getByRole('alert').filter({ hasText: /server.*retry/i })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).toHaveURL(/\/coordinator\/dashboard$/);
});

test('background identity 503 after profile save keeps the current user and page', async ({ page }) => {
  await seed(page);
  let failing = false;
  await page.route('**/api/users/me', route => route.fulfill(failing ? { status: 503, json: {} } : { json: user }));
  await page.route('**/api/users/me/profile', route => { failing = true; return route.fulfill({ json: user }); });
  await page.goto('/coordinator/profile');
  await page.getByRole('button', { name: 'Edit profile', exact: true }).click();
  await page.getByLabel('Phone number', { exact: true }).fill('123456789');
  await page.getByRole('button', { name: 'Save changes', exact: true }).click();
  await expect(page.getByRole('alert').filter({ hasText: /profile.*saved.*retry/i })).toBeVisible();
  await expect(page.getByLabel('Phone number', { exact: true })).toHaveValue('123456789');
  await expect(page.getByRole('heading', { name: 'Cold Fixture', exact: true })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('refreshToken'))).toBe('cold-refresh');
});

for (const failure of [503, 'offline', 'timeout'] as const) {
  test(`project POST ${failure} is never automatically retried`, async ({ page }) => {
    await seed(page);
    await page.route('**/api/users/me', route => route.fulfill({ json: { ...user, role: 'COMPANY' } }));
    let writes = 0;
    await page.route('**/api/projects', route => { writes += 1; return typeof failure === 'string' ? route.abort(failure === 'offline' ? 'internetdisconnected' : 'timedout') : route.fulfill({ status: failure, json: {} }); });
    await page.goto('/company/projects/new');
    await page.getByLabel('Project title', { exact: true }).fill('Draft stays here');
    await page.getByLabel('Project description', { exact: true }).fill('No automatic retry.');
    await page.getByRole('button', { name: 'Save as draft', exact: true }).click();
    await expect(page.getByRole('alert').filter({ hasText: 'Save outcome unknown' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Save as draft', exact: true })).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Submit for review', exact: true })).toBeDisabled();
    await expect(page.getByRole('link', { name: 'Inspect projects', exact: true })).toHaveAttribute('href', '/company/projects');
    expect(writes).toBe(1);
    await expect(page.getByLabel('Project title', { exact: true })).toHaveValue('Draft stays here');
    await expect(page.getByLabel('Project description', { exact: true })).toHaveValue('No automatic retry.');
    await page.getByLabel('Project title', { exact: true }).press('Enter');
    expect(writes).toBe(1);
  });
}

test('login followed by an unavailable identity endpoint retries GET me, not credentials', async ({ page }) => {
  let logins = 0;
  let failing = true;
  await page.route('**/api/auth/login', route => { logins += 1; return route.fulfill({ json: { accessToken: jwt(), refreshToken: 'cold-refresh', user } }); });
  await page.route('**/api/users/me', route => route.fulfill(failing ? { status: 503, json: {} } : { json: user }));
  await signIn(page, user.email);
  await expect(page.getByRole('button', { name: 'Retry', exact: true })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('refreshToken'))).toBe('cold-refresh');
  failing = false;
  await page.getByRole('button', { name: 'Retry', exact: true }).click();
  await expect(page).toHaveURL(/\/coordinator\/dashboard$/);
  expect(logins).toBe(1);
});

test('401 project POST renews the session but requires explicit resubmission without replay', async ({ page }) => {
  await seed(page);
  const company = { ...user, role: 'COMPANY' };
  await page.route('**/api/users/me', route => route.fulfill({ json: company }));
  let writes = 0;
  let refreshes = 0;
  await page.route('**/api/projects', route => {
    writes += 1;
    return route.fulfill({ status: 401, json: { message: 'Expired access' } });
  });
  await page.route('**/api/auth/refresh', route => {
    refreshes += 1;
    return route.fulfill({ json: { accessToken: jwt(7200, 'fresh'), refreshToken: 'fresh-refresh', user: company } });
  });
  await page.goto('/company/projects/new');
  await page.getByLabel('Project title', { exact: true }).fill('Keep my draft');
  await page.getByLabel('Project description', { exact: true }).fill('Never repeat a business write silently.');
  await page.getByRole('button', { name: 'Save as draft', exact: true }).click();
  await expect(page.getByText(/session renewed.*submit again/i)).toBeVisible();
  expect(writes).toBe(1);
  expect(refreshes).toBe(1);
  await expect(page.getByLabel('Project title', { exact: true })).toHaveValue('Keep my draft');
});

test('manual renewal 503 preserves the dashboard and allows retry while access remains valid', async ({ page }) => {
  await seed(page, 35);
  await page.clock.install();
  let refreshes = 0;
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/api/users/pending**', route => route.fulfill({ json: { content: [], totalElements: 7 } }));
  await page.route('**/api/auth/refresh', async route => {
    refreshes += 1;
    if (refreshes === 1) await gate;
    return route.fulfill(refreshes === 1 ? { status: 503, json: {} }
      : { json: { accessToken: jwt(3600, 'renewed'), refreshToken: 'renewed-refresh', user } });
  });
  await page.goto('/coordinator/dashboard');
  await expect(page.getByRole('heading', { name: 'Overview', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: /Pending approvals/ })).toContainText('7');
  await page.clock.fastForward(6000);
  await page.getByRole('button', { name: 'Stay logged in', exact: true }).click();
  try {
    await expect.poll(() => refreshes).toBe(1);
    await expect(page.getByRole('button', { name: /Refreshing/ })).toBeDisabled();
    await page.clock.fastForward(5100);
    await expect(page.getByText(warming, { exact: true })).toBeVisible();
    await page.screenshot({ path: test.info().outputPath('session-warming.png') });
  } finally { release(); }
  await expect(page.getByRole('alert').filter({ hasText: /retry/i })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Stay logged in', exact: true })).toBeEnabled();
  expect(await page.evaluate(() => localStorage.getItem('refreshToken'))).toBe('cold-refresh');
  await page.screenshot({ path: test.info().outputPath('session-retry.png') });
  await page.getByRole('button', { name: 'Stay logged in', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Overview', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: /Pending approvals/ })).toContainText('7');
  expect(refreshes).toBe(2);
});

test('an unavailable renewal still expires at the actual access deadline', async ({ page }) => {
  await seed(page, 35);
  await page.clock.install();
  await page.route('**/api/auth/refresh', route => route.fulfill({ status: 503, json: {} }));
  await page.goto('/coordinator/dashboard');
  await expect(page.getByRole('heading', { name: 'Overview', exact: true })).toBeVisible();
  await page.clock.fastForward(6000);
  await page.getByRole('button', { name: 'Stay logged in', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Stay logged in', exact: true })).toBeEnabled();
  await page.clock.fastForward(30000);
  await expect(page).toHaveURL(/\/login$/);
  expect(await page.evaluate(() => localStorage.getItem('accessToken'))).toBeNull();
});

test('successful renewal with identity 503 retains the full profile and unsaved form', async ({ page }) => {
  await seed(page, 35);
  await page.clock.install();
  const student = { ...user, role: 'STUDENT' };
  let failing = false;
  await page.route('**/api/users/me', route => route.fulfill(failing ? { status: 503, json: {} }
    : { json: { ...student, studentProfile: { id: 'profile', university: 'Fixture University', skills: ['React'] } } }));
  await page.route('**/api/auth/refresh', route => {
    failing = true;
    return route.fulfill({ json: { accessToken: jwt(3600, 'renewed'), refreshToken: 'renewed-refresh', user: student } });
  });
  await page.goto('/student/profile');
  await page.getByRole('button', { name: 'Edit profile', exact: true }).click();
  await page.getByLabel('First name', { exact: true }).fill('Unsaved name');
  await page.clock.fastForward(6000);
  await page.getByRole('button', { name: 'Stay logged in', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page).toHaveURL(/\/student\/profile$/);
  await expect(page.getByLabel('First name', { exact: true })).toHaveValue('Unsaved name');
  await expect(page.getByLabel('University', { exact: true })).toHaveValue('Fixture University');
  expect(await page.evaluate(() => localStorage.getItem('refreshToken'))).toBe('renewed-refresh');
});

for (const status of [400, 401, 403]) {
  test(`definitive refresh ${status} still logs out`, async ({ page }) => {
    await seed(page, 35);
    await page.clock.install();
    await page.route('**/api/auth/refresh', route => route.fulfill({ status, json: {} }));
    await page.goto('/coordinator/dashboard');
    await expect(page.getByRole('heading', { name: 'Overview', exact: true })).toBeVisible();
    await page.clock.fastForward(6000);
    await page.getByRole('button', { name: 'Stay logged in', exact: true }).click();
    await expect(page).toHaveURL(/\/login$/);
    expect(await page.evaluate(() => localStorage.getItem('refreshToken'))).toBeNull();
  });
}

for (const [status, role, path, heading] of [
  ['PENDING', 'COMPANY', '/pending', 'Approval pending'],
  ['REJECTED', 'COMPANY', '/rejected', 'Account not approved'],
  ['APPROVED', 'STUDENT', '/onboarding', 'Complete your profile'],
] as const) {
  test(`existing ${status} ${role} flow stays intact`, async ({ page }) => {
    const account = { ...user, status, role };
    await page.route('**/api/auth/login', route => route.fulfill({ json: { accessToken: jwt(), refreshToken: 'cold-refresh', user: account } }));
    await page.route('**/api/users/me', route => route.fulfill({ json: account }));
    await signIn(page, user.email);
    await expect(page).toHaveURL(new RegExp(`${path}$`));
    await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible();
  });
}
