"use client";

import { useState } from "react";
import { useStore } from "@/store/useStore";
import { History, RotateCcw, Trash2, ChevronRight, ChevronDown, Bot, Save } from "lucide-react";

// Project checkpoints = full file snapshots. One is taken automatically before every agent run
// (safety net) and the user can save one on demand. Restoring rolls the files back — and the
// current state is itself snapshotted first, so a restore is always reversible.
function timeAgo(ts: number, now: number): string {
  const s = Math.max(0, Math.floor((now - ts) / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

export function Checkpoints() {
  const checkpoints = useStore((s) => s.checkpoints);
  const files = useStore((s) => s.files);
  const saveCheckpoint = useStore((s) => s.saveCheckpoint);
  const restoreCheckpoint = useStore((s) => s.restoreCheckpoint);
  const deleteCheckpoint = useStore((s) => s.deleteCheckpoint);
  const running = useStore((s) => s.running);
  const [open, setOpen] = useState(false);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const now = Date.now();

  const fileCount = Object.keys(files).length;

  // Count how many files differ between a checkpoint and the current project (added/removed/changed).
  const diffCount = (snap: Record<string, string>) => {
    const keys = new Set([...Object.keys(snap), ...Object.keys(files)]);
    let n = 0;
    for (const k of keys) if (snap[k] !== files[k]) n++;
    return n;
  };

  return (
    <div className="shrink-0 border-t border-border">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-1.5 px-2 h-8 text-[11px] font-medium uppercase tracking-wide text-muted transition-colors hover:text-text"
      >
        {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        <History size={12} />
        Checkpoints
        {checkpoints.length > 0 && <span className="rounded bg-tool px-1 text-[10px] tabular-nums">{checkpoints.length}</span>}
        <span
          role="button"
          title="Save a checkpoint of the current files"
          onClick={(e) => {
            e.stopPropagation();
            if (fileCount > 0) saveCheckpoint("Manual checkpoint", false);
          }}
          className={`ml-auto grid h-5 w-5 place-items-center rounded-md transition-colors ${fileCount > 0 && !running ? "hover:bg-panel hover:text-text" : "pointer-events-none opacity-40"}`}
        >
          <Save size={12} />
        </span>
      </button>

      {open && (
        <div className="max-h-52 overflow-y-auto px-1.5 pb-2">
          {checkpoints.length === 0 && (
            <p className="px-1.5 py-1 text-[11px] text-muted">
              None yet. A snapshot is taken automatically before each agent run.
            </p>
          )}
          {checkpoints.map((cp) => {
            const d = diffCount(cp.files);
            return (
              <div key={cp.id} className="group rounded-md px-1.5 py-1 transition-colors hover:bg-tool/60">
                <div className="flex items-center gap-1.5">
                  {cp.auto ? (
                    <Bot size={12} className="shrink-0 text-muted" />
                  ) : (
                    <Save size={12} className="shrink-0 text-muted" />
                  )}
                  <span className="min-w-0 flex-1 truncate text-[12px] text-text" title={cp.label}>
                    {cp.label}
                  </span>
                  <span className="shrink-0 text-[10px] tabular-nums text-muted">{timeAgo(cp.at, now)}</span>
                </div>
                <div className="mt-0.5 flex items-center gap-2 pl-[18px]">
                  <span className="text-[10px] text-muted">
                    {Object.keys(cp.files).length} files{d > 0 ? ` · ${d} changed since` : " · current"}
                  </span>
                  <div className="ml-auto flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                    <button
                      onClick={() => restoreCheckpoint(cp.id)}
                      disabled={running}
                      title="Restore the files to this checkpoint (reversible)"
                      className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] text-muted transition-colors hover:bg-panel hover:text-accent disabled:opacity-40"
                    >
                      <RotateCcw size={11} /> Restore
                    </button>
                    {confirmId === cp.id ? (
                      <button
                        onClick={() => { deleteCheckpoint(cp.id); setConfirmId(null); }}
                        className="rounded px-1.5 py-0.5 text-[10px] text-red-400 hover:bg-panel"
                      >
                        Sure?
                      </button>
                    ) : (
                      <button
                        onClick={() => setConfirmId(cp.id)}
                        title="Delete this checkpoint"
                        className="grid h-5 w-5 place-items-center rounded text-muted transition-colors hover:bg-panel hover:text-red-400"
                      >
                        <Trash2 size={11} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
