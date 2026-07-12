import { useState, useRef, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { projectApi } from '../../api/services';
import {
  Plus, FolderKanban, Users, Eye, Pencil, Trash2,
  Tag, Check, X, Search, ArrowUpDown,
} from 'lucide-react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import clsx from 'clsx';
import DeadlineCountdown from '../../components/shared/DeadlineCountdown';

const STATUS_INFO: Record<string, { cls: string; label: string }> = {
  OPEN:           { cls: 'bg-blue-500/15 text-blue-400 border border-blue-500/20', label: 'Pending Assignment' },
  PENDING_REVIEW: { cls: 'badge-pending',                                           label: 'Pending Review' },
  ASSIGNED:       { cls: 'bg-jade-500/20 text-jade-400 border border-jade-500/30',  label: 'Live' },
  ARCHIVED:       { cls: 'bg-red-500/15 text-red-400 border border-red-500/20',     label: 'Rejected' },
  CLOSED:         { cls: 'bg-ink-700/50 text-ink-400 border border-ink-600/30',     label: 'Closed' },
};

const TABS = [
  { key: 'ALL',           label: 'All' },
  { key: 'ASSIGNED',      label: 'Live' },
  { key: 'OPEN',          label: 'Pending Assignment' },
  { key: 'PENDING_REVIEW',label: 'Pending Review' },
  { key: 'ARCHIVED',      label: 'Rejected' },
];

const SORT_OPTIONS = [
  { key: 'newest', label: 'Newest first' },
  { key: 'oldest', label: 'Oldest first' },
  { key: 'az',     label: 'A → Z' },
  { key: 'za',     label: 'Z → A' },
];

// ── Inline name editor ────────────────────────────────────────────────────────
function InlineNameEditor({
  projectId, value, onSaved,
}: { projectId: string; value: string | null; onSaved: (v: string) => void }) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? '');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) {
      setDraft(value ?? '');
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [editing]);

  const mutation = useMutation({
    mutationFn: (name: string) => projectApi.patchInternalName(projectId, name),
    onSuccess: (res) => {
      onSaved((res.data as any).internalName ?? '');
      qc.invalidateQueries({ queryKey: ['my-projects'] });
      setEditing(false);
      toast.success('Saved');
    },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Failed'),
  });

  const save = () => mutation.mutate(draft.trim());

  if (editing) {
    return (
      <div className='flex items-center gap-1.5 mt-1'>
        <Tag size={10} className='text-ember-500 flex-shrink-0' />
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { e.preventDefault(); save(); }
            if (e.key === 'Escape') setEditing(false);
          }}
          onBlur={save}
          placeholder='Internal reference…'
          className='bg-ink-700 border border-ember-500/40 rounded-md px-2 py-0.5 text-[11px] text-ember-300 placeholder:text-ink-500 focus:outline-none focus:ring-1 focus:ring-ember-500/50 w-44'
        />
        <button onMouseDown={(e) => { e.preventDefault(); save(); }} className='text-jade-400 hover:text-jade-300'><Check size={12} /></button>
        <button onMouseDown={(e) => { e.preventDefault(); setEditing(false); }} className='text-ink-500 hover:text-ink-300'><X size={12} /></button>
      </div>
    );
  }

  return (
    <button onClick={() => setEditing(true)} className='flex items-center gap-1 mt-1 group' title='Edit internal reference'>
      {value ? (
        <>
          <Tag size={10} className='text-ember-500' />
          <span className='text-[11px] text-ember-400/80 group-hover:text-ember-300'>{value}</span>
          <Pencil size={9} className='text-ink-600 group-hover:text-ember-400 ml-0.5' />
        </>
      ) : (
        <>
          <Tag size={10} className='text-ink-600 group-hover:text-ink-400' />
          <span className='text-[11px] text-ink-600 group-hover:text-ink-400'>+ add reference</span>
        </>
      )}
    </button>
  );
}

