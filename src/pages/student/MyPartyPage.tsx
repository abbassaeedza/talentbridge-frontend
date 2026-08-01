import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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
        <div className='w-6 h-6 border-2 border-ember-500 border-t-transparent rounded-full animate-spin' />
      </div>
    );

  return (
    <div className='animate-fade-up max-w-3xl'>
      <div className='page-header'>
        <h1 className='page-title'>My Party</h1>
        <p className='page-subtitle'>
          Collaborate with your team and apply to industry projects.
        </p>
      </div>

      {!party ? (
        <div className='space-y-4'>
          <div className='card p-6'>
            <h2 className='font-display font-semibold text-white mb-1'>
              Create a Party
            </h2>
            <p className='text-xs text-ink-400 mb-4'>
              Start your own team and invite classmates
              {rules ? ` (${rules.minSize}-${rules.maxSize} members).` : '.'}
            </p>
            {!createOpen ? (
              <button
                onClick={() => setCreateOpen(true)}
                className='btn-primary'
              >
                <Plus size={15} /> Create Party
              </button>
            ) : (
              <div className='space-y-3'>
                <div>
                  <label htmlFor='party-name' className='input-label'>Party name *</label>
                  <input
                    id='party-name'
                    className='input'
                    value={newPartyName}
                    maxLength={100}
                    onChange={(e) => setNewPartyName(e.target.value)}
                    placeholder='Team Phoenix'
                  />
                </div>
                <div className='grid grid-cols-2 gap-3'>
                  <div>
                    <label htmlFor='party-semester' className='input-label'>Semester</label>
                    <select
                      id='party-semester'
                      className='input'
                      value={semester}
                      onChange={(e) => setSemester(e.target.value)}
                    >
                      <option value='Spring'>Spring</option>
                      <option value='Fall'>Fall</option>
                    </select>
                  </div>
                  <div>
                    <label htmlFor='party-year' className='input-label'>Academic year</label>
                    <input
                      id='party-year'
                      type='number'
                      min={2020}
                      max={2100}
                      className='input'
                      value={academicYear}
                      onChange={(e) => setAcademicYear(Number(e.target.value))}
                    />
                  </div>
                </div>
                <div className='flex gap-2'>
                  <button
                    onClick={() => setCreateOpen(false)}
                    className='btn-secondary'
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => createMutation.mutate()}
                    disabled={!newPartyName.trim() || !semester || !academicYear || createMutation.isPending}
                    className='btn-primary'
                  >
                    {createMutation.isPending ? '...' : 'Create'}
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className='card p-6'>
            <h2 className='font-display font-semibold text-white mb-1'>
              Join a Party
            </h2>
            <p className='text-xs text-ink-400 mb-4'>
              Enter a party ID or paste a join link.
            </p>
            <div className='flex gap-2'>
              <input
                className='input flex-1'
                value={joinId}
                onChange={(e) => setJoinId(e.target.value)}
                placeholder='Paste party ID or join link...'
              />
              <button
                onClick={() => joinMutation.mutate()}
                disabled={!joinId || joinMutation.isPending}
                className='btn-primary px-4'
              >
                {joinMutation.isPending ? '...' : 'Join'}
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className='space-y-5'>
          {/* Party card */}
          <div className='card p-6'>
            <div className='flex items-start justify-between mb-5'>
              <div className='flex items-center gap-3'>
                <div className='w-12 h-12 rounded-2xl bg-ink-700 border border-ink-600/50 flex items-center justify-center font-display font-bold text-xl text-ink-200'>
                  {party.name?.[0] ?? '?'}
                </div>
                <div>
                  <h2 className='font-display font-bold text-white text-lg'>
                    {party.name}
                  </h2>
                  <div className='flex items-center gap-2 mt-1'>
                    <span
                      className={clsx(
                        'badge text-[10px]',
                        party.status === 'FORMING' && 'badge-forming',
                        party.status === 'ACTIVE' && 'badge-active',
                        party.status === 'ASSIGNED' && 'badge-assigned',
                        party.status === 'SUBMITTED' && 'badge-submitted',
                      )}
                    >
                      {party.status}
                    </span>
                    {party.semester && (
                      <span className='text-xs text-ink-500'>
                        {party.semester} {party.academicYear}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Members */}
            <div className='mb-5'>
              <p className='text-xs font-semibold text-ink-400 uppercase tracking-wider mb-3'>
                Members ({members.length})
              </p>
              <div className='space-y-2'>
                {members.map((m: any) => (
                  <div
                    key={m.id}
                    className='flex items-center gap-3 p-3 rounded-xl bg-ink-800/50'
                  >
                    <div className='w-8 h-8 rounded-lg bg-ink-700 flex items-center justify-center text-xs font-bold text-ink-200'>
                      {m.firstName?.[0]}
                      {m.lastName?.[0]}
                    </div>
                    <div className='flex-1 min-w-0'>
                      <p className='text-sm font-medium text-ink-100 flex items-center gap-1.5'>
                        {m.firstName} {m.lastName}
                        {m.id === party.leader?.id && (
                          <Crown size={11} className='text-amber-400' />
                        )}
                      </p>
                      <p className='text-xs text-ink-500'>{m.email}</p>
                    </div>
                    <div className='flex items-center gap-2'>
                      <div className='flex flex-wrap gap-1 justify-end'>
                        {(m.skills ?? []).slice(0, 3).map((s: string) => (
                          <span
                            key={s}
                            className='px-1.5 py-0.5 rounded bg-ink-700 text-ink-400 text-[10px]'
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
                            <button
                              onClick={() => changeLeaderMutation.mutate(m.id)}
                              disabled={changeLeaderMutation.isPending}
                              className='px-2 py-1 rounded-lg bg-amber-500/20 border border-amber-500/30 text-amber-400 text-[10px] font-semibold hover:bg-amber-500/30 transition-colors'
                            >
                              Confirm
                            </button>
                            <button
                              onClick={() => setTransferingTo(null)}
                              className='px-2 py-1 rounded-lg bg-ink-700 text-ink-400 text-[10px] hover:bg-ink-600 transition-colors'
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setTransferingTo(m.id)}
                            title='Make leader'
                            className='p-1.5 rounded-lg text-ink-600 hover:text-amber-400 hover:bg-amber-500/10 transition-colors'
                          >
                            <UserCheck size={13} />
                          </button>
                        ))}
                    </div>
                  </div>
                ))}
              </div>
              {isLeader && members.length > 1 && (
                <p className='text-[10px] text-ink-600 mt-2 flex items-center gap-1'>
                  <UserCheck size={10} /> Click the icon next to a member to
                  transfer leadership.
                </p>
              )}
            </div>

            {party.supervisorName && (
              <div className='mb-4 p-3 rounded-xl bg-ink-800/50'>
                <p className='text-xs text-ink-400'>
                  <span className='font-semibold text-ink-300'>
                    Supervisor:
                  </span>{' '}
                  {party.supervisorName}
                </p>
              </div>
            )}

            {party.assignedProjectTitle && (
              <div className='mb-4 p-3 rounded-xl bg-jade-500/10 border border-jade-500/20'>
                <p className='text-xs font-semibold text-jade-400 flex items-center gap-1.5'>
                  <Briefcase size={12} /> Assigned: {party.assignedProjectTitle}
                </p>
              </div>
            )}

            {/* Invite link */}
            <div className='pt-4 border-t border-ink-800/50'>
              <p className='text-xs font-semibold text-ink-400 uppercase tracking-wider mb-2'>
                Invite Link
              </p>
              <div className='flex items-center gap-2'>
                <code className='flex-1 text-xs font-mono text-ember-300 bg-ink-800 px-3 py-2 rounded-lg select-all break-all'>
                  {joinLink}
                </code>
                <button
                  onClick={copyLink}
                  className='flex-shrink-0 p-2 rounded-lg bg-ink-700 hover:bg-ink-600 transition-colors text-ink-300 hover:text-white'
                >
                  {copied ? (
                    <Check size={15} className='text-jade-400' />
                  ) : (
                    <Copy size={15} />
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Applications — visible to ALL members */}
          <div className='card p-5'>
            <div className='flex items-center gap-2 mb-4'>
              <ClipboardList size={16} className='text-ink-400' />
              <h3 className='font-display font-semibold text-white'>
                Project Applications
              </h3>
              <span className='ml-auto text-xs text-ink-500'>
                {apps.length} application{apps.length !== 1 ? 's' : ''}
              </span>
            </div>

            {apps.length === 0 ? (
              <div className='text-center py-6'>
                <p className='text-ink-400 text-sm'>
                  No applications submitted yet.
                </p>
                {isLeader && party.status !== 'ASSIGNED' && (
                  <p className='text-xs text-ink-500 mt-1'>
                    Browse projects and apply as party leader.
                  </p>
                )}
              </div>
            ) : (
              <div className='space-y-2'>
                {apps.map((app: any) => (
                  <div
                    key={app.id}
                    className='flex items-center gap-3 p-3 rounded-xl bg-ink-800/50'
                  >
                    <div
                      className={clsx(
                        'w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold flex-shrink-0',
                        app.rankPosition === 1 &&
                          'bg-amber-500/20 text-amber-400',
                        app.rankPosition === 2 && 'bg-ink-600 text-ink-300',
                        app.rankPosition === 3 && 'bg-ink-600 text-ink-400',
                        app.rankPosition > 3 && 'bg-ink-700 text-ink-500',
                      )}
                    >
                      #{app.rankPosition}
                    </div>
                    <div className='flex-1 min-w-0'>
                      <p className='text-sm font-medium text-ink-100 truncate'>
                        {app.projectTitle}
                      </p>
                      <p className='text-xs text-ink-500'>{app.companyName}</p>
                    </div>
                    <span
                      className={clsx(
                        'badge text-[10px] flex-shrink-0',
                        app.status === 'PENDING' && 'badge-pending',
                        app.status === 'ASSIGNED' && 'badge-active',
                        app.status === 'REASSIGNED' &&
                          'bg-red-500/15 text-red-400 border-red-500/20',
                      )}
                    >
                      {app.status}
                    </span>
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
