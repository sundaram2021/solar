
# Solar

> An open-source autonomous multi-agent software factory that orchestrates specialized AI agents from GitHub issue intake to tested pull requests.

Solar continuously monitors your GitHub repositories, classifies incoming issues and pull requests, and orchestrates specialized sub-agents (implementation, code review, automated testing) running in isolated sandbox environments. Every run is bound to an explicit intent plan and verified with Armoriq, and a real-time command dashboard keeps you in control of what ships.

---

## Demo 


https://github.com/user-attachments/assets/d462ad6e-9085-4084-bcc5-c77cd187ee62



## ✨ Features

- **Automated GitHub Intake & Event Queue**: Listens to polled events and webhooks for repository issues, pull requests, and review comments with deduplication and tracking.
- **Intelligent Work Classification**: Decomposes incoming tasks into structured work orders, assessing complexity, risk, and required scope.
- **Customized Prompts**: The orchestrator writes a detailed, task-specific prompt for every sub-agent — no generic agents, no canned skills.
- **Isolated Sandbox Execution**: Runs agent workloads inside isolated microVM sandboxes (via Tensorlake or local container runners) with full workspace checkout, terminal execution, and file inspection.
- **Intent Guardrails (Armoriq)**: Binds every run to an approved intent plan (the tools its kind is authorized to use) and verifies each tool call. Out-of-scope actions — like a review agent reaching for `write_file` — stop the run and notify you.
- **Approval Gates & Real-Time Dashboard**: Interactive web console with orchestrator chat, live run logs, traces, an activity feed, and approval controls for every PR, merge, and destructive GitHub action.

---

## 🏗 Architecture

```
                      ┌──────────────────────┐
                      │    GitHub Events     │
                      │  (Issues, PRs, Web)  │
                      └──────────┬───────────┘
                                 │
                                 ▼
                      ┌──────────────────────┐
                      │  Solar Orchestrator  │
                      │  (Classify & Plan)   │
                      └─────┬──────────┬─────┘
                            │          │
            ┌───────────────┘          └───────────────┐
            ▼                                          ▼
┌──────────────────────┐                    ┌──────────────────────┐
│  Customized Prompts  │                    │  Intent Guardrails   │
│   (Per Task)         │                    │     (Armoriq)        │
└──────────────────────┘                    └──────────────────────┘
            │                                          │
            └───────────────────┬──────────────────────┘
                                │
                                ▼
                   ┌────────────────────────┐
                   │ Specialized Sub-Agents │
                   │  - Implementation      │
                   │  - Code Review         │
                   │  - Test Generation     │
                   └───────────┬────────────┘
                               │
                               ▼
                   ┌────────────────────────┐
                   │   Isolated Sandboxes   │
                   │ (Tensorlake microVMs)  │
                   └───────────┬────────────┘
                               │
                               ▼
                   ┌────────────────────────┐
                   │ Intent Verification &  │
                   │   Approval Gates       │
                   └───────────┬────────────┘
                               │
                               ▼
                   ┌────────────────────────┐
                   │ Tested Pull Request /  │
                   │   Human Approval Gate  │
                   └────────────────────────┘
```

---

## 🛠 Tech Stack

