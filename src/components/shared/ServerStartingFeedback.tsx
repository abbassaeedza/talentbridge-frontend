import { useEffect, useState } from 'react';

export default function ServerStartingFeedback({ pending }: { pending: boolean }) {
  const [warming, setWarming] = useState(false);

  useEffect(() => {
    if (!pending) {
      setWarming(false);
      return;
    }
    const timer = window.setTimeout(() => setWarming(true), 5000);
    return () => window.clearTimeout(timer);
  }, [pending]);

  return pending && warming ? (
    <p role='status' aria-live='polite' className='text-sm leading-6 text-muted'>
      The server may be starting. Keep this page open; each request can wait up to 90 seconds.
    </p>
  ) : null;
}
