import { expect, test, type Page } from '@playwright/test';

test.setTimeout(30_000);

const student = {
  id: 'account-student', email: 'student@example.test', firstName: 'Mira', lastName: 'Fixture',
  role: 'STUDENT', status: 'APPROVED',
  studentProfile: { id: 'student-profile', university: 'Fixture University', major: 'Computing', yearOfStudy: '3rd Year', skills: ['React'], gpa: 0 },
};
const supervisor = {
  ...student, id: 'invited-supervisor', email: 'supervisor@example.test', role: 'PROJECT_SUPERVISOR', studentProfile: undefined,
  supervisorProfile: { id: 'supervisor-profile', jobTitle: 'Engineer', department: 'Platform', bio: 'Supports teams.' },
};
const invitation = { id: 'invitation', email: supervisor.email, companyName: 'Fixture Company', status: 'PENDING', expiresAt: '2030-01-01T00:00:00Z' };
const invitePath = '/project-supervisor-invitations/fixture-token';
const jwt = (id: string) => `e30.${Buffer.from(JSON.stringify({ sub: id, ver: 0, exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url')}.fixture`;

async function seed(page: Page, user = student) {
  await page.addInitScript(token => {
    if (sessionStorage.getItem('account-fixture')) return;
    sessionStorage.setItem('account-fixture', 'yes');
    localStorage.setItem('accessToken', token);
    localStorage.setItem('refreshToken', 'account-refresh');
  }, jwt(user.id));
  await page.route('**/api/users/me', route => route.fulfill({ json: user }));
}

async function fillInvitation(page: Page) {
  await page.getByLabel('First name', { exact: true }).fill('Invited');
  await page.getByLabel('Last name', { exact: true }).fill('Fixture');
  await page.getByLabel('Job title', { exact: true }).fill('Engineer');
  await page.getByLabel('Department', { exact: true }).fill('Platform');
  await page.getByLabel('Bio', { exact: true }).fill('Supports teams.');
  await page.getByLabel('Password', { exact: true }).fill('SyntheticOnly123!');
  await page.getByLabel('Confirm password', { exact: true }).fill('SyntheticOnly123!');
}

test.beforeEach(async ({ page }) => {
  await page.route(url => url.pathname.startsWith('/api/'), route => route.fulfill({ status: 503, json: {} }));
  await page.route('**/api/project-supervisor-invitations/fixture-token', route => route.fulfill({ json: invitation }));
});

test('student save sends only editable role fields, keeps GPA zero, and retries identity without another write', async ({ page }) => {
  await seed(page);
  let writes = 0;
  let failing = false;
  let recover = false;
  await page.route('**/api/users/me', route => route.fulfill(failing && !recover
    ? { status: 503, json: {} } : { json: { ...student, firstName: recover ? 'Persisted' : student.firstName } }));
  await page.route('**/api/users/me/profile', route => {
    writes += 1;
    expect(route.request().method()).toBe('PUT');
    const payload = route.request().postDataJSON();
    expect(payload).not.toHaveProperty('companyName');
    expect(payload).not.toHaveProperty('industry');
    expect(payload.gpa).toBe(0);
    failing = true;
    return route.fulfill({ json: { ...student, firstName: 'Persisted' } });
  });
  await page.goto('/student/profile');
  await page.getByRole('button', { name: 'Edit profile' }).click();
  await page.getByLabel('First name', { exact: true }).fill('Draft');
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByRole('alert').filter({ hasText: /saved.*retry/i })).toBeVisible();
  await expect(page.getByRole('alert').filter({ hasText: /saved.*retry/i })).toBeInViewport();
  await expect(page.getByRole('button', { name: 'Retry', exact: true })).toBeInViewport({ ratio: 1 });
  await expect(page.getByLabel('First name', { exact: true })).toHaveValue('Draft');
  await page.screenshot({ path: test.info().outputPath('profile-saved-retry.png'), fullPage: true });
  await expect(page.getByText('Profile updated', { exact: true })).toHaveCount(0);
  recover = true;
  await page.getByRole('button', { name: 'Retry', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Persisted Fixture' })).toBeVisible();
  expect(writes).toBe(1);
});

test('empty GPA explicitly clears it and failed profile save retains form without success', async ({ page }) => {
  await seed(page);
  await page.route('**/api/users/me/profile', route => {
    expect(route.request().postDataJSON().gpa).toBeNull();
    return route.fulfill({ status: 400, json: { message: 'Profile validation failed' } });
  });
  await page.goto('/student/profile');
  await page.getByRole('button', { name: 'Edit profile' }).click();
  await page.getByLabel('GPA', { exact: true }).fill('');
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'Profile validation failed' })).toBeVisible();
  await expect(page.getByLabel('GPA', { exact: true })).toHaveValue('');
  await expect(page.getByText('Profile updated', { exact: true })).toHaveCount(0);
});

