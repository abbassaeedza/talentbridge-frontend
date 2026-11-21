import { expect, test } from '@playwright/test';
import { assignment, sessionToken, setupQuestionnaire, student } from './helpers/questionnaires';

test('owner can reach frozen assignments without a current party and save five-entry drafts', async ({ page }) => {
  const fixture = await setupQuestionnaire(page);
  await page.goto('/student/questionnaires');
  await page.getByRole('link', { name: 'Student support platform' }).click();
  await expect(page.getByRole('heading', { name: 'Student support platform' })).toBeVisible();
  await expect(page.getByRole('textbox')).toHaveCount(5);
  await page.getByLabel('Answer 1', { exact: true }).fill('My saved explanation');
  await expect.poll(() => fixture.writes.length).toBe(1);
  await expect(page.getByRole('status').filter({ hasText: 'All changes saved' })).toBeVisible();
  await page.getByRole('link', { name: 'All questionnaires', exact: true }).click();
  await expect(page.getByText('1/5 saved answers', { exact: false })).toBeVisible();
  await page.getByRole('link', { name: 'Student support platform', exact: true }).click();
  await page.reload();
  await expect(page.getByLabel('Answer 1', { exact: true })).toHaveValue('My saved explanation');
  await expect(page.getByRole('button', { name: /submit/i })).toHaveCount(0);
});

test('owner list errors can be retried and detail loading does not show an editor early', async ({ page }) => {
  await setupQuestionnaire(page);
  let fail = true;
  await page.route('**/api/questionnaires/my', route => route.fulfill(fail
    ? { status: 503, json: { message: 'Synthetic outage' } } : { json: [assignment()] }));
  await page.goto('/student/questionnaires');
  await expect(page.getByRole('alert')).toContainText("Couldn't load my questionnaires");
  fail = false;
  await page.getByRole('button', { name: 'Retry my questionnaires' }).click();
  let release!: () => void;
  const held = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/api/questionnaires/assignment-1', async route => { await held; await route.fallback(); });
  await page.getByRole('link', { name: 'Student support platform', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Loading questionnaire' })).toBeVisible();
  await expect(page.getByRole('textbox')).toHaveCount(0);
  release();
  await expect(page.getByRole('textbox')).toHaveCount(5);
});

test('pending generation has no invented deadline or zero', async ({ page }) => {
  await setupQuestionnaire(page, assignment({ state: 'GENERATING', answerState: 'PENDING', editable: false, opensAt: null, closesAt: null, questions: [] }));
  await page.goto('/student/questionnaires/assignment-1');
  await expect(page.getByText('Your questions are being prepared.')).toBeVisible();
  await expect(page.getByRole('textbox')).toHaveCount(0);
  await expect(page.getByText(/closes|zero|0\/5/i)).toHaveCount(0);
});

test('a deferred old GET cannot overwrite a newer confirmed PUT', async ({ page }) => {
  const initial = assignment();
  const fixture = await setupQuestionnaire(page, initial);
  let reads = 0;
  let release!: () => void;
  const held = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/api/questionnaires/assignment-1', async route => {
    reads++;
    const response = { ...initial, serverNow: new Date().toISOString() };
    if (reads > 1) await held;
    await route.fulfill({ json: response });
  });
  await page.goto('/student/questionnaires/assignment-1');
  await page.getByLabel('Answer 1', { exact: true }).fill('New confirmed answer');
  await page.evaluate(() => window.dispatchEvent(new Event('visibilitychange')));
  await expect.poll(() => reads).toBe(2);
  await expect.poll(() => fixture.writes.length).toBe(1);
  await expect(page.getByRole('status').filter({ hasText: 'All changes saved' })).toBeVisible();
  release();
  await expect(page.getByText('Updating questionnaire...')).toHaveCount(0);
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await expect(page.getByLabel('Answer 1', { exact: true })).toHaveValue('New confirmed answer');
});

test('an answer clamped at the limit never sends a broken emoji surrogate', async ({ page }) => {
  const fixture = await setupQuestionnaire(page);
  await page.goto('/student/questionnaires/assignment-1');
  await page.getByLabel('Answer 1', { exact: true }).evaluate(input => input.removeAttribute('maxlength'));
  await page.getByLabel('Answer 1', { exact: true }).fill('a'.repeat(1999) + '😀');
  await expect.poll(() => fixture.writes.length).toBe(1);
  expect(fixture.writes[0].answers[0].text).toBe('a'.repeat(1999));
  expect(fixture.writes[0].answers[0].text.isWellFormed()).toBe(true);
});

