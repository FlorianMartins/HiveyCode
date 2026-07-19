"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useStore } from "@/store/useStore";
import { useAgent } from "@/hooks/useAgent";
import { InputControls } from "./InputControls";
import { UsageMeter } from "./UsageMeter";
import { PlanReview } from "./PlanReview";
import { Markdown } from "./Markdown";
import { Splitter } from "./Splitter";
import { usePersistentNumber } from "@/lib/uiPrefs";
import { useT } from "@/lib/i18n";
import { stopActive } from "@/lib/abort";
import type { AgentQuestion } from "@/agent/types";
import { ArrowUp, Loader2, Check, Copy, RotateCcw, RotateCw, X, Plus, Square, Pause, Play, Sparkles, Brain, ChevronRight, ChevronDown, MousePointerSquareDashed, SquareDashedMousePointer, AlertTriangle } from "lucide-react";

export function Chat() {
  const { chat, running, paused, setPaused, runtimeError, selection, setSelection, resumable, setResumable, askMode } = useStore();
  const restoreRedo = useStore((s) => s.restoreRedo);
  const undoRestore = useStore((s) => s.undoRestore);
  const { sendPrompt, answerQuestions, fixError, resumeRun } = useAgent();
  const t = useT();
  const [input, setInput] = useState("");
  const [composerH, setComposerH] = usePersistentNumber("hivey.ui.composerH", 150); // resizable input height
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [chat]);

  const send = () => {
    if (!input.trim() || running) return;
    sendPrompt(input);
    setInput("");
  };

  return (
    <div className="relative flex h-full flex-col">
      <Workbench />
      <div ref={scrollRef} className="relative flex-1 overflow-y-auto px-3 py-4 space-y-2.5">
        {chat.map((m, i) => {
          if (m.role === "user")
            return (
              <div key={i} className="group ml-auto flex w-fit max-w-full flex-col items-end gap-1">
                {/^My choices:/i.test(m.content) ? (
                  <ChoicesCard content={m.content} />
                ) : (
                  <div className="msg-in w-fit max-w-full whitespace-pre-wrap rounded-2xl rounded-br-sm bg-hivey-grad px-3.5 py-2 text-sm text-on-accent shadow-glow">
                    {m.content}
                  </div>
                )}
                <div className="flex gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                  <CopyBtn text={m.content} />
                  {!/^My choices:/i.test(m.content) && (
                    <ActionBtn title="Retry this prompt" onClick={() => !running && sendPrompt(m.content)}>
                      <RotateCcw size={12} />
                    </ActionBtn>
                  )}
                </div>
              </div>
            );
          if (m.reasoning) return <ReasoningBlock key={i} content={m.content} live={running && i === chat.length - 1} />;
          if (m.error)
            return (
              <div key={i} className="group max-w-full rounded-2xl border border-red-500/50 bg-red-500/10 px-3.5 py-2">
                <div className="flex items-start gap-2">
                  <AlertTriangle size={14} className="mt-0.5 shrink-0 text-red-400" />
                  <div className="min-w-0 flex-1 whitespace-pre-wrap break-words text-sm text-red-300/90">{m.content}</div>
                  <CopyBtn text={m.content} />
                </div>
              </div>
            );
          if (m.step) return <StepBlock key={i} title={m.step} content={m.content} />;
          if (m.status)
            return (
              <div key={i} className="msg-in flex items-center gap-2 text-sm italic text-muted">
                {running && i === chat.length - 1 ? (
                  <Loader2 size={12} className="shrink-0 animate-spin" />
                ) : (
                  <Check size={12} className="shrink-0 text-accent" />
                )}
                {m.content}
              </div>
            );
          return (
            <div key={i} className="group max-w-full">
              <div className="msg-in bubble-ai max-w-full rounded-2xl rounded-bl-sm px-3.5 py-2 text-text">
                <Markdown>{m.content}</Markdown>
                {m.questions && i === chat.length - 1 && !running && (
                  <QuestionsPanel questions={m.questions} onSubmit={answerQuestions} />
                )}
              </div>
              {m.content && (
                <div className="mt-1 flex gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                  <CopyBtn text={m.content} />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* The composer/response BORDER itself is the drag handle — pull it up/down to resize input. */}
      <Splitter dir="y" onDelta={(d) => setComposerH((h) => Math.min(window.innerHeight * 0.6, Math.max(100, h - d)))} />
      <div className="p-3">
        {restoreRedo && !running && (
          <div className="mb-2 flex items-center gap-2 rounded-lg border border-accent/40 bg-hivey-grad-soft px-2 py-1.5 text-xs">
            <RotateCw size={13} className="shrink-0 text-accent" />
            <span className="text-text/90">Restored an earlier checkpoint — the later chat was trimmed.</span>
            <button
              onClick={undoRestore}
              className="ml-auto rounded-md border border-border px-2 py-1 text-muted transition-colors hover:border-accent hover:text-text"
              title="Jump back to the state (files + chat) you had before restoring"
            >
              Undo restore
            </button>
          </div>
        )}
        {resumable && !running && (
          <div className="mb-2 flex items-center gap-2 rounded-lg border border-amber-500/50 bg-amber-500/10 p-2 text-xs">
            <RotateCw size={13} className="shrink-0 text-amber-400" />
            <span className="text-amber-300/90">The last run stopped before finishing. Resume from the current state?</span>
            <button
              onClick={resumeRun}
              className="ml-auto rounded-md bg-hivey-grad px-2 py-1 text-on-accent"
            >
              Resume
            </button>
            <button
              onClick={() => setResumable(null)}
              className="rounded-md border border-border px-2 py-1 text-muted transition-colors hover:text-text"
              title="Dismiss"
            >
              ✕
            </button>
          </div>
        )}
        {runtimeError && (
          <div className="mb-2 rounded-lg border border-red-500/50 bg-red-500/10 p-2 text-xs">
            <div className="flex items-center gap-2">
              <span className="font-medium text-red-400">{t("chat.runtimeError")}</span>
              <button
                onClick={fixError}
                disabled={running}
                className="ml-auto rounded-md bg-hivey-grad px-2 py-1 text-on-accent disabled:opacity-50"
              >
                {t("chat.fixWithAgents")}
              </button>
            </div>
            <pre className="mt-1 max-h-20 overflow-auto whitespace-pre-wrap text-[11px] text-muted">{runtimeError}</pre>
          </div>
        )}
        {selection && (
          <div className="mb-2 flex w-fit max-w-full items-center gap-1.5 rounded-md border border-accent bg-hivey-grad-soft px-2 py-1 text-xs text-text">
            {selection.kind === "element" ? <MousePointerSquareDashed size={12} /> : <SquareDashedMousePointer size={12} />}
            <span className="truncate">{selection.label}</span>
            <button onClick={() => setSelection(null)} className="ml-1 text-muted hover:text-text" title="Clear selection">
              <X size={12} />
            </button>
          </div>
        )}
        <PlanReview />
        <UsageMeter />
        <div className="mb-2">
          <InputControls />
        </div>
        <div className={`neon composer-box flex items-end gap-2 rounded-2xl border border-border p-2 transition-colors focus-within:border-accent ${running ? "is-busy" : ""}`}>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            style={{ height: composerH }}
            placeholder={askMode ? "Ask about the project — read-only, no changes…" : t("chat.placeholder")}
            className="flex-1 resize-none bg-transparent text-sm text-text placeholder:text-muted outline-none"
          />
          {running ? (
            <>
              <button
                onClick={() => setPaused(!paused)}
                title={paused ? "Resume" : "Pause"}
                className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-border transition-colors ${paused ? "bg-hivey-grad-soft text-accent" : "bg-panel text-muted hover:text-text"}`}
              >
                {paused ? <Play size={14} className="fill-current" /> : <Pause size={14} className="fill-current" />}
              </button>
              <button
                onClick={stopActive}
                title="Stop"
                className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-border bg-panel text-red-400 hover:text-red-300"
              >
                <Square size={14} className="fill-current" />
              </button>
            </>
          ) : (
            <button onClick={send} className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-hivey-grad text-on-accent">
              <ArrowUp size={16} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// Status workbench — a compact live timeline of the agent pipeline (Plan → Code → Test → Fix),
// shown while a run is in progress: done steps get a ✓, the current step spins, later steps dim.
const WB_PHASES = [
  { key: "plan", label: "Plan" },
  { key: "code", label: "Code" },
  { key: "test", label: "Test" },
  { key: "fix", label: "Fix" },
];
function Workbench() {
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
function ReasoningBlock({ content, live }: { content: string; live: boolean }) {
  const [open, setOpen] = useState(true);
  useEffect(() => {
    if (!live) setOpen(false); // collapse once thinking is done (re-openable on click)
  }, [live]);
  return (
    <div className="msg-in rounded-xl border border-border-soft bg-white/[0.015] text-[12px]">
      <button onClick={() => setOpen((o) => !o)} className="flex w-full items-center gap-1.5 px-2.5 py-1.5 text-muted transition-colors hover:text-text">
        <Brain size={13} className={live ? "text-accent" : ""} />
        <span className="font-medium">{live ? "Thinking…" : "Reasoning"}</span>
        {live && <Loader2 size={11} className="shrink-0 animate-spin text-accent" />}
        <span className="ml-auto">{open ? <ChevronDown size={13} /> : <ChevronRight size={13} />}</span>
      </button>
      {open && (
        // While live: NO max-height → the block GROWS with the reasoning (the chat view scrolls to
        // follow). Once done and re-opened, cap it so a long trace doesn't dominate the panel.
        <div className={`${live ? "" : "max-h-64 overflow-auto"} border-t border-border-soft px-2.5 py-2`}>
          <pre className="whitespace-pre-wrap break-words font-mono text-[11px] leading-relaxed text-muted">{content}</pre>
        </div>
      )}
    </div>
  );
}

// A pipeline step (plan / features / review…) — COLLAPSED by default (just the title + a chevron);
// click to expand the details. Keeps the conversation compact.
function StepBlock({ title, content }: { title: string; content: string }) {
  const [open, setOpen] = useState(false);
  // Strip the leading "**Title**" line so the expanded body isn't a duplicate of the header.
  const body = content.replace(/^\s*\*\*.+?\*\*\s*/, "").trim();
  return (
    <div className="msg-in rounded-xl border border-border-soft bg-white/[0.015] text-[12px]">
      <button onClick={() => setOpen((o) => !o)} className="flex w-full items-center gap-1.5 px-2.5 py-1.5 text-muted transition-colors hover:text-text">
        <Check size={12} className="shrink-0 text-accent" />
        <span className="font-medium">{title}</span>
        <span className="ml-auto">{open ? <ChevronDown size={13} /> : <ChevronRight size={13} />}</span>
      </button>
      {open && (
        <div className="border-t border-border-soft px-3 py-2">
          <Markdown>{body || content}</Markdown>
        </div>
      )}
    </div>
  );
}

// Tiny hover action button used under chat bubbles (copy / retry).
function ActionBtn({ title, onClick, children }: { title: string; onClick: () => void; children: ReactNode }) {
  return (
    <button
      title={title}
      aria-label={title}
      onClick={onClick}
      className="grid h-6 w-6 place-items-center rounded-md text-muted transition-colors hover:bg-white/5 hover:text-text"
    >
      {children}
    </button>
  );
}

// Copy button with a brief "copied ✓" confirmation.
function CopyBtn({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setDone(true);
      setTimeout(() => setDone(false), 1200);
    } catch {}
  };
  return (
    <ActionBtn title={done ? "Copied" : "Copy"} onClick={copy}>
      {done ? <Check size={12} className="text-accent" /> : <Copy size={12} />}
    </ActionBtn>
  );
}

// A CSS mini-mockup illustrating a named design direction (no external images — cheap + instant).
function designStyle(name: string) {
  const n = name.toLowerCase();
  if (n.includes("glass")) return { bg: "linear-gradient(135deg,#1e1b3a,#0b0b13)", card: "rgba(139,92,246,.20)", border: "rgba(255,255,255,.16)", accent: "#8b5cf6", radius: 10, blur: true };
  if (n.includes("minimal") || n.includes("linear")) return { bg: "#0f1016", card: "#181a24", border: "rgba(255,255,255,.08)", accent: "#6366f1", radius: 8 };
  if (n.includes("playful")) return { bg: "#fff7ed", card: "#fde68a", border: "#fb923c", accent: "#f97316", radius: 14 };
  if (n.includes("corporate")) return { bg: "#f8fafc", card: "#e2e8f0", border: "#cbd5e1", accent: "#2563eb", radius: 4 };
  if (n.includes("brutal")) return { bg: "#f5f5f5", card: "#ffffff", border: "#000000", accent: "#000000", radius: 0 };
  if (n.includes("neumorph")) return { bg: "#e0e5ec", card: "#e0e5ec", border: "rgba(0,0,0,.05)", accent: "#6d5dfc", radius: 12, soft: true };
  if (n.includes("editorial")) return { bg: "#faf7f2", card: "#ffffff", border: "#e7e0d5", accent: "#111111", radius: 2 };
  if (n.includes("retro") || n.includes("80")) return { bg: "linear-gradient(135deg,#2b1055,#5b7fd4)", card: "rgba(255,43,214,.28)", border: "#00e5ff", accent: "#ff2bd6", radius: 6 };
  if (n.includes("gradient") || n.includes("vibrant")) return { bg: "linear-gradient(135deg,#6366f1,#ec4899)", card: "rgba(255,255,255,.24)", border: "rgba(255,255,255,.35)", accent: "#ffffff", radius: 12 };
  if (n.includes("mono")) return { bg: "#111111", card: "#2a2a2a", border: "#444444", accent: "#bbbbbb", radius: 6 };
  return { bg: "#0f1016", card: "#181a24", border: "rgba(255,255,255,.08)", accent: "#6366f1", radius: 8 };
}
function DesignThumb({ name }: { name: string }) {
  const s = designStyle(name);
  const cardR = Math.max(2, s.radius - 3);
  return (
    <div style={{ background: s.bg, borderRadius: s.radius, height: 44, padding: 5, display: "flex", flexDirection: "column", gap: 4, overflow: "hidden", ...(s.blur ? { backdropFilter: "blur(4px)" } : {}) }}>
      <div style={{ height: 6, width: "55%", borderRadius: 3, background: s.accent }} />
      <div style={{ display: "flex", gap: 4, flex: 1 }}>
        <div style={{ flex: 1, background: s.card, border: `1px solid ${s.border}`, borderRadius: cardR, boxShadow: s.soft ? "2px 2px 4px rgba(0,0,0,.12), -2px -2px 4px rgba(255,255,255,.6)" : undefined }} />
        <div style={{ flex: 1, background: s.card, border: `1px solid ${s.border}`, borderRadius: cardR }} />
      </div>
    </div>
  );
}

// The user's interview answers ("My choices"), rendered as a clean card instead of a raw bulleted
// blob: a header + one row per question (the question in muted small text, the chosen answer bold).
function ChoicesCard({ content }: { content: string }) {
  const rows = content
    .replace(/^My choices:\s*/i, "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      const i = l.indexOf("→");
      return i >= 0 ? { q: l.slice(0, i).trim(), a: l.slice(i + 1).trim() } : { q: "", a: l };
    });
  return (
    <div className="ml-auto w-fit max-w-[88%] rounded-2xl rounded-br-sm border border-[color-mix(in_srgb,var(--accent)_30%,transparent)] bg-panel/70 px-4 py-3 text-sm backdrop-blur-sm">
      <div className="mb-2 flex items-center gap-1.5 text-[12px] font-semibold text-accent">
        <Sparkles size={13} /> My choices
      </div>
      <div className="space-y-2">
        {rows.map((r, i) => (
          <div key={i} className="flex flex-col gap-0.5">
            {r.q && <div className="text-[11px] leading-snug text-muted">{r.q}</div>}
            <div className="font-medium leading-snug text-text">{r.a}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Guided (Hivey Smart) mode: clickable options (design directions shown as visual thumbnails), plus
// MULTIPLE custom answers per question (a "+" list). The user picks/adds, then builds — or lets Smart decide.
function QuestionsPanel({ questions, onSubmit }: { questions: AgentQuestion[]; onSubmit: (answerText: string, summary: string) => void }) {
  const [picks, setPicks] = useState<Record<number, string[]>>({});
  const [customs, setCustoms] = useState<Record<number, string[]>>({});
  const [drafts, setDrafts] = useState<Record<number, string>>({});

  const toggle = (qi: number, opt: string, multi?: boolean) => {
    setPicks((p) => {
      const cur = new Set(p[qi] || []);
      if (multi) cur.has(opt) ? cur.delete(opt) : cur.add(opt);
      else {
        const had = cur.has(opt);
        cur.clear();
        if (!had) cur.add(opt);
      }
      return { ...p, [qi]: [...cur] };
    });
  };
  const addCustom = (qi: number) => {
    const v = (drafts[qi] || "").trim();
    if (!v) return;
    setCustoms((c) => ({ ...c, [qi]: [...(c[qi] || []), v] }));
    setDrafts((d) => ({ ...d, [qi]: "" }));
  };
  const removeCustom = (qi: number, idx: number) => setCustoms((c) => ({ ...c, [qi]: (c[qi] || []).filter((_, i) => i !== idx) }));

  const collect = () => {
    const parts: string[] = [];
    questions.forEach((q, qi) => {
      const draft = (drafts[qi] || "").trim();
      const ans = [...(picks[qi] || []), ...(customs[qi] || []), ...(draft ? [draft] : [])].join(", ");
      if (ans) parts.push(`• ${q.question} → ${ans}`);
    });
    return parts;
  };
  const build = () => {
    const parts = collect();
    if (!parts.length) return onSubmit("(No specific preferences — use your best judgment for a top-quality result.)", "Let Hivey Smart decide");
    onSubmit(parts.join("\n"), "My choices:\n" + parts.map((p) => p.replace(/^• /, "")).join("\n"));
  };

  return (
    <div className="mt-2.5 flex flex-col gap-3.5 border-t border-border-soft pt-2.5">
      {questions.map((q, qi) => (
        <div key={qi} className="flex flex-col gap-1.5">
          <div className="text-[12px] font-medium text-text">{q.question}</div>

          {q.design ? (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {q.options.map((opt) => {
                const on = (picks[qi] || []).includes(opt);
                return (
                  <button
                    key={opt}
                    onClick={() => toggle(qi, opt, q.multi)}
                    className={`flex flex-col gap-1 rounded-lg border p-1 text-left transition-colors ${on ? "border-accent ring-1 ring-accent" : "border-border hover:border-accent"}`}
                  >
                    <DesignThumb name={opt} />
                    <span className={`truncate px-0.5 text-[10.5px] ${on ? "text-accent" : "text-muted"}`}>
                      {on && <Check size={9} className="mb-0.5 mr-0.5 inline" />}
                      {opt}
                    </span>
                  </button>
                );
              })}
            </div>
          ) : (
            q.options.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {q.options.map((opt) => {
                  const on = (picks[qi] || []).includes(opt);
                  return (
                    <button
                      key={opt}
                      onClick={() => toggle(qi, opt, q.multi)}
                      className={`rounded-lg border px-2.5 py-1 text-[12px] transition-colors ${on ? "border-accent bg-hivey-grad-soft text-accent" : "border-border text-muted hover:border-accent hover:text-text"}`}
                    >
                      {on && <Check size={11} className="mb-0.5 mr-1 inline" />}
                      {opt}
                    </button>
                  );
                })}
              </div>
            )
          )}

          {/* Custom answers — add several with the "+" button. */}
          {(customs[qi] || []).length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {(customs[qi] || []).map((c, idx) => (
                <span key={idx} className="inline-flex items-center gap-1 rounded-lg border border-accent bg-hivey-grad-soft px-2 py-0.5 text-[11px] text-accent">
                  {c}
                  <button onClick={() => removeCustom(qi, idx)} className="text-muted hover:text-text">
                    <X size={10} />
                  </button>
                </span>
              ))}
            </div>
          )}
          <div className="flex items-center gap-1.5">
            <input
              value={drafts[qi] || ""}
              onChange={(e) => setDrafts((d) => ({ ...d, [qi]: e.target.value }))}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCustom(qi); } }}
              placeholder="Add your own…"
              className="flex-1 rounded-lg border border-border bg-white/[0.03] px-2.5 py-1 text-[12px] text-text placeholder:text-muted outline-none focus:border-accent"
            />
            <button onClick={() => addCustom(qi)} title="Add answer" className="grid h-7 w-7 shrink-0 place-items-center rounded-lg border border-border text-muted transition-colors hover:border-accent hover:text-accent">
              <Plus size={14} />
            </button>
          </div>
        </div>
      ))}
      <div className="flex items-center gap-2 pt-0.5">
        <button onClick={build} className="inline-flex items-center gap-1.5 rounded-lg bg-hivey-grad px-3 py-1.5 text-[12px] font-medium text-on-accent">
          <Sparkles size={13} /> Build with these
        </button>
        <button onClick={() => onSubmit("(No specific preferences — use your best judgment for a top-quality result.)", "Let Hivey Smart decide")} className="rounded-lg border border-border px-3 py-1.5 text-[12px] text-muted transition-colors hover:border-accent hover:text-text">
          Let it decide
        </button>
      </div>
    </div>
  );
}