for (const complete of [false, true]) {
  test(`pending check routes approved student to ${complete ? 'dashboard' : 'onboarding'} without relogin and dedupes focus`, async ({ page }) => {
    await seed(page);
    let approved = false;
    let checks = 0;
    let release!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    await page.route('**/api/users/me', async route => {
      checks += 1;
      if (approved) await gate;
      await route.fulfill({ json: { ...student, status: approved ? 'APPROVED' : 'PENDING', studentProfile: complete ? student.studentProfile : undefined } });
    });
    await page.goto('/pending');
    await expect(page.getByRole('heading', { name: 'Approval pending', exact: true })).toBeVisible();
    const before = checks;
    approved = true;
    await page.getByRole('button', { name: 'Check status', exact: true }).click();
    await expect.poll(() => checks).toBe(before + 1);
    await page.evaluate(() => { window.dispatchEvent(new Event('focus')); window.dispatchEvent(new Event('focus')); });
    expect(checks).toBe(before + 1);
    release();
    await expect(page).toHaveURL(complete ? /\/student\/dashboard$/ : /\/onboarding$/);
  });
}

test('pending focus refresh preserves account on transient failure and exposes keyboard retry', async ({ page }) => {
  await seed(page, { ...student, status: 'PENDING' });
  await page.goto('/pending');
  await expect(page.getByRole('heading', { name: 'Approval pending' })).toBeVisible();
  await page.route('**/api/users/me', route => route.fulfill({ status: 503, json: {} }));
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(page.getByRole('alert').filter({ hasText: /retry/i })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('refreshToken'))).toBe('account-refresh');
  await page.route('**/api/users/me', route => route.fulfill({ json: { ...student, status: 'REJECTED' } }));
  await page.getByRole('button', { name: 'Retry', exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/rejected$/);
});

for (const [role, status, complete, destination] of [
  ['STUDENT', 'PENDING', false, '/pending'], ['STUDENT', 'REJECTED', false, '/rejected'],
  ['STUDENT', 'APPROVED', true, '/student/dashboard'], ['COMPANY', 'APPROVED', false, '/company/dashboard'],
  ['COORDINATOR', 'APPROVED', false, '/coordinator/dashboard'], ['PROJECT_SUPERVISOR', 'APPROVED', false, '/project-supervisor/overview'],
  ['PARTY_SUPERVISOR', 'APPROVED', true, '/party-supervisor/overview'],
] as const) {
  test(`onboarding guard redirects ${role} ${status} completed=${complete}`, async ({ page }) => {
    await seed(page, { ...student, role, status, studentProfile: complete ? student.studentProfile : undefined,
      supervisorProfile: complete ? supervisor.supervisorProfile : undefined } as typeof student);
    await page.goto('/onboarding');
    await expect(page).toHaveURL(new RegExp(`${destination}$`));
    await expect(page.getByRole('button', { name: 'Complete profile', exact: true })).toHaveCount(0);
  });
}

