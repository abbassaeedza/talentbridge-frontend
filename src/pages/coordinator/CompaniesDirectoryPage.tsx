import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { projectApi, userApi } from '../../api/services';
import { getUserName } from '../../types';
import { Building2, ChevronDown, ChevronUp, ExternalLink, PauseCircle, PlayCircle, Search } from 'lucide-react';
import clsx from 'clsx';
import useUserStatusMutation from '../../hooks/useUserStatusMutation';

export default function CompaniesDirectoryPage() {
  const [query, setQuery] = useState('');
  const [industry, setIndustry] = useState('ALL');
  const [expanded, setExpanded] = useState<string | null>(null);

  const { data: companies, isLoading } = useQuery({
    queryKey: ['directory-companies'],
    queryFn: () => userApi.getCompanies().then((r) => r.data),
  });
  const { data: projects } = useQuery({
    queryKey: ['company-directory-projects'],
    queryFn: () => projectApi.getAll(0, 200).then((r) => r.data.content),
  });

  const statusMutation = useUserStatusMutation([['directory-companies']], 'Company');

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

  return (
    <div className='animate-fade-up'>
      <div className='page-header'>
        <h1 className='page-title'>Companies Directory</h1>
        <p className='page-subtitle'>{filtered.length} company account{filtered.length === 1 ? '' : 's'} shown</p>
      </div>

      <div className='card p-4 mb-5 grid md:grid-cols-[1fr_auto] gap-3'>
        <div className='relative'>
          <Search size={15} className='absolute left-3 top-1/2 -translate-y-1/2 text-ink-500' />
          <input className='input pl-9' placeholder='Search company, industry, location…' value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <select className='input text-sm' value={industry} onChange={(e) => setIndustry(e.target.value)}>
          {industries.map((i) => <option key={i} value={i}>{i === 'ALL' ? 'All industries' : i}</option>)}
        </select>
      </div>

      <div className='space-y-3'>
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => <div key={i} className='card h-20 animate-pulse' />)
        ) : filtered.length === 0 ? (
          <div className='card p-12 text-center text-sm text-ink-400'>No companies found.</div>
        ) : filtered.map((company) => {
          const profile = company.companyProfile;
          const relatedProjects = (projects ?? []).filter((p) => p.companyId === profile?.id || p.companyName === profile?.companyName);
          const isOpen = expanded === company.id;
          return (
            <div key={company.id} className='card overflow-hidden'>
              <div className='px-6 py-4 flex items-start gap-4'>
                <div className='w-11 h-11 rounded-xl bg-ink-700 flex items-center justify-center text-ink-200'>
                  <Building2 size={20} />
                </div>
                <div className='flex-1'>
                  <div className='flex flex-wrap items-center gap-2'>
                    <h3 className='font-semibold text-white'>{profile?.companyName ?? getUserName(company)}</h3>
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
                <div className='flex gap-2'>
                  {company.status === 'APPROVED' && <button onClick={() => statusMutation.mutate({ id: company.id, suspended: true })} className='btn-secondary text-xs px-3 py-1.5'><PauseCircle size={13} /> Suspend</button>}
                  {company.status === 'SUSPENDED' && <button onClick={() => statusMutation.mutate({ id: company.id, suspended: false })} className='btn-primary text-xs px-3 py-1.5'><PlayCircle size={13} /> Unsuspend</button>}
                  <button onClick={() => setExpanded(isOpen ? null : company.id)} className='btn-ghost text-xs'>
                    {isOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />} Projects ({relatedProjects.length})
                  </button>
                </div>
              </div>
              {isOpen && (
                <div className='border-t border-ink-800/50 px-6 py-4'>
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
    </div>
  );
}