// ── Delete button ─────────────────────────────────────────────────────────────
function DeleteButton({ projectId }: { projectId: string }) {
  const qc = useQueryClient();
  const [confirm, setConfirm] = useState(false);

  const mutation = useMutation({
    mutationFn: () => projectApi.deleteProject(projectId),
    onSuccess: () => {
      toast.success('Project deleted');
      qc.invalidateQueries({ queryKey: ['my-projects'] });
      setConfirm(false);
    },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Delete failed'),
  });

  if (confirm) {
    return (
      <div className='flex items-center gap-1'>
        <span className='text-[10px] text-red-400 mr-1'>Sure?</span>
        <button onClick={() => mutation.mutate()} disabled={mutation.isPending}
          className='flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 text-xs text-red-400 transition-colors'>
          {mutation.isPending ? <span className='w-3 h-3 border border-red-400 border-t-transparent rounded-full animate-spin' /> : <Check size={11} />}
          Yes
        </button>
        <button onClick={() => setConfirm(false)}
          className='flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-ink-700 hover:bg-ink-600 border border-ink-600/40 text-xs text-ink-400 hover:text-ink-200 transition-colors'>
          <X size={11} /> No
        </button>
      </div>
    );
  }

  return (
    <button onClick={() => setConfirm(true)}
      className='flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-xs text-red-400 hover:text-red-300 transition-colors'>
      <Trash2 size={12} /> Delete
    </button>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function CompanyProjectsPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState('ALL');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('newest');
  const [sortOpen, setSortOpen] = useState(false);
  const [nameOverrides, setNameOverrides] = useState<Record<string, string>>({});
  const sortRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (sortRef.current && !sortRef.current.contains(e.target as Node)) setSortOpen(false);
    }
    if (sortOpen) document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, [sortOpen]);

  const { data: projects, isLoading } = useQuery({
    queryKey: ['my-projects'],
    queryFn: () => projectApi.getMyProjects().then((r) => r.data),
  });

  const counts = useMemo(
    () => (projects ?? []).reduce((acc, p) => {
      acc[p.status as string] = (acc[p.status as string] || 0) + 1;
      return acc;
    }, {} as Record<string, number>),
    [projects],
  );

  const filtered = useMemo(() => {
    let list = projects ?? [];
    if (tab !== 'ALL') list = list.filter((p) => p.status === tab);
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter((p) =>
        p.title.toLowerCase().includes(q) ||
        ((p as any).internalName ?? '').toLowerCase().includes(q) ||
        (p.description ?? '').toLowerCase().includes(q),
      );
    }
    return [...list].sort((a, b) => {
      if (sort === 'newest') return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      if (sort === 'oldest') return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      if (sort === 'az') return a.title.localeCompare(b.title);
      if (sort === 'za') return b.title.localeCompare(a.title);
      return 0;
    });
  }, [projects, tab, search, sort]);

  const canEdit   = (s: string) => s === 'PENDING_REVIEW' || s === 'ARCHIVED';
  const canDelete = (s: string) => s === 'PENDING_REVIEW' || s === 'ARCHIVED';
  const currentSortLabel = SORT_OPTIONS.find((o) => o.key === sort)?.label ?? 'Sort';

  return (
    <div className='animate-fade-up'>
      <div className='flex items-start justify-between mb-6'>
        <div>
          <h1 className='page-title'>My Projects</h1>
          <p className='page-subtitle'>All projects you've submitted to TalentBridge.</p>
        </div>
        <Link to='/company/projects/new' className='btn-primary'>
          <Plus size={16} /> Post New Project
        </Link>
      </div>

      {/* Tab slider */}
      <div className='flex gap-1 mb-5 bg-ink-900 p-1 rounded-xl w-fit border border-ink-800/60'>
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={clsx('px-4 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap',
              tab === t.key ? 'bg-ink-700 text-white shadow-sm' : 'text-ink-400 hover:text-ink-200',
            )}>
            {t.label}
            {(() => {
              const count = t.key === 'ALL' ? (projects?.length ?? 0) : (counts[t.key] ?? 0);
              return count > 0 ? (
                <span className={clsx('ml-1.5 px-1.5 py-0.5 rounded-md text-[10px] font-bold',
                  tab === t.key ? 'bg-ink-600 text-ink-300' : 'bg-ink-800 text-ink-500')}>
                  {count}
                </span>
              ) : null;
            })()}
          </button>
        ))}
      </div>

      {/* Search + sort */}
      <div className='flex items-center gap-3 mb-5'>
        <div className='relative flex-1 max-w-sm'>
          <Search size={14} className='absolute left-3 top-1/2 -translate-y-1/2 text-ink-500' />
          <input value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder='Search by title or reference name…'
            className='input pl-9 py-2 text-sm h-9' />
          {search && (
            <button onClick={() => setSearch('')} className='absolute right-3 top-1/2 -translate-y-1/2 text-ink-500 hover:text-ink-300'>
              <X size={13} />
            </button>
          )}
        </div>
        <div className='relative' ref={sortRef}>
          <button onClick={() => setSortOpen((v) => !v)}
            className='flex items-center gap-2 h-9 px-3.5 rounded-xl bg-ink-800 border border-ink-600/50 text-xs text-ink-300 hover:text-white transition-colors'>
            <ArrowUpDown size={13} /> {currentSortLabel}
          </button>
          {sortOpen && (
            <div className='absolute right-0 top-11 w-40 bg-ink-900 border border-ink-700/50 rounded-xl shadow-xl overflow-hidden z-20'>
              {SORT_OPTIONS.map((o) => (
                <button key={o.key} onClick={() => { setSort(o.key); setSortOpen(false); }}
                  className={clsx('w-full text-left px-4 py-2.5 text-xs transition-colors',
                    sort === o.key ? 'text-white bg-ink-700' : 'text-ink-400 hover:text-ink-100 hover:bg-ink-800')}>
                  {o.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {search && (
        <p className='text-xs text-ink-500 mb-3'>
          {filtered.length} result{filtered.length !== 1 ? 's' : ''} for "{search}"
        </p>
      )}

      {isLoading ? (
        <div className='flex items-center justify-center py-16'>
          <div className='w-6 h-6 border-2 border-ember-500 border-t-transparent rounded-full animate-spin' />
        </div>
      ) : !filtered.length ? (
        <div className='card p-12 text-center'>
          <FolderKanban size={32} className='text-ink-600 mx-auto mb-3' />
          <p className='text-ink-400 text-sm mb-4'>
            {search ? `No projects match "${search}"` : tab === 'ALL' ? 'No projects yet.' : `No ${STATUS_INFO[tab]?.label ?? tab} projects.`}
          </p>
          {!search && tab === 'ALL' && (
            <Link to='/company/projects/new' className='btn-primary text-sm inline-flex'>
              <Plus size={15} /> Post a Project
            </Link>
          )}
        </div>
      ) : (
        <div className='space-y-3'>
          {filtered.map((p) => {
            const proj = p as any;
            const { cls, label } = STATUS_INFO[p.status as string] ?? { cls: 'badge-pending', label: p.status };
            const currentName = nameOverrides[p.id] !== undefined ? nameOverrides[p.id] : (proj.internalName ?? null);

            return (
              <div key={p.id} className='card px-5 py-4 hover:border-ink-600/60 transition-colors'>
                <div className='flex items-start gap-4'>
                  <div className='flex-1 min-w-0'>
                    <div className='flex items-center gap-2 flex-wrap mb-0.5'>
                      <h3 className='font-semibold text-white text-sm'>{p.title}</h3>
                      <span className={clsx('badge text-[10px]', cls)}>{label}</span>
                      {p.projectField && (
                        <span className='px-2 py-0.5 rounded-md bg-ink-700 border border-ink-600/40 text-[10px] text-ink-400'>
                          {p.projectField}
                        </span>
                      )}
                    </div>

                    <InlineNameEditor
                      projectId={p.id}
                      value={currentName}
                      onSaved={(val) => setNameOverrides((prev) => ({ ...prev, [p.id]: val }))}
                    />

                    <div className='flex items-center gap-3 flex-wrap mt-2'>
                      <span className='flex items-center gap-1 text-xs text-ink-500'>
                        <Users size={11} />
                        {p.partyApplicationCount} party application{p.partyApplicationCount !== 1 ? 's' : ''}
                      </span>
                      <DeadlineCountdown deadline={p.deadline ?? null} compact />
                      {p.deadline && (
                        <span className='text-xs text-ink-500'>
                          {format(new Date(p.deadline), 'dd MMM yyyy')}
                        </span>
                      )}
                      <span className='text-xs text-ink-500'>
                        Posted {format(new Date(p.createdAt), 'dd MMM yyyy')}
                      </span>
                    </div>

                    {p.status === 'ARCHIVED' && (
                      <p className='text-xs text-red-400 mt-1.5'>
                        Rejected by coordinator — edit and resubmit to go live again.
                      </p>
                    )}
                  </div>

                  <div className='flex items-center gap-2 flex-shrink-0 pt-0.5'>
                    <button onClick={() => navigate(`/company/projects/${p.id}`)}
                      className='flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-ink-800 hover:bg-ink-700 border border-ink-600/40 text-xs text-ink-300 hover:text-white transition-colors'>
                      <Eye size={13} /> View
                    </button>
                    {canEdit(p.status as string) && (
                      <button onClick={() => navigate(`/company/projects/${p.id}/edit`)}
                        className='flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-ember-500/10 hover:bg-ember-500/20 border border-ember-500/30 text-xs text-ember-400 hover:text-ember-300 transition-colors'>
                        <Pencil size={13} />
                        {p.status === 'ARCHIVED' ? 'Edit & Resubmit' : 'Edit'}
                      </button>
                    )}
                    {canDelete(p.status as string) && <DeleteButton projectId={p.id} />}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