test('save failure and conflict retain edits and never automatically retry', async ({ page }) => {
  await setupQuestionnaire(page);
  let attempts = 0;
  await page.route('**/api/questionnaires/assignment-1/answers', route => {
    attempts++;
    return route.fulfill({ status: attempts === 1 ? 503 : 409, json: { message: 'Synthetic save failure' } });
  });
  await page.goto('/student/questionnaires/assignment-1');
  await page.getByLabel('Answer 1', { exact: true }).fill('Keep this local edit');
  await expect(page.getByRole('alert')).toContainText('not saved');
  await page.waitForTimeout(1200);
  expect(attempts).toBe(1);
  await page.getByRole('button', { name: 'Save now', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('another session');
  await expect(page.getByLabel('Answer 1', { exact: true })).toHaveValue('Keep this local edit');
  await page.getByLabel('Answer 2', { exact: true }).fill('Still local');
  await page.waitForTimeout(1200);
  expect(attempts).toBe(2);
  await expect(page.getByRole('button', { name: 'Reload saved answers' })).toBeVisible();
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: 'Reload saved answers' }).click();
  await expect(page.getByLabel('Answer 1', { exact: true })).toHaveValue('');
  await expect(page.getByRole('alert')).toHaveCount(0);
});

test('serial saves preserve newer edits, focus refetch and same-session token renewal', async ({ page }) => {
  const fixture = await setupQuestionnaire(page);
  let started = 0;
  let release!: () => void;
  const held = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/api/questionnaires/assignment-1/answers', async route => {
    started++;
    if (started === 1) await held;
    await route.fallback();
  });
  await page.goto('/student/questionnaires/assignment-1');
  const answer = page.getByLabel('Answer 1', { exact: true });
  await answer.fill('First snapshot');
  await page.getByRole('button', { name: 'Save now', exact: true }).click();
  await expect.poll(() => started).toBe(1);
  await answer.fill('Newer local edit');
  await page.evaluate(token => {
    localStorage.setItem('accessToken', token);
    window.dispatchEvent(new Event('talentbridge:auth-token-changed'));
    window.dispatchEvent(new Event('visibilitychange'));
  }, sessionToken(student.email, 1, Math.floor(Date.now() / 1000) + 7200));
  await expect(answer).toHaveValue('Newer local edit');
  await page.waitForTimeout(1200);
  expect(started).toBe(1);
  release();
  await expect.poll(() => fixture.writes.length).toBe(2);
  expect(fixture.writes.map(write => write.expectedRevision)).toEqual([7, 8]);
  expect(fixture.writes[0].answers[0].text).toBe('First snapshot');
  expect(fixture.writes[1].answers[0].text).toBe('Newer local edit');
  await expect(answer).toHaveValue('Newer local edit');
});

test('validation failures keep text and explain how to edit before manual retry', async ({ page }) => {
  await setupQuestionnaire(page);
  let attempts = 0;
  await page.route('**/api/questionnaires/assignment-1/answers', route => {
    attempts++;
    return route.fulfill({ status: 400, json: { message: 'Invalid answer text' } });
  });
  await page.goto('/student/questionnaires/assignment-1');
  await page.getByLabel('Answer 1', { exact: true }).fill('Keep unsupported text for editing');
  await expect(page.getByRole('alert')).toContainText('unsupported control characters');
  await expect(page.getByLabel('Answer 1', { exact: true })).toHaveValue('Keep unsupported text for editing');
  await page.waitForTimeout(1200);
  expect(attempts).toBe(1);
});

for (const navigation of ['all questionnaires', 'sidebar', 'history']) {
  test(`a failed-save draft survives ${navigation} navigation within its owner session`, async ({ page }) => {
    await setupQuestionnaire(page);
    let attempts = 0;
    await page.route('**/api/questionnaires/assignment-1/answers', route => {
      attempts++;
      return route.fulfill({ status: 503, json: { message: 'Synthetic outage' } });
    });
    await page.goto('/student/questionnaires/assignment-1');
    await page.getByLabel('Answer 1', { exact: true }).fill('Private local answer must survive navigation');
    await expect(page.getByRole('alert')).toContainText('not saved');
    if (navigation === 'sidebar') await page.getByRole('link', { name: 'Questionnaires', exact: true }).click();
    else await page.getByRole('link', { name: 'All questionnaires', exact: true }).click();
    if (navigation === 'history') {
      await page.clock.install();
      await page.clock.runFor(301_000);
      await page.goBack();
    }
    else await page.getByRole('link', { name: 'Student support platform', exact: true }).click();
    await expect(page.getByLabel('Answer 1', { exact: true })).toHaveValue('Private local answer must survive navigation');
    await expect(page.getByRole('alert')).toContainText('not saved');
    await page.waitForTimeout(1200);
    expect(attempts).toBe(1);
    expect(await page.evaluate(() => Object.values(localStorage).some(value => value.includes('Private local answer must survive navigation')))).toBe(false);
  });
}

