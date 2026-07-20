// 🐝 Hivey Code — shared agent types.

export type FileMap = Record<string, string>;

export type Role = "planner" | "coder" | "reviewer" | "debugger" | "tester";

// A clarifying question the guided (Hivey Smart) mode asks before building. The user picks one/many
// of `options` or types a custom answer.
export interface AgentQuestion {
  question: string;
  options: string[];
  multi?: boolean;
  design?: boolean; // a visual STYLE question → the UI shows design-direction thumbnails
}

// A concrete, previewable design direction. The UI renders a mockup from these tokens locally, which
// is why they are tokens and not markup — three directions cost one small call, not three mockups.
export interface DesignDirection {
  id: string;
  name: string;
  personality: string;
  bg: string;
  surface: string;
  text: string;
  muted: string;
  accent: string;
  accentText: string;
  font: string;
  headingFont: string;
  radius: number;
  density: "compact" | "regular" | "airy";
}

// A single step the orchestrator streams back to the UI (NDJSON, one JSON per line).
export type AgentEvent =
  | { type: "status"; role: Role | "orchestrator"; message: string }
  | { type: "reasoning"; chunk: string } // live model reasoning stream (shown as a collapsible block)
  | { type: "questions"; intro: string; questions: AgentQuestion[] } // guided mode: ask before building
  | { type: "plan"; content: string }
  | { type: "file-open"; path: string } // a file just started streaming (open it in the editor)
  | { type: "file-delta"; path: string; chunk: string } // append streamed content (live typing)
  | { type: "file"; path: string; content: string } // authoritative full content (final / clean)
  | { type: "message"; content: string } // assistant prose for the chat
  | { type: "review"; ok: boolean; notes: string }
  | { type: "usage"; role: Role; model: string; prompt: number; completion: number; cost: number } // per-call token/cost
  | { type: "error"; message: string }
  // Design checkpoint: concrete directions to look at BEFORE the expensive build. The run stops here;
  // the client resumes with `chosenDesign`.
  | { type: "design-options"; intro: string; directions: DesignDirection[] }
  // Cost gate: what this build is expected to cost, emitted BEFORE the coder runs so the user can
  // decline. The run stops after this; the client resumes with `approvedEstimate: true`.
  | {
      type: "estimate";
      low: number;
      high: number;
      priced: boolean;
      basis: string;
      lines: { role: string; model: string; promptTokens: number; completionTokens: number; low: number; high: number }[];
    }
  | { type: "done" };

export interface AgentRequest {
  prompt: string;
  files: FileMap; // current project (empty = from scratch)
  apiKey: string; // user's OpenRouter key (BYOK) — never persisted server-side
  keys?: Record<string, string>; // per-provider keys (anthropic via OpenRouter; openai/google/groq direct)
  localBaseUrls?: Record<string, string>; // per-local-provider base URL override (ollama/lmstudio/custom)
  variant: string; // "hivey/*" pseudo-model or a concrete model id
  reasoning?: "off" | "high" | "max";
  mode?: "auto" | "fast" | "deep"; // orchestration depth — auto picks fast (edit) vs deep (build)
  template?: string; // project stack id (react/vue/svelte/…/python/flutter) — see agent/templates.ts
  interview?: boolean; // guided (Hivey Smart) mode: false = skip questions & build now
  answered?: boolean; // the guided clarifying questions WERE answered → honour those choices over the template
  planOnly?: boolean; // plan-first: produce the plan then STOP (await user approval before coding)
  approvedPlan?: string; // a user-approved/edited plan → skip the planner, hand this to the coder
  design?: boolean; // false = skip the design checkpoint (user opted out of being asked)
  chosenDesign?: string; // the design direction the user picked, serialised as firm requirements
  estimate?: boolean; // false = skip the cost gate entirely (user opted out of being asked)
  approvedEstimate?: boolean; // the user saw the cost estimate and accepted it → build now
  ask?: boolean; // ASK mode: just ANSWER a question about the project (no build, no file changes)
}

export type HiveyVariant = "hivey/free" | "hivey" | "hivey/smart";

// A defensive security-audit finding for the Security tab.
export interface SecurityFinding {
  id: string;
  severity: "high" | "medium" | "low";
  title: string;
  file: string;
  line: number;
  category: string;
  why: string;
  fix: string;
  status?: "open" | "fixed";
}
