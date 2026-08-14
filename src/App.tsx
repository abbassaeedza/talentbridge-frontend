import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  Outlet,
  useNavigate,
} from 'react-router-dom';
import { useEffect, useRef } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster, toast } from 'react-hot-toast';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { userApi } from './api/services';
import { isGitHubOAuthStateValid } from './utils/githubOAuth';
import AppLayout from './components/layout/AppLayout';
import type { UserRole } from './types';
import { Layers, AlertTriangle, Ghost } from 'lucide-react';

// Auth pages
import LoginPage from './pages/auth/LoginPage';
import RegisterPage from './pages/auth/RegisterPage';
import PendingPage from './pages/auth/PendingPage';
import OnboardingPage from './pages/auth/OnboardingPage';

// Student pages
import StudentDashboard from './pages/student/StudentDashboard';
import ProjectsListPage from './pages/student/ProjectsListPage';
import ProjectDetailPage from './pages/student/ProjectDetailPage';
import MyPartyPage from './pages/student/MyPartyPage';
import JoinPartyPage from './pages/student/JoinPartyPage';
import SubmissionPage from './pages/student/SubmissionPage';
import ScorecardPage from './pages/student/ScorecardPage';
import SupervisorsPage from './pages/student/SupervisorsPage';

// Company pages
import CompanyDashboard from './pages/company/CompanyDashboard';
import CompanyProjectsPage from './pages/company/CompanyProjectsPage';
import CompanyProjectViewPage from './pages/company/CompanyProjectViewPage';
import CompanyProjectEditPage from './pages/company/CompanyProjectEditPage';
import CreateProjectPage from './pages/company/CreateProjectPage';
import ProjectSupervisorsPage from './pages/company/ProjectSupervisorsPage';

// Coordinator pages
import CoordinatorDashboard from './pages/coordinator/CoordinatorDashboard';
import ManageProjectsPage from './pages/coordinator/ManageProjectsPage';
import ManagePartiesPage from './pages/coordinator/ManagePartiesPage';
import EvaluationsPage from './pages/coordinator/EvaluationsPage';
import StudentsDirectoryPage from './pages/coordinator/StudentsDirectoryPage';
import CompaniesDirectoryPage from './pages/coordinator/CompaniesDirectoryPage';
import SupervisorsDirectoryPage from './pages/coordinator/SupervisorsDirectoryPage';

// Supervisor pages
import {
  BrowsePartiesPage,
  MyPartiesPage as SupervisorPartiesPage,
  PartySupervisorDetailPage,
  ProjectSupervisorDetailPage,
  SupervisedProjectsPage,
  SupervisorOverviewPage,
} from './pages/supervisor/SupervisorWorkspacePages';
import ProjectSupervisorInvitationPage from './pages/auth/ProjectSupervisorInvitationPage';

// Shared
import ProfilePage from './pages/shared/ProfilePage';
import StudentProfilePage from './pages/shared/StudentProfilePage';
import NotificationSettingsPage from './pages/shared/NotificationSettingsPage';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30_000 } },
});

// ── Rejected screen ──────────────────────────────────────────────────────────
function RejectedScreen() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const reason = (user as any)?.rejectionReason ?? null;
  return (
    <div className='min-h-screen bg-ink-950 mesh-bg flex items-center justify-center p-8'>
      <div className='text-center max-w-md'>
        <div className='w-20 h-20 rounded-3xl bg-red-500/10 border border-red-500/30 flex items-center justify-center mx-auto mb-6'>
          <AlertTriangle size={36} className='text-red-400' />
        </div>
        <h1 className='font-display text-2xl font-bold text-white mb-3'>
          Account Not Approved
        </h1>
        <p className='text-ink-400 text-sm leading-relaxed mb-4'>
          Your account has been rejected. Please contact the coordinator for
          more information.
        </p>
        {reason && (
          <div className='mb-6 p-4 rounded-2xl bg-ink-900 border border-red-500/20 text-left'>
            <p className='text-xs font-semibold text-ink-400 uppercase tracking-wider mb-1'>
              Reason
            </p>
            <p className='text-sm text-red-300'>{reason}</p>
          </div>
        )}
        <div className='p-4 rounded-2xl bg-ink-900 border border-ink-700/50 mb-6 text-left'>
          <p className='text-xs font-semibold text-ink-400 uppercase tracking-wider mb-1'>
            Contact Coordinator
          </p>
          <p className='text-sm text-ember-400 font-mono'>
            coordinator@talentbridge.com
          </p>
        </div>
        <button
          onClick={() => {
            logout();
            navigate('/login');
          }}
          className='btn-ghost text-ink-300'
        >
          Sign out
        </button>
      </div>
    </div>
  );
}

