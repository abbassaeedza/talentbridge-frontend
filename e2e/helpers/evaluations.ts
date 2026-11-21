import { expect, type Page } from '@playwright/test';
import { sessionToken } from './questionnaires';
import type { CoordinatorSubmission, EvaluationReport, EvaluationRun, PrivateQuestionnaireReview, QuestionnaireGenerationReview } from '../../src/types';

export const coordinator = {
  id: 'coordinator-1', email: 'coordinator@example.test', firstName: 'Test', lastName: 'Coordinator',
  role: 'COORDINATOR', status: 'APPROVED', onboardingComplete: true,
};

export function sharedReport(overrides: Partial<EvaluationReport> = {}): EvaluationReport {
  return {
    id: 'report-1', submissionId: 'submission-1', assessmentVersion: 2,
    aiDetectionScore: 84, aiDetectionNotes: 'Uncertain provenance evidence.',
    codeQualityScore: 84, codeQualityNotes: 'Repository quality feedback.',
    functionalityScore: 84, functionalityNotes: 'Repository functionality feedback.',
    scopeAlignmentScore: 84, scopeAlignmentNotes: 'Repository scope feedback.',
    teamCollaborationScore: 84, teamCollaborationNotes: 'Bounded contributor evidence.',
    repositoryScore: 84, questionnaireScore: 72, totalScore: 81,
    effectiveWeights: { authenticity: 15, quality: 18.75, functionality: 18.75, scope: 15, collaboration: 7.5, questionnaire: 25 },
    contributorCoverage: { capturedAt: '2026-11-18T12:00:00Z', limit: 100, truncated: true, commitPinned: false },
    overallSummary: 'Shared repository-only summary.', studentScores: [{
      id: 'student-score-1', student: { id: 'student-1', firstName: 'Frozen', lastName: 'Student', email: null, githubUsername: 'frozen-student' },
      totalCommits: 4, contributionPercentage: 33.3, individualScore: 80.9, performanceNotes: 'Frozen contributor calculation.',
    }], evaluatedAt: '2026-11-21T12:00:00Z', finalized: false,
    ...overrides,
  };
}

export function coordinatorSubmission(overrides: Partial<CoordinatorSubmission> = {}): CoordinatorSubmission {
  return {
    id: 'submission-1', partyId: 'party-1', partyName: 'Frozen team', projectId: 'project-1',
    projectTitle: 'Frozen project', status: 'SUBMITTED', assessmentVersion: 2, version: 8,
    repoUrl: 'https://github.com/example/frozen-project', repoBranch: 'main', submittedAt: '2026-11-18T12:00:00Z',
    questionnaireState: 'READY_FOR_EVALUATION', opensAt: '2026-11-18T12:00:00Z', closesAt: '2026-11-20T12:00:00Z',
    runId: null, runStatus: null, reportId: null, finalized: false, serverNow: '2026-11-21T12:00:00Z',
    ...overrides,
  };
}

export function runView(overrides: Partial<EvaluationRun> = {}): EvaluationRun {
  return {
    id: 'run-1', submissionId: 'submission-1', assessmentVersion: 2, status: 'RUNNING', reportId: null,
    serverNow: '2026-11-21T12:00:00Z', steps: [{
      id: 'step-1', jobId: 'job-1', position: 0, kind: 'REPOSITORY', questionCount: 0, status: overrides.status === 'REVIEW' || overrides.status === 'FINALIZED' ? 'SUCCEEDED' : 'RUNNING',
      attempts: 1, dispatchGeneration: 1, nextAttemptAt: null, leaseUntil: overrides.status === 'REVIEW' || overrides.status === 'FINALIZED' ? null : '2026-11-21T12:01:50Z', errorCode: null,
    }, {
      id: 'step-2', jobId: 'job-2', position: 1, kind: 'QUESTIONNAIRE', questionCount: 5, status: overrides.status === 'REVIEW' || overrides.status === 'FINALIZED' ? 'SUCCEEDED' : 'PENDING',
      attempts: 0, dispatchGeneration: 0, nextAttemptAt: null, leaseUntil: null, errorCode: null,
    }], ...overrides,
  };
}

