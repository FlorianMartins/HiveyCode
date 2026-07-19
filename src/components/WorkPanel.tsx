"use client";

import dynamic from "next/dynamic";

// The whole IDE workspace (Sandpack + Monaco) is client-only.
const SandboxBody = dynamic(() => import("./Sandbox").then((m) => m.SandboxBody), {
  ssr: false,
  loading: () => <div className="grid h-full place-items-center text-xs text-muted">Loading workspace…</div>,
});

export function WorkPanel() {
  return (
    <div className="h-full">
      <SandboxBody />
    </div>
  );
}
