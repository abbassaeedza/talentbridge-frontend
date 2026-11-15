import type { ChatContextSnapshot, SummarySet, UserRole } from '../types/index.ts';
import { formatDateTime, parseServerDateTime } from './dateTime.ts';
import { CHAT_CONTEXT_TTL } from './chatContextCache.ts';

export type ChatAction = { label: string; path?: string; message?: string };
export type ChatReply = { text: string; items?: { text: string; path?: string }[]; actions?: ChatAction[] };
export type ChatResolution = { kind: 'reply'; reply: ChatReply } | { kind: 'contextRequired' } | { kind: 'llmRequired' };
export type ChatInput = { message: string; userId: string; role: UserRole; path: string };

const routes: Record<UserRole, Record<string, string>> = {
  STUDENT: { dashboard: '/student/dashboard', projects: '/student/projects', party: '/student/party', submission: '/student/submission', scorecard: '/student/scorecard', supervisors: '/student/supervisors' },
  COMPANY: { dashboard: '/company/dashboard', projects: '/company/projects', 'new project': '/company/projects/new', supervisors: '/company/project-supervisors' },
  COORDINATOR: { dashboard: '/coordinator/dashboard', projects: '/coordinator/projects', parties: '/coordinator/parties', students: '/coordinator/students', companies: '/coordinator/companies', supervisors: '/coordinator/supervisors', evaluations: '/coordinator/evaluations' },
  PARTY_SUPERVISOR: { dashboard: '/party-supervisor/overview', parties: '/party-supervisor/parties', browse: '/party-supervisor/browse' },
  PROJECT_SUPERVISOR: { dashboard: '/project-supervisor/overview', projects: '/project-supervisor/projects' },
};

export function chatHelp(role: UserRole): ChatReply {
  return {
    text: 'I can help with navigation, workflows, and facts you can access. Project suggestions are not saved until you save the form.',
    actions: [
      ...Object.entries(routes[role]).slice(0, 4).map(([label, path]) => ({ label: `Open ${label}`, path })),
      { label: 'Upcoming deadlines', message: 'What are my upcoming deadlines?' },
    ],
  };
}

export function chatProjectPath(role: UserRole, id: string): string | undefined {
  const encoded = encodeURIComponent(id);
  if (role === 'PARTY_SUPERVISOR') return undefined;
  return `${role === 'COMPANY' ? '/company' : role === 'COORDINATOR' ? '/coordinator'
    : role === 'PROJECT_SUPERVISOR' ? '/project-supervisor' : '/student'}/projects/${encoded}`;
}

function validSet(value: SummarySet<unknown> | undefined): boolean {
  return !!value && Array.isArray(value.items) && value.items.length <= 50 && Number.isSafeInteger(value.total)
    && value.total >= value.items.length && typeof value.truncated === 'boolean'
    && value.truncated === (value.total > value.items.length);
}

function describeSet<T>(set: SummarySet<T>, label: string, item: (value: T) => { text: string; path?: string }): ChatReply {
  return { text: `${set.total} ${label}.${set.truncated ? ` Showing ${set.items.length}; this list is incomplete.` : ''}`,
    items: set.items.map(item) };
}

