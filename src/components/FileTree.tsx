"use client";

import { useEffect, useMemo, useState } from "react";
import { useStore } from "@/store/useStore";
import { commitProject } from "@/lib/git";
import { lineDiff } from "@/lib/lineDiff";
import { useT } from "@/lib/i18n";
import { ChevronRight, ChevronDown, FileCode2, Folder, FolderOpen, FilePlus, FolderPlus, Pencil, Copy, Trash2 } from "lucide-react";

interface Node {
  name: string;
  path: string;
  dir: boolean;
  children: Node[];
}

function buildTree(paths: string[]): Node[] {
  const root: Node = { name: "", path: "", dir: true, children: [] };
  for (const p of paths) {
    const parts = p.split("/");
    let cur = root;
    parts.forEach((part, i) => {
      const isFile = i === parts.length - 1;
      const path = parts.slice(0, i + 1).join("/");
      let next = cur.children.find((c) => c.name === part && c.dir === !isFile);
      if (!next) {
        next = { name: part, path, dir: !isFile, children: [] };
        cur.children.push(next);
      }
      cur = next;
    });
  }
  const sort = (n: Node) => {
    n.children.sort((a, b) => (a.dir === b.dir ? a.name.localeCompare(b.name) : a.dir ? -1 : 1));
    n.children.forEach(sort);
  };
  sort(root);
  return root.children;
}

type Diff = { added: number; removed: number };
type Ctx = { x: number; y: number; path: string; dir: boolean } | null;

// A quiet git commit after any manual file operation, so the history reflects it.
const commitNow = (msg: string) => {
  const s = useStore.getState();
  commitProject(s.files, msg, s.projectId);
};

export function FileTree() {
  const { files, baseline, activeFile, setActiveFile, newFile, renamePath, deletePath, duplicatePath } = useStore();
  const tree = useMemo(() => buildTree(Object.keys(files)), [files]);
  const [ctx, setCtx] = useState<Ctx>(null);
  const t = useT();

  // Per-file +added / −removed line counts vs the run baseline (VS-Code-style). Hidden on .gitkeep etc.
  const diffs = useMemo(() => {
    const out: Record<string, Diff> = {};
    for (const [p, content] of Object.entries(files)) {
      const base = baseline[p];
      if (base === content) continue;
      const d = lineDiff(base ?? "", content);
      if (d.added || d.removed) out[p] = d;
    }
    return out;
  }, [files, baseline]);

  useEffect(() => {
    if (!ctx) return;
    const close = () => setCtx(null);
    window.addEventListener("click", close);
    window.addEventListener("scroll", close, true);
    return () => {
      window.removeEventListener("click", close);
      window.removeEventListener("scroll", close, true);
    };
  }, [ctx]);

  // ── operations (prompt-based, then commit) ──────────────────────────────────
  const createFile = (dir: string) => {
    const name = window.prompt("New file (relative path):", dir ? dir + "/" : "");
    if (name && name.trim()) {
      newFile(name.trim());
      commitNow("Create file " + name.trim());
    }
  };
  const createFolder = (dir: string) => {
    const name = window.prompt("New folder name:", "");
    if (name && name.trim()) {
      const path = (dir ? dir + "/" : "") + name.trim().replace(/\/+$/, "") + "/.gitkeep";
      newFile(path);
      commitNow("Create folder");
    }
  };
  const rename = (path: string) => {
    const np = window.prompt("Rename to:", path);
    if (np && np.trim() && np.trim() !== path) {
      renamePath(path, np.trim());
      commitNow("Rename " + path);
    }
  };
  const duplicate = (path: string) => {
    duplicatePath(path);
    commitNow("Duplicate " + path);
  };
  const del = (path: string) => {
    if (window.confirm(`Delete "${path}"${!files[path] ? " and everything inside" : ""}?`)) {
      deletePath(path);
      commitNow("Delete " + path);
    }
  };

  const onCtx = (e: React.MouseEvent, path: string, dir: boolean) => {
    e.preventDefault();
    e.stopPropagation();
    setCtx({ x: e.clientX, y: e.clientY, path, dir });
  };

  return (
    <div className="relative py-1.5" onContextMenu={(e) => onCtx(e, "", true)}>
      {tree.length === 0 && <div className="p-3 text-xs text-muted">No files yet.</div>}
      {tree.filter((n) => n.dir || n.name !== ".gitkeep").map((n) => (
        <TreeNode key={n.path} node={n} depth={0} activeFile={activeFile} diffs={diffs} onOpen={setActiveFile} onCtx={onCtx} />
      ))}

      {ctx && (
        <div
          className="fixed z-[200] min-w-[160px] overflow-hidden rounded-lg border border-border bg-panel py-1 shadow-glow backdrop-blur-xl"
          style={{ left: Math.min(ctx.x, window.innerWidth - 176), top: Math.min(ctx.y, window.innerHeight - 200) }}
          onClick={(e) => e.stopPropagation()}
        >
          {ctx.dir && <CtxItem icon={<FilePlus size={13} />} label={t("tree.newFile")} onClick={() => { setCtx(null); createFile(ctx.path); }} />}
          {ctx.dir && <CtxItem icon={<FolderPlus size={13} />} label={t("tree.newFolder")} onClick={() => { setCtx(null); createFolder(ctx.path); }} />}
          {ctx.path && <CtxItem icon={<Pencil size={13} />} label={t("tree.rename")} onClick={() => { setCtx(null); rename(ctx.path); }} />}
          {ctx.path && <CtxItem icon={<Copy size={13} />} label={t("tree.duplicate")} onClick={() => { setCtx(null); duplicate(ctx.path); }} />}
          {ctx.path && <CtxItem icon={<Trash2 size={13} />} label={t("tree.delete")} danger onClick={() => { setCtx(null); del(ctx.path); }} />}
        </div>
      )}
    </div>
  );
}

