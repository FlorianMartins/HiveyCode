import type { FileMap } from "./types";

// ── Diff / patch editing (Claude-Code-style) ────────────────────────────────────────────────────
// For edits on an EXISTING project the coder emits targeted search/replace patches instead of whole
// files — ~10× fewer output tokens and far faster. Format:
//   <edit path="src/App.tsx">
//   <<<<<<< SEARCH
//   <exact current snippet>
//   =======
//   <replacement>
//   >>>>>>> REPLACE
//   </edit>
// New files still use a full <file>…</file> block.
export interface Patch {
  path: string;
  replacements: { search: string; replace: string }[];
}

export function parseEdits(text: string): { patches: Patch[]; fullFiles: FileMap } {
  const fullFiles = parseFileBlocksRaw(text);
  const patches: Patch[] = [];
  const editRe = /<edit\s+path="([^"]+)"\s*>([\s\S]*?)<\/edit>/g;
  const srRe = /<{5,}\s*SEARCH\s*\n([\s\S]*?)\n?={5,}\s*\n([\s\S]*?)\n?>{5,}\s*REPLACE/g;
  let m: RegExpExecArray | null;
  while ((m = editRe.exec(text)) !== null) {
    const path = m[1].trim().replace(/^\.?\//, "");
    const body = m[2];
    const reps: { search: string; replace: string }[] = [];
    let s: RegExpExecArray | null;
    srRe.lastIndex = 0;
    while ((s = srRe.exec(body)) !== null) reps.push({ search: s[1], replace: s[2] });
    if (path && reps.length) patches.push({ path, replacements: reps });
  }
  return { patches, fullFiles };
}

const trimTrailing = (s: string) => s.split("\n").map((l) => l.replace(/[ \t]+$/, "")).join("\n");

// Indentation-tolerant replace: the #1 reason a model's SEARCH block fails to match is a leading-
// whitespace mismatch (the model re-indented, or the file uses tabs vs spaces). We match line-by-line
// on the TRIMMED text, then re-indent the replacement to the block's real indentation. Returns the new
// content, or null if the block genuinely isn't there.
function fuzzyReplace(content: string, search: string, replace: string): string | null {
  const cl = content.split("\n");
  const sl = search.replace(/[ \t]+$/gm, "").split("\n");
  while (sl.length && sl[sl.length - 1].trim() === "") sl.pop();
  while (sl.length && sl[0].trim() === "") sl.shift();
  if (!sl.length) return null;
  const sTrim = sl.map((l) => l.trim());
  for (let i = 0; i + sl.length <= cl.length; i++) {
    let ok = true;
    for (let j = 0; j < sl.length; j++) {
      if (cl[i + j].trim() !== sTrim[j]) { ok = false; break; }
    }
    if (!ok) continue;
    const baseIndent = cl[i].match(/^[ \t]*/)?.[0] ?? "";
    const searchIndent = sl[0].match(/^[ \t]*/)?.[0] ?? "";
    const rl = replace.split("\n").map((l) => (l.startsWith(searchIndent) ? baseIndent + l.slice(searchIndent.length) : l));
    return [...cl.slice(0, i), ...rl, ...cl.slice(i + sl.length)].join("\n");
  }
  return null;
}

// Apply patches (+ any full new files) to the project. Returns the new file map, the changed paths,
// and any patches whose SEARCH text couldn't be located (so the UI can flag them).
export function applyEdits(
  files: FileMap,
  patches: Patch[],
  fullFiles: FileMap,
): { files: FileMap; changed: string[]; failures: { path: string; snippet: string }[] } {
  const out: FileMap = { ...files };
  const changed = new Set<string>();
  const failures: { path: string; snippet: string }[] = [];

  for (const [p, c] of Object.entries(fullFiles)) {
    out[p] = c;
    changed.add(p);
  }

  for (const patch of patches) {
    let content = out[patch.path];
    // A patch on a missing file with an empty SEARCH = create it.
    if (content == null) {
      if (patch.replacements.length === 1 && !patch.replacements[0].search.trim()) {
        out[patch.path] = patch.replacements[0].replace;
        changed.add(patch.path);
      } else {
        failures.push({ path: patch.path, snippet: "(file not found)" });
      }
      continue;
    }
    for (const r of patch.replacements) {
      if (!r.search.trim()) {
        content += (content.endsWith("\n") ? "" : "\n") + r.replace; // empty SEARCH = append
        continue;
      }
      if (content.includes(r.search)) {
        content = content.replace(r.search, r.replace);
      } else {
        // Tolerant fallback 1: ignore trailing-whitespace differences (common model slip).
        const ct = trimTrailing(content);
        const st = trimTrailing(r.search);
        if (ct.includes(st)) {
          content = ct.replace(st, r.replace);
        } else {
          // Tolerant fallback 2: indentation-tolerant line match (re-indents the replacement).
          const fz = fuzzyReplace(content, r.search, r.replace);
          if (fz != null) content = fz;
          else failures.push({ path: patch.path, snippet: r.search.trim().slice(0, 80) });
        }
      }
    }
    out[patch.path] = content;
    changed.add(patch.path);
  }
  return { files: out, changed: [...changed], failures };
}

// Like parseFileBlocks but WITHOUT the markdown fallback (used by parseEdits, where a fence would
// be a false positive).
function parseFileBlocksRaw(text: string): FileMap {
  const files: FileMap = {};
  const re = /<file\s+path="([^"]+)"\s*>\n?([\s\S]*?)\n?<\/file>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const path = m[1].trim().replace(/^\.?\//, "");
    const content = m[2].replace(/^```[a-zA-Z]*\n/, "").replace(/\n```\s*$/, "");
    if (path) files[path] = content;
  }
  return files;
}

