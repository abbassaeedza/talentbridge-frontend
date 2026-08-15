import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Building2, GraduationCap, UserCog } from 'lucide-react';
import toast from 'react-hot-toast';
import { Button } from '@heroui/react/button';
import { Input } from '@heroui/react/input';
import { Label } from '@heroui/react/label';
import { Spinner } from '@heroui/react/spinner';
import { TextField } from '@heroui/react/textfield';
import { ToggleButton } from '@heroui/react/toggle-button';
import clsx from 'clsx';
import { authApi } from '../../api/services';
import { PublicShell } from '../../components/ui/TalentBridgeUI';
import { useAuth } from '../../contexts/AuthContext';
import type { UserRole } from '../../types';
import { setAuthTokens } from '../../utils/authTokens';

const ROLES: { value: UserRole; label: string; description: string; icon: React.ElementType }[] = [
  { value: 'STUDENT', label: 'Student', description: 'Join a project party', icon: GraduationCap },
  { value: 'COMPANY', label: 'Company', description: 'Post industry projects', icon: Building2 },
  { value: 'PARTY_SUPERVISOR', label: 'Party supervisor', description: 'Supervise university teams', icon: UserCog },
];

const Field = ({
  label,
  value,
  onChange,
  type = 'text',
  placeholder,
  required = false,
  autoComplete,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
  required?: boolean;
  autoComplete?: string;
}) => (
  <TextField fullWidth isRequired={required}>
    <Label>{label}</Label>
    <Input
      fullWidth
      type={type}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      autoComplete={autoComplete}
    />
  </TextField>
);

export default function RegisterPage() {
  const navigate = useNavigate();
  const { refreshUser } = useAuth();
  const [role, setRole] = useState<UserRole>('STUDENT');
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    phoneNumber: '',
    companyName: '',
    industry: '',
    companyDescription: '',
    website: '',
    registrationNumber: '',
  });

  const set = (key: string, value: string) => setForm((current) => ({ ...current, [key]: value }));

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (form.password.length < 8) {
      toast.error('Password must contain at least 8 characters');
      return;
    }
    setLoading(true);
    try {
      const { data } = await authApi.register({ ...form, role });
      setAuthTokens(data.accessToken, data.refreshToken);
      await refreshUser();
      navigate(data.user.status === 'PENDING' ? '/pending' : role === 'STUDENT' ? '/onboarding' : '/dashboard');
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <PublicShell>
      <div className='mb-7'>
        <h1 className='text-3xl font-semibold tracking-tight'>Create an account</h1>
        <p className='mt-2 text-sm text-muted'>
          Already registered?{' '}
          <Link to='/login' className='font-medium text-foreground underline decoration-accent decoration-2 underline-offset-4'>Sign in</Link>
        </p>
      </div>

      <div className='mb-6'>
        <p className='mb-2 text-sm font-medium'>Account type</p>
        <div className='grid gap-2 sm:grid-cols-3' role='group' aria-label='Account type'>
          {ROLES.map((item) => (
            <ToggleButton
              key={item.value}
              isSelected={role === item.value}
              onChange={() => setRole(item.value)}
              className={clsx(
                'min-h-20 rounded-md border p-3 text-left transition-colors',
                role === item.value
                  ? 'border-accent bg-default text-foreground'
                  : 'border-border bg-surface text-muted hover:bg-default hover:text-foreground',
              )}
            >
              <item.icon size={18} aria-hidden='true' />
              <span className='mt-2 block text-sm font-medium'>{item.label}</span>
              <span className='mt-0.5 block text-xs text-muted'>{item.description}</span>
            </ToggleButton>
          ))}
        </div>
      </div>

      <form onSubmit={handleSubmit} className='space-y-5'>
        <div className='grid gap-4 sm:grid-cols-2'>
          <Field label='First name' value={form.firstName} onChange={(value) => set('firstName', value)} placeholder='Jane' required autoComplete='given-name' />
          <Field label='Last name' value={form.lastName} onChange={(value) => set('lastName', value)} placeholder='Smith' required autoComplete='family-name' />
        </div>
        <Field label='Email address' value={form.email} onChange={(value) => set('email', value)} type='email' placeholder='name@example.com' required autoComplete='email' />
        <Field label='Password' value={form.password} onChange={(value) => set('password', value)} type='password' placeholder='At least 8 characters' required autoComplete='new-password' />
        <Field label='Phone number' value={form.phoneNumber} onChange={(value) => set('phoneNumber', value)} type='tel' placeholder='Optional' autoComplete='tel' />

        {role === 'COMPANY' && (
          <fieldset className='space-y-5 border-t border-separator pt-5'>
            <legend className='px-1 text-sm font-semibold'>Company details</legend>
            <Field label='Company name' value={form.companyName} onChange={(value) => set('companyName', value)} placeholder='Company name' required autoComplete='organization' />
            <div className='grid gap-4 sm:grid-cols-2'>
              <Field label='Industry' value={form.industry} onChange={(value) => set('industry', value)} placeholder='Software' />
              <Field label='Website' value={form.website} onChange={(value) => set('website', value)} type='url' placeholder='https://example.com' autoComplete='url' />
            </div>
          </fieldset>
        )}

        <div className='py-2'>
          <Button type='submit' fullWidth size='lg' variant='primary' isDisabled={loading}>
            {loading ? <Spinner size='sm' /> : <><span>Create account</span><ArrowRight size={17} /></>}
          </Button>
        </div>
      </form>
    </PublicShell>
  );
}
