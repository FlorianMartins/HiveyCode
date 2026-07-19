"use client";

import {
  SandpackProvider,
  SandpackPreview,
  useSandpack,
  type SandpackPreviewRef,
} from "@codesandbox/sandpack-react";
import { useStore } from "@/store/useStore";
import { useAgent } from "@/hooks/useAgent";
import { getTemplate } from "@/agent/templates";
import { usePersistentNumber } from "@/lib/uiPrefs";
import { buildImport, filesFromInput, filesFromDataTransfer } from "@/lib/importFiles";
import { injectInspector } from "@/lib/inspector";
import { CodeEditor } from "./Editor";
import { FileTree } from "./FileTree";
import { SearchPanel } from "./SearchPanel";
import { Checkpoints } from "./Checkpoints";
import { DiffView } from "./DiffView";
import { History } from "./History";
import { Terminal } from "./Terminal";
import { SecurityPanel } from "./SecurityPanel";
import { Splitter } from "./Splitter";
import { useEffect, useMemo, useRef, useState } from "react";

// Silence the harmless nodebox/xterm noise ("clearScreenDown is not yet implemented…") that the
// Sandpack preview emits while the dev server boots — it clutters the browser console for no reason.
if (typeof window !== "undefined" && !(window as unknown as { __hiveyConsolePatched?: boolean }).__hiveyConsolePatched) {
  (window as unknown as { __hiveyConsolePatched?: boolean }).__hiveyConsolePatched = true;
  const noisy = /clearScreenDown is not yet implemented|Please file an issue on GitHub if you rely on this feature/i;
  (["error", "warn", "log"] as const).forEach((m) => {
    const orig = console[m].bind(console);
    console[m] = (...args: unknown[]) => {
      if (args.some((a) => typeof a === "string" && noisy.test(a))) return;
      orig(...(args as []));
    };
  });
}
import {
  Code2,
  Eye,
  Monitor,
  Smartphone,
  RotateCw,
  GitCompareArrows,
  GitBranch,
  Terminal as TerminalIcon,
  SquareTerminal,
  MousePointer2,
  SquareDashed,
  ChevronsDownUp,
  ChevronsUpDown,
  Trash2,
  Wrench,
  AlertTriangle,
  Upload,
  FilePlus,
  Search,
  ShieldCheck,
  X,
} from "lucide-react";

type TopTab = "preview" | "code" | "diff" | "history" | "security";
type BottomTab = "terminal" | "console";

// Preview bundler URL. The react-ts template uses Sandpack's LEGACY iframe bundler (postMessage, NO
// service worker) → it already works in Firefox, unlike the nodebox runtime. By DEFAULT we let Sandpack
// use its own hosted bundler (functional; the CORS/telemetry console noise from it is harmless).
// A self-hosted bundler (built from github.com/codesandbox/sandpack-bundler, served by Caddy at
// deploys.hivey.be/_sandpack/ — a separate origin from the BYOK key) can be opted into by setting
// NEXT_PUBLIC_SANDPACK_BUNDLER_URL once verified in a browser. undefined → Sandpack's default bundler.
const SANDPACK_BUNDLER_URL = process.env.NEXT_PUBLIC_SANDPACK_BUNDLER_URL || undefined;

// STABLE object identities for SandpackProvider. Recreating `options`/`style` inline on every render
// made the provider re-initialise the client each time SandboxBody re-rendered (e.g. when the booting
// overlay toggled `previewReady`) → the preview rendered for ~1s then rebooted, in a loop. Hoisting
// them to module constants keeps the client alive across re-renders. (`files`/`customSetup` are memoised.)
const SP_OPTIONS = { initMode: "immediate" as const, recompileMode: "delayed" as const, recompileDelay: 600, bundlerURL: SANDPACK_BUNDLER_URL };
const SP_STYLE = { height: "100%" } as const;

