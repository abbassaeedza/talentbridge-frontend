import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Award, Briefcase, ExternalLink, FileText, Search, Send, Users } from 'lucide-react';
import { evaluationApi, partyApi, projectApi, submissionApi, userApi } from '../../api/services';
import DeadlineCountdown from '../../components/shared/DeadlineCountdown';
import { useAuth } from '../../contexts/AuthContext';
import type { Application, EvaluationReport, Party, Project, Scorecard, Submission } from '../../types';
import toast from 'react-hot-toast';

type ItemKind = 'project' | 'party';
type SortValue = 'deadline' | 'name' | 'status';

const submitted = (status: string) => status === 'SUBMITTED' || status === 'COMPLETED';
const dateValue = (value?: string) => value ? new Date(value).getTime() : Number.POSITIVE_INFINITY;
const matchesSubmission = (filter: string, hasSubmission: boolean, status?: string) => {
  if (filter === 'ALL') return true;
  if (filter === 'HAS_SUBMISSION') return hasSubmission;
  if (filter === 'NO_SUBMISSION') return !hasSubmission;
  return status === filter;
};

function EmptyState({ icon: Icon, children }: { icon: React.ElementType; children: React.ReactNode }) {
  return <div className='card p-14 text-center'><Icon size={32} className='mx-auto mb-3 text-ink-600' /><p className='text-sm text-ink-400'>{children}</p></div>;
}

function LoadingCards() {
  return <div className='grid gap-4 md:grid-cols-2'><div className='card h-40 animate-pulse' /><div className='card h-40 animate-pulse' /></div>;
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
  const loading = kind === 'project' ? projects.isLoading : parties.isLoading;
  const nearest = useMemo(() => [...(items ?? [])].filter((item) => {
    const deadline = kind === 'project' ? (item as Project).deadline : (item as Party).assignedProjectDeadline;
    return deadline && dateValue(deadline) > Date.now();
  }).sort((a, b) => dateValue(kind === 'project' ? (a as Project).deadline : (a as Party).assignedProjectDeadline)
    - dateValue(kind === 'project' ? (b as Project).deadline : (b as Party).assignedProjectDeadline))[0], [items, kind]);

  const project = kind === 'project' ? nearest as Project | undefined : undefined;
  const party = kind === 'party' ? nearest as Party | undefined : undefined;
  const title = kind === 'project' ? 'Project Supervisor Overview' : 'Party Supervisor Overview';

  return (
    <div className='animate-fade-up'>
      <div className='page-header'><h1 className='page-title'>{title}</h1><p className='page-subtitle'>Welcome back, {user?.firstName}. Here is the work that needs attention next.</p></div>
      {loading ? <LoadingCards /> : !items?.length ? <EmptyState icon={kind === 'project' ? Briefcase : Users}>No supervised {kind === 'project' ? 'projects' : 'parties'} yet.</EmptyState> : (
        <div className='grid gap-5 lg:grid-cols-[1.3fr_.7fr]'>
          <div className='card p-6'>
            <p className='mb-3 text-xs font-semibold uppercase tracking-wider text-ink-500'>Nearest deadline</p>
            {nearest ? (
              <>
                <Link to={kind === 'project' ? `/project-supervisor/projects/${project!.id}` : `/party-supervisor/parties/${party!.id}`} className='font-display text-xl font-bold text-white hover:text-ember-400'>{kind === 'project' ? project!.title : party!.name}</Link>
                <p className='mt-1 text-sm text-ink-400'>{kind === 'project' ? project!.assignedPartyName || 'Awaiting party assignment' : party!.assignedProjectTitle}</p>
                <div className='mt-5'><DeadlineCountdown deadline={(kind === 'project' ? project!.deadline : party!.assignedProjectDeadline) ?? null} submitted={kind === 'party' && submitted(party!.status)} /></div>
              </>
            ) : <p className='text-sm text-ink-400'>No upcoming deadlines.</p>}
          </div>
          <div className='card p-6'><p className='text-xs font-semibold uppercase tracking-wider text-ink-500'>Current workload</p><p className='mt-3 font-display text-4xl font-bold text-white'>{items.length}</p><p className='mt-1 text-sm text-ink-400'>supervised {kind === 'project' ? 'projects' : 'parties'}</p></div>
        </div>
      )}
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
    <div className='animate-fade-up'>
      <div className='page-header'><h1 className='page-title'>Projects</h1><p className='page-subtitle'>Search, filter, and review the projects assigned to you.</p></div>
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
    <Link to={`/project-supervisor/projects/${project.id}`} className='card block p-5 hover:border-ember-500/30'>
      <div className='flex items-start justify-between gap-3'><h2 className='font-display font-semibold text-white'>{project.title}</h2><span className='badge badge-open text-[10px]'>{project.status}</span></div>
      <p className='mt-2 line-clamp-2 text-xs leading-relaxed text-ink-400'>{project.description}</p>
      <div className='mt-4 flex flex-wrap gap-2 text-xs text-ink-500'><span>{project.assignedPartyName || 'Unassigned'}</span>{submissionStatus && <span className='badge badge-active text-[9px]'>{submissionStatus.replace('_', ' ')}</span>}</div>
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
    <div className='card mb-5 grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-5'>
      <label className='relative sm:col-span-2 xl:col-span-1'><Search size={14} className='absolute left-3 top-3 text-ink-500' /><input aria-label={props.searchPlaceholder} className='input pl-9' placeholder={props.searchPlaceholder} value={props.search} onChange={(event) => props.setSearch(event.target.value)} /></label>
      <select aria-label='Filter by status' className='input' value={props.status} onChange={(event) => props.setStatus(event.target.value)}><option value='ALL'>All statuses</option>{['DRAFT', 'PENDING_REVIEW', 'OPEN', 'ACTIVE', 'ASSIGNED', 'SUBMITTED', 'COMPLETED', 'CLOSED', 'ARCHIVED'].map((value) => <option key={value}>{value}</option>)}</select>
      <select aria-label='Filter by assignment' className='input' value={props.assignment} onChange={(event) => props.setAssignment(event.target.value)}><option value='ALL'>Any assignment</option><option value='ASSIGNED'>Assigned</option><option value='UNASSIGNED'>Unassigned</option></select>
      <select aria-label='Filter by submission' className='input' value={props.submission} onChange={(event) => props.setSubmission(event.target.value)}><option value='ALL'>Any submission</option><option value='HAS_SUBMISSION'>Has submission</option><option value='NO_SUBMISSION'>No submission</option><option value='DRAFT'>Draft</option><option value='SUBMITTED'>Submitted</option><option value='EVALUATED'>Evaluated</option></select>
      <select aria-label='Sort items' className='input' value={props.sort} onChange={(event) => props.setSort(event.target.value as SortValue)}><option value='deadline'>Deadline</option><option value='name'>Name</option><option value='status'>Status</option></select>
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
    <div className='animate-fade-up'>
      <div className='page-header'><h1 className='page-title'>My Parties</h1><p className='page-subtitle'>Track your supervised parties, projects, and submissions.</p></div>
      <Filters search={search} setSearch={setSearch} status={status} setStatus={setStatus} assignment={assignment} setAssignment={setAssignment} submission={submission} setSubmission={setSubmission} sort={sort} setSort={setSort} searchPlaceholder='Search parties' />
      {query.isLoading ? <LoadingCards /> : rows.length === 0 ? <EmptyState icon={Users}>No parties match these filters.</EmptyState> : <div className='grid gap-4 md:grid-cols-2'>{rows.map(({ party, submissionStatus }) => <PartyCard key={party.id} party={party} submissionStatus={submissionStatus} />)}</div>}
    </div>
  );
}

