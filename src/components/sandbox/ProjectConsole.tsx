"use client";

import { useEffect, useRef, useState } from "react";
import { useSandpack } from "@codesandbox/sandpack-react";
import { useStore } from "@/store/useStore";
import { useAgent } from "@/hooks/useAgent";
import { PURE_NOISE, SERVER_NOISE, stripAnsi, safeStr, type ConsoleLevel, type ConsoleLine } from "./consoleFilters";
import { Trash2, Wrench, AlertTriangle } from "lucide-react";

export function ProjectConsole() {
  const { listen } = useSandpack();
  const { fixIssue } = useAgent();
  const running = useStore((s) => s.running);
  const [lines, setLines] = useState<ConsoleLine[]>([]);
  const idRef = useRef(0);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const push = (level: ConsoleLevel, text: string) =>
      setLines((ls) => [...ls.slice(-400), { id: ++idRef.current, level, text }]);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const unsub = listen((msg: any) => {
      if (msg?.type === "start") return setLines([]); // resetOnPreviewRestart
      if (msg?.type === "stdout" && msg.payload?.data != null) {
        const text = stripAnsi(String(msg.payload.data)).replace(/\s+$/, "");
        if (!text.trim() || PURE_NOISE.test(text)) return; // pure noise dropped even on stderr
        const isErr = msg.payload.type === "err";
        if (!isErr && SERVER_NOISE.test(text)) return; // infra chatter dropped for non-errors only
        push(isErr ? "err" : "cmd", text);
      } else if (msg?.type === "console" && Array.isArray(msg.log)) {
        for (const l of msg.log) {
          if (l.method !== "error") continue; // keep ONLY errors from the app's console
          const text = stripAnsi((l.data || []).map(safeStr).join(" ")).trim();
          // Show EVERY real error — only drop the harmless pure-noise lines (never the infra filter,
          // which was hiding legit errors that merely mentioned "vite"/"reload"/"compiled"…).
          if (text && !PURE_NOISE.test(text)) push("error", text);
        }
      }
    });
    return unsub;
  }, [listen]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [lines]);

  const errorCount = lines.filter((l) => l.level !== "cmd").length;

  return (
    <div className="flex h-full flex-col bg-white/[0.01]">
      <div className="flex items-center gap-2 border-b border-border px-3 h-8 text-[11px]">
        <span className="font-medium text-muted">Logs</span>
        {errorCount > 0 && (
          <span className="inline-flex items-center gap-1 rounded-full bg-red-500/15 px-1.5 py-0.5 text-[10px] font-medium text-red-400">
            <AlertTriangle size={10} /> {errorCount}
          </span>
        )}
        <button
          onClick={() => setLines([])}
          title="Clear console"
          className="ml-auto grid h-6 w-6 place-items-center rounded-md text-muted transition-colors hover:bg-panel hover:text-text"
        >
          <Trash2 size={13} />
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-auto px-3 py-2 font-mono text-[11.5px] leading-relaxed min-w-0">
        {lines.length === 0 && (
          <div className="text-muted">No logs yet. Command output (build / install / test) and errors will appear here.</div>
        )}
        {lines.map((l) => (
          <div key={l.id} className="group flex items-start gap-2 py-0.5">
            <pre className={`min-w-0 flex-1 whitespace-pre-wrap break-words ${l.level === "cmd" ? "text-text/80" : "text-red-400"}`}>{l.text}</pre>
            {l.level !== "cmd" && (
              <button
                onClick={() => fixIssue(l.text)}
                disabled={running}
                title="Fix this error with the selected model"
                className="shrink-0 rounded-md bg-hivey-grad px-1.5 py-0.5 text-[10px] font-medium text-on-accent opacity-0 transition-opacity group-hover:opacity-100 disabled:opacity-40"
              >
                <span className="inline-flex items-center gap-1">
                  <Wrench size={10} /> Fix
                </span>
              </button>
            )}
          </div>
        ))}
        <div ref={endRef} />
      </div>
    </div>
  );
}
