import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Briefcase, ExternalLink, FileText, Send, Users } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { evaluationApi, partyApi, projectApi, submissionApi, userApi } from '../../api/services';
import DeadlineCountdown from '../../components/shared/DeadlineCountdown';
import EvaluationReportPanel from '../../components/evaluation/EvaluationReportPanel';
import { useAuth } from '../../contexts/AuthContext';
import type { Application, Party, Project, Scorecard, Submission } from '../../types';
import toast from 'react-hot-toast';
import { Button, buttonVariants } from '@heroui/react/button';
import { Label } from '@heroui/react/label';
import { ListBox } from '@heroui/react/list-box';
import { Select } from '@heroui/react/select';
import { SearchField } from '@heroui/react/search-field';
import { Skeleton } from '@heroui/react/skeleton';
import { EmptyState as SharedEmptyState, ListToolbar, PageHeader, StatCard, StatusBadge } from '../../components/ui/TalentBridgeUI';
import QuerySection from '../../components/ui/QuerySection';
import { parseServerDateTime } from '../../utils/dateTime';

type ItemKind = 'project' | 'party';
type SortValue = 'deadline' | 'name' | 'status';

const submitted = (status: string) => status === 'SUBMITTED' || status === 'COMPLETED';
const dateValue = (value?: string) => parseServerDateTime(value)?.getTime() ?? Number.POSITIVE_INFINITY;
const matchesSubmission = (filter: string, hasSubmission: boolean, status?: string) => {
  if (filter === 'ALL') return true;
  if (filter === 'HAS_SUBMISSION') return hasSubmission;
  if (filter === 'NO_SUBMISSION') return !hasSubmission;
  return status === filter;
};

function EmptyState({ icon: Icon, children }: { icon: LucideIcon; children: React.ReactNode }) {
  return <SharedEmptyState icon={Icon} title={String(children)} />;
}

function LoadingCards() {
  return <div className='grid gap-4 md:grid-cols-2'><Skeleton className='h-40 rounded-lg' /><Skeleton className='h-40 rounded-lg' /></div>;
}

export function SupervisorOverviewPage({ kind }: { kind: ItemKind }) {
  const { user } = useAuth();
  const projects = useQuery({
    queryKey: ['supervised-projects'],
    queryFn: () => projectApi.getSupervised().then((response) => response.data),
    enabled: kind === 'project',
  });
  const parties = useQuery({
    queryKey: ['supervised-parties'],
    queryFn: () => partyApi.getSupervised().then((response) => response.data),
    enabled: kind === 'party',
  });
  const items = kind === 'project' ? projects.data : parties.data;
  const query = kind === 'project' ? projects : parties;
  const nearest = useMemo(() => [...(items ?? [])].filter((item) => {
    const deadline = kind === 'project' ? (item as Project).deadline : (item as Party).assignedProjectDeadline;
    const due = dateValue(deadline);
    return Number.isFinite(due) && due > Date.now();
  }).sort((a, b) => dateValue(kind === 'project' ? (a as Project).deadline : (a as Party).assignedProjectDeadline)
    - dateValue(kind === 'project' ? (b as Project).deadline : (b as Party).assignedProjectDeadline))[0], [items, kind]);

  const project = kind === 'project' ? nearest as Project | undefined : undefined;
  const party = kind === 'party' ? nearest as Party | undefined : undefined;
  const title = kind === 'project' ? 'Project Supervisor Overview' : 'Party Supervisor Overview';

  return (
    <div className=''>
      <PageHeader title={title} description={`Welcome back, ${user?.firstName}. Review the work that needs attention next.`} />
      <QuerySection query={query} label={`Supervised ${kind === 'project' ? 'projects' : 'parties'}`}>
      {!items?.length ? <EmptyState icon={kind === 'project' ? Briefcase : Users}>{`No supervised ${kind === 'project' ? 'projects' : 'parties'} yet.`}</EmptyState> : (
        <div className='grid gap-3 lg:grid-cols-[1.3fr_.7fr]'>
          <div className='panel p-4'>
            <p className='mb-2 text-xs text-muted'>Nearest deadline</p>
            {nearest ? (
              <>
                <Link to={kind === 'project' ? `/project-supervisor/projects/${project!.id}` : `/party-supervisor/parties/${party!.id}`} className='inline-flex min-h-11 min-w-11 items-center text-sm font-medium text-foreground hover:text-accent'>{kind === 'project' ? project!.title : party!.name}</Link>
                <p className='mt-1 text-xs text-muted'>{kind === 'project' ? project!.assignedPartyName || 'Awaiting party assignment' : party!.assignedProjectTitle}</p>
                <div className='mt-3'><DeadlineCountdown deadline={(kind === 'project' ? project!.deadline : party!.assignedProjectDeadline) ?? null} submitted={kind === 'party' && submitted(party!.status)} compact /></div>
              </>
            ) : <p className='text-sm text-muted'>No upcoming deadlines.</p>}
          </div>
          <StatCard icon={kind === 'project' ? Briefcase : Users} label={`Supervised ${kind === 'project' ? 'projects' : 'parties'}`} value={items.length} />
        </div>
      )}
      </QuerySection>
    </div>
  );
}

