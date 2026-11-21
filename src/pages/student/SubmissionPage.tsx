import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { evaluationApi, partyApi, submissionApi } from '../../api/services';
import EvaluationReportPanel from '../../components/evaluation/EvaluationReportPanel';
import { Github, Send, Save, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { Button } from '@heroui/react/button';
import { Input } from '@heroui/react/input';
import { Label } from '@heroui/react/label';
import { TextArea } from '@heroui/react/textarea';
import { TextField } from '@heroui/react/textfield';
import { EmptyState, PageHeader, StatusBadge } from '../../components/ui/TalentBridgeUI';
import QuerySection from '../../components/ui/QuerySection';
import { useAuth } from '../../contexts/AuthContext';
import { useSessionRequests } from '../../hooks/useSessionRequests';
import { canFinalizeSubmission, matchesSavedDraft, submissionFields, type SubmissionFields } from '../../utils/submissionDraft';
import { formatDateTime } from '../../utils/dateTime';
import type { Party, Submission } from '../../types';
import { QuestionnaireList } from './QuestionnairesPage';

export default function SubmissionPage() {
  const { user } = useAuth();
  const session = useSessionRequests();
  const partyQuery = useQuery({
    queryKey: ['my-party', user?.role, user?.id, session.owner, 'submission'],
    queryFn: () => partyApi.getMyParty().then(r => r.data).catch(error => {
      if (isAxiosError(error) && error.response?.status === 404) return null;
      throw error;
    }), retry: false,
  });
  const party = partyQuery.data;
  return <div className='max-w-3xl space-y-6'>
    <QuerySection query={partyQuery} label='Submission party'>
      {!party ? <EmptyState icon={AlertCircle} title='No party available' description='Join a party with an assigned project before creating a submission. Your previous questionnaires remain available below.' />
        : !party.assignedProjectId ? <EmptyState icon={AlertCircle} title='No assigned project' description='A submission becomes available when your party receives a project.' />
          : <SubmissionForm key={user?.id + ':' + session.owner + ':' + party.id + ':' + party.assignedProjectId} party={party} />}
    </QuerySection>
    <QuestionnaireList />
  </div>;
}

function SubmissionForm({ party }: { party: Party }) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const session = useSessionRequests();
  const [fields, setFields] = useState<SubmissionFields | null>(null);
  const [saved, setSaved] = useState<Submission | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [pending, setPending] = useState<'save' | 'submit' | 'reload' | null>(null);
  const [error, setError] = useState('');
  const busy = useRef(false);
  const queryKey = ['submission', user?.role, user?.id, session.owner, party.id];
  const query = useQuery({
    queryKey,
    queryFn: ({ signal }) => submissionApi.get(party.id, { ownerSession: session.owner ?? '', signal }).then(r => r.data).catch(error => {
      if (isAxiosError(error) && error.response?.status === 404) return null;
      throw error;
    }), retry: false,
  });
  const report = useQuery({
    queryKey: ['eval-report', user?.role, user?.id, session.owner, saved?.id],
    queryFn: () => evaluationApi.getBySubmission(saved!.id).then(r => r.data),
    enabled: saved?.status === 'EVALUATED', retry: false,
  });

  useEffect(() => {
    if (query.data === undefined || !session.current() || busy.current) return;
    if (saved?.version !== undefined && (query.data?.version ?? -1) < saved.version) return;
    if (!fields || matchesSavedDraft(saved, fields, files.length)) {
      setSaved(query.data);
      setFields(submissionFields(query.data));
    }
  }, [query.data]);

  const leader = party.leader?.id === user?.id;
  const submitted = !!saved && saved.status !== 'DRAFT';
  const editingLocked = submitted || !leader || pending === 'submit' || pending === 'reload';
  const dirty = !!fields && !matchesSavedDraft(saved, fields, files.length);
  const canSubmit = !!fields && canFinalizeSubmission(saved, fields, files.length, leader,
    !!pending || query.isFetching || query.isError || !session.current());

  const write = async (kind: 'save' | 'submit') => {
    if (!fields || busy.current || !session.current() || !leader || submitted) return;
    if (kind === 'submit' && (!canSubmit || !confirm('Are you sure? Final submission cannot be undone.'))) return;
    const sent = { ...fields };
    const sentFiles = [...files];
    const options = session.options();
    busy.current = true;
    setPending(kind);
    setError('');
    try {
      const fd = new FormData();
      fd.append('repoUrl', sent.repoUrl);
      fd.append('branch', sent.branch);
      fd.append('notes', sent.notes);
      sentFiles.forEach(file => fd.append('documents', file));
      const { data } = kind === 'save'
        ? await submissionApi.saveDraft(party.id, fd, options)
        : await submissionApi.finalSubmit(party.id, saved!.version!, options);
      if (!session.current() || options.signal.aborted) return;
      setSaved(data);
      qc.setQueryData(queryKey, data);
      if (kind === 'save') {
        const uploaded = data.documentUrls.length >= (saved?.documentUrls.length ?? 0) + sentFiles.length;
        if (uploaded) setFiles(current => current.filter(file => !sentFiles.includes(file)));
        if (!uploaded || !matchesSavedDraft(data, sent, 0)) {
          setError('The server did not save every requested change. Blank repository or branch values cannot clear saved values. Review your fields before final submission.');
        } else toast.success('Draft saved!');
      } else toast.success('Submission complete!');
    } catch (error) {
      if (session.current() && !options.signal.aborted) setError(isAxiosError(error)
        ? error.response?.data?.message || 'Request failed. Your edits are kept here. Try again or reload the saved draft.'
        : 'Request failed. Your edits are kept here.');
    } finally {
      if (session.current() && !options.signal.aborted) { busy.current = false; setPending(null); }
    }
  };

  return <>
    <PageHeader title='Project Submission' description={'Submit your team’s work for ' + party.assignedProjectTitle + '.'} />
    <QuerySection query={query} label='Saved submission'>
      {fields && <>
        <div className='panel mb-5 flex flex-wrap items-center gap-3 p-4'>
          <div className='min-w-0 flex-1'>
            <p role='status' aria-live='polite' className='text-sm font-semibold'>{submitted ? 'Submission received' : pending === 'save' ? 'Saving draft...' : dirty ? 'Unsaved draft changes' : 'Draft saved'}</p>
            {saved?.submittedAt && <p className='mt-1 text-xs text-muted'>Submitted {formatDateTime(saved.submittedAt)}</p>}
            {!leader && <p className='mt-1 text-sm text-muted'>Only your party leader can save or submit. You can read the saved team submission.</p>}
          </div>
          {saved && <StatusBadge status={saved.status} />}
        </div>
        <div className='panel space-y-5 p-4 sm:p-6'>
          <TextField fullWidth isRequired isReadOnly={editingLocked}>
            <Label><Github size={14} /> GitHub repository URL</Label>
            <Input maxLength={500} value={fields.repoUrl} onChange={e => setFields({ ...fields, repoUrl: e.target.value })} placeholder='https://github.com/your-org/your-project' />
          </TextField>
          <TextField fullWidth isReadOnly={editingLocked}><Label>Branch</Label>
            <Input maxLength={100} value={fields.branch} onChange={e => setFields({ ...fields, branch: e.target.value })} placeholder='main' />
          </TextField>
          <div className='space-y-2'>
            <label htmlFor='submission-documents' className='text-sm font-medium'>Supporting documents (optional)</label>
            {leader && !submitted && <input id='submission-documents' aria-label='Supporting documents (optional)' type='file' multiple disabled={editingLocked}
              className='block min-h-11 w-full min-w-0 text-sm file:mr-3 file:min-h-11 file:rounded-md file:border-0 file:bg-default file:px-3 file:text-foreground focus-visible:outline-2 focus-visible:outline-focus'
              onChange={e => { setFiles(Array.from(e.target.files ?? [])); e.target.value = ''; }} />}
            {files.map((file, i) => <div key={i} className='flex min-w-0 items-center gap-2 text-sm'><span className='min-w-0 flex-1 break-all'>{file.name}</span>
              <Button variant='ghost' className='min-h-11' isDisabled={editingLocked} onPress={() => setFiles(current => current.filter(item => item !== file))}>Remove {file.name}</Button></div>)}
            {!!saved?.documentUrls.length && <div className='space-y-1 text-xs text-muted'><p>Previously uploaded (kept with this submission):</p>{saved.documentUrls.map((url, i) => <p key={i} className='break-all'>{url.split('/').pop()}</p>)}</div>}
          </div>
          <TextField fullWidth isReadOnly={editingLocked}><Label>Notes for evaluators (optional)</Label>
            <TextArea maxLength={2000} rows={3} value={fields.notes} onChange={e => setFields({ ...fields, notes: e.target.value })} />
            <p className='text-right text-xs text-muted'>{fields.notes.length}/2000</p>
          </TextField>
          {error && <div><p role='alert' className='text-sm text-danger'>{error}</p>
            <Button variant='secondary' className='mt-3 min-h-11' isDisabled={!!pending} onPress={async () => {
              if (busy.current || !confirm('Discard your local edits and reload the saved draft?')) return;
              busy.current = true; setPending('reload');
              const result = await query.refetch();
              if (session.current()) {
                if (result.isSuccess) { setSaved(result.data); setFields(submissionFields(result.data)); setFiles([]); setError(''); }
                busy.current = false; setPending(null);
              }
            }}>Reload saved draft</Button></div>}
          {leader && !submitted && <>
            <p className='text-sm text-muted'>{dirty ? 'Save your changes before final submission.' : 'Final submission uses the saved draft and cannot be undone.'}</p>
            <div className='flex flex-wrap gap-3'>
              <Button variant='secondary' className='min-h-11 flex-1' onPress={() => { void write('save'); }} isDisabled={!!pending || query.isFetching || query.isError}><Save size={15} />{pending === 'save' ? 'Saving...' : 'Save Draft'}</Button>
              <Button variant='primary' className='min-h-11 flex-1' onPress={() => { void write('submit'); }} isDisabled={!canSubmit}><Send size={15} />{pending === 'submit' ? 'Submitting...' : 'Final Submit'}</Button>
            </div>
          </>}
        </div>
      </>}
    </QuerySection>
    {report.data && <div className='panel mt-5 overflow-hidden'><EvaluationReportPanel report={report.data} /></div>}
  </>;
}
