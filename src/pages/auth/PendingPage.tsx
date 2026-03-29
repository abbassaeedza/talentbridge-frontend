import { Link } from 'react-router-dom'
import { Clock, Layers, LogOut } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { useNavigate } from 'react-router-dom'

export default function PendingPage() {
  const { logout } = useAuth()
  const navigate = useNavigate()
  return (
    <div className="min-h-screen bg-ink-950 mesh-bg flex items-center justify-center p-8">
      <div className="text-center max-w-md">
        <div className="w-20 h-20 rounded-3xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mx-auto mb-6">
          <Clock size={36} className="text-amber-400" />
        </div>
        <h1 className="font-display text-2xl font-bold text-white mb-3">Account Pending Approval</h1>
        <p className="text-ink-400 text-sm leading-relaxed mb-8">
          Your account has been registered and is awaiting coordinator approval.
          You'll receive a notification once your account is activated.
        </p>
        <button onClick={() => { logout(); navigate('/login') }}
          className="btn-ghost text-ink-300 gap-2">
          <LogOut size={16} />Sign out
        </button>
      </div>
    </div>
  )
}
