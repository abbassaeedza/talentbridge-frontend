import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, Mail } from 'lucide-react';
import toast from 'react-hot-toast';
import { useState } from 'react';
import { userApi } from '../../api/services';
import type { NotificationType } from '../../types';

const TYPES: NotificationType[] = [
  'ACCOUNT_APPROVED',
  'ACCOUNT_REJECTED',
  'PARTY_JOINED',
  'PARTY_LEFT',
  'PROJECT_ASSIGNED',
  'PROJECT_REJECTED',
  'APPLICATION_SUBMITTED',
  'SUBMISSION_RECEIVED',
  'EVALUATION_COMPLETE',
  'DEADLINE_REMINDER',
  'NEW_PROJECT_POSTED',
  'GENERAL',
];

const label = (type: NotificationType) => type
  .toLowerCase()
  .replace(/_/g, ' ')
  .replace(/\b\w/g, (letter) => letter.toUpperCase());

export default function NotificationSettingsPage() {
  const queryClient = useQueryClient();
  const [overrides, setOverrides] = useState<Partial<Record<NotificationType, boolean>>>({});
  const query = useQuery({
    queryKey: ['notification-preferences'],
    queryFn: () => userApi.getNotificationPreferences().then((response) => response.data),
  });
  const mutation = useMutation({
    mutationFn: ({ type, emailEnabled }: { type: NotificationType; emailEnabled: boolean }) =>
      userApi.updateNotificationPreference(type, emailEnabled),
    onSuccess: (response) => {
      queryClient.setQueryData(['notification-preferences'], (current: typeof query.data) =>
        (current ?? []).map((preference) => preference.type === response.data.type ? response.data : preference));
      setOverrides((current) => {
        const next = { ...current };
        delete next[response.data.type];
        return next;
      });
      toast.success('Email preference updated');
    },
    onError: (_error, variables) => {
      setOverrides((current) => {
        const next = { ...current };
        delete next[variables.type];
        return next;
      });
      toast.error('Could not update email preference');
    },
  });
  const preferences = new Map((query.data ?? []).map((preference) => [preference.type, preference.emailEnabled]));

  return (
    <div className='animate-fade-up'>
      <div className='page-header'>
        <h1 className='page-title'>Notification Settings</h1>
        <p className='page-subtitle'>Choose which TalentBridge updates are also sent by email.</p>
      </div>

      <div className='mb-5 flex items-start gap-3 rounded-2xl border border-ink-700/50 bg-ink-900/70 p-4'>
        <Bell size={18} className='mt-0.5 flex-shrink-0 text-ember-400' />
        <p className='text-sm leading-relaxed text-ink-300'>In-app notifications always remain enabled. These switches control email delivery only.</p>
      </div>

      <div className='card overflow-hidden'>
        {query.isLoading ? (
          <div className='p-12 text-center text-sm text-ink-400'>Loading preferences...</div>
        ) : (
          <div className='divide-y divide-ink-800/60'>
            {TYPES.map((type) => {
              const enabled = overrides[type] ?? preferences.get(type) ?? true;
              return (
                <div key={type} className='flex items-center gap-4 px-5 py-4'>
                  <div className='flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-ink-800 text-ink-400'><Mail size={16} /></div>
                  <div className='min-w-0 flex-1'>
                    <p className='text-sm font-medium text-white'>{label(type)}</p>
                    <p className='mt-0.5 text-xs text-ink-500'>Send this notification to my account email.</p>
                  </div>
                  <label className='relative block h-6 w-11 cursor-pointer'>
                    <span className='sr-only'>{label(type)} email</span>
                    <input
                      type='checkbox'
                      role='switch'
                      aria-label={`${label(type)} email`}
                      checked={enabled}
                      disabled={mutation.isPending && mutation.variables?.type === type}
                      onChange={(event) => {
                        const emailEnabled = event.target.checked;
                        setOverrides((current) => ({ ...current, [type]: emailEnabled }));
                        mutation.mutate({ type, emailEnabled });
                      }}
                      className='peer absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0'
                    />
                    <span className='relative block h-6 w-11 rounded-full bg-ink-700 transition peer-checked:bg-ember-500 peer-disabled:opacity-50 after:absolute after:left-1 after:top-1 after:h-4 after:w-4 after:rounded-full after:bg-white after:transition peer-checked:after:translate-x-5' />
                  </label>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
