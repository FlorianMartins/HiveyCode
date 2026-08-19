// Tests for the reasoning kernel (src/agent/harness.ts).
//
// The kernel's purpose is to make agent behaviour observable and testable without a model, a
// network or a sandbox. So these tests mount a scripted `llm` seam and assert on the SESSION
// LOG — the same artefact the model's view is projected from. A behaviour that cannot be seen
// in the log is a behaviour the model cannot see either.

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createHarness, runTurn, streamTurn, inject, DURABLE,
  type Harness, type SessionEvent, type LlmSeam, type ToolsSeam,
} from "../src/agent/harness.js";

interface Reply { text?: string; toolCalls?: { id: string; name: string; input: unknown }[] }

function scriptedLlm(replies: Reply[]) {
  let i = 0;
  const seen: string[] = [];
  const seam: LlmSeam & { seen: string[] } = {
    seen,
    project(e) {
      if (e.type === "user/message") return { role: "user", content: e.text };
      if (e.type === "assistant/message") return { role: "assistant", content: e.text };
      if (e.type === "tool/result") return { role: "tool", content: JSON.stringify(e.result) };
      return null;
    },
    async runTurn(req) {
      seen.push((req.messages as any[]).map((m) => `${m.role}:${m.content}`).join("|"));
      const r = replies[Math.min(i, replies.length - 1)];
      i++;
      return { text: r.text || "", raw: { role: "assistant" }, toolCalls: r.toolCalls || [] };
    },
  };
  return seam;
}

const echoTools: ToolsSeam = {
  list: () => [{ name: "echo" }],
  execute: async (name, input) => ({ ok: true, name, input }),
};

const typesOf = (ctx: Harness) => ctx.events().map((e) => e.type);

// ── Seams ──────────────────────────────────────────────────────────────────────────────────

test("a seam can be provided, read, and restored on dispose", () => {
  const ctx = createHarness();
  assert.equal(ctx.has("llm"), false);
  const undoA = ctx.provide("llm", { id: "a" });
  const undoB = ctx.provide("llm", { id: "b" });
  assert.equal(ctx.get<{ id: string }>("llm").id, "b");
  undoB();
  assert.equal(ctx.get<{ id: string }>("llm").id, "a");
  undoA();
  assert.equal(ctx.has("llm"), false);
});

test("a missing seam throws instead of returning undefined", () => {
  assert.throws(() => createHarness().get("nope"), /no provider for "nope"/);
});

// ── Events ─────────────────────────────────────────────────────────────────────────────────

test("listeners run in declared order, not registration order", async () => {
  const ctx = createHarness();
  const order: string[] = [];
  ctx.on("x", () => order.push("late"), 200);
  ctx.on("x", () => order.push("early"), 10);
  await ctx.emit("x", {});
  assert.deepEqual(order, ["early", "late"]);
});

test("a throwing listener cannot take down the emit", async () => {
  const ctx = createHarness();
  const errors: string[] = [];
  ctx.onError = (_e, err) => errors.push((err as Error).message);
  let reached = false;
  ctx.on("x", () => { throw new Error("boom"); }, 10);
  ctx.on("x", () => { reached = true; }, 20);
  await ctx.emit("x", {});
  assert.equal(reached, true);
  assert.deepEqual(errors, ["boom"]);
});

test("a waterfall delegates through next() to the terminal", async () => {
  const ctx = createHarness();
  ctx.on("w", (v, next) => next!({ n: v.n + 1 }), 10);
  ctx.on("w", (v, next) => next!({ n: v.n * 10 }), 20);
  assert.deepEqual(await ctx.waterfall("w", { n: 1 }, (v) => ({ n: v.n + 100 })), { n: 120 });
});

test("not calling next() short-circuits the terminal entirely", async () => {
  const ctx = createHarness();
  let terminalRan = false;
  ctx.on("w", () => ({ decided: true }), 10);
  const out = await ctx.waterfall("w", {}, () => { terminalRan = true; return {}; });
  assert.deepEqual(out, { decided: true });
  assert.equal(terminalRan, false);
});

// ── Plugins ────────────────────────────────────────────────────────────────────────────────

test("disposing a plugin unwinds every registration it made", async () => {
  const ctx = createHarness();
  const hits: string[] = [];
  const handle = ctx.plug({
    name: "demo",
    apply(c) { c.provide("thing", { v: 1 }); c.on("e", () => hits.push("x")); return "applied"; },
  });
  assert.equal(handle.value, "applied");
  await ctx.emit("e", {});
  handle.dispose();
  await ctx.emit("e", {});
  assert.deepEqual(hits, ["x"], "the listener fired once, before disposal");
  assert.equal(ctx.has("thing"), false);
});

