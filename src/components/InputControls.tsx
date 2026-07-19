"use client";

import { useMemo, useState } from "react";
import { useStore } from "@/store/useStore";
import { VARIANT_LABELS } from "@/agent/models";
import type { HiveyVariant } from "@/agent/types";
import { modelScore, scoreColor, costLabel, priceTier } from "@/lib/benchmarks";
import { Popover } from "./Popover";
import { ChevronDown, Search, Check, Target, Tag, ArrowDownUp, ArrowDownWideNarrow, ArrowUpWideNarrow, MessageCircleQuestion } from "lucide-react";

const HIVEY_KEYS = Object.keys(VARIANT_LABELS) as HiveyVariant[];

const MODES = [
  { value: "auto", label: "Auto", desc: "Picks fast for small edits, deep for real builds." },
  { value: "fast", label: "Fast", desc: "One direct pass (bolt-style) — instant & cheap." },
  { value: "deep", label: "Deep", desc: "Full agentic pipeline: scope features → code → test → complete." },
] as const;

// HiveyCode builds apps → rank/label models by their CODE benchmark score.
const CATEGORY = "code";

const pill = "pill flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1 text-[12px] text-text hover:border-accent hover:bg-white/[0.05]";

export function InputControls({ hideAsk = false }: { hideAsk?: boolean }) {
  const { variant, setVariant, mode, setMode } = useStore();
  const askMode = useStore((s) => s.askMode);
  const setAskMode = useStore((s) => s.setAskMode);

  const currentModelLabel = (variant in VARIANT_LABELS ? VARIANT_LABELS[variant as HiveyVariant] : variant.split("/").pop()) || variant;
  const currentMode = MODES.find((m) => m.value === mode) || MODES[0];

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {/* ASK — kept at the FAR LEFT (before the model picker) for consistency. Read-only Q&A about the
          project (no build, no file changes). When ON it stays "locked" with the accent border + fill.
          Hidden on the landing page (hideAsk): there's no project to ask about yet. */}
      {!hideAsk && (
        <button
          onClick={() => setAskMode(!askMode)}
          title="Ask mode — just ask questions about the project (read-only, no build or file changes)"
          className={`${pill} ${askMode ? "!border-accent text-accent bg-white/[0.05]" : ""}`}
        >
          <MessageCircleQuestion size={13} className={askMode ? "text-accent" : "opacity-70"} />
          Ask
        </button>
      )}

      {/* MODEL */}
      <Popover direction="up" width={320} trigger={(o) => <span className={`${pill} max-w-[180px] ${o ? "border-accent" : ""}`}><span className="truncate">{currentModelLabel}</span><ChevronDown size={13} className="ml-auto shrink-0 opacity-60" /></span>}>
        {(close) => <ModelList onPick={(v) => { setVariant(v); close(); }} current={variant} />}
      </Popover>

      {/* MODE */}
      <Popover direction="up" width={260} trigger={(o) => <span className={`${pill} ${o ? "border-accent" : ""}`}>{currentMode.label}<ChevronDown size={13} className="opacity-60" /></span>}>
        {(close) => (
          <div className="flex flex-col">
            {MODES.map((m) => (
              <button
                key={m.value}
                onClick={() => { setMode(m.value); close(); }}
                className={`flex flex-col items-start gap-0.5 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-tool ${mode === m.value ? "bg-hivey-grad-soft" : ""}`}
              >
                <span className="flex w-full items-center gap-1.5 text-[12px] font-medium text-text">
                  {m.label}
                  {mode === m.value && <Check size={13} className="ml-auto text-accent" />}
                </span>
                <span className="text-[11px] leading-snug text-muted">{m.desc}</span>
              </button>
            ))}
          </div>
        )}
      </Popover>
    </div>
  );
}

type OrModel = { id: string; name: string; group: string; prompt?: number };
type Row = { value: string; label: string; vendor: string; score: number | null; prompt?: number; isHivey?: boolean; desc?: string };

// What each Hivey preset actually uses. Only these presets mix models per task; ANY concrete model
// you pick below is used as-is for every step (no routing, no substitution).
const HIVEY_DESC: Record<string, string> = {
  "hivey/free": "Flexible mix — free models (code: Qwen3 Coder)",
  hivey: "Flexible mix — Sonnet 4.6 codes · fast models plan/review",
  "hivey/smart": "Best models · guides you with questions first",
};

