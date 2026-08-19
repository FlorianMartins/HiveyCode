// 🐝 Deterministic LAYOUT lint — the layout rules in roles.ts are prompt guidance, which is
// probabilistic: it lowers how often the model breaks a layout, it never guarantees it. The defects
// below are mechanical and detectable from the markup alone, so we check them in code instead of
// paying a model to maybe notice them.
//
// Two tiers:
//   • FIXES  — rewrites we can apply with confidence because adding the class is a strict
//              improvement and cannot change a correct layout (min-h-0 / min-w-0 on a flex child).
//   • ISSUES — real defects we can spot but NOT safely auto-repair (the right padding depends on the
//              control's actual width). These are handed to the debugger as concrete, located facts,
//              which is far cheaper and more reliable than asking it to hunt for them.
//
// Everything operates ONLY inside `className` string literals, so a false match can never corrupt
// logic — the worst case is a redundant utility class.

import type { FileMap } from "./types";
import type { Harness, Plugin } from "./harness";

export interface LayoutIssue {
  file: string;
  line: number;
  rule: string;
  detail: string;
}

export interface LintResult {
  files: FileMap;
  fixes: string[]; // human-readable, one per applied fix
  issues: LayoutIssue[]; // detected, not auto-fixed
}

const JSX_RE = /\.(tsx|jsx)$/;

// Matches a className value we can safely rewrite: a plain string literal, in either
// className="…" or className={"…"} / className={`…`} form (no interpolation).
const CLASSNAME_RE = /className=(?:"([^"{}]*)"|\{\s*(?:"([^"{}]*)"|`([^`${}]*)`)\s*\})/g;

function classesOf(m: RegExpExecArray): string | null {
  return m[1] ?? m[2] ?? m[3] ?? null;
}

const has = (cls: string, name: string) => new RegExp(`(^|\\s)${name}(\\s|$)`).test(cls);

// `flex-1`, `flex-auto`, `flex-[1_1_0%]`, `grow`… — anything that makes the child share free space.
const isFlexChild = (cls: string) => /(^|\s)(flex-1|flex-auto|grow|flex-\[)/.test(cls);
const scrollsY = (cls: string) => /(^|\s)overflow-(y-)?(auto|scroll)(\s|$)/.test(cls);
const scrollsX = (cls: string) => /(^|\s)overflow-(x-)?(auto|scroll)(\s|$)/.test(cls);
const shrinksText = (cls: string) => /(^|\s)(truncate|text-ellipsis|line-clamp-)/.test(cls);

function lineOf(src: string, index: number): number {
  return src.slice(0, index).split("\n").length;
}

// ── Auto-fixable: the missing-min-size family ────────────────────────────────────────────────────
// A flex child defaults to `min-height:auto`, which refuses to shrink below its content. A scrollable
// pane inside a flex column therefore grows the page instead of scrolling itself — the single most
// common layout bug in generated apps. `min-h-0` restores the intended behaviour and is inert on a
// layout that was already correct.
function fixMinSizes(path: string, src: string): { out: string; fixes: string[] } {
  const fixes: string[] = [];
  const out = src.replace(CLASSNAME_RE, (full, ...rest) => {
    const m = [full, ...rest] as unknown as RegExpExecArray;
    const cls = classesOf(m);
    if (cls == null) return full;

    let next = cls;
    if (isFlexChild(next) && scrollsY(next) && !has(next, "min-h-0")) {
      next = `${next} min-h-0`.trim();
      fixes.push(`${path}: added min-h-0 to a scrollable flex child (it would have overflowed instead of scrolling)`);
    }
    if (isFlexChild(next) && (shrinksText(next) || scrollsX(next)) && !has(next, "min-w-0")) {
      next = `${next} min-w-0`.trim();
      fixes.push(`${path}: added min-w-0 to a flex child holding truncated/overflowing content (it would have blown out the row width)`);
    }
    return next === cls ? full : full.replace(cls, next);
  });
  return { out, fixes };
}

// ── Detect-only: a control absolutely positioned over a text field ───────────────────────────────
// This is the defect the user actually reported ("bouton menu sur la zone d'écriture"). We cannot
// auto-fix it: the correct repair is either restructuring into a flex row or adding padding sized to
// the control, and guessing the padding would be worse than reporting it precisely.
//
// Heuristic: within one JSX element block, an <input>/<textarea> whose className lacks side padding,
// alongside a sibling carrying `absolute` + a horizontal anchor (left-*/right-*/inset-*).
const FIELD_RE = /<(input|textarea)\b/gi;

// Returns the full JSX opening tag starting at `start`. A naive `[^>]*` is WRONG here: JSX props are
// full of arrow functions (`onChange={(e) => …}`), and the `>` of `=>` truncates the tag before its
// className — which silently turns the padding check below into a false-positive machine. So we scan
// forward tracking brace depth and quotes, and stop at the first `>` that really closes the tag.
function openingTag(src: string, start: number): string {
  let depth = 0;
  let quote = "";
  for (let i = start; i < src.length && i < start + 4000; i++) {
    const c = src[i];
    if (quote) {
      if (c === quote && src[i - 1] !== "\\") quote = "";
      continue;
    }
    if (c === '"' || c === "'" || c === "`") { quote = c; continue; }
    if (c === "{") depth++;
    else if (c === "}") depth--;
    else if (c === ">" && depth === 0) return src.slice(start, i + 1);
  }
  return src.slice(start, start + 4000);
}

