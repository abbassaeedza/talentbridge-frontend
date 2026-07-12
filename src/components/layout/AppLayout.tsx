import { Outlet, NavLink, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import {
  LayoutDashboard,
  FolderKanban,
  Users,
  ClipboardList,
  Award,
  LogOut,
  Bell,
  Briefcase,
  Send,
  Star,
  UserCheck,
  Layers,
  GraduationCap,
  Building2,
  UserCircle,
  ChevronUp,
  Shield,
  Menu,
  X,
  Sun,
  Moon,
} from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { userApi } from '../../api/services';
import { formatDistanceToNow } from 'date-fns';
import ChatBot from '../chat/ChatBot';
import clsx from 'clsx';

// ── Role badge config ─────────────────────────────────────────────────────────
const ROLE_LABELS: Record<string, string> = {
  STUDENT: 'Student',
  COMPANY: 'Company',
  COORDINATOR: 'Coordinator',
  PARTY_SUPERVISOR: 'Party Supervisor',
  PROJECT_SUPERVISOR: 'Project Supervisor',
};

const ROLE_ICONS: Record<string, React.ElementType> = {
  STUDENT: GraduationCap,
  COMPANY: Building2,
  COORDINATOR: Shield,
  PARTY_SUPERVISOR: UserCheck,
  PROJECT_SUPERVISOR: UserCheck,
};

const ROLE_COLORS: Record<string, string> = {
  STUDENT: 'text-jade-400',
  COMPANY: 'text-blue-400',
  COORDINATOR: 'text-ember-400',
  PARTY_SUPERVISOR: 'text-violet-400',
  PROJECT_SUPERVISOR: 'text-violet-400',
};

// ── Nav items by role ─────────────────────────────────────────────────────────
function NavItem({
  to,
  icon: Icon,
  label,
  end,
  onNavigate,
}: {
  to: string;
  icon: React.ElementType;
  label: string;
  end?: boolean;
  onNavigate?: () => void;
}) {
  return (
    <NavLink
      to={to}
      end={end}
      onClick={onNavigate}
      className={({ isActive }) =>
        clsx('nav-link', isActive && 'nav-link-active')
      }
    >
      <Icon size={16} />
      <span>{label}</span>
    </NavLink>
  );
}

const NAV_BY_ROLE: Record<
  string,
  { to: string; icon: React.ElementType; label: string; end?: boolean }[]
> = {
  STUDENT: [
    { to: '/student/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/student/projects', icon: FolderKanban, label: 'Browse Projects' },
    { to: '/student/party', icon: Users, label: 'My Party' },
    { to: '/student/supervisors', icon: UserCheck, label: 'Supervisors' },
    { to: '/student/submission', icon: Send, label: 'Submission' },
    { to: '/student/scorecard', icon: Star, label: 'Scorecard' },
  ],
  COMPANY: [
    {
      to: '/company/dashboard',
      icon: LayoutDashboard,
      label: 'Dashboard',
      end: true,
    },
    {
      to: '/company/projects',
      icon: FolderKanban,
      label: 'My Projects',
      end: true,
    },
    {
      to: '/company/projects/new',
      icon: Briefcase,
      label: 'Post Project',
      end: true,
    },
  ],
  COORDINATOR: [
    { to: '/coordinator/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/coordinator/users', icon: UserCheck, label: 'Users' },
    { to: '/coordinator/students', icon: GraduationCap, label: 'Students' },
    { to: '/coordinator/companies', icon: Building2, label: 'Companies' },
    { to: '/coordinator/projects', icon: FolderKanban, label: 'Projects' },
    { to: '/coordinator/parties', icon: ClipboardList, label: 'Parties' },
    { to: '/coordinator/evaluations', icon: Award, label: 'Evaluations' },
  ],
  PARTY_SUPERVISOR: [
    { to: '/supervisor/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  ],
  PROJECT_SUPERVISOR: [
    { to: '/supervisor/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  ],
};

// ── Profile route by role ─────────────────────────────────────────────────────
const PROFILE_ROUTE: Record<string, string> = {
  STUDENT: '/student/profile',
  COMPANY: '/company/profile',
  COORDINATOR: '/coordinator/profile',
  PARTY_SUPERVISOR: '/supervisor/profile',
  PROJECT_SUPERVISOR: '/supervisor/profile',
};

export default function AppLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [notifOpen, setNotifOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [theme, setTheme] = useState<'dark' | 'light'>(() =>
    document.documentElement.classList.contains('light') ? 'light' : 'dark',
  );
  const notifRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);

  const { data: notifData } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => userApi.getNotifications().then((r) => r.data),
    refetchInterval: 60_000,
  });

  const markOneMutation = useMutation({
    mutationFn: (id: string) => userApi.markNotificationRead(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const clearMutation = useMutation({
    mutationFn: () => userApi.clearNotifications(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications'] });
      setNotifOpen(false);
    },
  });

  // Mark all read when panel opens
  useEffect(() => {
    if (notifOpen && (notifData?.unreadCount ?? 0) > 0) {
      userApi.markAllNotificationsRead();
      qc.invalidateQueries({ queryKey: ['notifications'] });
    }
  }, [notifOpen]);

  // Close notification panel on outside click
  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(e.target as Node))
        setNotifOpen(false);
    }
    if (notifOpen) document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, [notifOpen]);

  // Close user menu on outside click
  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (
        userMenuRef.current &&
        !userMenuRef.current.contains(e.target as Node)
      )
        setUserMenuOpen(false);
    }
    if (userMenuOpen) document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, [userMenuOpen]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    document.documentElement.classList.toggle('dark', next === 'dark');
    document.documentElement.classList.toggle('light', next === 'light');
    localStorage.setItem('talentbridge-theme', next);
  };

  if (!user) return null;

  const navItems = NAV_BY_ROLE[user.role] || [];
  const initials = `${user.firstName?.[0] ?? ''}${user.lastName?.[0] ?? ''}`;
  const notifications = notifData?.notifications ?? [];
  const unread = notifData?.unreadCount ?? 0;
  const RoleIcon = ROLE_ICONS[user.role] ?? Shield;
  const roleColor = ROLE_COLORS[user.role] ?? 'text-ink-400';
  const profileRoute = PROFILE_ROUTE[user.role] ?? '/dashboard';

  // Contextual subtitle under name
  const userSubtitle = () => {
    const u = user as any;
    if (user.role === 'COMPANY')
      return u.companyProfile?.companyName ?? u.email;
    if (user.role === 'STUDENT') return u.studentProfile?.university ?? u.email;
    return u.email;
  };

  return (
    <div className='flex h-screen bg-ink-950 relative overflow-hidden'>
      {sidebarOpen && (
        <button
          aria-label='Close sidebar overlay'
          className='fixed inset-0 bg-black/50 z-40 lg:hidden'
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ── Sidebar ── */}
      <aside className={clsx(
        'fixed lg:static inset-y-0 left-0 z-50 w-64 flex-shrink-0 flex flex-col bg-ink-950 transform transition-transform duration-200',
        sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
      )}>
        {/* Logo — no border-b */}
        <div className='px-5 py-5'>
          <div className='flex items-center gap-3'>
            <div className='w-8 h-8 rounded-lg bg-ember-500 flex items-center justify-center'>
              <Layers size={16} className='text-white' />
            </div>
            <span className='font-display font-bold text-white text-lg tracking-tight'>
              TalentBridge
            </span>
            <button
              onClick={() => setSidebarOpen(false)}
              className='ml-auto lg:hidden w-10 h-10 rounded-xl flex items-center justify-center text-ink-400 hover:bg-ink-800 hover:text-ink-100'
              aria-label='Close sidebar'
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Role badge — below logo */}
        <div className='px-4 pb-3'>
          <div
            className={clsx(
              'flex items-center gap-2 px-3 py-1.5 rounded-xl bg-ink-800/60 border border-ink-700/40 w-fit',
            )}
          >
            <RoleIcon size={12} className={roleColor} />
            <span className={clsx('text-xs font-semibold', roleColor)}>
              {ROLE_LABELS[user.role]}
            </span>
          </div>
        </div>

        {/* Nav */}
        <nav className='flex-1 px-3 space-y-0.5 overflow-y-auto'>
          {navItems.map((item) => (
            <NavItem
              key={item.to}
              to={item.to}
              icon={item.icon}
              label={item.label}
              end={item.end}
              onNavigate={() => setSidebarOpen(false)}
            />
          ))}
        </nav>

        {/* User footer — clickable, opens menu */}
        <div className='p-3' ref={userMenuRef}>
          {/* User menu popup */}
          {userMenuOpen && (
            <div className='mb-2 rounded-xl bg-ink-800 border border-ink-700/50 overflow-hidden shadow-xl shadow-black/40'>
              <Link
                to={profileRoute}
                onClick={() => setUserMenuOpen(false)}
                className='flex items-center gap-3 px-4 py-3 hover:bg-ink-700/60 transition-colors text-sm text-ink-200 hover:text-white'
              >
                <UserCircle size={15} className='text-ink-400' />
                My Profile
              </Link>
              <button
                onClick={handleLogout}
                className='w-full flex items-center gap-3 px-4 py-3 hover:bg-red-500/10 transition-colors text-sm text-red-400 hover:text-red-300'
              >
                <LogOut size={15} />
                Sign out
              </button>
            </div>
          )}

          <button
            onClick={() => setUserMenuOpen((v) => !v)}
            className='w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-ink-800/60 transition-colors'
          >
            <div className='w-8 h-8 rounded-lg bg-ink-700 border border-ink-600/50 flex items-center justify-center flex-shrink-0'>
              <span className='text-xs font-bold text-ink-200'>{initials}</span>
            </div>
            <div className='flex-1 min-w-0 text-left'>
              <p className='text-xs font-semibold text-ink-100 truncate'>
                {user.firstName} {user.lastName}
              </p>
              <p className='text-[10px] text-ink-500 truncate'>
                {userSubtitle()}
              </p>
            </div>
            <ChevronUp
              size={14}
              className={clsx(
                'text-ink-500 transition-transform flex-shrink-0',
                !userMenuOpen && 'rotate-180',
              )}
            />
          </button>
        </div>
      </aside>

      {/* ── Main ── */}
      <div className='flex-1 flex flex-col overflow-hidden border-l border-ink-800/60 min-w-0'>
        {/* Top bar */}
        <header className='h-14 flex items-center justify-between px-4 sm:px-6 border-b border-ink-800/60 bg-ink-950 flex-shrink-0 relative'>
          <button
            onClick={() => setSidebarOpen(true)}
            className='lg:hidden w-10 h-10 rounded-xl flex items-center justify-center text-ink-400 hover:text-ink-100 hover:bg-ink-800 transition-colors'
            aria-label='Open sidebar'
          >
            <Menu size={19} />
          </button>
          <div className='flex items-center gap-2'>
            <button
              onClick={toggleTheme}
              className='w-9 h-9 rounded-xl flex items-center justify-center text-ink-400 hover:text-ink-100 hover:bg-ink-800 transition-all'
              aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
            </button>

            {/* Notification bell */}
            <div ref={notifRef} className='relative'>
              <button
                onClick={() => setNotifOpen((v) => !v)}
                className='relative w-9 h-9 rounded-xl flex items-center justify-center text-ink-400 hover:text-ink-100 hover:bg-ink-800 transition-all'
              >
                <Bell size={17} />
                {unread > 0 && (
                  <span className='absolute -top-0.5 -right-0.5 w-4 h-4 bg-ember-500 rounded-full flex items-center justify-center text-white text-[10px] font-bold'>
                    {unread > 9 ? '9+' : unread}
                  </span>
                )}
              </button>

              {notifOpen && (
                <div className='absolute right-0 top-11 w-80 z-[999] rounded-2xl border border-ink-700/50 bg-ink-900 shadow-2xl shadow-black/60 overflow-hidden'>
                  <div className='px-4 py-3 border-b border-ink-700/50 flex items-center justify-between'>
                    <span className='text-sm font-semibold text-white'>
                      Notifications
                    </span>
                    {notifications.length > 0 && (
                      <button
                        onClick={() => clearMutation.mutate()}
                        disabled={clearMutation.isPending}
                        className='text-xs text-red-400 hover:text-red-300 transition-colors'
                      >
                        Clear all
                      </button>
                    )}
                  </div>
                  <div className='max-h-80 overflow-y-auto'>
                    {notifications.length === 0 ? (
                      <p className='px-4 py-8 text-center text-ink-400 text-sm'>
                        All caught up 🎉
                      </p>
                    ) : (
                      notifications.map((n: any) => (
                        <div
                          key={n.id}
                          onClick={() =>
                            !n.read && markOneMutation.mutate(n.id)
                          }
                          className={clsx(
                            'px-4 py-3 border-b border-ink-800/50 last:border-0 transition-colors',
                            !n.read &&
                              'bg-ember-500/5 cursor-pointer hover:bg-ember-500/10',
                          )}
                        >
                          <div className='flex items-start gap-2'>
                            {!n.read && (
                              <div className='w-1.5 h-1.5 rounded-full bg-ember-500 mt-1.5 flex-shrink-0' />
                            )}
                            <div className={clsx('flex-1', n.read && 'pl-3.5')}>
                              <p className='text-xs font-semibold text-ink-100'>
                                {n.title}
                              </p>
                              <p className='text-xs text-ink-400 mt-0.5'>
                                {n.message}
                              </p>
                              {n.createdAt && (
                                <p className='text-[10px] text-ink-600 mt-1'>
                                  {formatDistanceToNow(new Date(n.createdAt), {
                                    addSuffix: true,
                                  })}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Top-right user button */}
            <div className='w-px h-5 bg-ink-700/60' />
            <button
              onClick={() => navigate(profileRoute)}
              className='flex items-center gap-2 px-3 py-1.5 rounded-xl hover:bg-ink-800 transition-colors'
            >
              <div className='w-6 h-6 rounded-md bg-ink-700 flex items-center justify-center text-xs font-bold text-ink-200'>
                {initials}
              </div>
              <span className='text-sm text-ink-300 font-medium'>
                {user.firstName}
              </span>
            </button>
          </div>
        </header>

        {/* Page content */}
        <main className='flex-1 overflow-y-auto'>
          <div className='max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8'>
            <Outlet />
          </div>
        </main>
      </div>

      <ChatBot />
    </div>
  );
}
