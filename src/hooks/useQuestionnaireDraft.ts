import { useEffect, useReducer, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { questionnaireApi } from '../api/services';
import type { Questionnaire, QuestionnaireAnswer } from '../types';
import { answerPayload, boundedAnswer, questionnaireIsOpen, sameAnswers } from '../utils/questionnaireDraft';
import { useSessionRequests } from './useSessionRequests';
import { useAuth } from '../contexts/AuthContext';

interface DraftState {
  server: Questionnaire; answers: QuestionnaireAnswer[]; saved: QuestionnaireAnswer[];
  clock: { server: number; received: number }; saving: boolean; error: string; conflict: boolean;
}

export function useQuestionnaireDraft(data: Questionnaire | undefined, assignmentId: string) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const session = useSessionRequests();
  const cacheKey = ['questionnaire-draft', user?.role, user?.id, session.owner, assignmentId];
  const memory = useQuery<DraftState | null>({
    queryKey: cacheKey, queryFn: () => null, initialData: null, enabled: false, gcTime: Infinity,
  });
  const cacheEntry = useRef(queryClient.getQueryCache().find({ queryKey: cacheKey, exact: true }));
  const [, render] = useReducer(n => n + 1, 0);
  const state = useRef<DraftState | null>(null);
  const changed = () => {
    // A cleared session cache must never be recreated by an old component or response.
    if (!session.current() || queryClient.getQueryCache().find({ queryKey: cacheKey, exact: true }) !== cacheEntry.current) return;
    queryClient.setQueryData(cacheKey, structuredClone(state.current));
    render();
  };
  const now = () => state.current ? state.current.clock.server + performance.now() - state.current.clock.received : NaN;
  const reset = (server: Questionnaire) => {
    const calibratedNow = Math.max(Date.parse(server.serverNow), state.current ? now() : -Infinity);
    state.current = { server, answers: answerPayload(server.questions), saved: answerPayload(server.questions),
      clock: { server: calibratedNow, received: performance.now() }, saving: false, error: '', conflict: false };
    changed();
  };

  useEffect(() => {
    if (!data || !session.current()) return;
    if (!state.current && memory.data) {
      state.current = structuredClone(memory.data);
      if (state.current.saving) {
        state.current.saving = false;
        state.current.conflict = true;
        state.current.error = 'A previous save may have completed. Your draft is kept here. Reload saved answers before saving again.';
      }
    }
    const s = state.current;
    if (s && data.revision === s.server.revision && Date.parse(data.serverNow) < Date.parse(s.server.serverNow)) return;
    if (s && data.revision < s.server.revision) {
      // An earlier read may finish after a successful write; never roll answers or revision back.
      if (Date.parse(data.serverNow) > s.clock.server) {
        s.clock = { server: Math.max(now(), Date.parse(data.serverNow)), received: performance.now() };
        s.server = { ...s.server, editable: s.server.editable && data.editable };
        changed();
      }
      return;
    }
    if (!s || (!s.saving && !s.error && sameAnswers(s.answers, s.saved))) reset(data);
    else if (!s.saving) {
      s.clock = { server: Math.max(now(), Date.parse(data.serverNow)), received: performance.now() };
      if (data.revision !== s.server.revision) {
        s.conflict = true;
        s.error = 'Answers changed in another session. Your edits are kept here. Reload saved answers before saving again.';
      }
      s.server = { ...s.server, editable: data.editable, opensAt: data.opensAt, closesAt: data.closesAt };
      changed();
    }
  }, [data]);

  useEffect(() => {
    const timer = window.setInterval(render, 1000);
    return () => window.clearInterval(timer);
  }, []);

  const save = async (manual = false) => {
    const s = state.current;
    if (!s || !session.current() || s.saving || s.conflict || (!manual && s.error)
      || !questionnaireIsOpen(s.server, now()) || sameAnswers(s.answers, s.saved)) return;
    const payload = s.answers.map(a => ({ ...a }));
    const options = session.options();
    s.saving = true;
    s.error = '';
    changed();
    try {
      const { data: saved } = await questionnaireApi.save(s.server.id, s.server.revision, payload, options);
      if (!session.current() || options.signal.aborted) return;
      s.server = saved;
      s.saved = answerPayload(saved.questions);
      s.clock = { server: Math.max(now(), Date.parse(saved.serverNow)), received: performance.now() };
      void queryClient.invalidateQueries({ queryKey: ['questionnaires'] });
    } catch (error) {
      if (!session.current() || options.signal.aborted) return;
      s.conflict = isAxiosError(error) && error.response?.status === 409;
      s.error = s.conflict
        ? 'Answers changed in another session or the answer window closed. Your edits are kept here. Reload saved answers before saving again.'
        : isAxiosError(error) && error.response?.status === 400
          ? 'Your changes are not saved. Check each answer for unsupported control characters or text longer than 2000 characters. Edit the text, then choose Save now. Your draft is kept here.'
          : 'Your changes are not saved. Your edits are kept here. Choose Save now to try again.';
    } finally {
      if (session.current() && !options.signal.aborted) { s.saving = false; changed(); }
    }
  };

  const s = state.current;
  const dirty = !!s && !sameAnswers(s.answers, s.saved);
  const editable = !!s && questionnaireIsOpen(s.server, now());
  // Depend on the actual draft, not clock ticks, so the debounce can finish.
  const draftKey = JSON.stringify(s?.answers);
  useEffect(() => {
    if (!dirty || !editable || s?.saving || s?.error) return;
    const timer = window.setTimeout(() => { void save(); }, 1000);
    return () => window.clearTimeout(timer);
  }, [draftKey, dirty, editable, s?.saving, s?.error]);

  useEffect(() => {
    if (!s?.server.closesAt || !editable) return;
    const timer = window.setTimeout(render, Math.max(0, Date.parse(s.server.closesAt) - now()));
    return () => window.clearTimeout(timer);
  }, [s?.server.closesAt, s?.server.serverNow, editable]);

  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      const current = state.current;
      if (session.current() && current && !sameAnswers(current.answers, current.saved)) {
        event.preventDefault();
        event.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, []);

  return {
    server: s?.server, answers: s?.answers ?? [], saved: s?.saved ?? [], dirty, editable,
    saving: s?.saving ?? false, error: s?.error ?? '', conflict: s?.conflict ?? false,
    remaining: s?.server.closesAt ? Math.max(0, Date.parse(s.server.closesAt) - now()) : null,
    save: () => save(true), blur: () => save(),
    edit: (id: string, text: string) => {
      const current = state.current;
      if (!current || !session.current() || !questionnaireIsOpen(current.server, now())) return;
      current.answers = current.answers.map(a => a.questionId === id ? { ...a, text: boundedAnswer(text) } : a);
      changed();
    },
    reset,
  };
}
