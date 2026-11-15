# TalentBridge Frontend

TalentBridge is an AI-assisted platform connecting university student teams with industry projects.
This repository contains its React single-page application.

## Features

- Role-specific experiences for students, companies, coordinators, and supervisors
- Project discovery, applications, team management, submissions, and scorecards
- Coordinator workflows for user approval, project management, assignments, and evaluations
- GitHub account integration and AI-assisted project evaluation
- Responsive interface built with a shared Tailwind CSS design system
- Credential-based sign-in for all accounts, including demo accounts

## Technology

- React 18 and TypeScript
- Vite 5
- React Router 6
- TanStack Query 5
- Axios
- Tailwind CSS
- Recharts
- Lucide React

## Requirements

- Node.js 24.x
- npm
- A running TalentBridge backend

## Local development

```bash
cp .env.example .env
npm ci
npm run dev
```

The development server runs at `http://localhost:3000`.
Vite proxies local `/api` requests to `http://localhost:8080`.

## Environment variables

| Variable | Required | Description |
| --- | --- | --- |
| `VITE_API_URL` | Yes | Public base URL of the TalentBridge backend |
| `VITE_GITHUB_CLIENT_ID` | For GitHub OAuth | Client ID of the GitHub OAuth App |

Only variables prefixed with `VITE_` are exposed to browser code.
Never place private keys or client secrets in frontend environment variables.
All accounts sign in with an email address and password through `POST /api/auth/login`.
Demo account passwords are configured by the backend operator and must not be embedded in the frontend.

## Commands

```bash
npm run dev      # Start development server
npm run build    # Type-check and create production build
npm test         # Run all src/**/*.test.ts unit tests
npm run test:e2e # Run the Chromium end-to-end suite
npm run preview  # Preview production build locally
```

Production files are written to `dist/`.
Login tests intercept API requests and use synthetic `example.test` credentials, not production accounts or backend seed passwords.
CI runs unit tests, the build, and the complete mocked Chromium suite on PRs and pushes to `main` as `Frontend checks`.
See [CI and protected releases](docs/DEPLOYMENT.md#ci-and-protected-releases) for failure artifacts and the pending reviewed Linux screenshot baselines.

## Deployment

See [Vercel deployment](docs/DEPLOYMENT.md) for production variables, SPA routing, GitHub OAuth, and verification.

## Main routes

| Area | Routes |
| --- | --- |
| Authentication | `/login`, `/register`, `/pending`, `/onboarding` |
| Student | `/student/dashboard`, `/student/projects`, `/student/party`, `/student/submission`, `/student/scorecard` |
| Company | `/company/dashboard`, `/company/projects` |
| Coordinator | `/coordinator/dashboard`, `/coordinator/users`, `/coordinator/projects`, `/coordinator/parties`, `/coordinator/evaluations` |
| Supervisor | `/supervisor/dashboard` |

## Backend

Backend source lives in the separate [`talentbridge-backend`](https://github.com/abbassaeedza/talentbridge-backend) repository.

## License

Licensed under the [MIT License](LICENSE).