test('returning during an uncertain save retains the draft and requires deliberate recovery', async ({ page }) => {
  await setupQuestionnaire(page);
  let attempts = 0;
  let release!: () => void;
  const held = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/api/questionnaires/assignment-1/answers', async route => {
    attempts++;
    await held;
    await route.fulfill({ json: assignment({ revision: 8 }) });
  });
  await page.goto('/student/questionnaires/assignment-1');
  await page.getByLabel('Answer 1', { exact: true }).fill('Keep the uncertain local answer');
  await expect.poll(() => attempts).toBe(1);
  await page.getByRole('link', { name: 'All questionnaires', exact: true }).click();
  await page.getByRole('link', { name: 'Student support platform', exact: true }).click();
  await expect(page.getByLabel('Answer 1', { exact: true })).toHaveValue('Keep the uncertain local answer');
  await expect(page.getByRole('alert')).toContainText('may have completed');
  await expect(page.getByRole('button', { name: 'Reload saved answers' })).toBeVisible();
  release();
  await page.waitForTimeout(1200);
  expect(attempts).toBe(1);
});

test('401 refresh does not replay an answer write or discard its draft', async ({ page }) => {
  await setupQuestionnaire(page);
  let writes = 0;
  await page.route('**/api/auth/refresh', route => route.fulfill({ json: {
    accessToken: sessionToken(student.email, 1, Math.floor(Date.now() / 1000) + 7200), refreshToken: 'synthetic-renewed', user: student,
  } }));
  await page.route('**/api/questionnaires/assignment-1/answers', route => {
    writes++;
    return route.fulfill({ status: 401, json: { message: 'Renew session' } });
  });
  await page.goto('/student/questionnaires/assignment-1');
  await page.getByLabel('Answer 1', { exact: true }).fill('Do not replay this write');
  await expect(page.getByRole('alert')).toContainText('not saved');
  await expect(page.getByLabel('Answer 1', { exact: true })).toHaveValue('Do not replay this write');
  await page.waitForTimeout(1200);
  expect(writes).toBe(1);
});

test('logout before debounce cancels the pending owner write', async ({ page }) => {
  const fixture = await setupQuestionnaire(page);
  await page.goto('/student/questionnaires/assignment-1');
  await page.getByLabel('Answer 1', { exact: true }).fill('Must not leave the old account');
  await page.evaluate(() => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    window.dispatchEvent(new Event('talentbridge:auth-token-changed'));
  });
  await expect(page).toHaveURL(/\/login/);
  await page.waitForTimeout(1200);
  expect(fixture.writes).toHaveLength(0);
});

test('account replacement ignores an in-flight save and never writes old answers with the new token', async ({ page }) => {
  await setupQuestionnaire(page);
  let started = 0;
  const sentTokens: string[] = [];
  let release!: () => void;
  const held = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/api/questionnaires/assignment-1/answers', async route => {
    started++;
    sentTokens.push(route.request().headers().authorization);
    await held;
    await route.fulfill({ json: assignment({ revision: 8 }) });
  });
  await page.goto('/student/questionnaires/assignment-1');
  await page.getByLabel('Answer 1', { exact: true }).fill('Old account private draft');
  await expect.poll(() => started).toBe(1);
  await page.route('**/api/users/me', route => route.fulfill({ json: { ...student, id: 'other-id', email: 'other@example.test' } }));
  await page.route('**/api/questionnaires/assignment-1', route => route.fulfill({ status: 404, json: { message: 'Not owned' } }));
  const replacement = sessionToken('other@example.test');
  await page.evaluate(token => {
    const oldValue = localStorage.getItem('accessToken');
    localStorage.setItem('accessToken', token);
    window.dispatchEvent(new StorageEvent('storage', { key: 'accessToken', oldValue, newValue: token }));
  }, replacement);
  await expect(page.getByRole('alert')).toContainText("Couldn't load questionnaire");
  release();
  await page.waitForTimeout(1200);
  expect(started).toBe(1);
  expect(sentTokens.every(token => token !== `Bearer ${replacement}`)).toBe(true);
  await expect(page.getByRole('textbox')).toHaveCount(0);
  await page.route('**/api/users/me', route => route.fulfill({ json: student }));
  await page.route('**/api/questionnaires/assignment-1', route => route.fulfill({ json: assignment() }));
  await page.evaluate(token => {
    const oldValue = localStorage.getItem('accessToken');
    localStorage.setItem('accessToken', token);
    window.dispatchEvent(new StorageEvent('storage', { key: 'accessToken', oldValue, newValue: token }));
  }, sessionToken());
  await expect(page.getByLabel('Answer 1', { exact: true })).toHaveValue('');
  expect(started).toBe(1);
});

