import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Lightbulb } from 'lucide-react';
import toast from 'react-hot-toast';
import { projectApi } from '../../api/services';
import ProjectForm, { type ProjectFormData } from './ProjectForm';

export default function CompanyProjectEditPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: project, isLoading } = useQuery({
    queryKey: ['project', id],
    queryFn: () => projectApi.getById(id!).then((response) => response.data),
    enabled: !!id,
  });
  const mutation = useMutation({
    mutationFn: (data: ProjectFormData) => projectApi.update(id!, data),
    onSuccess: () => {
      toast.success(project?.status === 'ARCHIVED' ? 'Resubmitted for review!' : 'Project updated!');
      queryClient.invalidateQueries({ queryKey: ['my-projects'] });
      queryClient.invalidateQueries({ queryKey: ['project', id] });
      navigate(`/company/projects/${id}`);
    },
    onError: (error: any) => toast.error(error?.response?.data?.message || 'Update failed'),
  });

  if (isLoading) {
    return <div className='flex items-center justify-center py-24'><div className='w-6 h-6 border-2 border-ember-500 border-t-transparent rounded-full animate-spin' /></div>;
  }
  if (!project) return null;
  const isResubmit = project.status === 'ARCHIVED';

  return (
    <div className='animate-fade-up max-w-2xl'>
      <button onClick={() => navigate(`/company/projects/${id}`)}
        className='flex items-center gap-2 text-sm text-ink-400 hover:text-ink-100 transition-colors mb-6'>
        <ArrowLeft size={15} /> Back to Project
      </button>
      <div className='page-header'>
        <h1 className='page-title'>{isResubmit ? 'Edit & Resubmit' : 'Edit Project'}</h1>
        <p className='page-subtitle'>{isResubmit ? 'Make your changes and save to resubmit for coordinator review.' : 'Update your project details.'}</p>
      </div>
      {isResubmit && (
        <div className='mb-6 p-4 rounded-2xl bg-amber-500/8 border border-amber-500/20 flex items-start gap-3'>
          <Lightbulb size={18} className='text-amber-400 flex-shrink-0 mt-0.5' />
          <p className='text-xs text-ink-300'><span className='font-semibold text-amber-300'>Heads up:</span> Saving will resubmit this project for coordinator review.</p>
        </div>
      )}
      <ProjectForm
        initial={project}
        pending={mutation.isPending}
        submitLabel={isResubmit ? 'Save & Resubmit' : 'Save Changes'}
        pendingLabel='Saving…'
        internalNameHelp='Only visible to you.'
        onSubmit={mutation.mutate}
        onCancel={() => navigate(`/company/projects/${id}`)}
      />
    </div>
  );
}
