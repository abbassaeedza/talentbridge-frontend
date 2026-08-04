import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { projectApi } from '../../api/services';
import { AlertTriangle, CheckCircle, XCircle, Clock, Calendar, RefreshCw, Users } from 'lucide-react';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import DeadlineCountdown from '../../components/shared/DeadlineCountdown';
import clsx from 'clsx';
import type { GlobalDeadlinePreview } from '../../types';
import { Link } from 'react-router-dom';

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
  const [globalEnabled, setGlobalEnabled] = useState(false);
  const [deadlinePreview, setDeadlinePreview] = useState<GlobalDeadlinePreview | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['all-projects-admin', tab, page],
    queryFn: () =>
      projectApi.getAll(page, 20, tab === 'ALL' ? undefined : tab).then((r) => r.data),
  });

  const globalDeadlineQuery = useQuery({
    queryKey: ['global-deadline'],
    queryFn: () => projectApi.getGlobalDeadline().then((response) => response.data),
  });

  useEffect(() => {
    if (!globalDeadlineQuery.data) return;
    setGlobalEnabled(globalDeadlineQuery.data.enabled);
    setGlobalDeadline(globalDeadlineQuery.data.deadline?.slice(0, 16) ?? '');
  }, [globalDeadlineQuery.data]);

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
      projectApi.setDeadline(id, deadline),
    onSuccess: () => { toast.success('Deadline set!'); invalidate(); },
    onError: () => toast.error('Failed to set deadline'),
  });

  const globalDeadlineMutation = useMutation({
    mutationFn: () => projectApi.setGlobalDeadline({
      enabled: globalEnabled,
      deadline: globalEnabled ? globalDeadline : globalDeadlineQuery.data?.deadline ?? null,
    }),
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['all-projects-admin'] }),
        qc.invalidateQueries({ queryKey: ['all-projects'] }),
        qc.invalidateQueries({ queryKey: ['global-deadline'] }),
      ]);
      toast.success(globalEnabled ? 'Global deadline updated' : 'Global deadline disabled');
      setDeadlinePreview(null);
    },
    onError: () => toast.error('Failed'),
  });

  const previewMutation = useMutation({
    mutationFn: () => projectApi.previewGlobalDeadline({ enabled: true, deadline: globalDeadline }).then((response) => response.data),
    onSuccess: setDeadlinePreview,
    onError: () => toast.error('Could not preview affected projects'),
  });

  const reviewGlobalChange = () => {
    if (globalEnabled) previewMutation.mutate();
    else setDeadlinePreview({
      affectedCounts: { PENDING_REVIEW: 0, OPEN: 0, ASSIGNED: 0 },
      excludedFinishedCount: 0,
    });
  };

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

      <section className='card mb-6 overflow-hidden'>
        <div className='flex flex-col gap-4 border-b border-ink-800/60 p-5 sm:flex-row sm:items-start sm:justify-between'>
          <div className='flex gap-3'>
            <div className='flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-ember-500/15 text-ember-400'>
              <Calendar size={19} />
            </div>
            <div>
              <h2 className='font-display font-semibold text-white'>Global Application Deadline</h2>
              <p className='mt-1 text-xs text-ink-400'>Updates unfinished pending, open, and assigned projects.</p>
            </div>
          </div>
          <label className='relative flex cursor-pointer items-center gap-3 text-sm text-ink-200'>
            <span>{globalEnabled ? 'Enabled' : 'Disabled'}</span>
            <input
              type='checkbox'
              role='switch'
              aria-label='Enable global deadline'
              checked={globalEnabled}
              onChange={(event) => setGlobalEnabled(event.target.checked)}
              className='peer absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0'
            />
            <span className='relative h-6 w-11 rounded-full bg-ink-700 transition peer-checked:bg-ember-500 after:absolute after:left-1 after:top-1 after:h-4 after:w-4 after:rounded-full after:bg-white after:transition peer-checked:after:translate-x-5' />
          </label>
        </div>
        <div className='grid gap-4 p-5 lg:grid-cols-[1fr_1fr_auto] lg:items-end'>
          <div>
            <p className='text-[10px] font-bold uppercase tracking-wider text-ink-500'>Current setting</p>
            <p className='mt-2 text-sm font-semibold text-white'>
              {globalDeadlineQuery.data?.enabled ? 'Global deadline is enabled' : 'Global deadline is disabled'}
            </p>
            <p className='mt-1 text-xs text-ink-400'>
              {globalDeadlineQuery.data?.deadline
                ? format(new Date(globalDeadlineQuery.data.deadline), 'dd MMM yyyy HH:mm')
                : 'No deadline configured'}
            </p>
          </div>
          <label className='block text-xs font-medium text-ink-300'>
            Global deadline date and time
            <input
              type='datetime-local'
              className='input mt-2 w-full text-xs'
              value={globalDeadline}
              disabled={!globalEnabled}
              onChange={(event) => setGlobalDeadline(event.target.value)}
            />
          </label>
          <button
            onClick={reviewGlobalChange}
            disabled={(globalEnabled && !globalDeadline) || previewMutation.isPending}
            className='btn-primary justify-center text-xs lg:min-w-40'
          >
            {previewMutation.isPending ? 'Loading preview...' : 'Preview changes'}
          </button>
        </div>
      </section>

      {deadlinePreview && (
        <div className='fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-4' role='presentation'>
          <section role='dialog' aria-modal='true' aria-labelledby='global-deadline-dialog-title' className='card w-full max-w-lg p-6 shadow-2xl'>
            <div className='flex items-start gap-3'>
              <div className='flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-amber-500/15 text-amber-400'><AlertTriangle size={19} /></div>
              <div>
                <h2 id='global-deadline-dialog-title' className='font-display text-lg font-semibold text-white'>Confirm global deadline</h2>
                <p className='mt-1 text-sm text-ink-400'>
                  {globalEnabled
                    ? 'This overwrites individual deadlines on every eligible project.'
                    : 'Disabling global mode keeps every project deadline unchanged.'}
                </p>
              </div>
            </div>
            {globalEnabled && (
              <div className='mt-5 grid grid-cols-3 gap-2'>
                {Object.entries(deadlinePreview.affectedCounts).map(([status, count]) => (
                  <div key={status} className='rounded-xl bg-ink-800/60 p-3 text-center'>
                    <p className='font-display text-xl font-bold text-white'>{count} <span className='text-[10px] font-normal text-ink-400'>{status.replace('_', ' ').toLowerCase()}</span></p>
                  </div>
                ))}
              </div>
            )}
            <p className='mt-4 text-xs text-ink-400'>{deadlinePreview.excludedFinishedCount} finished projects excluded</p>
            <div className='mt-6 flex justify-end gap-3'>
              <button className='btn-secondary' onClick={() => setDeadlinePreview(null)}>Cancel</button>
              <button className='btn-primary' disabled={globalDeadlineMutation.isPending} onClick={() => globalDeadlineMutation.mutate()}>
                {globalDeadlineMutation.isPending ? 'Applying...' : 'Confirm and apply'}
              </button>
            </div>
          </section>
        </div>
      )}

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
                        <Link to={`/coordinator/projects/${p.id}`} className='font-medium text-white text-sm truncate hover:text-ember-400'>{p.title}</Link>
                        <span className={clsx('badge text-[10px]', cls)}>{label}</span>
                        {p.projectField && (
                          <span className='px-2 py-0.5 rounded-md bg-ink-700 border border-ink-600/40 text-[10px] text-ink-400'>
                            {p.projectField}
                          </span>
                        )}
                      </div>
                      <p className='text-xs text-ink-400'>{p.companyName}</p>
                      <div className='mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-ink-400'>
                        <span>
                          Party:{' '}
                          {p.assignedPartyId ? <Link to={`/coordinator/parties?party=${p.assignedPartyId}`} className='text-ember-400 hover:text-ember-300'>{p.assignedPartyName}</Link> : 'Unassigned'}
                        </span>
                        <span>
                          Project supervisor:{' '}
                          {p.projectSupervisorId ? <Link to={`/coordinator/supervisors?section=PROJECT_SUPERVISOR&supervisor=${p.projectSupervisorId}`} className='text-ember-400 hover:text-ember-300'>{p.projectSupervisorName}</Link> : 'Unassigned'}
                        </span>
                      </div>
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

                      {/* Open and assigned projects keep independent deadlines */}
                      {(p.status === 'OPEN' || p.status === 'ASSIGNED') && (
                        <div className='flex items-center gap-2'>
                          <input
                            type='datetime-local'
                            aria-label={`Deadline for ${p.title}`}
                            className='input text-xs py-1.5 w-44'
                            value={deadlines[p.id] ?? ''}
                            onChange={(e) => setDeadlines((d) => ({ ...d, [p.id]: e.target.value }))} />
                          <button
                            aria-label={`Set deadline for ${p.title}`}
                            onClick={() => deadlineMutation.mutate({ id: p.id, deadline: deadlines[p.id] })}
                            disabled={!deadlines[p.id] || deadlineMutation.isPending}
                            className='btn-secondary text-xs px-3 py-1.5'>
                            <Clock size={12} /> Set
                          </button>
                          {p.status === 'OPEN' && (
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
                          )}
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
