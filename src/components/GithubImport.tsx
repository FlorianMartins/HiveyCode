"use client";

import { useState } from "react";
import { importRepo, listBranches, parseRepo } from "@/lib/github";
import type { FileMap } from "@/agent/types";
import { X, GitBranch, KeyRound, Loader2 } from "lucide-react";

const TOKEN_KEY = "hivey.ghToken"; // GitHub PAT — stored only in this browser (BYOK, like the model keys)

// Import an existing GitHub repo — public OR private (with a personal-access token) — on any branch,
// so users can work on REAL code, not just greenfield. The token never leaves the browser.
export function GithubImport({ onImport, onClose }: { onImport: (files: FileMap, label: string) => void; onClose: () => void }) {
  const [url, setUrl] = useState("");
  const [token, setToken] = useState(() => (typeof localStorage !== "undefined" ? localStorage.getItem(TOKEN_KEY) || "" : ""));
  const [branches, setBranches] = useState<string[]>([]);
  const [branch, setBranch] = useState("");
  const [busy, setBusy] = useState(false);
  const [loadingBranches, setLoadingBranches] = useState(false);
  const [error, setError] = useState("");

  const persistToken = (v: string) => {
    setToken(v);
    try {
      if (v.trim()) localStorage.setItem(TOKEN_KEY, v.trim());
      else localStorage.removeItem(TOKEN_KEY);
    } catch {}
  };

  const loadBranches = async () => {
    if (!parseRepo(url)) { setError("Enter a valid GitHub repo URL first."); return; }
    setError("");
    setLoadingBranches(true);
    try {
      const list = await listBranches(url, token || undefined);
      setBranches(list);
      if (list.length && !branch) setBranch(parseRepo(url)?.branch || list.find((b) => b === "main" || b === "master") || list[0]);
    } finally {
      setLoadingBranches(false);
    }
  };

  const doImport = async () => {
    if (!parseRepo(url)) { setError("Enter a valid GitHub repo URL (https://github.com/owner/repo)."); return; }
    setError("");
    setBusy(true);
    try {
      const files = await importRepo(url, { token: token || undefined, branch: branch || undefined });
      const p = parseRepo(url)!;
      onImport(files, `${p.owner}/${p.repo}${branch ? `@${branch}` : ""}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] grid place-items-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative flex w-full max-w-md flex-col gap-4 overflow-hidden rounded-2xl border border-border bg-panel/90 p-5 shadow-glow backdrop-blur-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="pointer-events-none absolute -top-20 left-1/3 h-40 w-56 rounded-full bg-accent/20 blur-[90px]" />
        <div className="relative flex items-center gap-2">
          <GitBranch size={18} />
          <span className="font-semibold">Import a GitHub repo</span>
          <button onClick={onClose} className="ml-auto text-muted hover:text-text" title="Close">
            <X size={18} />
          </button>
        </div>

        <div className="relative space-y-3">
          <div>
            <label className="mb-1 block text-[11px] uppercase tracking-wide text-muted">Repository URL</label>
            <input
              autoFocus
              value={url}
              onChange={(e) => { setUrl(e.target.value); setBranches([]); setBranch(""); }}
              onKeyDown={(e) => e.key === "Enter" && doImport()}
              placeholder="https://github.com/owner/repo"
              className="w-full rounded-lg border border-border bg-tool px-3 py-2 text-sm outline-none focus:border-accent"
            />
          </div>

          <div>
            <label className="mb-1 flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-muted">
              <KeyRound size={11} /> Token (optional — for private repos)
            </label>
            <input
              type="password"
              value={token}
              onChange={(e) => persistToken(e.target.value)}
              placeholder="github_pat_… (read-only, stays in your browser)"
              className="w-full rounded-lg border border-border bg-tool px-3 py-2 text-xs outline-none focus:border-accent"
            />
          </div>

          <div>
            <label className="mb-1 flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-muted">
              <GitBranch size={11} /> Branch
            </label>
            <div className="flex items-center gap-2">
              {branches.length > 0 ? (
                <select
                  value={branch}
                  onChange={(e) => setBranch(e.target.value)}
                  className="flex-1 rounded-lg border border-border bg-tool px-3 py-2 text-sm outline-none focus:border-accent"
                >
                  {branches.map((b) => (
                    <option key={b} value={b}>{b}</option>
                  ))}
                </select>
              ) : (
                <input
                  value={branch}
                  onChange={(e) => setBranch(e.target.value)}
                  placeholder="default branch"
                  className="flex-1 rounded-lg border border-border bg-tool px-3 py-2 text-sm outline-none focus:border-accent"
                />
              )}
              <button
                onClick={loadBranches}
                disabled={loadingBranches}
                className="shrink-0 rounded-lg border border-border px-2.5 py-2 text-xs text-muted transition-colors hover:border-accent hover:text-text disabled:opacity-50"
              >
                {loadingBranches ? <Loader2 size={13} className="animate-spin" /> : "List"}
              </button>
            </div>
          </div>

          {error && <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-2.5 py-1.5 text-[11px] text-red-300">{error}</p>}

          <button
            onClick={doImport}
            disabled={busy}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-hivey-grad py-2.5 text-sm font-medium text-on-accent disabled:opacity-60"
          >
            {busy ? <><Loader2 size={15} className="animate-spin" /> Importing…</> : <>Import project</>}
          </button>
          <p className="text-[10px] text-muted">
            Text files only, up to 500 files. The token needs only read access and is stored solely in your browser.
          </p>
        </div>
      </div>
    </div>
  );
}
