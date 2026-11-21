import { expect, test, type Page } from '@playwright/test';
import { coordinator, coordinatorSubmission, generationReview, privateReview, runView, setupEvaluations } from './helpers/evaluations';

async function returnToVisibleTab(page: Page) {
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
    document.dispatchEvent(new Event('visibilitychange', { bubbles: true }));
  });
  await page.clock.fastForward(31_000);
  const discovery = page.waitForResponse(response => new URL(response.url()).pathname === '/api/submissions');
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
    document.dispatchEvent(new Event('visibilitychange', { bubbles: true }));
  });
  await (await discovery).finished();
}

for (const allIncomplete of [false, true]) {
  test(`quality P2 lease: expired last RUNNING ${allIncomplete ? 'repository-only incomplete' : 'questionnaire after repository success'} step permits one explicit recovery`, async ({ page }) => {
    const state = await setupEvaluations(page, coordinatorSubmission({ status: 'UNDER_EVALUATION', questionnaireState: 'GRADING', runId: 'run-1', runStatus: 'RUNNING' }));
    const original = runView();
    const last = { ...original.steps[allIncomplete ? 0 : 1], status: 'RUNNING' as const, attempts: 1, dispatchGeneration: 1, leaseUntil: '2026-11-21T12:01:50Z' };
    const completed = { ...original.steps[0], status: 'SUCCEEDED' as const, leaseUntil: null };
    state.run = runView({ steps: allIncomplete ? [last] : [completed, last] });
    state.review = privateReview({ state: 'GRADING', members: privateReview().members.map(member => ({ ...member,
      gradeState: allIncomplete ? 'INCOMPLETE' : 'PENDING', aiScore: allIncomplete ? 0 : null, effectiveScore: allIncomplete ? 0 : null,
      questions: member.questions.map(question => ({ ...question, aiScore: null, effectiveScore: null, feedback: null })),
    })) });
    const posts: string[] = [];
    page.on('request', request => { if (request.method() === 'POST') posts.push(new URL(request.url()).pathname); });
    await page.goto('/coordinator/evaluations');
    await expect(page.getByRole('region', { name: 'Grading run' })).toContainText('RUNNING');
    const retry = page.getByRole('button', { name: 'Retry grading', exact: true });
    await expect(retry).toBeHidden();
    await page.clock.install();
    state.run.serverNow = '2026-11-21T12:01:51Z';
    await page.clock.fastForward(111_000);
    await expect(retry).toBeVisible();
    await expect(retry).toBeEnabled();
    expect(state.retries).toBe(0);
    await page.route('**/api/evaluations/runs/run-1/retry', route => {
      expect(route.request().postData()).toBeNull();
      state.retries++;
      state.run = { ...state.run, steps: state.run.steps.map(step => step.id === last.id
        ? { ...step, status: 'DISPATCHED', leaseUntil: null, dispatchGeneration: step.dispatchGeneration + 1 }
        : step) };
      return route.fulfill({ status: 202, json: state.run });
    });
    await retry.click();
    await expect(page.getByRole('region', { name: 'Grading run' })).toContainText('DISPATCHED');
    await page.clock.fastForward(6000);
    expect(state.retries).toBe(1);
    expect(posts).toEqual(['/api/evaluations/runs/run-1/retry']);
    expect(state.triggers).toBe(0);
    expect(state.run.steps.find(step => step.id === last.id)?.attempts).toBe(1);
    if (!allIncomplete) expect(state.run.steps[0]).toEqual(completed);
  });
}