// ── 404 screen ───────────────────────────────────────────────────────────────
function NotFoundPage() {
  const navigate = useNavigate();
  return (
    <div className='min-h-screen bg-ink-950 mesh-bg flex items-center justify-center p-8'>
      <div className='text-center max-w-md'>
        <div className='w-24 h-24 rounded-3xl bg-ink-800 border border-ink-700/50 flex items-center justify-center mx-auto mb-6'>
          <Ghost size={44} className='text-ink-400' />
        </div>
        <p className='font-mono text-ember-400 text-sm font-semibold mb-2'>
          404
        </p>
        <h1 className='font-display text-3xl font-bold text-white mb-3'>
          This page ghosted you
        </h1>
        <p className='text-ink-400 text-sm leading-relaxed mb-8'>
          Looks like this route packed its bags and left. Maybe it never
          existed, or maybe it's just playing hard to get.
        </p>
        <div className='flex gap-3 justify-center'>
          <button onClick={() => navigate(-1)} className='btn-secondary'>
            Go back
          </button>
          <button
            onClick={() => navigate('/dashboard')}
            className='btn-primary'
          >
            <Layers size={15} /> Go home
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Loading screen ────────────────────────────────────────────────────────────
function FullScreenLoader() {
  return (
    <div className='min-h-screen bg-ink-950 flex items-center justify-center'>
      <div className='flex flex-col items-center gap-4'>
        <div className='w-10 h-10 rounded-xl bg-ember-500/20 border border-ember-500/30 flex items-center justify-center'>
          <div className='w-4 h-4 border-2 border-ember-500 border-t-transparent rounded-full animate-spin' />
        </div>
        <span className='text-ink-400 text-sm'>Loading TalentBridge…</span>
      </div>
    </div>
  );
}

function GitHubCallbackPage() {
  const { refreshUser } = useAuth();
  const navigate = useNavigate();
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const state = params.get('state');
    const expectedState = sessionStorage.getItem('github_oauth_state');
    sessionStorage.removeItem('github_oauth_state');

    if (!code || !isGitHubOAuthStateValid(expectedState, state)) {
      toast.error(params.get('error_description') || 'Invalid GitHub authorization response');
      navigate('/student/dashboard', { replace: true });
      return;
    }

    userApi
      .githubCallback(code)
      .then(refreshUser)
      .then(() => toast.success('GitHub account connected'))
      .catch((error) => toast.error(
        error?.response?.data?.message || 'Could not connect GitHub account',
      ))
      .finally(() => navigate('/student/dashboard', { replace: true }));
  }, [navigate, refreshUser]);

  return <FullScreenLoader />;
}

// ── Route guards ──────────────────────────────────────────────────────────────

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <FullScreenLoader />;
  if (user) return <Navigate to='/dashboard' replace />;
  return <>{children}</>;
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <FullScreenLoader />;
  if (!user) return <Navigate to='/login' replace />;
  return <>{children}</>;
}

function AppGuard({ children }: { children: React.ReactNode }) {
  const { user, loading, isApproved, onboardingComplete } = useAuth();
  if (loading) return <FullScreenLoader />;
  if (!user) return <Navigate to='/login' replace />;
  if ((user as any).status === 'REJECTED')
    return <Navigate to='/rejected' replace />;
  if ((user as any).status === 'PENDING')
    return <Navigate to='/pending' replace />;
  if (!isApproved) return <Navigate to='/pending' replace />;
  if (!onboardingComplete) return <Navigate to='/onboarding' replace />;
  return <>{children}</>;
}

