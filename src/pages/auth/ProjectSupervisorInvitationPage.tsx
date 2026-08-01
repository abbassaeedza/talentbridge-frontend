import { useState, type FormEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, Building2, Layers } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { projectSupervisorInvitationApi, userApi } from '../../api/services';
import SupervisorProfileFields from '../../components/supervisor/SupervisorProfileFields';
import { useAuth } from '../../contexts/AuthContext';
import type { SupervisorProfessionalFields } from '../../types';

export default function ProjectSupervisorInvitationPage() {
  const { token = '' } = useParams();
  const navigate = useNavigate();
  const { completeExternalLogin, refreshUser } = useAuth();
  const [pending, setPending] = useState(false);
  const [photo, setPhoto] = useState<File>();
  const [form, setForm] = useState({
    firstName: '', lastName: '', phoneNumber: '', password: '', confirmPassword: '',
  });
  const [professional, setProfessional] = useState<SupervisorProfessionalFields>({
    jobTitle: '', department: '', bio: '', linkedinUrl: '',
  });

  const invitation = useQuery({
    queryKey: ['project-supervisor-invitation', token],
    queryFn: () => projectSupervisorInvitationApi.validate(token).then((response) => response.data),
    enabled: !!token,
    retry: false,
  });

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (form.password !== form.confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
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
      if (photo) {
        try {
          await userApi.uploadSupervisorProfilePhoto(photo);
          await refreshUser();
        } catch {
          toast.error('Account created, but the profile photo could not be uploaded');
        }
      }
      toast.success('Invitation accepted. Welcome to TalentBridge.');
      navigate('/project-supervisor/overview', { replace: true });
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Could not accept this invitation');
    } finally {
      setPending(false);
    }
  };

  if (invitation.isLoading) {
    return <div className='min-h-screen bg-ink-950 flex items-center justify-center'><div className='w-7 h-7 rounded-full border-2 border-ember-500 border-t-transparent animate-spin' /></div>;
  }

  if (!invitation.data || invitation.data.status !== 'PENDING') {
    return (
      <div className='min-h-screen bg-ink-950 mesh-bg flex items-center justify-center p-6'>
        <div className='card max-w-md p-8 text-center'>
          <AlertTriangle className='mx-auto mb-4 text-ember-400' size={36} />
          <h1 className='page-title'>Invitation unavailable</h1>
          <p className='page-subtitle mt-2'>This invitation is invalid, expired, revoked, or already accepted.</p>
        </div>
      </div>
    );
  }

  return (
    <div className='min-h-screen bg-ink-950 mesh-bg px-4 py-8 sm:px-8'>
      <div className='mx-auto max-w-2xl'>
        <div className='mb-8 flex items-center gap-3'>
          <div className='flex h-9 w-9 items-center justify-center rounded-xl bg-ember-500'><Layers size={18} className='text-white' /></div>
          <span className='font-display text-xl font-bold text-white'>TalentBridge</span>
        </div>
        <div className='page-header'>
          <h1 className='page-title'>Join as Project Supervisor</h1>
          <p className='page-subtitle flex items-center gap-2'><Building2 size={14} /> {invitation.data.companyName} invited you to supervise its projects.</p>
        </div>
        <form onSubmit={submit} className='card space-y-5 p-5 sm:p-7'>
          <div>
            <label className='input-label' htmlFor='invitedEmail'>Work email</label>
            <input id='invitedEmail' className='input' value={invitation.data.email} disabled />
          </div>
          <div className='grid gap-4 sm:grid-cols-2'>
            <div><label className='input-label' htmlFor='firstName'>First name *</label><input id='firstName' className='input' required value={form.firstName} onChange={(event) => setForm({ ...form, firstName: event.target.value })} /></div>
            <div><label className='input-label' htmlFor='lastName'>Last name *</label><input id='lastName' className='input' required value={form.lastName} onChange={(event) => setForm({ ...form, lastName: event.target.value })} /></div>
          </div>
          <div><label className='input-label' htmlFor='phoneNumber'>Phone number</label><input id='phoneNumber' type='tel' className='input' value={form.phoneNumber} onChange={(event) => setForm({ ...form, phoneNumber: event.target.value })} /></div>
          <SupervisorProfileFields value={professional} onChange={setProfessional} />
          <div className='grid gap-4 sm:grid-cols-2'>
            <div><label className='input-label' htmlFor='password'>Password *</label><input id='password' aria-label='Password' type='password' minLength={8} className='input' required value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} /></div>
            <div><label className='input-label' htmlFor='confirmPassword'>Confirm password *</label><input id='confirmPassword' type='password' minLength={8} className='input' required value={form.confirmPassword} onChange={(event) => setForm({ ...form, confirmPassword: event.target.value })} /></div>
          </div>
          <div><label className='input-label' htmlFor='profilePhoto'>Profile photo</label><input id='profilePhoto' type='file' accept='image/*' className='input file:mr-3 file:rounded-lg file:border-0 file:bg-ink-700 file:px-3 file:py-1 file:text-xs file:text-ink-200' onChange={(event) => setPhoto(event.target.files?.[0])} /></div>
          <button type='submit' disabled={pending} className='btn-primary w-full'>{pending ? 'Accepting...' : 'Accept invitation'}</button>
        </form>
      </div>
    </div>
  );
}
