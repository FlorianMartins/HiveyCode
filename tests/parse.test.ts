// Tests for turning model output into files.
//
// This is the layer where a model's sloppiness becomes the user's broken project: a SEARCH block
// re-indented by two spaces, a fence the model added inside a <file> block, a path written as
// "./src/App.tsx". Each tolerance below exists because a real model did that, so each one is
// pinned here — and so is the line where tolerance must STOP and report a failure instead of
// silently writing the wrong thing.

import { test } from "node:test";
import assert from "node:assert/strict";
import { parseEdits, applyEdits, parseFileBlocks, summariseFiles } from "../src/agent/parse.js";

const edit = (path: string, search: string, replace: string) =>
  `<edit path="${path}">\n<<<<<<< SEARCH\n${search}\n=======\n${replace}\n>>>>>>> REPLACE\n</edit>`;

// ── <file> blocks ──────────────────────────────────────────────────────────────────────────

test("a file block is parsed, and a leading ./ is stripped from the path", () => {
  const out = parseFileBlocks(`<file path="./src/App.tsx">\nconst a = 1;\n</file>`);
  assert.deepEqual(out, { "src/App.tsx": "const a = 1;" });
});

test("a markdown fence the model wrapped inside the block is removed", () => {
  const out = parseFileBlocks(`<file path="src/a.ts">\n\`\`\`ts\nconst a = 1;\n\`\`\`\n</file>`);
  assert.deepEqual(out, { "src/a.ts": "const a = 1;" });
});

test("several file blocks in one response are all collected", () => {
  const text = `<file path="a.ts">A</file>\nblah\n<file path="b.ts">B</file>`;
  assert.deepEqual(parseFileBlocks(text), { "a.ts": "A", "b.ts": "B" });
});

test("prose containing no file block yields nothing rather than guessing", () => {
  assert.deepEqual(parseFileBlocks("I would suggest editing src/App.tsx to add a header."), {});
});

// ── search / replace patches ───────────────────────────────────────────────────────────────

test("a patch is parsed and applied exactly", () => {
  const { patches, fullFiles } = parseEdits(edit("a.ts", "const a = 1;", "const a = 2;"));
  const r = applyEdits({ "a.ts": "const a = 1;\nconst b = 3;\n" }, patches, fullFiles);
  assert.equal(r.files["a.ts"], "const a = 2;\nconst b = 3;\n");
  assert.deepEqual(r.changed, ["a.ts"]);
  assert.deepEqual(r.failures, []);
});

test("a SEARCH block re-indented by the model still matches, and the replacement is re-indented", () => {
  // The single most common model slip. Failing here would send the whole file back for a rewrite.
  const file = "function f() {\n    const a = 1;\n    return a;\n}\n";
  const { patches, fullFiles } = parseEdits(edit("a.ts", "const a = 1;", "const a = 42;"));
  const r = applyEdits({ "a.ts": file }, patches, fullFiles);
  assert.equal(r.files["a.ts"], "function f() {\n    const a = 42;\n    return a;\n}\n");
  assert.deepEqual(r.failures, []);
});

test("trailing whitespace differences do not break a match", () => {
  const { patches, fullFiles } = parseEdits(edit("a.ts", "const a = 1;", "const a = 2;"));
  const r = applyEdits({ "a.ts": "const a = 1;   \n" }, patches, fullFiles);
  assert.match(r.files["a.ts"], /const a = 2;/);
  assert.deepEqual(r.failures, []);
});

test("a SEARCH block that genuinely is not there is REPORTED, not silently dropped", () => {
  // The line where tolerance stops. Applying nothing while claiming success is how a build
  // reports "done" over an unchanged file.
  const { patches, fullFiles } = parseEdits(edit("a.ts", "const nowhere = 9;", "x"));
  const r = applyEdits({ "a.ts": "const a = 1;\n" }, patches, fullFiles);
  assert.equal(r.failures.length, 1);
  assert.equal(r.failures[0].path, "a.ts");
  assert.match(r.failures[0].snippet, /nowhere/);
  assert.equal(r.files["a.ts"], "const a = 1;\n", "the file is untouched");
});

