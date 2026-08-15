import { CheckCircle, Loader2, PauseCircle, XCircle } from 'lucide-react';
import { Button } from '@heroui/react/button';
import { Input } from '@heroui/react/input';

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
  if (!selectedCount) return null;

  const run = (action: Action) => {
    const count = eligible[action];
    const label = `${action[0].toUpperCase()}${action.slice(1)}`;
    if (count && confirm(`${label} ${count} selected ${noun}${count === 1 ? '' : 's'}?`)) onAction(action);
  };

  return (
    <div className='sticky bottom-3 z-20 mb-4 flex flex-col gap-3 rounded-lg border border-border bg-overlay p-3 shadow-xl md:flex-row md:items-center'>
      <p className='shrink-0 text-sm font-semibold'>{selectedCount} selected</p>
      <Input
        fullWidth
        aria-label='Rejection reason'
        placeholder='Rejection reason required for reject'
        value={rejectionReason}
        onChange={(event) => onRejectionReasonChange(event.target.value)}
        className='md:min-w-64 md:flex-1'
      />
      <div className='flex flex-wrap gap-2'>
        <Button size='sm' variant='primary' isDisabled={!eligible.approve || !!loadingAction} onPress={() => run('approve')}>
          {loadingAction === 'approve' ? <Loader2 size={14} className='animate-spin' /> : <CheckCircle size={14} />}
          Approve {eligible.approve}
        </Button>
        <Button size='sm' variant='danger-soft' isDisabled={!eligible.reject || !rejectionReason.trim() || !!loadingAction} onPress={() => run('reject')}>
          {loadingAction === 'reject' ? <Loader2 size={14} className='animate-spin' /> : <XCircle size={14} />}
          Reject {eligible.reject}
        </Button>
        <Button size='sm' variant='secondary' isDisabled={!eligible.suspend || !!loadingAction} onPress={() => run('suspend')}>
          {loadingAction === 'suspend' ? <Loader2 size={14} className='animate-spin' /> : <PauseCircle size={14} />}
          Suspend {eligible.suspend}
        </Button>
      </div>
    </div>
  );
}