async function projectsWithSubmissions() {
  const projects = (await projectApi.getSupervised()).data;
  return Promise.all(projects.map(async (project) => {
    try {
      const submissions = (await submissionApi.getByProject(project.id)).data;
      return { project, hasSubmission: submissions.length > 0, submissionStatus: submissions[0]?.status };
    } catch {
      return { project, hasSubmission: false, submissionStatus: undefined };
    }
  }));
}

export function SupervisedProjectsPage() {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('ALL');
  const [assignment, setAssignment] = useState('ALL');
  const [submission, setSubmission] = useState('ALL');
  const [sort, setSort] = useState<SortValue>('deadline');
  const query = useQuery({ queryKey: ['supervised-project-rows'], queryFn: projectsWithSubmissions });
  const rows = useMemo(() => (query.data ?? []).filter(({ project, hasSubmission, submissionStatus }) =>
    project.title.toLowerCase().includes(search.toLowerCase())
    && (status === 'ALL' || project.status === status)
    && (assignment === 'ALL' || (assignment === 'ASSIGNED') === !!project.assignedPartyId)
    && matchesSubmission(submission, hasSubmission, submissionStatus),
  ).sort((a, b) => sort === 'deadline'
    ? dateValue(a.project.deadline) - dateValue(b.project.deadline)
    : sort === 'name'
      ? a.project.title.localeCompare(b.project.title)
      : a.project.status.localeCompare(b.project.status)), [query.data, search, status, assignment, submission, sort]);

  return (
    <div className=''>
      <PageHeader title='My projects' description='Search, filter, and review the projects assigned to you.' />
      <Filters search={search} setSearch={setSearch} status={status} setStatus={setStatus} assignment={assignment} setAssignment={setAssignment} submission={submission} setSubmission={setSubmission} sort={sort} setSort={setSort} searchPlaceholder='Search projects' />
      {query.isLoading ? <LoadingCards /> : rows.length === 0 ? <EmptyState icon={Briefcase}>No projects match these filters.</EmptyState> : (
        <div className='grid gap-4 md:grid-cols-2'>
          {rows.map(({ project, submissionStatus }) => <ProjectCard key={project.id} project={project} submissionStatus={submissionStatus} />)}
        </div>
      )}
    </div>
  );
}

function ProjectCard({ project, submissionStatus }: { project: Project; submissionStatus?: string }) {
  return (
    <Link to={`/project-supervisor/projects/${project.id}`} className='rounded-lg border border-border bg-surface block p-5 hover:border-accent'>
      <div className='flex items-start justify-between gap-3'><h2 className='font-semibold'>{project.title}</h2><StatusBadge status={project.status} /></div>
      <p className='mt-2 line-clamp-2 text-xs leading-relaxed text-muted'>{project.description}</p>
      <div className='mt-4 flex flex-wrap gap-2 text-xs text-muted'><span>{project.assignedPartyName || 'Unassigned'}</span>{submissionStatus && <StatusBadge status={submissionStatus} />}</div>
      <div className='mt-4'><DeadlineCountdown deadline={project.deadline ?? null} submitted={submissionStatus === 'SUBMITTED' || submissionStatus === 'EVALUATED'} compact /></div>
    </Link>
  );
}

