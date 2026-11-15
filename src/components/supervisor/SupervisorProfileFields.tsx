import { Input } from '@heroui/react/input';
import { Label } from '@heroui/react/label';
import { TextArea } from '@heroui/react/textarea';
import { TextField } from '@heroui/react/textfield';
import type { SupervisorProfessionalFields } from '../../types';

type Props = { value: SupervisorProfessionalFields; onChange: (value: SupervisorProfessionalFields) => void };

export default function SupervisorProfileFields({ value, onChange }: Props) {
  const set = (key: keyof SupervisorProfessionalFields, next: string) => onChange({ ...value, [key]: next });
  return (
    <>
      <div className='grid gap-5 sm:grid-cols-2'>
        <TextField fullWidth isRequired>
          <Label>Job title</Label>
          <Input fullWidth maxLength={100} value={value.jobTitle} onChange={(event) => set('jobTitle', event.target.value)} placeholder='Engineering manager' />
        </TextField>
        <TextField fullWidth isRequired>
          <Label>Department</Label>
          <Input fullWidth maxLength={255} value={value.department} onChange={(event) => set('department', event.target.value)} placeholder='Platform engineering' />
        </TextField>
      </div>
      <TextField fullWidth isRequired>
        <Label>Bio</Label>
        <TextArea fullWidth maxLength={2000} rows={4} value={value.bio} onChange={(event) => set('bio', event.target.value)} placeholder='Describe your experience and how you support teams.' />
        <p className='mt-1 text-right text-xs text-muted'>{value.bio.length}/2000</p>
      </TextField>
      <TextField fullWidth>
        <Label>LinkedIn URL</Label>
        <Input fullWidth type='url' pattern='https?://.+' maxLength={500} value={value.linkedinUrl ?? ''} onChange={(event) => set('linkedinUrl', event.target.value)} placeholder='https://linkedin.com/in/...' />
      </TextField>
    </>
  );
}