// The full IDE workspace: project area on top (Preview/Code/Diff/History), and a VSCode-style
// bottom panel (Console ↔ OpenClaude terminal), all inside ONE persistent Sandpack instance.
export function SandboxBody() {
  const files = useStore((s) => s.files);
  const { inspectMode, setInspectMode } = useStore();
  const previewNonce = useStore((s) => s.previewNonce);
  const codeNonce = useStore((s) => s.codeNonce);
  const tpl = getTemplate(useStore((s) => s.template));
  const canPreview = tpl.preview;
  const [top, setTop] = useState<TopTab>("code");
  const [previewReady, setPreviewReady] = useState(false);
  const [bottom, setBottom] = useState<BottomTab>("terminal");
  const [bottomOpen, setBottomOpen] = useState(true);
  const [bottomH, setBottomH] = usePersistentNumber("hivey.ui.bottomH", 300);

  // Give Sandpack the app files but REPLACE the project's package.json — a generated one often pins a
  // toolchain (vite, react-scripts…) that fights the in-browser bundler. The legacy CRA bundler needs a
  // package.json that (a) points `main` at the real entry (/index.tsx) and (b) lists the runtime deps.
  // We keep the project's runtime dependencies but drop its toolchain/devDeps. The store still keeps the
  // full package.json for the editor and the server-side runner.
  const { spFiles, customDeps, entry } = useMemo(() => {
    const out: Record<string, string> = {};
    let deps: Record<string, string> = { "lucide-react": "^0.460.0", "framer-motion": "^11.11.0", clsx: "^2.1.1" };
    for (const [path, content] of Object.entries(files)) {
      const clean = path.replace(/^\//, "");
      if (clean === "package.json") {
        try {
          const pj = JSON.parse(content) as { dependencies?: Record<string, string> };
          if (pj.dependencies) deps = { ...deps, ...pj.dependencies };
        } catch {}
        continue; // deps go through customSetup (ONE source) — a package.json here would fight it → reload loop
      }
      out["/" + clean] = content;
    }
    // Adapt the VITE-shaped project to Sandpack's LEGACY (create-react-app) bundler — which, unlike the
    // nodebox runtime, needs no service worker so it works in Firefox. The CRA bundler serves its HTML
    // from /public/index.html and injects the JS entry itself, so relocate the root index.html there and
    // strip the `<script type="module" src="/index.tsx">` (the entry is declared via customSetup.entry).
    if (out["/index.html"] && !out["/public/index.html"]) {
      out["/public/index.html"] = out["/index.html"].replace(/\s*<script[^>]*type="module"[^>]*><\/script>/i, "");
      delete out["/index.html"];
    }
    // React comes from the bundler env; pin a bundler-friendly version, drop the vite/CRA toolchain deps.
    deps = { react: "^18.3.1", "react-dom": "^18.3.1", ...deps };
    for (const k of ["vite", "typescript", "esbuild-wasm", "react-scripts", "@vitejs/plugin-react"]) delete deps[k];
    const entry = out["/index.tsx"] ? "/index.tsx" : out["/src/index.tsx"] ? "/src/index.tsx" : out["/index.jsx"] ? "/index.jsx" : "/index.tsx";
    // Guarantee Tailwind loads in the PREVIEW even for older projects whose entry predates the loader,
    // and regardless of whether the bundler executes <script> tags in index.html — insert the CDN loader
    // right after the entry's imports (a self-contained statement, valid ESM position).
    if (out[entry] && !/tailwindcss\.com/.test(out[entry])) {
      const loader = `if(typeof document!=="undefined"&&!document.querySelector('script[src*="tailwindcss.com"]')){var __tw=document.createElement("script");__tw.src="https://cdn.tailwindcss.com";document.head.appendChild(__tw);}`;
      const lines = out[entry].split("\n");
      let lastImport = -1;
      for (let i = 0; i < lines.length; i++) if (/^\s*import\s/.test(lines[i])) lastImport = i;
      if (lastImport >= 0) lines.splice(lastImport + 1, 0, "", loader, "");
      else lines.unshift(loader);
      out[entry] = lines.join("\n");
    }
    return { spFiles: injectInspector(out), customDeps: deps, entry };
  }, [files]);

  const hasFiles = Object.keys(files).length > 0;
  // Stable customSetup identity (only changes when the resolved deps/entry change) so re-renders don't
  // reboot the Sandpack client — see SP_OPTIONS above.
  const spCustomSetup = useMemo(() => ({ dependencies: customDeps, entry }), [customDeps, entry]);

  const pick = (m: "select" | "zone") => {
    setTop("preview");
    setInspectMode(inspectMode === m ? "off" : m);
  };
  useEffect(() => {
    if (inspectMode !== "off") setTop("preview");
  }, [inspectMode]);
  // If the current stack has no preview, never sit on the (now-hidden) Preview tab.
  useEffect(() => {
    if (!canPreview) setTop((t) => (t === "preview" ? "code" : t));
  }, [canPreview]);
  // When a build finishes, jump to the live preview so the user sees the running app immediately —
  // but only for stacks that HAVE a browser preview (code stacks stay on the editor).
  useEffect(() => {
    if (previewNonce > 0) setTop(canPreview ? "preview" : "code");
  }, [previewNonce, canPreview]);
  // When a run starts, jump to the Code tab so the user watches the files being written live.
  useEffect(() => {
    if (codeNonce > 0) setTop("code");
  }, [codeNonce]);

  return (
    <SandpackProvider
      template={tpl.sandpack as React.ComponentProps<typeof SandpackProvider>["template"]}
      theme="dark"
      files={spFiles}
      customSetup={spCustomSetup}
      options={SP_OPTIONS}
      style={SP_STYLE}
    >
      <ErrorWatcher />
      <PreviewRefresher />
      <PreviewReadyWatcher onChange={setPreviewReady} />
      <div className="flex h-full flex-col">
        {/* ── top tab bar ── */}
        <div className="flex items-center gap-1 border-b border-border bg-white/[0.015] px-2 h-10 shrink-0 backdrop-blur-md">
          <Tab active={top === "code"} onClick={() => setTop("code")} icon={<Code2 size={14} />} label="Code" />
          <Tab active={top === "diff"} onClick={() => setTop("diff")} icon={<GitCompareArrows size={14} />} label="Diff" />
          <Tab active={top === "history"} onClick={() => setTop("history")} icon={<GitBranch size={14} />} label="History" />
          <Tab active={top === "security"} onClick={() => setTop("security")} icon={<ShieldCheck size={14} />} label="Security" />
          {canPreview && <Tab active={top === "preview"} onClick={() => setTop("preview")} icon={<Eye size={14} />} label="Preview" />}
          {canPreview ? (
            <div className="ml-auto flex items-center gap-1">
              <Tool active={inspectMode === "select"} onClick={() => pick("select")} icon={<MousePointer2 size={15} />} label="Select an element" />
              <Tool active={inspectMode === "zone"} onClick={() => pick("zone")} icon={<SquareDashed size={15} />} label="Select a zone" />
            </div>
          ) : (
            <span className="ml-auto truncate text-[11px] text-muted">No live preview for {tpl.label} — edit &amp; export (run via the terminal)</span>
          )}
        </div>

        {/* ── top content (preview stays mounted so the sandbox keeps running) ── */}
        <div className="relative min-h-0 flex-1">
          {canPreview && (
            <div className={top === "preview" ? "h-full" : "hidden"}>
              {hasFiles ? <PreviewPane ready={previewReady} /> : <Empty text="Your app's live preview will appear here." />}
            </div>
          )}
          {top === "code" && (hasFiles ? <CodeArea /> : <Empty text="Files will appear here once the agents build." />)}
          {top === "diff" && <DiffView />}
          {top === "history" && <History />}
          {top === "security" && <SecurityPanel />}
        </div>

        {/* ── bottom panel: Console ↔ OpenClaude (VSCode-style), resizable ── */}
        <div className="flex shrink-0 flex-col border-t border-border">
          {bottomOpen && <Splitter dir="y" reverse onDelta={(d) => setBottomH((h) => Math.min(window.innerHeight * 0.75, Math.max(120, h - d)))} />}
          <div className="flex items-center gap-1 bg-white/[0.015] px-2 h-9 backdrop-blur-md">
            <Tab active={bottomOpen && bottom === "terminal"} onClick={() => { setBottom("terminal"); setBottomOpen(true); }} icon={<SquareTerminal size={14} />} label="OpenClaude" title="OpenClaude — an AI coding agent you chat with in a terminal (edits your project). Different from the Console, which just shows logs." />
            <Tab active={bottomOpen && bottom === "console"} onClick={() => { setBottom("console"); setBottomOpen(true); }} icon={<TerminalIcon size={14} />} label="Logs" title="Logs — command output (build / install / test) and errors from your app. Read-only (server/dev-server noise filtered out)." />
            <button
              onClick={() => setBottomOpen((o) => !o)}
              title={bottomOpen ? "Collapse panel" : "Expand panel"}
              className="ml-auto grid h-7 w-7 place-items-center rounded-sm text-muted hover:bg-panel hover:text-text"
            >
              {bottomOpen ? <ChevronsDownUp size={15} /> : <ChevronsUpDown size={15} />}
            </button>
          </div>
          {bottomOpen && (
            <div style={{ height: bottomH }} className="min-h-[120px]">
              <div className={bottom === "console" ? "h-full" : "hidden"}>
                <ProjectConsole />
              </div>
              <div className={bottom === "terminal" ? "h-full" : "hidden"}>
                <Terminal />
              </div>
            </div>
          )}
        </div>
      </div>
    </SandpackProvider>
  );
}

function Empty({ text }: { text: string }) {
  return <div className="grid h-full place-items-center px-6 text-center text-sm text-muted">{text}</div>;
}

function CodeArea() {
  const { openFiles, activeFile, setActiveFile, closeFile, addFiles, newFile } = useStore();
  const [dragOver, setDragOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const [leftTab, setLeftTab] = useState<"files" | "search">("files");
  const importRef = useRef<HTMLInputElement>(null);
  // Command palette → "Search in files" opens the multi-file search in the left panel.
  useEffect(() => {
    const onSearch = () => setLeftTab("search");
    window.addEventListener("hivey:open-search", onSearch);
    return () => window.removeEventListener("hivey:open-search", onSearch);
  }, []);

  // Import files/folder/zip INTO the current project (merge, don't wipe). New files are instantly in
  // the store → available to the agents (context) and the Sandpack preview.
  const merge = async (fileList: File[]) => {
    if (!fileList.length || busy) return;
    setBusy(true);
    try {
      const { files, assets, skipped } = await buildImport(fileList);
      addFiles(files);
      if (skipped.length) window.alert(`Added ${Object.keys(files).length} file(s)` + (assets.length ? ` + ${assets.length} asset(s)` : "") + `. Skipped ${skipped.length} (too large / unsupported).`);
    } catch (e) {
      window.alert("Import failed: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex h-full">
      <input ref={importRef} type="file" multiple className="hidden" onChange={(e) => { merge(filesFromInput(e.currentTarget)); e.currentTarget.value = ""; }} />
      <div
        className={`relative flex w-56 shrink-0 flex-col overflow-hidden border-r border-border bg-panel/50 ${dragOver ? "ring-2 ring-inset ring-accent" : ""}`}
        onDragOver={(e) => { e.preventDefault(); if (!dragOver) setDragOver(true); }}
        onDragLeave={(e) => { if (e.currentTarget === e.target) setDragOver(false); }}
        onDrop={async (e) => { e.preventDefault(); setDragOver(false); merge(await filesFromDataTransfer(e.dataTransfer)); }}
      >
        <div className="flex items-center gap-1.5 border-b border-border px-2 h-8 shrink-0">
          <button
            onClick={() => setLeftTab("files")}
            className={`text-[11px] font-medium uppercase tracking-wide ${leftTab === "files" ? "text-text" : "text-muted hover:text-text"}`}
          >
            Files
          </button>
          <button
            onClick={() => setLeftTab("search")}
            title="Search across all files (multi-file find & replace)"
            className={`grid h-5 w-5 place-items-center rounded-md ${leftTab === "search" ? "bg-hivey-grad-soft text-accent" : "text-muted hover:bg-panel hover:text-text"}`}
          >
            <Search size={13} />
          </button>
          <button
            onClick={() => {
              const name = window.prompt("New file (name — extension optional, like VS Code):", "");
              if (name && name.trim()) newFile(name.trim());
            }}
            disabled={busy}
            title="New empty file (extension optional)"
            className="ml-auto grid h-5 w-5 place-items-center rounded-md text-muted transition-colors hover:bg-panel hover:text-text disabled:opacity-50"
          >
            <FilePlus size={13} />
          </button>
          <button
            onClick={() => importRef.current?.click()}
            disabled={busy}
            title="Add files or a folder to this project (or drag & drop here)"
            className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] text-muted transition-colors hover:bg-panel hover:text-text disabled:opacity-50"
          >
            <Upload size={12} /> Add
          </button>
        </div>
        {leftTab === "files" ? (
          <>
            <div className="min-h-0 flex-1 overflow-y-auto">
              <FileTree />
            </div>
            <Checkpoints />
          </>
        ) : (
          <div className="min-h-0 flex-1 overflow-hidden">
            <SearchPanel />
          </div>
        )}
        {dragOver && (
          <div className="pointer-events-none absolute inset-0 grid place-items-center bg-hivey-grad-soft/60 text-[11px] font-medium text-text backdrop-blur-sm">
            Drop to add
          </div>
        )}
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        {openFiles.length > 0 && (
          <div className="flex h-8 shrink-0 items-center overflow-x-auto border-b border-border bg-panel/40">
            {openFiles.map((p) => (
              <div
                key={p}
                onClick={() => setActiveFile(p)}
                className={`group flex h-full shrink-0 cursor-pointer items-center gap-1.5 border-r border-border px-3 text-xs transition-colors ${
                  activeFile === p ? "bg-panel text-text" : "text-muted hover:text-text"
                }`}
              >
                <span className="max-w-[140px] truncate">{p.split("/").pop()}</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    closeFile(p);
                  }}
                  className="opacity-0 transition-opacity hover:text-text group-hover:opacity-100"
                >
                  <X size={11} />
                </button>
              </div>
            ))}
          </div>
        )}
        <div className="min-h-0 flex-1">
          <CodeEditor />
        </div>
      </div>
    </div>
  );
}

// Transient Sandpack/nodebox infrastructure hiccups that are NOT the user's app failing — they fire
// on their own (esp. when the tab is backgrounded or the bundler restarts) and must not be surfaced
// as "Runtime error in the preview".
const SANDBOX_NOISE = /failed to get shell|shell by id|nodebox|bundler .*reset|dangerouslyreset|iframe .*not (loaded|ready)|command failed with a non-zero|listener|is read-only/i;

function ErrorWatcher() {
  const { sandpack } = useSandpack();
  const setRuntimeError = useStore((s) => s.setRuntimeError);
  const raw = sandpack.error?.message || null;
  const err = raw && SANDBOX_NOISE.test(raw) ? null : raw;
  useEffect(() => {
    setRuntimeError(err);
  }, [err, setRuntimeError]);
  return null;
}

// When a build finishes, force Sandpack to recompile the FINAL files and reload the preview iframe —
// otherwise it can stay on a stale/errored intermediate state (from the mid-stream partial files) and
// the user has to refresh manually.
function PreviewRefresher() {
  const { sandpack } = useSandpack();
  const previewNonce = useStore((s) => s.previewNonce);
  const running = useStore((s) => s.running);
  useEffect(() => {
    if (previewNonce === 0) return;
    // Recompile ONCE, a beat after the run settled so the final files have propagated store → Sandpack.
    // (An earlier SECOND pass at 1.5s was resetting an already-rendered preview back to a white screen —
    // that's what forced a manual reload.)
    const t = setTimeout(() => { try { sandpack.runSandpack(); } catch {} }, 450);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previewNonce, running]);
  return null;
}

// Always-mounted (even off the Preview tab) so it reliably catches the dev-server "done" event — a
// listener attached only when the Preview tab opens can miss a "done" that already fired.
function PreviewReadyWatcher({ onChange }: { onChange: (ready: boolean) => void }) {
  const { listen } = useSandpack();
  useEffect(() => {
    let graceTimer: ReturnType<typeof setTimeout> | undefined;
    const unsub = listen((msg: { type?: string }) => {
      if (msg.type === "start") {
        clearTimeout(graceTimer);
        onChange(false);
      } else if (msg.type === "done" || msg.type === "success" || msg.type === "urlchange") {
        // The bundler says "done" a beat BEFORE the app actually paints inside the iframe — hiding the
        // overlay immediately shows a brief WHITE flash. A short grace delay bridges that gap.
        clearTimeout(graceTimer);
        graceTimer = setTimeout(() => onChange(true), 550);
      }
    });
    const failsafe = setTimeout(() => onChange(true), 12000);
    return () => { unsub(); clearTimeout(graceTimer); clearTimeout(failsafe); };
  }, [listen, onChange]);
  return null;
}

function PreviewPane({ ready }: { ready: boolean }) {
  const { inspectMode, setInspectMode, setSelection } = useStore();
  const { dispatch } = useSandpack();
  const ref = useRef<SandpackPreviewRef>(null);
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  const mobile = device === "mobile";

  useEffect(() => {
    const send = () => {
      const iframe = ref.current?.getClient()?.iframe;
      iframe?.contentWindow?.postMessage({ source: "hivey-cmd", mode: inspectMode }, "*");
    };
    send();
    const t = setTimeout(send, 400);
    return () => clearTimeout(t);
  }, [inspectMode]);

  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      const d = e.data;
      if (!d || d.source !== "hivey-inspector") return;
      if (d.type === "cancel") return setInspectMode("off");
      if (d.type === "pick" && d.payload) {
        const p = d.payload;
        setSelection({
          kind: "element",
          label: `<${p.tag}>${p.id ? "#" + p.id : ""}`,
          detail:
            `Selected element: <${p.tag}>` +
            (p.id ? ` id="${p.id}"` : "") +
            (p.classes ? ` class="${p.classes}"` : "") +
            `\nCSS selector: ${p.selector}` +
            (p.text ? `\nText: "${p.text}"` : "") +
            `\nSize: ${p.rect.w}x${p.rect.h}px`,
        });
        setInspectMode("off");
      }
      if (d.type === "zone" && d.payload) {
        const els = (d.payload.elements || []).filter(Boolean);
        setSelection({
          kind: "zone",
          label: `zone · ${els.length} element${els.length > 1 ? "s" : ""}`,
          detail:
            `Selected a zone (${d.payload.rect.w}x${d.payload.rect.h}px) containing:\n` +
            els.map((p: { tag: string; selector: string; text: string }) => `- <${p.tag}> ${p.selector}${p.text ? ` — "${p.text}"` : ""}`).join("\n"),
        });
        setInspectMode("off");
      }
    };
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, [setInspectMode, setSelection]);

  return (
    <div className="relative h-full">
      {/* Device switch: desktop ↔ mobile. Only the wrappers' styling changes — the SandpackPreview
          stays mounted (same element + ref), so the running sandbox is never rebooted. */}
      <div className="absolute right-3 top-3 z-20 flex items-center gap-1.5">
        {/* In MOBILE the phone frame hides Sandpack's navigator, so its refresh would float INSIDE
            the frame — we disable it (showRefreshButton={false}) and put our own refresh OUT here.
            In desktop the navigator keeps its own refresh, so we don't duplicate it. */}
        {mobile && (
          <button onClick={() => dispatch({ type: "refresh" })} title="Reload preview"
            className="rounded-lg border border-white/10 bg-[#1a1a22]/90 p-1.5 text-white/50 shadow-lg backdrop-blur transition-colors hover:text-white"><RotateCw size={15} /></button>
        )}
        <div className="flex rounded-lg border border-white/10 bg-[#1a1a22]/90 p-0.5 shadow-lg backdrop-blur">
          <button onClick={() => setDevice("desktop")} title="Desktop view" aria-pressed={!mobile}
            className={`rounded-md p-1.5 transition-colors ${!mobile ? "bg-accent text-white" : "text-white/50 hover:text-white"}`}><Monitor size={15} /></button>
          <button onClick={() => setDevice("mobile")} title="Mobile view" aria-pressed={mobile}
            className={`rounded-md p-1.5 transition-colors ${mobile ? "bg-accent text-white" : "text-white/50 hover:text-white"}`}><Smartphone size={15} /></button>
        </div>
      </div>
      <div className={mobile ? "flex h-full items-center justify-center overflow-auto bg-[#0b0b0f] p-4" : "h-full"}>
        <div className={mobile ? "h-full max-h-[820px] w-[390px] max-w-full shrink-0 overflow-hidden rounded-[26px] border-[7px] border-[#26262e] bg-black shadow-2xl" : "h-full w-full"}>
          <SandpackPreview ref={ref} showNavigator={!mobile} showRefreshButton={false} showOpenInCodeSandbox={false} style={{ height: "100%" }} />
        </div>
      </div>
      {!ready && (
        // The Sandpack preview is always dark (theme="dark"), so this overlay is FIXED dark too —
        // otherwise, in a light app theme, its text rendered dark ("black") over the dark preview.
        <div className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 bg-[#0f0f14]">
          <div className="pointer-events-none absolute left-1/2 top-1/3 h-56 w-72 -translate-x-1/2 rounded-full bg-accent/15 blur-[100px]" />
          <div className="relative h-9 w-9 animate-spin rounded-full border-2 border-white/15 border-t-accent" />
          <div className="relative flex items-center gap-1.5 text-sm text-white/60">
            <span className="font-medium text-white/90">Booting preview</span>
            <span className="inline-flex gap-0.5">
              <span className="h-1 w-1 animate-bounce rounded-full bg-accent [animation-delay:-0.2s]" />
              <span className="h-1 w-1 animate-bounce rounded-full bg-accent [animation-delay:-0.1s]" />
              <span className="h-1 w-1 animate-bounce rounded-full bg-accent" />
            </span>
          </div>
          <div className="relative text-[11px] text-white/45">Installing dependencies &amp; starting the dev server…</div>
        </div>
      )}
    </div>
  );
}

