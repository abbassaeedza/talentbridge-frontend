import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle, Mail, PauseCircle, PlayCircle, Search, Trash2, UserCheck, XCircle } from 'lucide-react';
import { userApi } from '../../api/services';
import { getUserName } from '../../types';
import useUserStatusMutation from '../../hooks/useUserStatusMutation';
import clsx from 'clsx';
import toast from 'react-hot-toast';
import BulkActionToolbar from '../../components/coordinator/BulkActionToolbar';

export default function SupervisorsDirectoryPage() {
  const [query, setQuery] = useState('');
  const [section, setSection] = useState<'PENDING' | 'PARTY_SUPERVISOR' | 'PROJECT_SUPERVISOR'>('PENDING');
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
    <div className='animate-fade-up'>
      <div className='page-header'>
        <h1 className='page-title'>Supervisors Directory</h1>
        <p className='page-subtitle'>{filtered.length} supervisor{filtered.length === 1 ? '' : 's'} shown</p>
      </div>

      <div className='mb-4 flex w-fit max-w-full gap-1 overflow-x-auto rounded-xl bg-ink-900 p-1' role='tablist' aria-label='Supervisor sections'>
        {([
          ['PENDING', 'Pending Requests'],
          ['PARTY_SUPERVISOR', 'Party Supervisors'],
          ['PROJECT_SUPERVISOR', 'Project Supervisors'],
        ] as const).map(([value, label]) => (
          <button
            key={value}
            role='tab'
            aria-selected={section === value}
            onClick={() => { setSection(value); setSelected([]); }}
            className={clsx('whitespace-nowrap rounded-lg px-4 py-2 text-xs font-semibold transition',
              section === value ? 'bg-ink-700 text-white' : 'text-ink-400 hover:text-white')}
          >
            {label}
          </button>
        ))}
      </div>

      <div className='card p-4 mb-5'>
        <div className='relative'>
          <Search size={15} className='absolute left-3 top-1/2 -translate-y-1/2 text-ink-500' />
          <input
            className='input pl-9'
            placeholder='Search supervisors…'
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
        <label className='mt-3 flex w-fit items-center gap-2 text-xs text-ink-300'>
          <input type='checkbox' aria-label='Select all filtered supervisors' checked={allFilteredSelected} onChange={() => setSelected(allFilteredSelected ? [] : filtered.map((supervisor) => supervisor.id))} className='h-4 w-4 accent-orange-500' />
          Select all {filtered.length} filtered supervisors
        </label>
      </div>

      <BulkActionToolbar noun='supervisor' selectedCount={selected.length} eligible={eligible} rejectionReason={rejectReason} onRejectionReasonChange={setRejectReason} loadingAction={bulkAction} onAction={runBulk} />

      <div className='card overflow-hidden'>
        {isLoading ? (
          <div className='p-12 flex justify-center'>
            <div className='w-5 h-5 border-2 border-ember-500 border-t-transparent rounded-full animate-spin' />
          </div>
        ) : filtered.length === 0 ? (
          <div className='p-12 text-center'>
            <UserCheck size={30} className='mx-auto mb-3 text-ink-600' />
            <p className='text-sm text-ink-400'>No supervisors found.</p>
          </div>
        ) : (
          <div className='divide-y divide-ink-800/50'>
            {filtered.map((supervisor) => (
              <div key={supervisor.id} className='flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center'>
                <input
                  type='checkbox'
                  aria-label={`Select ${getUserName(supervisor)}`}
                  checked={selected.includes(supervisor.id)}
                  onChange={() => setSelected((current) => current.includes(supervisor.id)
                    ? current.filter((id) => id !== supervisor.id)
                    : [...current, supervisor.id])}
                  className='h-4 w-4 accent-orange-500'
                />
                <div className='w-10 h-10 rounded-xl bg-ink-700 flex items-center justify-center text-xs font-bold text-ink-200'>
                  {getUserName(supervisor).split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase()}
                </div>
                <div className='flex-1 min-w-0'>
                  <div className='flex flex-wrap items-center gap-2'>
                    <p className='text-sm font-semibold text-white'>{getUserName(supervisor)}</p>
                    <span className='badge badge-assigned text-[10px]'>{supervisor.role.replace('_', ' ')}</span>
                    <span className={clsx('badge text-[10px]',
                      supervisor.status === 'APPROVED' && 'badge-open',
                      supervisor.status === 'PENDING' && 'badge-pending',
                      supervisor.status === 'SUSPENDED' && 'bg-red-500/15 text-red-400 border-red-500/20',
                    )}>{supervisor.status}</span>
                  </div>
                  <a href={`mailto:${supervisor.email}`} className='mt-1 inline-flex items-center gap-1 text-xs text-ink-400 hover:text-ember-400'>
                    <Mail size={11} /> {supervisor.email}
                  </a>
                  {supervisor.phoneNumber && <p className='mt-1 text-xs text-ink-500'>{supervisor.phoneNumber}</p>}
                </div>
                <div className='flex flex-wrap gap-2'>
                {(supervisor.status === 'PENDING' || supervisor.status === 'REJECTED') && (
                  <button onClick={() => userApi.approve(supervisor.id).then(invalidate)} className='btn-primary text-xs px-3 py-1.5'><CheckCircle size={13} /> Approve</button>
                )}
                {supervisor.status === 'PENDING' && (
                  <button onClick={() => userApi.reject(supervisor.id, rejectReason).then(invalidate)} className='btn-secondary text-xs px-3 py-1.5 text-red-300'><XCircle size={13} /> Reject</button>
                )}
                {supervisor.status === 'APPROVED' && (
                  <button
                    onClick={() => statusMutation.mutate({ id: supervisor.id, suspended: true })}
                    className='btn-secondary text-xs px-3 py-1.5'
                  >
                    <PauseCircle size={13} /> Suspend
                  </button>
                )}
                {supervisor.status === 'SUSPENDED' && (
                  <button
                    onClick={() => statusMutation.mutate({ id: supervisor.id, suspended: false })}
                    className='btn-primary text-xs px-3 py-1.5'
                  >
                    <PlayCircle size={13} /> Unsuspend
                  </button>
                )}
                {supervisor.status === 'REJECTED' && (
                  <button
                    onClick={() => confirm(`Delete ${getUserName(supervisor)} so this email can register again?`) && userApi.deleteRejected(supervisor.id).then(invalidate)}
                    className='btn-secondary text-xs px-3 py-1.5 text-red-300'
                  >
                    <Trash2 size={13} /> Delete
                  </button>
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
