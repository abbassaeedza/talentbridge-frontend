import { expect, test, type Page } from '@playwright/test';
import { setupQuestionnaire, student } from './helpers/questionnaires';

async function setupSubmission(page: Page, leader = true) {
  await setupQuestionnaire(page);
  await page.route('**/api/parties/my', route => route.fulfill({ json: {
    id: 'party-id', name: 'Team Orbit', leader: { id: leader ? student.id : 'other-leader' },
    assignedProjectId: 'project-id', assignedProjectTitle: 'Student support platform',
  } }));
  let saved = { id: 'submission-id', partyId: 'party-id', status: 'DRAFT', version: 7, assessmentVersion: 1,
    documentUrls: [] as string[], repoUrl: 'https://github.com/example/saved', repoBranch: 'main', notes: 'Saved notes' };
  const saves: FormData[] = [];
  const finals: { expectedVersion: number }[] = [];
  await page.route('**/api/submissions/party-id', route => route.fulfill({ json: saved }));
  await page.route('**/api/submissions/party-id/draft', async route => {
    const request = route.request();
    const body = await new Request('http://fixture.test', { method: 'POST', headers: request.headers(), body: request.postDataBuffer() }).formData();
    saves.push(body);
    saved = { ...saved, version: saved.version + 1,
      repoUrl: String(body.get('repoUrl') || saved.repoUrl), repoBranch: String(body.get('branch') || saved.repoBranch),
      notes: String(body.get('notes') ?? saved.notes),
      documentUrls: [...saved.documentUrls, ...body.getAll('documents').map((_, i) => `upload-${saved.version}-${i}.pdf`)],
    };
    await route.fulfill({ json: saved });
  });
  await page.route('**/api/submissions/party-id/submit', async route => {
    const request = route.request().postDataJSON();
    finals.push(request);
    expect(request).toEqual({ expectedVersion: saved.version });
    saved = { ...saved, status: 'SUBMITTED', version: saved.version + 1 };
    await route.fulfill({ json: saved });
  });
  return { saves, finals, saved: () => saved };
}

test('dirty finalization is disabled until the exact saved version returns', async ({ page }) => {
  const fixture = await setupSubmission(page);
  await page.goto('/student/submission');
  const submit = page.getByRole('button', { name: 'Final Submit', exact: true });
  await expect(submit).toBeEnabled();
  await page.getByLabel('Branch', { exact: true }).fill('release');
  await expect(submit).toBeDisabled();
  await page.getByRole('button', { name: 'Save Draft', exact: true }).click();
  await expect(submit).toBeEnabled();
  expect(fixture.saves).toHaveLength(1);
  page.once('dialog', dialog => dialog.accept());
  await submit.click();
  await expect(page.getByText('Submission received', { exact: true })).toBeVisible();
  expect(fixture.finals).toEqual([{ expectedVersion: 8 }]);
});

