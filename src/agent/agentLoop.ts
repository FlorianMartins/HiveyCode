import type { FileMap, HiveyVariant } from "./types";
import { callORTools, type ToolDef, type ToolCall } from "./openrouter";
import { modelFor } from "./models";
import { reasoningFor } from "./orchestrator";
import { verifyInSandbox } from "./sandbox";
import { listTools, callTool } from "./mcp-client";
import { resolveTarget } from "./providers";

/**
 * 🐝 OpenClaude autonomous agent loop — the OpenHands-style think→act→observe cycle. The model is
 * given TOOLS (project read/write/list + real sandbox typecheck + any configured MCP tools) and
 * decides itself which to call, observes the results, and iterates until the task is done. Grounded
 * in real execution (typecheck) and real external tools (MCP).
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

export async function* runAgentLoop(req: AgentLoopRequest): AsyncGenerator<AgentLoopEvent> {
  const { input, files, apiKey, variant, reasoning, memory, mcpServers = [], keys = {}, localBaseUrls = {} } = req;
  const project: FileMap = { ...files };
  const tgt = resolveTarget(variant, { openrouter: apiKey || "", ...keys }, localBaseUrls);
  const model = tgt.hivey ? modelFor(variant, "coder") : tgt.model;

  // Discover MCP tools and build a name → {url, original} map (namespaced to avoid clashes).
  const mcpMap = new Map<string, { url: string; original: string }>();
  const tools: ToolDef[] = [...BUILTIN_TOOLS];
  for (const srv of mcpServers) {
    try {
      const list = await listTools(srv.url);
      for (const t of list) {
        const ns = `mcp__${srv.name}__${t.name}`.replace(/[^a-zA-Z0-9_]/g, "_");
        mcpMap.set(ns, { url: srv.url, original: t.name });
        tools.push({ type: "function", function: { name: ns, description: `[MCP ${srv.name}] ${t.description || t.name}`, parameters: t.inputSchema || { type: "object", properties: {} } } });
      }
    } catch {
      // server unreachable → skip it
    }
  }

  const fileList = Object.keys(project).sort().join("\n") || "(empty project)";
  const messages: any[] = [
    { role: "system", content: AGENT_SYSTEM },
    { role: "user", content: (memory ? `${memory}\n\n` : "") + `PROJECT FILES:\n${fileList}\n\nTASK:\n${input}` },
  ];

  const MAX_STEPS = 8;
  try {
    for (let step = 0; step < MAX_STEPS; step++) {
      const effReason = reasoning && reasoning !== "off" ? reasoning : reasoningFor(model);
      const { content, toolCalls } = await callORTools({ model, messages, tools, apiKey: tgt.apiKey, baseUrl: tgt.baseUrl, maxTokens: 4000, reasoning: effReason });

      if (content) yield { type: "token", text: content + "\n" };

      if (!toolCalls.length) {
        yield { type: "done" };
        return;
      }

      messages.push({ role: "assistant", content: content || null, tool_calls: toolCalls });

      for (const call of toolCalls) {
        const out = await execute(call, project, mcpMap);
        yield { type: "tool", name: call.function.name, detail: out.detail };
        for (const f of out.files) yield { type: "file", path: f.path, content: f.content };
        yield { type: "tool_result", name: call.function.name, summary: out.summary };
        messages.push({ role: "tool", tool_call_id: call.id, content: out.output.slice(0, 8000) });
      }
    }
    yield { type: "token", text: "\n(reached the step limit — ask me to continue.)\n" };
    yield { type: "done" };
  } catch (e) {
    yield { type: "error", message: e instanceof Error ? e.message : String(e) };
    yield { type: "done" };
  }
}

async function execute(
  call: ToolCall,
  project: FileMap,
  mcpMap: Map<string, { url: string; original: string }>,
): Promise<{ output: string; summary: string; detail: string; files: { path: string; content: string }[] }> {
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
      const out = await callTool(mcp.url, mcp.original, args);
      return { output: out, summary: "ok", detail: `MCP ${mcp.original}`, files: [] };
    } catch (e) {
      return { output: "MCP error: " + (e instanceof Error ? e.message : String(e)), summary: "✗ error", detail: `MCP ${mcp.original}`, files: [] };
    }
  }

  return { output: `unknown tool: ${name}`, summary: "unknown", detail: name, files: [] };
}
