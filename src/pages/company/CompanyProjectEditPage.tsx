import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Lightbulb } from 'lucide-react';
import toast from 'react-hot-toast';
import { Button } from '@heroui/react/button';
import { Spinner } from '@heroui/react/spinner';
import { projectApi } from '../../api/services';
import { PageHeader } from '../../components/ui/TalentBridgeUI';
import ProjectForm, { type ProjectFormData } from './ProjectForm';

export default function CompanyProjectEditPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: project, isLoading } = useQuery({ queryKey: ['project', id], queryFn: () => projectApi.getById(id!).then((response) => response.data), enabled: !!id });
  const mutation = useMutation({
    mutationFn: (data: ProjectFormData) => projectApi.update(id!, data),
    onSuccess: () => {
      toast.success(project?.status === 'ARCHIVED' ? 'Project resubmitted' : 'Project updated');
      queryClient.invalidateQueries({ queryKey: ['my-projects'] });
      queryClient.invalidateQueries({ queryKey: ['project', id] });
      navigate(`/company/projects/${id}`);
    },
    onError: (error: any) => toast.error(error?.response?.data?.message || 'Could not update project'),
  });
  if (isLoading) return <div className='flex min-h-64 items-center justify-center'><Spinner /></div>;
  if (!project) return null;
  const resubmit = project.status === 'ARCHIVED';
  return (
    <div className='max-w-3xl'>
      <Button variant='ghost' size='sm' className='mb-5' onPress={() => navigate(`/company/projects/${id}`)}><ArrowLeft size={15} /> Back to project</Button>
      <PageHeader title={resubmit ? 'Edit and resubmit' : 'Edit project'} description={resubmit ? 'Saving sends this project back for coordinator review.' : 'Update the project brief and assignment.'} />
      {resubmit && <div className='mb-6 flex items-start gap-3 rounded-lg border border-border bg-surface-secondary p-4'><Lightbulb size={18} className='mt-0.5 shrink-0 text-foreground' /><p className='text-sm text-muted'>Saving this project will resubmit it for coordinator review.</p></div>}
      <ProjectForm initial={project} pending={mutation.isPending} submitLabel={resubmit ? 'Save and resubmit' : 'Save changes'} pendingLabel='Saving' internalNameHelp='Only your company can see this reference.' onSubmit={mutation.mutate} onCancel={() => navigate(`/company/projects/${id}`)} />
    </div>
  );
}