test('quality P2 publication: refreshed discovery replaces cached unpublished generation without a second generation read', async ({ page }) => {
  const state = await setupEvaluations(page, coordinatorSubmission({ questionnaireState: 'GENERATING', opensAt: null, closesAt: null }));
  state.generation = generationReview({ jobs: [{ ...generationReview().jobs[0], status: 'DISPATCHED', attempts: 0, errorCode: null }] });
  let generationReads = 0;
  let privateReads = 0;
  await page.route('**/api/submissions/submission-1/questionnaire-review', route => {
    generationReads++;
    return route.fulfill({ json: state.generation });
  });
  await page.route('**/api/evaluations/submission/submission-1/questionnaire', route => {
    privateReads++;
    return route.fulfill({ json: privateReview({ state: 'READY_FOR_EVALUATION', opensAt: '2026-11-21T12:00:00Z', closesAt: '2026-11-23T12:00:00Z', serverNow: '2026-11-23T12:00:00Z',
      members: privateReview().members.map(member => ({ ...member, gradeState: 'PENDING', aiScore: null, effectiveScore: null,
        questions: member.questions.map(question => ({ ...question, aiScore: null, effectiveScore: null, feedback: null })),
      })),
    }) });
  });
  await page.goto('/coordinator/evaluations');
  await page.getByRole('button', { name: 'View review', exact: true }).click();
  await expect(page.getByText('0/5 questions ready', { exact: false })).toBeVisible();
  expect(generationReads).toBe(1);
  await page.clock.install();
  state.submission = { ...state.submission, questionnaireState: 'OPEN', opensAt: '2026-11-21T12:00:00Z', closesAt: '2026-11-23T12:00:00Z', serverNow: '2026-11-23T11:59:00Z' };
  await returnToVisibleTab(page);
  await expect(page.getByText('Your 48-hour answer window has not started.', { exact: true })).toBeHidden();
  await expect(page.getByText('Opens 21 Nov 2026, 17:00 (Asia/Karachi)', { exact: true })).toBeVisible();
  await expect(page.getByText('Closes 23 Nov 2026, 17:00 (Asia/Karachi)', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Evaluate', exact: true })).toBeDisabled();
  expect(privateReads).toBe(0);
  expect(generationReads).toBe(1);
  state.submission = { ...state.submission, serverNow: '2026-11-23T12:00:00Z' };
  await returnToVisibleTab(page);
  await expect(page.getByText('Answer window closed. Locked saved answers can be reviewed.', { exact: true })).toBeVisible();
  await expect.poll(() => privateReads).toBe(1);
  await expect(page.getByRole('button', { name: 'Evaluate', exact: true })).toBeEnabled();
  expect(generationReads).toBe(1);
  expect(state.triggers).toBe(0);
  expect(state.retries).toBe(0);
  await expect(page.getByRole('heading', { name: 'Evaluations', exact: true })).toBeVisible();
});

for (const conflict of [false, true]) {
  test(`quality P2 retained draft: coordinator B finalizes before A ${conflict ? 'receives an adjustment 409' : 'refreshes discovery'}`, async ({ page, browser }, testInfo) => {
    const initial = coordinatorSubmission({ status: 'EVALUATED', questionnaireState: 'REVIEW', runId: 'run-1', runStatus: 'REVIEW', reportId: 'report-1' });
    const state = await setupEvaluations(page, initial);
    state.run = runView({ status: 'REVIEW', reportId: 'report-1' });
    const otherContext = await browser.newContext();
    try {
      const otherPage = await otherContext.newPage();
      const other = await setupEvaluations(otherPage, initial, { ...coordinator, id: 'coordinator-2', email: 'second-coordinator@example.test', firstName: 'Second' });
      other.run = runView({ status: 'REVIEW', reportId: 'report-1' });
      let bFinalizes = 0;
      let aWrites = 0;
      await otherPage.route('**/api/evaluations/report-1/finalize', route => {
        expect(route.request().method()).toBe('PUT');
        expect(route.request().postData()).toBeNull();
        bFinalizes++;
        state.submission = { ...state.submission, finalized: true, questionnaireState: 'FINALIZED', runStatus: 'FINALIZED', serverNow: '2026-11-21T12:01:00Z' };
        state.report.finalized = true;
        state.review.state = 'FINALIZED';
        state.run = runView({ status: 'FINALIZED', reportId: 'report-1', serverNow: '2026-11-21T12:01:00Z' });
        other.submission = state.submission; other.report = state.report; other.review = state.review; other.run = state.run;
        return route.fulfill({ json: state.report });
      });
      await page.route('**/api/evaluations/submission/submission-1/questions/question-1/mark', route => {
        aWrites++;
        expect(route.request().postDataJSON()).toEqual({ mark: 20, reason: 'A retained explanation اردو 😀' });
        return route.fulfill({ status: 409, json: { message: 'Finalized assessment is immutable' } });
      });
      await page.goto('/coordinator/evaluations');
      await page.getByRole('button', { name: 'View review', exact: true }).click();
      const mark = page.getByRole('textbox', { name: 'Mark for Frozen Student question 1', exact: true });
      const reason = page.getByRole('textbox', { name: 'Reason for Frozen Student question 1', exact: true });
      await mark.fill('20');
      await reason.fill('A retained explanation اردو 😀');
      await expect(page.getByRole('button', { name: 'Finalize Report', exact: true })).toBeDisabled();
      await expect(page.getByRole('button', { name: 'Hide review', exact: true })).toBeDisabled();
      await otherPage.goto('/coordinator/evaluations');
      await otherPage.getByRole('button', { name: 'View review', exact: true }).click();
      otherPage.once('dialog', dialog => dialog.accept());
      await otherPage.getByRole('button', { name: 'Finalize Report', exact: true }).click();
      await expect(otherPage.getByText('Report finalized', { exact: true })).toBeVisible();
      expect(bFinalizes).toBe(1);
      if (conflict) {
        await page.getByRole('button', { name: 'Save correction for Frozen Student question 1', exact: true }).click();
        await expect(page.getByRole('alert')).toContainText('Finalized assessment is immutable');
      } else {
        await page.clock.install();
        await returnToVisibleTab(page);
      }
      await expect(mark).toHaveValue('20');
      await expect(reason).toHaveValue('A retained explanation اردو 😀');
      await expect(mark).toHaveAttribute('readonly', '');
      await expect(reason).toHaveAttribute('readonly', '');
      await expect(reason).toBeEnabled();
      await expect(page.getByRole('button', { name: 'Save correction for Frozen Student question 1', exact: true })).toBeHidden();
      await expect(page.getByRole('button', { name: 'Finalize Report', exact: true })).toBeHidden();
      const discard = page.getByRole('button', { name: 'Discard local correction for Frozen Student question 1', exact: true });
      if (!conflict) for (const width of [360, 390, 1440]) for (const theme of ['light', 'dark']) {
        await page.setViewportSize({ width, height: 900 });
        const switchTheme = page.getByRole('button', { name: `Switch to ${theme} mode`, exact: true });
        if (await switchTheme.isVisible()) await switchTheme.click();
        await reason.scrollIntoViewIfNeeded();
        await reason.focus();
        await page.keyboard.press('ControlOrMeta+A');
        await expect(reason).toBeFocused();
        expect(await reason.evaluate(element => ({ start: (element as HTMLTextAreaElement).selectionStart, end: (element as HTMLTextAreaElement).selectionEnd })))
          .toEqual({ start: 0, end: 'A retained explanation اردو 😀'.length });
        const widths = await page.locator('main').evaluate(main => ({ client: main.clientWidth, scroll: main.scrollWidth, document: document.documentElement.scrollWidth, viewport: innerWidth }));
        expect(widths.scroll).toBeLessThanOrEqual(widths.client);
        expect(widths.document).toBeLessThanOrEqual(widths.viewport);
        expect((await discard.boundingBox())!.height).toBeGreaterThanOrEqual(44);
        await page.screenshot({ path: testInfo.outputPath(`retained-local-${width}-${theme}.png`), fullPage: true });
      }
      await discard.click();
      await expect(page.getByRole('button', { name: 'Hide review', exact: true })).toBeEnabled();
      await expect(page.getByRole('button', { name: 'Check status', exact: true })).toBeEnabled();
      expect(aWrites).toBe(conflict ? 1 : 0);
      expect(state.finalizes).toBe(0);
      const storage = await page.evaluate(() => JSON.stringify({ ...localStorage, ...sessionStorage }));
      expect(storage).not.toContain('A retained explanation');
    } finally { await otherContext.close(); }
  });
}

for (const authoritative of ['GRADING', 'FAILED'] as const) {
  test(`quality P2 retained draft: adjustment 409 refreshes actual ${authoritative} state instead of assuming finalization`, async ({ page }, testInfo) => {
    const state = await setupEvaluations(page, coordinatorSubmission({ status: 'EVALUATED', questionnaireState: 'REVIEW', reportId: 'report-1' }));
    let writes = 0;
    await page.route('**/api/evaluations/submission/submission-1/questions/question-1/mark', route => {
      writes++;
      state.submission = { ...state.submission, status: 'UNDER_EVALUATION', questionnaireState: authoritative, runId: 'run-2', runStatus: authoritative === 'FAILED' ? 'FAILED' : 'RUNNING', serverNow: '2026-11-21T12:02:00Z' };
      state.review.state = authoritative;
      return route.fulfill({ status: 409, json: { message: 'Assessment is not in review' } });
    });
    await page.route('**/api/evaluations/runs/run-2', route => route.fulfill({ json: runView({ id: 'run-2', status: authoritative === 'FAILED' ? 'FAILED' : 'RUNNING', serverNow: '2026-11-21T12:02:00Z', steps: [
      { ...runView().steps[0], status: authoritative === 'FAILED' ? 'FAILED' : 'RUNNING', leaseUntil: authoritative === 'FAILED' ? null : '2026-11-21T12:01:50Z' }, runView().steps[1],
    ] }) }));
    await page.goto('/coordinator/evaluations');
    await page.getByRole('button', { name: 'View review', exact: true }).click();
    const mark = page.getByRole('textbox', { name: 'Mark for Frozen Student question 1', exact: true });
    const reason = page.getByRole('textbox', { name: 'Reason for Frozen Student question 1', exact: true });
    await mark.fill('19');
    await reason.fill('Keep this correction while adjustment is unavailable');
    await page.getByRole('button', { name: 'Save correction for Frozen Student question 1', exact: true }).click();
    await expect(page.getByRole('alert')).toContainText('Assessment is not in review');
    await expect(mark).toHaveValue('19');
    await expect(reason).toHaveValue('Keep this correction while adjustment is unavailable');
    await expect(reason).toHaveAttribute('readonly', '');
    await expect(reason).toBeEnabled();
    await expect(page.getByText('Report finalized', { exact: true })).toBeHidden();
    await expect(page.getByRole('region', { name: 'Grading run' })).toContainText(authoritative === 'FAILED' ? 'FAILED' : 'RUNNING');
    await expect(page.getByRole('button', { name: 'Retry grading', exact: true })).toBeDisabled();
    await reason.scrollIntoViewIfNeeded();
    await page.screenshot({ path: testInfo.outputPath(`retained-local-${authoritative}.png`), fullPage: true });
    await page.getByRole('button', { name: 'Discard local correction for Frozen Student question 1', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Check status', exact: true })).toBeEnabled();
    await expect(page.getByRole('button', { name: 'Retry grading', exact: true })).toBeEnabled();
    expect(writes).toBe(1);
    expect(state.finalizes).toBe(0);
  });
}

test('quality P2 recovery guard: future quota deferral never permits explicit retry', async ({ page }) => {
  const state = await setupEvaluations(page, coordinatorSubmission({ status: 'UNDER_EVALUATION', questionnaireState: 'GRADING', runId: 'run-1', runStatus: 'RUNNING' }));
  state.run = runView({ steps: [{ ...runView().steps[0], status: 'SUCCEEDED', leaseUntil: null }, {
    ...runView().steps[1], status: 'DEFERRED', nextAttemptAt: '2026-11-21T19:00:00Z', errorCode: 'ASSESSMENT_DAILY_LIMIT',
  }] });
  await page.goto('/coordinator/evaluations');
  await expect(page.getByRole('button', { name: 'Retry grading', exact: true })).toBeDisabled();
  await expect(page.getByRole('region', { name: 'Grading run' })).toContainText('Next eligible');
  expect(state.retries).toBe(0);
});
