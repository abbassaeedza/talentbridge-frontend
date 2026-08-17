import { useEffect, useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { AlertCircle, CheckCircle, Users } from 'lucide-react';
import toast from 'react-hot-toast';
import { Avatar } from '@heroui/react/avatar';
import { Button, buttonVariants } from '@heroui/react/button';
import { Card } from '@heroui/react/card';
import { Spinner } from '@heroui/react/spinner';
import { partyApi } from '../../api/services';
import { useAuth } from '../../contexts/AuthContext';
import { PublicShell, StatusBadge } from '../../components/ui/TalentBridgeUI';
import { defaultAvatarUrl } from '../../utils/avatar';

export default function JoinPartyPage() {
  const { partyId } = useParams<{ partyId: string }>();
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [joined, setJoined] = useState(false);
  const { data: rules } = useQuery({ queryKey: ['party-rules'], queryFn: () => partyApi.getRules().then((response) => response.data) });
  const { data: party, isLoading, error } = useQuery({ queryKey: ['party-preview', partyId], queryFn: () => partyApi.getById(partyId!).then((response) => response.data), enabled: !!partyId, retry: false });
  const join = useMutation({ mutationFn: () => partyApi.join(partyId!), onSuccess: () => { setJoined(true); toast.success('You joined the party'); setTimeout(() => navigate('/student/party'), 2000); }, onError: (reason: any) => toast.error(reason?.response?.data?.message || 'Could not join party') });
  useEffect(() => { if (!loading && !user) navigate(`/login?redirect=/join/${partyId}`); }, [loading, user, navigate, partyId]);
  useEffect(() => { if (user && user.role !== 'STUDENT') { toast.error('Only students can join parties'); navigate('/dashboard'); } }, [user, navigate]);
  if (loading || isLoading) return <PublicShell><div className='flex justify-center py-20'><Spinner /></div></PublicShell>;
  if (error || !party) return <PublicShell><State icon={AlertCircle} title='Party not found' description='This invitation is invalid or the party no longer exists.' action={<Link to='/student/party' className={buttonVariants({ variant: 'primary' })}>Go to my party</Link>} /></PublicShell>;
  if (joined) return <PublicShell><State icon={CheckCircle} title="You're in!" description='Redirecting to your party workspace.' /></PublicShell>;
  const memberCount = party.members?.length ?? 0;
  const joinable = ['FORMING', 'ACTIVE'].includes(party.status) && (!rules || memberCount < rules.maxSize);
  return <PublicShell><Card><Card.Content className='p-7 text-center'>
    <span className='mx-auto flex size-12 items-center justify-center rounded-lg bg-default text-muted'><Users size={22} /></span>
    <p className='mt-5 text-xs font-medium uppercase tracking-wider text-muted'>Party invitation</p>
    <h1 className='mt-2 text-2xl font-semibold'>{party.name}</h1>
    <div className='mt-3 flex items-center justify-center gap-3'><StatusBadge status={party.status} />{party.semester && <span className='text-xs text-muted'>{party.semester}</span>}<span className='text-xs text-muted'>{memberCount} member{memberCount === 1 ? '' : 's'}</span></div>
    {party.members?.length > 0 && <div className='mt-6 flex justify-center -space-x-2'>{party.members.slice(0, 5).map((member: any) => <Avatar key={member.id} size='sm' title={`${member.firstName} ${member.lastName}`}><Avatar.Image src={defaultAvatarUrl(member.id || member.email)} alt={`${member.firstName} ${member.lastName}`} /><Avatar.Fallback>{member.firstName?.[0]}{member.lastName?.[0]}</Avatar.Fallback></Avatar>)}</div>}
    {!joinable && <p className='mt-6 rounded-lg border border-border bg-surface-secondary p-3 text-sm text-muted'>This party is not accepting new members.</p>}
    <Button fullWidth className='mt-6' variant='primary' onPress={() => join.mutate()} isDisabled={join.isPending || !joinable}>{join.isPending && <Spinner size='sm' />}{join.isPending ? 'Joining' : 'Join party'}</Button>
    <Link to='/student/party' className='mt-3 block text-sm text-muted hover:text-foreground'>Go to my party instead</Link>
  </Card.Content></Card></PublicShell>;
}

function State({ icon: Icon, title, description, action }: { icon: typeof AlertCircle; title: string; description: string; action?: ReactNode }) {
  return <div className='text-center'><Icon size={32} className='mx-auto text-muted' /><h1 className='mt-5 text-xl font-semibold'>{title}</h1><p className='mt-2 text-sm text-muted'>{description}</p>{action && <div className='mt-6'>{action}</div>}</div>;
}
