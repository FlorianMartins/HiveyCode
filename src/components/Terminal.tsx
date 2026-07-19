"use client";

import { useEffect, useRef, useState } from "react";
import { useStore, memoryBlock } from "@/store/useStore";
import { commitProject } from "@/lib/git";
import { mcpListTools, mcpCallTool } from "@/lib/mcp";
import { newAbort, stopActive, isAbortError } from "@/lib/abort";
import { downloadProjectZip } from "@/lib/exportZip";
import { prepareLocalProject } from "@/lib/localRun";
import { Play, ExternalLink, Copy, Check } from "lucide-react";

type Line = { text: string; kind: "in" | "out" | "err" | "sys" | "ai" };

// Auto-detect the OS so we can show the right "open a terminal" hint (Windows / macOS / Linux).
function detectOS(): "windows" | "mac" | "linux" | "other" {
  if (typeof navigator === "undefined") return "other";
  const s = `${navigator.platform || ""} ${navigator.userAgent || ""}`.toLowerCase();
  if (/win/.test(s)) return "windows";
  if (/mac|iphone|ipad/.test(s)) return "mac";
  if (/linux|x11|android/.test(s)) return "linux";
  return "other";
}
const OS_TERMINAL: Record<string, string> = {
  windows: 'Windows: press ⊞ Win, type "PowerShell" (or use Windows Terminal), then run  cd path\\to\\hivey-project',
  mac: 'macOS: press ⌘ Space, type "Terminal", then run  cd ~/Downloads/hivey-project',
  linux: "Linux: open your terminal (Ctrl+Alt+T), then run  cd ~/Downloads/hivey-project",
  other: "Open a terminal in the unzipped hivey-project folder.",
};

const HELP = [
  "OpenClaude — coding agent in a terminal. Built-in commands:",
  "  help            this help",
  "  ls | tree       list project files",
  "  cat <file>      print a file",
  "  open <file>     open a file in the editor",
  "  rm <file>       delete a file",
  "  clear           clear the terminal",
  "  typecheck       real tsc type-check in a sandbox",
  "  build           real `vite build` in a sandbox",
  "  test            real `vitest run` in a sandbox",
  "  mcp …           connect MCP tool servers (mcp help)",
  "  refactor        improve structure/readability, then typecheck (no behavior change)",
  "  deploy          build & publish the app to a live URL",
  "  local           show the commands to run this app on YOUR machine (npm install && dev)",
  "",
  "Sandbox = ephemeral, network-less, isolated Docker container (your server stays safe).",
  "Anything else is sent to the OpenClaude agent, which can edit the project directly.",
  'e.g.  "add a dark mode toggle to the header"',
].join("\n");

const TASKS = new Set(["build", "test", "typecheck"]);

