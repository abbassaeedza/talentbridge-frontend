import { useEffect, useRef, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Plus, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { Button } from '@heroui/react/button';
import { Input } from '@heroui/react/input';
import { Label } from '@heroui/react/label';
import { ListBox } from '@heroui/react/list-box';
import { Select } from '@heroui/react/select';
import { Spinner } from '@heroui/react/spinner';
import { TextArea } from '@heroui/react/textarea';
import { TextField } from '@heroui/react/textfield';
import { userApi } from '../../api/services';
import { useAuth } from '../../contexts/AuthContext';
import { PublicShell } from '../../components/ui/TalentBridgeUI';
import SupervisorProfileFields from '../../components/supervisor/SupervisorProfileFields';
import type { SupervisorProfessionalFields } from '../../types';
import { getAccessToken, getJwtSessionKey } from '../../utils/authTokens';

const SKILLS = ['React', 'TypeScript', 'Python', 'Node.js', 'Java', 'Spring Boot', 'PostgreSQL', 'MongoDB', 'Docker', 'AWS', 'Machine Learning', 'Figma'];
const YEARS = ['1st Year', '2nd Year', '3rd Year', '4th Year', 'Masters', 'PhD'];

function Field({ label, value, onChange, ...props }: { label: string; value: string; onChange: (value: string) => void } & Omit<React.ComponentProps<typeof Input>, 'value' | 'onChange'>) {
  return (
    <TextField fullWidth isRequired={props.required}>
      <Label>{label}</Label>
      <Input fullWidth value={value} onChange={(event) => onChange(event.target.value)} {...props} />
    </TextField>
  );
}

export default function OnboardingPage() {
  const { user, onboardingComplete } = useAuth();
  if (!user) return <Navigate to='/login' replace />;
  if (user.status === 'REJECTED') return <Navigate to='/rejected' replace />;
  if (user.status !== 'APPROVED') return <Navigate to='/pending' replace />;
  if (onboardingComplete || !['STUDENT', 'PARTY_SUPERVISOR'].includes(user.role)) return <Navigate to='/dashboard' replace />;
  return user.role === 'PARTY_SUPERVISOR' ? <SupervisorOnboarding key={user.id} /> : <StudentOnboarding key={user.id} />;
}

function StudentOnboarding() {
  const { refreshUser, authError } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const busy = useRef(false);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const [saved, setSaved] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [skills, setSkills] = useState<string[]>([]);
  const [skillInput, setSkillInput] = useState('');
  const [form, setForm] = useState({ university: '', yearOfStudy: '', major: '', bio: '', linkedinUrl: '', gpa: '' });
  const set = (key: keyof typeof form, value: string) => setForm((current) => ({ ...current, [key]: value }));
  const addSkill = (raw: string) => {
    const skill = raw.trim().slice(0, 100);
    if (skill && !skills.includes(skill) && skills.length < 20) setSkills((current) => [...current, skill]);
    setSkillInput('');
  };
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy.current) return;
    if (!saved && (!form.university.trim() || !form.yearOfStudy || !form.major.trim())) {
      setErrorMessage('Enter your university, year of study, and major.');
      return;
    }
    if (!saved && !skills.length) return void toast.error('Add at least one skill');
    const session = getJwtSessionKey(getAccessToken()) ?? getAccessToken();
    const stillCurrent = () => mounted.current && !!getAccessToken() && session === (getJwtSessionKey(getAccessToken()) ?? getAccessToken());
    busy.current = true;
    setErrorMessage(null);
    setLoading(true);
    try {
      if (!saved) {
        await userApi.completeOnboarding({ ...form, skills, gpa: form.gpa ? Number(form.gpa) : undefined });
        if (!stillCurrent()) return;
        setSaved(true);
      }
      if (!stillCurrent() || !await refreshUser() || !stillCurrent()) return;
      toast.success('Profile completed');
      navigate('/student/dashboard');
    } catch (error: any) {
      if (stillCurrent()) setErrorMessage(error?.response?.data?.message || 'Could not save profile. Your entries are still here.');
    } finally {
      busy.current = false;
      if (mounted.current) setLoading(false);
    }
  };

  return (
    <PublicShell>
      <div className='py-6'>
        <h1 className='text-3xl font-semibold tracking-tight'>Complete your profile</h1>
        <p className='mt-2 text-sm text-muted'>Add your academic information so teams and coordinators can understand your background.</p>
        <form onSubmit={submit} onInvalid={() => setErrorMessage('Check the required university, year of study, and major, the GPA range (0 to 4), and any URL (http or https).')} className='mt-8 space-y-6'>
          <div className='grid gap-5 sm:grid-cols-2'>
            <Field label='University' required value={form.university} onChange={(value) => set('university', value)} maxLength={255} placeholder='National University' />
            <Select.Root fullWidth isRequired aria-label='Year of study' selectedKey={form.yearOfStudy || null} onSelectionChange={(key) => set('yearOfStudy', key === null ? '' : String(key))}>
              <Label>Year of study</Label>
              <Select.Trigger><Select.Value /><Select.Indicator /></Select.Trigger>
              <Select.Popover><ListBox>{YEARS.map((year) => <ListBox.Item key={year} id={year} textValue={year}>{year}</ListBox.Item>)}</ListBox></Select.Popover>
            </Select.Root>
            <Field label='Major or field of study' required value={form.major} onChange={(value) => set('major', value)} maxLength={255} placeholder='Computer science' />
            <Field label='GPA (optional)' value={form.gpa} onChange={(value) => set('gpa', value)} type='number' min='0' max='4' step='0.01' placeholder='3.80' />
          </div>

          <div>
            <Label>Skills</Label>
            <div className='mt-2 flex gap-2'>
              <Input fullWidth maxLength={100} value={skillInput} onChange={(event) => setSkillInput(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); addSkill(skillInput); } }} placeholder='Add a skill' />
              <Button isIconOnly variant='secondary' type='button' aria-label='Add skill' isDisabled={!skillInput.trim()} onPress={() => addSkill(skillInput)}><Plus size={17} /></Button>
            </div>
            <div className='mt-2 flex flex-wrap gap-1.5'>
              {SKILLS.filter((skill) => !skills.includes(skill)).map((skill) => <Button key={skill} size='sm' variant='ghost' type='button' onPress={() => addSkill(skill)}>+ {skill}</Button>)}
            </div>
            {skills.length > 0 && (
              <div className='mt-3 flex flex-wrap gap-2'>
                {skills.map((skill) => (
                  <span key={skill} className='inline-flex items-center gap-1.5 rounded-sm bg-default px-2 py-1 text-xs font-medium'>
                    {skill}<Button isIconOnly size='sm' variant='ghost' aria-label={`Remove ${skill}`} onPress={() => setSkills((current) => current.filter((item) => item !== skill))}><X size={12} /></Button>
                  </span>
                ))}
              </div>
            )}
          </div>

          <TextField fullWidth>
            <Label>Bio (optional)</Label>
            <TextArea fullWidth rows={3} maxLength={2000} value={form.bio} onChange={(event) => set('bio', event.target.value)} placeholder='Briefly describe your interests and experience.' />
          </TextField>
          <Field label='LinkedIn URL (optional)' value={form.linkedinUrl} onChange={(value) => set('linkedinUrl', value)} type='url' pattern='https?://.+' maxLength={500} placeholder='https://linkedin.com/in/...' />
          {errorMessage && <p role='alert' className='text-sm leading-6 text-danger'>{errorMessage}</p>}
          {saved && authError && <p role='alert' className='text-sm leading-6 text-muted'>Your profile was saved. {authError}</p>}
          <Button type='submit' fullWidth size='lg' className='min-h-11' variant='primary' isDisabled={loading}>{loading ? <Spinner size='sm' /> : saved ? 'Retry' : 'Complete profile'}</Button>
        </form>
      </div>
    </PublicShell>
  );
}

