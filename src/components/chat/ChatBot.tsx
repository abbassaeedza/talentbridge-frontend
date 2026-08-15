import { useState, useRef, useEffect } from 'react';
import { MessageCircle, X, Send, Bot, Minimize2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { chatApi, projectApi } from '../../api/services';
import { useAuth } from '../../contexts/AuthContext';
import type { ChatMessage } from '../../types';
import clsx from 'clsx';
import { Button } from '@heroui/react/button';
import { Surface } from '@heroui/react/surface';
import { TextArea } from '@heroui/react/textarea';
import { useLocation } from 'react-router-dom';

export default function ChatBot() {
  const { user } = useAuth();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [draftProjectId, setDraftProjectId] = useState<string>();
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const context = user?.role === 'COMPANY' && location.pathname === '/company/projects/new'
    ? 'COMPANY_PROJECT_CREATION'
    : user?.role ?? 'STUDENT';
  const copy = user?.role === 'COMPANY'
    ? {
        greeting: 'Ask about company projects, supervisors, applications, submissions, or create a project draft.',
        subtitle: 'Company access',
      }
    : user?.role === 'COORDINATOR'
      ? {
          greeting: 'Ask about TalentBridge users, approvals, projects, parties, deadlines, or evaluations.',
          subtitle: 'Coordinator access',
        }
      : user?.role === 'PARTY_SUPERVISOR'
        ? {
            greeting: 'Ask about your parties, projects, applications, submissions, or evaluations.',
            subtitle: 'Party supervisor access',
          }
        : user?.role === 'PROJECT_SUPERVISOR'
          ? {
              greeting: 'Ask about supervised projects, assigned parties, submissions, or evaluations.',
              subtitle: 'Project supervisor access',
            }
          : {
              greeting: 'Ask about projects, your party, applications, submission, deadlines, or scorecard.',
              subtitle: 'Student access',
            };
  const greeting = copy.greeting;

  useEffect(() => {
    if (open && messages.length === 0)
      setMessages([{ role: 'assistant', content: greeting }]);
  }, [open]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput('');
    const userMsg: ChatMessage = { role: 'user', content: text };
    const history = messages.filter((_, index) => index > 0).slice(-10);
    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);
    try {
      const { data } = await chatApi.send(text, history, context);
      let assistantMessage = data.message;
      if (data.projectDraft && Object.keys(data.projectDraft).length > 0) {
        window.dispatchEvent(new CustomEvent('talentbridge:project-draft', {
          detail: data.projectDraft,
        }));
        const { title, description } = data.projectDraft;
        if (user?.role === 'COMPANY' && title?.trim() && description?.trim()) {
          const response = draftProjectId
            ? await projectApi.update(draftProjectId, { ...data.projectDraft, saveAsDraft: true })
            : await projectApi.create({ ...data.projectDraft, saveAsDraft: true });
          setDraftProjectId(response.data.id);
          assistantMessage += `\n\n[Open saved draft](/company/projects/${response.data.id})`;
        }
      }
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: assistantMessage },
      ]);
    } catch (error: any) {
      const backendMessage = error?.response?.data?.message;
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: typeof backendMessage === 'string' && backendMessage.trim()
            ? backendMessage
            : 'Sorry, I ran into an error. Please try again.',
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  return (
    <>
      {!open && (
        <Button
          isIconOnly
          size='lg'
          variant='primary'
          onPress={() => setOpen(true)}
          aria-label='Open AI assistant'
          className='fixed bottom-4 right-4 z-30 shadow-lg sm:bottom-6 sm:right-6'
        >
          <MessageCircle size={20} />
        </Button>
      )}

      {open && (
        <Surface data-testid='chat-panel' className='fixed inset-0 z-[80] flex h-dvh flex-col overflow-hidden border border-border shadow-2xl sm:inset-auto sm:bottom-6 sm:right-6 sm:h-[min(600px,calc(100dvh-3rem))] sm:w-[400px] sm:rounded-lg'>
          <div className='flex shrink-0 items-center gap-3 border-b border-border px-4 py-3'>
            <div className='flex size-8 items-center justify-center rounded-md bg-default text-foreground'>
              <Bot size={16} />
            </div>
            <div className='flex-1'>
              <p className='text-sm font-semibold'>TalentBridge assistant</p>
              <p className='text-xs text-muted'>{copy.subtitle}</p>
            </div>
            <div className='flex gap-1'>
              <Button
                isIconOnly
                size='sm'
                variant='ghost'
                onPress={() => setMessages([])}
                aria-label='Clear conversation'
              >
                <Minimize2 size={16} />
              </Button>
              <Button
                isIconOnly
                size='sm'
                variant='ghost'
                onPress={() => setOpen(false)}
                aria-label='Close AI assistant'
              >
                <X size={16} />
              </Button>
            </div>
          </div>

          <div className='flex-1 space-y-4 overflow-y-auto p-4'>
            {messages.map((m, i) => (
              <div
                key={i}
                className={clsx(
                  'flex gap-2',
                  m.role === 'user' && 'flex-row-reverse',
                )}
              >
                {m.role === 'assistant' && (
                  <div className='mt-1 flex size-6 shrink-0 items-center justify-center rounded-md bg-default'>
                    <Bot size={13} />
                  </div>
                )}
                <div
                  className={clsx(
                    'max-w-[85%] rounded-lg px-3 py-2 text-sm',
                    m.role === 'user'
                      ? 'bg-accent text-accent-foreground'
                      : 'border border-border bg-surface-secondary text-foreground',
                  )}
                >
                  {m.role === 'assistant' ? (
                    <div className='prose-chat'>
                      <ReactMarkdown>{m.content}</ReactMarkdown>
                    </div>
                  ) : (
                    <p className='whitespace-pre-wrap'>{m.content}</p>
                  )}
                </div>
              </div>
            ))}
            {loading && (
              <div className='flex gap-2'>
                <div className='flex size-6 shrink-0 items-center justify-center rounded-md bg-default'>
                  <Bot size={13} />
                </div>
                <div className='rounded-lg border border-border bg-surface-secondary px-3 py-2.5'>
                  <div className='flex gap-1 items-center'>
                    <div
                      className='size-1.5 animate-bounce rounded-full bg-muted'
                      style={{ animationDelay: '0ms' }}
                    />
                    <div
                      className='size-1.5 animate-bounce rounded-full bg-muted'
                      style={{ animationDelay: '150ms' }}
                    />
                    <div
                      className='size-1.5 animate-bounce rounded-full bg-muted'
                      style={{ animationDelay: '300ms' }}
                    />
                  </div>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          <div className='shrink-0 border-t border-border p-3'>
            <div className='flex gap-2 items-end'>
              <TextArea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKey}
                placeholder='Ask about TalentBridge'
                maxLength={2000}
                rows={1}
                fullWidth
                className='min-h-11 flex-1 resize-none'
                style={{ maxHeight: 72, overflowY: 'auto' }}
              />
              <Button
                isIconOnly
                variant='primary'
                onPress={send}
                aria-label='Send message'
                isDisabled={!input.trim() || loading}
                className='shrink-0'
              >
                <Send size={16} />
              </Button>
            </div>
          </div>
        </Surface>
      )}
    </>
  );
}
