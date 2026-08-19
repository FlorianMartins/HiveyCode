"use client";

import { useState } from "react";
import type { AgentQuestion } from "@/agent/types";
import { DesignThumb } from "./DesignPanel";
import { Check, X, Plus, Sparkles } from "lucide-react";

export function QuestionsPanel({ questions, onSubmit }: { questions: AgentQuestion[]; onSubmit: (answerText: string, summary: string) => void }) {
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
