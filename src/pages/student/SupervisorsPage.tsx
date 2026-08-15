import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { userApi } from '../../api/services';
import { getUserName } from '../../types';
import { Mail, UserCheck } from 'lucide-react';
import clsx from 'clsx';
import { Label } from '@heroui/react/label';
import { ListBox } from '@heroui/react/list-box';
import { Select } from '@heroui/react/select';
import { Skeleton } from '@heroui/react/skeleton';
import { EmptyState, ListToolbar, PageHeader, StatusBadge } from '../../components/ui/TalentBridgeUI';

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

      <ListToolbar searchLabel='Search supervisors' placeholder='Search supervisors' value={query} onChange={setQuery} filters={<Select.Root className='w-full sm:w-52' aria-label='Supervisor role' selectedKey={role} onSelectionChange={(key) => setRole(String(key))}><Label className='sr-only'>Supervisor role</Label><Select.Trigger><Select.Value /><Select.Indicator /></Select.Trigger><Select.Popover><ListBox><ListBox.Item id='ALL' textValue='All supervisors'>All supervisors</ListBox.Item><ListBox.Item id='PARTY_SUPERVISOR' textValue='Party supervisors'>Party supervisors</ListBox.Item><ListBox.Item id='PROJECT_SUPERVISOR' textValue='Project supervisors'>Project supervisors</ListBox.Item></ListBox></Select.Popover></Select.Root>} />

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