function CtxItem({ icon, label, onClick, danger }: { icon: React.ReactNode; label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-[12px] transition-colors hover:bg-tool ${danger ? "text-red-400" : "text-text"}`}
    >
      {icon}
      {label}
    </button>
  );
}

function DiffBadge({ d }: { d: Diff }) {
  return (
    <span className="ml-auto shrink-0 pl-1.5 text-[10px] tabular-nums">
      {d.added > 0 && <span className="text-green-400">+{d.added}</span>}
      {d.added > 0 && d.removed > 0 && " "}
      {d.removed > 0 && <span className="text-red-400">−{d.removed}</span>}
    </span>
  );
}

function TreeNode({
  node,
  depth,
  activeFile,
  diffs,
  onOpen,
  onCtx,
}: {
  node: Node;
  depth: number;
  activeFile: string | null;
  diffs: Record<string, Diff>;
  onOpen: (p: string) => void;
  onCtx: (e: React.MouseEvent, path: string, dir: boolean) => void;
}) {
  const [open, setOpen] = useState(depth < 2);
  const pad = { paddingLeft: 8 + depth * 12 };

  if (!node.dir) {
    return (
      <button
        onClick={() => onOpen(node.path)}
        onContextMenu={(e) => onCtx(e, node.path, false)}
        style={pad}
        className={`flex w-full items-center gap-1.5 py-1 pr-2 text-left text-xs transition-colors ${
          activeFile === node.path ? "bg-hivey-grad-soft text-text" : "text-muted hover:bg-tool hover:text-text"
        }`}
      >
        <FileCode2 size={13} className="shrink-0 opacity-70" />
        <span className="truncate">{node.name}</span>
        {diffs[node.path] && <DiffBadge d={diffs[node.path]} />}
      </button>
    );
  }

  return (
    <div>
      <button
        onClick={() => setOpen((o) => !o)}
        onContextMenu={(e) => onCtx(e, node.path, true)}
        style={pad}
        className="flex w-full items-center gap-1 py-1 pr-2 text-left text-xs text-muted transition-colors hover:text-text"
      >
        {open ? <ChevronDown size={12} className="shrink-0" /> : <ChevronRight size={12} className="shrink-0" />}
        {open ? <FolderOpen size={13} className="shrink-0 text-accent/80" /> : <Folder size={13} className="shrink-0 text-accent/80" />}
        <span className="truncate font-medium">{node.name}</span>
      </button>
      {open && node.children.filter((c) => c.dir || c.name !== ".gitkeep").map((c) => <TreeNode key={c.path} node={c} depth={depth + 1} activeFile={activeFile} diffs={diffs} onOpen={onOpen} onCtx={onCtx} />)}
    </div>
  );
}
