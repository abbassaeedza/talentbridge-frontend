import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { projectApi } from '../../api/services';
import { PROJECT_FIELDS } from '../../types';
import { Search, Users, X, ChevronDown, ChevronUp } from 'lucide-react';
import { format } from 'date-fns';
import DeadlineCountdown from '../../components/shared/DeadlineCountdown';
import clsx from 'clsx';

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

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setQuery(search);
    setPage(0);
  };

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
    <div className='animate-fade-up'>
      <div className='page-header'>
        <h1 className='page-title'>Browse Projects</h1>
        <p className='page-subtitle'>{data?.totalElements ?? '…'} open projects available</p>
      </div>

      {/* Search + sort + filter toggle */}
      <div className='flex gap-3 mb-4 flex-wrap'>
        <form onSubmit={handleSearch} className='flex-1 min-w-48 relative'>
          <Search size={16} className='absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-400' />
          <input className='input pl-10' value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder='Search by title, description, tools…' />
        </form>

        <select className='input w-auto' value={sortBy} onChange={(e) => { setSortBy(e.target.value); setPage(0); }}>
          {SORT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>

        <button onClick={() => setFilterOpen((v) => !v)}
          className={clsx('flex items-center gap-2 px-4 h-10 rounded-xl border text-sm font-medium transition-colors',
            filterOpen || activeFilters > 0
              ? 'bg-ember-500/15 border-ember-500/40 text-ember-300'
              : 'bg-ink-800 border-ink-700/50 text-ink-300 hover:text-white',
          )}>
          Filters
          {activeFilters > 0 && (
            <span className='w-5 h-5 rounded-full bg-ember-500 text-white text-[10px] font-bold flex items-center justify-center'>
              {activeFilters}
            </span>
          )}
          {filterOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
      </div>

      {/* Filter panel */}
      {filterOpen && (
        <div className='card p-4 mb-5 space-y-4'>
          <div>
            <p className='text-xs font-semibold text-ink-400 uppercase tracking-wider mb-2'>Project Field</p>
            <div className='flex flex-wrap gap-2'>
              {PROJECT_FIELDS.map((f) => (
                <button key={f} type='button' onClick={() => toggleField(f)}
                  className={clsx('px-3 py-1 rounded-xl text-xs font-medium border transition-colors',
                    selectedFields.includes(f)
                      ? 'bg-ember-500/20 border-ember-500/40 text-ember-300'
                      : 'bg-ink-800 border-ink-700/50 text-ink-400 hover:text-ink-200',
                  )}>
                  {f}
                </button>
              ))}
            </div>
          </div>

          {allTools.length > 0 && (
            <div>
              <p className='text-xs font-semibold text-ink-400 uppercase tracking-wider mb-2'>Tools / Technologies</p>
              <div className='flex flex-wrap gap-2'>
                {allTools.slice(0, 16).map((t) => (
                  <button key={t} type='button' onClick={() => toggleTool(t)}
                    className={clsx('px-3 py-1 rounded-xl text-xs font-medium border transition-colors font-mono',
                      selectedTools.includes(t)
                        ? 'bg-jade-500/15 border-jade-500/30 text-jade-300'
                        : 'bg-ink-800 border-ink-700/50 text-ink-400 hover:text-ink-200',
                    )}>
                    {t}
                  </button>
                ))}
              </div>
            </div>
          )}

          {activeFilters > 0 && (
            <button onClick={() => { setSelectedFields([]); setSelectedTools([]); }}
              className='flex items-center gap-1.5 text-xs text-ink-500 hover:text-ink-300 transition-colors'>
              <X size={12} /> Clear all filters
            </button>
          )}
        </div>
      )}

      {isLoading ? (
        <div className='grid md:grid-cols-2 lg:grid-cols-3 gap-4'>
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className='card p-4 animate-pulse'>
              <div className='h-4 bg-ink-700 rounded mb-3 w-3/4' />
              <div className='h-3 bg-ink-800 rounded mb-2' />
              <div className='h-3 bg-ink-800 rounded w-2/3' />
            </div>
          ))}
        </div>
      ) : (
        <>
          {activeFilters > 0 && (
            <p className='text-xs text-ink-500 mb-3'>
              {displayed.length} result{displayed.length !== 1 ? 's' : ''} after filters
            </p>
          )}

          <div className='grid md:grid-cols-2 lg:grid-cols-3 gap-4'>
            {displayed.map((p) => (
              <Link key={p.id} to={`/student/projects/${p.id}`}
                className='card p-5 hover:border-ember-500/30 hover:bg-ink-800/20 transition-all duration-200 group flex flex-col'>
                <div className='flex items-start justify-between gap-2 mb-3'>
                  <div className='w-9 h-9 rounded-xl bg-ink-700 border border-ink-600/50 flex items-center justify-center font-display font-bold text-ink-200 flex-shrink-0'>
                    {p.companyName[0]}
                  </div>
                  <div className='flex flex-wrap gap-1'>
                    <span className='badge badge-open text-[10px]'>OPEN</span>
                    {p.projectField && (
                      <span className='badge bg-ink-700/50 text-ink-400 border-ink-600/30 text-[10px]'>
                        {p.projectField}
                      </span>
                    )}
                    {!p.projectField && p.companyIndustry && (
                      <span className='badge bg-ink-700/50 text-ink-400 border-ink-600/30 text-[10px]'>
                        {p.companyIndustry}
                      </span>
                    )}
                  </div>
                </div>

                <h3 className='font-semibold text-white text-sm mb-2 group-hover:text-ember-300 transition-colors line-clamp-2'>
                  {p.title}
                </h3>
                <p className='text-xs text-ink-400 mb-3 line-clamp-3 flex-1'>{p.description}</p>

                {p.tools.length > 0 && (
                  <div className='flex flex-wrap gap-1 mb-3'>
                    {p.tools.slice(0, 4).map((t) => (
                      <span key={t} className='px-2 py-0.5 rounded-md bg-ink-700/60 text-ink-400 text-[10px] font-mono'>{t}</span>
                    ))}
                    {p.tools.length > 4 && <span className='text-[10px] text-ink-500'>+{p.tools.length - 4}</span>}
                  </div>
                )}

                <div className='border-t border-ink-800/50 pt-3 mt-auto space-y-2'>
                  <div className='flex items-center justify-between text-xs text-ink-400'>
                    <span className='font-medium'>{p.companyName}</span>
                    <span className='flex items-center gap-1 text-ink-500'>
                      <Users size={10} />
                      {p.partyApplicationCount} party application{p.partyApplicationCount !== 1 ? 's' : ''}
                    </span>
                  </div>
                  <div className='flex items-center justify-between gap-2'>
                    <DeadlineCountdown deadline={p.deadline ?? null} compact />
                    {p.deadline && (
                      <span className='text-[10px] text-ink-500'>
                        {format(new Date(p.deadline), 'dd MMM yyyy')}
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
              <button onClick={() => setPage((p) => p - 1)} disabled={data.first}
                className='btn-secondary px-4 py-2 text-xs'>Previous</button>
              <span className='px-4 py-2 text-xs text-ink-400'>Page {page + 1} of {data.totalPages}</span>
              <button onClick={() => setPage((p) => p + 1)} disabled={data.last}
                className='btn-secondary px-4 py-2 text-xs'>Next</button>
            </div>
          )}

          {displayed.length === 0 && !isLoading && (
            <div className='text-center py-20'>
              <p className='text-ink-400 text-sm'>No projects found. Try adjusting your search or filters.</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
