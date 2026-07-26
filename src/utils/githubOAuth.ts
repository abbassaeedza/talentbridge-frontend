export function createGitHubOAuthRequest(
  clientId: string,
  redirectUri: string,
  state: string = crypto.randomUUID(),
) {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: 'repo read:user',
    state,
  });
  return {
    state,
    url: `https://github.com/login/oauth/authorize?${params}`,
  };
}

export function isGitHubOAuthStateValid(expected: string | null, actual: string | null) {
  return !!expected && !!actual && expected === actual;
}
