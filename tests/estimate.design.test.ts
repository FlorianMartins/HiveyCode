// Tests for the two gates that run BEFORE the coder — the only place a checkpoint can still
// save the user money, since the coder is 88–99% of every bill.

import { test } from "node:test";
import assert from "node:assert/strict";
import { buildEstimate, tokenProfile, formatEstimate, type RolePrice } from "../src/agent/estimate.js";
import { contrastRatio, parseDirections, designToRequirements } from "../src/agent/design.js";

// Prices in $ per token, in the shape OpenRouter returns.
const PRICING: Record<string, RolePrice> = {
  "anthropic/claude-opus-5": { prompt: 0.000015, completion: 0.000075 },
  "anthropic/claude-sonnet-5": { prompt: 0.000003, completion: 0.000015 },
};

// ── Estimation ─────────────────────────────────────────────────────────────────────────────

test("an estimate is a real range, and the whole point is that it precedes the spend", () => {
  const e = buildEstimate({
    shape: "template", depth: "deep",
    coderModel: "anthropic/claude-opus-5", reviewerModel: "anthropic/claude-sonnet-5",
    pricing: PRICING,
  });
  assert.equal(e.priced, true);
  assert.ok(e.low > 0 && e.high > e.low, "a single number would be false precision");
  assert.equal(e.lines.length, 2, "coder and reviewer are both accounted for");
  assert.match(e.basis, /template/i);
});

test("building from scratch is dearer than adapting a template", () => {
  const common = { depth: "fast" as const, coderModel: "anthropic/claude-opus-5", reviewerModel: "anthropic/claude-sonnet-5", pricing: PRICING };
  const t = buildEstimate({ ...common, shape: "template" });
  const s = buildEstimate({ ...common, shape: "scratch" });
  assert.ok(s.low > t.low && s.high > t.high);
});

test("the fast path skips the reviewer, and says so by omitting its line", () => {
  const fast = buildEstimate({ shape: "template", depth: "fast", coderModel: "anthropic/claude-opus-5", reviewerModel: "anthropic/claude-sonnet-5", pricing: PRICING });
  assert.deepEqual(fast.lines.map((l) => l.role), ["coder"]);
});

test("the deep path costs more than the fast one", () => {
  const common = { shape: "scratch" as const, coderModel: "anthropic/claude-opus-5", reviewerModel: "anthropic/claude-sonnet-5", pricing: PRICING };
  assert.ok(buildEstimate({ ...common, depth: "deep" }).high > buildEstimate({ ...common, depth: "fast" }).high);
});

test("an unknown model yields token counts and NO dollar claim", () => {
  // Inventing a price for a model we have no price for would be worse than saying nothing.
  const e = buildEstimate({ shape: "template", depth: "fast", coderModel: "who/knows", reviewerModel: "who/knows", pricing: PRICING });
  assert.equal(e.priced, false);
  assert.equal(e.high, 0);
  assert.ok(e.lines[0].promptTokens > 0, "the token estimate still stands");
  assert.match(formatEstimate(e), /unavailable/i);
});

test("the template profile's low bound covers the diff path, not just full rewrites", () => {
  // Calibrating only on full-file rewrites over-predicted a real $0.39 build as $0.69 minimum.
  const p = tokenProfile({ shape: "template", depth: "fast" });
  assert.ok(p.coderOut[0] <= 12_000, "the cheap sub-path must be inside the range");
  assert.ok(p.coderOut[1] >= 30_000, "and so must a full rewrite");
});

test("the template high bound leaves room for a failed adaptation", () => {
  // A template that does not fit pays for the attempt AND the rebuild.
  const p = tokenProfile({ shape: "template", depth: "fast" });
  assert.ok(p.coderOut[1] > 32_000);
});

test("formatEstimate is readable and never shows a bare $0.00 for real work", () => {
  const e = buildEstimate({ shape: "template", depth: "fast", coderModel: "anthropic/claude-sonnet-5", reviewerModel: "anthropic/claude-sonnet-5", pricing: PRICING });
  assert.match(formatEstimate(e), /^\$\d+\.\d\d – \$\d+\.\d\d$/);
});

// ── Design directions ──────────────────────────────────────────────────────────────────────

