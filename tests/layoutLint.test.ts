// Tests for the deterministic layout lint.
//
// This lint exists because prompt rules are probabilistic: they lower how often a model breaks a
// layout, they never guarantee it. So each rule here has to be right about REAL code — a false
// positive costs a debugger pass on a file that was already fine, which is the expensive kind of
// mistake. Every rule is therefore tested from both sides: it fires on the defect, and it stays
// quiet on the correct version of the same markup.

import { test } from "node:test";
import assert from "node:assert/strict";
import { lintLayout, issuesForPrompt, layoutLintPlugin } from "../src/agent/layoutLint.js";
import { createHarness, type Harness } from "../src/agent/harness.js";

const rules = (files: Record<string, string>) => lintLayout(files).issues.map((i) => i.rule);
const app = (body: string) => `export default function App() {\n  return (\n${body}\n  );\n}\n`;

// ── control-over-field ─────────────────────────────────────────────────────────────────────

test("a control absolutely positioned over an input with no side padding is flagged", () => {
  const src = app(`    <div className="relative">
      <button onClick={clear} className="absolute right-2 top-2">✕</button>
      <input className="w-full rounded border" placeholder="Search" />
    </div>`);
  assert.deepEqual(rules({ "src/A.tsx": src }), ["control-over-field"]);
});

test("the same markup WITH the matching padding is not flagged", () => {
  const src = app(`    <div className="relative">
      <button onClick={clear} className="absolute right-2 top-2">✕</button>
      <input className="w-full rounded border pr-9" placeholder="Search" />
    </div>`);
  assert.deepEqual(rules({ "src/A.tsx": src }), []);
});

test("padding on the WRONG side does not count as clearance", () => {
  // pl-9 leaves room on the left; the control is anchored right. Accepting any padding at all
  // was the original bug — it made the rule agree with almost anything.
  const src = app(`    <div className="relative">
      <button onClick={clear} className="absolute right-2 top-2">✕</button>
      <input className="w-full border pl-9" />
    </div>`);
  assert.deepEqual(rules({ "src/A.tsx": src }), ["control-over-field"]);
});

test("a decorative icon is not treated as a control", () => {
  // A <span> emoji inside a label overlaps nothing the user can click; flagging it would send
  // the debugger after markup that is already correct.
  const src = app(`    <div className="relative">
      <span className="absolute left-3 top-2">🔍</span>
      <input className="w-full rounded border" placeholder="Search" />
    </div>`);
  assert.deepEqual(rules({ "src/A.tsx": src }), []);
});

test("an arrow function inside a JSX attribute does not blind the scanner", () => {
  // The regression this pins: a naive /<input[^>]*/ stops at the ">" inside `(e) =>`, so the
  // className is never read and every correctly-padded field was reported.
  const src = app(`    <div className="relative">
      <button onClick={clear} className="absolute left-2 top-2">🔍</button>
      <input className="w-full pl-9" onChange={(e) => setQuery(e.target.value)} value={query} />
    </div>`);
  assert.deepEqual(rules({ "src/A.tsx": src }), []);
});

// ── min-h-0 / min-w-0 auto-fix ─────────────────────────────────────────────────────────────

test("a scrolling flex child gains min-h-0 automatically", () => {
  const src = app(`    <div className="flex flex-col h-screen">
      <div className="flex-1 overflow-y-auto">list</div>
    </div>`);
  const r = lintLayout({ "src/A.tsx": src });
  assert.match(r.files["src/A.tsx"], /flex-1 min-h-0 overflow-y-auto|flex-1 overflow-y-auto min-h-0/);
  assert.equal(r.fixes.length, 1, "one fix, described for the user");
});

test("a file that already has min-h-0 is left alone", () => {
  const src = app(`    <div className="flex flex-col h-screen">
      <div className="flex-1 min-h-0 overflow-y-auto">list</div>
    </div>`);
  const r = lintLayout({ "src/A.tsx": src });
  assert.equal(r.fixes.length, 0);
  assert.equal(r.files["src/A.tsx"], src, "unchanged, byte for byte");
});

// ── dead buttons ───────────────────────────────────────────────────────────────────────────

test("a button with no handler, no type and no spread is dead", () => {
  const src = app(`    <button className="px-3 py-2 rounded">Settings</button>`);
  assert.deepEqual(rules({ "src/A.tsx": src }), ["dead-button"]);
});

test("a button is alive via onClick, submit, a spread, or being disabled", () => {
  const alive = [
    `<button onClick={() => save()}>Save</button>`,
    `<button type="submit">Send</button>`,
    `<button type="reset">Clear</button>`,
    `<button {...props}>Go</button>`,
    `<button disabled>Soon</button>`,
  ];
  for (const b of alive) {
    assert.deepEqual(rules({ "src/A.tsx": app(`    ${b}`) }), [], `should be alive: ${b}`);
  }
});

// ── motion without a reduced-motion guard ──────────────────────────────────────────────────

