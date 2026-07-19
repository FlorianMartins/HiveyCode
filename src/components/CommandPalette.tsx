"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useStore } from "@/store/useStore";
import { useAgent } from "@/hooks/useAgent";
import {
  Command, FilePlus, FolderPlus, ShieldCheck, ScanSearch, Search as SearchIcon,
  Settings as SettingsIcon, FileCode2, CornerDownLeft,
} from "lucide-react";

// Command palette (Ctrl/Cmd+K): fast keyboard access to actions + quick-open any project file.
type Cmd = { id: string; label: string; hint?: string; icon: typeof Command; run: () => void };

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const files = useStore((s) => s.files);
  const newProject = useStore((s) => s.newProject);
  const setFile = useStore((s) => s.setFile);
  const setActiveFile = useStore((s) => s.setActiveFile);
  const revealInEditor = useStore((s) => s.revealInEditor);
  const requestCode = useStore((s) => s.requestCode);
  const running = useStore((s) => s.running);
  const { scanSecurity, deepScan } = useAgent();

  // Global Ctrl/Cmd+K toggle.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      } else if (e.key === "Escape") {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (open) { setQ(""); setSel(0); setTimeout(() => inputRef.current?.focus(), 0); }
  }, [open]);

  const close = () => setOpen(false);
  const emit = (name: string) => window.dispatchEvent(new CustomEvent(name));

  const actions: Cmd[] = useMemo(() => [
    { id: "newfile", label: "New file", hint: "create", icon: FilePlus, run: () => {
      const name = window.prompt("New file (name — extension optional):", "");
      if (name && name.trim()) { setFile(name.trim(), ""); setActiveFile(name.trim()); requestCode(); }
    } },
    { id: "newproject", label: "New project", hint: "reset", icon: FolderPlus, run: () => newProject() },
    { id: "search", label: "Search in files", hint: "find & replace", icon: SearchIcon, run: () => { requestCode(); emit("hivey:open-search"); } },
    { id: "scan", label: "Security scan (AI)", hint: running ? "busy" : "audit", icon: ShieldCheck, run: () => !running && scanSecurity() },
    { id: "deepscan", label: "Deep scan (npm audit + semgrep)", hint: running ? "busy" : "runner", icon: ScanSearch, run: () => !running && deepScan() },
    { id: "settings", label: "Open settings", icon: SettingsIcon, run: () => emit("hivey:open-settings") },
  ], [running, newProject, scanSecurity, deepScan, setFile, setActiveFile, requestCode]);

  const fileCmds: Cmd[] = useMemo(
    () => Object.keys(files).sort().map((p) => ({ id: "file:" + p, label: p, hint: "open", icon: FileCode2, run: () => revealInEditor(p, 1) })),
    [files, revealInEditor],
  );

  const results = useMemo(() => {
    const all = [...actions, ...fileCmds];
    const f = q.trim().toLowerCase();
    if (!f) return all.slice(0, 40);
    return all.filter((c) => c.label.toLowerCase().includes(f)).slice(0, 40);
  }, [q, actions, fileCmds]);

  useEffect(() => { if (sel >= results.length) setSel(0); }, [results, sel]);

  if (!open) return null;

  const pick = (i: number) => { const c = results[i]; if (!c) return; close(); c.run(); };

  return (
    <div className="fixed inset-0 z-[70] flex items-start justify-center p-4 pt-[12vh]" onClick={close}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div
        className="relative flex w-full max-w-lg flex-col overflow-hidden rounded-xl border border-border bg-panel/95 shadow-glow backdrop-blur-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-border px-3 py-2.5">
          <Command size={15} className="text-muted" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => { setQ(e.target.value); setSel(0); }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") { e.preventDefault(); setSel((s) => Math.min(results.length - 1, s + 1)); }
              else if (e.key === "ArrowUp") { e.preventDefault(); setSel((s) => Math.max(0, s - 1)); }
              else if (e.key === "Enter") { e.preventDefault(); pick(sel); }
            }}
            placeholder="Type a command or file…"
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted"
          />
          <kbd className="rounded border border-border px-1.5 py-0.5 text-[10px] text-muted">Esc</kbd>
        </div>
        <div className="max-h-[50vh] overflow-y-auto py-1">
          {results.length === 0 && <p className="px-3 py-4 text-center text-xs text-muted">No matches</p>}
          {results.map((c, i) => {
            const Icon = c.icon;
            return (
              <button
                key={c.id}
                onMouseEnter={() => setSel(i)}
                onClick={() => pick(i)}
                className={`flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm ${i === sel ? "bg-hivey-grad-soft text-text" : "text-muted"}`}
              >
                <Icon size={14} className={i === sel ? "text-accent" : ""} />
                <span className="min-w-0 flex-1 truncate">{c.label}</span>
                {c.hint && <span className="shrink-0 text-[10px] text-muted">{c.hint}</span>}
                {i === sel && <CornerDownLeft size={12} className="shrink-0 text-muted" />}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
