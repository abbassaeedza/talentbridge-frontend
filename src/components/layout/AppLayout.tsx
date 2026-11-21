import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Avatar } from '@heroui/react/avatar';
import { Button } from '@heroui/react/button';
import { Chip } from '@heroui/react/chip';
import { Dropdown } from '@heroui/react/dropdown';
import { Popover } from '@heroui/react/popover';
import { formatDistanceToNow } from 'date-fns';
import {
  Award,
  Bell,
  BriefcaseBusiness,
  Building2,
  ChevronDown,
  ClipboardList,
  FolderKanban,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  Menu,
  Moon,
  Send,
  Settings,
  Star,
  Sun,
  UserCheck,
  UserCircle,
  Users,
  X,
} from 'lucide-react';
import clsx from 'clsx';
import { partyApi, userApi } from '../../api/services';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../hooks/useTheme';
import ChatBot from '../chat/ChatBot';
import { Brand } from '../ui/TalentBridgeUI';
import { defaultAvatarUrl } from '../../utils/avatar';

type NavItem = {
  to: string;
  icon: React.ElementType;
  label: string;
  end?: boolean;
};

type NavSection = {
  label?: string;
  items: NavItem[];
};

const ROLE_LABELS: Record<string, string> = {
  STUDENT: 'Student',
  COMPANY: 'Company',
  COORDINATOR: 'Coordinator',
  PARTY_SUPERVISOR: 'Party supervisor',
  PROJECT_SUPERVISOR: 'Project supervisor',
};

const NAV_BY_ROLE: Record<string, NavSection[]> = {
  STUDENT: [
    {
      items: [
        { to: '/student/dashboard', icon: LayoutDashboard, label: 'Overview' },
        { to: '/student/projects', icon: FolderKanban, label: 'Projects', end: true },
        { to: '/student/party', icon: Users, label: 'Party' },
        { to: '/student/supervisors', icon: UserCheck, label: 'Supervisors' },
        { to: '/student/submission', icon: Send, label: 'Submission' },
        { to: '/student/questionnaires', icon: ClipboardList, label: 'Questionnaires' },
        { to: '/student/scorecard', icon: Star, label: 'Scorecard' },
      ],
    },
    { label: 'Account', items: [{ to: '/student/notification-settings', icon: Settings, label: 'Settings' }] },
  ],
  COMPANY: [
    {
      items: [
        { to: '/company/dashboard', icon: LayoutDashboard, label: 'Overview', end: true },
        { to: '/company/projects', icon: FolderKanban, label: 'Projects', end: true },
        { to: '/company/project-supervisors', icon: UserCheck, label: 'Project supervisors', end: true },
      ],
    },
    { label: 'Account', items: [{ to: '/company/notification-settings', icon: Settings, label: 'Settings' }] },
  ],
  COORDINATOR: [
    { items: [{ to: '/coordinator/dashboard', icon: LayoutDashboard, label: 'Overview' }] },
    {
      label: 'People',
      items: [
        { to: '/coordinator/students', icon: GraduationCap, label: 'Students' },
        { to: '/coordinator/companies', icon: Building2, label: 'Companies' },
        { to: '/coordinator/supervisors', icon: UserCheck, label: 'Supervisors' },
      ],
    },
    {
      label: 'Work',
      items: [
        { to: '/coordinator/projects', icon: FolderKanban, label: 'Projects' },
        { to: '/coordinator/parties', icon: ClipboardList, label: 'Parties' },
        { to: '/coordinator/evaluations', icon: Award, label: 'Evaluations' },
      ],
    },
    { label: 'Account', items: [{ to: '/coordinator/notification-settings', icon: Settings, label: 'Settings' }] },
  ],
  PARTY_SUPERVISOR: [
    {
      items: [
        { to: '/party-supervisor/overview', icon: LayoutDashboard, label: 'Overview' },
        { to: '/party-supervisor/parties', icon: Users, label: 'My parties' },
        { to: '/party-supervisor/browse', icon: UserCheck, label: 'Browse parties' },
      ],
    },
    { label: 'Account', items: [{ to: '/party-supervisor/notification-settings', icon: Settings, label: 'Settings' }] },
  ],
  PROJECT_SUPERVISOR: [
    {
      items: [
        { to: '/project-supervisor/overview', icon: LayoutDashboard, label: 'Overview' },
        { to: '/project-supervisor/projects', icon: FolderKanban, label: 'Projects' },
      ],
    },
    { label: 'Account', items: [{ to: '/project-supervisor/notification-settings', icon: Settings, label: 'Settings' }] },
  ],
};

const PROFILE_ROUTE: Record<string, string> = {
  STUDENT: '/student/profile',
  COMPANY: '/company/profile',
  COORDINATOR: '/coordinator/profile',
  PARTY_SUPERVISOR: '/party-supervisor/profile',
  PROJECT_SUPERVISOR: '/project-supervisor/profile',
};

