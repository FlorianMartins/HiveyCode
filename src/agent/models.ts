import type { HiveyVariant, Role } from "./types";

/**
 * 🐝 Per-task model routing. The whole point of Hivey: get a top-tier RESULT for LESS by using the
 * right model for each role instead of throwing the most expensive model at everything.
 *
 *  - hivey/free  → 100% free models (no cost).
 *  - hivey       → hybrid ("Smart"): a strong model on the roles the user FEELS (scope, code,
 *                  review), a cheap one on throwaway text.
 *  - hivey/smart → "Pro": Opus-grade code + reasoning, cheap models still handle plumbing.
 *
 * Auxiliary roles (planner/reviewer/tester) only emit short TEXT, not the final code — so they run
 * on cheaper models. The expensive model is reserved for the CODER (and debugger), where it matters.
 *
 * ⚙️ AUTO-MAINTAINED by scripts/update-models.mjs (daily systemd timer `hiveycode-models.timer`):
 * every assignment is bumped to the NEWEST model of the SAME family when the vendor ships one
 * (Opus 4.8 → Opus 4.9, Sonnet 5 → Sonnet 6…), and any id that disappears from the catalogue is
 * repaired. Same-family only — never a risky cross-vendor jump. Edit the ids freely: the script
 * only ever moves a role FORWARD within the family you chose.
 *
 * MEASURED, 2026-08-19: in a free-model bake-off on three pure functions with edge cases — the
 * answer EXTRACTED and EXECUTED against assertions, not eyeballed — every code-SPECIALISED free
 * model scored 2/3 (poolside/laguna-s-2.1 and -xs, cohere/north-mini-code) while the general
 * nemotron-3-super-120b-a12b and nemotron-3.5-lightning scored 3/3. The free coder and debugger
 * moved accordingly. A "-code" suffix is a claim, not a result.
 */
// <hivey:start>
const MODELS: Record<HiveyVariant, Record<Role, string>> = {
  "hivey/free": {
    "planner": "nvidia/nemotron-3.5-lightning:free",
    "coder": "nvidia/nemotron-3-super-120b-a12b:free",
    "reviewer": "nvidia/nemotron-3.5-lightning:free",
    "debugger": "nvidia/nemotron-3-super-120b-a12b:free",
    "tester": "nvidia/nemotron-3.5-lightning:free"
  },
  "hivey": {
    "planner": "anthropic/claude-sonnet-5",
    "coder": "anthropic/claude-sonnet-5",
    "reviewer": "anthropic/claude-sonnet-5",
    "debugger": "anthropic/claude-sonnet-5",
    "tester": "anthropic/claude-haiku-4.5"
  },
  "hivey/smart": {
    "planner": "anthropic/claude-sonnet-5",
    "coder": "anthropic/claude-opus-5",
    "reviewer": "anthropic/claude-sonnet-5",
    "debugger": "anthropic/claude-opus-5",
    "tester": "anthropic/claude-haiku-4.5"
  }
};
// <hivey:end>

export function modelFor(variant: string, role: Role): string {
  // A "hivey/*" pseudo-model routes per role; any other value is a concrete model id the user
  // picked from the full catalog → use it for every role.
  if (variant in MODELS) return MODELS[variant as HiveyVariant][role];
  // A stale/renamed "hivey/*" (or bare "hivey") that isn't an exact key must NEVER be sent raw to
  // OpenRouter (→ 400 "hivey/… is not a valid model ID"). Route it through the Free preset instead.
  if (!variant || variant === "hivey" || variant.startsWith("hivey/")) return MODELS["hivey/free"][role];
  return variant;
}

// "Hivey" is the provider (group header); the models are just Free / Optimize / Smart (no redundant
// "Hivey" prefix everywhere).
export const VARIANT_LABELS: Record<HiveyVariant, string> = {
  "hivey/free": "Free",
  hivey: "Smart",
  "hivey/smart": "Pro",
};
