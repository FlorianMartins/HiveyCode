"use client";

import { create } from "zustand";
import type { FileMap, HiveyVariant, AgentQuestion, DesignDirection, SecurityFinding } from "@/agent/types";
import { applyUi, loadUi } from "@/lib/uiTheme";
import { applyThemePalette, loadSavedPalette } from "@/lib/themeSync";

// What the cost gate shows before any code is generated.
export interface EstimateData {
  low: number;
  high: number;
  priced: boolean;
  basis: string;
  lines: { role: string; model: string; promptTokens: number; completionTokens: number; low: number; high: number }[];
}

export interface ChatMsg {
  role: "user" | "assistant";
  content: string;
  status?: boolean; // true = transient status line (replaced by the next status/message)
  reasoning?: boolean; // true = live model-reasoning block (collapsible; not persisted)
  step?: string; // a pipeline step (plan / features / review…) — rendered collapsed by default
  questions?: AgentQuestion[]; // guided mode: clarifying questions to render interactively
  designs?: DesignDirection[]; // design checkpoint: directions to pick from before building
  estimate?: EstimateData; // cost gate: what the build will cost, awaiting the user's go-ahead
  error?: boolean; // true = an error report (rendered with a red style + an always-visible copy button)
}

// A pick made on the live preview (single element or a dragged zone). Used as targeted context
// for the next request — like the sidebar's "select an element" feature.
export interface Selection {
  kind: "element" | "zone";
  label: string;
  detail: string;
}

// Durable project memory — facts the agents should always know (goal, stack, conventions, key
// decisions). Injected into every agent/terminal request so the project has continuity.
export interface MemoryEntry {
  id: string;
  text: string;
  ts: number;
  auto?: boolean; // auto-captured (vs user-written)
}

type InspectMode = "off" | "select" | "zone";

// A project checkpoint = a full snapshot of the files at a point in time. Taken automatically
// before each big agent run (safety net) and on demand. Restoring rolls the files back.
export interface Checkpoint {
  id: string;
  label: string;
  at: number;
  auto?: boolean; // taken automatically before an agent run
  files: FileMap;
  chatLen?: number; // number of chat messages at the time — restoring truncates the chat back to this
}
const MAX_CHECKPOINTS = 15;

// Live token/cost accounting for the current agent run, broken down per role (planner/coder/…).
export interface RoleUsage {
  prompt: number;
  completion: number;
  cost: number;
  calls: number;
}
export interface RunUsage {
  prompt: number;
  completion: number;
  cost: number;
  byRole: Record<string, RoleUsage>;
}
const emptyUsage = (): RunUsage => ({ prompt: 0, completion: 0, cost: 0, byRole: {} });

export interface ProjectMeta {
  id: string;
  name: string;
  updatedAt: number;
  customName?: string; // user-set name — overrides the auto-derived one and survives re-saves
}

interface State {
  files: FileMap;
  baseline: FileMap;
  checkpoints: Checkpoint[];
  // Ephemeral (never persisted) "flashpoint" kept right after a checkpoint restore, so the user can
  // UNDO the restore (jump back to the state — files + full chat — they had just before restoring).
  restoreRedo: { chat: ChatMsg[]; files: FileMap; checkpoints: Checkpoint[] } | null;
  runUsage: RunUsage; // live token/cost accounting for the current/last run
  activeFile: string | null;
  openFiles: string[]; // editor tabs (VSCode-style)
  chat: ChatMsg[];
  running: boolean;
  paused: boolean; // dev run paused (client stops consuming the stream → backpressure pauses the pipeline)
  phase: string; // current pipeline phase (plan/code/test/fix/done…) for the status workbench
  securityFindings: SecurityFinding[]; // defensive security-audit findings (Security tab)
  securityScanning: boolean;
  inspectMode: InspectMode;
  selection: Selection | null;
  runtimeError: string | null;
  memory: MemoryEntry[];
  mcpServers: { name: string; url: string }[]; // configured MCP tool servers
  projectId: string;
  projects: ProjectMeta[]; // saved projects index (for the quick menu / history)

