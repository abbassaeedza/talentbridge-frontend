import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { userApi } from '../../api/services';
import { getUserName } from '../../types';
import { CheckCircle, ChevronDown, ChevronUp, ExternalLink, Mail, PauseCircle, PlayCircle, Search, Trash2, XCircle } from 'lucide-react';
import clsx from 'clsx';
import useUserStatusMutation from '../../hooks/useUserStatusMutation';
import toast from 'react-hot-toast';
import { Link } from 'react-router-dom';

export default function StudentsDirectoryPage() {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('ALL');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [rejectReason, setRejectReason] = useState('');
  const qc = useQueryClient();

  const { data: students, isLoading } = useQuery({
    queryKey: ['directory-students'],
    queryFn: () => userApi.getStudents().then((r) => r.data),
  });

  const statusMutation = useUserStatusMutation([['directory-students']], 'Student');
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['directory-students'] });
    qc.invalidateQueries({ queryKey: ['pending-users'] });
  };
  const approveMutation = useMutation({
    mutationFn: (id: string) => userApi.approve(id),
    onSuccess: () => { toast.success('Student approved'); invalidate(); },
  });
  const rejectMutation = useMutation({
    mutationFn: (id: string) => userApi.reject(id, rejectReason),
    onSuccess: () => { toast.success('Student rejected'); invalidate(); },
  });
  const deleteMutation = useMutation({
    mutationFn: (id: string) => userApi.deleteRejected(id),
    onSuccess: () => { toast.success('Rejected student deleted'); invalidate(); },
  });

  const runBulk = async (action: 'approve' | 'reject' | 'suspend') => {
    const chosen = (students ?? []).filter((student) => selected.includes(student.id));
    const requests = chosen.flatMap((student) => {
      if (action === 'approve' && (student.status === 'PENDING' || student.status === 'REJECTED'))
        return [userApi.approve(student.id)];
      if (action === 'reject' && student.status === 'PENDING')
        return [userApi.reject(student.id, rejectReason)];
      if (action === 'suspend' && student.status === 'APPROVED')
        return [userApi.suspend(student.id)];
      return [];
    });
    const results = await Promise.allSettled(requests);
    const failed = results.filter((result) => result.status === 'rejected').length;
    failed
      ? toast.error(`${results.length - failed} updated, ${failed} failed`)
      : toast.success(`${requests.length} student${requests.length === 1 ? '' : 's'} updated`);
    setSelected([]);
    invalidate();
  };

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return (students ?? [])
      .filter((s) => status === 'ALL' || s.status === status)
      .filter((s) => {
        if (!needle) return true;
        return [
          getUserName(s),
          s.email,
          s.studentProfile?.university,
          s.studentProfile?.major,
          ...(s.studentProfile?.skills ?? []),
        ].filter(Boolean).join(' ').toLowerCase().includes(needle);
      })
      .sort((a, b) => getUserName(a).localeCompare(getUserName(b)));
  }, [students, query, status]);

  return (
    <div className='animate-fade-up'>
      <div className='page-header'>
        <h1 className='page-title'>Students Directory</h1>
        <p className='page-subtitle'>{filtered.length} student{filtered.length === 1 ? '' : 's'} shown</p>
      </div>

      <div className='card p-4 mb-5 grid md:grid-cols-[1fr_auto] gap-3'>
        <div className='relative'>
          <Search size={15} className='absolute left-3 top-1/2 -translate-y-1/2 text-ink-500' />
          <input className='input pl-9' placeholder='Search by name, university, major, skill…' value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <select className='input text-sm' value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value='ALL'>All statuses</option>
          <option value='APPROVED'>Approved</option>
          <option value='PENDING'>Pending</option>
          <option value='SUSPENDED'>Suspended</option>
          <option value='REJECTED'>Rejected</option>
        </select>
        {selected.length > 0 && (
          <div className='md:col-span-2 flex flex-col gap-2 rounded-xl border border-ink-700/50 bg-ink-800/60 p-3 md:flex-row md:items-center'>
            <p className='flex-1 text-xs text-ink-300'>{selected.length} selected</p>
            <input
              className='input py-2 text-xs md:w-64'
              placeholder='Rejection reason…'
              value={rejectReason}
              onChange={(event) => setRejectReason(event.target.value)}
            />
            <button onClick={() => runBulk('approve')} className='btn-primary px-3 py-2 text-xs'><CheckCircle size={13} /> Approve</button>
            <button onClick={() => runBulk('reject')} className='btn-secondary px-3 py-2 text-xs text-red-300'><XCircle size={13} /> Reject</button>
            <button onClick={() => runBulk('suspend')} className='btn-secondary px-3 py-2 text-xs'><PauseCircle size={13} /> Suspend</button>
          </div>
        )}
      </div>

      <div className='card overflow-hidden'>
        {isLoading ? (
          <div className='p-12 flex justify-center'><div className='w-5 h-5 border-2 border-ember-500 border-t-transparent rounded-full animate-spin' /></div>
        ) : filtered.length === 0 ? (
          <p className='p-12 text-center text-sm text-ink-400'>No students found.</p>
        ) : (
          <div className='divide-y divide-ink-800/50'>
            {filtered.map((student) => {
              const profile = student.studentProfile;
              const isOpen = expanded === student.id;
              return (
                <div key={student.id} className='px-6 py-4'>
                  <div className='flex flex-col items-start gap-3 sm:flex-row sm:gap-4'>
                    <input
                      type='checkbox'
                      aria-label={`Select ${getUserName(student)}`}
                      checked={selected.includes(student.id)}
                      onChange={() => setSelected((current) => current.includes(student.id)
                        ? current.filter((id) => id !== student.id)
                        : [...current, student.id])}
                      className='mt-3 h-4 w-4 accent-orange-500'
                    />
                    <div className='w-10 h-10 rounded-xl bg-ink-700 flex items-center justify-center text-xs font-bold text-ink-200'>
                      {getUserName(student).split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase()}
                    </div>
                    <div className='flex-1 min-w-0'>
                      <div className='flex flex-wrap gap-2 items-center'>
                        <p className='text-sm font-semibold text-white'>{getUserName(student)}</p>
                        <span className={clsx('badge text-[10px]',
                          student.status === 'APPROVED' && 'badge-open',
                          student.status === 'PENDING' && 'badge-pending',
                          student.status === 'SUSPENDED' && 'bg-red-500/15 text-red-400 border-red-500/20',
                        )}>{student.status}</span>
                      </div>
                      <a href={`mailto:${student.email}`} className='text-xs text-ink-400 hover:text-ember-400 flex items-center gap-1 mt-1'>
                        <Mail size={11} /> {student.email}
                      </a>
                      <p className='text-xs text-ink-500 mt-1'>{profile?.university ?? 'No university'}{profile?.major ? ` · ${profile.major}` : ''}</p>
                    </div>
                    <div className='flex flex-wrap gap-2'>
                      {(student.status === 'PENDING' || student.status === 'REJECTED') && (
                        <button onClick={() => approveMutation.mutate(student.id)} className='btn-primary text-xs px-3 py-1.5'><CheckCircle size={13} /> Approve</button>
                      )}
                      {student.status === 'PENDING' && (
                        <button onClick={() => rejectMutation.mutate(student.id)} className='btn-secondary text-xs px-3 py-1.5 text-red-300'><XCircle size={13} /> Reject</button>
                      )}
                      {student.status === 'APPROVED' && (
                        <button onClick={() => statusMutation.mutate({ id: student.id, suspended: true })} className='btn-secondary text-xs px-3 py-1.5'><PauseCircle size={13} /> Suspend</button>
                      )}
                      {student.status === 'SUSPENDED' && (
                        <button onClick={() => statusMutation.mutate({ id: student.id, suspended: false })} className='btn-primary text-xs px-3 py-1.5'><PlayCircle size={13} /> Unsuspend</button>
                      )}
                      {student.status === 'REJECTED' && (
                        <button
                          onClick={() => confirm(`Delete ${getUserName(student)} so this email can register again?`) && deleteMutation.mutate(student.id)}
                          className='btn-secondary text-xs px-3 py-1.5 text-red-300'
                        >
                          <Trash2 size={13} /> Delete
                        </button>
                      )}
                      <button onClick={() => setExpanded(isOpen ? null : student.id)} className='btn-ghost text-xs'>
                        {isOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />} Profile
                      </button>
                      <Link to={`/coordinator/students/${student.id}`} className='btn-ghost text-xs'>View full</Link>
                    </div>
                  </div>
                  {isOpen && (
                    <div className='mt-4 p-4 rounded-xl bg-ink-800/50 border border-ink-700/50 grid md:grid-cols-2 gap-4 text-xs sm:ml-14'>
                      <div>
                        <p className='text-ink-500 uppercase font-semibold mb-1'>Profile</p>
                        <div className='space-y-1 text-ink-300'>
                          <p>Age: {profile?.age ?? 'Not provided'}</p>
                          <p>Year: {profile?.yearOfStudy ?? 'Not provided'}</p>
                          <p>GPA: {profile?.gpa ?? 'Not provided'}</p>
                          <p>Phone: {student.phoneNumber ?? 'Not provided'}</p>
                          <p>GitHub: {student.githubUsername ?? 'Not connected'}</p>
                        </div>
                      </div>
                      <div>
                        <p className='text-ink-500 uppercase font-semibold mb-1'>Skills</p>
                        <div className='flex flex-wrap gap-1.5'>
                          {(profile?.skills ?? []).length > 0 ? profile!.skills.map((skill) => (
                            <span key={skill} className='px-2 py-1 rounded-lg bg-ink-700 text-ink-300'>{skill}</span>
                          )) : <span className='text-ink-400'>No skills listed.</span>}
                        </div>
                      </div>
                      <div>
                        <p className='text-ink-500 uppercase font-semibold mb-1'>Bio and experience</p>
                        <p className='text-ink-300 leading-relaxed'>{profile?.bio || 'No bio provided.'}</p>
                        <p className='mt-2 text-ink-300 leading-relaxed'>{profile?.pastExperience || 'No past experience provided.'}</p>
                      </div>
                      <div>
                        <p className='text-ink-500 uppercase font-semibold mb-1'>Links and moderation</p>
                        <div className='space-y-1 text-ink-300'>
                          {profile?.linkedinUrl && <a href={profile.linkedinUrl} target='_blank' rel='noreferrer' className='flex items-center gap-1 text-ember-400'>LinkedIn <ExternalLink size={10} /></a>}
                          {profile?.portfolioUrl && <a href={profile.portfolioUrl} target='_blank' rel='noreferrer' className='flex items-center gap-1 text-ember-400'>Portfolio <ExternalLink size={10} /></a>}
                          <p>Moderation history is available in the full profile.</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