function findOverlaps(path: string, src: string): LayoutIssue[] {
  const issues: LayoutIssue[] = [];
  let fm: RegExpExecArray | null;
  FIELD_RE.lastIndex = 0;
  while ((fm = FIELD_RE.exec(src))) {
    const tag = openingTag(src, fm.index);
    const cm = /className=(?:"([^"{}]*)"|\{\s*(?:"([^"{}]*)"|`([^`${}]*)`)\s*\})/.exec(tag);
    const fieldCls = cm ? (cm[1] ?? cm[2] ?? cm[3] ?? "") : "";

    // Look at a window around the field for an absolutely-anchored sibling control.
    const start = Math.max(0, fm.index - 700);
    const win = src.slice(start, fm.index + 700);
    const overlay = /className=(?:"[^"{}]*|\{\s*(?:"[^"{}]*|`[^`${}]*))\babsolute\b[^"`]*\b(left-|right-|inset-)/.exec(win);
    if (!overlay) continue;

    // Padding must be on the SAME side the control is anchored to. `pl-9` next to a left-anchored
    // search icon is the correct construction, not a defect — the overwhelmingly common case.
    const side = overlay[1];
    const padRe =
      side === "left-" ? /(^|\s)(p|px|pl)-\S+/
      : side === "right-" ? /(^|\s)(p|px|pr)-\S+/
      : /(^|\s)(p|px|pl|pr)-\S+/;
    if (padRe.test(fieldCls)) continue;
    // Only flag when the overlay sits next to a real control, not a decorative icon inside a label.
    if (!/<(button|svg|select)\b/i.test(win)) continue;

    issues.push({
      file: path,
      line: lineOf(src, fm.index),
      rule: "control-over-field",
      detail:
        `a control is absolutely positioned over the <${fm[1].toLowerCase()}>, whose className has no ` +
        `matching side padding — typed text will run underneath it. Fix by making the control a flex ` +
        `SIBLING of the field (field: flex-1 min-w-0, control: shrink-0), or add padding ≥ control width + 8px on that side.`,
    });
  }
  return issues;
}

// ── Detect-only: fixed/sticky bar with no compensating space ─────────────────────────────────────
// A `fixed bottom-0` bar covers the last rows of whatever scrolls behind it unless the scroll
// container reserves room. We report rather than fix because the needed amount is the bar's height.
function findFixedBars(path: string, src: string): LayoutIssue[] {
  const issues: LayoutIssue[] = [];
  const re = /className=(?:"([^"{}]*)"|\{\s*(?:"([^"{}]*)"|`([^`${}]*)`)\s*\})/g;
  let m: RegExpExecArray | null;
  const scrollHasBottomPad = /className=(?:"[^"{}]*|\{\s*(?:"[^"{}]*|`[^`${}]*))[^"`]*\boverflow-(y-)?(auto|scroll)\b[^"`]*\b(pb-|mb-|scroll-mb-)/.test(src);
  while ((m = re.exec(src))) {
    const cls = classesOf(m);
    if (cls == null) continue;
    if (!/(^|\s)fixed(\s|$)/.test(cls)) continue;
    if (!/(^|\s)bottom-0(\s|$)/.test(cls)) continue;
    if (scrollHasBottomPad) continue;
    issues.push({
      file: path,
      line: lineOf(src, m.index),
      rule: "fixed-bar-covers-content",
      detail:
        "a `fixed bottom-0` bar overlays the scrolling content and no scroll container reserves bottom " +
        "space — the last row will sit underneath it. Add bottom padding equal to the bar height on the " +
        "scrolling element, or restructure as a flex column with the bar as a non-scrolling last child.",
    });
  }
  return issues;
}

