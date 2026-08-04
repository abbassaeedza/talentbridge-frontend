import { useEffect, useState, type FormEvent } from 'react';
import { Plus, Tag, X } from 'lucide-react';
import clsx from 'clsx';
import { PROJECT_FIELDS, type Project, type ProjectDraft } from '../../types';
import { useQuery } from '@tanstack/react-query';
import { projectSupervisorInvitationApi } from '../../api/services';

const TOOL_SUGGESTIONS = [
  'React', 'TypeScript', 'Python', 'Node.js', 'Java', 'Spring Boot',
  'PostgreSQL', 'MongoDB', 'Docker', 'AWS', 'TensorFlow', 'PyTorch',
  'Vue.js', 'GraphQL', 'Redis',
];

const LIMITS = {
  title: 100,
  text: 2000,
  short: 100,
  tools: 20,
};

function Count({ value, max }: { value: string; max: number }) {
  return <p className='mt-1 text-right text-[10px] text-ink-500'>{value.length}/{max}</p>;
}

export type ProjectFormData = Record<string, unknown> & {
  title: string;
  description: string;
  saveAsDraft?: boolean;
};

type Props = {
  initial?: Project;
  pending: boolean;
  submitLabel: string;
  pendingLabel?: string;
  internalNameHelp: string;
  onSubmit: (data: ProjectFormData) => void;
  onSaveDraft?: (data: ProjectFormData) => void;
  onCancel: () => void;
};

