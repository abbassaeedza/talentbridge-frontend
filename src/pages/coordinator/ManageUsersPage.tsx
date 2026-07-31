import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { userApi } from '../../api/services';
import type { User, UserRole, UserStatus } from '../../types';
import { getUserName } from '../../types';
import {
  CheckCircle,
  PauseCircle,
  PlayCircle,
  Search,
  ShieldCheck,
  UserCheck,
  XCircle,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import clsx from 'clsx';
import useUserStatusMutation from '../../hooks/useUserStatusMutation';

const ROLE_OPTIONS: ('ALL' | UserRole)[] = [
  'ALL',
  'STUDENT',
  'COMPANY',
  'PARTY_SUPERVISOR',
  'PROJECT_SUPERVISOR',
  'COORDINATOR',
];

const STATUS_OPTIONS: ('ALL' | UserStatus)[] = [
  'ALL',
  'PENDING',
  'APPROVED',
  'SUSPENDED',
  'REJECTED',
];

const roleColor: Record<string, string> = {
  STUDENT: 'badge-forming',
  COMPANY: 'badge-ember',
  PARTY_SUPERVISOR: 'badge-active',
  PROJECT_SUPERVISOR: 'badge-assigned',
  COORDINATOR: 'badge-pending',
};

function userMeta(user: User) {
  if (user.companyProfile?.companyName) {
    return `${user.companyProfile.companyName}${user.companyProfile.industry ? ` · ${user.companyProfile.industry}` : ''}`;
  }
  if (user.studentProfile?.university) {
    return `${user.studentProfile.university}${user.studentProfile.major ? ` · ${user.studentProfile.major}` : ''}`;
  }
  return user.email;
}

export default function ManageUsersPage() {
  const qc = useQueryClient();
  const [query, setQuery] = useState('');
  const [role, setRole] = useState<'ALL' | UserRole>('ALL');
  const [status, setStatus] = useState<'ALL' | UserStatus>('ALL');
  const [sort, setSort] = useState<'newest' | 'name' | 'role'>('newest');
  const [rejectReason, setRejectReason] = useState('');
  const [selectedPending, setSelectedPending] = useState<string[]>([]);

  const pendingQuery = useQuery({
    queryKey: ['pending-users'],
    queryFn: () => userApi.getPending(0, 100).then((r) => r.data),
  });
  const studentsQuery = useQuery({
    queryKey: ['directory-students'],
    queryFn: () => userApi.getStudents().then((r) => r.data),
  });
  const companiesQuery = useQuery({
    queryKey: ['directory-companies'],
    queryFn: () => userApi.getCompanies().then((r) => r.data),
  });
  const supervisorsQuery = useQuery({
    queryKey: ['directory-supervisors'],
    queryFn: () => userApi.getSupervisors().then((r) => r.data),
  });
  const coordinatorsQuery = useQuery({
    queryKey: ['directory-coordinators'],
    queryFn: () => userApi.getCoordinators().then((r) => r.data),
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['pending-users'] });
    qc.invalidateQueries({ queryKey: ['directory-students'] });
    qc.invalidateQueries({ queryKey: ['directory-companies'] });
    qc.invalidateQueries({ queryKey: ['directory-supervisors'] });
    qc.invalidateQueries({ queryKey: ['directory-coordinators'] });
  };

  const approveMutation = useMutation({
    mutationFn: (id: string) => userApi.approve(id),
    onSuccess: () => { toast.success('User approved'); invalidate(); },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Failed to approve'),
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) => userApi.reject(id, reason),
    onSuccess: () => { toast.success('User rejected'); invalidate(); },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Failed to reject'),
  });

  const statusMutation = useUserStatusMutation([
    ['pending-users'],
    ['directory-students'],
    ['directory-companies'],
    ['directory-supervisors'],
    ['directory-coordinators'],
  ], 'User');

  const users = useMemo(() => {
    const merged = new Map<string, User>();
    [
      ...(pendingQuery.data?.content ?? []),
      ...(studentsQuery.data ?? []),
      ...(companiesQuery.data ?? []),
      ...(supervisorsQuery.data ?? []),
      ...(coordinatorsQuery.data ?? []),
    ].forEach((u) => merged.set(u.id, u));

    const needle = query.trim().toLowerCase();
    return [...merged.values()]
      .filter((u) => role === 'ALL' || u.role === role)
      .filter((u) => status === 'ALL' || u.status === status)
      .filter((u) => {
        if (!needle) return true;
        return [
          getUserName(u),
          u.email,
          u.role,
          u.status,
          u.companyProfile?.companyName,
          u.companyProfile?.industry,
          u.studentProfile?.university,
          u.studentProfile?.major,
        ].filter(Boolean).join(' ').toLowerCase().includes(needle);
      })
      .sort((a, b) => {
        if (sort === 'name') return getUserName(a).localeCompare(getUserName(b));
        if (sort === 'role') return a.role.localeCompare(b.role);
        return new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime();
      });
  }, [pendingQuery.data, studentsQuery.data, companiesQuery.data, supervisorsQuery.data, coordinatorsQuery.data, query, role, status, sort]);

  const pendingUsers = users.filter((u) => u.status === 'PENDING');
  const isLoading = pendingQuery.isLoading || studentsQuery.isLoading || companiesQuery.isLoading || supervisorsQuery.isLoading || coordinatorsQuery.isLoading;

  const togglePending = (id: string) => {
    setSelectedPending((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  };

  const bulkApprove = async () => {
    for (const id of selectedPending) await userApi.approve(id);
    toast.success(`${selectedPending.length} user${selectedPending.length === 1 ? '' : 's'} approved`);
    setSelectedPending([]);
    invalidate();
  };

  const bulkReject = async () => {
    for (const id of selectedPending) await userApi.reject(id, rejectReason);
    toast.success(`${selectedPending.length} user${selectedPending.length === 1 ? '' : 's'} rejected`);
    setSelectedPending([]);
    invalidate();
  };

  return (
    <div className='animate-fade-up'>
      <div className='page-header'>
        <h1 className='page-title'>Manage Users</h1>
        <p className='page-subtitle'>
          {users.length} user{users.length === 1 ? '' : 's'} · {pendingUsers.length} pending approval{pendingUsers.length === 1 ? '' : 's'}
        </p>
      </div>

      <div className='card p-4 mb-5'>
        <div className='grid md:grid-cols-[1fr_auto_auto_auto] gap-3'>
          <div className='relative'>
            <Search size={15} className='absolute left-3 top-1/2 -translate-y-1/2 text-ink-500' />
            <input
              className='input pl-9'
              placeholder='Search users, companies, universities…'
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <select className='input text-sm' value={role} onChange={(e) => setRole(e.target.value as any)}>
            {ROLE_OPTIONS.map((r) => <option key={r} value={r}>{r === 'ALL' ? 'All roles' : r.replace('_', ' ')}</option>)}
          </select>
          <select className='input text-sm' value={status} onChange={(e) => setStatus(e.target.value as any)}>
            {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s === 'ALL' ? 'All statuses' : s}</option>)}
          </select>
          <select className='input text-sm' value={sort} onChange={(e) => setSort(e.target.value as any)}>
            <option value='newest'>Newest</option>
            <option value='name'>Name A→Z</option>
            <option value='role'>Role</option>
          </select>
        </div>

        {selectedPending.length > 0 && (
          <div className='mt-4 p-3 rounded-xl bg-ink-800/70 border border-ink-700/50 flex flex-col md:flex-row gap-3 md:items-center'>
            <p className='text-xs text-ink-300 flex-1'>{selectedPending.length} pending user{selectedPending.length === 1 ? '' : 's'} selected</p>
            <input
              className='input text-xs py-2 md:w-72'
              placeholder='Reject reason for bulk reject…'
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
            />
            <button onClick={bulkApprove} className='btn-primary text-xs px-3 py-2'>
              <CheckCircle size={13} /> Bulk approve
            </button>
            <button onClick={bulkReject} className='btn-secondary text-xs px-3 py-2 text-red-300'>
              <XCircle size={13} /> Bulk reject
            </button>
          </div>
        )}
      </div>

      <div className='card overflow-hidden'>
        {isLoading ? (
          <div className='p-12 flex justify-center'>
            <div className='w-5 h-5 border-2 border-ember-500 border-t-transparent rounded-full animate-spin' />
          </div>
        ) : users.length === 0 ? (
          <div className='p-16 text-center'>
            <UserCheck size={32} className='text-ink-600 mx-auto mb-3' />
            <p className='text-ink-400 text-sm'>No users match your filters.</p>
          </div>
        ) : (
          <div className='divide-y divide-ink-800/50'>
            {users.map((u) => (
              <div key={u.id} className='px-6 py-4'>
                <div className='flex items-start gap-4'>
                  {u.status === 'PENDING' && (
                    <input
                      type='checkbox'
                      checked={selectedPending.includes(u.id)}
                      onChange={() => togglePending(u.id)}
                      className='mt-3 h-4 w-4 accent-orange-500'
                    />
                  )}
                  <div className='w-10 h-10 rounded-xl bg-ink-700 border border-ink-600/50 flex items-center justify-center font-bold text-ink-200 flex-shrink-0'>
                    {getUserName(u).split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase()}
                  </div>
                  <div className='flex-1 min-w-0'>
                    <div className='flex items-center gap-2 mb-1 flex-wrap'>
                      <p className='font-semibold text-white text-sm'>{getUserName(u)}</p>
                      <span className={clsx('badge text-[10px]', roleColor[u.role] || 'badge-pending')}>
                        {u.role.replace('_', ' ')}
                      </span>
                      <span className={clsx('badge text-[10px]',
                        u.status === 'APPROVED' && 'badge-open',
                        u.status === 'PENDING' && 'badge-pending',
                        u.status === 'SUSPENDED' && 'bg-red-500/15 text-red-400 border-red-500/20',
                        u.status === 'REJECTED' && 'bg-ink-700/50 text-ink-400 border-ink-600/30',
                      )}>{u.status}</span>
                    </div>
                    <p className='text-xs text-ink-400'>{u.email}</p>
                    <p className='text-xs text-ink-500 mt-1'>{userMeta(u)}</p>
                    {u.createdAt && (
                      <p className='text-xs text-ink-600 mt-1'>Registered {format(new Date(u.createdAt), 'dd MMM yyyy')}</p>
                    )}
                  </div>
                  <div className='flex flex-wrap gap-2 justify-end'>
                    {u.status === 'PENDING' && (
                      <>
                        <button
                          onClick={() => approveMutation.mutate(u.id)}
                          disabled={approveMutation.isPending}
                          className='flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-jade-500/15 border border-jade-500/30 text-jade-400 hover:bg-jade-500/25 text-xs font-medium transition-colors'
                        >
                          <CheckCircle size={13} /> Approve
                        </button>
                        <button
                          onClick={() => rejectMutation.mutate({ id: u.id, reason: rejectReason })}
                          disabled={rejectMutation.isPending}
                          className='flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/15 border border-red-500/30 text-red-400 hover:bg-red-500/25 text-xs font-medium transition-colors'
                        >
                          <XCircle size={13} /> Reject
                        </button>
                      </>
                    )}
                    {u.status === 'APPROVED' && u.role !== 'COORDINATOR' && (
                      <button
                        onClick={() => statusMutation.mutate({ id: u.id, suspended: true })}
                        disabled={statusMutation.isPending}
                        className='btn-secondary text-xs px-3 py-1.5'
                      >
                        <PauseCircle size={13} /> Suspend
                      </button>
                    )}
                    {u.status === 'SUSPENDED' && (
                      <button
                        onClick={() => statusMutation.mutate({ id: u.id, suspended: false })}
                        disabled={statusMutation.isPending}
                        className='btn-primary text-xs px-3 py-1.5'
                      >
                        <PlayCircle size={13} /> Unsuspend
                      </button>
                    )}
                    {u.role === 'COORDINATOR' && (
                      <span className='text-xs text-ink-500 flex items-center gap-1'>
                        <ShieldCheck size={13} /> protected
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
