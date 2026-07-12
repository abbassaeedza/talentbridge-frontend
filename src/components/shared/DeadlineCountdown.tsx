import { useEffect, useState } from 'react';
import { CheckCircle, Clock } from 'lucide-react';
import clsx from 'clsx';

interface Props {
  deadline: string | null | undefined;
  submitted?: boolean;
  label?: string;
  compact?: boolean;
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
  compact = false,
  className,
}: Props) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  // Submitted — always green
  if (submitted) {
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
    return (
      <div
        className={clsx(
          'inline-flex items-center gap-1.5 rounded-xl font-medium border',
          compact ? 'px-2.5 py-1 text-[11px]' : 'px-3 py-1.5 text-xs',
          'bg-red-500/15 border-red-500/30 text-red-400',
          className,
        )}
      >
        <span className='w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse flex-shrink-0' />
        Expired
      </div>
    );
  }

  // Colour logic: submitted=green (handled above), >48h=neutral, <48h=amber, <24h=red+pulse
  const isRed = left.totalHours < 24;
  const isAmber = !isRed && left.totalHours < 48;

  const colourCls = isRed
    ? 'bg-red-500/15 border-red-500/30 text-red-400'
    : isAmber
      ? 'bg-amber-500/15 border-amber-500/30 text-amber-400'
      : 'bg-ink-800 border-ink-700/50 text-ink-300';

  const dotCls = isRed
    ? 'bg-red-400 animate-pulse'
    : isAmber
      ? 'bg-amber-400'
      : 'bg-ink-500';

  const timeStr = `${left.d}d ${pad(left.h)}:${pad(left.m)}:${pad(left.s)}`;

  if (compact) {
    return (
      <div
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
