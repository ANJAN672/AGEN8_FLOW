## AI Flowkit — Developer Guide

This document describes how to run, understand, and extend the current Vite + React implementation of the workflow builder in this repo.

---

## 1) Quickstart

Prerequisites
- Node.js 18 or newer
- A package manager (pnpm recommended; npm works too)

Install and run (Windows PowerShell examples)

```powershell
# using pnpm
pnpm install
pnpm dev

# or using npm
npm install
npm run dev
```

Open the app at: http://localhost:8080

First run checklist
- Create a Workspace (top bar selector will show it).
- Create a Workflow (auto-created in a new workspace).
- Drag blocks from the left Palette onto the canvas.
- Connect nodes; select a node to edit its properties in the right panel.
- Click Run (top bar) to execute and view logs in the Execution Log panel.

Notes
- No database or auth. State persists to localStorage.
- Execution is client-side only; some blocks call external APIs directly from the browser.

---

## 2) Tech Stack

- Vite + React + TypeScript
- UI: Tailwind CSS + shadcn/ui + Lucide icons
- Canvas: @xyflow/react
- State: Zustand
- Editors: Monaco (via @monaco-editor/react) for JSON/code fields

What this project is NOT using right now
- No Next.js, no server/API routes, no NDJSON streaming endpoints
- No test runner configured (Vitest/Playwright are not set up yet)

---

## 3) Repository Layout (current)

Key paths you’ll touch most:

```
src/
  components/
    Copilot.tsx            # Optional copilot side panel (UI only)
    ExecutionLog.tsx       # Shows logs emitted by the engine
    Palette.tsx            # Block catalog + drag and drop
    PropertiesPanel.tsx    # Dynamic form for selected node properties
    Topbar.tsx             # Run/Stop, toggles, workspace/workflow display
    WorkflowBuilder.tsx    # Main builder shell (palette + canvas + panels)
    nodes/WorkflowNode.tsx # React Flow node renderer for all blocks

  lib/
    blocks/
      registry.ts          # Registers block types for the palette
      starter.ts           # Built-in blocks (starter, agent, api, ...)
      agent.ts
      api.ts
      condition.ts
      function.ts
      response.ts
      integrations/index.ts # Many integration stubs (API key fields + mock)

    execution/engine.ts    # Client-side execution engine (MVP)
    storage.ts             # localStorage persistence
    store.ts               # Zustand app state (workspaces, runs, UI toggles)
    types.ts               # Shared types (Workflow, BlockConfig, etc.)

  pages/
    Index.tsx              # Loads from storage and mounts WorkflowBuilder
```

Vite config sets dev server to http://localhost:8080 (`vite.config.ts`).

---

## 4) Core Concepts

### 4.1 Workflow shape
See `src/lib/types.ts` for source of truth. Simplified shape:

```ts
type Workflow = {
  id: string; name: string;
  nodes: Array<{ id: string; type: string; position: { x: number; y: number }; data: Record<string, any> }>;
  edges: Array<{ id: string; source: string; target: string; sourceHandle?: string; targetHandle?: string; label?: string }>;
  starterId: string;
  createdAt: string; updatedAt: string;
};
```

### 4.2 Block definition
Blocks drive both the UI (properties panel) and execution. See `src/lib/types.ts`.

```ts
type BlockConfig<T = any> = {
  type: string; name: string; category: 'blocks' | 'integrations' | 'io' | 'control' | 'tools';
  icon: React.FC<any>; bgColor?: string; description?: string; docsLink?: string;
  subBlocks?: BlockField[];      // properties panel fields
  inputs: Record<string, { type: 'string' | 'number' | 'json' | 'any'; description?: string; schema?: any }>;
  outputs: Record<string, { type: 'string' | 'number' | 'json' | 'any'; description?: string }>;
  run?: (ctx: RunContext) => Promise<T>;
};
```

### 4.3 Execution model (MVP)
- Engine is entirely client-side (`src/lib/execution/engine.ts`).
- Validates only that a starter node exists.
- Executes the starter, then executes nodes directly connected from the starter (one hop). Full DAG traversal/topo-sort is not implemented yet.
- Each node’s `run(ctx)` can `ctx.log(...)` and set outputs via `ctx.setNodeOutput(key, value)`.
- A fetch wrapper applies a 30s timeout to requests. There is no retry/backoff yet.
- There is no streaming; logs are appended in-memory and shown in the UI.

Limitations to be aware of
- Stop in the UI toggles state, but does not currently abort in-flight requests.
- No cycles detection, multi-branch traversal, or on-error routing yet.

---

## 5) Built-in Blocks

Category "blocks"
- Starter: begins execution and provides a payload
- AI Agent: optional call to Ollama (http://localhost:11434) or mock if no key/endpoint
- HTTP Request: basic fetch with method/url/headers/body fields
- Condition / Function / Response: present with minimal or mock behavior

Category "integrations"
- A large catalog of stubs exists in `integrations/index.ts` (Airtable, ArXiv, Discord, GitHub, Gmail, Google, OpenAI, Pinecone, Slack, Supabase, Tavily, Telegram, Twilio, Wikipedia, YouTube, and many more).
- These require an `apiKey` input and currently return mocked responses to keep the MVP functional without credentials.

Palette categories
- The UI shows categories for future growth (tools, io, control), but most concrete items today are under "blocks" and "integrations".

---

## 6) API Keys

- Provide API keys per-node via the node’s properties (many integrations expose an `API Key` field).
- A global `apiKeys` store exists in `src/lib/store.ts` for future settings UX, but there is no Settings modal yet and the engine doesn’t read global keys.
- Ollama models are addressed with `ollama:<model>` (e.g., `ollama:llama3.2`). If Ollama is not running, the Agent block gracefully falls back to a mock response.

---

## 7) Adding a Block

1) Create `src/lib/blocks/your_block.ts` and export a `BlockConfig`.
2) Register it in `src/lib/blocks/registry.ts`.
3) Define `subBlocks` for properties UI; define `inputs`/`outputs` contracts.
4) Implement `run(ctx)` and use `ctx.log(...)`, `ctx.getNodeOutput(...)`, and `ctx.setNodeOutput(...)` as needed.

Tip: Keep browser/CORS constraints in mind for any external HTTP calls.

---

## 8) Persistence

- All app state (workspaces, current workflow, theme, and apiKeys map) persists to localStorage under the key `sim-ai-workflow-builder` (`src/lib/storage.ts`).

---

## 9) Troubleshooting

- Nothing happens when you click Run: Ensure you have a starter node and at least one edge from the starter to another node. Check the Execution Log panel for messages.
- CORS errors when calling third-party APIs: Browser-based requests may be blocked by CORS. Use services that allow browser calls or proxy through your own backend (not included in this repo).
- Ollama not available: Start Ollama locally (default at http://localhost:11434). If unavailable, the Agent block logs the issue and returns a mock response.
- Port mismatch: Dev server runs on http://localhost:8080 (configured in `vite.config.ts`).

---

## 10) Roadmap (short)

- Full DAG traversal + topo-sort, multi-hop execution
- Proper cancel/abort wiring from UI to engine
- Error ports and conditional branching in the engine
- Import/Export workflows
- Settings UI for provider keys; provider adapters
- Tests (unit + E2E), editor hotkeys, and richer block library

---

## 11) MVP “Done” checklist

- Create workspace and workflow; state persists to localStorage
- Drag/drop/connect nodes on the canvas
- Edit node properties via dynamic forms
- Click Run and see logs for each executed node
- Works without API keys (mock outputs); produces real outputs where possible