  apiKey: string;
  keys: Record<string, string>; // per-provider BYOK keys (openrouter, anthropic, openai, google, groq…)
  localBaseUrls: Record<string, string>; // per-local-provider base URL (ollama/lmstudio/custom); "" = default
  localEnabled: Record<string, boolean>; // which local servers are enabled (shown in the picker)
  variant: string; // selected model: a "hivey/*" pseudo-model OR a concrete model id
  reasoning: "off" | "high" | "max";
  mode: "auto" | "fast" | "deep"; // orchestration depth (best-of-both-worlds dial)
  planFirst: boolean; // plan-before-build: show & approve the plan before the coder runs
  askMode: boolean; // ASK mode: chat about the project (read-only Q&A) instead of building/editing
  pendingPlan: string | null; // a plan awaiting user approval (plan-first mode)
  pendingBuild: { display: string; full: string } | null; // the prompt to build once the plan is approved
  resumable: { display: string; full: string } | null; // a run that failed mid-way → offer to resume
  revealTarget: { path: string; line: number; nonce: number } | null; // jump the editor to a file+line
  template: string; // project stack (react/vue/svelte/vanilla/static/python/…) — agent/templates.ts
  orModels: { id: string; name: string; group: string; prompt?: number }[]; // models from all connected providers (prompt = $/token)
  accent: string; // brand accent colour (synced with the sidebar theme)
  lang: "en" | "fr"; // UI language, synced from the sidebar (falls back to the browser locale)

  setFile: (path: string, content: string) => void;
  setFiles: (files: FileMap) => void;
  addFiles: (add: FileMap) => void; // merge imported files into the current project
  newFile: (path: string, content?: string) => void; // create a file (no-op if it exists)
  renamePath: (oldPath: string, newPath: string) => void; // rename/move a file OR a folder (prefix)
  deletePath: (path: string) => void; // delete a file OR a folder and everything under it
  duplicatePath: (path: string) => void; // copy a file OR a folder
  saveNow: () => void; // flush the current files to localStorage (debounced auto-save)
  setActiveFile: (path: string | null) => void;
  closeFile: (path: string) => void;
  snapshotBaseline: () => void;
  addUsage: (role: string, prompt: number, completion: number, cost: number) => void;
  resetUsage: () => void;
  saveCheckpoint: (label?: string, auto?: boolean) => void; // snapshot current files
  restoreCheckpoint: (id: string) => void; // roll files back to a checkpoint
  undoRestore: () => void; // jump back to the ephemeral flashpoint saved before the last restore
  deleteCheckpoint: (id: string) => void;
  setInspectMode: (m: InspectMode) => void;
  setSelection: (s: Selection | null) => void;
  setRuntimeError: (e: string | null) => void;
  pushChat: (m: ChatMsg) => void;
  setStatus: (text: string) => void;
  setRunning: (r: boolean) => void;
  setPaused: (p: boolean) => void;
  setPhase: (phase: string) => void;
  setLang: (lang: "en" | "fr") => void;
  setSecurityFindings: (f: SecurityFinding[]) => void;
  setSecurityScanning: (b: boolean) => void;
  markFindingFixed: (id: string) => void;
  previewNonce: number; // bumped when the workspace should jump to the live Preview tab
  requestPreview: () => void;
  codeNonce: number; // bumped when the workspace should jump to the Code tab (watch the agent write)
  requestCode: () => void;
  pendingPrompt: string; // guided mode: the original request kept while questions are answered
  lastRunPrompt: string; // the exact prompt of the current run, replayed verbatim once the cost is approved
  addMemory: (text: string, auto?: boolean) => void;
  removeMemory: (id: string) => void;
  addMcpServer: (name: string, url: string) => void;
  removeMcpServer: (name: string) => void;
  newProject: () => void; // save current, start a fresh project (lands on the hero)
  openProject: (id: string) => void; // save current, load another project
  deleteProject: (id: string) => void;
  renameProject: (id: string, name: string) => void;
  setApiKey: (k: string) => void;
  setProviderKey: (provider: string, key: string) => void;
  setLocalServer: (id: string, patch: { baseUrl?: string; enabled?: boolean }) => void;
  setVariant: (v: string) => void;
  setReasoning: (r: "off" | "high" | "max") => void;
  setMode: (m: "auto" | "fast" | "deep") => void;
  setPlanFirst: (v: boolean) => void;
  setAskMode: (v: boolean) => void;
  setPendingPlan: (p: string | null) => void;
  setPendingBuild: (b: { display: string; full: string } | null) => void;
  setResumable: (r: { display: string; full: string } | null) => void;
  revealInEditor: (path: string, line: number) => void; // open a file and scroll to a line
  setTemplate: (id: string) => void;
  setAccent: (hex: string) => void;
  fetchModels: () => Promise<void>;
  hydrate: () => void;
}

