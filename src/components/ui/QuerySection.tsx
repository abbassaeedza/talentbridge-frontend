import type { ReactNode } from 'react';
import type { UseQueryResult } from '@tanstack/react-query';
import { Button } from '@heroui/react/button';
import { Skeleton } from '@heroui/react/skeleton';

export default function QuerySection({ query, label, children }: {
  query: Pick<UseQueryResult<unknown>, 'data' | 'isPending' | 'isError' | 'isFetching' | 'refetch'>;
  label: string;
  children: ReactNode;
}) {
  const hasData = query.data !== undefined;
  return (
    <div role='region' aria-label={label} aria-busy={query.isFetching} className='min-w-0'>
      {query.isPending ? (
        <div role='status' className='panel min-h-14 space-y-2 p-3'>
          <p className='text-xs text-muted'>Loading {label.toLowerCase()}...</p>
          <Skeleton className='h-4 w-2/3 rounded-sm' aria-hidden='true' />
        </div>
      ) : (
        <>
          {query.isError && (
            <div className='panel mb-2 flex flex-wrap items-center gap-2 p-3'>
              <p role='alert' className='min-w-0 flex-1 text-sm text-danger'>
                Couldn't {hasData ? 'refresh' : 'load'} {label.toLowerCase()}.{hasData && ' Showing last available data.'}
              </p>
              <Button variant='secondary' className='min-h-11 min-w-11' aria-label={`Retry ${label.toLowerCase()}`} isPending={query.isFetching} onPress={() => { void query.refetch(); }}>Retry</Button>
            </div>
          )}
          {hasData && children}
          {hasData && query.isFetching && <p role='status' className='mt-2 text-xs text-muted'>Updating {label.toLowerCase()}...</p>}
        </>
      )}
    </div>
  );
}
