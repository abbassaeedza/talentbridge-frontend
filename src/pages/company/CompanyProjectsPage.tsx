import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Eye, FolderKanban, Pencil, Plus, Tag, Trash2, Users, X } from 'lucide-react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { Button, buttonVariants } from '@heroui/react/button';
import { Input } from '@heroui/react/input';
import { Label } from '@heroui/react/label';
import { ListBox } from '@heroui/react/list-box';
import { Select } from '@heroui/react/select';
import { Spinner } from '@heroui/react/spinner';
import { Table } from '@heroui/react/table';
import { Tabs } from '@heroui/react/tabs';
import { projectApi } from '../../api/services';
import DeadlineCountdown from '../../components/shared/DeadlineCountdown';
import { ConfirmationDialog, EmptyState, ListToolbar, PageHeader, StatusBadge } from '../../components/ui/TalentBridgeUI';

const TABS = [
  ['ALL', 'All'], ['DRAFT', 'Drafts'], ['ASSIGNED', 'Assigned'], ['OPEN', 'Open'], ['PENDING_REVIEW', 'Pending review'], ['ARCHIVED', 'Rejected'],
] as const;
const STATUS_LABEL: Record<string, string> = { DRAFT: 'Draft', OPEN: 'Open', PENDING_REVIEW: 'Pending review', ASSIGNED: 'Assigned', ARCHIVED: 'Rejected', CLOSED: 'Closed' };
const SORTS = [['newest', 'Newest first'], ['oldest', 'Oldest first'], ['az', 'Title A-Z'], ['za', 'Title Z-A']] as const;

function InlineNameEditor({ projectId, value, onSaved }: { projectId: string; value: string | null; onSaved: (value: string) => void }) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? '');
  const mutation = useMutation({
    mutationFn: () => projectApi.patchInternalName(projectId, draft.trim()),
    onSuccess: (response) => {
      const saved = (response.data as any).internalName ?? '';
      onSaved(saved);
      queryClient.invalidateQueries({ queryKey: ['my-projects'] });
      setEditing(false);
      toast.success('Reference saved');
    },
    onError: (error: any) => toast.error(error?.response?.data?.message || 'Could not save reference'),
  });
  if (!editing) return <Button size='sm' variant='ghost' className='mt-1 h-auto min-h-7 px-1 text-xs text-muted' onPress={() => { setDraft(value ?? ''); setEditing(true); }}><Tag size={12} /> {value || 'Add internal reference'}</Button>;
  return (
    <div className='mt-1 flex max-w-xs items-center gap-1'>
      <Input fullWidth autoFocus aria-label='Internal reference' maxLength={100} value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') mutation.mutate(); if (event.key === 'Escape') setEditing(false); }} />
      <Button isIconOnly size='sm' variant='primary' aria-label='Save internal reference' isDisabled={mutation.isPending} onPress={() => mutation.mutate()}><Check size={14} /></Button>
      <Button isIconOnly size='sm' variant='ghost' aria-label='Cancel editing internal reference' onPress={() => setEditing(false)}><X size={14} /></Button>
    </div>
  );
}

function DeleteProjectButton({ projectId }: { projectId: string }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const mutation = useMutation({
    mutationFn: () => projectApi.deleteProject(projectId),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['my-projects'] }); setOpen(false); toast.success('Project deleted'); },
    onError: (error: any) => toast.error(error?.response?.data?.message || 'Could not delete project'),
  });
  return <><Button size='sm' variant='danger-soft' onPress={() => setOpen(true)}><Trash2 size={14} /> Delete</Button><ConfirmationDialog open={open} title='Delete project?' description='This removes the project permanently.' confirmLabel='Delete project' danger pending={mutation.isPending} onClose={() => setOpen(false)} onConfirm={() => mutation.mutate()} /></>;
}

