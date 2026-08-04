import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { partyApi, projectApi, userApi } from '../../api/services';
import type { Party } from '../../types';
import { getUserName } from '../../types';
import DeadlineCountdown from '../../components/shared/DeadlineCountdown';
import {
  ArrowRight,
  Briefcase,
  Clock,
  Edit3,
  Search,
  Trash2,
  UserCog,
  Users,
  XCircle,
} from 'lucide-react';
import toast from 'react-hot-toast';
import clsx from 'clsx';
import { Link, useSearchParams } from 'react-router-dom';

export default function ManagePartiesPage() {
  const qc = useQueryClient();
  const [searchParams] = useSearchParams();
  const linkedPartyId = searchParams.get('party');
  const [query, setQuery] = useState('');
  const [assignProject, setAssignProject] = useState<Record<string, string>>({});
  const [assignSup, setAssignSup] = useState<Record<string, string>>({});
  const [renameDraft, setRenameDraft] = useState<Record<string, string>>({});
  const [deadlineDraft, setDeadlineDraft] = useState<Record<string, string>>({});
  const [expandedParty, setExpandedParty] = useState<string | null>(linkedPartyId);

  useEffect(() => {
    if (linkedPartyId) setExpandedParty(linkedPartyId);
  }, [linkedPartyId]);

  const { data: parties, isLoading } = useQuery({
    queryKey: ['all-parties'],
    queryFn: () => partyApi.getAll().then((r) => r.data),
  });

  const { data: openProjects } = useQuery({
    queryKey: ['open-projects-assign'],
    queryFn: () => projectApi.getOpen({ page: 0, size: 100 }).then((r) => r.data),
  });

  const { data: supervisors } = useQuery({
    queryKey: ['party-supervisors'],
    queryFn: () => userApi.getSupervisors().then((r) => r.data.filter((u) =>
      u.role === 'PARTY_SUPERVISOR' && u.status === 'APPROVED')),
  });

  const { data: rules } = useQuery({
    queryKey: ['party-rules'],
    queryFn: () => partyApi.getRules().then((r) => r.data),
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['all-parties'] });
    qc.invalidateQueries({ queryKey: ['open-projects-assign'] });
  };

  const assignMutation = useMutation({
    mutationFn: ({ projectId, partyId }: { projectId: string; partyId: string }) =>
      projectApi.assign(projectId, partyId),
    onSuccess: () => { toast.success('Project assigned'); invalidate(); },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Failed to assign project'),
  });

  const supMutation = useMutation({
    mutationFn: ({ partyId, supervisorId }: { partyId: string; supervisorId: string }) =>
      partyApi.assignSupervisor(partyId, supervisorId),
    onSuccess: () => { toast.success('Supervisor assigned'); invalidate(); },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Failed to assign supervisor'),
  });

  const renameMutation = useMutation({
    mutationFn: ({ partyId, name }: { partyId: string; name: string }) => partyApi.rename(partyId, name),
    onSuccess: () => { toast.success('Party renamed'); invalidate(); },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Failed to rename party'),
  });

  const removeMemberMutation = useMutation({
    mutationFn: ({ partyId, userId }: { partyId: string; userId: string }) => partyApi.removeMember(partyId, userId),
    onSuccess: () => { toast.success('Member removed'); invalidate(); },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Failed to remove member'),
  });

  const unassignMutation = useMutation({
    mutationFn: (partyId: string) => partyApi.unassignProject(partyId),
    onSuccess: () => { toast.success('Project unassigned'); invalidate(); },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Failed to unassign project'),
  });

  const deadlineMutation = useMutation({
    mutationFn: ({ projectId, deadline }: { projectId: string; deadline: string }) =>
      projectApi.setDeadline(projectId, deadline),
    onSuccess: () => {
      toast.success('Project deadline updated');
      invalidate();
      qc.invalidateQueries({ queryKey: ['all-projects-admin'] });
    },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Failed to update deadline'),
  });

  const { data: appsByParty } = useQuery({
    queryKey: ['apps-expanded', expandedParty],
    queryFn: () => expandedParty ? partyApi.getApplicationsByParty(expandedParty).then((r) => r.data) : Promise.resolve([]),
    enabled: !!expandedParty,
  });

  const filteredParties = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return (parties ?? []).filter((party) => {
      if (!needle) return true;
      return [
        party.name,
        party.status,
        party.assignedProjectTitle,
        party.supervisorName,
        party.leader?.firstName,
        party.leader?.lastName,
        ...party.members.flatMap((m) => [m.firstName, m.lastName, m.email]),
      ].filter(Boolean).join(' ').toLowerCase().includes(needle);
    });
  }, [parties, query]);

  const statusClass = (party: Party) => clsx('badge text-[10px]',
    party.status === 'FORMING' && 'badge-forming',
    party.status === 'ACTIVE' && 'badge-active',
    party.status === 'ASSIGNED' && 'badge-assigned',
    party.status === 'SUBMITTED' && 'badge-submitted',
    party.status === 'COMPLETED' && 'badge-open',
  );

  const supervisorsFor = (party: Party) => (supervisors ?? []).filter((supervisor) => {
    if (supervisor.id === party.supervisorId) return true;
    const count = (parties ?? []).filter((candidate) =>
      candidate.id !== party.id
      && candidate.supervisorId === supervisor.id
      && candidate.semester === party.semester
      && candidate.academicYear === party.academicYear,
    ).length;
    return count < (rules?.supervisorMaxParties ?? 2);
  });

  return (
    <div className='animate-fade-up'>
      <div className='page-header'>
        <h1 className='page-title'>Manage Parties</h1>
        <p className='page-subtitle'>{filteredParties.length} of {parties?.length ?? 0} parties shown</p>
      </div>

      <div className='card p-4 mb-5'>
        <div className='relative'>
          <Search size={15} className='absolute left-3 top-1/2 -translate-y-1/2 text-ink-500' />
          <input
            className='input pl-9'
            placeholder='Search parties, members, supervisors, projects…'
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </div>

      <div className='space-y-3'>
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className='card p-4 animate-pulse h-20' />
          ))
        ) : filteredParties.length === 0 ? (
          <div className='card p-16 text-center'>
            <Users size={32} className='text-ink-600 mx-auto mb-3' />
            <p className='text-ink-400 text-sm'>No parties match your search.</p>
          </div>
        ) : filteredParties.map((party) => (
          <div key={party.id} id={`party-${party.id}`} className={clsx('card overflow-hidden', linkedPartyId === party.id && 'ring-1 ring-ember-500/60')}>
            <div className='px-5 py-4 flex items-start gap-4'>
              <div className='w-10 h-10 rounded-xl bg-ink-700 flex items-center justify-center font-display font-bold text-ink-200 flex-shrink-0'>
                {party.name[0]}
              </div>
              <div className='flex-1 min-w-0'>
                <div className='flex items-center gap-2 flex-wrap'>
                  <h3 className='font-semibold text-white text-sm'>{party.name}</h3>
                  <span className={statusClass(party)}>{party.status}</span>
                  {party.semester && <span className='text-[10px] text-ink-500'>{party.semester} {party.academicYear}</span>}
                </div>
                <p className='text-xs text-ink-400 mt-1'>
                  {party.members.length} members · Leader: {party.leader?.firstName} {party.leader?.lastName}
                  {party.supervisorName && ` · Supervisor: ${party.supervisorName}`}
                </p>
                {party.assignedProjectTitle && (
                  <div className='mt-2 flex flex-wrap items-center gap-2'>
                    <p className='text-xs text-jade-400 flex items-center gap-1'>
                      <Briefcase size={10} /> {party.assignedProjectTitle}
                    </p>
                    <DeadlineCountdown deadline={party.assignedProjectDeadline ?? null} compact />
                  </div>
                )}
              </div>

              <div className='flex items-center gap-2 flex-shrink-0 flex-wrap justify-end'>
                <button
                  onClick={() => setExpandedParty(expandedParty === party.id ? null : party.id)}
                  className='btn-ghost text-xs gap-1'
                >
                  <Users size={13} /> Details
                </button>
                {party.assignedProjectId && (
                  <button
                    onClick={() => {
                      if (confirm('Unassign this project from the party?')) unassignMutation.mutate(party.id);
                    }}
                    disabled={unassignMutation.isPending}
                    className='btn-secondary text-xs px-3 py-1.5 text-red-300'
                  >
                    <XCircle size={13} /> Unassign
                  </button>
                )}
              </div>
            </div>

            <div className='px-5 pb-4 grid lg:grid-cols-2 xl:grid-cols-4 gap-3 border-t border-ink-800/50 pt-3'>
              <div className='flex gap-2'>
                <input
                  className='input text-xs py-1.5 flex-1'
                  placeholder='Rename party…'
                  maxLength={100}
                  value={renameDraft[party.id] ?? ''}
                  onChange={(e) => setRenameDraft((d) => ({ ...d, [party.id]: e.target.value }))}
                />
                <button
                  onClick={() => renameMutation.mutate({ partyId: party.id, name: renameDraft[party.id] })}
                  disabled={!renameDraft[party.id]?.trim() || renameMutation.isPending}
                  className='btn-secondary text-xs px-3 py-1.5'
                >
                  <Edit3 size={13} /> Rename
                </button>
              </div>

              {!party.assignedProjectId && party.status !== 'FORMING' && (
                <div className='flex gap-2'>
                  <select
                    className='input flex-1 text-xs py-1.5'
                    value={assignProject[party.id] ?? ''}
                    onChange={(e) => setAssignProject((d) => ({ ...d, [party.id]: e.target.value }))}
                  >
                    <option value=''>Assign project…</option>
                    {openProjects?.content.map((p) => (
                      <option key={p.id} value={p.id}>{p.title}</option>
                    ))}
                  </select>
                  <button
                    onClick={() => assignMutation.mutate({ projectId: assignProject[party.id], partyId: party.id })}
                    disabled={!assignProject[party.id] || assignMutation.isPending}
                    className='btn-primary text-xs px-3 py-1.5'
                  >
                    Assign
                  </button>
                </div>
              )}

              <div className='flex gap-2'>
                <select
                  className='input flex-1 text-xs py-1.5'
                  value={assignSup[party.id] ?? ''}
                  onChange={(e) => setAssignSup((d) => ({ ...d, [party.id]: e.target.value }))}
                >
                  <option value=''>Assign party supervisor…</option>
                  {supervisorsFor(party).map((s) => (
                    <option key={s.id} value={s.id}>{getUserName(s)}</option>
                  ))}
                </select>
                <button
                  onClick={() => supMutation.mutate({ partyId: party.id, supervisorId: assignSup[party.id] })}
                  disabled={!assignSup[party.id] || supMutation.isPending}
                  className='btn-secondary text-xs px-3 py-1.5'
                >
                  <UserCog size={13} /> Assign
                </button>
              </div>

              {party.assignedProjectId && (
                <div className='flex gap-2'>
                  <input
                    type='datetime-local'
                    aria-label={`Deadline for party ${party.name}`}
                    className='input flex-1 text-xs py-1.5'
                    value={deadlineDraft[party.id] ?? ''}
                    onChange={(e) => setDeadlineDraft((draft) => ({ ...draft, [party.id]: e.target.value }))}
                  />
                  <button
                    aria-label={`Update deadline for party ${party.name}`}
                    onClick={() => deadlineMutation.mutate({
                      projectId: party.assignedProjectId!,
                      deadline: deadlineDraft[party.id],
                    })}
                    disabled={!deadlineDraft[party.id] || deadlineMutation.isPending}
                    className='btn-secondary text-xs px-3 py-1.5'
                  >
                    <Clock size={13} /> Set
                  </button>
                </div>
              )}
            </div>

            {expandedParty === party.id && (
              <div className='border-t border-ink-800/50 px-5 py-4 grid lg:grid-cols-2 gap-4'>
                <div>
                  <p className='text-xs font-semibold text-ink-400 uppercase tracking-wider mb-2'>Members</p>
                  <div className='space-y-2'>
                    {party.members.map((m) => {
                      const isLeader = party.leader?.id === m.id;
                      return (
                        <div key={m.id} className='flex items-center gap-3 p-2 rounded-lg bg-ink-800/50'>
                          <div className='w-8 h-8 rounded-lg bg-ink-700 flex items-center justify-center text-xs font-bold text-ink-200'>
                            {m.firstName[0]}{m.lastName[0]}
                          </div>
                          <div className='flex-1 min-w-0'>
                            <Link to={`/coordinator/students/${m.id}`} className='text-xs font-medium text-ink-100 hover:text-ember-400'>
                              {m.firstName} {m.lastName} {isLeader && <span className='text-ember-400'>(leader)</span>}
                            </Link>
                            <p className='text-[10px] text-ink-500 truncate'>{m.email}</p>
                          </div>
                          <button
                            onClick={() => {
                              if (confirm(`Remove ${m.firstName} ${m.lastName} from ${party.name}?`)) {
                                removeMemberMutation.mutate({ partyId: party.id, userId: m.id });
                              }
                            }}
                            disabled={removeMemberMutation.isPending || party.members.length <= 1}
                            className='text-red-400 hover:text-red-300 disabled:opacity-40'
                            title='Remove member'
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <p className='text-xs font-semibold text-ink-400 uppercase tracking-wider mb-2'>Applications</p>
                  {!appsByParty || appsByParty.length === 0 ? (
                    <p className='text-xs text-ink-500'>No applications submitted.</p>
                  ) : (
                    <div className='space-y-2'>
                      {appsByParty.sort((a, b) => a.rankPosition - b.rankPosition).map((app) => (
                        <div key={app.id} className='flex items-center gap-3 p-2 rounded-lg bg-ink-800/50'>
                          <span className='w-6 h-6 rounded-md bg-ink-700 flex items-center justify-center text-xs font-bold text-ember-400'>
                            {app.rankPosition}
                          </span>
                          <div className='flex-1'>
                            <p className='text-xs font-medium text-ink-100'>{app.projectTitle}</p>
                            <p className='text-[10px] text-ink-500'>{app.companyName}</p>
                          </div>
                          <span className={clsx('badge text-[10px]',
                            app.status === 'PENDING' && 'badge-pending',
                            app.status === 'ASSIGNED' && 'badge-active',
                            app.status === 'REASSIGNED' && 'badge-ember',
                            app.status === 'WITHDRAWN' && 'bg-ink-700/50 text-ink-400 border-ink-600/30',
                          )}>{app.status}</span>
                          {app.status === 'PENDING' && !party.assignedProjectId && (
                            <button
                              onClick={() => assignMutation.mutate({ projectId: app.projectId, partyId: party.id })}
                              className='flex items-center gap-1 px-2 py-1 rounded-lg bg-jade-500/15 border border-jade-500/30 text-jade-400 text-[10px] font-medium hover:bg-jade-500/25'
                            >
                              <ArrowRight size={10} /> Assign this
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
