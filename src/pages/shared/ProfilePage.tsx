import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
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

const YEARS = ['1st Year', '2nd Year', '3rd Year', '4th Year', 'Postgraduate'];

function Field({ label, value, onChange, ...props }: { label: string; value: string | number; onChange: (value: string) => void } & Omit<React.ComponentProps<typeof Input>, 'value' | 'onChange'>) {
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
            {skill}<Button isIconOnly size='sm' variant='ghost' aria-label={`Remove ${skill}`} onPress={() => onChange(value.filter((item) => item !== skill))}><X size={12} /></Button>
          </span>
        ))}
      </div>
    </div>
  );
}

export default function ProfilePage() {
  const { user, refreshUser } = useAuth();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Record<string, any>>({});
  if (!user) return null;
  const student = (user as any).studentProfile;
  const company = (user as any).companyProfile;
  const supervisor = user.supervisorProfile;
  const isStudent = user.role === 'STUDENT';
  const isCompany = user.role === 'COMPANY';
  const isSupervisor = user.role === 'PARTY_SUPERVISOR' || user.role === 'PROJECT_SUPERVISOR';
  const initials = `${user.firstName?.[0] ?? ''}${user.lastName?.[0] ?? ''}`;
  const photo = supervisor?.profilePhotoUrl ? new URL(supervisor.profilePhotoUrl, import.meta.env.VITE_API_URL || 'http://localhost:8080').toString() : undefined;
  const set = (key: string, value: any) => setForm((current) => ({ ...current, [key]: value }));
  const startEdit = () => {
    setForm({
      firstName: user.firstName ?? '', lastName: user.lastName ?? '', phoneNumber: user.phoneNumber ?? '',
      university: student?.university ?? '', major: student?.major ?? '', yearOfStudy: student?.yearOfStudy ?? '', bio: student?.bio ?? '',
      linkedinUrl: student?.linkedinUrl ?? '', portfolioUrl: student?.portfolioUrl ?? '', pastExperience: student?.pastExperience ?? '', skills: student?.skills ?? [], gpa: student?.gpa ?? '',
      companyName: company?.companyName ?? '', industry: company?.industry ?? '', description: company?.description ?? '', website: company?.website ?? '', city: company?.city ?? '', country: company?.country ?? '',
    });
    setEditing(true);
  };
  const mutation = useMutation({
    mutationFn: () => userApi.updateMyProfile({ ...form, gpa: form.gpa ? Number(form.gpa) : undefined }),
    onSuccess: async () => { await refreshUser(); setEditing(false); toast.success('Profile updated'); },
    onError: (error: any) => toast.error(error?.response?.data?.message || 'Could not update profile'),
  });
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
          <Avatar size='lg'>{photo && <Avatar.Image src={photo} alt='' />}<Avatar.Fallback>{initials}</Avatar.Fallback></Avatar>
          <div className='min-w-0 flex-1'>
            <h2 className='text-xl font-semibold'>{user.firstName} {user.lastName}</h2>
            <p className='mt-1 text-sm text-muted'>{subtitle || user.email}</p>
          </div>
          {user.githubUsername && <a href={`https://github.com/${user.githubUsername}`} target='_blank' rel='noreferrer' className='inline-flex min-h-11 items-center gap-2 rounded-md border border-border px-3 text-sm hover:bg-default'><Github size={16} /> {user.githubUsername}</a>}
        </div>
        {!editing && (student?.bio || company?.description || supervisor?.bio) && <p className='mt-5 max-w-2xl text-sm leading-6 text-muted'>{student?.bio || company?.description || supervisor?.bio}</p>}
      </section>

      {editing ? (
        <div className='space-y-8 py-7'>
          <section>
            <h3 className='mb-5 text-base font-semibold'>Account details</h3>
            <div className='grid gap-5 sm:grid-cols-2'>
              <Field label='First name' value={form.firstName} onChange={(value) => set('firstName', value)} maxLength={100} />
              <Field label='Last name' value={form.lastName} onChange={(value) => set('lastName', value)} maxLength={100} />
              <Field label='Phone number' value={form.phoneNumber} onChange={(value) => set('phoneNumber', value)} maxLength={30} />
            </div>
          </section>

          {isStudent && (
            <section className='border-t border-separator pt-7'>
              <h3 className='mb-5 text-base font-semibold'>Academic profile</h3>
              <div className='grid gap-5 sm:grid-cols-2'>
                <Field label='University' value={form.university} onChange={(value) => set('university', value)} maxLength={255} />
                <Field label='Major' value={form.major} onChange={(value) => set('major', value)} maxLength={255} />
                <Select.Root fullWidth aria-label='Year of study' selectedKey={form.yearOfStudy || null} onSelectionChange={(key) => set('yearOfStudy', String(key))}>
                  <Label>Year of study</Label><Select.Trigger><Select.Value /><Select.Indicator /></Select.Trigger><Select.Popover><ListBox>{YEARS.map((year) => <ListBox.Item key={year} id={year}>{year}</ListBox.Item>)}</ListBox></Select.Popover>
                </Select.Root>
                <Field label='GPA' value={form.gpa} onChange={(value) => set('gpa', value)} type='number' min='0' max='4' step='0.01' />
                <Field label='LinkedIn URL' value={form.linkedinUrl} onChange={(value) => set('linkedinUrl', value)} type='url' maxLength={500} />
                <Field label='Portfolio URL' value={form.portfolioUrl} onChange={(value) => set('portfolioUrl', value)} type='url' maxLength={500} />
              </div>
              <TextField fullWidth className='mt-5'><Label>Bio</Label><TextArea fullWidth rows={3} maxLength={2000} value={form.bio} onChange={(event) => set('bio', event.target.value)} /></TextField>
              <div className='mt-5'><Label>Skills</Label><div className='mt-2'><SkillsInput value={form.skills ?? []} onChange={(value) => set('skills', value)} /></div></div>
              <TextField fullWidth className='mt-5'><Label>Past experience</Label><TextArea fullWidth rows={4} maxLength={3000} value={form.pastExperience} onChange={(event) => set('pastExperience', event.target.value)} /></TextField>
            </section>
          )}

          {isCompany && (
            <section className='border-t border-separator pt-7'>
              <h3 className='mb-5 text-base font-semibold'>Company profile</h3>
              <div className='grid gap-5 sm:grid-cols-2'>
                <Field label='Company name' value={form.companyName} onChange={(value) => set('companyName', value)} maxLength={255} />
                <Field label='Industry' value={form.industry} onChange={(value) => set('industry', value)} maxLength={255} />
                <Field label='Website' value={form.website} onChange={(value) => set('website', value)} type='url' maxLength={500} />
                <Field label='City' value={form.city} onChange={(value) => set('city', value)} maxLength={255} />
                <Field label='Country' value={form.country} onChange={(value) => set('country', value)} maxLength={255} />
              </div>
              <TextField fullWidth className='mt-5'><Label>Company description</Label><TextArea fullWidth rows={4} maxLength={2000} value={form.description} onChange={(event) => set('description', event.target.value)} /></TextField>
            </section>
          )}

          <div className='sticky bottom-0 flex justify-end gap-2 border-t border-border bg-background/95 py-4 backdrop-blur'>
            <Button variant='ghost' onPress={() => setEditing(false)}><X size={15} /> Cancel</Button>
            <Button variant='primary' isDisabled={mutation.isPending} onPress={() => mutation.mutate()}>{mutation.isPending ? <Spinner size='sm' /> : <Check size={15} />} Save changes</Button>
          </div>
        </div>
      ) : (
        <div className='py-7'>
          <h3 className='mb-2 text-base font-semibold'>Details</h3>
          <InfoRow icon={Mail} label='Email' value={user.email} />
          <InfoRow icon={Phone} label='Phone' value={user.phoneNumber} />
          {isStudent && <>
            <InfoRow icon={GraduationCap} label='University' value={student?.university} />
            <InfoRow icon={GraduationCap} label='Major' value={student?.major} />
            <InfoRow icon={GraduationCap} label='Year of study' value={student?.yearOfStudy} />
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
              <section><h3 className='text-sm font-semibold'>Skills</h3><div className='mt-3 flex flex-wrap gap-2'>{(student?.skills ?? []).length ? student.skills.map((skill: string) => <span key={skill} className='rounded-sm bg-default px-2 py-1 text-xs'>{skill}</span>) : <p className='text-sm text-muted'>No skills added.</p>}</div></section>
              <section><h3 className='text-sm font-semibold'>Past experience</h3><p className='mt-3 whitespace-pre-wrap text-sm leading-6 text-muted'>{student?.pastExperience || 'No experience added.'}</p></section>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
