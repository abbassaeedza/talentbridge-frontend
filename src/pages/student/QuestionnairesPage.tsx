import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { Button } from '@heroui/react/button';
import { TextArea } from '@heroui/react/textarea';
import { TextField } from '@heroui/react/textfield';
import { Label } from '@heroui/react/label';
import { questionnaireApi } from '../../api/services';
import { useAuth } from '../../contexts/AuthContext';
import { useSessionRequests } from '../../hooks/useSessionRequests';
import { useQuestionnaireDraft } from '../../hooks/useQuestionnaireDraft';
import { getAccessToken, getJwtSessionKey } from '../../utils/authTokens';
import { formatDateTime } from '../../utils/dateTime';
import QuerySection from '../../components/ui/QuerySection';
import { PageHeader } from '../../components/ui/TalentBridgeUI';

export function QuestionnaireList() {
  const { user } = useAuth();
  const session = useSessionRequests();
  const query = useQuery({
    queryKey: ['questionnaires', user?.role, user?.id, session.owner],
    queryFn: ({ signal }) => questionnaireApi.list({ ownerSession: session.owner ?? '', signal }).then(r => r.data),
    enabled: user?.role === 'STUDENT' && !!session.owner,
    retry: false,
  });
  return <QuerySection query={query} label='My questionnaires'>
    <div className='panel p-4 sm:p-5'>
      <h2 className='font-semibold text-foreground'>My questionnaires</h2>
      {query.data?.length === 0 && <p className='mt-2 text-sm text-muted'>No questionnaires yet. New assignments will appear here after final project submission.</p>}
      <ul className='mt-2 divide-y divide-separator'>
        {query.data?.map(q => <li key={q.id} className='py-3'>
          <Link className='inline-flex min-h-11 max-w-full items-center [overflow-wrap:anywhere] text-sm font-semibold text-accent underline underline-offset-4' to={`/student/questionnaires/${q.id}`}>{q.projectTitle}</Link>
          {q.answerState === 'PENDING'
            ? <p className='text-sm text-muted'>{q.state === 'FAILED' ? 'Questions are not ready. Please check again later.' : 'Your questions are being prepared.'}</p>
            : <><p className='text-sm text-muted'>{q.answeredCount}/5 saved answers{q.editable ? ' - editable until the deadline' : ' - answer window closed'}</p>
              <p className='mt-1 text-xs text-muted'>Closes {formatDateTime(q.closesAt)}</p></>}
        </li>)}
      </ul>
    </div>
  </QuerySection>;
}

export default function QuestionnairesPage() {
  return <div className='max-w-3xl'><PageHeader title='Questionnaires' description='Your individual questions for submitted projects, including past parties.' /><QuestionnaireList /></div>;
}

export function QuestionnaireDetailPage() {
  const { assignmentId } = useParams();
  const { user } = useAuth();
  return <QuestionnaireDetail key={`${user?.id}:${getJwtSessionKey(getAccessToken())}:${assignmentId}`} id={assignmentId!} />;
}

