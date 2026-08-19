"use client";

import React from "react";

export function Tab({ active, onClick, icon, label, title }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string; title?: string }) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={`relative flex h-full items-center gap-1.5 px-3 text-xs transition-colors ${
        active ? "text-text" : "text-muted hover:text-text"
      }`}
    >
      {icon}
      {label}
      {active && <span className="absolute inset-x-2 -bottom-px h-[2px] rounded-full bg-hivey-grad shadow-glow" />}
    </button>
  );
}

// ── Console (logs) ─────────────────────────────────────────────────────────────────────────────
// A focused console: it keeps ONLY the useful CLIENT output — automated command output (build /
// install / test: vite / tsc / vitest / npm) and ERRORS (console.error + runtime stderr) — and
// drops the server/infra noise (dev-server startup, HMR, nodebox/WebContainer internals, verbose
// console.log/info/debug). Each error row has a "Fix with AI" button that hands that exact error to
// the currently-selected model (mainly for Fast mode, which has no auto test→debug loop).
