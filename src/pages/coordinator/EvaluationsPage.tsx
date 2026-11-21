import { useQuery } from '@tanstack/react-query';
import { Award } from 'lucide-react';
import { submissionApi } from '../../api/services';
import { useAuth } from '../../contexts/AuthContext';
import { useSessionRequests } from '../../hooks/useSessionRequests';
import QuerySection from '../../components/ui/QuerySection';
import { EmptyState, PageHeader } from '../../components/ui/TalentBridgeUI';
import SubmissionEvaluation from '../../components/evaluation/SubmissionEvaluation';

export default function EvaluationsPage() {
  const { user } = useAuth();
  const session = useSessionRequests();
  const queryKey = ['coordinator-submissions', user?.role, user?.id, session.owner];
  const query = useQuery({
    queryKey,
    queryFn: ({ signal }) => submissionApi.list({ ownerSession: session.owner ?? '', signal }).then(r => r.data),
    enabled: user?.role === 'COORDINATOR' && !!session.owner,
    retry: false,
  });
  return <div className='min-w-0'>
    <PageHeader title='Evaluations' description='Review submissions, run evaluation, and finalize reports.' />
    <QuerySection query={query} label='Submissions'>
      {query.data?.length === 0 ? <EmptyState icon={Award} title='No submissions to evaluate' />
        : <div className='space-y-4'>{query.data?.map(submission => <SubmissionEvaluation
          key={`${user?.id}:${session.owner}:${submission.id}`} submission={submission} discoveryKey={queryKey}
        />)}</div>}
    </QuerySection>
  </div>;
}
