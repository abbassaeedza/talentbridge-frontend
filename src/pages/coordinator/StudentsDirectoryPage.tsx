import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Button, buttonVariants } from '@heroui/react/button';
import { Checkbox } from '@heroui/react/checkbox';
import { Spinner } from '@heroui/react/spinner';
import { Table } from '@heroui/react/table';
import { Tabs } from '@heroui/react/tabs';
import {
  CheckCircle,
  ExternalLink,
  Eye,
  Mail,
  PauseCircle,
  PlayCircle,
  Trash2,
  XCircle,
} from 'lucide-react';
import { userApi } from '../../api/services';
import BulkActionToolbar from '../../components/coordinator/BulkActionToolbar';
import { ListToolbar, PageHeader, StatusBadge } from '../../components/ui/TalentBridgeUI';
import useUserStatusMutation from '../../hooks/useUserStatusMutation';
import { getUserName } from '../../types';

const STATUSES = [
  ['ALL', 'All'],
  ['PENDING', 'Pending'],
  ['APPROVED', 'Approved'],
  ['SUSPENDED', 'Suspended'],
  ['REJECTED', 'Rejected'],
] as const;

function SelectCheckbox({
  selected,
  onChange,
  label,
}: {
  selected: boolean;
  onChange: (selected: boolean) => void;
  label: string;
}) {
  return (
    <Checkbox isSelected={selected} onChange={onChange} aria-label={label}>
      <Checkbox.Content>
        <Checkbox.Control><Checkbox.Indicator /></Checkbox.Control>
      </Checkbox.Content>
    </Checkbox>
  );
}

