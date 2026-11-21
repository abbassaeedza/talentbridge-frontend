import { expect, test } from '@playwright/test';
import { coordinatorSubmission, privateReview, runView, setupEvaluations, sharedReport } from './helpers/evaluations';
import { assignment, sessionToken, setupQuestionnaire } from './helpers/questionnaires';

test('scorecard 503 is an explicit error with retry, never a fake absence or zero', async ({ page }) => {
  await setupQuestionnaire(page);
  let failed = true;
  await page.route('**/api/users/my/scorecard', route => failed
    ? route.fulfill({ status: 503, json: { message: 'Temporarily unavailable' } })
    : route.fulfill({ json: { entries: [], averageScore: 0, totalProjects: 0 } }));
  await page.goto('/student/scorecard');
  await expect(page.getByRole('alert')).toContainText("Couldn't load");
  await expect(page.getByText('No evaluations yet', { exact: true })).toBeHidden();
  await expect(page.getByText('Average Score', { exact: true })).toBeHidden();
  failed = false;
  await page.getByRole('button', { name: 'Retry scorecard', exact: true }).click();
  await expect(page.getByText('No evaluations yet', { exact: true })).toBeVisible();
});

test('persisted frozen submission discovery survives unassignment and exposes outages', async ({ page }) => {
  await setupEvaluations(page);
  let failed = true;
  let parties = 0;
  await page.route('**/api/parties/all', route => { parties++; return route.fulfill({ json: [] }); });
  await page.route('**/api/submissions', route => failed
    ? route.fulfill({ status: 503, json: { message: 'Temporarily unavailable' } })
    : route.fulfill({ json: [coordinatorSubmission()] }));
  await page.goto('/coordinator/evaluations');
  await expect(page.getByRole('alert')).toContainText("Couldn't load");
  await expect(page.getByText('No submissions to evaluate')).toBeHidden();
  failed = false;
  await page.getByRole('button', { name: 'Retry submissions', exact: true }).click();
  await expect(page.getByText('Frozen project', { exact: true })).toBeVisible();
  expect(parties).toBe(0);
});

