import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { projectApi } from '../../api/services';
import { PROJECT_FIELDS } from '../../types';
import { Search, Users, X, ChevronDown, ChevronUp } from 'lucide-react';
import { formatDateTime } from '../../utils/dateTime';
import DeadlineCountdown from '../../components/shared/DeadlineCountdown';
import { Button } from '@heroui/react/button';
import { ButtonGroup } from '@heroui/react/button-group';
import { Label } from '@heroui/react/label';
import { ListBox } from '@heroui/react/list-box';
import { Select } from '@heroui/react/select';
import { Skeleton } from '@heroui/react/skeleton';
import { Table } from '@heroui/react/table';
import { ToggleButton } from '@heroui/react/toggle-button';
import { EmptyState, ListToolbar, PageHeader, StatusBadge } from '../../components/ui/TalentBridgeUI';

const SORT_OPTIONS = [
  { value: 'createdAt', label: 'Newest' },
  { value: 'title',     label: 'A → Z' },
  { value: 'deadline',  label: 'Deadline' },
];

export default function ProjectsListPage() {
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [sortBy, setSortBy] = useState('createdAt');
  const [page, setPage] = useState(0);
  const [filterOpen, setFilterOpen] = useState(false);
  const [selectedFields, setSelectedFields] = useState<string[]>([]);
  const [selectedTools, setSelectedTools] = useState<string[]>([]);

  const { data, isLoading } = useQuery({
    queryKey: ['projects', query, sortBy, page],
    queryFn: () =>
      projectApi.getOpen({ search: query || undefined, sortBy, page, size: 12 }).then((r) => r.data),
  });

  // Collect all tools across current page for filter pills
  const allTools = useMemo(() => {
    const set = new Set<string>();
    (data?.content ?? []).forEach((p) => p.tools.forEach((t) => set.add(t)));
    return Array.from(set).sort();
  }, [data]);

  // Client-side filter on top of server search
  const displayed = useMemo(() => {
    let list = data?.content ?? [];
    if (selectedFields.length > 0)
      list = list.filter((p) => p.projectField && selectedFields.includes(p.projectField));
    if (selectedTools.length > 0)
      list = list.filter((p) => selectedTools.every((t) => p.tools.includes(t)));
    return list;
  }, [data, selectedFields, selectedTools]);

  const toggleField = (f: string) =>
    setSelectedFields((prev) => prev.includes(f) ? prev.filter((x) => x !== f) : [...prev, f]);
  const toggleTool = (t: string) =>
    setSelectedTools((prev) => prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]);

  const activeFilters = selectedFields.length + selectedTools.length;

  return (
    <div className=''>
      <PageHeader title='Projects' description={`${data?.totalElements ?? 0} open projects available`} />

      <ListToolbar searchLabel='Search projects' placeholder='Search by title, description, or tools' value={search} onChange={setSearch} onSubmit={(value) => { setQuery(value); setPage(0); }} filters={<><Select.Root className='w-44' aria-label='Sort projects' selectedKey={sortBy} onSelectionChange={(key) => { setSortBy(String(key)); setPage(0); }}><Label className='sr-only'>Sort projects</Label><Select.Trigger><Select.Value /><Select.Indicator /></Select.Trigger><Select.Popover><ListBox>{SORT_OPTIONS.map((option) => <ListBox.Item key={option.value} id={option.value} textValue={option.label}>{option.label}</ListBox.Item>)}</ListBox></Select.Popover></Select.Root><ButtonGroup variant='secondary'>
          <Button variant={filterOpen || activeFilters > 0 ? 'primary' : 'secondary'} onPress={() => setFilterOpen((value) => !value)}>
            Filters {activeFilters > 0 && `(${activeFilters})`} {filterOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </Button>
          {activeFilters > 0 && <><ButtonGroup.Separator /><Button isIconOnly variant='secondary' aria-label='Clear project filters' onPress={() => { setSelectedFields([]); setSelectedTools([]); }}><X size={14} /></Button></>}
        </ButtonGroup></>} />

      {/* Filter panel */}
      {filterOpen && (
        <div className='rounded-lg border border-border bg-surface p-4 mb-5 space-y-4'>
          <div>
            <p className='text-xs font-semibold text-muted uppercase tracking-wider mb-2'>Project Field</p>
            <div className='flex flex-wrap gap-2'>
              {PROJECT_FIELDS.map((f) => (
                <ToggleButton key={f} size='sm' isSelected={selectedFields.includes(f)} onChange={() => toggleField(f)}>
                  {f}
                </ToggleButton>
              ))}
            </div>
          </div>

          {allTools.length > 0 && (
            <div>
              <p className='text-xs font-semibold text-muted uppercase tracking-wider mb-2'>Tools / Technologies</p>
              <div className='flex flex-wrap gap-2'>
                {allTools.slice(0, 16).map((t) => (
                  <ToggleButton key={t} size='sm' isSelected={selectedTools.includes(t)} onChange={() => toggleTool(t)}>
                    {t}
                  </ToggleButton>
                ))}
              </div>
            </div>
          )}

          {activeFilters > 0 && (
            <Button size='sm' variant='ghost' onPress={() => { setSelectedFields([]); setSelectedTools([]); }}>
              <X size={12} /> Clear all filters
            </Button>
          )}
        </div>
      )}

      {isLoading ? (
        <div className='grid md:grid-cols-2 lg:grid-cols-3 gap-4'>
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className='h-64 rounded-lg' />
          ))}
        </div>
      ) : (
        <>
          {activeFilters > 0 && (
            <p className='text-xs text-muted mb-3'>
              {displayed.length} result{displayed.length !== 1 ? 's' : ''} after filters
            </p>
          )}

          <Table variant='secondary' className='hidden md:block'>
            <Table.ScrollContainer><Table.Content aria-label='Open projects'>
              <Table.Header><Table.Column isRowHeader>Project</Table.Column><Table.Column>Company</Table.Column><Table.Column>Field and tools</Table.Column><Table.Column>Applications</Table.Column><Table.Column>Deadline</Table.Column></Table.Header>
              <Table.Body>{displayed.map((project) => <Table.Row key={project.id} id={project.id}>
                <Table.Cell><Link to={`/student/projects/${project.id}`} className='font-medium text-foreground hover:text-accent'>{project.title}</Link><p className='mt-1 max-w-md line-clamp-1 text-xs text-muted'>{project.description}</p></Table.Cell>
                <Table.Cell>{project.companyName}</Table.Cell>
                <Table.Cell><StatusBadge status='OPEN' /><p className='mt-1 text-xs text-muted'>{[project.projectField, ...project.tools.slice(0, 3)].filter(Boolean).join(' · ') || 'Not specified'}</p></Table.Cell>
                <Table.Cell><span className='flex items-center gap-1.5'><Users size={14} className='text-muted' />{project.partyApplicationCount}</span></Table.Cell>
                <Table.Cell><DeadlineCountdown deadline={project.deadline ?? null} compact /></Table.Cell>
              </Table.Row>)}</Table.Body>
            </Table.Content></Table.ScrollContainer>
          </Table>

          <div className='grid gap-4 md:hidden'>
            {displayed.map((p) => (
              <Link key={p.id} to={`/student/projects/${p.id}`}
                className='rounded-lg border border-border bg-surface p-5 hover:border-accent hover:bg-surface-secondary transition-all duration-200 group flex flex-col'>
                <div className='flex items-start justify-between gap-2 mb-3'>
                  <div className='w-9 h-9 rounded-lg bg-default border border-border flex items-center justify-center  font-bold text-foreground flex-shrink-0'>
                    {p.companyName[0]}
                  </div>
                  <div className='flex flex-wrap gap-1'>
                    <StatusBadge status='OPEN' />
                    {p.projectField && (
                      <span className='inline-flex items-center rounded-sm bg-default px-2 py-1 text-[10px] text-muted'>
                        {p.projectField}
                      </span>
                    )}
                    {!p.projectField && p.companyIndustry && (
                      <span className='inline-flex items-center rounded-sm bg-default px-2 py-1 text-[10px] text-muted'>
                        {p.companyIndustry}
                      </span>
                    )}
                  </div>
                </div>

                <h3 className='font-semibold text-foreground text-sm mb-2 group-hover:text-accent transition-colors line-clamp-2'>
                  {p.title}
                </h3>
                <p className='text-xs text-muted mb-3 line-clamp-3 flex-1'>{p.description}</p>

                {p.tools.length > 0 && (
                  <div className='flex flex-wrap gap-1 mb-3'>
                    {p.tools.slice(0, 4).map((t) => (
                      <span key={t} className='px-2 py-0.5 rounded-md bg-default text-muted text-[10px]'>{t}</span>
                    ))}
                    {p.tools.length > 4 && <span className='text-[10px] text-muted'>+{p.tools.length - 4}</span>}
                  </div>
                )}

                <div className='border-t border-border pt-3 mt-auto space-y-2'>
                  <div className='flex items-center justify-between text-xs text-muted'>
                    <span className='font-medium'>{p.companyName}</span>
                    <span className='flex items-center gap-1 text-muted'>
                      <Users size={10} />
                      {p.partyApplicationCount} party application{p.partyApplicationCount !== 1 ? 's' : ''}
                    </span>
                  </div>
                  <div className='flex items-center justify-between gap-2'>
                    <DeadlineCountdown deadline={p.deadline ?? null} compact />
                    {p.deadline && (
                      <span className='text-[10px] text-muted'>
                        {formatDateTime(p.deadline)}
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>

          {/* Pagination */}
          {data && data.totalPages > 1 && (
            <div className='flex justify-center gap-2 mt-8'>
              <Button size='sm' variant='secondary' onPress={() => setPage((p) => p - 1)} isDisabled={data.first}>Previous</Button>
              <span className='px-4 py-2 text-xs text-muted'>Page {page + 1} of {data.totalPages}</span>
              <Button size='sm' variant='secondary' onPress={() => setPage((p) => p + 1)} isDisabled={data.last}>Next</Button>
            </div>
          )}

          {displayed.length === 0 && !isLoading && (
            <EmptyState icon={Search} title='No projects found' description='Try adjusting your search or filters.' />
          )}
        </>
      )}
    </div>
  );
}
