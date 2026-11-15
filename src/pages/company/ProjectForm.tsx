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
import { ToggleButton } from '@heroui/react/toggle-button';
import { projectSupervisorInvitationApi } from '../../api/services';
import DateTimePicker from '../../components/ui/DateTimePicker';
import { parseServerDateTime, toApiDateTime } from '../../utils/dateTime';
import { PROJECT_FIELDS, type Project } from '../../types';
import { PROJECT_DRAFT_EVENT, PROJECT_DRAFT_LIMITS as LIMITS, sanitizeProjectDraft } from '../../utils/projectDraft';

const TOOL_SUGGESTIONS = [
  'React', 'TypeScript', 'Python', 'Node.js', 'Java', 'Spring Boot',
  'PostgreSQL', 'MongoDB', 'Docker', 'AWS', 'TensorFlow', 'PyTorch',
  'Vue.js', 'GraphQL', 'Redis',
];

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
  outcomeUnknown?: boolean;
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
  outcomeUnknown = false,
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
  const [deadlineValid, setDeadlineValid] = useState(true);
  const [form, setForm] = useState({
    title: initial?.title ?? '',
    description: initial?.description ?? '',
    scope: initial?.scope ?? '',
    deliverables: initial?.deliverables ?? '',
    evaluationCriteria: initial?.evaluationCriteria ?? '',
    deadline: initial?.deadline ?? '',
    internalName: initial?.internalName ?? '',
    projectSupervisorId: initial?.projectSupervisorId ?? '',
  });

  useEffect(() => {
    const populateDraft = (event: Event) => {
      const draft = sanitizeProjectDraft((event as CustomEvent<unknown>).detail);
      setForm((current) => ({
        ...current,
        title: current.title || draft.title || '',
        description: current.description || draft.description || '',
        scope: current.scope || draft.scope || '',
        deliverables: current.deliverables || draft.deliverables || '',
        evaluationCriteria: current.evaluationCriteria || draft.evaluationCriteria || '',
      }));
      setTools((current) => current.length ? current : draft.tools ?? []);
      setSelectedField((current) => {
        if (current) return current;
        const field = draft.projectField;
        if (!field) return current;
        if ((PROJECT_FIELDS as readonly string[]).includes(field)) return field;
        setCustomField(field);
        return 'Other';
      });
    };
    window.addEventListener(PROJECT_DRAFT_EVENT, populateDraft);
    return () => window.removeEventListener(PROJECT_DRAFT_EVENT, populateDraft);
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
    deadline: form.deadline ? toApiDateTime(form.deadline) : undefined,
    projectSupervisorId: form.projectSupervisorId || undefined,
  });
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (pending || outcomeUnknown || !deadlineValid || (form.deadline && !parseServerDateTime(form.deadline))) return;
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
                <ToggleButton
                  key={field}
                  isSelected={selectedField === field}
                  onChange={() => { setSelectedField(field); if (field !== 'Other') setCustomField(''); }}
                  className={clsx(
                    'min-h-9 rounded-sm border px-3 text-xs font-medium transition-colors',
                    selectedField === field ? 'border-accent bg-default text-foreground' : 'border-border bg-surface text-muted hover:bg-default hover:text-foreground',
                  )}
                >
                  {field}
                </ToggleButton>
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
                    <Button isIconOnly size='sm' variant='ghost' onPress={() => setTools((current) => current.filter((item) => item !== tool))} aria-label={`Remove ${tool}`}><X size={12} /></Button>
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
          <DateTimePicker label='Application deadline' value={form.deadline} onChange={(value) => set('deadline', value)} onValidityChange={setDeadlineValid} />
          <SupervisorSelect value={form.projectSupervisorId} onChange={(value) => set('projectSupervisorId', value)} />
        </div>
      </section>

      <div className='sticky bottom-0 -mx-2 flex flex-col-reverse gap-2 border-t border-border bg-background/95 px-2 py-4 backdrop-blur sm:flex-row sm:justify-end'>
        <Button type='button' variant='ghost' onPress={onCancel}>Cancel</Button>
        {onSaveDraft && (
          <Button type='button' variant='secondary' onPress={() => { if (!outcomeUnknown && !pending) onSaveDraft({ ...data(), saveAsDraft: true }); }} isDisabled={outcomeUnknown || pending || !form.title || !form.description || !deadlineValid || (!!form.deadline && !parseServerDateTime(form.deadline))}>
            Save as draft
          </Button>
        )}
        <Button type='submit' variant='primary' isDisabled={outcomeUnknown || pending || !form.title || !form.description || !deadlineValid || (!!form.deadline && !parseServerDateTime(form.deadline))}>
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
          <ListBox.Item id='none' textValue='No project supervisor'>No project supervisor</ListBox.Item>
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
