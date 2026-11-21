import { expect, type Page } from '@playwright/test';
import type { Questionnaire } from '../../src/types';

export const student = {
  id: 'student-id', email: 'student@example.test', firstName: 'Demo', lastName: 'Student',
  role: 'STUDENT', status: 'APPROVED', studentProfile: { skills: [], university: 'Test University' },
};

export function sessionToken(subject = student.email, version = 1, expiry = Math.floor(Date.now() / 1000) + 3600) {
  const encode = (value: object) => btoa(String.fromCharCode(...new TextEncoder().encode(JSON.stringify(value))))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ sub: subject, ver: version, exp: expiry })}.synthetic-signature`;
}

export function assignment(overrides: Partial<Questionnaire> = {}): Questionnaire {
  return {
    id: 'assignment-1', submissionId: 'submission-1', assessmentVersion: 2,
    projectTitle: 'Student support platform', state: 'OPEN', answerState: 'DRAFT',
    revision: 7, answeredCount: 0, editable: true,
    opensAt: new Date(Date.now() - 1000).toISOString(),
    closesAt: new Date(Date.now() + 48 * 3600_000 - 1000).toISOString(),
    serverNow: new Date().toISOString(), savedAt: null,
    questions: Array.from({ length: 5 }, (_, i) => ({
      id: `question-${i + 1}`, position: i + 1,
      prompt: `Explain implementation decision ${i + 1} in your submitted code.`,
      sourceReferences: [{ path: `src/feature-${i + 1}.ts`, startLine: 1, endLine: 12 }], answer: '',
    })),
    ...overrides,
  };
}

export async function setupQuestionnaire(page: Page, initial = assignment()) {
  let current = initial;
  const writes: { expectedRevision: number; answers: { questionId: string; text: string }[] }[] = [];
  await page.addInitScript(token => {
    localStorage.setItem('accessToken', token);
    localStorage.setItem('refreshToken', 'synthetic-refresh');
  }, sessionToken());
  await page.route(url => url.pathname.startsWith('/api/'), route => route.fulfill({ status: 404, json: { message: 'Fixture not found' } }));
  await page.route('**/api/users/me', route => route.fulfill({ json: student }));
  await page.route('**/api/users/notifications**', route => route.fulfill({ json: { notifications: [], unreadCount: 0 } }));
  await page.route('**/api/questionnaires/my', route => route.fulfill({ json: [current] }));
  await page.route('**/api/questionnaires/assignment-1', route => route.fulfill({ json: { ...current, serverNow: new Date().toISOString() } }));
  await page.route('**/api/questionnaires/assignment-1/answers', async route => {
    const body = route.request().postDataJSON();
    writes.push(body);
    expect(body.expectedRevision).toBe(current.revision);
    expect(body.answers).toHaveLength(5);
    current = { ...current, revision: current.revision + 1, savedAt: new Date().toISOString(),
      serverNow: new Date().toISOString(), answeredCount: body.answers.filter((a: { text: string }) => a.text.trim()).length,
      questions: current.questions.map(q => ({ ...q, answer: body.answers.find((a: { questionId: string }) => a.questionId === q.id).text })) };
    await route.fulfill({ json: current });
  });
  return { writes, current: () => current };
}
