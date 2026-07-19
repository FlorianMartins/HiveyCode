"use client";

import { useState } from "react";
import { useStore } from "@/store/useStore";
import { Plus, Trash2, FolderGit2, PanelLeft, Pencil, Check } from "lucide-react";

const rel = (ts: number) => {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return new Date(ts).toLocaleDateString();
};

// Bolt-style quick menu: new project + history of saved projects.
export function MenuDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { projects, projectId, newProject, openProject, deleteProject, renameProject } = useStore();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");

  const startRename = (id: string, name: string) => {
    setEditingId(id);
    setDraft(name);
  };
  const commitRename = () => {
    if (editingId && draft.trim()) renameProject(editingId, draft);
    setEditingId(null);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40" />
      <div className="relative flex h-full w-[300px] flex-col border-r border-border bg-panel shadow-glow" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 border-b border-border px-3 h-12">
          <button
            onClick={onClose}
            title="Close menu"
            className="grid h-8 w-8 place-items-center rounded-lg border border-accent/40 bg-hivey-grad-soft text-accent shadow-glow"
          >
            <PanelLeft size={18} />
          </button>
          <span className="font-semibold">
            Hivey <span className="bg-hivey-grad bg-clip-text text-transparent">Code</span>
          </span>
        </div>

        <div className="p-3">
          <button
            onClick={() => {
              newProject();
              onClose();
            }}
            className="flex w-full items-center gap-2 rounded-lg bg-hivey-grad px-3 py-2 text-sm font-medium text-on-accent"
          >
            <Plus size={16} /> New project
          </button>
        </div>

        <div className="px-4 pb-1 text-[11px] uppercase tracking-wide text-muted">Recent projects</div>
        <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
          {projects.length === 0 && <div className="px-2 py-3 text-xs text-muted">No projects yet — build something!</div>}
          {projects.map((p) => (
            <div
              key={p.id}
              className={`group flex items-center gap-2 rounded-lg px-2 py-2 text-sm transition-colors ${
                p.id === projectId ? "bg-hivey-grad-soft text-text" : "text-muted hover:bg-tool hover:text-text"
              }`}
            >
              <FolderGit2 size={14} className="shrink-0 text-accent" />
              {editingId === p.id ? (
                <input
                  autoFocus
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") commitRename();
                    else if (e.key === "Escape") setEditingId(null);
                  }}
                  onBlur={commitRename}
                  className="min-w-0 flex-1 rounded-md border border-accent bg-tool px-1.5 py-1 text-sm text-text outline-none"
                />
              ) : (
                <button
                  onClick={() => {
                    openProject(p.id);
                    onClose();
                  }}
                  onDoubleClick={() => startRename(p.id, p.name)}
                  className="min-w-0 flex-1 text-left"
                >
                  <div className="truncate">{p.name}</div>
                  <div className="text-[11px] text-muted">{rel(p.updatedAt)}</div>
                </button>
              )}
              {editingId === p.id ? (
                <button onMouseDown={(e) => e.preventDefault()} onClick={commitRename} className="text-accent" title="Save name">
                  <Check size={14} />
                </button>
              ) : (
                <button
                  onClick={() => startRename(p.id, p.name)}
                  className="text-muted opacity-0 transition-opacity hover:text-text group-hover:opacity-100"
                  title="Rename project"
                >
                  <Pencil size={13} />
                </button>
              )}
              <button
                onClick={() => deleteProject(p.id)}
                className="text-muted opacity-0 transition-opacity hover:text-red-400 group-hover:opacity-100"
                title="Delete project"
              >
                <Trash2 size={13} />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
