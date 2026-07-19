"use client";

import { useEffect, useState } from "react";

type Snapshot = { name: string; files: Record<string, string>; at: number };

// Public READ-ONLY viewer for a shared project snapshot. No execution, no editing — just browse the
// source (handy for a portfolio link). "Open a copy" hands the files to a fresh HiveyCode project.
export default function SharePage({ params }: { params: { id: string } }) {
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [error, setError] = useState("");
  const [active, setActive] = useState<string>("");

  useEffect(() => {
    fetch(`/api/share?id=${encodeURIComponent(params.id)}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("This shared project was not found."))))
      .then((s: Snapshot) => {
        setSnap(s);
        const first = Object.keys(s.files).find((p) => /App\.(t|j)sx?$/.test(p)) || Object.keys(s.files).sort()[0] || "";
        setActive(first);
      })
      .catch((e) => setError(e.message));
  }, [params.id]);

  const openCopy = () => {
    if (!snap) return;
    try {
      localStorage.setItem("hivey.pendingImport", JSON.stringify({ name: snap.name, files: snap.files }));
    } catch {}
    window.location.href = "/";
  };

  if (error) return <div className="grid h-screen place-items-center bg-bg text-sm text-muted">{error}</div>;
  if (!snap) return <div className="grid h-screen place-items-center bg-bg text-sm text-muted">Loading shared project…</div>;

  const paths = Object.keys(snap.files).sort();

  return (
    <div className="flex h-screen flex-col bg-bg text-text">
      <header className="flex h-12 shrink-0 items-center gap-3 border-b border-border px-4">
        <span className="text-sm font-semibold">{snap.name}</span>
        <span className="rounded bg-tool px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted">read-only</span>
        <span className="text-[11px] text-muted">{paths.length} files</span>
        <button
          onClick={openCopy}
          className="ml-auto rounded-lg bg-hivey-grad px-3 py-1.5 text-xs font-medium text-on-accent"
        >
          Open a copy in HiveyCode
        </button>
      </header>
      <div className="flex min-h-0 flex-1">
        <aside className="w-60 shrink-0 overflow-y-auto border-r border-border bg-panel/40 py-1">
          {paths.map((p) => (
            <button
              key={p}
              onClick={() => setActive(p)}
              className={`block w-full truncate px-3 py-1 text-left text-xs ${active === p ? "bg-hivey-grad-soft text-text" : "text-muted hover:text-text"}`}
              title={p}
            >
              {p}
            </button>
          ))}
        </aside>
        <main className="min-w-0 flex-1 overflow-auto">
          <pre className="min-h-full p-4 text-[12px] leading-relaxed text-text/90">
            <code>{active ? snap.files[active] : ""}</code>
          </pre>
        </main>
      </div>
    </div>
  );
}
