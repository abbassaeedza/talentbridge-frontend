import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle, Mail, PauseCircle, PlayCircle, Search, Trash2, UserCheck, XCircle } from 'lucide-react';
import { userApi } from '../../api/services';
import { getUserName } from '../../types';
import useUserStatusMutation from '../../hooks/useUserStatusMutation';
import clsx from 'clsx';
import toast from 'react-hot-toast';
import BulkActionToolbar from '../../components/coordinator/BulkActionToolbar';
import { useSearchParams } from 'react-router-dom';
import { Button } from '@heroui/react/button';
import { Checkbox } from '@heroui/react/checkbox';
import { Input } from '@heroui/react/input';
import { Spinner } from '@heroui/react/spinner';
import { Tabs } from '@heroui/react/tabs';
import { PageHeader, StatusBadge } from '../../components/ui/TalentBridgeUI';

type SupervisorSection = 'PENDING' | 'PARTY_SUPERVISOR' | 'PROJECT_SUPERVISOR';

export default function SupervisorsDirectoryPage() {
  const [searchParams] = useSearchParams();
  const linkedSupervisorId = searchParams.get('supervisor');
  const requestedSection = searchParams.get('section') as SupervisorSection | null;
  const [query, setQuery] = useState('');
  const [section, setSection] = useState<SupervisorSection>(
    requestedSection === 'PARTY_SUPERVISOR' || requestedSection === 'PROJECT_SUPERVISOR' ? requestedSection : 'PENDING',
  );
  const [selected, setSelected] = useState<string[]>([]);
  const [rejectReason, setRejectReason] = useState('');
  const [bulkAction, setBulkAction] = useState<'approve' | 'reject' | 'suspend' | null>(null);
  const qc = useQueryClient();

  const { data: supervisors, isLoading } = useQuery({
    queryKey: ['directory-supervisors'],
    queryFn: () => userApi.getSupervisors().then((response) => response.data),
  });
  const statusMutation = useUserStatusMutation([['directory-supervisors']], 'Supervisor');
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['directory-supervisors'] });
    qc.invalidateQueries({ queryKey: ['pending-users'] });
  };
  const runBulk = async (action: 'approve' | 'reject' | 'suspend') => {
    setBulkAction(action);
    const requests = (supervisors ?? []).filter((supervisor) => selected.includes(supervisor.id)).flatMap((supervisor) => {
      if (action === 'approve' && (supervisor.status === 'PENDING' || supervisor.status === 'REJECTED')) return [userApi.approve(supervisor.id)];
      if (action === 'reject' && supervisor.status === 'PENDING') return [userApi.reject(supervisor.id, rejectReason)];
      if (action === 'suspend' && supervisor.status === 'APPROVED') return [userApi.suspend(supervisor.id)];
      return [];
    });
    try {
      const results = await Promise.allSettled(requests);
      const failed = results.filter((result) => result.status === 'rejected').length;
      failed
        ? toast.error(`${results.length - failed} updated, ${failed} failed`)
        : toast.success(`${requests.length} supervisor${requests.length === 1 ? '' : 's'} updated`);
      setSelected([]);
      invalidate();
    } finally {
      setBulkAction(null);
    }
  };

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return (supervisors ?? [])
      .filter((supervisor) => section === 'PENDING'
        ? supervisor.status === 'PENDING'
        : supervisor.role === section)
      .filter((supervisor) => !needle || [
        getUserName(supervisor),
        supervisor.email,
        supervisor.phoneNumber,
        supervisor.role,
      ].filter(Boolean).join(' ').toLowerCase().includes(needle))
      .sort((a, b) => getUserName(a).localeCompare(getUserName(b)));
  }, [supervisors, query, section]);
  const selectedSupervisors = (supervisors ?? []).filter((supervisor) => selected.includes(supervisor.id));
  const eligible = {
    approve: selectedSupervisors.filter((supervisor) => supervisor.status === 'PENDING' || supervisor.status === 'REJECTED').length,
    reject: selectedSupervisors.filter((supervisor) => supervisor.status === 'PENDING').length,
    suspend: selectedSupervisors.filter((supervisor) => supervisor.status === 'APPROVED').length,
  };
  const allFilteredSelected = filtered.length > 0 && filtered.every((supervisor) => selected.includes(supervisor.id));

  return (
    <div className=''>
      <PageHeader title='Supervisors' description={`${filtered.length} supervisor${filtered.length === 1 ? '' : 's'} shown`} />

      <Tabs.Root variant='secondary' selectedKey={section} onSelectionChange={(key) => { setSection(String(key) as SupervisorSection); setSelected([]); }} className='mb-4'><Tabs.ListContainer><Tabs.List aria-label='Supervisor sections'>{([
          ['PENDING', 'Pending Requests'],
          ['PARTY_SUPERVISOR', 'Party Supervisors'],
          ['PROJECT_SUPERVISOR', 'Project Supervisors'],
        ] as const).map(([value, label]) => (
          <Tabs.Tab key={value} id={value}>{label}</Tabs.Tab>
        ))}
      </Tabs.List></Tabs.ListContainer></Tabs.Root>

      <div className='rounded-lg border border-border bg-surface p-4 mb-5'>
        <div className='relative'>
          <Search size={15} className='absolute left-3 top-1/2 -translate-y-1/2 text-muted' />
          <Input fullWidth
            className='pl-9'
            placeholder='Search supervisors…'
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
        <div className='mt-3 flex items-center gap-2 text-xs'><SelectCheckbox selected={allFilteredSelected} onChange={() => setSelected(allFilteredSelected ? [] : filtered.map((supervisor) => supervisor.id))} label='Select all filtered supervisors' /> Select all {filtered.length} filtered supervisors</div>
      </div>

      <BulkActionToolbar noun='supervisor' selectedCount={selected.length} eligible={eligible} rejectionReason={rejectReason} onRejectionReasonChange={setRejectReason} loadingAction={bulkAction} onAction={runBulk} />

      <div className='rounded-lg border border-border bg-surface overflow-hidden'>
        {isLoading ? (
          <div className='p-12 flex justify-center'>
            <Spinner />
          </div>
        ) : filtered.length === 0 ? (
          <div className='p-12 text-center'>
            <UserCheck size={30} className='mx-auto mb-3 text-muted' />
            <p className='text-sm text-muted'>No supervisors found.</p>
          </div>
        ) : (
          <div className='divide-y divide-separator'>
            {filtered.map((supervisor) => (
              <div key={supervisor.id} className={clsx('flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center', linkedSupervisorId === supervisor.id && 'bg-accent ring-1 ring-inset ring-accent')}>
                <SelectCheckbox label={`Select ${getUserName(supervisor)}`} selected={selected.includes(supervisor.id)} onChange={() => setSelected((current) => current.includes(supervisor.id)
                    ? current.filter((id) => id !== supervisor.id)
                    : [...current, supervisor.id])} />
                <div className='w-10 h-10 rounded-lg bg-default flex items-center justify-center text-xs font-bold text-foreground'>
                  {getUserName(supervisor).split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase()}
                </div>
                <div className='flex-1 min-w-0'>
                  <div className='flex flex-wrap items-center gap-2'>
                    <p className='text-sm font-semibold text-foreground'>{getUserName(supervisor)}</p>
                    <span className='inline-flex items-center rounded-sm bg-default px-2 py-1 text-xs font-medium text-foreground text-[10px]'>{supervisor.role.replace('_', ' ')}</span>
                    <StatusBadge status={supervisor.status} />
                  </div>
                  <a href={`mailto:${supervisor.email}`} className='mt-1 inline-flex items-center gap-1 text-xs text-muted hover:text-accent'>
                    <Mail size={11} /> {supervisor.email}
                  </a>
                  {supervisor.phoneNumber && <p className='mt-1 text-xs text-muted'>{supervisor.phoneNumber}</p>}
                </div>
                <div className='flex flex-wrap gap-2'>
                {(supervisor.status === 'PENDING' || supervisor.status === 'REJECTED') && (
                  <Button size='sm' variant='primary' onPress={() => userApi.approve(supervisor.id).then(invalidate)}><CheckCircle size={13} /> Approve</Button>
                )}
                {supervisor.status === 'PENDING' && (
                  <Button size='sm' variant='danger-soft' onPress={() => userApi.reject(supervisor.id, rejectReason).then(invalidate)}><XCircle size={13} /> Reject</Button>
                )}
                {supervisor.status === 'APPROVED' && (
                  <Button size='sm' variant='secondary' onPress={() => statusMutation.mutate({ id: supervisor.id, suspended: true })}>
                    <PauseCircle size={13} /> Suspend
                  </Button>
                )}
                {supervisor.status === 'SUSPENDED' && (
                  <Button size='sm' variant='primary' onPress={() => statusMutation.mutate({ id: supervisor.id, suspended: false })}>
                    <PlayCircle size={13} /> Unsuspend
                  </Button>
                )}
                {supervisor.status === 'REJECTED' && (
                  <Button size='sm' variant='danger-soft' onPress={() => confirm(`Delete ${getUserName(supervisor)} so this email can register again?`) && userApi.deleteRejected(supervisor.id).then(invalidate)}>
                    <Trash2 size={13} /> Delete
                  </Button>
                )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function SelectCheckbox({ selected, onChange, label }: { selected: boolean; onChange: (selected: boolean) => void; label: string }) {
  return <Checkbox isSelected={selected} onChange={onChange} aria-label={label}><Checkbox.Content><Checkbox.Control><Checkbox.Indicator /></Checkbox.Control></Checkbox.Content></Checkbox>;
}
