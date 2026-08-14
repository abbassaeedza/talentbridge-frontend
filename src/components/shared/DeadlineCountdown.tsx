import { useEffect, useState } from 'react';
import { CheckCircle, Clock } from 'lucide-react';
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
  const diff = new Date(deadline).getTime() - Date.now();
  if (diff <= 0) return null;
  const s = Math.floor(diff / 1000);
  return {
    d: Math.floor(s / 86400),
    h: Math.floor((s % 86400) / 3600),
    m: Math.floor((s % 3600) / 60),
    s: s % 60,
    totalHours: s / 3600,
  };
}

function pad(n: number) {
  return String(n).padStart(2, '0');
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
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  // Submitted - always green
  if (submitted) {
    if (hero) {
      return (
        <div className={clsx('rounded-3xl border border-jade-500/30 bg-jade-500/10 p-5 text-jade-400 sm:p-6', className)}>
          <div className='flex items-start justify-between gap-4'>
            <div>
              {label && <p className='text-xs font-semibold uppercase tracking-widest opacity-75'>{label}</p>}
              {title && <h3 className='mt-2 font-display text-xl font-bold text-white sm:text-2xl'>{title}</h3>}
            </div>
            <span className='rounded-full border border-jade-500/30 bg-jade-500/15 px-3 py-1 text-xs font-semibold'>Submitted</span>
          </div>
          <div className='mt-6 flex items-center gap-3'>
            <CheckCircle size={32} />
            <div>
              <p className='font-display text-2xl font-bold text-white'>Project submitted</p>
              <p className='mt-1 text-sm opacity-75'>The deadline countdown has stopped.</p>
            </div>
          </div>
        </div>
      );
    }
    return (
      <div
        className={clsx(
          'inline-flex items-center gap-1.5 rounded-xl font-medium border',
          compact ? 'px-2.5 py-1 text-[11px]' : 'px-3 py-1.5 text-xs',
          'bg-jade-500/15 border-jade-500/30 text-jade-400',
          className,
        )}
      >
        <CheckCircle size={compact ? 10 : 12} />
        Submitted ✓
      </div>
    );
  }

  // No deadline
  if (!deadline) {
    if (hero) {
      return (
        <div className={clsx('rounded-3xl border border-ink-700/50 bg-ink-900 p-5 sm:p-6', className)}>
          {label && <p className='text-xs uppercase tracking-widest font-semibold text-ink-400'>{label}</p>}
          {title && <h3 className='mt-2 font-display text-xl font-bold text-white'>{title}</h3>}
          <div className='mt-6 flex items-center gap-3 text-ink-400'>
            <Clock size={28} />
            <span className='font-display text-xl font-semibold'>No deadline scheduled</span>
          </div>
        </div>
      );
    }

    return (
      <div
        className={clsx(
          'inline-flex items-center gap-1.5 rounded-xl border',
          compact ? 'px-2.5 py-1 text-[11px]' : 'px-3 py-1.5 text-xs',
          'bg-ink-800 border-ink-700/50 text-ink-500',
          className,
        )}
      >
        <Clock size={compact ? 10 : 12} />
        No deadline
      </div>
    );
  }

  const left = getTimeLeft(deadline);

  // Expired
  if (!left) {
    if (hero) {
      return (
        <div className={clsx('rounded-3xl border border-red-500/30 bg-red-500/10 p-5 sm:p-6 text-red-400', className)}>
          <div className='flex items-start justify-between gap-4'>
            <div>
              {label && <p className='text-xs uppercase tracking-widest font-semibold opacity-75'>{label}</p>}
              {title && <h3 className='mt-2 font-display text-xl font-bold text-white'>{title}</h3>}
            </div>
            <span className='rounded-full border border-red-500/30 bg-red-500/15 px-3 py-1 text-xs font-semibold'>Expired</span>
          </div>
          <p className='mt-6 font-display text-3xl font-bold'>Deadline expired</p>
          <p className='mt-2 text-sm opacity-75'>{new Date(deadline).toLocaleString('en-GB')}</p>
        </div>
      );
    }

    return (
      <div
        className={clsx(
          'inline-flex items-center gap-1.5 rounded-xl font-medium border',
          compact ? 'px-2.5 py-1 text-[11px]' : 'px-3 py-1.5 text-xs',
          'bg-red-500/15 border-red-500/30 text-red-400',
          className,
        )}
      >
        <span className='w-1.5 h-1.5 rounded-full bg-red-400 motion-safe:animate-pulse flex-shrink-0' />
        Expired
      </div>
    );
  }

  const isRed = left.totalHours < 48;
  const isAmber = !isRed && left.totalHours <= 24 * 7;

  const colourCls = isRed
    ? 'bg-red-500/15 border-red-500/30 text-red-400'
    : isAmber
      ? 'bg-amber-500/15 border-amber-500/30 text-amber-400'
      : 'bg-jade-500/15 border-jade-500/30 text-jade-400';

  const dotCls = isRed
    ? 'bg-red-400 motion-safe:animate-pulse'
    : isAmber
      ? 'bg-amber-400'
      : 'bg-jade-400';

  const timeStr = `${left.d}d ${pad(left.h)}:${pad(left.m)}:${pad(left.s)}`;
  const status = isRed ? 'Urgent' : isAmber ? 'Due soon' : 'On track';

  if (hero) {
    const blocks = [
      ['Days', String(left.d)],
      ['Hours', pad(left.h)],
      ['Minutes', pad(left.m)],
      ['Seconds', pad(left.s)],
    ];

    return (
      <div className={clsx('relative overflow-hidden rounded-3xl border p-5 sm:p-6', colourCls, className)}>
        <div className='relative'>
          <div className='flex items-start justify-between gap-4'>
            <div className='min-w-0'>
              {label && <p className='text-xs uppercase tracking-widest font-semibold opacity-75'>{label}</p>}
              {title && <h3 className='mt-2 truncate font-display text-xl font-bold text-white sm:text-2xl'>{title}</h3>}
            </div>
            <span className='flex-shrink-0 rounded-full border border-current/25 bg-black/10 px-3 py-1 text-xs font-semibold'>
              {status}
            </span>
          </div>

          <div className='mt-6 grid grid-cols-4 gap-2 sm:gap-3' aria-label={`${timeStr} remaining`}>
            {blocks.map(([unit, value]) => (
              <div key={unit} className='rounded-2xl border border-current/15 bg-black/10 px-2 py-3 text-center sm:px-4 sm:py-4'>
                <p className='font-mono text-2xl font-bold tracking-tight text-white sm:text-4xl'>{value}</p>
                <p className='mt-1 text-[9px] font-semibold uppercase tracking-wider opacity-70 sm:text-xs'>{unit}</p>
              </div>
            ))}
          </div>

          <p className='mt-4 text-xs font-medium opacity-70 sm:text-sm'>
            Due {new Date(deadline).toLocaleDateString('en-GB', {
              day: '2-digit',
              month: 'short',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </p>
        </div>
      </div>
    );
  }

  if (compact) {
    return (
      <div
        aria-label={`${status}: ${timeStr} remaining`}
        className={clsx(
          'inline-flex items-center gap-1.5 rounded-xl border font-mono font-medium',
          'px-2.5 py-1 text-[11px]',
          colourCls,
          className,
        )}
      >
        <span className={clsx('w-1.5 h-1.5 rounded-full flex-shrink-0', dotCls)} />
        {timeStr}
      </div>
    );
  }

  return (
    <div className={clsx('rounded-2xl border p-3', colourCls, className)}>
      {label && (
        <p className='text-[10px] uppercase tracking-widest font-semibold opacity-70 mb-1'>
          {label}
        </p>
      )}
      <div className='flex items-center gap-2'>
        <span className={clsx('w-2 h-2 rounded-full flex-shrink-0', dotCls)} />
        <span className='font-mono text-sm font-semibold tracking-wide'>{timeStr}</span>
      </div>
      <p className='text-[10px] opacity-60 mt-1'>
        {new Date(deadline).toLocaleDateString('en-GB', {
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
