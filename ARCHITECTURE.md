# Hivey — System Architecture

Two products that share one OpenRouter BYOK key and one visual theme:

1. **Hivey AI Sidebar** — a Firefox/Chrome MV3 browser extension (`/opt/firefox-ai-sidebar`): a chat +
   tools sidebar (translate, improve, image, PDF, agent, terminal) that talks to any model via the
   user's own OpenRouter key.
2. **Hivey Code** — a web app (`/opt/hiveycode`, https://app.hivey.be): the agentic coding studio.

They are wired together: the sidebar has a **"Code"** button that opens Hivey Code and hands over the
OpenRouter key; a content-script **bridge** keeps the key (and the accent colour) in sync both ways.

```
┌────────────────────────── User's browser ──────────────────────────┐
│                                                                     │
│  Hivey AI Sidebar (extension)            Hivey Code (app.hivey.be)  │
│  ┌───────────────────────┐               ┌──────────────────────┐  │
│  │ sidebar.js / .html    │  #sk= + bridge │ Next.js React app    │  │
│  │ storage.local (keys)  │◀──────────────▶│ localStorage (key,   │  │
│  │ options page (theme)  │  postMessage   │   projects, prefs)   │  │
│  └───────────┬───────────┘   (hivey-      │ IndexedDB (git)      │  │
│              │                bridge)      └──────────┬───────────┘  │
└──────────────│──────────────────────────────────────│──────────────┘
               │ BYOK per-request                      │ /api/*  (Next server)
               ▼                                        ▼
        api.openrouter.ai                       Next.js server (same origin)
        (Anthropic/OpenAI/…                      orchestrator, /api/run → runner,
         via one OpenRouter key)                 /api/deploy → /srv/hivey-deploys
                                                        │
                                                        ▼
                                        hivey-runner (127.0.0.1:8093, Docker, hardened)
                                        deploys.hivey.be (separate origin, file_server)
```

---

## Server & network (VPS 141.94.46.216, Caddy reverse-proxy)

| Domain               | Backend                                   | Purpose                                  |
|----------------------|-------------------------------------------|------------------------------------------|
| `app.hivey.be`       | systemd `hiveycode` → 127.0.0.1:5174      | Hivey Code web app                       |
| `deploys.hivey.be`   | Caddy `file_server` → `/srv/hivey-deploys`| User-published apps (separate origin!)   |
| `hivey.be`           | Caddy `file_server` → `/srv/dl`           | Extension `.zip` downloads               |
| (internal) :8093     | systemd `hivey-runner`, 127.0.0.1 only    | Hardened Docker exec (tsc/vitest/build)  |

Caddy config: `/etc/caddy/Caddyfile`. Services: `systemctl status hiveycode hivey-runner caddy`.

---

## Hivey Code — the agent loop

`src/agent/orchestrator.ts :: runAgents()` is a single **async generator**. The browser
(`src/hooks/useAgent.ts`) POSTs to `/api/agent` and reads NDJSON events (`file-open`, `file-delta`,
`file`, `reasoning`, `status`, `plan`, `review`, `questions`, `message`, `error`, `done`), applying
them to the Zustand store which drives the editor and the Sandpack preview.

**Fast vs Deep** (`router.ts`): a from-scratch build or a "build" request → Deep (feature-scoping →
plan → code → real type-check → debug → completeness); a small edit → Fast (single coder pass).

**Diff editing** (`parse.ts`): edits to an existing project are emitted as `<edit>` SEARCH/REPLACE
patches, applied with `applyEdits()` (≈10× fewer output tokens than rewriting files).

**Models** (`models.ts`): concrete model = used everywhere; `hivey/free|hivey|hivey/smart` route per
role. Reasoning is opt-out-by-default (was causing multi-minute stalls). Prompt caching + a 90 s idle
timeout live in `openrouter.ts`.

**Execution truth** (`sandbox.ts` → runner): the tester runs a *real* `tsc`/`vitest` in the hardened
container and feeds the real errors to the debugger — the pattern that makes OpenHands-class agents
reliable. Missing-dependency errors are filtered (they resolve for the real preview).

---

## Security model (see each README for detail)

- **BYOK**: keys only in the browser; forwarded per-request; never persisted server-side; never logged.
- **Runner**: `--network none`, non-root, read-only, `--cap-drop ALL`, `--no-new-privileges`,
  mem/cpu/pids limits, timeouts, output cap, path + command allow-list; bound to 127.0.0.1.
- **Deployed apps** run on `deploys.hivey.be` (separate origin) → cannot read the key on app.hivey.be.
- **Rendering**: markdown via `react-markdown` (no raw HTML). Sidebar bridge only syncs the key with
  the sidebar's own content script.

---

## Build & deploy

- **Hivey Code**: `cd /opt/hiveycode && npm run build && systemctl restart hiveycode` → verify
  `curl -s -o /dev/null -w '%{http_code}' https://app.hivey.be` = 200.
- **Sidebar**: `cd /opt/firefox-ai-sidebar && bash scripts/build.sh`, bump `version` in `manifest.json`
  + `manifest.chrome.json`, copy the zips to `/srv/dl/` → verify
  `hivey.be/ai-sidebar-<VER>-firefox.zip` and `-chrome.zip` = 200.

See `README.md` (Hivey Code) and `../firefox-ai-sidebar/README.md` (extension) for full detail.