for (const state of ['ACCEPTED', 'EXPIRED', 'REVOKED', 'INVALID']) {
  test(`invitation ${state} has distinct copy and safe actions`, async ({ page }) => {
    await page.route('**/api/project-supervisor-invitations/fixture-token', route => route.fulfill(state === 'INVALID'
      ? { status: 400, json: { message: 'Invalid invitation' } } : { json: { ...invitation, status: state } }));
    await page.goto(invitePath);
    await expect(page.getByRole('heading', { name: `Invitation ${state.toLowerCase()}`, exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Accept invitation', exact: true })).toHaveCount(0);
    if (state === 'ACCEPTED') {
      await page.getByRole('link', { name: 'Sign in', exact: true }).click();
      await expect(page).toHaveURL(/\/login\?returnTo=/);
    }
  });
}

test('temporary invitation validation retains form and Retry is GET only', async ({ page }) => {
  await page.goto(invitePath);
  await fillInvitation(page);
  await page.route('**/api/project-supervisor-invitations/fixture-token', route => route.fulfill({ status: 503, json: {} }), { times: 1 });
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  // Explicit refresh is also available when reviewing an old invitation form.
  await page.getByRole('button', { name: 'Check invitation', exact: true }).click();
  await expect(page.getByRole('alert').filter({ hasText: /temporar|retry/i })).toBeVisible();
  await expect(page.getByLabel('First name', { exact: true })).toHaveValue('Invited');
  await page.screenshot({ path: test.info().outputPath('invitation-transient-form.png'), fullPage: true });
  await page.getByRole('button', { name: 'Retry', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Accept invitation', exact: true })).toBeEnabled();
});

test('existing identity must explicitly sign out before accepting and URL stays intact', async ({ page }) => {
  await seed(page);
  await page.goto(invitePath);
  await expect(page.getByRole('alert').filter({ hasText: student.email })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Accept invitation', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Sign out to continue', exact: true }).click();
  await expect(page).toHaveURL(invitePath);
  await expect(page.getByRole('button', { name: 'Accept invitation', exact: true })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('accessToken'))).toBeNull();
});

for (const failure of ['offline', 'timeout']) {
  test(`lost acceptance ${failure} reconciles accepted state with GET and offers sign in, never POST again`, async ({ page }) => {
    let writes = 0;
    await page.route('**/api/project-supervisor-invitations/fixture-token', route => route.fulfill({ json: { ...invitation, status: writes ? 'ACCEPTED' : 'PENDING' } }));
    await page.route('**/api/project-supervisor-invitations/fixture-token/accept', route => {
      writes += 1;
      return route.abort(failure === 'timeout' ? 'timedout' : 'internetdisconnected');
    });
    await page.goto(invitePath);
    await fillInvitation(page);
    await page.getByRole('button', { name: 'Accept invitation', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Invitation accepted', exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Sign in', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Accept invitation', exact: true })).toHaveCount(0);
    expect(writes).toBe(1);
  });
}

test('accepted account with unavailable identity retries GET only, no registration or photo replay', async ({ page }) => {
  let writes = 0;
  let photos = 0;
  let failing = true;
  await page.route('**/api/users/me', route => route.fulfill(failing ? { status: 503, json: {} } : { json: supervisor }));
  await page.route('**/api/users/supervisor-profile-photo', route => { photos += 1; return route.fulfill({ json: supervisor.supervisorProfile }); });
  await page.route('**/api/project-supervisor-invitations/fixture-token/accept', async route => {
    writes += 1;
    await new Promise(resolve => setTimeout(resolve, 150));
    await route.fulfill({ json: { accessToken: jwt(supervisor.id), refreshToken: 'invited-refresh', user: supervisor } });
  });
  await page.goto(invitePath);
  await fillInvitation(page);
  await page.getByLabel('Profile photo', { exact: true }).setInputFiles({ name: 'photo.png', mimeType: 'image/png', buffer: Buffer.from('synthetic') });
  await page.getByRole('button', { name: 'Accept invitation', exact: true }).click();
  await page.locator('form').evaluate(form => { (form as HTMLFormElement).requestSubmit(); (form as HTMLFormElement).requestSubmit(); });
  await expect(page.getByRole('alert').filter({ hasText: /created.*retry/i })).toBeVisible();
  const before = photos;
  await page.getByRole('button', { name: 'Retry identity', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Retry identity', exact: true })).toBeEnabled();
  expect(photos).toBe(before);
  failing = false;
  await page.getByRole('button', { name: 'Retry identity', exact: true }).click();
  await expect(page).toHaveURL(/\/project-supervisor\/overview$/);
  expect(writes).toBe(1);
  expect(photos).toBe(before);
});

for (const failure of [503, 'offline', 'unknown-state'] as const) {
  test(`initial invitation ${failure} is temporary and GET retry recovers`, async ({ page }) => {
    let checks = 0;
    let writes = 0;
    await page.route('**/api/project-supervisor-invitations/fixture-token', route => {
      checks += 1;
      if (checks > 1) return route.fulfill({ json: invitation });
      return failure === 'offline' ? route.abort('internetdisconnected')
        : route.fulfill(failure === 503 ? { status: 503, json: {} } : { json: { ...invitation, status: 'UNKNOWN' } });
    });
    await page.route('**/api/project-supervisor-invitations/fixture-token/accept', route => { writes += 1; return route.fulfill({ status: 500 }); });
    await page.goto(invitePath);
    await expect(page.getByRole('heading', { name: 'Invitation temporarily unavailable', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Retry', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Accept invitation', exact: true })).toBeEnabled();
    expect(writes).toBe(0);
    expect(checks).toBe(2);
  });
}

test('uncertain acceptance with unavailable validation keeps checking, never repeats registration', async ({ page }) => {
  let writes = 0;
  let recovered = false;
  await page.route('**/api/project-supervisor-invitations/fixture-token', route => route.fulfill(writes && !recovered
    ? { status: 503, json: {} } : { json: { ...invitation, status: writes ? 'ACCEPTED' : 'PENDING' } }));
  await page.route('**/api/project-supervisor-invitations/fixture-token/accept', route => { writes += 1; return route.abort('timedout'); });
  await page.goto(invitePath);
  await fillInvitation(page);
  await page.getByRole('button', { name: 'Accept invitation', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Check acceptance status', exact: true })).toBeVisible();
  await expect(page.getByRole('alert').filter({ hasText: /not confirmed/i })).toBeVisible();
  await page.getByRole('button', { name: 'Retry', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Retry', exact: true })).toBeEnabled();
  recovered = true;
  await page.getByRole('button', { name: 'Retry', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Invitation accepted', exact: true })).toBeVisible();
  expect(writes).toBe(1);
});

test('photo failure leaves accepted account signed in and opens workspace', async ({ page }) => {
  let writes = 0;
  let photos = 0;
  await page.route('**/api/users/me', route => route.fulfill({ json: supervisor }));
  await page.route('**/api/users/supervisor-profile-photo', route => { photos += 1; return route.fulfill({ status: 503 }); });
  await page.route('**/api/project-supervisor-invitations/fixture-token/accept', route => {
    writes += 1;
    return route.fulfill({ json: { accessToken: jwt(supervisor.id), refreshToken: 'invited-refresh', user: supervisor } });
  });
  await page.goto(invitePath);
  await fillInvitation(page);
  await page.getByLabel('Profile photo', { exact: true }).setInputFiles({ name: 'photo.png', mimeType: 'image/png', buffer: Buffer.from('synthetic') });
  await page.getByRole('button', { name: 'Accept invitation', exact: true }).click();
  await expect(page).toHaveURL(/\/project-supervisor\/overview$/);
  await expect(page.getByText('Account created, but the profile photo could not be uploaded', { exact: true })).toBeVisible();
  expect(writes).toBe(1);
  expect(photos).toBe(1);
  expect(await page.evaluate(() => localStorage.getItem('refreshToken'))).toBe('invited-refresh');
});

test('invitation sign in preserves return URL and signed-in identity stays explicit', async ({ page }) => {
  await page.route('**/api/project-supervisor-invitations/fixture-token', route => route.fulfill({ json: { ...invitation, status: 'ACCEPTED' } }));
  await page.route('**/api/auth/login', route => route.fulfill({ json: { accessToken: jwt(supervisor.id), refreshToken: 'invited-refresh', user: supervisor } }));
  await page.route('**/api/users/me', route => route.fulfill({ json: supervisor }));
  await page.goto(invitePath);
  await page.getByRole('link', { name: 'Sign in', exact: true }).click();
  await page.getByLabel('Email address', { exact: true }).fill(supervisor.email);
  await page.getByLabel('Password', { exact: true }).fill('SyntheticOnly123!');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).toHaveURL(invitePath);
  await expect(page.getByRole('heading', { name: 'Invitation accepted', exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Go to dashboard', exact: true }).click();
  await expect(page).toHaveURL(/\/project-supervisor\/overview$/);
});

for (const role of ['COMPANY', 'COORDINATOR']) {
  test(`${role} profile sends common and role fields only, reflects normalized persisted values`, async ({ page }) => {
    const company = role === 'COMPANY';
    const account = { ...student, role, companyProfile: { id: 'company-profile', companyName: 'Fixture Company', city: 'Karachi' } };
    await seed(page, account);
    let saved = false;
    await page.route('**/api/users/me', route => route.fulfill({ json: { ...account, firstName: saved ? 'Normalized' : 'Mira' } }));
    await page.route('**/api/users/me/profile', route => {
      expect(route.request().method()).toBe('PUT');
      const payload = route.request().postDataJSON();
      expect(payload).not.toHaveProperty('university');
      expect(payload).not.toHaveProperty('gpa');
      expect(payload).not.toHaveProperty('studentProfile');
      if (company) expect(payload.companyName).toBe('Fixture Company');
      else expect(Object.keys(payload).sort()).toEqual(['firstName', 'lastName', 'phoneNumber']);
      saved = true;
      return route.fulfill({ json: { ...account, firstName: 'Normalized' } });
    });
    await page.goto(`/${role.toLowerCase()}/profile`);
    await page.getByRole('button', { name: 'Edit profile', exact: true }).click();
    await expect.soft(page.getByLabel('Phone number', { exact: true })).toHaveAttribute('maxlength', '50');
    if (company) {
      for (const label of ['Industry', 'City', 'Country']) {
        await expect.soft(page.getByLabel(label, { exact: true })).toHaveAttribute('maxlength', '100');
      }
    }
    await page.getByLabel('First name', { exact: true }).fill('Draft');
    await page.getByRole('button', { name: 'Save changes', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Normalized Fixture', exact: true })).toBeVisible();
    await expect(page.getByText('Profile updated', { exact: true })).toBeVisible();
  });
}

test('student onboarding validates required fields and selects a real year before its single write', async ({ page }) => {
  await seed(page, { ...student, studentProfile: undefined } as unknown as typeof student);
  let writes = 0;
  let saved = false;
  await page.route('**/api/users/me', route => route.fulfill({ json: { ...student, studentProfile: saved ? student.studentProfile : undefined } }));
  await page.route('**/api/users/onboarding', route => {
    writes += 1;
    expect(route.request().postDataJSON()).toMatchObject({ university: 'Fixture University', major: 'Computing', yearOfStudy: '3rd Year', gpa: 0 });
    saved = true;
    return route.fulfill({ json: student.studentProfile });
  });
  await page.goto('/onboarding');
  await page.getByRole('button', { name: 'Complete profile', exact: true }).click();
  await expect(page.getByRole('alert')).toBeVisible();
  expect(writes).toBe(0);
  await page.getByLabel('University', { exact: true }).fill('Fixture University');
  await page.getByLabel('Major or field of study', { exact: true }).fill('Computing');
  await page.getByRole('button', { name: '+ React', exact: true }).click();
  await page.getByLabel('GPA (optional)', { exact: true }).fill('0');
  await page.getByRole('button', { name: 'Complete profile', exact: true }).click();
  expect(writes).toBe(0);
  await page.getByRole('button', { name: 'Year of study' }).click();
  await page.getByRole('option', { name: '3rd Year', exact: true }).click();
  await page.getByRole('button', { name: 'Complete profile', exact: true }).click();
  await expect(page).toHaveURL(/\/student\/dashboard$/);
  expect(writes).toBe(1);
});

test('a late invitation response cannot replace a new signed-in account or upload under it', async ({ page }) => {
  let writes = 0;
  let photos = 0;
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  const replacement = { ...student, role: 'COORDINATOR' };
  await page.route('**/api/users/me', route => route.fulfill({ json: replacement }));
  await page.route('**/api/users/supervisor-profile-photo', route => { photos += 1; return route.fulfill({ status: 500 }); });
  await page.route('**/api/project-supervisor-invitations/fixture-token/accept', async route => {
    writes += 1;
    await gate;
    await route.fulfill({ json: { accessToken: jwt(supervisor.id), refreshToken: 'invited-refresh', user: supervisor } });
  });
  await page.goto(invitePath);
  await fillInvitation(page);
  await page.getByLabel('Profile photo', { exact: true }).setInputFiles({ name: 'photo.png', mimeType: 'image/png', buffer: Buffer.from('synthetic') });
  await page.getByRole('button', { name: 'Accept invitation', exact: true }).click();
  await expect.poll(() => writes).toBe(1);
  await page.evaluate(token => {
    localStorage.setItem('accessToken', token);
    localStorage.setItem('refreshToken', 'replacement-refresh');
    window.dispatchEvent(new StorageEvent('storage', { key: 'accessToken', oldValue: null, newValue: token, storageArea: localStorage }));
  }, jwt(replacement.id));
  await expect(page.getByRole('heading', { name: 'Switch account to accept', exact: true })).toBeVisible();
  const response = page.waitForResponse('**/api/project-supervisor-invitations/fixture-token/accept');
  release();
  await response;
  await page.waitForLoadState('networkidle');
  expect(await page.evaluate(() => localStorage.getItem('refreshToken'))).toBe('replacement-refresh');
  expect(photos).toBe(0);
  expect(writes).toBe(1);
  await expect(page.getByRole('alert').filter({ hasText: student.email })).toBeVisible();
});

test('late profile save cannot display or overwrite another account after a tab switch', async ({ page }) => {
  await seed(page);
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  let writes = 0;
  const replacement = { ...student, id: 'replacement-student', firstName: 'Replacement' };
  const replacementToken = jwt(replacement.id);
  await page.route('**/api/users/me', route => route.fulfill({ json: route.request().headers().authorization === `Bearer ${replacementToken}` ? replacement : student }));
  await page.route('**/api/users/me/profile', async route => {
    writes += 1;
    await gate;
    await route.fulfill({ json: { ...student, firstName: 'Private draft' } });
  });
  await page.goto('/student/profile');
  await page.getByRole('button', { name: 'Edit profile', exact: true }).click();
  await page.getByLabel('First name', { exact: true }).fill('Private draft');
  await page.getByRole('button', { name: 'Save changes', exact: true }).click();
  await expect.poll(() => writes).toBe(1);
  await page.evaluate(token => {
    const previous = localStorage.getItem('accessToken');
    localStorage.setItem('accessToken', token);
    localStorage.setItem('refreshToken', 'replacement-refresh');
    window.dispatchEvent(new StorageEvent('storage', { key: 'accessToken', oldValue: previous, newValue: token, storageArea: localStorage }));
  }, replacementToken);
  await expect(page.getByRole('heading', { name: 'Replacement Fixture', exact: true })).toBeVisible();
  const response = page.waitForResponse('**/api/users/me/profile');
  release();
  await response;
  await page.waitForLoadState('networkidle');
  await expect(page.getByRole('heading', { name: 'Replacement Fixture', exact: true })).toBeVisible();
  await expect(page.locator('input[value="Private draft"]')).toHaveCount(0);
  await expect(page.getByText('Profile updated', { exact: true })).toHaveCount(0);
});

test('mobile pending retry and invitation form keep house style, visible errors and 44px actions', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await seed(page, { ...student, status: 'PENDING' });
  await page.goto('/pending');
  const check = page.getByRole('button', { name: 'Check status', exact: true });
  await expect(check).toBeVisible();
  expect((await check.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  await page.route('**/api/users/me', route => route.fulfill({ status: 503, json: {} }));
  await check.click();
  await expect(page.getByRole('alert')).toBeVisible();
  await page.screenshot({ path: test.info().outputPath('pending-mobile-retry.png'), fullPage: true });
  await page.goto(invitePath);
  await page.getByRole('button', { name: 'Sign out to continue', exact: true }).click();
  await fillInvitation(page);
  const accept = page.getByRole('button', { name: 'Accept invitation', exact: true });
  expect((await accept.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  await page.screenshot({ path: test.info().outputPath('invitation-mobile-form.png'), fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test('student profile requires nonblank university, year and major before one role-filtered PUT', async ({ page }) => {
  await seed(page, { ...student, studentProfile: { ...student.studentProfile, yearOfStudy: '' } });
  let writes = 0;
  await page.route('**/api/users/me/profile', route => { writes += 1; return route.fulfill({ json: student }); });
  await page.goto('/student/profile');
  await page.getByRole('button', { name: 'Edit profile', exact: true }).click();
  const university = page.getByLabel('University', { exact: true });
  const major = page.getByLabel('Major', { exact: true });
  const save = page.getByRole('button', { name: 'Save changes', exact: true });
  await university.fill('');
  await save.click();
  await expect(page.getByRole('alert')).toBeVisible();
  expect(writes).toBe(0);
  await university.fill('Fixture University');
  await save.click();
  await expect(page.getByRole('alert')).toBeVisible();
  expect(writes).toBe(0);
  await page.getByRole('button', { name: 'Year of study' }).click();
  await page.getByRole('option', { name: '3rd Year', exact: true }).click();
  await major.fill('');
  await save.click();
  expect(writes).toBe(0);
  await major.fill('Computing');
  await university.fill('   ');
  await save.click();
  await expect(page.getByRole('alert')).toBeVisible();
  expect(writes).toBe(0);
  await university.fill('Fixture University');
  await save.click();
  await expect(page.getByText('Profile updated', { exact: true })).toBeVisible();
  expect(writes).toBe(1);
});

for (const yearOfStudy of ['Masters', 'PhD', 'Final Year', 'Foundation Year']) {
  test(`${yearOfStudy} phone-only profile edit preserves academic year`, async ({ page }) => {
    let account = { ...student, phoneNumber: '', studentProfile: { ...student.studentProfile, yearOfStudy } };
    await seed(page, account);
    let writes = 0;
    await page.route('**/api/users/me', route => route.fulfill({ json: account }));
    await page.route('**/api/users/me/profile', route => {
      writes += 1;
      expect(route.request().method()).toBe('PUT');
      const payload = route.request().postDataJSON();
      expect(payload).toMatchObject({
        phoneNumber: '+923001234567', yearOfStudy,
        university: student.studentProfile.university, major: student.studentProfile.major,
      });
      account = { ...account, phoneNumber: payload.phoneNumber };
      return route.fulfill({ json: account });
    });
    await page.goto('/student/profile');
    await page.getByRole('button', { name: 'Edit profile', exact: true }).click();
    await page.getByLabel('Phone number', { exact: true }).fill('+923001234567');
    await page.getByRole('button', { name: 'Save changes', exact: true }).click();
    await expect(page.getByText('Profile updated', { exact: true })).toBeVisible();
    expect(writes).toBe(1);
    await page.getByRole('button', { name: 'Edit profile', exact: true }).click();
    await expect(page.getByLabel('Phone number', { exact: true })).toHaveValue('+923001234567');
    await expect(page.getByRole('button', { name: 'Year of study' })).toContainText(yearOfStudy);
  });
}
