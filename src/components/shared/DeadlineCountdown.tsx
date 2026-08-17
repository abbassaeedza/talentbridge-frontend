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

const TONE_TEXT = {
  danger: 'text-danger',
  warning: 'text-warning',
  success: 'text-success',
} as const;

function dueLabel(deadline: string) {
  return new Date(deadline).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

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
      <div className={clsx('panel p-5', className)}>
        {label && <p className='text-xs text-muted'>{label}</p>}
        {title && <h3 className='mt-1 truncate text-lg font-medium'>{title}</h3>}
        <p className='mt-5 flex items-center gap-2 text-sm text-success'>
          <CheckCircle2 size={16} /> Submission received
        </p>
      </div>
    ) : (
      <span className={clsx('inline-flex items-center gap-1.5 text-xs text-success', className)}>
        <CheckCircle2 size={13} /> Submitted
      </span>
    );
  }

  if (!deadline) {
    return hero ? (
      <div className={clsx('panel p-5', className)}>
        {label && <p className='text-xs text-muted'>{label}</p>}
        {title && <h3 className='mt-1 truncate text-lg font-medium'>{title}</h3>}
        <p className='mt-5 flex items-center gap-2 text-sm text-muted'><Clock3 size={16} /> No deadline scheduled</p>
      </div>
    ) : (
      <span className={clsx('inline-flex items-center gap-1.5 text-xs text-muted', className)}>
        <Clock3 size={13} /> No deadline
      </span>
    );
  }

  const remaining = getTimeLeft(deadline);
  const expired = !remaining;
  const urgent = remaining && remaining.totalHours < 48;
  const warning = remaining && !urgent && remaining.totalHours <= 24 * 7;
  const tone = expired || urgent ? 'danger' : warning ? 'warning' : 'success';
  const status = expired ? 'Expired' : urgent ? 'Urgent' : warning ? 'Due soon' : 'On track';

  if (expired) {
    return hero ? (
      <div className={clsx('panel p-5', className)}>
        <Header label={label} title={title} status={status} tone={tone} />
        <p className='mt-5 font-mono text-4xl tabular-nums tracking-tight text-danger sm:text-5xl'>00:00:00</p>
        <p className='mt-2 text-sm text-muted'>Passed {dueLabel(deadline)}</p>
      </div>
    ) : (
      <span className={clsx('inline-flex items-center font-mono text-[11px] tabular-nums text-danger', className)}>Expired</span>
    );
  }

  const time = `${remaining.days}d ${pad(remaining.hours)}:${pad(remaining.minutes)}:${pad(remaining.seconds)}`;

  if (hero) {
    return (
      <div className={clsx('panel p-5', className)}>
        <Header label={label} title={title} status={status} tone={tone} />
        <p className={clsx('mt-5 font-mono text-4xl tabular-nums tracking-tight sm:text-5xl', TONE_TEXT[tone])} aria-label={`${time} remaining`}>
          {time}
        </p>
        <p className='mt-2 text-sm text-muted'>Due {dueLabel(deadline)}</p>
      </div>
    );
  }

  if (compact) {
    return (
      <span
        aria-label={`${status}: ${time} remaining`}
        className={clsx('inline-flex items-center font-mono text-[11px] tabular-nums', TONE_TEXT[tone], className)}
      >
        {time}
      </span>
    );
  }

  return (
    <div className={clsx('panel p-4', className)}>
      {label && <p className='text-xs text-muted'>{label}</p>}
      <p className={clsx('mt-1 font-mono text-xl tracking-tight tabular-nums', TONE_TEXT[tone])}>{time}</p>
      <p className='mt-1 text-xs text-muted'>Due {dueLabel(deadline)}</p>
    </div>
  );
}

function Header({
  label,
  title,
  status,
  tone,
}: {
  label?: string;
  title?: string;
  status: string;
  tone: keyof typeof TONE_TEXT;
}) {
  return (
    <div className='flex items-start justify-between gap-4'>
      <div className='min-w-0'>
        {label && <p className='text-xs text-muted'>{label}</p>}
        {title && <h3 className='mt-1 truncate text-lg font-medium text-foreground'>{title}</h3>}
      </div>
      <span className={clsx('shrink-0 text-xs', TONE_TEXT[tone])}>{status}</span>
    </div>
  );
}
