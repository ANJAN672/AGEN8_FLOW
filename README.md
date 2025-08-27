# AGEN8

🚀 **Advanced Visual AI Workflow Builder** with autonomous copilot and drag-and-drop blocks.

## ✨ Features

- **🤖 AI-Powered Copilot**: Autonomous workflow creation
- **🎨 Modern UI/UX**: Polished UI with tooltips and responsive layouts
- **🔧 Dynamic Blocks**: Real-time configuration
- **⚡ Real-time Execution**: Live status tracking
- **💾 Auto-save**: localStorage persistence
- **🌙 Dark/Light Mode**

## Prerequisites

- **Node.js**: v18+ recommended
- **npm**: v9+

## 1) Clone and install

```bash
# Clone the repository
git clone <YOUR_GIT_URL>
cd AGEN8

# Install frontend deps
npm install

# Install backend deps
npm install --prefix server
```

## 2) Configure environment (optional)

Create `.env.local` in the project root if you need to override defaults:

```env
# Frontend API base (defaults to /api which proxies to :3001 in dev)
VITE_API_BASE_URL=/api
```

Note: Vite dev server proxies `/api` to `http://localhost:3001` (see `vite.config.ts`).

## 3) Run locally

Just start the frontend (no Node backend required):

```bash
npm run dev
```

Open http://localhost:8080

## 🤖 AI Copilot (optional)

Copilot features may require additional API keys. Configure as needed in `.env.local`.

## Integrations behavior

- Integrations (Airtable, GitHub, Notion, Slack, etc.) run in mock mode by default for a smooth UX.
- To perform real API calls, toggle off "Skip Live Check" and provide valid credentials and required IDs.
- Common defaults are pre-configured; mock responses will populate node outputs so workflows run without errors.

## Tech Stack

- Vite, TypeScript, React
- shadcn-ui, Tailwind CSS
- Express (backend), zod

## Troubleshooting

- If API requests fail in dev, ensure the backend is running on port 3001.
- If port 8080 is busy, change it in `vite.config.ts` or stop the conflicting process.
