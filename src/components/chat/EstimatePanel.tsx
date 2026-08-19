"use client";

import type { EstimateData } from "@/store/useStore";

export function EstimatePanel({
  data,
  onApprove,
  onDecline,
}: {
  data: EstimateData;
  onApprove: () => void;
  onDecline: () => void;
}) {
  const money = (n: number) => (n < 0.01 ? "<$0.01" : `$${n.toFixed(2)}`);
  const range = data.low === data.high ? money(data.high) : `${money(data.low)} – ${money(data.high)}`;
  return (
    <div className="mt-2 rounded-xl border border-border bg-surface/60 p-3">
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span className="text-sm text-muted">Estimated cost</span>
        <span className="text-lg font-semibold text-text">{range}</span>
      </div>
      <p className="mt-1 text-xs leading-relaxed text-muted">{data.basis}</p>
      <ul className="mt-2 space-y-1">
        {data.lines.map((l) => (
          <li key={l.role} className="flex flex-wrap items-baseline justify-between gap-2 text-xs text-muted">
            <span className="min-w-0 truncate">
              <span className="text-text">{l.role}</span> · {l.model}
            </span>
            <span className="shrink-0 tabular-nums">
              ~{Math.round((l.promptTokens + l.completionTokens) / 1000)}k tok
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-muted">
        Nothing has been generated yet — declining costs you nothing.
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        <button
          onClick={onApprove}
          className="shrink-0 rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-white hover:opacity-90"
        >
          Build it
        </button>
        <button
          onClick={onDecline}
          className="shrink-0 rounded-lg border border-border px-3 py-1.5 text-sm text-muted hover:text-text"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
