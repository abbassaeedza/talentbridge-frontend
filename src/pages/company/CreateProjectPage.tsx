import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { projectApi } from '../../api/services';
import { Plus, X, Lightbulb, Tag } from 'lucide-react';
import toast from 'react-hot-toast';

const TOOL_SUGGESTIONS = [
  'React',
  'TypeScript',
  'Python',
  'Node.js',
  'Java',
  'Spring Boot',
  'PostgreSQL',
  'MongoDB',
  'Docker',
  'AWS',
  'TensorFlow',
  'PyTorch',
  'Vue.js',
  'GraphQL',
  'Redis',
];

export default function CreateProjectPage() {
  const navigate = useNavigate();
  const [tools, setTools] = useState<string[]>([]);
  const [toolInput, setToolInput] = useState('');
  const [form, setForm] = useState({
    title: '',
    description: '',
    scope: '',
    deliverables: '',
    evaluationCriteria: '',
    deadline: '',
    internalName: '',
  });

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const addTool = (t: string) => {
    const s = t.trim();
    if (s && !tools.includes(s)) setTools((p) => [...p, s]);
    setToolInput('');
  };

  const mutation = useMutation({
    mutationFn: () =>
      projectApi.create({
        ...form,
        tools,
        deadline: form.deadline
          ? new Date(form.deadline).toISOString()
          : undefined,
      }),
    onSuccess: () => {
      toast.success('Project submitted for review!');
      navigate('/company/dashboard');
    },
    onError: (e: any) =>
      toast.error(e?.response?.data?.message || 'Failed to create project'),
  });

  return (
    <div className='animate-fade-up max-w-2xl'>
      <div className='page-header'>
        <h1 className='page-title'>Post a New Project</h1>
        <p className='page-subtitle'>
          Your project will be reviewed by a coordinator before going live.
        </p>
      </div>

      {/* AI tip */}
      <div className='mb-6 p-4 rounded-2xl bg-ember-500/8 border border-ember-500/20 flex items-start gap-3'>
        <Lightbulb size={18} className='text-ember-400 flex-shrink-0 mt-0.5' />
        <p className='text-xs text-ink-300'>
          <span className='font-semibold text-ember-300'>Tip:</span> Use the AI
          assistant (bottom right) to help you write a clear, compelling project
          description and evaluation criteria.
        </p>
      </div>

      <div className='space-y-5'>
        {/* Internal name — first field, prominent */}
        <div className='p-4 rounded-2xl bg-ember-500/5 border border-ember-500/20'>
          <label className='flex items-center gap-1.5 text-[10px] font-bold text-ember-400 uppercase tracking-widest mb-2'>
            <Tag size={10} /> Internal Reference Name (optional)
          </label>
          <input
            className='input'
            value={form.internalName}
            onChange={(e) => set('internalName', e.target.value)}
            placeholder='e.g. Q3-AI-Project, Client-ABC-2026…'
          />
          <p className='text-[10px] text-ink-500 mt-1.5'>
            Only visible to you — students and coordinators never see this.
          </p>
        </div>

        <div>
          <label className='input-label'>Project Title *</label>
          <input
            className='input'
            value={form.title}
            onChange={(e) => set('title', e.target.value)}
            placeholder='e.g. AI-Powered Customer Support Chatbot'
            required
          />
        </div>

        <div>
          <label className='input-label'>Project Description *</label>
          <textarea
            className='textarea'
            rows={4}
            value={form.description}
            onChange={(e) => set('description', e.target.value)}
            placeholder='What is the project about? What problem does it solve?'
            required
          />
        </div>

        <div>
          <label className='input-label'>Project Scope</label>
          <textarea
            className='textarea'
            rows={3}
            value={form.scope}
            onChange={(e) => set('scope', e.target.value)}
            placeholder='What exactly should students build? What are the boundaries of the project?'
          />
        </div>

        <div>
          <label className='input-label'>Expected Deliverables</label>
          <textarea
            className='textarea'
            rows={3}
            value={form.deliverables}
            onChange={(e) => set('deliverables', e.target.value)}
            placeholder='What should students submit? (e.g. working web app, GitHub repo, documentation, demo video)'
          />
        </div>

        <div>
          <label className='input-label'>Evaluation Criteria</label>
          <textarea
            className='textarea'
            rows={3}
            value={form.evaluationCriteria}
            onChange={(e) => set('evaluationCriteria', e.target.value)}
            placeholder='How will the project be evaluated? What makes a successful submission?'
          />
        </div>

        {/* Tools */}
        <div>
          <label className='input-label'>Required Technologies / Tools</label>
          <div className='flex gap-2 mb-2'>
            <input
              className='input flex-1'
              value={toolInput}
              onChange={(e) => setToolInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addTool(toolInput);
                }
              }}
              placeholder='e.g. React, Python…'
            />
            <button
              type='button'
              onClick={() => addTool(toolInput)}
              className='btn-secondary px-3'
            >
              <Plus size={15} />
            </button>
          </div>
          {/* Suggestions */}
          <div className='flex flex-wrap gap-1.5 mb-3'>
            {TOOL_SUGGESTIONS.filter((t) => !tools.includes(t))
              .slice(0, 8)
              .map((t) => (
                <button
                  key={t}
                  type='button'
                  onClick={() => addTool(t)}
                  className='px-2.5 py-1 rounded-lg bg-ink-800 border border-ink-700/50 text-ink-400 hover:text-ink-200 hover:border-ink-500 text-xs transition-colors'
                >
                  + {t}
                </button>
              ))}
          </div>
          {tools.length > 0 && (
            <div className='flex flex-wrap gap-1.5'>
              {tools.map((t) => (
                <span
                  key={t}
                  className='flex items-center gap-1 px-2.5 py-1 rounded-lg bg-ember-500/15 border border-ember-500/30 text-ember-300 text-xs font-medium'
                >
                  {t}
                  <button
                    type='button'
                    onClick={() => setTools((p) => p.filter((x) => x !== t))}
                  >
                    <X size={11} />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        <div>
          <label className='input-label'>Application Deadline (optional)</label>
          <input
            type='datetime-local'
            className='input'
            value={form.deadline}
            onChange={(e) => set('deadline', e.target.value)}
          />
        </div>

        <div className='flex gap-3 pt-2'>
          <button
            type='button'
            onClick={() => navigate(-1)}
            className='btn-secondary'
          >
            Cancel
          </button>
          <button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending || !form.title || !form.description}
            className='btn-primary flex-1'
          >
            {mutation.isPending ? (
              <span className='w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin' />
            ) : (
              'Submit for Review'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