function SupervisorOnboarding() {
  const { refreshUser, authError } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const busy = useRef(false);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const [saved, setSaved] = useState(false);
  const [photo, setPhoto] = useState<File>();
  const [professional, setProfessional] = useState<SupervisorProfessionalFields>({ jobTitle: '', department: '', bio: '', linkedinUrl: '' });
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy.current) return;
    const session = getJwtSessionKey(getAccessToken()) ?? getAccessToken();
    const stillCurrent = () => mounted.current && !!getAccessToken() && session === (getJwtSessionKey(getAccessToken()) ?? getAccessToken());
    busy.current = true;
    setLoading(true);
    try {
      if (!saved) {
        await userApi.completeSupervisorOnboarding({ ...professional, linkedinUrl: professional.linkedinUrl || undefined });
        if (!stillCurrent()) return;
        setSaved(true);
        if (photo) await userApi.uploadSupervisorProfilePhoto(photo).catch(() => toast.error('Profile saved, but the photo could not be uploaded'));
      }
      if (!stillCurrent() || !await refreshUser() || !stillCurrent()) return;
      toast.success('Profile completed');
      navigate('/party-supervisor/overview', { replace: true });
    } catch (error: any) {
      if (stillCurrent()) toast.error(error?.response?.data?.message || 'Could not save profile');
    } finally {
      busy.current = false;
      if (mounted.current) setLoading(false);
    }
  };
  return (
    <PublicShell>
      <div className='py-6'>
        <h1 className='text-3xl font-semibold tracking-tight'>Complete your supervisor profile</h1>
        <p className='mt-2 text-sm text-muted'>Add the professional information students will see.</p>
        <form onSubmit={submit} className='mt-8 space-y-5'>
          <SupervisorProfileFields value={professional} onChange={setProfessional} />
          <TextField fullWidth>
            <Label>Profile photo</Label>
            <Input fullWidth type='file' accept='image/*' onChange={(event) => setPhoto(event.target.files?.[0])} />
          </TextField>
          {saved && authError && <p role='alert' className='text-sm leading-6 text-muted'>Your profile was saved. {authError}</p>}
          <Button type='submit' fullWidth size='lg' variant='primary' isDisabled={loading}>{loading ? <Spinner size='sm' /> : saved ? 'Retry' : 'Complete profile'}</Button>
        </form>
      </div>
    </PublicShell>
  );
}