function PartyCard({ party, submissionStatus, browse = false }: { party: Party; submissionStatus?: string; browse?: boolean }) {
  return (
    <Link to={browse ? `/party-supervisor/browse/${party.id}` : `/party-supervisor/parties/${party.id}`} className='card block p-5 hover:border-ember-500/30'>
      <div className='flex items-start justify-between gap-3'><h2 className='font-display font-semibold text-white'>{party.name}</h2><span className='badge badge-active text-[10px]'>{party.status}</span></div>
      <p className='mt-2 text-xs text-ink-400'>{party.members.length} members · {party.assignedProjectTitle || 'No project assigned'}</p>
      {submissionStatus && <span className='mt-3 inline-flex badge badge-open text-[9px]'>{submissionStatus.replace('_', ' ')}</span>}
      {party.assignedProjectDeadline && <div className='mt-4'><DeadlineCountdown deadline={party.assignedProjectDeadline} submitted={submitted(party.status)} compact /></div>}
    </Link>
  );
}

export function BrowsePartiesPage() {
  const [search, setSearch] = useState('');
  const query = useQuery({ queryKey: ['browse-parties'], queryFn: () => partyApi.browse().then((response) => response.data) });
  const parties = (query.data ?? []).filter((party) => party.name.toLowerCase().includes(search.toLowerCase()));
  return (
    <div className='animate-fade-up'>
      <div className='page-header'><h1 className='page-title'>Browse Parties</h1><p className='page-subtitle'>Review available teams before choosing who to supervise.</p></div>
      <label className='relative mb-5 block max-w-md'><Search size={14} className='absolute left-3 top-3 text-ink-500' /><input className='input pl-9' placeholder='Search parties' value={search} onChange={(event) => setSearch(event.target.value)} /></label>
      {query.isLoading ? <LoadingCards /> : parties.length === 0 ? <EmptyState icon={Users}>No parties are available.</EmptyState> : <div className='grid gap-4 md:grid-cols-2'>{parties.map((party) => <PartyCard key={party.id} party={party} browse />)}</div>}
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
        <div className='mb-4 flex justify-end'><button className='btn-primary' disabled={claim.isPending} onClick={() => claim.mutate()}>{claim.isPending ? 'Selecting...' : 'Pick this party'}</button></div>
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
    <div className='animate-fade-up max-w-5xl'>
      <Link to={back} className='mb-6 flex items-center gap-2 text-sm text-ink-400 hover:text-white'><ArrowLeft size={14} /> Back</Link>
      <div className='page-header'><h1 className='page-title'>{title}</h1><p className='page-subtitle'>{kind === 'project' ? `${project!.companyName} · ${project!.status}` : `${party!.semester ?? ''} ${party!.academicYear ?? ''} · ${party!.status}`}</p></div>
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
    <div className='card mb-5 p-6'>
      <div className='mb-5 flex flex-wrap items-center justify-between gap-3'><h2 className='font-display font-semibold text-white'>Project brief</h2><DeadlineCountdown deadline={project.deadline ?? null} compact /></div>
      <div className='grid gap-5 md:grid-cols-2'>{[
        ['Description', project.description], ['Scope', project.scope], ['Deliverables', project.deliverables], ['Evaluation criteria', project.evaluationCriteria],
      ].filter(([, value]) => value).map(([label, value]) => <div key={label}><p className='mb-1 text-[10px] font-bold uppercase tracking-wider text-ink-500'>{label}</p><p className='text-sm leading-relaxed text-ink-200'>{value}</p></div>)}</div>
      {project.assignedPartyName && <p className='mt-5 flex items-center gap-2 border-t border-ink-800 pt-4 text-sm text-ink-300'><Users size={14} className='text-ember-400' /> Assigned party: {project.assignedPartyName}</p>}
    </div>
  );
}

