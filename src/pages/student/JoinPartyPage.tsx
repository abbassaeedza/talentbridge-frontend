import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { partyApi } from '../../api/services';
import { useAuth } from '../../contexts/AuthContext';
import { Users, CheckCircle, AlertCircle, Layers } from 'lucide-react';
import toast from 'react-hot-toast';

export default function JoinPartyPage() {
  const { partyId } = useParams<{ partyId: string }>();
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [joined, setJoined] = useState(false);

  // Fetch party info to show name before joining
  const {
    data: party,
    isLoading: partyLoading,
    error: partyError,
  } = useQuery({
    queryKey: ['party-preview', partyId],
    queryFn: () => partyApi.getById(partyId!).then((r) => r.data),
    enabled: !!partyId,
    retry: false,
  });

  const joinMutation = useMutation({
    mutationFn: () => partyApi.join(partyId!),
    onSuccess: () => {
      setJoined(true);
      toast.success('You joined the party!');
      setTimeout(() => navigate('/student/party'), 2000);
    },
    onError: (e: any) =>
      toast.error(e?.response?.data?.message || 'Could not join party'),
  });

  // If not logged in, redirect to login with return URL
  useEffect(() => {
    if (!loading && !user) {
      navigate(`/login?redirect=/join/${partyId}`);
    }
  }, [loading, user]);

  // If user is not a student, redirect to dashboard
  useEffect(() => {
    if (user && user.role !== 'STUDENT') {
      toast.error('Only students can join parties.');
      navigate('/dashboard');
    }
  }, [user]);

  if (loading || partyLoading)
    return (
      <div className='min-h-screen bg-ink-950 mesh-bg flex items-center justify-center'>
        <div className='w-6 h-6 border-2 border-ember-500 border-t-transparent rounded-full animate-spin' />
      </div>
    );

  if (partyError || !party)
    return (
      <div className='min-h-screen bg-ink-950 mesh-bg flex items-center justify-center p-8'>
        <div className='text-center max-w-sm'>
          <div className='w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto mb-5'>
            <AlertCircle size={28} className='text-red-400' />
          </div>
          <h1 className='font-display text-xl font-bold text-white mb-2'>
            Party not found
          </h1>
          <p className='text-sm text-ink-400 mb-6'>
            This invite link may be invalid or the party no longer exists.
          </p>
          <Link to='/student/party' className='btn-primary'>
            Go to My Party
          </Link>
        </div>
      </div>
    );

  if (joined)
    return (
      <div className='min-h-screen bg-ink-950 mesh-bg flex items-center justify-center p-8'>
        <div className='text-center max-w-sm'>
          <div className='w-16 h-16 rounded-2xl bg-jade-500/10 border border-jade-500/20 flex items-center justify-center mx-auto mb-5'>
            <CheckCircle size={28} className='text-jade-400' />
          </div>
          <h1 className='font-display text-xl font-bold text-white mb-2'>
            You're in!
          </h1>
          <p className='text-sm text-ink-400'>
            Redirecting to your party page…
          </p>
        </div>
      </div>
    );

  return (
    <div className='min-h-screen bg-ink-950 mesh-bg flex items-center justify-center p-8'>
      <div className='max-w-sm w-full'>
        {/* Logo */}
        <div className='flex items-center gap-2.5 justify-center mb-8'>
          <div className='w-8 h-8 rounded-lg bg-ember-500 flex items-center justify-center'>
            <Layers size={16} className='text-white' />
          </div>
          <span className='font-display font-bold text-white text-lg'>
            TalentBridge
          </span>
        </div>

        <div className='card p-8 text-center'>
          <div className='w-14 h-14 rounded-2xl bg-ink-700 border border-ink-600/50 flex items-center justify-center mx-auto mb-5'>
            <Users size={24} className='text-ink-300' />
          </div>

          <p className='text-xs text-ink-400 uppercase tracking-wider mb-2'>
            You've been invited to join
          </p>
          <h1 className='font-display text-2xl font-bold text-white mb-1'>
            {party.name}
          </h1>

          <div className='flex items-center justify-center gap-3 mb-6 mt-3'>
            <span
              className={`badge text-[10px] ${
                party.status === 'FORMING' ? 'badge-forming' : 'badge-active'
              }`}
            >
              {party.status}
            </span>
            {party.semester && (
              <span className='text-xs text-ink-500'>{party.semester}</span>
            )}
            <span className='text-xs text-ink-500'>
              {party.members?.length ?? 0} member
              {(party.members?.length ?? 0) !== 1 ? 's' : ''}
            </span>
          </div>

          {/* Members preview */}
          {(party.members ?? []).length > 0 && (
            <div className='flex justify-center -space-x-2 mb-6'>
              {(party.members ?? []).slice(0, 5).map((m: any) => (
                <div
                  key={m.id}
                  title={`${m.firstName} ${m.lastName}`}
                  className='w-9 h-9 rounded-full bg-ink-700 border-2 border-ink-900 flex items-center justify-center text-xs font-bold text-ink-200'
                >
                  {m.firstName?.[0]}
                  {m.lastName?.[0]}
                </div>
              ))}
            </div>
          )}

          {party.status !== 'FORMING' ? (
            <div className='p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 mb-5'>
              <p className='text-xs text-amber-400'>
                This party is no longer accepting new members.
              </p>
            </div>
          ) : null}

          <button
            onClick={() => joinMutation.mutate()}
            disabled={joinMutation.isPending || party.status !== 'FORMING'}
            className='btn-primary w-full justify-center'
          >
            {joinMutation.isPending ? (
              <div className='w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin' />
            ) : (
              'Join Party'
            )}
          </button>

          <Link
            to='/student/party'
            className='block mt-3 text-xs text-ink-500 hover:text-ink-300 transition-colors'
          >
            Go to My Party instead
          </Link>
        </div>
      </div>
    </div>
  );
}
