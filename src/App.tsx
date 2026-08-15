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
import { AlertTriangle, Ghost } from 'lucide-react';
import { Button } from '@heroui/react/button';
import { Spinner } from '@heroui/react/spinner';
import { PublicShell } from './components/ui/TalentBridgeUI';

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
    <PublicShell>
      <div className='mx-auto max-w-md text-center'>
        <div className='mx-auto flex size-12 items-center justify-center rounded-md bg-danger text-danger-foreground'>
          <AlertTriangle size={22} />
        </div>
        <h1 className='mt-5 text-2xl font-semibold tracking-tight'>Account not approved</h1>
        <p className='mt-2 text-sm leading-6 text-muted'>Your account was rejected. Contact the coordinator if you need more information.</p>
        {reason && (
          <div className='mt-5 rounded-lg border border-border bg-surface p-4 text-left'>
            <p className='text-xs font-semibold uppercase tracking-wider text-muted'>Reason</p>
            <p className='mt-1 text-sm'>{reason}</p>
          </div>
        )}
        <p className='mt-5 text-sm text-muted'>Coordinator: <a href='mailto:coordinator@talentbridge.com' className='text-accent hover:underline'>coordinator@talentbridge.com</a></p>
        <Button className='mt-6' variant='secondary' onPress={() => { logout(); navigate('/login'); }}>Sign out</Button>
      </div>
    </PublicShell>
  );
}

// ── 404 screen ───────────────────────────────────────────────────────────────
function NotFoundPage() {
  const navigate = useNavigate();
  return (
    <div className='mx-auto flex min-h-[60vh] max-w-md items-center justify-center py-16 text-center'>
      <div>
        <Ghost size={34} className='mx-auto text-muted' />
        <p className='mt-4 font-mono text-sm text-muted'>404</p>
        <h1 className='mt-2 text-2xl font-semibold'>Page not found</h1>
        <p className='mt-2 text-sm leading-6 text-muted'>The requested TalentBridge page does not exist or is not available to your role.</p>
        <div className='mt-6 flex justify-center gap-2'>
          <Button variant='secondary' onPress={() => navigate(-1)}>Go back</Button>
          <Button variant='primary' onPress={() => navigate('/dashboard')}>Go to overview</Button>
        </div>
      </div>
    </div>
  );
}

// ── Loading screen ────────────────────────────────────────────────────────────
function FullScreenLoader() {
  return (
    <div className='flex min-h-dvh items-center justify-center bg-background'>
      <div className='flex items-center gap-3 text-sm text-muted'><Spinner size='sm' /> Loading TalentBridge</div>
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
              background: 'var(--overlay)',
              color: 'var(--overlay-foreground)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius)',
              fontSize: '13px',
            },
            success: {
              iconTheme: { primary: 'var(--success)', secondary: 'var(--overlay)' },
            },
            error: { iconTheme: { primary: 'var(--danger)', secondary: 'var(--overlay)' } },
          }}
        />
      </AuthProvider>
    </QueryClientProvider>
  );
}