test("a keyframe animation without prefers-reduced-motion is flagged once for the project", () => {
  const css = `@keyframes rise { from { opacity: 0 } to { opacity: 1 } }\n.card { animation: rise 200ms }`;
  assert.deepEqual(rules({ "src/index.css": css }), ["motion-without-reduced-motion"]);
});

test("the same animation WITH the guard is accepted", () => {
  const css = `@keyframes rise { from { opacity: 0 } to { opacity: 1 } }
.card { animation: rise 200ms }
@media (prefers-reduced-motion: reduce) { .card { animation: none } }`;
  assert.deepEqual(rules({ "src/index.css": css }), []);
});

test("a plain hover transition is NOT treated as animation", () => {
  // Tightened deliberately: `transition duration-200` on a hover tint fired this rule on real
  // apps and cost a debugger pass for a colour change nobody would call motion.
  const src = app(`    <button onClick={go} className="transition duration-200 hover:bg-slate-100">Go</button>`);
  assert.deepEqual(rules({ "src/A.tsx": src }), []);
});

// ── monolithic file ────────────────────────────────────────────────────────────────────────

test("a long file holding several components is flagged", () => {
  const body = Array.from({ length: 320 }, (_, i) => `  const x${i} = ${i};`).join("\n");
  const src = `function Header() { return <h1>h</h1>; }\nfunction Row() { return <li>r</li>; }\nfunction Side() { return <aside/>; }\nexport default function App() {\n${body}\n  return <div/>;\n}\n`;
  assert.ok(rules({ "src/App.tsx": src }).includes("monolithic-file"));
});

test("a long file with a single component is not a monolith", () => {
  const body = Array.from({ length: 320 }, (_, i) => `  const x${i} = ${i};`).join("\n");
  assert.deepEqual(rules({ "src/App.tsx": `export default function App() {\n${body}\n  return <div/>;\n}\n` }), []);
});

// ── shape of the result ────────────────────────────────────────────────────────────────────

test("non-JSX files are ignored by the JSX rules", () => {
  assert.deepEqual(rules({ "src/util.ts": `export const f = () => "<input className='' />";` }), []);
});

test("an empty project lints clean", () => {
  const r = lintLayout({});
  assert.deepEqual([r.issues, r.fixes], [[], []]);
});

test("issuesForPrompt locates every issue so the debugger does not have to search", () => {
  const src = app(`    <button className="p-2">Dead</button>`);
  const out = issuesForPrompt(lintLayout({ "src/A.tsx": src }).issues);
  assert.match(out, /^- src\/A\.tsx:\d+ \[dead-button\] /);
});

// ── The plugin: lint what the agent writes, as it writes it ────────────────────────────────

async function runWrite(ctx: Harness, files: { path: string; content: string }[]) {
  const call = { id: "1", name: "write_file", input: {} };
  const result = { output: `wrote ${files[0].path}`, summary: "wrote", detail: "write", files };
  return ctx.waterfall("tools/post-execute", { call, result }, (v: any) => v.result);
}

test("the plugin auto-fixes a written file and tells the model what it did", async () => {
  const ctx = createHarness();
  const project: Record<string, string> = {};
  ctx.plug(layoutLintPlugin(project));
  const out: any = await runWrite(ctx, [{
    path: "src/A.tsx",
    content: app(`    <div className="flex flex-col h-screen"><div className="flex-1 overflow-y-auto">x</div></div>`),
  }]);
  assert.match(out.files[0].content, /min-h-0/, "the fix reached the file");
  assert.equal(project["src/A.tsx"], out.files[0].content, "and the project the UI renders");
  assert.match(out.output, /auto-fixed/i, "and the model is told, so it stops re-introducing it");
});

test("the plugin hands unfixable problems back as instructions", async () => {
  const ctx = createHarness();
  ctx.plug(layoutLintPlugin({}));
  const out: any = await runWrite(ctx, [{ path: "src/A.tsx", content: app(`    <button className="p-2">Dead</button>`) }]);
  assert.match(out.output, /Layout problems you must fix/);
  assert.match(out.output, /dead-button/);
});

test("a clean file passes through the plugin untouched", async () => {
  const ctx = createHarness();
  const content = app(`    <button onClick={go} className="p-2">Go</button>`);
  ctx.plug(layoutLintPlugin({}));
  const out: any = await runWrite(ctx, [{ path: "src/A.tsx", content }]);
  assert.equal(out.files[0].content, content);
  assert.equal(out.output, "wrote src/A.tsx", "no noise added to a clean write");
});

test("the plugin ignores tools other than write_file", async () => {
  const ctx = createHarness();
  ctx.plug(layoutLintPlugin({}));
  const result = { output: "ok — no type errors", summary: "✓", detail: "typecheck", files: [] };
  const out = await ctx.waterfall("tools/post-execute", { call: { id: "1", name: "typecheck", input: {} }, result }, (v: any) => v.result);
  assert.deepEqual(out, result);
});
