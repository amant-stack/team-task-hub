# Baki Task — Collaborative Task Management

A professional, full-stack collaborative task management platform designed for high-performance teams. Built with React 19, TanStack Start, and Supabase.

---

## 📋 Project Overview

| Attribute | Details |
| :--- | :--- |
| **Project Name** | Baki Task |
| **Version** | 1.0.0 |
| **License** | MIT |
| **Status** | Production Ready |

## ✨ Key Features

### 🔐 Authentication & Security
- **Supabase Auth**: Secure email/password authentication.
- **Session Management**: JWT-based persistence with auto-refresh.
- **RBAC**: Fine-grained Role-Based Access Control (Admin vs. Member).

### 📁 Project & Task Control
- **Dynamic Projects**: Create, manage, and assign team members to projects.
- **Task Lifecycle**: Track tasks through **To Do**, **In Progress**, and **Done** states.
- **Priority Engine**: Categorize work by High, Medium, and Low priorities.
- **Assignments**: Real-time task assignment to specific team members.

### 📊 Intelligence & Dashboards
- **Global Dashboard**: Comprehensive view of team progress and bottleneck identification.
- **Personalized View**: "My Tasks" page for focused individual workflows.
- **Visual Analytics**: Progress bars and status breakdowns.

---

## 🛠️ Technology Stack

- **Frontend**: [React 19](https://react.dev/), [TypeScript](https://www.typescriptlang.org/)
- **Styling**: [Tailwind CSS 4](https://tailwindcss.com/), [Shadcn UI](https://ui.shadcn.com/)
- **Routing**: [TanStack Router](https://tanstack.com/router)
- **SSR & API**: [TanStack Start](https://tanstack.com/start)
- **Backend**: [Supabase](https://supabase.com/) (PostgreSQL + RLS)
- **State Management**: React Context + TanStack Query hooks

---

## 🚀 Getting Started

### 1. Environment Setup
Ensure you have **Node.js 18+** installed on your system.

```bash
# Clone the repository
git clone <repository-url>

# Navigate to the project directory
cd team-task-hub

# Install dependencies
npm install
```

### 2. Database Configuration
1. Initialize a new project on [Supabase](https://supabase.com/).
2. Execute the migration scripts located in `supabase/migrations/` within the Supabase SQL Editor.
3. Disable "Email Confirmation" in **Authentication > Providers > Email** for development.

### 3. Environment Variables
Create a `.env` file in the root directory and populate it with your Supabase credentials:

```env
SUPABASE_URL=your_supabase_url
SUPABASE_PUBLISHABLE_KEY=your_supabase_anon_key
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_PUBLISHABLE_KEY=your_supabase_anon_key
VITE_SUPABASE_PROJECT_ID=your_project_id
```

### 4. Local Development
Start the development server:

```bash
npm run dev
```
The application will be accessible at `http://localhost:8080`.

---

## 🚢 Deployment

### Railway Deployment (Recommended)
1. Connect your GitHub repository to [Railway](https://railway.app/).
2. Railway will automatically detect the `Dockerfile` and `package.json`.
3. Configure the environment variables (listed above) in the Railway dashboard.
4. Generate a public domain in the networking settings.

---

## 📂 Architecture

```text
team-task-hub/
├── src/
│   ├── components/      # UI & Layout components
│   ├── hooks/           # Business logic hooks
│   ├── integrations/    # Supabase client configuration
│   ├── lib/             # Utilities & Auth provider
│   └── routes/          # File-based routing system
├── supabase/            # Database migrations
└── public/              # Static assets
```

---

## 📄 License
This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
