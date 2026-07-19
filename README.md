# Hivey Code

An agentic, browser-based coding studio: describe an app in plain language and a team of AI agents
**plan → code → test → debug → complete** it, with a live preview, a real editor, and a hardened
execution sandbox. Companion to the **Hivey AI Sidebar** browser extension (they share the OpenRouter
BYOK key and the visual theme).

- **Live:** https://app.hivey.be
- **Stack:** Next.js 14 (App Router, TypeScript), Zustand, Monaco, Sandpack, Tailwind.
- **BYOK:** the user's OpenRouter key lives only in their browser; the server never stores it.

---

## Architecture (bird's-eye)

```
Browser (app.hivey.be)                         Server (Next.js, same origin)          Isolated
┌──────────────────────────────┐   NDJSON      ┌──────────────────────────────┐       ┌────────────────┐
│ Landing / Workspace (React)  │──/api/agent──▶│ orchestrator.ts (agent loop) │──────▶│ hivey-runner   │
│  • Chat + InputControls      │◀─ events ─────│  planner→coder→test→debug     │ /run  │ 127.0.0.1:8093 │
│  • Monaco editor + FileTree  │               │  streams file/reasoning/status│       │ Docker hardened│
│  • Sandpack live preview     │               ├──────────────────────────────┤       │ tsc/vitest/vite│
│  • OpenClaude terminal       │──/api/terminal│ agentLoop.ts (tool-calling)  │       └────────────────┘
│  • Zustand store (localStorage│──/api/run ───▶│ sandbox.ts → runner           │
│    + IndexedDB git)          │──/api/deploy─▶│ deploy → /srv/hivey-deploys    │────▶ deploys.hivey.be
└──────────────────────────────┘──/api/unrar──▶│ node-unrar-js (rar import)     │        (separate origin)
                                                └──────────────────────────────┘
  The browser never talks to OpenRouter directly for the agent stream — /api/agent forwards the user's
  key per-request and never persists it.
```

### The agent pipeline (`src/agent/orchestrator.ts`)

`runAgents(req)` is an **async generator** that yields NDJSON `AgentEvent`s to the browser. Depth is
chosen by `router.ts`:

- **Fast** — one direct coder pass (small edits). No planner/reviewer.
- **Deep** — the full council (every from-scratch build is Deep):
  1. **Feature-scoping** (`MARKET_SYSTEM`) — lists the features a best-in-class version of this
     product should have, injected as *additive* requirements so the app isn't minimal.
  2. **Planner** — a short concrete build plan.
  3. **Coder** — writes the app. **New project → full files** (streamed live). **Existing project →
     search/replace patches** (`<edit>` blocks — Claude-Code-style, ~10× fewer output tokens).
  4. **Tester** — a **real** type-check in the runner sandbox (`sandbox.ts` → `verifyInSandbox`).
     Dependency-resolution errors (TS2307, missing deps) are filtered out (the runner doesn't install
     app deps; they resolve for the real preview).
  5. **Debugger** — fixes the *real* type errors; bounded loop (`MAX_FIX = 2`).
  6. **Completeness** — the reviewer checks the app against the expected features; anything missing is
     sent back to the coder to *add*.

**Key design choices**

- **Reasoning is OFF by default** — quality comes from the agentic loop + real execution, not a long
  think-monologue. A forced reasoning budget used to make the coder sit silent for minutes.
- **Prompt caching** — the system prompt is marked `cache_control: ephemeral` (`openrouter.ts`) so it
  isn't re-billed each turn (Anthropic/Gemini/DeepSeek via OpenRouter).
- **Idle timeout** — `streamOR` aborts if the model sends nothing for 90 s (no infinite hang).
- **Diff editing** — `parse.ts` `parseEdits()`/`applyEdits()` turn `<edit>` SEARCH/REPLACE blocks into
  file changes (exact match + trailing-whitespace-tolerant fallback).

### Models & Hivey variants (`src/agent/models.ts`)

A selected concrete model is used **as-is for every role**. The `hivey/*` pseudo-models route per role:

- **Hivey Free** — 100% free models (code: Qwen3 Coder).
- **Hivey** (hybrid) — Sonnet 4.6 for the code, fast models for planning/review.
- **Hivey Smart** — **Opus 4.8** for coder/debugger + a guided **interview** (clarifying questions
  with clickable options, multi-add, and visual design-direction thumbnails) before building.

