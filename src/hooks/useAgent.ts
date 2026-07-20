"use client";

import { useStore, memoryBlock } from "@/store/useStore";
import { LOCAL_IDS } from "@/agent/providers";
import { commitProject } from "@/lib/git";
import { newAbort, isAbortError } from "@/lib/abort";
import { translate } from "@/lib/i18n";
import type { AgentEvent, SecurityFinding } from "@/agent/types";
import type { Selection } from "@/store/useStore";

// Maps an agent role to a pipeline phase for the status workbench.
const PHASE_OF: Record<string, string> = { planner: "plan", coder: "code", tester: "test", reviewer: "test", debugger: "fix" };

// True while a plan-first (planOnly) run is in flight — routes the incoming plan to the approval UI
// instead of the normal chat step.
let planOnlyActive = false;
// Set when the current run emits an error → the run is offered as "resumable".
let lastRunFailed = false;

// Shared agent-run logic for the Chat and the Landing hero. Reads the store via getState() so the
// returned callbacks are stable and don't force re-renders.
export function useAgent() {
  const handleEvent = (ev: AgentEvent) => {
    const s = useStore.getState();
    switch (ev.type) {
      case "status":
        s.setStatus(ev.message);
        s.setPhase(PHASE_OF[ev.role] || s.phase);
        break;
      case "plan": {
        const c = ev.content.trim();
        // Plan-first run → send the plan to the editable approval panel (don't clutter the chat).
        // (A leading "Expected features" block still goes to chat; the real plan opens the panel.)
        if (planOnlyActive && !/^\*\*Expected features/i.test(c)) {
          s.setPendingPlan(c);
          break;
        }
        const content = /^\*\*/.test(c) ? c : "**Plan**\n\n" + c;
        const title = content.match(/\*\*(.+?)\*\*/)?.[1] || "Plan";
        s.pushChat({ role: "assistant", content, step: title });
        break;
      }
      case "file-open":
        // A new file started streaming — open it so the user watches it being written.
        s.setFile(ev.path, "");
        s.setActiveFile(ev.path);
        break;
      case "file-delta": {
        // Append the streamed chunk to the file's current content (live typing in the editor).
        const cur = useStore.getState().files[ev.path] || "";
        s.setFile(ev.path, cur + ev.chunk);
        break;
      }
      case "file":
        // Authoritative full content (final, fences stripped) — replaces whatever streamed.
        s.setFile(ev.path, ev.content);
        s.setActiveFile(ev.path);
        break;
      case "review":
        if (ev.notes)
          s.pushChat({
            role: "assistant",
            content: (ev.ok ? "**Review — OK**" : "**Review — issues found**") + "\n\n" + ev.notes,
            step: ev.ok ? "Review — OK" : "Review — issues found",
          });
        break;
      case "reasoning": {
        // Live model reasoning → accumulate into a single collapsible block (not persisted). This is
        // what proves "it's thinking", not frozen, between planning and the first file.
        const cur = useStore.getState().chat;
        const last = cur[cur.length - 1];
        if (last && last.reasoning) {
          const merged = (last.content + ev.chunk).slice(-8000);
          const next = cur.slice();
          next[next.length - 1] = { ...last, content: merged };
          useStore.setState({ chat: next });
        } else {
          useStore.setState({ chat: [...cur, { role: "assistant", content: ev.chunk, reasoning: true }] });
        }
        break;
      }
      case "estimate":
        // Cost gate — the run stopped BEFORE the coder. Show what it will cost and wait for a
        // decision; nothing has been spent on code generation at this point.
        s.pushChat({
          role: "assistant",
          content: "",
          estimate: { low: ev.low, high: ev.high, priced: ev.priced, basis: ev.basis, lines: ev.lines },
        });
        break;
      case "questions":
        // Guided (Hivey Smart) mode: render clarifying questions the user can answer before building.
        s.pushChat({ role: "assistant", content: ev.intro, questions: ev.questions });
        break;
      case "message":
        s.pushChat({ role: "assistant", content: ev.content });
        break;
      case "error":
        s.pushChat({ role: "assistant", content: ev.message, error: true });
        lastRunFailed = true;
        break;
      case "usage":
        s.addUsage(ev.role, ev.prompt, ev.completion, ev.cost);
        break;
      case "done":
        // Build finished → auto-launch the live preview (switch the workspace to the Preview tab).
        if (Object.keys(useStore.getState().files).length > 0) s.requestPreview();
        break;
    }
  };

  const runRequest = async (
    displayText: string,
    fullPrompt: string,
    opts?: {
      interview?: boolean;
      answered?: boolean;
      planOnly?: boolean;
      approvedPlan?: string;
      skipUserEcho?: boolean;
      estimate?: boolean;
      approvedEstimate?: boolean;
    },
  ) => {
    const s = useStore.getState();
    // A local provider (Ollama/LM Studio/custom, "provider|model") needs no key.
    const localProvider = s.variant.includes("|") && LOCAL_IDS.has(s.variant.split("|")[0]);
    const hasAnyKey = !!s.apiKey || Object.values(s.keys || {}).some(Boolean);
    if (!hasAnyKey && !localProvider) {
      s.pushChat({ role: "assistant", content: translate(s.lang, "chat.needKey") });
      return;
    }
    // Plan-first removed: a short pre-plan anchored the coder to a minimal, off-target build, so the
    // agents now go straight to building (feature-scoping + completeness enforce a rich, working app).
    const planOnly = false;
    planOnlyActive = planOnly;
    lastRunFailed = false;
    // Keep the exact prompt so the cost gate can replay THIS request (answers included) on approval.
    useStore.setState({ lastRunPrompt: fullPrompt });
    // ASK mode = read-only Q&A about the project: no checkpoint, no snapshot, no jump to the editor —
    // it never touches files, it just answers in the chat.
    const askMode = s.askMode;
    if (!opts?.skipUserEcho) s.pushChat({ role: "user", content: displayText });
    if (askMode) {
      // nothing to prepare — the answer streams into the chat, files stay untouched.
    } else {
      s.snapshotBaseline();
      // Auto-checkpoint the files BEFORE the agent touches them — a one-click safety net if it
      // breaks something. No-op on an empty project; deduped against the latest snapshot.
      s.saveCheckpoint(displayText.replace(/\s+/g, " ").trim().slice(0, 60) || "Before run", true);
      s.requestCode(); // jump to the Code tab so the user watches the agent write files live
    }
    s.resetUsage(); // fresh token/cost accounting for this run
    s.setRunning(true);
    const mem = memoryBlock();
    const ctrl = newAbort();
    try {
      const res = await fetch("/api/agent", {
        method: "POST",
        headers: { "content-type": "application/json" },
        signal: ctrl.signal,
        body: JSON.stringify({
          prompt: mem ? `${mem}\n\n${fullPrompt}` : fullPrompt,
          files: useStore.getState().files,
          apiKey: s.apiKey,
          keys: s.keys,
          localBaseUrls: s.localBaseUrls,
          variant: s.variant,
          reasoning: s.reasoning,
          mode: useStore.getState().mode,
          template: useStore.getState().template,
          interview: askMode ? false : opts?.interview, // Ask mode never runs the guided interview
          answered: opts?.answered, // user answered the clarifying questions → honour choices over template
          planOnly,
          approvedPlan: opts?.approvedPlan,
          ask: askMode,
          estimate: opts?.estimate,
          approvedEstimate: opts?.approvedEstimate,
        }),
      });
      if (!res.body) throw new Error("No response stream");
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      while (true) {
        // Pause: stop consuming the stream. HTTP backpressure fills the server buffer and the
        // orchestrator generator blocks on its next enqueue → the pipeline pauses between steps.
        while (useStore.getState().paused && !ctrl.signal.aborted) {
          await new Promise((r) => setTimeout(r, 150));
        }
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() || "";
        for (const line of lines) {
          if (!line.trim()) continue;
          handleEvent(JSON.parse(line) as AgentEvent);
        }
      }
      commitProject(useStore.getState().files, displayText.split("\n")[0], useStore.getState().projectId);
    } catch (e) {
      if (isAbortError(e)) useStore.getState().pushChat({ role: "assistant", content: translate(useStore.getState().lang, "chat.stopped") });
      else { useStore.getState().pushChat({ role: "assistant", content: (e instanceof Error ? e.message : String(e)) }); lastRunFailed = true; }
    } finally {
      // Resume-after-failure: if this run failed mid-way, remember it so the user can pick up where it
      // stopped (the partial files are already in the project) instead of restarting from scratch.
      const st = useStore.getState();
      if (!planOnly) st.setResumable(lastRunFailed ? { display: displayText, full: fullPrompt } : null);
      st.setRunning(false);
    }
  };

  const sendPrompt = (prompt: string, selection?: Selection | null) => {
    const s = useStore.getState();
    const p = prompt.trim();
    if (!p || s.running) return;
    if (s.memory.length === 0 && Object.keys(s.files).length === 0) s.addMemory(`Project goal: ${p}`, true);
    const sel = selection !== undefined ? selection : s.selection;
    const fullPrompt = sel
      ? `${p}\n\n[Target picked on the live preview — apply the change HERE specifically]\n${sel.detail}`
      : p;
    s.setSelection(null);
    // Remember the request so the guided (Smart) mode can build it once questions are answered.
    useStore.setState({ pendingPrompt: fullPrompt });
    runRequest(sel ? `${p}\n(${sel.label})` : p, fullPrompt);
  };

  // Guided mode: the user answered the clarifying questions (picked options and/or wrote their own).
  // Build the original request enriched with their answers — and skip the interview this time.
  const answerQuestions = (answerText: string, displaySummary: string) => {
    const s = useStore.getState();
    if (s.running) return;
    const base = s.pendingPrompt || "";
    const combined = `${base}\n\n=== FIRM REQUIREMENTS (the user answered the clarifying questions) ===\nThe finished app MUST match ALL of these choices EXACTLY — especially the chosen VISUAL STYLE / design direction and the selected features. Treat them as the authoritative spec; do not substitute your own defaults where the user made a choice.\n${answerText}`;
    runRequest(displaySummary, combined, { interview: false, answered: true });
  };

  // The user accepted the estimated cost → replay the SAME request verbatim, past the gate. Replaying
  // `lastRunPrompt` (not `pendingPrompt`) matters: after a guided interview the real prompt carries the
  // user's answers, and rebuilding it from the base would silently drop their choices.
  const approveEstimate = () => {
    const s = useStore.getState();
    if (s.running) return;
    runRequest("Building…", s.lastRunPrompt, { interview: false, answered: true, approvedEstimate: true, skipUserEcho: true });
  };

  const declineEstimate = () => {
    useStore.getState().pushChat({
      role: "assistant",
      content: "Build cancelled — nothing was generated, so nothing was charged. Adjust your request and try again.",
    });
  };

  const fixError = () => {
    const s = useStore.getState();
    if (!s.runtimeError || s.running) return;
    const err = s.runtimeError;
    s.setRuntimeError(null);
    runRequest(
      "Fix the runtime error",
      `The live preview throws this error — find the root cause and fix it with a minimal change. Output the complete corrected file(s).\n\nERROR:\n${err}`,
    );
  };

  // Send ONE specific console error to the currently-selected model to fix (used by the per-error
  // "Fix with AI" button in the Console — mainly for Fast mode, which has no auto test→debug loop).
  const fixIssue = (errorText: string) => {
    const s = useStore.getState();
    if (s.running || !errorText.trim()) return;
    runRequest(
      "Fix this error",
      `The app produced this error. Find the ROOT CAUSE and fix it with a minimal, correct change. ` +
        `Output the complete corrected file(s).\n\nERROR:\n${errorText.slice(0, 4000)}`,
    );
  };

  // Defensive security scan of the current project (Security tab). Server-side (BYOK); sets findings.
  const scanSecurity = async () => {
    const s = useStore.getState();
    if (s.securityScanning || s.running) return;
    if (!s.apiKey && !Object.keys(s.keys).length) {
      s.pushChat({ role: "assistant", content: translate(s.lang, "chat.needKey") });
      return;
    }
    if (Object.keys(s.files).length === 0) return;
    s.setSecurityScanning(true);
    try {
      const res = await fetch("/api/security", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ files: s.files, apiKey: s.apiKey, keys: s.keys, variant: s.variant }),
      });
      const j = (await res.json()) as { findings?: SecurityFinding[]; error?: string };
      if (j.findings) s.setSecurityFindings(j.findings);
      else if (j.error) s.pushChat({ role: "assistant", content: j.error });
    } catch (e) {
      s.pushChat({ role: "assistant", content: e instanceof Error ? e.message : String(e) });
    } finally {
      useStore.getState().setSecurityScanning(false);
    }
  };

  // Phase-2 DEEP scan: npm audit + semgrep in the hardened runner (no LLM, no key). Merges the tool
  // findings with any existing LLM scan findings (kept: ids starting with "sec-").
  const deepScan = async () => {
    const s = useStore.getState();
    if (s.securityScanning || s.running) return;
    if (Object.keys(s.files).length === 0) return;
    s.setSecurityScanning(true);
    try {
      const res = await fetch("/api/deepscan", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ files: s.files }),
      });
      const j = (await res.json()) as { findings?: SecurityFinding[]; tools?: Record<string, { ok: boolean; error?: string }>; error?: string };
      if (j.findings) {
        const keep = useStore.getState().securityFindings.filter((f) => f.id.startsWith("sec-"));
        const rank = { high: 0, medium: 1, low: 2 } as const;
        const merged = [...keep, ...j.findings].sort((a, b) => rank[a.severity] - rank[b.severity]);
        s.setSecurityFindings(merged);
      } else if (j.error) {
        s.pushChat({ role: "assistant", content: j.error });
      }
      const errs = Object.entries(j.tools || {}).filter(([, t]) => t && !t.ok).map(([k, t]) => `${k}: ${t.error}`);
      if (errs.length) s.pushChat({ role: "assistant", content: "Deep-scan tool issue — " + errs.join("; ") });
    } catch (e) {
      s.pushChat({ role: "assistant", content: e instanceof Error ? e.message : String(e) });
    } finally {
      useStore.getState().setSecurityScanning(false);
    }
  };

  // "Fix" on a finding — reuses the edit pipeline (runRequest → diffs applied + git commit), strictly
  // as a DEFENSIVE hardening change, then marks the finding fixed.
  const fixFinding = async (f: SecurityFinding) => {
    const s = useStore.getState();
    if (s.running) return;
    const loc = f.file ? ` in ${f.file}${f.line ? `:${f.line}` : ""}` : "";
    await runRequest(
      `Harden: ${f.title}`,
      `DEFENSIVE security hardening. Apply a MINIMAL, correct change to fix this issue${loc}. Do NOT add features or ` +
        `change behaviour beyond the fix, and do NOT introduce any offensive/exploit code.\n\n` +
        `ISSUE (${f.severity} · ${f.category}): ${f.title}\nWHY: ${f.why}\nSUGGESTED FIX: ${f.fix}\n\n` +
        `Output the change as edits to the affected file(s).`,
    );
    useStore.getState().markFindingFixed(f.id);
  };

  // Batch auto-fix: harden ALL of the given findings in ONE bounded, defensive pass (used for
  // "fix all low-risk"). One request → the coder applies every minimal fix, then we mark them fixed.
  const fixFindingsBatch = async (list: SecurityFinding[]) => {
    const s = useStore.getState();
    if (s.running || !list.length) return;
    const body = list
      .map((f, i) => `${i + 1}. [${f.severity} · ${f.category}] ${f.title}${f.file ? ` (${f.file}${f.line ? `:${f.line}` : ""})` : ""}\n   WHY: ${f.why}\n   FIX: ${f.fix}`)
      .join("\n");
    await runRequest(
      `Harden ${list.length} finding${list.length > 1 ? "s" : ""}`,
      `DEFENSIVE security hardening — apply MINIMAL, correct fixes for ALL of the issues below. Do NOT add ` +
        `features or change behaviour beyond the fixes, and never introduce offensive/exploit code. Output ` +
        `edits to the affected files.\n\nISSUES:\n${body}`,
    );
    const st = useStore.getState();
    list.forEach((f) => st.markFindingFixed(f.id));
  };

  // Resume-after-failure: continue the failed run from the current (partial) project state.
  const resumeRun = () => {
    const st = useStore.getState();
    const r = st.resumable;
    if (!r || st.running) return;
    st.setResumable(null);
    runRequest(
      "Resume — finish where it stopped",
      `The previous run did NOT finish (it errored mid-way). CONTINUE and COMPLETE the task using the current project state, which is already partially built — do not restart from scratch, just finish what's missing and fix anything broken.\n\nOriginal request:\n${r.full}`,
      { planOnly: false },
    );
  };

  // Plan-first: approve (optionally edited) plan → build it; or cancel.
  const approvePlan = (editedPlan: string) => {
    const st = useStore.getState();
    const pb = st.pendingBuild;
    st.setPendingPlan(null);
    planOnlyActive = false;
    if (!pb) return;
    runRequest(pb.display, pb.full, { approvedPlan: editedPlan, skipUserEcho: true });
  };
  const cancelPlan = () => {
    planOnlyActive = false;
    const st = useStore.getState();
    st.setPendingPlan(null);
    st.setPendingBuild(null);
  };

  return { runRequest, sendPrompt, answerQuestions, approveEstimate, declineEstimate, fixError, fixIssue, scanSecurity, fixFinding, fixFindingsBatch, deepScan, approvePlan, cancelPlan, resumeRun };
}