export function resolveChat(input: ChatInput, snapshot: ChatContextSnapshot | undefined, clock: () => number): ChatResolution {
  const text = input.message.trim().toLowerCase().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  const reply = (value: ChatReply): ChatResolution => ({ kind: 'reply', reply: value });
  if (/^(hi|hello|hey|good morning|good afternoon|good evening|help|what can you do|thanks|thank you)$/.test(text)) return reply(chatHelp(input.role));
  const navigation = text.match(/^(?:open|go to|take me to|show) (?:my |the )?(dashboard|projects|party|parties|submission|scorecard|supervisors|students|companies|evaluations|new project|browse)$/);
  if (navigation) {
    const path = routes[input.role][navigation[1]];
    return reply(path ? { text: `Open ${navigation[1]} to continue.`, actions: [{ label: `Open ${navigation[1]}`, path }] }
      : { text: 'That page is not available for your role.', actions: chatHelp(input.role).actions });
  }
  if (/^(?:how (?:do|can) i |how to )(?:apply(?: to (?:a )?project)?|submit an application)$/.test(text)) {
    return reply({ text: 'Students apply from a project page as party leader. OPEN visibility is not application eligibility; check the party, project, and deadline requirements shown in the application form.',
      actions: input.role === 'STUDENT' ? [{ label: 'Browse projects', path: '/student/projects' }, { label: 'My party', path: '/student/party' }] : chatHelp(input.role).actions });
  }
  if (/^(?:how (?:do|can) i |how to )(?:create (?:a )?project|save (?:a )?(?:project|draft)|submit (?:a )?project)$/.test(text)) {
    return reply({ text: 'Companies prepare a project in the form, then choose Save as draft or Submit for review. AI suggestions only fill empty fields after explicit review; chat never saves a project.',
      actions: input.role === 'COMPANY' ? [{ label: 'Create project', path: '/company/projects/new' }] : chatHelp(input.role).actions });
  }
  if (/^(?:how (?:do|can) i |how to )(?:submit(?: my work)?|upload (?:a )?submission|join (?:a )?party|find (?:a )?supervisor|review evaluations|approve users)$/.test(text)) {
    return reply({ text: 'Use the relevant workspace page to review requirements and confirm the action there. Chat does not submit work, join parties, approve users, or finalize evaluations.', actions: chatHelp(input.role).actions });
  }

  const fact = /^(?:how many |list |what are |what is |show )?(?:my |the )?(open projects|projects|parties|applications|submissions|evaluations|finalized evaluations|upcoming deadlines|deadlines|assigned project|assigned project brief|scorecard|users|pending users|available parties)(?: do i have| are there)?$/.exec(text)?.[1];
  const statusFact = /^(?:how many |list |what are )?(?:my )?(draft|pending review|open|assigned|closed|archived) projects(?: do i have| are there)?$/.exec(text)?.[1];
  if (!fact && !statusFact) return { kind: 'llmRequired' };
  if ((fact === 'users' || fact === 'pending users') && input.role !== 'COORDINATOR'
    || (fact === 'scorecard' || fact?.startsWith('assigned project')) && input.role !== 'STUDENT'
    || fact === 'available parties' && input.role !== 'PARTY_SUPERVISOR') return reply({ text: 'That information is not available for your role.', actions: chatHelp(input.role).actions });
  const timestamp = snapshot?.snapshotTimeUTC?.endsWith('Z') ? parseServerDateTime(snapshot.snapshotTimeUTC)?.getTime() : undefined;
  const now = clock();
  if (!snapshot || snapshot.viewer?.id !== input.userId || snapshot.viewer?.role !== input.role
    || timestamp === undefined || now < timestamp || now - timestamp >= CHAT_CONTEXT_TTL) return { kind: 'contextRequired' };
  if (statusFact && fact !== 'open projects') {
    const status = statusFact.toUpperCase().replace(' ', '_');
    const count = snapshot.counts?.projectsByStatus?.[status];
    return reply(Number.isSafeInteger(count) && count >= 0 ? { text: `${count} ${statusFact} workspace projects. Open-project discovery is counted separately.` }
      : { text: 'Project counts are unavailable. Open your workspace to inspect projects.', actions: chatHelp(input.role).actions });
  }
  if (fact === 'users' || fact === 'pending users') {
    const users = snapshot.counts?.users;
    const count = fact === 'pending users' ? users?.byStatus?.PENDING : users?.total;
    return reply(typeof count === 'number' && Number.isSafeInteger(count) && count >= 0
      ? { text: `${count} ${fact}.`, actions: [{ label: 'Students', path: '/coordinator/students' }, { label: 'Companies', path: '/coordinator/companies' }, { label: 'Supervisors', path: '/coordinator/supervisors' }] }
      : { text: 'User counts are unavailable.' });
  }
  if (fact === 'finalized evaluations') {
    const count = snapshot.counts?.finalizedEvaluations;
    return reply(Number.isSafeInteger(count) && count >= 0 ? { text: `${count} finalized evaluations.` } : { text: 'Finalized evaluation counts are unavailable.' });
  }
  if (fact?.startsWith('assigned project')) {
    const project = snapshot.myAssignedProject;
    return reply(project ? { text: `Assigned project: ${project.title}. ${project.status}. Deadline: ${project.deadlineUTC ? formatDateTime(project.deadlineUTC) : 'not set'}.${project.truncatedFields?.length ? ' Some brief fields are shortened; open the project for the full brief.' : ''}`,
      items: fact.endsWith('brief') ? [project.description, project.scope, project.deliverables, project.evaluationCriteria].filter((value): value is string => !!value).map(text => ({ text })) : undefined,
      actions: [{ label: 'Open assigned project', path: chatProjectPath(input.role, project.id) }] }
      : { text: 'You do not currently have an assigned project.', actions: [{ label: 'My party', path: '/student/party' }] });
  }
  if (fact === 'scorecard') {
    const score = snapshot.myScorecard;
    return reply(score ? { text: `${score.totalProjects} scored projects. ${score.averageScore === null ? 'Average score unavailable.' : `Average score: ${score.averageScore}.`}`,
      actions: [{ label: 'Open scorecard', path: '/student/scorecard' }] } : { text: 'Your scorecard is unavailable.', actions: [{ label: 'Open scorecard', path: '/student/scorecard' }] });
  }
  if (fact === 'deadlines' || fact === 'upcoming deadlines') {
    const set = snapshot.upcomingDeadlines;
    if (!validSet(set)) return reply({ text: 'Upcoming deadlines are unavailable.' });
    const result = describeSet(set, 'upcoming deadlines', item => ({ text: `${item.title}: ${formatDateTime(item.deadlineUTC)}`, path: chatProjectPath(input.role, item.projectId) }));
    if (snapshot.globalDeadline?.enabled) result.text += ` Global deadline: ${formatDateTime(snapshot.globalDeadline.deadlineUTC)}.`;
    return reply(result);
  }
  if (fact === 'projects' || fact === 'open projects') {
    const set = fact === 'open projects' ? snapshot.openProjects : snapshot.projects;
    return reply(validSet(set) ? describeSet(set, fact === 'projects' ? 'workspace projects' : 'open projects', project => ({ text: `${project.title}: ${project.status}`, path: fact === 'open projects' && input.role === 'PROJECT_SUPERVISOR' ? undefined : chatProjectPath(input.role, project.id) })) : { text: 'Projects are unavailable.' });
  }
  if (fact === 'parties' || fact === 'available parties') {
    const set = fact === 'available parties' ? snapshot.partyDirectory : snapshot.parties;
    return reply(set && validSet(set) ? describeSet(set, fact, party => ({ text: `${party.name}: ${party.status}, ${party.memberCount} members${party.viewerIsLeader ? ', you are the leader' : ''}`,
      path: input.role === 'STUDENT' ? '/student/party' : input.role === 'PARTY_SUPERVISOR' ? `/party-supervisor/${fact === 'available parties' ? 'browse' : 'parties'}/${encodeURIComponent(party.id)}` : undefined })) : { text: 'Parties are unavailable.' });
  }
  if (fact === 'applications') return reply(validSet(snapshot.applications) ? describeSet(snapshot.applications, 'applications', application => ({ text: `${application.projectTitle}: ${application.status}${application.rankPosition === null ? '' : ` (rank ${application.rankPosition})`}` })) : { text: 'Applications are unavailable.' });
  if (fact === 'submissions') return reply(validSet(snapshot.submissions) ? describeSet(snapshot.submissions, 'submissions', submission => ({ text: `${submission.projectTitle}: ${submission.status}` })) : { text: 'Submissions are unavailable.' });
  return reply(validSet(snapshot.evaluations) ? describeSet(snapshot.evaluations, 'evaluations', evaluation => ({ text: `${evaluation.finalized ? 'Finalized' : 'Draft'} evaluation` })) : { text: 'Evaluations are unavailable.' });
}
