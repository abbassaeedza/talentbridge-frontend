import type { SupervisorProfessionalFields } from '../../types';

type Props = {
  value: SupervisorProfessionalFields;
  onChange: (value: SupervisorProfessionalFields) => void;
};

export default function SupervisorProfileFields({ value, onChange }: Props) {
  const set = (key: keyof SupervisorProfessionalFields, next: string) =>
    onChange({ ...value, [key]: next });

  return (
    <>
      <div className='grid gap-4 sm:grid-cols-2'>
        <div>
          <label className='input-label' htmlFor='jobTitle'>Job title *</label>
          <input id='jobTitle' className='input' maxLength={100} required value={value.jobTitle}
            onChange={(event) => set('jobTitle', event.target.value)} placeholder='Engineering Manager' />
        </div>
        <div>
          <label className='input-label' htmlFor='department'>Department *</label>
          <input id='department' className='input' maxLength={255} required value={value.department}
            onChange={(event) => set('department', event.target.value)} placeholder='Platform Engineering' />
        </div>
      </div>
      <div>
        <label className='input-label' htmlFor='supervisorBio'>Bio *</label>
        <textarea id='supervisorBio' className='textarea' maxLength={2000} rows={4} required value={value.bio}
          onChange={(event) => set('bio', event.target.value)} placeholder='Describe your experience and how you support teams.' />
      </div>
      <div>
        <label className='input-label' htmlFor='linkedinUrl'>LinkedIn URL</label>
        <input id='linkedinUrl' type='url' className='input' maxLength={500} value={value.linkedinUrl ?? ''}
          onChange={(event) => set('linkedinUrl', event.target.value)} placeholder='https://linkedin.com/in/...' />
      </div>
    </>
  );
}
