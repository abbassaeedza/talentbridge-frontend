import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Clock3, MailPlus, RefreshCw, UserCheck, UserX, X } from 'lucide-react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { projectSupervisorInvitationApi } from '../../api/services';
import type { ProjectSupervisorInvitationStatus } from '../../types';

const STATUS_STYLE: Record<ProjectSupervisorInvitationStatus, string> = {
  PENDING: 'badge-pending',
  ACCEPTED: 'badge-open',
  EXPIRED: 'badge-ember',
  REVOKED: 'bg-ink-700 text-ink-400 border border-ink-600/40',
};

export default function ProjectSupervisorsPage() {
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [email, setEmail] = useState('');
  const { data: invitations = [], isLoading } = useQuery({
    queryKey: ['project-supervisor-invitations'],
    queryFn: () => projectSupervisorInvitationApi.list().then((response) => response.data),
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['project-supervisor-invitations'] });
  const invite = useMutation({
    mutationFn: () => projectSupervisorInvitationApi.create(email.trim()),
    onSuccess: () => {
      toast.success('Invitation sent');
      setEmail('');
      setModalOpen(false);
      refresh();
    },
    onError: (error: any) => toast.error(error?.response?.data?.message || 'Could not send invitation'),
  });
  const resend = useMutation({
    mutationFn: (id: string) => projectSupervisorInvitationApi.resend(id),
    onSuccess: () => { toast.success('Invitation resent'); refresh(); },
    onError: (error: any) => toast.error(error?.response?.data?.message || 'Could not resend invitation'),
  });
  const revoke = useMutation({
    mutationFn: (id: string) => projectSupervisorInvitationApi.revoke(id),
    onSuccess: () => { toast.success('Invitation revoked'); refresh(); },
    onError: (error: any) => toast.error(error?.response?.data?.message || 'Could not revoke invitation'),
  });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (email.trim()) invite.mutate();
  };

  return (
    <div className='animate-fade-up'>
      <div className='page-header flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between'>
        <div>
          <h1 className='page-title'>Project Supervisors</h1>
          <p className='page-subtitle'>Invite colleagues and manage access to your company projects.</p>
        </div>
        <button className='btn-primary self-start' onClick={() => setModalOpen(true)}><MailPlus size={15} /> Invite supervisor</button>
      </div>

      {isLoading ? (
        <div className='grid gap-3'><div className='card h-20 animate-pulse' /><div className='card h-20 animate-pulse' /></div>
      ) : invitations.length === 0 ? (
        <div className='card p-14 text-center'><UserCheck size={32} className='mx-auto mb-3 text-ink-600' /><p className='text-sm text-ink-400'>No project supervisors invited yet.</p></div>
      ) : (
        <div className='grid gap-3'>
          {invitations.map((invitation) => (
            <div key={invitation.id} className='card flex flex-col gap-4 p-4 sm:flex-row sm:items-center'>
              <div className='flex h-10 w-10 items-center justify-center rounded-xl bg-ink-800 text-ink-300'><UserCheck size={18} /></div>
              <div className='min-w-0 flex-1'>
                <p className='truncate text-sm font-semibold text-white'>{invitation.email}</p>
                <p className='mt-1 flex items-center gap-1 text-xs text-ink-500'><Clock3 size={11} /> Expires {format(new Date(invitation.expiresAt), 'dd MMM yyyy, HH:mm')}</p>
              </div>
              <span className={`badge w-fit text-[10px] ${STATUS_STYLE[invitation.status]}`}>{invitation.status}</span>
              {invitation.status === 'PENDING' && (
                <div className='flex gap-2'>
                  <button aria-label={`Resend invitation to ${invitation.email}`} className='btn-secondary px-3 py-2 text-xs' onClick={() => resend.mutate(invitation.id)} disabled={resend.isPending}><RefreshCw size={13} /> Resend</button>
                  <button aria-label={`Revoke invitation to ${invitation.email}`} className='btn-secondary px-3 py-2 text-xs text-red-400' onClick={() => revoke.mutate(invitation.id)} disabled={revoke.isPending}><UserX size={13} /> Revoke</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {modalOpen && (
        <div className='fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-4' role='dialog' aria-modal='true' aria-labelledby='invite-title'>
          <form onSubmit={submit} className='card w-full max-w-md p-6'>
            <div className='mb-5 flex items-start justify-between'>
              <div><h2 id='invite-title' className='font-display text-lg font-bold text-white'>Invite project supervisor</h2><p className='mt-1 text-xs text-ink-400'>They will receive a secure account setup link.</p></div>
              <button type='button' aria-label='Close invitation form' className='text-ink-400 hover:text-white' onClick={() => setModalOpen(false)}><X size={18} /></button>
            </div>
            <label className='input-label' htmlFor='inviteEmail'>Work email</label>
            <input id='inviteEmail' type='email' className='input' required autoFocus value={email} onChange={(event) => setEmail(event.target.value)} placeholder='supervisor@company.com' />
            <div className='mt-5 flex justify-end gap-3'><button type='button' className='btn-secondary' onClick={() => setModalOpen(false)}>Cancel</button><button className='btn-primary' disabled={invite.isPending}>{invite.isPending ? 'Sending...' : 'Send invitation'}</button></div>
          </form>
        </div>
      )}
    </div>
  );
}
