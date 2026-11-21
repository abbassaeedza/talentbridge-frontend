import type { QuestionnaireAnswer } from '../types';

export function boundedAnswer(text: string) {
  const clipped = text.slice(0, 2000);
  return text.length > 2000 && /[\uD800-\uDBFF]$/.test(clipped) && /[\uDC00-\uDFFF]/.test(text[2000])
    ? clipped.slice(0, -1) : clipped;
}

export function answerPayload(questions: { id: string; answer: string }[]): QuestionnaireAnswer[] {
  return questions.map(q => ({ questionId: q.id, text: q.answer }));
}

export function sameAnswers(a: QuestionnaireAnswer[], b: QuestionnaireAnswer[]) {
  return a.length === b.length && a.every((answer, i) => answer.questionId === b[i].questionId && answer.text === b[i].text);
}

export function questionnaireIsOpen(window: { editable: boolean; opensAt: string | null; closesAt: string | null }, serverNow: number) {
  return window.editable && !!window.opensAt && !!window.closesAt
    && serverNow >= Date.parse(window.opensAt) && serverNow < Date.parse(window.closesAt);
}
