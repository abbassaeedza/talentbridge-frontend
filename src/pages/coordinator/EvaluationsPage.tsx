import { useEffect, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { partyApi, submissionApi, evaluationApi } from '../../api/services'
import { Award, Play, CheckSquare, BarChart3, Check, LoaderCircle } from 'lucide-react'
import toast from 'react-hot-toast'
import clsx from 'clsx'
import EvaluationReportPanel from '../../components/evaluation/EvaluationReportPanel'

const evaluationSteps = [
  { label: 'AI Detection', weight: 20 },
  { label: 'Code Quality', weight: 25 },
  { label: 'Functionality', weight: 25 },
  { label: 'Scope Alignment', weight: 20 },
  { label: 'Team Collaboration', weight: 10 },
]

function EvaluationProgress({ currentStep }: { currentStep: number }) {
  return (
    <div role='status' aria-label='Evaluation progress' className='border-t border-ink-800/50 bg-ink-950/40 px-5 py-4'>
      <div className='mb-3 flex items-center justify-between'>
        <p className='text-xs font-semibold uppercase tracking-wider text-ink-300'>Evaluation progress</p>
        <p className='text-[10px] text-ink-500'>Weights total 100%</p>
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
                'rounded-xl border p-3 transition-colors',
                complete && 'border-jade-500/30 bg-jade-500/10',
                active && 'border-ember-500/40 bg-ember-500/10',
                !complete && !active && 'border-ink-800 bg-ink-900/60',
              )}
            >
              <div className='mb-2 flex items-center justify-between'>
                {complete ? (
                  <Check size={15} className='text-jade-400' />
                ) : active ? (
                  <LoaderCircle size={15} className='animate-spin text-ember-400' />
                ) : (
                  <span className='h-3.5 w-3.5 rounded-full border border-ink-600' />
                )}
                <span className='text-[10px] font-semibold text-ink-400'>{step.weight}%</span>
              </div>
              <p className='text-[11px] font-medium text-ink-200'>{step.label}</p>
            </div>
          )
        })}
      </div>
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

    if (isLoading) return <p className="text-xs text-ink-400 p-4">Loading report…</p>
    if (isError) return <p className="p-4 text-xs text-red-400">Could not load the evaluation report.</p>
    if (!report) return <p className="text-xs text-ink-400 p-4">No evaluation report yet.</p>

    return (
      <EvaluationReportPanel report={report} className='border-t border-ink-800/50'>
        {!report.finalized && (
          <div className='mt-4 flex flex-wrap gap-2'>
            <button
              onClick={() => evaluationMutation.mutate({ submissionId, reportId: report.id })}
              disabled={evaluationMutation.isPending || finalizeMutation.isPending}
              title='Refresh GitHub contribution scores without changing the AI analysis'
              className='btn-secondary text-xs'
            >
              <Play size={13} />
              {evaluationMutation.isPending ? 'Reevaluating…' : 'Reevaluate'}
            </button>
            <button onClick={() => finalizeMutation.mutate(report.id)}
              disabled={finalizeMutation.isPending || evaluationMutation.isPending}
              className="btn-primary text-xs">
              <CheckSquare size={13} />
              {finalizeMutation.isPending ? 'Finalizing…' : 'Finalize Report'}
            </button>
          </div>
        )}
        {report.finalized && (
          <span className="badge badge-open text-[10px] mt-3">Report Finalized</span>
        )}
      </EvaluationReportPanel>
    )
  }

  return (
    <div className="animate-fade-up">
      <div className="page-header">
        <h1 className="page-title">Evaluations</h1>
        <p className="page-subtitle">Trigger AI evaluation for submitted projects.</p>
      </div>

      <div className="space-y-3">
        {submissionsQuery.isLoading ? (
          Array.from({ length: 3 }).map((_, i) => <div key={i} className="card h-16 animate-pulse" />)
        ) : submissions.length === 0 ? (
          <div className="card p-16 text-center">
            <Award size={32} className="text-ink-600 mx-auto mb-3" />
            <p className="text-ink-400 text-sm">No submissions to evaluate yet.</p>
          </div>
        ) : (
          submissions.map((sub: any) => (
            <div key={sub.id} className="card overflow-hidden">
              <div className="px-5 py-4 flex items-center gap-4">
                <div className="flex-1">
                  <p className="font-semibold text-white text-sm">{sub.partyName}</p>
                  <p className="text-xs text-ink-400">{sub.assignedProjectTitle}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={clsx('badge text-[10px]',
                      sub.status === 'DRAFT' && 'badge-pending',
                      sub.status === 'SUBMITTED' && 'badge-active',
                      sub.status === 'UNDER_EVALUATION' && 'badge-ember',
                      sub.status === 'EVALUATED' && 'badge-open',
                    )}>{sub.status?.replace('_', ' ')}</span>
                    {sub.repoUrl && (
                      <a href={sub.repoUrl} target="_blank" rel="noreferrer"
                        className="text-[10px] text-ink-400 hover:text-ember-400 underline">
                        {sub.repoUrl.replace('https://github.com/', '')}
                      </a>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  {sub.status === 'SUBMITTED' && (
                    <button onClick={() => evaluationMutation.mutate({ submissionId: sub.id })}
                      disabled={evaluationMutation.isPending}
                      className="btn-primary text-xs px-3 py-2">
                      <Play size={13} />
                      {evaluationMutation.isPending && evaluationProgress?.submissionId === sub.id ? 'Running…' : 'Evaluate'}
                    </button>
                  )}
                  {(sub.status === 'EVALUATED' || sub.status === 'UNDER_EVALUATION') && (
                    <button onClick={() => setExpandedSubmission(expandedSubmission === sub.id ? null : sub.id)}
                      className="btn-secondary text-xs px-3 py-2 gap-1.5">
                      <BarChart3 size={13} />
                      {expandedSubmission === sub.id ? 'Hide' : 'View Report'}
                    </button>
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