function Tab({ active, onClick, icon, label, title }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string; title?: string }) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={`relative flex h-full items-center gap-1.5 px-3 text-xs transition-colors ${
        active ? "text-text" : "text-muted hover:text-text"
      }`}
    >
      {icon}
      {label}
      {active && <span className="absolute inset-x-2 -bottom-px h-[2px] rounded-full bg-hivey-grad shadow-glow" />}
    </button>
  );
}

// ── Console (logs) ─────────────────────────────────────────────────────────────────────────────
// A focused console: it keeps ONLY the useful CLIENT output — automated command output (build /
// install / test: vite / tsc / vitest / npm) and ERRORS (console.error + runtime stderr) — and
// drops the server/infra noise (dev-server startup, HMR, nodebox/WebContainer internals, verbose
// console.log/info/debug). Each error row has a "Fix with AI" button that hands that exact error to
// the currently-selected model (mainly for Fast mode, which has no auto test→debug loop).
type ConsoleLevel = "cmd" | "err" | "error";
interface ConsoleLine {
  id: number;
  level: ConsoleLevel;
  text: string;
}

// Dev-server / bundler / container noise to drop from stdout "out".
// PURE noise = harmless nodebox/xterm chatter that is NEVER useful — dropped from EVERY stream,
// including stderr (that's why "clearScreenDown is not yet implemented…" kept showing: it arrives on
// stderr, which bypasses the infra filter below).
const PURE_NOISE = /is not yet implemented\. Please file an issue on GitHub|Please file an issue on GitHub if you rely on this feature|^\s*$/i;
// INFRA chatter = dev-server/build progress. Dropped only for NON-error output — never used to filter
// real errors (an app error that happens to mention "vite"/"reload"/"compiled" must still show).
const SERVER_NOISE =
  /vite\s+v?\d|ready in|\bLocal:|\bNetwork:|press h to|\bhmr\b|\[hmr\]|hot update|hmr update|\[vite\]|nodebox|webcontainer|watching for (file|change)|server (re)?start|optimiz(ing|ed) dependencies|re-optimizing|forced re-optimization|page reload|reloading|➜|dev server|listening on|Port \d|dependencies installed|added \d+ packages|found 0 vulnerabilities|npm warn|deprecated|compil(ing|ed)|transform(ing|ed)?|modules transformed|built in |gzip:|bundling|esbuild|rollup|wss?:\/\/|websocket|sockjs|waiting for|no issues found/i;

