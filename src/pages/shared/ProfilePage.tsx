import { useEffect, useRef, useState } from 'react';
import { Building2, Check, Github, Globe, GraduationCap, Linkedin, Mail, MapPin, Pencil, Phone, Plus, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { Avatar } from '@heroui/react/avatar';
import { Button } from '@heroui/react/button';
import { Input } from '@heroui/react/input';
import { Label } from '@heroui/react/label';
import { ListBox } from '@heroui/react/list-box';
import { Select } from '@heroui/react/select';
import { Spinner } from '@heroui/react/spinner';
import { TextArea } from '@heroui/react/textarea';
import { TextField } from '@heroui/react/textfield';
import { useAuth } from '../../contexts/AuthContext';
import { userApi } from '../../api/services';
import { PageHeader } from '../../components/ui/TalentBridgeUI';
import { defaultAvatarUrl } from '../../utils/avatar';
import { profileUpdatePayload, type ProfileForm } from '../../utils/accountFlows';
import { getAccessToken, getJwtSessionKey } from '../../utils/authTokens';
import type { User } from '../../types';

const YEARS = ['1st Year', '2nd Year', '3rd Year', '4th Year', 'Masters', 'PhD', 'Postgraduate'];

function Field({ label, value, onChange, ...props }: { label: string; value?: string | number | null; onChange: (value: string) => void } & Omit<React.ComponentProps<typeof Input>, 'value' | 'onChange'>) {
  return <TextField fullWidth><Label>{label}</Label><Input fullWidth value={String(value ?? '')} onChange={(event) => onChange(event.target.value)} {...props} /></TextField>;
}

function InfoRow({ icon: Icon, label, value, href }: { icon: React.ElementType; label: string; value?: string | null; href?: string }) {
  if (!value) return null;
  const content = href ? <a className='text-sm text-accent hover:underline' href={href} target='_blank' rel='noreferrer'>{value}</a> : <p className='text-sm'>{value}</p>;
  return (
    <div className='grid gap-1 border-b border-separator py-3 last:border-0 sm:grid-cols-[10rem_1fr] sm:items-center'>
      <p className='flex items-center gap-2 text-xs font-medium text-muted'><Icon size={14} /> {label}</p>
      <div className='min-w-0'>{content}</div>
    </div>
  );
}

function SkillsInput({ value, onChange }: { value: string[]; onChange: (value: string[]) => void }) {
  const [input, setInput] = useState('');
  const add = () => {
    const skill = input.trim().slice(0, 100);
    if (skill && !value.includes(skill) && value.length < 20) onChange([...value, skill]);
    setInput('');
  };
  return (
    <div>
      <div className='flex gap-2'>
        <Input fullWidth maxLength={100} value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); add(); } }} placeholder='Add a skill' />
        <Button type='button' variant='secondary' isIconOnly aria-label='Add skill' isDisabled={!input.trim()} onPress={add}><Plus size={16} /></Button>
      </div>
      <div className='mt-3 flex flex-wrap gap-2'>
        {value.map((skill) => (
          <span key={skill} className='inline-flex items-center gap-1.5 rounded-sm bg-default px-2 py-1 text-xs font-medium'>
            {skill}<Button type='button' isIconOnly size='sm' variant='ghost' aria-label={`Remove ${skill}`} onPress={() => onChange(value.filter((item) => item !== skill))}><X size={12} /></Button>
          </span>
        ))}
      </div>
    </div>
  );
}

export default function ProfilePage() {
  const { user } = useAuth();
  return user ? <ProfileEditor key={user.id} user={user} /> : null;
}

