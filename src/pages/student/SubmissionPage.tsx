import { useEffect, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { partyApi, submissionApi } from '../../api/services'
import { Github, Upload, Send, Save, CheckCircle2, AlertCircle } from 'lucide-react'
import toast from 'react-hot-toast'
import { format } from 'date-fns'
import clsx from 'clsx'

export default function SubmissionPage() {
  const qc = useQueryClient()
  const [repoUrl, setRepoUrl] = useState('')
  const [branch, setBranch] = useState('main')
  const [notes, setNotes] = useState('')
  const [files, setFiles] = useState<File[]>([])

  const { data: party } = useQuery({
    queryKey: ['my-party'],
    queryFn: () => partyApi.getMyParty().then(r => r.data),
    retry: false,
  })

  const { data: submission, isLoading } = useQuery({
    queryKey: ['submission', party?.id],
    queryFn: () => submissionApi.get(party!.id).then(r => r.data),
    enabled: !!party?.id,
    retry: false,
  })

  useEffect(() => {
    if (!submission) return
    if (submission.repoUrl) setRepoUrl(submission.repoUrl)
    if (submission.repoBranch) setBranch(submission.repoBranch)
    if (submission.notes) setNotes(submission.notes)
  }, [submission])

  const saveDraftMutation = useMutation({
    mutationFn: () => {
      const fd = new FormData()
      if (repoUrl) fd.append('repoUrl', repoUrl)
      if (branch) fd.append('branch', branch)
      if (notes) fd.append('notes', notes)
      files.forEach(f => fd.append('documents', f))
      return submissionApi.saveDraft(party!.id, fd)
    },
    onSuccess: () => { toast.success('Draft saved!'); qc.invalidateQueries({ queryKey: ['submission'] }) },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Save failed'),
  })

  const submitMutation = useMutation({
    mutationFn: () => submissionApi.finalSubmit(party!.id),
    onSuccess: () => { toast.success('Submission complete!'); qc.invalidateQueries({ queryKey: ['submission'] }) },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Submission failed'),
  })

  if (!party) return (
    <div className="flex flex-col items-center justify-center py-24 gap-4">
      <AlertCircle size={32} className="text-amber-400" />
      <p className="text-ink-400 text-sm">You need to be in a party with an assigned project to submit.</p>
    </div>
  )

  if (!party.assignedProjectId) return (
    <div className="flex flex-col items-center justify-center py-24 gap-4">
      <AlertCircle size={32} className="text-amber-400" />
      <p className="text-ink-400 text-sm">Your party hasn't been assigned a project yet.</p>
    </div>
  )

  const isSubmitted = submission?.status === 'SUBMITTED' || submission?.status === 'UNDER_EVALUATION' || submission?.status === 'EVALUATED'

  return (
    <div className="animate-fade-up max-w-2xl">
      <div className="page-header">
        <h1 className="page-title">Project Submission</h1>
        <p className="page-subtitle">Submit your team's work for {party.assignedProjectTitle}</p>
      </div>

      {/* Status banner */}
      {submission && (
        <div className={clsx('mb-6 p-4 rounded-2xl flex items-center gap-3 border',
          isSubmitted
            ? 'bg-jade-500/10 border-jade-500/30'
            : 'bg-ink-900 border-ink-700/50'
        )}>
          {isSubmitted
            ? <CheckCircle2 size={20} className="text-jade-400 flex-shrink-0" />
            : <Save size={20} className="text-ink-400 flex-shrink-0" />
          }
          <div>
            <p className="text-sm font-semibold text-white">
              {isSubmitted ? 'Submission received' : 'Draft saved'}
            </p>
            {submission.submittedAt && (
              <p className="text-xs text-ink-400">
                Submitted {format(new Date(submission.submittedAt), 'dd MMM yyyy, HH:mm')}
              </p>
            )}
          </div>
          <span className={clsx('badge ml-auto text-[10px]',
            submission.status === 'DRAFT' && 'badge-pending',
            submission.status === 'SUBMITTED' && 'badge-active',
            submission.status === 'UNDER_EVALUATION' && 'badge-ember',
            submission.status === 'EVALUATED' && 'badge-open',
          )}>{submission.status.replace('_', ' ')}</span>
        </div>
      )}

      <div className="card p-6 space-y-5">
        {/* GitHub repo */}
        <div>
          <label className="input-label flex items-center gap-2">
            <Github size={14} /> GitHub Repository URL *
          </label>
          <input
            className="input"
            value={repoUrl}
            onChange={e => setRepoUrl(e.target.value)}
            placeholder="https://github.com/your-org/your-project"
            disabled={isSubmitted}
          />
        </div>

        <div>
          <label className="input-label">Branch</label>
          <input
            className="input"
            value={branch}
            onChange={e => setBranch(e.target.value)}
            placeholder="main"
            disabled={isSubmitted}
          />
        </div>

        {/* Documents */}
        <div>
          <label className="input-label flex items-center gap-2">
            <Upload size={14} /> Supporting Documents (optional)
          </label>
          <div
            onClick={() => !isSubmitted && document.getElementById('file-input')?.click()}
            className={clsx(
              'border-2 border-dashed rounded-xl p-6 text-center transition-colors',
              isSubmitted ? 'border-ink-700/30 cursor-not-allowed' : 'border-ink-600/50 hover:border-ember-500/40 cursor-pointer'
            )}
          >
            <Upload size={24} className="text-ink-500 mx-auto mb-2" />
            <p className="text-xs text-ink-400">Click to upload PDFs, docs, or any project files</p>
            <input
              id="file-input"
              type="file"
              multiple
              className="hidden"
              onChange={e => setFiles(Array.from(e.target.files || []))}
            />
          </div>
          {files.length > 0 && (
            <div className="mt-2 space-y-1">
              {files.map((f, i) => (
                <p key={i} className="text-xs text-ink-400 flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-jade-500" />
                  {f.name} <span className="text-ink-600">({(f.size / 1024).toFixed(0)}KB)</span>
                </p>
              ))}
            </div>
          )}
          {submission?.documentUrls && submission.documentUrls.length > 0 && (
            <div className="mt-2">
              <p className="text-xs text-ink-500 mb-1">Previously uploaded:</p>
              {submission.documentUrls.map((url, i) => (
                <p key={i} className="text-xs text-ink-400">• {url.split('/').pop()}</p>
              ))}
            </div>
          )}
        </div>

        <div>
          <label className="input-label">Notes for evaluators (optional)</label>
          <textarea
            className="textarea"
            rows={3}
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Any context or notes you want the evaluators to know…"
            disabled={isSubmitted}
          />
        </div>

        {!isSubmitted && (
          <div className="flex gap-3 pt-2">
            <button
              onClick={() => saveDraftMutation.mutate()}
              disabled={saveDraftMutation.isPending}
              className="btn-secondary flex-1"
            >
              <Save size={15} />
              {saveDraftMutation.isPending ? 'Saving…' : 'Save Draft'}
            </button>
            <button
              onClick={() => {
                if (!repoUrl) { toast.error('GitHub URL is required for final submission'); return }
                if (confirm('Are you sure? Final submission cannot be undone.')) submitMutation.mutate()
              }}
              disabled={submitMutation.isPending || !repoUrl}
              className="btn-primary flex-1"
            >
              <Send size={15} />
              {submitMutation.isPending ? 'Submitting…' : 'Final Submit'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