function PartyMembers({ party, showScorecards }: { party: Party; showScorecards: boolean }) {
  const scorecards = useQuery({
    queryKey: ['supervisor-member-scorecards', party.id],
    queryFn: async () => Object.fromEntries(await Promise.all(party.members.map(async (member) => {
      try { return [member.id, (await userApi.getScorecard(member.id)).data] as const; }
      catch { return [member.id, null] as const; }
    }))),
    enabled: showScorecards,
  });
  return (
    <div className='card mb-5 p-6'>
      <div className='mb-4 flex flex-wrap items-center justify-between gap-2'><h2 className='font-display font-semibold text-white'>Party members</h2>{party.assignedProjectTitle && <span className='text-xs text-ink-400'>{party.assignedProjectTitle}</span>}</div>
      <div className='grid gap-3 sm:grid-cols-2'>
        {party.members.map((member) => {
          const scorecard = scorecards.data?.[member.id] as Scorecard | null | undefined;
          return <Link key={member.id} to={`/supervisor/students/${member.id}`} className='rounded-xl border border-ink-700/50 bg-ink-800/50 p-4 hover:border-ember-500/30'><div className='flex items-center justify-between'><p className='text-sm font-semibold text-white'>{member.firstName} {member.lastName}</p>{party.leader.id === member.id && <span className='badge badge-ember text-[9px]'>Leader</span>}</div><p className='mt-1 text-xs text-ink-500'>{member.email}</p>{showScorecards && <p className='mt-3 text-xs text-ink-400'>Scorecard: <span className='font-semibold text-white'>{scorecard ? `${scorecard.averageScore.toFixed(0)} avg · ${scorecard.totalProjects} projects` : 'No scores yet'}</span></p>}</Link>;
        })}
      </div>
    </div>
  );
}

