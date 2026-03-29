import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../contexts/AuthContext';
import { userApi } from '../../api/services';
import {
  UserCircle,
  Mail,
  Phone,
  Building2,
  Globe,
  Linkedin,
  Github,
  GraduationCap,
  Briefcase,
  Pencil,
  Check,
  X,
  MapPin,
  BookOpen,
  Star,
} from 'lucide-react';
import toast from 'react-hot-toast';
import clsx from 'clsx';

// ── Skill tag input ────────────────────────────────────────────────────────
function SkillsInput({
  value,
  onChange,
}: {
  value: string[];
  onChange: (v: string[]) => void;
}) {
  const [input, setInput] = useState('');
  const add = () => {
    const s = input.trim();
    if (s && !value.includes(s)) {
      onChange([...value, s]);
      setInput('');
    }
  };
  return (
    <div>
      <div className='flex gap-2 mb-2'>
        <input
          className='input flex-1 text-sm py-2'
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              add();
            }
          }}
          placeholder='Type a skill and press Enter'
        />
        <button
          type='button'
          onClick={add}
          className='btn-secondary px-3 py-2 text-xs'
        >
          Add
        </button>
      </div>
      <div className='flex flex-wrap gap-1.5'>
        {value.map((s) => (
          <span
            key={s}
            className='flex items-center gap-1 px-2.5 py-1 rounded-full bg-ink-700 border border-ink-600/50 text-xs text-ink-200'
          >
            {s}
            <button
              type='button'
              onClick={() => onChange(value.filter((x) => x !== s))}
              className='text-ink-500 hover:text-red-400 ml-0.5'
            >
              <X size={11} />
            </button>
          </span>
        ))}
      </div>
    </div>
  );
}

