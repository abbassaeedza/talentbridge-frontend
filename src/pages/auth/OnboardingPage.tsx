import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { userApi } from '../../api/services'
import { useAuth } from '../../contexts/AuthContext'
import { Layers, Plus, X } from 'lucide-react'
import toast from 'react-hot-toast'

const SKILL_SUGGESTIONS = ['React', 'TypeScript', 'Python', 'Node.js', 'Java', 'Spring Boot',
  'PostgreSQL', 'MongoDB', 'Docker', 'AWS', 'Machine Learning', 'TensorFlow', 'Vue.js', 'Angular',
  'Figma', 'DevOps', 'Kotlin', 'Swift', 'Flutter', 'GraphQL']

export default function OnboardingPage() {
  const { refreshUser } = useAuth()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [skills, setSkills] = useState<string[]>([])
  const [skillInput, setSkillInput] = useState('')
  const [form, setForm] = useState({
    university: '', yearOfStudy: '', major: '', bio: '', linkedinUrl: '', gpa: ''
  })

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  const addSkill = (s: string) => {
    const trimmed = s.trim()
    if (trimmed && !skills.includes(trimmed)) setSkills(p => [...p, trimmed])
    setSkillInput('')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (skills.length === 0) { toast.error('Add at least one skill'); return }
    setLoading(true)
    try {
      await userApi.completeOnboarding({ ...form, skills, gpa: form.gpa ? parseFloat(form.gpa) : undefined })
      await refreshUser()
      toast.success('Profile complete! Welcome to TalentBridge.')
      navigate('/student/dashboard')
    } catch { toast.error('Failed to save profile') }
    finally { setLoading(false) }
  }

  return (
    <div className="min-h-screen bg-ink-950 mesh-bg flex items-center justify-center p-8">
      <div className="w-full max-w-2xl">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-9 h-9 rounded-xl bg-ember-500 flex items-center justify-center">
            <Layers size={18} className="text-white" />
          </div>
          <span className="font-display font-bold text-white text-xl">TalentBridge</span>
        </div>

        <h1 className="font-display text-3xl font-bold text-white mb-1">Complete your profile</h1>
        <p className="text-ink-400 text-sm mb-8">Help teams and coordinators know who you are.</p>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="input-label">University</label>
              <input className="input" value={form.university} onChange={e => set('university', e.target.value)} placeholder="MIT" />
            </div>
            <div>
              <label className="input-label">Year of Study</label>
              <select className="input" value={form.yearOfStudy} onChange={e => set('yearOfStudy', e.target.value)}>
                <option value="">Select…</option>
                {['1st Year', '2nd Year', '3rd Year', '4th Year', 'Masters', 'PhD'].map(y => (
                  <option key={y}>{y}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="input-label">Major / Field of Study</label>
              <input className="input" value={form.major} onChange={e => set('major', e.target.value)} placeholder="Computer Science" />
            </div>
            <div>
              <label className="input-label">GPA (optional)</label>
              <input type="number" step="0.01" min="0" max="4" className="input" value={form.gpa} onChange={e => set('gpa', e.target.value)} placeholder="3.8" />
            </div>
          </div>

          {/* Skills */}
          <div>
            <label className="input-label">Skills *</label>
            <div className="flex gap-2 mb-2">
              <input
                className="input flex-1"
                value={skillInput}
                onChange={e => setSkillInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addSkill(skillInput) } }}
                placeholder="Type a skill and press Enter…"
              />
              <button type="button" onClick={() => addSkill(skillInput)} className="btn-secondary px-3">
                <Plus size={16} />
              </button>
            </div>
            {/* Suggestions */}
            <div className="flex flex-wrap gap-1.5 mb-3">
              {SKILL_SUGGESTIONS.filter(s => !skills.includes(s)).slice(0, 12).map(s => (
                <button key={s} type="button" onClick={() => addSkill(s)}
                  className="px-2.5 py-1 rounded-lg bg-ink-800 border border-ink-700/50 text-ink-400 hover:text-ink-200 hover:border-ink-500 text-xs transition-colors">
                  + {s}
                </button>
              ))}
            </div>
            {/* Selected */}
            {skills.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {skills.map(s => (
                  <span key={s} className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-ember-500/15 border border-ember-500/30 text-ember-300 text-xs font-medium">
                    {s}
                    <button type="button" onClick={() => setSkills(p => p.filter(x => x !== s))}>
                      <X size={11} />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          <div>
            <label className="input-label">Bio (optional)</label>
            <textarea className="textarea" rows={3} value={form.bio} onChange={e => set('bio', e.target.value)} placeholder="A brief intro about yourself…" />
          </div>

          <div>
            <label className="input-label">LinkedIn URL (optional)</label>
            <input className="input" value={form.linkedinUrl} onChange={e => set('linkedinUrl', e.target.value)} placeholder="https://linkedin.com/in/..." />
          </div>

          <button type="submit" disabled={loading} className="btn-primary w-full !mt-6">
            {loading ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : 'Complete profile & get started'}
          </button>
        </form>
      </div>
    </div>
  )
}
