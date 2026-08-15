import { useState, type FormEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, Building2 } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Button } from '@heroui/react/button';
import { Input } from '@heroui/react/input';
import { Label } from '@heroui/react/label';
import { Spinner } from '@heroui/react/spinner';
import { TextField } from '@heroui/react/textfield';
import { projectSupervisorInvitationApi, userApi } from '../../api/services';
import SupervisorProfileFields from '../../components/supervisor/SupervisorProfileFields';
import { PublicShell } from '../../components/ui/TalentBridgeUI';
import { useAuth } from '../../contexts/AuthContext';
import type { SupervisorProfessionalFields } from '../../types';

export default function ProjectSupervisorInvitationPage() {
  const { token = '' } = useParams();
  const navigate = useNavigate();
  const { completeExternalLogin, refreshUser } = useAuth();
  const [pending, setPending] = useState(false);
  const [photo, setPhoto] = useState<File>();
  const [form, setForm] = useState({ firstName: '', lastName: '', phoneNumber: '', password: '', confirmPassword: '' });
  const [professional, setProfessional] = useState<SupervisorProfessionalFields>({ jobTitle: '', department: '', bio: '', linkedinUrl: '' });
  const invitation = useQuery({
    queryKey: ['project-supervisor-invitation', token],
    queryFn: () => projectSupervisorInvitationApi.validate(token).then((response) => response.data),
    enabled: !!token,
    retry: false,
  });
  const set = (key: keyof typeof form, value: string) => setForm((current) => ({ ...current, [key]: value }));
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (form.password !== form.confirmPassword) return void toast.error('Passwords do not match');
    setPending(true);
    try {
      const { data } = await projectSupervisorInvitationApi.accept(token, {
        firstName: form.firstName,
        lastName: form.lastName,
        phoneNumber: form.phoneNumber || undefined,
        password: form.password,
        ...professional,
        linkedinUrl: professional.linkedinUrl || undefined,
      });
      await completeExternalLogin(data);
      if (photo) await userApi.uploadSupervisorProfilePhoto(photo).then(refreshUser).catch(() => toast.error('Account created, but the profile photo could not be uploaded'));
      toast.success('Invitation accepted');
      navigate('/project-supervisor/overview', { replace: true });
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Could not accept this invitation');
    } finally {
      setPending(false);
    }
  };

  if (invitation.isLoading) return <div className='flex min-h-dvh items-center justify-center bg-background'><Spinner /></div>;
  if (!invitation.data || invitation.data.status !== 'PENDING') {
    return (
      <PublicShell>
        <div className='text-center'>
          <div className='mx-auto flex size-12 items-center justify-center rounded-md bg-danger text-danger-foreground'><AlertTriangle size={22} /></div>
          <h1 className='mt-5 text-2xl font-semibold'>Invitation unavailable</h1>
          <p className='mt-2 text-sm leading-6 text-muted'>This invitation is invalid, expired, revoked, or already accepted.</p>
        </div>
      </PublicShell>
    );
  }

  return (
    <PublicShell>
      <div className='py-6'>
        <h1 className='text-3xl font-semibold tracking-tight'>Join as project supervisor</h1>
        <p className='mt-2 flex items-center gap-2 text-sm text-muted'><Building2 size={15} /> {invitation.data.companyName} invited you to supervise its projects.</p>
        <form onSubmit={submit} className='mt-8 space-y-5'>
          <TextField fullWidth><Label>Work email</Label><Input fullWidth value={invitation.data.email} disabled /></TextField>
          <div className='grid gap-5 sm:grid-cols-2'>
            <TextField fullWidth isRequired><Label>First name</Label><Input fullWidth maxLength={100} value={form.firstName} onChange={(event) => set('firstName', event.target.value)} /></TextField>
            <TextField fullWidth isRequired><Label>Last name</Label><Input fullWidth maxLength={100} value={form.lastName} onChange={(event) => set('lastName', event.target.value)} /></TextField>
          </div>
          <TextField fullWidth><Label>Phone number</Label><Input fullWidth type='tel' maxLength={30} value={form.phoneNumber} onChange={(event) => set('phoneNumber', event.target.value)} /></TextField>
          <SupervisorProfileFields value={professional} onChange={setProfessional} />
          <div className='grid gap-5 sm:grid-cols-2'>
            <TextField fullWidth isRequired><Label>Password</Label><Input fullWidth type='password' minLength={8} value={form.password} onChange={(event) => set('password', event.target.value)} /></TextField>
            <TextField fullWidth isRequired><Label>Confirm password</Label><Input fullWidth type='password' minLength={8} value={form.confirmPassword} onChange={(event) => set('confirmPassword', event.target.value)} /></TextField>
          </div>
          <TextField fullWidth><Label>Profile photo</Label><Input fullWidth type='file' accept='image/*' onChange={(event) => setPhoto(event.target.files?.[0])} /></TextField>
          <Button type='submit' fullWidth size='lg' variant='primary' isDisabled={pending}>{pending ? <Spinner size='sm' /> : 'Accept invitation'}</Button>
        </form>
      </div>
    </PublicShell>
  );
}
