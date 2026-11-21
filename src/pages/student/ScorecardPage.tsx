import { useQuery } from '@tanstack/react-query';
import { userApi } from '../../api/services';
import { Award, TrendingUp } from 'lucide-react';
import { format } from 'date-fns';
import EvaluationReportPanel from '../../components/evaluation/EvaluationReportPanel';
import { ProgressBar } from '@heroui/react/progress-bar';
import { ProgressCircle } from '@heroui/react/progress-circle';
import { Button } from '@heroui/react/button';
import { EmptyState, PageHeader, StatCard } from '../../components/ui/TalentBridgeUI';
import QuerySection from '../../components/ui/QuerySection';
import { useAuth } from '../../contexts/AuthContext';
import { useSessionRequests } from '../../hooks/useSessionRequests';

function ScoreRing({ score, precision = 0 }: { score: number; precision?: number }) {
  return (
    <div className='relative w-20 h-20 flex items-center justify-center'>
      <ProgressCircle aria-label='Score' value={score} size='lg' color={score >= 80 ? 'success' : score >= 60 ? 'warning' : 'danger'} className='absolute inset-0 size-20'><ProgressCircle.Track><ProgressCircle.TrackCircle /><ProgressCircle.FillCircle /></ProgressCircle.Track></ProgressCircle>
      <span className=' font-bold text-xl text-foreground'>
        {score.toFixed(precision)}
      </span>
    </div>
  );
}

export default function ScorecardPage() {
  const { user } = useAuth();
  const session = useSessionRequests();
  const query = useQuery({
    queryKey: ['my-scorecard', user?.role, user?.id, session.owner],
    queryFn: ({ signal }) => userApi.getMyScorecard({ ownerSession: session.owner ?? '', signal }).then(r => r.data),
    retry: false,
  });
  const scorecard = query.data;
  const entries = scorecard?.entries ?? [];
  const unpublished = entries.some(entry => entry.evaluationReport?.assessmentVersion === 2 && !entry.evaluationReport.finalized);
  const precision = entries.some(entry => entry.evaluationReport?.assessmentVersion === 2) ? 1 : 0;
  const averageScore = scorecard?.averageScore ?? 0;
  const totalProjects = scorecard?.totalProjects ?? 0;
  const bestScore =
    entries.length > 0 ? Math.max(...entries.map((e) => e.score ?? 0)) : null;

  return (
    <div className='min-w-0 max-w-3xl [overflow-wrap:anywhere]'>
      <PageHeader title='Scorecard' description='Your individual contribution and evaluation results.' />
      <QuerySection query={query} label='Scorecard'>
      {unpublished ? <div className='panel space-y-3 p-4'>
        <p role='alert' className='text-sm text-danger'>The scorecard contains an unpublished report. Grades are unavailable until coordinator finalization.</p>
        <Button className='min-h-11' variant='secondary' isDisabled={query.isFetching} onPress={() => { void query.refetch(); }}>Check scorecard</Button>
      </div> : <>
      {/* Summary */}
      <div className='mb-8 grid gap-3 min-[480px]:grid-cols-3'>
        <div className='rounded-lg border border-border bg-surface p-5 text-center'>
          <div className='flex justify-center mb-2'>
            <ScoreRing score={averageScore} precision={precision} />
          </div>
          <p className='text-xs text-muted'>Average Score</p>
        </div>

        <StatCard icon={Award} label='Projects completed' value={totalProjects} />
        <StatCard icon={TrendingUp} label='Best score' value={bestScore !== null ? bestScore.toFixed(precision) : '-'} />
      </div>

      {/* Entries */}
      {entries.length === 0 ? (
        <EmptyState icon={Award} title='No evaluations yet' description='Complete a project to receive a scorecard.' />
      ) : (
        <div className='space-y-4'>
          {entries.map((entry) => (
            <div key={entry.id} className='rounded-lg border border-border bg-surface p-5'>
              <div className='flex flex-col gap-4 sm:flex-row sm:items-center'>
                <ScoreRing score={entry.score ?? 0} precision={entry.evaluationReport?.assessmentVersion === 2 ? 1 : 0} />
                <div className='min-w-0 flex-1'>
                  <h3 className='font-semibold text-foreground mb-0.5'>
                    {entry.project?.title ?? 'Project'}
                  </h3>
                  <div className='flex flex-wrap items-center gap-3 text-xs text-muted'>
                    <span className='font-semibold text-foreground'>
                      Your score: {(entry.score ?? 0).toFixed(entry.evaluationReport?.assessmentVersion === 2 ? 1 : 0)}/100
                    </span>
                    {entry.evaluationReport && (
                      <span>
                        Team project score: {entry.evaluationReport.totalScore.toFixed(entry.evaluationReport.assessmentVersion === 2 ? 1 : 0)}/100
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
      </>}
      </QuerySection>
    </div>
  );
}