// Work out the exact commands + dev URL to run THIS project locally (full dev server on the user's
// machine — beyond the in-browser Sandpack preview). Detects the dev script, framework and port.
export function Terminal() {
  const { files, apiKey, variant, reasoning, setFile, setFiles, setActiveFile, snapshotBaseline, setRuntimeError, addMcpServer, removeMcpServer } =
    useStore();
  const [lines, setLines] = useState<Line[]>([
    { kind: "sys", text: "OpenClaude · code agent in a terminal (via OpenRouter). Type `help`." },
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [hist, setHist] = useState<string[]>([]);
  const [histIdx, setHistIdx] = useState(-1);
  const [localUrl, setLocalUrl] = useState("");
  const [localOpen, setLocalOpen] = useState(false); // show the local-run guide card
  const [copied, setCopied] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const LOCAL_CMDS = "npm install\nnpm run dev";

  // One-click "run locally": download a self-contained runnable project + show an OS-aware guide with
  // copyable commands. (A hosted web app can't run your machine's dev server, so we can't render the
  // localhost preview here — we make running it a 2-copy-paste operation instead.)
  const runLocal = async () => {
    const raw = useStore.getState().files;
    if (Object.keys(raw).length === 0) { push({ kind: "err", text: "No files to run yet — build something first." }); return; }
    const prepared = prepareLocalProject(raw);
    push({ kind: "sys", text: prepared.runnable ? "▸ Prepared a ready-to-run Vite + React project — downloading hivey-project.zip…" : "▸ Downloading the project…" });
    try {
      await downloadProjectZip(prepared.files, "hivey-project");
    } catch {
      push({ kind: "err", text: "Zip download failed — use the top-bar Export button instead." });
    }
    setLocalUrl(`http://localhost:${prepared.port}`);
    setLocalOpen(true);
    try { await navigator.clipboard.writeText(LOCAL_CMDS); } catch {}
    push({ kind: "sys", text: "✓ Downloaded + commands copied. See the guide below ↓ (the app opens automatically once the server starts)." });
  };
  const copyCmds = async () => {
    try { await navigator.clipboard.writeText(LOCAL_CMDS); setCopied(true); setTimeout(() => setCopied(false), 1600); } catch {}
  };

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [lines]);

  const push = (line: Line) => setLines((l) => [...l, line]);
  const appendToLast = (text: string) =>
    setLines((l) => {
      const last = l[l.length - 1];
      if (last && last.kind === "ai") return [...l.slice(0, -1), { ...last, text: last.text + text }];
      return [...l, { kind: "ai", text }];
    });

  const builtin = (raw: string): boolean => {
    const [cmd, ...rest] = raw.trim().split(/\s+/);
    const arg = rest.join(" ");
    switch (cmd) {
      case "help":
        push({ kind: "out", text: HELP });
        return true;
      case "clear":
        setLines([]);
        return true;
      case "ls":
      case "tree": {
        const ps = Object.keys(files).sort();
        push({ kind: "out", text: ps.length ? ps.join("\n") : "(empty project)" });
        return true;
      }
      case "cat": {
        if (!(arg in files)) push({ kind: "err", text: `cat: ${arg}: no such file` });
        else push({ kind: "out", text: files[arg].slice(0, 4000) });
        return true;
      }
      case "open": {
        if (!(arg in files)) push({ kind: "err", text: `open: ${arg}: no such file` });
        else {
          setActiveFile(arg);
          push({ kind: "sys", text: `opened ${arg} in the editor` });
        }
        return true;
      }
      case "rm": {
        if (!(arg in files)) push({ kind: "err", text: `rm: ${arg}: no such file` });
        else {
          const next = { ...files };
          delete next[arg];
          setFiles(next);
          push({ kind: "sys", text: `removed ${arg}` });
        }
        return true;
      }
      default:
        return false;
    }
  };

  // Real compile/run/test in the hardened server-side sandbox.
  const runTask = async (task: string) => {
    if (busy) return;
    setBusy(true);
    push({ kind: "sys", text: `running ${task} in an isolated sandbox…` });
    try {
      const res = await fetch("/api/run", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ task, files: useStore.getState().files }),
      });
      const r = await res.json();
      if (r.error) {
        push({ kind: "err", text: "✗ " + r.error });
      } else if (r.ok) {
        push({ kind: "sys", text: `✓ ${task} passed${r.durationMs ? ` (${(r.durationMs / 1000).toFixed(1)}s)` : ""}` });
        if (r.output) push({ kind: "out", text: r.output });
      } else {
        push({ kind: "err", text: `✗ ${task} failed${r.timedOut ? " (timed out)" : ""}` });
        if (r.output) push({ kind: "out", text: r.output });
        // Feed the real failure into the agent fix-loop (banner in the chat).
        setRuntimeError(`\`${task}\` failed:\n${r.output || "(no output)"}`);
      }
    } catch (e) {
      push({ kind: "err", text: "✗ " + (e instanceof Error ? e.message : String(e)) });
    } finally {
      setBusy(false);
    }
  };

  // MCP (Model Context Protocol) — connect external tool servers and call their tools.
  const MCP_HELP = [
    "mcp commands:",
    "  mcp add <name> <url>      register an MCP server (HTTP/SSE url)",
    "  mcp rm <name>             remove a server",
    "  mcp ls                    list configured servers",
    "  mcp tools [name]          list a server's tools",
    "  mcp call <name> <tool> [json]   call a tool with JSON args",
  ].join("\n");

  const runMcp = async (raw: string) => {
    const [, sub, ...rest] = raw.trim().split(/\s+/);
    if (!sub || sub === "help") return push({ kind: "out", text: MCP_HELP });

    if (sub === "add") {
      const [name, url] = rest;
      if (!name || !url) return push({ kind: "err", text: "usage: mcp add <name> <url>" });
      addMcpServer(name, url);
      return push({ kind: "sys", text: `added MCP server ${name} → ${url}` });
    }
    if (sub === "rm") {
      if (!rest[0]) return push({ kind: "err", text: "usage: mcp rm <name>" });
      removeMcpServer(rest[0]);
      return push({ kind: "sys", text: `removed ${rest[0]}` });
    }
    if (sub === "ls") {
      const list = useStore.getState().mcpServers;
      return push({ kind: "out", text: list.length ? list.map((s) => `${s.name}  ${s.url}`).join("\n") : "(no MCP servers)" });
    }

    const server = useStore.getState().mcpServers.find((s) => s.name === rest[0]);
    if (sub === "tools") {
      const srv = rest[0] ? server : useStore.getState().mcpServers[0];
      if (!srv) return push({ kind: "err", text: "no such server (mcp ls)" });
      setBusy(true);
      try {
        const tools = await mcpListTools(srv.url);
        push({ kind: "out", text: tools.length ? tools.map((t) => `- ${t.name}${t.description ? ` — ${t.description}` : ""}`).join("\n") : "(no tools)" });
      } catch (e) {
        push({ kind: "err", text: "✗ " + (e instanceof Error ? e.message : String(e)) });
      } finally {
        setBusy(false);
      }
      return;
    }
    if (sub === "call") {
      if (!server) return push({ kind: "err", text: "usage: mcp call <name> <tool> [json] — unknown server" });
      const tool = rest[1];
      if (!tool) return push({ kind: "err", text: "usage: mcp call <name> <tool> [json]" });
      let args: unknown = {};
      const jsonPart = raw.slice(raw.indexOf(tool) + tool.length).trim();
      if (jsonPart) {
        try {
          args = JSON.parse(jsonPart);
        } catch {
          return push({ kind: "err", text: "invalid JSON args" });
        }
      }
      setBusy(true);
      try {
        const out = await mcpCallTool(server.url, tool, args);
        push({ kind: "out", text: out });
      } catch (e) {
        push({ kind: "err", text: "✗ " + (e instanceof Error ? e.message : String(e)) });
      } finally {
        setBusy(false);
      }
      return;
    }
    push({ kind: "out", text: MCP_HELP });
  };

  // Build in the sandbox and publish the static site to a live URL (separate origin = safe).
  const runDeploy = async () => {
    if (busy) return;
    if (Object.keys(useStore.getState().files).length === 0) return push({ kind: "err", text: "nothing to deploy yet" });
    setBusy(true);
    push({ kind: "sys", text: "building & publishing (isolated sandbox)…" });
    try {
      const res = await fetch("/api/deploy", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ files: useStore.getState().files }),
      });
      const r = await res.json();
      if (r.ok && r.url) {
        push({ kind: "sys", text: `✓ deployed (${r.files} files)` });
        push({ kind: "out", text: r.url });
      } else {
        push({ kind: "err", text: "✗ deploy failed" });
        if (r.output || r.error) push({ kind: "out", text: r.output || r.error });
      }
    } catch (e) {
      push({ kind: "err", text: "✗ " + (e instanceof Error ? e.message : String(e)) });
    } finally {
      setBusy(false);
    }
  };

  const submit = async () => {
    const raw = input.trim();
    if (!raw || busy) return;
    setInput("");
    setHist((h) => [...h, raw]);
    setHistIdx(-1);
    push({ kind: "in", text: "$ " + raw });

    if (builtin(raw)) return;

    const cmd0 = raw.split(/\s+/)[0];
    if (TASKS.has(cmd0)) {
      await runTask(cmd0);
      return;
    }
    if (cmd0 === "mcp") {
      await runMcp(raw);
      return;
    }
    if (cmd0 === "deploy") {
      await runDeploy();
      return;
    }
    if (cmd0 === "local") {
      await runLocal();
      return;
    }

    if (!apiKey) {
      push({ kind: "err", text: "no OpenRouter key — add it top-right." });
      return;
    }

    const aiInput =
      cmd0 === "refactor"
        ? "Refactor the WHOLE project for readability, structure, naming and dead-code removal WITHOUT changing any behavior or visible output. Edit files with write_file, then run typecheck to confirm nothing broke. If typecheck goes red, fix it before finishing."
        : raw;

    setBusy(true);
    snapshotBaseline();
    try {
      const ctrl = newAbort();
      const res = await fetch("/api/terminal", {
        method: "POST",
        headers: { "content-type": "application/json" },
        signal: ctrl.signal,
        body: JSON.stringify({
          input: aiInput,
          files: useStore.getState().files,
          apiKey,
          variant,
          reasoning,
          memory: memoryBlock(),
          mcpServers: useStore.getState().mcpServers,
          keys: useStore.getState().keys,
        }),
      });
      if (!res.body) throw new Error("no stream");
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      let wrote = false;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const ls = buf.split("\n");
        buf = ls.pop() || "";
        for (const line of ls) {
          if (!line.trim()) continue;
          const ev = JSON.parse(line);
          if (ev.type === "token") appendToLast(ev.text);
          else if (ev.type === "tool") push({ kind: "sys", text: `> ${ev.detail}` });
          else if (ev.type === "tool_result") push({ kind: "sys", text: `   ↳ ${ev.summary}` });
          else if (ev.type === "file") {
            setFile(ev.path, ev.content);
            wrote = true;
          } else if (ev.type === "error") push({ kind: "err", text: "✗ " + ev.message });
        }
      }
      if (wrote) commitProject(useStore.getState().files, raw, useStore.getState().projectId); // auto-Git: real commit
    } catch (e) {
      if (isAbortError(e)) push({ kind: "sys", text: "⏹ stopped." });
      else push({ kind: "err", text: "✗ " + (e instanceof Error ? e.message : String(e)) });
    } finally {
      setBusy(false);
    }
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "Escape" && busy) {
      e.preventDefault();
      stopActive();
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      submit();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (!hist.length) return;
      const i = histIdx < 0 ? hist.length - 1 : Math.max(0, histIdx - 1);
      setHistIdx(i);
      setInput(hist[i]);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (histIdx < 0) return;
      const i = histIdx + 1;
      if (i >= hist.length) {
        setHistIdx(-1);
        setInput("");
      } else {
        setHistIdx(i);
        setInput(hist[i]);
      }
    }
  };

  const color = (k: Line["kind"]) =>
    k === "in" ? "text-accent" : k === "err" ? "text-red-400" : k === "sys" ? "text-muted" : k === "ai" ? "text-text" : "text-text";

  return (
    <div className="flex h-full flex-col bg-white/[0.01] font-mono text-[12.5px]" onClick={() => inputRef.current?.focus()}>
      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-2">
        {lines.map((l, i) => (
          <pre key={i} className={`whitespace-pre-wrap break-words ${color(l.kind)}`}>
            {l.text}
          </pre>
        ))}
        {busy && <pre className="text-muted">…</pre>}
        <div ref={endRef} />
      </div>
      {/* One-click local flow: download a runnable project + an OS-aware, copy-paste guide. */}
      <div className="flex items-center gap-2 border-t border-border px-3 py-1.5">
        <button
          onClick={() => void runLocal()}
          disabled={busy || Object.keys(files).length === 0}
          title="Download a ready-to-run project + the exact commands to launch it on your machine"
          className="inline-flex items-center gap-1.5 rounded-md border border-border px-2 py-1 text-[11px] text-text transition-colors hover:border-accent disabled:opacity-50"
        >
          <Play size={11} /> Run locally
        </button>
        {localOpen && (
          <>
            <button
              onClick={() => window.open(localUrl, "_blank", "noopener,noreferrer")}
              title={`Opens ${localUrl} — reachable once the dev server is running (it also opens automatically).`}
              className="inline-flex items-center gap-1.5 rounded-md bg-hivey-grad px-2.5 py-1 text-[11px] font-medium text-on-accent"
            >
              <ExternalLink size={11} /> Open {localUrl.replace(/^https?:\/\//, "")}
            </button>
            <button onClick={() => setLocalOpen(false)} className="ml-auto text-[11px] text-muted hover:text-text" title="Hide">✕</button>
          </>
        )}
      </div>
      {localOpen && (
        <div className="border-t border-border px-3 py-2 text-[11px]">
          <div className="mb-1.5 flex items-center gap-1.5 text-muted">
            <span className="font-medium text-text">Run it on your machine</span>
            <span className="rounded bg-tool px-1.5 py-0.5 text-[10px] uppercase tracking-wide">{detectOS()}</span>
          </div>
          <ol className="mb-2 ml-4 list-decimal space-y-0.5 text-muted">
            <li>Unzip <code className="rounded bg-tool px-1">hivey-project.zip</code>.</li>
            <li>{OS_TERMINAL[detectOS()]}</li>
            <li>Run the two commands below (already copied):</li>
          </ol>
          <div className="relative rounded-md border border-border bg-tool/60 p-2 pr-9 font-mono text-[11px] text-text">
            <div>npm install</div>
            <div>npm run dev</div>
            <button
              onClick={copyCmds}
              title="Copy commands"
              className="absolute right-1.5 top-1.5 grid h-6 w-6 place-items-center rounded text-muted transition-colors hover:bg-panel hover:text-text"
            >
              {copied ? <Check size={13} className="text-accent" /> : <Copy size={13} />}
            </button>
          </div>
          <p className="mt-1.5 text-[10px] text-muted/80">The dev server opens your browser automatically at {localUrl}. (A hosted app can't run your machine's server, so the live preview here is the in-app Preview tab.)</p>
        </div>
      )}
      <div className="flex items-center gap-2 border-t border-border px-3 py-2">
        <span className="text-accent">$</span>
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKey}
          spellCheck={false}
          autoComplete="off"
          placeholder={busy ? "running…" : "command or task…"}
          className="flex-1 bg-transparent font-mono text-[12.5px] text-text placeholder:text-muted outline-none"
        />
      </div>
    </div>
  );
}
