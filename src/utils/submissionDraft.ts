import type { Submission } from '../types';

export interface SubmissionFields { repoUrl: string; branch: string; notes: string }

export function submissionFields(saved: Submission | null): SubmissionFields {
  return { repoUrl: saved?.repoUrl ?? '', branch: saved ? saved.repoBranch ?? '' : 'main', notes: saved?.notes ?? '' };
}

export function matchesSavedDraft(saved: Submission | null, fields: SubmissionFields, fileCount: number) {
  const original = submissionFields(saved);
  return !!saved && fileCount === 0 && fields.repoUrl === original.repoUrl
    && fields.branch === original.branch && fields.notes === original.notes;
}

export function canFinalizeSubmission(saved: Submission | null, fields: SubmissionFields, fileCount: number, leader: boolean, busy: boolean) {
  return leader && !busy && saved?.status === 'DRAFT' && Number.isSafeInteger(saved.version)
    && saved.version! >= 0 && !!saved.repoUrl?.trim() && matchesSavedDraft(saved, fields, fileCount);
}
