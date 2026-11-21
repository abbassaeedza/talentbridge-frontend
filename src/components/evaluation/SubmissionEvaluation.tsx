import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { Button } from '@heroui/react/button';
import { evaluationApi, submissionApi } from '../../api/services';
import { useAuth } from '../../contexts/AuthContext';
import { useSessionRequests } from '../../hooks/useSessionRequests';
import type { CoordinatorSubmission, EvaluationRun } from '../../types';
import { correctionPayload, gradingPollInterval, windowExpired } from '../../utils/evaluation';
import { formatDateTime } from '../../utils/dateTime';
import QuerySection from '../ui/QuerySection';
import { StatusBadge } from '../ui/TalentBridgeUI';
import EvaluationReportPanel from './EvaluationReportPanel';
import QuestionnaireReview, { type Correction } from './QuestionnaireReview';

export default function SubmissionEvaluation({ submission: sub, discoveryKey }: { submission: CoordinatorSubmission; discoveryKey: (string | null | undefined)[] }) {
  const { user } = useAuth();
  const session = useSessionRequests();
  const qc = useQueryClient();
  const scope = ['coordinator-evaluation', user?.role, user?.id, session.owner, sub.id];
  const [expanded, setExpanded] = useState(sub.runStatus === 'RUNNING');
  const [runId, setRunId] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [corrections, setCorrections] = useState<Record<string, Correction>>({});
  const busy = useRef(false);
  const dirty = Object.keys(corrections).length > 0;
  const v2 = sub.assessmentVersion === 2;
  const activeRunId = runId ?? sub.runId;
  useEffect(() => {
    if (runId && sub.runId === runId) setRunId(null);
  }, [runId, sub.runId]);
  const [visible, setVisible] = useState(() => document.visibilityState === 'visible');
  useEffect(() => {
    const changed = () => setVisible(document.visibilityState === 'visible');
    document.addEventListener('visibilitychange', changed);
    return () => document.removeEventListener('visibilitychange', changed);
  }, []);
  const runKey = [...scope, 'run', activeRunId];
  const run = useQuery({
    queryKey: runKey,
    queryFn: ({ signal }) => evaluationApi.run(activeRunId!, { ownerSession: session.owner ?? '', signal }).then(r => r.data),
    enabled: !!session.owner && v2 && !!activeRunId && visible && !pending,
    retry: false, refetchOnWindowFocus: false, refetchIntervalInBackground: false,
    refetchInterval: query => visible && !query.state.error ? gradingPollInterval(query.state.data) : false,
  });
  const generationKey = [...scope, 'generation'];
  const generation = useQuery({
    queryKey: generationKey,
    queryFn: ({ signal }) => submissionApi.questionnaireReview(sub.id, { ownerSession: session.owner ?? '', signal }).then(r => r.data),
    enabled: !!session.owner && v2 && expanded && !sub.opensAt && !pending,
    retry: false, refetchOnWindowFocus: false,
  });
  const answerWindow = sub.opensAt ? sub : generation.data ?? sub;
  const serverNow = Math.max(Date.parse(answerWindow.serverNow), Date.parse(run.data?.serverNow ?? answerWindow.serverNow));
  const clock = useMemo(() => ({ server: serverNow, received: performance.now() }), [serverNow]);
  const [, renderDeadline] = useState(0);
  const now = clock.server + performance.now() - clock.received;
  const expired = windowExpired(answerWindow, now);
  useEffect(() => {
    if (!answerWindow.closesAt || expired) return;
    const timer = window.setTimeout(() => renderDeadline(n => n + 1), Math.min(2_147_483_647, Math.max(1, Date.parse(answerWindow.closesAt) - now)));
    return () => window.clearTimeout(timer);
  }, [clock, answerWindow.closesAt, expired]);
  const reviewKey = [...scope, 'private-review'];
  const review = useQuery({
    queryKey: reviewKey,
    queryFn: ({ signal }) => evaluationApi.questionnaire(sub.id, { ownerSession: session.owner ?? '', signal }).then(r => r.data),
    enabled: !!session.owner && v2 && expanded && expired && !pending,
    retry: false, refetchOnWindowFocus: false,
  });
  const reportKey = [...scope, 'report'];
  const reportReady = activeRunId ? ['REVIEW', 'FINALIZED'].includes(run.data?.status ?? '') : sub.status === 'EVALUATED' || !!sub.reportId;
  const report = useQuery({
    queryKey: reportKey,
    queryFn: ({ signal }) => evaluationApi.getBySubmission(sub.id, { ownerSession: session.owner ?? '', signal }).then(r => r.data),
    enabled: !!session.owner && expanded && reportReady && !pending,
    retry: false, refetchOnWindowFocus: false,
  });
  useEffect(() => {
    if (!session.current() || !run.data || !['REVIEW', 'FINALIZED'].includes(run.data.status)) return;
    void qc.invalidateQueries({ queryKey: reviewKey });
    void qc.invalidateQueries({ queryKey: reportKey });
    void qc.invalidateQueries({ queryKey: discoveryKey });
  }, [run.data?.id, run.data?.status]);
  const finalized = sub.finalized || !!report.data?.finalized || run.data?.status === 'FINALIZED' || review.data?.state === 'FINALIZED';
  const reviewState = finalized ? 'FINALIZED' : review.data && sub.questionnaireState && Date.parse(sub.serverNow) > Date.parse(review.data.serverNow)
    ? sub.questionnaireState : review.data?.state;
  const unfinished = run.data?.steps.find(step => step.status !== 'SUCCEEDED');
  const canRetry = run.data?.status === 'FAILED' || (run.data?.status === 'RUNNING' && unfinished &&
    (['FAILED', 'PENDING', 'DEFERRED'].includes(unfinished.status) ||
      (unfinished.status === 'RUNNING' && !!unfinished.leaseUntil && Date.parse(unfinished.leaseUntil) <= now)));
  const reading = review.isFetching || report.isFetching || generation.isFetching;
  const locked = !!pending || reading;
  const readyToFinalize = !report.isError && (!v2 || (!review.isError && reviewState === 'REVIEW' && review.data?.members.every(m => m.gradeState !== 'PENDING') && (!activeRunId || run.data?.status === 'REVIEW')));

  const write = async (kind: 'trigger' | 'reevaluate' | 'retry' | 'generation' | 'mark' | 'finalize', questionId?: string) => {
    if (!session.current() || busy.current || finalized || reading) return;
    if (dirty && kind !== 'mark') return;
    const payload = questionId && corrections[questionId] ? correctionPayload(corrections[questionId].mark, corrections[questionId].reason) : null;
    if (kind === 'mark' && (!payload || !questionId || reviewState !== 'REVIEW')) return;
    if (kind === 'trigger' && (sub.status !== 'SUBMITTED' || (v2 && (!expired || !!activeRunId)))) return;
    if ((kind === 'finalize' || kind === 'reevaluate') && (!report.data || (v2 && !readyToFinalize))) return;
    if (kind === 'finalize' && !confirm('Finalize this report and publish grades to all frozen participants? Finalized grades cannot be changed.')) return;
    const options = session.options();
    busy.current = true; setPending(kind); setError('');
    try {
      await qc.cancelQueries({ queryKey: scope });
      if (!session.current()) return;
      if (kind === 'mark') {
        const { data } = await evaluationApi.adjustMark(sub.id, questionId!, payload!, options);
        if (!session.current()) return;
        qc.setQueryData(reviewKey, data);
        setCorrections(previous => { const next = { ...previous }; delete next[questionId!]; return next; });
        await qc.invalidateQueries({ queryKey: reportKey });
      } else if (kind === 'finalize') {
        const { data } = await evaluationApi.finalize(report.data!.id, options);
        if (!session.current()) return;
        qc.setQueryData(reportKey, data);
        await qc.invalidateQueries({ queryKey: reviewKey });
        await qc.invalidateQueries({ queryKey: runKey });
      } else if (kind === 'generation') {
        const { data } = await submissionApi.retryQuestionnaire(sub.id, options);
        if (!session.current()) return;
        qc.setQueryData(generationKey, data);
      } else {
        const response = kind === 'trigger' ? await evaluationApi.trigger(sub.id, options)
          : kind === 'reevaluate' ? await evaluationApi.reevaluate(report.data!.id, options)
            : await evaluationApi.retry(activeRunId!, options);
        if (!session.current()) return;
        if (response.status === 202 && 'steps' in response.data) {
          const data: EvaluationRun = response.data;
          qc.setQueryData([...scope, 'run', data.id], data);
          setRunId(data.id);
        } else if ('totalScore' in response.data) {
          qc.setQueryData(reportKey, response.data);
        }
        setExpanded(true);
      }
      if (session.current()) await qc.invalidateQueries({ queryKey: discoveryKey });
    } catch (failure) {
      if (!session.current() || options.signal.aborted) return;
      const message = isAxiosError(failure) && typeof failure.response?.data?.message === 'string' ? failure.response.data.message : 'Request failed. Your unsaved corrections are kept. Check status before trying again.';
      setError(message);
      if (kind === 'mark' && isAxiosError(failure) && failure.response?.status === 409) {
        await qc.invalidateQueries({ queryKey: scope });
        if (session.current()) await qc.invalidateQueries({ queryKey: discoveryKey });
      }
    } finally {
      if (session.current()) { busy.current = false; setPending(null); }
    }
  };

  const refresh = async () => {
    if (dirty || busy.current || !session.current()) return;
    busy.current = true; setPending('reload'); setError('');
    try {
      if (activeRunId) await run.refetch();
      if (v2 && !answerWindow.opensAt) await generation.refetch();
      if (v2 && expired) await review.refetch();
      if (reportReady) await report.refetch();
      if (session.current()) await qc.invalidateQueries({ queryKey: discoveryKey });
    } finally { if (session.current()) { busy.current = false; setPending(null); } }
  };
  return <article className='min-w-0 rounded-lg border border-border bg-surface [overflow-wrap:anywhere]' aria-label={`Evaluation for ${sub.projectTitle}`}>
    <div className='space-y-3 p-4 sm:p-5'>
      <div className='flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between'>
        <div className='min-w-0 flex-1'><h2 className='text-base font-semibold'>{sub.partyName}</h2><p className='mt-1 text-sm text-muted'>{sub.projectTitle}</p></div>
        <div className='flex flex-wrap gap-2'>
          {sub.status === 'SUBMITTED' && !finalized && <Button variant='primary' className='min-h-11' isDisabled={locked || !!activeRunId || (v2 && !expired)} onPress={() => { void write('trigger'); }}>{pending === 'trigger' ? 'Starting...' : 'Evaluate'}</Button>}
          <Button variant='secondary' className='min-h-11' isDisabled={!!pending || dirty} aria-expanded={expanded} onPress={() => setExpanded(!expanded)}>{expanded ? 'Hide review' : 'View review'}</Button>
        </div>
      </div>
      <div className='flex flex-wrap items-center gap-3 text-xs'><StatusBadge status={sub.status} />{sub.repoUrl && <a href={sub.repoUrl} target='_blank' rel='noreferrer' className='break-all text-accent underline underline-offset-4'>{sub.repoUrl.replace('https://github.com/', '')}</a>}</div>
      {v2 && <div className='space-y-1 text-sm text-muted'>
        <p>{finalized ? 'Finalized' : run.data?.status ?? (sub.opensAt ? sub.questionnaireState : generation.data?.state ?? sub.questionnaireState)}</p>
        {!answerWindow.opensAt ? <p>Your 48-hour answer window has not started.</p> : <><p>Opens {formatDateTime(answerWindow.opensAt)}</p><p>Closes {formatDateTime(answerWindow.closesAt)}</p><p>{expired ? 'Answer window closed. Locked saved answers can be reviewed.' : 'Answer window open. Evaluation is available only after the full 48 hours.'}</p></>}
      </div>}
      {pending === 'trigger' && !v2 && <p role='status' aria-label='Evaluation progress' className='text-sm'>Evaluation request in progress. Waiting for the server report.</p>}
      {error && <p role='alert' className='whitespace-pre-wrap text-sm text-danger'>{error}</p>}
    </div>
    {v2 && activeRunId && <div className='border-t border-separator p-4 sm:p-5'>
      <QuerySection query={run} label='Grading run'>
        {run.data && <><p className='mb-3 text-sm font-semibold'>Grading run: {run.data.status}</p><ol className='space-y-3 text-sm'>
          {run.data.steps.map(step => <li key={step.id} className='rounded-md border border-border p-3'>
            <p className='font-medium'>{step.kind === 'REPOSITORY' ? 'Repository scoring' : `Private questionnaire batch ${step.position} (${step.questionCount} questions)`}: {step.status}</p>
            <p className='mt-1 text-xs text-muted'>Actual attempts: {step.attempts}{step.errorCode && ` - ${step.errorCode}`}</p>
            {step.nextAttemptAt && <p className='mt-1 text-xs text-muted'>Next eligible {formatDateTime(step.nextAttemptAt)}</p>}
          </li>)}
        </ol></>}
      </QuerySection>
      <div className='mt-3 flex flex-wrap gap-2'>
        <Button variant='secondary' className='min-h-11' isDisabled={locked || dirty} onPress={() => { void refresh(); }}>Check status</Button>
        {!finalized && canRetry && <Button variant='secondary' className='min-h-11' isDisabled={locked || dirty || run.data?.steps.some(s => (s.status === 'DEFERRED' && !!s.nextAttemptAt && Date.parse(s.nextAttemptAt) > now) || (!!s.leaseUntil && Date.parse(s.leaseUntil) > now))} onPress={() => { void write('retry'); }}>Retry grading</Button>}
      </div>
    </div>}
    {expanded && <div className='min-w-0 space-y-5 border-t border-separator p-4 sm:p-5'>
      {v2 && !answerWindow.opensAt && <QuerySection query={generation} label='Questionnaire generation'>
        {generation.data && <div className='space-y-3 text-sm'>
          {generation.data.members.map(member => <p key={member.assignmentId}>{member.studentName}: {member.questionCount}/5 questions ready, {member.answeredCount}/5 saved answers</p>)}
          {generation.data.jobs.map(job => <p key={job.id}>{job.kind}: {job.status}, actual attempts {job.attempts}{job.errorCode && ` - ${job.errorCode}`}{job.nextAttemptAt && ` - Next eligible ${formatDateTime(job.nextAttemptAt)}`}</p>)}
          <div className='flex flex-wrap gap-2'><Button variant='secondary' className='min-h-11' isDisabled={locked || dirty} onPress={() => { void refresh(); }}>Check status</Button>
            {!finalized && generation.data.jobs.some(job => job.status !== 'SUCCEEDED') && <Button variant='secondary' className='min-h-11' isDisabled={locked || generation.data.jobs.some(job => (!!job.leaseUntil && Date.parse(job.leaseUntil) > now) || (job.status === 'DEFERRED' && !!job.nextAttemptAt && Date.parse(job.nextAttemptAt) > now))} onPress={() => { void write('generation'); }}>Recover generation</Button>}
          </div>
        </div>}
      </QuerySection>}
      {reportReady && <QuerySection query={report} label='Evaluation report'>
        {report.data && <EvaluationReportPanel report={report.data} audience='coordinator'>
          {finalized ? <StatusBadge status='EVALUATED' label='Report finalized' className='mt-4' /> : <div className='mt-5 space-y-3'>
            {dirty && <p role='status' className='text-sm text-warning'>Save or cancel every unsaved correction before finalization, reevaluation or reload.</p>}
            <div className='flex flex-wrap gap-2'>
              <Button variant='secondary' className='min-h-11' isDisabled={locked || dirty || !readyToFinalize} onPress={() => { void write('reevaluate'); }}>Reevaluate</Button>
              <Button variant='primary' className='min-h-11' isDisabled={locked || dirty || !readyToFinalize} onPress={() => { void write('finalize'); }}>{pending === 'finalize' ? 'Finalizing...' : 'Finalize Report'}</Button>
            </div>
          </div>}
        </EvaluationReportPanel>}
      </QuerySection>}
      {v2 && expired && <QuerySection query={review} label='Private questionnaire review'>
        {review.data && <QuestionnaireReview review={review.data} corrections={corrections} locked={locked} state={reviewState ?? review.data.state} onEdit={(id, savedMark, value) => {
          if (locked || reviewState !== 'REVIEW') return;
          setCorrections(previous => { const next = { ...previous }; if (value.mark === String(savedMark) && value.reason === '') delete next[id]; else next[id] = value; return next; });
        }} onCancel={id => { if (!locked) setCorrections(previous => { const next = { ...previous }; delete next[id]; return next; }); }} onSave={id => { void write('mark', id); }} />}
      </QuerySection>}
    </div>}
  </article>;
}
