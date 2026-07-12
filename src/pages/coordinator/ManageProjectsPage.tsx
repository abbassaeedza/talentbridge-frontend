import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { projectApi } from '../../api/services';
import { CheckCircle, XCircle, Clock, Calendar, RefreshCw, Users } from 'lucide-react';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import DeadlineCountdown from '../../components/shared/DeadlineCountdown';
import clsx from 'clsx';

type TabStatus = 'ALL' | 'PENDING_REVIEW' | 'OPEN' | 'ARCHIVED' | 'ASSIGNED';

const TABS: { label: string; value: TabStatus }[] = [
  { label: 'All',     value: 'ALL'            },
  { label: 'Pending', value: 'PENDING_REVIEW'  },
  { label: 'Open',    value: 'OPEN'            },
  { label: 'Rejected',value: 'ARCHIVED'        },
  { label: 'Assigned',value: 'ASSIGNED'        },
];

export default function ManageProjectsPage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<TabStatus>('ALL');
  const [page, setPage] = useState(0);
  const [deadlines, setDeadlines] = useState<Record<string, string>>({});
  const [globalDeadline, setGlobalDeadline] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['all-projects-admin', tab, page],
    queryFn: () =>
      projectApi.getAll(page, 20, tab === 'ALL' ? undefined : tab).then((r) => r.data),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ['all-projects-admin'] });

  const approveMutation = useMutation({
    mutationFn: (id: string) => projectApi.approve(id),
    onSuccess: () => { toast.success('Project approved — now open!'); invalidate(); },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Failed'),
  });

  const disapproveMutation = useMutation({
    mutationFn: (id: string) => projectApi.disapprove(id),
    onSuccess: () => { toast.success('Project rejected — company can edit and resubmit.'); invalidate(); },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Failed'),
  });

  const retractMutation = useMutation({
    mutationFn: (id: string) => projectApi.retract(id),
    onSuccess: () => { toast.success('Project retracted and pending applications reassigned.'); invalidate(); },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Failed to retract'),
  });

  const deadlineMutation = useMutation({
    mutationFn: ({ id, deadline }: { id: string; deadline: string }) =>
      projectApi.setDeadline(id, new Date(deadline).toISOString()),
    onSuccess: () => { toast.success('Deadline set!'); invalidate(); },
    onError: () => toast.error('Failed to set deadline'),
  });

  const globalDeadlineMutation = useMutation({
    mutationFn: () => projectApi.setGlobalDeadline(new Date(globalDeadline).toISOString()),
    onSuccess: () => {
      toast.success('Global deadline applied to all open projects!');
      setGlobalDeadline('');
    },
    onError: () => toast.error('Failed'),
  });

  const statusBadge = (status: string) => {
    const map: Record<string, string> = {
      OPEN:           'badge-open',
      PENDING_REVIEW: 'badge-pending',
      ASSIGNED:       'badge-assigned',
      ARCHIVED:       'bg-red-500/15 text-red-400 border-red-500/20',
      CLOSED:         'bg-ink-700/50 text-ink-400 border-ink-600/30',
    };
    const labels: Record<string, string> = {
      PENDING_REVIEW: 'Pending',
      ARCHIVED:       'Rejected',
    };
    return {
      cls:   map[status] || 'badge-pending',
      label: labels[status] || status.replace('_', ' '),
    };
  };

  return (
    <div className='animate-fade-up'>
      <div className='page-header'>
        <h1 className='page-title'>Manage Projects</h1>
        <p className='page-subtitle'>{data?.totalElements ?? 0} total projects</p>
      </div>

      {/* Global deadline */}
      <div className='card p-4 mb-6 flex items-center gap-3'>
        <Calendar size={18} className='text-ink-400 flex-shrink-0' />
        <div className='flex-1'>
          <p className='text-sm font-semibold text-white mb-0.5'>Set Global Application Deadline</p>
          <p className='text-xs text-ink-400'>Applies the same deadline to all currently open projects.</p>
        </div>
        <input type='datetime-local' className='input w-56 text-xs py-2'
          value={globalDeadline} onChange={(e) => setGlobalDeadline(e.target.value)} />
        <button onClick={() => globalDeadlineMutation.mutate()}
          disabled={!globalDeadline || globalDeadlineMutation.isPending}
          className='btn-primary text-xs px-4 py-2'>
          Apply
        </button>
      </div>

      {/* Filter tabs */}
      <div className='flex gap-1 mb-4 bg-ink-900 p-1 rounded-xl w-fit'>
        {TABS.map((t) => (
          <button key={t.value} onClick={() => { setTab(t.value); setPage(0); }}
            className={clsx('px-4 py-1.5 rounded-lg text-xs font-semibold transition-all',
              tab === t.value ? 'bg-ink-700 text-white shadow-sm' : 'text-ink-400 hover:text-ink-200')}>
            {t.label}
          </button>
        ))}
      </div>

      <div className='card overflow-hidden'>
        {isLoading ? (
          <div className='p-12 flex justify-center'>
            <div className='w-5 h-5 border-2 border-ember-500 border-t-transparent rounded-full animate-spin' />
          </div>
        ) : !data?.content.length ? (
          <div className='p-12 text-center'>
            <p className='text-ink-400 text-sm'>No projects in this category.</p>
          </div>
        ) : (
          <div className='divide-y divide-ink-800/50'>
            {data.content.map((p) => {
              const { cls, label } = statusBadge(p.status as string);
              return (
                <div key={p.id} className='px-6 py-4'>
                  <div className='flex items-start gap-4'>
                    <div className='flex-1 min-w-0'>
                      <div className='flex items-center gap-2 mb-1 flex-wrap'>
                        <h3 className='font-medium text-white text-sm truncate'>{p.title}</h3>
                        <span className={clsx('badge text-[10px]', cls)}>{label}</span>
                        {p.projectField && (
                          <span className='px-2 py-0.5 rounded-md bg-ink-700 border border-ink-600/40 text-[10px] text-ink-400'>
                            {p.projectField}
                          </span>
                        )}
                      </div>
                      <p className='text-xs text-ink-400'>{p.companyName}</p>
                      <p className='text-xs text-ink-500 mt-0.5 flex items-center gap-1'>
                        <Users size={10} />
                        {p.partyApplicationCount} party application{p.partyApplicationCount !== 1 ? 's' : ''}
                      </p>
                      <div className='flex items-center gap-3 mt-1.5 flex-wrap'>
                        <DeadlineCountdown deadline={p.deadline ?? null} compact />
                        {p.deadline && (
                          <span className='text-xs text-ink-500'>
                            {format(new Date(p.deadline), 'dd MMM yyyy HH:mm')}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className='flex items-center gap-2 flex-shrink-0 flex-wrap justify-end'>
                      {/* Pending → approve or reject */}
                      {p.status === 'PENDING_REVIEW' && (
                        <>
                          <button onClick={() => approveMutation.mutate(p.id)} disabled={approveMutation.isPending}
                            className='flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-jade-500/15 border border-jade-500/30 text-jade-400 hover:bg-jade-500/25 text-xs font-medium transition-colors'>
                            <CheckCircle size={13} /> Approve
                          </button>
                          <button onClick={() => disapproveMutation.mutate(p.id)} disabled={disapproveMutation.isPending}
                            className='flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/15 border border-red-500/30 text-red-400 hover:bg-red-500/25 text-xs font-medium transition-colors'>
                            <XCircle size={13} /> Reject
                          </button>
                        </>
                      )}

                      {/* Rejected → reinstate */}
                      {p.status === 'ARCHIVED' && (
                        <button onClick={() => approveMutation.mutate(p.id)} disabled={approveMutation.isPending}
                          className='flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-jade-500/15 border border-jade-500/30 text-jade-400 hover:bg-jade-500/25 text-xs font-medium transition-colors'>
                          <RefreshCw size={13} /> Reinstate
                        </button>
                      )}

                      {/* Open → set deadline */}
                      {p.status === 'OPEN' && (
                        <div className='flex items-center gap-2'>
                          <input type='datetime-local' className='input text-xs py-1.5 w-44'
                            value={deadlines[p.id] ?? ''}
                            onChange={(e) => setDeadlines((d) => ({ ...d, [p.id]: e.target.value }))} />
                          <button
                            onClick={() => deadlineMutation.mutate({ id: p.id, deadline: deadlines[p.id] })}
                            disabled={!deadlines[p.id] || deadlineMutation.isPending}
                            className='btn-secondary text-xs px-3 py-1.5'>
                            <Clock size={12} /> Set
                          </button>
                          <button
                            onClick={() => {
                              if (confirm('Retract this open project? Pending applications will be reassigned.')) {
                                retractMutation.mutate(p.id);
                              }
                            }}
                            disabled={retractMutation.isPending}
                            className='flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/15 border border-red-500/30 text-red-400 hover:bg-red-500/25 text-xs font-medium transition-colors'
                          >
                            <XCircle size={13} /> Retract
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {data && data.totalPages > 1 && (
        <div className='flex justify-center gap-2 mt-6'>
          <button onClick={() => setPage((p) => p - 1)} disabled={data.first}
            className='btn-secondary text-xs px-4 py-2'>Previous</button>
          <span className='px-4 py-2 text-xs text-ink-400'>Page {page + 1} of {data.totalPages}</span>
          <button onClick={() => setPage((p) => p + 1)} disabled={data.last}
            className='btn-secondary text-xs px-4 py-2'>Next</button>
        </div>
      )}
    </div>
  );
}
