import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Eye, EyeOff, FlaskConical } from 'lucide-react';
import toast from 'react-hot-toast';
import { Button } from '@heroui/react/button';
import { Input } from '@heroui/react/input';
import { Label } from '@heroui/react/label';
import { Spinner } from '@heroui/react/spinner';
import { TextField } from '@heroui/react/textfield';
import { useAuth } from '../../contexts/AuthContext';
import { PublicShell } from '../../components/ui/TalentBridgeUI';

type PendingAction = 'sign-in' | 'demo' | null;

export default function LoginPage() {
  const { login, demoLogin } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [pending, setPending] = useState<PendingAction>(null);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!email || !password || pending) return;
    setPending('sign-in');
    try {
      await login(email, password);
      navigate('/dashboard');
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Email or password is incorrect');
    } finally {
      setPending(null);
    }
  };

  const handleDemoLogin = async () => {
    if (pending) return;
    setPending('demo');
    try {
      await demoLogin();
      navigate('/dashboard');
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Demo login is unavailable');
    } finally {
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

        <Button type='submit' fullWidth size='lg' variant='primary' isDisabled={!!pending}>
          {pending === 'sign-in' ? (
            <><Spinner size='sm' /> Signing in...</>
          ) : (
            <><span>Sign in</span><ArrowRight size={17} /></>
          )}
        </Button>
      </form>

      <p className='mt-6 text-center text-sm text-muted'>
        Need an account?{' '}
        <Link to='/register' className='font-medium text-foreground underline decoration-accent decoration-2 underline-offset-4'>
          Register
        </Link>
      </p>

      <div className='my-7 flex items-center gap-3 text-xs text-muted'>
        <span className='h-px flex-1 bg-separator' />
        <span>Demo environment</span>
        <span className='h-px flex-1 bg-separator' />
      </div>

      <Button
        type='button'
        fullWidth
        size='lg'
        variant='secondary'
        isDisabled={!!pending}
        onPress={handleDemoLogin}
      >
        {pending === 'demo' ? (
          <><Spinner size='sm' /> Opening demo...</>
        ) : (
          <><FlaskConical size={17} /> Open coordinator demo</>
        )}
      </Button>
    </PublicShell>
  );
}
