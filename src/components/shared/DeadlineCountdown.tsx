import { useEffect, useState } from 'react';
import { CheckCircle2, Clock3 } from 'lucide-react';
import clsx from 'clsx';

interface Props {
  deadline: string | null | undefined;
  submitted?: boolean;
  label?: string;
  title?: string;
  compact?: boolean;
  hero?: boolean;
  className?: string;
}

function getTimeLeft(deadline: string) {
  const difference = new Date(deadline).getTime() - Date.now();
  if (difference <= 0) return null;
  const seconds = Math.floor(difference / 1000);
  return {
    days: Math.floor(seconds / 86400),
    hours: Math.floor((seconds % 86400) / 3600),
    minutes: Math.floor((seconds % 3600) / 60),
    seconds: seconds % 60,
    totalHours: seconds / 3600,
  };
}

const pad = (value: number) => String(value).padStart(2, '0');

export default function DeadlineCountdown({
  deadline,
  submitted = false,
  label,
  title,
  compact = false,
  hero = false,
  className,
}: Props) {
  const [, refresh] = useState(0);

  useEffect(() => {
    if (!deadline || submitted) return;
    const timer = window.setInterval(() => refresh((value) => value + 1), 1000);
    return () => window.clearInterval(timer);
  }, [deadline, submitted]);

  if (submitted) {
    return hero ? (
      <div className={clsx('rounded-lg border border-border border-t-4 border-t-success bg-surface p-5', className)}>
        <div className='flex items-start justify-between gap-4'>
          <div>
            {label && <p className='text-xs font-semibold uppercase tracking-wider text-muted'>{label}</p>}
            {title && <h3 className='mt-1 text-xl font-semibold'>{title}</h3>}
          </div>
          <span className='rounded-sm bg-success px-2 py-1 text-xs font-semibold text-success-foreground'>Submitted</span>
        </div>
        <div className='mt-6 flex items-center gap-3'>
          <CheckCircle2 className='text-success' size={28} />
          <div>
            <p className='font-semibold'>Submission received</p>
            <p className='text-sm text-muted'>The deadline countdown has stopped.</p>
          </div>
        </div>
      </div>
    ) : (
      <span className={clsx('inline-flex items-center gap-1.5 rounded-sm bg-success px-2 py-1 text-xs font-semibold text-success-foreground', className)}>
        <CheckCircle2 size={13} /> Submitted
      </span>
    );
  }

  if (!deadline) {
    return hero ? (
      <div className={clsx('rounded-lg border border-border bg-surface p-5', className)}>
        {label && <p className='text-xs font-semibold uppercase tracking-wider text-muted'>{label}</p>}
        {title && <h3 className='mt-1 text-xl font-semibold'>{title}</h3>}
        <p className='mt-6 flex items-center gap-2 text-sm text-muted'><Clock3 size={18} /> No deadline scheduled</p>
      </div>
    ) : (
      <span className={clsx('inline-flex items-center gap-1.5 rounded-sm bg-default px-2 py-1 text-xs text-muted', className)}>
        <Clock3 size={13} /> No deadline
      </span>
    );
  }

  const remaining = getTimeLeft(deadline);
  const expired = !remaining;
  const urgent = remaining && remaining.totalHours < 48;
  const warning = remaining && !urgent && remaining.totalHours <= 24 * 7;
  const color = expired || urgent ? 'danger' : warning ? 'warning' : 'success';
  const status = expired ? 'Expired' : urgent ? 'Urgent' : warning ? 'Due soon' : 'On track';
  const colorClasses = {
    danger: 'border-t-danger text-danger',
    warning: 'border-t-warning text-warning',
    success: 'border-t-success text-success',
  }[color];
  const badgeClasses = {
    danger: 'bg-danger text-danger-foreground',
    warning: 'bg-warning text-warning-foreground',
    success: 'bg-success text-success-foreground',
  }[color];
  const leftBorderClasses = {
    danger: 'border-l-danger',
    warning: 'border-l-warning',
    success: 'border-l-success',
  }[color];

  if (expired) {
    return hero ? (
      <div className={clsx('rounded-lg border border-border border-t-4 bg-surface p-5', colorClasses, className)}>
        <div className='flex items-start justify-between gap-4'>
          <div>
            {label && <p className='text-xs font-semibold uppercase tracking-wider text-muted'>{label}</p>}
            {title && <h3 className='mt-1 text-xl font-semibold text-foreground'>{title}</h3>}
          </div>
          <span className={clsx('rounded-sm px-2 py-1 text-xs font-semibold', badgeClasses)}>Expired</span>
        </div>
        <p className='mt-6 text-lg font-semibold text-foreground'>Deadline passed</p>
        <p className='mt-1 text-sm text-muted'>{new Date(deadline).toLocaleString('en-GB')}</p>
      </div>
    ) : (
      <span className={clsx('inline-flex items-center rounded-sm px-2 py-1 text-xs font-semibold', badgeClasses, className)}>Expired</span>
    );
  }

  const time = `${remaining.days}d ${pad(remaining.hours)}:${pad(remaining.minutes)}:${pad(remaining.seconds)}`;

  if (hero) {
    const blocks = [
      ['Days', String(remaining.days)],
      ['Hours', pad(remaining.hours)],
      ['Minutes', pad(remaining.minutes)],
      ['Seconds', pad(remaining.seconds)],
    ];
    return (
      <div className={clsx('rounded-lg border border-border border-t-4 bg-surface p-5', colorClasses, className)}>
        <div className='flex items-start justify-between gap-4'>
          <div className='min-w-0'>
            {label && <p className='text-xs font-semibold uppercase tracking-wider text-muted'>{label}</p>}
            {title && <h3 className='mt-1 truncate text-xl font-semibold text-foreground'>{title}</h3>}
          </div>
          <span className={clsx('shrink-0 rounded-sm px-2 py-1 text-xs font-semibold', badgeClasses)}>{status}</span>
        </div>
        <div className='mt-5 grid grid-cols-4 gap-2' aria-label={`${time} remaining`}>
          {blocks.map(([unit, value]) => (
            <div key={unit} className='rounded-md bg-surface-secondary px-2 py-3 text-center'>
              <p className='font-mono text-2xl font-semibold text-foreground sm:text-3xl'>{value}</p>
              <p className='mt-1 text-[10px] font-semibold uppercase tracking-wider text-muted'>{unit}</p>
            </div>
          ))}
        </div>
        <p className='mt-4 text-xs text-muted'>
          Due {new Date(deadline).toLocaleDateString('en-GB', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          })}
        </p>
      </div>
    );
  }

  if (compact) {
    return (
      <span
        aria-label={`${status}: ${time} remaining`}
        className={clsx('inline-flex items-center gap-1.5 rounded-sm px-2 py-1 font-mono text-[11px] font-semibold', badgeClasses, className)}
      >
        {time}
      </span>
    );
  }

  return (
    <div className={clsx('rounded-md border border-border border-l-4 bg-surface p-3', leftBorderClasses, className)}>
      {label && <p className='text-[10px] font-semibold uppercase tracking-wider text-muted'>{label}</p>}
      <p className='mt-1 font-mono text-sm font-semibold text-foreground'>{time}</p>
      <p className='mt-1 text-[10px] text-muted'>{new Date(deadline).toLocaleString('en-GB')}</p>
    </div>
  );
}
