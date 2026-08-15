import { useEffect, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { evaluationApi, partyApi, submissionApi } from '../../api/services'
import EvaluationReportPanel from '../../components/evaluation/EvaluationReportPanel'
import { Github, Upload, Send, Save, CheckCircle2, AlertCircle } from 'lucide-react'
import toast from 'react-hot-toast'
import { format } from 'date-fns'
import clsx from 'clsx'
import { Button } from '@heroui/react/button'
import { Input } from '@heroui/react/input'
import { Label } from '@heroui/react/label'
import { Spinner } from '@heroui/react/spinner'
import { TextArea } from '@heroui/react/textarea'
import { TextField } from '@heroui/react/textfield'
import { EmptyState, PageHeader, StatusBadge } from '../../components/ui/TalentBridgeUI'

export default function SubmissionPage() {
  const qc = useQueryClient()
  const [repoUrl, setRepoUrl] = useState('')
  const [branch, setBranch] = useState('main')
  const [notes, setNotes] = useState('')
  const [files, setFiles] = useState<File[]>([])

  const { data: party, isLoading: partyLoading } = useQuery({
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

  const { data: evaluationReport } = useQuery({
    queryKey: ['eval-report', submission?.id],
    queryFn: () => evaluationApi.getBySubmission(submission!.id).then(response => response.data),
    enabled: submission?.status === 'EVALUATED',
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

  if (partyLoading) return <div className='flex justify-center py-24'><Spinner /></div>

  if (!party) return (
    <EmptyState icon={AlertCircle} title='No party available' description='Join a party with an assigned project before creating a submission.' />
  )

  if (!party.assignedProjectId) return (
    <EmptyState icon={AlertCircle} title='No assigned project' description='A submission becomes available when your party receives a project.' />
  )

  const isSubmitted = submission?.status === 'SUBMITTED' || submission?.status === 'UNDER_EVALUATION' || submission?.status === 'EVALUATED'

  return (
    <div className=" max-w-2xl">
      <PageHeader title='Project Submission' description={`Submit your team’s work for ${party.assignedProjectTitle}.`} />

      {/* Status banner */}
      {submission && (
        <div className={clsx('mb-6 p-4 rounded-lg flex items-center gap-3 border',
          isSubmitted
            ? 'bg-success border-success'
            : 'bg-surface border-border'
        )}>
          {isSubmitted
            ? <CheckCircle2 size={20} className="text-success flex-shrink-0" />
            : <Save size={20} className="text-muted flex-shrink-0" />
          }
          <div>
            <p className="text-sm font-semibold text-foreground">
              {isSubmitted ? 'Submission received' : 'Draft saved'}
            </p>
            {submission.submittedAt && (
              <p className="text-xs text-muted">
                Submitted {format(new Date(submission.submittedAt), 'dd MMM yyyy, HH:mm')}
              </p>
            )}
          </div>
          <StatusBadge status={submission.status} className='ml-auto' />
        </div>
      )}

      <div className="rounded-lg border border-border bg-surface p-6 space-y-5">
        {/* GitHub repo */}
        <TextField fullWidth isRequired>
          <Label><Github size={14} /> GitHub repository URL</Label>
          <Input
            maxLength={500}
            value={repoUrl}
            onChange={e => setRepoUrl(e.target.value)}
            placeholder="https://github.com/your-org/your-project"
            disabled={isSubmitted}
          />
        </TextField>

        <TextField fullWidth><Label>Branch</Label><Input
            maxLength={100}
            value={branch}
            onChange={e => setBranch(e.target.value)}
            placeholder="main"
            disabled={isSubmitted}
          /></TextField>

        {/* Documents */}
        <div>
          <Label className="flex items-center gap-2">
            <Upload size={14} /> Supporting Documents (optional)
          </Label>
          <div
            onClick={() => !isSubmitted && document.getElementById('file-input')?.click()}
            className={clsx(
              'border-2 border-dashed rounded-lg p-6 text-center transition-colors',
              isSubmitted ? 'border-border cursor-not-allowed' : 'border-border hover:border-accent cursor-pointer'
            )}
          >
            <Upload size={24} className="text-muted mx-auto mb-2" />
            <p className="text-xs text-muted">Click to upload PDFs, docs, or any project files</p>
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
                <p key={i} className="text-xs text-muted flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-success" />
                  {f.name} <span className="text-muted">({(f.size / 1024).toFixed(0)}KB)</span>
                </p>
              ))}
            </div>
          )}
          {submission?.documentUrls && submission.documentUrls.length > 0 && (
            <div className="mt-2">
              <p className="text-xs text-muted mb-1">Previously uploaded:</p>
              {submission.documentUrls.map((url, i) => (
                <p key={i} className="text-xs text-muted">• {url.split('/').pop()}</p>
              ))}
            </div>
          )}
        </div>

        <TextField fullWidth><Label>Notes for evaluators (optional)</Label><TextArea
            maxLength={2000}
            rows={3}
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Any context or notes you want the evaluators to know…"
            disabled={isSubmitted}
          />
          <p className="mt-1 text-right text-[10px] text-muted">{notes.length}/2000</p>
        </TextField>

        {!isSubmitted && (
          <div className="flex gap-3 pt-2">
            <Button variant='secondary' className='flex-1' onPress={() => saveDraftMutation.mutate()} isDisabled={saveDraftMutation.isPending}>
              <Save size={15} />
              {saveDraftMutation.isPending ? 'Saving…' : 'Save Draft'}
            </Button>
            <Button variant='primary' className='flex-1'
              onPress={() => {
                if (!repoUrl) { toast.error('GitHub URL is required for final submission'); return }
                if (confirm('Are you sure? Final submission cannot be undone.')) submitMutation.mutate()
              }}
              isDisabled={submitMutation.isPending || !repoUrl}
            >
              <Send size={15} />
              {submitMutation.isPending ? 'Submitting…' : 'Final Submit'}
            </Button>
          </div>
        )}
      </div>
      {evaluationReport && (
        <div className='rounded-lg border border-border bg-surface mt-5 overflow-hidden'>
          <EvaluationReportPanel report={evaluationReport} />
        </div>
      )}
    </div>
  )
}
