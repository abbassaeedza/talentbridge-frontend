import { useState, useRef, useEffect } from 'react';
import { MessageCircle, X, Send, Bot, Minimize2 } from 'lucide-react';
import { Button } from '@heroui/react/button';
import { Modal } from '@heroui/react/modal';
import { TextArea } from '@heroui/react/textarea';
import { Link, useLocation } from 'react-router-dom';
import { chatApi } from '../../api/services';
import { useAuth } from '../../contexts/AuthContext';
import type { ChatMessage, ProjectDraft } from '../../types';
import { AUTH_TOKEN_CHANGED_EVENT, getAccessToken, getJwtSessionKey } from '../../utils/authTokens';
import { chatContextCache } from '../../utils/chatContextCache';
import { chatHelp, resolveChat, type ChatReply } from '../../utils/chatLogic';
import { PROJECT_DRAFT_EVENT, sanitizeProjectDraft } from '../../utils/projectDraft';

type Entry = ChatMessage & { reply?: ChatReply; draft?: ProjectDraft; reviewed?: boolean; filled?: boolean; owner?: string; generation?: number };

export default function ChatBot() {
  const { user } = useAuth();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(false);
  const epoch = useRef(0);
  const busy = useRef(false);
  const controller = useRef<AbortController | null>(null);
  const userRef = useRef(user);
  userRef.current = user;
  const currentOwner = () => {
    const viewer = userRef.current;
    const token = getAccessToken();
    const session = getJwtSessionKey(token);
    if (!viewer || !token || (session && !session.startsWith(`${viewer.id}:`))) return '';
    return `${viewer.id}:${viewer.role}:${session ?? 'opaque'}`;
  };
  const owner = currentOwner();
  const ownerRef = useRef(owner);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const help = chatHelp(user?.role ?? 'STUDENT');
  const onProjectForm = user?.role === 'COMPANY' && /^\/company\/projects\/(new|[^/]+\/edit)$/.test(location.pathname);

  const clearConversation = () => {
    epoch.current += 1;
    controller.current?.abort();
    busy.current = false;
    chatContextCache.clear();
    setLoading(false);
    setMessages([]);
    setInput('');
  };

  useEffect(() => {
    const sync = () => {
      const next = currentOwner();
      if (next !== ownerRef.current) {
        ownerRef.current = next;
        clearConversation();
        setOpen(false);
      }
      chatContextCache.setOwner(next);
    };
    sync();
    window.addEventListener(AUTH_TOKEN_CHANGED_EVENT, sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(AUTH_TOKEN_CHANGED_EVENT, sync);
      window.removeEventListener('storage', sync);
    };
  }, [owner]);

  useEffect(() => () => {
    epoch.current += 1;
    controller.current?.abort();
    chatContextCache.setOwner('');
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'instant', block: 'end' });
  }, [messages, loading]);

  const send = async (suggestion?: string) => {
    const text = (suggestion ?? input).trim().slice(0, 2000);
    const requestOwner = currentOwner();
    if (!text || busy.current || !user || !requestOwner || requestOwner !== ownerRef.current) return;
    const generation = epoch.current;
    const stillCurrent = () => epoch.current === generation && currentOwner() === requestOwner && ownerRef.current === requestOwner;
    controller.current = new AbortController();
    const signal = controller.current.signal;
    const history = messages.slice(-10).map(({ role, content }) => ({ role, content: content.slice(0, 2000) }));
    setInput('');
    setMessages(previous => [...previous, { role: 'user', content: text }]);
    busy.current = true;
    setLoading(true);
    const request = { message: text, userId: user.id, role: user.role, path: location.pathname };
    try {
      let result = resolveChat(request, undefined, Date.now);
      if (result.kind === 'contextRequired') {
        const snapshot = await chatContextCache.get(requestOwner, async () => {
          const { data } = await chatApi.context(signal);
          if (!stillCurrent() || data?.viewer?.id !== user.id || data.viewer.role !== user.role) throw new Error('Chat identity changed');
          return data;
        });
        if (!stillCurrent()) return;
        result = resolveChat(request, snapshot, Date.now);
        if (result.kind === 'contextRequired') throw new Error('Chat context unavailable');
      }
      if (result.kind === 'reply') {
        const reply = result.reply;
        if (stillCurrent()) setMessages(previous => [...previous, { role: 'assistant', content: reply.text, reply }]);
      } else {
        const context = user.role === 'COMPANY' && location.pathname === '/company/projects/new' ? 'COMPANY_PROJECT_CREATION' : user.role;
        const { data } = await chatApi.send(text, history, context, undefined, signal);
        if (!stillCurrent()) return;
        if (typeof data?.message !== 'string' || !data.message.trim()) throw new Error('Invalid chat response');
        const draft = user.role === 'COMPANY' ? sanitizeProjectDraft(data.projectDraft) : {};
        setMessages(previous => [...previous, { role: 'assistant', content: data.message.slice(0, 12000),
          draft: Object.keys(draft).length ? draft : undefined, owner: requestOwner, generation }]);
      }
    } catch (error: unknown) {
      if (!stillCurrent()) return;
      const response = (error as { response?: { status?: number; data?: { reason?: string; retryAfterSeconds?: number }; headers?: Record<string, string> } }).response;
      const reason = response?.data?.reason;
      const limit = reason === 'GLOBAL_DAILY_LIMIT' ? 'The daily AI limit has been reached.'
        : reason === 'ACCOUNT_RATE_LIMIT' ? 'You have reached the AI request rate limit.'
        : reason === 'ACCOUNT_IN_FLIGHT' ? 'An AI request is already running for your account.' : 'AI is temporarily unavailable.';
      const seconds = Number(response?.data?.retryAfterSeconds ?? response?.headers?.['retry-after']);
      const retry = response?.status === 429 && Number.isFinite(seconds) && seconds > 0 ? ` Try again after ${Math.ceil(seconds)} seconds.` : '';
      const facts = resolveChat(request, undefined, Date.now).kind === 'contextRequired';
      const content = facts ? 'Live facts are unavailable. Open your workspace to check; I will not guess.' : `${limit}${retry} Navigation and workflow help are still available.`;
      setMessages(previous => [...previous, { role: 'assistant', content }]);
    } finally {
      if (stillCurrent()) { busy.current = false; setLoading(false); }
    }
  };

  const prefill = (index: number) => {
    if (currentOwner() !== ownerRef.current || !currentOwner() || !onProjectForm) return;
    const entry = messages[index];
    if (!entry?.reviewed || entry.filled || !entry.draft || entry.owner !== currentOwner() || entry.generation !== epoch.current) return;
    window.dispatchEvent(new CustomEvent(PROJECT_DRAFT_EVENT, { detail: sanitizeProjectDraft(entry.draft) }));
    setMessages(previous => previous.map((message, i) => i === index ? { ...message, filled: true } : message));
    setOpen(false);
  };

  const actions = (reply: ChatReply) => reply.actions?.map((action, i) => action.path
    ? <Link key={i} to={action.path} onClick={() => setOpen(false)} className='inline-flex min-h-11 items-center rounded-md border border-border px-3 text-sm hover:bg-default focus-visible:outline-focus'>{action.label}</Link>
    : <Button key={i} size='sm' variant='secondary' className='min-h-11' isDisabled={loading} onPress={() => void send(action.message)}>{action.label}</Button>);

  return (
    <Modal isOpen={open && !!owner} onOpenChange={setOpen}>
      <Button isIconOnly size='lg' variant='primary' onPress={() => setOpen(true)} aria-label='Open AI assistant' className={`${open ? 'invisible ' : ''}fixed bottom-4 right-4 z-30 min-h-11 min-w-11 sm:bottom-6 sm:right-6`}><MessageCircle size={20} /></Button>
      <Modal.Backdrop variant='transparent' className='z-[80]'>
        {/* A transformed container would reposition and scale the viewport-fixed panel. */}
        <Modal.Container className='animate-none p-0 will-change-auto'>
          <Modal.Dialog aria-label='TalentBridge assistant' data-testid='chat-panel' className='fixed inset-0 flex h-[var(--visual-viewport-height,100dvh)] max-h-none w-full max-w-none flex-col overflow-hidden rounded-none border border-border bg-surface p-0 sm:inset-auto sm:bottom-6 sm:right-6 sm:h-[min(600px,calc(100dvh-3rem))] sm:w-[400px] sm:rounded-lg'>
            <div className='flex shrink-0 items-center gap-3 border-b border-border px-4 py-3'>
              <Bot size={18} className='shrink-0 text-muted' />
              <div className='min-w-0 flex-1'><p className='text-sm font-semibold'>TalentBridge assistant</p><p className='text-xs text-muted'>Suggestions, not automatic actions</p></div>
              <Button isIconOnly size='sm' variant='ghost' className='min-h-11 min-w-11' onPress={clearConversation} aria-label='Clear conversation'><Minimize2 size={16} /></Button>
              <Button isIconOnly size='sm' variant='ghost' className='min-h-11 min-w-11' onPress={() => setOpen(false)} aria-label='Close AI assistant'><X size={16} /></Button>
            </div>
            <div className='min-h-0 flex-1 space-y-4 overflow-y-auto p-4' role='log' aria-label='Conversation' aria-live='polite' aria-relevant='additions'>
              <p className='text-sm leading-6 text-muted'>{help.text}</p>
              {(owner === ownerRef.current ? messages : []).map((message, index) => (
                <div key={index} className={`min-w-0 rounded-lg border border-border px-3 py-2 text-sm ${message.role === 'user' ? 'ml-6 bg-accent text-accent-foreground' : 'mr-2 bg-surface-secondary text-foreground'}`}>
                  <p className='whitespace-pre-wrap break-words [overflow-wrap:anywhere]'>{message.content}</p>
                  {message.reply?.items && <ul className='mt-2 space-y-2'>
                    {message.reply.items.map((item, i) => <li key={i} className='break-words [overflow-wrap:anywhere]'>{item.path ? <Link to={item.path} onClick={() => setOpen(false)} className='inline-flex min-h-11 items-center underline'>{item.text}</Link> : item.text}</li>)}
                  </ul>}
                  {message.reply?.actions && <div className='mt-3 flex flex-wrap gap-2'>{actions(message.reply)}</div>}
                  {message.draft && <div className='mt-3 border-t border-separator pt-3'>
                    <p className='font-medium'>Project suggestion</p><p className='mt-1 text-xs text-muted'>Not saved. Review before filling empty fields.</p>
                    {!message.reviewed ? <Button variant='secondary' className='mt-2 min-h-11' onPress={() => {
                      if (currentOwner() && currentOwner() === ownerRef.current && message.owner === currentOwner() && message.generation === epoch.current) setMessages(previous => previous.map((entry, i) => i === index ? { ...entry, reviewed: true } : entry));
                    }}>Review suggestion</Button> : <>
                      <dl className='mt-3 space-y-3'>
                        {Object.entries(message.draft).map(([field, value]) => <div key={field}><dt className='text-xs font-medium text-muted'>{({ title: 'Title', description: 'Description', scope: 'Scope', deliverables: 'Deliverables', evaluationCriteria: 'Evaluation criteria', projectField: 'Project field', tools: 'Tools' } as Record<string, string>)[field]}</dt><dd className='mt-1 whitespace-pre-wrap break-words [overflow-wrap:anywhere]'>{Array.isArray(value) ? value.join(', ') : value}</dd></div>)}
                      </dl>
                      {message.filled ? <p className='mt-3 text-xs'>Empty fields filled. Save in the form when ready.</p> : onProjectForm
                        ? <Button variant='secondary' className='mt-3 min-h-11' onPress={() => prefill(index)}>Fill empty fields</Button>
                        : <Link to='/company/projects/new' onClick={() => setOpen(false)} className='mt-3 inline-flex min-h-11 items-center underline'>Open project form</Link>}
                    </>}
                  </div>}
                </div>
              ))}
              {loading && <p role='status' className='text-sm text-muted'>Checking your request...</p>}
              <div ref={bottomRef} />
            </div>
            <div className='shrink-0 border-t border-border p-3'>
              <div className='mb-3 flex max-h-24 flex-wrap gap-2 overflow-y-auto' aria-label='Quick help'>{actions(help)}</div>
              <div className='flex items-end gap-2'>
                <TextArea ref={inputRef} aria-label='Message' autoFocus value={input} onChange={event => setInput(event.target.value)} onKeyDown={event => {
                  if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); void send(); }
                }} placeholder='Ask about TalentBridge' maxLength={2000} rows={1} fullWidth className='max-h-24 min-h-11 flex-1 resize-none overflow-y-auto' />
                <Button isIconOnly variant='primary' onPress={() => void send()} aria-label='Send message' isDisabled={!input.trim() || loading} className='min-h-11 min-w-11 shrink-0'><Send size={16} /></Button>
              </div>
            </div>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}