// ── Detect-only: motion with no reduced-motion escape hatch ──────────────────────────────────────
// We now instruct the coder to animate, which makes this a defect we created the conditions for: a
// user with vestibular sensitivity has `prefers-reduced-motion: reduce` set and expects it honoured.
// Checked across the WHOLE project (not per file) because the media query usually lives in the CSS
// while the animations live in components.
function findUnguardedMotion(files: FileMap): LayoutIssue[] {
  const all = Object.entries(files);
  const guarded = all.some(([, src]) => typeof src === "string" && /prefers-reduced-motion/.test(src));
  if (guarded) return [];

  for (const [path, src] of all) {
    if (typeof src !== "string") continue;
    // Only genuine animation. A bare `transition duration-200` on a hover tint is too mild to be worth
    // a paid debugger pass, and flagging it would fire on nearly every app — noise that costs money.
    const m = /(@keyframes\s|animate-\[|animate-(spin|ping|pulse|bounce)\b|animation:\s*[a-z]|transition:\s*(all|transform))/.exec(src);
    if (!m) continue;
    return [
      {
        file: path,
        line: lineOf(src, m.index),
        rule: "motion-without-reduced-motion",
        detail:
          "the project animates but never references `prefers-reduced-motion`. Add a " +
          "`@media (prefers-reduced-motion: reduce)` block that collapses animations/transitions to " +
          "near-zero duration (or opacity-only). Accessibility requirement, not an option.",
      },
    ];
  }
  return [];
}

// ── Detect-only: a monolithic file ───────────────────────────────────────────────────────────────
// Not a layout defect, but the same kind of mechanical, checkable one — and the module is where our
// deterministic code checks live. Every seed/template ships as a single App.tsx, so an adapter that
// only patches inherits that shape: a real Pro build came back as one 27 Ko App.tsx holding the whole
// product. We report rather than auto-split, because moving components between files means rewriting
// imports/exports and a mechanical guess there would break the build.
const COMPONENT_RE = /^(?:export\s+)?(?:function\s+([A-Z]\w*)\s*\(|const\s+([A-Z]\w*)\s*(?::[^=]+)?=\s*(?:\([^)]*\)|[A-Za-z_$][\w$]*)\s*=>)/gm;

function findMonolith(path: string, src: string): LayoutIssue[] {
  const lines = src.split("\n").length;
  if (lines <= 300) return [];
  COMPONENT_RE.lastIndex = 0;
  const names = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = COMPONENT_RE.exec(src))) names.add((m[1] || m[2]) as string);
  if (names.size < 3) return []; // one long component is a different problem from a monolith
  return [
    {
      file: path,
      line: 1,
      rule: "monolithic-file",
      detail:
        `${lines} lines holding ${names.size} components (${[...names].slice(0, 5).join(", ")}…). Split it: ` +
        `one component per file under components/ with a named export and a Props interface, hooks into ` +
        `hooks/, pure helpers into lib/, shared types into types.ts. App.tsx keeps only composition. ` +
        `Emit every new file and fix every import.`,
    },
  ];
}

// ── Detect-only: a button wired to nothing ───────────────────────────────────────────────────────
// The coder prompt forbids dead buttons and the LLM reviewer is asked to hunt them, but it proved
// unreliable: in one Pro build it caught a dead mobile-menu toggle while missing four dead items in a
// user dropdown right next to it. Whether a <button> carries a handler is decidable from the markup,
// so it should not depend on a model noticing.
//
// Uses the same brace/quote-aware tag scan as the overlap rule: a naive regex stops at the `>` inside
// `onClick={() => …}` and would report every correctly-wired button as dead.
const BUTTON_RE = /<button\b/gi;

