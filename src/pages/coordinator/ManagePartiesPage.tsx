import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { partyApi, projectApi, userApi } from '../../api/services'
import { Users, Briefcase, UserCog, ArrowRight } from 'lucide-react'
import toast from 'react-hot-toast'
import clsx from 'clsx'

export default function ManagePartiesPage() {
  const qc = useQueryClient()
  const [assignProject, setAssignProject] = useState<Record<string, string>>({})
  const [assignSup, setAssignSup] = useState<Record<string, string>>({})
  const [expandedParty, setExpandedParty] = useState<string | null>(null)

  const { data: parties, isLoading } = useQuery({
    queryKey: ['all-parties'],
    queryFn: () => partyApi.getAll().then(r => r.data)
  })

  const { data: openProjects } = useQuery({
    queryKey: ['open-projects-assign'],
    queryFn: () => projectApi.getOpen({ page: 0, size: 100 }).then(r => r.data)
  })

  const { data: supervisors } = useQuery({
    queryKey: ['supervisors'],
    queryFn: () => userApi.getPending(0, 1).then(() => null), // placeholder
    retry: false,
    enabled: false,
  })

  const assignMutation = useMutation({
    mutationFn: ({ projectId, partyId }: { projectId: string; partyId: string }) =>
      projectApi.assign(projectId, partyId),
    onSuccess: () => { toast.success('Project assigned!'); qc.invalidateQueries({ queryKey: ['all-parties'] }) },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Failed'),
  })

  const supMutation = useMutation({
    mutationFn: ({ partyId, supervisorId }: { partyId: string; supervisorId: string }) =>
      partyApi.assignSupervisor(partyId, supervisorId),
    onSuccess: () => { toast.success('Supervisor assigned!'); qc.invalidateQueries({ queryKey: ['all-parties'] }) },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Failed'),
  })

  const { data: appsByProject } = useQuery({
    queryKey: ['apps-expanded', expandedParty],
    queryFn: () => {
      const party = parties?.find(p => p.id === expandedParty)
      return party ? partyApi.getApplicationsByParty(party.id).then(r => r.data) : Promise.resolve([])
    },
    enabled: !!expandedParty,
  })

  return (
    <div className="animate-fade-up">
      <div className="page-header">
        <h1 className="page-title">Manage Parties</h1>
        <p className="page-subtitle">{parties?.length ?? 0} parties registered</p>
      </div>

      <div className="space-y-3">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="card p-4 animate-pulse h-16" />
          ))
        ) : parties?.map(party => (
          <div key={party.id} className="card overflow-hidden">
            <div className="px-5 py-4 flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-ink-700 flex items-center justify-center font-display font-bold text-ink-200 flex-shrink-0">
                {party.name[0]}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-white text-sm">{party.name}</h3>
                  <span className={clsx('badge text-[10px]',
                    party.status === 'FORMING' && 'badge-forming',
                    party.status === 'ACTIVE' && 'badge-active',
                    party.status === 'ASSIGNED' && 'badge-assigned',
                    party.status === 'SUBMITTED' && 'badge-submitted',
                  )}>{party.status}</span>
                </div>
                <p className="text-xs text-ink-400">
                  {party.members.length} members ·
                  Leader: {party.leader?.firstName} {party.leader?.lastName}
                  {party.supervisorName && ` · Supervisor: ${party.supervisorName}`}
                </p>
                {party.assignedProjectTitle && (
                  <p className="text-xs text-jade-400 mt-0.5 flex items-center gap-1">
                    <Briefcase size={10} /> {party.assignedProjectTitle}
                  </p>
                )}
              </div>

              <div className="flex items-center gap-2 flex-shrink-0">
                <button onClick={() => setExpandedParty(expandedParty === party.id ? null : party.id)}
                  className="btn-ghost text-xs gap-1">
                  <Users size={13} /> Applications
                </button>
              </div>
            </div>

            {/* Assign project */}
            {!party.assignedProjectId && party.status !== 'FORMING' && (
              <div className="px-5 pb-4 flex items-center gap-2 border-t border-ink-800/50 pt-3">
                <Briefcase size={14} className="text-ink-400" />
                <select className="input flex-1 text-xs py-1.5"
                  value={assignProject[party.id] ?? ''}
                  onChange={e => setAssignProject(d => ({ ...d, [party.id]: e.target.value }))}>
                  <option value="">Assign a project…</option>
                  {openProjects?.content.map(p => (
                    <option key={p.id} value={p.id}>{p.title}</option>
                  ))}
                </select>
                <button
                  onClick={() => assignMutation.mutate({ projectId: assignProject[party.id], partyId: party.id })}
                  disabled={!assignProject[party.id] || assignMutation.isPending}
                  className="btn-primary text-xs px-3 py-1.5">
                  Assign
                </button>
              </div>
            )}

            {/* Applications expansion */}
            {expandedParty === party.id && appsByProject && (
              <div className="border-t border-ink-800/50 px-5 py-3">
                <p className="text-xs font-semibold text-ink-400 uppercase tracking-wider mb-2">Applications</p>
                {appsByProject.length === 0 ? (
                  <p className="text-xs text-ink-500">No applications submitted.</p>
                ) : (
                  <div className="space-y-2">
                    {appsByProject.sort((a, b) => a.rankPosition - b.rankPosition).map(app => (
                      <div key={app.id} className="flex items-center gap-3 p-2 rounded-lg bg-ink-800/50">
                        <span className="w-6 h-6 rounded-md bg-ink-700 flex items-center justify-center text-xs font-bold text-ember-400">
                          {app.rankPosition}
                        </span>
                        <div className="flex-1">
                          <p className="text-xs font-medium text-ink-100">{app.projectTitle}</p>
                          <p className="text-[10px] text-ink-500">{app.companyName}</p>
                        </div>
                        <span className={clsx('badge text-[10px]',
                          app.status === 'PENDING' && 'badge-pending',
                          app.status === 'ASSIGNED' && 'badge-active',
                          app.status === 'REASSIGNED' && 'badge-ember',
                        )}>{app.status}</span>
                        {app.status === 'PENDING' && !party.assignedProjectId && (
                          <button
                            onClick={() => assignMutation.mutate({ projectId: app.projectId, partyId: party.id })}
                            className="flex items-center gap-1 px-2 py-1 rounded-lg bg-jade-500/15 border border-jade-500/30 text-jade-400 text-[10px] font-medium hover:bg-jade-500/25">
                            <ArrowRight size={10} /> Assign this
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
