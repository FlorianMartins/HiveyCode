"use client";

import { useEffect, useState } from "react";
import { useStore } from "@/store/useStore";
import { gitLog, filesAtCommit, type GitCommit } from "@/lib/git";
import { GitCommitVertical, RotateCcw, RefreshCw } from "lucide-react";

const rel = (ts: number) => {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return new Date(ts).toLocaleDateString();
};

export function History() {
  const { setFiles, setActiveFile, snapshotBaseline, running, projectId } = useStore();
  const [log, setLog] = useState<GitCommit[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    setLoading(true);
    setLog(await gitLog(projectId));
    setLoading(false);
  };

  // Reload the log when a run finishes (a new commit) or the project changes.
  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, projectId]);

  const restore = async (oid: string) => {
    const files = await filesAtCommit(oid, projectId);
    if (Object.keys(files).length === 0) return;
    setFiles(files);
    snapshotBaseline();
    const first = Object.keys(files).find((p) => /App\.(t|j)sx?$/.test(p)) || Object.keys(files)[0];
    if (first) setActiveFile(first);
  };

  if (loading) return <div className="grid h-full place-items-center text-xs text-muted">Loading git history…</div>;

  if (log.length === 0) {
    return (
      <div className="grid h-full place-items-center px-6 text-center text-sm text-muted">
        Real Git history is empty. Every build and terminal edit becomes a commit here — restore any point.
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto p-3">
      <div className="mb-2 flex items-center gap-2 text-[11px] uppercase tracking-wide text-muted">
        <span>{log.length} commits · main</span>
        <button onClick={refresh} className="ml-auto text-muted hover:text-text" title="Refresh">
          <RefreshCw size={12} />
        </button>
      </div>
      <div className="relative ml-2 border-l border-border pl-4">
        {log.map((c) => (
          <div key={c.oid} className="group relative mb-3">
            <GitCommitVertical size={16} className="absolute -left-[26px] top-0 text-accent" />
            <div className="flex items-start gap-2 rounded-sm border border-border-soft bg-panel px-3 py-2">
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm text-text">{c.message || "(commit)"}</div>
                <div className="text-[11px] text-muted">
                  <span className="font-mono">{c.oid.slice(0, 7)}</span> · {rel(c.ts)} · {c.files} files
                </div>
              </div>
              <button
                onClick={() => restore(c.oid)}
                title="Restore the project to this commit"
                className="flex items-center gap-1 rounded-sm border border-border px-2 py-1 text-[11px] text-muted opacity-0 transition-opacity hover:text-text group-hover:opacity-100"
              >
                <RotateCcw size={12} /> Restore
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
