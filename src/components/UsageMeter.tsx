"use client";

import { useState } from "react";
import { useStore } from "@/store/useStore";
import { Coins, ChevronDown, ChevronUp } from "lucide-react";

// Live token + $ cost readout for the current agent run, broken down per role — the visible proof
// of Hivey's "top result for less" DNA. Costs come straight from OpenRouter's usage accounting
// (real $, not an estimate). Local models report 0. Hidden until a run produces some usage.
const ROLE_LABEL: Record<string, string> = {
  planner: "Planner",
  coder: "Coder",
  reviewer: "Reviewer",
  debugger: "Debugger",
  tester: "Tester",
};

function fmtTokens(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return `${n}`;
}
function fmtCost(c: number): string {
  if (c === 0) return "$0";
  if (c < 0.01) return `$${c.toFixed(4)}`;
  return `$${c.toFixed(3)}`;
}

export function UsageMeter() {
  const usage = useStore((s) => s.runUsage);
  const running = useStore((s) => s.running);
  const [open, setOpen] = useState(false);

  const total = usage.prompt + usage.completion;
  const roles = Object.entries(usage.byRole);
  if (total === 0 && !running) return null;
  if (roles.length === 0) return null;

  return (
    <div className="mb-2 rounded-lg border border-border bg-panel/40 text-[11px]">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 px-2.5 py-1.5 text-muted transition-colors hover:text-text"
      >
        <Coins size={12} className="text-accent" />
        <span className="font-medium text-text">{fmtCost(usage.cost)}</span>
        <span className="text-muted">· {fmtTokens(total)} tok</span>
        {running && <span className="ml-1 h-1.5 w-1.5 animate-pulse rounded-full bg-accent" />}
        <span className="ml-auto">{open ? <ChevronUp size={12} /> : <ChevronDown size={12} />}</span>
      </button>
      {open && (
        <div className="border-t border-border px-2.5 py-1.5 space-y-1">
          {roles.map(([role, u]) => (
            <div key={role} className="flex items-center gap-2 tabular-nums">
              <span className="w-16 shrink-0 text-text">{ROLE_LABEL[role] || role}</span>
              <span className="text-muted">{fmtTokens(u.prompt)}→{fmtTokens(u.completion)} tok</span>
              <span className="ml-auto text-muted">{fmtCost(u.cost)}</span>
            </div>
          ))}
          <p className="pt-0.5 text-[10px] text-muted/80">
            Real cost from OpenRouter · cheap models on aux roles, strong model only where it counts.
          </p>
        </div>
      )}
    </div>
  );
}
