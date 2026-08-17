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
  Trash2,
  UserCog,
  Users,
  XCircle,
} from 'lucide-react';
import toast from 'react-hot-toast';
import clsx from 'clsx';
import { Link, useSearchParams } from 'react-router-dom';
import { Button } from '@heroui/react/button';
import { Input } from '@heroui/react/input';
import { ListBox } from '@heroui/react/list-box';
import { Select } from '@heroui/react/select';
import { Spinner } from '@heroui/react/spinner';
import { EmptyState, ListToolbar, PageHeader, StatusBadge } from '../../components/ui/TalentBridgeUI';
import DateTimePicker from '../../components/ui/DateTimePicker';

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
    <div className=''>
      <PageHeader title='Parties' description={`${filteredParties.length} of ${parties?.length ?? 0} parties shown`} />

      <ListToolbar searchLabel='Search parties' placeholder='Search parties, members, supervisors, or projects' value={query} onChange={setQuery} />

      <div className='space-y-3'>
        {isLoading ? (
          <div className='flex min-h-48 items-center justify-center'><Spinner /></div>
        ) : filteredParties.length === 0 ? (
          <EmptyState icon={Users} title='No parties match your search' />
        ) : filteredParties.map((party) => (
          <div key={party.id} id={`party-${party.id}`} className={clsx('rounded-lg border border-border bg-surface overflow-hidden', linkedPartyId === party.id && 'ring-1 ring-foreground')}>
            <div className='px-5 py-4 flex items-start gap-4'>
              <div className='w-10 h-10 rounded-lg bg-default flex items-center justify-center  font-bold text-foreground flex-shrink-0'>
                {party.name[0]}
              </div>
              <div className='flex-1 min-w-0'>
                <div className='flex items-center gap-2 flex-wrap'>
                  <h3 className='font-semibold text-foreground text-sm'>{party.name}</h3>
                  <StatusBadge status={party.status} />
                  {party.semester && <span className='text-[10px] text-muted'>{party.semester} {party.academicYear}</span>}
                </div>
                <p className='text-xs text-muted mt-1'>
                  {party.members.length} members · Leader: {party.leader?.firstName} {party.leader?.lastName}
                  {party.supervisorName && ` · Supervisor: ${party.supervisorName}`}
                </p>
                {party.assignedProjectTitle && (
                  <div className='mt-2 flex flex-wrap items-center gap-2'>
                    <p className='text-xs text-foreground flex items-center gap-1'>
                      <Briefcase size={10} /> {party.assignedProjectTitle}
                    </p>
                    <DeadlineCountdown deadline={party.assignedProjectDeadline ?? null} compact />
                  </div>
                )}
              </div>

              <div className='flex items-center gap-2 flex-shrink-0 flex-wrap justify-end'>
                <Button size='sm' variant='ghost' onPress={() => setExpandedParty(expandedParty === party.id ? null : party.id)}>
                  <Users size={13} /> Details
                </Button>
                {party.assignedProjectId && (
                  <Button size='sm' variant='danger-soft'
                    onPress={() => {
                      if (confirm('Unassign this project from the party?')) unassignMutation.mutate(party.id);
                    }}
                    isDisabled={unassignMutation.isPending}
                  >
                    <XCircle size={13} /> Unassign
                  </Button>
                )}
              </div>
            </div>

            <div className='grid items-end gap-3 border-t border-border px-5 pb-4 pt-3 lg:grid-cols-2 xl:grid-cols-4'>
              <div className='flex min-w-0 items-end gap-2'>
                <Input fullWidth
                  className='flex-1 text-xs'
                  placeholder='Rename party…'
                  maxLength={100}
                  value={renameDraft[party.id] ?? ''}
                  onChange={(e) => setRenameDraft((d) => ({ ...d, [party.id]: e.target.value }))}
                />
                <Button size='sm' variant='secondary' onPress={() => renameMutation.mutate({ partyId: party.id, name: renameDraft[party.id] })} isDisabled={!renameDraft[party.id]?.trim() || renameMutation.isPending}>
                  <Edit3 size={13} /> Rename
                </Button>
              </div>

              {!party.assignedProjectId && party.status !== 'FORMING' && (
                <div className='flex min-w-0 items-end gap-2'>
                  <CompactSelect label='Assign project' value={assignProject[party.id] ?? ''} onChange={(value) => setAssignProject((draft) => ({ ...draft, [party.id]: value }))} options={(openProjects?.content ?? []).map((project) => ({ id: project.id, label: project.title }))} />
                  <Button size='sm' variant='primary' onPress={() => assignMutation.mutate({ projectId: assignProject[party.id], partyId: party.id })} isDisabled={!assignProject[party.id] || assignMutation.isPending}>
                    Assign
                  </Button>
                </div>
              )}

              <div className='flex min-w-0 items-end gap-2'>
                <CompactSelect label='Assign party supervisor' value={assignSup[party.id] ?? ''} onChange={(value) => setAssignSup((draft) => ({ ...draft, [party.id]: value }))} options={supervisorsFor(party).map((supervisor) => ({ id: supervisor.id, label: getUserName(supervisor) }))} />
                <Button size='sm' variant='secondary' onPress={() => supMutation.mutate({ partyId: party.id, supervisorId: assignSup[party.id] })} isDisabled={!assignSup[party.id] || supMutation.isPending}>
                  <UserCog size={13} /> Assign
                </Button>
              </div>

              {party.assignedProjectId && (
                <div className='flex min-w-0 items-end gap-2'>
                  <DateTimePicker label={`Deadline for party ${party.name}`} className='min-w-0 flex-1' value={deadlineDraft[party.id] ?? party.assignedProjectDeadline?.slice(0, 19) ?? ''} onChange={(value) => setDeadlineDraft((draft) => ({ ...draft, [party.id]: value }))} />
                  <Button size='sm' variant='secondary'
                    aria-label={`Update deadline for party ${party.name}`}
                    onPress={() => deadlineMutation.mutate({
                      projectId: party.assignedProjectId!,
                      deadline: deadlineDraft[party.id] ?? party.assignedProjectDeadline?.slice(0, 19) ?? '',
                    })}
                    isDisabled={!(deadlineDraft[party.id] ?? party.assignedProjectDeadline) || deadlineMutation.isPending}
                  >
                    <Clock size={13} /> Set
                  </Button>
                </div>
              )}
            </div>

            {expandedParty === party.id && (
              <div className='border-t border-border px-5 py-4 grid lg:grid-cols-2 gap-4'>
                <div>
                  <p className='text-xs font-semibold text-muted uppercase tracking-wider mb-2'>Members</p>
                  <div className='space-y-2'>
                    {party.members.map((m) => {
                      const isLeader = party.leader?.id === m.id;
                      return (
                        <div key={m.id} className='flex items-center gap-3 p-2 rounded-lg bg-surface-secondary'>
                          <div className='w-8 h-8 rounded-lg bg-default flex items-center justify-center text-xs font-bold text-foreground'>
                            {m.firstName[0]}{m.lastName[0]}
                          </div>
                          <div className='flex-1 min-w-0'>
                            <Link to={`/coordinator/students/${m.id}`} className='text-xs font-medium text-foreground hover:text-accent'>
                              {m.firstName} {m.lastName} {isLeader && <span className='text-accent'>(leader)</span>}
                            </Link>
                            <p className='text-[10px] text-muted truncate'>{m.email}</p>
                          </div>
                          <Button isIconOnly size='sm' variant='ghost'
                            onPress={() => {
                              if (confirm(`Remove ${m.firstName} ${m.lastName} from ${party.name}?`)) {
                                removeMemberMutation.mutate({ partyId: party.id, userId: m.id });
                              }
                            }}
                            isDisabled={removeMemberMutation.isPending || party.members.length <= 1}
                            aria-label={`Remove ${m.firstName} ${m.lastName}`}
                          >
                            <Trash2 size={14} />
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <p className='text-xs font-semibold text-muted uppercase tracking-wider mb-2'>Applications</p>
                  {!appsByParty || appsByParty.length === 0 ? (
                    <p className='text-xs text-muted'>No applications submitted.</p>
                  ) : (
                    <div className='space-y-2'>
                      {appsByParty.sort((a, b) => a.rankPosition - b.rankPosition).map((app) => (
                        <div key={app.id} className='flex items-center gap-3 p-2 rounded-lg bg-surface-secondary'>
                          <span className='w-6 h-6 rounded-md bg-default flex items-center justify-center text-xs font-bold text-accent'>
                            {app.rankPosition}
                          </span>
                          <div className='flex-1'>
                            <p className='text-xs font-medium text-foreground'>{app.projectTitle}</p>
                            <p className='text-[10px] text-muted'>{app.companyName}</p>
                          </div>
                          <StatusBadge status={app.status} />
                          {app.status === 'PENDING' && !party.assignedProjectId && (
                            <Button size='sm' variant='secondary' onPress={() => assignMutation.mutate({ projectId: app.projectId, partyId: party.id })}>
                              <ArrowRight size={10} /> Assign this
                            </Button>
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

function CompactSelect({ label, value, options, onChange }: { label: string; value: string; options: { id: string; label: string }[]; onChange: (value: string) => void }) {
  return <Select.Root className='min-w-0 flex-1' aria-label={label} selectedKey={value || null} onSelectionChange={(key) => onChange(String(key))}><Select.Trigger><Select.Value>{({ defaultChildren }) => defaultChildren || label}</Select.Value><Select.Indicator /></Select.Trigger><Select.Popover><ListBox>{options.map((option) => <ListBox.Item key={option.id} id={option.id} textValue={option.label}>{option.label}</ListBox.Item>)}</ListBox></Select.Popover></Select.Root>;
}