test('an older save cannot clear newer text or newly selected files', async ({ page }) => {
  const fixture = await setupSubmission(page);
  let started = false;
  let release!: () => void;
  const held = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/api/submissions/party-id/draft', async route => {
    started = true;
    await held;
    await route.fallback();
  });
  await page.goto('/student/submission');
  const branch = page.getByLabel('Branch', { exact: true });
  await branch.fill('release-one');
  await page.getByLabel('Supporting documents (optional)').setInputFiles({ name: 'first.pdf', mimeType: 'application/pdf', buffer: Buffer.from('synthetic first file') });
  await page.getByRole('button', { name: 'Save Draft', exact: true }).click();
  await expect.poll(() => started).toBe(true);
  await expect(page.getByRole('button', { name: 'Final Submit', exact: true })).toBeDisabled();
  await branch.fill('release-two');
  await page.getByLabel('Supporting documents (optional)').setInputFiles({ name: 'second.pdf', mimeType: 'application/pdf', buffer: Buffer.from('synthetic second file') });
  release();
  await expect.poll(() => fixture.saves.length).toBe(1);
  await expect(branch).toHaveValue('release-two');
  await expect(page.getByRole('button', { name: 'Remove second.pdf' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Final Submit', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Save Draft', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Final Submit', exact: true })).toBeEnabled();
  expect(fixture.saves).toHaveLength(2);
  expect(fixture.saved().documentUrls).toHaveLength(2);
});

test('cleared notes are sent explicitly and unsupported branch clearing never becomes clean', async ({ page }) => {
  const fixture = await setupSubmission(page);
  await page.goto('/student/submission');
  await page.getByLabel('Notes for evaluators (optional)').fill('');
  await page.getByRole('button', { name: 'Save Draft', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Final Submit', exact: true })).toBeEnabled();
  expect(fixture.saves[0].has('notes')).toBe(true);
  expect(fixture.saves[0].get('notes')).toBe('');
  await page.getByLabel('Branch', { exact: true }).fill('');
  await page.getByRole('button', { name: 'Save Draft', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('did not save every requested change');
  await expect(page.getByLabel('Branch', { exact: true })).toHaveValue('');
  await expect(page.getByRole('button', { name: 'Final Submit', exact: true })).toBeDisabled();
});

test('teammates can read the saved submission but cannot act as leader', async ({ page }) => {
  await setupSubmission(page, false);
  await page.goto('/student/submission');
  await expect(page.getByLabel('Branch', { exact: true })).toHaveValue('main');
  await expect(page.getByLabel('Branch', { exact: true })).toHaveAttribute('readonly');
  await expect(page.getByRole('button', { name: 'Save Draft', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Final Submit', exact: true })).toHaveCount(0);
});

test('saved submission loading cannot offer finalization', async ({ page }) => {
  await setupSubmission(page);
  let release!: () => void;
  const held = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/api/submissions/party-id', async route => { await held; await route.fallback(); });
  await page.goto('/student/submission');
  await expect(page.getByRole('status').filter({ hasText: 'Loading saved submission' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Final Submit', exact: true })).toHaveCount(0);
  release();
  await expect(page.getByRole('button', { name: 'Final Submit', exact: true })).toBeEnabled();
});

test('stale expectedVersion conflict preserves the draft for deliberate recovery', async ({ page }) => {
  const fixture = await setupSubmission(page);
  await page.route('**/api/submissions/party-id/submit', route => route.fulfill({ status: 409, json: { message: 'Saved draft changed. Reload before submitting.' } }));
  await page.goto('/student/submission');
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: 'Final Submit', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Saved draft changed');
  await expect(page.getByLabel('GitHub repository URL')).toHaveValue('https://github.com/example/saved');
  expect(fixture.finals).toHaveLength(0);
});

test('a final request disables further finalization and draft saving until it finishes', async ({ page }) => {
  await setupSubmission(page);
  let requests = 0;
  let release!: () => void;
  const held = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/api/submissions/party-id/submit', async route => { requests++; await held; await route.fallback(); });
  await page.goto('/student/submission');
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: 'Final Submit', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Submitting...', exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Save Draft', exact: true })).toBeDisabled();
  await expect(page.getByLabel('Branch', { exact: true })).toHaveAttribute('readonly');
  expect(requests).toBe(1);
  release();
  await expect(page.getByText('Submission received', { exact: true })).toBeVisible();
});

test('explicit draft reload locks fields and selected files until its response arrives', async ({ page }) => {
  await setupSubmission(page);
  await page.route('**/api/submissions/party-id/draft', route => route.fulfill({ status: 503, json: { message: 'Synthetic save outage' } }));
  await page.goto('/student/submission');
  await page.getByLabel('Branch', { exact: true }).fill('Keep until deliberate reload');
  await page.getByLabel('Supporting documents (optional)').setInputFiles({ name: 'local.pdf', mimeType: 'application/pdf', buffer: Buffer.from('synthetic file') });
  await page.getByRole('button', { name: 'Save Draft', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Synthetic save outage');
  let started = false;
  let release!: () => void;
  const held = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/api/submissions/party-id', async route => { started = true; await held; await route.fallback(); });
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: 'Reload saved draft' }).click();
  await expect.poll(() => started).toBe(true);
  await expect(page.getByLabel('Branch', { exact: true })).toHaveAttribute('readonly');
  await expect(page.getByLabel('GitHub repository URL')).toHaveAttribute('readonly');
  await expect(page.getByLabel('Notes for evaluators (optional)')).toHaveAttribute('readonly');
  await expect(page.getByLabel('Supporting documents (optional)')).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Remove local.pdf' })).toBeDisabled();
  release();
  await expect(page.getByLabel('Branch', { exact: true })).toHaveValue('main');
  await expect(page.getByLabel('Branch', { exact: true })).toBeEditable();
  await page.getByLabel('Branch', { exact: true }).fill('Keep after failed reload');
  await page.getByRole('button', { name: 'Save Draft', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Synthetic save outage');
  await page.route('**/api/submissions/party-id', route => route.fulfill({ status: 503, json: { message: 'Synthetic reload outage' } }));
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: 'Reload saved draft' }).click();
  await expect(page.getByRole('alert').filter({ hasText: "Couldn't refresh saved submission" })).toBeVisible();
  await expect(page.getByLabel('Branch', { exact: true })).toHaveValue('Keep after failed reload');
  await expect(page.getByLabel('Branch', { exact: true })).toBeEditable();
});