// Parse <file path="...">...</file> blocks out of a model response into a FileMap. Falls back to
// markdown code fences with a filename when a model ignores the <file> format (common on free models).
export function parseFileBlocks(text: string): FileMap {
  const files: FileMap = {};
  const re = /<file\s+path="([^"]+)"\s*>\n?([\s\S]*?)\n?<\/file>/g;
  let m: RegExpExecArray | null;

  while ((m = re.exec(text)) !== null) {
    const path = m[1].trim().replace(/^\.?\//, "");
    let content = m[2];
    content = content.replace(/^```[a-zA-Z]*\n/, "").replace(/\n```\s*$/, "");
    if (path) files[path] = content;
  }

  if (Object.keys(files).length === 0) return fallbackParse(text);
  return files;
}

const PATH_RE = /([\w./@-]+\.(?:tsx?|jsx?|css|scss|html?|json|md|mjs|cjs|svg|ya?ml))/;

// Fallback: scan fenced ``` code blocks and pair each with a filename found in its info-string
// (```tsx src/App.tsx) or on the line just before it (**src/App.tsx**, `File: …`, `src/App.tsx:`).
export function fallbackParse(text: string): FileMap {
  const files: FileMap = {};
  const re = /(^|\n)([^\n`]*)\n```([^\n]*)\n([\s\S]*?)```/g;
  let m: RegExpExecArray | null;

  while ((m = re.exec(text)) !== null) {
    const before = m[2] || "";
    const info = m[3] || "";
    const body = m[4].replace(/\n$/, "");
    const path = (info.match(PATH_RE)?.[1] || before.match(PATH_RE)?.[1] || "").replace(/^\.?\//, "");
    if (path && body.trim()) files[path] = body;
  }

  return files;
}

// ── Incremental streaming parser ────────────────────────────────────────────────────────────
// Feed it the coder's output chunk-by-chunk; it emits events as <file> blocks open, grow and close
// so the UI can show files being written LIVE (instead of waiting for the whole response). A file
// left open at the end (truncated response) is still finalized with what we got — so the user
// always sees real files, never a blank editor + a format error.
export type StreamFileEvent =
  | { kind: "open"; path: string }
  | { kind: "delta"; path: string; chunk: string }
  | { kind: "close"; path: string; content: string };

export function createFileStreamParser() {
  let buf = "";
  let scan = 0; // index up to which we've searched for the next <file> open
  let cur: { path: string; contentStart: number; emitted: number; headerDone: boolean } | null = null;
  const OPEN = /<file\s+path="([^"]+)"\s*>\n?/g;
  const CLOSE = "</file>";
  const stripTrail = (s: string) => s.replace(/\n?```\s*$/, "").replace(/\n$/, "");

  return {
    push(chunk: string): StreamFileEvent[] {
      buf += chunk;
      const out: StreamFileEvent[] = [];
      let go = true;
      while (go) {
        go = false;
        if (!cur) {
          OPEN.lastIndex = scan;
          const m = OPEN.exec(buf);
          if (m) {
            const path = m[1].trim().replace(/^\.?\//, "");
            cur = { path, contentStart: OPEN.lastIndex, emitted: 0, headerDone: false };
            scan = OPEN.lastIndex;
            out.push({ kind: "open", path });
            go = true;
          }
        } else {
          // Strip an optional leading ```lang\n fence once the first line is visible.
          if (!cur.headerDone) {
            const head = buf.slice(cur.contentStart);
            const fm = head.match(/^```[a-zA-Z0-9]*\n/);
            if (fm) { cur.contentStart += fm[0].length; cur.headerDone = true; }
            else if (head.includes("\n") || head.length > 12) cur.headerDone = true;
            else break; // not enough yet to decide — wait for more
          }
          const closeIdx = buf.indexOf(CLOSE, cur.contentStart);
          if (closeIdx !== -1) {
            out.push({ kind: "close", path: cur.path, content: stripTrail(buf.slice(cur.contentStart, closeIdx)) });
            scan = closeIdx + CLOSE.length;
            cur = null;
            go = true;
          } else {
            // Emit new content incrementally, holding back the last few chars so we never split a
            // "</file>" (7) or a trailing "```" (3) marker across two deltas.
            const raw = buf.slice(cur.contentStart);
            const safeEnd = Math.max(cur.emitted, raw.length - 8);
            if (safeEnd > cur.emitted) {
              out.push({ kind: "delta", path: cur.path, chunk: raw.slice(cur.emitted, safeEnd) });
              cur.emitted = safeEnd;
            }
          }
        }
      }
      return out;
    },
    finish(): StreamFileEvent[] {
      const out: StreamFileEvent[] = [];
      if (cur) {
        out.push({ kind: "close", path: cur.path, content: stripTrail(buf.slice(cur.contentStart)) });
        cur = null;
      }
      return out;
    },
    buffer: () => buf,
  };
}

// Compact representation of the current project for an aux model's context (path + size only when
// big, full content when small) so we don't blow the token budget on every call.
// Budget is generous (200KB ≈ 50k tokens — well within Claude's context, and prompt-cached across
// turns): if a file the coder must EDIT is omitted, its search/replace patches can't match the real
// file and the change silently fails. Full context = reliable edits.
export function summariseFiles(files: FileMap, maxBytes = 200_000): string {
  const entries = Object.entries(files);
  if (entries.length === 0) return "(empty project)";

  let budget = maxBytes;
  const parts: string[] = [];
  for (const [path, content] of entries.sort((a, b) => a[1].length - b[1].length)) {
    if (budget > content.length) {
      parts.push(`--- ${path} ---\n${content}`);
      budget -= content.length;
    } else {
      parts.push(`--- ${path} --- (${content.length} bytes, omitted)`);
    }
  }
  return parts.join("\n\n");
}
