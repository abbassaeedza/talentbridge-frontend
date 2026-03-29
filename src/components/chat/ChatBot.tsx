import { useState, useRef, useEffect } from 'react';
import { MessageCircle, X, Send, Bot, Minimize2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { chatApi } from '../../api/services';
import { useAuth } from '../../contexts/AuthContext';
import type { ChatMessage } from '../../types';
import clsx from 'clsx';

export default function ChatBot() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const context =
    user?.role === 'COMPANY'
      ? 'COMPANY_PROJECT_CREATION'
      : 'STUDENT_PROJECT_INQUIRY';
  const greeting =
    user?.role === 'COMPANY'
      ? "Hi! I'm here to help you create a compelling project listing. What kind of project are you looking for student teams to work on?"
      : "Hey! I can help you understand projects, break down technical requirements, or answer any questions. What's on your mind?";

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
    const history = messages.filter((m, i) => i > 0);
    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);
    try {
      const { data } = await chatApi.send(text, history, context);
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: data.message },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: 'Sorry, I ran into an error. Please try again.',
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
      {/* Floating button — lower z than modals, higher than content */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className='fixed bottom-6 right-6 w-12 h-12 bg-ember-500 hover:bg-ember-600 text-white rounded-2xl shadow-xl shadow-ember-500/30 flex items-center justify-center transition-all duration-200 hover:scale-105 active:scale-95 z-30'
        >
          <MessageCircle size={20} />
        </button>
      )}

      {/* Chat panel — z-30 so modals at z-50 always appear on top */}
      {open && (
        <div className='fixed bottom-6 right-6 w-[360px] h-[500px] flex flex-col bg-ink-900 border border-ink-700/50 rounded-2xl shadow-2xl shadow-black/50 z-30 overflow-hidden'>
          {/* Header */}
          <div className='flex items-center gap-3 px-4 py-3 border-b border-ink-700/50 flex-shrink-0'>
            <div className='w-7 h-7 rounded-xl bg-ember-500/20 border border-ember-500/30 flex items-center justify-center'>
              <Bot size={14} className='text-ember-400' />
            </div>
            <div className='flex-1'>
              <p className='text-sm font-semibold text-white'>AI Assistant</p>
              <p className='text-[10px] text-ink-500'>
                {user?.role === 'COMPANY'
                  ? 'Project creation helper'
                  : 'Project Q&A'}
              </p>
            </div>
            <div className='flex gap-1'>
              <button
                onClick={() => setMessages([])}
                className='w-7 h-7 rounded-lg hover:bg-ink-700 flex items-center justify-center text-ink-500 hover:text-ink-300 transition-colors'
              >
                <Minimize2 size={13} />
              </button>
              <button
                onClick={() => setOpen(false)}
                className='w-7 h-7 rounded-lg hover:bg-ink-700 flex items-center justify-center text-ink-500 hover:text-ink-300 transition-colors'
              >
                <X size={13} />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className='flex-1 overflow-y-auto p-4 space-y-3'>
            {messages.map((m, i) => (
              <div
                key={i}
                className={clsx(
                  'flex gap-2',
                  m.role === 'user' && 'flex-row-reverse',
                )}
              >
                {m.role === 'assistant' && (
                  <div className='w-5 h-5 rounded-md bg-ember-500/20 border border-ember-500/30 flex items-center justify-center flex-shrink-0 mt-1'>
                    <Bot size={11} className='text-ember-400' />
                  </div>
                )}
                <div
                  className={clsx(
                    'max-w-[85%] px-3 py-2 rounded-xl text-sm',
                    m.role === 'user'
                      ? 'bg-ember-500 text-white rounded-tr-sm'
                      : 'bg-ink-800 border border-ink-700/50 text-ink-200 rounded-tl-sm',
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
                <div className='w-5 h-5 rounded-md bg-ember-500/20 border border-ember-500/30 flex items-center justify-center flex-shrink-0'>
                  <Bot size={11} className='text-ember-400' />
                </div>
                <div className='bg-ink-800 border border-ink-700/50 rounded-xl rounded-tl-sm px-3 py-2.5'>
                  <div className='flex gap-1 items-center'>
                    <div
                      className='w-1.5 h-1.5 rounded-full bg-ink-400 animate-bounce'
                      style={{ animationDelay: '0ms' }}
                    />
                    <div
                      className='w-1.5 h-1.5 rounded-full bg-ink-400 animate-bounce'
                      style={{ animationDelay: '150ms' }}
                    />
                    <div
                      className='w-1.5 h-1.5 rounded-full bg-ink-400 animate-bounce'
                      style={{ animationDelay: '300ms' }}
                    />
                  </div>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className='p-3 border-t border-ink-700/50 flex-shrink-0'>
            <div className='flex gap-2 items-end'>
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKey}
                placeholder='Ask anything…'
                rows={1}
                className='flex-1 bg-ink-800 border border-ink-600/50 rounded-xl px-3 py-2 text-sm text-ink-100 placeholder:text-ink-500 focus:outline-none focus:ring-2 focus:ring-ember-500/40 resize-none'
                style={{ maxHeight: 72, overflowY: 'auto' }}
              />
              <button
                onClick={send}
                disabled={!input.trim() || loading}
                className='w-8 h-8 bg-ember-500 hover:bg-ember-600 disabled:opacity-40 text-white rounded-xl flex items-center justify-center transition-all flex-shrink-0'
              >
                <Send size={13} />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
