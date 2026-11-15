import api, { refreshSession } from './client';
import { clearAuthTokens, getAccessToken, getRefreshToken, getJwtSessionKey } from '../utils/authTokens';
import type {
  AuthResponse,
  Project,
  Party,
  PartyRules,
  Submission,
  EvaluationReport,
  Scorecard,
  PageResponse,
  ChatMessage,
  ChatResponse,
  ChatContextSnapshot,
  Application,
  User,
  ProfileUpdateRequest,
  StudentProfile,
  Notification,
  CoordinatorAnalytics,
  ProjectSupervisorInvitation,
  ProjectSupervisorInvitationAcceptRequest,
  SupervisorProfessionalFields,
  SupervisorProfile,
  GlobalDeadlinePreview,
  GlobalDeadlineSetting,
  NotificationPreference,
  NotificationType,
} from '../types';

// ── Auth ────────────────────────────────────────────────────────────
export const authApi = {
  register: (data: Record<string, unknown>) =>
    api.post<AuthResponse>('/api/auth/register', data),
  login: (email: string, password: string) =>
    api.post<AuthResponse>('/api/auth/login', { email, password }),
  refresh: refreshSession,
  changePassword: async (currentPassword: string, newPassword: string) => {
    const session = getJwtSessionKey(getAccessToken());
    const refreshToken = getRefreshToken();
    await api.put('/api/auth/password', { currentPassword, newPassword });
    if (session ? session === getJwtSessionKey(getAccessToken()) : refreshToken === getRefreshToken()) clearAuthTokens();
  },
};

export const projectSupervisorInvitationApi = {
  validate: (token: string) =>
    api.get<ProjectSupervisorInvitation>(`/api/project-supervisor-invitations/${token}`),
  accept: (token: string, data: ProjectSupervisorInvitationAcceptRequest) =>
    api.post<AuthResponse>(`/api/project-supervisor-invitations/${token}/accept`, data),
  list: () =>
    api.get<ProjectSupervisorInvitation[]>('/api/company/project-supervisor-invitations'),
  create: (email: string) =>
    api.post<ProjectSupervisorInvitation>('/api/company/project-supervisor-invitations', { email }),
  resend: (id: string) =>
    api.post<ProjectSupervisorInvitation>(`/api/company/project-supervisor-invitations/${id}/resend`),
  revoke: (id: string) =>
    api.delete(`/api/company/project-supervisor-invitations/${id}`),
  listAccepted: () => api.get<User[]>('/api/company/project-supervisors'),
};