// ── Info row ───────────────────────────────────────────────────────────────
function InfoRow({
  icon: Icon,
  label,
  value,
  href,
}: {
  icon: React.ElementType;
  label: string;
  value?: string | null;
  href?: string;
}) {
  if (!value) return null;
  return (
    <div className='flex items-start gap-3 py-3 border-b border-ink-800/50 last:border-0'>
      <div className='w-7 h-7 rounded-lg bg-ink-800 flex items-center justify-center flex-shrink-0 mt-0.5'>
        <Icon size={13} className='text-ink-400' />
      </div>
      <div className='flex-1 min-w-0'>
        <p className='text-[10px] text-ink-500 uppercase tracking-wider mb-0.5'>
          {label}
        </p>
        {href ? (
          <a
            href={href}
            target='_blank'
            rel='noopener noreferrer'
            className='text-sm text-ember-400 hover:text-ember-300 truncate block'
          >
            {value}
          </a>
        ) : (
          <p className='text-sm text-ink-100 truncate'>{value}</p>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

export default function ProfilePage() {
  const { user, refreshUser } = useAuth();
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);

  const sp = (user as any)?.studentProfile;
  const cp = (user as any)?.companyProfile;

  const [form, setForm] = useState<Record<string, any>>({});

  const startEdit = () => {
    setForm({
      firstName: user?.firstName ?? '',
      lastName: user?.lastName ?? '',
      phoneNumber: user?.phoneNumber ?? '',
      // Student
      university: sp?.university ?? '',
      major: sp?.major ?? '',
      yearOfStudy: sp?.yearOfStudy ?? '',
      bio: sp?.bio ?? '',
      linkedinUrl: sp?.linkedinUrl ?? '',
      portfolioUrl: sp?.portfolioUrl ?? '',
      pastExperience: sp?.pastExperience ?? '',
      skills: sp?.skills ?? [],
      gpa: sp?.gpa ?? '',
      // Company
      companyName: cp?.companyName ?? '',
      industry: cp?.industry ?? '',
      description: cp?.description ?? '',
      website: cp?.website ?? '',
      city: cp?.city ?? '',
      country: cp?.country ?? '',
    });
    setEditing(true);
  };

  const set = (k: string, v: any) => setForm((f) => ({ ...f, [k]: v }));

  const mutation = useMutation({
    mutationFn: () =>
      userApi.updateMyProfile({
        ...form,
        gpa: form.gpa ? parseFloat(form.gpa) : undefined,
      }),
    onSuccess: async () => {
      await refreshUser();
      toast.success('Profile updated!');
      setEditing(false);
    },
    onError: (e: any) =>
      toast.error(e?.response?.data?.message || 'Update failed'),
  });

  if (!user) return null;

  const initials = `${user.firstName?.[0] ?? ''}${user.lastName?.[0] ?? ''}`;
  const isStudent = user.role === 'STUDENT';
  const isCompany = user.role === 'COMPANY';

  return (
    <div className='animate-fade-up max-w-2xl'>
      <div className='flex items-center justify-between mb-8'>
        <div>
          <h1 className='page-title'>My Profile</h1>
          <p className='page-subtitle'>
            Your personal information and account details.
          </p>
        </div>
        {!editing && (
          <button
            onClick={startEdit}
            className='btn-secondary flex items-center gap-2'
          >
            <Pencil size={14} /> Edit Profile
          </button>
        )}
      </div>

      {/* Avatar + name hero */}
      <div className='card p-6 mb-5'>
        <div className='flex items-center gap-5'>
          <div className='w-16 h-16 rounded-2xl bg-gradient-to-br from-ember-500/30 to-ink-700 border border-ink-600/50 flex items-center justify-center flex-shrink-0'>
            <span className='font-display font-bold text-2xl text-white'>
              {initials}
            </span>
          </div>
          <div className='flex-1 min-w-0'>
            {editing ? (
              <div className='flex gap-3'>
                <div className='flex-1'>
                  <label className='input-label'>First name</label>
                  <input
                    className='input'
                    value={form.firstName}
                    onChange={(e) => set('firstName', e.target.value)}
                  />
                </div>
                <div className='flex-1'>
                  <label className='input-label'>Last name</label>
                  <input
                    className='input'
                    value={form.lastName}
                    onChange={(e) => set('lastName', e.target.value)}
                  />
                </div>
              </div>
            ) : (
              <>
                <h2 className='font-display font-bold text-xl text-white'>
                  {user.firstName} {user.lastName}
                </h2>
                <p className='text-sm text-ink-400 mt-0.5'>
                  {isStudent
                    ? sp?.major
                      ? `${sp.major} · ${sp?.university ?? ''}`
                      : sp?.university
                    : ''}
                  {isCompany ? cp?.companyName : ''}
                  {!isStudent && !isCompany ? user.role.replace('_', ' ') : ''}
                </p>
              </>
            )}
          </div>
          {/* GitHub badge */}
          {user.githubUsername && (
            <a
              href={`https://github.com/${user.githubUsername}`}
              target='_blank'
              rel='noopener noreferrer'
              className='flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-ink-800 border border-ink-700/50 text-xs text-ink-300 hover:text-white transition-colors'
            >
              <Github size={13} /> {user.githubUsername}
            </a>
          )}
        </div>

        {/* Bio */}
        {isStudent && (
          <div className='mt-4 pt-4 border-t border-ink-800/50'>
            {editing ? (
              <>
                <label className='input-label'>Bio</label>
                <textarea
                  className='textarea'
                  rows={3}
                  value={form.bio}
                  onChange={(e) => set('bio', e.target.value)}
                  placeholder='Tell us about yourself...'
                />
              </>
            ) : sp?.bio ? (
              <p className='text-sm text-ink-300 leading-relaxed'>{sp.bio}</p>
            ) : (
              <p className='text-sm text-ink-500 italic'>No bio added yet.</p>
            )}
          </div>
        )}

        {isCompany && (
          <div className='mt-4 pt-4 border-t border-ink-800/50'>
            {editing ? (
              <>
                <label className='input-label'>Company description</label>
                <textarea
                  className='textarea'
                  rows={3}
                  value={form.description}
                  onChange={(e) => set('description', e.target.value)}
                />
              </>
            ) : cp?.description ? (
              <p className='text-sm text-ink-300 leading-relaxed'>
                {cp.description}
              </p>
            ) : null}
          </div>
        )}
      </div>

      {/* Contact & details card */}
      <div className='card p-6 mb-5'>
        <h3 className='font-semibold text-white text-sm mb-4'>
          Contact & Details
        </h3>
        {editing ? (
          <div className='space-y-4'>
            <div>
              <label className='input-label'>Phone number</label>
              <input
                className='input'
                value={form.phoneNumber}
                onChange={(e) => set('phoneNumber', e.target.value)}
                placeholder='+1 234 567 8900'
              />
            </div>

            {isStudent && (
              <>
                <div className='grid grid-cols-2 gap-3'>
                  <div>
                    <label className='input-label'>University</label>
                    <input
                      className='input'
                      value={form.university}
                      onChange={(e) => set('university', e.target.value)}
                    />
                  </div>
                  <div>
                    <label className='input-label'>Major</label>
                    <input
                      className='input'
                      value={form.major}
                      onChange={(e) => set('major', e.target.value)}
                    />
                  </div>
                </div>
                <div className='grid grid-cols-2 gap-3'>
                  <div>
                    <label className='input-label'>Year of study</label>
                    <select
                      className='input'
                      value={form.yearOfStudy}
                      onChange={(e) => set('yearOfStudy', e.target.value)}
                    >
                      <option value=''>Select...</option>
                      {[
                        '1st Year',
                        '2nd Year',
                        '3rd Year',
                        '4th Year',
                        'Postgraduate',
                      ].map((y) => (
                        <option key={y} value={y}>
                          {y}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className='input-label'>GPA (optional)</label>
                    <input
                      className='input'
                      type='number'
                      step='0.01'
                      min='0'
                      max='4'
                      value={form.gpa}
                      onChange={(e) => set('gpa', e.target.value)}
                      placeholder='3.80'
                    />
                  </div>
                </div>
                <div>
                  <label className='input-label'>LinkedIn URL</label>
                  <input
                    className='input'
                    value={form.linkedinUrl}
                    onChange={(e) => set('linkedinUrl', e.target.value)}
                    placeholder='https://linkedin.com/in/...'
                  />
                </div>
                <div>
                  <label className='input-label'>Portfolio / GitHub URL</label>
                  <input
                    className='input'
                    value={form.portfolioUrl}
                    onChange={(e) => set('portfolioUrl', e.target.value)}
                  />
                </div>
              </>
            )}

            {isCompany && (
              <>
                <div className='grid grid-cols-2 gap-3'>
                  <div>
                    <label className='input-label'>Company name</label>
                    <input
                      className='input'
                      value={form.companyName}
                      onChange={(e) => set('companyName', e.target.value)}
                    />
                  </div>
                  <div>
                    <label className='input-label'>Industry</label>
                    <input
                      className='input'
                      value={form.industry}
                      onChange={(e) => set('industry', e.target.value)}
                    />
                  </div>
                </div>
                <div>
                  <label className='input-label'>Website</label>
                  <input
                    className='input'
                    value={form.website}
                    onChange={(e) => set('website', e.target.value)}
                    placeholder='https://...'
                  />
                </div>
                <div className='grid grid-cols-2 gap-3'>
                  <div>
                    <label className='input-label'>City</label>
                    <input
                      className='input'
                      value={form.city}
                      onChange={(e) => set('city', e.target.value)}
                    />
                  </div>
                  <div>
                    <label className='input-label'>Country</label>
                    <input
                      className='input'
                      value={form.country}
                      onChange={(e) => set('country', e.target.value)}
                    />
                  </div>
                </div>
              </>
            )}
          </div>
        ) : (
          <div>
            <InfoRow icon={Mail} label='Email' value={user.email} />
            <InfoRow icon={Phone} label='Phone' value={user.phoneNumber} />
            {isStudent && (
              <>
                <InfoRow
                  icon={GraduationCap}
                  label='University'
                  value={sp?.university}
                />
                <InfoRow icon={BookOpen} label='Major' value={sp?.major} />
                <InfoRow icon={BookOpen} label='Year' value={sp?.yearOfStudy} />
                <InfoRow
                  icon={Star}
                  label='GPA'
                  value={sp?.gpa ? `${sp.gpa} / 4.0` : null}
                />
                <InfoRow
                  icon={Linkedin}
                  label='LinkedIn'
                  value={sp?.linkedinUrl}
                  href={sp?.linkedinUrl}
                />
                <InfoRow
                  icon={Globe}
                  label='Portfolio'
                  value={sp?.portfolioUrl}
                  href={sp?.portfolioUrl}
                />
              </>
            )}
            {isCompany && (
              <>
                <InfoRow
                  icon={Building2}
                  label='Company'
                  value={cp?.companyName}
                />
                <InfoRow
                  icon={Briefcase}
                  label='Industry'
                  value={cp?.industry}
                />
                <InfoRow
                  icon={Globe}
                  label='Website'
                  value={cp?.website}
                  href={cp?.website}
                />
                <InfoRow
                  icon={MapPin}
                  label='Location'
                  value={[cp?.city, cp?.country].filter(Boolean).join(', ')}
                />
              </>
            )}
          </div>
        )}
      </div>

      {/* Skills card — student only */}
      {isStudent && (
        <div className='card p-6 mb-5'>
          <h3 className='font-semibold text-white text-sm mb-4'>Skills</h3>
          {editing ? (
            <SkillsInput
              value={form.skills ?? []}
              onChange={(v) => set('skills', v)}
            />
          ) : (
            <div className='flex flex-wrap gap-2'>
              {(sp?.skills ?? []).length > 0 ? (
                (sp?.skills ?? []).map((s: string) => (
                  <span
                    key={s}
                    className='px-3 py-1 rounded-full bg-ink-700 border border-ink-600/50 text-xs text-ink-200'
                  >
                    {s}
                  </span>
                ))
              ) : (
                <p className='text-sm text-ink-500 italic'>
                  No skills added yet.
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Past experience — student only */}
      {isStudent && (
        <div className='card p-6 mb-5'>
          <h3 className='font-semibold text-white text-sm mb-4'>
            Past Experience
          </h3>
          {editing ? (
            <textarea
              className='textarea'
              rows={4}
              value={form.pastExperience}
              onChange={(e) => set('pastExperience', e.target.value)}
              placeholder='Describe your previous projects, internships, or relevant experience...'
            />
          ) : sp?.pastExperience ? (
            <p className='text-sm text-ink-300 leading-relaxed whitespace-pre-wrap'>
              {sp.pastExperience}
            </p>
          ) : (
            <p className='text-sm text-ink-500 italic'>
              No experience added yet.
            </p>
          )}
        </div>
      )}

      {/* Save / Cancel */}
      {editing && (
        <div className='flex gap-3 sticky bottom-6'>
          <button
            onClick={() => setEditing(false)}
            className='btn-secondary flex-1 flex items-center justify-center gap-2'
          >
            <X size={15} /> Cancel
          </button>
          <button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending}
            className='btn-primary flex-1 flex items-center justify-center gap-2'
          >
            {mutation.isPending ? (
              <div className='w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin' />
            ) : (
              <Check size={15} />
            )}
            {mutation.isPending ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      )}
    </div>
  );
}
