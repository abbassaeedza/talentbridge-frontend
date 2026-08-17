import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Moon, Sun } from 'lucide-react';
import { Button } from '@heroui/react/button';
import { Modal } from '@heroui/react/modal';
import { SearchField } from '@heroui/react/search-field';
import { Spinner } from '@heroui/react/spinner';
import clsx from 'clsx';
import { useTheme } from '../../hooks/useTheme';

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className='flex items-center gap-3' aria-label='TalentBridge'>
      <img src='/talentbridge-mark.png' alt='' className='size-9 object-contain dark:invert dark:opacity-90' aria-hidden='true' />
      {!compact && <span className='text-lg font-medium tracking-tight'>TalentBridge</span>}
    </div>
  );
}

export function PublicShell({ children }: { children: ReactNode }) {
  const { theme, toggleTheme } = useTheme();
  return (
    <main className='grid min-h-dvh bg-background lg:grid-cols-[minmax(20rem,38%)_1fr]'>
      <section className='hidden border-r border-border bg-surface p-10 lg:flex lg:flex-col lg:justify-between'>
        <Brand />
        <div className='max-w-md'>
          <p className='text-3xl font-medium leading-tight tracking-tight'>
            Academic project collaboration, kept accountable.
          </p>
          <p className='mt-4 text-sm leading-6 text-muted'>
            Manage student teams, industry projects, supervision, submissions, and evaluation in one workspace.
          </p>
        </div>
        <p className='text-xs text-muted'>TalentBridge</p>
      </section>
      <section className='relative flex min-w-0 items-center justify-center px-5 py-8 sm:px-8'>
        <div className='absolute right-4 top-4'>
          <Button
            isIconOnly
            size='sm'
            variant='ghost'
            aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            onPress={toggleTheme}
          >
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </Button>
        </div>
        <div className='w-full max-w-lg'>
          <div className='mb-10 lg:hidden'><Brand /></div>
          {children}
        </div>
      </section>
    </main>
  );
}

export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <header className='mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between'>
      <div>
        <h1 className='text-2xl font-medium tracking-tight sm:text-3xl'>{title}</h1>
        {description && <p className='mt-1 text-sm text-muted'>{description}</p>}
      </div>
      {action && <div className='flex shrink-0 items-center gap-2'>{action}</div>}
    </header>
  );
}

export function ListToolbar({
  searchLabel,
  placeholder,
  value,
  onChange,
  onSubmit,
  filters,
  selection,
}: {
  searchLabel: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  onSubmit?: (value: string) => void;
  filters?: ReactNode;
  selection?: ReactNode;
}) {
  return (
    <div className='mb-5 panel p-4'>
      <div className='flex flex-col gap-3 sm:flex-row sm:items-end'>
        <SearchField fullWidth className='min-w-0 flex-1' aria-label={searchLabel} value={value} onChange={onChange} onSubmit={onSubmit}>
          <SearchField.Group>
            <SearchField.SearchIcon />
            <SearchField.Input placeholder={placeholder} />
            <SearchField.ClearButton />
          </SearchField.Group>
        </SearchField>
        {filters && <div className='flex w-full shrink-0 flex-wrap items-end gap-3 sm:w-auto'>{filters}</div>}
      </div>
      {selection && <div className='mt-3 flex min-h-8 items-center gap-2 text-sm text-muted'>{selection}</div>}
    </div>
  );
}

export function StatCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: ReactNode;
  icon: LucideIcon;
}) {
  return (
    <div className='panel flex items-center justify-between gap-3 px-3 py-2.5'>
      <p className='flex min-w-0 items-center gap-1.5 text-xs text-muted'>
        <Icon size={13} aria-hidden='true' />
        {label}
      </p>
      <p className='text-lg font-semibold tabular-nums tracking-tight'>{value}</p>
    </div>
  );
}

function formatStatus(value: string) {
  const text = value.replace(/_/g, ' ').toLowerCase();
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function statusTone(status: string) {
  switch (status) {
    case 'APPROVED':
    case 'ACCEPTED':
    case 'OPEN':
    case 'ACTIVE':
    case 'ASSIGNED':
    case 'COMPLETED':
    case 'EVALUATED':
      return 'text-success';
    case 'PENDING':
    case 'PENDING_REVIEW':
    case 'FORMING':
    case 'DRAFT':
    case 'SUBMITTED':
    case 'UNDER_EVALUATION':
    case 'REASSIGNED':
      return 'text-warning';
    case 'REJECTED':
    case 'SUSPENDED':
    case 'ARCHIVED':
    case 'REVOKED':
    case 'EXPIRED':
    case 'WITHDRAWN':
      return 'text-danger';
    default:
      return 'text-muted';
  }
}

export function StatusBadge({ status, label, className }: { status: string; label?: string; className?: string }) {
  return (
    <span className={clsx('inline-flex items-center gap-1.5 text-xs', statusTone(status), className)}>
      <span className='size-1.5 shrink-0 rounded-full bg-current' aria-hidden='true' />
      {formatStatus(label ?? status)}
    </span>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className='rounded-lg border border-dashed border-border px-5 py-14 text-center'>
      <Icon size={28} className='mx-auto text-muted' />
      <p className='mt-4 text-sm font-semibold'>{title}</p>
      {description && <p className='mx-auto mt-1 max-w-md text-sm leading-6 text-muted'>{description}</p>}
      {action && <div className='mt-5 flex justify-center'>{action}</div>}
    </div>
  );
}

export function ConfirmationDialog({
  open,
  title,
  description,
  confirmLabel = 'Confirm',
  pending = false,
  danger = false,
  onClose,
  onConfirm,
}: {
  open: boolean;
  title: string;
  description: ReactNode;
  confirmLabel?: string;
  pending?: boolean;
  danger?: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <Modal isOpen={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <Modal.Backdrop isDismissable={!pending}>
        <Modal.Container>
          <Modal.Dialog className='max-w-md'>
            <Modal.Header><Modal.Heading>{title}</Modal.Heading></Modal.Header>
            <Modal.Body><div className='text-sm leading-6 text-muted'>{description}</div></Modal.Body>
            <Modal.Footer>
              <Button variant='ghost' isDisabled={pending} onPress={onClose}>Cancel</Button>
              <Button variant={danger ? 'danger' : 'primary'} isDisabled={pending} onPress={onConfirm}>{pending && <Spinner size='sm' />}{confirmLabel}</Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}
