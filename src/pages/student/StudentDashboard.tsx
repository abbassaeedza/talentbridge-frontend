import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { projectApi, partyApi, userApi } from '../../api/services';
import { useAuth } from '../../contexts/AuthContext';
import {
  FolderKanban,
  Users,
  Star,
  Github,
  ExternalLink,
  ArrowRight,
  Briefcase,
} from 'lucide-react';
import clsx from 'clsx';
import DeadlineCountdown from '../../components/shared/DeadlineCountdown';
import toast from 'react-hot-toast';
import { createGitHubOAuthRequest } from '../../utils/githubOAuth';
import { Avatar } from '@heroui/react/avatar';
import { Button, buttonVariants } from '@heroui/react/button';
import { Card } from '@heroui/react/card';
import { ProgressBar } from '@heroui/react/progress-bar';
import { Skeleton } from '@heroui/react/skeleton';
import { PageHeader, StatCard, StatusBadge } from '../../components/ui/TalentBridgeUI';

export default function StudentDashboard() {
  const { user } = useAuth();

  const { data: currentUser = user } = useQuery({
    queryKey: ['current-user', 'student-dashboard'],
    queryFn: () => userApi.getMe().then((response) => response.data),
    initialData: user ?? undefined,
    enabled: !!user,
    staleTime: 0,
    refetchOnMount: 'always',
  });

  const connectGitHub = () => {
    const clientId = import.meta.env.VITE_GITHUB_CLIENT_ID;
    if (!clientId) {
      toast.error('GitHub OAuth is not configured');
      return;
    }
    const request = createGitHubOAuthRequest(
      clientId,
      `${window.location.origin}/github/callback`,
    );
    sessionStorage.setItem('github_oauth_state', request.state);
    window.location.assign(request.url);
  };

  const { data: projects } = useQuery({
    queryKey: ['open-projects'],
    queryFn: () =>
      projectApi
        .getOpen({ page: 0, size: 6 })
        .then((r) => r.data)
        .catch(() => null),
    retry: false,
  });

  const { data: party, isPending: partyPending } = useQuery({
    queryKey: ['my-party'],
    queryFn: () => partyApi.getMyParty().then((r) => r.data),
    retry: false,
  });

  const { data: globalDeadline } = useQuery({
    queryKey: ['global-deadline'],
    queryFn: () =>
      projectApi
        .getGlobalDeadline()
        .then((r) => r.data.enabled ? r.data.deadline : null)
        .catch(() => null),
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

  const hasGithub = !!currentUser?.githubUsername;
  const members = party?.members ?? [];
  const entries = scorecard?.entries ?? [];
  const hasAssignedProject = !!party?.assignedProjectId;
  const projectSubmitted = party?.status === 'SUBMITTED' || party?.status === 'COMPLETED';
  const dashboardDeadline = hasAssignedProject
    ? party?.assignedProjectDeadline
    : globalDeadline;

  return (
    <div className=''>
      <PageHeader title={`Overview${currentUser?.firstName ? ` for ${currentUser.firstName}` : ''}`} description='Your party, project deadline, GitHub connection, and results.' />

      <div className='mb-8'>
        {partyPending ? (
          <Skeleton className='h-52 rounded-lg' />
        ) : (
          <DeadlineCountdown
            deadline={dashboardDeadline}
            label={hasAssignedProject ? 'Assigned project deadline' : 'Global application deadline'}
            title={hasAssignedProject ? party?.assignedProjectTitle : 'Application window'}
            submitted={hasAssignedProject && projectSubmitted}
            hero
          />
        )}
      </div>

      {/* GitHub connection */}
      {hasGithub ? (
        <div className='mb-6 flex flex-wrap items-center gap-4 rounded-lg border border-success bg-surface p-4'>
          <div className='flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-default'>
            <Github size={20} className='text-success' />
          </div>
          <div className='flex-1'>
            <p className='text-sm font-semibold text-foreground'>GitHub connected</p>
            <a
              href={`https://github.com/${encodeURIComponent(currentUser!.githubUsername!)}`}
              target='_blank'
              rel='noreferrer'
              aria-label={`@${currentUser!.githubUsername}`}
              className='mt-0.5 inline-flex items-center gap-1 text-xs text-success hover:text-success'
            >
              @{currentUser!.githubUsername} <ExternalLink size={11} />
            </a>
          </div>
        </div>
      ) : (
        <div className='mb-6 flex items-center gap-4 rounded-lg border border-amber-500/30 bg-surface p-4'>
          <div className='flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-default'>
            <Github size={20} className='text-warning' />
          </div>
          <div className='flex-1'>
            <p className='text-sm font-semibold text-foreground'>Connect your GitHub account</p>
            <p className='mt-0.5 text-xs text-muted'>Required for project submission and AI evaluation scoring.</p>
          </div>
          <Button
            type='button'
            onPress={connectGitHub}
            variant='secondary'
            className='flex-shrink-0'
          >
            Connect GitHub
          </Button>
        </div>
      )}

      {/* Stats */}
      <div className='grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8'>
        <Link to='/student/party'><StatCard icon={Users} label='Party status' value={party ? party.status : 'No party'} /></Link>
        <Link to='/student/projects'><StatCard icon={FolderKanban} label='Open projects' value={projects?.totalElements ?? '-'} /></Link>
        <Link to='/student/scorecard'><StatCard icon={Star} label='Average score' value={scorecard ? `${scorecard.averageScore}/100` : '-'} /></Link>
        <StatCard icon={Briefcase} label='Projects completed' value={scorecard?.totalProjects ?? 0} />
      </div>

      <div className='grid lg:grid-cols-2 gap-6 mb-8'>
        {/* Party card */}
        <Card><Card.Content className='p-5'>
          <div className='flex items-center justify-between mb-4'>
            <h2 className=' font-semibold text-foreground'>My Party</h2>
            <Link
              to='/student/party'
              className='text-xs text-accent hover:text-accent flex items-center gap-1'
            >
              Manage <ArrowRight size={12} />
            </Link>
          </div>

          {party ? (
            <div>
              <div className='flex items-center gap-3 mb-3'>
                <div className='w-10 h-10 rounded-lg bg-default flex items-center justify-center  font-bold text-foreground'>
                  {party.name?.[0] ?? '?'}
                </div>
                <div>
                  <p className='font-semibold text-foreground text-sm'>
                    {party.name}
                  </p>
                  <StatusBadge status={party.status} />
                </div>
              </div>

              {members.length > 0 && (
                <div className='flex -space-x-2'>
                  {members.map((m) => (
                    <Avatar
                      key={m.id}
                      title={`${m.firstName} ${m.lastName}`}
                      size='sm'
                    >
                      <Avatar.Fallback>{m.firstName?.[0]}{m.lastName?.[0]}</Avatar.Fallback>
                    </Avatar>
                  ))}
                </div>
              )}

              {party.assignedProjectTitle && (
                <div className='mt-3 space-y-2'>
                  <p className='text-xs text-success flex items-center gap-1.5'>
                    <Briefcase size={11} /> Assigned: {party.assignedProjectTitle}
                  </p>
                  <DeadlineCountdown
                    deadline={party.assignedProjectDeadline ?? null}
                    submitted={projectSubmitted}
                    compact
                  />
                </div>
              )}
            </div>
          ) : (
            <div className='text-center py-4'>
              <p className='text-muted text-sm mb-3'>
                You're not in a party yet.
              </p>
              <Link to='/student/party' className={buttonVariants({ variant: 'primary', size: 'sm' })}>
                Create or join a party
              </Link>
            </div>
          )}
        </Card.Content></Card>

        {/* Scorecard mini */}
        <Card><Card.Content className='p-5'>
          <div className='flex items-center justify-between mb-4'>
            <h2 className=' font-semibold text-foreground'>
              My Scorecard
            </h2>
            <Link
              to='/student/scorecard'
              className='text-xs text-accent hover:text-accent flex items-center gap-1'
            >
              View all <ArrowRight size={12} />
            </Link>
          </div>

          {entries.length > 0 ? (
            <div className='space-y-3'>
              {entries.slice(0, 3).map((e) => (
                <div key={e.id} className='flex items-center gap-3'>
                  <div className='flex-1 min-w-0'>
                    <p className='text-xs font-medium text-foreground truncate'>
                      {e.project?.title}
                    </p>
                    <ProgressBar aria-label={`${e.project?.title} score`} value={e.score ?? 0} className='mt-2'><ProgressBar.Track><ProgressBar.Fill /></ProgressBar.Track></ProgressBar>
                  </div>
                  <span className='text-sm font-bold text-foreground flex-shrink-0'>
                    {e.score ?? 0}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className='text-muted text-sm text-center py-4'>
              No evaluations yet.
            </p>
          )}
        </Card.Content></Card>
      </div>

    </div>
  );
}
