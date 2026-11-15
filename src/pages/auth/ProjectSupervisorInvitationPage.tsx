import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, Building2, CheckCircle2 } from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';
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
import { getAccessToken, getJwtSessionKey } from '../../utils/authTokens';
import ServerStartingFeedback from '../../components/shared/ServerStartingFeedback';

export default function ProjectSupervisorInvitationPage() {
  const { token = '' } = useParams();
  const navigate = useNavigate();
  const { user, loading, authError, completeExternalLogin, refreshUser, logout } = useAuth();
  const [pending, setPending] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const busy = useRef(false);
  const validating = useRef(false);
  const mounted = useRef(true);
  const acceptedSession = useRef<string | null>(null);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const [photo, setPhoto] = useState<File>();
  const [form, setForm] = useState({ firstName: '', lastName: '', phoneNumber: '', password: '', confirmPassword: '' });
  const [professional, setProfessional] = useState<SupervisorProfessionalFields>({ jobTitle: '', department: '', bio: '', linkedinUrl: '' });
  const invitation = useQuery({
    queryKey: ['project-supervisor-invitation', token],
    queryFn: () => projectSupervisorInvitationApi.validate(token).then((response) => response.data),
    enabled: !!token,
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
  const returnPath = `/project-supervisor-invitations/${encodeURIComponent(token)}`;
  const signInPath = `/login?returnTo=${encodeURIComponent(returnPath)}`;
  const sessionKey = () => getJwtSessionKey(getAccessToken()) ?? getAccessToken();
  const check = async () => {
    if (validating.current || invitation.isFetching) return;
    validating.current = true;
    try { await invitation.refetch({ cancelRefetch: false }); }
    finally { validating.current = false; }
  };
  const retryIdentity = async () => {
    if (busy.current || !acceptedSession.current || acceptedSession.current !== sessionKey()) return;
    busy.current = true;
    setPending(true);
    try {
      const refreshed = await refreshUser();
      if (mounted.current && refreshed && acceptedSession.current === sessionKey()) navigate('/dashboard', { replace: true });
    } finally { busy.current = false; if (mounted.current) setPending(false); }
  };
  const set = (key: keyof typeof form, value: string) => setForm((current) => ({ ...current, [key]: value }));
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (busy.current || user || getAccessToken() || invitation.isError || invitation.isFetching
      || invitation.data?.status !== 'PENDING' || accepted || uncertain) return;
    if (form.password !== form.confirmPassword) return void toast.error('Passwords do not match');
    busy.current = true;
    setPending(true);
    setErrorMessage(null);
    try {
      const { data } = await projectSupervisorInvitationApi.accept(token, {
        firstName: form.firstName,
        lastName: form.lastName,
        phoneNumber: form.phoneNumber || undefined,
        password: form.password,
        ...professional,
        linkedinUrl: professional.linkedinUrl || undefined,
      });
      if (!mounted.current || getAccessToken()) return;
      setAccepted(true);
      const ready = await completeExternalLogin(data);
      const expectedSession = getJwtSessionKey(data.accessToken) ?? data.accessToken;
      if (!mounted.current || sessionKey() !== expectedSession) return;
      acceptedSession.current = expectedSession;
      if (!ready) {
        if (photo) toast.error('Account created. The photo was not uploaded; it does not affect your account.');
        return;
      }
      if (photo) {
        try {
          await userApi.uploadSupervisorProfilePhoto(photo);
          if (!mounted.current || sessionKey() !== expectedSession) return;
          if (!await refreshUser()) return;
        } catch {
          if (mounted.current && sessionKey() === expectedSession) toast.error('Account created, but the profile photo could not be uploaded');
        }
      }
      if (!mounted.current || sessionKey() !== expectedSession) return;
      toast.success('Invitation accepted');
      navigate('/dashboard', { replace: true });
    } catch (error: any) {
      if (!mounted.current || getAccessToken()) return;
      const status = error?.response?.status;
      if (!status || status >= 500) {
        setUncertain(true);
        setErrorMessage('The acceptance result is not confirmed. Check the invitation status or sign in. Do not register again.');
      } else setErrorMessage(error?.response?.data?.message || 'Could not accept this invitation. Check its status before trying again.');
      await invitation.refetch({ cancelRefetch: false });
    } finally {
      busy.current = false;
      if (mounted.current) setPending(false);
    }
  };

  if (loading || invitation.isLoading) return <div className='flex min-h-dvh items-center justify-center bg-background'><div className='text-center'><Spinner /><ServerStartingFeedback pending /></div></div>;
  if (accepted) {
    return <PublicShell><div className='space-y-5 text-center'>
      <h1 className='text-2xl font-semibold'>Invitation accepted</h1>
      <p role='alert' className='text-sm leading-6 text-muted'>Your account was created. {authError || 'Retry loading your identity to continue. This will not register again or upload a photo.'}</p>
      {acceptedSession.current && acceptedSession.current === sessionKey()
        ? <Button className='min-h-11' variant='primary' isDisabled={pending} onPress={retryIdentity}>Retry identity</Button>
        : user || getAccessToken()
          ? <Button className='min-h-11' variant='secondary' onPress={logout}>Sign out to sign in</Button>
          : <Link className='inline-flex min-h-11 items-center text-accent underline' to={signInPath}>Sign in</Link>}
      <ServerStartingFeedback pending={pending} />
    </div></PublicShell>;
  }
  const invalid = !token || (invitation.error as any)?.response?.status === 400;
  const temporary = invitation.isError && !invalid;
  const state = invalid ? 'INVALID' : invitation.data?.status;
  const terminal = {
    ACCEPTED: 'This invitation has already been accepted. Sign in to the account created with your work email.',
    EXPIRED: 'This invitation has expired. Ask the company to send a new invitation.',
    REVOKED: 'The company revoked this invitation. Contact the company for a new invitation.',
    INVALID: 'This invitation link is invalid. Check the link or ask the company for a new invitation.',
  };
  if (!temporary && state && state !== 'PENDING' && state in terminal) {
    return (
      <PublicShell>
        <div className='text-center'>
          <div className={`mx-auto flex size-12 items-center justify-center rounded-md ${state === 'ACCEPTED' ? 'bg-success text-success-foreground' : 'bg-danger text-danger-foreground'}`}>{state === 'ACCEPTED' ? <CheckCircle2 size={22} /> : <AlertTriangle size={22} />}</div>
          <h1 className='mt-5 text-2xl font-semibold'>Invitation {state.toLowerCase()}</h1>
          <p className='mt-2 text-sm leading-6 text-muted'>{terminal[state as keyof typeof terminal]}</p>
          {user || getAccessToken()
            ? <Button className='mt-5 min-h-11' variant='secondary' onPress={logout}>Sign out to sign in</Button>
            : <Link className='mt-5 inline-flex min-h-11 items-center text-accent underline' to={signInPath}>Sign in</Link>}
          {user && <Link className='ml-5 inline-flex min-h-11 items-center text-accent underline' to='/dashboard'>Go to dashboard</Link>}
        </div>
      </PublicShell>
    );
  }

  const temporaryMessage = <p role='alert' className='text-sm leading-6 text-muted'>The invitation is temporarily unavailable. Your entries are still here. Retry to check its status.</p>;
  if (!invitation.data || (state !== 'PENDING' && !temporary)) return <PublicShell><div className='space-y-5 text-center'>
    <h1 className='text-2xl font-semibold'>Invitation temporarily unavailable</h1>
    {temporaryMessage}
    <Button className='min-h-11' variant='primary' isDisabled={invitation.isFetching} onPress={check}>Retry</Button>
  </div></PublicShell>;

  if (user || getAccessToken()) return <PublicShell><div className='space-y-5 text-center'>
    <h1 className='text-2xl font-semibold'>Switch account to accept</h1>
    <p role='alert' className='text-sm leading-6 text-muted'>You are signed in{user ? ` as ${user.email}` : ''}. This invitation creates an account for {invitation.data.email}. Sign out explicitly before continuing.</p>
    {authError && <p role='alert' className='text-sm leading-6 text-muted'>{authError}</p>}
    <Button className='min-h-11' variant='primary' onPress={logout}>Sign out to continue</Button>
    <Link className='ml-4 inline-flex min-h-11 items-center text-accent underline' to='/dashboard'>Keep current account</Link>
  </div></PublicShell>;

  if (uncertain) return <PublicShell><div className='space-y-5 text-center'>
    <h1 className='text-2xl font-semibold'>Check acceptance status</h1>
    <p role='alert' className='text-sm leading-6 text-muted'>{errorMessage}</p>
    {temporary && temporaryMessage}
    <Button className='min-h-11' variant='primary' isDisabled={pending || invitation.isFetching} onPress={check}>{temporary ? 'Retry' : 'Check invitation'}</Button>
    <Link className='ml-4 inline-flex min-h-11 items-center text-accent underline' to={signInPath}>Sign in</Link>
  </div></PublicShell>;

  return (
    <PublicShell>
      <div className='py-6'>
        <h1 className='text-3xl font-semibold tracking-tight'>Join as project supervisor</h1>
        <p className='mt-2 flex items-center gap-2 text-sm text-muted'><Building2 size={15} /> {invitation.data.companyName} invited you to supervise its projects.</p>
        {temporary && <div className='mt-5 space-y-3'>{temporaryMessage}<Button className='min-h-11' variant='secondary' isDisabled={invitation.isFetching} onPress={check}>Retry</Button></div>}
        {errorMessage && <p role='alert' className='mt-5 text-sm leading-6 text-danger'>{errorMessage}</p>}
        <Button className='mt-4 min-h-11' variant='ghost' isDisabled={pending || invitation.isFetching} onPress={check}>Check invitation</Button>
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
          <Button type='submit' fullWidth size='lg' className='min-h-11' variant='primary' isDisabled={pending || invitation.isFetching || temporary}>{pending ? <Spinner size='sm' /> : 'Accept invitation'}</Button>
          <ServerStartingFeedback pending={pending} />
        </form>
      </div>
    </PublicShell>
  );
}
