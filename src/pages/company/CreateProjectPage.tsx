import { useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Lightbulb } from 'lucide-react';
import toast from 'react-hot-toast';
import { projectApi } from '../../api/services';
import ProjectForm, { type ProjectFormData } from './ProjectForm';

export default function CreateProjectPage() {
  const navigate = useNavigate();
  const mutation = useMutation({
    mutationFn: (data: ProjectFormData) => projectApi.create(data),
    onSuccess: ({ data }, variables) => {
      if (variables.saveAsDraft) {
        toast.success('Project draft saved');
        navigate(`/company/projects/${data.id}`);
      } else {
        toast.success('Project submitted for review!');
        navigate('/company/dashboard');
      }
    },
    onError: (error: any) => toast.error(error?.response?.data?.message || 'Failed to create project'),
  });

  return (
    <div className='animate-fade-up max-w-2xl'>
      <div className='page-header'>
        <h1 className='page-title'>Post a New Project</h1>
        <p className='page-subtitle'>Your project will be reviewed by a coordinator before going live.</p>
      </div>
      <div className='mb-6 p-4 rounded-2xl bg-ember-500/8 border border-ember-500/20 flex items-start gap-3'>
        <Lightbulb size={18} className='text-ember-400 flex-shrink-0 mt-0.5' />
        <p className='text-xs text-ink-300'>
          <span className='font-semibold text-ember-300'>Tip:</span> Use the AI assistant (bottom right) to help you write a clear, compelling project description and evaluation criteria.
        </p>
      </div>
      <ProjectForm
        pending={mutation.isPending}
        submitLabel='Submit for Review'
        internalNameHelp='Only visible to you — students and coordinators never see this.'
        onSubmit={mutation.mutate}
        onSaveDraft={mutation.mutate}
        onCancel={() => navigate(-1)}
      />
    </div>
  );
}
