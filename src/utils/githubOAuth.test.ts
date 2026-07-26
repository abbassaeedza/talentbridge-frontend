import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createGitHubOAuthRequest,
  isGitHubOAuthStateValid,
} from './githubOAuth.ts';

test('creates a GitHub authorization request with callback and CSRF state', () => {
  const request = createGitHubOAuthRequest(
    'client-id',
    'https://talentbridge.vercel.app/github/callback',
    'fixed-state',
  );
  const url = new URL(request.url);

  assert.equal(url.origin + url.pathname, 'https://github.com/login/oauth/authorize');
  assert.equal(url.searchParams.get('client_id'), 'client-id');
  assert.equal(url.searchParams.get('redirect_uri'), 'https://talentbridge.vercel.app/github/callback');
  assert.equal(url.searchParams.get('scope'), 'repo read:user');
  assert.equal(url.searchParams.get('state'), 'fixed-state');
  assert.equal(request.state, 'fixed-state');
});

test('rejects missing or mismatched GitHub OAuth state', () => {
  assert.equal(isGitHubOAuthStateValid('expected', 'expected'), true);
  assert.equal(isGitHubOAuthStateValid('expected', 'different'), false);
  assert.equal(isGitHubOAuthStateValid(null, 'expected'), false);
  assert.equal(isGitHubOAuthStateValid('expected', null), false);
});
