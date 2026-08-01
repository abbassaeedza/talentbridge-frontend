import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { projectApi, userApi } from '../../api/services';
import { getUserName } from '../../types';
import { Building2, CheckCircle, ChevronDown, ChevronUp, ExternalLink, PauseCircle, PlayCircle, Search, Trash2, XCircle } from 'lucide-react';
import clsx from 'clsx';
import useUserStatusMutation from '../../hooks/useUserStatusMutation';
import toast from 'react-hot-toast';
import BulkActionToolbar from '../../components/coordinator/BulkActionToolbar';

export default function CompaniesDirectoryPage() {
  const [query, setQuery] = useState('');
  const [industry, setIndustry] = useState('ALL');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [rejectReason, setRejectReason] = useState('');
  const [bulkAction, setBulkAction] = useState<'approve' | 'reject' | 'suspend' | null>(null);
  const qc = useQueryClient();

  const { data: companies, isLoading } = useQuery({
    queryKey: ['directory-companies'],
    queryFn: () => userApi.getCompanies().then((r) => r.data),
  });
  const { data: projects } = useQuery({
    queryKey: ['company-directory-projects'],
    queryFn: () => projectApi.getAllUnpaged(),
  });

  const statusMutation = useUserStatusMutation([['directory-companies']], 'Company');
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['directory-companies'] });
    qc.invalidateQueries({ queryKey: ['pending-users'] });
  };
  const runBulk = async (action: 'approve' | 'reject' | 'suspend') => {
    setBulkAction(action);
    const requests = (companies ?? []).filter((company) => selected.includes(company.id)).flatMap((company) => {
      if (action === 'approve' && (company.status === 'PENDING' || company.status === 'REJECTED')) return [userApi.approve(company.id)];
      if (action === 'reject' && company.status === 'PENDING') return [userApi.reject(company.id, rejectReason)];
      if (action === 'suspend' && company.status === 'APPROVED') return [userApi.suspend(company.id)];
      return [];
    });
    try {
      const results = await Promise.allSettled(requests);
      const failed = results.filter((result) => result.status === 'rejected').length;
      failed
        ? toast.error(`${results.length - failed} updated, ${failed} failed`)
        : toast.success(`${requests.length} compan${requests.length === 1 ? 'y' : 'ies'} updated`);
      setSelected([]);
      invalidate();
    } finally {
      setBulkAction(null);
    }
  };

  const industries = useMemo(() => ['ALL', ...Array.from(new Set((companies ?? []).map((c) => c.companyProfile?.industry).filter(Boolean)))], [companies]);
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return (companies ?? [])
      .filter((c) => industry === 'ALL' || c.companyProfile?.industry === industry)
      .filter((c) => {
        if (!needle) return true;
        return [
          getUserName(c),
          c.email,
          c.companyProfile?.companyName,
          c.companyProfile?.industry,
          c.companyProfile?.city,
          c.companyProfile?.country,
        ].filter(Boolean).join(' ').toLowerCase().includes(needle);
      })
      .sort((a, b) => (a.companyProfile?.companyName ?? getUserName(a)).localeCompare(b.companyProfile?.companyName ?? getUserName(b)));
  }, [companies, query, industry]);
  const selectedCompanies = (companies ?? []).filter((company) => selected.includes(company.id));
  const eligible = {
    approve: selectedCompanies.filter((company) => company.status === 'PENDING' || company.status === 'REJECTED').length,
    reject: selectedCompanies.filter((company) => company.status === 'PENDING').length,
    suspend: selectedCompanies.filter((company) => company.status === 'APPROVED').length,
  };
  const allFilteredSelected = filtered.length > 0 && filtered.every((company) => selected.includes(company.id));
  const companyGroups = useMemo(() => {
    const groups = new Map<string, typeof filtered>();
    filtered.forEach((company) => {
      const name = company.companyProfile?.companyName ?? getUserName(company);
      groups.set(name, [...(groups.get(name) ?? []), company]);
    });
    return Array.from(groups, ([name, accounts]) => ({ name, accounts }));
  }, [filtered]);

  return (
    <div className='animate-fade-up'>
      <div className='page-header'>
        <h1 className='page-title'>Companies Directory</h1>
        <p className='page-subtitle'>{companyGroups.length} compan{companyGroups.length === 1 ? 'y' : 'ies'} · {filtered.length} profile{filtered.length === 1 ? '' : 's'}</p>
      </div>

      <div className='card p-4 mb-5 grid md:grid-cols-[1fr_auto] gap-3'>
        <div className='relative'>
          <Search size={15} className='absolute left-3 top-1/2 -translate-y-1/2 text-ink-500' />
          <input className='input pl-9' placeholder='Search company, industry, location…' value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <select className='input text-sm' value={industry} onChange={(e) => setIndustry(e.target.value)}>
          {industries.map((i) => <option key={i} value={i}>{i === 'ALL' ? 'All industries' : i}</option>)}
        </select>
        <label className='md:col-span-2 flex w-fit items-center gap-2 text-xs text-ink-300'>
          <input type='checkbox' aria-label='Select all filtered companies' checked={allFilteredSelected} onChange={() => setSelected(allFilteredSelected ? [] : filtered.map((company) => company.id))} className='h-4 w-4 accent-orange-500' />
          Select all {filtered.length} filtered companies
        </label>
      </div>

      <BulkActionToolbar noun='company' selectedCount={selected.length} eligible={eligible} rejectionReason={rejectReason} onRejectionReasonChange={setRejectReason} loadingAction={bulkAction} onAction={runBulk} />

      <div className='space-y-3'>
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => <div key={i} className='card h-20 animate-pulse' />)
        ) : filtered.length === 0 ? (
          <div className='card p-12 text-center text-sm text-ink-400'>No companies found.</div>
        ) : companyGroups.map((group) => (
          <section key={group.name} className='card overflow-hidden'>
            <div className='flex items-center gap-3 border-b border-ink-800/50 bg-ink-800/30 px-5 py-3'>
              <div className='flex h-9 w-9 items-center justify-center rounded-xl bg-ember-500/15 text-ember-400'>
                <Building2 size={17} />
              </div>
              <div>
                <h2 className='font-display font-semibold text-white'>{group.name}</h2>
                <p className='text-[11px] text-ink-500'>{group.accounts.length} company profile{group.accounts.length === 1 ? '' : 's'}</p>
              </div>
            </div>
            <div className='divide-y divide-ink-800/50'>
              {group.accounts.map((company, index) => {
                const profile = company.companyProfile;
                const relatedProjects = (projects ?? []).filter((p) => p.companyId === profile?.id);
                const isOpen = expanded === company.id;
                return (
                  <div key={company.id}>
              <div className='flex flex-col gap-4 px-5 py-4 sm:flex-row sm:items-start'>
                <input
                  type='checkbox'
                  aria-label={`Select ${getUserName(company)}`}
                  checked={selected.includes(company.id)}
                  onChange={() => setSelected((current) => current.includes(company.id)
                    ? current.filter((id) => id !== company.id)
                    : [...current, company.id])}
                  className='mt-3 h-4 w-4 flex-shrink-0 accent-orange-500'
                />
                <div className='flex-1'>
                  <div className='flex flex-wrap items-center gap-2'>
                    <h3 className='font-semibold text-white'>{getUserName(company)}</h3>
                    <span className='badge text-[10px] bg-ink-700/50 text-ink-300 border-ink-600/30'>Profile {index + 1}</span>
                    <span className='badge badge-ember text-[10px]'>{profile?.industry ?? 'Industry not set'}</span>
                    <span className={clsx('badge text-[10px]',
                      company.status === 'APPROVED' && 'badge-open',
                      company.status === 'PENDING' && 'badge-pending',
                      company.status === 'SUSPENDED' && 'bg-red-500/15 text-red-400 border-red-500/20',
                    )}>{company.status}</span>
                  </div>
                  <p className='text-xs text-ink-400 mt-1'>{company.email}</p>
                  <p className='text-xs text-ink-500 mt-1'>{[profile?.city, profile?.country].filter(Boolean).join(', ') || 'Location not set'}</p>
                  {profile?.website && (
                    <a href={profile.website} target='_blank' rel='noreferrer' className='text-xs text-ember-400 hover:text-ember-300 inline-flex gap-1 mt-1'>
                      Website <ExternalLink size={11} />
                    </a>
                  )}
                </div>
                <div className='flex flex-wrap gap-2 sm:justify-end'>
                  {(company.status === 'PENDING' || company.status === 'REJECTED') && <button onClick={() => userApi.approve(company.id).then(invalidate)} className='btn-primary text-xs px-3 py-1.5'><CheckCircle size={13} /> Approve</button>}
                  {company.status === 'PENDING' && <button onClick={() => userApi.reject(company.id, rejectReason).then(invalidate)} className='btn-secondary text-xs px-3 py-1.5 text-red-300'><XCircle size={13} /> Reject</button>}
                  {company.status === 'APPROVED' && <button onClick={() => statusMutation.mutate({ id: company.id, suspended: true })} className='btn-secondary text-xs px-3 py-1.5'><PauseCircle size={13} /> Suspend</button>}
                  {company.status === 'SUSPENDED' && <button onClick={() => statusMutation.mutate({ id: company.id, suspended: false })} className='btn-primary text-xs px-3 py-1.5'><PlayCircle size={13} /> Unsuspend</button>}
                  {company.status === 'REJECTED' && <button onClick={() => confirm(`Delete ${getUserName(company)} so this email can register again?`) && userApi.deleteRejected(company.id).then(invalidate)} className='btn-secondary text-xs px-3 py-1.5 text-red-300'><Trash2 size={13} /> Delete</button>}
                  <button onClick={() => setExpanded(isOpen ? null : company.id)} className='btn-ghost text-xs'>
                    {isOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />} Projects ({relatedProjects.length})
                  </button>
                </div>
              </div>
              {isOpen && (
                <div className='border-t border-ink-800/50 px-5 py-4'>
                  {relatedProjects.length === 0 ? (
                    <p className='text-xs text-ink-500'>No projects posted yet.</p>
                  ) : (
                    <div className='space-y-2'>
                      {relatedProjects.map((project) => (
                        <div key={project.id} className='p-3 rounded-xl bg-ink-800/50 border border-ink-700/40 flex items-center gap-3'>
                          <div className='flex-1'>
                            <p className='text-sm font-medium text-ink-100'>{project.title}</p>
                            <p className='text-xs text-ink-500'>{project.projectField ?? project.companyIndustry ?? 'No field'} · {project.partyApplicationCount} applications</p>
                          </div>
                          <span className='badge text-[10px] bg-ink-700/50 text-ink-300 border-ink-600/30'>{project.status.replace('_', ' ')}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
