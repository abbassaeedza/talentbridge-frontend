import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { ArrowRight, Award, FolderKanban, UserCheck, Users } from 'lucide-react';
import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { coordinatorApi, partyApi, projectApi, userApi } from '../../api/services';
import DeadlineCountdown from '../../components/shared/DeadlineCountdown';
import { PageHeader, StatCard, StatusBadge } from '../../components/ui/TalentBridgeUI';

const CHART_COLORS = [
  'var(--accent)',
  'var(--success)',
  'var(--warning)',
  'var(--danger)',
  'var(--muted)',
];

function chartRows(values?: Record<string, number>) {
  return Object.entries(values ?? {})
    .filter(([, value]) => value > 0)
    .map(([name, value]) => ({ name: name.replace(/_/g, ' '), value }));
}

const tooltipStyle = {
  background: 'var(--overlay)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--field-radius)',
  color: 'var(--overlay-foreground)',
  fontSize: 12,
};

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
  const assignmentPercent = totalParties ? Math.round((assignedParties / totalParties) * 100) : 0;
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

      <div className='mb-8 grid grid-cols-2 gap-3 lg:grid-cols-4'>
        {stats.map((stat) => (
          <Link key={stat.label} to={stat.to} className='rounded-lg focus-visible:outline-offset-4'>
            <StatCard {...stat} />
          </Link>
        ))}
      </div>

      <div className='mb-8 grid gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(18rem,0.8fr)]'>
        <section>
          <div className='mb-3 flex items-center justify-between'>
            <h2 className='text-base font-semibold'>Upcoming deadlines</h2>
            <Link to='/coordinator/projects' className='flex items-center gap-1 text-sm font-medium text-muted hover:text-foreground'>
              View projects <ArrowRight size={14} />
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
            <div className='rounded-lg border border-border bg-surface px-5 py-10 text-center text-sm text-muted'>
              No active project deadlines.
            </div>
          )}
        </section>

        <section>
          <h2 className='mb-3 text-base font-semibold'>Following deadlines</h2>
          <div className='overflow-hidden rounded-lg border border-border bg-surface'>
            {laterDeadlines.length === 0 ? (
              <p className='px-4 py-10 text-center text-sm text-muted'>No additional deadlines.</p>
            ) : laterDeadlines.map((project) => (
              <Link
                key={project.id}
                to={`/coordinator/projects/${project.id}`}
                className='flex items-center justify-between gap-3 border-b border-separator px-4 py-3 last:border-0 hover:bg-default'
              >
                <span className='min-w-0'>
                  <span className='block truncate text-sm font-medium'>{project.title}</span>
                  <span className='block truncate text-xs text-muted'>{project.companyName}</span>
                </span>
                <DeadlineCountdown deadline={project.deadline} compact className='shrink-0' />
              </Link>
            ))}
          </div>
        </section>
      </div>

      <section className='mb-8 rounded-lg border border-border bg-surface p-5'>
        <div className='flex items-end justify-between gap-4'>
          <div>
            <h2 className='text-base font-semibold'>Party assignment</h2>
            <p className='mt-1 text-sm text-muted'>{assignedParties} of {totalParties} parties have a project.</p>
          </div>
          <p className='text-2xl font-semibold'>{assignmentPercent}%</p>
        </div>
        <div className='mt-4 h-2 overflow-hidden rounded-full bg-default' role='progressbar' aria-valuenow={assignmentPercent} aria-valuemin={0} aria-valuemax={100}>
          <div className='h-full rounded-full bg-accent' style={{ width: `${assignmentPercent}%` }} />
        </div>
      </section>

      <div className='mb-8 grid gap-4 lg:grid-cols-3'>
        <ChartPanel title='Projects by status' empty={!projectRows.length}>
          <ResponsiveContainer width='100%' height='100%'>
            <PieChart>
              <Pie data={projectRows} dataKey='value' nameKey='name' outerRadius={78} innerRadius={48} paddingAngle={2}>
                {projectRows.map((row, index) => <Cell key={row.name} fill={CHART_COLORS[index % CHART_COLORS.length]} />)}
              </Pie>
              <Tooltip contentStyle={tooltipStyle} />
            </PieChart>
          </ResponsiveContainer>
        </ChartPanel>
        <ChartPanel title='Users by role' empty={!userRows.length}>
          <ResponsiveContainer width='100%' height='100%'>
            <BarChart data={userRows} margin={{ left: -25, right: 4 }}>
              <XAxis dataKey='name' tick={{ fill: 'var(--muted)', fontSize: 10 }} interval={0} angle={-15} textAnchor='end' height={48} />
              <YAxis tick={{ fill: 'var(--muted)', fontSize: 10 }} allowDecimals={false} />
              <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'var(--default)' }} />
              <Bar dataKey='value' fill='var(--accent)' radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartPanel>
        <ChartPanel title='Submissions by status' empty={!submissionRows.length}>
          <ResponsiveContainer width='100%' height='100%'>
            <BarChart data={submissionRows} margin={{ left: -25, right: 4 }}>
              <XAxis dataKey='name' tick={{ fill: 'var(--muted)', fontSize: 10 }} interval={0} angle={-15} textAnchor='end' height={48} />
              <YAxis tick={{ fill: 'var(--muted)', fontSize: 10 }} allowDecimals={false} />
              <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'var(--default)' }} />
              <Bar dataKey='value' fill='var(--success)' radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartPanel>
      </div>

      <div className='grid gap-6 lg:grid-cols-2'>
        <RecordList title='Pending approvals' to='/coordinator/students'>
          {!pending?.content.length ? (
            <p className='px-4 py-8 text-sm text-muted'>No pending approvals.</p>
          ) : pending.content.slice(0, 5).map((account) => (
            <Link key={account.id} to={`/coordinator/students/${account.id}`} className='flex items-center gap-3 border-b border-separator px-4 py-3 last:border-0 hover:bg-default'>
              <span className='flex size-8 shrink-0 items-center justify-center rounded-md bg-default text-xs font-semibold'>
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
            <p className='px-4 py-8 text-sm text-muted'>No projects available.</p>
          ) : projects.slice(0, 5).map((project) => (
            <Link key={project.id} to={`/coordinator/projects/${project.id}`} className='flex items-center gap-3 border-b border-separator px-4 py-3 last:border-0 hover:bg-default'>
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

function ChartPanel({ title, empty, children }: { title: string; empty: boolean; children: React.ReactNode }) {
  return (
    <section className='rounded-lg border border-border bg-surface p-4'>
      <h2 className='text-sm font-semibold'>{title}</h2>
      <div className='mt-3 h-56'>
        {empty ? <p className='py-20 text-center text-sm text-muted'>No data available.</p> : children}
      </div>
    </section>
  );
}

function RecordList({ title, to, children }: { title: string; to: string; children: React.ReactNode }) {
  return (
    <section className='overflow-hidden rounded-lg border border-border bg-surface'>
      <div className='flex items-center justify-between border-b border-border px-4 py-3'>
        <h2 className='text-sm font-semibold'>{title}</h2>
        <Link to={to} className='flex items-center gap-1 text-xs font-medium text-muted hover:text-foreground'>
          View all <ArrowRight size={13} />
        </Link>
      </div>
      {children}
    </section>
  );
}
