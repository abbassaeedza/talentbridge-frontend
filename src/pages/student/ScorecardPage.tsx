import { useQuery } from '@tanstack/react-query';
import { userApi } from '../../api/services';
import { Award, TrendingUp } from 'lucide-react';
import { format } from 'date-fns';
import clsx from 'clsx';
import EvaluationReportPanel from '../../components/evaluation/EvaluationReportPanel';

function ScoreRing({ score }: { score: number }) {
  const r = 28;
  const circ = 2 * Math.PI * r;
  const pct = (score ?? 0) / 100;
  const color = score >= 80 ? '#10b981' : score >= 60 ? '#f97316' : '#ef4444';
  return (
    <div className='relative w-20 h-20 flex items-center justify-center'>
      <svg className='absolute inset-0 -rotate-90' width='80' height='80'>
        <circle
          cx='40'
          cy='40'
          r={r}
          fill='none'
          stroke='#1b2452'
          strokeWidth='6'
        />
        <circle
          cx='40'
          cy='40'
          r={r}
          fill='none'
          stroke={color}
          strokeWidth='6'
          strokeDasharray={circ}
          strokeDashoffset={circ * (1 - pct)}
          strokeLinecap='round'
          style={{ transition: 'stroke-dashoffset 1s ease' }}
        />
      </svg>
      <span className='font-display font-bold text-xl text-white'>
        {Math.round(score ?? 0)}
      </span>
    </div>
  );
}

export default function ScorecardPage() {
  const { data: scorecard, isLoading } = useQuery({
    queryKey: ['my-scorecard'],
    queryFn: () =>
      userApi
        .getMyScorecard()
        .then((r) => r.data)
        .catch(() => null),
    retry: false,
  });

  const entries = scorecard?.entries ?? [];
  const averageScore = scorecard?.averageScore ?? 0;
  const totalProjects = scorecard?.totalProjects ?? 0;
  const bestScore =
    entries.length > 0 ? Math.max(...entries.map((e) => e.score ?? 0)) : null;

  if (isLoading)
    return (
      <div className='flex items-center justify-center py-24'>
        <div className='w-6 h-6 border-2 border-ember-500 border-t-transparent rounded-full animate-spin' />
      </div>
    );

  return (
    <div className='animate-fade-up max-w-3xl'>
      <div className='page-header'>
        <h1 className='page-title'>My Scorecard</h1>
        <p className='page-subtitle'>
          Your performance across all evaluated projects.
        </p>
      </div>

      {/* Summary */}
      <div className='grid grid-cols-3 gap-4 mb-8'>
        <div className='card p-5 text-center'>
          <div className='flex justify-center mb-2'>
            <ScoreRing score={averageScore} />
          </div>
          <p className='text-xs text-ink-400'>Average Score</p>
        </div>

        <div className='card p-5 flex flex-col items-center justify-center gap-2'>
          <div className='w-11 h-11 rounded-xl bg-ember-500/15 flex items-center justify-center'>
            <Award size={20} className='text-ember-400' />
          </div>
          <p className='font-display text-2xl font-bold text-white'>
            {totalProjects}
          </p>
          <p className='text-xs text-ink-400'>Projects done</p>
        </div>

        <div className='card p-5 flex flex-col items-center justify-center gap-2'>
          <div className='w-11 h-11 rounded-xl bg-jade-500/15 flex items-center justify-center'>
            <TrendingUp size={20} className='text-jade-400' />
          </div>
          <p className='font-display text-2xl font-bold text-white'>
            {bestScore !== null ? bestScore.toFixed(0) : '—'}
          </p>
          <p className='text-xs text-ink-400'>Best score</p>
        </div>
      </div>

      {/* Entries */}
      {entries.length === 0 ? (
        <div className='card p-12 text-center'>
          <Award size={32} className='text-ink-600 mx-auto mb-3' />
          <p className='text-ink-400 text-sm'>
            No evaluations yet. Complete a project to see your scorecard.
          </p>
        </div>
      ) : (
        <div className='space-y-4'>
          {entries.map((entry) => (
            <div key={entry.id} className='card p-5'>
              <div className='flex items-center gap-4'>
                <ScoreRing score={entry.score ?? 0} />
                <div className='flex-1'>
                  <h3 className='font-semibold text-white mb-0.5'>
                    {entry.project?.title ?? 'Project'}
                  </h3>
                  <div className='flex items-center gap-3 text-xs text-ink-400'>
                    <span className='font-semibold text-ink-200'>
                      Your score: {(entry.score ?? 0).toFixed(0)}/100
                    </span>
                    {entry.evaluationReport && (
                      <span>
                        Team project score: {entry.evaluationReport.totalScore.toFixed(0)}/100
                      </span>
                    )}
                    {entry.semester && <span>{entry.semester}</span>}
                    {entry.academicYear && <span>{entry.academicYear}</span>}
                    {entry.createdAt && (
                      <span>
                        {format(new Date(entry.createdAt), 'dd MMM yyyy')}
                      </span>
                    )}
                  </div>
                  <div className='mt-2 score-bar-track'>
                    <div
                      className={clsx(
                        'score-bar-fill',
                        (entry.score ?? 0) >= 80
                          ? 'bg-jade-500'
                          : (entry.score ?? 0) >= 60
                            ? 'bg-ember-500'
                            : 'bg-red-500',
                      )}
                      style={{ width: `${entry.score ?? 0}%` }}
                    />
                  </div>
                </div>
              </div>
              {entry.evaluationReport && (
                <EvaluationReportPanel
                  report={entry.evaluationReport}
                  className='mt-5 rounded-2xl border border-ink-800/60'
                />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
