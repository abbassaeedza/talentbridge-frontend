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
The first Linux run is expected to fail because only macOS baselines are committed.
Download and inspect the CI screenshots before adding reviewed `*-chromium-linux.png` baselines alongside the unchanged `*-chromium-darwin.png` baselines.
Do not copy macOS screenshots into Linux filenames or accept generated screenshots without visual review.

The release coordinator must register `Frontend checks` and enable strict required checks on `main`, including administrators, with zero required human approvals and no force pushes or branch deletion.
Then prove that a failing PR cannot merge.
Add the reviewed Linux baselines through a PR after that proof and protection setup.
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
