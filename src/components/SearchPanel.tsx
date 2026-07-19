"use client";

import { useMemo, useState } from "react";
import { useStore } from "@/store/useStore";
import { Search, Replace, CaseSensitive, Regex, ChevronRight, ChevronDown } from "lucide-react";

// Multi-file search & replace across the whole project (VS Code style). Matches jump the editor to
// the exact file+line; Replace all rewrites every occurrence.
type Match = { path: string; line: number; col: number; preview: string };

function buildRegex(query: string, useRegex: boolean, caseSensitive: boolean): RegExp | null {
  if (!query) return null;
  try {
    const src = useRegex ? query : query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(src, caseSensitive ? "g" : "gi");
  } catch {
    return null;
  }
}

export function SearchPanel() {
  const files = useStore((s) => s.files);
  const setFile = useStore((s) => s.setFile);
  const saveNow = useStore((s) => s.saveNow);
  const revealInEditor = useStore((s) => s.revealInEditor);

  const [query, setQuery] = useState("");
  const [replace, setReplace] = useState("");
  const [showReplace, setShowReplace] = useState(false);
  const [useRegex, setUseRegex] = useState(false);
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const { matches, total } = useMemo(() => {
    const re = buildRegex(query, useRegex, caseSensitive);
    const out: Match[] = [];
    if (!re) return { matches: out, total: 0 };
    for (const path of Object.keys(files).sort()) {
      const content = files[path];
      if (typeof content !== "string") continue;
      const lines = content.split("\n");
      for (let i = 0; i < lines.length; i++) {
        re.lastIndex = 0;
        let m: RegExpExecArray | null;
        while ((m = re.exec(lines[i])) !== null) {
          out.push({ path, line: i + 1, col: m.index + 1, preview: lines[i].trim().slice(0, 120) });
          if (m.index === re.lastIndex) re.lastIndex++; // avoid zero-width infinite loop
          if (out.length > 2000) return { matches: out, total: out.length };
        }
      }
    }
    return { matches: out, total: out.length };
  }, [files, query, useRegex, caseSensitive]);

  const byFile = useMemo(() => {
    const g: Record<string, Match[]> = {};
    for (const m of matches) (g[m.path] ||= []).push(m);
    return g;
  }, [matches]);

  const replaceAll = () => {
    const re = buildRegex(query, useRegex, caseSensitive);
    if (!re) return;
    let changed = 0;
    for (const path of Object.keys(files)) {
      const content = files[path];
      if (typeof content !== "string") continue;
      re.lastIndex = 0;
      if (!re.test(content)) continue;
      re.lastIndex = 0;
      const next = content.replace(re, replace);
      if (next !== content) { setFile(path, next); changed++; }
    }
    if (changed) saveNow();
  };

  const fileCount = Object.keys(byFile).length;

  return (
    <div className="flex h-full flex-col">
      <div className="space-y-1.5 border-b border-border p-2">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowReplace((v) => !v)}
            className="grid h-6 w-4 place-items-center text-muted hover:text-text"
            title={showReplace ? "Hide replace" : "Show replace"}
          >
            {showReplace ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
          </button>
          <div className="flex flex-1 items-center gap-1 rounded-md border border-border bg-tool px-2">
            <Search size={12} className="shrink-0 text-muted" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search all files"
              className="w-full bg-transparent py-1.5 text-xs outline-none"
            />
            <button
              onClick={() => setCaseSensitive((v) => !v)}
              title="Match case"
              className={`grid h-5 w-5 place-items-center rounded ${caseSensitive ? "bg-hivey-grad-soft text-accent" : "text-muted hover:text-text"}`}
            >
              <CaseSensitive size={13} />
            </button>
            <button
              onClick={() => setUseRegex((v) => !v)}
              title="Use regular expression"
              className={`grid h-5 w-5 place-items-center rounded ${useRegex ? "bg-hivey-grad-soft text-accent" : "text-muted hover:text-text"}`}
            >
              <Regex size={13} />
            </button>
          </div>
        </div>
        {showReplace && (
          <div className="flex items-center gap-1 pl-5">
            <div className="flex flex-1 items-center gap-1 rounded-md border border-border bg-tool px-2">
              <Replace size={12} className="shrink-0 text-muted" />
              <input
                value={replace}
                onChange={(e) => setReplace(e.target.value)}
                placeholder="Replace"
                className="w-full bg-transparent py-1.5 text-xs outline-none"
              />
            </div>
            <button
              onClick={replaceAll}
              disabled={!query || total === 0}
              title="Replace all across every file"
              className="rounded-md bg-hivey-grad px-2 py-1.5 text-[11px] font-medium text-on-accent disabled:opacity-40"
            >
              All
            </button>
          </div>
        )}
        {query && (
          <p className="pl-5 text-[10px] text-muted">
            {total === 0 ? "No results" : `${total} result${total > 1 ? "s" : ""} in ${fileCount} file${fileCount > 1 ? "s" : ""}`}
            {total > 2000 && " (capped)"}
          </p>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto py-1 text-xs">
        {Object.entries(byFile).map(([path, ms]) => (
          <div key={path}>
            <button
              onClick={() => setCollapsed((c) => ({ ...c, [path]: !c[path] }))}
              className="flex w-full items-center gap-1 px-2 py-1 text-left text-muted hover:text-text"
            >
              {collapsed[path] ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
              <span className="truncate text-text">{path.split("/").pop()}</span>
              <span className="truncate text-[10px] text-muted">{path.replace(/[^/]+$/, "").replace(/\/$/, "")}</span>
              <span className="ml-auto shrink-0 rounded bg-tool px-1 text-[10px] tabular-nums">{ms.length}</span>
            </button>
            {!collapsed[path] &&
              ms.map((m, i) => (
                <button
                  key={i}
                  onClick={() => revealInEditor(m.path, m.line)}
                  className="flex w-full items-baseline gap-2 px-2 py-0.5 pl-6 text-left hover:bg-tool/60"
                  title={`${m.path}:${m.line}`}
                >
                  <span className="shrink-0 text-[10px] tabular-nums text-muted">{m.line}</span>
                  <span className="truncate text-[11px] text-muted">{m.preview}</span>
                </button>
              ))}
          </div>
        ))}
      </div>
    </div>
  );
}
