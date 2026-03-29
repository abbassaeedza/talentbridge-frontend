import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useNavigate,
} from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './contexts/AuthContext';
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

// Company pages
import CompanyDashboard from './pages/company/CompanyDashboard';
import CompanyProjectsPage from './pages/company/CompanyProjectsPage';
import CompanyProjectViewPage from './pages/company/CompanyProjectViewPage';
import CompanyProjectEditPage from './pages/company/CompanyProjectEditPage';
import CreateProjectPage from './pages/company/CreateProjectPage';

// Coordinator pages
import CoordinatorDashboard from './pages/coordinator/CoordinatorDashboard';
import ManageUsersPage from './pages/coordinator/ManageUsersPage';
import ManageProjectsPage from './pages/coordinator/ManageProjectsPage';
import ManagePartiesPage from './pages/coordinator/ManagePartiesPage';
import EvaluationsPage from './pages/coordinator/EvaluationsPage';

// Supervisor pages
import SupervisorDashboard from './pages/supervisor/SupervisorDashboard';

// Shared
import ProfilePage from './pages/shared/ProfilePage';

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
  children,
}: {
  roles: UserRole[];
  children: React.ReactNode;
}) {
  const { user } = useAuth();
  if (!user || !roles.includes(user.role)) return <NotFoundPage />;
  return <>{children}</>;
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
    case 'PROJECT_SUPERVISOR':
      return <Navigate to='/supervisor/dashboard' replace />;
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
              {/* ── Student ── */}
              <Route
                path='/student/dashboard'
                element={
                  <RoleRoute roles={['STUDENT']}>
                    <StudentDashboard />
                  </RoleRoute>
                }
              />
              <Route
                path='/student/projects'
                element={
                  <RoleRoute roles={['STUDENT']}>
                    <ProjectsListPage />
                  </RoleRoute>
                }
              />
              <Route
                path='/student/projects/:id'
                element={
                  <RoleRoute roles={['STUDENT']}>
                    <ProjectDetailPage />
                  </RoleRoute>
                }
              />
              <Route
                path='/student/party'
                element={
                  <RoleRoute roles={['STUDENT']}>
                    <MyPartyPage />
                  </RoleRoute>
                }
              />
              <Route
                path='/student/submission'
                element={
                  <RoleRoute roles={['STUDENT']}>
                    <SubmissionPage />
                  </RoleRoute>
                }
              />
              <Route
                path='/student/scorecard'
                element={
                  <RoleRoute roles={['STUDENT']}>
                    <ScorecardPage />
                  </RoleRoute>
                }
              />
              <Route
                path='/student/profile'
                element={
                  <RoleRoute roles={['STUDENT']}>
                    <ProfilePage />
                  </RoleRoute>
                }
              />

              {/* ── Company ── */}
              <Route
                path='/company/dashboard'
                element={
                  <RoleRoute roles={['COMPANY']}>
                    <CompanyDashboard />
                  </RoleRoute>
                }
              />
              <Route
                path='/company/projects'
                element={
                  <RoleRoute roles={['COMPANY']}>
                    <CompanyProjectsPage />
                  </RoleRoute>
                }
              />
              <Route
                path='/company/projects/new'
                element={
                  <RoleRoute roles={['COMPANY']}>
                    <CreateProjectPage />
                  </RoleRoute>
                }
              />
              <Route
                path='/company/projects/:id'
                element={
                  <RoleRoute roles={['COMPANY']}>
                    <CompanyProjectViewPage />
                  </RoleRoute>
                }
              />
              <Route
                path='/company/projects/:id/edit'
                element={
                  <RoleRoute roles={['COMPANY']}>
                    <CompanyProjectEditPage />
                  </RoleRoute>
                }
              />
              <Route
                path='/company/profile'
                element={
                  <RoleRoute roles={['COMPANY']}>
                    <ProfilePage />
                  </RoleRoute>
                }
              />

              {/* ── Coordinator ── */}
              <Route
                path='/coordinator/dashboard'
                element={
                  <RoleRoute roles={['COORDINATOR']}>
                    <CoordinatorDashboard />
                  </RoleRoute>
                }
              />
              <Route
                path='/coordinator/users'
                element={
                  <RoleRoute roles={['COORDINATOR']}>
                    <ManageUsersPage />
                  </RoleRoute>
                }
              />
              <Route
                path='/coordinator/projects'
                element={
                  <RoleRoute roles={['COORDINATOR']}>
                    <ManageProjectsPage />
                  </RoleRoute>
                }
              />
              <Route
                path='/coordinator/parties'
                element={
                  <RoleRoute roles={['COORDINATOR']}>
                    <ManagePartiesPage />
                  </RoleRoute>
                }
              />
              <Route
                path='/coordinator/evaluations'
                element={
                  <RoleRoute roles={['COORDINATOR']}>
                    <EvaluationsPage />
                  </RoleRoute>
                }
              />
              <Route
                path='/coordinator/profile'
                element={
                  <RoleRoute roles={['COORDINATOR']}>
                    <ProfilePage />
                  </RoleRoute>
                }
              />

              {/* Coordinator — new Stage 2 pages (stub — built in Stage 4) */}
              <Route
                path='/coordinator/students'
                element={
                  <RoleRoute roles={['COORDINATOR']}>
                    <ManageUsersPage />
                  </RoleRoute>
                }
              />
              <Route
                path='/coordinator/companies'
                element={
                  <RoleRoute roles={['COORDINATOR']}>
                    <ManageUsersPage />
                  </RoleRoute>
                }
              />

              {/* ── Supervisor ── */}
              <Route
                path='/supervisor/dashboard'
                element={
                  <RoleRoute roles={['PARTY_SUPERVISOR', 'PROJECT_SUPERVISOR']}>
                    <SupervisorDashboard />
                  </RoleRoute>
                }
              />
              <Route
                path='/supervisor/profile'
                element={
                  <RoleRoute roles={['PARTY_SUPERVISOR', 'PROJECT_SUPERVISOR']}>
                    <ProfilePage />
                  </RoleRoute>
                }
              />

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