const stripAnsi = (s: string) => s.replace(/\u001b\[[0-9;?=]*[A-Za-z]/g, "").replace(/\u001b[=>NOc]/g, "");
const safeStr = (d: unknown) => {
  try {
    return typeof d === "string" ? d : JSON.stringify(d);
  } catch {
    return String(d);
  }
};

function ProjectConsole() {
  const { listen } = useSandpack();
  const { fixIssue } = useAgent();
  const running = useStore((s) => s.running);
  const [lines, setLines] = useState<ConsoleLine[]>([]);
  const idRef = useRef(0);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const push = (level: ConsoleLevel, text: string) =>
      setLines((ls) => [...ls.slice(-400), { id: ++idRef.current, level, text }]);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const unsub = listen((msg: any) => {
      if (msg?.type === "start") return setLines([]); // resetOnPreviewRestart
      if (msg?.type === "stdout" && msg.payload?.data != null) {
        const text = stripAnsi(String(msg.payload.data)).replace(/\s+$/, "");
        if (!text.trim() || PURE_NOISE.test(text)) return; // pure noise dropped even on stderr
        const isErr = msg.payload.type === "err";
        if (!isErr && SERVER_NOISE.test(text)) return; // infra chatter dropped for non-errors only
        push(isErr ? "err" : "cmd", text);
      } else if (msg?.type === "console" && Array.isArray(msg.log)) {
        for (const l of msg.log) {
          if (l.method !== "error") continue; // keep ONLY errors from the app's console
          const text = stripAnsi((l.data || []).map(safeStr).join(" ")).trim();
          // Show EVERY real error — only drop the harmless pure-noise lines (never the infra filter,
          // which was hiding legit errors that merely mentioned "vite"/"reload"/"compiled"…).
          if (text && !PURE_NOISE.test(text)) push("error", text);
        }
      }
    });
    return unsub;
  }, [listen]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [lines]);

  const errorCount = lines.filter((l) => l.level !== "cmd").length;

  return (
    <div className="flex h-full flex-col bg-white/[0.01]">
      <div className="flex items-center gap-2 border-b border-border px-3 h-8 text-[11px]">
        <span className="font-medium text-muted">Logs</span>
        {errorCount > 0 && (
          <span className="inline-flex items-center gap-1 rounded-full bg-red-500/15 px-1.5 py-0.5 text-[10px] font-medium text-red-400">
            <AlertTriangle size={10} /> {errorCount}
          </span>
        )}
        <button
          onClick={() => setLines([])}
          title="Clear console"
          className="ml-auto grid h-6 w-6 place-items-center rounded-md text-muted transition-colors hover:bg-panel hover:text-text"
        >
          <Trash2 size={13} />
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-auto px-3 py-2 font-mono text-[11.5px] leading-relaxed">
        {lines.length === 0 && (
          <div className="text-muted">No logs yet. Command output (build / install / test) and errors will appear here.</div>
        )}
        {lines.map((l) => (
          <div key={l.id} className="group flex items-start gap-2 py-0.5">
            <pre className={`min-w-0 flex-1 whitespace-pre-wrap break-words ${l.level === "cmd" ? "text-text/80" : "text-red-400"}`}>{l.text}</pre>
            {l.level !== "cmd" && (
              <button
                onClick={() => fixIssue(l.text)}
                disabled={running}
                title="Fix this error with the selected model"
                className="shrink-0 rounded-md bg-hivey-grad px-1.5 py-0.5 text-[10px] font-medium text-on-accent opacity-0 transition-opacity group-hover:opacity-100 disabled:opacity-40"
              >
                <span className="inline-flex items-center gap-1">
                  <Wrench size={10} /> Fix
                </span>
              </button>
            )}
          </div>
        ))}
        <div ref={endRef} />
      </div>
    </div>
  );
}

function Tool({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      title={label}
      onClick={onClick}
      className={`grid h-7 w-7 place-items-center rounded-sm transition-colors ${
        active ? "bg-hivey-grad text-on-accent" : "text-muted hover:text-text hover:bg-panel"
      }`}
    >
      {icon}
    </button>
  );
}
