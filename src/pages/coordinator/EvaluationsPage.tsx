import { useEffect, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { partyApi, submissionApi, evaluationApi } from '../../api/services'
import { Award, Play, CheckSquare, BarChart3, Check, LoaderCircle } from 'lucide-react'
import toast from 'react-hot-toast'
import clsx from 'clsx'
import EvaluationReportPanel from '../../components/evaluation/EvaluationReportPanel'
import { Button } from '@heroui/react/button'
import { ProgressBar } from '@heroui/react/progress-bar'
import { Skeleton } from '@heroui/react/skeleton'
import { EmptyState, PageHeader, StatusBadge } from '../../components/ui/TalentBridgeUI'

const evaluationSteps = [
  { label: 'AI Detection', weight: 20 },
  { label: 'Code Quality', weight: 25 },
  { label: 'Functionality', weight: 25 },
  { label: 'Scope Alignment', weight: 20 },
  { label: 'Team Collaboration', weight: 10 },
]

function EvaluationProgress({ currentStep }: { currentStep: number }) {
  return (
    <div role='status' aria-label='Evaluation progress' className='border-t border-border bg-background/40 px-5 py-4'>
      <div className='mb-3 flex items-center justify-between'>
        <p className='text-xs font-semibold uppercase tracking-wider text-foreground'>Evaluation progress</p>
        <p className='text-[10px] text-muted'>Weights total 100%</p>
      </div>
      <div className='grid gap-2 sm:grid-cols-5'>
        {evaluationSteps.map((step, index) => {
          const complete = index < currentStep
          const active = index === currentStep && currentStep < evaluationSteps.length
          const state = complete ? 'complete' : active ? 'in progress' : 'pending'
          return (
            <div
              key={step.label}
              aria-label={`${step.label} ${state}`}
              className={clsx(
                'rounded-lg border p-3 transition-colors',
                complete && 'border-border bg-default',
                active && 'border-foreground bg-default',
                !complete && !active && 'border-border bg-surface/60',
              )}
            >
              <div className='mb-2 flex items-center justify-between'>
                {complete ? (
                  <Check size={15} className='text-foreground' />
                ) : active ? (
                  <LoaderCircle size={15} className='animate-spin text-foreground' />
                ) : (
                  <span className='h-3.5 w-3.5 rounded-full border border-border' />
                )}
                <span className='text-[10px] font-semibold text-muted'>{step.weight}%</span>
              </div>
              <p className='text-[11px] font-medium text-foreground'>{step.label}</p>
            </div>
          )
        })}
      </div>
      <ProgressBar aria-label='Evaluation completion' value={Math.min(currentStep, evaluationSteps.length)} maxValue={evaluationSteps.length} className='mt-3'>
        <ProgressBar.Track>
          <ProgressBar.Fill />
        </ProgressBar.Track>
      </ProgressBar>
    </div>
  )
}

export default function EvaluationsPage() {
  const qc = useQueryClient()
  const [expandedSubmission, setExpandedSubmission] = useState<string | null>(null)
  const [evaluationProgress, setEvaluationProgress] = useState<{ submissionId: string; currentStep: number } | null>(null)

  const { data: parties } = useQuery({
    queryKey: ['submitted-parties'],
    queryFn: () => partyApi.getAll().then(r => r.data.filter(p => p.assignedProjectId))
  })

  const submissionsQuery = useQuery({
    queryKey: ['all-submissions'],
    queryFn: async () => {
      const results = []
      for (const party of parties ?? []) {
        try {
          const { data } = await submissionApi.get(party.id)
          results.push({ ...data, partyName: party.name, assignedProjectTitle: party.assignedProjectTitle })
        } catch { /* no submission yet */ }
      }
      return results
    },
    enabled: !!parties && parties.length > 0,
  })

  const evaluationMutation = useMutation({
    mutationFn: ({ submissionId, reportId }: { submissionId: string; reportId?: string }) =>
      reportId ? evaluationApi.reevaluate(reportId) : evaluationApi.trigger(submissionId),
    onMutate: ({ submissionId }) => setEvaluationProgress({ submissionId, currentStep: 0 }),
    onSuccess: (response, { submissionId, reportId }) => {
      qc.setQueryData(['eval-report', submissionId], response.data)
      setEvaluationProgress({ submissionId, currentStep: evaluationSteps.length })
      setExpandedSubmission(submissionId)
      qc.invalidateQueries({ queryKey: ['all-submissions'] })
      toast.success(reportId ? 'Contribution scores updated' : 'Evaluation complete')
    },
    onError: (e: any) => {
      setEvaluationProgress(null)
      toast.error(e?.response?.data?.message || 'Evaluation failed')
    },
  })

  useEffect(() => {
    if (!evaluationMutation.isPending || !evaluationProgress) return
    const submissionId = evaluationProgress.submissionId
    const interval = window.setInterval(() => {
      setEvaluationProgress((progress) => progress && progress.submissionId === submissionId
        ? { ...progress, currentStep: Math.min(progress.currentStep + 1, evaluationSteps.length - 1) }
        : progress)
    }, 4000)
    return () => window.clearInterval(interval)
  }, [evaluationMutation.isPending, evaluationProgress?.submissionId])

  const finalizeMutation = useMutation({
    mutationFn: (reportId: string) => evaluationApi.finalize(reportId),
    onSuccess: () => { toast.success('Report finalized!'); qc.invalidateQueries() },
    onError: () => toast.error('Failed to finalize'),
  })

  const submissions = submissionsQuery.data ?? []

  const EvaluationReportView = ({ submissionId }: { submissionId: string }) => {
    const { data: report, isLoading, isError } = useQuery({
      queryKey: ['eval-report', submissionId],
      queryFn: () => evaluationApi.getBySubmission(submissionId).then(r => r.data),
      retry: false,
    })

    if (isLoading) return <p className="text-xs text-muted p-4">Loading report…</p>
    if (isError) return <p className="p-4 text-xs text-danger">Could not load the evaluation report.</p>
    if (!report) return <p className="text-xs text-muted p-4">No evaluation report yet.</p>

    return (
      <EvaluationReportPanel report={report} className='border-t border-border'>
        {!report.finalized && (
          <div className='mt-4 flex flex-wrap gap-2'>
            <Button size='sm' variant='secondary'
              onPress={() => evaluationMutation.mutate({ submissionId, reportId: report.id })}
              isDisabled={evaluationMutation.isPending || finalizeMutation.isPending}
            >
              <Play size={13} />
              {evaluationMutation.isPending ? 'Reevaluating…' : 'Reevaluate'}
            </Button>
            <Button size='sm' variant='primary' onPress={() => finalizeMutation.mutate(report.id)}
              isDisabled={finalizeMutation.isPending || evaluationMutation.isPending}>
              <CheckSquare size={13} />
              {finalizeMutation.isPending ? 'Finalizing…' : 'Finalize Report'}
            </Button>
          </div>
        )}
        {report.finalized && (
          <StatusBadge status='EVALUATED' label='Report finalized' className='mt-3' />
        )}
      </EvaluationReportPanel>
    )
  }

  return (
    <div className="">
      <PageHeader title='Evaluations' description='Review submissions, run evaluation, and finalize reports.' />

      <div className="space-y-3">
        {submissionsQuery.isLoading ? (
          Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className='h-20 rounded-lg' />)
        ) : submissions.length === 0 ? (
          <EmptyState icon={Award} title='No submissions to evaluate' />
        ) : (
          submissions.map((sub: any) => (
            <div key={sub.id} className="rounded-lg border border-border bg-surface overflow-hidden">
              <div className="px-5 py-4 flex items-center gap-4">
                <div className="flex-1">
                  <p className="font-semibold text-foreground text-sm">{sub.partyName}</p>
                  <p className="text-xs text-muted">{sub.assignedProjectTitle}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <StatusBadge status={sub.status} />
                    {sub.repoUrl && (
                      <a href={sub.repoUrl} target="_blank" rel="noreferrer"
                        className="text-[10px] text-muted hover:text-accent underline">
                        {sub.repoUrl.replace('https://github.com/', '')}
                      </a>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  {sub.status === 'SUBMITTED' && (
                    <Button size='sm' variant='primary' onPress={() => evaluationMutation.mutate({ submissionId: sub.id })}
                      isDisabled={evaluationMutation.isPending}>
                      <Play size={13} />
                      {evaluationMutation.isPending && evaluationProgress?.submissionId === sub.id ? 'Running…' : 'Evaluate'}
                    </Button>
                  )}
                  {(sub.status === 'EVALUATED' || sub.status === 'UNDER_EVALUATION') && (
                    <Button size='sm' variant='secondary' onPress={() => setExpandedSubmission(expandedSubmission === sub.id ? null : sub.id)}>
                      <BarChart3 size={13} />
                      {expandedSubmission === sub.id ? 'Hide' : 'View Report'}
                    </Button>
                  )}
                </div>
              </div>

              {evaluationProgress && evaluationProgress.submissionId === sub.id && (
                <EvaluationProgress currentStep={evaluationProgress.currentStep} />
              )}
              {expandedSubmission === sub.id && <EvaluationReportView submissionId={sub.id} />}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
