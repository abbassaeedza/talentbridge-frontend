import type { ChatContextSnapshot } from '../types/index.ts';

export const CHAT_CONTEXT_TTL = 30_000;

export function createChatContextCache(clock = Date.now) {
  let owner = '';
  let epoch = 0;
  let cached: { value: ChatContextSnapshot; expires: number } | undefined;
  let pending: Promise<ChatContextSnapshot> | undefined;
  const clear = () => { epoch += 1; cached = undefined; pending = undefined; };
  return {
    clear,
    setOwner(next: string) { if (owner !== next) { clear(); owner = next; } },
    async get(key: string, load: () => Promise<ChatContextSnapshot>): Promise<ChatContextSnapshot> {
      if (!key || key !== owner) throw new Error('Chat session changed');
      if (cached && clock() < cached.expires) return cached.value;
      if (pending) return pending;
      const generation = epoch;
      const request = load().then(value => {
        if (generation !== epoch || key !== owner) throw new Error('Chat context invalidated');
        const timestamp = typeof value?.snapshotTimeUTC === 'string' && value.snapshotTimeUTC.endsWith('Z')
          ? Date.parse(value.snapshotTimeUTC) : NaN;
        const received = clock();
        const expires = Math.min(received, timestamp) + CHAT_CONTEXT_TTL;
        if (!Number.isFinite(timestamp) || timestamp > received || received >= expires) throw new Error('Chat context expired');
        cached = { value, expires };
        return value;
      }).finally(() => { if (pending === request) pending = undefined; });
      pending = request;
      return request;
    },
  };
}

export const chatContextCache = createChatContextCache();

export function isChatContextWrite(method: string | undefined, url: string | undefined): boolean {
  if (!['post', 'put', 'patch', 'delete'].includes(method?.toLowerCase() ?? '')) return false;
  const path = (url ?? '').split('?')[0];
  if (path === '/api/projects/global-deadline/preview') return false;
  if (/^\/api\/users\/(notifications|notification-preferences)(\/|$)/.test(path)) return false;
  return /^\/api\/(projects|parties|submissions|evaluations|users)(\/|$)/.test(path)
    || /^\/api\/company\/project-supervisor-invitations(\/|$)/.test(path);
}