function ProfileEditor({ user }: { user: User }) {
  const { refreshUser, authError } = useAuth();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<ProfileForm>({});
  const [pending, setPending] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const busy = useRef(false);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const student = user.studentProfile;
  const savedYear = student?.yearOfStudy;
  const years = savedYear?.trim() && savedYear.length <= 50 && !YEARS.includes(savedYear)
    ? [...YEARS, savedYear] : YEARS;
  const company = user.companyProfile;
  const supervisor = user.supervisorProfile;
  const isStudent = user.role === 'STUDENT';
  const isCompany = user.role === 'COMPANY';
  const isSupervisor = user.role === 'PARTY_SUPERVISOR' || user.role === 'PROJECT_SUPERVISOR';
  const initials = `${user.firstName?.[0] ?? ''}${user.lastName?.[0] ?? ''}`;
  const photo = supervisor?.profilePhotoUrl ? new URL(supervisor.profilePhotoUrl, import.meta.env.VITE_API_URL || 'http://localhost:8080').toString() : undefined;
  const set = <K extends keyof ProfileForm>(key: K, value: ProfileForm[K]) => setForm((current) => ({ ...current, [key]: value }));
  const startEdit = () => {
    setForm({
      firstName: user.firstName ?? '', lastName: user.lastName ?? '', phoneNumber: user.phoneNumber ?? '',
      ...(isStudent ? {
        university: student?.university ?? '', major: student?.major ?? '', yearOfStudy: student?.yearOfStudy ?? '', bio: student?.bio ?? '',
        linkedinUrl: student?.linkedinUrl ?? '', portfolioUrl: student?.portfolioUrl ?? '', pastExperience: student?.pastExperience ?? '', skills: student?.skills ?? [], gpa: student?.gpa ?? '',
      } : {}),
      ...(isCompany ? {
        companyName: company?.companyName ?? '', industry: company?.industry ?? '', description: company?.description ?? '', website: company?.website ?? '', city: company?.city ?? '', country: company?.country ?? '',
      } : {}),
    });
    setSaved(false);
    setError(null);
    setEditing(true);
  };
  const save = async () => {
    if (busy.current) return;
    const required = [form.firstName, form.lastName,
      ...(isStudent ? [form.university, form.yearOfStudy, form.major] : []),
      ...(isCompany ? [form.companyName] : [])];
    if (!saved && required.some(value => !value?.trim())) {
      setError('Enter the required names and, for students, university, year of study, and major.');
      return;
    }
    const session = getJwtSessionKey(getAccessToken()) ?? getAccessToken();
    const stillCurrent = () => mounted.current && !!getAccessToken()
      && session === (getJwtSessionKey(getAccessToken()) ?? getAccessToken());
    busy.current = true;
    setPending(true);
    setError(null);
    try {
      if (!saved) {
        const payload = profileUpdatePayload(user.role, form);
        await userApi.updateMyProfile(payload);
        if (!stillCurrent()) return;
        setSaved(true);
      }
      const refreshed = await refreshUser();
      if (stillCurrent() && refreshed) {
        setEditing(false);
        toast.success('Profile updated');
      }
    } catch (error: any) {
      if (stillCurrent()) setError(error?.response?.data?.message || 'Could not update profile. Your changes are still here.');
    } finally {
      busy.current = false;
      if (mounted.current) setPending(false);
    }
  };
  const subtitle = isStudent
    ? [student?.major, student?.university].filter(Boolean).join(' · ')
    : isCompany ? company?.companyName
      : isSupervisor ? [supervisor?.jobTitle, supervisor?.department].filter(Boolean).join(' · ')
        : user.role.replace(/_/g, ' ');

  return (
    <div className='max-w-3xl'>
      <PageHeader
        title='Profile'
        description='Your account and professional information.'
        action={!editing && !isSupervisor ? <Button variant='secondary' onPress={startEdit}><Pencil size={15} /> Edit profile</Button> : undefined}
      />

      <section className='border-b border-separator pb-6'>
        <div className='flex flex-col gap-4 sm:flex-row sm:items-center'>
          <Avatar size='lg'><Avatar.Image src={photo || defaultAvatarUrl(user.id || user.email)} alt={`${user.firstName} ${user.lastName}`} /><Avatar.Fallback>{initials}</Avatar.Fallback></Avatar>
          <div className='min-w-0 flex-1'>
            <h2 className='text-xl font-semibold'>{user.firstName} {user.lastName}</h2>
            <p className='mt-1 text-sm text-muted'>{subtitle || user.email}</p>
          </div>
          {user.githubUsername && <a href={`https://github.com/${user.githubUsername}`} target='_blank' rel='noreferrer' className='inline-flex min-h-11 items-center gap-2 rounded-md border border-border px-3 text-sm hover:bg-default'><Github size={16} /> {user.githubUsername}</a>}
        </div>
        {!editing && (student?.bio || company?.description || supervisor?.bio) && <p className='mt-5 max-w-2xl text-sm leading-6 text-muted'>{student?.bio || company?.description || supervisor?.bio}</p>}
      </section>

      {editing ? (
        <form className='space-y-8 py-7' onInvalid={() => setError('Check required names, university, year of study, major, GPA (0 to 4), and URLs (http or https).')} onSubmit={event => { event.preventDefault(); void save(); }}>
          <fieldset className='space-y-8' disabled={pending || saved}>
          <section>
            <h3 className='mb-5 text-base font-semibold'>Account details</h3>
            <div className='grid gap-5 sm:grid-cols-2'>
              <Field label='First name' required value={form.firstName} onChange={(value) => set('firstName', value)} maxLength={100} />
              <Field label='Last name' required value={form.lastName} onChange={(value) => set('lastName', value)} maxLength={100} />
              <Field label='Phone number' value={form.phoneNumber} onChange={(value) => set('phoneNumber', value)} maxLength={50} />
            </div>
          </section>

          {isStudent && (
            <section className='border-t border-separator pt-7'>
              <h3 className='mb-5 text-base font-semibold'>Academic profile</h3>
              <div className='grid gap-5 sm:grid-cols-2'>
                <Field label='University' required value={form.university} onChange={(value) => set('university', value)} maxLength={255} />
                <Field label='Major' required value={form.major} onChange={(value) => set('major', value)} maxLength={255} />
                <Select.Root fullWidth isRequired aria-label='Year of study' selectedKey={form.yearOfStudy || null} onSelectionChange={(key) => set('yearOfStudy', key === null ? '' : String(key))}>
                  <Label>Year of study</Label><Select.Trigger><Select.Value /><Select.Indicator /></Select.Trigger><Select.Popover><ListBox>{years.map((year) => <ListBox.Item key={year} id={year} textValue={year}>{year}</ListBox.Item>)}</ListBox></Select.Popover>
                </Select.Root>
                <Field label='GPA' value={form.gpa} onChange={(value) => set('gpa', value)} type='number' min='0' max='4' step='0.01' />
                <Field label='LinkedIn URL' value={form.linkedinUrl} onChange={(value) => set('linkedinUrl', value)} type='url' pattern='https?://.+' maxLength={500} />
                <Field label='Portfolio URL' value={form.portfolioUrl} onChange={(value) => set('portfolioUrl', value)} type='url' pattern='https?://.+' maxLength={500} />
              </div>
              <TextField fullWidth className='mt-5'><Label>Bio</Label><TextArea fullWidth rows={3} maxLength={2000} value={form.bio ?? ''} onChange={(event) => set('bio', event.target.value)} /></TextField>
              <div className='mt-5'><Label>Skills</Label><div className='mt-2'><SkillsInput value={form.skills ?? []} onChange={(value) => set('skills', value)} /></div></div>
              <TextField fullWidth className='mt-5'><Label>Past experience</Label><TextArea fullWidth rows={4} maxLength={3000} value={form.pastExperience ?? ''} onChange={(event) => set('pastExperience', event.target.value)} /></TextField>
            </section>
          )}

          {isCompany && (
            <section className='border-t border-separator pt-7'>
              <h3 className='mb-5 text-base font-semibold'>Company profile</h3>
              <div className='grid gap-5 sm:grid-cols-2'>
                <Field label='Company name' required value={form.companyName} onChange={(value) => set('companyName', value)} maxLength={255} />
                <Field label='Industry' value={form.industry} onChange={(value) => set('industry', value)} maxLength={100} />
                <Field label='Website' value={form.website} onChange={(value) => set('website', value)} type='url' pattern='https?://.+' maxLength={500} />
                <Field label='City' value={form.city} onChange={(value) => set('city', value)} maxLength={100} />
                <Field label='Country' value={form.country} onChange={(value) => set('country', value)} maxLength={100} />
              </div>
              <TextField fullWidth className='mt-5'><Label>Company description</Label><TextArea fullWidth rows={4} maxLength={2000} value={form.description ?? ''} onChange={(event) => set('description', event.target.value)} /></TextField>
            </section>
          )}

          </fieldset>
          <div className='sticky bottom-0 space-y-3 border-t border-border bg-background/95 py-4 backdrop-blur'>
            {error && <p role='alert' className='text-sm leading-6 text-danger'>{error}</p>}
            {saved && authError && <p role='alert' className='text-sm leading-6 text-muted'>Your profile was saved. {authError} Retry reloads your saved profile without saving again.</p>}
            <div className='flex justify-end gap-2'>
            {!saved && <Button type='button' className='min-h-11' variant='ghost' isDisabled={pending} onPress={() => setEditing(false)}><X size={15} /> Cancel</Button>}
            <Button type='submit' formNoValidate={saved} className='min-h-11' variant='primary' isDisabled={pending}>{pending ? <Spinner size='sm' /> : <Check size={15} />} {saved ? 'Retry' : 'Save changes'}</Button>
            </div>
          </div>
        </form>
      ) : (
        <div className='py-7'>
          <h3 className='mb-2 text-base font-semibold'>Details</h3>
          <InfoRow icon={Mail} label='Email' value={user.email} />
          <InfoRow icon={Phone} label='Phone' value={user.phoneNumber} />
          {isStudent && <>
            <InfoRow icon={GraduationCap} label='University' value={student?.university} />
            <InfoRow icon={GraduationCap} label='Major' value={student?.major} />
            <InfoRow icon={GraduationCap} label='Year of study' value={student?.yearOfStudy} />
            <InfoRow icon={GraduationCap} label='GPA' value={student?.gpa != null ? String(student.gpa) : null} />
            <InfoRow icon={Linkedin} label='LinkedIn' value={student?.linkedinUrl} href={student?.linkedinUrl} />
            <InfoRow icon={Globe} label='Portfolio' value={student?.portfolioUrl} href={student?.portfolioUrl} />
          </>}
          {isCompany && <>
            <InfoRow icon={Building2} label='Company' value={company?.companyName} />
            <InfoRow icon={Building2} label='Industry' value={company?.industry} />
            <InfoRow icon={Globe} label='Website' value={company?.website} href={company?.website} />
            <InfoRow icon={MapPin} label='Location' value={[company?.city, company?.country].filter(Boolean).join(', ')} />
          </>}
          {isSupervisor && <>
            <InfoRow icon={Building2} label='Job title' value={supervisor?.jobTitle} />
            <InfoRow icon={Building2} label='Department' value={supervisor?.department} />
            <InfoRow icon={Linkedin} label='LinkedIn' value={supervisor?.linkedinUrl} href={supervisor?.linkedinUrl} />
          </>}
          {isStudent && (
            <div className='mt-7 grid gap-7 border-t border-separator pt-7 sm:grid-cols-2'>
              <section><h3 className='text-sm font-semibold'>Skills</h3><div className='mt-3 flex flex-wrap gap-2'>{(student?.skills ?? []).length ? student?.skills.map((skill: string) => <span key={skill} className='rounded-sm bg-default px-2 py-1 text-xs'>{skill}</span>) : <p className='text-sm text-muted'>No skills added.</p>}</div></section>
              <section><h3 className='text-sm font-semibold'>Past experience</h3><p className='mt-3 whitespace-pre-wrap text-sm leading-6 text-muted'>{student?.pastExperience || 'No experience added.'}</p></section>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
