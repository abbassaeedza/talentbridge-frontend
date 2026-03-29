import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { projectApi, partyApi, userApi } from '../../api/services';
import { useAuth } from '../../contexts/AuthContext';
import {
  FolderKanban,
  Users,
  Star,
  Github,
  ArrowRight,
  Clock,
  Briefcase,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import clsx from 'clsx';

function StatCard({
  icon: Icon,
  label,
  value,
  color,
  to,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  color: string;
  to?: string;
}) {
  const inner = (
    <div className='stat-card hover:border-ink-600/60 transition-colors'>
      <div className={clsx('stat-icon', color)}>
        <Icon size={20} />
      </div>
      <div>
        <p className='text-2xl font-display font-bold text-white'>{value}</p>
        <p className='text-xs text-ink-400 mt-0.5'>{label}</p>
      </div>
    </div>
  );
  return to ? <Link to={to}>{inner}</Link> : inner;
}

export default function StudentDashboard() {
  const { user } = useAuth();

  const { data: projects } = useQuery({
    queryKey: ['open-projects'],
    queryFn: () =>
      projectApi
        .getOpen({ page: 0, size: 6 })
        .then((r) => r.data)
        .catch(() => null),
    retry: false,
  });

  const { data: party } = useQuery({
    queryKey: ['my-party'],
    queryFn: () => partyApi.getMyParty().then((r) => r.data),
    retry: false,
  });

  const { data: scorecard } = useQuery({
    queryKey: ['my-scorecard'],
    queryFn: () =>
      userApi
        .getMyScorecard()
        .then((r) => r.data)
        .catch(() => null),
    retry: false,
  });

  const hasGithub = !!user?.githubUsername;
  const members = party?.members ?? [];
  const entries = scorecard?.entries ?? [];
  const projectList = projects?.content ?? [];

  return (
    <div className='animate-fade-up'>
      {/* Header */}
      <div className='page-header'>
        <h1 className='page-title'>Good morning, {user?.firstName} 👋</h1>
        <p className='page-subtitle'>
          Here's what's happening on your TalentBridge account.
        </p>
      </div>

      {/* GitHub link prompt */}
      {!hasGithub && (
        <div className='mb-6 p-4 rounded-2xl bg-ink-900 border border-amber-500/30 flex items-center gap-4'>
          <div className='w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center flex-shrink-0'>
            <Github size={20} className='text-amber-400' />
          </div>
          <div className='flex-1'>
            <p className='text-sm font-semibold text-white'>
              Connect your GitHub account
            </p>
            <p className='text-xs text-ink-400 mt-0.5'>
              Required for project submission and AI evaluation scoring.
            </p>
          </div>
          <a
            href={`https://github.com/login/oauth/authorize?client_id=${import.meta.env.VITE_GITHUB_CLIENT_ID}&scope=repo,read:user`}
            className='btn-secondary text-xs px-3 py-2 flex-shrink-0'
          >
            Connect GitHub
          </a>
        </div>
      )}

      {/* Stats */}
      <div className='grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8'>
        <StatCard
          icon={Users}
          label='Party status'
          value={party ? party.status : 'No party'}
          color='bg-violet-500/15 text-violet-400'
          to='/student/party'
        />
        <StatCard
          icon={FolderKanban}
          label='Open projects'
          value={projects?.totalElements ?? '—'}
          color='bg-jade-500/15 text-jade-400'
          to='/student/projects'
        />
        <StatCard
          icon={Star}
          label='Avg score'
          value={scorecard ? `${scorecard.averageScore}/100` : '—'}
          color='bg-ember-500/15 text-ember-400'
          to='/student/scorecard'
        />
        <StatCard
          icon={Briefcase}
          label='Projects done'
          value={scorecard?.totalProjects ?? 0}
          color='bg-ink-600/40 text-ink-300'
        />
      </div>

      <div className='grid lg:grid-cols-2 gap-6 mb-8'>
        {/* Party card */}
        <div className='card p-5'>
          <div className='flex items-center justify-between mb-4'>
            <h2 className='font-display font-semibold text-white'>My Party</h2>
            <Link
              to='/student/party'
              className='text-xs text-ember-400 hover:text-ember-300 flex items-center gap-1'
            >
              Manage <ArrowRight size={12} />
            </Link>
          </div>

          {party ? (
            <div>
              <div className='flex items-center gap-3 mb-3'>
                <div className='w-10 h-10 rounded-xl bg-ink-700 flex items-center justify-center font-display font-bold text-ink-200'>
                  {party.name?.[0] ?? '?'}
                </div>
                <div>
                  <p className='font-semibold text-white text-sm'>
                    {party.name}
                  </p>
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
                </div>
              </div>

              {members.length > 0 && (
                <div className='flex -space-x-2'>
                  {members.map((m) => (
                    <div
                      key={m.id}
                      title={`${m.firstName} ${m.lastName}`}
                      className='w-8 h-8 rounded-full bg-ink-700 border-2 border-ink-900 flex items-center justify-center text-xs font-bold text-ink-200'
                    >
                      {m.firstName?.[0]}
                      {m.lastName?.[0]}
                    </div>
                  ))}
                </div>
              )}

              {party.assignedProjectTitle && (
                <p className='text-xs text-jade-400 mt-3 flex items-center gap-1.5'>
                  <Briefcase size={11} /> Assigned: {party.assignedProjectTitle}
                </p>
              )}
            </div>
          ) : (
            <div className='text-center py-4'>
              <p className='text-ink-400 text-sm mb-3'>
                You're not in a party yet.
              </p>
              <Link
                to='/student/party'
                className='btn-primary text-xs px-4 py-2'
              >
                Create or join a party
              </Link>
            </div>
          )}
        </div>

        {/* Scorecard mini */}
        <div className='card p-5'>
          <div className='flex items-center justify-between mb-4'>
            <h2 className='font-display font-semibold text-white'>
              My Scorecard
            </h2>
            <Link
              to='/student/scorecard'
              className='text-xs text-ember-400 hover:text-ember-300 flex items-center gap-1'
            >
              View all <ArrowRight size={12} />
            </Link>
          </div>

          {entries.length > 0 ? (
            <div className='space-y-3'>
              {entries.slice(0, 3).map((e) => (
                <div key={e.id} className='flex items-center gap-3'>
                  <div className='flex-1 min-w-0'>
                    <p className='text-xs font-medium text-ink-100 truncate'>
                      {e.project?.title}
                    </p>
                    <div className='score-bar-track mt-1.5'>
                      <div
                        className='score-bar-fill bg-gradient-to-r from-ember-500 to-ember-400'
                        style={{ width: `${e.score ?? 0}%` }}
                      />
                    </div>
                  </div>
                  <span className='text-sm font-bold text-white flex-shrink-0'>
                    {e.score ?? 0}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className='text-ink-400 text-sm text-center py-4'>
              No evaluations yet.
            </p>
          )}
        </div>
      </div>

      {/* Recent projects */}
      <div>
        <div className='flex items-center justify-between mb-4'>
          <h2 className='font-display font-semibold text-white'>
            Open Projects
          </h2>
          <Link
            to='/student/projects'
            className='text-xs text-ember-400 hover:text-ember-300 flex items-center gap-1'
          >
            Browse all <ArrowRight size={12} />
          </Link>
        </div>

        {projectList.length > 0 ? (
          <div className='grid md:grid-cols-2 lg:grid-cols-3 gap-4'>
            {projectList.map((p) => (
              <Link
                key={p.id}
                to={`/student/projects/${p.id}`}
                className='card p-4 hover:border-ink-600/60 hover:bg-ink-800/30 transition-all duration-200 group'
              >
                <div className='flex items-start justify-between gap-2 mb-3'>
                  <div className='w-8 h-8 rounded-lg bg-ink-700 flex items-center justify-center text-xs font-bold text-ink-200 flex-shrink-0'>
                    {p.companyName?.[0] ?? '?'}
                  </div>
                  <span className='badge badge-open text-[10px]'>OPEN</span>
                </div>
                <h3 className='font-semibold text-white text-sm mb-1 line-clamp-2 group-hover:text-ember-300 transition-colors'>
                  {p.title}
                </h3>
                <p className='text-xs text-ink-400 mb-3 line-clamp-2'>
                  {p.description}
                </p>
                <div className='flex items-center justify-between text-xs text-ink-500'>
                  <span>{p.companyName}</span>
                  {p.deadline && (
                    <span className='flex items-center gap-1'>
                      <Clock size={11} />
                      {formatDistanceToNow(new Date(p.deadline), {
                        addSuffix: true,
                      })}
                    </span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className='card p-12 text-center'>
            <FolderKanban size={32} className='text-ink-600 mx-auto mb-3' />
            <p className='text-ink-400 text-sm'>No open projects right now.</p>
          </div>
        )}
      </div>
    </div>
  );
}
