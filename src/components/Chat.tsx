"use client";

import { useEffect, useRef, useState } from "react";
import { useStore } from "@/store/useStore";
import { useAgent } from "@/hooks/useAgent";
import { InputControls } from "./InputControls";
import { UsageMeter } from "./UsageMeter";
import { PlanReview } from "./PlanReview";
import { Markdown } from "./Markdown";
import { Splitter } from "./Splitter";
import { Workbench } from "./chat/Workbench";
import { ReasoningBlock, StepBlock } from "./chat/MessageBlocks";
import { ActionBtn, CopyBtn } from "./chat/ChatButtons";
import { DesignPanel, ChoicesCard } from "./chat/DesignPanel";
import { EstimatePanel } from "./chat/EstimatePanel";
import { QuestionsPanel } from "./chat/QuestionsPanel";
import { usePersistentNumber } from "@/lib/uiPrefs";
import { useT } from "@/lib/i18n";
import { stopActive } from "@/lib/abort";
import { ArrowUp, Loader2, Check, RotateCcw, RotateCw, X, Square, Pause, Play, MousePointerSquareDashed, SquareDashedMousePointer, AlertTriangle } from "lucide-react";

export function Chat() {
  const { chat, running, paused, setPaused, runtimeError, selection, setSelection, resumable, setResumable, askMode } = useStore();
  const restoreRedo = useStore((s) => s.restoreRedo);
  const undoRestore = useStore((s) => s.undoRestore);
  const { sendPrompt, answerQuestions, chooseDesign, approveEstimate, declineEstimate, fixError, resumeRun } = useAgent();
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
      <div ref={scrollRef} className="relative flex-1 overflow-y-auto px-3 py-4 space-y-2.5 min-h-0">
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
                {m.designs && i === chat.length - 1 && !running && (
                  <DesignPanel directions={m.designs} onPick={chooseDesign} />
                )}
                {m.estimate && i === chat.length - 1 && !running && (
                  <EstimatePanel data={m.estimate} onApprove={approveEstimate} onDecline={declineEstimate} />
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
