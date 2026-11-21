import { Button } from '@heroui/react/button';
import { Input } from '@heroui/react/input';
import { Label } from '@heroui/react/label';
import { TextArea } from '@heroui/react/textarea';
import { TextField } from '@heroui/react/textfield';
import type { PrivateQuestionnaireReview } from '../../types';
import { correctionPayload } from '../../utils/evaluation';
import { formatDateTime } from '../../utils/dateTime';

export interface Correction { mark: string; reason: string }

export default function QuestionnaireReview({ review, corrections, locked, state, onEdit, onCancel, onSave }: {
  review: PrivateQuestionnaireReview; corrections: Record<string, Correction>; locked: boolean; state: PrivateQuestionnaireReview['state'];
  onEdit: (id: string, savedMark: number, value: Correction) => void;
  onCancel: (id: string) => void; onSave: (id: string) => void;
}) {
  return <section aria-label='Private questionnaire review' className='min-w-0 space-y-5'>
    <div><h3 className='text-lg font-semibold'>Private questionnaire review</h3>
      <p className='mt-1 max-w-prose text-sm text-muted'>Locked saved answers and grading details. Coordinator only. These details are not included in shared reports.</p></div>
    {review.members.map(member => <section key={member.assignmentId} aria-label={`Questionnaire for ${member.studentName}`} className='min-w-0 border-t border-separator pt-5'>
      <h4 className='text-base font-semibold [overflow-wrap:anywhere]'>{member.studentName}</h4>
      {member.gradeState === 'INCOMPLETE' ? <p className='mt-2 text-sm text-muted'>Incomplete saved set - policy zero (0.0/100)</p>
        : member.gradeState === 'PENDING' ? <p className='mt-2 text-sm text-muted'>Grading pending - no mark yet</p>
          : <p className='mt-2 text-sm text-muted'>AI questionnaire score: {member.aiScore?.toFixed(1) ?? 'Pending'}/100. Effective questionnaire score: {member.effectiveScore?.toFixed(1) ?? 'Pending'}/100.</p>}
      <div className='divide-y divide-separator'>{member.questions.map(question => {
        const label = `${member.studentName} question ${question.position}`;
        const savedMark = question.effectiveScore;
        const draft = corrections[question.id] ?? { mark: savedMark === null ? '' : String(savedMark), reason: '' };
        const adjustable = state === 'REVIEW' && member.gradeState === 'GRADED' && savedMark !== null;
        const retained = !adjustable && !!corrections[question.id];
        return <article key={question.id} className='min-w-0 space-y-3 py-5 [overflow-wrap:anywhere]'>
          <h5 className='whitespace-pre-wrap font-semibold leading-7'>{question.position}. {question.prompt}</h5>
          <ul className='space-y-1 text-xs text-muted' aria-label={`Source references for ${label}`}>
            {question.sourceReferences.map((source, i) => <li key={i} className='break-all'>{source.path}, lines {source.startLine}-{source.endLine}</li>)}
          </ul>
          <dl className='space-y-3 text-sm leading-6'>
            <div><dt className='font-medium'>Locked answer</dt><dd className='mt-1 whitespace-pre-wrap text-muted'>{question.answer || 'No saved answer'}</dd></div>
            <div><dt className='font-medium'>Grading rubric</dt><dd className='mt-1 whitespace-pre-wrap text-muted'>{question.rubric}</dd></div>
          </dl>
          {member.gradeState === 'GRADED' && <div className='space-y-1 text-sm'>
            <p>AI mark: {question.aiScore?.toFixed(1) ?? 'Pending'}/20</p>
            <p>Effective mark: {question.effectiveScore?.toFixed(1) ?? 'Pending'}/20</p>
            {question.feedback && <p className='whitespace-pre-wrap text-muted'>{question.feedback}</p>}
          </div>}
          {question.adjustments.length > 0 && <section aria-label={`Adjustment history for ${label}`} className='space-y-3 border-l-2 border-border pl-3 text-xs leading-5'>
            {question.adjustments.map((audit, i) => <div key={i}>
              <p>{audit.previousScore.toFixed(1)} to {audit.adjustedScore.toFixed(1)} /20</p>
              <p className='whitespace-pre-wrap'>{audit.reason}</p>
              <p className='text-muted'>Adjusted by {audit.actorId} at {formatDateTime(audit.adjustedAt)}</p>
            </div>)}
          </section>}
          {(adjustable || retained) && <form className='max-w-xl space-y-3 rounded-md border border-border p-3' onSubmit={event => { event.preventDefault(); if (adjustable && !locked) onSave(question.id); }}>
            {retained && <p role='status' className='text-sm text-warning'>Unsaved local correction - not applied. {state === 'FINALIZED' ? 'The report is finalized.' : `Adjustments are unavailable while the assessment is ${state}.`} Copy your text or discard this local correction.</p>}
            <TextField value={draft.mark} onChange={mark => { if (adjustable && savedMark !== null) onEdit(question.id, savedMark, { ...draft, mark }); }} isDisabled={locked} isReadOnly={!adjustable}>
              <Label>Mark for {label}</Label><Input inputMode='numeric' className='min-h-11' />
            </TextField>
            <TextField fullWidth value={draft.reason} onChange={reason => { if (adjustable && savedMark !== null) onEdit(question.id, savedMark, { ...draft, reason }); }} isDisabled={locked} isReadOnly={!adjustable}>
              <Label>Reason for {label}</Label><TextArea rows={3} maxLength={2000} />
              {adjustable && <p className='text-xs text-muted'>Integer 0-20. A nonblank reason is required, up to 2000 characters. {draft.reason.length}/2000</p>}
            </TextField>
            {adjustable && corrections[question.id] && !correctionPayload(draft.mark, draft.reason) && <p className='text-xs text-danger'>Enter an integer from 0 to 20 and a reason using normal text or code, without unsupported control characters.</p>}
            <div className='flex flex-wrap gap-2'>
              {adjustable ? <>
                <Button type='submit' variant='secondary' className='min-h-11' aria-label={`Save correction for ${label}`} isDisabled={locked || !corrections[question.id] || !correctionPayload(draft.mark, draft.reason)}>Save correction</Button>
                <Button type='button' variant='ghost' className='min-h-11' aria-label={`Cancel correction for ${label}`} isDisabled={locked || !corrections[question.id]} onPress={() => onCancel(question.id)}>Cancel correction</Button>
              </> : <Button type='button' variant='secondary' className='min-h-11' aria-label={`Discard local correction for ${label}`} isDisabled={locked} onPress={() => onCancel(question.id)}>Discard local correction</Button>}
            </div>
          </form>}
        </article>;
      })}</div>
    </section>)}
  </section>;
}