function Filters(props: {
  search: string; setSearch: (value: string) => void;
  status: string; setStatus: (value: string) => void;
  assignment: string; setAssignment: (value: string) => void;
  submission: string; setSubmission: (value: string) => void;
  sort: SortValue; setSort: (value: SortValue) => void;
  searchPlaceholder: string;
}) {
  return (
    <div className='rounded-lg border border-border bg-surface mb-5 grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-5'>
      <SearchField fullWidth className='sm:col-span-2 xl:col-span-1' aria-label={props.searchPlaceholder} value={props.search} onChange={props.setSearch}><SearchField.Group><SearchField.SearchIcon /><SearchField.Input placeholder={props.searchPlaceholder} /><SearchField.ClearButton /></SearchField.Group></SearchField>
      <CompactSelect label='Status' value={props.status} onChange={props.setStatus} options={['ALL', 'DRAFT', 'PENDING_REVIEW', 'OPEN', 'ACTIVE', 'ASSIGNED', 'SUBMITTED', 'COMPLETED', 'CLOSED', 'ARCHIVED']} />
      <CompactSelect label='Assignment' value={props.assignment} onChange={props.setAssignment} options={['ALL', 'ASSIGNED', 'UNASSIGNED']} />
      <CompactSelect label='Submission' value={props.submission} onChange={props.setSubmission} options={['ALL', 'HAS_SUBMISSION', 'NO_SUBMISSION', 'DRAFT', 'SUBMITTED', 'EVALUATED']} />
      <CompactSelect label='Sort' value={props.sort} onChange={(value) => props.setSort(value as SortValue)} options={['deadline', 'name', 'status']} />
    </div>
  );
}

async function partyRows() {
  const parties = (await partyApi.getSupervised()).data;
  return Promise.all(parties.map(async (party) => {
    try {
      const submission = (await submissionApi.get(party.id)).data;
      return { party, hasSubmission: true, submissionStatus: submission.status };
    } catch {
      return { party, hasSubmission: false, submissionStatus: undefined };
    }
  }));
}

export function MyPartiesPage() {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('ALL');
  const [assignment, setAssignment] = useState('ALL');
  const [submission, setSubmission] = useState('ALL');
  const [sort, setSort] = useState<SortValue>('deadline');
  const query = useQuery({ queryKey: ['supervised-party-rows'], queryFn: partyRows });
  const rows = useMemo(() => (query.data ?? []).filter(({ party, hasSubmission, submissionStatus }) =>
    party.name.toLowerCase().includes(search.toLowerCase())
    && (status === 'ALL' || party.status === status)
    && (assignment === 'ALL' || (assignment === 'ASSIGNED') === !!party.assignedProjectId)
    && matchesSubmission(submission, hasSubmission, submissionStatus),
  ).sort((a, b) => sort === 'deadline'
    ? dateValue(a.party.assignedProjectDeadline) - dateValue(b.party.assignedProjectDeadline)
    : sort === 'name'
      ? a.party.name.localeCompare(b.party.name)
      : a.party.status.localeCompare(b.party.status)), [query.data, search, status, assignment, submission, sort]);

  return (
    <div className=''>
      <PageHeader title='My parties' description='Track your supervised parties, projects, and submissions.' />
      <Filters search={search} setSearch={setSearch} status={status} setStatus={setStatus} assignment={assignment} setAssignment={setAssignment} submission={submission} setSubmission={setSubmission} sort={sort} setSort={setSort} searchPlaceholder='Search parties' />
      {query.isLoading ? <LoadingCards /> : rows.length === 0 ? <EmptyState icon={Users}>No parties match these filters.</EmptyState> : <div className='grid gap-4 md:grid-cols-2'>{rows.map(({ party, submissionStatus }) => <PartyCard key={party.id} party={party} submissionStatus={submissionStatus} />)}</div>}
    </div>
  );
}

function PartyCard({ party, submissionStatus, browse = false, isMine = false }: { party: Party; submissionStatus?: string; browse?: boolean; isMine?: boolean }) {
  return (
    <Link to={browse ? `/party-supervisor/browse/${party.id}` : `/party-supervisor/parties/${party.id}`} className='rounded-lg border border-border bg-surface block p-5 hover:border-accent'>
      <div className='flex items-start justify-between gap-3'><div className='flex flex-wrap items-center gap-2'><h2 className='font-semibold'>{party.name}</h2>{isMine && <StatusBadge status='ASSIGNED' label='My party' />}</div><StatusBadge status={party.status} /></div>
      <p className='mt-2 text-xs text-muted'>{(party.members ?? []).length} members · {party.assignedProjectTitle || 'No project assigned'}</p>
      <p className='mt-1 text-xs text-muted'>Party supervisor: {party.supervisorName || 'Unassigned'}</p>
      {submissionStatus && <StatusBadge status={submissionStatus} className='mt-3' />}
      {party.assignedProjectDeadline && <div className='mt-4'><DeadlineCountdown deadline={party.assignedProjectDeadline} submitted={submitted(party.status)} compact /></div>}
    </Link>
  );
}

