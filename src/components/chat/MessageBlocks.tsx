"use client";

import { useEffect, useState } from "react";
import { Markdown } from "../Markdown";
import { Loader2, Check, Brain, ChevronRight, ChevronDown } from "lucide-react";

export function ReasoningBlock({ content, live }: { content: string; live: boolean }) {
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
export function StepBlock({ title, content }: { title: string; content: string }) {
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
