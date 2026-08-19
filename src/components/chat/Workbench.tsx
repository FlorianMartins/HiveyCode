"use client";

import { useStore } from "@/store/useStore";
import { useT } from "@/lib/i18n";
import { Loader2, Check, ChevronRight } from "lucide-react";

const WB_PHASES = [
  { key: "plan", label: "Plan" },
  { key: "code", label: "Code" },
  { key: "test", label: "Test" },
  { key: "fix", label: "Fix" },
];

export function Workbench() {
  const phase = useStore((s) => s.phase);
  const running = useStore((s) => s.running);
  const t = useT();
  if (!running || !phase) return null;
  const idx = WB_PHASES.findIndex((p) => p.key === phase);
  return (
    <div className="flex items-center gap-1.5 border-b border-border-soft bg-white/[0.015] px-3 py-1.5 text-[11px]">
      {WB_PHASES.map((p, i) => {
        const done = idx >= 0 && i < idx;
        const active = i === idx;
        return (
          <div key={p.key} className="flex items-center gap-1.5">
            <span className={`inline-flex items-center gap-1 ${active ? "font-medium text-accent" : done ? "text-text" : "text-muted/50"}`}>
              {active ? <Loader2 size={11} className="animate-spin" /> : done ? <Check size={11} className="text-accent" /> : <span className="grid h-[11px] w-[11px] place-items-center"><span className="h-1.5 w-1.5 rounded-full bg-current" /></span>}
              {t(`phase.${p.key}`, p.label)}
            </span>
            {i < WB_PHASES.length - 1 && <ChevronRight size={11} className="text-border" />}
          </div>
        );
      })}
    </div>
  );
}

// Live, collapsible reasoning block — shows the model THINKING in real time (so it's clearly not
// frozen), then auto-collapses once it starts writing. Not persisted across reloads.
