import { useEffect, useState, type FormEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus, X } from 'lucide-react';
import clsx from 'clsx';
import { Button } from '@heroui/react/button';
import { Input } from '@heroui/react/input';
import { Label } from '@heroui/react/label';
import { ListBox } from '@heroui/react/list-box';
import { Select } from '@heroui/react/select';
import { Spinner } from '@heroui/react/spinner';
import { TextArea } from '@heroui/react/textarea';
import { TextField } from '@heroui/react/textfield';
import { projectSupervisorInvitationApi } from '../../api/services';
import { PROJECT_FIELDS, type Project, type ProjectDraft } from '../../types';

const TOOL_SUGGESTIONS = [
  'React', 'TypeScript', 'Python', 'Node.js', 'Java', 'Spring Boot',
  'PostgreSQL', 'MongoDB', 'Docker', 'AWS', 'TensorFlow', 'PyTorch',
  'Vue.js', 'GraphQL', 'Redis',
];

const LIMITS = { title: 100, text: 2000, short: 100, tools: 20 };

function Count({ value, max }: { value: string; max: number }) {
  return <p className='mt-1 text-right text-[11px] text-muted'>{value.length}/{max}</p>;
}

function TextInput({
  label,
  value,
  onChange,
  maxLength,
  placeholder,
  required = false,
  type = 'text',
  description,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  maxLength?: number;
  placeholder?: string;
  required?: boolean;
  type?: string;
  description?: string;
}) {
  return (
    <TextField fullWidth isRequired={required}>
      <Label>{label}</Label>
      <Input fullWidth type={type} value={value} onChange={(event) => onChange(event.target.value)} maxLength={maxLength} placeholder={placeholder} />
      {maxLength && <Count value={value} max={maxLength} />}
      {description && <p className='mt-1 text-xs text-muted'>{description}</p>}
    </TextField>
  );
}

