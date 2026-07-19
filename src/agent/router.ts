// 🐝 Adaptive depth router — the "best of both worlds" dial. Small tweaks take the FAST path
// (one direct coder pass, bolt-style: instant & cheap); real builds take the DEEP agentic path
// (planner → coder → reviewer → debugger …). The user can force a mode; "auto" decides by a cheap
// heuristic (no extra LLM call, so no added cost or latency).

export type Depth = "fast" | "deep";
export type Mode = "auto" | "fast" | "deep";

const BUILDY =
  /\b(build|create|make me|scaffold|generate|implement|design|add (a|an|the)?\s*(new\s+)?(page|screen|feature|section|dashboard|component|view|app|module)|rebuild|redesign|from scratch)\b/i;

export function resolveDepth(mode: Mode, prompt: string, hasProject: boolean): Depth {
  // A from-scratch build ALWAYS gets the full pipeline (feature-scoping → plan → code → test →
  // completeness) — a fast single pass produces a too-minimal app. This wins over the mode toggle.
  if (!hasProject) return "deep";

  if (mode === "fast" || mode === "deep") return mode; // explicit user choice on an existing project
  if (BUILDY.test(prompt) || prompt.length > 240) return "deep"; // substantial new work
  return "fast"; // a small edit/tweak on an existing project → straight to the coder
}