export default function StudentsDirectoryPage() {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('ALL');
  const [quickView, setQuickView] = useState<string | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [rejectReason, setRejectReason] = useState('');
  const [bulkAction, setBulkAction] = useState<'approve' | 'reject' | 'suspend' | null>(null);
  const queryClient = useQueryClient();

  const { data: students, isLoading } = useQuery({
    queryKey: ['directory-students'],
    queryFn: () => userApi.getStudents().then((response) => response.data),
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['directory-students'] });
    queryClient.invalidateQueries({ queryKey: ['pending-users'] });
  };
  const statusMutation = useUserStatusMutation([['directory-students']], 'Student');
  const approveMutation = useMutation({
    mutationFn: (id: string) => userApi.approve(id),
    onSuccess: () => { toast.success('Student approved'); invalidate(); },
  });
  const rejectMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => userApi.reject(id, reason),
    onSuccess: () => { toast.success('Student rejected'); invalidate(); },
  });
  const deleteMutation = useMutation({
    mutationFn: (id: string) => userApi.deleteRejected(id),
    onSuccess: () => { toast.success('Rejected student deleted'); invalidate(); },
  });

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return (students ?? [])
      .filter((student) => status === 'ALL' || student.status === status)
      .filter((student) => !needle || [
        getUserName(student),
        student.email,
        student.studentProfile?.university,
        student.studentProfile?.major,
        ...(student.studentProfile?.skills ?? []),
      ].filter(Boolean).join(' ').toLowerCase().includes(needle))
      .sort((a, b) => getUserName(a).localeCompare(getUserName(b)));
  }, [query, status, students]);

  const selectedStudents = (students ?? []).filter((student) => selected.includes(student.id));
  const eligible = {
    approve: selectedStudents.filter((student) => ['PENDING', 'REJECTED'].includes(student.status)).length,
    reject: selectedStudents.filter((student) => student.status === 'PENDING').length,
    suspend: selectedStudents.filter((student) => student.status === 'APPROVED').length,
  };
  const allFilteredSelected = filtered.length > 0 && filtered.every((student) => selected.includes(student.id));
  const viewedStudent = students?.find((student) => student.id === quickView);

  const toggleStudent = (id: string) => setSelected((current) =>
    current.includes(id) ? current.filter((selectedId) => selectedId !== id) : [...current, id],
  );

  const runBulk = async (action: 'approve' | 'reject' | 'suspend') => {
    setBulkAction(action);
    const requests = selectedStudents.flatMap((student) => {
      if (action === 'approve' && ['PENDING', 'REJECTED'].includes(student.status)) return [userApi.approve(student.id)];
      if (action === 'reject' && student.status === 'PENDING') return [userApi.reject(student.id, rejectReason)];
      if (action === 'suspend' && student.status === 'APPROVED') return [userApi.suspend(student.id)];
      return [];
    });
    try {
      const results = await Promise.allSettled(requests);
      const failed = results.filter((result) => result.status === 'rejected').length;
      failed
        ? toast.error(`${results.length - failed} updated, ${failed} failed`)
        : toast.success(`${requests.length} student${requests.length === 1 ? '' : 's'} updated`);
      setSelected([]);
      invalidate();
    } finally {
      setBulkAction(null);
    }
  };

  const rejectOne = (id: string) => {
    const reason = prompt('Enter the reason for rejection:')?.trim();
    if (reason) rejectMutation.mutate({ id, reason });
  };

  return (
    <div>
      <PageHeader title='Students' description={`${filtered.length} of ${students?.length ?? 0} students shown`} />

      <Tabs.Root
        variant='secondary'
        selectedKey={status}
        onSelectionChange={(key) => { setStatus(String(key)); setSelected([]); }}
        className='mb-4'
      >
        <Tabs.ListContainer>
          <Tabs.List aria-label='Student status'>
            {STATUSES.map(([value, label]) => <Tabs.Tab key={value} id={value}><Tabs.Indicator />{label}</Tabs.Tab>)}
          </Tabs.List>
        </Tabs.ListContainer>
      </Tabs.Root>

      <ListToolbar
        searchLabel='Search students'
        placeholder='Search name, university, major, or skill'
        value={query}
        onChange={setQuery}
        selection={<><SelectCheckbox selected={allFilteredSelected} onChange={() => setSelected(allFilteredSelected ? [] : filtered.map((student) => student.id))} label={`Select all ${filtered.length} filtered students`} /><span>Select all {filtered.length} filtered students</span></>}
      />

      <BulkActionToolbar
        noun='student'
        selectedCount={selected.length}
        eligible={eligible}
        rejectionReason={rejectReason}
        onRejectionReasonChange={setRejectReason}
        loadingAction={bulkAction}
        onAction={runBulk}
      />

      {isLoading ? (
        <div className='flex min-h-64 items-center justify-center rounded-lg border border-border bg-surface'><Spinner /></div>
      ) : filtered.length === 0 ? (
        <div className='rounded-lg border border-border bg-surface px-5 py-16 text-center text-sm text-muted'>No students match these filters.</div>
      ) : (
        <>
          <div className='hidden md:block'>
            <Table variant='secondary'>
              <Table.ScrollContainer>
                <Table.Content aria-label='Students'>
                  <Table.Header>
                    <Table.Column className='w-12'>Select</Table.Column>
                    <Table.Column isRowHeader>Student</Table.Column>
                    <Table.Column>Academic profile</Table.Column>
                    <Table.Column>Party</Table.Column>
                    <Table.Column>Status</Table.Column>
                    <Table.Column className='text-right'>Actions</Table.Column>
                  </Table.Header>
                  <Table.Body>
                    {filtered.map((student) => (
                      <Table.Row key={student.id} id={student.id}>
                        <Table.Cell>
                          <SelectCheckbox selected={selected.includes(student.id)} onChange={() => toggleStudent(student.id)} label={`Select ${getUserName(student)}`} />
                        </Table.Cell>
                        <Table.Cell>
                          <div className='flex items-center gap-3'>
                            <span className='flex size-9 shrink-0 items-center justify-center rounded-md bg-default text-xs font-semibold'>
                              {getUserName(student).split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase()}
                            </span>
                            <span className='min-w-0'>
                              <span className='block truncate text-sm font-medium'>{getUserName(student)}</span>
                              <a href={`mailto:${student.email}`} className='block truncate text-xs text-muted hover:text-foreground'>{student.email}</a>
                            </span>
                          </div>
                        </Table.Cell>
                        <Table.Cell>
                          <p className='text-sm'>{student.studentProfile?.university ?? 'Not provided'}</p>
                          <p className='text-xs text-muted'>{student.studentProfile?.major ?? 'No major'}</p>
                        </Table.Cell>
                        <Table.Cell>
                          {student.partyId
                            ? <Link to={`/coordinator/parties?party=${student.partyId}`} className='text-sm font-medium hover:underline'>{student.partyName}</Link>
                            : <span className='text-sm text-muted'>No party</span>}
                        </Table.Cell>
                        <Table.Cell><StatusBadge status={student.status} /></Table.Cell>
                        <Table.Cell>
                          <div className='flex justify-end gap-1'>
                            <RowActions
                              student={student}
                              onApprove={() => approveMutation.mutate(student.id)}
                              onReject={() => rejectOne(student.id)}
                              onSuspend={(suspended) => statusMutation.mutate({ id: student.id, suspended })}
                              onDelete={() => confirm(`Delete ${getUserName(student)} so this email can register again?`) && deleteMutation.mutate(student.id)}
                              onView={() => setQuickView(quickView === student.id ? null : student.id)}
                            />
                          </div>
                        </Table.Cell>
                      </Table.Row>
                    ))}
                  </Table.Body>
                </Table.Content>
              </Table.ScrollContainer>
            </Table>
          </div>

          <div className='space-y-3 md:hidden'>
            {filtered.map((student) => (
              <article key={student.id} className='rounded-lg border border-border bg-surface p-4'>
                <div className='flex items-start gap-3'>
                  <SelectCheckbox selected={selected.includes(student.id)} onChange={() => toggleStudent(student.id)} label={`Select ${getUserName(student)}`} />
                  <div className='min-w-0 flex-1'>
                    <div className='flex flex-wrap items-center gap-2'>
                      <h2 className='font-medium'>{getUserName(student)}</h2>
                      <StatusBadge status={student.status} />
                    </div>
                    <p className='mt-1 truncate text-sm text-muted'>{student.email}</p>
                    <p className='mt-2 text-sm'>{student.studentProfile?.university ?? 'University not provided'}</p>
                    <p className='text-xs text-muted'>{student.partyName ?? 'No party'}</p>
                  </div>
                </div>
                <div className='mt-4 flex flex-wrap gap-2 border-t border-separator pt-3'>
                  <RowActions
                    student={student}
                    onApprove={() => approveMutation.mutate(student.id)}
                    onReject={() => rejectOne(student.id)}
                    onSuspend={(suspended) => statusMutation.mutate({ id: student.id, suspended })}
                    onDelete={() => confirm(`Delete ${getUserName(student)} so this email can register again?`) && deleteMutation.mutate(student.id)}
                    onView={() => setQuickView(quickView === student.id ? null : student.id)}
                  />
                </div>
              </article>
            ))}
          </div>
        </>
      )}

      {viewedStudent && <QuickView student={viewedStudent} />}
    </div>
  );
}

