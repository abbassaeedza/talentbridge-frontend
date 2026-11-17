import { useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Eye, EyeOff, FlaskConical } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Button } from '@heroui/react/button';
import { Input } from '@heroui/react/input';
import { Label } from '@heroui/react/label';
import { Spinner } from '@heroui/react/spinner';
import { TextField } from '@heroui/react/textfield';
import { useAuth } from '../../contexts/AuthContext';
import { PublicShell } from '../../components/ui/TalentBridgeUI';
import ServerStartingFeedback from '../../components/shared/ServerStartingFeedback';
import { isAuthRejection, SERVER_RETRY_MESSAGE } from '../../utils/authErrors';
import { invitationReturnPath } from '../../utils/accountFlows';
import { authApi } from '../../api/services';

export default function LoginPage() {
  const { login, demoLogin } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [pending, setPending] = useState<'sign-in' | 'demo' | null>(null);
  const busy = useRef(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const demoConfig = useQuery({
    queryKey: ['auth-config'],
    queryFn: async () => (await authApi.getConfig()).data?.demoMode === true,
    gcTime: 0,
    staleTime: 0,
    retry: false,
    refetchOnMount: 'always',
    refetchOnWindowFocus: 'always',
    refetchOnReconnect: false,
    refetchInterval: false,
  });
  const demoAvailable = demoConfig.isSuccess && !demoConfig.isFetching && demoConfig.data === true;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!email || !password || busy.current) return;
    busy.current = true;
    setErrorMessage(null);
    setPending('sign-in');
    try {
      if (!await login(email, password)) return;
      navigate(invitationReturnPath(window.location.search));
    } catch (error: any) {
      if (isAuthRejection(error)) {
        toast.error(error?.response?.data?.message || 'Email or password is incorrect');
      } else {
        setErrorMessage(SERVER_RETRY_MESSAGE);
        if (error?.response?.data?.message) toast.error(error.response.data.message);
      }
    } finally {
      busy.current = false;
      setPending(null);
    }
  };

  const handleDemoLogin = async () => {
    if (!demoAvailable || busy.current) return;
    busy.current = true;
    setErrorMessage(null);
    setPending('demo');
    try {
      if (!await demoLogin()) return;
      navigate('/dashboard');
    } catch (error: any) {
      if (error?.response?.status === 404) {
        void demoConfig.refetch();
        setErrorMessage('The coordinator demo is no longer available. Sign in with your account.');
      } else {
        setErrorMessage(isAuthRejection(error) ? 'The coordinator demo is unavailable.' : SERVER_RETRY_MESSAGE);
      }
    } finally {
      busy.current = false;
      setPending(null);
    }
  };

  return (
    <PublicShell>
      <div className='mb-8'>
        <h1 className='text-3xl font-medium tracking-tight'>Sign in</h1>
        <p className='mt-2 text-sm text-muted'>Use your TalentBridge account to continue.</p>
      </div>

      <form onSubmit={handleSubmit} className='space-y-5'>
        <TextField fullWidth isRequired>
          <Label>Email address</Label>
          <Input
            fullWidth
            type='email'
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder='name@example.com'
            autoComplete='email'
          />
        </TextField>

        <TextField fullWidth isRequired>
          <Label>Password</Label>
          <div className='relative'>
            <Input
              fullWidth
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder='Enter your password'
              autoComplete='current-password'
              className='pr-12'
            />
            <Button
              isIconOnly
              size='sm'
              variant='ghost'
              className='absolute right-1 top-1/2 -translate-y-1/2'
              type='button'
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              onPress={() => setShowPassword((current) => !current)}
            >
              {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
            </Button>
          </div>
        </TextField>

        <Button type='submit' fullWidth size='lg' variant='primary' className={pending ? 'min-h-11' : undefined} isDisabled={!!pending}>
          {pending === 'sign-in' ? (
            <><Spinner size='sm' /> Signing in...</>
          ) : (
            <><span>Sign in</span><ArrowRight size={17} /></>
          )}
        </Button>
        <ServerStartingFeedback pending={!!pending || demoConfig.isFetching} />
        {errorMessage && <p role='alert' className='text-sm leading-6 text-muted'>{errorMessage}</p>}
      </form>

      <p className='mt-6 text-center text-sm text-muted'>
        Need an account?{' '}
        <Link to='/register' className='font-medium text-foreground underline decoration-accent decoration-2 underline-offset-4'>
          Register
        </Link>
      </p>

      {demoConfig.isFetching && <p role='status' className='mt-6 text-sm text-muted'>Checking demo availability...</p>}
      {demoConfig.isError && !demoConfig.isFetching && (
        <div className='mt-6 space-y-2'>
          <p role='status' className='text-sm text-muted'>Couldn't check demo availability. You can still sign in with your account.</p>
          <Button type='button' variant='secondary' className='min-h-11' isDisabled={!!pending} onPress={() => { void demoConfig.refetch(); }}>
            Retry demo availability
          </Button>
        </div>
      )}

      {demoAvailable && (
        <>
          <div className='my-7 flex items-center gap-3 text-xs text-muted'>
            <span className='h-px flex-1 bg-separator' />
            <span>Demo environment</span>
            <span className='h-px flex-1 bg-separator' />
          </div>
          <Button type='button' fullWidth size='lg' variant='secondary' className='min-h-11' isDisabled={!!pending} onPress={handleDemoLogin}>
            {pending === 'demo' ? (
              <><Spinner size='sm' /> Opening demo...</>
            ) : (
              <><FlaskConical size={17} /> Open coordinator demo</>
            )}
          </Button>
          <p className='mt-2 text-center text-sm text-muted'>Use the dedicated coordinator demo account, not your personal account.</p>
        </>
      )}

    </PublicShell>
  );
}
