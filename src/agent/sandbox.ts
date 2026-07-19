import type { FileMap } from "./types";

// Server-side call to the hardened runner (127.0.0.1:8093) — the SAME isolated, network-less Docker
// sandbox the UI uses. Lets the orchestrator VERIFY generated code against REAL execution
// (typecheck/build), grounding the fix-loop in reality instead of an LLM guessing — the pattern that
// makes OpenHands-class agents reliable. Best-effort: returns null if the runner is unreachable.
const RUNNER = process.env.HIVEY_RUNNER_URL || "http://127.0.0.1:8093";

export interface SandboxResult {
  ok: boolean;
  output: string;
  timedOut?: boolean;
}

export async function verifyInSandbox(files: FileMap, task: "typecheck" | "build" | "test"): Promise<SandboxResult | null> {
  // Only meaningful for a TS/JS project that has a tsconfig (else tsc has nothing to check).
  const hasTs = Object.keys(files).some((p) => /tsconfig.*\.json$/.test(p));
  if (task === "typecheck" && !hasTs) return null;

  try {
    const res = await fetch(`${RUNNER}/run`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ task, files }),
      signal: AbortSignal.timeout(160_000),
    });
    if (!res.ok) return null;
    const j = (await res.json()) as { ok?: boolean; output?: string; timedOut?: boolean; error?: string };
    if (j.error) return null;
    return { ok: !!j.ok, output: (j.output || "").slice(0, 6000), timedOut: j.timedOut };
  } catch {
    return null; // runner down / not configured — skip verification rather than fail the build
  }
}