function findDeadButtons(path: string, src: string): LayoutIssue[] {
  const issues: LayoutIssue[] = [];
  BUTTON_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  const dead: number[] = [];
  while ((m = BUTTON_RE.exec(src))) {
    const tag = openingTag(src, m.index);
    // Anything that can make it act: a handler, a form submit/reset, or props spread in from a parent
    // (which may well carry onClick — too uncertain to call dead).
    if (/\bon[A-Z]\w*\s*=/.test(tag)) continue;
    if (/\btype\s*=\s*[{"']?\s*(submit|reset)/.test(tag)) continue;
    if (/\{\s*\.\.\./.test(tag)) continue;
    if (/\bdisabled\b/.test(tag)) continue; // deliberately inert
    dead.push(lineOf(src, m.index));
  }
  if (!dead.length) return issues;
  issues.push({
    file: path,
    line: dead[0],
    rule: "dead-button",
    detail:
      `${dead.length} <button> with no handler (line${dead.length > 1 ? "s" : ""} ${dead.slice(0, 6).join(", ")}). ` +
      `Wire each one to real behaviour, or render it as non-interactive markup if it is decorative. ` +
      `A control that looks clickable and does nothing reads as a broken app.`,
  });
  return issues;
}

// Runs every rule over the JSX/TSX files of a project.

// ── Comments are not markup ──────────────────────────────────────────────────────────────────────
// Every detector below scans source text for tags, so a comment that MENTIONS a tag reads as one.
// Found by running this lint against HiveyCode's own source: a comment explaining why a decorative
// `<button>` had been replaced was itself reported as a dead `<button>` — the lint flagging the note
// about the fix it had asked for. Comment bodies are blanked rather than removed so every offset,
// and therefore every reported line number, stays exactly where it was.
function blankComments(src: string): string {
  let out = "";
  let i = 0;
  let quote: string | null = null;
  while (i < src.length) {
    const c = src[i];
    const next = src[i + 1];
    if (quote) {
      out += c;
      if (c === "\\") { out += next ?? ""; i += 2; continue; }
      if (c === quote) quote = null;
      i++;
      continue;
    }
    if (c === '"' || c === "'" || c === "`") { quote = c; out += c; i++; continue; }
    if (c === "/" && next === "/") {
      while (i < src.length && src[i] !== "\n") { out += " "; i++; }
      continue;
    }
    if (c === "/" && next === "*") {
      out += "  "; i += 2;
      while (i < src.length && !(src[i] === "*" && src[i + 1] === "/")) { out += src[i] === "\n" ? "\n" : " "; i++; }
      if (i < src.length) { out += "  "; i += 2; }
      continue;
    }
    out += c;
    i++;
  }
  return out;
}

export function lintLayout(files: FileMap): LintResult {
  const out: FileMap = { ...files };
  const fixes: string[] = [];
  const issues: LayoutIssue[] = [];

  for (const [path, src] of Object.entries(files)) {
    if (!JSX_RE.test(path) || typeof src !== "string") continue;
    const r = fixMinSizes(path, src);
    if (r.out !== src) out[path] = r.out;
    fixes.push(...r.fixes);
    // Detectors read the comment-free view; the auto-fixer keeps working on the real source.
    const scan = blankComments(r.out);
    issues.push(...findOverlaps(path, scan), ...findFixedBars(path, scan), ...findMonolith(path, scan), ...findDeadButtons(path, scan));
  }
  issues.push(...findUnguardedMotion(out));
  return { files: out, fixes, issues };
}

// Compact, located brief for the debugger — facts it would otherwise have to spend tokens finding.
export function issuesForPrompt(issues: LayoutIssue[]): string {
  return issues.map((i) => `- ${i.file}:${i.line} [${i.rule}] ${i.detail}`).join("\n");
}

/**
 * Deterministic layout review of everything the agent writes.
 *
 * The orchestrated build path already lints its output, but files written by the autonomous
 * agent went straight into the project unchecked — the same `min-h-0` omissions and dead
 * buttons, with nothing to catch them. As a post-execute listener it costs no model call: the
 * fix is applied, and anything not auto-fixable is appended to what the model reads next, so
 * the agent sees its own mistake on the very next step instead of the user seeing it later.
 */
/** What a tool hands back to the loop; only the shape this plugin needs is declared here. */
interface WriteOutcome {
  output: string;
  files: { path: string; content: string }[];
}

export function layoutLintPlugin(project: FileMap): Plugin {
  return {
    name: "layout-lint",
    apply(ctx: Harness) {
      ctx.on("tools/post-execute", async (v: any, next: any) => {
        const outcome = v.result as WriteOutcome;
        if (v.call.name !== "write_file" || !outcome?.files?.length) return next(v);

        const written: FileMap = {};
        for (const f of outcome.files) written[f.path] = f.content;
        const lint = lintLayout(written);
        if (!lint.fixes.length && !lint.issues.length) return next(v);

        const files = outcome.files.map((f) => ({ path: f.path, content: lint.files[f.path] ?? f.content }));
        for (const f of files) project[f.path] = f.content;

        const notes = [
          lint.fixes.length ? `Layout check auto-fixed: ${lint.fixes.join("; ")}` : "",
          lint.issues.length ? `Layout problems you must fix:\n${issuesForPrompt(lint.issues)}` : "",
        ].filter(Boolean).join("\n");

        return next({ ...v, result: { ...outcome, files, output: `${outcome.output}\n${notes}` } });
      }, 50);
    },
  };
}