const LS = {
  key: "hivey.orKey",
  variant: "hivey.variant",
  reasoning: "hivey.reasoning",
  mode: "hivey.mode",
  mcp: "hivey.mcp",
  keys: "hivey.keys",
  local: "hivey.local", // { baseUrls: {id:url}, enabled: {id:bool} }
  planFirst: "hivey.planFirst",
  askMode: "hivey.askMode",
  accent: "hivey.accent",
  lang: "hivey.lang", // UI language ("en" | "fr"), synced from the sidebar
  index: "hivey.projects", // [{id,name,updatedAt}]
  current: "hivey.currentProject", // id of the last-open project
};
const projectKey = (id: string) => `hivey.project.${id}`;
const uid = () => Math.random().toString(36).slice(2, 10);

// Apply the brand accent to the CSS variables (drives the whole themed UI).
function applyAccent(hex: string) {
  if (typeof document === "undefined" || !hex) return;
  document.documentElement.style.setProperty("--accent", hex);
}

function projectName(files: FileMap, memory: MemoryEntry[], chat: ChatMsg[] = []): string {
  const goal = memory.find((m) => m.text.startsWith("Project goal:"));
  if (goal) return goal.text.replace("Project goal:", "").trim().slice(0, 60);
  const firstUser = chat.find((m) => m.role === "user" && m.content.trim());
  if (firstUser) return firstUser.content.trim().replace(/\n[\s\S]*$/, "").slice(0, 60);
  const first = Object.keys(files)[0];
  return first ? first.split("/").pop()!.slice(0, 60) : "Untitled";
}

