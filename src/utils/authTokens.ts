export const AUTH_TOKEN_CHANGED_EVENT = 'talentbridge:auth-token-changed';

type JwtPayload = {
  exp?: number;
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

export function getJwtExpiryMs(token: string): number | null {
  const [, payload] = token.split('.');
  if (!payload) return null;

  try {
    const normalizedPayload = payload.replace(/-/g, '+').replace(/_/g, '/');
    const paddedPayload = normalizedPayload.padEnd(
      normalizedPayload.length + ((4 - (normalizedPayload.length % 4)) % 4),
      '=',
    );
    const decoded = window.atob(paddedPayload);
    const parsed = JSON.parse(decoded) as JwtPayload;

    return parsed.exp ? parsed.exp * 1000 : null;
  } catch {
    return null;
  }
}
