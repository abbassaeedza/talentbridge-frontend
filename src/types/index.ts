export type UserRole = 'STUDENT' | 'COMPANY' | 'PARTY_SUPERVISOR' | 'PROJECT_SUPERVISOR' | 'COORDINATOR'
export type UserStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'SUSPENDED'
export type PartyStatus = 'FORMING' | 'ACTIVE' | 'ASSIGNED' | 'SUBMITTED' | 'COMPLETED'
export type ProjectStatus = 'DRAFT' | 'PENDING_REVIEW' | 'OPEN' | 'ASSIGNED' | 'CLOSED' | 'ARCHIVED'
export type ApplicationStatus = 'PENDING' | 'ASSIGNED' | 'REJECTED' | 'REASSIGNED' | 'WITHDRAWN'
export type SubmissionStatus = 'DRAFT' | 'SUBMITTED' | 'UNDER_EVALUATION' | 'EVALUATED'
export type ProjectSupervisorInvitationStatus = 'PENDING' | 'ACCEPTED' | 'REVOKED' | 'EXPIRED'
export type NotificationType = 'ACCOUNT_APPROVED' | 'ACCOUNT_REJECTED' | 'PARTY_JOINED' | 'PARTY_LEFT' | 'PROJECT_ASSIGNED' | 'PROJECT_REJECTED' | 'APPLICATION_SUBMITTED' | 'SUBMISSION_RECEIVED' | 'EVALUATION_COMPLETE' | 'DEADLINE_REMINDER' | 'NEW_PROJECT_POSTED' | 'GENERAL'

export interface User {
  id: string
  email: string
  fullName?: string
  firstName: string
  lastName: string
  role: UserRole
  status: UserStatus
  phoneNumber?: string
  githubUsername?: string
  createdAt?: string
  studentProfile?: StudentProfile
  companyProfile?: CompanyProfile
  supervisorProfile?: SupervisorProfile
  suspensionCount?: number
  rejectionCount?: number
  partyId?: string
  partyName?: string
}

export interface StudentProfile {
  id: string
  age?: number
  university?: string
  yearOfStudy?: string
  major?: string
  skills: string[]
  pastExperience?: string
  bio?: string
  linkedinUrl?: string
  portfolioUrl?: string
  gpa?: number
}

export interface CompanyProfile {
  id: string
  companyName: string
  industry?: string
  description?: string
  website?: string
  logoUrl?: string
  country?: string
  city?: string
}

export interface ProfileUpdateRequest {
  firstName?: string
  lastName?: string
  phoneNumber?: string | null
  university?: string
  major?: string
  yearOfStudy?: string
  bio?: string | null
  linkedinUrl?: string | null
  portfolioUrl?: string | null
  pastExperience?: string | null
  skills?: string[]
  gpa?: number | null
  companyName?: string
  industry?: string | null
  description?: string | null
  website?: string | null
  city?: string | null
  country?: string | null
}

export interface SupervisorProfile {
  id: string
  jobTitle: string
  department: string
  bio: string
  linkedinUrl?: string
  profilePhotoUrl?: string
}

export interface ProjectSupervisorInvitation {
  id: string
  email: string
  companyName: string
  status: ProjectSupervisorInvitationStatus
  expiresAt: string
}

export interface SupervisorProfessionalFields {
  jobTitle: string
  department: string
  bio: string
  linkedinUrl?: string
}

export interface ProjectSupervisorInvitationAcceptRequest extends SupervisorProfessionalFields {
  password: string
  firstName: string
  lastName: string
  phoneNumber?: string
}

export interface AuthResponse {
  accessToken: string
  refreshToken: string
  tokenType: string
  user: {
    id: string
    email: string
    firstName: string
    lastName: string
    role: UserRole
    status: UserStatus
    onboardingComplete: boolean
    githubUsername?: string
    supervisorProfile?: SupervisorProfile
  }
}

export interface Project {
  id: string
  title: string
  description: string
  scope: string
  deliverables: string
  evaluationCriteria: string
  tools: string[]
  status: ProjectStatus
  deadline?: string
  companyName: string
  companyIndustry?: string
  companyId?: string
  projectSupervisorName?: string
  projectSupervisorId?: string
  assignedPartyId?: string
  assignedPartyName?: string
  finished?: boolean
  createdByName: string
  partyApplicationCount: number
  projectField?: string
  internalName?: string
  createdAt: string
}

export interface PartyMember {
  id: string
  firstName: string
  lastName: string
  email: string
  skills: string[]
}

export interface Party {
  id: string
  name: string
  status: PartyStatus
  semester?: string
  academicYear?: number
  leader: PartyMember
  members: PartyMember[]
  supervisorName?: string
  supervisorId?: string
  assignedProjectId?: string
  assignedProjectTitle?: string
  assignedProjectDeadline?: string
}

export interface PartyRules {
  minSize: number
  maxSize: number
  supervisorMaxParties: number
}

export interface Application {
  id: string
  projectId: string
  projectTitle: string
  companyName: string
  partyId: string
  partyName: string
  rankPosition: number
  proposalText?: string
  status: ApplicationStatus
  coordinatorNotes?: string
  createdAt: string
}

export interface Submission {
  id: string
  partyId?: string
  partyName?: string
  party?: { id: string; name: string }
  projectId?: string
  projectTitle?: string
  project?: { id: string; title: string }
  repoUrl?: string
  repoBranch?: string
  documentUrls: string[]
  status: SubmissionStatus
  submittedAt?: string
  notes?: string
}

export interface StudentEvaluationScore {
  id: string
  student: { id: string; firstName: string; lastName: string; email: string; githubUsername?: string }
  totalCommits: number
  contributionPercentage: number
  individualScore: number
  performanceNotes: string
}

