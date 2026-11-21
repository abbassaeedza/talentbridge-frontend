import { useState, type ReactNode } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import clsx from 'clsx';
import { Button } from '@heroui/react/button';
import type { EvaluationReport } from '../../types';
import { formatDateTime } from '../../utils/dateTime';

const dimensions = [
  { key: 'aiDetection', weightKey: 'authenticity', label: 'AI authenticity', weight: 20 },
  { key: 'codeQuality', weightKey: 'quality', label: 'Code quality', weight: 25 },
  { key: 'functionality', weightKey: 'functionality', label: 'Functionality', weight: 25 },
  { key: 'scopeAlignment', weightKey: 'scope', label: 'Scope alignment', weight: 20 },
  { key: 'teamCollaboration', weightKey: 'collaboration', label: 'Team collaboration', weight: 10 },
] as const;

function scoreTone(score: number) {
  return score >= 80 ? 'success' : score >= 60 ? 'warning' : 'danger';
}

const SCORE_TEXT = {
  success: 'text-success',
  warning: 'text-warning',
  danger: 'text-danger',
} as const;

const SCORE_FILL = {
  success: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-danger',
} as const;

function ScoreDimension({ label, weight, score, notes, precision }: { label: string; weight: number | undefined; score: number; notes: string; precision: number }) {
  const [open, setOpen] = useState(false);
  const tone = scoreTone(score);
  return (
    <div>
      <div className='mb-1.5 flex items-center justify-between gap-3'>
        <Button size='sm' variant='ghost' className='h-auto min-h-8 px-1 text-xs' aria-expanded={open} onPress={() => setOpen((value) => !value)}>
          {label}
          <span className='rounded-sm bg-default px-1.5 py-0.5 text-[10px] text-muted'>{weight === undefined ? 'Weight unavailable' : `${weight}%`}</span>
          {open ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        </Button>
        <span className={clsx('text-sm font-semibold', SCORE_TEXT[tone])}>{score.toFixed(precision)}</span>
      </div>
      <div className='h-1.5 overflow-hidden rounded-sm bg-surface-tertiary' aria-label={`${label}: ${score.toFixed(precision)} out of 100`}>
        <div className={clsx('h-full rounded-sm', SCORE_FILL[tone])} style={{ width: `${Math.max(0, Math.min(100, score))}%` }} />
      </div>
      {open && <p className='mt-2 whitespace-pre-wrap [overflow-wrap:anywhere] text-xs leading-5 text-muted'>{notes}</p>}
    </div>
  );
}

export default function EvaluationReportPanel({ report, children, className, audience = 'shared' }: { report: EvaluationReport; children?: ReactNode; className?: string; audience?: 'coordinator' | 'shared' }) {
  const v2 = report.assessmentVersion === 2;
  const precision = v2 ? 1 : 0;
  if (v2 && !report.finalized && audience !== 'coordinator') return null;
  return (
    <section className={clsx('evaluation-report-panel min-w-0 rounded-lg border border-border bg-surface p-4 [overflow-wrap:anywhere] sm:p-5', className)} aria-label={v2 ? 'Project evaluation report' : 'AI evaluation report'}>
      <div className='mb-5 flex flex-col gap-3 border-b border-separator pb-5 sm:flex-row sm:items-start sm:justify-between'>
        <div>
          <h3 className='text-base font-semibold'>{v2 ? 'Project Evaluation Report' : 'AI Evaluation Report'}</h3>
          <p className='mt-1 max-w-3xl text-sm leading-6 text-muted'>{report.overallSummary}</p>
        </div>
        <div className='shrink-0 sm:text-right'>
          <p className={clsx('font-mono text-3xl font-semibold', SCORE_TEXT[scoreTone(report.totalScore)])}>{report.totalScore.toFixed(precision)}</p>
          <p className='text-xs text-muted'>{v2 ? 'Combined team score /100' : 'Team project score /100'}</p>
        </div>
      </div>
      {v2 && <>
        <dl className='mb-5 grid gap-3 sm:grid-cols-2'>
          <div><dt className='text-xs text-muted'>Repository score /100</dt><dd className='text-lg font-semibold'>{report.repositoryScore?.toFixed(1) ?? 'Unavailable'}</dd></div>
          <div><dt className='text-xs text-muted'>Team questionnaire score /100</dt><dd className='text-lg font-semibold'>{report.questionnaireScore?.toFixed(1) ?? 'Pending'}</dd></div>
        </dl>
        <p className='mb-4 max-w-prose text-xs leading-5 text-muted'>The provenance indicator is uncertain evidence, not proof of AI authorship or misconduct. Repository scoring contributes 75% and the aggregate team questionnaire contributes 25% of the combined score.</p>
      </>}
      <div className='space-y-4'>
        {dimensions.map(({ key, weightKey, label, weight }) => (
          <ScoreDimension key={key} label={v2 && key === 'aiDetection' ? 'Provenance indicator' : label} weight={v2 ? report.effectiveWeights?.[weightKey] : weight} score={report[`${key}Score`]} notes={report[`${key}Notes`]} precision={precision} />
        ))}
        {v2 && report.questionnaireScore !== undefined && <ScoreDimension label='Team questionnaire' weight={report.effectiveWeights?.questionnaire} score={report.questionnaireScore} notes='Mean across all frozen participants, including incomplete saved sets as policy zero. Technical grading failures remain pending.' precision={1} />}
      </div>
      {v2 && report.contributorCoverage && <p className='mt-5 max-w-prose text-xs leading-5 text-muted'>Contributor counts are a bounded first {report.contributorCoverage.limit} sample captured {formatDateTime(report.contributorCoverage.capturedAt)}{report.contributorCoverage.truncated ? ' (truncated)' : ''}. This sample is {report.contributorCoverage.commitPinned ? 'commit-pinned' : 'not commit-pinned'} and is an activity indicator, not proven effort.</p>}
      {report.studentScores?.length > 0 && (
        <div className='mt-6 border-t border-separator pt-5'>
          <h4 className='mb-3 text-xs font-semibold uppercase tracking-wider text-muted'>Individual scores</h4>
          <div className='divide-y divide-separator rounded-md border border-border'>
            {report.studentScores.map((score) => (
              <div key={score.id} className='grid gap-1 px-3 py-3 text-sm sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center sm:gap-5'>
                <span className='min-w-0 font-medium'>
                  {score.student.firstName} {score.student.lastName}
                  {score.student.githubUsername && (
                    <a href={`https://github.com/${encodeURIComponent(score.student.githubUsername)}`} target='_blank' rel='noreferrer' className='ml-2 font-normal text-accent hover:underline'>
                      @{score.student.githubUsername}
                    </a>
                  )}
                </span>
                <span className='text-xs text-muted'>{score.totalCommits} commits ({score.contributionPercentage}%)</span>
                <span className={clsx('font-mono font-semibold', SCORE_TEXT[scoreTone(score.individualScore)])}>{score.individualScore.toFixed(precision)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      {children}
    </section>
  );
}
