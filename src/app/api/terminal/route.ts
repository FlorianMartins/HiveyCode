import { runAgentLoop, type AgentLoopRequest } from "@/agent/agentLoop";

export const runtime = "nodejs";
export const maxDuration = 300;

// OpenClaude autonomous agent loop — streamed as NDJSON (one event per line). The model calls tools
// (project read/write/list, real sandbox typecheck, MCP tools) on its own and iterates.
export async function POST(req: Request) {
  let body: AgentLoopRequest;
  try {
    body = (await req.json()) as AgentLoopRequest;
  } catch {
    return new Response("Bad request", { status: 400 });
  }
  if (!body.apiKey) {
    return new Response(JSON.stringify({ type: "error", message: "Add your OpenRouter API key first." }) + "\n", {
      headers: { "content-type": "application/x-ndjson" },
    });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const ev of runAgentLoop(body)) {
          controller.enqueue(encoder.encode(JSON.stringify(ev) + "\n"));
        }
      } catch (e) {
        controller.enqueue(encoder.encode(JSON.stringify({ type: "error", message: e instanceof Error ? e.message : String(e) }) + "\n"));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, { headers: { "content-type": "application/x-ndjson", "cache-control": "no-cache" } });
}
