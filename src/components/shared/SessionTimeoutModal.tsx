import { Clock, ShieldCheck } from 'lucide-react';

type SessionTimeoutModalProps = {
  open: boolean;
  secondsRemaining: number;
  refreshing: boolean;
  onStayLoggedIn: () => void;
  onSignOut: () => void;
};

export default function SessionTimeoutModal({
  open,
  secondsRemaining,
  refreshing,
  onStayLoggedIn,
  onSignOut,
}: SessionTimeoutModalProps) {
  if (!open) return null;

  return (
    <div
      className='fixed inset-0 z-[80] flex items-center justify-center bg-ink-950/80 p-4 backdrop-blur-sm'
      role='dialog'
      aria-modal='true'
      aria-labelledby='session-timeout-title'
    >
      <div className='w-full max-w-md rounded-3xl border border-ember-500/30 bg-ink-900 p-6 shadow-2xl shadow-ember-950/30'>
        <div className='mb-5 flex items-center gap-4'>
          <div className='flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl border border-ember-500/30 bg-ember-500/10 text-ember-300'>
            <Clock size={24} />
          </div>
          <div>
            <p className='text-xs font-semibold uppercase tracking-[0.2em] text-ember-300'>
              Session expiring
            </p>
            <h2
              id='session-timeout-title'
              className='font-display text-xl font-bold text-white'
            >
              Stay logged in?
            </h2>
          </div>
        </div>

        <p className='text-sm leading-relaxed text-ink-300'>
          Your session will expire in{' '}
          <span className='font-semibold text-ember-300'>
            {Math.max(0, secondsRemaining)} seconds
          </span>
          . Continue working by refreshing your secure session.
        </p>

        <div className='mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end'>
          <button
            type='button'
            onClick={onSignOut}
            className='btn-ghost justify-center text-ink-300'
          >
            Sign out
          </button>
          <button
            type='button'
            onClick={onStayLoggedIn}
            disabled={refreshing}
            className='btn-primary justify-center'
          >
            {refreshing ? (
              <span className='h-4 w-4 rounded-full border-2 border-white border-t-transparent animate-spin' />
            ) : (
              <ShieldCheck size={16} />
            )}
            <span>{refreshing ? 'Refreshing…' : 'Stay logged in'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
