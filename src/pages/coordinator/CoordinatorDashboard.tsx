import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { ArrowRight, Award, FolderKanban, UserCheck, Users } from 'lucide-react';
import clsx from 'clsx';
import { coordinatorApi, partyApi, projectApi, userApi } from '../../api/services';
import DeadlineCountdown from '../../components/shared/DeadlineCountdown';
import { PageHeader, StatCard, StatusBadge } from '../../components/ui/TalentBridgeUI';

function chartRows(values?: Record<string, number>) {
  return Object.entries(values ?? {})
    .filter(([, value]) => value > 0)
    .map(([name, value]) => {
      const text = name.replace(/_/g, ' ').toLowerCase();
      return { name: text.charAt(0).toUpperCase() + text.slice(1), value };
    })
    .sort((a, b) => b.value - a.value);
}

export default function CoordinatorDashboard() {
  const { data: pending } = useQuery({
    queryKey: ['pending-users'],
    queryFn: () => userApi.getPending(0, 100).then((response) => response.data),
  });
  const { data: projects } = useQuery({
    queryKey: ['all-projects'],
    queryFn: () => projectApi.getAllUnpaged(),
  });
  const { data: parties } = useQuery({
    queryKey: ['all-parties'],
    queryFn: () => partyApi.getAll().then((response) => response.data),
  });
  const { data: analytics } = useQuery({
    queryKey: ['coordinator-analytics'],
    queryFn: () => coordinatorApi.getAnalytics().then((response) => response.data),
  });

  const pendingProjects = projects?.filter((project) => project.status === 'PENDING_REVIEW').length ?? 0;
  const assignedParties = parties?.filter((party) => party.assignedProjectId).length ?? 0;
  const totalParties = parties?.length ?? 0;
  const upcomingDeadlines = (projects ?? [])
    .filter((project) => project.deadline
      && !project.finished
      && new Date(project.deadline).getTime() > Date.now()
      && ['OPEN', 'ASSIGNED'].includes(project.status))
    .sort((a, b) => new Date(a.deadline!).getTime() - new Date(b.deadline!).getTime())
    .slice(0, 5);
  const [nextDeadline, ...laterDeadlines] = upcomingDeadlines;

  const stats = [
    { label: 'Pending approvals', value: pending?.totalElements ?? 0, icon: UserCheck, to: '/coordinator/students' },
    { label: 'Projects to review', value: pendingProjects, icon: FolderKanban, to: '/coordinator/projects' },
    { label: 'Total parties', value: totalParties, icon: Users, to: '/coordinator/parties' },
    { label: 'Assigned parties', value: assignedParties, icon: Award, to: '/coordinator/evaluations' },
  ];
  const projectRows = chartRows(analytics?.projectsByStatus);
  const userRows = chartRows(analytics?.usersByRole);
  const submissionRows = chartRows(analytics?.submissionsByStatus);

  return (
    <div>
      <PageHeader
        title='Overview'
        description='Approvals, assignments, deadlines, and platform activity.'
      />

      <div className='mb-5 grid grid-cols-2 gap-2 lg:grid-cols-4'>
        {stats.map((stat) => (
          <Link key={stat.label} to={stat.to} className='rounded-lg focus-visible:outline-offset-4'>
            <StatCard {...stat} />
          </Link>
        ))}
      </div>

      <div className='mb-5 grid gap-2 lg:grid-cols-3'>
        <MeterList title='Projects by status' rows={projectRows} />
        <MeterList title='Users by role' rows={userRows} />
        <MeterList title='Submissions by status' rows={submissionRows} />
      </div>

      <section className={clsx('mb-5 grid gap-3', laterDeadlines.length > 0 && 'xl:grid-cols-[minmax(0,1.6fr)_minmax(16rem,0.8fr)]')}>
        <div>
          <div className='mb-2 flex items-center justify-between'>
            <h2 className='text-sm font-medium'>Upcoming deadlines</h2>
            <Link to='/coordinator/projects' className='flex items-center gap-1 text-xs font-medium text-muted hover:text-foreground'>
              View projects <ArrowRight size={13} />
            </Link>
          </div>
          {nextDeadline ? (
            <DeadlineCountdown
              deadline={nextDeadline.deadline}
              label='Nearest project deadline'
              title={nextDeadline.title}
              hero
            />
          ) : (
            <p className='panel px-4 py-8 text-sm text-muted'>No active project deadlines.</p>
          )}
        </div>
        {laterDeadlines.length > 0 && (
          <div>
            <h2 className='mb-2 text-sm font-medium'>Following</h2>
            <div className='panel overflow-hidden'>
              {laterDeadlines.map((project) => (
                <Link
                  key={project.id}
                  to={`/coordinator/projects/${project.id}`}
                  className='flex items-center justify-between gap-3 border-b border-separator px-3 py-2 last:border-0 hover:bg-default'
                >
                  <span className='min-w-0'>
                    <span className='block truncate text-sm font-medium'>{project.title}</span>
                    <span className='block truncate text-xs text-muted'>{project.companyName}</span>
                  </span>
                  <DeadlineCountdown deadline={project.deadline} compact className='shrink-0' />
                </Link>
              ))}
            </div>
          </div>
        )}
      </section>

      <div className='grid gap-2 lg:grid-cols-2'>
        <RecordList title='Pending approvals' to='/coordinator/students'>
          {!pending?.content.length ? (
            <p className='px-3 py-5 text-sm text-muted'>No pending approvals.</p>
          ) : pending.content.slice(0, 5).map((account) => (
            <Link key={account.id} to={`/coordinator/students/${account.id}`} className='flex items-center gap-3 border-b border-separator px-3 py-2 last:border-0 hover:bg-default'>
              <span className='flex size-7 shrink-0 items-center justify-center rounded-md bg-default text-xs font-semibold'>
                {account.firstName[0]}{account.lastName[0]}
              </span>
              <span className='min-w-0 flex-1'>
                <span className='block truncate text-sm font-medium'>{account.firstName} {account.lastName}</span>
                <span className='block truncate text-xs text-muted'>{account.role} · {account.email}</span>
              </span>
              <StatusBadge status='PENDING' />
            </Link>
          ))}
        </RecordList>

        <RecordList title='Recent projects' to='/coordinator/projects'>
          {!projects?.length ? (
            <p className='px-3 py-5 text-sm text-muted'>No projects available.</p>
          ) : projects.slice(0, 5).map((project) => (
            <Link key={project.id} to={`/coordinator/projects/${project.id}`} className='flex items-center gap-3 border-b border-separator px-3 py-2 last:border-0 hover:bg-default'>
              <span className='min-w-0 flex-1'>
                <span className='block truncate text-sm font-medium'>{project.title}</span>
                <span className='block truncate text-xs text-muted'>{project.companyName}</span>
              </span>
              <StatusBadge status={project.status} />
            </Link>
          ))}
        </RecordList>
      </div>
    </div>
  );
}

