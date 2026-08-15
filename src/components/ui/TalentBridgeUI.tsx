import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Layers, Moon, Sun } from 'lucide-react';
import { Button } from '@heroui/react/button';
import { Chip } from '@heroui/react/chip';
import clsx from 'clsx';
import { useTheme } from '../../hooks/useTheme';

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className='flex items-center gap-3' aria-label='TalentBridge'>
      <span className='flex size-9 items-center justify-center rounded-md bg-brand-mark text-white'>
        <Layers size={18} aria-hidden='true' />
      </span>
      {!compact && <span className='text-lg font-semibold tracking-tight'>TalentBridge</span>}
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
          <p className='text-3xl font-semibold leading-tight tracking-tight'>
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
        <h1 className='text-2xl font-semibold tracking-tight sm:text-3xl'>{title}</h1>
        {description && <p className='mt-1 text-sm text-muted'>{description}</p>}
      </div>
      {action && <div className='flex shrink-0 items-center gap-2'>{action}</div>}
    </header>
  );
}

export function StatCard({
  label,
  value,
  detail,
  icon: Icon,
}: {
  label: string;
  value: ReactNode;
  detail?: ReactNode;
  icon: LucideIcon;
}) {
  return (
    <section className='rounded-lg border border-border bg-surface p-4'>
      <div className='flex items-start justify-between gap-4'>
        <p className='text-sm text-muted'>{label}</p>
        <Icon size={18} className='text-muted' aria-hidden='true' />
      </div>
      <p className='mt-4 text-2xl font-semibold tracking-tight'>{value}</p>
      {detail && <div className='mt-1 text-xs text-muted'>{detail}</div>}
    </section>
  );
}

const STATUS_COLOR: Record<string, 'success' | 'warning' | 'danger' | 'default' | 'accent'> = {
  APPROVED: 'success',
  ACTIVE: 'success',
  OPEN: 'success',
  EVALUATED: 'success',
  PENDING: 'warning',
  PENDING_REVIEW: 'warning',
  REJECTED: 'danger',
  SUSPENDED: 'danger',
  CLOSED: 'default',
  ASSIGNED: 'accent',
};

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  return (
    <Chip
      size='sm'
      variant='soft'
      color={STATUS_COLOR[status] ?? 'default'}
      className={clsx('uppercase', className)}
    >
      {status.replace(/_/g, ' ')}
    </Chip>
  );
}