### State & persistence (`src/store/useStore.ts`)

Zustand store. **Everything is client-side:** OpenRouter key, projects (files + memory + chat +
template), UI prefs — all in `localStorage`; git history in **IndexedDB** (`src/lib/git.ts`,
isomorphic-git). The server only handles data *in transit* (LLM proxy, sandbox) + the sites the user
*deploys*.

### Templates & preview (`src/agent/templates.ts`, `src/components/Sandbox.tsx`)

- **Web stacks** (React/Vue/Svelte/Solid/vanilla/static) → **live preview** via Sandpack.
- **Code stacks** (Python/C/C++/Rust/Go/Flutter) → scaffold + editor + export, no live preview.
- Sandpack runs its **own tested toolchain** (vite 4.2.0 + esbuild-wasm); the project's `package.json`
  is *not* handed to Sandpack (a generated one can pin a toolchain nodebox can't run) — its runtime
  deps are merged in via `customSetup`.

### File import (`src/lib/importFiles.ts`)

Import files/folders/`.zip` (jszip, client) / `.rar` (server route `/api/unrar`, node-unrar-js).
Text/code/SVG → the FileMap; binaries → a manifest (`IMPORTED_ASSETS.md`) so the agents have context.
Junk (`node_modules`, `.git`, lockfiles…) is filtered; paths normalized. Importing files **disables**
the starter scaffold (the agents work on the imported code).

---

## Security

- **BYOK** — the OpenRouter/provider keys live only in the browser (`localStorage`). They're sent
  per-request to the LLM endpoint (proxied by `/api/agent` etc.) and **never persisted server-side**.
- **Runner sandbox** (`/opt/hivey-runner`, `127.0.0.1:8093`, never public) — each job runs in an
  ephemeral Docker container: `--network none`, non-root, `--read-only`, `--cap-drop ALL`,
  `--no-new-privileges`, memory/CPU/PID limits, wall-clock timeout, output cap, path/command
  allow-list. `/api/run` proxies to it; the container is never exposed.
- **Deployed apps** are served on a **separate origin** (`deploys.hivey.be`) so a generated app can't
  read app.hivey.be's `localStorage` (the BYOK key).
- **Markdown** is rendered with `react-markdown` (no `rawHtml`, no `dangerouslySetInnerHTML`).

---

## Infra / deployment

- **systemd service `hiveycode`** — `npm run start -- -p 5174`, `WorkingDirectory /opt/hiveycode`,
  `Restart=always`. Served behind **Caddy** at **app.hivey.be** (reverse_proxy 127.0.0.1:5174).
- **`hivey-runner`** systemd service (127.0.0.1:8093) — the hardened Docker execution service.
- **`deploys.hivey.be`** — Caddy `file_server` over `/srv/hivey-deploys`.

### Build & run locally

```bash
cd /opt/hiveycode
npm install
npm run build                 # production build
systemctl restart hiveycode   # (or: npm run start -- -p 5174)
# dev: npm run dev
```

Node 18. Uses **npm** (not pnpm).

---

## Project layout

```
src/
  agent/          orchestrator.ts (the loop), models.ts, roles.ts (prompts), parse.ts (file+patch),
                  openrouter.ts (BYOK calls + streaming + cache), sandbox.ts (runner), templates.ts,
                  router.ts (depth), agentLoop.ts (OpenClaude tool-calling), terminal.ts, providers.ts
  app/            page.tsx, globals.css (theme tokens), api/{agent,run,unrar,deploy,terminal,mcp}
  components/     Chat, InputControls, Sandbox (Sandpack+Monaco+FileTree+Diff+History+Console+Terminal),
                  Editor, Landing, Topbar, SettingsDrawer, MemoryPanel, Popover, Splitter…
  hooks/useAgent.ts   the client stream consumer (applies events to the store)
  lib/            git.ts (real git in IndexedDB), importFiles.ts, uiPrefs.ts, uiTheme.ts, benchmarks.ts
  store/useStore.ts   Zustand store (everything client-side)
```

See `../firefox-ai-sidebar/README.md` for the companion browser extension.
