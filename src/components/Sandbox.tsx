"use client";

import { SandpackProvider } from "@codesandbox/sandpack-react";
import { useStore } from "@/store/useStore";
import { getTemplate } from "@/agent/templates";
import { usePersistentNumber } from "@/lib/uiPrefs";
import { injectInspector } from "@/lib/inspector";
import { DiffView } from "./DiffView";
import { History } from "./History";
import { Terminal } from "./Terminal";
import { SecurityPanel } from "./SecurityPanel";
import { CodeArea, Empty } from "./sandbox/CodeArea";
import { PreviewPane, ErrorWatcher, PreviewRefresher, PreviewReadyWatcher } from "./sandbox/PreviewPane";
import { Tab } from "./sandbox/Tab";
import { ProjectConsole } from "./sandbox/ProjectConsole";
import { Tool } from "./sandbox/Tool";
import { Splitter } from "./Splitter";
import { useEffect, useMemo, useState } from "react";

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
import { Code2, Eye, GitCompareArrows, GitBranch, Terminal as TerminalIcon, SquareTerminal, MousePointer2, SquareDashed, ChevronsDownUp, ChevronsUpDown, ShieldCheck } from "lucide-react";

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