function RowActions({
  student,
  onApprove,
  onReject,
  onSuspend,
  onDelete,
  onView,
}: {
  student: any;
  onApprove: () => void;
  onReject: () => void;
  onSuspend: (suspended: boolean) => void;
  onDelete: () => void;
  onView: () => void;
}) {
  return (
    <>
      {['PENDING', 'REJECTED'].includes(student.status) && <Button size='sm' variant='primary' onPress={onApprove}><CheckCircle size={14} /> Approve</Button>}
      {student.status === 'PENDING' && <Button size='sm' variant='danger-soft' onPress={onReject}><XCircle size={14} /> Reject</Button>}
      {student.status === 'APPROVED' && <Button size='sm' variant='secondary' onPress={() => onSuspend(true)}><PauseCircle size={14} /> Suspend</Button>}
      {student.status === 'SUSPENDED' && <Button size='sm' variant='primary' onPress={() => onSuspend(false)}><PlayCircle size={14} /> Restore</Button>}
      {student.status === 'REJECTED' && <Button size='sm' variant='danger-soft' onPress={onDelete}><Trash2 size={14} /> Delete</Button>}
      <Button size='sm' variant='ghost' onPress={onView}><Eye size={14} /> Quick view</Button>
      <Link to={`/coordinator/students/${student.id}`} className={buttonVariants({ size: 'sm', variant: 'ghost' })}><ExternalLink size={14} /> Full profile</Link>
    </>
  );
}

function QuickView({ student }: { student: any }) {
  const profile = student.studentProfile;
  return (
    <section className='mt-4 rounded-lg border border-border bg-surface p-5'>
      <div className='flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between'>
        <div>
          <h2 className='text-lg font-semibold'>{getUserName(student)}</h2>
          <a href={`mailto:${student.email}`} className='mt-1 flex items-center gap-1.5 text-sm text-muted hover:text-foreground'><Mail size={14} /> {student.email}</a>
        </div>
        <Link to={`/coordinator/students/${student.id}`} className='text-sm font-medium hover:underline'>Open full profile</Link>
      </div>
      <dl className='mt-5 grid gap-4 border-t border-separator pt-5 text-sm sm:grid-cols-2 lg:grid-cols-4'>
        <div><dt className='text-xs text-muted'>University</dt><dd className='mt-1'>{profile?.university ?? 'Not provided'}</dd></div>
        <div><dt className='text-xs text-muted'>Major and year</dt><dd className='mt-1'>{profile?.major ?? 'Not provided'} · {profile?.yearOfStudy ?? 'N/A'}</dd></div>
        <div><dt className='text-xs text-muted'>GitHub</dt><dd className='mt-1'>{student.githubUsername ?? 'Not connected'}</dd></div>
        <div><dt className='text-xs text-muted'>Phone</dt><dd className='mt-1'>{student.phoneNumber ?? 'Not provided'}</dd></div>
      </dl>
      {(profile?.skills ?? []).length > 0 && (
        <div className='mt-5 flex flex-wrap gap-2'>{profile.skills.map((skill: string) => <span key={skill} className='rounded-sm bg-default px-2 py-1 text-xs'>{skill}</span>)}</div>
      )}
    </section>
  );
}
