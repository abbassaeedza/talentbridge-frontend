import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { projectApi, userApi } from '../../api/services';
import { getUserName } from '../../types';
import { Building2, CheckCircle, ChevronDown, ChevronUp, ExternalLink, PauseCircle, PlayCircle, Trash2, XCircle } from 'lucide-react';
import clsx from 'clsx';
import useUserStatusMutation from '../../hooks/useUserStatusMutation';
import toast from 'react-hot-toast';
import BulkActionToolbar from '../../components/coordinator/BulkActionToolbar';
import { Button } from '@heroui/react/button';
import { Checkbox } from '@heroui/react/checkbox';
import { Label } from '@heroui/react/label';
import { ListBox } from '@heroui/react/list-box';
import { Select } from '@heroui/react/select';
import { Spinner } from '@heroui/react/spinner';
import { Tabs } from '@heroui/react/tabs';
import { ListToolbar, PageHeader, StatusBadge } from '../../components/ui/TalentBridgeUI';

export default function CompaniesDirectoryPage() {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('ALL');
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
      .filter((c) => status === 'ALL' || c.status === status)
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
  }, [companies, query, status, industry]);
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
    <div className=''>
      <PageHeader title='Companies' description={`${companyGroups.length} compan${companyGroups.length === 1 ? 'y' : 'ies'} · ${filtered.length} profile${filtered.length === 1 ? '' : 's'}`} />

      <Tabs.Root variant='secondary' selectedKey={status} onSelectionChange={(key) => { setStatus(String(key)); setSelected([]); }} className='mb-4'><Tabs.ListContainer><Tabs.List aria-label='Company approval status'>{([
          ['ALL', 'All Companies'],
          ['PENDING', 'Pending Requests'],
          ['APPROVED', 'Approved'],
          ['SUSPENDED', 'Suspended'],
          ['REJECTED', 'Rejected'],
        ] as const).map(([value, label]) => (
          <Tabs.Tab key={value} id={value}><Tabs.Indicator />{label}</Tabs.Tab>
        ))}
      </Tabs.List></Tabs.ListContainer></Tabs.Root>

      <ListToolbar
        searchLabel='Search companies'
        placeholder='Search company, industry, or location'
        value={query}
        onChange={setQuery}
        filters={<Select.Root className='w-full sm:w-48' aria-label='Industry' selectedKey={industry} onSelectionChange={(key) => setIndustry(String(key))}><Label className='sr-only'>Industry</Label><Select.Trigger><Select.Value /><Select.Indicator /></Select.Trigger><Select.Popover><ListBox>{industries.map((item) => <ListBox.Item key={item} id={item} textValue={item === 'ALL' ? 'All industries' : item}>{item === 'ALL' ? 'All industries' : item}</ListBox.Item>)}</ListBox></Select.Popover></Select.Root>}
        selection={<><SelectCheckbox selected={allFilteredSelected} onChange={() => setSelected(allFilteredSelected ? [] : filtered.map((company) => company.id))} label='Select all filtered companies' /><span>Select all {filtered.length} filtered companies</span></>}
      />

      <BulkActionToolbar noun='company' selectedCount={selected.length} eligible={eligible} rejectionReason={rejectReason} onRejectionReasonChange={setRejectReason} loadingAction={bulkAction} onAction={runBulk} />

      <div className='space-y-3'>
        {isLoading ? (
          <div className='flex min-h-48 items-center justify-center'><Spinner /></div>
        ) : filtered.length === 0 ? (
          <div className='rounded-lg border border-border bg-surface p-12 text-center text-sm text-muted'>No companies found.</div>
        ) : companyGroups.map((group) => (
          <section key={group.name} className='rounded-lg border border-border bg-surface overflow-hidden'>
            <div className='flex items-center gap-3 border-b border-border bg-surface-secondary px-5 py-3'>
              <div className='flex h-9 w-9 items-center justify-center rounded-lg bg-accent text-accent'>
                <Building2 size={17} />
              </div>
              <div>
                <h2 className=' font-semibold text-foreground'>{group.name}</h2>
                <p className='text-[11px] text-muted'>{group.accounts.length} company profile{group.accounts.length === 1 ? '' : 's'}</p>
              </div>
            </div>
            <div className='divide-y divide-separator'>
              {group.accounts.map((company, index) => {
                const profile = company.companyProfile;
                const relatedProjects = (projects ?? []).filter((p) => p.companyId === profile?.id);
                const isOpen = expanded === company.id;
                return (
                  <div key={company.id}>
              <div className='flex flex-col gap-4 px-5 py-4 sm:flex-row sm:items-start'>
                <SelectCheckbox label={`Select ${getUserName(company)}`} selected={selected.includes(company.id)} onChange={() => setSelected((current) => current.includes(company.id)
                    ? current.filter((id) => id !== company.id)
                    : [...current, company.id])} />
                <div className='flex-1'>
                  <div className='flex flex-wrap items-center gap-2'>
                    <h3 className='font-semibold text-foreground'>{getUserName(company)}</h3>
                    <span className='inline-flex items-center rounded-sm bg-default px-2 py-1 font-medium text-[10px] bg-default text-foreground border-border'>Profile {index + 1}</span>
                    <span className='inline-flex items-center rounded-sm bg-default px-2 py-1 text-xs font-medium text-foreground text-[10px]'>{profile?.industry ?? 'Industry not set'}</span>
                    <StatusBadge status={company.status} />
                  </div>
                  <p className='text-xs text-muted mt-1'>{company.email}</p>
                  <p className='text-xs text-muted mt-1'>{[profile?.city, profile?.country].filter(Boolean).join(', ') || 'Location not set'}</p>
                  {profile?.website && (
                    <a href={profile.website} target='_blank' rel='noreferrer' className='text-xs text-accent hover:text-accent inline-flex gap-1 mt-1'>
                      Website <ExternalLink size={11} />
                    </a>
                  )}
                </div>
                <div className='flex flex-wrap gap-2 sm:justify-end'>
                  {(company.status === 'PENDING' || company.status === 'REJECTED') && <Button size='sm' variant='primary' onPress={() => userApi.approve(company.id).then(invalidate)}><CheckCircle size={13} /> Approve</Button>}
                  {company.status === 'PENDING' && <Button size='sm' variant='danger-soft' onPress={() => userApi.reject(company.id, rejectReason).then(invalidate)}><XCircle size={13} /> Reject</Button>}
                  {company.status === 'APPROVED' && <Button size='sm' variant='secondary' onPress={() => statusMutation.mutate({ id: company.id, suspended: true })}><PauseCircle size={13} /> Suspend</Button>}
                  {company.status === 'SUSPENDED' && <Button size='sm' variant='primary' onPress={() => statusMutation.mutate({ id: company.id, suspended: false })}><PlayCircle size={13} /> Unsuspend</Button>}
                  {company.status === 'REJECTED' && <Button size='sm' variant='danger-soft' onPress={() => confirm(`Delete ${getUserName(company)} so this email can register again?`) && userApi.deleteRejected(company.id).then(invalidate)}><Trash2 size={13} /> Delete</Button>}
                  <Button size='sm' variant='ghost' onPress={() => setExpanded(isOpen ? null : company.id)}>
                    {isOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />} Projects ({relatedProjects.length})
                  </Button>
                </div>
              </div>
              {isOpen && (
                <div className='border-t border-border px-5 py-4'>
                  {relatedProjects.length === 0 ? (
                    <p className='text-xs text-muted'>No projects posted yet.</p>
                  ) : (
                    <div className='space-y-2'>
                      {relatedProjects.map((project) => (
                        <div key={project.id} className='p-3 rounded-lg bg-surface-secondary border border-border flex items-center gap-3'>
                          <div className='flex-1'>
                            <p className='text-sm font-medium text-foreground'>{project.title}</p>
                            <p className='text-xs text-muted'>{project.projectField ?? project.companyIndustry ?? 'No field'} · {project.partyApplicationCount} applications</p>
                          </div>
                          <span className='inline-flex items-center rounded-sm bg-default px-2 py-1 font-medium text-[10px] bg-default text-foreground border-border'>{project.status.replace('_', ' ')}</span>
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

function SelectCheckbox({ selected, onChange, label }: { selected: boolean; onChange: (selected: boolean) => void; label: string }) {
  return <Checkbox isSelected={selected} onChange={onChange} aria-label={label}><Checkbox.Content><Checkbox.Control><Checkbox.Indicator /></Checkbox.Control></Checkbox.Content></Checkbox>;
}
