import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { projectApi } from '../../api/services';
import { AlertTriangle, CheckCircle, XCircle, Clock, Calendar, RefreshCw, Users } from 'lucide-react';
import toast from 'react-hot-toast';
import { formatDateTime, parseServerDateTime, toApiDateTime } from '../../utils/dateTime';
import DeadlineCountdown from '../../components/shared/DeadlineCountdown';
import type { GlobalDeadlinePreview } from '../../types';
import { Link } from 'react-router-dom';
import { Button } from '@heroui/react/button';
import { Input } from '@heroui/react/input';
import { Modal } from '@heroui/react/modal';
import { Spinner } from '@heroui/react/spinner';
import { Switch } from '@heroui/react/switch';
import { Tabs } from '@heroui/react/tabs';
import { PageHeader, StatusBadge } from '../../components/ui/TalentBridgeUI';
import DateTimePicker from '../../components/ui/DateTimePicker';

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
  const [invalidDeadlines, setInvalidDeadlines] = useState<Record<string, boolean>>({});
  const [globalDeadline, setGlobalDeadline] = useState('');
  const [globalDeadlineValid, setGlobalDeadlineValid] = useState(true);
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
    setGlobalDeadline(globalDeadlineQuery.data.deadline ?? '');
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
      projectApi.setDeadline(id, toApiDateTime(deadline)),
    onSuccess: () => { toast.success('Deadline set!'); invalidate(); },
    onError: () => toast.error('Failed to set deadline'),
  });

  const globalDeadlineMutation = useMutation({
    mutationFn: () => projectApi.setGlobalDeadline({
      enabled: globalEnabled,
      deadline: globalEnabled ? toApiDateTime(globalDeadline) : globalDeadlineQuery.data?.deadline ? toApiDateTime(globalDeadlineQuery.data.deadline) : null,
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
    mutationFn: () => projectApi.previewGlobalDeadline({ enabled: true, deadline: toApiDateTime(globalDeadline) }).then((response) => response.data),
    onSuccess: setDeadlinePreview,
    onError: () => toast.error('Could not preview affected projects'),
  });

  const reviewGlobalChange = () => {
    if (globalEnabled && (!globalDeadlineValid || !parseServerDateTime(globalDeadline))) return;
    if (globalEnabled) previewMutation.mutate();
    else setDeadlinePreview({
      affectedCounts: { PENDING_REVIEW: 0, OPEN: 0, ASSIGNED: 0 },
      excludedFinishedCount: 0,
    });
  };

  const statusLabel = (status: string) => {
    const labels: Record<string, string> = {
      PENDING_REVIEW: 'Pending',
      ARCHIVED:       'Rejected',
    };
    return labels[status] || status.replace('_', ' ');
  };

  return (
    <div className=''>
      <PageHeader title='Manage Projects' description={`${data?.totalElements ?? 0} total projects`} />

      <section className='rounded-lg border border-border bg-surface mb-6 overflow-hidden'>
        <div className='flex flex-col gap-4 border-b border-border p-5 sm:flex-row sm:items-start sm:justify-between'>
          <div className='flex gap-3'>
            <div className='flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-default text-accent'>
              <Calendar size={19} />
            </div>
            <div>
              <h2 className=' font-semibold text-foreground'>Global Application Deadline</h2>
              <p className='mt-1 text-xs text-muted'>Updates unfinished pending, open, and assigned projects.</p>
            </div>
          </div>
          <Switch aria-label='Enable global deadline' isSelected={globalEnabled} onChange={setGlobalEnabled}>
            <Switch.Content>
              <Switch.Control><Switch.Thumb /></Switch.Control>
              {globalEnabled ? 'Enabled' : 'Disabled'}
            </Switch.Content>
          </Switch>
        </div>
        <div className='grid gap-4 p-5 lg:grid-cols-[1fr_1fr_auto] lg:items-end'>
          <div>
            <p className='text-[10px] font-bold uppercase tracking-wider text-muted'>Current setting</p>
            <p className='mt-2 text-sm font-semibold text-foreground'>
              {globalDeadlineQuery.data?.enabled ? 'Global deadline is enabled' : 'Global deadline is disabled'}
            </p>
            <p className='mt-1 text-xs text-muted'>
              {globalDeadlineQuery.data?.deadline
                ? formatDateTime(globalDeadlineQuery.data.deadline)
                : 'No deadline configured'}
            </p>
          </div>
          <DateTimePicker label='Global deadline date and time' value={globalDeadline} onChange={setGlobalDeadline} onValidityChange={setGlobalDeadlineValid} isDisabled={!globalEnabled} />
          <Button variant='primary' onPress={reviewGlobalChange} isDisabled={(globalEnabled && (!globalDeadlineValid || !parseServerDateTime(globalDeadline))) || previewMutation.isPending} className='lg:min-w-40'>
            {previewMutation.isPending ? 'Loading preview...' : 'Preview changes'}
          </Button>
        </div>
      </section>

      <Modal isOpen={!!deadlinePreview} onOpenChange={(open) => { if (!open) setDeadlinePreview(null); }}><Modal.Backdrop><Modal.Container><Modal.Dialog className='max-w-lg'>
        {deadlinePreview && <><Modal.Header><Modal.Icon className='bg-warning text-warning-foreground'><AlertTriangle size={19} /></Modal.Icon><Modal.Heading>Confirm global deadline</Modal.Heading></Modal.Header><Modal.Body>
            <div className='flex items-start gap-3'>
              <div>
                <p className='mt-1 text-sm text-muted'>
                  {globalEnabled
                    ? 'This overwrites individual deadlines on every eligible project.'
                    : 'Disabling global mode keeps every project deadline unchanged.'}
                </p>
              </div>
            </div>
            {globalEnabled && (
              <div className='mt-5 grid grid-cols-3 gap-2'>
                {Object.entries(deadlinePreview.affectedCounts).map(([status, count]) => (
                  <div key={status} className='rounded-lg bg-surface-secondary p-3 text-center'>
                    <p className=' text-xl font-bold text-foreground'>{count} <span className='text-[10px] font-normal text-muted'>{status.replace('_', ' ').toLowerCase()}</span></p>
                  </div>
                ))}
              </div>
            )}
            <p className='mt-4 text-xs text-muted'>{deadlinePreview.excludedFinishedCount} finished projects excluded</p>
        </Modal.Body><Modal.Footer><Button variant='ghost' onPress={() => setDeadlinePreview(null)}>Cancel</Button><Button variant='primary' isDisabled={globalDeadlineMutation.isPending} onPress={() => globalDeadlineMutation.mutate()}>{globalDeadlineMutation.isPending && <Spinner size='sm' />}{globalDeadlineMutation.isPending ? 'Applying' : 'Confirm and apply'}</Button></Modal.Footer></>}
      </Modal.Dialog></Modal.Container></Modal.Backdrop></Modal>

      {/* Filter tabs */}
      <Tabs.Root variant='secondary' selectedKey={tab} onSelectionChange={(key) => { setTab(String(key) as TabStatus); setPage(0); }} className='mb-4'><Tabs.ListContainer><Tabs.List aria-label='Project status'>{TABS.map((item) => <Tabs.Tab key={item.value} id={item.value}><Tabs.Indicator />{item.label}</Tabs.Tab>)}</Tabs.List></Tabs.ListContainer></Tabs.Root>

      <div className='rounded-lg border border-border bg-surface overflow-hidden'>
        {isLoading ? (
          <div className='p-12 flex justify-center'>
            <Spinner />
          </div>
        ) : !data?.content.length ? (
          <div className='p-12 text-center'>
            <p className='text-muted text-sm'>No projects in this category.</p>
          </div>
        ) : (
          <div className='divide-y divide-separator'>
            {data.content.map((p) => {
              const label = statusLabel(p.status as string);
              return (
                <div key={p.id} className='px-6 py-4'>
                  <div className='flex items-start gap-4'>
                    <div className='flex-1 min-w-0'>
                      <div className='flex items-center gap-2 mb-1 flex-wrap'>
                        <Link to={`/coordinator/projects/${p.id}`} className='font-medium text-foreground text-sm truncate hover:text-accent'>{p.title}</Link>
                        <StatusBadge status={p.status} label={label} />
                        {p.projectField && (
                          <span className='px-2 py-0.5 rounded-md bg-default border border-border text-[10px] text-muted'>
                            {p.projectField}
                          </span>
                        )}
                      </div>
                      <p className='text-xs text-muted'>{p.companyName}</p>
                      <div className='mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted'>
                        <span>
                          Party:{' '}
                          {p.assignedPartyId ? <Link to={`/coordinator/parties?party=${p.assignedPartyId}`} className='text-accent hover:text-accent'>{p.assignedPartyName}</Link> : 'Unassigned'}
                        </span>
                        <span>
                          Project supervisor:{' '}
                          {p.projectSupervisorId ? <Link to={`/coordinator/supervisors?section=PROJECT_SUPERVISOR&supervisor=${p.projectSupervisorId}`} className='text-accent hover:text-accent'>{p.projectSupervisorName}</Link> : 'Unassigned'}
                        </span>
                      </div>
                      <p className='text-xs text-muted mt-0.5 flex items-center gap-1'>
                        <Users size={10} />
                        {p.partyApplicationCount} party application{p.partyApplicationCount !== 1 ? 's' : ''}
                      </p>
                      <div className='flex items-center gap-3 mt-1.5 flex-wrap'>
                        <DeadlineCountdown deadline={p.deadline ?? null} compact />
                        {p.deadline && (
                          <span className='text-xs text-muted'>
                            {formatDateTime(p.deadline)}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className='flex items-center gap-2 flex-shrink-0 flex-wrap justify-end'>
                      {/* Pending → approve or reject */}
                      {p.status === 'PENDING_REVIEW' && (
                        <>
                          <Button size='sm' variant='secondary' onPress={() => approveMutation.mutate(p.id)} isDisabled={approveMutation.isPending}>
                            <CheckCircle size={13} /> Approve
                          </Button>
                          <Button size='sm' variant='danger-soft' onPress={() => disapproveMutation.mutate(p.id)} isDisabled={disapproveMutation.isPending}>
                            <XCircle size={13} /> Reject
                          </Button>
                        </>
                      )}

                      {/* Rejected → reinstate */}
                      {p.status === 'ARCHIVED' && (
                        <Button size='sm' variant='secondary' onPress={() => approveMutation.mutate(p.id)} isDisabled={approveMutation.isPending}>
                          <RefreshCw size={13} /> Reinstate
                        </Button>
                      )}

                      {/* Open and assigned projects keep independent deadlines */}
                      {(p.status === 'OPEN' || p.status === 'ASSIGNED') && (
                        <div className='flex items-end gap-2'>
                          <DateTimePicker label={`Deadline for ${p.title}`} className='w-56' value={deadlines[p.id] ?? p.deadline ?? ''} onChange={(value) => setDeadlines((d) => ({ ...d, [p.id]: value }))} onValidityChange={(valid) => setInvalidDeadlines((current) => current[p.id] === !valid ? current : { ...current, [p.id]: !valid })} />
                          <Button size='sm' variant='secondary'
                            aria-label={`Set deadline for ${p.title}`}
                            onPress={() => deadlineMutation.mutate({ id: p.id, deadline: deadlines[p.id] ?? p.deadline ?? '' })}
                            isDisabled={invalidDeadlines[p.id] || !parseServerDateTime(deadlines[p.id] ?? p.deadline) || deadlineMutation.isPending}>
                            <Clock size={12} /> Set
                          </Button>
                          {p.status === 'OPEN' && (
                            <Button size='sm' variant='danger-soft'
                              onPress={() => {
                                if (confirm('Retract this open project? Pending applications will be reassigned.')) {
                                  retractMutation.mutate(p.id);
                                }
                              }}
                              isDisabled={retractMutation.isPending}
                            >
                              <XCircle size={13} /> Retract
                            </Button>
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
          <Button size='sm' variant='secondary' onPress={() => setPage((p) => p - 1)} isDisabled={data.first}>Previous</Button>
          <span className='px-4 py-2 text-xs text-muted'>Page {page + 1} of {data.totalPages}</span>
          <Button size='sm' variant='secondary' onPress={() => setPage((p) => p + 1)} isDisabled={data.last}>Next</Button>
        </div>
      )}
    </div>
  );
}
