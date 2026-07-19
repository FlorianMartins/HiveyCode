"use client";

import { useEffect, useState } from "react";
import { useStore } from "@/store/useStore";
import { useAgent } from "@/hooks/useAgent";
import { Markdown } from "./Markdown";
import { ClipboardList, Play, X, Pencil, Eye } from "lucide-react";

// Plan-before-build review: the architect's plan is shown here for the user to read, EDIT, then
// approve — only then does the coder run. More control, fewer wasted tokens.
export function PlanReview() {
  const pendingPlan = useStore((s) => s.pendingPlan);
  const running = useStore((s) => s.running);
  const { approvePlan, cancelPlan } = useAgent();
  const [draft, setDraft] = useState(pendingPlan || "");
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    setDraft(pendingPlan || "");
    setEditing(false);
  }, [pendingPlan]);

  if (!pendingPlan) return null;

  return (
    <div className="mb-2 rounded-xl border border-[color-mix(in_srgb,var(--accent)_40%,transparent)] bg-panel/60 p-3 shadow-glow">
      <div className="mb-2 flex items-center gap-2 text-xs font-medium text-text">
        <ClipboardList size={14} className="text-accent" />
        Review the plan before building
        <button
          onClick={() => setEditing((v) => !v)}
          className="ml-auto inline-flex items-center gap-1 rounded-md border border-border px-1.5 py-0.5 text-[11px] text-muted transition-colors hover:border-accent hover:text-text"
          title={editing ? "Preview" : "Edit the plan"}
        >
          {editing ? <><Eye size={11} /> Preview</> : <><Pencil size={11} /> Edit</>}
        </button>
      </div>

      {editing ? (
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={10}
          className="w-full resize-y rounded-lg border border-border bg-tool px-3 py-2 text-xs text-text outline-none focus:border-accent"
        />
      ) : (
        <div className="max-h-64 overflow-y-auto rounded-lg border border-border bg-tool/40 px-3 py-2">
          <Markdown>{draft}</Markdown>
        </div>
      )}

      <div className="mt-2 flex items-center gap-2">
        <button
          onClick={() => approvePlan(draft)}
          disabled={running}
          className="flex items-center gap-1.5 rounded-lg bg-hivey-grad px-3 py-1.5 text-sm font-medium text-on-accent disabled:opacity-60"
        >
          <Play size={14} /> Build this plan
        </button>
        <button
          onClick={cancelPlan}
          disabled={running}
          className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm text-muted transition-colors hover:border-accent hover:text-text disabled:opacity-50"
        >
          <X size={14} /> Cancel
        </button>
        {running && <span className="text-[11px] text-muted">Planning…</span>}
      </div>
    </div>
  );
}