function LongText({
  label,
  value,
  onChange,
  placeholder,
  required = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  required?: boolean;
}) {
  return (
    <TextField fullWidth isRequired={required}>
      <Label>{label}</Label>
      <TextArea fullWidth rows={4} maxLength={LIMITS.text} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} />
      <Count value={value} max={LIMITS.text} />
    </TextField>
  );
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
  pendingLabel = 'Saving',
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
      const text = (value: unknown, max: number) => typeof value === 'string' ? value.slice(0, max) : '';
      setForm((current) => ({
        ...current,
        title: current.title || text(draft.title, LIMITS.title),
        description: current.description || text(draft.description, LIMITS.text),
        scope: current.scope || text(draft.scope, LIMITS.text),
        deliverables: current.deliverables || text(draft.deliverables, LIMITS.text),
        evaluationCriteria: current.evaluationCriteria || text(draft.evaluationCriteria, LIMITS.text),
      }));
      setTools((current) => current.length ? current : (draft.tools ?? [])
        .filter((tool): tool is string => typeof tool === 'string' && !!tool.trim())
        .map((tool) => tool.trim().slice(0, LIMITS.short))
        .filter((tool, index, values) => values.indexOf(tool) === index)
        .slice(0, LIMITS.tools));
      setSelectedField((current) => {
        if (current) return current;
        const field = text(draft.projectField, LIMITS.short);
        if (!field) return current;
        if ((PROJECT_FIELDS as readonly string[]).includes(field)) return field;
        setCustomField(field);
        return 'Other';
      });
    };
    window.addEventListener('talentbridge:project-draft', populateDraft);
    return () => window.removeEventListener('talentbridge:project-draft', populateDraft);
  }, []);

  const set = (key: keyof typeof form, value: string) => setForm((current) => ({ ...current, [key]: value }));
  const addTool = (tool: string) => {
    const value = tool.trim();
    if (value && value.length <= LIMITS.short && tools.length < LIMITS.tools && !tools.includes(value)) {
      setTools((current) => [...current, value]);
    }
    setToolInput('');
  };
  const data = (): ProjectFormData => ({
    ...form,
    tools,
    projectField: selectedField === 'Other' ? customField.trim() || undefined : selectedField || undefined,
    deadline: form.deadline || undefined,
    projectSupervisorId: form.projectSupervisorId || undefined,
  });
  const submit = (event: FormEvent) => {
    event.preventDefault();
    onSubmit(data());
  };

  return (
    <form onSubmit={submit} className='space-y-8'>
      <section>
        <h2 className='text-base font-semibold'>Project brief</h2>
        <p className='mt-1 text-sm text-muted'>Provide enough detail for students to assess the work.</p>
        <div className='mt-5 space-y-5'>
          <TextInput
            label='Internal reference name'
            value={form.internalName}
            onChange={(value) => set('internalName', value)}
            maxLength={LIMITS.short}
            placeholder='For example, Q3 support platform'
            description={internalNameHelp}
          />
          <TextInput
            label='Project title'
            value={form.title}
            onChange={(value) => set('title', value)}
            maxLength={LIMITS.title}
            placeholder='A clear, specific project title'
            required
          />
          <LongText label='Project description' value={form.description} onChange={(value) => set('description', value)} placeholder='Describe the problem, users, and intended outcome.' required />
          <LongText label='Project scope' value={form.scope} onChange={(value) => set('scope', value)} placeholder='Define what is included and what is outside the project.' />
        </div>
      </section>

      <section className='border-t border-separator pt-7'>
        <h2 className='text-base font-semibold'>Delivery and evaluation</h2>
        <div className='mt-5 space-y-5'>
          <LongText label='Expected deliverables' value={form.deliverables} onChange={(value) => set('deliverables', value)} placeholder='List the software, repository, documentation, or report to submit.' />
          <LongText label='Evaluation criteria' value={form.evaluationCriteria} onChange={(value) => set('evaluationCriteria', value)} placeholder='Explain what a successful submission must demonstrate.' />
        </div>
      </section>

      <section className='border-t border-separator pt-7'>
        <h2 className='text-base font-semibold'>Classification and tools</h2>
        <div className='mt-5 space-y-6'>
          <div>
            <Label>Project field</Label>
            <div className='mt-2 flex flex-wrap gap-2'>
              {PROJECT_FIELDS.map((field) => (
                <button
                  key={field}
                  type='button'
                  aria-pressed={selectedField === field}
                  onClick={() => { setSelectedField(field); if (field !== 'Other') setCustomField(''); }}
                  className={clsx(
                    'min-h-9 rounded-sm border px-3 text-xs font-medium transition-colors',
                    selectedField === field ? 'border-accent bg-default text-foreground' : 'border-border bg-surface text-muted hover:bg-default hover:text-foreground',
                  )}
                >
                  {field}
                </button>
              ))}
            </div>
            {selectedField === 'Other' && (
              <Input fullWidth className='mt-3' maxLength={LIMITS.short} value={customField} onChange={(event) => setCustomField(event.target.value)} placeholder='Specify the project field' />
            )}
          </div>

          <div>
            <Label>Required technologies and tools</Label>
            <div className='mt-2 flex gap-2'>
              <Input
                fullWidth
                maxLength={LIMITS.short}
                value={toolInput}
                onChange={(event) => setToolInput(event.target.value)}
                onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); addTool(toolInput); } }}
                placeholder='Add a technology'
              />
              <Button isIconOnly variant='secondary' type='button' isDisabled={tools.length >= LIMITS.tools || !toolInput.trim()} onPress={() => addTool(toolInput)} aria-label='Add technology'>
                <Plus size={17} />
              </Button>
            </div>
            <div className='mt-2 flex flex-wrap gap-1.5'>
              {TOOL_SUGGESTIONS.filter((tool) => !tools.includes(tool)).slice(0, 8).map((tool) => (
                <Button key={tool} size='sm' variant='ghost' type='button' isDisabled={tools.length >= LIMITS.tools} onPress={() => addTool(tool)}>+ {tool}</Button>
              ))}
            </div>
            {tools.length > 0 && (
              <div className='mt-3 flex flex-wrap gap-2'>
                {tools.map((tool) => (
                  <span key={tool} className='inline-flex items-center gap-1.5 rounded-sm bg-default px-2 py-1 text-xs font-medium'>
                    {tool}
                    <button type='button' onClick={() => setTools((current) => current.filter((item) => item !== tool))} aria-label={`Remove ${tool}`}><X size={12} /></button>
                  </span>
                ))}
              </div>
            )}
            <p className='mt-2 text-right text-[11px] text-muted'>{tools.length}/{LIMITS.tools} tools</p>
          </div>
        </div>
      </section>

      <section className='border-t border-separator pt-7'>
        <h2 className='text-base font-semibold'>Assignment</h2>
        <div className='mt-5 grid gap-5 sm:grid-cols-2'>
          <TextInput label='Application deadline' value={form.deadline} onChange={(value) => set('deadline', value)} type='datetime-local' />
          <SupervisorSelect value={form.projectSupervisorId} onChange={(value) => set('projectSupervisorId', value)} />
        </div>
      </section>

      <div className='sticky bottom-0 -mx-2 flex flex-col-reverse gap-2 border-t border-border bg-background/95 px-2 py-4 backdrop-blur sm:flex-row sm:justify-end'>
        <Button type='button' variant='ghost' onPress={onCancel}>Cancel</Button>
        {onSaveDraft && (
          <Button type='button' variant='secondary' onPress={() => onSaveDraft({ ...data(), saveAsDraft: true })} isDisabled={pending || !form.title || !form.description}>
            Save as draft
          </Button>
        )}
        <Button type='submit' variant='primary' isDisabled={pending || !form.title || !form.description}>
          {pending ? <><Spinner size='sm' /> {pendingLabel}</> : submitLabel}
        </Button>
      </div>
    </form>
  );
}

function SupervisorSelect({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const { data: supervisors = [] } = useQuery({
    queryKey: ['accepted-project-supervisors'],
    queryFn: () => projectSupervisorInvitationApi.listAccepted().then((response) => response.data),
  });
  const approved = supervisors.filter((supervisor) => supervisor.status === 'APPROVED');

  return (
    <Select.Root
      fullWidth
      aria-label='Project supervisor'
      selectedKey={value || 'none'}
      onSelectionChange={(key) => onChange(key === 'none' ? '' : String(key))}
    >
      <Label>Project supervisor</Label>
      <Select.Trigger><Select.Value /><Select.Indicator /></Select.Trigger>
      <Select.Popover>
        <ListBox>
          <ListBox.Item id='none'>No project supervisor</ListBox.Item>
          {approved.map((supervisor) => (
            <ListBox.Item key={supervisor.id} id={supervisor.id} textValue={`${supervisor.firstName} ${supervisor.lastName}`}>
              <span className='block text-sm'>{supervisor.firstName} {supervisor.lastName}</span>
              <span className='block text-xs text-muted'>{supervisor.supervisorProfile?.jobTitle ?? supervisor.email}</span>
            </ListBox.Item>
          ))}
        </ListBox>
      </Select.Popover>
    </Select.Root>
  );
}
