import { useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Bot } from 'lucide-react';
import toast from 'react-hot-toast';
import { projectApi } from '../../api/services';
import ProjectForm, { type ProjectFormData } from './ProjectForm';
import { PageHeader } from '../../components/ui/TalentBridgeUI';

export default function CreateProjectPage() {
  const navigate = useNavigate();
  const mutation = useMutation({
    mutationFn: (data: ProjectFormData) => projectApi.create(data),
    onSuccess: ({ data }, variables) => {
      if (variables.saveAsDraft) {
        toast.success('Project draft saved');
        navigate(`/company/projects/${data.id}`);
      } else {
        toast.success('Project submitted for review');
        navigate('/company/dashboard');
      }
    },
    onError: (error: any) => toast.error(error?.response?.data?.message || 'Failed to create project'),
  });

  return (
    <div className='max-w-3xl'>
      <PageHeader title='Create project' description='Draft the project brief, requirements, supervision, and application deadline.' />
      <div className='mb-7 flex items-start gap-3 rounded-lg border border-border bg-surface-secondary p-4'>
        <Bot size={18} className='mt-0.5 shrink-0 text-muted' />
        <p className='text-sm text-muted'>The TalentBridge assistant can prepare these fields from your project description.</p>
      </div>
      <ProjectForm
        pending={mutation.isPending}
        submitLabel='Submit for review'
        internalNameHelp='Only your company can see this reference.'
        onSubmit={mutation.mutate}
        onSaveDraft={mutation.mutate}
        onCancel={() => navigate(-1)}
      />
    </div>
  );
}
