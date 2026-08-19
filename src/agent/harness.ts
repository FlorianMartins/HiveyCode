/**
 * 🐝 Harness — the reasoning kernel.
 *
 * WHY THIS EXISTS
 * ---------------
 * The agent loop was a flat `for` loop that pushed onto a `messages` array and yielded UI events
 * inline. Everything the product needs to do *around* reasoning — check a written file, stop a
 * run that has gone over budget, ask the user before spending — had nowhere to live except
 * inside that loop, so the loop was the only place any of it could be tested, which meant none
 * of it was.
 *
 * This is the same reasoning model DeepSeek Harness popularised (and the Cordis paradigm behind
 * it), implemented here from scratch: no dependency on it, no DeepSeek API, no token spent
 * anywhere new. It runs on the providers HiveyCode already calls.
 *
 *   1. THE LOG IS THE TRUTH. Every fact the model may see is appended to an ordered session log,
 *      and each step DERIVES the request from that log. The transcript therefore cannot drift
 *      from what was actually sent, and the UI can be rebuilt from it at any time — which is why
 *      `streamTurn` simply hands the log to the caller as it grows.
 *
 *   2. ADMISSION BEFORE EVERY STEP. `agent/pre-step` runs as a waterfall; a listener may rewrite
 *      the request or reject it, closing the turn having spent nothing. For a product whose bill
 *      is 88–99% coder tokens, refusing before the call is the only refusal worth anything.
 *
 *   3. REVERSIBLE REGISTRATION. Mounting a plugin returns a handle that unwinds everything it
 *      registered, so a behaviour can be added, tested and removed on its own.
 */

export type SessionEventType =
  | "system/prompt"
  | "turn/start"
  | "step/start"
  | "user/message"
  | "assistant/message"
  | "tool/call"
  | "tool/result"
  | "step/end"
  | "turn/end";

/** Durable facts. The model's view is a projection of these, so anything model-visible is here. */
export const DURABLE: ReadonlySet<string> = new Set<SessionEventType>([
  "system/prompt", "turn/start", "step/start", "user/message",
  "assistant/message", "tool/call", "tool/result", "step/end", "turn/end",
]);

export interface SessionEvent {
  seq: number;
  t: number;
  type: SessionEventType;
  [k: string]: unknown;
}

export interface ToolCallRecord {
  id: string;
  name: string;
  input: unknown;
}

export interface LlmSeam {
  /** Map one durable event to zero or more provider-shaped messages. */
  project(e: SessionEvent, i: number, all: SessionEvent[]): unknown | unknown[] | null;
  runTurn(req: { messages: unknown[]; tools: unknown[]; signal?: AbortSignal }): Promise<{
    text: string;
    raw?: unknown;
    toolCalls?: ToolCallRecord[];
  }>;
}

export interface ToolsSeam {
  list(): unknown[];
  execute(name: string, input: unknown): Promise<unknown>;
}

type Listener = (payload: any, next?: (v: any) => Promise<any>) => any;

export interface Harness {
  provide<T>(key: string, impl: T): () => void;
  get<T>(key: string): T;
  has(key: string): boolean;
  on(name: string, fn: Listener, order?: number): () => void;
  emit<T>(name: string, payload: T): Promise<T>;
  waterfall<T>(name: string, payload: T, terminal?: (v: any) => any): Promise<any>;
  plug<C>(plugin: Plugin<C>, config?: C): { name: string; dispose(): void; value: unknown };
  append(type: SessionEventType, data?: Record<string, unknown>): SessionEvent;
  events(): SessionEvent[];
  deriveMessages(project: LlmSeam["project"]): unknown[];
  onError: ((event: string, error: unknown) => void) | null;
}

export interface Plugin<C = unknown> {
  name: string;
  apply(ctx: Harness, config?: C): unknown;
}

