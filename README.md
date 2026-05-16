# Baki Task — Team Task Management App

A full-stack collaborative task management web application where teams can create projects, assign tasks, and track progress in real-time. Built with modern web technologies and deployed for production use.

![TypeScript](https://img.shields.io/badge/TypeScript-5.8-blue)
![React](https://img.shields.io/badge/React-19-61dafb)
![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-3ecf8e)
![TailwindCSS](https://img.shields.io/badge/TailwindCSS-4-38bdf8)

---

## Features

### Authentication
- Secure email/password signup and login via Supabase Auth
- JWT-based session management with auto-refresh
- Profile auto-creation on signup

### Project Management
- Create projects (creator automatically becomes Admin)
- Admin can add/remove team members by email
- Members can view all assigned projects
- Delete projects (admin only)

### Task Management
- Create tasks with Title, Description, Due Date, and Priority (Low/Medium/High)
- Assign tasks to any project member
- Update status: **To Do → In Progress → Done**
- Edit all task fields (admin) or update status (member)
- Delete tasks (admin only)
- Visual overdue indicators

### Dashboard
- Total tasks overview
- Tasks by status breakdown (To Do / In Progress / Done)
- Tasks assigned to current user
- Overdue task count
- **Tasks per team member** table with progress bars
- Project cards with completion progress

### My Tasks
- Dedicated page showing all tasks assigned to current user across all projects
- Grouped by project
- Filter by status
- Inline status updates

### Role-Based Access Control
| Action | Admin | Member |
|--------|-------|--------|
| Create/delete projects | ✅ | ❌ |
| Add/remove members | ✅ | ❌ |
| Create/delete tasks | ✅ | ❌ |
| Edit all task fields | ✅ | ❌ |
| Update assigned task status | ✅ | ✅ |
| View project tasks | ✅ | ✅ |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, TypeScript, TailwindCSS 4 |
| Routing | TanStack Router + TanStack Start (SSR) |
| Backend/API | Supabase (PostgreSQL + Row Level Security) |
| Auth | Supabase Auth (JWT, email/password) |
| UI Components | Radix UI + shadcn/ui |
| Styling | TailwindCSS 4 + CSS custom properties |
| Build Tool | Vite 7 |
| Deployment | Railway / Cloudflare Workers |

---

## Database Schema

```
┌─────────────┐     ┌──────────────────┐     ┌──────────────┐
│  profiles    │     │ project_members  │     │   projects   │
├─────────────┤     ├──────────────────┤     ├──────────────┤
│ id (PK/FK)  │◄────│ user_id (FK)     │────►│ id (PK)      │
│ name        │     │ project_id (FK)  │     │ name         │
│ email       │     │ role (enum)      │     │ description  │
│ created_at  │     │ created_at       │     │ created_by   │
└─────────────┘     └──────────────────┘     │ created_at   │
                                              └──────┬───────┘
                                                     │
                                              ┌──────┴───────┐
                                              │    tasks     │
                                              ├──────────────┤
                                              │ id (PK)      │
                                              │ project_id   │
                                              │ title        │
                                              │ description  │
                                              │ due_date     │
                                              │ priority     │
                                              │ status       │
                                              │ assignee_id  │
                                              │ created_by   │
                                              │ created_at   │
                                              │ updated_at   │
                                              └──────────────┘
```

**Enums:** `project_role` (admin, member) · `task_status` (todo, in_progress, done) · `task_priority` (low, medium, high)

**Row Level Security (RLS):** All tables enforce RLS policies — users can only access projects they belong to, and task modifications are restricted by role.

---

## Getting Started

### Prerequisites
- Node.js 18+ and npm
- A [Supabase](https://supabase.com) account (free tier works)

### 1. Clone the Repository

```bash
git clone <repository-url>
cd team-task-hub
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Set Up Supabase

1. Create a new project at [supabase.com/dashboard](https://supabase.com/dashboard)
2. Go to **SQL Editor** and run the migration files from `supabase/migrations/` in order
3. Go to **Authentication → Providers → Email** and toggle off **"Confirm email"** for development
4. Copy your project credentials from **Settings → API**

### 4. Configure Environment Variables

Create a `.env` file in the project root:

```env
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_PUBLISHABLE_KEY=your-anon-key
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-anon-key
VITE_SUPABASE_PROJECT_ID=your-project-id
```

### 5. Run the Development Server

```bash
npm run dev
```

The app will be available at `http://localhost:8080`

---

## Deployment (Railway)

### 1. Push to GitHub

```bash
git add .
git commit -m "Initial commit"
git push origin main
```

### 2. Deploy on Railway

1. Go to [railway.app](https://railway.app) and create a new project
2. Select **"Deploy from GitHub repo"** and connect your repository
3. Railway will automatically build the project using the included `Dockerfile` and `package.json` configurations (Node 22 is required and pre-configured).
4. Add these environment variables in the Railway dashboard:
   - `SUPABASE_URL`
   - `SUPABASE_PUBLISHABLE_KEY`
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_PUBLISHABLE_KEY`
   - `VITE_SUPABASE_PROJECT_ID`
5. Generate a public domain in the Networking settings. Railway will auto-deploy and provide your live URL.

### 3. Verify Deployment

- Visit the public URL
- Sign up a new account
- Create a project, add tasks, and verify all features work

---

## Project Structure

```
team-task-hub/
├── src/
│   ├── components/ui/       # Reusable UI components (shadcn/ui)
│   ├── hooks/               # Custom React hooks
│   ├── integrations/supabase/  # Supabase client & types
│   ├── lib/                 # Auth provider, utilities
│   ├── routes/
│   │   ├── __root.tsx       # Root layout with providers
│   │   ├── index.tsx        # Landing redirect
│   │   ├── auth.tsx         # Login / Signup page
│   │   ├── _authenticated.tsx  # Auth guard layout + nav
│   │   └── _authenticated/
│   │       ├── dashboard.tsx         # Dashboard with stats
│   │       ├── my-tasks.tsx          # My Tasks page
│   │       └── projects.$projectId.tsx  # Project detail + tasks
│   ├── server.ts            # SSR server entry
│   └── styles.css           # Design system (Tailwind + CSS vars)
├── supabase/migrations/     # Database schema SQL files
├── .env                     # Environment variables
├── package.json
├── vite.config.ts
└── README.md
```

---

## License

MIT