export interface EvaluationReport {
  id: string
  submissionId?: string
  submission?: { id: string }
  aiDetectionScore: number
  aiDetectionNotes: string
  codeQualityScore: number
  codeQualityNotes: string
  functionalityScore: number
  functionalityNotes: string
  scopeAlignmentScore: number
  scopeAlignmentNotes: string
  teamCollaborationScore: number
  teamCollaborationNotes: string
  totalScore: number
  overallSummary: string
  studentScores: StudentEvaluationScore[]
  evaluatedAt: string
  finalized: boolean
}

export interface Scorecard {
  id: string
  studentId: string
  entries: ScorecardEntry[]
  averageScore: number
  totalProjects: number
}

export interface ScorecardEntry {
  id: string
  project: { id: string; title: string; companyName?: string }
  score: number
  semester?: string
  academicYear?: number
  createdAt: string
  evaluationReport?: EvaluationReport
}

export interface Notification {
  id: string
  type: string
  title: string
  message: string
  read: boolean
  referenceId?: string
  referenceType?: string
  createdAt: string
}

export interface GlobalDeadlineSetting {
  enabled: boolean
  deadline: string | null
}

export interface GlobalDeadlinePreview {
  affectedCounts: Record<'PENDING_REVIEW' | 'OPEN' | 'ASSIGNED', number>
  excludedFinishedCount: number
}

export interface NotificationPreference {
  type: NotificationType
  emailEnabled: boolean
}

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface ProjectDraft {
  title?: string
  description?: string
  scope?: string
  deliverables?: string
  evaluationCriteria?: string
  projectField?: string
  tools?: string[]
}

export interface SummarySet<T> {
  items: T[]
  total: number
  truncated: boolean
}

export interface ChatProjectSummary {
  id: string
  title: string
  status: string
  companyName: string | null
  deadlineUTC: string | null
  finished: boolean
  partyApplicationCount: number
}

export interface ChatProjectBrief extends ChatProjectSummary {
  description: string | null
  scope: string | null
  deliverables: string | null
  evaluationCriteria: string | null
  tools: string[]
  projectField: string | null
  truncatedFields: string[]
}

export interface ChatPartySummary {
  id: string
  name: string
  status: string
  memberCount: number
  supervisorName: string | null
  assignedProjectId: string | null
  viewerIsLeader: boolean
}

export interface ChatApplicationSummary {
  id: string
  partyId: string
  partyName: string
  projectId: string
  projectTitle: string
  rankPosition: number | null
  status: string
}

export interface ChatSubmissionSummary {
  id: string
  partyId: string
  partyName: string
  projectId: string
  projectTitle: string
  status: string
  submittedAtUTC: string | null
}

export interface ChatContextSnapshot {
  viewer: { id: string; role: UserRole; name: string }
  snapshotTimeUTC: string
  globalDeadline: { enabled: boolean; deadlineUTC: string | null }
  openProjects: SummarySet<ChatProjectSummary>
  projects: SummarySet<ChatProjectSummary>
  parties: SummarySet<ChatPartySummary>
  applications: SummarySet<ChatApplicationSummary>
  submissions: SummarySet<ChatSubmissionSummary>
  evaluations: SummarySet<{
    id: string; submissionId: string; projectId: string; finalized: boolean; evaluatedAtUTC: string | null
    totalScore: number | null; aiDetectionScore: number | null; codeQualityScore: number | null
    functionalityScore: number | null; scopeAlignmentScore: number | null; teamCollaborationScore: number | null
    myIndividualScore: number | null; myContributionPercentage: number | null; myTotalCommits: number | null
  }>
  partyDirectory: SummarySet<ChatPartySummary> | null
  counts: {
    projectsByStatus: Record<string, number>
    partiesByStatus: Record<string, number>
    applicationsByStatus: Record<string, number>
    submissionsByStatus: Record<string, number>
    finalizedEvaluations: number
    users: { total: number; byRole: Record<string, number>; byStatus: Record<string, number> } | null
  }
  myAssignedProject: ChatProjectBrief | null
  myScorecard: {
    averageScore: number | null
    totalProjects: number
    entries: SummarySet<{ id: string; projectId: string; projectTitle: string; score: number | null; semester: string | null; academicYear: number | null }>
  } | null
  upcomingDeadlines: SummarySet<{ projectId: string; title: string; deadlineUTC: string }>
}

export interface ChatResponse {
  message: string
  model: string
  projectDraft?: ProjectDraft
  source?: 'llm'
}

export interface PageResponse<T> {
  content: T[]
  totalPages: number
  totalElements: number
  page: number
  size: number
  first: boolean
  last: boolean
}

export interface CoordinatorAnalytics {
  projectsByStatus: Record<string, number>
  usersByRole: Record<string, number>
  usersByStatus: Record<string, number>
  submissionsByStatus: Record<string, number>
  totalParties: number
  assignedParties: number
  unassignedParties: number
  finalizedEvaluations: number
  draftEvaluations: number
}

// ── Project field options ─────────────────────────────────────────────────────
export const PROJECT_FIELDS = [
  'Fintech',
  'Software',
  'Healthcare',
  'Education',
  'Marketing',
  'Engineering',
  'Other',
] as const;

export type ProjectFieldOption = (typeof PROJECT_FIELDS)[number];

export function getUserName(user?: Partial<User> | null): string {
  if (!user) return 'Unknown user';
  const fullName = user.fullName?.trim();
  if (fullName) return fullName;
  const firstLast = [user.firstName, user.lastName].filter(Boolean).join(' ').trim();
  if (firstLast) return firstLast;
  return user.email ?? 'Unknown user';
}
