import { CheckCircle, Loader2, PauseCircle, XCircle } from 'lucide-react';

type Action = 'approve' | 'reject' | 'suspend';

export default function BulkActionToolbar({
  noun,
  selectedCount,
  eligible,
  rejectionReason,
  onRejectionReasonChange,
  loadingAction,
  onAction,
}: {
  noun: string;
  selectedCount: number;
  eligible: Record<Action, number>;
  rejectionReason: string;
  onRejectionReasonChange: (value: string) => void;
  loadingAction: Action | null;
  onAction: (action: Action) => void;
}) {
  if (selectedCount === 0) return null;
  const run = (action: Action) => {
    const count = eligible[action];
    if (count > 0 && confirm(`${action[0].toUpperCase()}${action.slice(1)} ${count} selected ${noun}${count === 1 ? '' : 's'}?`)) onAction(action);
  };

  return (
    <div className='sticky bottom-4 z-30 mt-4 flex flex-col gap-3 rounded-2xl border border-ember-500/30 bg-ink-900/95 p-4 shadow-2xl backdrop-blur md:flex-row md:items-center'>
      <p className='min-w-24 text-sm font-semibold text-white'>{selectedCount} selected</p>
      <input
        className='input py-2 text-xs md:min-w-56 md:flex-1'
        placeholder='Rejection reason'
        value={rejectionReason}
        onChange={(event) => onRejectionReasonChange(event.target.value)}
      />
      <div className='flex flex-wrap gap-2'>
        <button disabled={eligible.approve === 0 || !!loadingAction} onClick={() => run('approve')} className='btn-primary px-3 py-2 text-xs'>
          {loadingAction === 'approve' ? <Loader2 size={13} className='animate-spin' /> : <CheckCircle size={13} />} Approve {eligible.approve}
        </button>
        <button disabled={eligible.reject === 0 || !rejectionReason.trim() || !!loadingAction} onClick={() => run('reject')} className='btn-secondary px-3 py-2 text-xs text-red-300'>
          {loadingAction === 'reject' ? <Loader2 size={13} className='animate-spin' /> : <XCircle size={13} />} Reject {eligible.reject}
        </button>
        <button disabled={eligible.suspend === 0 || !!loadingAction} onClick={() => run('suspend')} className='btn-secondary px-3 py-2 text-xs'>
          {loadingAction === 'suspend' ? <Loader2 size={13} className='animate-spin' /> : <PauseCircle size={13} />} Suspend {eligible.suspend}
        </button>
      </div>
    </div>
  );
}