- **Framework**: [Next.js 16](https://nextjs.org/) (App Router, React 19)
- **Runtime & Package Manager**: [Bun](https://bun.sh/)
- **Database & Auth**: [Supabase](https://supabase.com/) (PostgreSQL, Realtime, Row Level Security)
- **AI Models**: [Anthropic Claude](https://www.anthropic.com/) (Claude Haiku via the Anthropic SDK)
- **Intent Guardrails**: [Armoriq](https://armoriq.ai/) (in-process intent verification, fail-open on infra)
- **Execution Sandboxes**: [Tensorlake](https://tensorlake.ai/)
- **Styling**: [Tailwind CSS v4](https://tailwindcss.com/) & Lucide Icons

---

## 🚀 Getting Started

### Prerequisites

Ensure you have the following installed on your machine:
- [Bun](https://bun.sh/) (v1.1+ recommended) or [Node.js](https://nodejs.org/) (v20+)
- [Git](https://git-scm.com/)
- A [Supabase](https://supabase.com/) account and project
- An [Anthropic](https://console.anthropic.com/) API Key

### 1. Clone the Repository

```bash
git clone https://github.com/your-username/solar.git
cd solar
```

### 2. Install Dependencies

```bash
bun install
# or
npm install
```

### 3. Configure Environment Variables

Create a `.env.local` file in the project root:

```bash
cp .env.example .env.local
```

Populate the required configuration keys:

```env
# Supabase Configuration
SUPABASE_URL=https://<your-project-id>.supabase.co
SUPABASE_SECRET_KEY=<your-supabase-service-role-key>
NEXT_PUBLIC_SUPABASE_URL=https://<your-project-id>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-supabase-anon-key>

# Anthropic AI
AI_API_KEY=sk-ant-...
AI_MODEL_NAME=claude-haiku-4-5

# Intent Guardrails (Armoriq) — Optional / graceful degradation
ARMORIQ_API_KEY=ak_live_...
ARMORIQ_USER_EMAIL=you@example.com

# Web search (Exa) — Optional
EXA_API_KEY=...

# Sandboxing (Tensorlake)
TENSORLAKE_API_KEY=tl_...
TENSORLAKE_MOCK=false
```

### 4. Database Setup

Apply the SQL migrations located in `supabase/migrations/` using the Supabase CLI or SQL Editor:

```bash
# Via Supabase CLI (if configured)
supabase db push

# Or run the SQL scripts in supabase/migrations/ via the Supabase Dashboard SQL Editor
```

### 5. Run the Development Server

```bash
bun run dev
# or
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser to view the application and visit [http://localhost:3000/dashboard](http://localhost:3000/dashboard) for the agent console.

---

## 📁 Project Structure

```
solar/
├── app/                  # Next.js App Router pages and API routes
│   ├── api/              # Backend endpoints (events, orchestrator, chat, approvals)
│   ├── auth/             # Authentication & OAuth callbacks
│   ├── dashboard/        # Real-time orchestrator & agent dashboard
│   └── page.tsx          # Marketing and overview landing page
├── components/           # Reusable React components
│   ├── chat/             # Interactive thread & message UI
│   ├── common/           # Shared UI primitives and widgets
│   ├── dashboard/        # Sub-agent views, approval dialogs, metric cards
│   └── home/             # Landing page sections
├── lib/                  # Core application logic & orchestrator engine
│   ├── ai.ts             # Anthropic client wrapper & completions
│   ├── env.ts            # Validated server-side environment variables
│   ├── guardrails/       # Armoriq intent verification & per-kind tool allowlists
│   ├── security/         # Secret scanning and log scrubbing
│   ├── orchestrator/     # Task classification, prompt building, agent spawner
│   ├── sandbox/          # Tensorlake microVM runner and mock drivers
│   ├── supabase-*.ts     # Supabase client, server, and service instances
│   └── tools/            # Agent tool registry (GitHub, terminal exec, file I/O)
├── supabase/
│   └── migrations/       # PostgreSQL tables, indexes, and RLS policies
└── types/                # TypeScript type definitions and interfaces
```

---

## 🧪 Testing & Verification

Run tests and verification scripts:

```bash
# Run linting
bun run lint

# Run end-to-end simulation scripts
bun run scripts/real-e2e.ts
bun run scripts/tools-test.ts
```

---

## 🤝 Contributing

Contributions are warmly welcomed! Please follow these steps:

1. Fork the repository.
2. Create your feature branch (`git checkout -b feature/amazing-feature`).
3. Commit your changes (`git commit -m 'Add amazing feature'`).
4. Push to the branch (`git push origin feature/amazing-feature`).
5. Open a Pull Request with a clear description of your changes.

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).
