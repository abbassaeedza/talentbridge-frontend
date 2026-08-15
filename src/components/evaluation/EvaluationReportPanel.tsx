import { useState, type ReactNode } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import clsx from 'clsx';
import { Button } from '@heroui/react/button';
import type { EvaluationReport } from '../../types';

const dimensions = [
  { key: 'aiDetection', label: 'AI authenticity', weight: 20 },
  { key: 'codeQuality', label: 'Code quality', weight: 25 },
  { key: 'functionality', label: 'Functionality', weight: 25 },
  { key: 'scopeAlignment', label: 'Scope alignment', weight: 20 },
  { key: 'teamCollaboration', label: 'Team collaboration', weight: 10 },
] as const;

function ScoreDimension({ label, weight, score, notes }: { label: string; weight: number; score: number; notes: string }) {
  const [open, setOpen] = useState(false);
  const color = score >= 80 ? 'bg-success' : score >= 60 ? 'bg-warning' : 'bg-danger';
  return (
    <div>
      <div className='mb-1.5 flex items-center justify-between gap-3'>
        <Button size='sm' variant='ghost' className='h-auto min-h-8 px-1 text-xs' aria-expanded={open} onPress={() => setOpen((value) => !value)}>
          {label}
          <span className='rounded-sm bg-default px-1.5 py-0.5 text-[10px] text-muted'>{weight}%</span>
          {open ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        </Button>
        <span className='text-sm font-semibold'>{score.toFixed(0)}</span>
      </div>
      <div className='h-1.5 overflow-hidden rounded-full bg-surface-tertiary' aria-label={`${label}: ${score.toFixed(0)} out of 100`}>
        <div className={clsx('h-full rounded-full', color)} style={{ width: `${Math.max(0, Math.min(100, score))}%` }} />
      </div>
      {open && <p className='mt-2 text-xs leading-5 text-muted'>{notes}</p>}
    </div>
  );
}

export default function EvaluationReportPanel({ report, children, className }: { report: EvaluationReport; children?: ReactNode; className?: string }) {
  return (
    <section className={clsx('evaluation-report-panel rounded-lg border border-border bg-surface p-5', className)} aria-label='AI evaluation report'>
      <div className='mb-5 flex flex-col gap-3 border-b border-separator pb-5 sm:flex-row sm:items-start sm:justify-between'>
        <div>
          <h3 className='text-base font-semibold'>AI Evaluation Report</h3>
          <p className='mt-1 max-w-3xl text-sm leading-6 text-muted'>{report.overallSummary}</p>
        </div>
        <div className='shrink-0 sm:text-right'>
          <p className='font-mono text-3xl font-semibold'>{report.totalScore.toFixed(0)}</p>
          <p className='text-xs text-muted'>Team project score /100</p>
        </div>
      </div>
      <div className='space-y-4'>
        {dimensions.map(({ key, label, weight }) => (
          <ScoreDimension key={key} label={label} weight={weight} score={report[`${key}Score`]} notes={report[`${key}Notes`]} />
        ))}
      </div>
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
                <span className='font-mono font-semibold'>{score.individualScore.toFixed(0)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      {children}
    </section>
  );
}