export default function ProjectForm({
  initial,
  pending,
  submitLabel,
  pendingLabel,
  internalNameHelp,
  onSubmit,
  onSaveDraft,
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
    deadline: initial?.deadline?.slice(0, 16) ?? '',
    internalName: initial?.internalName ?? '',
    projectSupervisorId: initial?.projectSupervisorId ?? '',
  });

  useEffect(() => {
    const populateDraft = (event: Event) => {
      const draft = (event as CustomEvent<ProjectDraft>).detail;
      if (!draft) return;
      const text = (value: unknown, max: number) =>
        typeof value === 'string' ? value.slice(0, max) : '';

      setForm((current) => ({
        ...current,
        title: current.title || text(draft.title, LIMITS.title),
        description: current.description || text(draft.description, LIMITS.text),
        scope: current.scope || text(draft.scope, LIMITS.text),
        deliverables: current.deliverables || text(draft.deliverables, LIMITS.text),
        evaluationCriteria: current.evaluationCriteria || text(draft.evaluationCriteria, LIMITS.text),
      }));
      setTools((current) => current.length > 0 ? current : (draft.tools ?? [])
        .filter((tool): tool is string => typeof tool === 'string' && !!tool.trim())
        .map((tool) => tool.trim().slice(0, LIMITS.short))
        .filter((tool, index, values) => values.indexOf(tool) === index)
        .slice(0, LIMITS.tools));
      setSelectedField((current) => {
        if (current) return current;
        const field = text(draft.projectField, LIMITS.short);
        if (!field) return current;
        if ((PROJECT_FIELDS as readonly string[]).includes(field)) return field;
        setCustomField((custom) => custom || field);
        return 'Other';
      });
    };

    window.addEventListener('talentbridge:project-draft', populateDraft);
    return () => window.removeEventListener('talentbridge:project-draft', populateDraft);
  }, []);

  const set = (key: keyof typeof form, value: string) => setForm((current) => ({ ...current, [key]: value }));
  const addTool = (tool: string) => {
    const value = tool.trim();
    if (value && value.length <= LIMITS.short && tools.length < LIMITS.tools && !tools.includes(value))
      setTools((current) => [...current, value]);
    setToolInput('');
  };

  const data = (): ProjectFormData => {
    const projectField = selectedField === 'Other' ? customField.trim() || undefined : selectedField || undefined;
    return {
      ...form,
      tools,
      projectField,
      deadline: form.deadline || undefined,
      projectSupervisorId: form.projectSupervisorId || undefined,
    };
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    onSubmit(data());
  };

  return (
    <form className='space-y-5' onSubmit={submit}>
      <div className='p-4 rounded-2xl bg-ember-500/5 border border-ember-500/20'>
        <label className='flex items-center gap-1.5 text-[10px] font-bold text-ember-400 uppercase tracking-widest mb-2'>
          <Tag size={10} /> Internal Reference Name (optional)
        </label>
        <input className='input' maxLength={LIMITS.short} value={form.internalName} onChange={(e) => set('internalName', e.target.value)}
          placeholder='e.g. Q3-AI-Project, Client-ABC-2026…' />
        <Count value={form.internalName} max={LIMITS.short} />
        <p className='text-[10px] text-ink-500 mt-1.5'>{internalNameHelp}</p>
      </div>

      <div>
        <label className='input-label' htmlFor='projectTitle'>Project Title *</label>
        <input id='projectTitle' className='input' maxLength={LIMITS.title} value={form.title} onChange={(e) => set('title', e.target.value)}
          placeholder='e.g. AI-Powered Customer Support Chatbot' required />
        <Count value={form.title} max={LIMITS.title} />
      </div>

      <div>
        <label className='input-label' htmlFor='projectDescription'>Project Description *</label>
        <textarea id='projectDescription' className='textarea' maxLength={LIMITS.text} rows={4} value={form.description} onChange={(e) => set('description', e.target.value)}
          placeholder='What is the project about? What problem does it solve?' required />
        <Count value={form.description} max={LIMITS.text} />
      </div>

      <div>
        <label className='input-label'>Project Scope</label>
        <textarea className='textarea' maxLength={LIMITS.text} rows={3} value={form.scope} onChange={(e) => set('scope', e.target.value)}
          placeholder='What exactly should students build? What are the boundaries?' />
        <Count value={form.scope} max={LIMITS.text} />
      </div>

      <div>
        <label className='input-label'>Expected Deliverables</label>
        <textarea className='textarea' maxLength={LIMITS.text} rows={3} value={form.deliverables} onChange={(e) => set('deliverables', e.target.value)}
          placeholder='What should students submit? (e.g. working web app, GitHub repo, documentation)' />
        <Count value={form.deliverables} max={LIMITS.text} />
      </div>

      <div>
        <label className='input-label'>Evaluation Criteria</label>
        <textarea className='textarea' maxLength={LIMITS.text} rows={3} value={form.evaluationCriteria} onChange={(e) => set('evaluationCriteria', e.target.value)}
          placeholder='How will the project be evaluated? What makes a successful submission?' />
        <Count value={form.evaluationCriteria} max={LIMITS.text} />
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
          <input className='input' maxLength={LIMITS.short} value={customField} onChange={(e) => setCustomField(e.target.value)}
            placeholder='Specify the project field…' />
        )}
      </div>

      <div>
        <label className='input-label'>Required Technologies / Tools</label>
        <div className='flex gap-2 mb-2'>
          <input className='input flex-1' maxLength={LIMITS.short} value={toolInput} onChange={(e) => setToolInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTool(toolInput); } }}
            placeholder='e.g. React, Python…' />
          <button type='button' disabled={tools.length >= LIMITS.tools} onClick={() => addTool(toolInput)} className='btn-secondary px-3'>
            <Plus size={15} />
          </button>
        </div>
        <div className='flex flex-wrap gap-1.5 mb-3'>
          {TOOL_SUGGESTIONS.filter((tool) => !tools.includes(tool)).slice(0, 8).map((tool) => (
            <button key={tool} type='button' disabled={tools.length >= LIMITS.tools} onClick={() => addTool(tool)}
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
        <p className='mt-1 text-right text-[10px] text-ink-500'>{tools.length}/{LIMITS.tools} tools</p>
      </div>

      <div>
        <label className='input-label'>Application Deadline (optional)</label>
        <input type='datetime-local' className='input' value={form.deadline} onChange={(e) => set('deadline', e.target.value)} />
      </div>

      <SupervisorSelect value={form.projectSupervisorId} onChange={(value) => set('projectSupervisorId', value)} />

      <div className='flex flex-col gap-3 pt-2 sm:flex-row'>
        <button type='button' onClick={onCancel} className='btn-secondary'>Cancel</button>
        {onSaveDraft && (
          <button type='button' onClick={() => onSaveDraft({ ...data(), saveAsDraft: true })} disabled={pending || !form.title || !form.description} className='btn-secondary flex-1'>
            Save as Draft
          </button>
        )}
        <button type='submit' disabled={pending || !form.title || !form.description} className='btn-primary flex-1'>
          {pending
            ? <><span className='w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin' /> {pendingLabel}</>
            : submitLabel}
        </button>
      </div>
    </form>
  );
}

function SupervisorSelect({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const { data: supervisors = [] } = useQuery({
    queryKey: ['accepted-project-supervisors'],
    queryFn: () => projectSupervisorInvitationApi.listAccepted().then((response) => response.data),
  });

  return (
    <div>
      <label className='input-label' htmlFor='projectSupervisorId'>Project supervisor (optional)</label>
      <select id='projectSupervisorId' className='input' value={value} onChange={(event) => onChange(event.target.value)}>
        <option value=''>No project supervisor</option>
        {supervisors.filter((supervisor) => supervisor.status === 'APPROVED').map((supervisor) => (
          <option key={supervisor.id} value={supervisor.id}>{supervisor.firstName} {supervisor.lastName} - {supervisor.supervisorProfile?.jobTitle ?? supervisor.email}</option>
        ))}
      </select>
    </div>
  );
}