// ── Users ───────────────────────────────────────────────────────────
export const userApi = {
  getMe: () => api.get<User>('/api/users/me'),
  getById: (userId: string) => api.get<User>(`/api/users/${userId}`),
  completeOnboarding: (data: Record<string, unknown>) =>
    api.post<StudentProfile>('/api/users/onboarding', data),
  completeSupervisorOnboarding: (data: SupervisorProfessionalFields) =>
    api.post<SupervisorProfile>('/api/users/supervisor-onboarding', data),
  uploadSupervisorProfilePhoto: (file: File) => {
    const data = new FormData();
    data.append('file', file);
    return api.post<SupervisorProfile>('/api/users/supervisor-profile-photo', data, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  getScorecard: (userId: string) =>
    api.get<Scorecard>(`/api/users/${userId}/scorecard`),
  getMyScorecard: () => api.get<Scorecard>('/api/users/my/scorecard'),
  updateMyProfile: (data: ProfileUpdateRequest) =>
    api.put<User>('/api/users/me/profile', data),
  getPending: (page = 0, size = 20) =>
    api.get<PageResponse<User>>('/api/users/pending', {
      params: { page, size },
    }),
  getStudents: () => api.get<User[]>('/api/users/students'),
  getCompanies: () => api.get<User[]>('/api/users/companies'),
  getSupervisors: () => api.get<User[]>('/api/users/supervisors'),
  getCoordinators: () => api.get<User[]>('/api/users/coordinators'),
  approve: (userId: string) => api.put<User>(`/api/users/${userId}/approve`),
  reject: (userId: string, reason?: string) =>
    api.put<User>(`/api/users/${userId}/reject`, null, { params: { reason } }),
  suspend: (userId: string) => api.put<User>(`/api/users/${userId}/suspend`),
  unsuspend: (userId: string) => api.put<User>(`/api/users/${userId}/unsuspend`),
  deleteRejected: (userId: string) => api.delete(`/api/users/${userId}`),
  broadcast: (data: { title: string; message: string; role?: string }) =>
    api.post('/api/users/broadcast', data),
  githubCallback: (code: string) =>
    api.post<User>('/api/users/github/callback', null, { params: { code } }),
  getNotifications: (page = 0) =>
    api.get<{ notifications: Notification[]; unreadCount: number }>(
      '/api/users/notifications',
      { params: { page } },
    ),
  markNotificationRead: (id: string) =>
    api.put(`/api/users/notifications/${id}/read`),
  markAllNotificationsRead: () => api.put('/api/users/notifications/read-all'),
  clearNotifications: () => api.delete('/api/users/notifications/clear'),
  getNotificationPreferences: () =>
    api.get<NotificationPreference[]>('/api/users/notification-preferences'),
  updateNotificationPreference: (type: NotificationType, emailEnabled: boolean) =>
    api.put<NotificationPreference>(`/api/users/notification-preferences/${type}`, { emailEnabled }),
};

// ── Projects ────────────────────────────────────────────────────────
export const projectApi = {
  create: (data: Record<string, unknown>) =>
    api.post<Project>('/api/projects', data),
  update: (id: string, data: Record<string, unknown>) =>
    api.put<Project>(`/api/projects/${id}`, data),
  getOpen: (params: Record<string, unknown>) =>
    api.get<PageResponse<Project>>('/api/projects', { params }),
  getAll: (page = 0, size = 20, status?: string) =>
    api.get<PageResponse<Project>>('/api/projects/all', {
      params: { page, size, ...(status ? { status } : {}) },
    }),
  getAllUnpaged: async () => {
    const first = await api.get<PageResponse<Project>>('/api/projects/all', { params: { page: 0, size: 200 } });
    if (first.data.totalPages <= 1) return first.data.content;
    const rest = await Promise.all(Array.from({ length: first.data.totalPages - 1 }, (_, index) =>
      api.get<PageResponse<Project>>('/api/projects/all', { params: { page: index + 1, size: 200 } })));
    return [first.data.content, ...rest.map((response) => response.data.content)].flat();
  },
  getById: (id: string) => api.get<Project>(`/api/projects/${id}`),
  getMyProjects: () => api.get<Project[]>('/api/projects/my'),
  getSupervised: () => api.get<Project[]>('/api/projects/supervised'),
  approve: (id: string) => api.put<Project>(`/api/projects/${id}/approve`),
  disapprove: (id: string) =>
    api.put<Project>(`/api/projects/${id}/disapprove`),
  setDeadline: (id: string, deadline: string) =>
    api.put<Project>(`/api/projects/${id}/deadline`, null, {
      params: { deadline },
    }),
  setGlobalDeadline: (setting: GlobalDeadlineSetting) =>
    api.put('/api/projects/global-deadline', setting),
  getGlobalDeadline: () =>
    api.get<GlobalDeadlineSetting>('/api/projects/global-deadline'),
  previewGlobalDeadline: (setting: GlobalDeadlineSetting) =>
    api.post<GlobalDeadlinePreview>('/api/projects/global-deadline/preview', setting),
  assign: (projectId: string, partyId: string) =>
    api.put<Project>(`/api/projects/${projectId}/assign/${partyId}`),
  retract: (id: string) => api.put<Project>(`/api/projects/${id}/retract`),
  patchInternalName: (id: string, name: string) =>
    api.patch<Project>(`/api/projects/${id}/internal-name`, null, {
      params: { name },
    }),
  deleteProject: (id: string) => api.delete(`/api/projects/${id}`),
};

// ── Parties ─────────────────────────────────────────────────────────
export const partyApi = {
  getRules: () => api.get<PartyRules>('/api/parties/rules'),
  create: (data: Record<string, unknown>) =>
    api.post<Party>('/api/parties', data),
  join: (partyId: string) => api.post<Party>(`/api/parties/${partyId}/join`),
  leave: (partyId: string) =>
    api.delete<Party>(`/api/parties/${partyId}/leave`),
  applyToProject: (partyId: string, data: Record<string, unknown>) =>
    api.post<Application>(`/api/parties/${partyId}/apply`, data),
  getMyParty: () => api.get<Party>('/api/parties/my'),
  getById: (id: string) => api.get<Party>(`/api/parties/${id}`),
  getAll: () => api.get<Party[]>('/api/parties/all'),
  browse: () => api.get<Party[]>('/api/parties/browse'),
  getSupervised: () => api.get<Party[]>('/api/parties/supervised'),
  assignSupervisor: (partyId: string, supervisorId: string) =>
    api.put<Party>(`/api/parties/${partyId}/supervisor`, { supervisorId }),
  claimSupervisor: (partyId: string) =>
    api.put<Party>(`/api/parties/${partyId}/claim-supervisor`),
  rename: (partyId: string, name: string) =>
    api.put<Party>(`/api/parties/${partyId}/name`, { name }),
  removeMember: (partyId: string, userId: string) =>
    api.delete<Party>(`/api/parties/${partyId}/members/${userId}`),
  unassignProject: (partyId: string) =>
    api.delete<Party>(`/api/parties/${partyId}/project`),
  getApplicationsByParty: (partyId: string) =>
    api.get<Application[]>(`/api/parties/${partyId}/applications`),
  changeLeader: (partyId: string, newLeaderId: string) =>
    api.put<Party>(`/api/parties/${partyId}/leader`, null, {
      params: { newLeaderId },
    }),
  getApplicationsByProject: (projectId: string) =>
    api.get<Application[]>(`/api/parties/projects/${projectId}/applications`),
};

// ── Submissions ─────────────────────────────────────────────────────
export const submissionApi = {
  saveDraft: (partyId: string, formData: FormData) =>
    api.post<Submission>(`/api/submissions/${partyId}/draft`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  finalSubmit: (partyId: string) =>
    api.post<Submission>(`/api/submissions/${partyId}/submit`),
  get: (partyId: string) => api.get<Submission>(`/api/submissions/${partyId}`),
  getByProject: (projectId: string) =>
    api.get<Submission[]>(`/api/submissions/project/${projectId}`),
};

// ── Evaluations ─────────────────────────────────────────────────────
export const evaluationApi = {
  trigger: (submissionId: string) =>
    api.post<EvaluationReport>(`/api/evaluations/trigger/${submissionId}`),
  reevaluate: (reportId: string) =>
    api.post<EvaluationReport>(`/api/evaluations/${reportId}/reevaluate`),
  finalize: (reportId: string) =>
    api.put<EvaluationReport>(`/api/evaluations/${reportId}/finalize`),
  getBySubmission: (submissionId: string) =>
    api.get<EvaluationReport>(`/api/evaluations/submission/${submissionId}`),
};

// ── Chat ────────────────────────────────────────────────────────────
export const chatApi = {
  context: (signal?: AbortSignal) => api.get<ChatContextSnapshot>('/api/chat/context', { signal }),
  send: (
    message: string,
    history: ChatMessage[],
    context: string,
    projectId?: string,
    signal?: AbortSignal,
  ) =>
    api.post<ChatResponse>('/api/chat', {
      message: message.slice(0, 2000),
      history: history.slice(-10).map(({ role, content }) => ({ role, content: content.slice(0, 2000) })),
      context,
      projectId,
    }, { signal }),
};

// ── Coordinator Analytics ──────────────────────────────────────────
export const coordinatorApi = {
  getAnalytics: () => api.get<CoordinatorAnalytics>('/api/coordinator/analytics'),
};
