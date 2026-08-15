import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, Mail } from 'lucide-react';
import toast from 'react-hot-toast';
import { useState } from 'react';
import { Skeleton } from '@heroui/react/skeleton';
import { Switch } from '@heroui/react/switch';
import { userApi } from '../../api/services';
import { PageHeader } from '../../components/ui/TalentBridgeUI';
import type { NotificationType } from '../../types';

const TYPES: NotificationType[] = [
  'ACCOUNT_APPROVED', 'ACCOUNT_REJECTED', 'PARTY_JOINED', 'PARTY_LEFT', 'PROJECT_ASSIGNED', 'PROJECT_REJECTED',
  'APPLICATION_SUBMITTED', 'SUBMISSION_RECEIVED', 'EVALUATION_COMPLETE', 'DEADLINE_REMINDER', 'NEW_PROJECT_POSTED', 'GENERAL',
];
const label = (type: NotificationType) => type.toLowerCase().replace(/_/g, ' ').replace(/^\w/, (letter) => letter.toUpperCase());

export default function NotificationSettingsPage() {
  const queryClient = useQueryClient();
  const [overrides, setOverrides] = useState<Partial<Record<NotificationType, boolean>>>({});
  const query = useQuery({ queryKey: ['notification-preferences'], queryFn: () => userApi.getNotificationPreferences().then((response) => response.data) });
  const mutation = useMutation({
    mutationFn: ({ type, emailEnabled }: { type: NotificationType; emailEnabled: boolean }) => userApi.updateNotificationPreference(type, emailEnabled),
    onSuccess: (response) => {
      queryClient.setQueryData(['notification-preferences'], (current: typeof query.data) => (current ?? []).map((item) => item.type === response.data.type ? response.data : item));
      setOverrides((current) => { const next = { ...current }; delete next[response.data.type]; return next; });
      toast.success('Email preference updated');
    },
    onError: (_error, variables) => {
      setOverrides((current) => { const next = { ...current }; delete next[variables.type]; return next; });
      toast.error('Could not update email preference');
    },
  });
  const preferences = new Map((query.data ?? []).map((item) => [item.type, item.emailEnabled]));

  return (
    <div className='max-w-3xl'>
      <PageHeader title='Notification settings' description='Choose which in-app updates are also delivered by email.' />
      <div className='mb-6 flex items-start gap-3 rounded-lg border border-border bg-surface-secondary p-4'>
        <Bell size={18} className='mt-0.5 shrink-0 text-muted' />
        <p className='text-sm leading-6 text-muted'>In-app notifications always stay enabled. These controls affect email delivery only.</p>
      </div>
      <section className='divide-y divide-separator rounded-lg border border-border bg-surface'>
        {query.isLoading ? Array.from({ length: 6 }, (_, index) => <Skeleton key={index} className='m-4 h-12 rounded-md' />) : TYPES.map((type) => {
          const enabled = overrides[type] ?? preferences.get(type) ?? true;
          return (
            <div key={type} className='flex min-h-16 items-center gap-4 px-4 py-3 sm:px-5'>
              <div className='flex size-9 shrink-0 items-center justify-center rounded-md bg-default text-muted'><Mail size={16} /></div>
              <div className='min-w-0 flex-1'>
                <p className='text-sm font-medium'>{label(type)}</p>
                <p className='mt-0.5 text-xs text-muted'>Send this update to my account email.</p>
              </div>
              <Switch
                aria-label={`${label(type)} email`}
                isSelected={enabled}
                isDisabled={mutation.isPending && mutation.variables?.type === type}
                onChange={(emailEnabled) => {
                  setOverrides((current) => ({ ...current, [type]: emailEnabled }));
                  mutation.mutate({ type, emailEnabled });
                }}
              >
                <Switch.Content>
                  <Switch.Control><Switch.Thumb /></Switch.Control>
                </Switch.Content>
              </Switch>
            </div>
          );
        })}
      </section>
    </div>
  );
}
