"use client";

import { DiffEditor } from "@monaco-editor/react";
import { useStore } from "@/store/useStore";
import { useMemo, useState } from "react";
import { FilePlus2, FilePen, FileMinus2 } from "lucide-react";

type Change = { path: string; kind: "added" | "modified" | "removed"; before: string; after: string };

const langOf = (p: string) =>
  /\.tsx?$/.test(p) ? "typescript" : /\.jsx?$/.test(p) ? "javascript" : /\.css$/.test(p) ? "css" : /\.html?$/.test(p) ? "html" : /\.json$/.test(p) ? "json" : "plaintext";

export function DiffView() {
  const { files, baseline } = useStore();

  const changes = useMemo<Change[]>(() => {
    const paths = new Set([...Object.keys(baseline), ...Object.keys(files)]);
    const out: Change[] = [];
    for (const p of paths) {
      const before = baseline[p] ?? "";
      const after = files[p] ?? "";
      if (before === after) continue;
      out.push({ path: p, before, after, kind: !(p in baseline) ? "added" : !(p in files) ? "removed" : "modified" });
    }
    return out.sort((a, b) => a.path.localeCompare(b.path));
  }, [files, baseline]);

  const [sel, setSel] = useState(0);
  const active = changes[Math.min(sel, changes.length - 1)];

  if (changes.length === 0) {
    return (
      <div className="grid h-full place-items-center px-6 text-center text-sm text-muted">
        No changes since the last build. Edits made by the agents show up here as a diff.
      </div>
    );
  }

  const Icon = active.kind === "added" ? FilePlus2 : active.kind === "removed" ? FileMinus2 : FilePen;

  return (
    <div className="flex h-full">
      <div className="w-56 shrink-0 overflow-y-auto border-r border-border bg-panel py-2">
        <div className="px-3 pb-2 text-[11px] uppercase tracking-wide text-muted">
          {changes.length} changed file{changes.length > 1 ? "s" : ""}
        </div>
        {changes.map((c, i) => {
          const I = c.kind === "added" ? FilePlus2 : c.kind === "removed" ? FileMinus2 : FilePen;
          const color = c.kind === "added" ? "text-emerald-400" : c.kind === "removed" ? "text-red-400" : "text-amber-400";
          return (
            <button
              key={c.path}
              onClick={() => setSel(i)}
              className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs transition-colors ${
                i === sel ? "bg-hivey-grad-soft text-text" : "text-muted hover:text-text hover:bg-tool"
              }`}
            >
              <I size={13} className={`shrink-0 ${color}`} />
              <span className="truncate">{c.path}</span>
            </button>
          );
        })}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 border-b border-border bg-tool px-3 h-8 text-xs text-muted">
          <Icon size={13} />
          <span className="truncate text-text">{active.path}</span>
          <span className="ml-auto">{active.kind}</span>
        </div>
        <div className="h-[calc(100%-2rem)]">
          <DiffEditor
            key={active.path}
            height="100%"
            theme="vs-dark"
            language={langOf(active.path)}
            original={active.before}
            modified={active.after}
            options={{
              readOnly: true,
              renderSideBySide: true,
              fontSize: 12,
              minimap: { enabled: false },
              scrollBeyondLastLine: false,
            }}
          />
        </div>
      </div>
    </div>
  );
}
