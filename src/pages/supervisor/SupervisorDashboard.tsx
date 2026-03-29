import { useQuery } from '@tanstack/react-query'
import { partyApi, submissionApi } from '../../api/services'
import { useAuth } from '../../contexts/AuthContext'
import { Users, Briefcase, Send, Clock } from 'lucide-react'
import { format } from 'date-fns'
import clsx from 'clsx'

export default function SupervisorDashboard() {
  const { user } = useAuth()

  const { data: parties, isLoading } = useQuery({
    queryKey: ['supervised-parties'],
    queryFn: () => partyApi.getSupervised().then(r => r.data)
  })

  const submissionQueries = useQuery({
    queryKey: ['supervised-submissions', parties?.map(p => p.id)],
    queryFn: async () => {
      const results: Record<string, any> = {}
      for (const p of parties ?? []) {
        try {
          const { data } = await submissionApi.get(p.id)
          results[p.id] = data
        } catch { /* no submission */ }
      }
      return results
    },
    enabled: !!parties && parties.length > 0,
  })

  const submissions = submissionQueries.data ?? {}

  return (
    <div className="animate-fade-up">
      <div className="page-header">
        <h1 className="page-title">Supervisor Dashboard</h1>
        <p className="page-subtitle">Welcome back, {user?.firstName}. Monitoring {parties?.length ?? 0} parties.</p>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <div className="w-6 h-6 border-2 border-ember-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : !parties || parties.length === 0 ? (
        <div className="card p-16 text-center">
          <Users size={32} className="text-ink-600 mx-auto mb-3" />
          <p className="text-ink-400 text-sm">No parties assigned to you yet.</p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-5">
          {parties.map(party => {
            const sub = submissions[party.id]
            return (
              <div key={party.id} className="card p-5">
                <div className="flex items-start gap-3 mb-4">
                  <div className="w-11 h-11 rounded-2xl bg-ink-700 border border-ink-600/50 flex items-center justify-center font-display font-bold text-lg text-ink-200 flex-shrink-0">
                    {party.name[0]}
                  </div>
                  <div>
                    <h2 className="font-display font-semibold text-white">{party.name}</h2>
                    <span className={clsx('badge text-[10px] mt-1',
                      party.status === 'FORMING' && 'badge-forming',
                      party.status === 'ACTIVE' && 'badge-active',
                      party.status === 'ASSIGNED' && 'badge-assigned',
                      party.status === 'SUBMITTED' && 'badge-submitted',
                    )}>{party.status}</span>
                  </div>
                </div>

                {/* Members */}
                <div className="mb-4">
                  <p className="text-xs font-semibold text-ink-500 uppercase tracking-wider mb-2">Members</p>
                  <div className="flex -space-x-1.5">
                    {party.members.map(m => (
                      <div key={m.id} title={`${m.firstName} ${m.lastName}`}
                        className="w-7 h-7 rounded-full bg-ink-700 border-2 border-ink-900 flex items-center justify-center text-[10px] font-bold text-ink-200">
                        {m.firstName[0]}{m.lastName[0]}
                      </div>
                    ))}
                    <span className="ml-3 text-xs text-ink-400 self-center">{party.members.length} members</span>
                  </div>
                </div>

                {/* Assigned project */}
                {party.assignedProjectTitle ? (
                  <div className="p-3 rounded-xl bg-jade-500/8 border border-jade-500/20 mb-3">
                    <p className="text-xs font-semibold text-jade-400 flex items-center gap-1.5 mb-0.5">
                      <Briefcase size={11} /> Project
                    </p>
                    <p className="text-xs text-ink-200">{party.assignedProjectTitle}</p>
                  </div>
                ) : (
                  <p className="text-xs text-ink-500 mb-3">No project assigned yet.</p>
                )}

                {/* Submission status */}
                {sub ? (
                  <div className="p-3 rounded-xl bg-ink-800/50 border border-ink-700/50">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-semibold text-ink-300 flex items-center gap-1.5">
                        <Send size={11} /> Submission
                      </p>
                      <span className={clsx('badge text-[10px]',
                        sub.status === 'DRAFT' && 'badge-pending',
                        sub.status === 'SUBMITTED' && 'badge-active',
                        sub.status === 'UNDER_EVALUATION' && 'badge-ember',
                        sub.status === 'EVALUATED' && 'badge-open',
                      )}>{sub.status?.replace('_', ' ')}</span>
                    </div>
                    {sub.repoUrl && (
                      <a href={sub.repoUrl} target="_blank" rel="noreferrer"
                        className="text-[10px] text-ember-400 hover:text-ember-300 truncate block mt-1">
                        {sub.repoUrl}
                      </a>
                    )}
                    {sub.submittedAt && (
                      <p className="text-[10px] text-ink-500 mt-1 flex items-center gap-1">
                        <Clock size={9} /> Submitted {format(new Date(sub.submittedAt), 'dd MMM yyyy')}
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-ink-500">No submission yet.</p>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
