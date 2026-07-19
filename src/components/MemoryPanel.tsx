"use client";

import { useState } from "react";
import { useStore } from "@/store/useStore";
import { Brain, X, Plus, Sparkles } from "lucide-react";

// Slide-over drawer for the durable PROJECT MEMORY — facts injected into every agent/terminal
// request so the project keeps its goal, stack and conventions across turns and reloads.
export function MemoryDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { memory, addMemory, removeMemory } = useStore();
  const [draft, setDraft] = useState("");

  if (!open) return null;

  const add = () => {
    if (!draft.trim()) return;
    addMemory(draft.trim());
    setDraft("");
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40" />
      <div
        className="relative flex h-full w-[360px] flex-col border-l border-border bg-panel shadow-glow"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-border px-4 h-12">
          <Brain size={16} className="text-accent" />
          <span className="font-medium">Project memory</span>
          <button onClick={onClose} className="ml-auto text-muted hover:text-text" title="Close">
            <X size={16} />
          </button>
        </div>

        <p className="px-4 pt-3 text-xs text-muted">
          Durable facts the agents always know — goal, stack, conventions, decisions. Injected into every request.
        </p>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3 space-y-2">
          {memory.length === 0 && <div className="text-xs text-muted">No memory yet. Add a fact below.</div>}
          {memory.map((m) => (
            <div key={m.id} className="group flex items-start gap-2 rounded-sm border border-border-soft bg-tool px-3 py-2 text-sm">
              {m.auto && <Sparkles size={12} className="mt-1 shrink-0 text-accent" />}
              <span className="min-w-0 flex-1 break-words">{m.text}</span>
              <button
                onClick={() => removeMemory(m.id)}
                className="text-muted opacity-0 transition-opacity hover:text-red-400 group-hover:opacity-100"
                title="Remove"
              >
                <X size={13} />
              </button>
            </div>
          ))}
        </div>

        <div className="border-t border-border p-3">
          <div className="flex items-end gap-2 rounded bg-tool border border-border p-2 focus-within:border-accent">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  add();
                }
              }}
              rows={2}
              placeholder="e.g. Use Tailwind; brand color is #8b5cf6; keep it mobile-first"
              className="flex-1 resize-none bg-transparent text-sm text-text placeholder:text-muted outline-none"
            />
            <button onClick={add} className="grid h-8 w-8 shrink-0 place-items-center rounded-sm bg-hivey-grad text-on-accent">
              <Plus size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