export const useStore = create<State>((set, get) => {
  // Persist the current project (files + memory) under its id, and keep the projects index fresh so
  // the quick menu / history can list and reopen them. Empty projects aren't indexed.
  const persist = () => {
    try {
      const { files, memory, projectId, projects, template, chat, securityFindings, checkpoints } = get();
      if (!projectId) return;
      // Don't persist transient reasoning blocks (they'd bloat storage and clutter reopened history).
      const savedChat = chat.filter((m) => !m.reasoning);
      localStorage.setItem(projectKey(projectId), JSON.stringify({ files, memory, template, chat: savedChat, security: securityFindings, checkpoints }));
      // Index the project as soon as it has ANY real content — files OR a real conversation — so it
      // shows up in the "Recent projects" history (a chat-only project counts too).
      const hasChat = chat.some((m) => !m.status && m.content.trim());
      if (Object.keys(files).length === 0 && !hasChat) return;
      // Keep a user-set custom name across re-saves; otherwise derive it from the goal/chat/files.
      const existing = projects.find((p) => p.id === projectId);
      const meta: ProjectMeta = {
        id: projectId,
        name: existing?.customName || projectName(files, memory, chat),
        updatedAt: Date.now(),
        customName: existing?.customName,
      };
      const next = [meta, ...projects.filter((p) => p.id !== projectId)];
      set({ projects: next });
      localStorage.setItem(LS.index, JSON.stringify(next));
      localStorage.setItem(LS.current, projectId);
    } catch {
      // localStorage full / unavailable — best effort.
    }
  };

  return {
    files: {},
    baseline: {},
    checkpoints: [],
    restoreRedo: null,
    runUsage: emptyUsage(),
    activeFile: null,
    openFiles: [],
    chat: [],
    running: false,
    paused: false,
    phase: "",
    securityFindings: [],
    securityScanning: false,
    setSecurityFindings: (securityFindings) => {
      set({ securityFindings });
      persist();
    },
    setSecurityScanning: (securityScanning) => set({ securityScanning }),
    markFindingFixed: (id) => {
      set((s) => ({ securityFindings: s.securityFindings.map((f) => (f.id === id ? { ...f, status: "fixed" } : f)) }));
      persist();
    },
    inspectMode: "off",
    selection: null,
    runtimeError: null,
    memory: [],
    mcpServers: [],
    projectId: "",
    projects: [],
    apiKey: "",
    keys: {},
    localBaseUrls: {},
    localEnabled: {},
    variant: "hivey",
    reasoning: "off",
    mode: "auto",
    planFirst: false,
    askMode: false,
    pendingPlan: null,
    pendingBuild: null,
    resumable: null,
    revealTarget: null,
    template: "custom",
    orModels: [],
    accent: "#6366f1",
    lang: "en",
    setLang: (lang) => {
      set({ lang });
      try {
        localStorage.setItem(LS.lang, lang);
      } catch {}
    },

    setFile: (path, content) =>
      set((s) => ({ files: { ...s.files, [path]: content }, activeFile: s.activeFile ?? path })),
    setFiles: (files) => {
      set({ files });
      persist();
    },
    addFiles: (add) => {
      const keys = Object.keys(add);
      if (!keys.length) return;
      set((s) => ({
        files: { ...s.files, ...add },
        activeFile: s.activeFile ?? keys[0],
        openFiles: s.openFiles.includes(keys[0]) ? s.openFiles : [...s.openFiles, keys[0]],
      }));
      persist();
    },
    newFile: (path, content = "") => {
      const p = path.replace(/^\.?\//, "").trim();
      if (!p || get().files[p] != null) return;
      set((s) => ({ files: { ...s.files, [p]: content }, activeFile: p, openFiles: [...s.openFiles, p] }));
      persist();
    },
    renamePath: (oldPath, newPath) => {
      const from = oldPath.replace(/^\.?\//, "");
      const to = newPath.replace(/^\.?\//, "").trim();
      if (!to || from === to) return;
      set((s) => {
        const files: FileMap = {};
        const remap = (k: string) => (k === from ? to : k.startsWith(from + "/") ? to + k.slice(from.length) : k);
        for (const [k, v] of Object.entries(s.files)) files[remap(k)] = v;
        return {
          files,
          activeFile: s.activeFile ? remap(s.activeFile) : s.activeFile,
          openFiles: s.openFiles.map(remap),
        };
      });
      persist();
    },
    deletePath: (path) => {
      const p = path.replace(/^\.?\//, "");
      set((s) => {
        const files: FileMap = {};
        for (const [k, v] of Object.entries(s.files)) if (k !== p && !k.startsWith(p + "/")) files[k] = v;
        const gone = (k: string) => k === p || k.startsWith(p + "/");
        const openFiles = s.openFiles.filter((k) => !gone(k));
        return { files, openFiles, activeFile: s.activeFile && gone(s.activeFile) ? openFiles[openFiles.length - 1] || null : s.activeFile };
      });
      persist();
    },
    duplicatePath: (path) => {
      const p = path.replace(/^\.?\//, "");
      set((s) => {
        const isFile = s.files[p] != null;
        // "src/App.tsx" → "src/App copy.tsx" ; "components" (folder) → "components copy"
        const copyName = (name: string) => {
          const dot = name.lastIndexOf(".");
          return dot > 0 && isFile ? `${name.slice(0, dot)} copy${name.slice(dot)}` : `${name} copy`;
        };
        const newBase = copyName(p);
        const files: FileMap = { ...s.files };
        for (const [k, v] of Object.entries(s.files)) {
          if (k === p) files[newBase] = v;
          else if (k.startsWith(p + "/")) files[newBase + k.slice(p.length)] = v;
        }
        return { files };
      });
      persist();
    },
    saveNow: () => persist(),
    setActiveFile: (path) =>
      set((s) => ({ activeFile: path, openFiles: path && !s.openFiles.includes(path) ? [...s.openFiles, path] : s.openFiles })),
    closeFile: (path) =>
      set((s) => {
        const openFiles = s.openFiles.filter((p) => p !== path);
        const activeFile = s.activeFile === path ? openFiles[openFiles.length - 1] || null : s.activeFile;
        return { openFiles, activeFile };
      }),
    snapshotBaseline: () => set((s) => ({ baseline: { ...s.files } })),
    addUsage: (role, prompt, completion, cost) =>
      set((s) => {
        const prev = s.runUsage.byRole[role] || { prompt: 0, completion: 0, cost: 0, calls: 0 };
        const byRole = {
          ...s.runUsage.byRole,
          [role]: { prompt: prev.prompt + prompt, completion: prev.completion + completion, cost: prev.cost + cost, calls: prev.calls + 1 },
        };
        return {
          runUsage: {
            prompt: s.runUsage.prompt + prompt,
            completion: s.runUsage.completion + completion,
            cost: s.runUsage.cost + cost,
            byRole,
          },
        };
      }),
    resetUsage: () => set({ runUsage: emptyUsage() }),
    saveCheckpoint: (label, auto) => {
      const s = get();
      const files = { ...s.files };
      if (Object.keys(files).length === 0) return; // nothing to snapshot
      // Skip a duplicate auto-snapshot when the files are identical to the latest checkpoint.
      const last = s.checkpoints[0];
      if (last && JSON.stringify(last.files) === JSON.stringify(files)) return;
      const cp: Checkpoint = {
        id: uid(),
        label: (label || "Checkpoint").slice(0, 80),
        at: Date.now(),
        auto: !!auto,
        files,
        chatLen: s.chat.length, // remember where the conversation was, to truncate back on restore
      };
      const checkpoints = [cp, ...s.checkpoints].slice(0, MAX_CHECKPOINTS);
      set({ checkpoints });
      persist();
    },
    restoreCheckpoint: (id) => {
      const s = get();
      const cp = s.checkpoints.find((c) => c.id === id);
      if (!cp) return;
      // Snapshot the CURRENT state first (auto) so restoring is itself reversible.
      const cur = { ...s.files };
      const guard: Checkpoint[] =
        Object.keys(cur).length && JSON.stringify(s.checkpoints[0]?.files) !== JSON.stringify(cur)
          ? [{ id: uid(), label: "Before restore", at: Date.now(), auto: true, files: cur, chatLen: s.chat.length }]
          : [];
      const files = { ...cp.files };
      const first = get().activeFile && files[get().activeFile!] !== undefined ? get().activeFile! : Object.keys(files)[0] || null;
      // Truncate the CHAT back to where this checkpoint was taken, so the conversation matches the
      // restored files (and the deleted turns can't be referenced again — the agent's context is the
      // FILES + current prompt, so they're gone from context too). The full pre-restore state is kept
      // in `restoreRedo` (ephemeral) so the user can jump forward again ("Undo restore").
      const keep = typeof cp.chatLen === "number" ? Math.min(cp.chatLen, s.chat.length) : s.chat.length;
      const newChat = s.chat.slice(0, keep);
      set({
        files,
        baseline: { ...files },
        checkpoints: [...guard, ...s.checkpoints].slice(0, MAX_CHECKPOINTS),
        activeFile: first,
        openFiles: first ? [first] : [],
        chat: newChat,
        restoreRedo: { chat: s.chat, files: cur, checkpoints: s.checkpoints },
      });
      persist();
    },
    undoRestore: () => {
      const r = get().restoreRedo;
      if (!r) return;
      const first = get().activeFile && r.files[get().activeFile!] !== undefined ? get().activeFile! : Object.keys(r.files)[0] || null;
      set({
        files: { ...r.files },
        baseline: { ...r.files },
        chat: r.chat,
        checkpoints: r.checkpoints,
        activeFile: first,
        openFiles: first ? [first] : [],
        restoreRedo: null,
      });
      persist();
    },
    deleteCheckpoint: (id) => {
      set((s) => ({ checkpoints: s.checkpoints.filter((c) => c.id !== id) }));
      persist();
    },
    setInspectMode: (m) => set({ inspectMode: m }),
    setSelection: (sel) => set({ selection: sel }),
    setRuntimeError: (e) => set({ runtimeError: e }),
    pushChat: (m) => {
      // A new USER turn means the user committed to the restored branch → the ephemeral "Undo restore"
      // flashpoint is no longer offered.
      set((s) => ({ chat: [...s.chat, m], restoreRedo: m.role === "user" ? null : s.restoreRedo }));
      persist(); // keep the conversation saved with the project (survives reload / reopening)
    },
    setStatus: (text) =>
      set((s) => {
        const chat = [...s.chat];
        const last = chat[chat.length - 1];
        if (last && last.status) chat[chat.length - 1] = { role: "assistant", content: text, status: true };
        else chat.push({ role: "assistant", content: text, status: true });
        return { chat };
      }),
    setRunning: (r) => {
      set({ running: r, ...(r ? { paused: false, phase: "plan" } : { phase: "done" }) });
      if (!r) persist(); // at the end of every turn, save the full conversation + files to history
    },
    setPaused: (p) => set({ paused: p }),
    setPhase: (phase) => set({ phase }),
    previewNonce: 0,
    requestPreview: () => set((s) => ({ previewNonce: s.previewNonce + 1 })),
    codeNonce: 0,
    requestCode: () => set((s) => ({ codeNonce: s.codeNonce + 1 })),
    pendingPrompt: "",
    lastRunPrompt: "",

    addMemory: (text, auto) => {
      const t = text.trim();
      if (!t) return;
      set((s) => ({ memory: [...s.memory, { id: uid(), text: t, ts: Date.now(), auto }] }));
      persist();
    },
    removeMemory: (id) => {
      set((s) => ({ memory: s.memory.filter((m) => m.id !== id) }));
      persist();
    },
    addMcpServer: (name, url) => {
      set((s) => ({ mcpServers: [...s.mcpServers.filter((m) => m.name !== name), { name, url }] }));
      try {
        localStorage.setItem(LS.mcp, JSON.stringify(get().mcpServers));
      } catch {}
    },
    removeMcpServer: (name) => {
      set((s) => ({ mcpServers: s.mcpServers.filter((m) => m.name !== name) }));
      try {
        localStorage.setItem(LS.mcp, JSON.stringify(get().mcpServers));
      } catch {}
    },

    newProject: () => {
      persist(); // save the current one into history first
      set({ projectId: uid(), files: {}, baseline: {}, checkpoints: [], activeFile: null, openFiles: [], chat: [], memory: [], securityFindings: [], runtimeError: null, selection: null });
      try {
        localStorage.setItem(LS.current, get().projectId);
      } catch {}
    },
    openProject: (id) => {
      persist();
      try {
        const raw = localStorage.getItem(projectKey(id));
        const p = raw ? (JSON.parse(raw) as { files?: FileMap; memory?: MemoryEntry[]; template?: string; chat?: ChatMsg[]; security?: SecurityFinding[]; checkpoints?: Checkpoint[] }) : { files: {}, memory: [] };
        const files = p.files || {};
        const first = Object.keys(files)[0] || null;
        set({ projectId: id, files, baseline: { ...files }, checkpoints: (p as { checkpoints?: Checkpoint[] }).checkpoints || [], memory: p.memory || [], template: p.template || "custom", chat: p.chat || [], securityFindings: p.security || [], activeFile: first, openFiles: first ? [first] : [], runtimeError: null, selection: null });
        localStorage.setItem(LS.current, id);
        // Reopening a project that already has a build → jump straight to the live Preview (the
        // SandboxBody drops back to Code if this stack isn't preview-capable).
        if (Object.keys(files).length) get().requestPreview();
      } catch {}
    },
    deleteProject: (id) => {
      try {
        localStorage.removeItem(projectKey(id));
      } catch {}
      const next = get().projects.filter((p) => p.id !== id);
      set({ projects: next });
      try {
        localStorage.setItem(LS.index, JSON.stringify(next));
      } catch {}
      if (get().projectId === id) get().newProject();
    },
    renameProject: (id, name) => {
      const custom = name.trim().slice(0, 80);
      const next = get().projects.map((p) =>
        p.id === id ? { ...p, name: custom || p.name, customName: custom || undefined } : p,
      );
      set({ projects: next });
      try {
        localStorage.setItem(LS.index, JSON.stringify(next));
      } catch {}
    },

    setApiKey: (k) => {
      try {
        localStorage.setItem(LS.key, k);
      } catch {}
      set({ apiKey: k });
    },
    setVariant: (v) => {
      try {
        localStorage.setItem(LS.variant, v);
      } catch {}
      set({ variant: v });
    },
    setReasoning: (r) => {
      try {
        localStorage.setItem(LS.reasoning, r);
      } catch {}
      set({ reasoning: r });
    },
    setMode: (m) => {
      try {
        localStorage.setItem(LS.mode, m);
      } catch {}
      set({ mode: m });
    },
    setAskMode: (v) => {
      try { localStorage.setItem(LS.askMode, v ? "1" : "0"); } catch {}
      set({ askMode: v });
    },
    setPlanFirst: (v) => {
      try { localStorage.setItem(LS.planFirst, v ? "1" : "0"); } catch {}
      set({ planFirst: v });
    },
    setPendingPlan: (p) => set({ pendingPlan: p }),
    setPendingBuild: (b) => set({ pendingBuild: b }),
    setResumable: (r) => set({ resumable: r }),
    revealInEditor: (path, line) => {
      const s = get();
      if (s.files[path] === undefined) return;
      const nonce = (s.revealTarget?.nonce || 0) + 1;
      set({
        activeFile: path,
        openFiles: s.openFiles.includes(path) ? s.openFiles : [...s.openFiles, path],
        revealTarget: { path, line, nonce },
      });
    },
    setTemplate: (id) => set({ template: id }),
    setProviderKey: (provider, key) => {
      const keys = { ...get().keys, [provider]: key };
      if (!key) delete keys[provider];
      set({ keys });
      try {
        localStorage.setItem(LS.keys, JSON.stringify(keys));
      } catch {}
      get().fetchModels();
    },
    setLocalServer: (id, patch) => {
      const localBaseUrls = { ...get().localBaseUrls };
      const localEnabled = { ...get().localEnabled };
      if (patch.baseUrl !== undefined) {
        if (patch.baseUrl) localBaseUrls[id] = patch.baseUrl;
        else delete localBaseUrls[id];
      }
      if (patch.enabled !== undefined) {
        if (patch.enabled) localEnabled[id] = true;
        else delete localEnabled[id];
      }
      set({ localBaseUrls, localEnabled });
      try {
        localStorage.setItem(LS.local, JSON.stringify({ baseUrls: localBaseUrls, enabled: localEnabled }));
      } catch {}
      get().fetchModels();
    },
    setAccent: (hex) => {
      set({ accent: hex });
      applyAccent(hex);
      try {
        localStorage.setItem(LS.accent, hex);
      } catch {}
    },
    fetchModels: async () => {
      const out: { id: string; name: string; group: string; prompt?: number }[] = [];
      const keys = { openrouter: get().apiKey, ...get().keys } as Record<string, string>;
      // OpenRouter catalog (covers Anthropic/OpenAI/Google… proxied) — grouped by vendor.
      // We also keep each model's prompt price ($/token) so the picker can rank/label by cost.
      try {
        const orKey = keys.openrouter;
        const res = await fetch("https://openrouter.ai/api/v1/models", { headers: orKey ? { authorization: `Bearer ${orKey}` } : {} });
        const j = (await res.json()) as { data?: { id: string; name?: string; pricing?: { prompt?: string } }[] };
        for (const m of j.data || []) out.push({ id: m.id, name: m.name || m.id, group: m.id.split("/")[0] || "openrouter", prompt: m.pricing?.prompt ? parseFloat(m.pricing.prompt) : 0 });
      } catch {}
      // Each DIRECT provider the user added a key for (OpenAI / Google / Groq…).
      const { PROVIDERS, LOCAL_PROVIDERS } = await import("@/agent/providers");
      await Promise.all(
        PROVIDERS.filter((p) => p.id !== "openrouter" && keys[p.id]).map(async (p) => {
          try {
            const res = await fetch(p.models || `${p.baseUrl}/models`, { headers: { authorization: `Bearer ${keys[p.id]}` } });
            const j = (await res.json()) as { data?: { id: string }[] };
            for (const m of j.data || []) out.push({ id: `${p.id}|${m.id}`, name: m.id, group: `${p.label} (direct)` });
          } catch {}
        }),
      );
      // Local servers (Ollama / LM Studio / custom) the user enabled. Listed from the BROWSER,
      // so it reaches the user's own machine (unlike the agent run, which is server-side). Prices = 0.
      const localBaseUrls = get().localBaseUrls;
      const localEnabled = get().localEnabled;
      await Promise.all(
        LOCAL_PROVIDERS.filter((p) => localEnabled[p.id]).map(async (p) => {
          const base = (localBaseUrls[p.id] || p.baseUrl).replace(/\/$/, "");
          if (!base) return;
          try {
            const res = await fetch(`${base}/models`);
            const j = (await res.json()) as { data?: { id?: string; name?: string }[]; models?: { id?: string; name?: string }[] };
            const list = j.data || j.models || [];
            for (const m of list) {
              const id = m.id || m.name;
              if (id) out.push({ id: `${p.id}|${id}`, name: id, group: p.label, prompt: 0 });
            }
          } catch {
            // Native Ollama fallback (/api/tags) for older/proxied builds.
            if (p.id === "ollama") {
              try {
                const res2 = await fetch(`${base.replace(/\/v1$/, "")}/api/tags`);
                const j2 = (await res2.json()) as { models?: { name?: string; model?: string }[] };
                for (const m of j2.models || []) {
                  const id = m.name || m.model;
                  if (id) out.push({ id: `${p.id}|${id}`, name: id, group: p.label, prompt: 0 });
                }
              } catch {}
            }
          }
        }),
      );
      set({ orModels: out.sort((a, b) => a.group.localeCompare(b.group) || a.name.localeCompare(b.name)) });
    },
    hydrate: () => {
      try {
        // 🔗 Sync with the Hivey AI sidebar: it hands us its OpenRouter key via the URL fragment
        // (#sk=) — and a content-script bridge also mirrors it into localStorage. The fragment is
        // never sent to a server; we persist it then strip it from the URL.
        if (typeof location !== "undefined") {
          const frag = new URLSearchParams((location.hash || "").replace(/^#/, ""));
          const qs = new URLSearchParams(location.search || "");
          const sk = frag.get("sk") || qs.get("sk");
          if (sk) {
            localStorage.setItem(LS.key, sk);
            try {
              history.replaceState(null, "", location.pathname);
            } catch {}
          }
        }

        const apiKey = localStorage.getItem(LS.key) || "";
        const variant = localStorage.getItem(LS.variant) || "hivey";
        const reasoning = (localStorage.getItem(LS.reasoning) as "off" | "high" | "max") || "off";
        const mode = (localStorage.getItem(LS.mode) as "auto" | "fast" | "deep") || "auto";
        const planFirst = localStorage.getItem(LS.planFirst) === "1";
        const askMode = localStorage.getItem(LS.askMode) === "1";
        // Accent = blue (#6366f1), matching the sidebar (blue → violet gradient). Migrate the old
        // violet default (#8b5cf6) to blue so existing users get the same look as the sidebar.
        let accent = localStorage.getItem(LS.accent) || "#6366f1";
        if (accent.toLowerCase() === "#8b5cf6") accent = "#6366f1";
        let mcpServers: { name: string; url: string }[] = [];
        try {
          mcpServers = JSON.parse(localStorage.getItem(LS.mcp) || "[]");
        } catch {}
        let keys: Record<string, string> = {};
        try {
          keys = JSON.parse(localStorage.getItem(LS.keys) || "{}");
        } catch {}
        let localBaseUrls: Record<string, string> = {};
        let localEnabled: Record<string, boolean> = {};
        try {
          const l = JSON.parse(localStorage.getItem(LS.local) || "{}");
          localBaseUrls = l.baseUrls || {};
          localEnabled = l.enabled || {};
        } catch {}
        // UI language: prefer the value the sidebar synced (hivey.lang), else the browser locale.
        const storedLang = localStorage.getItem(LS.lang);
        const navLang = typeof navigator !== "undefined" && navigator.language?.toLowerCase().startsWith("fr") ? "fr" : "en";
        const lang: "en" | "fr" = storedLang === "fr" || storedLang === "en" ? storedLang : navLang;
        set({ apiKey, variant, reasoning, mode, planFirst, askMode, mcpServers, keys, localBaseUrls, localEnabled, accent, lang });
        applyAccent(accent);
        applyUi(loadUi());
        // Re-apply the FULL theme palette synced from the sidebar (persisted) so HiveyCode keeps the
        // sidebar's theme across reloads instead of reverting to its defaults.
        applyThemePalette(loadSavedPalette());
        // ALWAYS load the catalogue: OpenRouter's /models is PUBLIC (no key), so the picker can
        // show every current model out of the box. It used to stay empty until a key was pasted,
        // which made HiveyCode look like it only knew the three Hivey presets.
        get().fetchModels();

        // Projects index + the last-open project.
        let projects: ProjectMeta[] = [];
        try {
          projects = JSON.parse(localStorage.getItem(LS.index) || "[]");
        } catch {}
        let projectId = localStorage.getItem(LS.current) || "";
        // Migrate the old single-project key if present.
        if (!projectId) {
          const legacy = localStorage.getItem("hivey.project.v1");
          projectId = uid();
          if (legacy) {
            localStorage.setItem(projectKey(projectId), legacy);
            localStorage.removeItem("hivey.project.v1");
          }
        }
        let files: FileMap = {};
        let memory: MemoryEntry[] = [];
        let template = "custom";
        let chat: ChatMsg[] = [];
        let securityFindings: SecurityFinding[] = [];
        let checkpoints: Checkpoint[] = [];
        try {
          const raw = localStorage.getItem(projectKey(projectId));
          if (raw) {
            const p = JSON.parse(raw) as { files?: FileMap; memory?: MemoryEntry[]; template?: string; chat?: ChatMsg[]; security?: SecurityFinding[]; checkpoints?: Checkpoint[] };
            files = p.files || {};
            memory = p.memory || [];
            template = p.template || "custom";
            chat = p.chat || [];
            securityFindings = p.security || [];
            checkpoints = p.checkpoints || [];
          }
        } catch {}
        set({ projects, projectId, files, baseline: { ...files }, checkpoints, memory, template, chat, securityFindings });

        // "Open a copy" from a read-only share → import the handed-off files into a fresh project.
        try {
          const pending = localStorage.getItem("hivey.pendingImport");
          if (pending) {
            localStorage.removeItem("hivey.pendingImport");
            const { files: impFiles } = JSON.parse(pending) as { name?: string; files?: FileMap };
            if (impFiles && Object.keys(impFiles).length) {
              get().newProject();
              get().setFiles(impFiles);
              const first = Object.keys(impFiles).find((p) => /App\.(t|j)sx?$/.test(p)) || Object.keys(impFiles)[0] || null;
              if (first) get().setActiveFile(first);
            }
          }
        } catch {}
      } catch {}
    },
  };
});

// Build the memory block injected into agent/terminal requests.
export function memoryBlock(): string {
  const mem = useStore.getState().memory;
  if (!mem.length) return "";
  return "[PROJECT MEMORY — durable facts about this project; honor them]\n" + mem.map((m) => `- ${m.text}`).join("\n");
}
