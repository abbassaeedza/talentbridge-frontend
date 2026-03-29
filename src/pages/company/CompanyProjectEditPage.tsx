import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { projectApi } from '../../api/services'
import { ArrowLeft, Plus, X, Tag, Lightbulb } from 'lucide-react'
import toast from 'react-hot-toast'

const TOOL_SUGGESTIONS = [
  'React', 'TypeScript', 'Python', 'Node.js', 'Java', 'Spring Boot',
  'PostgreSQL', 'MongoDB', 'Docker', 'AWS', 'TensorFlow', 'Vue.js', 'GraphQL',
]

export default function CompanyProjectEditPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const qc = useQueryClient()

  const { data: project, isLoading } = useQuery({
    queryKey: ['project', id],
    queryFn: () => projectApi.getById(id!).then(r => r.data),
    enabled: !!id,
  })

  const [tools, setTools]         = useState<string[]>([])
  const [toolInput, setToolInput] = useState('')
  const [form, setForm] = useState({
    title: '', description: '', scope: '',
    deliverables: '', evaluationCriteria: '',
    deadline: '', internalName: '',
  })
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (project && !ready) {
      const p = project as any
      setForm({
        title:              p.title ?? '',
        description:        p.description ?? '',
        scope:              p.scope ?? '',
        deliverables:       p.deliverables ?? '',
        evaluationCriteria: p.evaluationCriteria ?? '',
        deadline:           p.deadline ? new Date(p.deadline).toISOString().slice(0, 16) : '',
        internalName:       p.internalName ?? '',
      })
      setTools(p.tools ?? [])
      setReady(true)
    }
  }, [project])

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))
  const addTool = (t: string) => {
    const s = t.trim()
    if (s && !tools.includes(s)) setTools(prev => [...prev, s])
    setToolInput('')
  }

  const mutation = useMutation({
    mutationFn: () => projectApi.update(id!, {
      ...form,
      tools,
      deadline: form.deadline ? new Date(form.deadline).toISOString() : undefined,
    }),
    onSuccess: () => {
      toast.success(project?.status === 'ARCHIVED' ? 'Resubmitted for review!' : 'Project updated!')
      qc.invalidateQueries({ queryKey: ['my-projects'] })
      qc.invalidateQueries({ queryKey: ['project', id] })
      navigate(`/company/projects/${id}`)
    },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Update failed'),
  })

  if (isLoading || !ready) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="w-6 h-6 border-2 border-ember-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!project) return null

  const isResubmit = project.status === 'ARCHIVED'

  return (
    <div className="animate-fade-up max-w-2xl">
      {/* Back */}
      <button
        onClick={() => navigate(`/company/projects/${id}`)}
        className="flex items-center gap-2 text-sm text-ink-400 hover:text-ink-100 transition-colors mb-6"
      >
        <ArrowLeft size={15} /> Back to Project
      </button>

      <div className="page-header">
        <h1 className="page-title">{isResubmit ? 'Edit & Resubmit' : 'Edit Project'}</h1>
        <p className="page-subtitle">
          {isResubmit
            ? 'Make your changes and save to resubmit for coordinator review.'
            : 'Update your project details.'
          }
        </p>
      </div>

      {isResubmit && (
        <div className="mb-6 p-4 rounded-2xl bg-amber-500/8 border border-amber-500/20 flex items-start gap-3">
          <Lightbulb size={18} className="text-amber-400 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-ink-300">
            <span className="font-semibold text-amber-300">Heads up:</span> Saving will resubmit this project for coordinator review. It will go back to Pending Review status.
          </p>
        </div>
      )}

      <div className="space-y-5">
        {/* Internal name */}
        <div className="p-4 rounded-2xl bg-ember-500/5 border border-ember-500/20">
          <label className="flex items-center gap-1.5 text-[10px] font-bold text-ember-400 uppercase tracking-widest mb-2">
            <Tag size={10} /> Internal Reference Name (optional)
          </label>
          <input className="input" value={form.internalName}
            onChange={e => set('internalName', e.target.value)}
            placeholder="e.g. Q3-AI-Project, Client-ABC-2026…" />
          <p className="text-[10px] text-ink-500 mt-1.5">Only visible to you.</p>
        </div>

        <div>
          <label className="input-label">Project Title *</label>
          <input className="input" value={form.title} onChange={e => set('title', e.target.value)} required />
        </div>

        <div>
          <label className="input-label">Description *</label>
          <textarea className="textarea" rows={4} value={form.description}
            onChange={e => set('description', e.target.value)} required />
        </div>

        <div>
          <label className="input-label">Scope</label>
          <textarea className="textarea" rows={3} value={form.scope}
            onChange={e => set('scope', e.target.value)} />
        </div>

        <div>
          <label className="input-label">Deliverables</label>
          <textarea className="textarea" rows={3} value={form.deliverables}
            onChange={e => set('deliverables', e.target.value)} />
        </div>

        <div>
          <label className="input-label">Evaluation Criteria</label>
          <textarea className="textarea" rows={3} value={form.evaluationCriteria}
            onChange={e => set('evaluationCriteria', e.target.value)} />
        </div>

        {/* Tools */}
        <div>
          <label className="input-label">Technologies / Tools</label>
          <div className="flex gap-2 mb-2">
            <input className="input flex-1" value={toolInput}
              onChange={e => setToolInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTool(toolInput) } }}
              placeholder="e.g. React, Python…" />
            <button type="button" onClick={() => addTool(toolInput)} className="btn-secondary px-3">
              <Plus size={15} />
            </button>
          </div>
          <div className="flex flex-wrap gap-1.5 mb-3">
            {TOOL_SUGGESTIONS.filter(t => !tools.includes(t)).slice(0, 8).map(t => (
              <button key={t} type="button" onClick={() => addTool(t)}
                className="px-2.5 py-1 rounded-lg bg-ink-800 border border-ink-700/50 text-ink-400 hover:text-ink-200 text-xs transition-colors">
                + {t}
              </button>
            ))}
          </div>
          {tools.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {tools.map(t => (
                <span key={t} className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-ember-500/15 border border-ember-500/30 text-ember-300 text-xs font-medium">
                  {t}
                  <button type="button" onClick={() => setTools(p => p.filter(x => x !== t))}>
                    <X size={11} />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        <div>
          <label className="input-label">Deadline</label>
          <input type="datetime-local" className="input" value={form.deadline}
            onChange={e => set('deadline', e.target.value)} />
        </div>

        <div className="flex gap-3 pt-2">
          <button type="button" onClick={() => navigate(`/company/projects/${id}`)} className="btn-secondary">
            Cancel
          </button>
          <button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending || !form.title || !form.description}
            className="btn-primary flex-1"
          >
            {mutation.isPending
              ? <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Saving…</>
              : isResubmit ? 'Save & Resubmit' : 'Save Changes'
            }
          </button>
        </div>
      </div>
    </div>
  )
}
