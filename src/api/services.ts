import api from './client';
import type {
  AuthResponse,
  Project,
  Party,
  Submission,
  EvaluationReport,
  Scorecard,
  PageResponse,
  ChatMessage,
  Application,
  User,
  StudentProfile,
  Notification,
  CoordinatorAnalytics,
} from '../types';

// ── Auth ────────────────────────────────────────────────────────────
export const authApi = {
  register: (data: Record<string, unknown>) =>
    api.post<AuthResponse>('/api/auth/register', data),
  login: (email: string, password: string) =>
    api.post<AuthResponse>('/api/auth/login', { email, password }),
  refresh: (refreshToken: string) =>
    api.post<AuthResponse>('/api/auth/refresh', { refreshToken }),
  changePassword: (currentPassword: string, newPassword: string) =>
    api.put('/api/auth/password', { currentPassword, newPassword }),
};

// ── Users ───────────────────────────────────────────────────────────
export const userApi = {
  getMe: () => api.get<User>('/api/users/me'),
  completeOnboarding: (data: Record<string, unknown>) =>
    api.post<StudentProfile>('/api/users/onboarding', data),
  getScorecard: (userId: string) =>
    api.get<Scorecard>(`/api/users/${userId}/scorecard`),
  getMyScorecard: () => api.get<Scorecard>('/api/users/my/scorecard'),
  updateMyProfile: (data: Record<string, unknown>) =>
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
  broadcast: (data: { title: string; message: string; role?: string }) =>
    api.post('/api/users/broadcast', data),
  githubCallback: (code: string) =>
    api.post('/api/users/github/callback', null, { params: { code } }),
  getNotifications: (page = 0) =>
    api.get<{ notifications: Notification[]; unreadCount: number }>(
      '/api/users/notifications',
      { params: { page } },
    ),
  markNotificationRead: (id: string) =>
    api.put(`/api/users/notifications/${id}/read`),
  markAllNotificationsRead: () => api.put('/api/users/notifications/read-all'),
  clearNotifications: () => api.delete('/api/users/notifications/clear'),
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
  getById: (id: string) => api.get<Project>(`/api/projects/${id}`),
  getMyProjects: () => api.get<Project[]>('/api/projects/my'),
  approve: (id: string) => api.put<Project>(`/api/projects/${id}/approve`),
  disapprove: (id: string) =>
    api.put<Project>(`/api/projects/${id}/disapprove`),
  setDeadline: (id: string, deadline: string) =>
    api.put<Project>(`/api/projects/${id}/deadline`, null, {
      params: { deadline },
    }),
  setGlobalDeadline: (deadline: string) =>
    api.put('/api/projects/global-deadline', { deadline }),
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
  getSupervised: () => api.get<Party[]>('/api/parties/supervised'),
  assignSupervisor: (partyId: string, supervisorId: string) =>
    api.put<Party>(`/api/parties/${partyId}/supervisor`, { supervisorId }),
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
  finalize: (reportId: string) =>
    api.put<EvaluationReport>(`/api/evaluations/${reportId}/finalize`),
  getBySubmission: (submissionId: string) =>
    api.get<EvaluationReport>(`/api/evaluations/submission/${submissionId}`),
};

// ── Chat ────────────────────────────────────────────────────────────
export const chatApi = {
  send: (
    message: string,
    history: ChatMessage[],
    context: string,
    projectId?: string,
  ) =>
    api.post<{ message: string; model: string }>('/api/chat', {
      message,
      history,
      context,
      projectId,
    }),
};

// ── Coordinator Analytics ──────────────────────────────────────────
export const coordinatorApi = {
  getAnalytics: () => api.get<CoordinatorAnalytics>('/api/coordinator/analytics'),
};
