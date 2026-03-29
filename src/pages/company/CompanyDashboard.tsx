import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { projectApi } from '../../api/services';
import { useAuth } from '../../contexts/AuthContext';
import {
  Plus,
  FolderKanban,
  Activity,
  CheckCircle2,
  Clock3,
} from 'lucide-react';
import clsx from 'clsx';

export default function CompanyDashboard() {
  const { user } = useAuth();

  const { data: projects, isLoading } = useQuery({
    queryKey: ['my-projects'],
    queryFn: () => projectApi.getMyProjects().then((r) => r.data),
  });

  const counts = (projects ?? []).reduce(
    (acc, p) => {
      acc[p.status as string] = (acc[p.status as string] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  const stats = [
    {
      label: 'Total Projects',
      value: projects?.length ?? 0,
      icon: FolderKanban,
      color: 'bg-ember-500/15 text-ember-400',
    },
    {
      label: 'Live (Assigned)',
      value: counts['ASSIGNED'] ?? 0,
      icon: CheckCircle2,
      color: 'bg-jade-500/15 text-jade-400',
    },
    {
      label: 'Pending Assignment',
      value: counts['OPEN'] ?? 0,
      icon: Activity,
      color: 'bg-blue-500/15 text-blue-400',
    },
    {
      label: 'Pending Review',
      value: counts['PENDING_REVIEW'] ?? 0,
      icon: Clock3,
      color: 'bg-amber-500/15 text-amber-400',
    },
  ];

  return (
    <div className='animate-fade-up'>
      <div className='flex items-start justify-between mb-8'>
        <div>
          <h1 className='page-title'>Welcome, {user?.firstName}</h1>
          <p className='page-subtitle'>
            Here's an overview of your projects on TalentBridge.
          </p>
        </div>
        <Link to='/company/projects/new' className='btn-primary'>
          <Plus size={16} /> Post New Project
        </Link>
      </div>

      {/* Stats */}
      <div className='grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8'>
        {stats.map((s) => (
          <Link
            key={s.label}
            to='/company/projects'
            className='stat-card hover:border-ink-600/60 transition-colors'
          >
            <div className={clsx('stat-icon', s.color)}>
              <s.icon size={20} />
            </div>
            <div>
              {isLoading ? (
                <div className='w-8 h-7 bg-ink-700 rounded animate-pulse mb-1' />
              ) : (
                <p className='text-2xl font-display font-bold text-white'>
                  {s.value}
                </p>
              )}
              <p className='text-xs text-ink-400 mt-0.5'>{s.label}</p>
            </div>
          </Link>
        ))}
      </div>

      {/* Quick links */}
      <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
        <Link
          to='/company/projects'
          className='card p-5 hover:border-ink-600/60 transition-colors group'
        >
          <div className='flex items-center gap-4'>
            <div className='w-10 h-10 rounded-xl bg-ink-800 flex items-center justify-center flex-shrink-0'>
              <FolderKanban
                size={18}
                className='text-ink-400 group-hover:text-ember-400 transition-colors'
              />
            </div>
            <div>
              <p className='font-semibold text-white text-sm'>My Projects</p>
              <p className='text-xs text-ink-400 mt-0.5'>
                View, edit, and manage all your projects
              </p>
            </div>
          </div>
        </Link>

        <Link
          to='/company/projects/new'
          className='card p-5 hover:border-ink-600/60 transition-colors group'
        >
          <div className='flex items-center gap-4'>
            <div className='w-10 h-10 rounded-xl bg-ink-800 flex items-center justify-center flex-shrink-0'>
              <Plus
                size={18}
                className='text-ink-400 group-hover:text-ember-400 transition-colors'
              />
            </div>
            <div>
              <p className='font-semibold text-white text-sm'>Post a Project</p>
              <p className='text-xs text-ink-400 mt-0.5'>
                Submit a new project for student teams
              </p>
            </div>
          </div>
        </Link>
      </div>
    </div>
  );
}