test('server-calibrated exact expiry shows only saved answers without advancing JWT time', async ({ page }) => {
  const serverNow = Date.parse('2020-01-01T00:00:00Z');
  await setupQuestionnaire(page, assignment({ serverNow: new Date(serverNow).toISOString(), opensAt: new Date(serverNow - 48 * 3600_000 + 3500).toISOString(), closesAt: new Date(serverNow + 3500).toISOString() }));
  await page.route('**/api/questionnaires/assignment-1', route => route.fulfill({ json: assignment({ serverNow: new Date(serverNow).toISOString(), opensAt: new Date(serverNow - 48 * 3600_000 + 3500).toISOString(), closesAt: new Date(serverNow + 3500).toISOString() }) }));
  await page.route('**/api/questionnaires/assignment-1/answers', route => route.fulfill({ status: 503, json: { message: 'Test outage' } }));
  await page.goto('/student/questionnaires/assignment-1');
  await page.getByLabel('Answer 1', { exact: true }).fill('Unsaved answer must not count');
  await expect(page.getByText('Answer window closed', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Answer 1', { exact: true })).toHaveValue('');
  await expect(page.getByLabel('Answer 1', { exact: true })).toHaveAttribute('readonly');
  await expect(page.getByRole('status').filter({ hasText: 'Unsaved edits were not accepted' })).toBeVisible();
  await expect(page).toHaveURL(/assignment-1/);
});

test('a complete saved set remains editable for the full window', async ({ page }) => {
  const initial = assignment();
  initial.questions.forEach(q => { q.answer = 'A complete answer'; });
  await setupQuestionnaire(page, { ...initial, answeredCount: 5, answerState: 'COMPLETE' });
  await page.goto('/student/questionnaires/assignment-1');
  await expect(page.getByText('5/5 saved answers.', { exact: false })).toBeVisible();
  for (let i = 1; i <= 5; i++) await expect(page.getByLabel(`Answer ${i}`, { exact: true })).toBeEditable();
  await expect(page.getByRole('button', { name: /submit/i })).toHaveCount(0);
});

for (const width of [360, 390, 1440]) for (const theme of ['light', 'dark']) {
  test(`questionnaire layout ${width}px ${theme} is readable, labelled and overflow-free`, async ({ page }, testInfo) => {
    const initial = assignment({ projectTitle: 'A student-led support platform with a long frozen project title for mobile review' });
    initial.questions[0].sourceReferences[0].path = 'src/' + 'a-very-long-reference-directory/'.repeat(6) + 'service.ts';
    await setupQuestionnaire(page, initial);
    await page.addInitScript(value => localStorage.setItem('talentbridge-theme', value), theme);
    await page.setViewportSize({ width, height: 900 });
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('/student/questionnaires/assignment-1');
    await expect(page.getByLabel('Answer 1', { exact: true })).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect((await page.getByRole('button', { name: 'Save now', exact: true }).boundingBox())!.height).toBeGreaterThanOrEqual(44);
    await page.getByLabel('Answer 1', { exact: true }).focus();
    await page.keyboard.press('Tab');
    await expect(page.getByLabel('Answer 2', { exact: true })).toBeFocused();
    await page.screenshot({ path: testInfo.outputPath(`questionnaire-fields-${width}-${theme}.png`), fullPage: true });
    await page.locator('main').evaluate(main => { main.scrollTop = 0; });
    await page.screenshot({ path: testInfo.outputPath(`questionnaire-${width}-${theme}.png`), fullPage: true });
    expect(errors).toEqual([]);
  });
}

for (const width of [360, 390]) for (const theme of ['light', 'dark']) {
  test(`unbroken frozen title ${width}px ${theme} fits detail and list scrollers`, async ({ page }, testInfo) => {
    const title = 'W'.repeat(100);
    await setupQuestionnaire(page, assignment({ projectTitle: title }));
    await page.addInitScript(value => localStorage.setItem('talentbridge-theme', value), theme);
    await page.setViewportSize({ width, height: 900 });
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('/student/questionnaires/assignment-1');
    await expect(page.getByRole('heading', { name: title, exact: true })).toHaveText(title);
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
    const detail = await page.locator('main').evaluate(main => ({ scroll: main.scrollWidth, client: main.clientWidth }));
    expect.soft(detail.scroll, 'Detail main must not scroll horizontally').toBeLessThanOrEqual(detail.client);
    expect.soft(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`unbroken-detail-${width}-${theme}.png`), fullPage: true });
    await page.getByRole('link', { name: 'All questionnaires', exact: true }).click();
    await expect(page.getByRole('link', { name: title, exact: true })).toHaveText(title);
    const list = await page.locator('main').evaluate(main => ({ scroll: main.scrollWidth, client: main.clientWidth }));
    expect.soft(list.scroll, 'List main must not scroll horizontally').toBeLessThanOrEqual(list.client);
    expect.soft(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`unbroken-list-${width}-${theme}.png`), fullPage: true });
    expect(errors).toEqual([]);
  });
}
