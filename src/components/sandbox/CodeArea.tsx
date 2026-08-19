"use client";

import { useEffect, useRef, useState } from "react";
import { useStore } from "@/store/useStore";
import { buildImport, filesFromInput, filesFromDataTransfer } from "@/lib/importFiles";
import { CodeEditor } from "../Editor";
import { FileTree } from "../FileTree";
import { SearchPanel } from "../SearchPanel";
import { Checkpoints } from "../Checkpoints";
import { Search, FilePlus, Upload, X } from "lucide-react";

export function Empty({ text }: { text: string }) {
  return <div className="grid h-full place-items-center px-6 text-center text-sm text-muted">{text}</div>;
}

export function CodeArea() {
  const { openFiles, activeFile, setActiveFile, closeFile, addFiles, newFile } = useStore();
  const [dragOver, setDragOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const [leftTab, setLeftTab] = useState<"files" | "search">("files");
  const importRef = useRef<HTMLInputElement>(null);
  // Command palette → "Search in files" opens the multi-file search in the left panel.
  useEffect(() => {
    const onSearch = () => setLeftTab("search");
    window.addEventListener("hivey:open-search", onSearch);
    return () => window.removeEventListener("hivey:open-search", onSearch);
  }, []);

  // Import files/folder/zip INTO the current project (merge, don't wipe). New files are instantly in
  // the store → available to the agents (context) and the Sandpack preview.
  const merge = async (fileList: File[]) => {
    if (!fileList.length || busy) return;
    setBusy(true);
    try {
      const { files, assets, skipped } = await buildImport(fileList);
      addFiles(files);
      if (skipped.length) window.alert(`Added ${Object.keys(files).length} file(s)` + (assets.length ? ` + ${assets.length} asset(s)` : "") + `. Skipped ${skipped.length} (too large / unsupported).`);
    } catch (e) {
      window.alert("Import failed: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex h-full">
      <input ref={importRef} type="file" multiple className="hidden" onChange={(e) => { merge(filesFromInput(e.currentTarget)); e.currentTarget.value = ""; }} />
      <div
        className={`relative flex w-56 shrink-0 flex-col overflow-hidden border-r border-border bg-panel/50 ${dragOver ? "ring-2 ring-inset ring-accent" : ""}`}
        onDragOver={(e) => { e.preventDefault(); if (!dragOver) setDragOver(true); }}
        onDragLeave={(e) => { if (e.currentTarget === e.target) setDragOver(false); }}
        onDrop={async (e) => { e.preventDefault(); setDragOver(false); merge(await filesFromDataTransfer(e.dataTransfer)); }}
      >
        <div className="flex items-center gap-1.5 border-b border-border px-2 h-8 shrink-0">
          <button
            onClick={() => setLeftTab("files")}
            className={`text-[11px] font-medium uppercase tracking-wide ${leftTab === "files" ? "text-text" : "text-muted hover:text-text"}`}
          >
            Files
          </button>
          <button
            onClick={() => setLeftTab("search")}
            title="Search across all files (multi-file find & replace)"
            className={`grid h-5 w-5 place-items-center rounded-md ${leftTab === "search" ? "bg-hivey-grad-soft text-accent" : "text-muted hover:bg-panel hover:text-text"}`}
          >
            <Search size={13} />
          </button>
          <button
            onClick={() => {
              const name = window.prompt("New file (name — extension optional, like VS Code):", "");
              if (name && name.trim()) newFile(name.trim());
            }}
            disabled={busy}
            title="New empty file (extension optional)"
            className="ml-auto grid h-5 w-5 place-items-center rounded-md text-muted transition-colors hover:bg-panel hover:text-text disabled:opacity-50"
          >
            <FilePlus size={13} />
          </button>
          <button
            onClick={() => importRef.current?.click()}
            disabled={busy}
            title="Add files or a folder to this project (or drag & drop here)"
            className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] text-muted transition-colors hover:bg-panel hover:text-text disabled:opacity-50"
          >
            <Upload size={12} /> Add
          </button>
        </div>
        {leftTab === "files" ? (
          <>
            <div className="min-h-0 flex-1 overflow-y-auto">
              <FileTree />
            </div>
            <Checkpoints />
          </>
        ) : (
          <div className="min-h-0 flex-1 overflow-hidden">
            <SearchPanel />
          </div>
        )}
        {dragOver && (
          <div className="pointer-events-none absolute inset-0 grid place-items-center bg-hivey-grad-soft/60 text-[11px] font-medium text-text backdrop-blur-sm">
            Drop to add
          </div>
        )}
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        {openFiles.length > 0 && (
          <div className="flex h-8 shrink-0 items-center overflow-x-auto border-b border-border bg-panel/40">
            {openFiles.map((p) => (
              <div
                key={p}
                onClick={() => setActiveFile(p)}
                className={`group flex h-full shrink-0 cursor-pointer items-center gap-1.5 border-r border-border px-3 text-xs transition-colors ${
                  activeFile === p ? "bg-panel text-text" : "text-muted hover:text-text"
                }`}
              >
                <span className="max-w-[140px] truncate">{p.split("/").pop()}</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    closeFile(p);
                  }}
                  className="opacity-0 transition-opacity hover:text-text group-hover:opacity-100"
                >
                  <X size={11} />
                </button>
              </div>
            ))}
          </div>
        )}
        <div className="min-h-0 flex-1">
          <CodeEditor />
        </div>
      </div>
    </div>
  );
}

// Transient Sandpack/nodebox infrastructure hiccups that are NOT the user's app failing — they fire
// on their own (esp. when the tab is backgrounded or the bundler restarts) and must not be surfaced
