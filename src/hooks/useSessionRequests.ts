import { useEffect, useRef, useState } from 'react';
import { AUTH_TOKEN_CHANGED_EVENT, getAccessToken, getJwtSessionKey } from '../utils/authTokens';

export function useSessionRequests() {
  const [owner] = useState(() => getJwtSessionKey(getAccessToken()));
  const controller = useRef(new AbortController());
  const mounted = useRef(false);
  const current = () => mounted.current && !!owner && owner === getJwtSessionKey(getAccessToken()) && !controller.current.signal.aborted;

  useEffect(() => {
    controller.current = new AbortController();
    mounted.current = true;
    const changed = () => {
      if (owner !== getJwtSessionKey(getAccessToken())) controller.current.abort();
    };
    window.addEventListener(AUTH_TOKEN_CHANGED_EVENT, changed);
    window.addEventListener('storage', changed);
    return () => {
      mounted.current = false;
      controller.current.abort();
      window.removeEventListener(AUTH_TOKEN_CHANGED_EVENT, changed);
      window.removeEventListener('storage', changed);
    };
  }, [owner]);

  return { owner, current, options: () => ({ ownerSession: owner ?? '', signal: controller.current.signal }) };
}
