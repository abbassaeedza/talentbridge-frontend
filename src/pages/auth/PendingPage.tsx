import { Clock, LogOut } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@heroui/react/button';
import { useAuth } from '../../contexts/AuthContext';
import { PublicShell } from '../../components/ui/TalentBridgeUI';

export default function PendingPage() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  return (
    <PublicShell>
      <div className='text-center'>
        <div className='mx-auto flex size-12 items-center justify-center rounded-md bg-warning text-warning-foreground'><Clock size={22} /></div>
        <h1 className='mt-5 text-2xl font-semibold tracking-tight'>Approval pending</h1>
        <p className='mx-auto mt-2 max-w-sm text-sm leading-6 text-muted'>
          Your account is waiting for coordinator approval. We will notify you when access is available.
        </p>
        <Button className='mt-6' variant='secondary' onPress={() => { logout(); navigate('/login'); }}>
          <LogOut size={16} /> Sign out
        </Button>
      </div>
    </PublicShell>
  );
}