export function BrowsePartiesPage() {
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const query = useQuery({ queryKey: ['browse-parties'], queryFn: () => partyApi.browse().then((response) => response.data) });
  const parties = (query.data ?? []).filter((party) => party.name.toLowerCase().includes(search.toLowerCase()));
  return (
    <div className=''>
      <PageHeader title='Browse parties' description='Review available teams before choosing who to supervise.' />
      <ListToolbar searchLabel='Search parties' placeholder='Search parties' value={search} onChange={setSearch} />
      {query.isLoading ? <LoadingCards /> : parties.length === 0 ? <EmptyState icon={Users}>No parties are available.</EmptyState> : <div className='grid gap-4 md:grid-cols-2'>{parties.map((party) => <PartyCard key={party.id} party={party} browse isMine={party.supervisorId === user?.id} />)}</div>}
    </div>
  );
}

export function ProjectSupervisorDetailPage() {
  const { id = '' } = useParams();
  const project = useQuery({ queryKey: ['supervisor-project', id], queryFn: () => projectApi.getById(id).then((response) => response.data), enabled: !!id });
  const party = useQuery({ queryKey: ['supervisor-project-party', project.data?.assignedPartyId], queryFn: () => partyApi.getById(project.data!.assignedPartyId!).then((response) => response.data), enabled: !!project.data?.assignedPartyId });
  const applications = useQuery({ queryKey: ['supervisor-project-applications', id], queryFn: () => partyApi.getApplicationsByProject(id).then((response) => response.data), enabled: !!id });
  const submissions = useQuery({ queryKey: ['supervisor-project-submissions', id], queryFn: () => submissionApi.getByProject(id).then((response) => response.data), enabled: !!id, retry: false });

  if (project.isLoading) return <LoadingCards />;
  if (!project.data) return <EmptyState icon={Briefcase}>Project not found.</EmptyState>;
  return <WorkDetail kind='project' project={project.data} party={party.data} applications={applications.data ?? []} submission={submissions.data?.[0]} />;
}

export function PartySupervisorDetailPage({ browse = false }: { browse?: boolean }) {
  return browse ? <BrowsePartyDetail /> : <SupervisedPartyDetail />;
}

function SupervisedPartyDetail() {
  const { id = '' } = useParams();
  const party = useQuery({ queryKey: ['supervisor-party', id], queryFn: () => partyApi.getById(id).then((response) => response.data), enabled: !!id });
  const applications = useQuery({ queryKey: ['supervisor-party-applications', id], queryFn: () => partyApi.getApplicationsByParty(id).then((response) => response.data), enabled: !!party.data && !party.data.assignedProjectId });
  const submission = useQuery({ queryKey: ['supervisor-party-submission', id], queryFn: () => submissionApi.get(id).then((response) => response.data), enabled: !!party.data?.assignedProjectId, retry: false });
  const project = useQuery({ queryKey: ['supervisor-party-project', party.data?.assignedProjectId], queryFn: () => projectApi.getById(party.data!.assignedProjectId!).then((response) => response.data), enabled: !!party.data?.assignedProjectId });

  if (party.isLoading) return <LoadingCards />;
  if (!party.data) return <EmptyState icon={Users}>Party not found.</EmptyState>;
  return <WorkDetail kind='party' party={party.data} project={project.data} applications={applications.data ?? []} submission={submission.data} />;
}

