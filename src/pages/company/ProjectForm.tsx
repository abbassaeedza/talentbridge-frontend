import { useState, type FormEvent } from 'react';
import { Plus, Tag, X } from 'lucide-react';
import clsx from 'clsx';
import { PROJECT_FIELDS, type Project } from '../../types';

const TOOL_SUGGESTIONS = [
  'React', 'TypeScript', 'Python', 'Node.js', 'Java', 'Spring Boot',
  'PostgreSQL', 'MongoDB', 'Docker', 'AWS', 'TensorFlow', 'PyTorch',
  'Vue.js', 'GraphQL', 'Redis',
];

export type ProjectFormData = Record<string, unknown> & {
  title: string;
  description: string;
};

type Props = {
  initial?: Project;
  pending: boolean;
  submitLabel: string;
  pendingLabel?: string;
  internalNameHelp: string;
  onSubmit: (data: ProjectFormData) => void;
  onCancel: () => void;
};

export default function ProjectForm({
  initial,
  pending,
  submitLabel,
  pendingLabel,
  internalNameHelp,
  onSubmit,
  onCancel,
}: Props) {
  const initialField = initial?.projectField ?? '';
  const knownField = (PROJECT_FIELDS as readonly string[]).includes(initialField);
  const [tools, setTools] = useState<string[]>(initial?.tools ?? []);
  const [toolInput, setToolInput] = useState('');
  const [selectedField, setSelectedField] = useState(knownField ? initialField : initialField ? 'Other' : '');
  const [customField, setCustomField] = useState(knownField ? '' : initialField);
  const [form, setForm] = useState({
    title: initial?.title ?? '',
    description: initial?.description ?? '',
    scope: initial?.scope ?? '',
    deliverables: initial?.deliverables ?? '',
    evaluationCriteria: initial?.evaluationCriteria ?? '',
    deadline: initial?.deadline ? new Date(initial.deadline).toISOString().slice(0, 16) : '',
    internalName: initial?.internalName ?? '',
  });

  const set = (key: keyof typeof form, value: string) => setForm((current) => ({ ...current, [key]: value }));
  const addTool = (tool: string) => {
    const value = tool.trim();
    if (value && !tools.includes(value)) setTools((current) => [...current, value]);
    setToolInput('');
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const projectField = selectedField === 'Other' ? customField.trim() || undefined : selectedField || undefined;
    onSubmit({
      ...form,
      tools,
      projectField,
      deadline: form.deadline ? new Date(form.deadline).toISOString() : undefined,
    });
  };

  return (
    <form className='space-y-5' onSubmit={submit}>
      <div className='p-4 rounded-2xl bg-ember-500/5 border border-ember-500/20'>
        <label className='flex items-center gap-1.5 text-[10px] font-bold text-ember-400 uppercase tracking-widest mb-2'>
          <Tag size={10} /> Internal Reference Name (optional)
        </label>
        <input className='input' value={form.internalName} onChange={(e) => set('internalName', e.target.value)}
          placeholder='e.g. Q3-AI-Project, Client-ABC-2026…' />
        <p className='text-[10px] text-ink-500 mt-1.5'>{internalNameHelp}</p>
      </div>

      <div>
        <label className='input-label'>Project Title *</label>
        <input className='input' value={form.title} onChange={(e) => set('title', e.target.value)}
          placeholder='e.g. AI-Powered Customer Support Chatbot' required />
      </div>

      <div>
        <label className='input-label'>Project Description *</label>
        <textarea className='textarea' rows={4} value={form.description} onChange={(e) => set('description', e.target.value)}
          placeholder='What is the project about? What problem does it solve?' required />
      </div>

      <div>
        <label className='input-label'>Project Scope</label>
        <textarea className='textarea' rows={3} value={form.scope} onChange={(e) => set('scope', e.target.value)}
          placeholder='What exactly should students build? What are the boundaries?' />
      </div>

      <div>
        <label className='input-label'>Expected Deliverables</label>
        <textarea className='textarea' rows={3} value={form.deliverables} onChange={(e) => set('deliverables', e.target.value)}
          placeholder='What should students submit? (e.g. working web app, GitHub repo, documentation)' />
      </div>

      <div>
        <label className='input-label'>Evaluation Criteria</label>
        <textarea className='textarea' rows={3} value={form.evaluationCriteria} onChange={(e) => set('evaluationCriteria', e.target.value)}
          placeholder='How will the project be evaluated? What makes a successful submission?' />
      </div>

      <div>
        <label className='input-label'>Project Field</label>
        <div className='flex flex-wrap gap-2 mb-2'>
          {PROJECT_FIELDS.map((field) => (
            <button key={field} type='button'
              onClick={() => { setSelectedField(field); if (field !== 'Other') setCustomField(''); }}
              className={clsx('px-3 py-1.5 rounded-xl text-xs font-medium border transition-colors',
                selectedField === field
                  ? 'bg-ember-500/20 border-ember-500/40 text-ember-300'
                  : 'bg-ink-800 border-ink-700/50 text-ink-400 hover:text-ink-200 hover:border-ink-500')}
            >
              {field}
            </button>
          ))}
        </div>
        {selectedField === 'Other' && (
          <input className='input' value={customField} onChange={(e) => setCustomField(e.target.value)}
            placeholder='Specify the project field…' />
        )}
      </div>

      <div>
        <label className='input-label'>Required Technologies / Tools</label>
        <div className='flex gap-2 mb-2'>
          <input className='input flex-1' value={toolInput} onChange={(e) => setToolInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTool(toolInput); } }}
            placeholder='e.g. React, Python…' />
          <button type='button' onClick={() => addTool(toolInput)} className='btn-secondary px-3'>
            <Plus size={15} />
          </button>
        </div>
        <div className='flex flex-wrap gap-1.5 mb-3'>
          {TOOL_SUGGESTIONS.filter((tool) => !tools.includes(tool)).slice(0, 8).map((tool) => (
            <button key={tool} type='button' onClick={() => addTool(tool)}
              className='px-2.5 py-1 rounded-lg bg-ink-800 border border-ink-700/50 text-ink-400 hover:text-ink-200 hover:border-ink-500 text-xs transition-colors'>
              + {tool}
            </button>
          ))}
        </div>
        {tools.length > 0 && (
          <div className='flex flex-wrap gap-1.5'>
            {tools.map((tool) => (
              <span key={tool} className='flex items-center gap-1 px-2.5 py-1 rounded-lg bg-ember-500/15 border border-ember-500/30 text-ember-300 text-xs font-medium'>
                {tool}
                <button type='button' onClick={() => setTools((current) => current.filter((item) => item !== tool))}>
                  <X size={11} />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      <div>
        <label className='input-label'>Application Deadline (optional)</label>
        <input type='datetime-local' className='input' value={form.deadline} onChange={(e) => set('deadline', e.target.value)} />
      </div>

      <div className='flex gap-3 pt-2'>
        <button type='button' onClick={onCancel} className='btn-secondary'>Cancel</button>
        <button type='submit' disabled={pending || !form.title || !form.description} className='btn-primary flex-1'>
          {pending
            ? <><span className='w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin' /> {pendingLabel}</>
            : submitLabel}
        </button>
      </div>
    </form>
  );
}
