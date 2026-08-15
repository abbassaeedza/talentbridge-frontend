import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, ExternalLink, Github, Mail, Phone } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { Avatar } from '@heroui/react/avatar';
import { Button } from '@heroui/react/button';
import { Skeleton } from '@heroui/react/skeleton';
import { userApi } from '../../api/services';
import { getUserName } from '../../types';
import { useAuth } from '../../contexts/AuthContext';

export default function StudentProfilePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user: viewer } = useAuth();
  const { data: student, isLoading } = useQuery({ queryKey: ['student-profile', id], queryFn: () => userApi.getById(id!).then((response) => response.data), enabled: !!id });
  if (isLoading) return <Skeleton className='h-64 rounded-lg' />;
  if (!student) return <div className='rounded-lg border border-border bg-surface p-12 text-center text-sm text-muted'>Student profile not found.</div>;
  const profile = student.studentProfile;
  const section = (title: string, content: React.ReactNode) => <section className='border-t border-separator py-6 first:border-0 first:pt-0'><h2 className='text-sm font-semibold'>{title}</h2><div className='mt-3 text-sm leading-6 text-muted'>{content}</div></section>;
  return (
    <div className='max-w-4xl'>
      <Button variant='ghost' size='sm' className='mb-5' onPress={() => navigate(-1)}><ArrowLeft size={15} /> Back</Button>
      <header className='border-b border-separator pb-6'>
        <div className='flex flex-col gap-4 sm:flex-row sm:items-center'>
          <Avatar size='lg'><Avatar.Fallback>{student.firstName[0]}{student.lastName[0]}</Avatar.Fallback></Avatar>
          <div className='min-w-0 flex-1'>
            <h1 className='text-2xl font-semibold tracking-tight'>{getUserName(student)}</h1>
            <p className='mt-1 text-sm text-muted'>{profile?.major ?? 'Major not provided'}{profile?.university ? ` · ${profile.university}` : ''}</p>
          </div>
        </div>
        <div className='mt-5 flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted'>
          <a href={`mailto:${student.email}`} className='flex items-center gap-1.5 hover:text-foreground'><Mail size={14} /> {student.email}</a>
          {student.phoneNumber && <span className='flex items-center gap-1.5'><Phone size={14} /> {student.phoneNumber}</span>}
          {student.githubUsername && <a href={`https://github.com/${student.githubUsername}`} target='_blank' rel='noreferrer' className='flex items-center gap-1.5 text-accent hover:underline'><Github size={14} /> {student.githubUsername}</a>}
        </div>
      </header>
      <div className='grid gap-x-10 py-7 sm:grid-cols-2'>
        {section('Academic information', <div className='space-y-1'><p>Year of study: {profile?.yearOfStudy ?? 'Not provided'}</p><p>Age: {profile?.age ?? 'Not provided'}</p><p>GPA: {profile?.gpa ?? 'Not provided'}</p></div>)}
        {section('Skills', <div className='flex flex-wrap gap-2'>{(profile?.skills ?? []).length ? profile!.skills.map((skill) => <span key={skill} className='rounded-sm bg-default px-2 py-1 text-xs text-foreground'>{skill}</span>) : 'No skills listed.'}</div>)}
        {section('Bio', profile?.bio ?? 'No bio provided.')}
        {section('Past experience', profile?.pastExperience ?? 'No past experience provided.')}
        {section('Links', <div className='space-y-2'>{profile?.linkedinUrl && <a href={profile.linkedinUrl} target='_blank' rel='noreferrer' className='flex items-center gap-1 text-accent hover:underline'>LinkedIn <ExternalLink size={12} /></a>}{profile?.portfolioUrl && <a href={profile.portfolioUrl} target='_blank' rel='noreferrer' className='flex items-center gap-1 text-accent hover:underline'>Portfolio <ExternalLink size={12} /></a>}{!profile?.linkedinUrl && !profile?.portfolioUrl && 'No links provided.'}</div>)}
        {viewer?.role === 'COORDINATOR' && section('Moderation history', <div className='space-y-1'><p>Suspensions: {student.suspensionCount ?? 0}</p><p>Rejections: {student.rejectionCount ?? 0}</p></div>)}
      </div>
    </div>
  );
}