function SidebarLink({ item, close }: { item: NavItem; close: () => void }) {
  const Icon = item.icon;
  return (
    <NavLink
      to={item.to}
      end={item.end}
      onClick={close}
      className={({ isActive }) => clsx(
        'flex min-h-11 items-center gap-3 rounded-md px-3 text-sm font-medium text-muted transition-colors hover:bg-default hover:text-foreground',
        isActive && 'bg-default text-foreground',
      )}
    >
      <Icon size={18} strokeWidth={1.8} aria-hidden='true' />
      <span>{item.label}</span>
    </NavLink>
  );
}

export default function AppLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { theme, toggleTheme } = useTheme();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  const { data: notificationData } = useQuery({
    queryKey: ['notifications', user?.role, user?.id],
    queryFn: () => userApi.getNotifications().then((response) => response.data),
    refetchInterval: 60_000,
  });

  const { data: studentParty } = useQuery({
    queryKey: ['my-party'],
    queryFn: () => partyApi.getMyParty().then((response) => response.data),
    enabled: user?.role === 'STUDENT',
    retry: false,
  });

  const markOne = useMutation({
    mutationFn: (id: string) => userApi.markNotificationRead(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const clearAll = useMutation({
    mutationFn: () => userApi.clearNotifications(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      setNotificationsOpen(false);
    },
  });

  useEffect(() => {
    if (!notificationsOpen || (notificationData?.unreadCount ?? 0) === 0) return;
    userApi.markAllNotificationsRead().finally(() =>
      queryClient.invalidateQueries({ queryKey: ['notifications'] }),
    );
  }, [notificationData?.unreadCount, notificationsOpen, queryClient]);

  if (!user) return null;

  const baseSections = NAV_BY_ROLE[user.role] ?? [];
  const sections = user.role === 'STUDENT' && studentParty?.assignedProjectId
    ? baseSections.map((section, index) => index === 0 ? {
        ...section,
        items: [
          ...section.items.slice(0, 2),
          {
            to: `/student/projects/${studentParty.assignedProjectId}`,
            icon: BriefcaseBusiness,
            label: 'My project',
            end: true,
          },
          ...section.items.slice(2),
        ],
      } : section)
    : baseSections;

  const initials = `${user.firstName?.[0] ?? ''}${user.lastName?.[0] ?? ''}`.toUpperCase();
  const notifications = notificationData?.notifications ?? [];
  const unread = notificationData?.unreadCount ?? 0;
  const profileRoute = PROFILE_ROUTE[user.role] ?? '/';
  const subtitle = user.role === 'COMPANY'
    ? (user as any).companyProfile?.companyName ?? user.email
    : user.role === 'STUDENT'
      ? (user as any).studentProfile?.university ?? user.email
      : user.email;

  const signOut = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className='flex h-dvh overflow-hidden bg-background text-foreground'>
      {sidebarOpen && (
        <Button
          isIconOnly
          variant='ghost'
          type='button'
          data-testid='navigation-overlay'
          aria-label='Close navigation'
          className='fixed inset-0 z-40 bg-black/45 lg:hidden'
          onPress={() => setSidebarOpen(false)}
        />
      )}

      <aside
        aria-label='Primary navigation'
        className={clsx(
          'fixed inset-y-0 left-0 z-50 flex w-[var(--sidebar-width)] flex-col border-r border-border bg-background transition-transform lg:static',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
        )}
      >
        <div className='flex h-16 items-center px-4'>
          <Link to='/' onClick={() => setSidebarOpen(false)}>
            <Brand />
          </Link>
          <Button
            isIconOnly
            size='sm'
            variant='ghost'
            className='ml-auto lg:hidden'
            aria-label='Close navigation'
            onPress={() => setSidebarOpen(false)}
          >
            <X size={18} />
          </Button>
        </div>

        <div className='px-4 pb-4'>
          <Chip size='sm' variant='primary' color='accent' className='px-2 py-0.5'>{ROLE_LABELS[user.role]}</Chip>
        </div>

        <nav className='flex-1 overflow-y-auto px-3 pb-4'>
          {sections.map((section, index) => (
            <section key={section.label ?? index} className={clsx(index > 0 && 'mt-5')}>
              {section.label && (
                <p className='mb-1 px-3 text-[11px] font-semibold uppercase tracking-wider text-muted'>
                  {section.label}
                </p>
              )}
              <div className='space-y-1'>
                {section.items.map((item) => (
                  <SidebarLink key={item.to} item={item} close={() => setSidebarOpen(false)} />
                ))}
              </div>
            </section>
          ))}
        </nav>

        <div className='border-t border-border p-4'>
          <div className='flex items-center gap-3'>
            <Avatar size='sm'>
              <Avatar.Image src={defaultAvatarUrl(user.id || user.email)} alt={`${user.firstName} ${user.lastName}`} />
              <Avatar.Fallback>{initials}</Avatar.Fallback>
            </Avatar>
            <div className='min-w-0'>
              <p className='truncate text-sm font-medium'>{user.firstName} {user.lastName}</p>
              <p className='truncate text-xs text-muted'>{subtitle}</p>
            </div>
          </div>
        </div>
      </aside>

      <div className='flex min-w-0 flex-1 flex-col'>
        <header className='relative z-[60] flex h-16 shrink-0 items-center border-b border-border bg-background px-4 sm:px-6'>
          <Button
            isIconOnly
            size='sm'
            variant='ghost'
            className='lg:hidden'
            aria-label='Open navigation'
            onPress={() => setSidebarOpen(true)}
          >
            <Menu size={19} />
          </Button>

          <div className='ml-auto flex items-center gap-1 sm:gap-2'>
            <Button
              isIconOnly
              size='sm'
              variant='ghost'
              aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              onPress={toggleTheme}
            >
              {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            </Button>

            <Popover.Root
              isOpen={notificationsOpen}
              onOpenChange={(open) => {
                setNotificationsOpen(open);
                if (open) setSidebarOpen(false);
              }}
            >
              <Button
                isIconOnly
                size='sm'
                variant='ghost'
                aria-label='Notifications'
                className='relative'
              >
                <Bell size={18} />
                {unread > 0 && (
                  <span className='absolute right-1 top-1 flex min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[9px] font-bold text-danger-foreground'>
                    {unread > 9 ? '9+' : unread}
                  </span>
                )}
              </Button>
              <Popover.Content
                placement='bottom end'
                className='max-h-[calc(100dvh-5rem)] w-[min(22rem,calc(100vw-1rem))] overflow-hidden p-0'
              >
                <Popover.Dialog className='flex max-h-[calc(100dvh-5rem)] flex-col outline-none'>
                  <div className='flex items-center justify-between border-b border-border px-4 py-3'>
                    <Popover.Heading className='text-sm font-semibold'>Notifications</Popover.Heading>
                    {notifications.length > 0 && (
                      <Button
                        size='sm'
                        variant='ghost'
                        isDisabled={clearAll.isPending}
                        onPress={() => clearAll.mutate()}
                      >
                        Clear all
                      </Button>
                    )}
                  </div>
                  <div className='min-h-0 flex-1 overflow-y-auto'>
                    {notifications.length === 0 ? (
                      <p className='px-4 py-10 text-center text-sm text-muted'>No new notifications.</p>
                    ) : notifications.map((notification: any) => (
                      <Button
                        variant='ghost'
                        key={notification.id}
                        className='h-auto w-full justify-start rounded-none border-b border-separator px-4 py-3 text-left last:border-0'
                        onPress={() => {
                          if (!notification.read) markOne.mutate(notification.id);
                          if (user.role === 'STUDENT' && notification.referenceType === 'QUESTIONNAIRE' && notification.referenceId) {
                            setNotificationsOpen(false);
                            navigate(`/student/questionnaires/${encodeURIComponent(notification.referenceId)}`);
                          }
                        }}
                      >
                        <span className={clsx('mt-1.5 size-1.5 shrink-0 rounded-full', notification.read ? 'bg-transparent' : 'bg-accent')} />
                        <span className='min-w-0'>
                          <span className='block text-sm font-medium'>{notification.title}</span>
                          <span className='mt-0.5 block text-xs leading-5 text-muted'>{notification.message}</span>
                          {notification.createdAt && (
                            <span className='mt-1 block text-[11px] text-muted'>
                              {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}
                            </span>
                          )}
                        </span>
                      </Button>
                    ))}
                  </div>
                </Popover.Dialog>
              </Popover.Content>
            </Popover.Root>

            <Dropdown.Root>
              <Dropdown.Trigger aria-label={`Open ${user.firstName} ${user.lastName} profile menu`} className='flex min-h-11 items-center gap-2 rounded-md px-2 hover:bg-default'>
                <Avatar size='sm'><Avatar.Image src={defaultAvatarUrl(user.id || user.email)} alt={`${user.firstName} ${user.lastName}`} /><Avatar.Fallback>{initials}</Avatar.Fallback></Avatar>
                <span className='hidden text-sm font-medium sm:inline'>{user.firstName}</span>
                <ChevronDown size={14} className='hidden text-muted sm:block' />
              </Dropdown.Trigger>
              <Dropdown.Popover placement='bottom end'>
                <Dropdown.Menu
                  aria-label='Profile actions'
                  onAction={(key) => key === 'profile' ? navigate(profileRoute) : signOut()}
                >
                  <Dropdown.Item id='profile' textValue='Profile'>
                    <UserCircle size={16} />
                    <span>Profile</span>
                  </Dropdown.Item>
                  <Dropdown.Item id='sign-out' textValue='Sign out'>
                    <LogOut size={16} />
                    <span>Sign out</span>
                  </Dropdown.Item>
                </Dropdown.Menu>
              </Dropdown.Popover>
            </Dropdown.Root>
          </div>
        </header>

        <main className='flex-1 overflow-y-auto'>
          <div className='mx-auto w-full max-w-[96rem] px-4 pt-6 pb-20 sm:px-6 sm:pt-8 sm:pb-20 lg:px-8'>
            <Outlet />
          </div>
        </main>
      </div>

      <ChatBot />
    </div>
  );
}