export function createHarness(opts: { now?: () => number } = {}): Harness {
  const now = opts.now || (() => Date.now());
  const services = new Map<string, unknown>();
  const listeners = new Map<string, { fn: Listener; order: number }[]>();
  const log: SessionEvent[] = [];
  let seq = 0;

  const ctx: Harness = {
    provide(key, impl) {
      const had = services.has(key);
      const prev = services.get(key);
      services.set(key, impl);
      return () => {
        if (services.get(key) !== impl) return;
        if (had) services.set(key, prev);
        else services.delete(key);
      };
    },
    get<T>(key: string): T {
      if (!services.has(key)) throw new Error(`harness: no provider for "${key}"`);
      return services.get(key) as T;
    },
    has: (key) => services.has(key),

    on(name, fn, order = 100) {
      const arr = listeners.get(name) || [];
      const entry = { fn, order };
      arr.push(entry);
      // Declared order, so a guard states once that it runs before another guard instead of
      // depending on which plugin happened to be mounted first.
      arr.sort((a, b) => a.order - b.order);
      listeners.set(name, arr);
      return () => {
        const cur = listeners.get(name) || [];
        const i = cur.indexOf(entry);
        if (i >= 0) cur.splice(i, 1);
      };
    },

    async emit(name, payload) {
      for (const { fn } of listeners.get(name) || []) {
        try { await fn(payload); } catch (e) { ctx.onError?.(name, e); }
      }
      return payload;
    },

    // A listener that returns without calling next() has taken the decision. That is a rejection.
    async waterfall(name, payload, terminal) {
      const chain = (listeners.get(name) || []).map((l) => l.fn);
      let i = -1;
      const next = async (value: any): Promise<any> => {
        i++;
        if (i < chain.length) return chain[i](value, next);
        return terminal ? terminal(value) : value;
      };
      return next(payload);
    },

    plug(plugin, config) {
      const undo: (() => void)[] = [];
      const scoped: Harness = Object.create(ctx);
      scoped.provide = (k, impl) => { const d = ctx.provide(k, impl); undo.push(d); return d; };
      scoped.on = (n, fn, order) => { const d = ctx.on(n, fn, order); undo.push(d); return d; };
      scoped.plug = (p, c) => { const h = ctx.plug(p as Plugin<unknown>, c); undo.push(h.dispose); return h; };
      const value = plugin.apply(scoped, config);
      return {
        name: plugin.name,
        value,
        dispose() { while (undo.length) undo.pop()!(); },
      };
    },

    append(type, data = {}) {
      const event: SessionEvent = { seq: seq++, t: now(), type, ...data };
      log.push(event);
      // Broadcast AFTER appending: a listener that reads the log must already see the event it
      // is being told about, or the UI renders a turn that does not exist yet.
      void ctx.emit("session/event", event);
      return event;
    },
    events: () => log.slice(),

    // `project` gets its position because providers batch: the results of one step's parallel
    // tool calls belong in a single message for some wire formats.
    deriveMessages(project) {
      const durable = log.filter((e) => DURABLE.has(e.type));
      const out: unknown[] = [];
      for (let i = 0; i < durable.length; i++) {
        const m = project(durable[i], i, durable);
        if (m) out.push(...(Array.isArray(m) ? m : [m]));
      }
      return out;
    },
    onError: null,
  };

  return ctx;
}

export interface TurnResult {
  text: string;
  steps: number;
  done: boolean;
  reason: "done" | "step-limit" | "aborted" | "rejected" | "error";
  detail?: string;
}

/**
 * A STEP is one model request plus the tools it calls; a TURN is zero or more steps, closing once
 * nothing is owed. Extension points:
 *
 *   agent/pre-step      waterfall  rewrite or REJECT the messages about to be sent
 *   agent/request       waterfall  wrap the provider call (retry, telemetry, model choice)
 *   tools/pre-execute   waterfall  approve, deny or rewrite a tool call
 *   tools/post-execute  waterfall  transform a result before the model sees it
 *   agent/turn-stopping serial     last word — may demand another step
 */