function ModelList({ onPick, current }: { onPick: (v: string) => void; current: string }) {
  const orModels = useStore((s) => s.orModels) as OrModel[];
  const [q, setQ] = useState("");
  // Accuracy (code benchmark) + price badges. Sort cycle: "" → desc → asc.
  const [showScore, setShowScore] = useState(true);
  const [showPrice, setShowPrice] = useState(true);
  const [sort, setSort] = useState<"" | "desc" | "asc">("");
  const query = q.toLowerCase();

  // Hivey pseudo-variants first (no live pricing → accuracy only). Never filtered by price tier.
  const hiveyRows: Row[] = useMemo(
    () =>
      HIVEY_KEYS.filter((k) => !query || VARIANT_LABELS[k].toLowerCase().includes(query)).map((k) => ({
        value: k,
        label: VARIANT_LABELS[k],
        vendor: "Hivey",
        score: modelScore(k.includes("smart") ? "anthropic/claude-opus" : k.includes("free") ? "qwen/qwen3-coder" : "anthropic/claude-sonnet", CATEGORY),
        isHivey: true,
        desc: HIVEY_DESC[k],
      })),
    [query],
  );

  // Vendor-grouped OpenRouter rows, each sub-sorted by best code score.
  const vendorGroups = useMemo(() => {
    const g: Record<string, Row[]> = {};
    for (const m of orModels) {
      if (query && !m.id.toLowerCase().includes(query) && !m.name.toLowerCase().includes(query)) continue;
      const row: Row = { value: m.id, label: prettyName(m), vendor: m.group, score: modelScore(m.id, CATEGORY), prompt: m.prompt };
      (g[m.group] ||= []).push(row);
    }
    for (const k of Object.keys(g)) g[k].sort(byScoreDesc);
    return Object.entries(g).sort((a, b) => a[0].localeCompare(b[0]));
  }, [orModels, query]);

  // When a sort is active, flatten everything (except Hivey) into one ranked "Results" list.
  const flat = useMemo(() => {
    if (!sort) return null;
    const rows = vendorGroups.flatMap(([, r]) => r);
    rows.sort(byScoreDesc);
    if (sort === "asc") rows.reverse();
    return rows;
  }, [sort, vendorGroups]);

  const Badge = ({ r }: { r: Row }) => {
    if (!showScore && !showPrice) return null;
    return (
      <span className="ml-auto flex shrink-0 items-center gap-1.5 text-[11px] tabular-nums">
        {showScore && <span style={{ color: scoreColor(r.score) }}>{r.score == null ? "—" : `${r.score}%`}</span>}
        {showScore && showPrice && !r.isHivey && <span className="text-border">·</span>}
        {showPrice && !r.isHivey && <span style={{ color: priceTier(r.prompt).color }}>{costLabel(r.prompt)}</span>}
      </span>
    );
  };

  const RowBtn = ({ r }: { r: Row }) => (
    <button onClick={() => onPick(r.value)} className={`flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left text-[12px] transition-colors hover:bg-tool ${current === r.value ? "text-text" : "text-muted"}`}>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="truncate">{r.label}</span>
          {current === r.value && <Check size={12} className="shrink-0 text-accent" />}
          <Badge r={r} />
        </span>
        {r.desc && <span className="mt-0.5 block truncate text-[10px] text-muted">{r.desc}</span>}
      </span>
    </button>
  );

  const MetricBtn = ({ on, onClick, icon: Icon, label }: { on: boolean; onClick: () => void; icon: typeof Target; label: string }) => (
    <button type="button" onClick={onClick} title={label} aria-label={label} aria-pressed={on}
      className={`grid h-6 w-6 place-items-center rounded-md border transition-colors ${on ? "border-accent bg-hivey-grad-soft text-accent" : "border-border text-muted hover:text-text"}`}>
      <Icon size={13} />
    </button>
  );

  return (
    <div className="flex max-h-[60vh] flex-col">
      {/* search */}
      <div className="mb-1 flex items-center gap-1.5 rounded-md border border-border bg-tool px-2 py-1">
        <Search size={12} className="text-muted" />
        <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search models…" className="w-full bg-transparent text-[12px] text-text outline-none placeholder:text-muted" />
      </div>

      {/* metric header: accuracy / price badges · sort cycle · filter */}
      <div className="mb-1 flex items-center gap-1 rounded-md border border-border bg-white/[0.02] px-1.5 py-1">
        <MetricBtn on={showScore} onClick={() => setShowScore((v) => !v)} icon={Target} label="Accuracy (code benchmark)" />
        <MetricBtn on={showPrice} onClick={() => setShowPrice((v) => !v)} icon={Tag} label="Price ($/1M tokens)" />
        <button type="button" onClick={() => setSort((s) => (s === "" ? "desc" : s === "desc" ? "asc" : ""))}
          title={sort === "desc" ? "Best first" : sort === "asc" ? "Worst first" : "Default order"} aria-label="Sort"
          className={`ml-auto grid h-6 w-6 place-items-center rounded-md border transition-colors ${sort ? "border-accent bg-hivey-grad-soft text-accent" : "border-border text-muted hover:text-text"}`}>
          {sort === "desc" ? <ArrowDownWideNarrow size={13} /> : sort === "asc" ? <ArrowUpWideNarrow size={13} /> : <ArrowDownUp size={13} />}
        </button>
      </div>

      {/* list */}
      <div className="flex flex-col overflow-y-auto">
        {hiveyRows.length > 0 && (
          <>
            <div className="px-2 pt-1 text-[10px] uppercase tracking-wide text-muted">Hivey</div>
            {hiveyRows.map((r) => <RowBtn key={r.value} r={r} />)}
          </>
        )}
        {flat ? (
          <>
            <div className="px-2 pt-1.5 text-[10px] uppercase tracking-wide text-muted">Results</div>
            {flat.slice(0, 120).map((r) => <RowBtn key={r.value} r={r} />)}
          </>
        ) : (
          vendorGroups.map(([vendor, rows]) => (
            <div key={vendor}>
              <div className="px-2 pt-1.5 text-[10px] uppercase tracking-wide text-muted">{vendor}</div>
              {rows.slice(0, 60).map((r) => <RowBtn key={r.value} r={r} />)}
            </div>
          ))
        )}
        {/* The catalogue loads WITHOUT a key (OpenRouter /models is public), so an empty list now
            means the fetch failed — not that the user forgot their key. */}
        {orModels.length === 0 && <div className="px-2 py-2 text-[11px] text-muted">Loading the model catalogue… (offline? check your connection)</div>}
      </div>
    </div>
  );
}

// OpenRouter "name" is usually "Vendor: Model Name" → keep the model part for readability.
function prettyName(m: OrModel): string {
  if (m.name && m.name.includes(": ")) return m.name.split(": ").slice(1).join(": ");
  return m.name || m.id;
}

function byScoreDesc(a: Row, b: Row): number {
  const sa = a.score == null ? -1 : a.score, sb = b.score == null ? -1 : b.score;
  if (sb !== sa) return sb - sa;
  return a.label.localeCompare(b.label);
}
