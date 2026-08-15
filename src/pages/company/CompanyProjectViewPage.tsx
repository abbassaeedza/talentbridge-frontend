import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, ExternalLink, Github, Pencil, Users } from 'lucide-react';
import { format } from 'date-fns';
import { Button, buttonVariants } from '@heroui/react/button';
import { Spinner } from '@heroui/react/spinner';
import { evaluationApi, partyApi, projectApi, submissionApi } from '../../api/services';
import EvaluationReportPanel from '../../components/evaluation/EvaluationReportPanel';
import DeadlineCountdown from '../../components/shared/DeadlineCountdown';
import { EmptyState, StatusBadge } from '../../components/ui/TalentBridgeUI';

const STATUS_LABEL: Record<string, string> = { DRAFT: 'Draft', OPEN: 'Open', PENDING_REVIEW: 'Pending review', ASSIGNED: 'Assigned', ARCHIVED: 'Rejected', CLOSED: 'Closed' };

export default function CompanyProjectViewPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [expandedParty, setExpandedParty] = useState<string | null>(null);
  const { data: project, isLoading } = useQuery({ queryKey: ['project', id], queryFn: () => projectApi.getById(id!).then((response) => response.data), enabled: !!id });
  const { data: applications = [] } = useQuery({ queryKey: ['company-project-applications', id], queryFn: () => partyApi.getApplicationsByProject(id!).then((response) => response.data), enabled: !!id });
  const { data: selectedParty } = useQuery({ queryKey: ['company-application-party', expandedParty], queryFn: () => partyApi.getById(expandedParty!).then((response) => response.data), enabled: !!expandedParty });
  const { data: submissions = [] } = useQuery({ queryKey: ['company-project-submissions', id], queryFn: () => submissionApi.getByProject(id!).then((response) => response.data), enabled: !!id, retry: false });
  const submission = submissions[0];
  const { data: evaluation } = useQuery({ queryKey: ['eval-report', submission?.id], queryFn: () => evaluationApi.getBySubmission(submission!.id).then((response) => response.data), enabled: submission?.status === 'EVALUATED', retry: false });
  if (isLoading) return <div className='flex min-h-64 items-center justify-center'><Spinner /></div>;
  if (!project) return <EmptyState icon={Users} title='Project not found' action={<Link to='/company/projects' className={buttonVariants({ variant: 'secondary' })}>Back to projects</Link>} />;
  const details = [['Description', project.description], ['Project scope', project.scope], ['Expected deliverables', project.deliverables], ['Evaluation criteria', project.evaluationCriteria]].filter((item) => item[1]);
  const canEdit = ['DRAFT', 'PENDING_REVIEW', 'ARCHIVED'].includes(project.status);

  return (
    <div className='max-w-6xl'>
      <div className='mb-5 flex items-center justify-between gap-3'>
        <Button variant='ghost' size='sm' onPress={() => navigate('/company/projects')}><ArrowLeft size={15} /> Back to projects</Button>
        {canEdit && <Link to={`/company/projects/${id}/edit`} className={buttonVariants({ variant: 'secondary', size: 'sm' })}><Pencil size={14} /> {project.status === 'ARCHIVED' ? 'Edit and resubmit' : 'Edit project'}</Link>}
      </div>
      <header className='border-b border-separator pb-6'>
        <div className='flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between'>
          <div className='min-w-0'><div className='mb-3 flex flex-wrap gap-2'><StatusBadge status={project.status} label={STATUS_LABEL[project.status]} />{project.internalName && <span className='rounded-sm bg-default px-2 py-1 text-xs text-muted'>{project.internalName}</span>}</div><h1 className='text-2xl font-semibold tracking-tight sm:text-3xl'>{project.title}</h1><p className='mt-2 text-sm text-muted'>{project.companyName}</p></div>
          <div className='flex flex-wrap gap-1.5 sm:max-w-sm sm:justify-end'>{(project.tools ?? []).map((tool) => <span key={tool} className='rounded-sm bg-default px-2 py-1 font-mono text-xs'>{tool}</span>)}</div>
        </div>
        {project.status === 'ARCHIVED' && <p className='mt-4 rounded-md bg-danger px-3 py-2 text-sm text-danger-foreground'>This project was rejected. Edit and resubmit it for another review.</p>}
      </header>

      <div className='grid gap-8 py-7 xl:grid-cols-[minmax(0,1fr)_20rem]'>
        <div>{details.map(([title, content], index) => <section key={title} className={`py-6 first:pt-0 ${index < details.length - 1 ? 'border-b border-separator' : ''}`}><h2 className='text-base font-semibold'>{title}</h2><p className='mt-3 whitespace-pre-wrap text-sm leading-7 text-muted'>{content}</p></section>)}</div>
        <aside className='space-y-4'>
          <DeadlineCountdown deadline={project.deadline} submitted={project.finished} label='Project deadline' />
          <section className='rounded-lg border border-border bg-surface p-4'><p className='text-xs text-muted'>Applications</p><p className='mt-1 text-2xl font-semibold'>{project.partyApplicationCount}</p><p className='mt-2 text-xs text-muted'>Posted {format(new Date(project.createdAt), 'dd MMM yyyy')}</p></section>
          {project.projectSupervisorName && <section className='rounded-lg border border-border bg-surface p-4'><p className='text-xs text-muted'>Project supervisor</p><p className='mt-1 text-sm font-medium'>{project.projectSupervisorName}</p></section>}
          {project.assignedPartyName && <section className='rounded-lg border border-border bg-surface p-4'><p className='text-xs text-muted'>Assigned party</p><p className='mt-1 text-sm font-medium'>{project.assignedPartyName}</p></section>}
        </aside>
      </div>

      <section className='border-t border-separator py-7'>
        <h2 className='text-lg font-semibold'>Party applications</h2><p className='mt-1 text-sm text-muted'>Review ranked applications and student profiles.</p>
        {applications.length === 0 ? <div className='mt-5'><EmptyState icon={Users} title='No party applications yet' /></div> : <div className='mt-5 divide-y divide-separator rounded-lg border border-border bg-surface'>{applications.map((application) => <article key={application.id} className='p-4'>
          <div className='flex flex-col gap-3 sm:flex-row sm:items-center'><span className='flex size-8 items-center justify-center rounded-md bg-default font-mono text-sm'>#{application.rankPosition}</span><div className='min-w-0 flex-1'><p className='font-medium'>{application.partyName}</p><p className='mt-1 text-xs text-muted'>{application.status.replace(/_/g, ' ')}</p>{application.proposalText && <p className='mt-2 text-sm leading-6 text-muted'>{application.proposalText}</p>}</div><Button size='sm' variant='secondary' onPress={() => setExpandedParty(expandedParty === application.partyId ? null : application.partyId)}>{expandedParty === application.partyId ? 'Hide party' : 'View party'}</Button></div>
          {expandedParty === application.partyId && selectedParty?.id === application.partyId && <div className='mt-4 grid gap-2 border-t border-separator pt-4 sm:grid-cols-2'>{selectedParty.members.map((member) => <Link key={member.id} to={`/company/students/${member.id}`} className='rounded-md border border-border p-3 hover:bg-default'><p className='text-sm font-medium'>{member.firstName} {member.lastName}</p><p className='mt-1 text-xs text-muted'>{member.email}</p><div className='mt-2 flex flex-wrap gap-1'>{member.skills.slice(0, 3).map((skill) => <span key={skill} className='rounded-sm bg-default px-1.5 py-0.5 text-[10px]'>{skill}</span>)}</div></Link>)}</div>}
        </article>)}</div>}
      </section>

      {submission && <section className='border-t border-separator py-7'><h2 className='text-lg font-semibold'>Submission</h2><div className='mt-4 grid gap-3 text-sm sm:grid-cols-2'><div className='rounded-lg border border-border bg-surface p-4'><p className='text-xs text-muted'>Status</p><div className='mt-2'><StatusBadge status={submission.status} /></div>{submission.submittedAt && <p className='mt-3 text-xs text-muted'>Submitted {format(new Date(submission.submittedAt), 'dd MMM yyyy, HH:mm')}</p>}</div><div className='rounded-lg border border-border bg-surface p-4'><p className='text-xs text-muted'>Repository and documents</p>{submission.repoUrl && <a href={submission.repoUrl} target='_blank' rel='noreferrer' className='mt-2 flex items-center gap-1.5 text-accent hover:underline'><Github size={14} /> Repository <ExternalLink size={12} /></a>}{submission.documentUrls?.map((url, index) => <a key={url} href={url} target='_blank' rel='noreferrer' className='mt-2 flex items-center gap-1.5 text-accent hover:underline'>Document {index + 1} <ExternalLink size={12} /></a>)}</div></div>{submission.notes && <p className='mt-4 text-sm leading-6 text-muted'>{submission.notes}</p>}</section>}
      {evaluation && <div className='border-t border-separator py-7'><EvaluationReportPanel report={evaluation} /></div>}
    </div>
  );
}
