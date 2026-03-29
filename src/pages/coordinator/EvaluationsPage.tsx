import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { partyApi, submissionApi, evaluationApi } from '../../api/services'
import { Award, Play, CheckSquare, ChevronDown, ChevronUp, BarChart3 } from 'lucide-react'
import toast from 'react-hot-toast'
import clsx from 'clsx'

function ScoreDimension({ label, score, notes }: { label: string; score: number; notes: string }) {
  const [open, setOpen] = useState(false)
  const color = score >= 80 ? 'bg-jade-500' : score >= 60 ? 'bg-ember-500' : 'bg-red-500'
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <button onClick={() => setOpen(v => !v)} className="flex items-center gap-1 text-xs text-ink-300 hover:text-ink-100">
          {label} {open ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
        </button>
        <span className="text-xs font-bold text-white">{score.toFixed(0)}</span>
      </div>
      <div className="score-bar-track mb-1">
        <div className={clsx('score-bar-fill', color)} style={{ width: `${score}%` }} />
      </div>
      {open && <p className="text-[11px] text-ink-400 leading-relaxed mt-1">{notes}</p>}
    </div>
  )
}

export default function EvaluationsPage() {
  const qc = useQueryClient()
  const [expandedSubmission, setExpandedSubmission] = useState<string | null>(null)

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
    mutationFn: (submissionId: string) => evaluationApi.trigger(submissionId),
    onSuccess: () => { toast.success('Evaluation triggered! This may take 30–60 seconds.'); qc.invalidateQueries() },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Evaluation failed'),
  })

  const finalizeMutation = useMutation({
    mutationFn: (reportId: string) => evaluationApi.finalize(reportId),
    onSuccess: () => { toast.success('Report finalized!'); qc.invalidateQueries() },
    onError: () => toast.error('Failed to finalize'),
  })

  const submissions = submissionsQuery.data ?? []

  const EvaluationReportView = ({ submissionId }: { submissionId: string }) => {
    const { data: report, isLoading } = useQuery({
      queryKey: ['eval-report', submissionId],
      queryFn: () => evaluationApi.getBySubmission(submissionId).then(r => r.data),
      retry: false,
    })

    if (isLoading) return <p className="text-xs text-ink-400 p-4">Loading report…</p>
    if (!report) return <p className="text-xs text-ink-400 p-4">No evaluation report yet.</p>

    return (
      <div className="p-5 bg-ink-950/50 border-t border-ink-800/50">
        <div className="flex items-start justify-between mb-4">
          <div>
            <p className="text-sm font-semibold text-white">AI Evaluation Report</p>
            <p className="text-xs text-ink-400 mt-0.5">{report.overallSummary}</p>
          </div>
          <div className="text-right">
            <p className="font-display text-2xl font-bold text-white">{report.totalScore.toFixed(0)}</p>
            <p className="text-xs text-ink-400">/100</p>
          </div>
        </div>

        <div className="space-y-3 mb-4">
          <ScoreDimension label="AI Detection (authenticity)" score={report.aiDetectionScore} notes={report.aiDetectionNotes} />
          <ScoreDimension label="Code Quality" score={report.codeQualityScore} notes={report.codeQualityNotes} />
          <ScoreDimension label="Functionality" score={report.functionalityScore} notes={report.functionalityNotes} />
          <ScoreDimension label="Scope Alignment" score={report.scopeAlignmentScore} notes={report.scopeAlignmentNotes} />
          <ScoreDimension label="Team Collaboration" score={report.teamCollaborationScore} notes={report.teamCollaborationNotes} />
        </div>

        {/* Per-student scores */}
        {report.studentScores?.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-ink-400 uppercase tracking-wider mb-2">Individual Scores</p>
            <div className="space-y-1.5">
              {report.studentScores.map(ss => (
                <div key={ss.id} className="flex items-center gap-3 p-2 rounded-lg bg-ink-800/50 text-xs">
                  <span className="text-ink-200 font-medium flex-1">
                    {ss.student.firstName} {ss.student.lastName}
                  </span>
                  <span className="text-ink-400">{ss.totalCommits} commits ({ss.contributionPercentage}%)</span>
                  <span className="font-bold text-white">{ss.individualScore.toFixed(0)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {!report.finalized && (
          <button onClick={() => finalizeMutation.mutate(report.id)}
            disabled={finalizeMutation.isPending}
            className="btn-primary text-xs mt-4">
            <CheckSquare size={13} />
            {finalizeMutation.isPending ? 'Finalizing…' : 'Finalize Report'}
          </button>
        )}
        {report.finalized && (
          <span className="badge badge-open text-[10px] mt-3">Report Finalized</span>
        )}
      </div>
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
                    <button onClick={() => evaluationMutation.mutate(sub.id)}
                      disabled={evaluationMutation.isPending}
                      className="btn-primary text-xs px-3 py-2">
                      <Play size={13} />
                      {evaluationMutation.isPending ? 'Running…' : 'Evaluate'}
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

              {expandedSubmission === sub.id && <EvaluationReportView submissionId={sub.id} />}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
