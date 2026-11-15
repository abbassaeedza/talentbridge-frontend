import axios from 'axios';

export const SERVER_RETRY_MESSAGE = 'The server is unavailable or still starting. Please retry.';

export function isAuthRejection(error: unknown): boolean {
  return axios.isAxiosError(error) && [400, 401, 403].includes(error.response?.status ?? 0);
}
