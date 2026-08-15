import { Clock, ShieldCheck } from 'lucide-react';
import { Button } from '@heroui/react/button';
import { Modal } from '@heroui/react/modal';
import { Spinner } from '@heroui/react/spinner';

type Props = {
  open: boolean;
  secondsRemaining: number;
  refreshing: boolean;
  onStayLoggedIn: () => void;
  onSignOut: () => void;
};

export default function SessionTimeoutModal({ open, secondsRemaining, refreshing, onStayLoggedIn, onSignOut }: Props) {
  return (
    <Modal isOpen={open}>
      <Modal.Backdrop isDismissable={false}>
        <Modal.Container>
          <Modal.Dialog className='max-w-md'>
            <Modal.Header>
              <Modal.Icon className='bg-warning text-warning-foreground'><Clock size={20} /></Modal.Icon>
              <Modal.Heading>Session expiring</Modal.Heading>
            </Modal.Header>
            <Modal.Body>
              <p className='text-sm leading-6 text-muted'>
                Your session expires in <strong className='text-foreground'>{Math.max(0, secondsRemaining)} seconds</strong>.
                Refresh it to continue working.
              </p>
            </Modal.Body>
            <Modal.Footer>
              <Button variant='ghost' onPress={onSignOut}>Sign out</Button>
              <Button variant='primary' isDisabled={refreshing} onPress={onStayLoggedIn}>
                {refreshing ? <Spinner size='sm' /> : <ShieldCheck size={16} />}
                {refreshing ? 'Refreshing' : 'Stay logged in'}
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}