function MeterList({ title, rows }: { title: string; rows: { name: string; value: number }[] }) {
  const max = Math.max(0, ...rows.map((row) => row.value));
  return (
    <section className='panel p-3'>
      <h2 className='mb-2 text-xs text-muted'>{title}</h2>
      {rows.length === 0 ? (
        <p className='py-4 text-sm text-muted'>No data available.</p>
      ) : (
        <ul className='space-y-2'>
          {rows.map((row) => (
            <li key={row.name}>
              <div className='mb-0.5 flex items-baseline justify-between gap-3'>
                <span className='truncate text-xs text-muted'>{row.name}</span>
                <span className='font-mono text-xs tabular-nums'>{row.value}</span>
              </div>
              <div className='h-1 overflow-hidden rounded-sm bg-default' role='meter' aria-label={row.name} aria-valuenow={row.value} aria-valuemin={0} aria-valuemax={max}>
                <div className='h-full bg-foreground' style={{ width: `${max ? (row.value / max) * 100 : 0}%` }} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function RecordList({ title, to, children }: { title: string; to: string; children: React.ReactNode }) {
  return (
    <section className='panel overflow-hidden'>
      <div className='flex items-center justify-between border-b border-border px-3 py-2'>
        <h2 className='text-sm font-medium'>{title}</h2>
        <Link to={to} className='flex items-center gap-1 text-xs font-medium text-muted hover:text-foreground'>
          View all <ArrowRight size={13} />
        </Link>
      </div>
      <div>{children}</div>
    </section>
  );
}
