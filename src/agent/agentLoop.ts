import type { FileMap } from "./types";
import { callORTools, type ToolDef, type ToolCall } from "./openrouter";
import { modelFor } from "./models";
import { reasoningFor } from "./orchestrator";
import { verifyInSandbox } from "./sandbox";
import { listTools, callTool } from "./mcp-client";
import { resolveTarget } from "./providers";
import { layoutLintPlugin } from "./layoutLint";
import { createHarness, streamTurn, inject, type LlmSeam, type ToolsSeam } from "./harness";

/**
 * 🐝 Autonomous agent loop — think → act → observe, grounded in real execution.
 *
 * The model is handed tools (project read/write/list, a real sandbox typecheck, plus any MCP
 * tools configured) and decides for itself which to call, observes the results and iterates.
 *
 * The loop itself lives in ./harness: this file only supplies the two seams it needs (a model
 * and a tool set) and mounts the policies as plugins. That separation is the point — the
 * layout lint below could not previously exist here at all, because there was no seam to hang
 * it on and no way to test it without a live model.
 */

const AGENT_SYSTEM =
  "You are OpenClaude, an AUTONOMOUS coding agent working in a terminal. You have TOOLS and must USE " +
  "them to accomplish the task — do not just describe. Typical flow: list_files / read_file to " +
  "understand, write_file to edit (write the COMPLETE file), typecheck to VERIFY, fix if red, repeat. " +
  "Use MCP tools when they help. Keep the project a runnable Vite + React + TS app. When the task is " +
  "done and typecheck is green, stop calling tools and give a SHORT summary. Terse, CLI tone.";

export type AgentLoopEvent =
  | { type: "token"; text: string }
  | { type: "tool"; name: string; detail: string }
  | { type: "tool_result"; name: string; summary: string }
  | { type: "file"; path: string; content: string }
  | { type: "error"; message: string }
  | { type: "done" };

export interface AgentLoopRequest {
  input: string;
  files: FileMap;
  apiKey: string;
  variant: string;
  reasoning?: "off" | "high" | "max";
  memory?: string;
  mcpServers?: { name: string; url: string }[];
  keys?: Record<string, string>;
  localBaseUrls?: Record<string, string>;
}

const BUILTIN_TOOLS: ToolDef[] = [
  { type: "function", function: { name: "list_files", description: "List all project file paths.", parameters: { type: "object", properties: {} } } },
  { type: "function", function: { name: "read_file", description: "Read a file's content.", parameters: { type: "object", properties: { path: { type: "string" } }, required: ["path"] } } },
  {
    type: "function",
    function: {
      name: "write_file",
      description: "Create or overwrite a file with the COMPLETE new content.",
      parameters: { type: "object", properties: { path: { type: "string" }, content: { type: "string" } }, required: ["path", "content"] },
    },
  },
  { type: "function", function: { name: "typecheck", description: "Run a real TypeScript type-check in the sandbox; returns errors or 'ok'.", parameters: { type: "object", properties: {} } } },
];

/** What a tool hands back to the loop. `files` is what the UI must render as a project change. */
interface ToolOutcome {
  output: string;
  summary: string;
  detail: string;
  files: { path: string; content: string }[];
}

const MAX_STEPS = 8;