export function privateReview(overrides: Partial<PrivateQuestionnaireReview> = {}): PrivateQuestionnaireReview {
  return {
    submissionId: 'submission-1', state: 'REVIEW', opensAt: '2026-11-18T12:00:00Z', closesAt: '2026-11-20T12:00:00Z',
    serverNow: '2026-11-21T12:00:00Z', members: [{
      assignmentId: 'assignment-1', studentId: 'student-1', studentName: 'Frozen Student', gradeState: 'GRADED',
      aiScore: 72, effectiveScore: 72, lockedAnswerRevision: 9,
      questions: Array.from({ length: 5 }, (_, i) => ({
        id: `question-${i + 1}`, position: i + 1, prompt: `Private question ${i + 1}: explain this implementation.`,
        rubric: `Hidden rubric ${i + 1}`, answer: `Locked private answer ${i + 1}`, aiScore: i === 0 ? 16 : 14,
        effectiveScore: i === 0 ? 16 : 14, feedback: `Private feedback ${i + 1}`,
        sourceReferences: [{ path: `src/${'long-path/'.repeat(15)}feature-${i + 1}.ts`, startLine: 1, endLine: 20 }], adjustments: [],
      })),
    }], ...overrides,
  };
}

export function generationReview(overrides: Partial<QuestionnaireGenerationReview> = {}): QuestionnaireGenerationReview {
  return {
    submissionId: 'submission-1', projectTitle: 'Frozen project', state: 'GENERATING', opensAt: null, closesAt: null,
    serverNow: '2026-11-21T12:00:00Z', members: [{ assignmentId: 'assignment-1', studentId: 'student-1', studentName: 'Frozen Student', questionCount: 0, answeredCount: 0 }],
    jobs: [{ id: 'generation-job-1', retryOf: null, kind: 'GENERATE_MEMBER', status: 'FAILED', attempts: 3, dispatchGeneration: 2, nextAttemptAt: null, leaseUntil: null, errorCode: 'RELAY_FAILURE' }],
    ...overrides,
  };
}

export async function setupEvaluations(page: Page, initial = coordinatorSubmission(), user = coordinator) {
  const state = { submission: initial, run: runView(), report: sharedReport(), review: privateReview(), generation: generationReview(), reads: 0, triggers: 0, retries: 0, marks: [] as unknown[], finalizes: 0 };
  await page.addInitScript(token => {
    localStorage.setItem('accessToken', token);
    localStorage.setItem('refreshToken', 'synthetic-coordinator-refresh');
  }, sessionToken(user.email));
  await page.route(url => url.pathname.startsWith('/api/'), route => route.fulfill({ status: 404, json: { message: 'Fixture not found' } }));
  await page.route('**/api/users/me', route => route.fulfill({ json: user }));
  await page.route('**/api/users/notifications**', route => route.fulfill({ json: { notifications: [], unreadCount: 0 } }));
  await page.route('**/api/submissions', route => route.fulfill({ json: [state.submission] }));
  await page.route('**/api/submissions/submission-1/questionnaire-review', route => route.fulfill({ json: state.generation }));
  await page.route('**/api/submissions/submission-1/questionnaire/retry', route => route.fulfill({ json: state.generation }));
  await page.route('**/api/evaluations/trigger/submission-1', route => {
    state.triggers++;
    expect(route.request().postData()).toBeNull();
    state.submission = { ...state.submission, runId: 'run-1', runStatus: 'RUNNING' };
    return route.fulfill({ status: 202, json: state.run });
  });
  await page.route('**/api/evaluations/runs/run-1', route => {
    state.reads++;
    return route.fulfill({ json: state.run });
  });
  await page.route('**/api/evaluations/runs/run-1/retry', route => {
    state.retries++;
    expect(route.request().method()).toBe('POST');
    expect(route.request().postData()).toBeNull();
    return route.fulfill({ status: 202, json: state.run });
  });
  await page.route('**/api/evaluations/submission/submission-1', route => route.fulfill({ json: state.report }));
  await page.route('**/api/evaluations/submission/submission-1/questionnaire', route => route.fulfill({ json: state.review }));
  await page.route('**/api/evaluations/submission/submission-1/questions/*/mark', route => {
    state.marks.push(route.request().postDataJSON());
    return route.fulfill({ status: 503, json: { message: 'Correction could not be saved. Try again.' } });
  });
  await page.route('**/api/evaluations/report-1/finalize', route => {
    state.finalizes++;
    expect(route.request().method()).toBe('PUT');
    expect(route.request().postData()).toBeNull();
    state.report.finalized = true;
    state.review.state = 'FINALIZED';
    state.submission = { ...state.submission, finalized: true, questionnaireState: 'FINALIZED' };
    return route.fulfill({ json: state.report });
  });
  return state;
}