test("a patch aimed at a missing file is reported instead of creating a stray one", () => {
  const { patches, fullFiles } = parseEdits(edit("ghost.ts", "something", "else"));
  const r = applyEdits({}, patches, fullFiles);
  assert.deepEqual(r.failures, [{ path: "ghost.ts", snippet: "(file not found)" }]);
  assert.deepEqual(Object.keys(r.files), []);
});

test("an empty SEARCH on a missing file creates it", () => {
  const { patches, fullFiles } = parseEdits(edit("new.ts", "", "export const a = 1;"));
  const r = applyEdits({}, patches, fullFiles);
  assert.equal(r.files["new.ts"], "export const a = 1;");
  assert.deepEqual(r.failures, []);
});

test("an empty SEARCH on an existing file appends", () => {
  const { patches, fullFiles } = parseEdits(edit("a.ts", "", "export const b = 2;"));
  const r = applyEdits({ "a.ts": "export const a = 1;" }, patches, fullFiles);
  assert.equal(r.files["a.ts"], "export const a = 1;\nexport const b = 2;");
});

test("several replacements inside one edit all apply", () => {
  const text = `<edit path="a.ts">
<<<<<<< SEARCH
const a = 1;
=======
const a = 10;
>>>>>>> REPLACE
<<<<<<< SEARCH
const b = 2;
=======
const b = 20;
>>>>>>> REPLACE
</edit>`;
  const { patches, fullFiles } = parseEdits(text);
  assert.equal(patches[0].replacements.length, 2);
  const r = applyEdits({ "a.ts": "const a = 1;\nconst b = 2;\n" }, patches, fullFiles);
  assert.equal(r.files["a.ts"], "const a = 10;\nconst b = 20;\n");
});

test("patches and whole new files arrive together and both land", () => {
  const text = `${edit("a.ts", "const a = 1;", "const a = 2;")}\n<file path="b.ts">export const b = 1;</file>`;
  const { patches, fullFiles } = parseEdits(text);
  const r = applyEdits({ "a.ts": "const a = 1;\n" }, patches, fullFiles);
  assert.equal(r.files["b.ts"], "export const b = 1;");
  assert.match(r.files["a.ts"], /const a = 2;/);
  assert.deepEqual(r.changed.sort(), ["a.ts", "b.ts"]);
});

test("applyEdits never mutates the project it was given", () => {
  const before = { "a.ts": "const a = 1;\n" };
  const { patches, fullFiles } = parseEdits(edit("a.ts", "const a = 1;", "const a = 2;"));
  applyEdits(before, patches, fullFiles);
  assert.equal(before["a.ts"], "const a = 1;\n", "the caller's map is untouched");
});

test("malformed edit markup yields no patch rather than a corrupt one", () => {
  for (const junk of [
    `<edit path="a.ts">no markers at all</edit>`,
    `<<<<<<< SEARCH\nfoo\n=======\nbar\n>>>>>>> REPLACE`, // outside any <edit>
    `<edit path="">\n<<<<<<< SEARCH\na\n=======\nb\n>>>>>>> REPLACE\n</edit>`, // no path
  ]) {
    assert.deepEqual(parseEdits(junk).patches, [], `should parse to nothing: ${junk.slice(0, 30)}`);
  }
});

// ── summarising a project for a prompt ─────────────────────────────────────────────────────

test("summariseFiles lists the project and respects its byte budget", () => {
  const files: Record<string, string> = {};
  for (let i = 0; i < 40; i++) files[`src/f${i}.ts`] = "x".repeat(2000);
  const out = summariseFiles(files, 5000);
  assert.ok(out.length <= 20000, "the summary stays bounded");
  assert.match(out, /src\/f0\.ts/);
});

test("summariseFiles handles an empty project", () => {
  assert.equal(typeof summariseFiles({}), "string");
});