export async function* runAgentLoop(req: AgentLoopRequest): AsyncGenerator<AgentLoopEvent> {
  const { input, files, apiKey, variant, reasoning, memory, mcpServers = [], keys = {}, localBaseUrls = {} } = req;
  const project: FileMap = { ...files };
  const tgt = resolveTarget(variant, { openrouter: apiKey || "", ...keys }, localBaseUrls);
  const model = tgt.hivey ? modelFor(variant, "coder") : tgt.model;

  // Discover MCP tools and namespace them so two servers cannot collide on a name.
  const mcpMap = new Map<string, { url: string; original: string }>();
  const tools: ToolDef[] = [...BUILTIN_TOOLS];
  for (const srv of mcpServers) {
    try {
      for (const t of await listTools(srv.url)) {
        const ns = `mcp__${srv.name}__${t.name}`.replace(/[^a-zA-Z0-9_]/g, "_");
        mcpMap.set(ns, { url: srv.url, original: t.name });
        tools.push({ type: "function", function: { name: ns, description: `[MCP ${srv.name}] ${t.description || t.name}`, parameters: t.inputSchema || { type: "object", properties: {} } } });
      }
    } catch {
      // server unreachable → skip it
    }
  }

  const ctx = createHarness();
  const fileList = Object.keys(project).sort().join("\n") || "(empty project)";
  ctx.append("system/prompt", { text: AGENT_SYSTEM });
  inject(ctx, (memory ? `${memory}\n\n` : "") + `PROJECT FILES:\n${fileList}\n\nTASK:\n${input}`);

  const llm: LlmSeam = {
    // OpenAI wire format. One message per event — no batching, because this API pairs each
    // result with its own tool_call_id rather than grouping a step's results together.
    project(e) {
      if (e.type === "system/prompt") return { role: "system", content: e.text };
      if (e.type === "user/message") return { role: "user", content: e.text };
      if (e.type === "assistant/message") {
        const calls = e.raw as ToolCall[] | undefined;
        if (!calls?.length && !e.text) return null; // an empty assistant turn carries nothing
        return { role: "assistant", content: (e.text as string) || null, ...(calls?.length ? { tool_calls: calls } : {}) };
      }
      if (e.type === "tool/result") {
        return { role: "tool", tool_call_id: e.id, content: String((e.result as ToolOutcome)?.output ?? "").slice(0, 8000) };
      }
      return null;
    },
    async runTurn(request) {
      const effReason = reasoning && reasoning !== "off" ? reasoning : reasoningFor(model);
      const { content, toolCalls } = await callORTools({
        model, messages: request.messages as any[], tools: request.tools as ToolDef[],
        apiKey: tgt.apiKey, baseUrl: tgt.baseUrl, maxTokens: 4000, reasoning: effReason,
      });
      return {
        text: content || "",
        raw: toolCalls,                              // the provider's own shape, replayed verbatim
        toolCalls: toolCalls.map((c) => ({ id: c.id, name: c.function.name, input: c })),
      };
    },
  };

  const toolsSeam: ToolsSeam = {
    list: () => tools,
    execute: (_name, input) => execute(input as ToolCall, project, mcpMap),
  };

  ctx.provide("llm", llm);
  ctx.provide("tools", toolsSeam);
  ctx.plug(layoutLintPlugin(project));

  // The UI is rendered FROM the session log rather than from callbacks threaded through the
  // loop: one stream of facts describes the run, and everything downstream reads the same one.
  try {
    for await (const e of streamTurn(ctx, { maxSteps: MAX_STEPS })) {
      if (e.type === "assistant/message" && e.text) yield { type: "token", text: `${e.text}\n` };
      if (e.type === "tool/result") {
        const out = e.result as ToolOutcome;
        yield { type: "tool", name: e.name as string, detail: out.detail };
        for (const f of out.files) yield { type: "file", path: f.path, content: f.content };
        yield { type: "tool_result", name: e.name as string, summary: out.summary };
      }
      if (e.type === "turn/end" && e.reason === "step-limit") {
        yield { type: "token", text: "\n(reached the step limit — ask me to continue.)\n" };
      }
      if (e.type === "turn/end" && e.reason === "error") {
        yield { type: "error", message: String(e.detail) };
      }
    }
  } catch (e) {
    yield { type: "error", message: e instanceof Error ? e.message : String(e) };
  }
  yield { type: "done" };
}

async function execute(
  call: ToolCall,
  project: FileMap,
  mcpMap: Map<string, { url: string; original: string }>,
): Promise<ToolOutcome> {
  let args: any = {};
  try {
    args = JSON.parse(call.function.arguments || "{}");
  } catch {
    return { output: "invalid JSON arguments", summary: "bad args", detail: call.function.name, files: [] };
  }
  const name = call.function.name;

  if (name === "list_files") {
    const list = Object.keys(project).sort().join("\n") || "(empty)";
    return { output: list, summary: `${Object.keys(project).length} files`, detail: "list_files", files: [] };
  }
  if (name === "read_file") {
    const c = project[args.path];
    return { output: c ?? `not found: ${args.path}`, summary: c ? "read" : "not found", detail: `read ${args.path}`, files: [] };
  }
  if (name === "write_file") {
    if (!args.path || typeof args.content !== "string") return { output: "path and content required", summary: "error", detail: "write_file", files: [] };
    project[args.path] = args.content;
    return { output: `wrote ${args.path}`, summary: `wrote ${args.path}`, detail: `write ${args.path}`, files: [{ path: args.path, content: args.content }] };
  }
  if (name === "typecheck") {
    const r = await verifyInSandbox(project, "typecheck");
    if (r === null) return { output: "typecheck unavailable (no tsconfig or runner down)", summary: "skipped", detail: "typecheck", files: [] };
    return { output: r.ok ? "ok — no type errors" : r.output, summary: r.ok ? "✓ green" : "✗ errors", detail: "typecheck", files: [] };
  }

  const mcp = mcpMap.get(name);
  if (mcp) {
    try {
      return { output: await callTool(mcp.url, mcp.original, args), summary: "ok", detail: `MCP ${mcp.original}`, files: [] };
    } catch (e) {
      return { output: "MCP error: " + (e instanceof Error ? e.message : String(e)), summary: "✗ error", detail: `MCP ${mcp.original}`, files: [] };
    }
  }

  return { output: `unknown tool: ${name}`, summary: "unknown", detail: name, files: [] };
}
