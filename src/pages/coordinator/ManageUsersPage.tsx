import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { userApi } from '../../api/services'
import { CheckCircle, XCircle, UserCheck } from 'lucide-react'
import toast from 'react-hot-toast'
import { format } from 'date-fns'
import clsx from 'clsx'

export default function ManageUsersPage() {
  const qc = useQueryClient()
  const [page, setPage] = useState(0)
  const [rejectReason, setRejectReason] = useState<Record<string, string>>({})

  const { data, isLoading } = useQuery({
    queryKey: ['pending-users', page],
    queryFn: () => userApi.getPending(page, 20).then(r => r.data)
  })

  const approveMutation = useMutation({
    mutationFn: (id: string) => userApi.approve(id),
    onSuccess: () => { toast.success('User approved'); qc.invalidateQueries({ queryKey: ['pending-users'] }) },
    onError: () => toast.error('Failed to approve'),
  })

  const rejectMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => userApi.reject(id, reason),
    onSuccess: () => { toast.success('User rejected'); qc.invalidateQueries({ queryKey: ['pending-users'] }) },
    onError: () => toast.error('Failed to reject'),
  })

  const roleColor: Record<string, string> = {
    STUDENT: 'badge-forming',
    COMPANY: 'badge-ember',
    PARTY_SUPERVISOR: 'badge-active',
    PROJECT_SUPERVISOR: 'badge-assigned',
    COORDINATOR: 'badge-pending',
  }

  return (
    <div className="animate-fade-up">
      <div className="page-header">
        <h1 className="page-title">Manage Users</h1>
        <p className="page-subtitle">
          {data?.totalElements ?? 0} pending approval{data?.totalElements !== 1 ? 's' : ''}
        </p>
      </div>

      <div className="card overflow-hidden">
        {isLoading ? (
          <div className="p-12 flex justify-center">
            <div className="w-5 h-5 border-2 border-ember-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : !data || data.content.length === 0 ? (
          <div className="p-16 text-center">
            <UserCheck size={32} className="text-ink-600 mx-auto mb-3" />
            <p className="text-ink-400 text-sm">No pending approvals. All caught up!</p>
          </div>
        ) : (
          <div className="divide-y divide-ink-800/50">
            {data.content.map(u => (
              <div key={u.id} className="px-6 py-4">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-xl bg-ink-700 border border-ink-600/50 flex items-center justify-center font-bold text-ink-200 flex-shrink-0">
                    {u.firstName[0]}{u.lastName[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-semibold text-white text-sm">{u.firstName} {u.lastName}</p>
                      <span className={clsx('badge text-[10px]', roleColor[u.role] || 'badge-pending')}>
                        {u.role.replace('_', ' ')}
                      </span>
                    </div>
                    <p className="text-xs text-ink-400">{u.email}</p>
                    {u.companyProfile && (
                      <p className="text-xs text-ink-500 mt-1">
                        Company: <span className="text-ink-300">{u.companyProfile.companyName}</span>
                        {u.companyProfile.industry && ` · ${u.companyProfile.industry}`}
                      </p>
                    )}
                    <p className="text-xs text-ink-600 mt-1">
                      Registered {format(new Date(u.createdAt ?? Date.now()), 'dd MMM yyyy')}
                    </p>

                    {/* Reject reason input */}
                    <div className="mt-3 flex flex-col sm:flex-row gap-2">
                      <input
                        className="input text-xs py-1.5 flex-1 max-w-xs"
                        placeholder="Rejection reason (optional)…"
                        value={rejectReason[u.id] ?? ''}
                        onChange={e => setRejectReason(r => ({ ...r, [u.id]: e.target.value }))}
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => approveMutation.mutate(u.id)}
                          disabled={approveMutation.isPending}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-jade-500/15 border border-jade-500/30 text-jade-400 hover:bg-jade-500/25 text-xs font-medium transition-colors"
                        >
                          <CheckCircle size={13} /> Approve
                        </button>
                        <button
                          onClick={() => rejectMutation.mutate({ id: u.id, reason: rejectReason[u.id] })}
                          disabled={rejectMutation.isPending}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/15 border border-red-500/30 text-red-400 hover:bg-red-500/25 text-xs font-medium transition-colors"
                        >
                          <XCircle size={13} /> Reject
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Pagination */}
      {data && data.totalPages > 1 && (
        <div className="flex justify-center gap-2 mt-6">
          <button onClick={() => setPage(p => p - 1)} disabled={data.first} className="btn-secondary text-xs px-4 py-2">Previous</button>
          <span className="px-4 py-2 text-xs text-ink-400">Page {page + 1} of {data.totalPages}</span>
          <button onClick={() => setPage(p => p + 1)} disabled={data.last} className="btn-secondary text-xs px-4 py-2">Next</button>
        </div>
      )}
    </div>
  )
}
