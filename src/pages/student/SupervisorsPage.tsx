import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { userApi } from '../../api/services';
import { getUserName } from '../../types';
import { Mail, Search, UserCheck } from 'lucide-react';
import clsx from 'clsx';
import { Input } from '@heroui/react/input';
import { Label } from '@heroui/react/label';
import { ListBox } from '@heroui/react/list-box';
import { Select } from '@heroui/react/select';
import { Skeleton } from '@heroui/react/skeleton';
import { EmptyState, PageHeader, StatusBadge } from '../../components/ui/TalentBridgeUI';

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
    <div className=''>
      <PageHeader title='Supervisors' description='Find approved party and project supervisors.' />

      <div className='rounded-lg border border-border bg-surface p-4 mb-5 grid md:grid-cols-[1fr_auto] gap-3'>
        <div className='relative'>
          <Search size={15} className='absolute left-3 top-1/2 -translate-y-1/2 text-muted' />
          <Input fullWidth aria-label='Search supervisors' className='pl-9' placeholder='Search supervisors' value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <Select.Root aria-label='Supervisor role' selectedKey={role} onSelectionChange={(key) => setRole(String(key))}><Label>Role</Label><Select.Trigger><Select.Value /><Select.Indicator /></Select.Trigger><Select.Popover><ListBox><ListBox.Item id='ALL'>All supervisors</ListBox.Item><ListBox.Item id='PARTY_SUPERVISOR'>Party supervisors</ListBox.Item><ListBox.Item id='PROJECT_SUPERVISOR'>Project supervisors</ListBox.Item></ListBox></Select.Popover></Select.Root>
      </div>

      {isLoading ? (
        <div className='grid md:grid-cols-2 lg:grid-cols-3 gap-4'>
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className='h-28 rounded-lg' />)}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState icon={UserCheck} title='No supervisors found' />
      ) : (
        <div className='grid md:grid-cols-2 lg:grid-cols-3 gap-4'>
          {filtered.map((supervisor) => (
            <div key={supervisor.id} className='rounded-lg border border-border bg-surface p-5'>
              <div className='flex items-start gap-3'>
                <div className='flex size-11 items-center justify-center rounded-lg border border-border bg-default text-accent'>
                  <UserCheck size={20} />
                </div>
                <div className='flex-1 min-w-0'>
                  <p className='font-semibold text-foreground text-sm'>{getUserName(supervisor)}</p>
                  <StatusBadge status={supervisor.role === 'PARTY_SUPERVISOR' ? 'ACTIVE' : 'ASSIGNED'} label={supervisor.role.replace(/_/g, ' ')} className='mt-1' />
                  <a href={`mailto:${supervisor.email}`} className='text-xs text-muted hover:text-accent flex items-center gap-1 mt-3'>
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
