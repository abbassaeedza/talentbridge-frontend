export const AUTH_TOKEN_CHANGED_EVENT = 'talentbridge:auth-token-changed';

type JwtPayload = {
  exp?: number;
  sub?: string;
  ver?: number;
};

export function notifyAuthTokenChanged() {
  window.dispatchEvent(new Event(AUTH_TOKEN_CHANGED_EVENT));
}

export function setAuthTokens(accessToken: string, refreshToken: string) {
  localStorage.setItem('accessToken', accessToken);
  localStorage.setItem('refreshToken', refreshToken);
  notifyAuthTokenChanged();
}

export function clearAuthTokens() {
  localStorage.removeItem('accessToken');
  localStorage.removeItem('refreshToken');
  notifyAuthTokenChanged();
}

export function getAccessToken() {
  return localStorage.getItem('accessToken');
}

export function getRefreshToken() {
  return localStorage.getItem('refreshToken');
}

function getJwtPayload(token: string): JwtPayload | null {
  const [, payload] = token.split('.');
  if (!payload) return null;

  try {
    const normalizedPayload = payload.replace(/-/g, '+').replace(/_/g, '/');
    const paddedPayload = normalizedPayload.padEnd(
      normalizedPayload.length + ((4 - (normalizedPayload.length % 4)) % 4),
      '=',
    );
    const decoded = window.atob(paddedPayload);
    return JSON.parse(decoded) as JwtPayload;
  } catch {
    return null;
  }
}

export function getJwtExpiryMs(token: string): number | null {
  const expiry = getJwtPayload(token)?.exp;
  return typeof expiry === 'number' && Number.isFinite(expiry) ? expiry * 1000 : null;
}

// Correlation only; the backend remains responsible for signature and permission checks.
export function getJwtSessionKey(token: string | null): string | null {
  const payload = token ? getJwtPayload(token) : null;
  return typeof payload?.sub === 'string' ? `${payload.sub}:${payload.ver ?? 'legacy'}` : null;
}