function QuestionnaireDetail({ id }: { id: string }) {
  const { user } = useAuth();
  const session = useSessionRequests();
  const [reloading, setReloading] = useState(false);
  const query = useQuery({
    queryKey: ['questionnaire', user?.role, user?.id, session.owner, id],
    queryFn: ({ signal }) => questionnaireApi.get(id, { ownerSession: session.owner ?? '', signal }).then(r => r.data),
    enabled: !!session.owner && user?.role === 'STUDENT', retry: false, staleTime: 0,
  });
  const draft = useQuestionnaireDraft(query.data, id);
  const server = draft.server;
  const closed = !!server?.closesAt && !draft.editable;
  const hours = Math.floor((draft.remaining ?? 0) / 3600_000);
  const minutes = Math.floor(((draft.remaining ?? 0) % 3600_000) / 60_000);
  return <div className='max-w-3xl pb-6'>
    <Link to='/student/questionnaires' className='inline-flex min-h-11 items-center text-sm text-accent underline underline-offset-4'>All questionnaires</Link>
    <QuerySection query={query} label='Questionnaire'>
      {server && <>
        <div className='min-w-0 [overflow-wrap:anywhere]'><PageHeader title={server.projectTitle} description='Your individual project questionnaire' /></div>
        {server.answerState === 'PENDING' ? <div className='panel p-5'>
          <p>{server.state === 'FAILED' ? 'Questions are not ready. Please check again later.' : 'Your questions are being prepared.'}</p>
          <p className='mt-2 text-sm text-muted'>Your 48-hour answer window starts only when every team member’s questions are ready.</p>
          <Button variant='secondary' className='mt-4 min-h-11' onPress={() => { void query.refetch(); }}>Check again</Button>
        </div> : <>
          <section className='panel mb-6 space-y-3 p-4 sm:p-5' aria-label='Answer window and saving'>
            <div className='flex flex-wrap items-center justify-between gap-3'>
              <p className='font-semibold text-foreground'>{closed ? 'Answer window closed' : `${hours}h ${minutes}m remaining`}</p>
              <Button className='min-h-11' variant='primary' isDisabled={!draft.editable || !draft.dirty || draft.saving || draft.conflict || reloading} onPress={() => { void draft.save(); }}>Save now</Button>
            </div>
            <p className='text-sm text-muted'>{server.answeredCount}/5 saved answers. {draft.editable && 'You can edit all five answers until the deadline.'}</p>
            <div className='space-y-1 text-xs text-muted'><p>Opens {formatDateTime(server.opensAt)}</p><p>Closes {formatDateTime(server.closesAt)}</p></div>
            <p className='max-w-prose text-sm text-muted'>Only your latest complete, successfully saved set counts at the deadline. An incomplete saved set receives zero. There is no early submit.</p>
            <p role='status' aria-live='polite' className='text-sm text-foreground'>
              {closed ? (draft.dirty ? 'Window closed. Unsaved edits were not accepted; showing saved answers.' : 'Window closed. Showing saved answers.')
                : draft.saving ? 'Saving answers...' : draft.error ? 'Changes not saved.' : draft.dirty ? 'Unsaved changes' : 'All changes saved'}
              {server.savedAt && <span className='mt-1 block text-xs text-muted'>Last saved {formatDateTime(server.savedAt)}</span>}
            </p>
            {draft.error && <p role='alert' className='text-sm text-danger'>{draft.error}</p>}
            {draft.conflict && <Button className='min-h-11' variant='secondary' isDisabled={reloading} onPress={async () => {
              if (!confirm('Discard your local edits and reload the saved answers?')) return;
              setReloading(true);
              const result = await query.refetch();
              if (session.current() && result.isSuccess) draft.reset(result.data);
              if (session.current()) setReloading(false);
            }}>Reload saved answers</Button>}
          </section>
          <div className='divide-y divide-separator'>
            {server.questions.map((q, i) => {
              const answer = (closed ? draft.saved : draft.answers).find(a => a.questionId === q.id)?.text ?? '';
              return <section key={q.id} className='space-y-3 py-6 first:pt-0' aria-labelledby={`question-${q.id}`}>
                <h2 id={`question-${q.id}`} className='whitespace-pre-wrap break-words text-base font-semibold leading-7 text-foreground'>{q.position}. {q.prompt}</h2>
                <ul aria-label={`Source references for question ${q.position}`} className='space-y-1 text-xs text-muted'>
                  {q.sourceReferences.map((ref, index) => <li key={index} className='break-all'>{ref.path}, lines {ref.startLine}-{ref.endLine}</li>)}
                </ul>
                <TextField fullWidth value={answer} onChange={value => draft.edit(q.id, value)} isReadOnly={!draft.editable || reloading} onBlur={() => { void draft.blur(); }}>
                  <Label>Answer {i + 1}</Label>
                  <TextArea rows={5} maxLength={2000} className='w-full resize-y' />
                  <p className='text-right text-xs text-muted'>{answer.length}/2000 characters</p>
                </TextField>
              </section>;
            })}
          </div>
        </>}
      </>}
    </QuerySection>
  </div>;
}
