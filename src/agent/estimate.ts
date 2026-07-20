// 🐝 Cost estimation — tell the user what a build will cost BEFORE spending their money.
//
// Why this exists: measured over real runs, the CODER accounts for 88–99% of the bill. Any
// checkpoint placed after code generation saves nothing on that run, because the money is already
// gone. So the only checkpoint that can actually protect the user is one placed BEFORE the coder —
// which is what this module feeds.
//
// Two halves, deliberately separated:
//   • TOKEN PROFILES  — how many tokens a run of a given shape consumes. Calibrated from real runs
//                       (see PROFILES), not guessed. This is the part that stays stable.
//   • PRICING         — fetched live from OpenRouter. Never hardcoded: model prices change and new
//                       models ship constantly, so a pinned table would silently start lying.

export interface RolePrice {
  prompt: number; // $ per prompt token
  completion: number; // $ per completion token
}

export interface EstimateLine {
  role: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
  low: number;
  high: number;
}

export interface Estimate {
  low: number;
  high: number;
  lines: EstimateLine[];
  basis: string; // plain-language explanation shown to the user
  priced: boolean; // false when pricing was unavailable → token counts only, no $ claim
}

// ── Token profiles ───────────────────────────────────────────────────────────────────────────────
// Measured on real generations (dashboard / e-commerce / kanban), recorded rather than estimated:
//
//   template path  coder   ~6-10k prompt / 12–32k completion   reviewer  4.5–18k / 0.5–1.6k
//                  (12k = diff/patch sub-path, 32k = full-file rewrite; both are real)
//   from scratch   coder  19–52k prompt / 34–102k completion   reviewer  3–32k  / 0.3–0.7k
//
// The ranges are wide because they genuinely are — a kanban costs twice a dashboard. We surface a
// low/high band instead of a fake-precise single number.
type Shape = "template" | "scratch";

interface Profile {
  coder: { prompt: [number, number]; completion: [number, number] };
  reviewer: { prompt: [number, number]; completion: [number, number] };
}

const PROFILES: Record<Shape, Profile> = {
  template: {
    // The low bound covers the DIFF sub-path: when the template fits well, the coder emits
    // search/replace patches (~12k completion) instead of rewriting whole files (~30k). Measured at
    // $0.388 on Opus where a [26k, 32k] profile had predicted $0.69 minimum — a ~1.8x over-estimate.
    // Over-predicting is the safer error, but scaring a user off a $0.39 build is still a real cost.
    coder: { prompt: [5_000, 10_000], completion: [11_000, 32_000] },
    reviewer: { prompt: [4_000, 20_000], completion: [400, 1_800] },
  },
  scratch: {
    coder: { prompt: [18_000, 55_000], completion: [34_000, 105_000] },
    reviewer: { prompt: [3_000, 33_000], completion: [300, 3_000] },
  },
};

// A failed template adaptation pays for the adapter attempt AND the full rebuild. It is not the
// common case, so it widens the HIGH bound rather than shifting the whole estimate up.
const FALLBACK_MULTIPLIER = 1.9;

// The deep path adds a type-check→debug loop (up to 2 fixes) and a completeness pass on top.
const DEEP_EXTRA = 1.45;

export function tokenProfile(opts: {
  shape: Shape;
  depth: "fast" | "deep";
}): { coder: [number, number]; coderOut: [number, number]; rev: [number, number]; revOut: [number, number] } {
  const p = PROFILES[opts.shape];
  const deep = opts.depth === "deep" ? DEEP_EXTRA : 1;
  const hi = opts.shape === "template" ? FALLBACK_MULTIPLIER : 1;
  return {
    coder: [p.coder.prompt[0], Math.round(p.coder.prompt[1] * hi)],
    coderOut: [p.coder.completion[0], Math.round(p.coder.completion[1] * hi)],
    rev: [Math.round(p.reviewer.prompt[0] * deep), Math.round(p.reviewer.prompt[1] * deep)],
    revOut: [Math.round(p.reviewer.completion[0] * deep), Math.round(p.reviewer.completion[1] * deep)],
  };
}

// ── Live pricing ─────────────────────────────────────────────────────────────────────────────────
// Cached process-wide for an hour: model prices move on the order of weeks, and re-fetching a 338-
// entry catalogue on every build would be pure waste.
let priceCache: { at: number; map: Record<string, RolePrice> } | null = null;
const PRICE_TTL_MS = 60 * 60 * 1000;

export async function fetchPricing(apiKey: string, baseUrl = "https://openrouter.ai/api/v1"): Promise<Record<string, RolePrice>> {
  if (priceCache && Date.now() - priceCache.at < PRICE_TTL_MS) return priceCache.map;
  try {
    const r = await fetch(`${baseUrl}/models`, { headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {} });
    if (!r.ok) return priceCache?.map ?? {};
    const j = (await r.json()) as { data?: { id: string; pricing?: { prompt?: string; completion?: string } }[] };
    const map: Record<string, RolePrice> = {};
    for (const m of j.data ?? []) {
      const p = Number(m.pricing?.prompt ?? 0);
      const c = Number(m.pricing?.completion ?? 0);
      if (p > 0 || c > 0) map[m.id] = { prompt: p, completion: c };
    }
    priceCache = { at: Date.now(), map };
    return map;
  } catch {
    // Offline / rate-limited → fall back to whatever we had; the caller degrades to tokens-only.
    return priceCache?.map ?? {};
  }
}

// ── Assembling the estimate ──────────────────────────────────────────────────────────────────────
export function buildEstimate(opts: {
  shape: Shape;
  depth: "fast" | "deep";
  coderModel: string;
  reviewerModel: string;
  pricing: Record<string, RolePrice>;
}): Estimate {
  const t = tokenProfile({ shape: opts.shape, depth: opts.depth });
  const lines: EstimateLine[] = [];

  const price = (model: string): RolePrice | null => opts.pricing[model] ?? null;

  const add = (role: string, model: string, pr: [number, number], co: [number, number]) => {
    const p = price(model);
    lines.push({
      role,
      model,
      promptTokens: Math.round((pr[0] + pr[1]) / 2),
      completionTokens: Math.round((co[0] + co[1]) / 2),
      low: p ? pr[0] * p.prompt + co[0] * p.completion : 0,
      high: p ? pr[1] * p.prompt + co[1] * p.completion : 0,
    });
  };

  add("coder", opts.coderModel, t.coder, t.coderOut);
  if (opts.depth === "deep") add("reviewer", opts.reviewerModel, t.rev, t.revOut);

  const priced = lines.some((l) => l.high > 0);
  const low = lines.reduce((a, l) => a + l.low, 0);
  const high = lines.reduce((a, l) => a + l.high, 0);

  const basis =
    opts.shape === "template"
      ? "Based on adapting a ready-made template — the usual path, and the cheaper one. The upper bound covers the case where the template doesn't fit and the app has to be built from scratch instead."
      : "Based on building from scratch: no template matched your request, so every file is generated. The range reflects how much app you asked for — a kanban costs about twice a simple dashboard.";

  return { low, high, lines, basis, priced };
}

// One-line summary for the chat, e.g. "≈ $0.28 – $0.71".
export function formatEstimate(e: Estimate): string {
  if (!e.priced) return "Cost unavailable (pricing could not be fetched) — proceeding will still consume tokens.";
  const f = (n: number) => (n < 0.01 ? "<$0.01" : `$${n.toFixed(2)}`);
  return e.low === e.high ? f(e.high) : `${f(e.low)} – ${f(e.high)}`;
}
