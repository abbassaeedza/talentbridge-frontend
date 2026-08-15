import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { ArrowLeft, Building2, SendHorizonal, Users } from 'lucide-react';
import toast from 'react-hot-toast';
import clsx from 'clsx';
import { Button, buttonVariants } from '@heroui/react/button';
import { Spinner } from '@heroui/react/spinner';
import { TextArea } from '@heroui/react/textarea';
import { partyApi, projectApi } from '../../api/services';
import DeadlineCountdown from '../../components/shared/DeadlineCountdown';
import { StatusBadge } from '../../components/ui/TalentBridgeUI';
import { useAuth } from '../../contexts/AuthContext';

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isRole, user } = useAuth();
  const [rankPosition, setRankPosition] = useState(1);
  const [proposalText, setProposalText] = useState('');
  const [applyOpen, setApplyOpen] = useState(false);

  const { data: project, isLoading } = useQuery({
    queryKey: ['project', id],
    queryFn: () => projectApi.getById(id!).then((response) => response.data),
    enabled: !!id,
  });
  const { data: party } = useQuery({
    queryKey: ['my-party'],
    queryFn: () => partyApi.getMyParty().then((response) => response.data),
    retry: false,
    enabled: isRole('STUDENT'),
  });
  const { data: rules } = useQuery({
    queryKey: ['party-rules'],
    queryFn: () => partyApi.getRules().then((response) => response.data),
    enabled: isRole('STUDENT'),
  });
  const applyMutation = useMutation({
    mutationFn: () => partyApi.applyToProject(party!.id, { projectId: id, rankPosition, proposalText }),
    onSuccess: () => {
      toast.success('Application submitted');
      setApplyOpen(false);
    },
    onError: (error: any) => toast.error(error?.response?.data?.message || 'Application failed'),
  });

  if (isLoading) return <div className='flex min-h-64 items-center justify-center'><Spinner /></div>;
  if (!project) return <div className='rounded-lg border border-border bg-surface px-5 py-16 text-center text-sm text-muted'>Project not found.</div>;

  const content = [
    ['Description', project.description],
    ['Project scope', project.scope],
    ['Expected deliverables', project.deliverables],
    ['Evaluation criteria', project.evaluationCriteria],
  ].filter((section) => section[1]);

  return (
    <div className='max-w-6xl'>
      <Button variant='ghost' size='sm' className='mb-5' onPress={() => navigate(-1)}>
        <ArrowLeft size={16} /> Back
      </Button>

      <header className='border-b border-separator pb-6'>
        <div className='flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between'>
          <div className='min-w-0'>
            <div className='mb-3 flex flex-wrap items-center gap-2'>
              <StatusBadge status={project.status} />
              {project.companyIndustry && <span className='rounded-sm bg-default px-2 py-1 text-xs text-muted'>{project.companyIndustry}</span>}
            </div>
            <h1 className='text-2xl font-semibold tracking-tight sm:text-3xl'>{project.title}</h1>
            <div className='mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted'>
              <span className='flex items-center gap-1.5'><Building2 size={15} /> {project.companyName}</span>
              <span className='flex items-center gap-1.5'><Users size={15} /> {project.partyApplicationCount} party application{project.partyApplicationCount === 1 ? '' : 's'}</span>
            </div>
          </div>
          {(project.tools ?? []).length > 0 && (
            <div className='flex max-w-md flex-wrap gap-1.5 sm:justify-end'>
              {(project.tools ?? []).map((tool) => <span key={tool} className='rounded-sm bg-default px-2 py-1 font-mono text-[11px]'>{tool}</span>)}
            </div>
          )}
        </div>
      </header>

      <div className='grid gap-8 py-7 lg:grid-cols-[minmax(0,1fr)_20rem]'>
        <div>
          {content.map(([label, text], index) => (
            <section key={label} className={clsx('py-6 first:pt-0', index < content.length - 1 && 'border-b border-separator')}>
              <h2 className='text-base font-semibold'>{label}</h2>
              <p className='mt-3 whitespace-pre-wrap text-sm leading-7 text-muted'>{text}</p>
            </section>
          ))}
        </div>

        <aside className='space-y-4'>
          <DeadlineCountdown deadline={project.deadline} submitted={project.finished} label='Project deadline' />

          {isRole('STUDENT') && project.status === 'OPEN' && (
            <section className='rounded-lg border border-border bg-surface p-4'>
              <h2 className='text-sm font-semibold'>Apply for this project</h2>
              {!party ? (
                <p className='mt-2 text-sm text-muted'>Join a party before applying.</p>
              ) : (party.members?.length ?? 0) < (rules?.minSize ?? 2) ? (
                <p className='mt-2 text-sm text-warning'>Your party needs at least {rules?.minSize ?? 2} members.</p>
              ) : party.assignedProjectId ? (
                <p className='mt-2 text-sm text-success'>Your party already has a project.</p>
              ) : !applyOpen ? (
                <Button fullWidth className='mt-4' variant='primary' onPress={() => setApplyOpen(true)}>
                  <SendHorizonal size={16} /> Apply
                </Button>
              ) : (
                <div className='mt-4 space-y-4'>
                  <div>
                    <p className='text-xs font-medium'>Priority rank</p>
                    <div className='mt-2 grid grid-cols-5 gap-1'>
                      {[1, 2, 3, 4, 5].map((rank) => (
                        <button
                          key={rank}
                          type='button'
                          aria-pressed={rankPosition === rank}
                          onClick={() => setRankPosition(rank)}
                          className={clsx(
                            'min-h-10 rounded-sm border text-sm font-semibold',
                            rankPosition === rank ? 'border-accent bg-accent text-accent-foreground' : 'border-border bg-default',
                          )}
                        >
                          {rank}
                        </button>
                      ))}
                    </div>
                    <p className='mt-1 text-[11px] text-muted'>1 is the party's first choice.</p>
                  </div>
                  <div>
                    <label htmlFor='proposal' className='text-xs font-medium'>Proposal</label>
                    <TextArea
                      id='proposal'
                      fullWidth
                      rows={4}
                      maxLength={2000}
                      value={proposalText}
                      onChange={(event) => setProposalText(event.target.value)}
                      placeholder='Explain why this party is suitable.'
                      className='mt-2'
                    />
                    <p className='mt-1 text-right text-[11px] text-muted'>{proposalText.length}/2000</p>
                  </div>
                  <div className='flex gap-2'>
                    <Button fullWidth variant='ghost' onPress={() => setApplyOpen(false)}>Cancel</Button>
                    <Button fullWidth variant='primary' isDisabled={applyMutation.isPending} onPress={() => applyMutation.mutate()}>
                      {applyMutation.isPending ? <Spinner size='sm' /> : 'Submit'}
                    </Button>
                  </div>
                </div>
              )}
            </section>
          )}

          {project.projectSupervisorName && (
            <section className='rounded-lg border border-border bg-surface p-4'>
              <p className='text-xs text-muted'>Project supervisor</p>
              {user?.role === 'COORDINATOR' && project.projectSupervisorId ? (
                <Link to={`/coordinator/supervisors?section=PROJECT_SUPERVISOR&supervisor=${project.projectSupervisorId}`} className='mt-1 block text-sm font-medium hover:underline'>
                  {project.projectSupervisorName}
                </Link>
              ) : <p className='mt-1 text-sm font-medium'>{project.projectSupervisorName}</p>}
            </section>
          )}

          {project.assignedPartyName && (
            <section className='rounded-lg border border-border bg-surface p-4'>
              <p className='text-xs text-muted'>Assigned party</p>
              {user?.role === 'COORDINATOR' && project.assignedPartyId ? (
                <Link to={`/coordinator/parties?party=${project.assignedPartyId}`} className='mt-1 flex items-center gap-1.5 text-sm font-medium hover:underline'>
                  <Users size={14} /> {project.assignedPartyName}
                </Link>
              ) : <p className='mt-1 text-sm font-medium'>{project.assignedPartyName}</p>}
            </section>
          )}

          {user?.role === 'COMPANY' && (
            <Link to={`/company/projects/${project.id}/edit`} className={buttonVariants({ variant: 'secondary', fullWidth: true })}>Edit project</Link>
          )}
        </aside>
      </div>
    </div>
  );
}
