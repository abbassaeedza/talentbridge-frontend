# Vercel Deployment

This guide deploys the TalentBridge React application from its GitHub repository on Vercel's free Hobby plan.

## Prerequisites

- Backend deployed on Render with a public `https://...onrender.com` URL
- GitHub OAuth App client ID
- Access to the `abbassaeedza/talentbridge-frontend` repository

## Import the repository

1. Open the Vercel dashboard and select **Add New > Project**.
2. Import `abbassaeedza/talentbridge-frontend`.
3. Keep the detected **Vite** framework preset.
4. Set the build command to `npm run build`.
5. Set the output directory to `dist`.

The committed `vercel.json` sends all browser routes to `index.html`, so React Router routes work after refresh.

## Environment variables

Add these variables for the Production environment:

```text
VITE_API_URL=https://your-render-service.onrender.com
VITE_GITHUB_CLIENT_ID=your-github-oauth-client-id
```

Do not add the GitHub client secret, Supabase key, JWT secret, database password, or OpenAI key to Vercel.
Every `VITE_` value becomes public browser code.

## GitHub OAuth App

Open GitHub **Settings > Developer settings > OAuth Apps** and create or update the TalentBridge application.

```text
Homepage URL: https://your-vercel-project.vercel.app
Authorization callback URL: https://your-vercel-project.vercel.app/github/callback
```

Use the same callback URL for the Render `GITHUB_REDIRECT_URI` variable.

## Deploy

Deploy the project after adding variables.
Vercel redeploys Production whenever `main` changes.
Changing a Vercel environment variable requires a new deployment before browser code sees it.

## Verify

1. Open `/login` directly and refresh the page.
2. Register or sign in.
3. Confirm API requests target the Render URL and do not show CORS errors.
4. Sign in as a student and connect GitHub.
5. Confirm GitHub returns to `/github/callback` and the student dashboard shows the linked username.

## Free-tier limits

Vercel hosting remains free within Hobby limits.
Render can take about one minute to answer its first request after sleeping.
Custom domains are optional and domain registration is not included.
