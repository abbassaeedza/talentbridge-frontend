import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Lightbulb } from 'lucide-react';
import toast from 'react-hot-toast';
import { Button } from '@heroui/react/button';
import { Spinner } from '@heroui/react/spinner';
import { projectApi } from '../../api/services';
import { PageHeader } from '../../components/ui/TalentBridgeUI';
import ProjectForm, { type ProjectFormData } from './ProjectForm';
import { getAccessToken, getJwtSessionKey } from '../../utils/authTokens';

export default function CompanyProjectEditPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [outcomeUnknown, setOutcomeUnknown] = useState(false);
  const saving = useRef(false);
  const mounted = useRef(true);
  const saveCurrent = useRef<() => boolean>(() => false);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const { data: project, isLoading } = useQuery({ queryKey: ['project', id], queryFn: () => projectApi.getById(id!).then((response) => response.data), enabled: !!id });
  const mutation = useMutation({
    mutationFn: async (data: ProjectFormData) => {
      const token = getAccessToken();
      const session = getJwtSessionKey(token);
      const current = () => mounted.current && !!getAccessToken() && (session ? session === getJwtSessionKey(getAccessToken()) : token === getAccessToken());
      saveCurrent.current = current;
      try {
        const response = await projectApi.update(id!, data);
        if (!current()) throw new Error('Session changed');
        if (typeof response.data?.id !== 'string' || !response.data.id.trim()) { setOutcomeUnknown(true); throw new Error('Save outcome unknown'); }
        return response;
      } catch (error: any) {
        if (current() && (!error.response || error.response.status >= 500 || error.response.status === 408)) setOutcomeUnknown(true);
        throw error;
      }
    },
    onSuccess: () => {
      if (!saveCurrent.current()) return;
      toast.success(project?.status === 'ARCHIVED' ? 'Project resubmitted' : 'Project updated');
      queryClient.invalidateQueries({ queryKey: ['my-projects'] });
      queryClient.invalidateQueries({ queryKey: ['project', id] });
      navigate(`/company/projects/${id}`);
    },
    onError: (error: any) => { if (saveCurrent.current()) toast.error(error?.response?.data?.message || 'Could not update project'); },
  });
  const save = (data: ProjectFormData) => {
    if (saving.current || outcomeUnknown) return;
    saving.current = true;
    mutation.mutate(data, { onSettled: () => { if (saveCurrent.current()) saving.current = false; } });
  };
  if (isLoading) return <div className='flex min-h-64 items-center justify-center'><Spinner /></div>;
  if (!project) return null;
  const resubmit = project.status === 'ARCHIVED';
  return (
    <div className='max-w-3xl'>
      <Button variant='ghost' size='sm' className='mb-5' onPress={() => navigate(`/company/projects/${id}`)}><ArrowLeft size={15} /> Back to project</Button>
      <PageHeader title={resubmit ? 'Edit and resubmit' : 'Edit project'} description={resubmit ? 'Saving sends this project back for coordinator review.' : 'Update the project brief and assignment.'} />
      {resubmit && <div className='mb-6 flex items-start gap-3 rounded-lg border border-border bg-surface-secondary p-4'><Lightbulb size={18} className='mt-0.5 shrink-0 text-foreground' /><p className='text-sm text-muted'>Saving this project will resubmit it for coordinator review.</p></div>}
      <ProjectForm initial={project} pending={mutation.isPending} outcomeUnknown={outcomeUnknown} submitLabel={resubmit ? 'Save and resubmit' : 'Save changes'} pendingLabel='Saving' internalNameHelp='Only your company can see this reference.' onSubmit={save} onCancel={() => navigate(`/company/projects/${id}`)} />
      {outcomeUnknown && <p role='alert' className='mt-4 text-sm'>Save outcome unknown. Inspect your projects before submitting again. <Link to='/company/projects' className='inline-flex min-h-11 items-center underline'>Inspect projects</Link></p>}
    </div>
  );
}