test("a nested plugin is unwound with its parent", () => {
  const ctx = createHarness();
  const child = { name: "child", apply: (c: Harness) => c.provide("child", {}) };
  const h = ctx.plug({ name: "parent", apply: (c) => { c.plug(child); c.provide("parent", {}); } });
  assert.equal(ctx.has("child"), true);
  h.dispose();
  assert.equal(ctx.has("child"), false);
  assert.equal(ctx.has("parent"), false);
});

// ── The log ────────────────────────────────────────────────────────────────────────────────

test("the log is ordered, stamped, and broadcast after the append", async () => {
  let clock = 0;
  const ctx = createHarness({ now: () => ++clock });
  const seen: [string, number][] = [];
  ctx.on("session/event", (e: SessionEvent) => seen.push([e.type, ctx.events().length]));
  ctx.append("user/message", { text: "a" });
  ctx.append("assistant/message", { text: "b" });
  assert.deepEqual(ctx.events().map((e) => e.seq), [0, 1]);
  assert.deepEqual(ctx.events().map((e) => e.t), [1, 2]);
  assert.deepEqual(seen, [["user/message", 1], ["assistant/message", 2]]);
});

test("events() hands out a copy, so a caller cannot corrupt the log", () => {
  const ctx = createHarness();
  ctx.append("user/message", { text: "a" });
  ctx.events().push({ seq: 99, t: 0, type: "user/message" });
  assert.equal(ctx.events().length, 1);
});

test("every event type the loop appends is declared durable", async () => {
  const ctx = createHarness();
  ctx.provide("llm", scriptedLlm([{ text: "done" }]));
  inject(ctx, "go");
  await runTurn(ctx);
  for (const t of typesOf(ctx)) assert.equal(DURABLE.has(t), true, `"${t}" is logged but not durable`);
});

// ── The reasoning loop ─────────────────────────────────────────────────────────────────────

test("a turn with no tool calls runs exactly one step", async () => {
  const ctx = createHarness();
  ctx.provide("llm", scriptedLlm([{ text: "hello" }]));
  inject(ctx, "hi");
  const r = await runTurn(ctx);
  assert.deepEqual([r.done, r.steps, r.text], [true, 1, "hello"]);
  assert.deepEqual(typesOf(ctx), [
    "user/message", "turn/start", "step/start", "assistant/message", "step/end", "turn/end",
  ]);
});

test("a tool call owes another step; call and result are both logged", async () => {
  const ctx = createHarness();
  ctx.provide("llm", scriptedLlm([
    { toolCalls: [{ id: "1", name: "echo", input: { a: 1 } }] },
    { text: "finished" },
  ]));
  ctx.provide("tools", echoTools);
  inject(ctx, "use it");
  const r = await runTurn(ctx);
  assert.equal(r.steps, 2);
  assert.deepEqual(typesOf(ctx), [
    "user/message", "turn/start",
    "step/start", "assistant/message", "tool/call", "tool/result", "step/end",
    "step/start", "assistant/message", "step/end",
    "turn/end",
  ]);
  assert.equal(ctx.events().find((e) => e.type === "tool/result")!.isError, false);
});

test("the model's view is rebuilt from the log on every step", async () => {
  const llm = scriptedLlm([{ toolCalls: [{ id: "1", name: "echo", input: {} }] }, { text: "done" }]);
  const ctx = createHarness();
  ctx.provide("llm", llm);
  ctx.provide("tools", echoTools);
  inject(ctx, "start");
  await runTurn(ctx);
  assert.equal(llm.seen[0], "user:start");
  assert.match(llm.seen[1], /^user:start\|assistant:\|tool:/);
});

test("a rejected pre-step closes the turn without calling the model", async () => {
  const ctx = createHarness();
  const llm = scriptedLlm([{ text: "never" }]);
  ctx.provide("llm", llm);
  ctx.on("agent/pre-step", () => ({ reject: "over budget" }));
  inject(ctx, "expensive");
  const r = await runTurn(ctx);
  assert.equal(r.reason, "rejected");
  assert.equal(r.detail, "over budget");
  assert.equal(llm.seen.length, 0, "not one token was spent");
  assert.equal(ctx.events().find((e) => e.type === "turn/end")!.detail, "over budget");
});

test("pre-step can rewrite what the model sees", async () => {
  const llm = scriptedLlm([{ text: "ok" }]);
  const ctx = createHarness();
  ctx.provide("llm", llm);
  ctx.on("agent/pre-step", (v, next) =>
    next!({ ...v, messages: [...v.messages, { role: "user", content: "[guard] be brief" }] }));
  inject(ctx, "q");
  await runTurn(ctx);
  assert.equal(llm.seen[0], "user:q|user:[guard] be brief");
});

