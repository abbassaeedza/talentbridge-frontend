# TalentBridge Frontend

React + Vite + TypeScript frontend for TalentBridge — an AI-powered platform connecting university student teams with industry projects.

## Tech Stack

| Concern | Technology |
|---|---|
| Framework | React 18 + TypeScript |
| Build tool | Vite 5 |
| Routing | React Router v6 |
| Data fetching | TanStack Query v5 |
| Forms | React Hook Form + Zod |
| Styling | Tailwind CSS |
| Animation | Framer Motion |
| Markdown | react-markdown |
| Icons | Lucide React |
| HTTP client | Axios |
| Toasts | react-hot-toast |
| Fonts | Sora (display) + DM Sans (body) |

## Quick Start

```bash
# Install dependencies
npm install

# Copy env and fill in values
cp .env.example .env

# Start dev server
npm run dev
```

Runs on **http://localhost:3000** and proxies `/api` to `http://localhost:8080`.

---

## Environment Variables

| Variable | Description |
|---|---|
| `VITE_API_URL` | Backend URL (default: `http://localhost:8080`) |
| `VITE_GITHUB_CLIENT_ID` | GitHub OAuth App client ID |

---

## Pages by Role

### Student
| Path | Description |
|---|---|
| `/student/dashboard` | Overview: stats, party status, open projects |
| `/student/projects` | Browse + search open projects |
| `/student/projects/:id` | Project detail + apply form (rank 1–5) |
| `/student/party` | Create/join/manage party + view applications |
| `/student/submission` | Draft/final submit GitHub repo + documents |
| `/student/scorecard` | Evaluation scores across all projects |

### Company
| Path | Description |
|---|---|
| `/company/dashboard` | Projects overview with status |
| `/company/projects/new` | Post a new project (AI-assisted) |

### Coordinator
| Path | Description |
|---|---|
| `/coordinator/dashboard` | High-level stats |
| `/coordinator/users` | Approve/reject pending registrations |
| `/coordinator/projects` | Approve projects, set deadlines |
| `/coordinator/parties` | Assign projects & supervisors |
| `/coordinator/evaluations` | Trigger AI eval, view/finalize reports |

### Supervisor
| Path | Description |
|---|---|
| `/supervisor/dashboard` | Supervised parties + submission status |

---

## Design System

**Colors**
- `ink-*` — deep navy/midnight blue (backgrounds, surfaces)
- `ember-*` — orange accent (CTAs, highlights)
- `jade-*` — green (success, active states)

**Typography**
- Display: **Sora** (headings, numbers)
- Body: **DM Sans** (all text)
- Mono: **JetBrains Mono** (code, IDs)

**Components (global CSS)**
- `.card` `.card-glass` — surface containers
- `.btn-primary` `.btn-secondary` `.btn-ghost` `.btn-danger` — buttons
- `.input` `.textarea` `.input-label` — form elements
- `.badge-*` — status indicators
- `.nav-link` `.nav-link-active` — sidebar navigation

---

## AI Features

- **ChatBot** (bottom-right): Floating AI assistant, context-aware for company project creation vs. student project Q&A. Powered by GPT-4o-mini.
- **Evaluation**: Coordinator-triggered; GPT-4o analyses GitHub repo against project scope, scores 5 dimensions, per-student scoring based on commit distribution.