function BrowsePartyDetail() {
  const { id = '' } = useParams();
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ['browse-parties'],
    queryFn: () => partyApi.browse().then((response) => response.data),
  });
  const party = query.data?.find((candidate) => candidate.id === id);
  const claim = useMutation({
    mutationFn: () => partyApi.claimSupervisor(id),
    onSuccess: () => {
      toast.success('Party selected');
      queryClient.invalidateQueries({ queryKey: ['browse-parties'] });
      queryClient.invalidateQueries({ queryKey: ['supervised-parties'] });
    },
    onError: (error: any) => toast.error(error?.response?.data?.message || 'Could not select party'),
  });
  if (query.isLoading) return <LoadingCards />;
  if (!party) return <EmptyState icon={Users}>Party not found.</EmptyState>;
  return (
    <div>
      {!party.supervisorId && (party.status === 'ACTIVE' || party.status === 'ASSIGNED') && (
        <div className='mb-4 flex justify-end'><Button variant='primary' isDisabled={claim.isPending} onPress={() => claim.mutate()}>{claim.isPending ? 'Selecting' : 'Pick this party'}</Button></div>
      )}
      <WorkDetail kind='party' party={party} applications={[]} browse />
    </div>
  );
}

function WorkDetail({ kind, project, party, applications, submission, browse = false }: {
  kind: ItemKind; project?: Project; party?: Party; applications: Application[]; submission?: Submission; browse?: boolean;
}) {
  const back = kind === 'project' ? '/project-supervisor/projects' : browse ? '/party-supervisor/browse' : '/party-supervisor/parties';
  const title = kind === 'project' ? project!.title : party!.name;
  return (
    <div className=' max-w-5xl'>
      <Link to={back} className={buttonVariants({ variant: 'ghost', size: 'sm' })}><ArrowLeft size={14} /> Back</Link>
      <div className='mt-4'><PageHeader title={title} description={kind === 'project' ? `${project!.companyName} · ${project!.status}` : `${party!.semester ?? ''} ${party!.academicYear ?? ''} · ${party!.status}`} /></div>
      {project && <ProjectBrief project={project} />}
      {party && <PartyMembers party={party} showScorecards={!browse} />}
      {kind === 'party' && !project && !browse && <Applications applications={applications} kind='party' />}
      {kind === 'project' && <Applications applications={applications} kind='project' />}
      {submission && <SubmissionPanel submission={submission} />}
      {submission && <EvaluationPanel submissionId={submission.id} />}
    </div>
  );
}

function ProjectBrief({ project }: { project: Project }) {
  return (
    <div className='rounded-lg border border-border bg-surface mb-5 p-6'>
      <div className='mb-5 flex flex-wrap items-center justify-between gap-3'><h2 className=' font-semibold text-foreground'>Project brief</h2><DeadlineCountdown deadline={project.deadline ?? null} compact /></div>
      <div className='grid gap-5 md:grid-cols-2'>{[
        ['Description', project.description], ['Scope', project.scope], ['Deliverables', project.deliverables], ['Evaluation criteria', project.evaluationCriteria],
      ].filter(([, value]) => value).map(([label, value]) => <div key={label}><p className='mb-1 text-[10px] font-bold uppercase tracking-wider text-muted'>{label}</p><p className='text-sm leading-relaxed text-foreground'>{value}</p></div>)}</div>
      {(project.tools ?? []).length > 0 && <div className='mt-5 flex flex-wrap gap-2 border-t border-border pt-4'>{project.tools.map((tool) => <span key={tool} className='rounded-lg border border-border bg-surface-secondary px-2.5 py-1 text-xs text-foreground'>{tool}</span>)}</div>}
      {project.projectSupervisorName && <p className='mt-4 text-sm text-foreground'>Project supervisor: <span className='text-foreground'>{project.projectSupervisorName}</span></p>}
      {project.assignedPartyName && <p className='mt-5 flex items-center gap-2 border-t border-border pt-4 text-sm text-foreground'><Users size={14} className='text-accent' /> Assigned party: {project.assignedPartyName}</p>}
    </div>
  );
}

