import { useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { userApi } from '../api/services';

export default function useUserStatusMutation(queryKeys: string[][], label: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, suspended }: { id: string; suspended: boolean }) =>
      suspended ? userApi.suspend(id) : userApi.unsuspend(id),
    onSuccess: (_, { suspended }) => {
      toast.success(`${label} ${suspended ? 'suspended' : 'unsuspended'}`);
      queryKeys.forEach((queryKey) => queryClient.invalidateQueries({ queryKey }));
    },
    onError: (error: any, { suspended }) =>
      toast.error(error?.response?.data?.message || `Failed to ${suspended ? 'suspend' : 'unsuspend'}`),
  });
}
