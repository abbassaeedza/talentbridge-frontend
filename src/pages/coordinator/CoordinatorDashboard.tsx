import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { userApi, projectApi, partyApi, coordinatorApi } from '../../api/services'
import { Users, FolderKanban, UserCheck, Award, ArrowRight, Clock } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import DeadlineCountdown from '../../components/shared/DeadlineCountdown'
import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
} from 'recharts'

const CHART_COLORS = ['#f97316', '#10b981', '#8b5cf6', '#38bdf8', '#f59e0b', '#ef4444']

function chartRows(values?: Record<string, number>) {
  return Object.entries(values ?? {})
    .filter(([, value]) => value > 0)
    .map(([name, value]) => ({ name: name.replace(/_/g, ' '), value }))
}

export default function CoordinatorDashboard() {
  const { user } = useAuth()

  const { data: pending } = useQuery({
    queryKey: ['pending-users'],
    queryFn: () => userApi.getPending(0, 100).then(r => r.data)
  })
  const { data: projects } = useQuery({
    queryKey: ['all-projects'],
    queryFn: () => projectApi.getAllUnpaged()
  })
  const { data: parties } = useQuery({
    queryKey: ['all-parties'],
    queryFn: () => partyApi.getAll().then(r => r.data)
  })
  const { data: analytics } = useQuery({
    queryKey: ['coordinator-analytics'],
    queryFn: () => coordinatorApi.getAnalytics().then(r => r.data)
  })

  const pendingProjects = projects?.filter(p => p.status === 'PENDING_REVIEW').length ?? 0
  const assignedParties = parties?.filter(p => p.assignedProjectId).length ?? 0
  const totalParties = parties?.length ?? 0
  const assignmentPercent = totalParties > 0 ? Math.round((assignedParties / totalParties) * 100) : 0
  const upcomingDeadlines = (projects ?? [])
    .filter(p => p.deadline
      && new Date(p.deadline).getTime() > Date.now()
      && (p.status === 'OPEN' || p.status === 'ASSIGNED'))
    .sort((a, b) => new Date(a.deadline!).getTime() - new Date(b.deadline!).getTime())
    .slice(0, 5)
  const [nextDeadline, ...laterDeadlines] = upcomingDeadlines

  const stats = [
    { label: 'Pending approvals', value: pending?.totalElements ?? 0, icon: UserCheck, color: 'bg-amber-500/15 text-amber-400', to: '/coordinator/students' },
    { label: 'Projects to review', value: pendingProjects, icon: FolderKanban, color: 'bg-ember-500/15 text-ember-400', to: '/coordinator/projects' },
    { label: 'Total parties', value: parties?.length ?? 0, icon: Users, color: 'bg-violet-500/15 text-violet-400', to: '/coordinator/parties' },
    { label: 'Assigned parties', value: assignedParties, icon: Award, color: 'bg-jade-500/15 text-jade-400', to: '/coordinator/evaluations' },
  ]

  const projectRows = chartRows(analytics?.projectsByStatus)
  const userRows = chartRows(analytics?.usersByRole)
  const submissionRows = chartRows(analytics?.submissionsByStatus)

  return (
    <div className="animate-fade-up">
      <div className="page-header">
        <h1 className="page-title">Coordinator Dashboard</h1>
        <p className="page-subtitle">Welcome back, {user?.firstName}. Here's today's overview.</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {stats.map(s => (
          <Link key={s.label} to={s.to} className="stat-card hover:border-ink-600/60 transition-colors">
            <div className={`stat-icon ${s.color}`}><s.icon size={20} /></div>
            <div>
              <p className="text-2xl font-display font-bold text-white">{s.value}</p>
              <p className="text-xs text-ink-400 mt-0.5">{s.label}</p>
            </div>
          </Link>
        ))}
      </div>

      <section className="mb-6">
        <h2 className="mb-4 flex items-center gap-2 font-display text-lg font-semibold text-white">
          <Clock size={18} className="text-ember-400" /> Upcoming Deadlines
        </h2>
        {nextDeadline ? (
          <>
            <DeadlineCountdown
              deadline={nextDeadline.deadline}
              label="Nearest project deadline"
              title={nextDeadline.title}
              hero
            />
            {laterDeadlines.length > 0 && (
              <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {laterDeadlines.map(project => (
                  <div key={project.id} className="card min-w-0 p-4">
                    <p className="truncate text-sm font-semibold text-ink-100">{project.title}</p>
                    <p className="mb-3 mt-1 truncate text-xs text-ink-500">{project.companyName}</p>
                    <DeadlineCountdown deadline={project.deadline} compact />
                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
          <div className="card p-5">
            <p className="text-sm text-ink-400">No active project deadlines set.</p>
          </div>
        )}
      </section>

      <div className="mb-6">
        <div className="card p-5">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="font-display font-semibold text-white">Assignment Progress</p>
              <p className="text-xs text-ink-400">{assignedParties} of {totalParties} parties assigned</p>
            </div>
            <span className="font-display text-2xl font-bold text-white">{assignmentPercent}%</span>
          </div>
          <div className="h-2 rounded-full bg-ink-800 overflow-hidden">
            <div className="h-full rounded-full bg-gradient-to-r from-jade-500 to-ember-400" style={{ width: `${assignmentPercent}%` }} />
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6 mb-6">
        <div className="card p-5">
          <p className="font-display font-semibold text-white mb-4">Projects by Status</p>
          <div className="h-56">
            {projectRows.length === 0 ? (
              <p className="text-sm text-ink-400 py-16 text-center">No project data yet.</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={projectRows} dataKey="value" nameKey="name" outerRadius={82} innerRadius={46}>
                    {projectRows.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="card p-5">
          <p className="font-display font-semibold text-white mb-4">Users by Role</p>
          <div className="h-56">
            {userRows.length === 0 ? (
              <p className="text-sm text-ink-400 py-16 text-center">No user data yet.</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={userRows}>
                  <XAxis dataKey="name" tick={{ fill: '#8b95b7', fontSize: 10 }} interval={0} angle={-20} textAnchor="end" height={55} />
                  <Tooltip />
                  <Bar dataKey="value" fill="#f97316" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="card p-5">
          <p className="font-display font-semibold text-white mb-4">Submissions</p>
          <div className="h-56">
            {submissionRows.length === 0 ? (
              <p className="text-sm text-ink-400 py-16 text-center">No submission data yet.</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={submissionRows}>
                  <XAxis dataKey="name" tick={{ fill: '#8b95b7', fontSize: 10 }} interval={0} angle={-20} textAnchor="end" height={55} />
                  <Tooltip />
                  <Bar dataKey="value" fill="#10b981" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Pending users */}
        <div className="card overflow-hidden">
          <div className="px-5 py-4 border-b border-ink-700/50 flex items-center justify-between">
            <h2 className="font-display font-semibold text-white">Pending Approvals</h2>
            <Link to="/coordinator/students" className="text-xs text-ember-400 flex items-center gap-1">View all <ArrowRight size={12} /></Link>
          </div>
          {!pending || pending.content.length === 0 ? (
            <p className="px-5 py-6 text-sm text-ink-400">No pending approvals.</p>
          ) : (
            <div className="divide-y divide-ink-800/50">
              {pending.content.slice(0, 5).map(u => (
                <div key={u.id} className="px-5 py-3 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-ink-700 flex items-center justify-center text-xs font-bold text-ink-200">
                    {u.firstName[0]}{u.lastName[0]}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-ink-100">{u.firstName} {u.lastName}</p>
                    <p className="text-xs text-ink-500">{u.role} · {u.email}</p>
                  </div>
                  <span className="badge badge-pending text-[10px]">PENDING</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent projects */}
        <div className="card overflow-hidden">
          <div className="px-5 py-4 border-b border-ink-700/50 flex items-center justify-between">
            <h2 className="font-display font-semibold text-white">Recent Projects</h2>
            <Link to="/coordinator/projects" className="text-xs text-ember-400 flex items-center gap-1">View all <ArrowRight size={12} /></Link>
          </div>
          {!projects || projects.length === 0 ? (
            <p className="px-5 py-6 text-sm text-ink-400">No projects yet.</p>
          ) : (
            <div className="divide-y divide-ink-800/50">
              {projects.slice(0, 5).map(p => (
                <div key={p.id} className="px-5 py-3 flex items-center gap-3">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-ink-100 truncate">{p.title}</p>
                    <p className="text-xs text-ink-500">{p.companyName}</p>
                  </div>
                  <span className={`badge text-[10px] ${
                    p.status === 'OPEN' ? 'badge-open' :
                    p.status === 'PENDING_REVIEW' ? 'badge-pending' :
                    p.status === 'ASSIGNED' ? 'badge-assigned' : 'bg-ink-700/50 text-ink-400 border-ink-600/30'
                  }`}>{p.status.replace('_',' ')}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
