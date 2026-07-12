import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { userApi } from '../../api/services';
import { getUserName } from '../../types';
import { Mail, Search, UserCheck } from 'lucide-react';
import clsx from 'clsx';

export default function SupervisorsPage() {
  const [query, setQuery] = useState('');
  const [role, setRole] = useState('ALL');

  const { data: supervisors, isLoading } = useQuery({
    queryKey: ['student-supervisors'],
    queryFn: () => userApi.getSupervisors().then((r) => r.data.filter((u) => u.status === 'APPROVED')),
  });

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return (supervisors ?? [])
      .filter((s) => role === 'ALL' || s.role === role)
      .filter((s) => !needle || [getUserName(s), s.email, s.role].join(' ').toLowerCase().includes(needle))
      .sort((a, b) => getUserName(a).localeCompare(getUserName(b)));
  }, [supervisors, query, role]);

  return (
    <div className='animate-fade-up'>
      <div className='page-header'>
        <h1 className='page-title'>Supervisors</h1>
        <p className='page-subtitle'>Find party and project supervisors for guidance.</p>
      </div>

      <div className='card p-4 mb-5 grid md:grid-cols-[1fr_auto] gap-3'>
        <div className='relative'>
          <Search size={15} className='absolute left-3 top-1/2 -translate-y-1/2 text-ink-500' />
          <input className='input pl-9' placeholder='Search supervisors…' value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <select className='input text-sm' value={role} onChange={(e) => setRole(e.target.value)}>
          <option value='ALL'>All supervisors</option>
          <option value='PARTY_SUPERVISOR'>Party supervisors</option>
          <option value='PROJECT_SUPERVISOR'>Project supervisors</option>
        </select>
      </div>

      {isLoading ? (
        <div className='grid md:grid-cols-2 lg:grid-cols-3 gap-4'>
          {Array.from({ length: 6 }).map((_, i) => <div key={i} className='card h-28 animate-pulse' />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className='card p-12 text-center text-sm text-ink-400'>No supervisors found.</div>
      ) : (
        <div className='grid md:grid-cols-2 lg:grid-cols-3 gap-4'>
          {filtered.map((supervisor) => (
            <div key={supervisor.id} className='card p-5'>
              <div className='flex items-start gap-3'>
                <div className='w-11 h-11 rounded-xl bg-violet-500/15 border border-violet-500/20 flex items-center justify-center text-violet-400'>
                  <UserCheck size={20} />
                </div>
                <div className='flex-1 min-w-0'>
                  <p className='font-semibold text-white text-sm'>{getUserName(supervisor)}</p>
                  <span className={clsx('badge text-[10px] mt-1',
                    supervisor.role === 'PARTY_SUPERVISOR' ? 'badge-active' : 'badge-assigned',
                  )}>{supervisor.role.replace('_', ' ')}</span>
                  <a href={`mailto:${supervisor.email}`} className='text-xs text-ink-400 hover:text-ember-400 flex items-center gap-1 mt-3'>
                    <Mail size={11} /> {supervisor.email}
                  </a>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