export default function CompanyProjectsPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState('ALL');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('newest');
  const [nameOverrides, setNameOverrides] = useState<Record<string, string>>({});
  const { data: projects = [], isLoading } = useQuery({ queryKey: ['my-projects'], queryFn: () => projectApi.getMyProjects().then((response) => response.data) });
  const counts = useMemo(() => projects.reduce((result, project) => ({ ...result, [project.status]: (result[project.status] ?? 0) + 1 }), {} as Record<string, number>), [projects]);
  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const result = projects.filter((project) => tab === 'ALL' || project.status === tab).filter((project) => !needle || [project.title, (project as any).internalName, project.description].filter(Boolean).join(' ').toLowerCase().includes(needle));
    return [...result].sort((a, b) => sort === 'oldest' ? +new Date(a.createdAt) - +new Date(b.createdAt) : sort === 'az' ? a.title.localeCompare(b.title) : sort === 'za' ? b.title.localeCompare(a.title) : +new Date(b.createdAt) - +new Date(a.createdAt));
  }, [projects, tab, search, sort]);
  const canEdit = (status: string) => ['DRAFT', 'PENDING_REVIEW', 'ARCHIVED'].includes(status);
  const canDelete = (status: string) => ['PENDING_REVIEW', 'ARCHIVED'].includes(status);
  const actions = (project: any) => <div className='flex flex-wrap justify-end gap-1'><Button size='sm' variant='ghost' onPress={() => navigate(`/company/projects/${project.id}`)}><Eye size={14} /> View</Button>{canEdit(project.status) && <Button size='sm' variant='secondary' onPress={() => navigate(`/company/projects/${project.id}/edit`)}><Pencil size={14} /> {project.status === 'ARCHIVED' ? 'Edit and resubmit' : 'Edit'}</Button>}{canDelete(project.status) && <DeleteProjectButton projectId={project.id} />}</div>;

  return (
    <div>
      <PageHeader title='Projects' description={`${filtered.length} of ${projects.length} projects shown`} action={<Link to='/company/projects/new' className={buttonVariants({ variant: 'primary' })}><Plus size={16} /> Post New Project</Link>} />
      <Tabs.Root variant='secondary' selectedKey={tab} onSelectionChange={(key) => setTab(String(key))} className='mb-4'>
        <Tabs.ListContainer><Tabs.List aria-label='Project status'>{TABS.map(([key, label]) => <Tabs.Tab key={key} id={key}><Tabs.Indicator />{label}{(key === 'ALL' ? projects.length : counts[key] ?? 0) > 0 && <span className='ml-1 text-xs text-muted'>{key === 'ALL' ? projects.length : counts[key]}</span>}</Tabs.Tab>)}</Tabs.List></Tabs.ListContainer>
      </Tabs.Root>
      <ListToolbar searchLabel='Search projects' placeholder='Search title, description, or reference' value={search} onChange={setSearch} filters={<Select.Root aria-label='Sort projects' selectedKey={sort} onSelectionChange={(key) => setSort(String(key))} className='w-full sm:w-44'>
          <Label className='sr-only'>Sort projects</Label><Select.Trigger><Select.Value /><Select.Indicator /></Select.Trigger><Select.Popover><ListBox>{SORTS.map(([key, label]) => <ListBox.Item key={key} id={key} textValue={label}>{label}</ListBox.Item>)}</ListBox></Select.Popover>
        </Select.Root>} />

      {isLoading ? <div className='flex min-h-64 items-center justify-center'><Spinner /></div> : filtered.length === 0 ? <EmptyState icon={FolderKanban} title='No projects match these filters' description={projects.length ? 'Change the status or search query.' : 'Create a project brief for student parties.'} action={!projects.length ? <Link to='/company/projects/new' className={buttonVariants({ variant: 'primary' })}>Create project</Link> : undefined} /> : <>
        <div className='hidden md:block'>
          <Table variant='secondary'><Table.ScrollContainer><Table.Content aria-label='Company projects'>
            <Table.Header><Table.Column isRowHeader>Project</Table.Column><Table.Column>Status</Table.Column><Table.Column>Applications</Table.Column><Table.Column>Deadline</Table.Column><Table.Column>Created</Table.Column><Table.Column className='text-right'>Actions</Table.Column></Table.Header>
            <Table.Body>{filtered.map((project: any) => <Table.Row key={project.id} id={project.id}>
              <Table.Cell><p className='text-sm font-medium'>{project.title}</p><InlineNameEditor projectId={project.id} value={nameOverrides[project.id] ?? project.internalName ?? null} onSaved={(value) => setNameOverrides((current) => ({ ...current, [project.id]: value }))} /></Table.Cell>
              <Table.Cell><StatusBadge status={project.status} label={STATUS_LABEL[project.status]} /></Table.Cell>
              <Table.Cell><span className='flex items-center gap-1.5 text-sm'><Users size={14} className='text-muted' /> {project.partyApplicationCount}</span></Table.Cell>
              <Table.Cell><DeadlineCountdown deadline={project.deadline} compact /></Table.Cell>
              <Table.Cell><span className='text-sm text-muted'>{format(new Date(project.createdAt), 'dd MMM yyyy')}</span></Table.Cell>
              <Table.Cell>{actions(project)}</Table.Cell>
            </Table.Row>)}</Table.Body>
          </Table.Content></Table.ScrollContainer></Table>
        </div>
        <div className='space-y-3 md:hidden'>{filtered.map((project: any) => <article key={project.id} className='rounded-lg border border-border bg-surface p-4'>
          <div className='flex items-start justify-between gap-3'><div><h2 className='font-medium'>{project.title}</h2><InlineNameEditor projectId={project.id} value={nameOverrides[project.id] ?? project.internalName ?? null} onSaved={(value) => setNameOverrides((current) => ({ ...current, [project.id]: value }))} /></div><StatusBadge status={project.status} label={STATUS_LABEL[project.status]} /></div>
          <div className='mt-3 flex flex-wrap gap-3 text-xs text-muted'><span>{project.partyApplicationCount} applications</span><DeadlineCountdown deadline={project.deadline} compact /><span>{format(new Date(project.createdAt), 'dd MMM yyyy')}</span></div>
          <div className='mt-4 border-t border-separator pt-3'>{actions(project)}</div>
        </article>)}</div>
      </>}
    </div>
  );
}
