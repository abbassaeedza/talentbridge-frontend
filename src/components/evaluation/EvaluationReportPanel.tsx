import { useState, type ReactNode } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import clsx from 'clsx';
import type { EvaluationReport } from '../../types';

const dimensions = [
  { key: 'aiDetection', label: 'AI authenticity', weight: 20 },
  { key: 'codeQuality', label: 'Code Quality', weight: 25 },
  { key: 'functionality', label: 'Functionality', weight: 25 },
  { key: 'scopeAlignment', label: 'Scope Alignment', weight: 20 },
  { key: 'teamCollaboration', label: 'Team Collaboration', weight: 10 },
] as const;

function ScoreDimension({
  label,
  weight,
  score,
  notes,
}: {
  label: string;
  weight: number;
  score: number;
  notes: string;
}) {
  const [open, setOpen] = useState(false);
  const color = score >= 80 ? 'bg-jade-500' : score >= 60 ? 'bg-ember-500' : 'bg-red-500';
  return (
    <div>
      <div className='mb-1 flex items-center justify-between gap-3'>
        <button
          type='button'
          onClick={() => setOpen((value) => !value)}
          className='flex items-center gap-1 text-xs text-ink-300 hover:text-ink-100'
        >
          {label}
          <span className='rounded-md bg-ink-800 px-1.5 py-0.5 text-[10px] text-ink-400'>
            {weight}%
          </span>
          {open ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
        </button>
        <span className='text-xs font-bold text-white'>{score.toFixed(0)}</span>
      </div>
      <div className='score-bar-track mb-1'>
        <div className={clsx('score-bar-fill', color)} style={{ width: `${score}%` }} />
      </div>
      {open && <p className='mt-1 text-[11px] leading-relaxed text-ink-400'>{notes}</p>}
    </div>
  );
}

export default function EvaluationReportPanel({
  report,
  children,
  className,
}: {
  report: EvaluationReport;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div className={clsx('evaluation-report-panel bg-ink-950/50 p-5', className)}>
      <div className='mb-4 flex items-start justify-between gap-4'>
        <div>
          <p className='text-sm font-semibold text-white'>AI Evaluation Report</p>
          <p className='mt-0.5 text-xs text-ink-400'>{report.overallSummary}</p>
        </div>
        <div className='flex-shrink-0 text-right'>
          <p className='font-display text-2xl font-bold text-white'>{report.totalScore.toFixed(0)}</p>
          <p className='text-xs text-ink-400'>Team project score /100</p>
        </div>
      </div>

      <div className='mb-4 space-y-3'>
        {dimensions.map(({ key, label, weight }) => (
          <ScoreDimension
            key={key}
            label={label}
            weight={weight}
            score={report[`${key}Score`]}
            notes={report[`${key}Notes`]}
          />
        ))}
      </div>

      {report.studentScores?.length > 0 && (
        <div>
          <p className='mb-2 text-xs font-semibold uppercase tracking-wider text-ink-400'>Individual Scores</p>
          <div className='space-y-1.5'>
            {report.studentScores.map((score) => (
              <div key={score.id} className='flex items-center gap-3 rounded-lg bg-ink-800/50 p-2 text-xs'>
                <span className='flex-1 font-medium text-ink-200'>
                  {score.student.firstName} {score.student.lastName}
                  {score.student.githubUsername && (
                    <a
                      href={`https://github.com/${encodeURIComponent(score.student.githubUsername)}`}
                      target='_blank'
                      rel='noreferrer'
                      className='ml-1.5 font-normal text-ink-400 hover:text-ember-400'
                    >
                      @{score.student.githubUsername}
                    </a>
                  )}
                </span>
                <span className='text-ink-400'>
                  {score.totalCommits} commits ({score.contributionPercentage}%)
                </span>
                <span className='font-bold text-white'>{score.individualScore.toFixed(0)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {children}
    </div>
  );
}