function PartyMembers({ party, showScorecards }: { party: Party; showScorecards: boolean }) {
  const scorecards = useQuery({
    queryKey: ['supervisor-member-scorecards', party.id],
    queryFn: async () => Object.fromEntries(await Promise.all((party.members ?? []).map(async (member) => {
      try { return [member.id, (await userApi.getScorecard(member.id)).data] as const; }
      catch { return [member.id, null] as const; }
    }))),
    enabled: showScorecards,
  });
  return (
    <div className='rounded-lg border border-border bg-surface mb-5 p-6'>
      <div className='mb-4 flex flex-wrap items-center justify-between gap-2'><h2 className=' font-semibold text-foreground'>Party members</h2>{party.assignedProjectTitle && <span className='text-xs text-muted'>{party.assignedProjectTitle}</span>}</div>
      <div className='grid gap-3 sm:grid-cols-2'>
        {(party.members ?? []).map((member) => {
          const scorecard = scorecards.data?.[member.id] as Scorecard | null | undefined;
          return <Link key={member.id} to={`/supervisor/students/${member.id}`} className='rounded-lg border border-border bg-surface-secondary p-4 hover:border-accent'><div className='flex items-center justify-between'><p className='text-sm font-semibold'>{member.firstName} {member.lastName}</p>{party.leader?.id === member.id && <StatusBadge status='ASSIGNED' label='Leader' />}</div><p className='mt-1 text-xs text-muted'>{member.email}</p>{showScorecards && <p className='mt-3 text-xs text-muted'>Scorecard: <span className='font-semibold text-foreground'>{scorecard ? `${scorecard.averageScore.toFixed(0)} avg · ${scorecard.totalProjects} projects` : 'No scores yet'}</span></p>}</Link>;
        })}
      </div>
    </div>
  );
}

function Applications({ applications, kind }: { applications: Application[]; kind: ItemKind }) {
  return (
    <div className='rounded-lg border border-border bg-surface mb-5 overflow-hidden'>
      <div className='border-b border-border px-6 py-4'><h2 className=' font-semibold text-foreground'>Applications and rankings</h2></div>
      {applications.length === 0 ? <p className='p-6 text-sm text-muted'>No applications.</p> : <div className='divide-y divide-separator'>{[...applications].sort((a, b) => a.rankPosition - b.rankPosition).map((application) => <div key={application.id} className='flex gap-4 p-5'><span className='flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-surface-secondary text-sm font-bold text-accent'>#{application.rankPosition}</span><div><p className='text-sm font-semibold'>{kind === 'party' ? application.projectTitle : application.partyName}</p><p className='mt-1 text-xs text-muted'>{application.proposalText || 'No proposal provided.'}</p><StatusBadge status={application.status} className='mt-2' /></div></div>)}</div>}
    </div>
  );
}

function SubmissionPanel({ submission }: { submission: Submission }) {
  return (
    <div className='rounded-lg border border-border bg-surface mb-5 p-6'>
      <div className='mb-4 flex items-center justify-between'><h2 className='flex items-center gap-2 font-semibold'><Send size={15} className='text-accent' /> Submission</h2><StatusBadge status={submission.status || 'UNKNOWN'} /></div>
      {submission.repoUrl && <a href={submission.repoUrl} target='_blank' rel='noreferrer' className='flex items-center gap-2 text-sm text-accent hover:text-accent'><ExternalLink size={13} /> {submission.repoUrl}</a>}
      {submission.notes && <p className='mt-3 text-sm text-foreground'>{submission.notes}</p>}
      {(submission.documentUrls ?? []).length > 0 && <div className='mt-4 flex flex-wrap gap-2'>{(submission.documentUrls ?? []).map((url, index) => <a key={url} href={url} target='_blank' rel='noreferrer' className={buttonVariants({ variant: 'secondary', size: 'sm' })}><FileText size={12} /> Document {index + 1}</a>)}</div>}
    </div>
  );
}

function EvaluationPanel({ submissionId }: { submissionId: string }) {
  const query = useQuery({ queryKey: ['supervisor-evaluation', submissionId], queryFn: () => evaluationApi.getBySubmission(submissionId).then((response) => response.data), retry: false });
  if (query.isLoading || !query.data) return null;
  return (
    <div className='rounded-lg border border-border bg-surface overflow-hidden'>
      <EvaluationReportPanel report={query.data}>
        {query.data.finalized && <StatusBadge status='EVALUATED' label='Finalized' className='mt-4' />}
      </EvaluationReportPanel>
    </div>
  );
}

function CompactSelect({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (value: string) => void }) {
  return <Select.Root selectedKey={value} onSelectionChange={(key) => onChange(String(key))}><Label>{label}</Label><Select.Trigger aria-label={label}><Select.Value /><Select.Indicator /></Select.Trigger><Select.Popover><ListBox>{options.map((option) => <ListBox.Item key={option} id={option} textValue={option.replace(/_/g, ' ')}>{option.replace(/_/g, ' ').toLowerCase().replace(/^\w/, (letter) => letter.toUpperCase())}</ListBox.Item>)}</ListBox></Select.Popover></Select.Root>;
}