function Applications({ applications, kind }: { applications: Application[]; kind: ItemKind }) {
  return (
    <div className='card mb-5 overflow-hidden'>
      <div className='border-b border-ink-800 px-6 py-4'><h2 className='font-display font-semibold text-white'>Applications and rankings</h2></div>
      {applications.length === 0 ? <p className='p-6 text-sm text-ink-400'>No applications.</p> : <div className='divide-y divide-ink-800'>{[...applications].sort((a, b) => a.rankPosition - b.rankPosition).map((application) => <div key={application.id} className='flex gap-4 p-5'><span className='flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-ink-800 text-sm font-bold text-ember-400'>#{application.rankPosition}</span><div><p className='text-sm font-semibold text-white'>{kind === 'party' ? application.projectTitle : application.partyName}</p><p className='mt-1 text-xs text-ink-400'>{application.proposalText || 'No proposal provided.'}</p><span className='mt-2 inline-flex badge badge-pending text-[9px]'>{application.status}</span></div></div>)}</div>}
    </div>
  );
}

function SubmissionPanel({ submission }: { submission: Submission }) {
  return (
    <div className='card mb-5 p-6'>
      <div className='mb-4 flex items-center justify-between'><h2 className='flex items-center gap-2 font-display font-semibold text-white'><Send size={15} className='text-ember-400' /> Submission</h2><span className='badge badge-open text-[10px]'>{submission.status.replace('_', ' ')}</span></div>
      {submission.repoUrl && <a href={submission.repoUrl} target='_blank' rel='noreferrer' className='flex items-center gap-2 text-sm text-ember-400 hover:text-ember-300'><ExternalLink size={13} /> {submission.repoUrl}</a>}
      {submission.notes && <p className='mt-3 text-sm text-ink-300'>{submission.notes}</p>}
      {submission.documentUrls.length > 0 && <div className='mt-4 flex flex-wrap gap-2'>{submission.documentUrls.map((url, index) => <a key={url} href={url} target='_blank' rel='noreferrer' className='btn-secondary px-3 py-2 text-xs'><FileText size={12} /> Document {index + 1}</a>)}</div>}
    </div>
  );
}

function EvaluationPanel({ submissionId }: { submissionId: string }) {
  const query = useQuery({ queryKey: ['supervisor-evaluation', submissionId], queryFn: () => evaluationApi.getBySubmission(submissionId).then((response) => response.data), retry: false });
  if (query.isLoading || !query.data) return null;
  const report = query.data as EvaluationReport;
  const dimensions = [
    ['AI detection', report.aiDetectionScore, report.aiDetectionNotes],
    ['Code quality', report.codeQualityScore, report.codeQualityNotes],
    ['Functionality', report.functionalityScore, report.functionalityNotes],
    ['Scope alignment', report.scopeAlignmentScore, report.scopeAlignmentNotes],
    ['Team collaboration', report.teamCollaborationScore, report.teamCollaborationNotes],
  ] as const;
  return (
    <div className='card p-6'>
      <div className='mb-5 flex items-start justify-between gap-4'><div><h2 className='flex items-center gap-2 font-display font-semibold text-white'><Award size={16} className='text-ember-400' /> Evaluation</h2><p className='mt-1 text-sm text-ink-400'>{report.overallSummary}</p></div><div className='text-right'><p className='font-display text-3xl font-bold text-white'>{report.totalScore.toFixed(0)}</p><p className='text-[10px] text-ink-500'>out of 100</p></div></div>
      <div className='grid gap-3 sm:grid-cols-2'>{dimensions.map(([label, score, notes]) => <div key={label} className='rounded-xl bg-ink-800/50 p-3'><div className='flex justify-between text-xs'><span className='text-ink-300'>{label}</span><strong className='text-white'>{score.toFixed(0)}</strong></div><div className='my-2 h-1.5 overflow-hidden rounded-full bg-ink-700'><div className='h-full rounded-full bg-ember-500' style={{ width: `${Math.max(0, Math.min(100, score))}%` }} /></div><p className='text-[11px] text-ink-500'>{notes}</p></div>)}</div>
      {report.studentScores.length > 0 && <div className='mt-5'><p className='mb-2 text-xs font-semibold uppercase tracking-wider text-ink-500'>Member scorecards</p><div className='grid gap-2 sm:grid-cols-2'>{report.studentScores.map((score) => <div key={score.id} className='flex items-center gap-3 rounded-xl border border-ink-700/50 p-3'><div className='flex-1'><p className='text-sm font-medium text-white'>{score.student.firstName} {score.student.lastName}</p><p className='text-[10px] text-ink-500'>{score.totalCommits} commits · {score.contributionPercentage}% contribution</p><p className='mt-1 text-[11px] text-ink-400'>{score.performanceNotes}</p></div><strong className='text-lg text-white'>{score.individualScore.toFixed(0)}</strong></div>)}</div></div>}
      {report.finalized && <span className='mt-4 inline-flex badge badge-open text-[9px]'>Finalized</span>}
    </div>
  );
}