test("contrastRatio matches the WCAG extremes", () => {
  assert.equal(Math.round(contrastRatio("#000000", "#ffffff")), 21);
  assert.equal(contrastRatio("#123456", "#123456"), 1);
  assert.equal(Math.round(contrastRatio("#000", "#fff")), 21, "shorthand hex works too");
});

test("contrastRatio refuses to invent a number for a non-colour", () => {
  assert.equal(contrastRatio("not a colour", "#fff"), 0);
});

const direction = (over: Record<string, unknown> = {}) => ({
  id: "1", name: "Atelier clair", personality: "calm, editorial",
  bg: "#F8FAFC", surface: "#FFFFFF", text: "#0F172A", muted: "#64748B",
  accent: "#4F46E5", accentText: "#FFFFFF",
  font: "Inter", headingFont: "Inter", radius: 12, density: "regular", motion: "subtle",
  ...over,
});

test("a well-formed direction parses with its tokens intact", () => {
  const [d] = parseDirections(JSON.stringify({ directions: [direction()] }));
  assert.equal(d.name, "Atelier clair");
  assert.equal(d.accent, "#4F46E5");
  assert.equal(d.motion, "subtle");
  assert.equal(d.radius, 12);
});

test("a direction whose body text is unreadable is REJECTED, not shipped", () => {
  // Offering it would be worse than offering two options: the user might pick it.
  const bad = direction({ text: "#DDDDDD", bg: "#FFFFFF" });
  assert.deepEqual(parseDirections(JSON.stringify({ directions: [bad] })), []);
});

test("a direction whose accent label is unreadable is rejected too", () => {
  const bad = direction({ accent: "#FFFF00", accentText: "#FFFFFF" });
  assert.deepEqual(parseDirections(JSON.stringify({ directions: [bad] })), []);
});

test("one bad direction does not take the good ones down with it", () => {
  const out = parseDirections(JSON.stringify({
    directions: [direction({ id: "1" }), direction({ id: "2", text: "#EEEEEE" }), direction({ id: "3" })],
  }));
  assert.deepEqual(out.map((d) => d.id), ["1", "3"]);
});

test("at most three directions are kept", () => {
  const out = parseDirections(JSON.stringify({ directions: [1, 2, 3, 4, 5].map((i) => direction({ id: String(i) })) }));
  assert.equal(out.length, 3);
});

test("a hex without # is accepted, because models write it both ways", () => {
  const [d] = parseDirections(JSON.stringify({ directions: [direction({ accent: "4F46E5" })] }));
  assert.equal(d.accent, "#4F46E5");
});

test("a missing colour disqualifies the direction rather than defaulting it", () => {
  const { accent, ...noAccent } = direction();
  assert.deepEqual(parseDirections(JSON.stringify({ directions: [noAccent] })), []);
});

test("unusable model output yields no directions instead of throwing", () => {
  for (const junk of ["", "I think a dark theme would be nice", "{ broken json", "{}", '{"directions":"soon"}']) {
    assert.deepEqual(parseDirections(junk), [], `should be empty: ${junk.slice(0, 20)}`);
  }
});

test("an unrecognised motion or density falls back to the professional default", () => {
  const [d] = parseDirections(JSON.stringify({ directions: [direction({ motion: "wild", density: "chunky" })] }));
  assert.equal(d.motion, "subtle");
  assert.equal(d.density, "regular");
});

test("radius is clamped instead of trusted", () => {
  const [big] = parseDirections(JSON.stringify({ directions: [direction({ radius: 9999 })] }));
  const [neg] = parseDirections(JSON.stringify({ directions: [direction({ radius: -20 })] }));
  assert.equal(big.radius, 32);
  assert.equal(neg.radius, 0);
});

test("the chosen direction becomes a spec the coder cannot drift away from", () => {
  const [d] = parseDirections(JSON.stringify({ directions: [direction()] }));
  const spec = designToRequirements(d);
  for (const token of ["#F8FAFC", "#4F46E5", "#0F172A", "Inter", "12px"]) {
    assert.ok(spec.includes(token), `the spec must state ${token}`);
  }
  assert.match(spec, /NON-NEGOTIABLE/);
  assert.match(spec, /prefers-reduced-motion/, "accessibility is part of the spec, not an extra");
  assert.match(spec, /transform.*opacity|opacity.*transform/, "only cheap properties may be animated");
});
