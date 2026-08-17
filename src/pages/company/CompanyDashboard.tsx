import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Activity, CheckCircle2, Clock3, FolderKanban, Plus } from 'lucide-react';
import { buttonVariants } from '@heroui/react/button';
import { Skeleton } from '@heroui/react/skeleton';
import { projectApi } from '../../api/services';
import { useAuth } from '../../contexts/AuthContext';
import { EmptyState, PageHeader, StatCard, StatusBadge } from '../../components/ui/TalentBridgeUI';
import DeadlineCountdown from '../../components/shared/DeadlineCountdown';

export default function CompanyDashboard() {
  const { user } = useAuth();
  const { data: projects = [], isLoading } = useQuery({ queryKey: ['my-projects'], queryFn: () => projectApi.getMyProjects().then((response) => response.data) });
  const counts = projects.reduce((result, project) => ({ ...result, [project.status]: (result[project.status] ?? 0) + 1 }), {} as Record<string, number>);
  const nearest = projects.filter((project) => project.deadline && !project.finished).sort((a, b) => new Date(a.deadline!).getTime() - new Date(b.deadline!).getTime())[0];
  return (
    <div>
      <PageHeader
        title={`Welcome, ${user?.firstName}`}
        description='Review project activity, assignments, and deadlines.'
        action={<Link to='/company/projects/new' className={buttonVariants({ variant: 'primary' })}><Plus size={16} /> Create project</Link>}
      />
      <div className='grid gap-3 sm:grid-cols-2 xl:grid-cols-4'>
        {isLoading ? Array.from({ length: 4 }, (_, index) => <Skeleton key={index} className='h-14 rounded-lg' />) : <>
          <StatCard label='Total projects' value={projects.length} icon={FolderKanban} />
          <StatCard label='Assigned' value={counts.ASSIGNED ?? 0} icon={CheckCircle2} />
          <StatCard label='Open' value={counts.OPEN ?? 0} icon={Activity} />
          <StatCard label='Pending review' value={counts.PENDING_REVIEW ?? 0} icon={Clock3} />
        </>}
      </div>

      <div className='mt-5 grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(20rem,0.6fr)]'>
        <section>
          <div className='mb-3 flex items-center justify-between'><h2 className='text-base font-semibold'>Recent projects</h2><Link to='/company/projects' className='text-sm text-muted hover:text-foreground'>View all</Link></div>
          {projects.length === 0 ? <EmptyState icon={FolderKanban} title='No projects yet' description='Create a project brief for student parties.' action={<Link to='/company/projects/new' className={buttonVariants({ variant: 'primary' })}>Create project</Link>} /> : (
            <div className='panel divide-y divide-separator'>
              {projects.slice(0, 5).map((project) => (
                <Link key={project.id} to={`/company/projects/${project.id}`} className='flex min-h-16 items-center gap-3 px-4 py-3 hover:bg-default'>
                  <div className='min-w-0 flex-1'><p className='truncate text-sm font-medium'>{project.title}</p><p className='mt-1 text-xs text-muted'>{project.partyApplicationCount} party applications</p></div>
                  <StatusBadge status={project.status} />
                </Link>
              ))}
            </div>
          )}
        </section>
        <section>
          <h2 className='mb-3 text-base font-semibold'>Next deadline</h2>
          {nearest ? <DeadlineCountdown deadline={nearest.deadline} title={nearest.title} label='Project deadline' /> : <p className='panel px-3 py-5 text-sm text-muted'>No active deadlines.</p>}
          <Link to='/company/project-supervisors' className={`${buttonVariants({ variant: 'secondary' })} mt-3 w-full`}>Manage supervisors</Link>
        </section>
      </div>
    </div>
  );
}