export async function runTurn(
  ctx: Harness,
  { maxSteps = 12, signal }: { maxSteps?: number; signal?: AbortSignal } = {},
): Promise<TurnResult> {
  const llm = ctx.get<LlmSeam>("llm");
  const tools = ctx.has("tools") ? ctx.get<ToolsSeam>("tools") : null;

  ctx.append("turn/start");
  let steps = 0;
  let lastText = "";

  try {
    for (;;) {
      if (signal?.aborted) {
        ctx.append("turn/end", { reason: "aborted" });
        return { text: lastText, steps, done: false, reason: "aborted" };
      }
      if (steps >= maxSteps) {
        ctx.append("turn/end", { reason: "step-limit" });
        return { text: lastText, steps, done: false, reason: "step-limit" };
      }

      const derived = ctx.deriveMessages(llm.project);
      const admitted = await ctx.waterfall("agent/pre-step", { messages: derived, step: steps }, (v) => v);
      if (!admitted || admitted.reject) {
        const detail = admitted?.reject as string | undefined;
        ctx.append("turn/end", { reason: "rejected", detail });
        return { text: lastText, steps, done: false, reason: "rejected", detail };
      }

      steps++;
      ctx.append("step/start", { step: steps });

      const request = { messages: admitted.messages, tools: tools ? tools.list() : [], signal };
      const turn = await ctx.waterfall("agent/request", request, (req: any) => llm.runTurn(req));

      lastText = turn.text || "";
      ctx.append("assistant/message", { text: lastText, raw: turn.raw, calls: (turn.toolCalls || []).length });

      const calls: ToolCallRecord[] = turn.toolCalls || [];
      if (calls.length && tools) {
        for (const call of calls) {
          ctx.append("tool/call", { step: steps, id: call.id, name: call.name, input: call.input });
          // A denied call still produces a RESULT. Dropping it silently desynchronises the
          // provider's call/result pairing, and the model then answers as if the tool had run.
          const executed = await ctx.waterfall(
            "tools/pre-execute",
            { call, deny: null as string | null },
            async (d: any) => (d.deny ? { error: d.deny } : tools.execute(call.name, call.input)),
          );
          const result = await ctx.waterfall("tools/post-execute", { call, result: executed }, (v: any) => v.result);
          ctx.append("tool/result", {
            step: steps, id: call.id, name: call.name, result,
            isError: !!(result && typeof result === "object" && (result as any).error),
          });
        }
        ctx.append("step/end", { step: steps, owed: true });
        continue;
      }

      ctx.append("step/end", { step: steps, owed: false });

      const closing = { text: lastText, steps, continue: false, reason: "" };
      await ctx.emit("agent/turn-stopping", closing);
      if (closing.continue) {
        if (closing.reason) ctx.append("user/message", { text: closing.reason, injected: true });
        continue;
      }

      ctx.append("turn/end", { reason: "done" });
      return { text: lastText, steps, done: true, reason: "done" };
    }
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e);
    ctx.append("turn/end", { reason: "error", detail });
    return { text: lastText, steps, done: false, reason: "error", detail };
  }
}

/**
 * The same turn, handed to the caller as the log grows. The UI is meant to render FROM the
 * session log rather than from bespoke callbacks: one event stream describes the run, and
 * whatever renders it (chat, terminal, transcript, replay) is downstream of the same facts.
 */
export async function* streamTurn(
  ctx: Harness,
  opts: { maxSteps?: number; signal?: AbortSignal } = {},
): AsyncGenerator<SessionEvent, TurnResult> {
  const queue: SessionEvent[] = [];
  let wake: (() => void) | null = null;
  const off = ctx.on("session/event", (e: SessionEvent) => {
    queue.push(e);
    wake?.();
  }, 0);

  let result: TurnResult | null = null;
  let failed: unknown = null;
  const running = runTurn(ctx, opts).then(
    (r) => { result = r; },
    (e) => { failed = e; },
  ).finally(() => wake?.());

  try {
    for (;;) {
      while (queue.length) yield queue.shift()!;
      if (result || failed) break;
      // Wait for either the next event or the turn finishing. Without the race, a turn that
      // ends while the queue is empty would hang here forever.
      await new Promise<void>((resolve) => { wake = resolve; });
      wake = null;
    }
    while (queue.length) yield queue.shift()!;
  } finally {
    off();
    await running;
  }

  if (failed) throw failed;
  return result!;
}

/** The only way to put context in front of the model — and it goes through the log. */
export function inject(ctx: Harness, text: string, meta: Record<string, unknown> = {}): SessionEvent {
  return ctx.append("user/message", { text, injected: true, ...meta });
}
