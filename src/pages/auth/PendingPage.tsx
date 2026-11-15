import { useCallback, useEffect, useRef, useState } from 'react';
import { Clock, LogOut } from 'lucide-react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Button } from '@heroui/react/button';
import { useAuth } from '../../contexts/AuthContext';
import { PublicShell } from '../../components/ui/TalentBridgeUI';
import ServerStartingFeedback from '../../components/shared/ServerStartingFeedback';

export default function PendingPage() {
  const { user, logout, refreshUser, authError } = useAuth();
  const [checking, setChecking] = useState(false);
  const busy = useRef(false);
  const navigate = useNavigate();
  const check = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    setChecking(true);
    try { await refreshUser(); }
    finally { busy.current = false; setChecking(false); }
  }, [refreshUser]);
  useEffect(() => {
    const focus = () => { void check(); };
    window.addEventListener('focus', focus);
    return () => window.removeEventListener('focus', focus);
  }, [check]);
  if (user?.status === 'REJECTED') return <Navigate to='/rejected' replace />;
  if (user?.status === 'APPROVED') return <Navigate to='/dashboard' replace />;
  return (
    <PublicShell>
      <div className='text-center'>
        <div className='mx-auto flex size-12 items-center justify-center rounded-md bg-warning text-warning-foreground'><Clock size={22} /></div>
        <h1 className='mt-5 text-2xl font-semibold tracking-tight'>Approval pending</h1>
        <p className='mx-auto mt-2 max-w-sm text-sm leading-6 text-muted'>
          Your account is waiting for coordinator approval. We will notify you when access is available.
        </p>
        {authError && <p role='alert' className='mx-auto mt-5 max-w-sm text-sm leading-6 text-muted'>{authError}</p>}
        <div className='mt-6 flex flex-wrap justify-center gap-2'>
        <Button className='min-h-11' variant='primary' isDisabled={checking} onPress={check}>{checking ? 'Checking status...' : authError ? 'Retry' : 'Check status'}</Button>
        <Button className='min-h-11' variant='secondary' onPress={() => { logout(); navigate('/login'); }}>
          <LogOut size={16} /> Sign out
        </Button>
        </div>
        <ServerStartingFeedback pending={checking} />
      </div>
    </PublicShell>
  );
}
