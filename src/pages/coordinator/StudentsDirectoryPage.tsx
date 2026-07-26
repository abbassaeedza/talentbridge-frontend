import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { userApi } from '../../api/services';
import { getUserName } from '../../types';
import { ChevronDown, ChevronUp, Mail, PauseCircle, PlayCircle, Search } from 'lucide-react';
import clsx from 'clsx';
import useUserStatusMutation from '../../hooks/useUserStatusMutation';

export default function StudentsDirectoryPage() {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('ALL');
  const [expanded, setExpanded] = useState<string | null>(null);

  const { data: students, isLoading } = useQuery({
    queryKey: ['directory-students'],
    queryFn: () => userApi.getStudents().then((r) => r.data),
  });

  const statusMutation = useUserStatusMutation([['directory-students']], 'Student');

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
                  <div className='flex items-start gap-4'>
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
                    <div className='flex gap-2'>
                      {student.status === 'APPROVED' && (
                        <button onClick={() => statusMutation.mutate({ id: student.id, suspended: true })} className='btn-secondary text-xs px-3 py-1.5'><PauseCircle size={13} /> Suspend</button>
                      )}
                      {student.status === 'SUSPENDED' && (
                        <button onClick={() => statusMutation.mutate({ id: student.id, suspended: false })} className='btn-primary text-xs px-3 py-1.5'><PlayCircle size={13} /> Unsuspend</button>
                      )}
                      <button onClick={() => setExpanded(isOpen ? null : student.id)} className='btn-ghost text-xs'>
                        {isOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />} Profile
                      </button>
                    </div>
                  </div>
                  {isOpen && (
                    <div className='mt-4 ml-14 p-4 rounded-xl bg-ink-800/50 border border-ink-700/50 grid md:grid-cols-2 gap-4 text-xs'>
                      <div>
                        <p className='text-ink-500 uppercase font-semibold mb-1'>Bio</p>
                        <p className='text-ink-300 leading-relaxed'>{profile?.bio || profile?.pastExperience || 'No profile details provided.'}</p>
                      </div>
                      <div>
                        <p className='text-ink-500 uppercase font-semibold mb-1'>Skills</p>
                        <div className='flex flex-wrap gap-1.5'>
                          {(profile?.skills ?? []).length > 0 ? profile!.skills.map((skill) => (
                            <span key={skill} className='px-2 py-1 rounded-lg bg-ink-700 text-ink-300'>{skill}</span>
                          )) : <span className='text-ink-400'>No skills listed.</span>}
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
