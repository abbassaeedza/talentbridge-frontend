import { useQuery } from '@tanstack/react-query';
import { userApi } from '../../api/services';
import { Award, TrendingUp } from 'lucide-react';
import { format } from 'date-fns';
import clsx from 'clsx';
import EvaluationReportPanel from '../../components/evaluation/EvaluationReportPanel';
import { ProgressBar } from '@heroui/react/progress-bar';
import { ProgressCircle } from '@heroui/react/progress-circle';
import { Spinner } from '@heroui/react/spinner';
import { EmptyState, PageHeader, StatCard } from '../../components/ui/TalentBridgeUI';

function ScoreRing({ score }: { score: number }) {
  return (
    <div className='relative w-20 h-20 flex items-center justify-center'>
      <ProgressCircle aria-label='Score' value={score} size='lg' color={score >= 80 ? 'success' : score >= 60 ? 'warning' : 'danger'} className='absolute inset-0 size-20'><ProgressCircle.Track><ProgressCircle.TrackCircle /><ProgressCircle.FillCircle /></ProgressCircle.Track></ProgressCircle>
      <span className=' font-bold text-xl text-foreground'>
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
        <Spinner />
      </div>
    );

  return (
    <div className=' max-w-3xl'>
      <PageHeader title='Scorecard' description='Your individual contribution and evaluation results.' />

      {/* Summary */}
      <div className='grid grid-cols-3 gap-4 mb-8'>
        <div className='rounded-lg border border-border bg-surface p-5 text-center'>
          <div className='flex justify-center mb-2'>
            <ScoreRing score={averageScore} />
          </div>
          <p className='text-xs text-muted'>Average Score</p>
        </div>

        <StatCard icon={Award} label='Projects completed' value={totalProjects} />
        <StatCard icon={TrendingUp} label='Best score' value={bestScore !== null ? bestScore.toFixed(0) : '-'} />
      </div>

      {/* Entries */}
      {entries.length === 0 ? (
        <EmptyState icon={Award} title='No evaluations yet' description='Complete a project to receive a scorecard.' />
      ) : (
        <div className='space-y-4'>
          {entries.map((entry) => (
            <div key={entry.id} className='rounded-lg border border-border bg-surface p-5'>
              <div className='flex items-center gap-4'>
                <ScoreRing score={entry.score ?? 0} />
                <div className='flex-1'>
                  <h3 className='font-semibold text-foreground mb-0.5'>
                    {entry.project?.title ?? 'Project'}
                  </h3>
                  <div className='flex items-center gap-3 text-xs text-muted'>
                    <span className='font-semibold text-foreground'>
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
                  <ProgressBar aria-label={`${entry.project?.title ?? 'Project'} score`} value={entry.score ?? 0} color={(entry.score ?? 0) >= 80 ? 'success' : (entry.score ?? 0) >= 60 ? 'warning' : 'danger'} className='mt-3'><ProgressBar.Track><ProgressBar.Fill /></ProgressBar.Track></ProgressBar>
                </div>
              </div>
              {entry.evaluationReport && (
                <EvaluationReportPanel
                  report={entry.evaluationReport}
                  className='mt-5 rounded-lg border border-border'
                />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
