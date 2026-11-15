import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Clock3, MailPlus, RefreshCw, UserCheck, UserX } from 'lucide-react';
import { formatDateTime } from '../../utils/dateTime';
import toast from 'react-hot-toast';
import { Button } from '@heroui/react/button';
import { Input } from '@heroui/react/input';
import { Label } from '@heroui/react/label';
import { Modal } from '@heroui/react/modal';
import { Skeleton } from '@heroui/react/skeleton';
import { TextField } from '@heroui/react/textfield';
import { projectSupervisorInvitationApi } from '../../api/services';
import { EmptyState, PageHeader, StatusBadge } from '../../components/ui/TalentBridgeUI';

export default function ProjectSupervisorsPage() {
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [email, setEmail] = useState('');
  const { data: invitations = [], isLoading } = useQuery({ queryKey: ['project-supervisor-invitations'], queryFn: () => projectSupervisorInvitationApi.list().then((response) => response.data) });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['project-supervisor-invitations'] });
  const invite = useMutation({ mutationFn: () => projectSupervisorInvitationApi.create(email.trim()), onSuccess: () => { toast.success('Invitation sent'); setEmail(''); setModalOpen(false); refresh(); }, onError: (error: any) => toast.error(error?.response?.data?.message || 'Could not send invitation') });
  const resend = useMutation({ mutationFn: (id: string) => projectSupervisorInvitationApi.resend(id), onSuccess: () => { toast.success('Invitation resent'); refresh(); }, onError: (error: any) => toast.error(error?.response?.data?.message || 'Could not resend invitation') });
  const revoke = useMutation({ mutationFn: (id: string) => projectSupervisorInvitationApi.revoke(id), onSuccess: () => { toast.success('Invitation revoked'); refresh(); }, onError: (error: any) => toast.error(error?.response?.data?.message || 'Could not revoke invitation') });
  const submit = (event: FormEvent) => { event.preventDefault(); if (email.trim()) invite.mutate(); };
  return <div className='max-w-6xl'>
    <PageHeader title='Project supervisors' description='Invite colleagues and manage their access to company projects.' action={<Button variant='primary' onPress={() => setModalOpen(true)}><MailPlus size={16} /> Invite supervisor</Button>} />
    {isLoading ? <div className='space-y-3'>{[0, 1].map((item) => <Skeleton key={item} className='h-20 rounded-lg' />)}</div> : invitations.length === 0 ? <EmptyState icon={UserCheck} title='No project supervisors' description='Invite a colleague when a project needs company-side supervision.' /> : <div className='divide-y divide-separator rounded-lg border border-border bg-surface'>{invitations.map((invitation) => <article key={invitation.id} className='flex flex-col gap-4 p-4 sm:flex-row sm:items-center'>
      <span className='flex size-10 shrink-0 items-center justify-center rounded-md bg-default text-muted'><UserCheck size={18} /></span>
      <div className='min-w-0 flex-1'><p className='truncate text-sm font-medium'>{invitation.email}</p><p className='mt-1 flex items-center gap-1 text-xs text-muted'><Clock3 size={12} /> Expires {formatDateTime(invitation.expiresAt)}</p></div>
      <StatusBadge status={invitation.status} />
      {invitation.status === 'PENDING' && <div className='flex gap-2'><Button size='sm' variant='secondary' aria-label={`Resend invitation to ${invitation.email}`} onPress={() => resend.mutate(invitation.id)} isDisabled={resend.isPending}><RefreshCw size={14} /> Resend</Button><Button size='sm' variant='danger-soft' aria-label={`Revoke invitation to ${invitation.email}`} onPress={() => revoke.mutate(invitation.id)} isDisabled={revoke.isPending}><UserX size={14} /> Revoke</Button></div>}
    </article>)}</div>}
    <Modal isOpen={modalOpen} onOpenChange={setModalOpen}><Modal.Backdrop><Modal.Container><Modal.Dialog className='max-w-md'><form onSubmit={submit}>
      <Modal.Header><Modal.Heading>Invite project supervisor</Modal.Heading></Modal.Header>
      <Modal.Body><p className='mb-4 text-sm text-muted'>The recipient will receive a secure account setup link valid for seven days.</p><TextField fullWidth isRequired><Label>Work email</Label><Input type='email' autoFocus value={email} onChange={(event) => setEmail(event.target.value)} placeholder='supervisor@company.com' /></TextField></Modal.Body>
      <Modal.Footer><Button type='button' variant='ghost' onPress={() => setModalOpen(false)}>Cancel</Button><Button type='submit' variant='primary' isDisabled={invite.isPending || !email.trim()}>{invite.isPending ? 'Sending' : 'Send invitation'}</Button></Modal.Footer>
    </form></Modal.Dialog></Modal.Container></Modal.Backdrop></Modal>
  </div>;
}
