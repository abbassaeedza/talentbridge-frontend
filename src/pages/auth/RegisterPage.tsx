import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { authApi } from '../../api/services'
import { Layers, GraduationCap, Building2, UserCog, ArrowRight } from 'lucide-react'
import toast from 'react-hot-toast'
import type { UserRole } from '../../types'
import clsx from 'clsx'

const ROLES: { value: UserRole; label: string; desc: string; icon: React.ElementType }[] = [
  { value: 'STUDENT', label: 'Student', desc: 'Join teams & work on real projects', icon: GraduationCap },
  { value: 'COMPANY', label: 'Company', desc: 'Post projects for student teams', icon: Building2 },
  { value: 'PARTY_SUPERVISOR', label: 'Party Supervisor', desc: 'University mentor for student parties', icon: UserCog },
]

export default function RegisterPage() {
  const navigate = useNavigate()
  const [role, setRole] = useState<UserRole>('STUDENT')
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    firstName: '', lastName: '', email: '', password: '',
    phoneNumber: '', companyName: '', industry: '', companyDescription: '', website: '', registrationNumber: ''
  })

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (form.password.length < 8) { toast.error('Password must be at least 8 characters'); return }
    setLoading(true)
    try {
      const { data } = await authApi.register({ ...form, role })
      localStorage.setItem('accessToken', data.accessToken)
      localStorage.setItem('refreshToken', data.refreshToken)
      if (data.user.status === 'PENDING') {
        navigate('/pending')
      } else if (role === 'STUDENT') {
        navigate('/onboarding')
      } else {
        navigate('/dashboard')
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Registration failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-ink-950 mesh-bg flex items-center justify-center p-8">
      <div className="w-full max-w-xl">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-9 h-9 rounded-xl bg-ember-500 flex items-center justify-center">
            <Layers size={18} className="text-white" />
          </div>
          <span className="font-display font-bold text-white text-xl">TalentBridge</span>
        </div>

        <h1 className="font-display text-3xl font-bold text-white mb-1">Create your account</h1>
        <p className="text-ink-400 text-sm mb-8">
          Already have one? <Link to="/login" className="text-ember-400 hover:text-ember-300">Sign in</Link>
        </p>

        {/* Role selector */}
        <div className="mb-6">
          <label className="input-label mb-3">I am a…</label>
          <div className="grid grid-cols-3 gap-3">
            {ROLES.map(r => (
              <button key={r.value} type="button" onClick={() => setRole(r.value)}
                className={clsx(
                  'flex flex-col items-center gap-2 p-4 rounded-2xl border text-center transition-all duration-200',
                  role === r.value
                    ? 'bg-ember-500/10 border-ember-500/50 text-ember-400'
                    : 'bg-ink-900 border-ink-700/50 text-ink-400 hover:border-ink-600'
                )}
              >
                <r.icon size={20} />
                <span className="text-xs font-semibold">{r.label}</span>
              </button>
            ))}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="input-label">First name</label>
              <input className="input" value={form.firstName} onChange={e => set('firstName', e.target.value)} placeholder="Jane" required />
            </div>
            <div>
              <label className="input-label">Last name</label>
              <input className="input" value={form.lastName} onChange={e => set('lastName', e.target.value)} placeholder="Smith" required />
            </div>
          </div>

          <div>
            <label className="input-label">Email</label>
            <input type="email" className="input" value={form.email} onChange={e => set('email', e.target.value)} placeholder="you@example.com" required />
          </div>

          <div>
            <label className="input-label">Password</label>
            <input type="password" className="input" value={form.password} onChange={e => set('password', e.target.value)} placeholder="Minimum 8 characters" required />
          </div>

          <div>
            <label className="input-label">Phone (optional)</label>
            <input className="input" value={form.phoneNumber} onChange={e => set('phoneNumber', e.target.value)} placeholder="+1 234 567 8900" />
          </div>

          {/* Company-only fields */}
          {role === 'COMPANY' && (
            <div className="space-y-4 pt-2 border-t border-ink-800">
              <p className="text-xs font-semibold text-ink-300 uppercase tracking-wider">Company Details</p>
              <div>
                <label className="input-label">Company name *</label>
                <input className="input" value={form.companyName} onChange={e => set('companyName', e.target.value)} placeholder="Acme Corp" required />
              </div>
              <div>
                <label className="input-label">Industry</label>
                <input className="input" value={form.industry} onChange={e => set('industry', e.target.value)} placeholder="Software / FinTech / Healthcare…" />
              </div>
              <div>
                <label className="input-label">Company website</label>
                <input className="input" value={form.website} onChange={e => set('website', e.target.value)} placeholder="https://example.com" />
              </div>
            </div>
          )}

          <button type="submit" disabled={loading} className="btn-primary w-full !mt-6">
            {loading ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : (
              <><span>Create account</span><ArrowRight size={16} /></>
            )}
          </button>
        </form>
      </div>
    </div>
  )
}
