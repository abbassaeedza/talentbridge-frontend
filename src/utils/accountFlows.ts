import type { ProfileUpdateRequest, UserRole } from '../types/index.ts';

export type ProfileForm = Omit<ProfileUpdateRequest, 'gpa'> & { gpa?: number | string | null };

export function profileUpdatePayload(role: UserRole, form: ProfileForm): ProfileUpdateRequest {
  const fields: (keyof ProfileUpdateRequest)[] = ['firstName', 'lastName', 'phoneNumber'];
  if (role === 'STUDENT') fields.push('university', 'major', 'yearOfStudy', 'bio', 'linkedinUrl', 'portfolioUrl', 'pastExperience', 'skills', 'gpa');
  if (role === 'COMPANY') fields.push('companyName', 'industry', 'description', 'website', 'city', 'country');
  return Object.fromEntries(fields.filter(key => Object.prototype.hasOwnProperty.call(form, key) && form[key] !== undefined)
    .map(key => [key, key === 'gpa' && form[key] !== null ? form[key] === '' ? null : Number(form[key]) : form[key]])) as ProfileUpdateRequest;
}

export function invitationReturnPath(search: string) {
  const path = new URLSearchParams(search).get('returnTo');
  return path && /^\/project-supervisor-invitations\/[a-zA-Z0-9_-]+$/.test(path) ? path : '/dashboard';
}
