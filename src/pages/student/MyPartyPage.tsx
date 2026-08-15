import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { partyApi } from '../../api/services';
import { useAuth } from '../../contexts/AuthContext';
import {
  Crown,
  Briefcase,
  Plus,
  ClipboardList,
  Copy,
  Check,
  UserCheck,
} from 'lucide-react';
import toast from 'react-hot-toast';
import clsx from 'clsx';
import { Button } from '@heroui/react/button';
import { Input } from '@heroui/react/input';
import { Label } from '@heroui/react/label';
import { ListBox } from '@heroui/react/list-box';
import { Select } from '@heroui/react/select';
import { Spinner } from '@heroui/react/spinner';
import { TextField } from '@heroui/react/textfield';
import { PageHeader, StatusBadge } from '../../components/ui/TalentBridgeUI';

export default function MyPartyPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [joinId, setJoinId] = useState('');
  const [newPartyName, setNewPartyName] = useState('');
  const [semester, setSemester] = useState(new Date().getMonth() < 6 ? 'Spring' : 'Fall');
  const [academicYear, setAcademicYear] = useState(new Date().getFullYear());
  const [copied, setCopied] = useState(false);
  const [transferingTo, setTransferingTo] = useState<string | null>(null);

  const { data: party, isLoading: partyLoading } = useQuery({
    queryKey: ['my-party'],
    queryFn: () =>
      partyApi
        .getMyParty()
        .then((r) => r.data)
        .catch(() => null),
    retry: false,
  });

  const { data: rules } = useQuery({
    queryKey: ['party-rules'],
    queryFn: () => partyApi.getRules().then((r) => r.data),
  });

  const { data: applications } = useQuery({
    queryKey: ['party-applications', party?.id],
    queryFn: () =>
      partyApi.getApplicationsByParty(party!.id).then((r) => r.data),
    enabled: !!party?.id,
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['my-party'] });
    qc.invalidateQueries({ queryKey: ['party-applications'] });
  };

  const createMutation = useMutation({
    mutationFn: () => partyApi.create({ name: newPartyName, semester, academicYear }),
    onSuccess: () => {
      toast.success('Party created!');
      invalidate();
      setCreateOpen(false);
      setNewPartyName('');
    },
    onError: (e: any) =>
      toast.error(e?.response?.data?.message || 'Failed to create party'),
  });

  const joinMutation = useMutation({
    mutationFn: () => partyApi.join(joinId.trim()),
    onSuccess: () => {
      toast.success('Joined party!');
      invalidate();
      setJoinId('');
    },
    onError: (e: any) =>
      toast.error(e?.response?.data?.message || 'Failed to join party'),
  });

  const changeLeaderMutation = useMutation({
    mutationFn: (newLeaderId: string) =>
      partyApi.changeLeader(party!.id, newLeaderId),
    onSuccess: () => {
      toast.success('Leadership transferred!');
      setTransferingTo(null);
      invalidate();
    },
    onError: (e: any) =>
      toast.error(
        e?.response?.data?.message || 'Failed to transfer leadership',
      ),
  });

  const isLeader = party?.leader?.id === user?.id;
  const members = party?.members ?? [];
  const apps = (applications ?? []).sort(
    (a: any, b: any) => a.rankPosition - b.rankPosition,
  );

  const joinLink = party ? `${window.location.origin}/join/${party.id}` : '';
  const copyLink = () => {
    navigator.clipboard.writeText(joinLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success('Join link copied!');
  };

  if (partyLoading)
    return (
      <div className='flex items-center justify-center py-24'>
        <Spinner />
      </div>
    );

  return (
    <div className=' max-w-3xl'>
      <PageHeader title='My party' description='Manage your team and review ranked project applications.' />

      {!party ? (
        <div className='space-y-4'>
          <div className='rounded-lg border border-border bg-surface p-6'>
            <h2 className=' font-semibold text-foreground mb-1'>
              Create a Party
            </h2>
            <p className='text-xs text-muted mb-4'>
              Start your own team and invite classmates
              {rules ? ` (${rules.minSize}-${rules.maxSize} members).` : '.'}
            </p>
            {!createOpen ? (
              <Button variant='primary' onPress={() => setCreateOpen(true)}>
                <Plus size={15} /> Create Party
              </Button>
            ) : (
              <div className='space-y-3'>
                <div>
                  <TextField fullWidth isRequired><Label>Party name</Label><Input
                    value={newPartyName}
                    maxLength={100}
                    onChange={(e) => setNewPartyName(e.target.value)}
                    placeholder='Team Phoenix'
                  /></TextField>
                </div>
                <div className='grid grid-cols-2 gap-3'>
                  <div>
                    <Select.Root selectedKey={semester} onSelectionChange={(key) => setSemester(String(key))}><Label>Semester</Label><Select.Trigger aria-label='Semester'><Select.Value /><Select.Indicator /></Select.Trigger><Select.Popover><ListBox><ListBox.Item id='Spring' textValue='Spring'>Spring</ListBox.Item><ListBox.Item id='Fall' textValue='Fall'>Fall</ListBox.Item></ListBox></Select.Popover></Select.Root>
                  </div>
                  <div>
                    <TextField fullWidth><Label>Academic year</Label><Input
                      type='number'
                      min={2020}
                      max={2100}
                      value={academicYear}
                      onChange={(e) => setAcademicYear(Number(e.target.value))}
                    /></TextField>
                  </div>
                </div>
                <div className='flex gap-2'>
                  <Button variant='secondary' onPress={() => setCreateOpen(false)}>
                    Cancel
                  </Button>
                  <Button variant='primary' onPress={() => createMutation.mutate()} isDisabled={!newPartyName.trim() || !semester || !academicYear || createMutation.isPending}>
                    {createMutation.isPending ? '...' : 'Create'}
                  </Button>
                </div>
              </div>
            )}
          </div>

          <div className='rounded-lg border border-border bg-surface p-6'>
            <h2 className=' font-semibold text-foreground mb-1'>
              Join a Party
            </h2>
            <p className='text-xs text-muted mb-4'>
              Enter a party ID or paste a join link.
            </p>
            <div className='flex gap-2'>
              <Input fullWidth aria-label='Party ID or join link'
                className='flex-1'
                value={joinId}
                onChange={(e) => setJoinId(e.target.value)}
                placeholder='Paste party ID or join link...'
              />
              <Button variant='primary' onPress={() => joinMutation.mutate()} isDisabled={!joinId || joinMutation.isPending}>
                {joinMutation.isPending ? '...' : 'Join'}
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <div className='space-y-5'>
          {/* Party card */}
          <div className='rounded-lg border border-border bg-surface p-6'>
            <div className='flex items-start justify-between mb-5'>
              <div className='flex items-center gap-3'>
                <div className='w-12 h-12 rounded-lg bg-default border border-border flex items-center justify-center  font-bold text-xl text-foreground'>
                  {party.name?.[0] ?? '?'}
                </div>
                <div>
                  <h2 className=' font-bold text-foreground text-lg'>
                    {party.name}
                  </h2>
                  <div className='flex items-center gap-2 mt-1'>
                    <StatusBadge status={party.status} />
                    {party.semester && (
                      <span className='text-xs text-muted'>
                        {party.semester} {party.academicYear}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Members */}
            <div className='mb-5'>
              <p className='text-xs font-semibold text-muted uppercase tracking-wider mb-3'>
                Members ({members.length})
              </p>
              <div className='space-y-2'>
                {members.map((m: any) => (
                  <div
                    key={m.id}
                    className='flex items-center gap-3 p-3 rounded-lg bg-surface-secondary'
                  >
                    <div className='w-8 h-8 rounded-lg bg-default flex items-center justify-center text-xs font-bold text-foreground'>
                      {m.firstName?.[0]}
                      {m.lastName?.[0]}
                    </div>
                    <div className='flex-1 min-w-0'>
                      <p className='text-sm font-medium text-foreground flex items-center gap-1.5'>
                        {m.firstName} {m.lastName}
                        {m.id === party.leader?.id && (
                          <Crown size={11} className='text-accent' />
                        )}
                      </p>
                      <p className='text-xs text-muted'>{m.email}</p>
                    </div>
                    <div className='flex items-center gap-2'>
                      <div className='flex flex-wrap gap-1 justify-end'>
                        {(m.skills ?? []).slice(0, 3).map((s: string) => (
                          <span
                            key={s}
                            className='px-1.5 py-0.5 rounded bg-default text-muted text-[10px]'
                          >
                            {s}
                          </span>
                        ))}
                      </div>
                      {/* Leader can transfer leadership to other members */}
                      {isLeader &&
                        m.id !== user?.id &&
                        (transferingTo === m.id ? (
                          <div className='flex gap-1'>
                            <Button size='sm' variant='secondary' onPress={() => changeLeaderMutation.mutate(m.id)} isDisabled={changeLeaderMutation.isPending}>
                              Confirm
                            </Button>
                            <Button size='sm' variant='ghost' onPress={() => setTransferingTo(null)}>
                              Cancel
                            </Button>
                          </div>
                        ) : (
                          <Button isIconOnly size='sm' variant='ghost' onPress={() => setTransferingTo(m.id)} aria-label={`Make ${m.firstName} leader`}>
                            <UserCheck size={13} />
                          </Button>
                        ))}
                    </div>
                  </div>
                ))}
              </div>
              {isLeader && members.length > 1 && (
                <p className='text-[10px] text-muted mt-2 flex items-center gap-1'>
                  <UserCheck size={10} /> Click the icon next to a member to
                  transfer leadership.
                </p>
              )}
            </div>

            {party.supervisorName && (
              <div className='mb-4 p-3 rounded-lg bg-surface-secondary'>
                <p className='text-xs text-muted'>
                  <span className='font-semibold text-foreground'>
                    Supervisor:
                  </span>{' '}
                  {party.supervisorName}
                </p>
              </div>
            )}

            {party.assignedProjectTitle && (
              <Link to={`/student/projects/${party.assignedProjectId}`} className='mb-4 flex items-center gap-2 rounded-lg border border-success/40 bg-success/10 p-3 text-xs font-semibold text-foreground hover:border-success'>
                <Briefcase size={14} className='text-success' /> Assigned: {party.assignedProjectTitle}
              </Link>
            )}

            {/* Invite link */}
            <div className='pt-4 border-t border-border'>
              <p className='text-xs font-semibold text-muted uppercase tracking-wider mb-2'>
                Invite Link
              </p>
              <div className='flex items-center gap-2'>
                <code className='flex-1 text-xs font-mono text-accent bg-surface-secondary px-3 py-2 rounded-lg select-all break-all'>
                  {joinLink}
                </code>
                <Button isIconOnly variant='secondary' onPress={copyLink} aria-label='Copy party join link'>
                  {copied ? (
                    <Check size={15} className='text-success' />
                  ) : (
                    <Copy size={15} />
                  )}
                </Button>
              </div>
            </div>
          </div>

          {/* Applications — visible to ALL members */}
          <div className='rounded-lg border border-border bg-surface p-5'>
            <div className='flex items-center gap-2 mb-4'>
              <ClipboardList size={16} className='text-muted' />
              <h3 className=' font-semibold text-foreground'>
                Project Applications
              </h3>
              <span className='ml-auto text-xs text-muted'>
                {apps.length} application{apps.length !== 1 ? 's' : ''}
              </span>
            </div>

            {apps.length === 0 ? (
              <div className='text-center py-6'>
                <p className='text-muted text-sm'>
                  No applications submitted yet.
                </p>
                {isLeader && party.status !== 'ASSIGNED' && (
                  <p className='text-xs text-muted mt-1'>
                    Browse projects and apply as party leader.
                  </p>
                )}
              </div>
            ) : (
              <div className='space-y-2'>
                {apps.map((app: any) => (
                  <div
                    key={app.id}
                    className='flex items-center gap-3 p-3 rounded-lg bg-surface-secondary'
                  >
                    <div
                      className={clsx(
                        'w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold flex-shrink-0',
                        app.rankPosition === 1 &&
                          'bg-default text-accent',
                        app.rankPosition === 2 && 'bg-default text-foreground',
                        app.rankPosition === 3 && 'bg-default text-muted',
                        app.rankPosition > 3 && 'bg-default text-muted',
                      )}
                    >
                      #{app.rankPosition}
                    </div>
                    <div className='flex-1 min-w-0'>
                      <p className='text-sm font-medium text-foreground truncate'>
                        {app.projectTitle}
                      </p>
                      <p className='text-xs text-muted'>{app.companyName}</p>
                    </div>
                    <StatusBadge status={app.status} className='flex-shrink-0' />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
