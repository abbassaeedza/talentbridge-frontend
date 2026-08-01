import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, ExternalLink, Github, Mail, Phone } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { userApi } from '../../api/services';
import { getUserName } from '../../types';
import { useAuth } from '../../contexts/AuthContext';

export default function StudentProfilePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user: viewer } = useAuth();
  const { data: student, isLoading } = useQuery({
    queryKey: ['student-profile', id],
    queryFn: () => userApi.getById(id!).then((response) => response.data),
    enabled: !!id,
  });

  if (isLoading) return <div className='card h-64 animate-pulse' />;
  if (!student) return <div className='card p-12 text-center text-sm text-ink-400'>Student profile not found.</div>;

  const profile = student.studentProfile;
  return (
    <div className='animate-fade-up max-w-4xl'>
      <button onClick={() => navigate(-1)} className='btn-ghost mb-5 px-0'><ArrowLeft size={15} /> Back</button>
      <div className='card overflow-hidden'>
        <div className='border-b border-ink-800/50 p-6 sm:p-8'>
          <div className='flex items-center gap-4'>
            <div className='flex h-16 w-16 items-center justify-center rounded-2xl bg-ink-700 font-display text-xl font-bold text-ink-100'>
              {student.firstName[0]}{student.lastName[0]}
            </div>
            <div>
              <h1 className='font-display text-2xl font-bold text-white'>{getUserName(student)}</h1>
              <p className='mt-1 text-sm text-ink-400'>{profile?.major ?? 'Major not provided'}{profile?.university ? ` · ${profile.university}` : ''}</p>
            </div>
          </div>
          <div className='mt-5 flex flex-wrap gap-3 text-xs text-ink-400'>
            <a href={`mailto:${student.email}`} className='flex items-center gap-1 hover:text-ember-400'><Mail size={12} /> {student.email}</a>
            {student.phoneNumber && <span className='flex items-center gap-1'><Phone size={12} /> {student.phoneNumber}</span>}
            {student.githubUsername && <a href={`https://github.com/${student.githubUsername}`} target='_blank' rel='noreferrer' className='flex items-center gap-1 hover:text-ember-400'><Github size={12} /> {student.githubUsername}</a>}
          </div>
        </div>

        <div className='grid gap-6 p-6 sm:grid-cols-2 sm:p-8'>
          <section>
            <h2 className='mb-2 text-xs font-semibold uppercase tracking-wider text-ink-500'>Academic information</h2>
            <div className='space-y-1 text-sm text-ink-200'>
              <p>Year of study: {profile?.yearOfStudy ?? 'Not provided'}</p>
              <p>Age: {profile?.age ?? 'Not provided'}</p>
              <p>GPA: {profile?.gpa ?? 'Not provided'}</p>
            </div>
          </section>
          <section>
            <h2 className='mb-2 text-xs font-semibold uppercase tracking-wider text-ink-500'>Skills</h2>
            <div className='flex flex-wrap gap-2'>
              {(profile?.skills ?? []).length > 0
                ? profile!.skills.map((skill) => <span key={skill} className='rounded-lg bg-ink-700 px-2.5 py-1 text-xs text-ink-200'>{skill}</span>)
                : <p className='text-sm text-ink-400'>No skills listed.</p>}
            </div>
          </section>
          <section>
            <h2 className='mb-2 text-xs font-semibold uppercase tracking-wider text-ink-500'>Bio</h2>
            <p className='text-sm leading-relaxed text-ink-300'>{profile?.bio ?? 'No bio provided.'}</p>
          </section>
          <section>
            <h2 className='mb-2 text-xs font-semibold uppercase tracking-wider text-ink-500'>Past experience</h2>
            <p className='text-sm leading-relaxed text-ink-300'>{profile?.pastExperience ?? 'No past experience provided.'}</p>
          </section>
          <section>
            <h2 className='mb-2 text-xs font-semibold uppercase tracking-wider text-ink-500'>Links</h2>
            <div className='space-y-2 text-sm'>
              {profile?.linkedinUrl && <a href={profile.linkedinUrl} target='_blank' rel='noreferrer' className='flex items-center gap-1 text-ember-400'>LinkedIn <ExternalLink size={12} /></a>}
              {profile?.portfolioUrl && <a href={profile.portfolioUrl} target='_blank' rel='noreferrer' className='flex items-center gap-1 text-ember-400'>Portfolio <ExternalLink size={12} /></a>}
              {!profile?.linkedinUrl && !profile?.portfolioUrl && <p className='text-ink-400'>No links provided.</p>}
            </div>
          </section>
          {viewer?.role === 'COORDINATOR' && (
            <section>
              <h2 className='mb-2 text-xs font-semibold uppercase tracking-wider text-ink-500'>Moderation history</h2>
              <div className='space-y-1 text-sm text-ink-300'>
                <p>Suspensions: {student.suspensionCount ?? 0}</p>
                <p>Rejections: {student.rejectionCount ?? 0}</p>
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
