import { useMutation } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Bot } from 'lucide-react';
import toast from 'react-hot-toast';
import { projectApi } from '../../api/services';
import ProjectForm, { type ProjectFormData } from './ProjectForm';
import { PageHeader } from '../../components/ui/TalentBridgeUI';
import { getAccessToken, getJwtSessionKey } from '../../utils/authTokens';

export default function CreateProjectPage() {
  const navigate = useNavigate();
  const [outcomeUnknown, setOutcomeUnknown] = useState(false);
  const saving = useRef(false);
  const mounted = useRef(true);
  const saveCurrent = useRef<() => boolean>(() => false);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const mutation = useMutation({
    mutationFn: async (data: ProjectFormData) => {
      const token = getAccessToken();
      const session = getJwtSessionKey(token);
      const current = () => mounted.current && !!getAccessToken() && (session ? session === getJwtSessionKey(getAccessToken()) : token === getAccessToken());
      saveCurrent.current = current;
      try {
        const response = await projectApi.create(data);
        if (!current()) throw new Error('Session changed');
        if (typeof response.data?.id !== 'string' || !response.data.id.trim()) { setOutcomeUnknown(true); throw new Error('Save outcome unknown'); }
        return response;
      } catch (error: any) {
        if (current() && (!error.response || error.response.status >= 500 || error.response.status === 408)) setOutcomeUnknown(true);
        throw error;
      }
    },
    onSuccess: ({ data }, variables) => {
      if (!saveCurrent.current()) return;
      if (variables.saveAsDraft) {
        toast.success('Project draft saved');
        navigate(`/company/projects/${data.id}`);
      } else {
        toast.success('Project submitted for review');
        navigate('/company/dashboard');
      }
    },
    onError: (error: any) => { if (saveCurrent.current()) toast.error(error?.response?.data?.message || 'Failed to create project'); },
  });
  const save = (data: ProjectFormData) => {
    if (saving.current || outcomeUnknown) return;
    saving.current = true;
    mutation.mutate(data, { onSettled: () => { if (saveCurrent.current()) saving.current = false; } });
  };

  return (
    <div className='max-w-3xl'>
      <PageHeader title='Create project' description='Draft the project brief, requirements, supervision, and application deadline.' />
      <div className='mb-7 flex items-start gap-3 rounded-lg border border-border bg-surface-secondary p-4'>
        <Bot size={18} className='mt-0.5 shrink-0 text-muted' />
        <p className='text-sm text-muted'>The TalentBridge assistant can prepare these fields from your project description.</p>
      </div>
      <ProjectForm
        pending={mutation.isPending}
        outcomeUnknown={outcomeUnknown}
        submitLabel='Submit for review'
        internalNameHelp='Only your company can see this reference.'
        onSubmit={save}
        onSaveDraft={save}
        onCancel={() => navigate(-1)}
      />
      {outcomeUnknown && <p role='alert' className='mt-4 text-sm'>Save outcome unknown. Inspect your projects before submitting again. <Link to='/company/projects' className='inline-flex min-h-11 items-center underline'>Inspect projects</Link></p>}
    </div>
  );
}