test("a denied tool still logs a result, keeping call/result paired", async () => {
  const ctx = createHarness();
  ctx.provide("llm", scriptedLlm([{ toolCalls: [{ id: "1", name: "echo", input: {} }] }, { text: "ok" }]));
  let executed = false;
  ctx.provide("tools", { list: () => [], execute: async () => { executed = true; return {}; } });
  ctx.on("tools/pre-execute", () => ({ error: "denied by policy" }));
  inject(ctx, "do it");
  await runTurn(ctx);
  assert.equal(executed, false);
  const res = ctx.events().find((e) => e.type === "tool/result")!;
  assert.deepEqual(res.result, { error: "denied by policy" });
  assert.equal(res.isError, true);
});

test("post-execute can transform a result before the model sees it", async () => {
  const ctx = createHarness();
  ctx.provide("llm", scriptedLlm([{ toolCalls: [{ id: "1", name: "echo", input: {} }] }, { text: "ok" }]));
  ctx.provide("tools", echoTools);
  ctx.on("tools/post-execute", (v, next) => next!({ ...v, result: { redacted: true } }));
  inject(ctx, "go");
  await runTurn(ctx);
  assert.deepEqual(ctx.events().find((e) => e.type === "tool/result")!.result, { redacted: true });
});

test("turn-stopping can demand another step and its reason reaches the model", async () => {
  const llm = scriptedLlm([{ text: "first" }, { text: "second" }]);
  const ctx = createHarness();
  ctx.provide("llm", llm);
  let asked = 0;
  ctx.on("agent/turn-stopping", (c) => {
    if (asked++ === 0) { c.continue = true; c.reason = "[verifier] typecheck is red"; }
  });
  inject(ctx, "task");
  const r = await runTurn(ctx);
  assert.equal(r.steps, 2);
  assert.match(llm.seen[1], /typecheck is red/);
});

test("the step limit stops the loop and says so", async () => {
  const ctx = createHarness();
  ctx.provide("llm", scriptedLlm([{ toolCalls: [{ id: "1", name: "echo", input: {} }] }]));
  ctx.provide("tools", echoTools);
  inject(ctx, "loop");
  const r = await runTurn(ctx, { maxSteps: 3 });
  assert.deepEqual([r.done, r.reason, r.steps], [false, "step-limit", 3]);
});

test("a provider failure closes the turn cleanly instead of escaping", async () => {
  const ctx = createHarness();
  ctx.provide("llm", {
    project: () => null,
    async runTurn() { throw new Error("HTTP 502"); },
  });
  inject(ctx, "x");
  const r = await runTurn(ctx);
  assert.equal(r.reason, "error");
  assert.equal(r.detail, "HTTP 502");
  assert.equal(typesOf(ctx).at(-1), "turn/end", "the log still ends with a closed turn");
});

test("an already-aborted signal spends no step", async () => {
  const ctx = createHarness();
  const llm = scriptedLlm([{ text: "no" }]);
  ctx.provide("llm", llm);
  inject(ctx, "x");
  const r = await runTurn(ctx, { signal: { aborted: true } as AbortSignal });
  assert.equal(r.reason, "aborted");
  assert.equal(llm.seen.length, 0);
});

// ── Streaming ──────────────────────────────────────────────────────────────────────────────

test("streamTurn yields every event, in order, and returns the result", async () => {
  const ctx = createHarness();
  ctx.provide("llm", scriptedLlm([{ toolCalls: [{ id: "1", name: "echo", input: {} }] }, { text: "ok" }]));
  ctx.provide("tools", echoTools);
  inject(ctx, "go");

  const seen: string[] = [];
  const it = streamTurn(ctx, {});
  let res = await it.next();
  while (!res.done) { seen.push((res.value as SessionEvent).type); res = await it.next(); }

  assert.equal((res.value as any).done, true);
  assert.deepEqual(seen, [
    "turn/start",
    "step/start", "assistant/message", "tool/call", "tool/result", "step/end",
    "step/start", "assistant/message", "step/end",
    "turn/end",
  ]);
  // Streaming must not duplicate or reorder: the log and the stream agree, minus the seed.
  assert.deepEqual(seen, typesOf(ctx).slice(1));
});

test("streamTurn terminates even when a turn ends with nothing left queued", async () => {
  const ctx = createHarness();
  ctx.provide("llm", scriptedLlm([{ text: "done" }]));
  inject(ctx, "x");
  const events: SessionEvent[] = [];
  for await (const e of streamTurn(ctx, {})) events.push(e);
  assert.equal(events.at(-1)!.type, "turn/end", "the generator completed rather than hanging");
});

test("streamTurn stops cleanly when the consumer breaks early", async () => {
  const ctx = createHarness();
  ctx.provide("llm", scriptedLlm([{ text: "done" }]));
  inject(ctx, "x");
  for await (const e of streamTurn(ctx, {})) { if (e.type === "step/start") break; }
  // The listener must have been removed; a further append must not throw or leak into a queue.
  ctx.append("user/message", { text: "after" });
  assert.equal(ctx.events().at(-1)!.text, "after");
});