function RoleRoute({
  roles,
}: {
  roles: UserRole[];
}) {
  const { user } = useAuth();
  if (!user || !roles.includes(user.role)) return <NotFoundPage />;
  return <Outlet />;
}

// ── Dashboard router ──────────────────────────────────────────────────────────
function DashboardRouter() {
  const { user } = useAuth();
  if (!user) return <Navigate to='/login' replace />;
  switch (user.role) {
    case 'STUDENT':
      return <Navigate to='/student/dashboard' replace />;
    case 'COMPANY':
      return <Navigate to='/company/dashboard' replace />;
    case 'COORDINATOR':
      return <Navigate to='/coordinator/dashboard' replace />;
    case 'PARTY_SUPERVISOR':
      return <Navigate to='/party-supervisor/overview' replace />;
    case 'PROJECT_SUPERVISOR':
      return <Navigate to='/project-supervisor/overview' replace />;
    default:
      return <Navigate to='/login' replace />;
  }
}

// ── App ───────────────────────────────────────────────────────────────────────
export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            {/* Public — redirect if already logged in */}
            <Route
              path='/login'
              element={
                <PublicRoute>
                  <LoginPage />
                </PublicRoute>
              }
            />
            <Route
              path='/register'
              element={
                <PublicRoute>
                  <RegisterPage />
                </PublicRoute>
              }
            />
            <Route path='/project-supervisor-invitations/:token' element={<ProjectSupervisorInvitationPage />} />

            {/* Semi-public — need auth but not full approval */}
            <Route
              path='/pending'
              element={
                <ProtectedRoute>
                  <PendingPage />
                </ProtectedRoute>
              }
            />
            <Route
              path='/rejected'
              element={
                <ProtectedRoute>
                  <RejectedScreen />
                </ProtectedRoute>
              }
            />
            <Route
              path='/onboarding'
              element={
                <ProtectedRoute>
                  <OnboardingPage />
                </ProtectedRoute>
              }
            />
            <Route
              path='/github/callback'
              element={
                <ProtectedRoute>
                  <GitHubCallbackPage />
                </ProtectedRoute>
              }
            />

            {/* Party join link — needs student auth, outside the app shell so it has its own full-page UI */}
            <Route
              path='/join/:partyId'
              element={
                <ProtectedRoute>
                  <JoinPartyPage />
                </ProtectedRoute>
              }
            />

            {/* Root → dashboard */}
            <Route path='/' element={<Navigate to='/dashboard' replace />} />

            {/* Dashboard redirect */}
            <Route
              path='/dashboard'
              element={
                <AppGuard>
                  <DashboardRouter />
                </AppGuard>
              }
            />

            {/* App shell */}
            <Route
              element={
                <AppGuard>
                  <AppLayout />
                </AppGuard>
              }
            >
              <Route element={<RoleRoute roles={['STUDENT']} />}>
                <Route path='/student/dashboard' element={<StudentDashboard />} />
                <Route path='/student/projects' element={<ProjectsListPage />} />
                <Route path='/student/projects/:id' element={<ProjectDetailPage />} />
                <Route path='/student/party' element={<MyPartyPage />} />
                <Route path='/student/submission' element={<SubmissionPage />} />
                <Route path='/student/scorecard' element={<ScorecardPage />} />
                <Route path='/student/supervisors' element={<SupervisorsPage />} />
                <Route path='/student/profile' element={<ProfilePage />} />
                <Route path='/student/notification-settings' element={<NotificationSettingsPage />} />
              </Route>

              <Route element={<RoleRoute roles={['COMPANY']} />}>
                <Route path='/company/dashboard' element={<CompanyDashboard />} />
                <Route path='/company/projects' element={<CompanyProjectsPage />} />
                <Route path='/company/projects/new' element={<CreateProjectPage />} />
                <Route path='/company/projects/:id' element={<CompanyProjectViewPage />} />
                <Route path='/company/projects/:id/edit' element={<CompanyProjectEditPage />} />
                <Route path='/company/project-supervisors' element={<ProjectSupervisorsPage />} />
                <Route path='/company/profile' element={<ProfilePage />} />
                <Route path='/company/notification-settings' element={<NotificationSettingsPage />} />
                <Route path='/company/students/:id' element={<StudentProfilePage />} />
              </Route>

              <Route element={<RoleRoute roles={['COORDINATOR']} />}>
                <Route path='/coordinator/dashboard' element={<CoordinatorDashboard />} />
                <Route path='/coordinator/users' element={<Navigate to='/coordinator/students' replace />} />
                <Route path='/coordinator/projects' element={<ManageProjectsPage />} />
                <Route path='/coordinator/projects/:id' element={<ProjectDetailPage />} />
                <Route path='/coordinator/parties' element={<ManagePartiesPage />} />
                <Route path='/coordinator/evaluations' element={<EvaluationsPage />} />
                <Route path='/coordinator/profile' element={<ProfilePage />} />
                <Route path='/coordinator/notification-settings' element={<NotificationSettingsPage />} />
                <Route path='/coordinator/students' element={<StudentsDirectoryPage />} />
                <Route path='/coordinator/companies' element={<CompaniesDirectoryPage />} />
                <Route path='/coordinator/supervisors' element={<SupervisorsDirectoryPage />} />
                <Route path='/coordinator/students/:id' element={<StudentProfilePage />} />
              </Route>

              <Route element={<RoleRoute roles={['PROJECT_SUPERVISOR']} />}>
                <Route path='/project-supervisor/overview' element={<SupervisorOverviewPage kind='project' />} />
                <Route path='/project-supervisor/projects' element={<SupervisedProjectsPage />} />
                <Route path='/project-supervisor/projects/:id' element={<ProjectSupervisorDetailPage />} />
                <Route path='/project-supervisor/profile' element={<ProfilePage />} />
                <Route path='/project-supervisor/notification-settings' element={<NotificationSettingsPage />} />
              </Route>

              <Route element={<RoleRoute roles={['PARTY_SUPERVISOR']} />}>
                <Route path='/party-supervisor/overview' element={<SupervisorOverviewPage kind='party' />} />
                <Route path='/party-supervisor/parties' element={<SupervisorPartiesPage />} />
                <Route path='/party-supervisor/parties/:id' element={<PartySupervisorDetailPage />} />
                <Route path='/party-supervisor/browse' element={<BrowsePartiesPage />} />
                <Route path='/party-supervisor/browse/:id' element={<PartySupervisorDetailPage browse />} />
                <Route path='/party-supervisor/profile' element={<ProfilePage />} />
                <Route path='/party-supervisor/notification-settings' element={<NotificationSettingsPage />} />
              </Route>

              <Route element={<RoleRoute roles={['PARTY_SUPERVISOR', 'PROJECT_SUPERVISOR']} />}>
                <Route path='/supervisor/dashboard' element={<DashboardRouter />} />
                <Route path='/supervisor/profile' element={<ProfilePage />} />
                <Route path='/supervisor/students/:id' element={<StudentProfilePage />} />
              </Route>

              {/* 404 inside app */}
              <Route path='*' element={<NotFoundPage />} />
            </Route>

            {/* Catch-all for logged-out users → login */}
            <Route path='*' element={<Navigate to='/login' replace />} />
          </Routes>
        </BrowserRouter>

        <Toaster
          position='top-right'
          toastOptions={{
            style: {
              background: '#1b2452',
              color: '#dde2f0',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: '12px',
              fontSize: '13px',
            },
            success: {
              iconTheme: { primary: '#10b981', secondary: '#1b2452' },
            },
            error: { iconTheme: { primary: '#f97316', secondary: '#1b2452' } },
          }}
        />
      </AuthProvider>
    </QueryClientProvider>
  );
}
