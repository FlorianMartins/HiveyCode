"use client";

import { useState, type ReactNode } from "react";
import { Check, Copy } from "lucide-react";

export function ActionBtn({ title, onClick, children }: { title: string; onClick: () => void; children: ReactNode }) {
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
export function CopyBtn({ text }: { text: string }) {
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
