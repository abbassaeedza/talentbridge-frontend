export type UserRole = 'STUDENT' | 'COMPANY' | 'PARTY_SUPERVISOR' | 'PROJECT_SUPERVISOR' | 'COORDINATOR'
export type UserStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'SUSPENDED'
export type PartyStatus = 'FORMING' | 'ACTIVE' | 'ASSIGNED' | 'SUBMITTED' | 'COMPLETED'
export type ProjectStatus = 'DRAFT' | 'PENDING_REVIEW' | 'OPEN' | 'ASSIGNED' | 'CLOSED' | 'ARCHIVED'
export type ApplicationStatus = 'PENDING' | 'ASSIGNED' | 'REJECTED' | 'REASSIGNED' | 'WITHDRAWN'
export type SubmissionStatus = 'DRAFT' | 'SUBMITTED' | 'UNDER_EVALUATION' | 'EVALUATED'
export type ProjectSupervisorInvitationStatus = 'PENDING' | 'ACCEPTED' | 'REVOKED' | 'EXPIRED'

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
  party?: { id: string; name: string }
  projectId?: string
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
  student: { id: string; firstName: string; lastName: string; email: string }
  totalCommits: number
  contributionPercentage: number
  individualScore: number
  performanceNotes: string
}

export interface EvaluationReport {
  id: string
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
