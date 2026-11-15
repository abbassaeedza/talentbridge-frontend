# Vercel Deployment

This guide deploys the TalentBridge React application from its GitHub repository on Vercel's free Hobby plan.

## Prerequisites

- Backend deployed on Google Cloud Run with a public HTTPS URL
- GitHub OAuth App client ID
- Access to the `abbassaeedza/talentbridge-frontend` repository

## Import the repository

1. Open the Vercel dashboard and select **Add New > Project**.
2. Import `abbassaeedza/talentbridge-frontend`.
3. Keep the detected **Vite** framework preset.
4. Keep the committed build command `npm test && npm run build`.
5. Set the output directory to `dist`.

The committed `vercel.json` sends all browser routes to `index.html`, so React Router routes work after refresh.
`package.json` selects Node.js 24.x for both Vercel builds and local development.

## CI and protected releases

GitHub Actions runs the stable `Frontend checks` job on pull requests targeting `main` and pushes to `main`.
It uses Node.js 24, `npm ci`, every `src/**/*.test.ts` unit test, the production build, and the full Chromium E2E suite with mocked APIs.
The CI API URL is loopback-only; no production backend, credentials, or Vercel token are needed.
Playwright uses two workers, no retries, rejects focused tests on CI, and starts its own development server on CI.

Failed runs retain `test-results/`, `playwright-report/`, and any generated Linux snapshot PNGs for seven days in the `frontend-playwright-failure` artifact.
These contain synthetic fixtures only, including actual screenshots and any generated expected screenshots when Linux baselines are missing.
The initial Linux run 43718616847 at commit 625e116 failed with 55 passing tests and eight missing baselines, as expected when only macOS baselines were committed.
All eight generated Linux screenshots from artifact 14163686971 were visually reviewed and are now committed as `*-chromium-linux.png` baselines alongside the unchanged `*-chromium-darwin.png` baselines.
CI is pinned to Ubuntu 26.04 to match the reviewed baseline runner image confirmed in that run's primary job logs.
Do not copy macOS screenshots into Linux filenames or accept generated screenshots without visual review.

The release coordinator must register `Frontend checks` and enable strict required checks on `main`, including administrators, with zero required human approvals and no force pushes or branch deletion.
Then prove that a failing PR cannot merge.
PR #3 was verified as blocked by the failing checks with `main` unchanged at 5d60 before these reviewed Linux baselines were added.
Workflow files do not configure branch protection themselves.

Keep Vercel's native GitHub deployments enabled.
Required PR checks gate merging; Vercel does not wait for post-merge GitHub Actions.
The committed `buildCommand` independently runs unit tests before building each Vercel deployment, but does not run E2E there.

## Environment variables

Add these variables for the Production environment:

```text
VITE_API_URL=https://talentbridge-backend-5665rby4oa-el.a.run.app
VITE_GITHUB_CLIENT_ID=your-github-oauth-client-id
```

Do not add the GitHub client secret, Supabase key, JWT secret, database password, or OpenAI key to Vercel.
Every `VITE_` value becomes public browser code.
Do not add account passwords, including demo account passwords, to Vercel environment variables.
All accounts use the normal email and password form, which calls `POST /api/auth/login`.
Backend credentials are pinned Google Secret Manager references and never belong in Vercel configuration.
JWT signing-key rotations require a new sign-in; they do not change the demo password.

## GitHub OAuth App

Open GitHub **Settings > Developer settings > OAuth Apps** and create or update the TalentBridge application.

```text
Homepage URL: https://your-vercel-project.vercel.app
Authorization callback URL: https://your-vercel-project.vercel.app/github/callback
```

Use the same callback URL for the Cloud Run `GITHUB_REDIRECT_URI` variable.

## Deploy

Deploy the project after adding variables.
Vercel redeploys Production whenever `main` changes.
Changing a Vercel environment variable requires a new deployment before browser code sees it.

## Verify

1. Open `/login` directly and refresh the page.
2. Register or sign in.
3. Confirm API requests target the Cloud Run URL and do not show CORS errors.
4. Sign in with operator-provided coordinator credentials and confirm the coordinator dashboard opens.
5. Sign in as a student and connect GitHub.
6. Confirm GitHub returns to `/github/callback` and the student dashboard shows the linked username.

## Before public launch

1. Confirm `/login` has no password-free demo shortcut and requires an email address and password.
2. Confirm unauthenticated requests to protected API routes are rejected by the backend.
3. Confirm no account credentials are embedded in the frontend build or environment variables.

## Free-tier limits

Vercel hosting remains free within Hobby limits.
The Cloud Run backend scales to zero and may take time to answer its first request after idle.
Custom domains are optional and domain registration is not included.

## Cold-start and session recovery

The shared API client allows 90 seconds per request, including the single shared refresh operation.
This is not a guarantee about total startup or sign-in time: sign-in and identity loading are separate requests.
Sign-in, identity bootstrap, and manual session renewal show server-starting feedback after five seconds.
The normal screens and their screenshot baselines are unchanged outside these feedback states.

Network errors, timeouts, and server failures preserve stored credentials and the current user and query cache.
If initial identity loading fails, the route stays behind a retry screen instead of redirecting to sign-in or claiming an account state.
Retry repeats only `GET /api/users/me`, not the credential submission.
An unavailable manual renewal permits another attempt while access remains valid; the actual access expiry still signs out.
Definitive authentication rejection, revoked credentials, suspension, explicit sign-out, and session expiry still invalidate the session.
Generation, session-key, token, and cache guards prevent old requests or timers from changing a replacement session.

Only GET and HEAD requests can replay once after a 401 and successful session renewal.
POST, PUT, PATCH, and DELETE requests never replay automatically, including on network errors, timeouts, or 5xx responses.
A write rejected with 401 can renew the session, but rejects the original action with “Session renewed. Please submit again.”
The user must explicitly submit the action again.
TanStack mutations explicitly disable retries; query retries remain unchanged.

The mocked `e2e/cold-start.spec.ts` suite covers delayed startup, identity retry, offline and timeout recovery, duplicate submissions, session expiry, and write non-replay.
Its real 35-second login test alone uses a 90-second test timeout; the suite default stays at 15 seconds.
Screenshots use Playwright per-test output paths so CI artifacts work on both macOS and Linux.
