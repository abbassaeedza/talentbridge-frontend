import { useParams, useNavigate, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { evaluationApi, projectApi, partyApi, submissionApi } from '../../api/services'
import EvaluationReportPanel from '../../components/evaluation/EvaluationReportPanel'
import { useState } from 'react'
import {
  ArrowLeft, FileText, Target, Package, Star,
  Wrench, Users, Clock, Calendar, Pencil, Tag
} from 'lucide-react'
import { format, formatDistanceToNow } from 'date-fns'
import clsx from 'clsx'

const STATUS_INFO: Record<string, { cls: string; label: string }> = {
  DRAFT:          { cls: 'bg-ink-700/50 text-ink-300 border border-ink-600/30', label: 'Draft' },
  OPEN:           { cls: 'bg-blue-500/15 text-blue-400 border border-blue-500/20',  label: 'Pending Assignment' },
  PENDING_REVIEW: { cls: 'badge-pending',                                            label: 'Pending Review' },
  ASSIGNED:       { cls: 'bg-jade-500/20 text-jade-400 border border-jade-500/30',  label: 'Live' },
  ARCHIVED:       { cls: 'bg-red-500/15 text-red-400 border border-red-500/20',     label: 'Rejected' },
  CLOSED:         { cls: 'bg-ink-700/50 text-ink-400 border border-ink-600/30',     label: 'Closed' },
}

function Section({ icon: Icon, label, children }: {
  icon: React.ElementType; label: string; children: React.ReactNode
}) {
  return (
    <div className="flex gap-4">
      <div className="w-8 h-8 rounded-lg bg-ink-800 border border-ink-700/50 flex items-center justify-center flex-shrink-0 mt-0.5">
        <Icon size={14} className="text-ink-400" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-bold text-ink-500 uppercase tracking-widest mb-1.5">{label}</p>
        <div className="text-sm text-ink-200 leading-relaxed">{children}</div>
      </div>
    </div>
  )
}

export default function CompanyProjectViewPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [expandedParty, setExpandedParty] = useState<string | null>(null)

  const { data: project, isLoading } = useQuery({
    queryKey: ['project', id],
    queryFn: () => projectApi.getById(id!).then(r => r.data),
    enabled: !!id,
  })

  const { data: applications } = useQuery({
    queryKey: ['company-project-applications', id],
    queryFn: () => partyApi.getApplicationsByProject(id!).then((response) => response.data),
    enabled: !!id,
  })

  const { data: selectedParty } = useQuery({
    queryKey: ['company-application-party', expandedParty],
    queryFn: () => partyApi.getById(expandedParty!).then((response) => response.data),
    enabled: !!expandedParty,
  })

  const { data: submissions } = useQuery({
    queryKey: ['company-project-submissions', id],
    queryFn: () => submissionApi.getByProject(id!).then(response => response.data),
    enabled: !!id,
    retry: false,
  })
  const submission = submissions?.[0]
  const { data: evaluationReport } = useQuery({
    queryKey: ['eval-report', submission?.id],
    queryFn: () => evaluationApi.getBySubmission(submission!.id).then(response => response.data),
    enabled: submission?.status === 'EVALUATED',
    retry: false,
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="w-6 h-6 border-2 border-ember-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!project) {
    return (
      <div className="text-center py-24">
        <p className="text-ink-400">Project not found.</p>
        <Link to="/company/projects" className="btn-secondary mt-4 inline-flex">Back to Projects</Link>
      </div>
    )
  }

  const p = project as any
  const { cls, label } = STATUS_INFO[project.status as string] ?? { cls: 'badge-pending', label: project.status }
  const canEdit = project.status === 'DRAFT' || project.status === 'PENDING_REVIEW' || project.status === 'ARCHIVED'

  return (
    <div className="animate-fade-up max-w-4xl">
      {/* Back + actions */}
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={() => navigate('/company/projects')}
          className="flex items-center gap-2 text-sm text-ink-400 hover:text-ink-100 transition-colors"
        >
          <ArrowLeft size={15} /> Back to Projects
        </button>

        {canEdit && (
          <Link
            to={`/company/projects/${id}/edit`}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-ember-500/10 hover:bg-ember-500/20 border border-ember-500/30 text-xs text-ember-400 hover:text-ember-300 transition-colors"
          >
            <Pencil size={13} />
            {project.status === 'ARCHIVED' ? 'Edit & Resubmit' : 'Edit'}
          </Link>
        )}
      </div>

      {/* Header card */}
      <div className="card px-6 py-5 mb-5">
        <div className="flex items-start justify-between gap-4 mb-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2.5 flex-wrap mb-2">
              <span className={clsx('badge text-[10px]', cls)}>{label}</span>
              {p.internalName && (
                <span className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-ember-500/10 border border-ember-500/20 text-[10px] text-ember-400 font-semibold">
                  <Tag size={9} /> {p.internalName}
                </span>
              )}
            </div>
            <h1 className="font-display font-bold text-2xl text-white leading-tight">{project.title}</h1>
            <p className="text-sm text-ink-500 mt-1">{p.companyName}</p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 pt-4 border-t border-ink-800/50">
          <div className="text-center">
            <p className="text-xl font-display font-bold text-white">{project.partyApplicationCount}</p>
            <p className="text-[10px] text-ink-500 mt-0.5 flex items-center justify-center gap-1">
              <Users size={10} /> Applicants
            </p>
          </div>
          <div className="text-center">
            <p className="text-sm font-semibold text-white">
              {project.deadline ? format(new Date(project.deadline), 'dd MMM yyyy') : '—'}
            </p>
            <p className="text-[10px] text-ink-500 mt-0.5 flex items-center justify-center gap-1">
              <Clock size={10} /> Deadline
            </p>
          </div>
          <div className="text-center">
            <p className="text-sm font-semibold text-white">
              {format(new Date(project.createdAt), 'dd MMM yyyy')}
            </p>
            <p className="text-[10px] text-ink-500 mt-0.5 flex items-center justify-center gap-1">
              <Calendar size={10} /> Posted
            </p>
          </div>
        </div>

        {project.status === 'ARCHIVED' && (
          <div className="mt-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20">
            <p className="text-xs text-red-400">
              This project was rejected by the coordinator. Edit and resubmit to go live again.
            </p>
          </div>
        )}
      </div>

      {/* Detail card */}
      <div className="card px-6 py-6 space-y-6">
        {project.description && (
          <Section icon={FileText} label="Description">
            {project.description}
          </Section>
        )}

        {project.scope && (
          <Section icon={Target} label="Scope">
            {project.scope}
          </Section>
        )}

        {project.deliverables && (
          <Section icon={Package} label="Deliverables">
            {project.deliverables}
          </Section>
        )}

        {project.evaluationCriteria && (
          <Section icon={Star} label="Evaluation Criteria">
            {project.evaluationCriteria}
          </Section>
        )}

        {(project.tools ?? []).length > 0 && (
          <Section icon={Wrench} label="Tools & Technologies">
            <div className="flex flex-wrap gap-1.5 mt-1">
              {project.tools.map((t: string) => (
                <span key={t} className="px-2.5 py-1 rounded-lg bg-ink-700 border border-ink-600/40 text-xs text-ink-200">
                  {t}
                </span>
              ))}
            </div>
          </Section>
        )}
      </div>

      <div className='card mt-5 overflow-hidden'>
        <div className='border-b border-ink-800/50 px-6 py-4'>
          <h2 className='font-display font-semibold text-white'>Party Applications</h2>
          <p className='mt-1 text-xs text-ink-400'>Review applicants and open each student’s full profile.</p>
        </div>
        {!applications || applications.length === 0 ? (
          <p className='p-6 text-sm text-ink-400'>No party applications yet.</p>
        ) : (
          <div className='divide-y divide-ink-800/50'>
            {applications.map((application) => (
              <div key={application.id} className='px-6 py-4'>
                <div className='flex items-center gap-3'>
                  <span className='flex h-8 w-8 items-center justify-center rounded-lg bg-ink-700 text-sm font-bold text-ember-400'>#{application.rankPosition}</span>
                  <div className='flex-1'>
                    <p className='text-sm font-semibold text-ink-100'>{application.partyName}</p>
                    <p className='text-xs text-ink-500'>{application.status.replace('_', ' ')}</p>
                  </div>
                  <button onClick={() => setExpandedParty(expandedParty === application.partyId ? null : application.partyId)} className='btn-secondary px-3 py-2 text-xs'>
                    {expandedParty === application.partyId ? 'Hide team' : 'View team'}
                  </button>
                </div>
                {expandedParty === application.partyId && selectedParty?.id === application.partyId && (
                  <div className='mt-4 grid gap-2 sm:grid-cols-2'>
                    {selectedParty.members.map((member) => (
                      <Link key={member.id} to={`/company/students/${member.id}`} className='rounded-xl border border-ink-700/40 bg-ink-800/50 p-3 hover:border-ember-500/30'>
                        <p className='text-sm font-medium text-ink-100'>{member.firstName} {member.lastName}</p>
                        <p className='mt-1 text-xs text-ink-500'>{member.email}</p>
                        <div className='mt-2 flex flex-wrap gap-1'>
                          {member.skills.slice(0, 3).map((skill) => <span key={skill} className='rounded bg-ink-700 px-1.5 py-0.5 text-[10px] text-ink-300'>{skill}</span>)}
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
      {evaluationReport && (
        <div className='card mt-5 overflow-hidden'>
          <EvaluationReportPanel report={evaluationReport} />
        </div>
      )}
    </div>
  )
}