test('202 evaluation displays real steps, polls to review and reload never triggers a write', async ({ page }) => {
  const state = await setupEvaluations(page);
  await page.goto('/coordinator/evaluations');
  await page.getByRole('button', { name: 'Evaluate', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Grading run' })).toContainText('RUNNING');
  await expect(page.getByText('AI Detection', { exact: true })).toBeHidden();
  await expect.poll(() => state.reads).toBeGreaterThan(0);
  await page.reload();
  await expect(page.getByRole('region', { name: 'Grading run' })).toContainText('RUNNING');
  expect(state.triggers).toBe(1);
  state.run = runView({ status: 'REVIEW', reportId: 'report-1', steps: state.run.steps.map(s => ({ ...s, status: 'SUCCEEDED' })) });
  await expect(page.getByText('Combined team score /100')).toBeVisible();
  await expect(page.getByText('81.0', { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Private questionnaire review' })).toBeVisible();
});

test('RUNNING with quota DEFERRED shows reset and stops polling without mutating retry', async ({ page }) => {
  const state = await setupEvaluations(page, coordinatorSubmission({ runId: 'run-1', runStatus: 'RUNNING' }));
  state.run = runView({ steps: [{ ...runView().steps[0], status: 'SUCCEEDED' }, { ...runView().steps[1], status: 'DEFERRED', nextAttemptAt: '2026-11-21T19:00:00Z', errorCode: 'ASSESSMENT_DAILY_LIMIT' }] });
  await page.goto('/coordinator/evaluations');
  await expect(page.getByRole('region', { name: 'Grading run' })).toContainText('DEFERRED');
  await expect(page.getByRole('region', { name: 'Grading run' })).toContainText('Next eligible');
  await page.clock.install();
  const reads = state.reads;
  await page.clock.fastForward(60_000);
  expect(state.reads).toBe(reads);
  expect(state.retries).toBe(0);
  expect(state.triggers).toBe(0);
});

test('actual run polling pauses while hidden and stops permanently on terminal review', async ({ page }) => {
  const state = await setupEvaluations(page, coordinatorSubmission({ runId: 'run-1', runStatus: 'RUNNING' }));
  await page.goto('/coordinator/evaluations');
  await expect(page.getByRole('region', { name: 'Grading run' })).toContainText('RUNNING');
  await page.clock.install();
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  const hiddenReads = state.reads;
  await page.clock.fastForward(60_000);
  expect(state.reads).toBe(hiddenReads);
  state.run = runView({ status: 'REVIEW', reportId: 'report-1' });
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect(page.getByRole('region', { name: 'Grading run' })).toContainText('REVIEW');
  const terminalReads = state.reads;
  await page.clock.fastForward(60_000);
  expect(state.reads).toBe(terminalReads);
  expect(state.triggers).toBe(0);
  expect(state.retries).toBe(0);
});

test('unsaved and failed corrections prevent finalization and cancel restores the saved mark', async ({ page }) => {
  const state = await setupEvaluations(page, coordinatorSubmission({ status: 'EVALUATED', runId: 'run-1', runStatus: 'REVIEW', reportId: 'report-1', questionnaireState: 'REVIEW' }));
  state.run = runView({ status: 'REVIEW', reportId: 'report-1' });
  await page.goto('/coordinator/evaluations');
  await page.getByRole('button', { name: 'View review', exact: true }).click();
  const mark = page.getByRole('textbox', { name: 'Mark for Frozen Student question 1', exact: true });
  const reason = page.getByRole('textbox', { name: 'Reason for Frozen Student question 1', exact: true });
  const finalize = page.getByRole('button', { name: 'Finalize Report', exact: true });
  await expect(finalize).toBeEnabled();
  await mark.fill('20');
  await reason.fill('اردو evidence-based correction 😀');
  await expect(finalize).toBeDisabled();
  await page.getByRole('button', { name: 'Save correction for Frozen Student question 1', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Correction could not be saved');
  await expect(mark).toHaveValue('20');
  await expect(reason).toHaveValue('اردو evidence-based correction 😀');
  await expect(finalize).toBeDisabled();
  expect(state.marks).toEqual([{ mark: 20, reason: 'اردو evidence-based correction 😀' }]);
  expect(state.finalizes).toBe(0);
  await page.getByRole('button', { name: 'Cancel correction for Frozen Student question 1', exact: true }).click();
  await expect(mark).toHaveValue('16');
  await expect(reason).toHaveValue('');
  await expect(finalize).toBeEnabled();
});

test('blank fractional and out-of-range marks and blank reasons never become writes', async ({ page }) => {
  const state = await setupEvaluations(page, coordinatorSubmission({ status: 'EVALUATED', reportId: 'report-1', questionnaireState: 'REVIEW' }));
  await page.goto('/coordinator/evaluations');
  await page.getByRole('button', { name: 'View review', exact: true }).click();
  const mark = page.getByRole('textbox', { name: 'Mark for Frozen Student question 1', exact: true });
  const reason = page.getByRole('textbox', { name: 'Reason for Frozen Student question 1', exact: true });
  const save = page.getByRole('button', { name: 'Save correction for Frozen Student question 1', exact: true });
  await reason.fill('A real reason');
  for (const value of ['', '-1', '20.5', '21', 'abc']) {
    await mark.fill(value);
    await expect(save).toBeDisabled();
  }
  await mark.fill('0');
  await reason.fill('   ');
  await expect(save).toBeDisabled();
  await reason.fill('Deliberate policy-independent correction');
  await expect(save).toBeEnabled();
  expect(state.marks).toEqual([]);
  await expect(page.getByRole('button', { name: 'Finalize Report', exact: true })).toBeDisabled();
});

test('a reason-only draft on any question blocks finalization until every correction is saved or canceled', async ({ page }) => {
  const state = await setupEvaluations(page, coordinatorSubmission({ status: 'EVALUATED', reportId: 'report-1', questionnaireState: 'REVIEW' }));
  await page.goto('/coordinator/evaluations');
  await page.getByRole('button', { name: 'View review', exact: true }).click();
  const finalize = page.getByRole('button', { name: 'Finalize Report', exact: true });
  await expect(finalize).toBeEnabled();
  await page.getByRole('textbox', { name: 'Reason for Frozen Student question 1', exact: true }).fill('First reason-only correction');
  await page.getByRole('textbox', { name: 'Mark for Frozen Student question 2', exact: true }).fill('19');
  await expect(finalize).toBeDisabled();
  await page.getByRole('button', { name: 'Cancel correction for Frozen Student question 1', exact: true }).click();
  await expect(finalize).toBeDisabled();
  await page.getByRole('button', { name: 'Cancel correction for Frozen Student question 2', exact: true }).click();
  await expect(finalize).toBeEnabled();
  expect(state.finalizes).toBe(0);
  expect(state.marks).toEqual([]);
});

test('pending corrections lock editing and finalization, then show AI/effective/audit separately', async ({ page }) => {
  const state = await setupEvaluations(page, coordinatorSubmission({ status: 'EVALUATED', reportId: 'report-1', questionnaireState: 'REVIEW' }));
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/api/evaluations/submission/submission-1/questions/question-1/mark', async route => {
    expect(route.request().method()).toBe('PUT');
    expect(route.request().postDataJSON()).toEqual({ mark: 20, reason: 'Reviewed evidence' });
    await gate;
    const q = state.review.members[0].questions[0];
    q.effectiveScore = 20;
    q.adjustments = [{ questionId: q.id, actorId: 'coordinator-1', previousScore: 16, adjustedScore: 20, reason: 'Reviewed evidence', adjustedAt: '2026-11-21T12:01:00Z' }];
    state.review.members[0].effectiveScore = 76;
    state.report.questionnaireScore = 76;
    state.report.totalScore = 82;
    return route.fulfill({ json: state.review });
  });
  await page.goto('/coordinator/evaluations');
  await page.getByRole('button', { name: 'View review', exact: true }).click();
  const mark = page.getByRole('textbox', { name: 'Mark for Frozen Student question 1', exact: true });
  await mark.fill('20');
  await page.getByRole('textbox', { name: 'Reason for Frozen Student question 1', exact: true }).fill('Reviewed evidence');
  await page.getByRole('button', { name: 'Save correction for Frozen Student question 1', exact: true }).click();
  await expect(mark).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Finalize Report', exact: true })).toBeDisabled();
  release();
  await expect(page.getByText('Reviewed evidence', { exact: true })).toBeVisible();
  await expect(page.getByText('Adjusted by coordinator-1', { exact: false })).toBeVisible();
  await expect(page.getByText('AI mark: 16.0/20', { exact: true })).toBeVisible();
  await expect(page.getByText('Effective mark: 20.0/20', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Finalize Report', exact: true })).toBeEnabled();
});

test('finalization requires confirmation and locks corrections until the immutable response', async ({ page }) => {
  const state = await setupEvaluations(page, coordinatorSubmission({ status: 'EVALUATED', reportId: 'report-1', questionnaireState: 'REVIEW' }));
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/api/evaluations/report-1/finalize', async route => {
    expect(route.request().postData()).toBeNull();
    state.finalizes++;
    await gate;
    state.report.finalized = true;
    state.review.state = 'FINALIZED';
    return route.fulfill({ json: state.report });
  });
  await page.goto('/coordinator/evaluations');
  await page.getByRole('button', { name: 'View review', exact: true }).click();
  page.once('dialog', dialog => dialog.dismiss());
  await page.getByRole('button', { name: 'Finalize Report', exact: true }).click();
  expect(state.finalizes).toBe(0);
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: 'Finalize Report', exact: true }).click();
  const mark = page.getByRole('textbox', { name: 'Mark for Frozen Student question 1', exact: true });
  await expect(mark).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Reevaluate', exact: true })).toBeDisabled();
  release();
  await expect(page.getByText('Report finalized', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Finalize Report', exact: true })).toBeHidden();
  await expect(page.getByRole('button', { name: 'Reevaluate', exact: true })).toBeHidden();
  await expect(page.getByRole('button', { name: 'Save correction for Frozen Student question 1', exact: true })).toBeHidden();
});

test('technical pending is not zero, incomplete is policy zero and neither is adjustable', async ({ page }) => {
  const state = await setupEvaluations(page);
  const graded = privateReview().members[0];
  state.review = privateReview({ state: 'GRADING', members: [
    { ...graded, gradeState: 'PENDING', aiScore: null, effectiveScore: null, questions: graded.questions.map(q => ({ ...q, aiScore: null, effectiveScore: null })) },
    { ...graded, assignmentId: 'assignment-2', studentId: 'student-2', studentName: 'Incomplete Student', gradeState: 'INCOMPLETE', aiScore: null, effectiveScore: 0, questions: graded.questions.map(q => ({ ...q, id: `incomplete-${q.id}`, answer: '', aiScore: null, effectiveScore: null, feedback: null })) },
  ] });
  await page.goto('/coordinator/evaluations');
  await page.getByRole('button', { name: 'View review', exact: true }).click();
  await expect(page.getByText('Grading pending - no mark yet', { exact: true })).toBeVisible();
  await expect(page.getByText('Incomplete saved set - policy zero (0.0/100)', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: /Save correction/ })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Finalize Report', exact: true })).toBeHidden();
});

test('publication and exact 48-hour window gate prevent private reads and early triggers', async ({ page }) => {
  const state = await setupEvaluations(page, coordinatorSubmission({ questionnaireState: 'OPEN', closesAt: '2026-11-21T12:00:01Z' }));
  let privateReads = 0;
  await page.route('**/api/evaluations/submission/submission-1/questionnaire', route => {
    privateReads++;
    return route.fulfill({ json: state.review });
  });
  await page.clock.install();
  await page.clock.pauseAt(new Date(Date.now() + 1000));
  const discovery = page.waitForResponse(response => new URL(response.url()).pathname === '/api/submissions');
  await page.goto('/coordinator/evaluations');
  await (await discovery).finished();
  // Flush Query's zero-delay notification without advancing the calibrated answer window.
  await page.clock.runFor(0);
  await page.getByRole('button', { name: 'View review', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Evaluate', exact: true })).toBeDisabled();
  await expect(page.getByText('Locked private answer 1')).toBeHidden();
  expect(privateReads).toBe(0);
  await page.clock.fastForward(999);
  await expect(page.getByRole('button', { name: 'Evaluate', exact: true })).toBeDisabled();
  await page.clock.fastForward(1);
  await expect(page.getByText('Answer window closed. Locked saved answers can be reviewed.', { exact: true })).toBeVisible();
  await expect.poll(() => privateReads).toBe(1);
  // Expiry is exact; let the asynchronous read notification finish before checking its idle controls.
  await page.clock.resume();
  await expect(page.getByRole('button', { name: 'Evaluate', exact: true })).toBeEnabled();
  expect(state.triggers).toBe(0);
});

for (const [repositoryScore, questionnaireScore, totalScore] of [[84, 72, 81], [84, 0, 63], [80, 60, 75]]) {
  test(`finalized owner report uses backend ${repositoryScore}/${questionnaireScore}=${totalScore} and exactly six weights after party removal`, async ({ page }) => {
    const report = sharedReport({ repositoryScore, questionnaireScore, totalScore, finalized: true });
    await setupQuestionnaire(page, assignment({ state: 'FINALIZED', answerState: 'LOCKED_COMPLETE', editable: false }));
    await page.route('**/api/questionnaires/assignment-1/report', route => route.fulfill({ json: report }));
    await page.goto('/student/questionnaires/assignment-1');
    await expect(page.getByText('Repository score /100')).toBeVisible();
    await expect(page.getByText('Team questionnaire score /100')).toBeVisible();
    await expect(page.getByText('Combined team score /100')).toBeVisible();
    const panel = page.locator('.evaluation-report-panel');
    await expect(panel.getByText(totalScore.toFixed(1), { exact: true })).toBeVisible();
    await expect(panel.getByText('15%', { exact: true })).toHaveCount(2);
    await expect(panel.getByText('18.75%', { exact: true })).toHaveCount(2);
    await expect(panel.getByText('7.5%', { exact: true })).toHaveCount(1);
    await expect(panel.getByText('25%', { exact: true })).toHaveCount(1);
    await expect(panel).toContainText('not proof of AI authorship or misconduct');
    await expect(panel).toContainText('not proven effort');
    await expect(panel).not.toContainText('Hidden rubric');
    await expect(panel).not.toContainText('Locked private answer');
  });
}

test('a failed run recovers only on an explicit retry and preserves successful steps', async ({ page }) => {
  const state = await setupEvaluations(page, coordinatorSubmission({ runId: 'run-1', runStatus: 'FAILED', questionnaireState: 'FAILED' }));
  state.run = runView({ status: 'FAILED', steps: [
    { ...runView().steps[0], status: 'SUCCEEDED', leaseUntil: null },
    { ...runView().steps[1], status: 'FAILED', attempts: 3, errorCode: 'RELAY_FAILURE' },
  ] });
  await page.goto('/coordinator/evaluations');
  await expect(page.getByRole('region', { name: 'Grading run' })).toContainText('SUCCEEDED');
  await expect(page.getByRole('region', { name: 'Grading run' })).toContainText('RELAY_FAILURE');
  expect(state.retries).toBe(0);
  state.run = runView({ steps: [{ ...runView().steps[0], status: 'SUCCEEDED', leaseUntil: null }, { ...runView().steps[1], status: 'DISPATCHED' }] });
  await page.getByRole('button', { name: 'Retry grading', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Grading run' })).toContainText('DISPATCHED');
  expect(state.retries).toBe(1);
  expect(state.triggers).toBe(0);
});

test('unpublished generation review contains counts and recovery, not private question content or an invented deadline', async ({ page }) => {
  const state = await setupEvaluations(page, coordinatorSubmission({ questionnaireState: 'FAILED', opensAt: null, closesAt: null }));
  let privateReads = 0;
  await page.route('**/api/evaluations/submission/submission-1/questionnaire', route => { privateReads++; return route.fulfill({ json: state.review }); });
  await page.goto('/coordinator/evaluations');
  await page.getByRole('button', { name: 'View review', exact: true }).click();
  await expect(page.getByText('Your 48-hour answer window has not started.', { exact: true })).toBeVisible();
  await expect(page.getByText('0/5 questions ready', { exact: false })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Recover generation', exact: true })).toBeEnabled();
  await expect(page.getByRole('button', { name: 'Evaluate', exact: true })).toBeDisabled();
  await expect(page.getByText('Private question 1', { exact: false })).toBeHidden();
  expect(privateReads).toBe(0);
});

test('reevaluation accepts a new 202 run and hides old draft totals while that run is unfinished', async ({ page }) => {
  const state = await setupEvaluations(page, coordinatorSubmission({ status: 'EVALUATED', reportId: 'report-1', questionnaireState: 'REVIEW' }));
  let requests = 0;
  await page.route('**/api/evaluations/report-1/reevaluate', route => {
    expect(route.request().postData()).toBeNull();
    requests++;
    state.submission = { ...state.submission, runId: 'run-2', runStatus: 'RUNNING' };
    return route.fulfill({ status: 202, json: runView({ id: 'run-2' }) });
  });
  await page.route('**/api/evaluations/runs/run-2', route => route.fulfill({ json: runView({ id: 'run-2' }) }));
  await page.goto('/coordinator/evaluations');
  await page.getByRole('button', { name: 'View review', exact: true }).click();
  await expect(page.getByText('Combined team score /100')).toBeVisible();
  await page.getByRole('button', { name: 'Reevaluate', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Grading run' })).toContainText('RUNNING');
  await expect(page.getByText('Combined team score /100')).toBeHidden();
  await expect(page.getByRole('button', { name: 'Finalize Report', exact: true })).toBeHidden();
  expect(requests).toBe(1);
});

test('owner report 404 means not finalized, while 503 is a retryable error without fake grades', async ({ page }) => {
  await setupQuestionnaire(page, assignment({ state: 'REVIEW', answerState: 'LOCKED_COMPLETE', editable: false }));
  let status = 404;
  await page.route('**/api/questionnaires/assignment-1/report', route => route.fulfill({ status, json: { message: 'Not available' } }));
  await page.goto('/student/questionnaires/assignment-1');
  await expect(page.getByText('Your report is not available until coordinator finalization.', { exact: false })).toBeVisible();
  await expect(page.locator('.evaluation-report-panel')).toBeHidden();
  status = 503;
  await page.getByRole('button', { name: 'Check finalized report', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Finalized report', exact: true }).getByRole('alert')).toContainText("Couldn't refresh");
  await expect(page.locator('.evaluation-report-panel')).toBeHidden();
});

test('a mark 401 renews the same session without replaying its PUT or discarding the correction', async ({ page }) => {
  const state = await setupEvaluations(page, coordinatorSubmission({ status: 'EVALUATED', reportId: 'report-1', questionnaireState: 'REVIEW' }));
  let writes = 0;
  await page.route('**/api/evaluations/submission/submission-1/questions/question-1/mark', route => {
    writes++;
    return route.fulfill({ status: 401, json: { message: 'Expired' } });
  });
  await page.route('**/api/auth/refresh', route => route.fulfill({ json: {
    accessToken: sessionToken('coordinator@example.test', 1, Math.floor(Date.now() / 1000) + 7200),
    refreshToken: 'synthetic-renewed', tokenType: 'Bearer',
  } }));
  await page.goto('/coordinator/evaluations');
  await page.getByRole('button', { name: 'View review', exact: true }).click();
  await page.getByRole('textbox', { name: 'Mark for Frozen Student question 1', exact: true }).fill('20');
  const reason = page.getByRole('textbox', { name: 'Reason for Frozen Student question 1', exact: true });
  await reason.fill('Keep this correction after renewal');
  await page.getByRole('button', { name: 'Save correction for Frozen Student question 1', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Session renewed. Please submit again.');
  await expect(reason).toHaveValue('Keep this correction after renewal');
  await expect(page.getByRole('button', { name: 'Finalize Report', exact: true })).toBeDisabled();
  expect(writes).toBe(1);
  expect(state.finalizes).toBe(0);
});

for (const finalized of [false, true]) {
  test(`scorecard v2 ${finalized ? 'displays finalized decimals and safe aggregate' : 'refuses unpublished draft grades including summary'}`, async ({ page }) => {
    await setupQuestionnaire(page);
    await page.route('**/api/users/my/scorecard', route => route.fulfill({ json: {
      id: 'scorecard-1', averageScore: 80.9, totalProjects: 1,
      entries: [{ id: 'entry-1', project: { id: 'project-1', title: 'W'.repeat(100) }, score: 80.9, evaluationReport: sharedReport({ finalized }) }],
    } }));
    await page.setViewportSize({ width: 360, height: 900 });
    await page.goto('/student/scorecard');
    if (finalized) {
      await expect(page.getByText('Your score: 80.9/100', { exact: true })).toBeVisible();
      await expect(page.getByText('Team project score: 81.0/100', { exact: true })).toBeVisible();
      await expect(page.getByText('Team questionnaire score /100')).toBeVisible();
      expect(await page.locator('main').evaluate(main => main.scrollWidth <= main.clientWidth)).toBe(true);
    } else {
      await expect(page.getByRole('alert')).toContainText('unpublished');
      await expect(page.getByText('Average Score', { exact: true })).toBeHidden();
      await expect(page.locator('.evaluation-report-panel')).toBeHidden();
      await expect(page.getByText('Your score: 80.9/100', { exact: true })).toBeHidden();
    }
    await expect(page.getByText('Hidden rubric', { exact: false })).toBeHidden();
  });
}

test('same-session token renewal preserves a correction; replacement cancels the old write and clears private UI', async ({ page }) => {
  const state = await setupEvaluations(page, coordinatorSubmission({ status: 'EVALUATED', reportId: 'report-1', questionnaireState: 'REVIEW' }));
  await page.goto('/coordinator/evaluations');
  await page.getByRole('button', { name: 'View review', exact: true }).click();
  const mark = page.getByRole('textbox', { name: 'Mark for Frozen Student question 1', exact: true });
  const reason = page.getByRole('textbox', { name: 'Reason for Frozen Student question 1', exact: true });
  await mark.fill('19');
  await reason.fill('Unsaved private coordinator draft');
  await page.evaluate(token => {
    const previous = localStorage.getItem('accessToken');
    localStorage.setItem('accessToken', token);
    window.dispatchEvent(new StorageEvent('storage', { key: 'accessToken', oldValue: previous, newValue: token }));
  }, sessionToken('coordinator@example.test', 1, Math.floor(Date.now() / 1000) + 7200));
  await expect(mark).toHaveValue('19');
  await expect(reason).toHaveValue('Unsaved private coordinator draft');
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  let began = false;
  await page.route('**/api/evaluations/submission/submission-1/questions/question-1/mark', async route => {
    began = true;
    await gate;
    await route.fulfill({ json: state.review });
  });
  await page.getByRole('button', { name: 'Save correction for Frozen Student question 1', exact: true }).click();
  await expect.poll(() => began).toBe(true);
  await page.route('**/api/users/me', route => route.fulfill({ json: { id: 'replacement-student', email: 'replacement@example.test', firstName: 'Other', lastName: 'Student', role: 'STUDENT', status: 'APPROVED', onboardingComplete: true } }));
  await page.evaluate(token => {
    const previous = localStorage.getItem('accessToken');
    localStorage.setItem('accessToken', token);
    window.dispatchEvent(new StorageEvent('storage', { key: 'accessToken', oldValue: previous, newValue: token }));
  }, sessionToken('replacement@example.test', 1));
  await expect(page.getByRole('heading', { name: 'Private questionnaire review' })).toBeHidden();
  release();
  await expect(reason).toBeHidden();
  expect(state.finalizes).toBe(0);
  const persisted = await page.evaluate(() => JSON.stringify({ ...localStorage, ...sessionStorage }));
  expect(persisted).not.toContain('Unsaved private coordinator draft');
  expect(persisted).not.toContain('Locked private answer');
});

for (const width of [360, 390, 1440]) for (const theme of ['light', 'dark']) {
  test(`private review and backend score fit the actual main scroller at ${width}px ${theme}`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    await page.addInitScript(theme => localStorage.setItem('talentbridge-theme', theme), theme);
    const state = await setupEvaluations(page, coordinatorSubmission({ projectTitle: 'W'.repeat(100), status: 'EVALUATED', reportId: 'report-1', questionnaireState: 'REVIEW' }));
    state.review.members[0].questions[0].answer = 'X'.repeat(2000);
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('/coordinator/evaluations');
    await page.getByRole('button', { name: 'View review', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Private questionnaire review' })).toBeVisible();
    await expect(page.getByText('W'.repeat(100), { exact: true })).toBeVisible();
    await expect(page.getByText('81.0', { exact: true })).toBeVisible();
    const layout = await page.evaluate(() => {
      const main = document.querySelector('main')!;
      return { mainWidth: main.clientWidth, mainScroll: main.scrollWidth, viewport: innerWidth, documentScroll: document.documentElement.scrollWidth };
    });
    expect(layout.mainScroll).toBeLessThanOrEqual(layout.mainWidth);
    expect(layout.documentScroll).toBeLessThanOrEqual(layout.viewport);
    const finalize = page.getByRole('button', { name: 'Finalize Report', exact: true });
    expect((await finalize.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    await page.screenshot({ path: testInfo.outputPath(`review-${width}-${theme}-top.png`), fullPage: true });
    const mark = page.getByRole('textbox', { name: 'Mark for Frozen Student question 1', exact: true });
    await mark.focus();
    await expect(mark).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(page.getByRole('textbox', { name: 'Reason for Frozen Student question 1', exact: true })).toBeFocused();
    await page.screenshot({ path: testInfo.outputPath(`review-${width}-${theme}.png`), fullPage: true });
    expect(errors).toEqual([]);
  });
}
