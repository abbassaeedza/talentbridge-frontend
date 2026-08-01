import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation } from '@tanstack/react-query'
import { projectApi, partyApi } from '../../api/services'
import { useAuth } from '../../contexts/AuthContext'
import { Clock, Users, Building2, ChevronLeft, SendHorizonal, Star } from 'lucide-react'
import { formatDistanceToNow, format } from 'date-fns'
import toast from 'react-hot-toast'
import clsx from 'clsx'

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { isRole } = useAuth()
  const [rankPosition, setRankPosition] = useState(1)
  const [proposalText, setProposalText] = useState('')
  const [applyOpen, setApplyOpen] = useState(false)

  const { data: project, isLoading } = useQuery({
    queryKey: ['project', id],
    queryFn: () => projectApi.getById(id!).then(r => r.data),
    enabled: !!id,
  })

  const { data: party } = useQuery({
    queryKey: ['my-party'],
    queryFn: () => partyApi.getMyParty().then(r => r.data),
    retry: false,
    enabled: isRole('STUDENT'),
  })

  const { data: rules } = useQuery({
    queryKey: ['party-rules'],
    queryFn: () => partyApi.getRules().then(r => r.data),
    enabled: isRole('STUDENT'),
  })

  const applyMutation = useMutation({
    mutationFn: () => partyApi.applyToProject(party!.id, {
      projectId: id, rankPosition, proposalText
    }),
    onSuccess: () => {
      toast.success('Application submitted!')
      setApplyOpen(false)
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Failed to apply'),
  })

  if (isLoading) return (
    <div className="flex items-center justify-center py-24">
      <div className="w-6 h-6 border-2 border-ember-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  if (!project) return <p className="text-ink-400">Project not found.</p>

  return (
    <div className="animate-fade-up max-w-4xl">
      <button onClick={() => navigate(-1)} className="btn-ghost mb-6 -ml-2 text-ink-400">
        <ChevronLeft size={16} /> Back
      </button>

      {/* Header */}
      <div className="card p-6 mb-6">
        <div className="flex items-start gap-4 mb-4">
          <div className="w-12 h-12 rounded-2xl bg-ink-700 border border-ink-600/50 flex items-center justify-center font-display font-bold text-xl text-ink-200 flex-shrink-0">
            {project.companyName[0]}
          </div>
          <div className="flex-1">
            <div className="flex flex-wrap gap-2 mb-2">
              <span className={clsx('badge',
                project.status === 'OPEN' && 'badge-open',
                project.status === 'ASSIGNED' && 'badge-assigned',
                project.status === 'CLOSED' && 'badge-pending',
              )}>{project.status}</span>
              {project.companyIndustry && (
                <span className="badge bg-ink-700/50 text-ink-400 border-ink-600/30">{project.companyIndustry}</span>
              )}
            </div>
            <h1 className="font-display text-2xl font-bold text-white mb-1">{project.title}</h1>
            <div className="flex flex-wrap items-center gap-4 text-sm text-ink-400">
              <span className="flex items-center gap-1.5"><Building2 size={14} />{project.companyName}</span>
              <span className="flex items-center gap-1.5"><Users size={14} />{project.partyApplicationCount} party application{project.partyApplicationCount !== 1 ? 's' : ''}</span>
              {project.deadline && (
                <span className="flex items-center gap-1.5 text-amber-400">
                  <Clock size={14} />
                  Deadline: {format(new Date(project.deadline), 'dd MMM yyyy')}
                  <span className="text-ink-500">({formatDistanceToNow(new Date(project.deadline), { addSuffix: true })})</span>
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Tools */}
        {project.tools.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {project.tools.map(t => (
              <span key={t} className="px-2.5 py-1 rounded-lg bg-ink-700/60 text-ink-300 text-xs font-mono border border-ink-600/30">{t}</span>
            ))}
          </div>
        )}
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-5">
          {[
            { label: 'Description', content: project.description },
            { label: 'Project Scope', content: project.scope },
            { label: 'Expected Deliverables', content: project.deliverables },
            { label: 'Evaluation Criteria', content: project.evaluationCriteria },
          ].map(s => s.content ? (
            <div key={s.label} className="card p-5">
              <h3 className="font-display font-semibold text-white mb-3">{s.label}</h3>
              <p className="text-sm text-ink-300 leading-relaxed whitespace-pre-wrap">{s.content}</p>
            </div>
          ) : null)}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Apply card */}
          {isRole('STUDENT') && project.status === 'OPEN' && (
            <div className="card p-5">
              <h3 className="font-display font-semibold text-white mb-3">Apply for this project</h3>
              {!party ? (
                <p className="text-xs text-ink-400 mb-3">You need to be in a party before applying.</p>
              ) : party.members.length < (rules?.minSize ?? 2) ? (
                <p className="text-xs text-amber-400 mb-3">Your party needs at least {rules?.minSize ?? 2} members before applying.</p>
              ) : party.assignedProjectId ? (
                <p className="text-xs text-jade-400">Your party is already assigned to a project.</p>
              ) : !applyOpen ? (
                <button onClick={() => setApplyOpen(true)} className="btn-primary w-full">
                  <SendHorizonal size={15} /> Apply Now
                </button>
              ) : (
                <div className="space-y-3">
                  <div>
                    <label className="input-label">Priority rank</label>
                    <div className="flex gap-2">
                      {[1, 2, 3, 4, 5].map(n => (
                        <button key={n} type="button" onClick={() => setRankPosition(n)}
                          className={clsx('flex-1 py-2 rounded-xl text-sm font-bold border transition-all',
                            rankPosition === n
                              ? 'bg-ember-500 border-ember-500 text-white'
                              : 'bg-ink-800 border-ink-600/50 text-ink-400 hover:border-ink-500'
                          )}>
                          {n}
                        </button>
                      ))}
                    </div>
                    <p className="text-[10px] text-ink-500 mt-1">1 = top choice, 5 = lowest preference</p>
                  </div>
                  <div>
                    <label className="input-label">Proposal (optional)</label>
                    <textarea className="textarea" rows={3} maxLength={2000} value={proposalText}
                      onChange={e => setProposalText(e.target.value)}
                      placeholder="Why is your team a great fit for this project?" />
                    <p className="mt-1 text-right text-[10px] text-ink-500">{proposalText.length}/2000</p>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => setApplyOpen(false)} className="btn-secondary flex-1 text-xs">Cancel</button>
                    <button onClick={() => applyMutation.mutate()} disabled={applyMutation.isPending}
                      className="btn-primary flex-1 text-xs">
                      {applyMutation.isPending ? '…' : 'Submit'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Supervisor info */}
          {project.projectSupervisorName && (
            <div className="card p-5">
              <h3 className="font-display font-semibold text-white mb-3">Project Supervisor</h3>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-ink-700 flex items-center justify-center text-xs font-bold text-ink-200">
                  {project.projectSupervisorName[0]}
                </div>
                <p className="text-sm text-ink-200">{project.projectSupervisorName}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
